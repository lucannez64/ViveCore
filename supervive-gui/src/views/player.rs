use gpui::*;
use gpui::prelude::*;
use crate::state::AppState;
use crate::views::OpenMatch;
use serde_json::Value;

pub struct PlayerView {
    player_id: String,
    platform: String,
    matches: Vec<Value>,
    loading: bool,
    // Statistics
    total_kills: i64,
    total_deaths: i64,
    avg_placement: f64,
    total_games: usize,
}

impl PlayerView {
    pub fn new(cx: &mut Context<Self>, player_id: String, platform: String) -> Self {
        let view = Self {
            player_id: player_id.clone(),
            platform: platform.clone(),
            matches: Vec::new(),
            loading: true,
            total_kills: 0,
            total_deaths: 0,
            avg_placement: 0.0,
            total_games: 0,
        };
        cx.spawn(async move |view, cx| {
            view.update(cx, |this, cx| this.fetch_data(cx)).ok();
        }).detach();
        view
    }

    fn fetch_data(&mut self, cx: &mut Context<Self>) {
        let app_state = cx.global::<AppState>();
        let service = app_state.service.clone();
        let player_id = self.player_id.clone();
        let platform = self.platform.clone();

        cx.spawn(async move |view, cx| {
            let result = cx.background_executor().spawn(async move {
                let service = service.lock().unwrap();
                service.get_player_matches(&platform, &player_id, 1)
            }).await;
            
            view.update(cx, |this, cx| {
                this.loading = false;
                if let Ok(data) = result {
                    if let Some(items) = data["data"].as_array() {
                        this.matches = items.clone();
                        this.calculate_stats();
                    }
                }
                cx.notify();
            }).ok();
        }).detach();
    }

    fn calculate_stats(&mut self) {
        let mut total_kills = 0i64;
        let mut total_deaths = 0i64;
        let mut total_placement = 0i64;
        let mut game_count = 0usize;

        for match_item in &self.matches {
            // Get stats
            if let Some(stats) = match_item.get("stats") {
                if let Some(kills) = stats.get("Kills").and_then(|v| v.as_i64()) {
                    total_kills += kills;
                }
                if let Some(deaths) = stats.get("Deaths").and_then(|v| v.as_i64()) {
                    total_deaths += deaths;
                }
            }

            // Get placement
            if let Some(placement) = match_item.get("placement").and_then(|v| v.as_i64()) {
                total_placement += placement;
                game_count += 1;
            }
        }

        self.total_kills = total_kills;
        self.total_deaths = total_deaths;
        self.total_games = game_count;
        self.avg_placement = if game_count > 0 {
            total_placement as f64 / game_count as f64
        } else {
            0.0
        };
    }
}

impl Render for PlayerView {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let kd_ratio = if self.total_deaths > 0 {
            self.total_kills as f64 / self.total_deaths as f64
        } else if self.total_kills > 0 {
            f64::INFINITY
        } else {
            0.0
        };

