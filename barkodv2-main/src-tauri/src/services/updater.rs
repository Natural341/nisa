//! Updater Service Module
//! 
//! Otomatik güncelleme yönetimi

use serde::{Deserialize, Serialize};

/// Update information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    #[serde(rename = "currentVersion")]
    pub current_version: String,
    #[serde(rename = "releaseNotes")]
    pub release_notes: Option<String>,
    #[serde(rename = "downloadUrl")]
    pub download_url: Option<String>,
    #[serde(rename = "publishedAt")]
    pub published_at: Option<String>,
}

/// Update status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatus {
    pub available: bool,
    pub info: Option<UpdateInfo>,
    pub error: Option<String>,
}

/// Get current application version
pub fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Check for updates configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConfig {
    /// URL to check for updates (JSON endpoint)
    pub endpoint: String,
    /// Check interval in hours
    #[serde(rename = "checkIntervalHours")]
    pub check_interval_hours: u32,
    /// Auto download updates
    #[serde(rename = "autoDownload")]
    pub auto_download: bool,
    /// Auto install updates on exit
    #[serde(rename = "autoInstall")]
    pub auto_install: bool,
}

impl Default for UpdateConfig {
    fn default() -> Self {
        Self {
            endpoint: "https://your-server.com/api/updates/latest".to_string(),
            check_interval_hours: 24,
            auto_download: false,
            auto_install: false,
        }
    }
}
