export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  POS = 'POS',
  SETTINGS = 'SETTINGS',
  TRANSACTIONS = 'TRANSACTIONS',
  DATABASE = 'DATABASE',
  CREDIT = 'CREDIT',
  USERS = 'USERS'
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
  costPrice?: number; // New field
  image?: string;
  lastUpdated: string;
  description?: string;
  aiTags?: string[];
  currency?: string;
}

export interface CartItem extends InventoryItem {
  cartId: string;
  cartQuantity: number;
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