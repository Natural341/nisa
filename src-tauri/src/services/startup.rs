//! Startup Service Module
//! 
//! Windows başlangıcında uygulama açma yönetimi

#[cfg(target_os = "windows")]
use winreg::{enums::*, RegKey};

/// Windows başlangıcına uygulamayı ekle
#[cfg(target_os = "windows")]
pub fn set_startup_enabled(enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = hkcu
        .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_ALL_ACCESS)
        .map_err(|e| format!("Registry açılamadı: {}", e))?;

    let app_name = "NexusInventory";

    if enabled {
        // Get current executable path
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Exe yolu alınamadı: {}", e))?;
        
        let exe_str = exe_path.to_string_lossy().to_string();
        
        run_key
            .set_value(app_name, &exe_str)
            .map_err(|e| format!("Registry yazılamadı: {}", e))?;
        
        println!("[Startup] Added to Windows startup: {}", exe_str);
    } else {
        // Remove from startup
        let _ = run_key.delete_value(app_name);
        println!("[Startup] Removed from Windows startup");
    }

    Ok(())
}

/// Windows başlangıcında olup olmadığını kontrol et
#[cfg(target_os = "windows")]
pub fn is_startup_enabled() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    if let Ok(run_key) = hkcu.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run") {
        run_key.get_value::<String, _>("NexusInventory").is_ok()
    } else {
        false
    }
}

// Non-Windows fallback implementations
#[cfg(not(target_os = "windows"))]
pub fn set_startup_enabled(_enabled: bool) -> Result<(), String> {
    Err("Başlangıç özelliği sadece Windows'ta desteklenir".to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn is_startup_enabled() -> bool {
    false
}
