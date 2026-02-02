import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { Transaction, CartItem } from '../types';

const TransactionsPage: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Date State
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [periodLabel, setPeriodLabel] = useState('Bugün');

    useEffect(() => {
        loadData();
    }, [startDate, endDate]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await inventoryService.getTransactionsByDateRange(startDate, endDate);
            setTransactions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePreset = (days: number, label: string) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);

        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
        setPeriodLabel(label);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    };

    // Stats
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.transactionType === 'RETURN' ? -t.total : t.total), 0);
    const successCount = transactions.length;
    const avgBasket = successCount > 0 ? totalRevenue / successCount : 0;

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-gray-50 dark:bg-black text-gray-900 dark:text-white flex flex-col relative">
            {/* Export Message Toast */}
            {exportMessage && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${exportMessage.type === 'success'
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}>
                    {exportMessage.type === 'success' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                    <span className="font-medium text-sm">{exportMessage.text}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">İşlem Geçmişi</h1>
                    <p className="text-gray-500 text-sm mt-1">Detaylı Satış ve İade Raporları</p>
                </div>

                <div className="flex gap-3 items-center">
                    {/* Excel Export Button */}
                    <button
                        onClick={async () => {
                            try {
                                setExportMessage(null);

                                if (transactions.length === 0) {
                                    setExportMessage({ type: 'error', text: 'Dışa aktarılacak işlem bulunamadı.' });
                                    return;
                                }

                                const headers = ['Tarih', 'Saat', 'Islem ID', 'Tur', 'Odeme Yontemi', 'Urunler', 'Tutar'];
                                const BOM = "\uFEFF";
                                const csvContent = BOM + headers.join(";") + "\n" +
                                    transactions.map(t => [
                                        new Date(t.createdAt).toLocaleDateString('tr-TR'),
                                        new Date(t.createdAt).toLocaleTimeString('tr-TR'),
                                        t.id.substring(0, 8),
                                        t.transactionType === 'RETURN' ? 'IADE' : 'SATIS',
                                        t.paymentMethod, // Payment Method
                                        `"${t.items.map(i => `${i.name} x${i.cartQuantity}`).join(', ').replace(/"/g, '""')}"`,
                                        // Ensure negative sign for returns, positive for sales
                                        t.transactionType === 'RETURN' ? -Math.abs(t.total) : Math.abs(t.total)
                                    ].join(";")).join("\n");

                                const fileName = `Islem_Gecmisi_${periodLabel}_${startDate}_${endDate}.csv`;

                                // Use downloadFile for direct download (works in both Web and Tauri WebView)
                                const { downloadFile } = await import('../services/tauriService');
                                downloadFile(csvContent, fileName);

                                setExportMessage({ type: 'success', text: `${fileName} başarıyla indirildi!` });
                                setTimeout(() => setExportMessage(null), 3000);
                            } catch (error) {
                                console.error('Excel export error:', error);
                                setExportMessage({ type: 'error', text: 'Dosya indirme başarısız oldu. Lütfen tekrar deneyin.' });
                                setTimeout(() => setExportMessage(null), 5000);
                            }
                        }}
                        className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Excel'e Aktar
                    </button>

                    {/* Period Filters */}
                    <div className="flex gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-gray-200 dark:border-zinc-800">
                        <button onClick={() => handlePreset(0, 'Bugün')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${periodLabel === 'Bugün' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500'}`}>BUGÜN</button>
                        <button onClick={() => handlePreset(7, 'Bu Hafta')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${periodLabel === 'Bu Hafta' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500'}`}>BU HAFTA</button>
                        <button onClick={() => handlePreset(30, 'Bu Ay')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${periodLabel === 'Bu Ay' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500'}`}>BU AY</button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-center">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1">Başlangıç</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPeriodLabel('Özel'); }}
                        className="bg-transparent font-bold text-lg outline-none date-picker-custom"
                    />
                </div>
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 flex flex-col justify-center">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1">Bitiş</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPeriodLabel('Özel'); }}
                        className="bg-transparent font-bold text-lg outline-none date-picker-custom"
                    />
                </div>

                {/* Summary Cards */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-900/30 flex flex-col justify-center">
                    <label className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-1">Toplam Ciro</label>
                    <div className="text-2xl font-black text-green-700 dark:text-green-400">{formatCurrency(totalRevenue)}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex flex-col justify-center">
                    <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">İşlem Sayısı</label>
                    <div className="text-2xl font-black text-blue-700 dark:text-blue-400">{successCount}</div>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 flex-1 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-black/50 border-b border-gray-200 dark:border-zinc-800 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="p-4">Tarih</th>
                                <th className="p-4">İşlem ID</th>
                                <th className="p-4">Tür</th>
                                <th className="p-4">İçerik (Ürünler)</th>
                                <th className="p-4 text-right">Tutar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center animate-pulse">Yükleniyor...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Bu tarih aralığında işlem bulunamadı.</td></tr>
                            ) : (
                                transactions.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                        <td className="p-4 text-gray-500 font-mono text-xs">
                                            {new Date(t.createdAt).toLocaleDateString('tr-TR')} <br />
                                            {new Date(t.createdAt).toLocaleTimeString('tr-TR')}
                                        </td>
                                        <td className="p-4 font-mono text-xs text-gray-400 select-all">{t.id.substring(0, 8)}...</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${t.transactionType === 'RETURN' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                {t.transactionType === 'RETURN' ? 'İADE' : 'SATIŞ'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-gray-900 dark:text-white">{t.items.length} Kalem Ürün</span>
                                                <div className="text-xs text-gray-500 hidden group-hover:block transition-all">
                                                    {t.items.map(i => `${i.name} (${i.cartQuantity}x)`).join(', ')}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-bold font-mono text-base">
                                            {t.transactionType === 'RETURN' ? '-' : ''}{formatCurrency(Math.abs(t.total))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TransactionsPage;
