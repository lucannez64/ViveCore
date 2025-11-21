use gpui::*;

pub mod match_detail;
pub mod player;
pub mod root;
pub mod search;

#[derive(Clone, PartialEq, Debug, serde::Deserialize, serde::Serialize)]
pub struct OpenPlayer {
    pub player_id: String,
    pub platform: String,
}

impl Action for OpenPlayer {
    fn name(&self) -> &'static str {
        "OpenPlayer"
    }
    fn name_for_type() -> &'static str {
        "OpenPlayer"
    }
    fn build(value: serde_json::Value) -> anyhow::Result<Box<dyn Action>> {
        let action: Self = serde_json::from_value(value)?;
        Ok(Box::new(action))
    }
    fn boxed_clone(&self) -> Box<dyn Action> {
        Box::new(self.clone())
    }
    fn partial_eq(&self, other: &dyn Action) -> bool {
        other
            .as_any()
            .downcast_ref::<Self>()
            .map_or(false, |a| self == a)
    }
}

#[derive(Clone, PartialEq, Debug, serde::Deserialize, serde::Serialize)]
pub struct OpenMatch {
    pub match_id: String,
    pub platform: String,
}

impl Action for OpenMatch {
    fn name(&self) -> &'static str {
        "OpenMatch"
    }
    fn name_for_type() -> &'static str {
        "OpenMatch"
    }
    fn build(value: serde_json::Value) -> anyhow::Result<Box<dyn Action>> {
        let action: Self = serde_json::from_value(value)?;
        Ok(Box::new(action))
    }
    fn boxed_clone(&self) -> Box<dyn Action> {
        Box::new(self.clone())
    }
    fn partial_eq(&self, other: &dyn Action) -> bool {
        other
            .as_any()
            .downcast_ref::<Self>()
            .map_or(false, |a| self == a)
    }
}
