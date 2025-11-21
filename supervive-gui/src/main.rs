mod api;
mod state;
mod views;

use api::SuperviveService;
use gpui::prelude::*;
use gpui::*;
use reqwest_client::ReqwestClient;
use state::AppState;
use std::sync::Arc;
use views::root::RootView;
use views::search::SearchView;

fn main() {
    env_logger::init();

    Application::new().run(|cx| {
        // Configure HTTP client for remote image loading
        let http_client = ReqwestClient::user_agent("supervive-gui").unwrap();
        cx.set_http_client(Arc::new(http_client));

        let service = SuperviveService::new().expect("Failed to initialize service");
        let app_state = AppState::new(service);
        cx.set_global(app_state);

        cx.open_window(WindowOptions::default(), |window, cx| {
            cx.new(|cx| RootView::new(cx, window))
        })
        .unwrap();
    });
}
