mod commands;
mod database;
mod models;
mod error;
mod security;
mod cache;
mod services;
pub mod license;
pub mod cloud;

pub use commands::*;
pub use database::{Database, DbPool, DbConn, init_database};
pub use models::*;
pub use error::*;

use tauri::{Manager, tray::{TrayIconBuilder, MouseButton, MouseButtonState}, menu::{Menu, MenuItem}};

/// Application state holding the SQLite database
pub struct AppState {
    pub db: Database,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // .plugin(tauri_plugin_updater::Builder::new().build()) // TODO: Production'da aktifleştir
        .setup(|app| {
            // Initialize SQLite database
            let db = init_database().expect("SQLite veritabani baslatilamadi");

            // Create default admin user if needed
            if let Err(e) = create_default_admin(&db) {
                eprintln!("Varsayilan admin olusturulamadi: {}", e);
            }

            app.manage(AppState { db });

            // Setup tray menu
            let show_item = MenuItem::with_id(app, "show", "Göster", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Gizle", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Handle window close - minimize to tray instead of closing
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Inventory commands
            get_all_items,
            get_item_by_sku,
            add_item,
            update_item,
            delete_item,
            update_quantity,
            // Transaction commands
            process_sale,
            get_transactions,
            update_transaction,
            // Dashboard & Analytics
            get_dashboard_stats,
            get_recent_activities,
            log_activity,
            get_category_stats,
            get_sales_by_date_range,
            get_transactions_by_date_range,
            // Import/Export
            export_to_csv,
            import_from_csv,
            export_database,
            import_database,
            // Database management
            clear_database,
            apply_price_change_by_category,
            seed_database,
            // User authentication commands
            login,
            get_all_users,
            create_user,
            update_user,
            delete_user,
            change_password,
            // Pagination commands
            get_items_paginated,
            get_transactions_paginated,
            // License commands
            get_mac_address,
            get_license_status,
            validate_license,
            activate_license,
            check_license_validity,
            deactivate_license,
            // Cloud sync commands
            cloud_backup,
            cloud_restore,
            get_sync_status,
            get_cloud_status,
            set_auto_sync,
            // Local backup commands
            create_local_backup,
            list_local_backups,
            restore_local_backup,
            delete_local_backup,
            start_auto_backup,
            stop_auto_backup,
            // Startup commands
            set_windows_startup,
            get_windows_startup_status,
            // Print commands
            generate_receipt,
            generate_invoice,
            // Updater commands
            get_app_version,
            // Scanner commands
            parse_barcode,
            validate_barcode,
            start_scanner,
            stop_scanner,
            get_scanner_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Create default admin user if no users exist
fn create_default_admin(db: &Database) -> Result<(), AppError> {
    let conn = db.get_conn()?;

    let user_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |row| row.get(0)
    ).unwrap_or(0);

    if user_count == 0 {
        let admin_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let password_hash = security::password::hash_password("admin123")
            .expect("Varsayılan admin şifresi hash'lenemedi");

        conn.execute(
            "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![&admin_id, "admin", &password_hash, "Yönetici", "admin", &now],
        )?;

        println!("Varsayilan admin kullanicisi olusturuldu");
    }

    Ok(())
}
