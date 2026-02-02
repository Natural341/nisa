use rusqlite::{params, Connection, OptionalExtension};

use crate::error::AppError;
use crate::models::{CategoryStats, DashboardStats, InventoryItem};
use crate::security::validation::{validate_price, validate_quantity, validate_sku};

/// Get all inventory items
pub fn get_all_items(conn: &Connection) -> Result<Vec<InventoryItem>, AppError> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, sku, name, category, quantity, location, price, cost_price,
                image, description, ai_tags, last_updated, currency
         FROM inventory_items
         ORDER BY last_updated DESC",
    )?;

    let items = stmt
        .query_map([], |row| {
            let ai_tags_str: Option<String> = row.get(10)?;
            let ai_tags: Option<Vec<String>> =
                ai_tags_str.and_then(|s| serde_json::from_str(&s).ok());

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
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(items)
}

/// Get item by SKU
pub fn get_item_by_sku(conn: &Connection, sku: &str) -> Result<Option<InventoryItem>, AppError> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, sku, name, category, quantity, location, price, cost_price,
                image, description, ai_tags, last_updated, currency
         FROM inventory_items WHERE sku = ?1",
    )?;

    let item = stmt
        .query_row([sku], |row| {
            let ai_tags_str: Option<String> = row.get(10)?;
            let ai_tags: Option<Vec<String>> =
                ai_tags_str.and_then(|s| serde_json::from_str(&s).ok());

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
        })
        .optional()?;

    Ok(item)
}

/// Add a new inventory item with validation
pub fn add_item(conn: &Connection, item: &InventoryItem) -> Result<(), AppError> {
    // Validate inputs
    validate_sku(&item.sku).map_err(AppError::Validation)?;
    validate_price(item.price).map_err(AppError::Validation)?;
    validate_quantity(item.quantity).map_err(AppError::Validation)?;

    let ai_tags_json = item
        .ai_tags
        .as_ref()
        .map(|tags| serde_json::to_string(tags).unwrap_or_default());

    conn.execute(
        "INSERT INTO inventory_items
         (id, sku, name, category, quantity, location, price, cost_price,
          image, description, ai_tags, last_updated, currency)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            item.id,
            item.sku,
            item.name,
            item.category,
            item.quantity,
            item.location,
            item.price,
            item.cost_price,
            item.image,
            item.description,
            ai_tags_json,
            item.last_updated,
            item.currency
        ],
    )?;

    Ok(())
}

/// Update existing inventory item
pub fn update_item(conn: &Connection, item: &InventoryItem) -> Result<(), AppError> {
    validate_price(item.price).map_err(AppError::Validation)?;
    validate_quantity(item.quantity).map_err(AppError::Validation)?;

    let ai_tags_json = item
        .ai_tags
        .as_ref()
        .map(|tags| serde_json::to_string(tags).unwrap_or_default());

    let affected = conn.execute(
        "UPDATE inventory_items
         SET name = ?1, category = ?2, quantity = ?3, location = ?4,
             price = ?5, cost_price = ?6, image = ?7, description = ?8,
             ai_tags = ?9, last_updated = ?10, currency = ?11
         WHERE sku = ?12",
        params![
            item.name,
            item.category,
            item.quantity,
            item.location,
            item.price,
            item.cost_price,
            item.image,
            item.description,
            ai_tags_json,
            item.last_updated,
            item.currency,
            item.sku
        ],
    )?;

    if affected == 0 {
        return Err(AppError::NotFound(format!("Urun bulunamadi: {}", item.sku)));
    }

    Ok(())
}

/// Delete item by SKU
pub fn delete_item(conn: &Connection, sku: &str) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM inventory_items WHERE sku = ?1", [sku])?;

    if affected == 0 {
        return Err(AppError::NotFound(format!("Urun bulunamadi: {}", sku)));
    }

    Ok(())
}

/// Update quantity by delta (can be negative for sales)
pub fn update_quantity(
    conn: &Connection,
    sku: &str,
    delta: i32,
) -> Result<Option<InventoryItem>, AppError> {
    let now = chrono::Utc::now().to_rfc3339();

    // First get current quantity to check bounds
    let current_qty: Option<i32> = conn
        .query_row(
            "SELECT quantity FROM inventory_items WHERE sku = ?1",
            [sku],
            |row| row.get(0),
        )
        .optional()?;

    let current_qty = match current_qty {
        Some(q) => q,
        None => return Ok(None), // Item not found
    };

    let new_qty = (current_qty + delta).max(0); // Prevent negative

    conn.execute(
        "UPDATE inventory_items SET quantity = ?1, last_updated = ?2 WHERE sku = ?3",
        params![new_qty, now, sku],
    )?;

    // Return updated item
    get_item_by_sku(conn, sku)
}

/// Get dashboard statistics
pub fn get_dashboard_stats(conn: &Connection) -> Result<DashboardStats, AppError> {
    let total_items: i32 = conn.query_row(
        "SELECT COUNT(*) FROM inventory_items",
        [],
        |row| row.get(0),
    )?;

    let total_quantity: i32 = conn.query_row(
        "SELECT COALESCE(SUM(quantity), 0) FROM inventory_items",
        [],
        |row| row.get(0),
    )?;

    let low_stock_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM inventory_items WHERE quantity < 10",
        [],
        |row| row.get(0),
    )?;

    let total_revenue: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total), 0) FROM transactions WHERE transaction_type = 'SALE'",
        [],
        |row| row.get(0),
    )?;

    Ok(DashboardStats {
        total_items,
        total_quantity,
        low_stock_count,
        total_revenue,
    })
}

