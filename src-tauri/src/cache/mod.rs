#![allow(dead_code)]

use lru::LruCache;
use std::num::NonZeroUsize;
use std::time::{Duration, Instant};

use crate::models::{CategoryStats, DashboardStats, InventoryItem};

/// Cache entry with TTL (Time To Live)
struct CacheEntry<T> {
    value: T,
    expires_at: Instant,
}

impl<T: Clone> CacheEntry<T> {
    fn new(value: T, ttl: Duration) -> Self {
        Self {
            value,
            expires_at: Instant::now() + ttl,
        }
    }

    fn is_expired(&self) -> bool {
        Instant::now() > self.expires_at
    }
}

/// Application-level cache with LRU eviction and TTL
pub struct AppCache {
    // Cache for individual items by SKU (5 min TTL, 500 items max)
    items_by_sku: LruCache<String, CacheEntry<InventoryItem>>,

    // Cache for all items list (1 min TTL)
    all_items: Option<CacheEntry<Vec<InventoryItem>>>,

    // Cache for dashboard stats (1 min TTL)
    dashboard_stats: Option<CacheEntry<DashboardStats>>,

    // Cache for category stats (1 min TTL)
    category_stats: Option<CacheEntry<Vec<CategoryStats>>>,
}

impl AppCache {
    pub fn new() -> Self {
        Self {
            items_by_sku: LruCache::new(NonZeroUsize::new(500).unwrap()),
            all_items: None,
            dashboard_stats: None,
            category_stats: None,
        }
    }

    // ==================== Item Cache ====================

    pub fn get_item(&mut self, sku: &str) -> Option<InventoryItem> {
        if let Some(entry) = self.items_by_sku.get(sku) {
            if !entry.is_expired() {
                return Some(entry.value.clone());
            }
            // Entry expired, remove it
        }
        self.items_by_sku.pop(sku);
        None
    }

    pub fn set_item(&mut self, sku: String, item: InventoryItem) {
        let entry = CacheEntry::new(item, Duration::from_secs(300)); // 5 min TTL
        self.items_by_sku.put(sku, entry);
    }

    pub fn invalidate_item(&mut self, sku: &str) {
        self.items_by_sku.pop(sku);
        // Also invalidate aggregate caches since item data changed
        self.all_items = None;
        self.dashboard_stats = None;
        self.category_stats = None;
    }

    // ==================== All Items Cache ====================

    pub fn get_all_items(&self) -> Option<Vec<InventoryItem>> {
        self.all_items
            .as_ref()
            .filter(|e| !e.is_expired())
            .map(|e| e.value.clone())
    }

    pub fn set_all_items(&mut self, items: Vec<InventoryItem>) {
        self.all_items = Some(CacheEntry::new(items, Duration::from_secs(60))); // 1 min TTL
    }

    // ==================== Dashboard Stats Cache ====================

    pub fn get_dashboard_stats(&self) -> Option<DashboardStats> {
        self.dashboard_stats
            .as_ref()
            .filter(|e| !e.is_expired())
            .map(|e| e.value.clone())
    }

    pub fn set_dashboard_stats(&mut self, stats: DashboardStats) {
        self.dashboard_stats = Some(CacheEntry::new(stats, Duration::from_secs(60))); // 1 min TTL
    }

    // ==================== Category Stats Cache ====================

    pub fn get_category_stats(&self) -> Option<Vec<CategoryStats>> {
        self.category_stats
            .as_ref()
            .filter(|e| !e.is_expired())
            .map(|e| e.value.clone())
    }

    pub fn set_category_stats(&mut self, stats: Vec<CategoryStats>) {
        self.category_stats = Some(CacheEntry::new(stats, Duration::from_secs(60))); // 1 min TTL
    }

    // ==================== Bulk Operations ====================

    /// Invalidate all caches (after bulk operations like import/seed)
    pub fn invalidate_all(&mut self) {
        self.items_by_sku.clear();
        self.all_items = None;
        self.dashboard_stats = None;
        self.category_stats = None;
    }

    /// Invalidate only aggregate caches (after transaction)
    pub fn invalidate_aggregates(&mut self) {
        self.all_items = None;
        self.dashboard_stats = None;
        self.category_stats = None;
    }
}

impl Default for AppCache {
    fn default() -> Self {
        Self::new()
    }
}
