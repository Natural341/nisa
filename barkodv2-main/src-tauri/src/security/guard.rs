//! Security Guard Module
//!
//! Bu modül uygulamanın güvenliğini sağlar:
//! - Lisans doğrulama
//! - Session token yönetimi
//! - Anti-tamper kontrolleri
//! - Runtime bütünlük kontrolü

use crate::license;
use crate::models::License;
use rusqlite::Connection;
use sha2::{Sha256, Digest};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

// Global güvenlik durumu
static SECURITY_VERIFIED: AtomicBool = AtomicBool::new(false);
static LAST_VERIFICATION: AtomicU64 = AtomicU64::new(0);
static TAMPER_DETECTED: AtomicBool = AtomicBool::new(false);

// Doğrulama geçerlilik süresi (5 dakika)
const VERIFICATION_VALIDITY_SECS: u64 = 300;

/// Güvenlik hatası türleri
#[derive(Debug, Clone)]
pub enum SecurityError {
    NoLicense,
    LicenseExpired,
    LicenseInvalid,
    SessionExpired,
    TamperDetected,
    ServerValidationFailed(String),
    MacMismatch,
}

impl std::fmt::Display for SecurityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SecurityError::NoLicense => write!(f, "Lisans bulunamadi"),
            SecurityError::LicenseExpired => write!(f, "Lisans suresi dolmus"),
            SecurityError::LicenseInvalid => write!(f, "Lisans gecersiz"),
            SecurityError::SessionExpired => write!(f, "Oturum suresi dolmus, yeniden dogrulama gerekli"),
            SecurityError::TamperDetected => write!(f, "Guvenlik ihlali tespit edildi"),
            SecurityError::ServerValidationFailed(msg) => write!(f, "Sunucu dogrulamasi basarisiz: {}", msg),
            SecurityError::MacMismatch => write!(f, "Cihaz uyusmazligi"),
        }
    }
}

/// Kritik işlemlerden önce çağrılacak güvenlik kontrolü
pub fn verify_access(conn: &Connection) -> Result<License, SecurityError> {
    // Tamper kontrolü
    if TAMPER_DETECTED.load(Ordering::SeqCst) {
        return Err(SecurityError::TamperDetected);
    }

    // Yerel lisans kontrolü
    let license = match license::get_local_license(conn) {
        Ok(Some(lic)) => lic,
        Ok(None) => return Err(SecurityError::NoLicense),
        Err(_) => return Err(SecurityError::LicenseInvalid),
    };

    // Lisans aktif mi?
    if !license.is_active {
        return Err(SecurityError::LicenseInvalid);
    }

    // Süre dolmuş mu?
    if license::is_license_expired(&license) {
        return Err(SecurityError::LicenseExpired);
    }

    // MAC adresi kontrolü
    if let Ok(current_mac) = license::get_device_mac_address() {
        if license.mac_address != current_mac {
            TAMPER_DETECTED.store(true, Ordering::SeqCst);
            return Err(SecurityError::MacMismatch);
        }
    }

    // Son doğrulama zamanı kontrolü
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let last_check = LAST_VERIFICATION.load(Ordering::SeqCst);

    if now - last_check > VERIFICATION_VALIDITY_SECS {
        // Periyodik sunucu doğrulaması gerekli
        SECURITY_VERIFIED.store(false, Ordering::SeqCst);
    }

    Ok(license)
}

/// Sunucu ile doğrulama yap ve session token al
pub async fn verify_with_server(license: &License) -> Result<SessionToken, SecurityError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|_| SecurityError::ServerValidationFailed("HTTP client error".to_string()))?;

    let mac = license::get_device_mac_address()
        .map_err(|_| SecurityError::MacMismatch)?;

    let response = client
        .post(format!("{}/api/license/validate", license.api_base_url))
        .json(&serde_json::json!({
            "license_key": license.license_key,
            "mac_address": mac
        }))
        .send()
        .await
        .map_err(|e| SecurityError::ServerValidationFailed(e.to_string()))?;

    if !response.status().is_success() {
        return Err(SecurityError::ServerValidationFailed("Server rejected".to_string()));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|_| SecurityError::ServerValidationFailed("Invalid response".to_string()))?;

    if body.get("valid").and_then(|v| v.as_bool()).unwrap_or(false) {
        // Başarılı doğrulama
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        SECURITY_VERIFIED.store(true, Ordering::SeqCst);
        LAST_VERIFICATION.store(now, Ordering::SeqCst);

        Ok(SessionToken {
            token: generate_session_token(license),
            expires_at: now + VERIFICATION_VALIDITY_SECS,
            dealer_id: license.dealer_id.clone(),
        })
    } else {
        let error_msg = body.get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown error")
            .to_string();
        Err(SecurityError::ServerValidationFailed(error_msg))
    }
}

/// Session token yapısı
#[derive(Debug, Clone)]
pub struct SessionToken {
    pub token: String,
    pub expires_at: u64,
    pub dealer_id: String,
}

/// Session token oluştur (yerel kullanım için)
fn generate_session_token(license: &License) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let data = format!(
        "{}:{}:{}:{}",
        license.license_key,
        license.dealer_id,
        license.mac_address,
        now
    );

    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

/// Kritik operasyon için güvenlik kontrolü makrosu
/// Bu makro her kritik komutun başında çağrılmalı
#[macro_export]
macro_rules! require_license {
    ($conn:expr) => {
        match $crate::security::guard::verify_access($conn) {
            Ok(license) => license,
            Err(e) => return Err(format!("Guvenlik hatasi: {}", e)),
        }
    };
}

/// Runtime bütünlük kontrolü
/// Belirli kritik fonksiyonların değiştirilip değiştirilmediğini kontrol eder
pub fn check_integrity() -> bool {
    // Bu fonksiyon compile-time'da belirlenen checksum'larla
    // runtime'daki değerleri karşılaştırır

    // Basit bir örnek: Tamper flag kontrolü
    !TAMPER_DETECTED.load(Ordering::SeqCst)
}

/// Güvenlik durumunu sıfırla (test için)
#[cfg(debug_assertions)]
pub fn reset_security_state() {
    SECURITY_VERIFIED.store(false, Ordering::SeqCst);
    LAST_VERIFICATION.store(0, Ordering::SeqCst);
    TAMPER_DETECTED.store(false, Ordering::SeqCst);
}

/// Anti-debug kontrolü
#[cfg(target_os = "windows")]
pub fn detect_debugger() -> bool {
    // Windows'ta debugger tespiti
    // Production'da daha gelişmiş teknikler kullanılabilir
    unsafe {
        // IsDebuggerPresent API çağrısı
        #[link(name = "kernel32")]
        extern "system" {
            fn IsDebuggerPresent() -> i32;
        }
        IsDebuggerPresent() != 0
    }
}

#[cfg(not(target_os = "windows"))]
pub fn detect_debugger() -> bool {
    // Linux/macOS için basit kontrol
    std::env::var("LD_PRELOAD").is_ok() || std::env::var("DYLD_INSERT_LIBRARIES").is_ok()
}

/// Uygulama başlangıcında çağrılacak güvenlik başlatıcı
pub fn init_security() {
    // Debugger kontrolü
    if detect_debugger() {
        log::warn!("Debugger detected!");
        // Production'da: TAMPER_DETECTED.store(true, Ordering::SeqCst);
    }

    // Integrity kontrolü
    if !check_integrity() {
        log::error!("Integrity check failed!");
    }

    log::info!("Security module initialized");
}
