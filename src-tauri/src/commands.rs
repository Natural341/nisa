use crate::models::{
    CartItem, DashboardStats, InventoryItem, Transaction, SalesDataPoint, CategoryStats,
    ActivityLog, User, CreateUserRequest, UpdateUserRequest,
    License, LicenseValidateResponse, LicenseActivateResponse,
    SyncStatus, CloudBackupResponse, CloudStatusResponse,
    PaginatedItemsResponse, PaginatedTransactionsResponse,
    FinanceRecord, FinanceSummary, AccessCode, GoodsReceiptItem,
    CurrentAccount, CreateCurrentAccountRequest, StockCard, CreateStockCardRequest,
    Category, CreateCategoryRequest, InventoryLot,
};
use crate::AppState;
use crate::security::password::{hash_password, verify_password};
use crate::security::validation::{validate_sku, validate_price, validate_quantity, validate_username, validate_password_strength};
use crate::license;
use crate::cloud;
use crate::services::backup::{self, BackupInfo};
use crate::services::startup;
use crate::services::print as print_service;
use crate::services::updater as updater_service;
use crate::services::scanner;
use crate::services::inventory;
use rusqlite::{params, OptionalExtension};
use tauri::State;

// ==================== INVENTORY COMMANDS ====================

#[tauri::command]
pub fn get_all_items(state: State<AppState>) -> Result<Vec<InventoryItem>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency, supplier_id, brand FROM inventory_items ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let items = stmt.query_map([], |row| {
        let ai_tags_str: Option<String> = row.get(10)?;
        let ai_tags: Option<Vec<String>> = ai_tags_str.and_then(|s| serde_json::from_str(&s).ok());

        Ok(InventoryItem {
            id: row.get(0)?,
            sku: row.get(1)?,
            name: row.get(2)?,
            category: row.get(3)?,
            quantity: row.get(4)?,
            location: row.get(5)?,
            price: row.get(6)?,
            cost_price: row.get(7)?,
            image: row.get(8)?,
            description: row.get(9)?,
            ai_tags,
            last_updated: row.get(11)?,
            currency: row.get(12)?,
            supplier_id: row.get(13)?,
            brand: row.get(14).unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;

    items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_item_by_sku(state: State<AppState>, sku: String) -> Result<Option<InventoryItem>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency, supplier_id, brand FROM inventory_items WHERE sku = ?1"
    ).map_err(|e| e.to_string())?;

    let item = stmt.query_row(params![&sku], |row| {
        let ai_tags_str: Option<String> = row.get(10)?;
        let ai_tags: Option<Vec<String>> = ai_tags_str.and_then(|s| serde_json::from_str(&s).ok());

        Ok(InventoryItem {
            id: row.get(0)?,
            sku: row.get(1)?,
            name: row.get(2)?,
            category: row.get(3)?,
            quantity: row.get(4)?,
            location: row.get(5)?,
            price: row.get(6)?,
            cost_price: row.get(7)?,
            image: row.get(8)?,
            description: row.get(9)?,
            ai_tags,
            last_updated: row.get(11)?,
            currency: row.get(12)?,
            supplier_id: row.get(13)?,
            brand: row.get(14).unwrap_or(None),
        })
    }).optional().map_err(|e| e.to_string())?;

    Ok(item)
}

#[tauri::command]
pub fn add_item(state: State<AppState>, item: InventoryItem) -> Result<(), String> {
    // Input validation
    validate_sku(&item.sku)?;
    validate_price(item.price)?;
    validate_quantity(item.quantity)?;

    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let ai_tags_str = serde_json::to_string(&item.ai_tags).unwrap_or("[]".to_string());

    conn.execute(
        "INSERT INTO inventory_items (id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency, supplier_id, brand) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            &item.id,
            &item.sku,
            &item.name,
            &item.category,
            item.quantity,
            &item.location,
            item.price,
            item.cost_price,
            &item.image,
            &item.description,
            &ai_tags_str,
            &item.last_updated,
            &item.currency,
            &item.supplier_id,
            &item.brand,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_item(state: State<AppState>, item: InventoryItem) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let ai_tags_str = serde_json::to_string(&item.ai_tags).unwrap_or("[]".to_string());

    conn.execute(
        "UPDATE inventory_items SET name = ?1, category = ?2, quantity = ?3, location = ?4, price = ?5, cost_price = ?6, image = ?7, description = ?8, ai_tags = ?9, last_updated = ?10, currency = ?11, supplier_id = ?12, brand = ?13 WHERE sku = ?14",
        params![
            &item.name,
            &item.category,
            item.quantity,
            &item.location,
            item.price,
            item.cost_price,
            &item.image,
            &item.description,
            &ai_tags_str,
            &item.last_updated,
            &item.currency,
            &item.supplier_id,
            &item.brand,
            &item.sku,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_item(state: State<AppState>, sku: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM inventory_items WHERE sku = ?1", params![&sku])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_quantity(state: State<AppState>, sku: String, quantity: i32) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE inventory_items SET quantity = ?1, last_updated = ?2 WHERE sku = ?3",
        params![quantity, &now, &sku],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

// ==================== TRANSACTION COMMANDS ====================

#[tauri::command]
pub fn process_sale(
    state: State<AppState>,
    cart_items: Vec<CartItem>,
    payment_method: String,
    transaction_type: String,
    note: Option<String>,
    customer_id: Option<String>,
) -> Result<Transaction, String> {
    let mut conn = state.db.get_conn().map_err(|e| e.to_string())?;

    inventory::process_sale_transaction(
        &mut conn,
        cart_items,
        payment_method,
        transaction_type,
        note,
        customer_id
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_transactions(state: State<AppState>) -> Result<Vec<Transaction>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, items, total, payment_method, transaction_type, note, created_at, customer_id FROM transactions ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let transactions = stmt.query_map([], |row| {
        let items_json: String = row.get(1)?;
        let items: Vec<CartItem> = serde_json::from_str(&items_json).unwrap_or_default();

        Ok(Transaction {
            id: row.get(0)?,
            items,
            total: row.get(2)?,
            payment_method: row.get(3)?,
            transaction_type: row.get(4)?,
            status: "completed".to_string(),
            note: row.get(5)?,
            created_at: row.get(6)?,
            customer_id: row.get(7).unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;

    transactions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_transactions_by_date_range(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<Transaction>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, items, total, payment_method, transaction_type, note, created_at, customer_id FROM transactions WHERE substr(created_at, 1, 10) >= ?1 AND substr(created_at, 1, 10) <= ?2 ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let transactions = stmt.query_map(params![&start_date, &end_date], |row| {
        let items_json: String = row.get(1)?;
        let items: Vec<CartItem> = serde_json::from_str(&items_json).unwrap_or_default();

        Ok(Transaction {
            id: row.get(0)?,
            items,
            total: row.get(2)?,
            payment_method: row.get(3)?,
            transaction_type: row.get(4)?,
            status: "completed".to_string(),
            note: row.get(5)?,
            created_at: row.get(6)?,
            customer_id: row.get(7).unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;

    transactions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
pub struct TransactionUpdate {
    pub payment_method: Option<String>,
    pub note: Option<String>,
}

#[tauri::command]
pub fn update_transaction(
    state: State<AppState>,
    id: String,
    updates: TransactionUpdate,
) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    if let Some(pm) = updates.payment_method {
        conn.execute(
            "UPDATE transactions SET payment_method = ?1 WHERE id = ?2",
            params![&pm, &id],
        ).map_err(|e| e.to_string())?;
    }

    if let Some(n) = updates.note {
        conn.execute(
            "UPDATE transactions SET note = ?1 WHERE id = ?2",
            params![&n, &id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ==================== DASHBOARD & ANALYTICS COMMANDS ====================

#[tauri::command]
pub fn get_dashboard_stats(state: State<AppState>) -> Result<DashboardStats, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let total_items: i32 = conn.query_row(
        "SELECT COUNT(*) FROM inventory_items",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let total_quantity: i32 = conn.query_row(
        "SELECT COALESCE(SUM(quantity), 0) FROM inventory_items",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let low_stock_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM inventory_items WHERE quantity < 10",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let total_revenue: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total), 0) FROM transactions",
        [],
        |row| row.get(0),
    ).unwrap_or(0.0);

    Ok(DashboardStats {
        total_items,
        total_quantity,
        low_stock_count,
        total_revenue,
    })
}

#[tauri::command]
pub fn get_sales_by_date_range(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<SalesDataPoint>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let start_dt = format!("{}T00:00:00", start_date);
    let end_dt = format!("{}T23:59:59", end_date);

    let mut stmt = conn.prepare(
        "SELECT date(created_at) as sale_date, COALESCE(SUM(total), 0) as daily_total, COUNT(*) as sale_count FROM transactions WHERE created_at >= ?1 AND created_at <= ?2 GROUP BY date(created_at) ORDER BY sale_date ASC"
    ).map_err(|e| e.to_string())?;

    let sales = stmt.query_map(params![&start_dt, &end_dt], |row| {
        Ok(SalesDataPoint {
            date: row.get(0)?,
            total: row.get(1)?,
            count: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;

    sales.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_category_stats(state: State<AppState>) -> Result<Vec<CategoryStats>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT category, COUNT(*) as count, COALESCE(SUM(quantity), 0) as total_qty, COALESCE(SUM(price * quantity), 0) as total_val FROM inventory_items GROUP BY category ORDER BY count DESC"
    ).map_err(|e| e.to_string())?;

    let stats = stmt.query_map([], |row| {
        Ok(CategoryStats {
            category: row.get(0)?,
            count: row.get(1)?,
            total_quantity: row.get(2)?,
            total_value: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    stats.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ==================== ACTIVITY LOG COMMANDS ====================

#[tauri::command]
pub fn get_recent_activities(state: State<AppState>, limit: i32) -> Result<Vec<ActivityLog>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, action_type, description, item_id, item_name, quantity_change, value, created_at FROM activity_log ORDER BY created_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let activities = stmt.query_map(params![limit], |row| {
        Ok(ActivityLog {
            id: row.get(0)?,
            action_type: row.get(1)?,
            description: row.get(2)?,
            item_id: row.get(3)?,
            item_name: row.get(4)?,
            quantity_change: row.get(5)?,
            value: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    activities.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn log_activity(
    state: State<AppState>,
    action_type: String,
    description: String,
    item_id: Option<String>,
    item_name: Option<String>,
    quantity_change: Option<i32>,
    value: Option<f64>,
) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO activity_log (action_type, description, item_id, item_name, quantity_change, value, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![&action_type, &description, &item_id, &item_name, quantity_change, value, &now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

// ==================== IMPORT/EXPORT COMMANDS ====================

#[tauri::command]
pub fn export_to_csv(state: State<AppState>, file_path: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, sku, name, category, quantity, location, price, cost_price, currency, last_updated FROM inventory_items"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, i32>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, f64>(6)?,
            row.get::<_, f64>(7)?,
            row.get::<_, String>(8)?,
            row.get::<_, String>(9)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut csv_content = String::from("\u{FEFF}");
    csv_content.push_str("ID;SKU;Ürün Adı;Kategori;Miktar;Konum;Satış Fiyatı;Alış Fiyatı;Para Birimi;Son Güncelleme\n");

    for row_result in rows {
        let (id, sku, name, category, quantity, location, price, cost_price, currency, last_updated) = row_result.map_err(|e| e.to_string())?;
        csv_content.push_str(&format!(
            "{};{};{};{};{};{};{:.2};{:.2};{};{}\n",
            id, sku, name, category, quantity, location, price, cost_price, currency, last_updated
        ));
    }

    std::fs::write(&file_path, csv_content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_from_csv(state: State<AppState>, file_path: String) -> Result<i32, String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let lines: Vec<&str> = content.lines().collect();
    
    // Check if empty or just header
    if lines.is_empty() {
        return Ok(0);
    }

    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut count = 0;

    // Start transaction
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    // Skip header line (index 0)
    for line in lines.iter().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split(';').collect();
        if parts.len() < 3 {
            continue; // Need at least SKU, Name
        }

        // Expected format: ID;SKU;Name;Category;Quantity;Location;Price;CostPrice;Currency;LastUpdated
        // We will be flexible. If importing from our own export, we have IDs. 
        // If importing new data, we might not have IDs.

        // Let's try to parse based on standard export format
        let sku = parts.get(1).unwrap_or(&"").trim();
        let name = parts.get(2).unwrap_or(&"").trim();
        
        if sku.is_empty() || name.is_empty() {
            continue;
        }

        let category = parts.get(3).unwrap_or(&"Genel").trim();
        let quantity: i32 = parts.get(4).unwrap_or(&"0").trim().parse().unwrap_or(0);
        let location = parts.get(5).unwrap_or(&"").trim();
        let price: f64 = parts.get(6).unwrap_or(&"0.0").trim().replace(',', ".").parse().unwrap_or(0.0);
        let cost_price: f64 = parts.get(7).unwrap_or(&"0.0").trim().replace(',', ".").parse().unwrap_or(0.0);
        let currency = parts.get(8).unwrap_or(&"TL").trim();

        // Check if item exists
        let exists: i32 = conn.query_row(
            "SELECT COUNT(*) FROM inventory_items WHERE sku = ?1",
            params![sku],
            |row| row.get(0),
        ).unwrap_or(0);

        if exists > 0 {
            // Update
             conn.execute(
                "UPDATE inventory_items SET name = ?1, category = ?2, quantity = ?3, location = ?4, price = ?5, cost_price = ?6, currency = ?7, last_updated = ?8 WHERE sku = ?9",
                params![name, category, quantity, location, price, cost_price, currency, &now, sku],
            ).map_err(|e| e.to_string())?;
        } else {
            // Insert
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO inventory_items (id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    &id,
                    sku,
                    name,
                    category,
                    quantity,
                    location,
                    price,
                    cost_price,
                    "", // No image
                    "", // No description
                    "[]", // Empty tags
                    &now,
                    currency,
                ],
            ).map_err(|e| e.to_string())?;
        }
        count += 1;
    }

    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(count)
}

#[tauri::command]
pub fn save_to_downloads(content: String, filename: String) -> Result<String, String> {
    let user_dirs = directories::UserDirs::new().ok_or("Kullanıcı klasörleri bulunamadı")?;
    let download_dir = user_dirs.download_dir().ok_or("İndirilenler klasörü bulunamadı")?;
    let path = download_dir.join(&filename);
    
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    
    Ok(path.to_string_lossy().to_string())
}

// ==================== DATABASE MANAGEMENT COMMANDS ====================

#[tauri::command]
pub fn clear_database(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM inventory_items", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM transactions", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM activity_log", []).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn export_database(state: State<AppState>, file_path: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let db_path = state.db.get_db_path_string();

    // Force WAL checkpoint to flush all data to main database file
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| format!("WAL checkpoint basarisiz: {}", e))?;

    // Copy the database file to the specified path
    std::fs::copy(&db_path, &file_path)
        .map_err(|e| format!("Veritabani kopyalanamadi: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn import_database(state: State<AppState>, file_path: String) -> Result<(), String> {
    // Verify the source file exists
    if !std::path::Path::new(&file_path).exists() {
        return Err("Kaynak dosya bulunamadi".to_string());
    }

    let db_path = state.db.get_db_path_string();

    // Open the source database
    let source_conn = rusqlite::Connection::open(&file_path)
        .map_err(|e| format!("Kaynak veritabani acilamadi: {}", e))?;

    // Open direct mutable connection to destination (not through pool)
    let mut dest_conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("Hedef veritabani acilamadi: {}", e))?;

    // Use SQLite backup API to restore into destination
    let backup = rusqlite::backup::Backup::new(&source_conn, &mut dest_conn)
        .map_err(|e| format!("Backup olusturulamadi: {}", e))?;

    backup.run_to_completion(100, std::time::Duration::from_millis(50), None)
        .map_err(|e| format!("Backup tamamlanamadi: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn apply_price_change_by_category(
    state: State<AppState>,
    category: String,
    percentage: f64,
) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let multiplier = 1.0 + (percentage / 100.0);

    if category == "HEPSİ" || category == "TÜMÜ" {
        conn.execute(
            "UPDATE inventory_items SET price = price * ?1, last_updated = ?2",
            params![multiplier, &now],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE inventory_items SET price = price * ?1, last_updated = ?2 WHERE category = ?3",
            params![multiplier, &now, &category],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn seed_database(_state: State<AppState>) -> Result<String, String> {
    /*
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    // Clear existing data
    conn.execute("DELETE FROM inventory_items", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM transactions", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM activity_log", []).map_err(|e| e.to_string())?;

    let categories = ["Elektronik", "Giyim", "Gıda", "Kırtasiye", "Aksesuar"];

    for i in 1..=20 {
        let id = uuid::Uuid::new_v4().to_string();
        let sku = format!("MOCK-{:03}", i);
        let name = format!("Numune Ürün {}", i);
        let category = categories[i % categories.len()];
        let quantity = ((i * 5) % 100) as i32;
        let price = (i as f64) * 15.0 + 10.0;
        let cost_price = price * 0.6;

        conn.execute(
            "INSERT INTO inventory_items (id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                &id,
                &sku,
                &name,
                category,
                quantity,
                "Raf A-1",
                price,
                cost_price,
                "",
                "Otomatik oluşturulan veri",
                "[\"mock\", \"auto\"]",
                &now,
                "TL",
            ],
        ).map_err(|e| e.to_string())?;
    }

    for i in 0..200 {
        let id = uuid::Uuid::new_v4().to_string();
        let days_ago = (i % 180) as i64;
        let t_date = (chrono::Utc::now() - chrono::Duration::days(days_ago)).to_rfc3339();

        let is_return = i % 12 == 0;
        let base_total = ((i % 50) as f64 * 15.0) + 50.0;
        let total = if is_return { -base_total } else { base_total };
        let tx_type = if is_return { "RETURN" } else { "SALE" };
        let payment_methods = ["Nakit", "Kredi Kartı", "Veresiye"];
        let payment_method = payment_methods[i % 3];

        conn.execute(
            "INSERT INTO transactions (id, items, total, payment_method, transaction_type, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&id, "[]", total, payment_method, tx_type, "Otomatik Veri", &t_date],
        ).map_err(|e| e.to_string())?;
    }
    */

    Ok("Test verisi oluşturma devre dışı bırakıldı.".to_string())
}

#[tauri::command]
pub fn factory_reset(state: State<AppState>, admin_password: Option<String>) -> Result<String, String> {
    let mut conn = state.db.get_conn().map_err(|e| e.to_string())?;
    
    // Start transaction
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Clear Business Data
    tx.execute("DELETE FROM transactions", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM inventory_items", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM inventory_lots", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM current_accounts", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM stock_cards", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM categories", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM expense_categories", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM finance_records", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM activity_log", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM access_codes", []).map_err(|e| e.to_string())?;
    
    // Clear Users
    tx.execute("DELETE FROM users", []).map_err(|e| e.to_string())?;
    
    // Re-create Admin User
    let admin_id = uuid::Uuid::new_v4().to_string();
    
    // Require password for factory reset
    let pwd = admin_password.ok_or("Sıfırlama için yönetici şifresi belirtilmelidir.".to_string())?;
    if pwd.is_empty() {
        return Err("Sıfırlama için yönetici şifresi boş olamaz.".to_string());
    }

    let password_hash = hash_password(&pwd).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    tx.execute(
        "INSERT INTO users (id, username, password_hash, display_name, role, created_at, must_change_password) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
        params![&admin_id, "admin", &password_hash, "Sistem Yöneticisi", "admin", &now],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok("Sistem başarıyla sıfırlandı.".to_string())
}

// ==================== USER AUTHENTICATION COMMANDS ====================

// Rate limiting sabitleri
#[allow(dead_code)]
const MAX_LOGIN_ATTEMPTS: i32 = 5;
#[allow(dead_code)]
const LOCKOUT_DURATION_MINUTES: i64 = 15;

#[tauri::command]
pub fn login(state: State<AppState>, username: String, password: String) -> Result<User, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    // Kullanıcıyı ara (rate limiting alanları dahil)
    let user_result: Result<(String, String, String, String, String, String, Option<String>, i32, Option<String>, bool), _> = conn.query_row(
        "SELECT id, username, password_hash, display_name, role, created_at, last_login, failed_login_attempts, locked_until, must_change_password FROM users WHERE username = ?1",
        params![&username],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get::<_, i32>(7).unwrap_or(0),
                row.get(8)?,
                row.get::<_, bool>(9).unwrap_or(false),
            ))
        },
    );

    match user_result {
        Ok((id, uname, password_hash, display_name, role, created_at, _, _failed_attempts, _locked_until, must_change_pwd)) => {
            let now = chrono::Utc::now();
            
            // Hesap kilitleme kaldirildi (sonsuz deneme hakki)

            // Şifreyi doğrula
            // Admin için şifre ZORUNLU, diğer kullanıcılar şifresiz girebilir
            let is_valid = if role == "admin" {
                // Admin için şifre zorunlu - boş şifre kabul edilmez
                if password.is_empty() {
                    return Err("Yönetici hesabı için şifre zorunludur".to_string());
                }
                verify_password(&password, &password_hash).unwrap_or(false)
            } else {
                // Diğer kullanıcılar şifresiz girebilir
                if password.is_empty() {
                    true
                } else {
                    verify_password(&password, &password_hash).unwrap_or(false)
                }
            };

            if !is_valid {
                // Return generic error without locking
                return Err("Hatali sifre".to_string());
            }

            // Basarili giris - sayaçları sıfırla
            conn.execute(
                "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = ?1 WHERE id = ?2",
                params![now.to_rfc3339(), &id],
            ).map_err(|e| e.to_string())?;

            Ok(User {
                id,
                username: uname,
                display_name,
                role,
                created_at,
                last_login: Some(now.to_rfc3339()),
                must_change_password: must_change_pwd,
            })
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Err("Kullanıcı bulunamadı".to_string()),
        Err(e) => Err(format!("Veritabanı hatası: {}", e)),
    }
}

#[tauri::command]
pub fn get_users_for_login(state: State<AppState>) -> Result<Vec<crate::models::UserLoginDisplay>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, username, display_name, role FROM users ORDER BY display_name"
    ).map_err(|e| e.to_string())?;

    let users = stmt.query_map([], |row| {
        Ok(crate::models::UserLoginDisplay {
            id: row.get(0)?,
            username: row.get(1)?,
            display_name: row.get(2)?,
            role: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    users.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_all_users(state: State<AppState>) -> Result<Vec<User>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, username, display_name, role, created_at, last_login FROM users ORDER BY created_at"
    ).map_err(|e| e.to_string())?;

    let users = stmt.query_map([], |row| {
        Ok(User {
            id: row.get(0)?,
            username: row.get(1)?,
            display_name: row.get(2)?,
            role: row.get(3)?,
            created_at: row.get(4)?,
            last_login: row.get(5)?,
            must_change_password: false,
        })
    }).map_err(|e| e.to_string())?;

    users.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_users_exist(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    Ok(count > 0)
}

#[tauri::command]
pub fn create_user(state: State<AppState>, request: CreateUserRequest) -> Result<User, String> {
    // Input validation
    validate_username(&request.username)?;
    validate_password_strength(&request.password)?;

    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    // Check if username exists
    let exists: i32 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE username = ?1",
        params![&request.username],
        |row| row.get(0),
    ).unwrap_or(0);

    if exists > 0 {
        return Err("Bu kullanıcı adı zaten kullanılıyor".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let password_hash = hash_password(&request.password).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO users (id, username, password_hash, display_name, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&id, &request.username, &password_hash, &request.display_name, &request.role, &now],
    ).map_err(|e| e.to_string())?;

    Ok(User {
        id,
        username: request.username,
        display_name: request.display_name,
        role: request.role,
        created_at: now,
        last_login: None,
        must_change_password: false,
    })
}

#[tauri::command]
pub fn update_user(state: State<AppState>, id: String, updates: UpdateUserRequest) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    if let Some(ref username) = updates.username {
        let existing: i32 = conn.query_row(
            "SELECT COUNT(*) FROM users WHERE username = ?1 AND id != ?2",
            params![username, &id],
            |row| row.get(0),
        ).unwrap_or(0);

        if existing > 0 {
            return Err("Bu kullanıcı adı zaten kullanılıyor".to_string());
        }

        conn.execute(
            "UPDATE users SET username = ?1 WHERE id = ?2",
            params![username, &id],
        ).map_err(|e| e.to_string())?;
    }

    if let Some(display_name) = updates.display_name {
        conn.execute(
            "UPDATE users SET display_name = ?1 WHERE id = ?2",
            params![&display_name, &id],
        ).map_err(|e| e.to_string())?;
    }

    if let Some(role) = updates.role {
        conn.execute(
            "UPDATE users SET role = ?1 WHERE id = ?2",
            params![&role, &id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_user(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let admin_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'admin'",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let is_admin: i32 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE id = ?1 AND role = 'admin'",
        params![&id],
        |row| row.get(0),
    ).unwrap_or(0);

    if is_admin > 0 && admin_count <= 1 {
        return Err("Son admin kullanıcısı silinemez".to_string());
    }

    conn.execute("DELETE FROM users WHERE id = ?1", params![&id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn change_password(state: State<AppState>, id: String, new_password: String) -> Result<(), String> {
    // Password strength validation
    validate_password_strength(&new_password)?;

    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let password_hash = hash_password(&new_password).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE users SET password_hash = ?1 WHERE id = ?2",
        params![&password_hash, &id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

// ==================== PAGINATION COMMANDS ====================

#[tauri::command]
pub fn get_items_paginated(
    state: State<AppState>,
    page: i32,
    per_page: i32,
    search: Option<String>,
    category: Option<String>,
) -> Result<PaginatedItemsResponse, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let page = if page < 1 { 1 } else { page };
    let per_page = if per_page < 1 { 20 } else { per_page.min(100) };
    let offset = (page - 1) * per_page;

    // Build WHERE clause
    let mut conditions = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref s) = search {
        if !s.is_empty() {
            conditions.push("(name LIKE ? OR sku LIKE ? OR description LIKE ?)");
            let search_pattern = format!("%{}%", s);
            params_vec.push(Box::new(search_pattern.clone()));
            params_vec.push(Box::new(search_pattern.clone()));
            params_vec.push(Box::new(search_pattern));
        }
    }

    if let Some(ref c) = category {
        if !c.is_empty() && c != "Tümü" && c != "HEPSİ" {
            conditions.push("category = ?");
            params_vec.push(Box::new(c.clone()));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM inventory_items {}", where_clause);
    let total: i32 = {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| e.to_string())?;
        // Use params_from_iter for cleaner code if possible, or manual slice
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        stmt.query_row(params_refs.as_slice(), |row| row.get(0)).unwrap_or(0)
    };

    // Get paginated items
    let select_sql = format!(
        "SELECT id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency, supplier_id, brand
         FROM inventory_items {} ORDER BY name LIMIT ? OFFSET ?",
        where_clause
    );

    let mut params_with_pagination = params_vec;
    params_with_pagination.push(Box::new(per_page));
    params_with_pagination.push(Box::new(offset));

    let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_with_pagination.iter().map(|p| p.as_ref()).collect();

    let items = stmt.query_map(params_refs.as_slice(), |row| {
        let ai_tags_str: Option<String> = row.get(10)?;
        let ai_tags: Option<Vec<String>> = ai_tags_str.and_then(|s| serde_json::from_str(&s).ok());

        Ok(InventoryItem {
            id: row.get(0)?,
            sku: row.get(1)?,
            name: row.get(2)?,
            category: row.get(3)?,
            quantity: row.get(4)?,
            location: row.get(5)?,
            price: row.get(6)?,
            cost_price: row.get(7)?,
            image: row.get(8)?,
            description: row.get(9)?,
            ai_tags,
            last_updated: row.get(11)?,
            currency: row.get(12)?,
            supplier_id: row.get(13)?,
            brand: row.get(14).unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;

    let data: Vec<InventoryItem> = items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    let total_pages = ((total as f64) / (per_page as f64)).ceil() as i32;

    Ok(PaginatedItemsResponse {
        data,
        total,
        page,
        per_page,
        total_pages,
    })
}

#[tauri::command]
pub fn get_transactions_with_pagination(
    state: State<AppState>,
    page: i32,
    per_page: i32,
    start_date: Option<String>,
    end_date: Option<String>,
    transaction_type: Option<String>,
    customer_id: Option<String>,
) -> Result<PaginatedTransactionsResponse, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    // Debug print
    println!("Fetching transactions: page={}, type={:?}, customer={:?}", page, transaction_type, customer_id);

    let page = if page < 1 { 1 } else { page };
    let per_page = if per_page < 1 { 20 } else { per_page.min(100) };
    let offset = (page - 1) * per_page;

    // Build WHERE clause
    let mut conditions = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref sd) = start_date {
        if !sd.is_empty() {
            conditions.push("substr(created_at, 1, 10) >= ?");
            params_vec.push(Box::new(sd.clone()));
        }
    }

    if let Some(ref ed) = end_date {
        if !ed.is_empty() {
            conditions.push("substr(created_at, 1, 10) <= ?");
            params_vec.push(Box::new(ed.clone()));
        }
    }

    if let Some(ref tt) = transaction_type {
        if !tt.is_empty() && tt != "ALL" {
            conditions.push("transaction_type = ?");
            params_vec.push(Box::new(tt.clone()));
        }
    }

    if let Some(ref cid) = customer_id {
        if !cid.is_empty() {
             conditions.push("customer_id = ?");
             params_vec.push(Box::new(cid.clone()));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Get total count
    let count_sql = format!("SELECT COUNT(*) FROM transactions {}", where_clause);
    let total: i32 = {
        let mut stmt = conn.prepare(&count_sql).map_err(|e| e.to_string())?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        stmt.query_row(params_refs.as_slice(), |row| row.get(0)).unwrap_or(0)
    };

    // Get paginated transactions
    let select_sql = format!(
        "SELECT id, items, total, payment_method, transaction_type, note, created_at, customer_id
         FROM transactions {} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        where_clause
    );

    let mut params_with_pagination = params_vec;
    params_with_pagination.push(Box::new(per_page));
    params_with_pagination.push(Box::new(offset));

    let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_with_pagination.iter().map(|p| p.as_ref()).collect();

    let transactions = stmt.query_map(params_refs.as_slice(), |row| {
        let items_json: String = row.get(1)?;
        let items: Vec<CartItem> = serde_json::from_str(&items_json).unwrap_or_default();

        Ok(Transaction {
            id: row.get(0)?,
            items,
            total: row.get(2)?,
            payment_method: row.get(3)?,
            transaction_type: row.get(4)?,
            status: "completed".to_string(),
            note: row.get(5)?,
            created_at: row.get(6)?,
            customer_id: row.get(7).unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?;

    let data: Vec<Transaction> = transactions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;
    let total_pages = ((total as f64) / (per_page as f64)).ceil() as i32;

    Ok(PaginatedTransactionsResponse {
        data,
        total,
        page,
        per_page,
        total_pages,
    })
}

// ==================== LICENSE COMMANDS ====================

#[tauri::command]
pub fn get_mac_address() -> Result<String, String> {
    license::get_device_mac_address().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_license_status(state: State<AppState>) -> Result<Option<License>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    license::get_local_license(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn validate_license(
    state: State<AppState>,
    api_base_url: String,
    license_key: String,
) -> Result<LicenseValidateResponse, String> {
    let mac = license::get_device_mac_address().map_err(|e| e.to_string())?;
    let response = license::validate_license_api(&api_base_url, &license_key, &mac)
        .map_err(|e| e.to_string())?;

    // If valid, update last_validated timestamp
    if response.valid {
        let conn = state.db.get_conn().map_err(|e| e.to_string())?;
        let _ = license::update_last_validated(&conn);
    }

    Ok(response)
}

#[tauri::command]
pub fn activate_license(
    state: State<AppState>,
    api_base_url: String,
    license_key: String,
) -> Result<LicenseActivateResponse, String> {
    let mac = license::get_device_mac_address().map_err(|e| e.to_string())?;
    let mut final_response = license::activate_license_api(&api_base_url, &license_key, &mac)
        .map_err(|e| e.to_string())?;

    if final_response.success {
        // Save license to local database
        let conn = state.db.get_conn().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();

        let license_data = License {
            license_key: license_key.clone(),
            dealer_id: final_response.dealer_id.clone().unwrap_or_default(),
            dealer_name: final_response.dealer_name.clone().unwrap_or_default(),
            mac_address: mac,
            activated_at: final_response.activated_at.clone().unwrap_or(now.clone()),
            expires_at: final_response.expires_at.clone(),
            is_active: true,
            last_validated: Some(now.clone()),
            api_base_url,
        };

        license::save_license(&conn, &license_data).map_err(|e| e.to_string())?;

        // Create default admin user for this dealer if no users exist
        let user_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM users",
            [],
            |row| row.get(0),
        ).unwrap_or(0);

        if user_count == 0 {
            let admin_id = uuid::Uuid::new_v4().to_string();
            // Generate random password (first 8 chars of a UUID)
            let random_pwd = uuid::Uuid::new_v4().to_string().chars().take(8).collect::<String>();
            let password_hash = hash_password(&random_pwd).map_err(|e| e.to_string())?;
            let dealer_name = final_response.dealer_name.clone().unwrap_or("Admin".to_string());
            let dealer_id = final_response.dealer_id.clone().unwrap_or_default();

            conn.execute(
                "INSERT INTO users (id, username, password_hash, display_name, role, created_at, dealer_id, must_change_password) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
                params![&admin_id, "admin", &password_hash, &dealer_name, "admin", &now, &dealer_id],
            ).map_err(|e| e.to_string())?;
            
            final_response.message = Some(format!(
                "Lisans başarıyla aktifleştirildi. Geçici Yönetici Şifreniz: {} (Lütfen hemen değiştirin)", 
                random_pwd
            ));
        }
    }

    Ok(final_response)
}

#[tauri::command]
pub fn check_license_validity(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    match license::get_local_license(&conn).map_err(|e| e.to_string())? {
        Some(lic) => {
            // Check if expired
            if license::is_license_expired(&lic) {
                return Ok(false);
            }

            // Check if needs revalidation (every 7 days)
            if license::needs_revalidation(&lic) {
                // Try to revalidate with API
                match license::validate_license_api(&lic.api_base_url, &lic.license_key, &lic.mac_address) {
                    Ok(response) => {
                        if response.valid {
                            let _ = license::update_last_validated(&conn);
                            Ok(true)
                        } else {
                            Ok(false)
                        }
                    }
                    Err(_) => {
                        // API unreachable - allow offline usage if not expired
                        Ok(lic.is_active && !license::is_license_expired(&lic))
                    }
                }
            } else {
                Ok(lic.is_active)
            }
        }
        None => Ok(false), // No license found
    }
}

#[tauri::command]
pub fn deactivate_license(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    license::delete_license(&conn).map_err(|e| e.to_string())
}

// ==================== CLOUD SYNC COMMANDS ====================

#[tauri::command]
pub fn cloud_backup(state: State<AppState>) -> Result<CloudBackupResponse, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    // Get license info for API auth
    let license_data = license::get_local_license(&conn)
        .map_err(|e| e.to_string())?
        .ok_or("Lisans bulunamadi. Lutfen once lisans aktivasyonu yapin.")?;

    let db_path = state.db.get_db_path_string();

    // Perform backup (with WAL checkpoint)
    let response = cloud::backup_to_cloud(
        &conn,
        &license_data.api_base_url,
        &license_data.dealer_id,
        &license_data.license_key,
        &db_path,
    ).map_err(|e| e.to_string())?;

    if response.success {
        // Update local sync status
        cloud::update_last_backup(&conn).map_err(|e| e.to_string())?;
    }

    Ok(response)
}

#[tauri::command]
pub fn cloud_restore(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    // Get license info for API auth
    let license_data = license::get_local_license(&conn)
        .map_err(|e| e.to_string())?
        .ok_or("Lisans bulunamadi")?;

    let db_path = state.db.get_db_path_string();

    // Perform restore using SQLite backup API (no restart needed)
    cloud::restore_from_cloud_with_conn(
        &db_path,
        &license_data.api_base_url,
        &license_data.dealer_id,
        &license_data.license_key,
    ).map_err(|e| e.to_string())?;

    // Update last restore timestamp
    cloud::update_last_restore(&conn).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_sync_status(state: State<AppState>) -> Result<SyncStatus, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    cloud::get_local_sync_status(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cloud_status(state: State<AppState>) -> Result<CloudStatusResponse, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let license_data = license::get_local_license(&conn)
        .map_err(|e| e.to_string())?
        .ok_or("Lisans bulunamadi")?;

    cloud::get_cloud_status(
        &license_data.api_base_url,
        &license_data.dealer_id,
        &license_data.license_key,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_auto_sync(
    state: State<AppState>,
    enabled: bool,
    interval_minutes: i32,
) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let interval = if interval_minutes < 5 { 5 } else { interval_minutes.min(1440) }; // 5 min to 24 hours

    cloud::set_auto_sync_settings(&conn, enabled, interval).map_err(|e| e.to_string())
}

// ==================== LOCAL BACKUP COMMANDS ====================

#[tauri::command]
pub fn create_local_backup(state: State<AppState>) -> Result<BackupInfo, String> {
    let db_path = state.db.get_db_path_string();
    let backup_path = backup::create_backup(&db_path)?;
    
    let metadata = std::fs::metadata(&backup_path)
        .map_err(|e| format!("Yedek bilgisi okunamadı: {}", e))?;
    
    Ok(BackupInfo {
        filename: backup_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        path: backup_path.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn list_local_backups() -> Result<Vec<BackupInfo>, String> {
    backup::list_backups()
}

#[tauri::command]
pub fn restore_local_backup(state: State<AppState>, backup_path: String) -> Result<(), String> {
    let db_path = state.db.get_db_path_string();
    backup::restore_backup(&backup_path, &db_path)
}

#[tauri::command]
pub fn delete_local_backup(backup_path: String) -> Result<(), String> {
    backup::delete_backup(&backup_path)
}

#[tauri::command]
pub fn start_auto_backup(state: State<AppState>, interval_hours: u64) -> Result<(), String> {
    let db_path = state.db.get_db_path_string();
    let interval = if interval_hours < 1 { 1 } else { interval_hours.min(24) };
    backup::start_backup_scheduler(db_path, interval);
    Ok(())
}

#[tauri::command]
pub fn stop_auto_backup() -> Result<(), String> {
    backup::stop_backup_scheduler();
    Ok(())
}

// ==================== STARTUP COMMANDS ====================

#[tauri::command]
pub fn set_windows_startup(enabled: bool) -> Result<(), String> {
    startup::set_startup_enabled(enabled)
}

#[tauri::command]
pub fn get_windows_startup_status() -> bool {
    startup::is_startup_enabled()
}

// ==================== PRINT COMMANDS ====================

#[tauri::command]
pub fn generate_receipt(transaction: Transaction, currency: String, store_name: String) -> String {
    print_service::generate_receipt_text(&transaction, &currency, &store_name)
}

#[tauri::command]
pub fn generate_invoice(transaction: Transaction, currency: String, store_name: String) -> String {
    print_service::generate_invoice_html(&transaction, &currency, &store_name)
}

// ==================== UPDATER COMMANDS ====================

#[tauri::command]
pub fn get_app_version() -> String {
    updater_service::get_current_version()
}

// ==================== SCANNER COMMANDS ====================

#[tauri::command]
pub fn parse_barcode(barcode: String) -> scanner::BarcodeInfo {
    scanner::parse_barcode(&barcode)
}

#[tauri::command]
pub fn validate_barcode(barcode: String) -> bool {
    let config = scanner::ScannerConfig::default();
    scanner::is_valid_barcode(&barcode, &config)
}

#[tauri::command]
pub fn start_scanner() {
    scanner::start_scanner_listener();
}

#[tauri::command]
pub fn stop_scanner() {
    scanner::stop_scanner_listener();
}

#[tauri::command]
pub fn get_scanner_status() -> bool {
    scanner::is_scanner_active()
}


// ==================== FINANCE COMMANDS ====================

#[tauri::command]
pub fn add_finance_record(state: State<AppState>, record: FinanceRecord) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO finance_records (record_type, category, amount, payment_method, description, date, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &record.record_type,
            &record.category,
            &record.amount,
            &record.payment_method,
            &record.description,
            &record.date,
            &record.created_at
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_finance_records(state: State<AppState>, start_date: String, end_date: String) -> Result<Vec<FinanceRecord>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, record_type, category, amount, payment_method, description, date, created_at FROM finance_records WHERE date BETWEEN ?1 AND ?2 ORDER BY date DESC, id DESC"
    ).map_err(|e| e.to_string())?;

    let records = stmt.query_map(params![&start_date, &end_date], |row| {
        Ok(FinanceRecord {
            id: row.get(0)?,
            record_type: row.get(1)?,
            category: row.get(2)?,
            amount: row.get(3)?,
            payment_method: row.get(4)?,
            description: row.get(5)?,
            date: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    records.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_finance_record(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM finance_records WHERE id = ?1",
        params![&id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_finance_summary(state: State<AppState>, date: String) -> Result<FinanceSummary, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    // --- DAILY TOTALS (Specific Date) ---
    // SQL does the heavy lifting
    let (d_man_inc, d_man_exp): (f64, f64) = conn.query_row(
        "SELECT 
            COALESCE(SUM(CASE WHEN record_type = 'INCOME' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN record_type = 'EXPENSE' THEN amount ELSE 0 END), 0)
         FROM finance_records WHERE date = ?1",
        params![&date],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap_or((0.0, 0.0));

    // Daily Transactions Aggregation
    // We sum absolute values based on logic
    let (d_tx_inc, d_tx_exp): (f64, f64) = conn.query_row(
        "SELECT 
            COALESCE(SUM(CASE WHEN transaction_type IN ('SALE', 'COLLECTION') THEN ABS(total) ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN transaction_type IN ('RETURN', 'EXPENSE') THEN ABS(total) ELSE 0 END), 0)
         FROM transactions WHERE substr(created_at, 1, 10) = ?1",
        params![&date],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).unwrap_or((0.0, 0.0));

    let total_income = d_man_inc + d_tx_inc;
    let total_expense = d_man_exp + d_tx_exp;
    let daily_net = total_income - total_expense; 
    
    // --- ALL TIME BALANCES (Asset Status) ---
    
    // 1. Manual Records Balance
    // Income is positive, Expense is negative
    let (man_cash, man_card, man_bank): (f64, f64, f64) = conn.query_row(
        "SELECT 
            COALESCE(SUM(CASE 
                WHEN payment_method IN ('NAKIT', 'CASH') THEN (CASE WHEN record_type='INCOME' THEN amount ELSE -amount END)
                ELSE 0 END), 0),
            COALESCE(SUM(CASE 
                WHEN payment_method IN ('KREDI_KARTI', 'CREDIT_CARD', 'MAIL_ORDER') THEN (CASE WHEN record_type='INCOME' THEN amount ELSE -amount END)
                ELSE 0 END), 0),
            COALESCE(SUM(CASE 
                WHEN payment_method IN ('HAVALE', 'EFT', 'BANKA_KARTI') THEN (CASE WHEN record_type='INCOME' THEN amount ELSE -amount END)
                ELSE 0 END), 0)
         FROM finance_records",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    ).unwrap_or((0.0, 0.0, 0.0));

    // 2. Transactions Balance
    // SALE/COLLECTION adds to balance (as cash/asset)
    // RETURN/EXPENSE/PURCHASE reduces it (cash out)
    let (tx_cash, tx_card, tx_bank): (f64, f64, f64) = conn.query_row(
        "SELECT
            COALESCE(SUM(CASE
                WHEN payment_method IN ('NAKIT', 'CASH', 'Nakit') THEN
                    (CASE WHEN transaction_type IN ('SALE', 'COLLECTION') THEN ABS(total)
                          WHEN transaction_type IN ('RETURN', 'EXPENSE', 'PURCHASE') THEN -ABS(total)
                          ELSE 0 END)
                ELSE 0 END), 0),
            COALESCE(SUM(CASE
                WHEN payment_method IN ('KREDI_KARTI', 'Kredi Kartı', 'CREDIT_CARD', 'MAIL_ORDER', 'MAIL ORDER') THEN
                    (CASE WHEN transaction_type IN ('SALE', 'COLLECTION') THEN ABS(total)
                          WHEN transaction_type IN ('RETURN', 'EXPENSE', 'PURCHASE') THEN -ABS(total)
                          ELSE 0 END)
                ELSE 0 END), 0),
            COALESCE(SUM(CASE
                WHEN payment_method IN ('HAVALE', 'EFT', 'Havale', 'BANKA_KARTI', 'Banka Kartı') THEN
                    (CASE WHEN transaction_type IN ('SALE', 'COLLECTION') THEN ABS(total)
                          WHEN transaction_type IN ('RETURN', 'EXPENSE', 'PURCHASE') THEN -ABS(total)
                          ELSE 0 END)
                ELSE 0 END), 0)
         FROM transactions",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    ).unwrap_or((0.0, 0.0, 0.0));

    Ok(FinanceSummary {
        total_income,
        total_expense,
        net_balance: daily_net,
        cash_balance: man_cash + tx_cash,
        card_balance: man_card + tx_card,
        bank_balance: man_bank + tx_bank,
    })
}

// ==================== ACCESS CODE COMMANDS ====================

#[tauri::command]
pub fn create_access_code(state: State<AppState>, code: String, name: String, role: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO access_codes (code, name, role, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![&code, &name, &role, &now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_access_codes(state: State<AppState>) -> Result<Vec<AccessCode>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, code, name, role, created_at FROM access_codes ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    
    let codes = stmt.query_map([], |row| {
        Ok(AccessCode {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            role: row.get(3)?,
            created_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    codes.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_access_code(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM access_codes WHERE id = ?1", params![&id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn login_with_code(state: State<AppState>, code: String) -> Result<Option<User>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let access_code: Option<AccessCode> = conn.query_row(
        "SELECT id, code, name, role, created_at FROM access_codes WHERE code = ?1",
        params![&code],
        |row| Ok(AccessCode {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            role: row.get(3)?,
            created_at: row.get(4)?,
        })
    ).optional().map_err(|e| e.to_string())?;

    match access_code {
        Some(ac) => {
            Ok(Some(User {
                id: format!("code_{}", ac.id),
                username: ac.name.clone(),
                display_name: ac.name,
                role: ac.role,
                created_at: ac.created_at,
                last_login: Some(chrono::Utc::now().to_rfc3339()),
                must_change_password: false,
            }))
        },
        None => Ok(None)
    }
}

// ==================== GOODS RECEIPT COMMANDS ====================

#[tauri::command]
pub fn process_goods_receipt(state: State<AppState>, items: Vec<GoodsReceiptItem>, total_amount: f64, payment_method: String, description: String, date: String, supplier_id: Option<String>, invoice_no: Option<String>) -> Result<(), String> {
    let mut conn = state.db.get_conn().map_err(|e| e.to_string())?;
    // Enable foreign key support just in case, though mostly handled by logic
    conn.execute("PRAGMA foreign_keys = ON", []).map_err(|e| e.to_string())?;
    
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let created_at = chrono::Utc::now().to_rfc3339();

    // 1. Add Finance Record
    // ONLY if NOT VADELI (Credit). If VADELI, no cash moves out yet.
    if payment_method != "VADELI" {
        tx.execute(
            "INSERT INTO finance_records (record_type, category, amount, payment_method, description, date, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params!["EXPENSE", "MAL_KABUL", total_amount, &payment_method, &description, &date, &created_at],
        ).map_err(|e| e.to_string())?;
    }

    // 2. Update Inventory and Create Lots
    for item in &items {
        // First, get the stock card barcode for SKU matching
        let stock_card_barcode: Option<String> = tx.query_row(
            "SELECT barcode FROM stock_cards WHERE id = ?1",
            params![item.product_id],
            |row| row.get(0),
        ).optional().unwrap_or(None);

        // Try to UPDATE by ID first, then by SKU if that fails
        let updated = if supplier_id.is_some() {
            let by_id = tx.execute(
                "UPDATE inventory_items SET quantity = quantity + ?1, cost_price = ?2, supplier_id = ?3, last_updated = ?4 WHERE id = ?5",
                params![item.quantity, item.buy_price, &supplier_id, created_at, item.product_id],
            ).map_err(|e| e.to_string())?;
            
            // If not found by ID, try by SKU (barcode)
            if by_id == 0 {
                if let Some(ref barcode) = stock_card_barcode {
                    tx.execute(
                        "UPDATE inventory_items SET quantity = quantity + ?1, cost_price = ?2, supplier_id = ?3, last_updated = ?4 WHERE sku = ?5",
                        params![item.quantity, item.buy_price, &supplier_id, created_at, barcode],
                    ).map_err(|e| e.to_string())?
                } else { 0 }
            } else { by_id }
        } else {
            let by_id = tx.execute(
                "UPDATE inventory_items SET quantity = quantity + ?1, cost_price = ?2, last_updated = ?3 WHERE id = ?4",
                params![item.quantity, item.buy_price, created_at, item.product_id],
            ).map_err(|e| e.to_string())?;
            
            if by_id == 0 {
                if let Some(ref barcode) = stock_card_barcode {
                    tx.execute(
                        "UPDATE inventory_items SET quantity = quantity + ?1, cost_price = ?2, last_updated = ?3 WHERE sku = ?4",
                        params![item.quantity, item.buy_price, created_at, barcode],
                    ).map_err(|e| e.to_string())?
                } else { 0 }
            } else { by_id }
        };

        // If item doesn't exist in inventory, INSERT it from Stock Card data
        if updated == 0 {
            // Fetch Stock Card details
            let stock_card: Option<(String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)> = tx.query_row(
                "SELECT barcode, name, brand, unit, category_id, description, image FROM stock_cards WHERE id = ?1",
                params![item.product_id],
                |row| Ok((
                    row.get(0)?, // barcode
                    row.get(1)?, // name
                    row.get(2)?, // brand
                    row.get(3)?, // unit
                    row.get(4)?, // category_id
                    row.get(5)?, // description
                    row.get(6)?, // image
                ))
            ).optional().map_err(|e| e.to_string())?;

            if let Some((barcode, name, _brand, _unit, category_id, card_desc, image)) = stock_card {
                // Fetch Category Name if category_id exists
                let mut category_name = "Genel".to_string();
                if let Some(cat_id) = category_id {
                    // Try fetch category name
                    let cat_n: Option<String> = tx.query_row(
                        "SELECT name FROM categories WHERE id = ?1",
                        params![cat_id],
                        |row| row.get(0)
                    ).optional().unwrap_or(None);
                    if let Some(n) = cat_n { category_name = n; }
                }

                // Use sell_price from item, or calculate 30% margin
                let initial_price = item.sell_price.unwrap_or(item.buy_price * 1.3);

                tx.execute(
                    "INSERT INTO inventory_items (id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency, supplier_id) 
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'TL', ?13)",
                    params![
                        item.product_id, // id (same as stock card id)
                        barcode,         // sku (using barcode)
                        name,            // name
                        category_name,   // category
                        item.quantity,   // quantity
                        "Depo",          // location (default)
                        initial_price,   // price
                        item.buy_price,  // cost_price
                        image,           // image
                        card_desc,       // description
                        Option::<String>::None, // ai_tags
                        created_at,      // last_updated
                        supplier_id      // supplier_id
                    ],
                ).map_err(|e| e.to_string())?;
            }
        }

        // 3. Create Inventory Lot
        let lot_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO inventory_lots (id, product_id, supplier_id, quantity, initial_quantity, buy_price, sell_price, receipt_date, invoice_no, created_at)
             VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                lot_id,
                item.product_id,
                &supplier_id,
                item.quantity,
                item.buy_price,
                item.sell_price,
                &date,
                &invoice_no,
                created_at
            ],
        ).map_err(|e| e.to_string())?;

        // 4. Log Activity
        tx.execute(
            "INSERT INTO activity_log (action_type, description, item_id, quantity_change, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params!["STOCK_IN", format!("Mal Kabul: {} adet - {}", item.quantity, description), item.product_id, item.quantity, created_at],
        ).map_err(|e| e.to_string())?;
    }

    // 5. Update Current Account Balance if VADELI OR ANY method with supplier
    // Logic update: We want to record the transaction for the supplier statement regardless of payment method.
    // However, balance update logic:
    // - VADELI: Balance INCREASES (Debt) -> Checked below
    // - CASH: Balance UNCHANGED (Paid immediately) -> But we still need a transaction record for history!
    
    if let Some(ref sup_id) = supplier_id {
        // Create Transaction Record for 'Cari Ekstre'
        // Type: 'PURCHASE'
        let tx_id = uuid::Uuid::new_v4().to_string();
        
        // Serialize items for transaction record
        let items_json = serde_json::to_string(&items).unwrap_or("[]".to_string());
        
        // For statement logic: 
        // PURCHASE type usually increases balance (Debt). 
        // If it's CASH, we might need a corresponding PAYMENT transaction or handle it in statement calculation.
        // Current logic in CustomerStatement.tsx: totalDebt = sum(total). 
        // So PURCHASE should be positive.
        // If it was paid by CASH, we technically have a PURCHASE (Debt +) and then immediately PAYMENT (Debt -).
        // To keep it simple for now, we'll just record PURCHASE.
        // If it was CASH purchase, the 'payment_method' field will say 'NAKIT'. The user knows it's paid.
        // But the calculated balance in statement might be misleading if we don't treat NAKIT purchase as net 0 change.
        // Let's rely on payment_method in statement calculation or just simply record it.
        
        tx.execute(
            "INSERT INTO transactions (id, items, total, payment_method, transaction_type, note, created_at, customer_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &tx_id,
                &items_json,
                total_amount,
                &payment_method,
                "PURCHASE", // New type for Mal Kabul
                format!("Mal Kabul Fatura: {}", invoice_no.clone().unwrap_or("-".to_string())),
                &created_at,
                sup_id
            ],
        ).map_err(|e| e.to_string())?;

        // Update Balance ONLY if VADELI
        if payment_method == "VADELI" {
             // Basic check if supplier exists
            let supplier_exists: i32 = tx.query_row(
                "SELECT COUNT(*) FROM current_accounts WHERE id = ?1",
                params![sup_id],
                |row| row.get(0)
            ).unwrap_or(0);

            if supplier_exists > 0 {
                tx.execute(
                    "UPDATE current_accounts SET balance = balance + ?1, updated_at = ?2 WHERE id = ?3",
                    params![total_amount, created_at, sup_id],
                ).map_err(|e| e.to_string())?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_product_lots(state: State<AppState>, product_id: String) -> Result<Vec<InventoryLot>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT l.id, l.product_id, l.supplier_id, ca.name, l.quantity, l.initial_quantity, l.buy_price, l.sell_price, l.receipt_date, l.invoice_no, l.created_at
         FROM inventory_lots l
         LEFT JOIN current_accounts ca ON l.supplier_id = ca.id
         WHERE l.product_id = ?1
         ORDER BY l.created_at ASC"
    ).map_err(|e| e.to_string())?;

    let lots = stmt.query_map(params![&product_id], |row| {
        Ok(InventoryLot {
            id: row.get(0)?,
            product_id: row.get(1)?,
            supplier_id: row.get(2)?,
            supplier_name: row.get(3)?,
            quantity: row.get(4)?,
            initial_quantity: row.get(5)?,
            buy_price: row.get(6)?,
            sell_price: row.get(7)?,
            receipt_date: row.get(8)?,
            invoice_no: row.get(9)?,
            created_at: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?;

    lots.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ==================== CURRENT ACCOUNT (CARİ) COMMANDS ====================

#[tauri::command]
pub fn create_current_account(state: State<AppState>, data: CreateCurrentAccountRequest) -> Result<CurrentAccount, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO current_accounts (id, name, account_type, tax_number, phone, email, address, note, payment_term, balance, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0.0, ?10, ?10)",
        params![
            &id,
            &data.name,
            &data.account_type,
            &data.tax_number,
            &data.phone,
            &data.email,
            &data.address,
            &data.note,
            &data.payment_term,
            &now
        ],
    ).map_err(|e| e.to_string())?;

    Ok(CurrentAccount {
        id,
        name: data.name,
        account_type: data.account_type,
        tax_number: data.tax_number,
        phone: data.phone,
        email: data.email,
        address: data.address,
        note: data.note,
        payment_term: data.payment_term,
        balance: 0.0,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn get_current_accounts(state: State<AppState>) -> Result<Vec<CurrentAccount>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, name, account_type, tax_number, phone, email, address, note, payment_term, balance, created_at, updated_at FROM current_accounts ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let accounts = stmt.query_map([], |row| {
        Ok(CurrentAccount {
            id: row.get(0)?,
            name: row.get(1)?,
            account_type: row.get(2)?,
            tax_number: row.get(3)?,
            phone: row.get(4)?,
            email: row.get(5)?,
            address: row.get(6)?,
            note: row.get(7)?,
            payment_term: row.get(8)?,
            balance: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?;

    accounts.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_current_account(state: State<AppState>, id: String, data: CreateCurrentAccountRequest) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE current_accounts SET name = ?1, account_type = ?2, tax_number = ?3, phone = ?4, email = ?5, address = ?6, note = ?7, payment_term = ?8, updated_at = ?9 WHERE id = ?10",
        params![
            &data.name,
            &data.account_type,
            &data.tax_number,
            &data.phone,
            &data.email,
            &data.address,
            &data.note,
            &data.payment_term,
            &now,
            &id
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_current_account(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    
    // Bakiye kontrolü - bakiye 0 değilse silme
    let balance: f64 = conn.query_row(
        "SELECT balance FROM current_accounts WHERE id = ?1",
        params![&id],
        |row| row.get(0),
    ).unwrap_or(0.0);
    
    if balance.abs() > 0.01 {
        return Err(format!("Bu cari hesabın bakiyesi var (₺{:.2}). Silmek için önce bakiyeyi sıfırlayın.", balance));
    }
    
    conn.execute("DELETE FROM current_accounts WHERE id = ?1", params![&id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ==================== STOCK CARD COMMANDS ====================

#[tauri::command]
pub fn create_stock_card(state: State<AppState>, data: CreateStockCardRequest) -> Result<StockCard, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    // Check for duplicate barcode
    let existing: Option<String> = conn.query_row(
        "SELECT id FROM stock_cards WHERE barcode = ?1",
        params![&data.barcode],
        |row| row.get(0)
    ).optional().map_err(|e| e.to_string())?;

    if existing.is_some() {
        return Err("Bu barkod numarası zaten kullanılıyor!".to_string());
    }

    conn.execute(
        "INSERT INTO stock_cards (id, barcode, name, brand, unit, category_id, description, image, supplier_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
        params![
            &data.id,
            &data.barcode,
            &data.name,
            &data.brand,
            &data.unit,
            &data.category_id,
            &data.description,
            &data.image,
            &data.supplier_id,
            &now
        ],
    ).map_err(|e| e.to_string())?;

    Ok(StockCard {
        id: data.id,
        barcode: data.barcode,
        name: data.name,
        brand: data.brand,
        unit: data.unit,
        category_id: data.category_id,
        description: data.description,
        image: data.image,
        supplier_id: data.supplier_id,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn delete_stock_card(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    inventory::delete_stock_card_safe(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stock_cards(state: State<AppState>) -> Result<Vec<StockCard>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, barcode, name, brand, unit, category_id, description, image, supplier_id, created_at, updated_at FROM stock_cards ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let cards = stmt.query_map([], |row| {
        Ok(StockCard {
            id: row.get(0)?,
            barcode: row.get(1)?,
            name: row.get(2)?,
            brand: row.get(3)?,
            unit: row.get(4)?,
            category_id: row.get(5)?,
            description: row.get(6)?,
            image: row.get(7)?,
            supplier_id: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?;

    cards.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_stock_card(state: State<AppState>, data: CreateStockCardRequest) -> Result<StockCard, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE stock_cards SET barcode = ?1, name = ?2, brand = ?3, unit = ?4, category_id = ?5, description = ?6, image = ?7, supplier_id = ?8, updated_at = ?9 WHERE id = ?10",
        params![
            &data.barcode,
            &data.name,
            &data.brand,
            &data.unit,
            &data.category_id,
            &data.description,
            &data.image,
            &data.supplier_id,
            &now,
            &data.id
        ],
    ).map_err(|e| e.to_string())?;

    // Fetch the updated card
    let mut stmt = conn.prepare(
        "SELECT id, barcode, name, brand, unit, category_id, description, image, supplier_id, created_at, updated_at FROM stock_cards WHERE id = ?1"
    ).map_err(|e| e.to_string())?;

    let card = stmt.query_row(params![&data.id], |row| {
        Ok(StockCard {
            id: row.get(0)?,
            barcode: row.get(1)?,
            name: row.get(2)?,
            brand: row.get(3)?,
            unit: row.get(4)?,
            category_id: row.get(5)?,
            description: row.get(6)?,
            image: row.get(7)?,
            supplier_id: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?;

    Ok(card)
}

// ==================== CATEGORY COMMANDS ====================

#[tauri::command]
pub fn create_category(state: State<AppState>, data: CreateCategoryRequest) -> Result<Category, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO categories (id, name, parent_id, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![
            &data.id,
            &data.name,
            &data.parent_id,
            &now
        ],
    ).map_err(|e| e.to_string())?;

    Ok(Category {
        id: data.id,
        name: data.name,
        parent_id: data.parent_id,
        created_at: now,
    })
}

#[tauri::command]
pub fn get_categories(state: State<AppState>) -> Result<Vec<Category>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, name, parent_id, created_at FROM categories ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let cats = stmt.query_map([], |row| {
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            parent_id: row.get(2)?,
            created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    cats.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_category(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM categories WHERE id = ?1", params![&id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn sync_inventory_categories(state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    
    // Get all unique categories from inventory items
    let mut stmt = conn.prepare("SELECT DISTINCT category FROM inventory_items WHERE category IS NOT NULL AND category != ''").map_err(|e| e.to_string())?;
    let existing_cats: Vec<String> = stmt.query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    
    let mut count = 0;
    for cat_name in existing_cats {
        let id_cleaned = cat_name.to_lowercase()
            .replace("ı", "i").replace("ş", "s").replace("ğ", "g")
            .replace("ü", "u").replace("ö", "o").replace("ç", "c")
            .replace(" ", "-");
        let id = format!("cat-{}", id_cleaned);
        
        // Use INSERT OR IGNORE to avoid duplicates
        let inserted = conn.execute(
            "INSERT OR IGNORE INTO categories (id, name, parent_id, created_at) VALUES (?1, ?2, NULL, ?3)",
            params![id, cat_name, &now],
        ).map_err(|e| e.to_string())?;
        
        if inserted > 0 {
            count += 1;
        }
    }
    
    Ok(count)
}

// ==================== SEED DATA COMMAND ====================

#[tauri::command]
pub fn seed_data(state: State<AppState>) -> Result<String, String> {
    let mut conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    // Önce mevcut verileri temizle
    tx.execute("DELETE FROM transactions", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM inventory_items", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM inventory_lots", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM stock_cards", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM categories", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM current_accounts", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM finance_records", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM activity_log", []).map_err(|e| e.to_string())?;

    let locations = vec!["Raf A-1", "Raf A-2", "Raf B-1", "Raf B-2", "Depo", "Vitrin"];

    // Hırdavat ve yapı malzemeleri ürünleri - (barkod, isim, kategori, fiyat, stok)
    let sample_items: Vec<(&str, &str, &str, f64, i32)> = vec![
        ("8680211380058", "DESTOYER LAVABO AÇICI 915 GR", "SIHHİ TESİSAT", 100.0, 13),
        ("8690496001142", "ASYEM FARE ZEHRİ 250 GR", "GENEL TEMİZLİK", 80.0, 13),
        ("00001036", "DERZ MALASI SARI 11X23", "FAYANS, SERAMİK", 280.0, 13),
        ("8699449343094", "SERFA OYNAR BAŞLI ZIMPARA", "Boya", 190.0, 14),
        ("8695013001926", "DEKOR DERZ MALASI 40 CM", "FAYANS, SERAMİK", 350.0, 13),
        ("8697433520391", "SOMAFİX HIZLI YAPIŞTIRICI SOĞUTUCULU 400 ML", "HIRDAVAT", 170.0, 15),
        ("8697433520339", "SOMAFİX HIZLI YAPIŞTIRICI SOĞUTUCULU 200 ML", "HIRDAVAT", 100.0, 15),
        ("8697433526652", "SOMAFİX HIZLI YAPIŞTIRICI SOĞUTUCULU 100 ML", "SIHHİ TESİSAT", 70.0, 23),
        ("8697455544221", "ASLAN LAVABO GİDER AÇICI SUSTA KILAVUZ 3 MT", "SIHHİ TESİSAT", 170.0, 13),
        ("8681999180250", "KUPA LAVABO AÇMA SUSTASI KILAVUZ 5 MT", "SIHHİ TESİSAT", 190.0, 13),
        ("8680211381277", "DESTROYER WC TEMİZLEYİCİ 750 ML", "SIHHİ TESİSAT", 70.0, 33),
        ("8697042006316", "PRATİX LAVABO GİDER AÇICI 1000 GR", "SIHHİ TESİSAT", 80.0, 44),
        ("8684396405001", "PLUS PROLINE WC LAVABO GİDER AÇICI 460 GR", "SIHHİ TESİSAT", 50.0, 33),
        ("00001035", "L GÖNYE 55X70X70", "HIRDAVAT", 35.0, 33),
        ("00001034", "L GÖNYE 65X90X90", "HIRDAVAT", 45.0, 33),
        ("00001033", "PERGULE AYAĞI KAMELYA", "HIRDAVAT", 100.0, 33),
        ("00001032", "DAYSON SİLİKON SİYAH", "HIRDAVAT", 250.0, 33),
        ("00001031", "DAYSON SİLİKON GRİ", "HIRDAVAT", 250.0, 33),
        ("00001030", "DAYSON SİLİKON BEYAZ", "HIRDAVAT", 250.0, 44),
        ("00001029", "DEKOR ŞERİT METRE 10 MT", "HIRDAVAT", 600.0, 14),
        ("00001028", "DMAX ŞERİT METRE 5 MT", "HIRDAVAT", 120.0, 33),
        ("00001027", "DMAX ŞERİT METRE 3 MT", "HIRDAVAT", 75.0, 22),
        ("00001026", "ARJ ŞERİT METRE 10 MT", "HIRDAVAT", 250.0, 4),
        ("00001025", "ARJ ŞERİT METRE 5 MT", "HIRDAVAT", 80.0, 33),
        ("8681190413409", "KİNETİKS TORNAVİDA DÜZ 6X35", "HIRDAVAT", 40.0, 33),
        ("8681190413331", "KİNETİKS TORNAVİDA DÜZ UÇLU 5X125", "HIRDAVAT", 40.0, 44),
        ("8681190413294", "KİNETİKS TORNAVİDA DÜZ 3X75", "HIRDAVAT", 40.0, 44),
        ("8680998237200", "CATA KAFA LAMBASI CT 9120", "ELEKTRİK", 150.0, 9),
        ("00001024", "PVC EMNİYET KİLİDİ ÇEKMELİ", "PIMAPEN", 60.0, 44),
        ("8694546525121", "PVC EMNİYET KİLİDİ UZUN KABLOLU", "PIMAPEN", 90.0, 33),
        ("8681184028206", "MASTER PAS ÇÖZÜCÜ YAĞLAYICI 400 ML", "HIRDAVAT", 130.0, 33),
        ("8681184028183", "MASTER PAS ÇÖZÜCÜ YAĞLAYICI 200 ML", "HIRDAVAT", 80.0, 33),
        ("8682315025019", "NOAS ŞARJLI AMPUL 7 W", "ELEKTRİK", 150.0, 33),
        ("00001023", "PVC PENCERE MENTEŞESİ", "PIMAPEN", 35.0, 33),
        ("00001022", "PVC KAPI MENTEŞESİ", "PIMAPEN", 40.0, 33),
        ("00001021", "PLASTİK EKO SİLİKON TABANCASI", "HIRDAVAT", 100.0, 33),
        ("8681999150048", "KUPA METAL GÖVDE SİLİKON TABANCASI", "HIRDAVAT", 250.0, 33),
        ("8681823083122", "FRS MARKA SOSİS TABANCASI", "HIRDAVAT", 350.0, 33),
        ("8697433520711", "SOMAFİX SOSİS SİLİKON 600 ML BEYAZ", "HIRDAVAT", 170.0, 44),
        ("00001020", "DİFİX TUTKAL 200 GR", "HIRDAVAT", 40.0, 44),
        ("8682754943899", "HASBANT FOLYOLU ALEMİNYUM BANT", "HIRDAVAT", 60.0, 33),
        ("00001019", "HASBANT KAĞIT BANT 25 MM 35 MT", "HIRDAVAT", 35.0, 33),
        ("00001018", "HASBANT KAĞIT BANT 50 MM 35 MT", "HIRDAVAT", 50.0, 44),
        ("00001017", "DAYSON KAĞIT BANT 25 MM 35 MT", "HIRDAVAT", 45.0, 44),
        ("00001016", "DAYSON KAĞIT BANT 50 MM 35 MT", "HIRDAVAT", 85.0, 44),
        ("00001015", "TAMİR BANTI", "HIRDAVAT", 60.0, 44),
        ("8663265315511", "KOLİ BANTI 48X100", "HIRDAVAT", 50.0, 44),
        ("8681689908874", "OCAK ÇAKMAĞI", "HIRDAVAT", 35.0, 33),
        ("8682118148472", "PAKET LASTİĞİ", "HIRDAVAT", 40.0, 33),
        ("8617340976517", "RAIN ASPRATÖR BORUSU 3 MT", "HIRDAVAT", 120.0, 44),
        ("00001014", "OXFORD TARTI PİLİ 2032", "HIRDAVAT", 40.0, 33),
        ("4897005160756", "WİLKİNSON PİL A 27", "HIRDAVAT", 60.0, 33),
        ("4891199042140", "GP PİL 23 A", "HIRDAVAT", 70.0, 33),
        ("6923861192117", "WATSONİX KALEM PİL AA", "HIRDAVAT", 40.0, 44),
        ("4008496556465", "VARTA KALEM PİL AA", "HIRDAVAT", 60.0, 44),
        ("8698753900832", "HATFİX SİLİKON ŞEFFAF 40 ML", "HIRDAVAT", 40.0, 55),
        ("8684712834003", "JAPON YAPIŞTIRICISI 502 20 GR", "HIRDAVAT", 50.0, 44),
        ("8682744571569", "JAPON YAPIŞTIRICISI 2005 20 GR", "HIRDAVAT", 50.0, 55),
        ("6260103510019", "İRAN YAPIŞTIRICISI", "HIRDAVAT", 50.0, 44),
        ("tangfix50ml", "TANGFİX PVC YAPIŞTIRICI 50 ML", "HIRDAVAT", 60.0, 44),
        ("8681184041526", "MASTER TABANCALI KÖPÜK 840 GR", "HIRDAVAT", 275.0, 44),
        ("8696071348961", "SELSİL MONTAJ KÖPÜĞÜ 600 GR", "HIRDAVAT", 150.0, 33),
        ("8696071030422", "SELSİL MASTİK GOLDEN OAK", "HIRDAVAT", 70.0, 33),
        ("8696071039302", "SELSİL MASTİK BRONZ", "HIRDAVAT", 70.0, 44),
        ("8696071419937", "SELSİL MASTİL GRİ", "HIRDAVAT", 70.0, 44),
        ("8680023050095", "SİBAX POLİÜRETAN MASTİK", "HIRDAVAT", 120.0, 44),
        ("8681999191157", "TAYSON SİLİKON MONTAJ YAPIŞTIRICI BEYAZ", "HIRDAVAT", 250.0, 44),
        ("8681002822467", "SOMAFİX MASTİK BEYAZ", "HIRDAVAT", 60.0, 44),
        ("8681002822184", "SOMAFİX SİLİKON EXPRESS BEYAZ", "HIRDAVAT", 100.0, 44),
        ("8681002822696", "SOMAFİX HAYTECK BEYAZ", "HIRDAVAT", 200.0, 44),
        ("8696071135189", "SELSİL SİLİKON MUTFAK VE BANYO ŞEFFAF", "HIRDAVAT", 160.0, 44),
        ("8696071135196", "SELSİL SİLİKON MUTFAK VE BANYO BEYAZ", "HIRDAVAT", 160.0, 44),
        ("8696071025282", "SELSİL SİLİKON BEYAZ", "HIRDAVAT", 70.0, 44),
        ("8696071918102", "SELSİL AKVARYUM SİLİKONU ŞEFFAF", "HIRDAVAT", 160.0, 44),
        ("8696071025275", "SELSİL SİLİKON ŞEFFAF", "HIRDAVAT", 70.0, 44),
        ("8696071414369", "SELSİL SİLİKON GRİ", "HIRDAVAT", 70.0, 33),
        ("8695013000813", "DEKOR HARÇ TEKNESİ", "HIRDAVAT", 560.0, 5),
        ("00001013", "SAPLI FARAŞ", "GENEL TEMİZLİK", 140.0, 23),
        ("00001012", "MANGAL 50 CM", "HIRDAVAT", 1100.0, 4),
        ("8681002823594", "SOMA FİX SIVI GRES 400 ML", "HIRDAVAT", 130.0, 9),
        ("00001011", "SPREY BOYA EKİN MAT SİYAH 200 ML", "Boya", 80.0, 12),
        ("00001010", "SPREY BOYA EKİN KIRMIZI 400 ML", "Boya", 120.0, 12),
        ("00001009", "SPREY BOYA EKİN BEYAZ 400 ML", "Boya", 120.0, 14),
        ("00001008", "SPREY BOYA EKİN YEŞİL 400 ML", "Boya", 120.0, 12),
        ("8697410474426", "ÇEK ÇEK CAM ORTA BOY PLASTİK", "HIRDAVAT", 30.0, 23),
        ("456486321557", "PAS SÖKÜCÜ SPREY AERON 200 ML", "HIRDAVAT", 60.0, 12),
        ("8682780801323", "SIVI GRES YAĞI 400 ML", "HIRDAVAT", 110.0, 12),
        ("1111138113810", "BOZLAK BOYA SÖKÜCÜ 400 ML", "Boya", 180.0, 11),
        ("8697446302601", "SPREY AKRİLİK VERNİK 400 ML", "Boya", 120.0, 11),
        ("8692641003001", "ÇAKMAK GAZI 270 ML", "HIRDAVAT", 50.0, 13),
        ("8680534200903", "ŞARO TUTUŞTURUCU 1 LT", "HIRDAVAT", 75.0, 11),
        ("8680763450414", "SPREY BOYA SWANSON SİYAH 400 ML", "Boya", 120.0, 11),
        ("8680763452159", "SPREY BOYA SWANSON MAVİ 400 ML", "Boya", 120.0, 12),
        ("8697393764279", "SPREY BOYA AKÇALI TURUNCU 400 ML", "Boya", 245.0, 6),
        ("8697393764170", "SPREY BOYA AKÇALI MAT BEYAZ 400 ML", "Boya", 245.0, 4),
        ("8697393764125", "SPREY BOYA AKÇALI KIRMIZI 400 ML", "Boya", 245.0, 2),
        ("8697393764187", "SPREY BOYA AKÇALI MAT SİYAH 400 ML", "Boya", 245.0, 11),
        ("8019615616638", "SPREY BOYA AKÇALI ANTRASİT 400 ML", "Boya", 245.0, 3),
        ("8697393764248", "SPREY BOYA AKÇALI PARLAK SİYAH 400 ML", "Boya", 245.0, 11),
        ("8697393764095", "SPREY BOYA AKÇALI GRİ 400 ML", "Boya", 245.0, 11),
        ("8697393764316", "SPREY BOYA AKÇALI AÇIK GRİ 400 ML", "Boya", 245.0, 3),
        ("8697393764149", "SPREY BOYA AKÇALI KROM SARI 400 ML", "Boya", 245.0, 3),
        ("8697393764064", "SPREY BOYA AKÇALI BONCUK MAVİ 400 ML", "Boya", 245.0, 8),
        ("8697393764026", "SPREY BOYA AKÇALI AÇIK MAVİ 400 ML", "Boya", 245.0, 11),
        ("8697393764200", "SPREY BOYA AKÇALI MOR 400 ML", "Boya", 245.0, 10),
        ("8693513674961", "DYO DİNAMİK SİLİKONLU DIŞ CEPHE RP 2 15 LT", "Boya", 2405.0, 11),
        ("8693513674954", "DYO DİNAMİK SİLİKONLU DIŞ CEPHE RP 1 15 LT", "Boya", 3400.0, 11),
        ("00001007", "MİKRON BRÜT BETON ASTARI 12 KG", "Boya", 1600.0, 11),
        ("8693513648221", "DYO DİNAMİK SOFT MAT SİLİKONLU A BAZI 7,5 LT", "Boya", 1000.0, 11),
        ("8693513674428", "DYO DİNAMİK SİLİKONLU MAT RP 2 7,5 LT", "Boya", 1000.0, 11),
        ("8693513674411", "DYO DİNAMİK MAT SİLİKONLU RP 1 7,5 LT", "Boya", 1000.0, 11),
        ("8693513674435", "DYO DİNAMİK SİLİKONLU MAT RP 3 7,5 LT", "Boya", 1000.0, 11),
        ("8693513886944", "CASATİ DÖNÜŞÜM ASTARI 10 KG", "Boya", 1860.0, 11),
        ("8692070070476", "MARSAHALL İZOLASYON ASTARI 1 KG", "Boya", 120.0, 9),
        ("8693513885633", "CASATİ SİLİKONLU DIŞ CEPHE BOYASI A BAZI 10 KG", "Boya", 1850.0, 11),
        ("8693513885664", "CASATİ SİLİKONLU DIŞ CEPHE BOYASI A BAZI 20 KG", "Boya", 2850.0, 11),
        ("8683735970224", "MİKRON BİNDER ASTAR 7,5 LT", "Boya", 650.0, 11),
        ("00001006", "MİKRON GEÇİŞ ASTARI 20 KG", "Boya", 1185.0, 11),
        ("00001005", "MİLKRON GEÇİŞ ASTARI 10 KG", "Boya", 615.0, 11),
        ("8697506412127", "FORCE BORU SIZDIRMAZLIK ELEMANI 50 ML", "SIHHİ TESİSAT", 150.0, 11),
        ("8697506412141", "FORCE BORU SIZDIRMAZLIK ELEMANI 250 ML", "SIHHİ TESİSAT", 350.0, 12),
        ("00001004", "ALLMAX 101 YÜZEY ASTARI 3,5 KG", "Boya", 780.0, 5),
        ("00001003", "ARJ METRE 5 MT", "MARANGOZ", 75.0, 11),
        ("00001002", "MİKRON TUTKAL 10 KG", "MARANGOZ", 350.0, 11),
        ("00001001", "MİKRON TUTKAL 3 KG", "GENEL", 185.0, 11),
        ("8692070070483", "MARSHALL İZOLASYON ASTARI 2,5 LT", "Boya", 450.0, 11),
        ("8693513648207", "DYO DİNAMİK SOFT MAT B BAZI 2,5 LT", "Boya", 880.0, 11),
        ("8693513648191", "DYO DİNAMİK SOFT MAT A BAZI 2,5 LT", "Boya", 880.0, 11),
        ("8693513645336", "BEŞYILDIZ PLASTİK A BAZI 3,5 KG", "Boya", 880.0, 11),
        ("8693513645084", "BEŞYILDIZ SİLİKONLU C BAZI 3,5 KG", "Boya", 880.0, 11),
        ("8693513645077", "BEŞYILDIZ SİLİKONLU MAT B BAZI 3,5 KG", "Boya", 880.0, 11),
        ("8693513645060", "BEŞYILDIZ SİLİKONLU MAT A BAZI 3,5 KG", "Boya", 380.0, 11),
        ("8693513645220", "BEŞYILDIZ PLASTİK BEYAZ 3,5 KG", "Boya", 350.0, 11),
        ("8693513674886", "DYO DİNAMİK DIŞ CEPHE RP 4 2,5 LT", "Boya", 878.0, 11),
        ("8693513674893", "DYO DİNAMİK DIŞ CEPHE RP 5 2,5 LT", "Boya", 878.0, 11),
        ("8693513674855", "DYO DİNAMİK DIŞ CEPHE RP 1 2,5 LT", "Boya", 780.0, 11),
        ("8693513674879", "DYO DİNAMİK DIŞ CEPHE RP 3 2,5 LT", "Boya", 780.0, 11),
        ("8693513673391", "DYO DİNAMİK MAT RP 4 2,5 LT", "Boya", 760.0, 11),
        ("8693513673384", "DYO DİNAMİK MAT RP 3 2,5 LT", "Boya", 760.0, 11),
        ("8693513673377", "DYO DİNAMİK MAT RP 2 2,5 LT", "Boya", 760.0, 11),
        ("8693513673360", "DYO DİNAMİK MAT RP 1 2,5 LT", "Boya", 760.0, 11),
        ("8681999194400", "TAYSON KOLİ KALEMİ SİYAH", "GENEL", 40.0, 3),
        ("8681999194417", "TAYSON KOLİ KALEMİ KIRMIZI", "GENEL", 40.0, 5),
        ("8681999194424", "TAYSON KOLİ KALEMİ MAVİ", "GENEL", 40.0, 8),
        ("8683735970002", "MİKRON TAVAN BOYASI 20 KG", "Boya", 600.0, 33),
        ("8683735970033", "MİKRON TAVAN BOYASI 10 KG", "Boya", 400.0, 11),
        ("8697393138001", "PERMOLİT TAVAN 20 KG", "Boya", 700.0, 11),
        ("8697393136007", "PERMOLİT TAVAN BOYASI 10 KG", "Boya", 500.0, 11),
        ("8697393133006", "PERMOLİT TAVA BOYASI 3,5 KG", "Boya", 280.0, 11),
        ("8693513674589", "DYO PLAST RP 5 2,5 LT", "Boya", 650.0, 11),
        ("8693513674572", "DYO PLAST RP 4 2,5 LT", "Boya", 650.0, 11),
        ("8693513674541", "DYO PLAST RP 1 2,5 LT", "Boya", 650.0, 11),
        ("8693513526154", "DYO PLAST A BAZI 2,5 LT", "Boya", 650.0, 11),
        ("8693513672967", "DYO TEKNOPLAST RP 2 15 LT", "Boya", 3900.0, 11),
        ("8693513465934", "DYO TEKNOPLAST B BAZI 15 LT", "Boya", 3900.0, 11),
        ("8693513668991", "DYO TEKNOPLAST BEYAZ 7,5 LT", "Boya", 2100.0, 11),
        ("8693513672929", "DYO TEKNOPLAST RP 3 7,5 LT", "Boya", 2100.0, 11),
        ("8693513672912", "DYO TEKNOPLAST RP 1 7,5 LT", "Boya", 2100.0, 11),
        ("8693513672899", "DYO TEKNOPLAST RP 5 2,5 LT", "Boya", 900.0, 11),
        ("8693513672851", "DYO TEKNOPLAST RP 1 2,5 LT", "Boya", 900.0, 10),
        ("8693513672868", "DYO TEKNOPLAST RP 2 2,5 LT", "Boya", 900.0, 10),
        ("8693513672875", "DYO TEKNOPLAST RP 3 2,5 LT", "Boya", 900.0, 10),
        ("8693513672882", "DYO TEKNOPLAST 2,5 RP4", "Boya", 900.0, 10),
        ("4891199058509", "POWERCEL PİL", "GENEL", 40.0, 10),
        ("8693513673162", "DYO DİNAMİK RP5 15L", "Boya", 2800.0, 10),
        ("8693513673148", "DYO DİNAMİK RP3 15L", "Boya", 2800.0, 10),
        ("8693513673131", "DYO DİNAMİK RP2 15L", "Boya", 2800.0, 10),
        ("8693513673087", "DYO DİNAMİK RP2 7,5L", "Boya", 1700.0, 10),
        ("8693513472208", "DYO DİNAMİK BEYAZ 7,5L", "Boya", 1700.0, 10),
        ("8693513673056", "DYO DİNAMİK RP4 2,5L", "Boya", 650.0, 10),
        ("8693513673049", "DYO DİNAMİK RP3 2,5L", "Boya", 650.0, 10),
        ("8693513673032", "DYO DİNAMİK RP2 2,5L", "Boya", 650.0, 10),
        ("8693513673025", "DYO DİNAMİK RP1 2,5L", "Boya", 650.0, 10),
    ];

    // Önce kategorileri ekle (stock_cards için category_id gerekiyor)
    let product_categories = vec![
        ("SIHHİ TESİSAT", "cat-sihhi-tesisat"),
        ("GENEL TEMİZLİK", "cat-genel-temizlik"),
        ("FAYANS, SERAMİK", "cat-fayans-seramik"),
        ("Boya", "cat-boya"),
        ("HIRDAVAT", "cat-hirdavat"),
        ("ELEKTRİK", "cat-elektrik"),
        ("PIMAPEN", "cat-pimapen"),
        ("MARANGOZ", "cat-marangoz"),
        ("GENEL", "cat-genel"),
    ];

    for (cat_name, cat_id) in &product_categories {
        tx.execute(
            "INSERT OR REPLACE INTO categories (id, name, parent_id, created_at) VALUES (?1, ?2, NULL, ?3)",
            params![cat_id, cat_name, &now],
        ).map_err(|e| e.to_string())?;
    }

    // Gider kategorileri ekle
    let expense_categories = vec!["Yakıt", "Masraf", "Yemek", "Kira", "Fatura", "Personel", "Vergi"];
    for cat_name in expense_categories {
        let id_cleaned = cat_name.to_lowercase()
            .replace("ı", "i").replace("ş", "s").replace("ğ", "g")
            .replace("ü", "u").replace("ö", "o").replace("ç", "c")
            .replace(" ", "-");
        let id = format!("cat-gider-{}", id_cleaned);

        tx.execute(
            "INSERT OR IGNORE INTO categories (id, name, parent_id, created_at) VALUES (?1, ?2, NULL, ?3)",
            params![id, cat_name, &now],
        ).map_err(|e| e.to_string())?;
    }

    // Kategori adından ID'ye dönüştürme fonksiyonu
    fn get_category_id(category: &str) -> &'static str {
        match category {
            "SIHHİ TESİSAT" => "cat-sihhi-tesisat",
            "GENEL TEMİZLİK" => "cat-genel-temizlik",
            "FAYANS, SERAMİK" => "cat-fayans-seramik",
            "Boya" => "cat-boya",
            "HIRDAVAT" => "cat-hirdavat",
            "ELEKTRİK" => "cat-elektrik",
            "PIMAPEN" => "cat-pimapen",
            "MARANGOZ" => "cat-marangoz",
            "GENEL" => "cat-genel",
            _ => "cat-genel",
        }
    }

    for (i, (barcode, name, category, price, qty)) in sample_items.iter().enumerate() {
        let id = format!("item-{:03}", i + 1);
        let stock_card_id = format!("sc-{:03}", i + 1);
        let loc = locations[i % locations.len()];
        let cost = price * 0.7; // Maliyet fiyatı satış fiyatının %70'i
        let category_id = get_category_id(category);

        // Önce stock_cards tablosuna ekle
        tx.execute(
            "INSERT OR REPLACE INTO stock_cards (id, barcode, name, brand, unit, category_id, description, image, supplier_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, NULL, 'ADET', ?4, ?5, NULL, NULL, ?6, ?6)",
            params![
                stock_card_id,
                barcode,
                name,
                category_id,
                format!("{}", name),
                &now
            ],
        ).map_err(|e| e.to_string())?;

        // Sonra inventory_items tablosuna ekle
        tx.execute(
            "INSERT OR REPLACE INTO inventory_items (id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency, supplier_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9, NULL, ?10, 'TL', NULL)",
            params![
                id,
                barcode,
                name,
                category,
                qty,
                loc,
                price,
                cost,
                format!("{}", name),
                &now
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    // Seed Expense Categories
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM expense_categories", []).map_err(|e| e.to_string())?;
    let default_expense_categories = vec!["Yakıt", "Yemek", "Kira", "Fatura", "Personel", "Genel Masraf", "Taksi", "Market", "Kırtasiye"];
    for cat in default_expense_categories {
        conn.execute(
            "INSERT OR IGNORE INTO expense_categories (id, name) VALUES (?1, ?2)",
            params![uuid::Uuid::new_v4().to_string(), cat],
        ).map_err(|e| e.to_string())?;
    }

    Ok(format!("Seed data created: {} stock cards, {} inventory items, {} categories",
        sample_items.len(), sample_items.len(), product_categories.len()))
}

// ==================== EXPENSE CATEGORY COMMANDS ====================

#[tauri::command]
pub fn verify_admin_password(state: State<AppState>, password: String) -> Result<bool, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    
    // 'admin' rolüne sahip ilk kullanıcının şifresi ile eşleştirme yapıyoruz.
    let mut stmt = conn.prepare("SELECT password_hash FROM users WHERE role = 'admin' LIMIT 1").map_err(|e| e.to_string())?;
    let admin_hash_iter = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;

    for hash_result in admin_hash_iter {
        if let Ok(hash) = hash_result {
            if verify_password(&password, &hash).unwrap_or(false) {
                return Ok(true);
            }
        }
    }

    Ok(false)
}



// ==================== EXPENSE COMMANDS ====================

#[tauri::command]
pub fn process_expense(
    state: State<AppState>,
    description: String,
    amount: f64,
    category: String,
    payment_method: String,
    date: String, // Front-end sends ISO date string
) -> Result<Transaction, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    
    let transaction_id = uuid::Uuid::new_v4().to_string();
    // Use user provided date for the record, but created_at is system time? 
    // Usually 'created_at' is database record time. We might need 'transaction_date' if different.
    // For now, let's use the provided date as created_at or assume user enters 'today'.
    // If user enters past date, we should probably respect it for the record.
    // Let's use the provided date.
    
    // Expenses are negative in financial calculations
    let total = -amount.abs(); 
    
    // Create a dummy item for the expense to verify structure
    let expense_item = serde_json::json!([{
        "id": "EXPENSE",
        "sku": "EXPENSE",
        "name": description,
        "category": category,
        "quantity": 1,
        "price": total,
        "cartQuantity": 1
    }]);

    conn.execute(
        "INSERT INTO transactions (id, items, total, payment_method, transaction_type, note, created_at) 
         VALUES (?1, ?2, ?3, ?4, 'EXPENSE', ?5, ?6)",
        params![transaction_id, expense_item.to_string(), total, payment_method, description, date],
    ).map_err(|e| e.to_string())?;

    Ok(Transaction {
        id: transaction_id,
        items: serde_json::from_value(expense_item).unwrap(),
        total,
        payment_method,
        transaction_type: "EXPENSE".to_string(),
        status: "completed".to_string(),
        note: Some(description),
        created_at: date,
        customer_id: None,
    })
}

// ==================== EXPENSE CATEGORY COMMANDS ====================

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ExpenseCategory {
    id: String,
    name: String,
}

#[tauri::command]
pub fn get_expense_categories(state: State<AppState>) -> Result<Vec<ExpenseCategory>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    // Check if empty, if so seed defaults
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM expense_categories", [], |row| row.get(0)).unwrap_or(0);
    if count == 0 {
        let defaults = vec!["Yakıt", "Yemek", "Kira", "Fatura", "Personel", "Genel Masraf", "Taksi", "Market", "Kırtasiye"];
        for cat in defaults {
            let _ = conn.execute(
                "INSERT INTO expense_categories (id, name) VALUES (?1, ?2)",
                params![uuid::Uuid::new_v4().to_string(), cat]
            );
        }
    }

    let mut stmt = conn.prepare("SELECT id, name FROM expense_categories ORDER BY name").map_err(|e| e.to_string())?;
    let cats = stmt.query_map([], |row| {
        Ok(ExpenseCategory {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?;

    cats.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_expense_category(state: State<AppState>, name: String) -> Result<ExpenseCategory, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO expense_categories (id, name) VALUES (?1, ?2)",
        params![&id, &name]
    ).map_err(|e| e.to_string())?;
    Ok(ExpenseCategory { id, name })
}

#[tauri::command]
pub fn delete_expense_category(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM expense_categories WHERE id = ?1", params![&id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ==================== INVOICE NUMBER GENERATION ====================

#[tauri::command]
pub fn generate_invoice_number(state: State<AppState>, prefix: Option<String>) -> Result<String, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    
    // Get current year
    let year = chrono::Utc::now().format("%Y").to_string();
    let prefix_str = prefix.unwrap_or_else(|| "MK".to_string());
    
    // Get the last invoice number for this year/prefix from finance_records
    let pattern = format!("{}-{}-%", prefix_str, year);
    let last_number: Option<String> = conn.query_row(
        "SELECT description FROM finance_records WHERE description LIKE ?1 ORDER BY created_at DESC LIMIT 1",
        params![&pattern],
        |row| row.get(0)
    ).optional().map_err(|e| e.to_string())?;
    
    let next_seq = if let Some(last) = last_number {
        // Extract sequence number from last invoice (MK-2026-00001)
        if let Some(seq_str) = last.split('-').last() {
            seq_str.parse::<u32>().unwrap_or(0) + 1
        } else {
            1
        }
    } else {
        1
    };
    
    // Format: MK-2026-00001
    let invoice_number = format!("{}-{}-{:05}", prefix_str, year, next_seq);
    
    Ok(invoice_number)
}

// ==================== GOODS RECEIPT HISTORY ====================

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GoodsReceiptRecord {
    pub id: String,
    pub invoice_no: Option<String>,
    pub supplier_id: Option<String>,
    pub supplier_name: Option<String>,
    pub total_amount: f64,
    pub payment_method: String,
    pub description: String,
    pub date: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_goods_receipt_history(state: State<AppState>) -> Result<Vec<GoodsReceiptRecord>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT fr.id, fr.description, fr.amount, fr.payment_method, fr.date, fr.created_at,
                ca.id as supplier_id, ca.name as supplier_name
         FROM finance_records fr
         LEFT JOIN current_accounts ca ON fr.description LIKE '%' || ca.name || '%'
         WHERE fr.category = 'MAL_KABUL'
         ORDER BY fr.created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let records = stmt.query_map([], |row| {
        let description: String = row.get(1)?;
        // Extract invoice number from description if present
        let invoice_no = if description.contains("Fatura:") {
            description.split("Fatura:").nth(1).map(|s| s.trim().split_whitespace().next().unwrap_or("").to_string())
        } else {
            None
        };
        
        Ok(GoodsReceiptRecord {
            id: row.get(0)?,
            invoice_no,
            supplier_id: row.get::<_, Option<String>>(6)?,
            supplier_name: row.get::<_, Option<String>>(7)?,
            total_amount: row.get(2)?,
            payment_method: row.get(3)?,
            description: row.get(1)?,
            date: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    

    records.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ==================== CHECK COMMANDS ====================

#[tauri::command]
pub fn check_sku_exists(state: State<AppState>, sku: String) -> Result<bool, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    
    // Check stock_cards table first as it's the master record
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM stock_cards WHERE barcode = ?1",
        [&sku],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    
    if count > 0 {
        return Ok(true);
    }

    // Also check inventory_items just in case
    let inv_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM inventory_items WHERE sku = ?1",
        [&sku],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(inv_count > 0)
}

#[tauri::command]
pub fn check_category_usage(state: State<AppState>, category_id: String) -> Result<i32, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    
    // Check stock_cards using this category
    let card_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM stock_cards WHERE category_id = ?1",
        [&category_id],
        |row| row.get(0),
    ).unwrap_or(0);
    
    Ok(card_count)
}

#[tauri::command]
pub fn check_current_account_exists(state: State<AppState>, name: String) -> Result<bool, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM current_accounts WHERE name = ?1",
        [&name],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(count > 0)
}

// ==================== MULTI-DEVICE SYNC COMMANDS ====================

use crate::services::sync::{self as sync_service, ActionType, SyncState as DeviceSyncState};

/// Perform manual sync (push and pull)
#[tauri::command]
pub fn perform_device_sync(state: State<AppState>) -> Result<DeviceSyncResult, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let (pushed, pulled) = sync_service::perform_sync(&conn).map_err(|e| e.to_string())?;
    Ok(DeviceSyncResult { pushed, pulled })
}

#[derive(serde::Serialize)]
pub struct DeviceSyncResult {
    pub pushed: i32,
    pub pulled: i32,
}

/// Get device sync status
#[tauri::command]
pub fn get_device_sync_state(state: State<AppState>) -> Result<DeviceSyncState, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    sync_service::get_sync_state(&conn).map_err(|e| e.to_string())
}

/// Start background sync service
#[tauri::command]
pub fn start_device_sync(state: State<AppState>, interval_seconds: Option<u64>) -> Result<bool, String> {
    let interval = interval_seconds.unwrap_or(300); // Default 5 minutes
    let db_path = state.db.get_db_path_string();
    sync_service::start_background_sync(db_path, interval).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Stop background sync service
#[tauri::command]
pub fn stop_device_sync() -> Result<bool, String> {
    sync_service::stop_background_sync();
    Ok(true)
}

/// Check if sync is running
#[tauri::command]
pub fn is_device_sync_running() -> Result<bool, String> {
    Ok(sync_service::is_sync_running())
}

/// Queue a transaction for sync (called internally after inventory changes)
#[tauri::command]
pub fn queue_sync_transaction(
    state: State<AppState>,
    action_type: String,
    item_sku: Option<String>,
    item_name: Option<String>,
    quantity_change: i32,
    old_value: Option<f64>,
    new_value: Option<f64>,
    metadata: Option<String>,
) -> Result<String, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let action = match action_type.as_str() {
        "SALE" => ActionType::SALE,
        "STOCK_IN" => ActionType::STOCK_IN,
        "STOCK_OUT" => ActionType::STOCK_OUT,
        "PRICE_CHANGE" => ActionType::PRICE_CHANGE,
        "ITEM_CREATE" => ActionType::ITEM_CREATE,
        "ITEM_UPDATE" => ActionType::ITEM_UPDATE,
        "ITEM_DELETE" => ActionType::ITEM_DELETE,
        _ => return Err("Invalid action type".to_string()),
    };

    sync_service::queue_transaction(
        &conn,
        action,
        item_sku.as_deref(),
        item_name.as_deref(),
        quantity_change,
        old_value,
        new_value,
        metadata.as_deref(),
    ).map_err(|e| e.to_string())
}
