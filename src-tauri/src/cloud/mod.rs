use crate::error::AppError;
use crate::models::{CloudBackupResponse, CloudStatusResponse, SyncStatus};
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use base64::Engine as _;

/// Calculate SHA256 checksum of a file
pub fn calculate_checksum(file_path: &str) -> Result<String, AppError> {
    let mut file = File::open(file_path)
        .map_err(|e| AppError::Internal(format!("Dosya acilamadi: {}", e)))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| AppError::Internal(format!("Dosya okunamadi: {}", e)))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

/// Backup database to cloud
pub fn backup_to_cloud(
    conn: &Connection,
    api_base_url: &str,
    dealer_id: &str,
    license_key: &str,
    db_path: &str,
) -> Result<CloudBackupResponse, AppError> {
    // Force WAL checkpoint to flush all data to main database file
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| AppError::Internal(format!("WAL checkpoint basarisiz: {}", e)))?;

    // Calculate checksum first
    let checksum = calculate_checksum(db_path)?;

    // Get file size
    let metadata = std::fs::metadata(db_path)
        .map_err(|e| AppError::Internal(format!("Dosya boyutu alinamadi: {}", e)))?;
    let file_size = metadata.len() as i64;

    // Read and encode file content
    let mut file = File::open(db_path)
        .map_err(|e| AppError::Internal(format!("Dosya acilamadi: {}", e)))?;
    
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| AppError::Internal(format!("Dosya okunamadi: {}", e)))?;

    let backup_data = base64::engine::general_purpose::STANDARD.encode(&buffer);

    let client = reqwest::blocking::Client::new();
    let url = format!("{}/api/cloud/backup", api_base_url);

    let body = serde_json::json!({
        "dealer_id": dealer_id,
        "license_key": license_key,
        "checksum": checksum,
        "backup_data": backup_data
    });

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Dealer-ID", dealer_id)
        .header("X-License-Key", license_key)
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .map_err(|e| AppError::Internal(format!("Yedekleme istegi basarisiz: {}", e)))?;

    if response.status().is_success() {
        let mut result: CloudBackupResponse = response
            .json()
            .map_err(|e| AppError::Internal(format!("API yaniti ayristirilamadi: {}", e)))?;
        result.size_bytes = Some(file_size);
        Ok(result)
    } else {
        let status = response.status();
        let body = response.text().unwrap_or_default();

        if let Ok(error_response) = serde_json::from_str::<CloudBackupResponse>(&body) {
            Ok(error_response)
        } else {
            Ok(CloudBackupResponse {
                success: false,
                backup_id: None,
                timestamp: None,
                size_bytes: None,
                message: None,
                error: Some(format!("Sunucu hatasi: {} - {}", status, body)),
            })
        }
    }
}

/// Restore database from cloud using SQLite backup API
/// This restores data into the existing connection without requiring app restart
pub fn restore_from_cloud_with_conn(
    db_path: &str,
    api_base_url: &str,
    dealer_id: &str,
    license_key: &str,
) -> Result<(), AppError> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/api/cloud/restore", api_base_url);

    let response = client
        .get(&url)
        .header("X-Dealer-ID", dealer_id)
        .header("X-License-Key", license_key)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .map_err(|e| AppError::Internal(format!("Geri yukleme istegi basarisiz: {}", e)))?;

    if response.status().is_success() {
        // Download to temp file
        let temp_path = std::env::temp_dir().join("nexus_cloud_restore.db");
        let bytes = response.bytes()
            .map_err(|e| AppError::Internal(format!("Veri alinamadi: {}", e)))?;

        std::fs::write(&temp_path, &bytes)
            .map_err(|e| AppError::Internal(format!("Gecici dosya yazilamadi: {}", e)))?;

        // Open the downloaded database (source)
        let source_conn = Connection::open(&temp_path)
            .map_err(|e| AppError::Internal(format!("Indirilen veritabani acilamadi: {}", e)))?;

        // Open direct mutable connection to destination
        let mut dest_conn = Connection::open(db_path)
            .map_err(|e| AppError::Internal(format!("Hedef veritabani acilamadi: {}", e)))?;

        // Use SQLite backup API to restore into destination
        let backup = rusqlite::backup::Backup::new(&source_conn, &mut dest_conn)
            .map_err(|e| AppError::Internal(format!("Backup olusturulamadi: {}", e)))?;

        backup.run_to_completion(100, std::time::Duration::from_millis(50), None)
            .map_err(|e| AppError::Internal(format!("Backup tamamlanamadi: {}", e)))?;

        // Clean up temp file
        let _ = std::fs::remove_file(&temp_path);

        Ok(())
    } else {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        Err(AppError::Internal(format!("Geri yukleme basarisiz: {} - {}", status, body)))
    }
}

