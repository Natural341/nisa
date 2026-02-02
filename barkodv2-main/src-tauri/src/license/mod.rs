use crate::error::AppError;
use crate::models::{License, LicenseActivateRequest, LicenseActivateResponse, LicenseValidateRequest, LicenseValidateResponse};
use mac_address::get_mac_address;
use rusqlite::{params, Connection};

/// Get the MAC address of the primary network interface
pub fn get_device_mac_address() -> Result<String, AppError> {
    match get_mac_address() {
        Ok(Some(ma)) => Ok(ma.to_string()),
        Ok(None) => Err(AppError::Internal("MAC adresi bulunamadi".to_string())),
        Err(e) => Err(AppError::Internal(format!("MAC adresi alinamadi: {}", e))),
    }
}

/// Get device name (hostname)
pub fn get_device_name() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Unknown".to_string())
}

/// Validate license with API
pub fn validate_license_api(
    api_base_url: &str,
    license_key: &str,
    mac_address: &str,
) -> Result<LicenseValidateResponse, AppError> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/api/license/validate", api_base_url);

    let request = LicenseValidateRequest {
        license_key: license_key.to_string(),
        mac_address: mac_address.to_string(),
    };

    let response = client
        .post(&url)
        .json(&request)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .map_err(|e| AppError::Internal(format!("API istegi basarisiz: {}", e)))?;

    if response.status().is_success() {
        let result: LicenseValidateResponse = response
            .json()
            .map_err(|e| AppError::Internal(format!("API yaniti ayriştirilamadi: {}", e)))?;
        Ok(result)
    } else {
        let status = response.status();
        let body = response.text().unwrap_or_default();

        // Try to parse error response
        if let Ok(error_response) = serde_json::from_str::<LicenseValidateResponse>(&body) {
            Ok(error_response)
        } else {
            Ok(LicenseValidateResponse {
                valid: false,
                dealer_id: None,
                dealer_name: None,
                expires_at: None,
                error: Some(format!("HTTP_{}", status.as_u16())),
                message: Some(format!("Sunucu hatasi: {}", status)),
            })
        }
    }
}

/// Activate license with API
pub fn activate_license_api(
    api_base_url: &str,
    license_key: &str,
    mac_address: &str,
) -> Result<LicenseActivateResponse, AppError> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/api/license/activate", api_base_url);

    let request = LicenseActivateRequest {
        license_key: license_key.to_string(),
        mac_address: mac_address.to_string(),
        device_name: Some(get_device_name()),
    };

    let response = client
        .post(&url)
        .json(&request)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .map_err(|e| AppError::Internal(format!("API istegi basarisiz: {}", e)))?;

    if response.status().is_success() {
        let result: LicenseActivateResponse = response
            .json()
            .map_err(|e| AppError::Internal(format!("API yaniti ayriştirilamadi: {}", e)))?;
        Ok(result)
    } else {
        let status = response.status();
        let body = response.text().unwrap_or_default();

        if let Ok(error_response) = serde_json::from_str::<LicenseActivateResponse>(&body) {
            Ok(error_response)
        } else {
            Ok(LicenseActivateResponse {
                success: false,
                dealer_id: None,
                dealer_name: None,
                activated_at: None,
                expires_at: None,
                error: Some(format!("HTTP_{}", status.as_u16())),
                message: Some(format!("Sunucu hatasi: {}", status)),
            })
        }
    }
}

/// Get license from local database
pub fn get_local_license(conn: &Connection) -> Result<Option<License>, AppError> {
    let result = conn.query_row(
        "SELECT license_key, dealer_id, dealer_name, mac_address, activated_at, expires_at, is_active, last_validated, api_base_url FROM license WHERE id = 1",
        [],
        |row| {
            Ok(License {
                license_key: row.get(0)?,
                dealer_id: row.get(1)?,
                dealer_name: row.get(2)?,
                mac_address: row.get(3)?,
                activated_at: row.get(4)?,
                expires_at: row.get(5)?,
                is_active: row.get::<_, i32>(6)? == 1,
                last_validated: row.get(7)?,
                api_base_url: row.get(8)?,
            })
        },
    );

    match result {
        Ok(license) => Ok(Some(license)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Database(e)),
    }
}

/// Save license to local database
pub fn save_license(conn: &Connection, license: &License) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO license (id, license_key, dealer_id, dealer_name, mac_address, activated_at, expires_at, is_active, last_validated, api_base_url)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &license.license_key,
            &license.dealer_id,
            &license.dealer_name,
            &license.mac_address,
            &license.activated_at,
            &license.expires_at,
            if license.is_active { 1 } else { 0 },
            &license.last_validated,
            &license.api_base_url,
        ],
    )?;
    Ok(())
}

/// Update last validated timestamp
pub fn update_last_validated(conn: &Connection) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE license SET last_validated = ?1 WHERE id = 1",
        params![&now],
    )?;
    Ok(())
}

/// Check if license needs revalidation (every 7 days)
pub fn needs_revalidation(license: &License) -> bool {
    if let Some(last_validated) = &license.last_validated {
        if let Ok(last_date) = chrono::DateTime::parse_from_rfc3339(last_validated) {
            let now = chrono::Utc::now();
            let diff = now.signed_duration_since(last_date);
            return diff.num_days() >= 7;
        }
    }
    true // If no last_validated, needs revalidation
}

/// Check if license is expired
pub fn is_license_expired(license: &License) -> bool {
    if let Some(expires_at) = &license.expires_at {
        if let Ok(expiry_date) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            let now = chrono::Utc::now();
            return now > expiry_date;
        }
    }
    false // No expiry means never expires
}

/// Delete license from local database
pub fn delete_license(conn: &Connection) -> Result<(), AppError> {
    conn.execute("DELETE FROM license WHERE id = 1", [])?;
    Ok(())
}
