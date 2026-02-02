import React, { useState, useEffect } from 'react';
import { tauriInvoke, isTauri } from '../services/tauriService';

interface CurrentAccount {
    id: string;
    name: string;
    accountType: string;
}

interface StockCard {
    id: string;
    barcode: string;
    name: string;
    unit: string;
}

interface GoodsReceiptItem {
    productId: string;
    productName: string;
    quantity: number;
    buyPrice: number;
    sellPrice: number;
    unit: string;
}

// Otomatik fatura no oluştur
const generateInvoiceNo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `MK-${year}${month}${day}-${time}`;
};

const GoodsReceipt: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
    const [stockCards, setStockCards] = useState<StockCard[]>([]);
    const [items, setItems] = useState<GoodsReceiptItem[]>([]);

    const [formData, setFormData] = useState({
        supplierId: '',
        date: new Date().toISOString().split('T')[0],
        invoiceNo: generateInvoiceNo(),
        paymentMethod: 'NAKIT',
        description: ''
    });

    const [currentItem, setCurrentItem] = useState({
        productId: '',
        quantity: 1,
        buyPrice: 0,
        sellPrice: 0
    });

    // Load current accounts and stock cards
    useEffect(() => {
        const loadData = async () => {
            try {
                if (isTauri()) {
                    const accounts = await tauriInvoke<CurrentAccount[]>('get_current_accounts');
                    const cards = await tauriInvoke<StockCard[]>('get_stock_cards');
                    setCurrentAccounts(accounts.filter(a => a.accountType === 'SUPPLIER' || a.accountType === 'BOTH'));
                    setStockCards(cards);
                }
            } catch (err) {
                console.error('Failed to load data:', err);
            }
        };
        loadData();
    }, []);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentItem(prev => ({
            ...prev,
            [name]: ['quantity', 'buyPrice', 'sellPrice'].includes(name) ? parseFloat(value) || 0 : value
        }));
    };

    const addItem = () => {
        if (!currentItem.productId) {
            setError('Lütfen bir ürün seçin.');
            return;
        }
        if (currentItem.quantity <= 0) {
            setError('Miktar 0\'dan büyük olmalı.');
            return;
        }

        const product = stockCards.find(s => s.id === currentItem.productId);
        if (!product) return;

        setItems(prev => [...prev, {
            productId: currentItem.productId,
            productName: product.name,
            quantity: currentItem.quantity,
            buyPrice: currentItem.buyPrice,
            sellPrice: currentItem.sellPrice,
            unit: product.unit
        }]);

        setCurrentItem({ productId: '', quantity: 1, buyPrice: 0, sellPrice: 0 });
        setError(null);
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.buyPrice), 0);

    // Yazdırma fonksiyonu
    const handlePrint = () => {
        const supplier = currentAccounts.find(c => c.id === formData.supplierId);
        const paymentText = formData.paymentMethod === 'NAKIT' ? 'Nakit' : formData.paymentMethod === 'KREDI_KARTI' ? 'Kredi Kartı' : formData.paymentMethod === 'HAVALE' ? 'Havale/EFT' : 'Vadeli';
        const printContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Mal Kabul Formu</title>
    <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #000; -webkit-print-color-adjust: exact; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { font-size: 24px; font-weight: 900; margin: 0; letter-spacing: 1px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .meta-box { border: 1px solid #ccc; padding: 10px; border-radius: 4px; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .meta-label { font-weight: bold; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #000; padding: 8px; text-align: left; }
        th { background-color: #f0f0f0; font-weight: 800; text-transform: uppercase; font-size: 10pt; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; }
        .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sign-box { border-top: 2px solid #000; padding-top: 10px; text-align: center; }
        .sign-title { font-weight: bold; margin-bottom: 40px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>MAL KABUL TUTANAĞI</h1>
    </div>

    <div class="meta-grid">
        <div class="meta-box">
            <div class="meta-row">
                <span class="meta-label">Tedarikçi:</span>
                <span>${supplier?.name || '-'}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">Fatura No:</span>
                <span>${formData.invoiceNo}</span>
            </div>
        </div>
        <div class="meta-box">
            <div class="meta-row">
                <span class="meta-label">Tarih:</span>
                <span>${new Date(formData.date).toLocaleDateString('tr-TR')}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">Ödeme:</span>
                <span>${paymentText}</span>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 5%">#</th>
                <th style="width: 45%">Ürün Adı</th>
                <th style="width: 15%" class="text-center">Miktar</th>
                <th style="width: 15%" class="text-right">Birim Fiyat</th>
                <th style="width: 20%" class="text-right">Toplam</th>
            </tr>
        </thead>
        <tbody>
            ${items.map((item, index) => `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td style="font-weight: 500">${item.productName}</td>
                <td class="text-center">${item.quantity} ${item.unit}</td>
                <td class="text-right">${item.buyPrice.toFixed(2)} ₺</td>
                <td class="text-right"><strong>${(item.quantity * item.buyPrice).toFixed(2)} ₺</strong></td>
            </tr>
            `).join('')}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="4" class="text-right" style="border: none; padding-top: 15px; font-size: 14pt; font-weight: bold;">GENEL TOPLAM:</td>
                <td class="text-right" style="border: none; padding-top: 15px; font-size: 14pt; font-weight: 900;">${totalAmount.toFixed(2)} ₺</td>
            </tr>
        </tfoot>
    </table>

    <div class="footer">
        <div class="sign-box">
            <div class="sign-title">TESLİM EDEN</div>
            <p style="font-size: 9pt; color: #666; margin-top: 20px;">(İmza / Kaşe)</p>
        </div>
        <div class="sign-box">
            <div class="sign-title">TESLİM ALAN</div>
            <p style="font-size: 9pt; color: #666; margin-top: 20px;">(İmza)</p>
        </div>
    </div>
</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;left:-9999px';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(printContent);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 500);
            }, 100);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (items.length === 0) {
            setError('En az bir ürün eklemelisiniz.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (isTauri()) {
                const payload = {
                    items: items.map(item => ({
                        product_id: item.productId,
                        quantity: item.quantity,
                        buy_price: item.buyPrice,
                        sell_price: item.sellPrice > 0 ? item.sellPrice : null
                    })),
                    totalAmount,
                    paymentMethod: formData.paymentMethod,
                    description: `Tedarikçi: ${currentAccounts.find(c => c.id === formData.supplierId)?.name || 'Belirtilmedi'}, Fatura: ${formData.invoiceNo || 'Belirtilmedi'}`,
                    date: formData.date,
                    supplierId: formData.supplierId || null,
                    invoiceNo: formData.invoiceNo || null
                };
                console.log('🚀 Mal Kabul Payload:', payload);
                console.log('📦 supplierId:', payload.supplierId);
                await tauriInvoke('process_goods_receipt', payload);
            }

            setSuccess('Mal kabul işlemi başarıyla kaydedildi!');
            setItems([]);
            setFormData({
                supplierId: '',
                date: new Date().toISOString().split('T')[0],
                invoiceNo: generateInvoiceNo(),
                paymentMethod: 'NAKIT',
                description: ''
            });
        } catch (err: any) {
            console.error(err);
            const errorMsg = typeof err === 'string' ? err : err?.message || 'Kayıt sırasında bir hata oluştu.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col overflow-y-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mal Kabul</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Tedarikçiden gelen ürünleri stoğa ekleyin.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl">
                {/* Left: Form */}
                <div className="lg:col-span-2 space-y-6">
                    {error && (
                        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm">
                            {success}
                        </div>
                    )}

                    {/* Header Info */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Genel Bilgiler</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Tedarikçi (Cari)</label>
                                <select
                                    name="supplierId"
                                    value={formData.supplierId}
                                    onChange={handleFormChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                >
                                    <option value="">-- Tedarikçi Seçin --</option>
                                    {currentAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                                {currentAccounts.length === 0 && (
                                    <p className="text-xs text-amber-500 mt-1">Henüz tedarikçi eklenmemiş. Cari Oluştur'dan ekleyin.</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Tarih</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleFormChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Fatura No</label>
                                <input
                                    type="text"
                                    name="invoiceNo"
                                    value={formData.invoiceNo}
                                    onChange={handleFormChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                    placeholder="Opsiyonel"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Ödeme Yöntemi</label>
                                <select
                                    name="paymentMethod"
                                    value={formData.paymentMethod}
                                    onChange={handleFormChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                >
                                    <option value="NAKIT">Nakit</option>
                                    <option value="KREDI_KARTI">Kredi Kartı</option>
                                    <option value="HAVALE">Havale/EFT</option>
                                    <option value="VADELI">Vadeli</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Add Product */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Ürün Ekle</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Ürün</label>
                                <select
                                    name="productId"
                                    value={currentItem.productId}
                                    onChange={handleItemChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                >
                                    <option value="">-- Ürün Seçin --</option>
                                    {stockCards.map(card => (
                                        <option key={card.id} value={card.id}>{card.barcode} - {card.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Miktar</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    min="1"
                                    value={currentItem.quantity}
                                    onChange={handleItemChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Alış Fiyatı (₺)</label>
                                <input
                                    type="number"
                                    name="buyPrice"
                                    min="0"
                                    step="0.01"
                                    value={currentItem.buyPrice}
                                    onChange={handleItemChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Satış Fiyatı (₺)</label>
                                <input
                                    type="number"
                                    name="sellPrice"
                                    min="0"
                                    step="0.01"
                                    value={currentItem.sellPrice}
                                    onChange={handleItemChange}
                                    className="w-full px-4 py-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addItem}
                            className="mt-4 px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white font-medium hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Listeye Ekle
                        </button>
                    </div>

                    {/* Items Table */}
                    {items.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-zinc-300">Ürün</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-zinc-300">Miktar</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-zinc-300">Alış Fiyatı</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-green-600 dark:text-green-400">Satış Fiyatı</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">Toplam</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.productName}</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-zinc-300">{item.quantity} {item.unit}</td>
                                            <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-zinc-300">₺{item.buyPrice.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400">₺{item.sellPrice.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">₺{(item.quantity * item.buyPrice).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right: Summary */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 sticky top-6">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Özet</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-zinc-400">Ürün Sayısı</span>
                                <span className="text-gray-900 dark:text-white font-medium">{items.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-zinc-400">Toplam Miktar</span>
                                <span className="text-gray-900 dark:text-white font-medium">{items.reduce((sum, i) => sum + i.quantity, 0)}</span>
                            </div>
                            <hr className="border-gray-100 dark:border-zinc-800" />
                            <div className="flex justify-between text-lg font-bold">
                                <span className="text-gray-900 dark:text-white">Toplam Tutar</span>
                                <span className="text-gray-900 dark:text-white">₺{totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={handlePrint}
                                disabled={items.length === 0}
                                className={`flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Yazdır
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || items.length === 0}
                                className={`flex-[2] py-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all flex items-center justify-center gap-2 ${(loading || items.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Mal Kabul Kaydet
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GoodsReceipt;
