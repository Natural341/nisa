//! Barcode Scanner Service Module
//! 
//! USB ve Bluetooth barkod tarayıcı desteği

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

static SCANNER_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Barcode scanner configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerConfig {
    /// Enable scanner listening
    pub enabled: bool,
    /// Input buffer timeout in milliseconds
    #[serde(rename = "bufferTimeoutMs")]
    pub buffer_timeout_ms: u32,
    /// Minimum barcode length
    #[serde(rename = "minLength")]
    pub min_length: usize,
    /// Maximum barcode length
    #[serde(rename = "maxLength")]
    pub max_length: usize,
    /// Expected suffix (e.g., "\r" or "\n")
    pub suffix: String,
}

impl Default for ScannerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            buffer_timeout_ms: 50,
            min_length: 4,
            max_length: 50,
            suffix: "\r".to_string(),
        }
    }
}

/// Barcode scan result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub barcode: String,
    pub timestamp: String,
    #[serde(rename = "scanType")]
    pub scan_type: String, // "keyboard", "serial", "hid"
}

/// Scanner status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerStatus {
    pub active: bool,
    #[serde(rename = "lastScan")]
    pub last_scan: Option<ScanResult>,
    #[serde(rename = "scanCount")]
    pub scan_count: u32,
}

/// Barcode validator - checks if input looks like a barcode
pub fn is_valid_barcode(input: &str, config: &ScannerConfig) -> bool {
    let len = input.len();
    
    // Length check
    if len < config.min_length || len > config.max_length {
        return false;
    }
    
    // Must be alphanumeric with optional hyphens
    input.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

/// Parse common barcode formats
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarcodeInfo {
    pub raw: String,
    #[serde(rename = "barcodeType")]
    pub barcode_type: String,
    pub valid: bool,
}

pub fn parse_barcode(barcode: &str) -> BarcodeInfo {
    let barcode_type = detect_barcode_type(barcode);
    
    BarcodeInfo {
        raw: barcode.to_string(),
        barcode_type,
        valid: true,
    }
}

/// Detect barcode type based on format
fn detect_barcode_type(barcode: &str) -> String {
    let len = barcode.len();
    let is_all_digits = barcode.chars().all(|c| c.is_numeric());
    
    if is_all_digits {
        match len {
            8 => "EAN-8".to_string(),
            12 => "UPC-A".to_string(),
            13 => "EAN-13".to_string(),
            14 => "ITF-14".to_string(),
            _ if len >= 1 && len <= 48 => "Code 128".to_string(),
            _ => "Unknown".to_string(),
        }
    } else {
        if barcode.chars().all(|c| c.is_alphanumeric() || c == '-' || c == ' ') {
            "Code 39".to_string()
        } else {
            "Custom".to_string()
        }
    }
}

/// Start scanner listener flag
pub fn start_scanner_listener() {
    SCANNER_ACTIVE.store(true, Ordering::SeqCst);
    println!("[Scanner] Listener started");
}

/// Stop scanner listener flag
pub fn stop_scanner_listener() {
    SCANNER_ACTIVE.store(false, Ordering::SeqCst);
    println!("[Scanner] Listener stopped");
}

/// Check if scanner is active
pub fn is_scanner_active() -> bool {
    SCANNER_ACTIVE.load(Ordering::SeqCst)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_barcode_type_detection() {
        assert_eq!(detect_barcode_type("12345678"), "EAN-8");
        assert_eq!(detect_barcode_type("123456789012"), "UPC-A");
        assert_eq!(detect_barcode_type("1234567890123"), "EAN-13");
        assert_eq!(detect_barcode_type("ABC-123"), "Code 39");
    }

    #[test]
    fn test_barcode_validation() {
        let config = ScannerConfig::default();
        assert!(is_valid_barcode("12345678", &config));
        assert!(is_valid_barcode("ABC-123-XYZ", &config));
        assert!(!is_valid_barcode("ab", &config)); // too short
    }
}
