use crate::views::match_detail::MatchDetailView;
use crate::views::player::PlayerView;
use crate::views::search::SearchView;
use crate::views::{OpenMatch, OpenPlayer};
use gpui::prelude::*;
use gpui::*;

pub struct RootView {
    active_view: AnyView,
}

impl RootView {
    pub fn new(cx: &mut Context<Self>, window: &mut Window) -> Self {
        let search_view = cx.new(|cx| SearchView::new(cx));
        Self {
            active_view: search_view.into(),
        }
    }

    fn handle_open_player(
        &mut self,
        event: &OpenPlayer,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let player_view =
            cx.new(|cx| PlayerView::new(cx, event.player_id.clone(), event.platform.clone()));
        self.active_view = player_view.into();
        cx.notify();
    }

    fn handle_open_match(
        &mut self,
        event: &OpenMatch,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let match_view =
            cx.new(|cx| MatchDetailView::new(cx, event.match_id.clone(), event.platform.clone()));
        self.active_view = match_view.into();
        cx.notify();
    }

    pub fn set_active_view(&mut self, view: AnyView, cx: &mut Context<Self>) {
        self.active_view = view;
        cx.notify();
    }
}

impl Render for RootView {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .size_full()
            .bg(rgb(0x1e1e2e)) // Dark background
            .text_color(rgb(0xcdd6f4)) // Light text
            .on_action(cx.listener(|this, action: &OpenPlayer, _window, cx| {
                let view = cx.new(|cx| {
                    PlayerView::new(cx, action.player_id.clone(), action.platform.clone())
                });
                this.set_active_view(view.into(), cx);
            }))
            .on_action(cx.listener(|this, action: &OpenMatch, _window, cx| {
                let view = cx.new(|cx| {
                    MatchDetailView::new(cx, action.match_id.clone(), action.platform.clone())
                });
                this.set_active_view(view.into(), cx);
            }))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .size_full()
                    .child(
                        div()
                            .h_12()
                            .flex()
                            .items_center()
                            .px_4()
                            .bg(rgb(0x11111b))
                            .border_b_1()
                            .border_color(rgb(0x313244))
                            .child(
                                div()
                                    .text_xl()
                                    .font_weight(FontWeight::BOLD)
                                    .cursor_pointer()
                                    .on_mouse_down(
                                        MouseButton::Left,
                                        cx.listener(|this, _, window, cx| {
                                            let view = cx.new(|cx| SearchView::new(cx));
                                            this.set_active_view(view.into(), cx);
                                        }),
                                    )
                                    .child("Supervive Dashboard"),
                            ),
                    )
                    .child(div().flex_1().child(self.active_view.clone())),
            )
    }
}
