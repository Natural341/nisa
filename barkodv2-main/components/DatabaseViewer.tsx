import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { InventoryItem, Transaction } from '../types';
import { useRefresh } from '../src/context/RefreshContext';

const DatabaseViewer: React.FC = () => {
    const { lastUpdated, triggerRefresh } = useRefresh();
    const [activeTable, setActiveTable] = useState<'items' | 'transactions'>('items');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit Modal State
    const [editingRow, setEditingRow] = useState<any | null>(null);
    const [editFormData, setEditFormData] = useState<Record<string, any>>({});

    useEffect(() => {
        loadTableData();
    }, [activeTable, lastUpdated]);

    const loadTableData = async () => {
        setLoading(true);
        try {
            if (activeTable === 'items') {
                const items = await inventoryService.getAllItems();
                setData(items);
            } else {
                const txns = await inventoryService.getTransactions();
                setData(txns);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (row: any) => {
        setEditingRow(row);
        setEditFormData({ ...row });
    };

    const handleEditChange = (key: string, value: any) => {
        setEditFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editingRow) return;

        try {
            if (activeTable === 'items') {
                // Update inventory item
                // editFormData contains all InventoryItem properties from the original row
                const updatedItem = {
                    ...editFormData,
                    quantity: Number(editFormData.quantity) || 0,
                    price: Number(editFormData.price) || 0,
                    costPrice: Number(editFormData.costPrice) || 0,
                    lastUpdated: new Date().toISOString()
                } as InventoryItem;
                await inventoryService.updateItem(updatedItem);
            } else {
                // Update transaction
                await inventoryService.updateTransaction(editingRow.id, {
                    paymentMethod: editFormData.paymentMethod,
                    note: editFormData.note
                });
            }
            setEditingRow(null);
            triggerRefresh();
        } catch (error) {
            console.error('Save failed:', error);
            alert('Kaydetme başarısız.');
        }
    };

    const handleDelete = async (row: any) => {
        if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            if (activeTable === 'items') {
                await inventoryService.deleteItem(row.id);
            } else {
                // For transactions, we don't have a delete mechanism yet
                // Let's update payment method to 'DELETED' as a soft delete
                await inventoryService.updateTransaction(row.id, { paymentMethod: 'SİLİNDİ' });
            }
            triggerRefresh();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Silme başarısız.');
        }
    };

    const getEditableFields = () => {
        if (activeTable === 'items') {
            return ['name', 'sku', 'category', 'quantity', 'price', 'costPrice', 'location'];
        }
        return ['paymentMethod', 'note'];
    };

    return (
        <div className="p-6 h-full bg-gray-50 dark:bg-black overflow-y-auto w-full">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-6 uppercase">Veritabanı Görüntüleyici</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-zinc-800 pb-1">
                <button
                    onClick={() => setActiveTable('items')}
                    className={`px-4 py-2 text-sm font-bold uppercase transition-colors ${activeTable === 'items' ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-400'}`}
                >
                    Ürünler (Inventory)
                </button>
                <button
                    onClick={() => setActiveTable('transactions')}
                    className={`px-4 py-2 text-sm font-bold uppercase transition-colors ${activeTable === 'transactions' ? 'text-black dark:text-white border-b-2 border-black dark:border-white' : 'text-gray-400'}`}
                >
                    İşlemler (Transactions)
                </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[70vh]">
                    <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-800">
                            <thead className="bg-gray-50 dark:bg-zinc-950 sticky top-0">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">İşlemler</th>
                                    {data.length > 0 && Object.keys(data[0]).slice(0, 6).map(key => (
                                        <th key={key} className="px-3 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                {loading ? (
                                    <tr><td colSpan={10} className="p-8 text-center">Yükleniyor...</td></tr>
                                ) : data.length === 0 ? (
                                    <tr><td colSpan={10} className="p-8 text-center text-gray-400">Kayıt bulunamadı.</td></tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => openEditModal(row)}
                                                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded font-bold hover:bg-blue-200"
                                                    >
                                                        Düzenle
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(row)}
                                                        className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-bold hover:bg-red-200"
                                                    >
                                                        Sil
                                                    </button>
                                                </div>
                                            </td>
                                            {Object.values(row).slice(0, 6).map((val: any, i) => (
                                                <td key={i} className="px-3 py-3 whitespace-nowrap text-xs font-mono text-gray-600 dark:text-zinc-400 border-r border-gray-100 dark:border-zinc-800/50 last:border-0">
                                                    {typeof val === 'object' ? JSON.stringify(val).slice(0, 20) + '...' : String(val).slice(0, 30)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div className="mt-4 text-xs text-center text-gray-400">
                Toplam {data.length} kayıt gösteriliyor.
            </div>

            {/* Edit Modal */}
            {editingRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Kayıt Düzenle</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {getEditableFields().map(key => (
                                <div key={key}>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{key}</label>
                                    <input
                                        type={['quantity', 'price', 'costPrice'].includes(key) ? 'number' : 'text'}
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-zinc-700 rounded-lg p-3 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editFormData[key] || ''}
                                        onChange={(e) => handleEditChange(key, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-zinc-800 flex gap-3">
                            <button
                                onClick={() => setEditingRow(null)}
                                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-90"
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatabaseViewer;