/// Get category statistics
pub fn get_category_stats(conn: &Connection) -> Result<Vec<CategoryStats>, AppError> {
    let mut stmt = conn.prepare_cached(
        "SELECT category, COUNT(*) as count, SUM(quantity) as total_qty,
                SUM(price * quantity) as total_value
         FROM inventory_items
         GROUP BY category
         ORDER BY total_value DESC",
    )?;

    let stats = stmt
        .query_map([], |row| {
            Ok(CategoryStats {
                category: row.get(0)?,
                count: row.get(1)?,
                total_quantity: row.get::<_, Option<i32>>(2)?.unwrap_or(0),
                total_value: row.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(stats)
}

/// Apply price change by category
pub fn apply_price_change(
    conn: &Connection,
    category: &str,
    percentage: f64,
) -> Result<usize, AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let multiplier = 1.0 + (percentage / 100.0);

    let affected = if category == "HEPSİ" || category == "TÜMÜ" || category == "ALL" {
        conn.execute(
            "UPDATE inventory_items SET price = price * ?1, last_updated = ?2",
            params![multiplier, now],
        )?
    } else {
        conn.execute(
            "UPDATE inventory_items SET price = price * ?1, last_updated = ?2 WHERE category = ?3",
            params![multiplier, now, category],
        )?
    };

    Ok(affected)
}

/// Export inventory to CSV and return content
pub fn export_to_csv(conn: &Connection) -> Result<String, AppError> {
    let items = get_all_items(conn)?;

    let mut csv = String::from("\u{FEFF}"); // UTF-8 BOM for Excel
    csv.push_str("ID;SKU;Ad;Kategori;Miktar;Konum;Fiyat;Son Guncelleme\n");

    for item in items {
        csv.push_str(&format!(
            "{};{};{};{};{};{};{:.2};{}\n",
            item.id,
            item.sku,
            item.name.replace(';', ","),
            item.category,
            item.quantity,
            item.location,
            item.price,
            item.last_updated
        ));
    }

    Ok(csv)
}

/// Import from CSV content
pub fn import_from_csv(conn: &Connection, csv_content: &str) -> Result<String, AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let mut imported = 0;
    let mut updated = 0;
    let mut errors = 0;

    for (line_num, line) in csv_content.lines().enumerate() {
        // Skip header line
        if line_num == 0 {
            continue;
        }

        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Try semicolon first, then comma
        let parts: Vec<&str> = if line.contains(';') {
            line.split(';').collect()
        } else {
            line.split(',').collect()
        };

        if parts.len() < 6 {
            errors += 1;
            continue;
        }

        let sku = parts[1].trim();
        let name = parts[2].trim();
        let category = parts[3].trim();
        let quantity: i32 = parts[4].trim().parse().unwrap_or(0);
        let location = parts[5].trim();
        let price: f64 = if parts.len() > 6 {
            parts[6].trim().replace(',', ".").parse().unwrap_or(0.0)
        } else {
            0.0
        };

        // Check if item exists
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM inventory_items WHERE sku = ?1",
                [sku],
                |_| Ok(true),
            )
            .optional()?
            .unwrap_or(false);

        if exists {
            conn.execute(
                "UPDATE inventory_items SET name = ?1, category = ?2, quantity = ?3,
                 location = ?4, price = ?5, last_updated = ?6 WHERE sku = ?7",
                params![name, category, quantity, location, price, now, sku],
            )?;
            updated += 1;
        } else {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO inventory_items (id, sku, name, category, quantity, location, price, last_updated)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![id, sku, name, category, quantity, location, price, now],
            )?;
            imported += 1;
        }
    }

    Ok(format!(
        "Import tamamlandi: {} yeni, {} guncellendi, {} hata",
        imported, updated, errors
    ))
}

/// Clear all inventory data
pub fn clear_inventory(conn: &Connection) -> Result<(), AppError> {
    conn.execute("DELETE FROM inventory_items", [])?;
    Ok(())
}

/// Seed database with sample data
pub fn seed_inventory(conn: &Connection) -> Result<String, AppError> {
    let now = chrono::Utc::now();
    let categories = ["Elektronik", "Giyim", "Gida", "Kirtasiye", "Aksesuar"];
    let mut count = 0;

    for i in 1..=20 {
        let id = uuid::Uuid::new_v4().to_string();
        let sku = format!("DEMO-{:03}", i);
        let name = format!("Ornek Urun {}", i);
        let category = categories[i % categories.len()];
        let quantity = (i * 5) as i32;
        let price = (i as f64 * 15.0) + 10.0;
        let location = format!("Raf-{}", (i % 5) + 1);
        let last_updated = now.to_rfc3339();

        let result = conn.execute(
            "INSERT OR IGNORE INTO inventory_items (id, sku, name, category, quantity, location, price, last_updated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, sku, name, category, quantity, location, price, last_updated],
        );

        if result.is_ok() {
            count += 1;
        }
    }

    Ok(format!("{} ornek urun eklendi", count))
}