/// Get cloud backup status
pub fn get_cloud_status(
    api_base_url: &str,
    dealer_id: &str,
    license_key: &str,
) -> Result<CloudStatusResponse, AppError> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/api/cloud/status", api_base_url);

    let response = client
        .get(&url)
        .header("X-Dealer-ID", dealer_id)
        .header("X-License-Key", license_key)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .map_err(|e| AppError::Internal(format!("Durum istegi basarisiz: {}", e)))?;

    if response.status().is_success() {
        let result: CloudStatusResponse = response
            .json()
            .map_err(|e| AppError::Internal(format!("API yaniti ayristirilamadi: {}", e)))?;
        Ok(result)
    } else {
        // Return empty status if no backup exists
        Ok(CloudStatusResponse {
            has_backup: false,
            last_backup_at: None,
            backup_size_bytes: None,
            backup_count: None,
        })
    }
}

/// Get sync status from local database
pub fn get_local_sync_status(conn: &Connection) -> Result<SyncStatus, AppError> {
    let result = conn.query_row(
        "SELECT last_backup_at, last_restore_at, auto_sync_enabled, auto_sync_interval_minutes FROM sync_status WHERE id = 1",
        [],
        |row| {
            Ok(SyncStatus {
                last_backup_at: row.get(0)?,
                last_restore_at: row.get(1)?,
                auto_sync_enabled: row.get::<_, i32>(2)? == 1,
                auto_sync_interval_minutes: row.get(3)?,
            })
        },
    );

    match result {
        Ok(status) => Ok(status),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Initialize default sync status
            conn.execute(
                "INSERT INTO sync_status (id, auto_sync_enabled, auto_sync_interval_minutes) VALUES (1, 0, 30)",
                [],
            )?;
            Ok(SyncStatus {
                last_backup_at: None,
                last_restore_at: None,
                auto_sync_enabled: false,
                auto_sync_interval_minutes: 30,
            })
        }
        Err(e) => Err(AppError::Database(e)),
    }
}

/// Update last backup timestamp
pub fn update_last_backup(conn: &Connection) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();

    // Ensure sync_status row exists
    conn.execute(
        "INSERT OR IGNORE INTO sync_status (id, auto_sync_enabled, auto_sync_interval_minutes) VALUES (1, 0, 30)",
        [],
    )?;

    conn.execute(
        "UPDATE sync_status SET last_backup_at = ?1 WHERE id = 1",
        params![&now],
    )?;
    Ok(())
}

/// Update last restore timestamp
pub fn update_last_restore(conn: &Connection) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();

    // Ensure sync_status row exists
    conn.execute(
        "INSERT OR IGNORE INTO sync_status (id, auto_sync_enabled, auto_sync_interval_minutes) VALUES (1, 0, 30)",
        [],
    )?;

    conn.execute(
        "UPDATE sync_status SET last_restore_at = ?1 WHERE id = 1",
        params![&now],
    )?;
    Ok(())
}

/// Set auto sync settings
pub fn set_auto_sync_settings(
    conn: &Connection,
    enabled: bool,
    interval_minutes: i32,
) -> Result<(), AppError> {
    // Ensure sync_status row exists
    conn.execute(
        "INSERT OR IGNORE INTO sync_status (id, auto_sync_enabled, auto_sync_interval_minutes) VALUES (1, 0, 30)",
        [],
    )?;

    conn.execute(
        "UPDATE sync_status SET auto_sync_enabled = ?1, auto_sync_interval_minutes = ?2 WHERE id = 1",
        params![if enabled { 1 } else { 0 }, interval_minutes],
    )?;
    Ok(())
}
