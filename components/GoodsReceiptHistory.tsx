import React, { useState, useEffect } from 'react';
import { tauriInvoke } from '../services/tauriService';

interface GoodsReceiptRecord {
    id: string;
    invoice_no: string | null;
    supplier_id: string | null;
    supplier_name: string | null;
    total_amount: number;
    payment_method: string;
    description: string;
    date: string;
    created_at: string;
}

const GoodsReceiptHistory: React.FC = () => {
    const [records, setRecords] = useState<GoodsReceiptRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await tauriInvoke<GoodsReceiptRecord[]>('get_goods_receipt_history');
            setRecords(data);
        } catch (error) {
            console.error('Failed to load goods receipt history', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    };

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
                    <h1 className="text-3xl font-black uppercase tracking-tight">Mal Kabul Geçmişi</h1>
                    <p className="text-gray-500 text-sm mt-1">Stok girişi ve fatura kayıtları</p>
                </div>

                <div className="flex gap-3 items-center">
                    <button
                        onClick={async () => {
                            try {
                                setExportMessage(null);

                                if (records.length === 0) {
                                    setExportMessage({ type: 'error', text: 'Dışa aktarılacak kayıt bulunamadı.' });
                                    return;
                                }

                                const headers = ['Tarih', 'Fatura No', 'Tedarikçi', 'Aciklama', 'Tutar'];
                                const BOM = "\uFEFF";
                                const csvContent = BOM + headers.join(";") + "\n" +
                                    records.map(r => [
                                        new Date(r.created_at).toLocaleDateString('tr-TR'),
                                        r.invoice_no || '-',
                                        r.supplier_name || '-',
                                        r.description,
                                        r.total_amount
                                    ].join(";")).join("\n");

                                const fileName = `Mal_Kabul_Gecmisi_${new Date().toISOString().split('T')[0]}.csv`;

                                const { downloadFile } = await import('../services/tauriService');
                                downloadFile(csvContent, fileName);

                                setExportMessage({ type: 'success', text: `${fileName} başarıyla indirildi!` });
                                setTimeout(() => setExportMessage(null), 3000);
                            } catch (error) {
                                console.error('Excel export error:', error);
                                setExportMessage({ type: 'error', text: 'Dosya indirme başarısız oldu.' });
                                setTimeout(() => setExportMessage(null), 5000);
                            }
                        }}
                        className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Excel'e Aktar
                    </button>
                    <button
                        onClick={loadData}
                        className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 flex-1 overflow-hidden flex flex-col shadow-sm">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-black/50 border-b border-gray-200 dark:border-zinc-800 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="p-4">Tarih</th>
                                <th className="p-4">Fatura No</th>
                                <th className="p-4">Tedarikçi</th>
                                <th className="p-4">Açıklama</th>
                                <th className="p-4 text-right">Tutar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center animate-pulse">Yükleniyor...</td></tr>
                            ) : records.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Kayıt bulunamadı.</td></tr>
                            ) : (
                                records.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                        <td className="p-4 text-gray-500 font-mono text-xs">
                                            {new Date(r.created_at).toLocaleDateString('tr-TR')} <br />
                                            {new Date(r.created_at).toLocaleTimeString('tr-TR')}
                                        </td>
                                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                                            {r.invoice_no ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs select-all">{r.invoice_no}</span> : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="p-4 font-medium">
                                            {r.supplier_name || '-'}
                                        </td>
                                        <td className="p-4 text-gray-600 dark:text-zinc-400 text-xs">
                                            {r.description}
                                        </td>
                                        <td className="p-4 text-right font-bold font-mono text-base text-red-600 dark:text-red-400">
                                            -{formatCurrency(r.total_amount)}
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

export default GoodsReceiptHistory;
