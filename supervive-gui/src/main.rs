mod api;
mod state;
mod views;

use api::SuperviveService;
use gpui::prelude::*;
use gpui::*;
use state::AppState;
use views::root::RootView;
use views::search::SearchView;

fn main() {
    env_logger::init();

    Application::new().run(|cx| {
        let service = SuperviveService::new().expect("Failed to initialize service");
        let app_state = AppState::new(service);
        cx.set_global(app_state);

        cx.open_window(WindowOptions::default(), |window, cx| {
            cx.new(|cx| RootView::new(cx, window))
        })
        .unwrap();
    });
}
