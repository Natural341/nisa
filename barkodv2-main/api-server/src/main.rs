use actix_cors::Cors;
use actix_multipart::Multipart;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer, middleware};
use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

// ============================================================================
// MODELS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct License {
    license_key: String,
    dealer_id: String,
    dealer_name: String,
    mac_address: Option<String>,
    activated_at: Option<String>,
    expires_at: Option<String>,
    is_active: bool,
    max_activations: i32,
    current_activations: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct LicenseValidateRequest {
    license_key: String,
    mac_address: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LicenseValidateResponse {
    valid: bool,
    dealer_id: Option<String>,
    dealer_name: Option<String>,
    expires_at: Option<String>,
    error: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LicenseActivateRequest {
    license_key: String,
    mac_address: String,
    device_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LicenseActivateResponse {
    success: bool,
    dealer_id: Option<String>,
    dealer_name: Option<String>,
    activated_at: Option<String>,
    expires_at: Option<String>,
    error: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupInfo {
    backup_id: String,
    dealer_id: String,
    timestamp: DateTime<Utc>,
    file_path: PathBuf,
    file_size: u64,
    checksum: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CloudBackupResponse {
    success: bool,
    backup_id: Option<String>,
    timestamp: Option<String>,
    message: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CloudStatusResponse {
    has_backup: bool,
    last_backup_at: Option<String>,
    backup_size_bytes: Option<u64>,
    backup_count: i32,
}

// ============================================================================
// APP STATE
// ============================================================================

struct AppState {
    licenses: Mutex<HashMap<String, License>>,
    backups: Mutex<HashMap<String, BackupInfo>>,
    backup_dir: PathBuf,
}

impl AppState {
    fn new() -> Self {
        let backup_dir = PathBuf::from("./backups");
        fs::create_dir_all(&backup_dir).ok();

        // Pre-populate with some test licenses
        let mut licenses = HashMap::new();

        // Test license 1 - Active, no expiry
        licenses.insert(
            "NEXUS-TEST-1234-5678".to_string(),
            License {
                license_key: "NEXUS-TEST-1234-5678".to_string(),
                dealer_id: "dealer-001".to_string(),
                dealer_name: "Test Bayi A.S.".to_string(),
                mac_address: None,
                activated_at: None,
                expires_at: None,
                is_active: true,
                max_activations: 3,
                current_activations: 0,
            },
        );

        // Test license 2 - Active, with expiry
        licenses.insert(
            "NEXUS-DEMO-ABCD-EFGH".to_string(),
            License {
                license_key: "NEXUS-DEMO-ABCD-EFGH".to_string(),
                dealer_id: "dealer-002".to_string(),
                dealer_name: "Demo Ticaret Ltd.".to_string(),
                mac_address: None,
                activated_at: None,
                expires_at: Some("2026-12-31T23:59:59Z".to_string()),
                is_active: true,
                max_activations: 1,
                current_activations: 0,
            },
        );

        // Test license 3 - Expired
        licenses.insert(
            "NEXUS-EXPR-1111-2222".to_string(),
            License {
                license_key: "NEXUS-EXPR-1111-2222".to_string(),
                dealer_id: "dealer-003".to_string(),
                dealer_name: "Suresi Dolmus Firma".to_string(),
                mac_address: None,
                activated_at: None,
                expires_at: Some("2024-01-01T00:00:00Z".to_string()),
                is_active: true,
                max_activations: 1,
                current_activations: 0,
            },
        );

        // Test license 4 - Deactivated
        licenses.insert(
            "NEXUS-DEAD-0000-0000".to_string(),
            License {
                license_key: "NEXUS-DEAD-0000-0000".to_string(),
                dealer_id: "dealer-004".to_string(),
                dealer_name: "Iptal Edilmis Firma".to_string(),
                mac_address: None,
                activated_at: None,
                expires_at: None,
                is_active: false,
                max_activations: 1,
                current_activations: 0,
            },
        );

        AppState {
            licenses: Mutex::new(licenses),
            backups: Mutex::new(HashMap::new()),
            backup_dir,
        }
    }
}

// ============================================================================
// LICENSE ENDPOINTS
// ============================================================================

/// POST /api/license/validate
async fn validate_license(
    data: web::Data<AppState>,
    body: web::Json<LicenseValidateRequest>,
) -> HttpResponse {
    log::info!("License validation request: {:?}", body.license_key);

    let licenses = data.licenses.lock().unwrap();

    match licenses.get(&body.license_key) {
        Some(license) => {
            // Check if license is active
            if !license.is_active {
                return HttpResponse::Forbidden().json(LicenseValidateResponse {
                    valid: false,
                    dealer_id: None,
                    dealer_name: None,
                    expires_at: None,
                    error: Some("LICENSE_DEACTIVATED".to_string()),
                    message: Some("Bu lisans deaktive edilmis".to_string()),
                });
            }

            // Check expiry
            if let Some(ref expires_at) = license.expires_at {
                if let Ok(expiry) = expires_at.parse::<DateTime<Utc>>() {
                    if expiry < Utc::now() {
                        return HttpResponse::Forbidden().json(LicenseValidateResponse {
                            valid: false,
                            dealer_id: None,
                            dealer_name: None,
                            expires_at: Some(expires_at.clone()),
                            error: Some("LICENSE_EXPIRED".to_string()),
                            message: Some("Lisans suresi dolmus".to_string()),
                        });
                    }
                }
            }

            // Check MAC address if already activated
            if let Some(ref registered_mac) = license.mac_address {
                if registered_mac != &body.mac_address {
                    return HttpResponse::Forbidden().json(LicenseValidateResponse {
                        valid: false,
                        dealer_id: None,
                        dealer_name: None,
                        expires_at: None,
                        error: Some("MAC_MISMATCH".to_string()),
                        message: Some("Bu lisans baska bir cihaza kayitli".to_string()),
                    });
                }
            }

            HttpResponse::Ok().json(LicenseValidateResponse {
                valid: true,
                dealer_id: Some(license.dealer_id.clone()),
                dealer_name: Some(license.dealer_name.clone()),
                expires_at: license.expires_at.clone(),
                error: None,
                message: Some("Lisans gecerli".to_string()),
            })
        }
        None => HttpResponse::NotFound().json(LicenseValidateResponse {
            valid: false,
            dealer_id: None,
            dealer_name: None,
            expires_at: None,
            error: Some("LICENSE_NOT_FOUND".to_string()),
            message: Some("Lisans bulunamadi".to_string()),
        }),
    }
}

/// POST /api/license/activate
async fn activate_license(
    data: web::Data<AppState>,
    body: web::Json<LicenseActivateRequest>,
) -> HttpResponse {
    log::info!("License activation request: {:?}", body.license_key);

    let mut licenses = data.licenses.lock().unwrap();

    match licenses.get_mut(&body.license_key) {
        Some(license) => {
            // Check if license is active
            if !license.is_active {
                return HttpResponse::Forbidden().json(LicenseActivateResponse {
                    success: false,
                    dealer_id: None,
                    dealer_name: None,
                    activated_at: None,
                    expires_at: None,
                    error: Some("LICENSE_DEACTIVATED".to_string()),
                    message: Some("Bu lisans deaktive edilmis".to_string()),
                });
            }

            // Check expiry
            if let Some(ref expires_at) = license.expires_at {
                if let Ok(expiry) = expires_at.parse::<DateTime<Utc>>() {
                    if expiry < Utc::now() {
                        return HttpResponse::Forbidden().json(LicenseActivateResponse {
                            success: false,
                            dealer_id: None,
                            dealer_name: None,
                            activated_at: None,
                            expires_at: Some(expires_at.clone()),
                            error: Some("LICENSE_EXPIRED".to_string()),
                            message: Some("Lisans suresi dolmus".to_string()),
                        });
                    }
                }
            }

            // Check if already activated on different device
            if let Some(ref registered_mac) = license.mac_address {
                if registered_mac != &body.mac_address {
                    // Check max activations
                    if license.current_activations >= license.max_activations {
                        return HttpResponse::Forbidden().json(LicenseActivateResponse {
                            success: false,
                            dealer_id: None,
                            dealer_name: None,
                            activated_at: None,
                            expires_at: None,
                            error: Some("MAX_ACTIVATIONS_REACHED".to_string()),
                            message: Some(format!(
                                "Maksimum aktivasyon sayisina ulasildi ({}/{})",
                                license.current_activations, license.max_activations
                            )),
                        });
                    }
                }
            }

            // Activate the license
            let now = Utc::now();
            license.mac_address = Some(body.mac_address.clone());
            license.activated_at = Some(now.to_rfc3339());
            license.current_activations += 1;

            log::info!(
                "License {} activated for MAC {} (device: {:?})",
                body.license_key,
                body.mac_address,
                body.device_name
            );

            HttpResponse::Ok().json(LicenseActivateResponse {
                success: true,
                dealer_id: Some(license.dealer_id.clone()),
                dealer_name: Some(license.dealer_name.clone()),
                activated_at: license.activated_at.clone(),
                expires_at: license.expires_at.clone(),
                error: None,
                message: Some("Lisans basariyla aktive edildi".to_string()),
            })
        }
        None => HttpResponse::NotFound().json(LicenseActivateResponse {
            success: false,
            dealer_id: None,
            dealer_name: None,
            activated_at: None,
            expires_at: None,
            error: Some("LICENSE_NOT_FOUND".to_string()),
            message: Some("Lisans bulunamadi".to_string()),
        }),
    }
}

// ============================================================================
// CLOUD SYNC ENDPOINTS
// ============================================================================

/// Helper to extract dealer info from headers
fn get_dealer_from_headers(req: &HttpRequest) -> Option<(String, String)> {
    let dealer_id = req
        .headers()
        .get("X-Dealer-ID")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())?;

    let license_key = req
        .headers()
        .get("X-License-Key")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())?;

    Some((dealer_id, license_key))
}

/// POST /api/cloud/backup
async fn cloud_backup(
    req: HttpRequest,
    data: web::Data<AppState>,
    mut payload: Multipart,
) -> HttpResponse {
    log::info!("Cloud backup request received");

    // Get dealer info from headers
    let (dealer_id, license_key) = match get_dealer_from_headers(&req) {
        Some(info) => info,
        None => {
            return HttpResponse::Unauthorized().json(CloudBackupResponse {
                success: false,
                backup_id: None,
                timestamp: None,
                message: None,
                error: Some("Missing dealer credentials in headers".to_string()),
            });
        }
    };

    // Verify license
    {
        let licenses = data.licenses.lock().unwrap();
        match licenses.get(&license_key) {
            Some(license) if license.is_active && license.dealer_id == dealer_id => {}
            _ => {
                return HttpResponse::Forbidden().json(CloudBackupResponse {
                    success: false,
                    backup_id: None,
                    timestamp: None,
                    message: None,
                    error: Some("Invalid license or dealer mismatch".to_string()),
                });
            }
        }
    }

    let mut file_data: Vec<u8> = Vec::new();
    let mut received_checksum: Option<String> = None;

    // Process multipart form
    while let Some(item) = payload.next().await {
        match item {
            Ok(mut field) => {
                let content_disposition = field.content_disposition();
                let field_name = content_disposition.get_name().unwrap_or("");

                match field_name {
                    "file" => {
                        while let Some(chunk) = field.next().await {
                            match chunk {
                                Ok(bytes) => file_data.extend_from_slice(&bytes),
                                Err(e) => {
                                    log::error!("Error reading file chunk: {}", e);
                                    return HttpResponse::InternalServerError().json(CloudBackupResponse {
                                        success: false,
                                        backup_id: None,
                                        timestamp: None,
                                        message: None,
                                        error: Some("Error reading file data".to_string()),
                                    });
                                }
                            }
                        }
                    }
                    "checksum" => {
                        let mut checksum_data = Vec::new();
                        while let Some(chunk) = field.next().await {
                            if let Ok(bytes) = chunk {
                                checksum_data.extend_from_slice(&bytes);
                            }
                        }
                        received_checksum = String::from_utf8(checksum_data).ok();
                    }
                    _ => {}
                }
            }
            Err(e) => {
                log::error!("Multipart error: {}", e);
                return HttpResponse::BadRequest().json(CloudBackupResponse {
                    success: false,
                    backup_id: None,
                    timestamp: None,
                    message: None,
                    error: Some("Error processing multipart form".to_string()),
                });
            }
        }
    }

    if file_data.is_empty() {
        return HttpResponse::BadRequest().json(CloudBackupResponse {
            success: false,
            backup_id: None,
            timestamp: None,
            message: None,
            error: Some("No file data received".to_string()),
        });
    }

    // Verify checksum if provided
    let calculated_checksum = {
        let mut hasher = Sha256::new();
        hasher.update(&file_data);
        hex::encode(hasher.finalize())
    };

    if let Some(ref recv_checksum) = received_checksum {
        if recv_checksum != &calculated_checksum {
            return HttpResponse::BadRequest().json(CloudBackupResponse {
                success: false,
                backup_id: None,
                timestamp: None,
                message: None,
                error: Some("Checksum mismatch".to_string()),
            });
        }
    }

    // Save backup file
    let backup_id = Uuid::new_v4().to_string();
    let timestamp = Utc::now();
    let file_name = format!("{}_{}.db", dealer_id, timestamp.format("%Y%m%d_%H%M%S"));
    let file_path = data.backup_dir.join(&file_name);

    match fs::write(&file_path, &file_data) {
        Ok(_) => {
            let backup_info = BackupInfo {
                backup_id: backup_id.clone(),
                dealer_id: dealer_id.clone(),
                timestamp,
                file_path: file_path.clone(),
                file_size: file_data.len() as u64,
                checksum: calculated_checksum,
            };

            data.backups.lock().unwrap().insert(dealer_id, backup_info);

            log::info!("Backup saved: {} ({} bytes)", file_path.display(), file_data.len());

            HttpResponse::Ok().json(CloudBackupResponse {
                success: true,
                backup_id: Some(backup_id),
                timestamp: Some(timestamp.to_rfc3339()),
                message: Some("Yedekleme basariyla tamamlandi".to_string()),
                error: None,
            })
        }
        Err(e) => {
            log::error!("Error saving backup: {}", e);
            HttpResponse::InternalServerError().json(CloudBackupResponse {
                success: false,
                backup_id: None,
                timestamp: None,
                message: None,
                error: Some("Error saving backup file".to_string()),
            })
        }
    }
}

/// GET /api/cloud/restore
async fn cloud_restore(req: HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    log::info!("Cloud restore request received");

    // Get dealer info from headers
    let (dealer_id, license_key) = match get_dealer_from_headers(&req) {
        Some(info) => info,
        None => {
            return HttpResponse::Unauthorized().body("Missing dealer credentials");
        }
    };

    // Verify license
    {
        let licenses = data.licenses.lock().unwrap();
        match licenses.get(&license_key) {
            Some(license) if license.is_active && license.dealer_id == dealer_id => {}
            _ => {
                return HttpResponse::Forbidden().body("Invalid license or dealer mismatch");
            }
        }
    }

    // Find backup for dealer
    let backups = data.backups.lock().unwrap();
    match backups.get(&dealer_id) {
        Some(backup_info) => {
            match fs::read(&backup_info.file_path) {
                Ok(file_data) => {
                    log::info!(
                        "Restoring backup for dealer {}: {} bytes",
                        dealer_id,
                        file_data.len()
                    );
                    HttpResponse::Ok()
                        .content_type("application/octet-stream")
                        .insert_header(("X-Backup-ID", backup_info.backup_id.as_str()))
                        .insert_header(("X-Backup-Checksum", backup_info.checksum.as_str()))
                        .body(file_data)
                }
                Err(e) => {
                    log::error!("Error reading backup file: {}", e);
                    HttpResponse::InternalServerError().body("Error reading backup file")
                }
            }
        }
        None => HttpResponse::NotFound().body("No backup found for this dealer"),
    }
}

/// GET /api/cloud/status
async fn cloud_status(req: HttpRequest, data: web::Data<AppState>) -> HttpResponse {
    log::info!("Cloud status request received");

    // Get dealer info from headers
    let (dealer_id, license_key) = match get_dealer_from_headers(&req) {
        Some(info) => info,
        None => {
            return HttpResponse::Unauthorized().json(CloudStatusResponse {
                has_backup: false,
                last_backup_at: None,
                backup_size_bytes: None,
                backup_count: 0,
            });
        }
    };

    // Verify license
    {
        let licenses = data.licenses.lock().unwrap();
        match licenses.get(&license_key) {
            Some(license) if license.is_active && license.dealer_id == dealer_id => {}
            _ => {
                return HttpResponse::Forbidden().json(CloudStatusResponse {
                    has_backup: false,
                    last_backup_at: None,
                    backup_size_bytes: None,
                    backup_count: 0,
                });
            }
        }
    }

    // Get backup info
    let backups = data.backups.lock().unwrap();
    match backups.get(&dealer_id) {
        Some(backup_info) => HttpResponse::Ok().json(CloudStatusResponse {
            has_backup: true,
            last_backup_at: Some(backup_info.timestamp.to_rfc3339()),
            backup_size_bytes: Some(backup_info.file_size),
            backup_count: 1,
        }),
        None => HttpResponse::Ok().json(CloudStatusResponse {
            has_backup: false,
            last_backup_at: None,
            backup_size_bytes: None,
            backup_count: 0,
        }),
    }
}

// ============================================================================
// HEALTH & INFO ENDPOINTS
// ============================================================================

/// GET /api/health
async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "timestamp": Utc::now().to_rfc3339()
    }))
}

