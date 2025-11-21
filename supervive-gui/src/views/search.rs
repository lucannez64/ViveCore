use gpui::*;
use gpui::prelude::*;
use crate::state::AppState;
use crate::views::OpenPlayer;
use serde_json::Value;

pub struct SearchView {
    query: String,
    results: Vec<Value>,
    focus_handle: FocusHandle,
    cursor_position: usize,
}

impl SearchView {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let focus_handle = cx.focus_handle();
        Self {
            query: String::new(),
            results: Vec::new(),
            focus_handle,
            cursor_position: 0,
        }
    }

    fn perform_search(&mut self, cx: &mut Context<Self>) {
        let query = self.query.clone();
        if query.is_empty() {
            return;
        }

        let app_state = cx.global::<AppState>();
        let service = app_state.service.clone();

        let view = cx.entity();
        cx.spawn(async move |_, cx| {
            let result = cx.background_executor().spawn(async move {
                let mut service = service.lock().unwrap();
                service.search_players(&query)
            }).await;

            view.update(cx, |this, cx| {
                if let Ok(data) = result {
                    if let Some(array) = data.as_array() {
                        this.results = array.clone();
                    }
                }
                cx.notify();
            }).ok();
        }).detach();
    }

    fn on_input(&mut self, text: &str, cx: &mut Context<Self>) {
        self.query = text.to_string();
        cx.notify();
    }
}

impl Render for SearchView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .size_full()
            .p_8()
            .gap_4()
            .child(
                div()
                    .flex()
                    .gap_2()
                    .child(
                        div()
                            .flex_1()
                            .p_2()
                            .bg(rgb(0x313244))
                            .rounded_md()
                            .border_1()
                            .border_color(rgb(0x45475a))
                            .cursor_text()
                            .on_mouse_down(MouseButton::Left, cx.listener(|this, _, window, cx| {
                                window.focus(&this.focus_handle);
                                cx.notify();
                            }))
                            .child(
                                div()
                                    .track_focus(&self.focus_handle)
                                    .on_key_down(cx.listener(|this, event: &KeyDownEvent, _window, cx| {
                                        match event.keystroke.key.as_str() {
                                            "backspace" => {
                                                if this.cursor_position > 0 && !this.query.is_empty() {
                                                    this.query.remove(this.cursor_position - 1);
                                                    this.cursor_position -= 1;
                                                    cx.notify();
                                                }
                                            }
                                            "delete" => {
                                                if this.cursor_position < this.query.len() {
                                                    this.query.remove(this.cursor_position);
                                                    cx.notify();
                                                }
                                            }
                                            "left" => {
                                                if this.cursor_position > 0 {
                                                    this.cursor_position -= 1;
                                                    cx.notify();
                                                }
                                            }
                                            "right" => {
                                                if this.cursor_position < this.query.len() {
                                                    this.cursor_position += 1;
                                                    cx.notify();
                                                }
                                            }
                                            "home" => {
                                                this.cursor_position = 0;
                                                cx.notify();
                                            }
                                            "end" => {
                                                this.cursor_position = this.query.len();
                                                cx.notify();
                                            }
                                            "enter" => {
                                                this.perform_search(cx);
                                            }
                                            key if key.len() == 1 => {
                                                this.query.insert_str(this.cursor_position, key);
                                                this.cursor_position += key.len();
                                                cx.notify();
                                            }
                                            _ => {}
                                        }
                                    }))
                                    .child({
                                        let is_focused = self.focus_handle.is_focused(window);
                                        if self.query.is_empty() && !is_focused {
                                            "Search player...".to_string()
                                        } else {
                                            let mut display_text = self.query.clone();
                                            if is_focused {
                                                // Insert caret at cursor position
                                                display_text.insert(self.cursor_position, '|');
                                            }
                                            if display_text.is_empty() {
                                                "|".to_string()
                                            } else {
                                                display_text
                                            }
                                        }
                                    })
                            )
                    )
                    .child(
                        div()
                            .p_2()
                            .bg(rgb(0x89b4fa))
                            .text_color(rgb(0x1e1e2e))
                            .rounded_md()
                            .cursor_pointer()
                            .on_mouse_down(MouseButton::Left, cx.listener(|this, _, _window, cx| this.perform_search(cx)))
                            .child("Search")
                    )
            )
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .children(self.results.iter().map(|player| {
                        let name = player["uniqueDisplayName"].as_str().unwrap_or("Unknown").to_string();
                        let id = player["userId"].as_str().unwrap_or("").to_string();
                        // Assuming platform is available or defaulting to "pc"
                        let platform = player["platform"].as_str().unwrap_or("steam").to_string(); 

                        div()
                            .p_4()
                            .bg(rgb(0x313244))
                            .rounded_md()
                            .cursor_pointer()
                            .hover(|s| s.bg(rgb(0x45475a)))
                            .on_mouse_down(MouseButton::Left, cx.listener(move |_, _, window, cx| {
                                window.dispatch_action(Box::new(OpenPlayer {
                                    player_id: id.clone(),
                                    platform: platform.clone(),
                                }), cx);
                            }))
                            .child(name)
                    }))
            )
    }
}
