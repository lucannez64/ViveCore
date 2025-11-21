use crate::api::SuperviveService;
use gpui::*;
use std::sync::Arc;
use std::sync::Mutex;

pub struct AppState {
    pub service: Arc<Mutex<SuperviveService>>,
}

impl Global for AppState {}

impl AppState {
    pub fn new(service: SuperviveService) -> Self {
        Self {
            service: Arc::new(Mutex::new(service)),
        }
    }
}
