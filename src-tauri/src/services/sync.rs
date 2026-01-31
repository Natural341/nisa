use crate::error::AppError;
use crate::license::{get_device_mac_address, get_local_license};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use uuid::Uuid;

/// Transaction action types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    SALE,
    STOCK_IN,
    STOCK_OUT,
    PRICE_CHANGE,
    ITEM_CREATE,
    ITEM_UPDATE,
    ITEM_DELETE,
}

impl ToString for ActionType {
    fn to_string(&self) -> String {
        match self {
            ActionType::SALE => "SALE".to_string(),
            ActionType::STOCK_IN => "STOCK_IN".to_string(),
            ActionType::STOCK_OUT => "STOCK_OUT".to_string(),
            ActionType::PRICE_CHANGE => "PRICE_CHANGE".to_string(),
            ActionType::ITEM_CREATE => "ITEM_CREATE".to_string(),
            ActionType::ITEM_UPDATE => "ITEM_UPDATE".to_string(),
            ActionType::ITEM_DELETE => "ITEM_DELETE".to_string(),
        }
    }
}

/// Outbox transaction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncTransaction {
    pub id: String,
    pub action_type: String,
    pub item_sku: Option<String>,
    pub item_name: Option<String>,
    pub quantity_change: i32,
    pub old_value: Option<f64>,
    pub new_value: Option<f64>,
    pub metadata: Option<String>,
    pub transaction_time: String,
}

/// Push request to cloud
#[derive(Debug, Serialize)]
struct PushRequest {
    device_identifier: String,
    transactions: Vec<SyncTransaction>,
}

/// Push response from cloud
#[derive(Debug, Deserialize)]
struct PushResponse {
    success: bool,
    inserted: Option<i32>,
    skipped: Option<i32>,
    message: Option<String>,
    error: Option<String>,
}

/// Pull request from cloud
#[derive(Debug, Serialize)]
struct PullRequest {
    device_identifier: String,
    since: Option<String>,
}

/// Pull response from cloud
#[derive(Debug, Deserialize)]
struct PullResponse {
    success: bool,
    transactions: Option<Vec<RemoteTransaction>>,
    message: Option<String>,
    error: Option<String>,
}

/// Remote transaction from other devices
#[derive(Debug, Clone, Deserialize)]
pub struct RemoteTransaction {
    pub id: String,
    #[serde(rename = "deviceIdentifier")]
    pub device_identifier: String,
    #[serde(rename = "actionType")]
    pub action_type: String,
    #[serde(rename = "itemSku")]
    pub item_sku: Option<String>,
    #[serde(rename = "itemName")]
    pub item_name: Option<String>,
    #[serde(rename = "quantityChange")]
    pub quantity_change: i32,
    #[serde(rename = "oldValue")]
    pub old_value: Option<f64>,
    #[serde(rename = "newValue")]
    pub new_value: Option<f64>,
    pub metadata: Option<serde_json::Value>,
    #[serde(rename = "transactionTime")]
    pub transaction_time: String,
}

/// Heartbeat request
#[derive(Debug, Serialize)]
struct HeartbeatRequest {
    device_identifier: String,
    device_name: String,
    pending_count: i32,
}

/// Add a transaction to the sync outbox
pub fn queue_transaction(
    conn: &Connection,
    action_type: ActionType,
    item_sku: Option<&str>,
    item_name: Option<&str>,
    quantity_change: i32,
    old_value: Option<f64>,
    new_value: Option<f64>,
    metadata: Option<&str>,
) -> Result<String, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO sync_outbox (id, action_type, item_sku, item_name, quantity_change, old_value, new_value, metadata, transaction_time, synced, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?9)",
        params![
            &id,
            action_type.to_string(),
            item_sku,
            item_name,
            quantity_change,
            old_value,
            new_value,
            metadata,
            &now,
        ],
    )?;

    Ok(id)
}

/// Get pending transactions from outbox
pub fn get_pending_transactions(conn: &Connection, limit: i32) -> Result<Vec<SyncTransaction>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, action_type, item_sku, item_name, quantity_change, old_value, new_value, metadata, transaction_time
         FROM sync_outbox WHERE synced = 0 ORDER BY transaction_time ASC LIMIT ?1"
    )?;

    let transactions = stmt.query_map(params![limit], |row| {
        Ok(SyncTransaction {
            id: row.get(0)?,
            action_type: row.get(1)?,
            item_sku: row.get(2)?,
            item_name: row.get(3)?,
            quantity_change: row.get(4)?,
            old_value: row.get(5)?,
            new_value: row.get(6)?,
            metadata: row.get(7)?,
            transaction_time: row.get(8)?,
        })
    })?
    .filter_map(|r| r.ok())
    .collect();

    Ok(transactions)
}

/// Mark transactions as synced
pub fn mark_as_synced(conn: &Connection, ids: &[String]) -> Result<(), AppError> {
    for id in ids {
        conn.execute(
            "UPDATE sync_outbox SET synced = 1 WHERE id = ?1",
            params![id],
        )?;
    }
    Ok(())
}

