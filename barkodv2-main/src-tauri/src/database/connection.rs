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
                currency TEXT DEFAULT 'TL'
            );

            -- Transactions Table
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY NOT NULL,
                items TEXT NOT NULL,
                total REAL NOT NULL,
                payment_method TEXT DEFAULT 'Nakit',
                transaction_type TEXT DEFAULT 'SALE' CHECK (transaction_type IN ('SALE', 'RETURN')),
                note TEXT,
                created_at TEXT NOT NULL
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
                dealer_id TEXT
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

            -- Performance Indexes
            CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);
            CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
            CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory_items(quantity);
            CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
            CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
            CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            ",
        )?;
        Ok(())
    }

    pub fn get_conn(&self) -> Result<DbConn, AppError> {
        self.pool
            .get()
            .map_err(|e| AppError::Internal(format!("Baglanti alinamadi: {}", e)))
    }

    pub fn get_db_path_string(&self) -> String {
        self.db_path.to_string_lossy().to_string()
    }
}

/// Initialize database and return pool - main entry point
pub fn init_database() -> Result<Database, AppError> {
    Database::new()
}
