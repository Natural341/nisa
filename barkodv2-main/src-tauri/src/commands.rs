use crate::models::{
    CartItem, DashboardStats, InventoryItem, Transaction, SalesDataPoint, CategoryStats,
    ActivityLog, User, CreateUserRequest, UpdateUserRequest,
    License, LicenseValidateResponse, LicenseActivateResponse,
    SyncStatus, CloudBackupResponse, CloudStatusResponse,
    PaginatedItemsResponse, PaginatedTransactionsResponse,
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
use rusqlite::{params, OptionalExtension};
use tauri::State;

// ==================== INVENTORY COMMANDS ====================

#[tauri::command]
pub fn get_all_items(state: State<AppState>) -> Result<Vec<InventoryItem>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency FROM inventory_items ORDER BY name"
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
        })
    }).map_err(|e| e.to_string())?;

    items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_item_by_sku(state: State<AppState>, sku: String) -> Result<Option<InventoryItem>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency FROM inventory_items WHERE sku = ?1"
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
        "INSERT INTO inventory_items (id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
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
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_item(state: State<AppState>, item: InventoryItem) -> Result<(), String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let ai_tags_str = serde_json::to_string(&item.ai_tags).unwrap_or("[]".to_string());

    conn.execute(
        "UPDATE inventory_items SET name = ?1, category = ?2, quantity = ?3, location = ?4, price = ?5, cost_price = ?6, image = ?7, description = ?8, ai_tags = ?9, last_updated = ?10, currency = ?11 WHERE sku = ?12",
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
) -> Result<Transaction, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut total = 0.0;
    for item in &cart_items {
        total += item.price * item.cart_quantity as f64;
    }
    if transaction_type == "RETURN" {
        total = -total;
    }

    let transaction_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    let items_json = serde_json::to_string(&cart_items).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO transactions (id, items, total, payment_method, transaction_type, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![&transaction_id, &items_json, total, &payment_method, &transaction_type, &note, &created_at],
    ).map_err(|e| e.to_string())?;

    // Update inventory quantities
    for item in &cart_items {
        let current_qty: i32 = conn.query_row(
            "SELECT quantity FROM inventory_items WHERE sku = ?1",
            params![&item.sku],
            |row| row.get(0),
        ).unwrap_or(0);

        let new_qty = if transaction_type == "RETURN" {
            current_qty + item.cart_quantity
        } else {
            current_qty - item.cart_quantity
        };
        let final_qty = if new_qty < 0 { 0 } else { new_qty };

        conn.execute(
            "UPDATE inventory_items SET quantity = ?1, last_updated = ?2 WHERE sku = ?3",
            params![final_qty, &created_at, &item.sku],
        ).map_err(|e| e.to_string())?;
    }

    Ok(Transaction {
        id: transaction_id,
        items: cart_items,
        total,
        payment_method,
        transaction_type,
        status: "completed".to_string(),
        note,
        created_at,
    })
}

