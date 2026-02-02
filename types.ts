export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  POS = 'POS',
  SETTINGS = 'SETTINGS',
  TRANSACTIONS = 'TRANSACTIONS',
  DATABASE = 'DATABASE',
  CREDIT = 'CREDIT',
  USERS = 'USERS',
  CREATE_CURRENT_ACCOUNT = 'CREATE_CURRENT_ACCOUNT',
  CREATE_STOCK_CARD = 'CREATE_STOCK_CARD',
  CREATE_PRODUCT_GROUP = 'CREATE_PRODUCT_GROUP',
  GOODS_RECEIPT = 'GOODS_RECEIPT',
  BULK_PRICE_UPDATE = 'BULK_PRICE_UPDATE',
  PRODUCT_HISTORY = 'PRODUCT_HISTORY',
  SALES_CASH = 'SALES_CASH',
  SALES_CREDIT = 'SALES_CREDIT',
  SALES_MAIL_ORDER = 'SALES_MAIL_ORDER',
  REFUND_CASH = 'REFUND_CASH',
  REFUND_CREDIT = 'REFUND_CREDIT',
  FINANCE_DAILY = 'FINANCE_DAILY',
  FINANCE_EXPENSES = 'FINANCE_EXPENSES',
  FINANCE_STATEMENTS = 'FINANCE_STATEMENTS',
  GOODS_RECEIPT_HISTORY = 'GOODS_RECEIPT_HISTORY'
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
  mustChangePassword?: boolean;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  location: string;
  price: number;
  costPrice?: number;
  image?: string;
  lastUpdated: string;
  description?: string;
  aiTags?: string[];
  unit?: string; // Physical unit: Adet, Kg, Litre, Gram, Metre, Paket, Kutu, Koli
  supplierId?: string; // Link to current account (Cari)
  brand?: string; // Product brand
  currency?: string;
}

export interface CartItem extends InventoryItem {
  cartId: string;
  cartQuantity: number;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string | null; // Rust Option<String> -> string | null
  createdAt: string;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  transactionType: string; // 'SALE' | 'RETURN'
  status: string;
  note?: string;
  createdAt: string;
  customerId?: string;
}

export interface DashboardStats {
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  totalRevenue: number;
}

// ==================== LICENSE TYPES ====================

export interface License {
  licenseKey: string;
  dealerId: string;
  dealerName: string;
  macAddress: string;
  activatedAt: string;
  expiresAt?: string;
  isActive: boolean;
  lastValidated?: string;
  apiBaseUrl: string;
}

export interface LicenseValidateResponse {
  valid: boolean;
  dealer_id?: string;
  dealer_name?: string;
  expires_at?: string;
  error?: string;
  message?: string;
}

export interface LicenseActivateResponse {
  success: boolean;
  dealer_id?: string;
  dealer_name?: string;
  activated_at?: string;
  expires_at?: string;
  error?: string;
  message?: string;
}

// ==================== CLOUD SYNC TYPES ====================

export interface SyncStatus {
  lastBackupAt?: string;
  lastRestoreAt?: string;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
}

export interface CloudBackupResponse {
  success: boolean;
  backupId?: string;
  timestamp?: string;
  sizeBytes?: number;
  message?: string;
  error?: string;
}

export interface CloudStatusResponse {
  has_backup: boolean;
  last_backup_at?: string;
  backup_size_bytes?: number;
  backup_count?: number;
}

// ==================== PAGINATION TYPES ====================

export interface PaginationParams {
  page: number;
  perPage: number;
  search?: string;
  category?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export type PaginatedItemsResponse = PaginatedResponse<InventoryItem>;
export type PaginatedTransactionsResponse = PaginatedResponse<Transaction>;

// ==================== FINANCE TYPES ====================

export interface FinanceRecord {
  id: number;
  recordType: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  paymentMethod: string;
  description: string;
  date: string;
  createdAt: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  cashBalance: number;
  cardBalance: number;
  bankBalance: number;
}

export interface AccessCode {
  id: number;
  code: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface GoodsReceiptItem {
  product_id: string;
  quantity: number;
  buy_price: number;
}