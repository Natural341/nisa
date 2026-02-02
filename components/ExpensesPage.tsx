import React, { useState, useEffect } from 'react';
import { tauriInvoke } from '../services/tauriService';
import { Transaction, Category } from '../types';

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    paymentMethod: string;
}

const ExpensesPage: React.FC = () => {
    // Data States
    const [expenses, setExpenses] = useState<Transaction[]>([]);
    // State for categories with specific type
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // Form States
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT_CARD' | 'HAVALE'>('CASH');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // UI States
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [fetchedExpenses, fetchedCategories] = await Promise.all([
                tauriInvoke<any>('get_transactions_with_pagination', {
                    page: 1,
                    perPage: 100,
                    transactionType: 'EXPENSE'
                }),
                tauriInvoke<{ id: string, name: string }[]>('get_expense_categories')
            ]);

            // Handle pagination response wrapper
            setExpenses(fetchedExpenses.data || []);
            setCategories(fetchedCategories || []);

        } catch (error) {
            console.error('Failed to load expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await tauriInvoke('process_expense', {
                description,
                amount: parseFloat(amount),
                category,
                paymentMethod,
                date: new Date(date).toISOString() // Send as ISO string
            });

            // Reset Form
            setDescription('');
            setAmount('');
            setCategory('');

            // Refresh
            loadData();
        } catch (error) {
            console.error(error);
            alert('Masraf eklenemedi: ' + error);
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await tauriInvoke('add_expense_category', {
                name: newCategoryName
            });
            setShowCategoryModal(false);
            setNewCategoryName('');
            loadData();
        } catch (error) {
            console.error(error);
            alert('Kategori eklenemedi: ' + error);
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return;
        try {
            await tauriInvoke('delete_expense_category', { id });
            loadData();
        } catch (error) {
            console.error(error);
            alert('Kategori silinemedi: ' + error);
        }
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-black p-6">
            <h1 className="text-3xl font-black uppercase mb-6 tracking-tight">Masraf Yönetimi</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
                {/* LEFT: Add Expense Form */}
                <div className="lg:col-span-1 bg-gray-50 dark:bg-zinc-900 rounded-2xl p-6 h-fit">
                    <h2 className="text-xl font-bold mb-4">Yeni Masraf Girişi</h2>
                    <form onSubmit={handleAddExpense} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Tarih</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 font-bold"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Kategori</label>
                            <div className="flex gap-2">
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    required
                                    className="flex-1 p-3 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 outline-none focus:ring-2 ring-black dark:ring-white"
                                >
                                    <option value="">Seçiniz...</option>
                                    {categories.map(c => (
                                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryModal(true)}
                                    className="p-3 bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Açıklama</label>
                            <input
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Örn: Ofis Kirası (İsteğe bağlı)"
                                className="w-full p-3 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 outline-none focus:ring-2 ring-black dark:ring-white"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Tutar</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                required
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full p-3 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 outline-none focus:ring-2 ring-black dark:ring-white font-mono font-bold text-lg"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Ödeme Yöntemi</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => setPaymentMethod('CASH')} className={`p-2 rounded-xl text-xs font-bold border transition-colors ${paymentMethod === 'CASH' ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-white dark:bg-black border-gray-200 dark:border-zinc-800'}`}>NAKİT</button>
                                <button type="button" onClick={() => setPaymentMethod('CREDIT_CARD')} className={`p-2 rounded-xl text-xs font-bold border transition-colors ${paymentMethod === 'CREDIT_CARD' ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-white dark:bg-black border-gray-200 dark:border-zinc-800'}`}>KART</button>
                                <button type="button" onClick={() => setPaymentMethod('HAVALE')} className={`p-2 rounded-xl text-xs font-bold border transition-colors ${paymentMethod === 'HAVALE' ? 'bg-black text-white dark:bg-white dark:text-black border-transparent' : 'bg-white dark:bg-black border-gray-200 dark:border-zinc-800'}`}>HAVALE</button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold uppercase hover:scale-[1.02] transition-transform shadow-xl"
                        >
                            Masrafı Ekle
                        </button>
                    </form>
                </div>

                {/* RIGHT: List */}
                <div className="lg:col-span-2 bg-gray-50 dark:bg-zinc-900 rounded-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-zinc-800">
                    <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-black">
                        <h2 className="font-bold">Son İşlemler</h2>
                        <span className="text-xs font-mono bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded">{expenses.length} Kayıt</span>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs font-black uppercase text-gray-400 border-b border-gray-200 dark:border-zinc-800">
                                    <th className="p-3">Tarih</th>
                                    <th className="p-3">Kategori</th>
                                    <th className="p-3">Açıklama</th>
                                    <th className="p-3">Yöntem</th>
                                    <th className="p-3 text-right">Tutar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Yükleniyor...</td></tr>
                                ) : expenses.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Henüz masraf kaydı yok.</td></tr>
                                ) : expenses.map(ex => {
                                    // Parse category/name from items list since backend stores it there for Expenses
                                    const expenseItem = ex.items && ex.items.length > 0 ? ex.items[0] : null;
                                    const catName = expenseItem?.category || 'Genel';

                                    return (
                                        <tr key={ex.id} className="hover:bg-white dark:hover:bg-black transition-colors">
                                            <td className="p-3 text-sm font-mono text-gray-500">{new Date(ex.createdAt).toLocaleDateString('tr-TR')}</td>
                                            <td className="p-3 font-bold text-xs uppercase"><span className="bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">{catName}</span></td>
                                            <td className="p-3 text-sm font-medium">{ex.note}</td>
                                            <td className="p-3 text-xs font-mono">{ex.paymentMethod}</td>
                                            <td className="p-3 text-right font-mono font-bold text-red-600">
                                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Math.abs(ex.total))}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl w-96 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Yeni Kategori Ekle</h2>
                        <input
                            autoFocus
                            type="text"
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            placeholder="Kategori Adı"
                            className="w-full p-3 border border-gray-200 dark:border-zinc-800 rounded-xl mb-4 outline-none focus:ring-2 ring-black dark:ring-white bg-transparent"
                        />
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-gray-400 uppercase">Mevcut Kategoriler</span>
                        </div>
                        <div className="max-h-32 overflow-auto mb-4 space-y-1">
                            {categories.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg text-sm group">
                                    <span>{c.name}</span>
                                    <button onClick={() => handleDeleteCategory(c.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Sil</button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setShowCategoryModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 text-sm font-bold">İptal</button>
                            <button onClick={handleAddCategory} className="flex-1 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 text-sm font-bold">Kaydet</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpensesPage;