/// Get pending transaction count
pub fn get_pending_count(conn: &Connection) -> Result<i32, AppError> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM sync_outbox WHERE synced = 0",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}

/// Push transactions to cloud
pub fn push_to_cloud(
    conn: &Connection,
    api_base_url: &str,
    dealer_id: &str,
    license_key: &str,
) -> Result<i32, AppError> {
    let device_id = get_device_mac_address()?;
    let transactions = get_pending_transactions(conn, 100)?;

    if transactions.is_empty() {
        return Ok(0);
    }

    let client = reqwest::blocking::Client::new();
    let url = format!("{}/api/sync/transactions/push", api_base_url);

    let request = PushRequest {
        device_identifier: device_id,
        transactions: transactions.clone(),
    };

    let response = client
        .post(&url)
        .header("X-Dealer-ID", dealer_id)
        .header("X-License-Key", license_key)
        .json(&request)
        .timeout(Duration::from_secs(30))
        .send()
        .map_err(|e| AppError::Internal(format!("Push istegi basarisiz: {}", e)))?;

    if response.status().is_success() {
        let result: PushResponse = response
            .json()
            .map_err(|e| AppError::Internal(format!("Push yaniti ayristirilamadi: {}", e)))?;

        if result.success {
            // Mark all pushed transactions as synced
            let ids: Vec<String> = transactions.iter().map(|t| t.id.clone()).collect();
            mark_as_synced(conn, &ids)?;

            // Update last push time
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT OR REPLACE INTO sync_state (id, last_push_at, last_pull_at, sync_in_progress)
                 VALUES (1, ?1, (SELECT last_pull_at FROM sync_state WHERE id = 1), 0)",
                params![&now],
            )?;

            Ok(result.inserted.unwrap_or(transactions.len() as i32))
        } else {
            Err(AppError::Internal(result.error.unwrap_or_else(|| "Push basarisiz".to_string())))
        }
    } else {
        Err(AppError::Internal(format!("Push HTTP hatasi: {}", response.status())))
    }
}

/// Pull transactions from cloud and apply them
pub fn pull_from_cloud(
    conn: &Connection,
    api_base_url: &str,
    dealer_id: &str,
    license_key: &str,
) -> Result<i32, AppError> {
    let device_id = get_device_mac_address()?;

    // Get last received timestamp
    let last_received: Option<String> = conn
        .query_row(
            "SELECT last_pull_at FROM sync_state WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .ok();

    let client = reqwest::blocking::Client::new();
    let url = format!("{}/api/sync/transactions/pull", api_base_url);

    let request = PullRequest {
        device_identifier: device_id.clone(),
        since: last_received,
    };

    let response = client
        .post(&url)
        .header("X-Dealer-ID", dealer_id)
        .header("X-License-Key", license_key)
        .json(&request)
        .timeout(Duration::from_secs(30))
        .send()
        .map_err(|e| AppError::Internal(format!("Pull istegi basarisiz: {}", e)))?;

    if response.status().is_success() {
        let result: PullResponse = response
            .json()
            .map_err(|e| AppError::Internal(format!("Pull yaniti ayristirilamadi: {}", e)))?;

        if result.success {
            let transactions = result.transactions.unwrap_or_default();
            let count = transactions.len() as i32;

            // Apply each transaction
            for txn in &transactions {
                apply_remote_transaction(conn, txn)?;
            }

            // Update last pull time
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "INSERT OR REPLACE INTO sync_state (id, last_push_at, last_pull_at, sync_in_progress)
                 VALUES (1, (SELECT last_push_at FROM sync_state WHERE id = 1), ?1, 0)",
                params![&now],
            )?;

            Ok(count)
        } else {
            Err(AppError::Internal(result.error.unwrap_or_else(|| "Pull basarisiz".to_string())))
        }
    } else {
        Err(AppError::Internal(format!("Pull HTTP hatasi: {}", response.status())))
    }
}

