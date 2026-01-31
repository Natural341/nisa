mod commands;
mod database;
mod models;
mod error;
mod security;
mod cache;
mod services;
#[cfg(test)]
mod security_tests;
pub mod license;
pub mod cloud;

pub use commands::*;
pub use database::{Database, DbPool, DbConn, init_database};
pub use models::*;
pub use error::*;

use tauri::{Manager, tray::{TrayIconBuilder, MouseButton, MouseButtonState}, menu::{Menu, MenuItem}};
use std::sync::Mutex;
use cache::AppCache;

/// Application state holding the SQLite database and cache
pub struct AppState {
    pub db: Database,
    pub cache: Mutex<AppCache>,
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
            
            // Auto-seed if empty
            if let Ok(conn) = db.get_conn() {
                let _ = services::inventory::check_and_seed_initial_data(&conn);
            }



            // Get db_path before moving db into AppState
            let db_path = db.get_db_path_string();

            app.manage(AppState {
                db,
                cache: Mutex::new(AppCache::new()),
            });

            // Start background sync service (5 minute interval = 300 seconds)
            if let Err(e) = services::sync::start_background_sync(db_path, 300) {
                eprintln!("Background sync could not start: {}", e);
            }

            // Setup tray menu
            let show_item = MenuItem::with_id(app, "show", "Göster", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Gizle", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
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
            check_users_exist,
            get_all_users,
            create_user,
            update_user,
            delete_user,
            change_password,
            get_users_for_login, // Yeni - Login grid icin
            // Pagination commands
            get_items_paginated,
            get_transactions_with_pagination,
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
            save_to_downloads,
            import_from_csv,
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
            update_current_account,
            delete_current_account,
            verify_admin_password,
            get_expense_categories,
            add_expense_category,
            delete_expense_category,
            get_scanner_status,
            // Finance commands
            add_finance_record,
            get_finance_records,
            delete_finance_record,
            get_finance_summary,
            // Access Code commands
            create_access_code,
            get_access_codes,
            delete_access_code,
            login_with_code,
            process_goods_receipt,
            get_product_lots,
            // Current Account (Cari) commands
            create_current_account,
            get_current_accounts,
            // Stock Card commands
            create_stock_card,
            get_stock_cards,
            update_stock_card,
            // Category commands
            create_category,
            get_categories,
            delete_category,
            sync_inventory_categories,
            // Seed data command
            seed_data,
            factory_reset,
            process_expense,
            // Invoice number generation
            generate_invoice_number,
            // Goods receipt history
            get_goods_receipt_history,
            // Stock card deletion
            delete_stock_card,
            // Check commands
            check_sku_exists,
            check_category_usage,
            check_current_account_exists,
            // Multi-device sync commands
            perform_device_sync,
            get_device_sync_state,
            start_device_sync,
            stop_device_sync,
            is_device_sync_running,
            queue_sync_transaction,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


