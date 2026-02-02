
#[cfg(test)]
mod tests {
    use rusqlite::{params, Connection};
    use crate::models::{CartItem, InventoryItem};
    use crate::services::inventory;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        
        conn.execute_batch(
            "
            CREATE TABLE inventory_items (
                id TEXT PRIMARY KEY NOT NULL,
                sku TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT DEFAULT 'Genel',
                quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
                location TEXT DEFAULT '',
                price REAL DEFAULT 0.00 CHECK (price >= 0),
                cost_price REAL DEFAULT 0.00,
                image TEXT,
                description TEXT,
                ai_tags TEXT,
                last_updated TEXT NOT NULL,
                currency TEXT DEFAULT 'TL',
                supplier_id TEXT
            );

            CREATE TABLE transactions (
                id TEXT PRIMARY KEY NOT NULL,
                items TEXT NOT NULL,
                total REAL NOT NULL,
                payment_method TEXT DEFAULT 'Nakit',
                transaction_type TEXT DEFAULT 'SALE',
                note TEXT,
                created_at TEXT NOT NULL,
                customer_id TEXT
            );

            CREATE TABLE current_accounts (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                account_type TEXT NOT NULL DEFAULT 'CUSTOMER',
                tax_number TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                note TEXT,
                payment_term INTEGER DEFAULT 0,
                balance REAL DEFAULT 0.00,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE inventory_lots (
                id TEXT PRIMARY KEY NOT NULL,
                product_id TEXT NOT NULL,
                supplier_id TEXT,
                quantity INTEGER NOT NULL,
                initial_quantity INTEGER NOT NULL,
                buy_price REAL NOT NULL,
                sell_price REAL,
                receipt_date TEXT NOT NULL,
                invoice_no TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE stock_cards (
                id TEXT PRIMARY KEY NOT NULL,
                barcode TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                brand TEXT,
                unit TEXT NOT NULL DEFAULT 'ADET',
                category_id TEXT,
                description TEXT,
                image TEXT,
                supplier_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            "
        ).unwrap();

        conn
    }

    #[test]
    fn test_process_sale_success() {
        let mut conn = setup_db();

        // Seed item
        conn.execute(
            "INSERT INTO inventory_items (id, sku, name, quantity, price, last_updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["item-1", "SKU123", "Test Item", 10, 100.0, "2024-01-01"],
        ).unwrap();

        let cart_items = vec![
            CartItem {
                id: "item-1".to_string(),
                sku: "SKU123".to_string(),
                name: "Test Item".to_string(),
                cart_quantity: 2,
                price: 100.0,
                cost_price: None,
            }
        ];

        let result = inventory::process_sale_transaction(
            &mut conn,
            cart_items,
            "NAKIT".to_string(),
            "SALE".to_string(),
            None,
            None
        );

        assert!(result.is_ok());
        let tx = result.unwrap();
        assert_eq!(tx.total, 200.0);

        // Verify inventory update
        let new_qty: i32 = conn.query_row(
            "SELECT quantity FROM inventory_items WHERE sku = 'SKU123'",
            [],
            |row| row.get(0)
        ).unwrap();
        assert_eq!(new_qty, 8);
    }

    #[test]
    fn test_process_sale_price_manipulation() {
        let mut conn = setup_db();

        // Seed item with price 100.0
        conn.execute(
            "INSERT INTO inventory_items (id, sku, name, quantity, price, last_updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["item-1", "SKU123", "Test Item", 10, 100.0, "2024-01-01"],
        ).unwrap();

        let cart_items = vec![
            CartItem {
                id: "item-1".to_string(),
                sku: "SKU123".to_string(),
                name: "Test Item".to_string(),
                cart_quantity: 1,
                price: 50.0, // MANIPULATED PRICE (Should be 100.0)
                cost_price: None,
            }
        ];

        let result = inventory::process_sale_transaction(
            &mut conn,
            cart_items,
            "NAKIT".to_string(),
            "SALE".to_string(),
            None,
            None
        );

        assert!(result.is_err());
        let err = result.err().unwrap().to_string();
        assert!(err.contains("Fiyat uyuşmazlığı"));
    }

    #[test]
    fn test_process_sale_negative_quantity() {
        let mut conn = setup_db();

        // Seed item
        conn.execute(
            "INSERT INTO inventory_items (id, sku, name, quantity, price, last_updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["item-1", "SKU123", "Test Item", 10, 100.0, "2024-01-01"],
        ).unwrap();

        let cart_items = vec![
            CartItem {
                id: "item-1".to_string(),
                sku: "SKU123".to_string(),
                name: "Test Item".to_string(),
                cart_quantity: -5, // NEGATIVE QUANTITY
                price: 100.0,
                cost_price: None,
            }
        ];

        let result = inventory::process_sale_transaction(
            &mut conn,
            cart_items,
            "NAKIT".to_string(),
            "SALE".to_string(),
            None,
            None
        );

        assert!(result.is_err());
        let err = result.err().unwrap().to_string();
        assert!(err.contains("Geçersiz miktar"));
    }

    #[test]
    fn test_delete_stock_card_safety() {
        let conn = setup_db();

        // 1. Create Stock Card
        conn.execute(
            "INSERT INTO stock_cards (id, barcode, name, unit, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["sc-1", "SKU123", "Test Card", "ADET", "2024-01-01", "2024-01-01"],
        ).unwrap();

        // 2. Create Inventory Item linked via SKU/Barcode
        conn.execute(
            "INSERT INTO inventory_items (id, sku, name, quantity, price, last_updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["item-1", "SKU123", "Test Item", 5, 100.0, "2024-01-01"],
        ).unwrap();

        // 3. Try to delete stock card -> Should Fail
        let result = inventory::delete_stock_card_safe(&conn, "sc-1");
        assert!(result.is_err());
        assert!(result.err().unwrap().to_string().contains("envanter kaydı var"));

        // 4. Delete Inventory Item
        conn.execute("DELETE FROM inventory_items WHERE sku = 'SKU123'", []).unwrap();

        // 5. Try to delete stock card -> Should Success
        let result = inventory::delete_stock_card_safe(&conn, "sc-1");
        assert!(result.is_ok());
    }
}