#[tauri::command]
pub fn get_transactions(state: State<AppState>) -> Result<Vec<Transaction>, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, items, total, payment_method, transaction_type, note, created_at FROM transactions ORDER BY created_at DESC"
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
        "SELECT id, items, total, payment_method, transaction_type, note, created_at FROM transactions WHERE substr(created_at, 1, 10) >= ?1 AND substr(created_at, 1, 10) <= ?2 ORDER BY created_at DESC"
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
        "SELECT id, sku, name, category, quantity, location, price, last_updated FROM inventory_items"
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
            row.get::<_, String>(7)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut csv_content = String::from("\u{FEFF}");
    csv_content.push_str("ID;SKU;Ürün Adı;Kategori;Miktar;Konum;Fiyat;Son Güncelleme\n");

    for row_result in rows {
        let (id, sku, name, category, quantity, location, price, last_updated) = row_result.map_err(|e| e.to_string())?;
        csv_content.push_str(&format!(
            "{};{};{};{};{};{};{:.2};{}\n",
            id, sku, name, category, quantity, location, price, last_updated
        ));
    }

    std::fs::write(&file_path, csv_content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn import_from_csv(state: State<AppState>, file_path: String) -> Result<i32, String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let mut imported = 0;
    for (idx, line) in content.lines().enumerate() {
        if idx == 0 { continue; }
        if line.trim().is_empty() { continue; }

        let parts: Vec<&str> = line.split(';').collect();
        if parts.len() < 6 { continue; }

        let id = uuid::Uuid::new_v4().to_string();
        let sku = parts.get(1).unwrap_or(&"").trim();
        let name = parts.get(2).unwrap_or(&"").trim();
        let category = parts.get(3).unwrap_or(&"Genel").trim();
        let quantity: i32 = parts.get(4).unwrap_or(&"0").trim().parse().unwrap_or(0);
        let price: f64 = parts.get(6).unwrap_or(&"0").trim().replace(",", ".").parse().unwrap_or(0.0);
        let location = parts.get(5).unwrap_or(&"").trim();

        if sku.is_empty() || name.is_empty() { continue; }

        // Use INSERT OR REPLACE for SQLite upsert
        let result = conn.execute(
            "INSERT OR REPLACE INTO inventory_items (id, sku, name, category, quantity, location, price, last_updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![&id, sku, name, category, quantity, location, price, &now],
        );

        if result.is_ok() {
            imported += 1;
        }
    }

    Ok(imported)
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
pub fn seed_database(state: State<AppState>) -> Result<String, String> {
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

    Ok("Veritabanı TL para birimi ile başarıyla sıfırlandı ve yeniden oluşturuldu.".to_string())
}

// ==================== USER AUTHENTICATION COMMANDS ====================

// Rate limiting sabitleri
const MAX_LOGIN_ATTEMPTS: i32 = 5;
const LOCKOUT_DURATION_MINUTES: i64 = 15;

#[tauri::command]
pub fn login(state: State<AppState>, username: String, password: String) -> Result<User, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

    // Kullanıcıyı ara (rate limiting alanları dahil)
    let user_result: Result<(String, String, String, String, String, String, Option<String>, i32, Option<String>), _> = conn.query_row(
        "SELECT id, username, password_hash, display_name, role, created_at, last_login, failed_login_attempts, locked_until FROM users WHERE username = ?1",
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
            ))
        },
    );

    match user_result {
        Ok((id, uname, password_hash, display_name, role, created_at, _, failed_attempts, locked_until)) => {
            let now = chrono::Utc::now();
            
            // Hesap kilitli mi kontrol et
            if let Some(ref lock_time) = locked_until {
                if let Ok(lock_dt) = chrono::DateTime::parse_from_rfc3339(lock_time) {
                    if now < lock_dt.with_timezone(&chrono::Utc) {
                        let remaining = (lock_dt.with_timezone(&chrono::Utc) - now).num_minutes() + 1;
                        return Err(format!("Hesabınız kilitli. {} dakika sonra tekrar deneyin.", remaining));
                    }
                }
            }


            // Şifreyi doğrula - Sadece Argon2id hash doğrulaması
            let is_valid = verify_password(&password, &password_hash).unwrap_or(false);

            if !is_valid {
                // Başarısız deneme sayısını artır
                let new_attempts = failed_attempts + 1;
                
                if new_attempts >= MAX_LOGIN_ATTEMPTS {
                    // Hesabı kilitle
                    let lock_until = (now + chrono::Duration::minutes(LOCKOUT_DURATION_MINUTES)).to_rfc3339();
                    conn.execute(
                        "UPDATE users SET failed_login_attempts = ?1, locked_until = ?2 WHERE id = ?3",
                        params![new_attempts, &lock_until, &id],
                    ).map_err(|e| e.to_string())?;
                    return Err(format!("Çok fazla başarısız deneme. Hesabınız {} dakika kilitlendi.", LOCKOUT_DURATION_MINUTES));
                } else {
                    conn.execute(
                        "UPDATE users SET failed_login_attempts = ?1 WHERE id = ?2",
                        params![new_attempts, &id],
                    ).map_err(|e| e.to_string())?;
                    let remaining = MAX_LOGIN_ATTEMPTS - new_attempts;
                    return Err(format!("Hatalı şifre. {} deneme hakkınız kaldı.", remaining));
                }
            }

            // Varsayılan şifre kullanılıyor mu kontrol et (admin123)
            let must_change = password == "admin123";

            // Başarılı giriş - sayaçları sıfırla
            let now_str = now.to_rfc3339();
            conn.execute(
                "UPDATE users SET last_login = ?1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?2",
                params![&now_str, &id],
            ).map_err(|e| e.to_string())?;

            Ok(User {
                id,
                username: uname,
                display_name,
                role,
                created_at,
                last_login: Some(now_str),
                must_change_password: must_change,
            })
        }
        Err(_) => Err("Kullanıcı bulunamadı".to_string()),
    }
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
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        stmt.query_row(params_refs.as_slice(), |row| row.get(0)).unwrap_or(0)
    };

    // Get paginated items
    let select_sql = format!(
        "SELECT id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency
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
pub fn get_transactions_paginated(
    state: State<AppState>,
    page: i32,
    per_page: i32,
    start_date: Option<String>,
    end_date: Option<String>,
    transaction_type: Option<String>,
) -> Result<PaginatedTransactionsResponse, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;

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
        "SELECT id, items, total, payment_method, transaction_type, note, created_at
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
    let response = license::activate_license_api(&api_base_url, &license_key, &mac)
        .map_err(|e| e.to_string())?;

    if response.success {
        // Save license to local database
        let conn = state.db.get_conn().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();

        let license_data = License {
            license_key: license_key.clone(),
            dealer_id: response.dealer_id.clone().unwrap_or_default(),
            dealer_name: response.dealer_name.clone().unwrap_or_default(),
            mac_address: mac,
            activated_at: response.activated_at.clone().unwrap_or(now.clone()),
            expires_at: response.expires_at.clone(),
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
            let password_hash = hash_password("admin123").unwrap_or_else(|_| "admin123_hashed".to_string());
            let dealer_name = response.dealer_name.clone().unwrap_or("Admin".to_string());
            let dealer_id = response.dealer_id.clone().unwrap_or_default();

            conn.execute(
                "INSERT INTO users (id, username, password_hash, display_name, role, created_at, dealer_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![&admin_id, "admin", &password_hash, &dealer_name, "admin", &now, &dealer_id],
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(response)
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
