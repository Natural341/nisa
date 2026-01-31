export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'editor';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Dealer {
  id: number;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  status: 'active' | 'inactive';
  latest_expiration?: string;
}

export interface License {
  id: number;
  key: string;
  dealerId: number;
  dealerName: string;
  macAddress: string | null;
  status: 'active' | 'expired' | 'revoked';
  expiryDate: string;
  maxDevices: number;
  price?: number;
}

export interface Backup {
  id: number;
  dealerId: string;
  dealerName: string;
  fileSize: string;
  uploadedAt: string;
  fileName: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  description: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface DashboardStats {
  totalDealers: number;
  activeLicenses: number;
  recentBackups: number;
  totalRevenue: number;
  chartData?: { name: string; value: number }[];
  pieData?: { name: string; value: number }[];
}