        div()
            .flex()
            .flex_col()
            .size_full()
            .p_8()
            .gap_4()
            // Header
            .child(
                div()
                    .text_2xl()
                    .font_weight(FontWeight::BOLD)
                    .child(format!("Player: {}", self.player_id))
            )
            // Stats Summary Panel
            .when(!self.loading && self.total_games > 0, |parent| {
                parent.child(
                    div()
                        .flex()
                        .gap_4()
                        .p_4()
                        .bg(rgb(0x181825))
                        .rounded_lg()
                        .border_1()
                        .border_color(rgb(0x313244))
                        .children(vec![
                            // K/D Stat
                            div()
                                .flex()
                                .flex_col()
                                .flex_1()
                                .p_3()
                                .bg(rgb(0x1e1e2e))
                                .rounded_md()
                                .child(
                                    div()
                                        .text_sm()
                                        .text_color(rgb(0x9399b2))
                                        .child("K/D Ratio")
                                )
                                .child(
                                    div()
                                        .text_xl()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(if kd_ratio >= 2.0 {
                                            rgb(0x4daf4a) // Green
                                        } else if kd_ratio >= 1.0 {
                                            rgb(0xcdd6f4) // White
                                        } else {
                                            rgb(0xef4444) // Red
                                        })
                                        .child(if kd_ratio.is_infinite() {
                                            "∞".to_string()
                                        } else {
                                            format!("{:.2}", kd_ratio)
                                        })
                                )
                                .child(
                                    div()
                                        .text_xs()
                                        .text_color(rgb(0x6c7086))
                                        .child(format!("{} K / {} D", self.total_kills, self.total_deaths))
                                ),
                            // Avg Placement Stat
                            div()
                                .flex()
                                .flex_col()
                                .flex_1()
                                .p_3()
                                .bg(rgb(0x1e1e2e))
                                .rounded_md()
                                .child(
                                    div()
                                        .text_sm()
                                        .text_color(rgb(0x9399b2))
                                        .child("Avg Placement")
                                )
                                .child(
                                    div()
                                        .text_xl()
                                        .font_weight(FontWeight::BOLD)
                                        .text_color(if self.avg_placement <= 10.0 {
                                            rgb(0x4daf4a) // Green
                                        } else if self.avg_placement <= 20.0 {
                                            rgb(0xf59e0b) // Yellow
                                        } else {
                                            rgb(0xef4444) // Red
                                        })
                                        .child(format!("#{:.1}", self.avg_placement))
                                ),
                            // Total Games Stat
                            div()
                                .flex()
                                .flex_col()
                                .flex_1()
                                .p_3()
                                .bg(rgb(0x1e1e2e))
                                .rounded_md()
                                .child(
                                    div()
                                        .text_sm()
                                        .text_color(rgb(0x9399b2))
                                        .child("Total Games")
                                )
                                .child(
                                    div()
                                        .text_xl()
                                        .font_weight(FontWeight::BOLD)
                                        .child(format!("{}", self.total_games))
                                ),
                        ])
                )
            })
            // Matches Section
            .child(
                if self.loading {
                    div().child("Loading...")
                } else {
                    div()
                        .flex()
                        .flex_col()
                        .gap_3()
                        .child(
                            div()
                                .text_lg()
                                .font_weight(FontWeight::SEMIBOLD)
                                .child("Recent Matches")
                        )
                        .children(self.matches.iter().map(|match_item| {
                            let match_id = match_item["match_id"].as_str().unwrap_or("").to_string();
                            let placement = match_item["placement"].as_i64().unwrap_or(0);
                            let hero_name = match_item["hero"]["name"].as_str().unwrap_or("Unknown").to_string();
                            let hero_image = match_item["hero"]["head_image_url"]
                                .as_str()
                                .or(match_item["hero"]["image_url"].as_str())
                                .unwrap_or("")
                                .to_string();
                            let platform = self.platform.clone();
                            
                            // Get K/D for this match
                            let kills = match_item["stats"]["Kills"].as_i64().unwrap_or(0);
                            let deaths = match_item["stats"]["Deaths"].as_i64().unwrap_or(0);
                            
                            // Placement color
                            let placement_color = if placement <= 10 {
                                rgb(0x4daf4a) // Green
                            } else if placement <= 20 {
                                rgb(0xf59e0b) // Yellow
                            } else {
                                rgb(0xef4444) // Red
                            };

                            div()
                                .flex()
                                .items_center()
                                .gap_3()
                                .p_4()
                                .bg(rgb(0x313244))
                                .rounded_md()
                                .cursor_pointer()
                                .hover(|s| s.bg(rgb(0x45475a)))
                                .on_mouse_down(MouseButton::Left, cx.listener(move |_, _, window, cx| {
                                    window.dispatch_action(Box::new(OpenMatch {
                                        match_id: match_id.clone(),
                                        platform: platform.clone(),
                                    }), cx);
                                }))
                                // Hero Image
                                .when(!hero_image.is_empty(), |parent| {
                                    parent.child(
                                        img(hero_image)
                                            .w(px(48.0))
                                            .h(px(48.0))
                                            .rounded(px(8.0))
                                            .object_fit(gpui::ObjectFit::Cover)
                                    )
                                })
                                // Match Info
                                .child(
                                    div()
                                        .flex()
                                        .flex_col()
                                        .flex_1()
                                        .gap_1()
                                        .child(
                                            div()
                                                .text_base()
                                                .font_weight(FontWeight::SEMIBOLD)
                                                .child(hero_name)
                                        )
                                        .child(
                                            div()
                                                .flex()
                                                .gap_3()
                                                .text_sm()
                                                .child(
                                                    div()
                                                        .text_color(placement_color)
                                                        .font_weight(FontWeight::MEDIUM)
                                                        .child(format!("#{} Placement", placement))
                                                )
                                                .child(
                                                    div()
                                                        .text_color(rgb(0x9399b2))
                                                        .child(format!("{} K / {} D", kills, deaths))
                                                )
                                        )
                                )
                        }))
                }
            )
    }
}
