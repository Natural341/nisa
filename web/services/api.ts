import axios, { AxiosInstance } from 'axios';
import { AuthResponse, DashboardStats, ActivityLog, Dealer, License, Backup } from '../types';

// Configuration - Development: localhost, Production: nisa.okilay.com
const getApiUrl = () => {
  // Development mode - localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }
  // Production mode
  // Production (Hostinger) - Dedicated API Domain
  return 'https://nisa.okilay.com/api';
};
const API_URL = getApiUrl();

// 1. Real Axios Instance Setup (Reference for Backend Integration)
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nexus_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nexus_token');
      localStorage.removeItem('nexus_user');
      window.location.hash = '/login';
    }
    return Promise.reject(error);
  }
);

// 2. MOCK SERVICE (For UI Demonstration without backend)
// In production, replace calls to `MockService` with `api.get/post` calls.

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock Data Store (Simple in-memory for demo consistency)
const mockDealers: Dealer[] = [
  { id: 1, name: 'TechSolutions Inc', email: 'contact@techsol.com', phone: '+1 555-0101', createdAt: '2023-01-15', status: 'active' },
  { id: 2, name: 'Alpha Systems', email: 'support@alphasys.net', phone: '+1 555-0102', createdAt: '2023-03-22', status: 'active' },
  { id: 3, name: 'Omega Retail', email: 'admin@omega.com', phone: '+1 555-0103', createdAt: '2023-06-10', status: 'inactive' },
];

// 2. REAL SERVICE (Connected to Backend)
export const MockService = { // Keeping name 'MockService' to avoid refactoring all components, but logic is REAL

  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { username, password });

    // Store user data on successful login
    if (response.data.success) {
      localStorage.setItem('nexus_token', response.data.token);
      localStorage.setItem('nexus_user', JSON.stringify(response.data.user));
    }

    return response.data;
  },

  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  getActivity: async (): Promise<ActivityLog[]> => {
    const response = await api.get('/dashboard/activity');
    return response.data;
  },

  getDealers: async (): Promise<Dealer[]> => {
    const response = await api.get('/dealers');
    return response.data;
  },

  getDealer: async (id: string | number): Promise<Dealer> => {
    const response = await api.get(`/dealers/${id}`);
    return response.data;
  },

  createDealer: async (dealerData: { name: string, email: string, phone: string }): Promise<Dealer> => {
    const response = await api.post('/dealers', dealerData);
    return response.data;
  },

  updateDealer: async (id: string | number, data: Partial<Dealer>): Promise<Dealer> => {
    const response = await api.put(`/dealers/${id}`, data);
    return response.data;
  },

  deleteDealer: async (id: string | number): Promise<void> => {
    await api.delete(`/dealers/${id}`);
  },

  getLicenses: async (dealerId?: string | number): Promise<License[]> => {
    const url = dealerId ? `/license?dealer_id=${dealerId}` : '/license';
    const response = await api.get(url);
    return response.data;
  },

  generateLicense: async (dealerId: string | number, expiryDate: string, maxDevices: number, price?: number): Promise<License> => {
    const response = await api.post('/license/generate', {
      dealer_id: dealerId,
      expiry_date: expiryDate || null,
      max_devices: maxDevices || 1,
      price: price || 0
    });

    // Return a constructed object since backend return might differ slightly or just be the key
    // We assume backend returns { success: true, key: ..., ... }
    return {
      id: Math.floor(Math.random() * 10000), // Frontend needs an ID
      key: response.data.key,
      dealerId: Number(dealerId),
      dealerName: '', // Will be refreshed on list
      macAddress: null,
      status: 'active',
      expiryDate,
      maxDevices
    };
  },

  extendLicense: async (licenseId: number, duration: string): Promise<void> => {
    await api.post('/license/extend', {
      license_id: licenseId,
      duration_type: duration,
    });
  },

  getBackups: async (): Promise<Backup[]> => {
    const response = await api.get('/sync/list');
    return response.data;
  },

  validateLicense: async (key: string, macAddress: string): Promise<{ valid: boolean; message?: string; dealer_name?: string; expires_at?: string }> => {
    try {
      const response = await api.post('/license/validate', { license_key: key, mac_address: macAddress });
      return response.data;
    } catch (error: any) {
      return { valid: false, message: error.response?.data?.message || 'Connection failed' };
    }
  },

  activateLicense: async (key: string, macAddress: string, deviceName: string): Promise<any> => {
    try {
      const response = await api.post('/license/activate', {
        license_key: key,
        mac_address: macAddress,
        device_name: deviceName
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { message: 'Activation failed' };
    }
  },

  // Lisans iptal et
  revokeLicense: async (licenseId: number): Promise<void> => {
    await api.post('/license/revoke', { license_id: licenseId });
  },

  // Lisansı tekrar aktif et
  reactivateLicense: async (licenseId: number): Promise<void> => {
    await api.post('/license/reactivate', { license_id: licenseId });
  },

  // Lisans sıfırla (MAC adresi temizle - yeni cihaza taşıma için)
  resetLicense: async (licenseId: number): Promise<void> => {
    await api.post('/license/reset', { license_id: licenseId });
  },

  // Lisansı kalıcı olarak sil
  deleteLicense: async (licenseId: number): Promise<void> => {
    await api.delete(`/license/${licenseId}`);
  }
};


export default api;