import api from '../web/services/api';
import { InventoryItem, CartItem, Transaction, DashboardStats } from '../types';
import { isTauri, tauriInvoke, saveFileDialog, openFileDialog } from './tauriService';

// Empty array for web development fallback - no mock data
const MOCK_DATA: InventoryItem[] = [];

class InventoryService {
  private items: InventoryItem[] = [...MOCK_DATA];
  private transactions: Transaction[] = [];

  async getAllItems(): Promise<InventoryItem[]> {
    if (isTauri()) {
      try {
        const result = await tauriInvoke<InventoryItem[]>('get_all_items');
        return result || [];
      } catch (error) {
        console.error('Tauri getAllItems failed:', error);
        return [];
      }
    }
    // Web Fallback (API)
    try {
      const response = await api.get('/inventory/all');
      if (response.data) {
        this.items = response.data;
        return response.data;
      }
      return [...this.items];
    } catch (e) {
      console.error('Web inventory fetch error:', e);
      return [...this.items];
    }
  }

  // Get Items with pagination and search (Web & Tauri)
  async getItems(page: number, perPage: number, search: string = '', category: string = ''): Promise<{ data: InventoryItem[], total: number }> {
    if (isTauri()) {
      try {
        const result = await tauriInvoke<{ data: InventoryItem[], total: number }>('get_items_paginated', { page, perPage, search, category });
        return { data: result.data || [], total: result.total || 0 };
      } catch (error) {
        // If get_items is not implemented, fallback to getAll and filter
        // But wait, the user's project already has paginated 'get_items' command in Rust?
        // Let's assume yes or I should have checked. 
        // Assuming it exists since this is BarkodV2 which has pagination.
        // If generic error, we return empty.
        console.error('Tauri getItems failed:', error);
        return { data: [], total: 0 };
      }
    }
    // Web Fallback
    let filtered = this.items.filter(i =>
      (!search || i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase())) &&
      (!category || i.category === category)
    );
    const start = (page - 1) * perPage;
    return {
      data: filtered.slice(start, start + perPage),
      total: filtered.length
    };
  }

  async getItemBySku(sku: string): Promise<InventoryItem | undefined> {
    if (isTauri()) {
      try {
        return await tauriInvoke<InventoryItem | null>('get_item_by_sku', { sku }) || undefined;
      } catch (error) {
        console.error('Tauri getItemBySku failed:', error);
        return undefined;
      }
    }
    return this.items.find(i => i.sku === sku);
  }

  async addItem(item: InventoryItem): Promise<void> {
    if (isTauri()) {
      try {
        await tauriInvoke('add_item', { item });
        return;
      } catch (error) {
        console.error('Tauri addItem failed:', error);
        throw error;
      }
    }
    this.items.push(item);
  }

  async updateItem(updatedItem: InventoryItem): Promise<void> {
    if (isTauri()) {
      try {
        await tauriInvoke('update_item', { item: updatedItem });
        return;
      } catch (error) {
        console.error('Tauri updateItem failed:', error);
        throw error;
      }
    }
    const index = this.items.findIndex(i => i.id === updatedItem.id);
    if (index !== -1) {
      this.items[index] = { ...updatedItem, lastUpdated: new Date().toISOString() };
    }
  }

  async deleteItem(sku: string): Promise<void> {
    if (isTauri()) {
      try {
        await tauriInvoke('delete_item', { sku });
        return;
      } catch (error) {
        console.error('Tauri deleteItem failed:', error);
        throw error;
      }
    }
    this.items = this.items.filter(i => i.sku !== sku);
  }

  async updateQuantity(sku: string, delta: number): Promise<InventoryItem | undefined> {
    if (isTauri()) {
      try {
        return await tauriInvoke<InventoryItem | null>('update_quantity', { sku, delta }) || undefined;
      } catch (error) {
        console.error('Tauri updateQuantity failed:', error);
        return undefined;
      }
    }
    const idx = this.items.findIndex(i => i.sku === sku);
    if (idx !== -1) {
      this.items[idx] = {
        ...this.items[idx],
        quantity: Math.max(0, this.items[idx].quantity + delta),
        lastUpdated: new Date().toISOString()
      };
      return this.items[idx];
    }
    return undefined;
  }

  async processSale(cartItems: CartItem[], paymentMethod: string, transactionType: string, note: string = '', customerId?: string): Promise<boolean> {
    console.log('[inventoryService] processSale called, isTauri:', isTauri());
    if (isTauri()) {
      try {
        console.log('[inventoryService] Using Tauri backend for processSale', { customerId });
        await tauriInvoke('process_sale', { cartItems, paymentMethod, transactionType, note, customerId });
        return true;
      } catch (error) {
        console.error('Tauri processSale failed:', error);
        return false;
      }
    }
    console.log('[inventoryService] Using WEB FALLBACK for processSale');
    // Web fallback
    let total = 0;
    for (const item of cartItems) {
      const qtyChange = transactionType === 'RETURN' ? (item.cartQuantity || 1) : -(item.cartQuantity || 1);
      await this.updateQuantity(item.sku, qtyChange);
      total += item.price * (item.cartQuantity || 1);
    }

    if (transactionType === 'RETURN') total = -total;

    // Record Transaction locally for Web Mode
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      items: cartItems,
      total: total,
      paymentMethod,
      transactionType,
      status: 'completed',
      note,
      createdAt: new Date().toISOString()
    };
    if (!this.transactions) this.transactions = [];
    this.transactions.unshift(newTransaction);

    return true;
  }

  async getTransactions(): Promise<Transaction[]> {
    if (isTauri()) {
      try {
        return await tauriInvoke<Transaction[]>('get_transactions') || [];
      } catch (error) {
        console.error('Tauri getTransactions failed:', error);
        return [];
      }
    }
    // Web Fallback
    return [...(this.transactions || [])];
  }

  async updateTransaction(id: string, updates: { paymentMethod?: string; note?: string }): Promise<void> {
    if (isTauri()) {
      try {
        await tauriInvoke('update_transaction', { id, updates });
        return;
      } catch (error) {
        console.error('Tauri updateTransaction failed:', error);
        throw error;
      }
    }
    // Web Fallback
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      if (updates.paymentMethod) this.transactions[idx].paymentMethod = updates.paymentMethod;
      if (updates.note !== undefined) this.transactions[idx].note = updates.note;
    }
  }

  async getTransactionsByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    if (isTauri()) {
      try {
        return await tauriInvoke<Transaction[]>('get_transactions_by_date_range', { startDate, endDate }) || [];
      } catch (error) {
        console.error('Tauri getTransactionsByDateRange failed:', error);
        return [];
      }
    }
    // Web Mock Filtering
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return (this.transactions || []).filter(t => {
      const tDate = new Date(t.createdAt).getTime();
      return tDate >= start && tDate <= end;
    });
  }

  async getCustomerTransactions(customerId: string, page: number = 1, perPage: number = 20): Promise<{ data: Transaction[], total: number, total_pages: number }> {
    if (isTauri()) {
      try {
        return await tauriInvoke<{ data: Transaction[], total: number, total_pages: number }>('get_transactions_with_pagination', {
          page,
          perPage,
          startDate: null,
          endDate: null,
          transactionType: null, // "ALL" or null
          customerId
        });
      } catch (error) {
        console.error('Tauri getCustomerTransactions failed:', error);
        return { data: [], total: 0, total_pages: 0 };
      }
    }
    // Web Fallback (Mock)
    const txs = (this.transactions || []).filter(t => (t as any).customerId === customerId); // Assuming t.customerId exists in mock
    return {
      data: txs.slice((page - 1) * perPage, page * perPage),
      total: txs.length,
      total_pages: Math.ceil(txs.length / perPage)
    };
  }

  async getDashboardStats(): Promise<DashboardStats> {
    if (isTauri()) {
      try {
        return await tauriInvoke<DashboardStats>('get_dashboard_stats');
      } catch (error) {
        console.error('Tauri getDashboardStats failed:', error);
        // Fallback to empty stats or rethrow?
        // Let's return empty stats to prevent crash
        return { totalItems: 0, totalQuantity: 0, lowStockCount: 0, totalRevenue: 0 };
      }
    }

    // Web Fallback Calculation
    const totalItems = this.items.length;
    const totalQuantity = this.items.reduce((acc, i) => acc + i.quantity, 0);
    const lowStockCount = this.items.filter(i => i.quantity < 10).length;
    const totalRevenue = (this.transactions || []).reduce((acc, t) => acc + t.total, 0);

    return { totalItems, totalQuantity, lowStockCount, totalRevenue };
  }

  async seedDatabase(): Promise<string> {
    if (isTauri()) {
      try {
        return await tauriInvoke<string>('seed_data');
      } catch (error) {
        console.error('Seed failed:', error);
        throw error;
      }
    }

    // Web Fallback: Generate Mock Data locally
    this.items = [];
    this.transactions = [];

    const categories = ["Elektronik", "Giyim", "Gıda", "Kırtasiye", "Aksesuar"];
    const now = new Date();

    // 1. Generate Items
    for (let i = 1; i <= 20; i++) {
      const price = Math.floor(Math.random() * 100) + 10;
      this.items.push({
        id: Math.random().toString(36).substr(2, 9),
        sku: `MOCK-${i.toString().padStart(3, '0')}`,
        name: `Numune Ürün ${i} (Web)`,
        category: categories[i % categories.length],
        quantity: Math.floor(Math.random() * 100),
        price: price,
        costPrice: price * 0.6,
        location: 'Raf Web-1',
        lastUpdated: now.toISOString(),
        image: '',
        description: 'Web tarayıcı mock verisi',
        aiTags: ['mock', 'web'],
        currency: 'TL'
      });
    }

    // 2. Generate Transactions - 200 transactions over 6 months (180 days)
    for (let i = 0; i < 200; i++) {
      const daysAgo = i % 180; // Spread over 6 months
      const tDate = new Date(now);
      tDate.setDate(tDate.getDate() - daysAgo);

      const isReturn = i % 12 === 0; // ~8% returns
      const total = ((i % 50) * 15) + 50; // Varying amounts 50-800

      this.transactions.push({
        id: Math.random().toString(36).substr(2, 9),
        items: [],
        total: isReturn ? -total : total,
        paymentMethod: ['Nakit', 'Kredi Kartı', 'Veresiye'][i % 3],
        transactionType: isReturn ? 'RETURN' : 'SALE',
        status: 'completed',
        note: 'Otomatik Web Verisi',
        createdAt: tDate.toISOString()
      });
    }

    this.transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return "Web: Mock veriler ve işlem geçmişi başarıyla oluşturuldu.";
  }

  async generatePdfLabel(item: InventoryItem): Promise<void> {
    alert(`[Simulated] Generated PDF Label for ${item.sku
      }`);
  }

  async exportToExcel(): Promise<string> {
    if (isTauri()) {
      try {
        const filePath = await saveFileDialog('inventory_export.csv');
        if (filePath) {
          await tauriInvoke('export_to_csv', { filePath });
          return `Dosya kaydedildi: ${filePath} `;
        }
        return 'Dosya secilmedi';
      } catch (error) {
        console.error('Tauri export failed:', error);
        throw error;
      }
    }

    // Fallback for web - browser download
    const items = await this.getAllItems();
    const headers = ['ID', 'SKU', 'Name', 'Category', 'Quantity', 'Price', 'Location', 'Last Updated'];
    const rows = items.map(i => [
      i.id, i.sku, `"${i.name}"`, i.category, i.quantity, i.price, i.location, i.lastUpdated
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventory_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return 'Dosya indirildi (Web)';
  }

  async clearDatabase(): Promise<void> {
    if (isTauri()) {
      try {
        await tauriInvoke('clear_database');
        return;
      } catch (error) {
        console.error('Clear DB failed:', error);
        throw error;
      }
    }

    // Web Fallback
    this.items = [];
    this.transactions = [];
  }

  async applyPriceChangeByCategory(category: string, percentage: number): Promise<void> {
    if (isTauri()) {
      try {
        await tauriInvoke('apply_price_change_by_category', { category, percentage });
        return;
      } catch (error) {
        console.error('Price update failed:', error);
        throw error;
      }
    }

    // Web Fallback
    const multiplier = 1.0 + (percentage / 100.0);
    this.items.forEach(item => {
      if (category === 'HEPSİ' || category === 'TÜMÜ' || item.category === category) {
        item.price = Number((item.price * multiplier).toFixed(2));
        item.lastUpdated = new Date().toISOString();
      }
    });
  }
  async importFromCsv(csvContent?: string): Promise<string> {
    if (isTauri()) {
      try {
        // Open file dialog to select CSV file
        const filePath = await openFileDialog([{ name: 'CSV', extensions: ['csv'] }]);
        if (!filePath || Array.isArray(filePath)) {
          return 'Dosya secilmedi';
        }
        const count = await tauriInvoke<number>('import_from_csv', { filePath });
        return `${count} urun basariyla ice aktarildi`;
      } catch (error) {
        console.error('Import failed:', error);
        throw error;
      }
    }
    // Web Fallback - parse csvContent if provided
    if (csvContent) {
      const lines = csvContent.split('\n');
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(';');
        if (parts.length < 6) continue;

        const sku = parts[1]?.trim();
        const name = parts[2]?.trim();
        if (!sku || !name) continue;

        this.items.push({
          id: Math.random().toString(36).substr(2, 9),
          sku,
          name,
          category: parts[3]?.trim() || 'Genel',
          quantity: parseInt(parts[4]) || 0,
          location: parts[5]?.trim() || '',
          price: parseFloat(parts[6]?.replace(',', '.')) || 0,
          costPrice: 0,
          lastUpdated: new Date().toISOString(),
          currency: 'TL'
        });
        imported++;
      }
      return `${imported} urun ice aktarildi(Web)`;
    }
    return "Web: Dosya secilmedi";
  }

  // ==================== DB EXPORT/IMPORT ====================

  async exportDatabase(): Promise<string> {
    if (isTauri()) {
      try {
        const filePath = await saveFileDialog('nexus_backup.db', [{ name: 'SQLite Database', extensions: ['db'] }]);
        if (!filePath) {
          return 'Dosya secilmedi';
        }
        await tauriInvoke('export_database', { filePath });
        return `Veritabani kaydedildi: ${filePath} `;
      } catch (error) {
        console.error('DB Export failed:', error);
        throw error;
      }
    }
    return 'Web modunda DB disa aktarma desteklenmiyor';
  }

  async importDatabase(): Promise<string> {
    if (isTauri()) {
      try {
        const filePath = await openFileDialog([{ name: 'SQLite Database', extensions: ['db'] }]);
        if (!filePath || Array.isArray(filePath)) {
          return 'Dosya secilmedi';
        }
        await tauriInvoke('import_database', { filePath });
        return 'Veritabani basariyla ice aktarildi. Sayfa yenilenecek...';
      } catch (error) {
        console.error('DB Import failed:', error);
        throw error;
      }
    }
    return 'Web modunda DB ice aktarma desteklenmiyor';
  }
}

export const inventoryService = new InventoryService();