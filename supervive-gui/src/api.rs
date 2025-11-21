use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const BASE_URL: &str = "https://op.gg/supervive/";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CacheItem {
    value: Value,
    expires_at: f64,
    sliding: bool,
    sliding_ttl: f64,
}

pub struct DiskCache {
    path: PathBuf,
    data: HashMap<String, CacheItem>,
}

impl DiskCache {
    pub fn new(path: PathBuf) -> Self {
        let mut cache = Self {
            path,
            data: HashMap::new(),
        };
        cache.load();
        cache
    }

    fn load(&mut self) {
        if self.path.exists() {
            if let Ok(file) = fs::File::open(&self.path) {
                if let Ok(data) = serde_json::from_reader(file) {
                    self.data = data;
                }
            }
        }
    }

    fn save(&self) {
        if let Ok(file) = fs::File::create(&self.path) {
            let _ = serde_json::to_writer(file, &self.data);
        }
    }

    fn now() -> f64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs_f64()
    }

    pub fn get(&mut self, key: &str) -> Option<Value> {
        let now = Self::now();
        let mut save_needed = false;
        let mut value = None;
        let mut remove = false;

        if let Some(item) = self.data.get_mut(key) {
            if now >= item.expires_at {
                remove = true;
            } else {
                if item.sliding {
                    item.expires_at = now + item.sliding_ttl;
                    save_needed = true;
                }
                value = Some(item.value.clone());
            }
        }

        if remove {
            self.data.remove(key);
            self.save();
            return None;
        }

        if save_needed {
            self.save();
        }

        value
    }

    pub fn set(&mut self, key: String, value: Value, ttl_seconds: f64, sliding: bool) {
        let now = Self::now();
        self.data.insert(
            key,
            CacheItem {
                value,
                expires_at: now + ttl_seconds,
                sliding,
                sliding_ttl: if sliding { ttl_seconds } else { 0.0 },
            },
        );
        self.save();
    }
}

pub struct SuperviveService {
    client: Client,
    cache: DiskCache,
}

impl SuperviveService {
    pub fn new() -> Result<Self> {
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(15))
            .build()?;

        let cache_path = dirs::cache_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("supervive_gui_cache.json");

        Ok(Self {
            client,
            cache: DiskCache::new(cache_path),
        })
    }

    fn get_url(path: &str) -> String {
        format!("{}{}", BASE_URL.trim_end_matches('/'), path)
    }

    pub fn check_player_exists(&self, platform: &str, unique_display_name: &str) -> Result<bool> {
        let url = Self::get_url("/api/players/check");
        let resp = self
            .client
            .get(&url)
            .query(&[
                ("platform", platform),
                ("uniqueDisplayName", unique_display_name),
            ])
            .send()?
            .error_for_status()?;

        let json: Value = resp.json()?;
        let exists = json["exists"]
            .as_bool()
            .or_else(|| json["Exists"].as_bool());
        exists.context("Missing 'exists' field")
    }

    pub fn search_players(&mut self, query: &str) -> Result<Value> {
        let key = format!("search:{}", query);
        if let Some(cached) = self.cache.get(&key) {
            return Ok(cached);
        }

        let url = Self::get_url("/api/players/search");
        let resp = self
            .client
            .get(&url)
            .query(&[("query", query)])
            .send()?
            .error_for_status()?;

        let data: Value = resp.json()?;
        self.cache
            .set(key, data.clone(), 7.0 * 24.0 * 3600.0, false);
        Ok(data)
    }

    pub fn get_match(&mut self, platform: &str, match_id: &str) -> Result<Value> {
        let key = format!("match:{}:{}", platform, match_id);
        if let Some(cached) = self.cache.get(&key) {
            return Ok(cached);
        }

        let url = Self::get_url(&format!("/api/matches/{}-{}", platform, match_id));
        let resp = self.client.get(&url).send()?.error_for_status()?;

        let data: Value = resp.json()?;
        self.cache
            .set(key, data.clone(), 15.0 * 24.0 * 3600.0, true);
        Ok(data)
    }

    pub fn get_player_matches(&self, platform: &str, player_id: &str, page: i32) -> Result<Value> {
        let normalized = player_id.replace("-", "");
        let url = Self::get_url(&format!("/api/players/{}-{}/matches", platform, normalized));
        let resp = self
            .client
            .get(&url)
            .query(&[("page", page.to_string())])
            .send()?
            .error_for_status()?;

        let data: Value = resp.json()?;
        Ok(data)
    }
}
