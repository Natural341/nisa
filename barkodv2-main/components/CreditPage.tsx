import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Transaction } from '../types';
import { useRefresh } from '../src/context/RefreshContext';

const CreditPage: React.FC = () => {
    const { lastUpdated, triggerRefresh } = useRefresh();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [editNote, setEditNote] = useState('');

    useEffect(() => {
        loadCreditTransactions();
    }, [lastUpdated]);

    const loadCreditTransactions = async () => {
        setLoading(true);
        try {
            // Get all transactions and filter for Veresiye
            const allTxns = await inventoryService.getTransactions();
            const creditTxns = allTxns.filter(t => t.paymentMethod === 'Veresiye' && t.transactionType !== 'PAID');
            setTransactions(creditTxns);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsPaid = async (tx: Transaction) => {
        if (!window.confirm(`Bu veresiye işlemini "Ödendi" olarak işaretlemek istediğinize emin misiniz?`)) return;

        try {
            // Update transaction payment method to indicate it's paid
            await inventoryService.updateTransaction(tx.id, { paymentMethod: 'Nakit (Veresiye Tahsilat)' });
            triggerRefresh();
        } catch (error) {
            console.error('Mark as paid failed:', error);
            alert('İşlem güncellenemedi.');
        }
    };

    const openEditModal = (tx: Transaction) => {
        setEditingTx(tx);
        setEditNote(tx.note || '');
    };

    const handleSaveEdit = async () => {
        if (!editingTx) return;

        try {
            await inventoryService.updateTransaction(editingTx.id, { note: editNote });
            setEditingTx(null);
            triggerRefresh();
        } catch (error) {
            console.error('Update failed:', error);
            alert('Güncelleme başarısız.');
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    };

    const totalCredit = transactions.reduce((sum, t) => sum + Math.abs(t.total), 0);

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-gray-50 dark:bg-black text-gray-900 dark:text-white flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">Veresiye Takibi</h1>
                    <p className="text-gray-500 text-sm mt-1">Bekleyen Ödemeler</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 rounded-xl border border-red-100 dark:border-red-900/30">
                    <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">Toplam Alacak</div>
                    <div className="text-3xl font-black text-red-700 dark:text-red-400">{formatCurrency(totalCredit)}</div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 flex-1 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-black/50 border-b border-gray-200 dark:border-zinc-800 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="p-4">Tarih</th>
                                <th className="p-4">İşlem ID</th>
                                <th className="p-4">Not / Müşteri</th>
                                <th className="p-4 text-right">Tutar</th>
                                <th className="p-4 text-center">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center animate-pulse">Yükleniyor...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Bekleyen veresiye bulunmuyor.</td></tr>
                            ) : (
                                transactions.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4 text-gray-500 font-mono text-xs">
                                            {new Date(t.createdAt).toLocaleDateString('tr-TR')} <br />
                                            {new Date(t.createdAt).toLocaleTimeString('tr-TR')}
                                        </td>
                                        <td className="p-4 font-mono text-xs text-gray-400 select-all">{t.id.substring(0, 8)}...</td>
                                        <td className="p-4">
                                            <span className="font-bold text-gray-900 dark:text-white">{t.note || '-'}</span>
                                        </td>
                                        <td className="p-4 text-right font-bold font-mono text-lg text-red-600 dark:text-red-400">
                                            {formatCurrency(Math.abs(t.total))}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => handleMarkAsPaid(t)}
                                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg uppercase transition-colors flex items-center gap-1"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    Alındı
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(t)}
                                                    className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-white font-bold text-xs rounded-lg uppercase transition-colors"
                                                >
                                                    Düzenle
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {editingTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Veresiye Düzenle</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Not / Müşteri Bilgisi</label>
                                <textarea
                                    className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-zinc-700 rounded-lg p-3 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    placeholder="Müşteri adı, telefon, vb."
                                />
                            </div>
                            <div className="bg-gray-50 dark:bg-zinc-800 p-3 rounded-lg">
                                <div className="text-xs text-gray-400 uppercase mb-1">Tutar</div>
                                <div className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(Math.abs(editingTx.total))}</div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 dark:border-zinc-800 flex gap-3">
                            <button
                                onClick={() => setEditingTx(null)}
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

export default CreditPage;