/// Apply a remote transaction to local database
fn apply_remote_transaction(conn: &Connection, txn: &RemoteTransaction) -> Result<(), AppError> {
    match txn.action_type.as_str() {
        "SALE" | "STOCK_OUT" => {
            // Decrease quantity
            if let Some(sku) = &txn.item_sku {
                conn.execute(
                    "UPDATE inventory_items SET quantity = MAX(0, quantity + ?1), last_updated = ?2 WHERE sku = ?3",
                    params![txn.quantity_change, &txn.transaction_time, sku],
                )?;
            }
        }
        "STOCK_IN" => {
            // Increase quantity
            if let Some(sku) = &txn.item_sku {
                conn.execute(
                    "UPDATE inventory_items SET quantity = quantity + ?1, last_updated = ?2 WHERE sku = ?3",
                    params![txn.quantity_change, &txn.transaction_time, sku],
                )?;
            }
        }
        "PRICE_CHANGE" => {
            // Update price
            if let (Some(sku), Some(new_price)) = (&txn.item_sku, txn.new_value) {
                conn.execute(
                    "UPDATE inventory_items SET price = ?1, last_updated = ?2 WHERE sku = ?3",
                    params![new_price, &txn.transaction_time, sku],
                )?;
            }
        }
        "ITEM_CREATE" => {
            // Create new item if not exists
            if let (Some(sku), Some(name)) = (&txn.item_sku, &txn.item_name) {
                let id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT OR IGNORE INTO inventory_items (id, sku, name, quantity, price, last_updated)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![&id, sku, name, txn.quantity_change, txn.new_value.unwrap_or(0.0), &txn.transaction_time],
                )?;
            }
        }
        "ITEM_UPDATE" => {
            // Update item
            if let (Some(sku), Some(name)) = (&txn.item_sku, &txn.item_name) {
                conn.execute(
                    "UPDATE inventory_items SET name = ?1, last_updated = ?2 WHERE sku = ?3",
                    params![name, &txn.transaction_time, sku],
                )?;
            }
        }
        "ITEM_DELETE" => {
            // Soft delete or mark as deleted
            if let Some(sku) = &txn.item_sku {
                conn.execute(
                    "DELETE FROM inventory_items WHERE sku = ?1",
                    params![sku],
                )?;
            }
        }
        _ => {}
    }

    Ok(())
}

/// Send heartbeat to cloud
pub fn send_heartbeat(
    conn: &Connection,
    api_base_url: &str,
    dealer_id: &str,
    license_key: &str,
) -> Result<(), AppError> {
    let device_id = get_device_mac_address()?;
    let device_name = crate::license::get_device_name();
    let pending = get_pending_count(conn)?;

    let client = reqwest::blocking::Client::new();
    let url = format!("{}/api/sync/devices/heartbeat", api_base_url);

    let request = HeartbeatRequest {
        device_identifier: device_id,
        device_name,
        pending_count: pending,
    };

    let _ = client
        .post(&url)
        .header("X-Dealer-ID", dealer_id)
        .header("X-License-Key", license_key)
        .json(&request)
        .timeout(Duration::from_secs(10))
        .send();

    Ok(())
}

/// Perform full sync cycle: push, pull, heartbeat
pub fn perform_sync(conn: &Connection) -> Result<(i32, i32), AppError> {
    // Get license info
    let license = get_local_license(conn)?
        .ok_or_else(|| AppError::Internal("Lisans bulunamadi".to_string()))?;

    let api_base_url = &license.api_base_url;
    let dealer_id = &license.dealer_id;
    let license_key = &license.license_key;

    // Push local changes
    let pushed = push_to_cloud(conn, api_base_url, dealer_id, license_key).unwrap_or(0);

    // Pull remote changes
    let pulled = pull_from_cloud(conn, api_base_url, dealer_id, license_key).unwrap_or(0);

    // Send heartbeat
    let _ = send_heartbeat(conn, api_base_url, dealer_id, license_key);

    Ok((pushed, pulled))
}

/// Background sync worker state
static SYNC_RUNNING: AtomicBool = AtomicBool::new(false);
static SYNC_STOP_FLAG: AtomicBool = AtomicBool::new(false);

/// Start background sync worker
pub fn start_background_sync(
    db_path: String,
    interval_seconds: u64,
) -> Result<(), AppError> {
    if SYNC_RUNNING.load(Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    SYNC_RUNNING.store(true, Ordering::SeqCst);
    SYNC_STOP_FLAG.store(false, Ordering::SeqCst);

    thread::spawn(move || {
        loop {
            // Check stop flag
            if SYNC_STOP_FLAG.load(Ordering::SeqCst) {
                break;
            }

            // Perform sync
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                let _ = perform_sync(&conn);
            }

            // Sleep for interval
            for _ in 0..(interval_seconds * 10) {
                if SYNC_STOP_FLAG.load(Ordering::SeqCst) {
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
        }

        SYNC_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(())
}

/// Stop background sync worker
pub fn stop_background_sync() {
    SYNC_STOP_FLAG.store(true, Ordering::SeqCst);
}

/// Check if sync is running
pub fn is_sync_running() -> bool {
    SYNC_RUNNING.load(Ordering::SeqCst)
}

/// Get sync status
pub fn get_sync_state(conn: &Connection) -> Result<SyncState, AppError> {
    let result = conn.query_row(
        "SELECT last_push_at, last_pull_at, sync_in_progress FROM sync_state WHERE id = 1",
        [],
        |row| {
            Ok(SyncState {
                last_push_at: row.get(0)?,
                last_pull_at: row.get(1)?,
                sync_in_progress: row.get::<_, i32>(2)? == 1,
                pending_count: 0,
            })
        },
    );

    let mut state = match result {
        Ok(s) => s,
        Err(_) => SyncState {
            last_push_at: None,
            last_pull_at: None,
            sync_in_progress: false,
            pending_count: 0,
        },
    };

    state.pending_count = get_pending_count(conn).unwrap_or(0);
    Ok(state)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub last_push_at: Option<String>,
    pub last_pull_at: Option<String>,
    pub sync_in_progress: bool,
    pub pending_count: i32,
}
