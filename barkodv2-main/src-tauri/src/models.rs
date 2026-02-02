use serde::{Deserialize, Serialize};

/// Inventory item model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub sku: String,
    pub name: String,
    pub category: String,
    pub quantity: i32,
    pub location: String,
    pub price: f64,
    #[serde(rename = "costPrice")]
    pub cost_price: Option<f64>,
    pub image: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "aiTags")]
    pub ai_tags: Option<Vec<String>>,
    #[serde(rename = "lastUpdated")]
    pub last_updated: String,
    pub currency: Option<String>,
}

/// Cart item for processing sales
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CartItem {
    pub id: String,
    pub sku: String,
    pub name: String,
    #[serde(rename = "cartQuantity")]
    pub cart_quantity: i32,
    pub price: f64,
}

/// Transaction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub items: Vec<CartItem>,
    pub total: f64,
    #[serde(rename = "paymentMethod")]
    pub payment_method: String, // 'CASH', 'CARD', 'CREDIT'
    #[serde(rename = "transactionType")]
    pub transaction_type: String, // 'SALE', 'RETURN'
    pub status: String,
    pub note: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

/// Dashboard statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStats {
    #[serde(rename = "totalItems")]
    pub total_items: i32,
    #[serde(rename = "totalQuantity")]
    pub total_quantity: i32,
    #[serde(rename = "lowStockCount")]
    pub low_stock_count: i32,
    #[serde(rename = "totalRevenue")]
    pub total_revenue: f64,
}

/// Sales data point for charts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesDataPoint {
    pub date: String,
    pub total: f64,
    pub count: i32,
}

/// Category statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryStats {
    pub category: String,
    pub count: i32,
    #[serde(rename = "totalQuantity")]
    pub total_quantity: i32,
    #[serde(rename = "totalValue")]
    pub total_value: f64,
}

/// Activity log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityLog {
    pub id: i64,
    #[serde(rename = "actionType")]
    pub action_type: String,
    pub description: String,
    #[serde(rename = "itemId")]
    pub item_id: Option<String>,
    #[serde(rename = "itemName")]
    pub item_name: Option<String>,
    #[serde(rename = "quantityChange")]
    pub quantity_change: Option<i32>,
    pub value: Option<f64>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

/// User model for authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub role: String, // "admin" or "user"
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "lastLogin")]
    pub last_login: Option<String>,
    #[serde(rename = "mustChangePassword", default)]
    pub must_change_password: bool,
}

/// Create user request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub role: String,
}

/// Update user request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserRequest {
    pub username: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub role: Option<String>,
}

// ==================== LICENSE MODELS ====================

/// License information stored locally
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct License {
    #[serde(rename = "licenseKey")]
    pub license_key: String,
    #[serde(rename = "dealerId")]
    pub dealer_id: String,
    #[serde(rename = "dealerName")]
    pub dealer_name: String,
    #[serde(rename = "macAddress")]
    pub mac_address: String,
    #[serde(rename = "activatedAt")]
    pub activated_at: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "lastValidated")]
    pub last_validated: Option<String>,
    #[serde(rename = "apiBaseUrl")]
    pub api_base_url: String,
}

/// License validation request to API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseValidateRequest {
    #[serde(rename = "license_key")]
    pub license_key: String,
    #[serde(rename = "mac_address")]
    pub mac_address: String,
}

/// License validation response from API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseValidateResponse {
    pub valid: bool,
    #[serde(rename = "dealer_id")]
    pub dealer_id: Option<String>,
    #[serde(rename = "dealer_name")]
    pub dealer_name: Option<String>,
    #[serde(rename = "expires_at")]
    pub expires_at: Option<String>,
    pub error: Option<String>,
    pub message: Option<String>,
}

/// License activation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseActivateRequest {
    #[serde(rename = "license_key")]
    pub license_key: String,
    #[serde(rename = "mac_address")]
    pub mac_address: String,
    #[serde(rename = "device_name")]
    pub device_name: Option<String>,
}

/// License activation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseActivateResponse {
    pub success: bool,
    #[serde(rename = "dealer_id")]
    pub dealer_id: Option<String>,
    #[serde(rename = "dealer_name")]
    pub dealer_name: Option<String>,
    #[serde(rename = "activated_at")]
    pub activated_at: Option<String>,
    #[serde(rename = "expires_at")]
    pub expires_at: Option<String>,
    pub error: Option<String>,
    pub message: Option<String>,
}

// ==================== CLOUD SYNC MODELS ====================

/// Cloud sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    #[serde(rename = "lastBackupAt")]
    pub last_backup_at: Option<String>,
    #[serde(rename = "lastRestoreAt")]
    pub last_restore_at: Option<String>,
    #[serde(rename = "autoSyncEnabled")]
    pub auto_sync_enabled: bool,
    #[serde(rename = "autoSyncIntervalMinutes")]
    pub auto_sync_interval_minutes: i32,
}

/// Cloud backup response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudBackupResponse {
    pub success: bool,
    #[serde(rename = "backupId")]
    pub backup_id: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: Option<i64>,
    pub message: Option<String>,
    pub error: Option<String>,
}

/// Cloud status response from API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudStatusResponse {
    #[serde(rename = "has_backup")]
    pub has_backup: bool,
    #[serde(rename = "last_backup_at")]
    pub last_backup_at: Option<String>,
    #[serde(rename = "backup_size_bytes")]
    pub backup_size_bytes: Option<i64>,
    #[serde(rename = "backup_count")]
    pub backup_count: Option<i32>,
}

// ==================== PAGINATION MODELS ====================

/// Pagination parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: i32,
    #[serde(rename = "perPage")]
    pub per_page: i32,
    pub search: Option<String>,
    pub category: Option<String>,
}

/// Paginated response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i32,
    pub page: i32,
    #[serde(rename = "perPage")]
    pub per_page: i32,
    #[serde(rename = "totalPages")]
    pub total_pages: i32,
}

/// Paginated items response (concrete type for Tauri command)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedItemsResponse {
    pub data: Vec<InventoryItem>,
    pub total: i32,
    pub page: i32,
    #[serde(rename = "perPage")]
    pub per_page: i32,
    #[serde(rename = "totalPages")]
    pub total_pages: i32,
}

/// Paginated transactions response (concrete type for Tauri command)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedTransactionsResponse {
    pub data: Vec<Transaction>,
    pub total: i32,
    pub page: i32,
    #[serde(rename = "perPage")]
    pub per_page: i32,
    #[serde(rename = "totalPages")]
    pub total_pages: i32,
}