/// GET /api/licenses (Debug endpoint - list all licenses)
async fn list_licenses(data: web::Data<AppState>) -> HttpResponse {
    let licenses = data.licenses.lock().unwrap();
    let license_list: Vec<&License> = licenses.values().collect();
    HttpResponse::Ok().json(license_list)
}

// ============================================================================
// MAIN
// ============================================================================

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .unwrap_or(3000);

    let app_state = web::Data::new(AppState::new());

    log::info!("========================================");
    log::info!("  Nexus API Server - Mock Backend");
    log::info!("========================================");
    log::info!("Server starting on http://localhost:{}", port);
    log::info!("");
    log::info!("Test Licenses:");
    log::info!("  - NEXUS-TEST-1234-5678 (Active, no expiry)");
    log::info!("  - NEXUS-DEMO-ABCD-EFGH (Active, expires 2026-12-31)");
    log::info!("  - NEXUS-EXPR-1111-2222 (Expired)");
    log::info!("  - NEXUS-DEAD-0000-0000 (Deactivated)");
    log::info!("");
    log::info!("Endpoints:");
    log::info!("  POST /api/license/validate");
    log::info!("  POST /api/license/activate");
    log::info!("  POST /api/cloud/backup");
    log::info!("  GET  /api/cloud/restore");
    log::info!("  GET  /api/cloud/status");
    log::info!("  GET  /api/health");
    log::info!("  GET  /api/licenses (debug)");
    log::info!("========================================");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .app_data(app_state.clone())
            .wrap(middleware::Logger::default())
            .wrap(cors)
            // Health
            .route("/api/health", web::get().to(health_check))
            // License endpoints
            .route("/api/license/validate", web::post().to(validate_license))
            .route("/api/license/activate", web::post().to(activate_license))
            .route("/api/licenses", web::get().to(list_licenses))
            // Cloud endpoints
            .route("/api/cloud/backup", web::post().to(cloud_backup))
            .route("/api/cloud/restore", web::get().to(cloud_restore))
            .route("/api/cloud/status", web::get().to(cloud_status))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
