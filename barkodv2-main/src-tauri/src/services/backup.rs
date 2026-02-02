//! Backup Service Module
//! 
//! Otomatik ve manuel veritabanı yedekleme sistemi

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use directories::ProjectDirs;
use chrono::{Local, Datelike, Timelike};

static BACKUP_RUNNING: AtomicBool = AtomicBool::new(false);

/// Backup configuration
pub struct BackupConfig {
    pub enabled: bool,
    pub interval_hours: u32,
    pub max_backups: usize,
    pub backup_dir: PathBuf,
}

impl Default for BackupConfig {
    fn default() -> Self {
        let backup_dir = get_backup_directory().unwrap_or_else(|| PathBuf::from("."));
        Self {
            enabled: true,
            interval_hours: 6,
            max_backups: 10,
            backup_dir,
        }
    }
}

/// Get backup directory path
pub fn get_backup_directory() -> Option<PathBuf> {
    ProjectDirs::from("com", "nexus", "inventory")
        .map(|proj| proj.data_dir().join("backups"))
}

/// Create backup of the database
pub fn create_backup(db_path: &str) -> Result<PathBuf, String> {
    let backup_dir = get_backup_directory()
        .ok_or("Yedek dizini belirlenemedi")?;
    
    // Ensure backup directory exists
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Yedek dizini oluşturulamadı: {}", e))?;
    
    // Generate backup filename with timestamp
    let now = Local::now();
    let filename = format!(
        "nexus_backup_{:04}{:02}{:02}_{:02}{:02}{:02}.db",
        now.year(), now.month(), now.day(),
        now.hour(), now.minute(), now.second()
    );
    let backup_path = backup_dir.join(&filename);
    
    // Copy database file
    std::fs::copy(db_path, &backup_path)
        .map_err(|e| format!("Yedek kopyalanamadı: {}", e))?;
    
    // Clean old backups
    if let Err(e) = cleanup_old_backups(&backup_dir, 10) {
        eprintln!("Eski yedekler temizlenemedi: {}", e);
    }
    
    println!("[Backup] Created: {}", backup_path.display());
    Ok(backup_path)
}

/// List all available backups
pub fn list_backups() -> Result<Vec<BackupInfo>, String> {
    let backup_dir = get_backup_directory()
        .ok_or("Yedek dizini belirlenemedi")?;
    
    if !backup_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut backups = Vec::new();
    
    let entries = std::fs::read_dir(&backup_dir)
        .map_err(|e| format!("Yedek dizini okunamadı: {}", e))?;
    
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "db").unwrap_or(false) {
            if let Ok(metadata) = std::fs::metadata(&path) {
                backups.push(BackupInfo {
                    filename: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(),
                    size_bytes: metadata.len(),
                    created_at: metadata.modified()
                        .map(|t| chrono::DateTime::<Local>::from(t).to_rfc3339())
                        .unwrap_or_default(),
                });
            }
        }
    }
    
    // Sort by date (newest first)
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(backups)
}

/// Restore database from backup
pub fn restore_backup(backup_path: &str, db_path: &str) -> Result<(), String> {
    // Verify backup file exists
    if !std::path::Path::new(backup_path).exists() {
        return Err("Yedek dosyası bulunamadı".to_string());
    }
    
    // Copy backup to database location
    std::fs::copy(backup_path, db_path)
        .map_err(|e| format!("Yedek geri yüklenemedi: {}", e))?;
    
    println!("[Backup] Restored from: {}", backup_path);
    Ok(())
}

/// Delete a specific backup
pub fn delete_backup(backup_path: &str) -> Result<(), String> {
    std::fs::remove_file(backup_path)
        .map_err(|e| format!("Yedek silinemedi: {}", e))
}

/// Cleanup old backups, keeping only the most recent ones
fn cleanup_old_backups(backup_dir: &PathBuf, keep_count: usize) -> Result<(), String> {
    let mut backups = list_backups()?;
    
    if backups.len() <= keep_count {
        return Ok(());
    }
    
    // Remove oldest backups
    for backup in backups.drain(keep_count..) {
        if let Err(e) = std::fs::remove_file(&backup.path) {
            eprintln!("Eski yedek silinemedi {}: {}", backup.filename, e);
        } else {
            println!("[Backup] Cleaned: {}", backup.filename);
        }
    }
    
    Ok(())
}

/// Backup info structure
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupInfo {
    pub filename: String,
    pub path: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

/// Start automatic backup scheduler
pub fn start_backup_scheduler(db_path: String, interval_hours: u64) {
    if BACKUP_RUNNING.swap(true, Ordering::SeqCst) {
        println!("[Backup] Scheduler already running");
        return;
    }
    
    std::thread::spawn(move || {
        let interval = Duration::from_secs(interval_hours * 3600);
        
        loop {
            std::thread::sleep(interval);
            
            if !BACKUP_RUNNING.load(Ordering::SeqCst) {
                break;
            }
            
            match create_backup(&db_path) {
                Ok(path) => println!("[Backup] Scheduled backup created: {}", path.display()),
                Err(e) => eprintln!("[Backup] Scheduled backup failed: {}", e),
            }
        }
        
        println!("[Backup] Scheduler stopped");
    });
    
    println!("[Backup] Scheduler started (interval: {} hours)", interval_hours);
}

/// Stop automatic backup scheduler
pub fn stop_backup_scheduler() {
    BACKUP_RUNNING.store(false, Ordering::SeqCst);
}
