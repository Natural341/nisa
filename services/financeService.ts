import { invoke } from '@tauri-apps/api/core';
import { FinanceRecord, FinanceSummary } from '../types';

export const financeService = {
    // Add new finance record
    addRecord: async (record: Omit<FinanceRecord, 'id' | 'createdAt'>): Promise<void> => {
        try {
            // Backend expects the full struct, so we fill in dummy values for id and createdAt
            // They will be ignored/overwritten by DB/logic as needed, but 'created_at' is actually passed
            // Let's generate createdAt here for consistency if backend uses it directly
            const fullRecord = {
                ...record,
                id: 0,
                createdAt: new Date().toISOString()
            };

            await invoke('add_finance_record', { record: fullRecord });
        } catch (error) {
            console.error('Error adding finance record:', error);
            throw error;
        }
    },

    // Get finance records by date range
    getRecords: async (startDate: string, endDate: string): Promise<FinanceRecord[]> => {
        try {
            return await invoke('get_finance_records', { startDate, endDate });
        } catch (error) {
            console.error('Error getting finance records:', error);
            throw error;
        }
    },

    // Delete finance record
    deleteRecord: async (id: number): Promise<void> => {
        try {
            await invoke('delete_finance_record', { id });
        } catch (error) {
            console.error('Error deleting finance record:', error);
            throw error;
        }
    },

    // Get finance summary for a specific date (or just daily summary logic backend side)
    // Backend impl uses 'date' equality check, so this is 'Daily Summary'
    getSummary: async (date: string): Promise<FinanceSummary> => {
        try {
            return await invoke('get_finance_summary', { date });
        } catch (error) {
            console.error('Error getting finance summary:', error);
            throw error;
        }
    },

    // Process Goods Receipt (Mal Kabul)
    processGoodsReceipt: async (items: any[], totalAmount: number, paymentMethod: string, description: string, date: string, supplierId?: string | null, invoiceNo?: string | null): Promise<void> => {
        try {
            await invoke('process_goods_receipt', {
                items,
                totalAmount,
                paymentMethod,
                description,
                date,
                supplierId: supplierId || null,
                invoiceNo: invoiceNo || null
            });
        } catch (error) {
            console.error('Error processing goods receipt:', error);
            throw error;
        }
    },

    // Expense Categories
    getExpenseCategories: async (): Promise<string[]> => {
        try {
            return await invoke('get_expense_categories');
        } catch (error) {
            console.error('Error getting expense categories:', error);
            return [];
        }
    },

    addExpenseCategory: async (name: string): Promise<void> => {
        try {
            await invoke('add_expense_category', { name });
        } catch (error) {
            console.error('Error adding expense category:', error);
            throw error;
        }
    },

    deleteExpenseCategory: async (name: string): Promise<void> => {
        try {
            await invoke('delete_expense_category', { name });
        } catch (error) {
            console.error('Error deleting expense category:', error);
            throw error;
        }
    },

    // Get Suppliers (Current Accounts)
    getSuppliers: async (): Promise<{ id: string, name: string }[]> => {
        try {
            const accounts = await invoke<any[]>('get_current_accounts');
            // Filter only suppliers if needed, or return all. 
            // In GoodsReceipt.tsx logic was: acc.accountType === 'SUPPLIER' || acc.accountType === 'BOTH'
            // We'll reproduce that filtering here or return all and let UI filter.
            // Let's return all for now to be generic, or filter here. 
            // The backend struct is models::CurrentAccount.
            return accounts.map(a => ({ id: a.id, name: a.name }));
        } catch (error) {
            console.error('Error getting suppliers:', error);
            return [];
        }
    }
};
