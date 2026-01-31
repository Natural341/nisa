use chrono::Utc;
use directories::ProjectDirs;
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::path::PathBuf;

use crate::error::AppError;

pub type DbPool = Pool<SqliteConnectionManager>;
pub type DbConn = PooledConnection<SqliteConnectionManager>;

pub struct Database {
    pool: DbPool,
    db_path: PathBuf,
}

impl Database {
    pub fn new() -> Result<Self, AppError> {
        let db_path = Self::get_db_path()?;

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let manager = SqliteConnectionManager::file(&db_path);

        let pool = Pool::builder()
            .max_size(10)
            .min_idle(Some(2))
            .build(manager)
            .map_err(|e| AppError::Internal(format!("Pool olusturulamadi: {}", e)))?;

        // Initialize database with pragmas and schema
        {
            let conn = pool
                .get()
                .map_err(|e| AppError::Internal(format!("Baglanti alinamadi: {}", e)))?;
            Self::init_pragmas(&conn)?;
            Self::init_schema(&conn)?;
        }

        Ok(Self { pool, db_path })
    }

    fn get_db_path() -> Result<PathBuf, AppError> {
        let proj_dirs = ProjectDirs::from("com", "nexus", "inventory").ok_or_else(|| {
            AppError::Internal("Uygulama veri dizini belirlenemedi".to_string())
        })?;

        let data_dir = proj_dirs.data_dir();
        Ok(data_dir.join("inventory.db"))
    }

    /// Get database path as string (for backup operations)
    pub fn get_db_path_string(&self) -> String {
        self.db_path.to_string_lossy().to_string()
    }

