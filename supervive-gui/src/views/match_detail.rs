use gpui::*;
use gpui::prelude::*;
use crate::state::AppState;
use serde_json::Value;

pub struct MatchDetailView {
    match_id: String,
    platform: String,
    details: Option<Value>,
    loading: bool,
}

impl MatchDetailView {
    pub fn new(cx: &mut Context<Self>, match_id: String, platform: String) -> Self {
        let view = Self {
            match_id: match_id.clone(),
            platform: platform.clone(),
            details: None,
            loading: true,
        };
        cx.spawn(async move |view, cx| {
            view.update(cx, |this, cx| this.fetch_data(cx)).ok();
        }).detach();
        view
    }

    fn fetch_data(&mut self, cx: &mut Context<Self>) {
        let app_state = cx.global::<AppState>();
        let service = app_state.service.clone();
        let match_id = self.match_id.clone();
        let platform = self.platform.clone();

        cx.spawn(async move |view, cx| {
            let result = cx.background_executor().spawn(async move {
                let mut service = service.lock().unwrap();
                service.get_match(&platform, &match_id)
            }).await;

            view.update(cx, |this, cx| {
                this.loading = false;
                if let Ok(data) = result {
                    this.details = Some(data);
                }
                cx.notify();
            }).ok();
        }).detach();
    }
}

impl Render for MatchDetailView {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .size_full()
            .p_8()
            .gap_4()
            .child(
                div()
                    .text_xl()
                    .font_weight(FontWeight::BOLD)
                    .child(format!("Match: {}", self.match_id))
            )
            .child(
                if self.loading {
                    div().child("Loading...")
                } else if let Some(details) = &self.details {
                    div()
                        .child(format!("Details: {:?}", details))
                } else {
                    div().child("Failed to load match details")
                }
            )
    }
}