    fn init_pragmas(conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;
            PRAGMA busy_timeout = 5000;
            PRAGMA foreign_keys = ON;
            PRAGMA temp_store = MEMORY;
            ",
        )?;
        Ok(())
    }

    fn init_schema(conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch(
            "
            -- Inventory Items Table
            CREATE TABLE IF NOT EXISTS inventory_items (
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

            -- Transactions Table
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY NOT NULL,
                items TEXT NOT NULL,
                total REAL NOT NULL,
                payment_method TEXT DEFAULT 'Nakit',
                transaction_type TEXT DEFAULT 'SALE' CHECK (transaction_type IN ('SALE', 'RETURN', 'EXPENSE', 'COLLECTION', 'PURCHASE')),
                note TEXT,
                created_at TEXT NOT NULL,
                customer_id TEXT
            );

            -- Users Table
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                created_at TEXT NOT NULL,
                last_login TEXT,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until TEXT,
                dealer_id TEXT,
                must_change_password BOOLEAN DEFAULT 0
            );

            -- License Table (tek kayıt tutacak)
            CREATE TABLE IF NOT EXISTS license (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                license_key TEXT NOT NULL,
                dealer_id TEXT NOT NULL,
                dealer_name TEXT NOT NULL,
                mac_address TEXT NOT NULL,
                activated_at TEXT NOT NULL,
                expires_at TEXT,
                is_active INTEGER DEFAULT 1,
                last_validated TEXT,
                api_base_url TEXT NOT NULL
            );

            -- Cloud Sync Status Table
            CREATE TABLE IF NOT EXISTS sync_status (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_backup_at TEXT,
                last_restore_at TEXT,
                auto_sync_enabled INTEGER DEFAULT 0,
                auto_sync_interval_minutes INTEGER DEFAULT 30
            );

            -- Settings Table
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT
            );

            -- Finance Records Table
            CREATE TABLE IF NOT EXISTS finance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_type TEXT NOT NULL CHECK (record_type IN ('INCOME', 'EXPENSE')),
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                payment_method TEXT NOT NULL DEFAULT 'NAKIT',
                description TEXT DEFAULT '',
                date TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            -- Access Codes Table
            CREATE TABLE IF NOT EXISTS access_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at TEXT NOT NULL
            );

            -- Activity Log Table
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT NOT NULL,
                description TEXT NOT NULL,
                item_id TEXT,
                item_name TEXT,
                quantity_change INTEGER,
                value REAL,
                user_id TEXT,
                created_at TEXT NOT NULL
            );

            -- Current Accounts (Cari) Table
            CREATE TABLE IF NOT EXISTS current_accounts (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                account_type TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (account_type IN ('CUSTOMER', 'SUPPLIER', 'BOTH')),
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

            -- Stock Cards Table
            CREATE TABLE IF NOT EXISTS stock_cards (
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

            -- Categories Table
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                parent_id TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
            );

            -- Inventory Lots Table (for lot/batch tracking)
            CREATE TABLE IF NOT EXISTS inventory_lots (
                id TEXT PRIMARY KEY NOT NULL,
                product_id TEXT NOT NULL,
                supplier_id TEXT,
                quantity INTEGER NOT NULL,
                initial_quantity INTEGER NOT NULL,
                buy_price REAL NOT NULL,
                sell_price REAL,
                receipt_date TEXT NOT NULL,
                invoice_no TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (product_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
                FOREIGN KEY (supplier_id) REFERENCES current_accounts(id)
            );

            -- Sync Transactions Table (Local outbox for pending sync)
            CREATE TABLE IF NOT EXISTS sync_outbox (
                id TEXT PRIMARY KEY NOT NULL,
                action_type TEXT NOT NULL CHECK (action_type IN ('SALE', 'STOCK_IN', 'STOCK_OUT', 'PRICE_CHANGE', 'ITEM_CREATE', 'ITEM_UPDATE', 'ITEM_DELETE')),
                item_sku TEXT,
                item_name TEXT,
                quantity_change INTEGER DEFAULT 0,
                old_value REAL,
                new_value REAL,
                metadata TEXT,
                transaction_time TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            -- Sync State Table (Track last sync position)
            CREATE TABLE IF NOT EXISTS sync_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_push_at TEXT,
                last_pull_at TEXT,
                last_received_id TEXT,
                sync_in_progress INTEGER DEFAULT 0
            );

            -- Performance Indexes
            CREATE INDEX IF NOT EXISTS idx_sync_outbox_synced ON sync_outbox(synced);
            CREATE INDEX IF NOT EXISTS idx_sync_outbox_time ON sync_outbox(transaction_time);
            CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);
            CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
            CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory_items(quantity);
            CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
            CREATE INDEX IF NOT EXISTS idx_transactions_payment ON transactions(payment_method);
            CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_current_accounts_name ON current_accounts(name);
            CREATE INDEX IF NOT EXISTS idx_stock_cards_barcode ON stock_cards(barcode);
            CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
            CREATE INDEX IF NOT EXISTS idx_inventory_lots_product ON inventory_lots(product_id);
            CREATE INDEX IF NOT EXISTS idx_inventory_lots_created ON inventory_lots(created_at);
            CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier ON inventory_items(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_finance_records_date ON finance_records(date);
            CREATE INDEX IF NOT EXISTS idx_finance_records_payment ON finance_records(payment_method);

            -- Expense Categories Table
            CREATE TABLE IF NOT EXISTS expense_categories (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT UNIQUE NOT NULL
            );
            ",
        )?;

        // Migration: Ensure supplier_id column exists in inventory_items (for existing databases)
        // Check if column exists
        let has_supplier_id: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('inventory_items') WHERE name='supplier_id'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !has_supplier_id {
            // Add the column if it doesn't exist
            // Ignore error if column already exists (race condition or check failed)
            let _ = conn.execute("ALTER TABLE inventory_items ADD COLUMN supplier_id TEXT", []);
        }

        // Migration: Fix transaction_type check constraint by recreating the table if needed.
        // We check if we can insert an EXPENSE type dummy transaction (in a transaction that we rollback)
        // actually, simpler: Just check sql definition in sqlite_master
        let sql: String = conn.query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'", 
            [], 
            |row| row.get(0)
        ).unwrap_or_default();

        if !sql.contains("'EXPENSE'") || !sql.contains("'PURCHASE'") {
            // Need migration - add EXPENSE and/or PURCHASE types
            conn.execute_batch("
                BEGIN TRANSACTION;
                ALTER TABLE transactions RENAME TO transactions_old;

                CREATE TABLE transactions (
                    id TEXT PRIMARY KEY NOT NULL,
                    items TEXT NOT NULL,
                    total REAL NOT NULL,
                    payment_method TEXT DEFAULT 'Nakit',
                    transaction_type TEXT DEFAULT 'SALE' CHECK (transaction_type IN ('SALE', 'RETURN', 'EXPENSE', 'COLLECTION', 'PURCHASE')),
                    note TEXT,
                    created_at TEXT NOT NULL,
                    customer_id TEXT
                );

                INSERT INTO transactions (id, items, total, payment_method, transaction_type, note, created_at, customer_id)
                SELECT id, items, total, payment_method, transaction_type, note, created_at, customer_id
                FROM transactions_old;

                DROP TABLE transactions_old;

                CREATE INDEX idx_transactions_created_at ON transactions(created_at);
                CREATE INDEX idx_transactions_type ON transactions(transaction_type);

                COMMIT;
            ").map_err(|e| AppError::Internal(format!("Migration failed: {}", e)))?;
        }



        // Migration: Ensure customer_id column exists in transactions
        let has_customer_id: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('transactions') WHERE name='customer_id'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !has_customer_id {
            let _ = conn.execute("ALTER TABLE transactions ADD COLUMN customer_id TEXT", []);
        }

        // Migration: Ensure supplier_id column exists in stock_cards (for existing databases)
        let has_stock_supplier_id: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('stock_cards') WHERE name='supplier_id'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !has_stock_supplier_id {
            let _ = conn.execute("ALTER TABLE stock_cards ADD COLUMN supplier_id TEXT", []);
        }

        // Migration: Ensure must_change_password column exists in users
        let has_must_change_pwd: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='must_change_password'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !has_must_change_pwd {
            let _ = conn.execute("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0", []);
        }

        // Migration: Create inventory_lots table if it doesn't exist
        conn.execute(
            "CREATE TABLE IF NOT EXISTS inventory_lots (
                id TEXT PRIMARY KEY NOT NULL,
                product_id TEXT NOT NULL,
                supplier_id TEXT,
                quantity INTEGER NOT NULL,
                initial_quantity INTEGER NOT NULL,
                buy_price REAL NOT NULL,
                sell_price REAL,
                receipt_date TEXT NOT NULL,
                invoice_no TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (product_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
                FOREIGN KEY (supplier_id) REFERENCES current_accounts(id)
            )",
            [],
        ).map_err(|e| AppError::Internal(format!("Create inventory_lots failed: {}", e)))?;

        // Create indexes for inventory_lots if they don't exist
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_inventory_lots_product ON inventory_lots(product_id)", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_inventory_lots_created ON inventory_lots(created_at)", []);

        // Migration: Ensure brand column exists in inventory_items
        let has_brand: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('inventory_items') WHERE name='brand'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0) > 0;

        if !has_brand {
            let _ = conn.execute("ALTER TABLE inventory_items ADD COLUMN brand TEXT", []);
        }

        // Auto-seed: Veritabanı boşsa otomatik olarak ürünleri ekle
        let stock_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM stock_cards", [], |row| row.get(0))
            .unwrap_or(0);

        if stock_count == 0 {
            Self::auto_seed_data(conn)?;
        }

        Ok(())
    }

    fn auto_seed_data(conn: &Connection) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();

        // Önce "Eski Dükkan" tedarikçisini ekle
        conn.execute(
            "INSERT OR REPLACE INTO current_accounts (id, name, account_type, tax_number, phone, email, address, note, payment_term, balance, created_at, updated_at)
             VALUES ('cari-eski-dukkan', 'Eski Dükkan', 'SUPPLIER', '', '', '', '', 'Mevcut stok devri', 0, 0.0, ?1, ?1)",
            rusqlite::params![&now],
        )?;

        // Kategorileri ekle
        let categories = vec![
            ("cat-sihhi-tesisat", "SIHHİ TESİSAT"),
            ("cat-genel-temizlik", "GENEL TEMİZLİK"),
            ("cat-fayans-seramik", "FAYANS, SERAMİK"),
            ("cat-boya", "Boya"),
            ("cat-hirdavat", "HIRDAVAT"),
            ("cat-elektrik", "ELEKTRİK"),
            ("cat-pimapen", "PIMAPEN"),
            ("cat-marangoz", "MARANGOZ"),
            ("cat-genel", "GENEL"),
        ];

        for (cat_id, cat_name) in &categories {
            conn.execute(
                "INSERT OR REPLACE INTO categories (id, name, parent_id, created_at) VALUES (?1, ?2, NULL, ?3)",
                rusqlite::params![cat_id, cat_name, &now],
            )?;
        }

        // Ürün listesi: (barkod, isim, kategori, satış_fiyatı, stok)
        let products: Vec<(&str, &str, &str, f64, i32)> = vec![
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

        // Kategori adından ID'ye dönüştürme
        fn get_cat_id(cat: &str) -> &'static str {
            match cat {
                "SIHHİ TESİSAT" => "cat-sihhi-tesisat",
                "GENEL TEMİZLİK" => "cat-genel-temizlik",
                "FAYANS, SERAMİK" => "cat-fayans-seramik",
                "Boya" => "cat-boya",
                "HIRDAVAT" => "cat-hirdavat",
                "ELEKTRİK" => "cat-elektrik",
                "PIMAPEN" => "cat-pimapen",
                "MARANGOZ" => "cat-marangoz",
                _ => "cat-genel",
            }
        }

        let locations = ["Raf A-1", "Raf A-2", "Raf B-1", "Raf B-2", "Depo", "Vitrin"];

        for (i, (barcode, name, category, price, qty)) in products.iter().enumerate() {
            let item_id = format!("item-{:03}", i + 1);
            let sc_id = format!("sc-{:03}", i + 1);
            let lot_id = format!("lot-{:03}", i + 1);
            let cat_id = get_cat_id(category);
            let loc = locations[i % locations.len()];

            // 1. Stock Card ekle
            conn.execute(
                "INSERT OR REPLACE INTO stock_cards (id, barcode, name, brand, unit, category_id, description, image, supplier_id, created_at, updated_at)
                 VALUES (?1, ?2, ?3, NULL, 'ADET', ?4, ?5, NULL, 'cari-eski-dukkan', ?6, ?6)",
                rusqlite::params![sc_id, barcode, name, cat_id, name, &now],
            )?;

            // 2. Inventory Item ekle (maliyet 0 TL)
            conn.execute(
                "INSERT OR REPLACE INTO inventory_items (id, sku, name, category, quantity, location, price, cost_price, image, description, ai_tags, last_updated, currency, supplier_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0.0, NULL, ?8, NULL, ?9, 'TL', 'cari-eski-dukkan')",
                rusqlite::params![item_id, barcode, name, category, qty, loc, price, name, &now],
            )?;

            // 3. Inventory Lot ekle (Eski Dükkan'dan 0 TL'ye giriş)
            conn.execute(
                "INSERT OR REPLACE INTO inventory_lots (id, product_id, supplier_id, quantity, initial_quantity, buy_price, sell_price, receipt_date, invoice_no, created_at)
                 VALUES (?1, ?2, 'cari-eski-dukkan', ?3, ?3, 0.0, ?4, ?5, 'DEVIR', ?5)",
                rusqlite::params![lot_id, item_id, qty, price, &now],
            )?;
        }

        // Gider kategorileri ekle
        let expense_cats = ["Yakıt", "Yemek", "Kira", "Fatura", "Personel", "Genel Masraf", "Taksi", "Market", "Kırtasiye"];
        for cat in expense_cats {
            let cat_id = format!("exp-{}", cat.to_lowercase().replace(" ", "-").replace("ı", "i").replace("ş", "s").replace("ğ", "g").replace("ü", "u").replace("ö", "o").replace("ç", "c"));
            let _ = conn.execute(
                "INSERT OR IGNORE INTO expense_categories (id, name) VALUES (?1, ?2)",
                rusqlite::params![cat_id, cat],
            );
        }

        Ok(())
    }

    pub fn get_conn(&self) -> Result<DbConn, AppError> {
        self.pool
            .get()
            .map_err(|e| AppError::Internal(format!("Baglanti alinamadi: {}", e)))
    }
}

/// Initialize database and return pool - main entry point
pub fn init_database() -> Result<Database, AppError> {
    Database::new()
}
