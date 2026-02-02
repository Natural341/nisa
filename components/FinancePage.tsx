import React, { useState, useEffect, useRef } from 'react';
import { FinanceRecord, FinanceSummary, InventoryItem, GoodsReceiptItem } from '../types';
import { financeService } from '../services/financeService';
import { inventoryService } from '../services/inventoryService';
import { useRefresh } from '../src/context/RefreshContext';
import { printContent } from '../services/printService';

const ManageCategoriesModal = ({ onClose, categories, onReload }: { onClose: () => void, categories: string[], onReload: () => void }) => {
    const [newCat, setNewCat] = useState('');

    const handleAdd = async () => {
        if (!newCat.trim()) return;
        try {
            await financeService.addExpenseCategory(newCat.trim());
            setNewCat('');
            onReload();
        } catch (e) {
            alert('Kategori eklenirken hata oluştu.');
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`${name} kategorisini silmek istediğinize emin misiniz?`)) return;
        try {
            await financeService.deleteExpenseCategory(name);
            onReload();
        } catch (e) {
            alert('Silinemedi.');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black uppercase">Masraf Kategorileri</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full">✕</button>
                </div>

                <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
                    {categories.map(cat => (
                        <div key={cat} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-black rounded-lg">
                            <span className="text-sm font-bold">{cat}</span>
                            <button onClick={() => handleDelete(cat)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2">SİL</button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input
                        value={newCat}
                        onChange={e => setNewCat(e.target.value)}
                        placeholder="Yeni Kategori..."
                        className="flex-1 bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-medium outline-none"
                    />
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-blue-700">EKLE</button>
                </div>
            </div>
        </div>
    );
};

interface FinancePageProps {
    defaultTab?: 'OVERVIEW' | 'TRANSACTIONS' | 'MAL_KABUL';
    autoOpenExpense?: boolean;
}

const FinancePage: React.FC<FinancePageProps> = ({ defaultTab = 'OVERVIEW', autoOpenExpense = false }) => {
    const { lastUpdated, triggerRefresh } = useRefresh();
    const [records, setRecords] = useState<FinanceRecord[]>([]);
    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [loading, setLoading] = useState(false);

    // Filters
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Printing State
    const [lastReceiptForPrint, setLastReceiptForPrint] = useState<{ items: any[], total: number, date: string, description: string } | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Initial effect for autoOpenExpense
    useEffect(() => {
        if (autoOpenExpense) {
            setNewRecord(prev => ({ ...prev, recordType: 'EXPENSE', category: 'MASRAF' }));
            setShowAddModal(true);
        }
    }, [autoOpenExpense]);

    // New Record Form State
    const [showAddModal, setShowAddModal] = useState(false);

    // Mal Kabul State
    const [showGoodsReceiptModal, setShowGoodsReceiptModal] = useState(false);
    const [receiptItems, setReceiptItems] = useState<{ item: InventoryItem; quantity: number; buyPrice: number }[]>([]);

    // Product Search & Add State
    const [mkMode, setMkMode] = useState<'SEARCH' | 'NEW'>('SEARCH');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);

    // Supplier & Invoice State
    const [suppliers, setSuppliers] = useState<{ id: string, name: string }[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');

    useEffect(() => {
        const loadSuppliers = async () => {
            const list = await financeService.getSuppliers();
            setSuppliers(list);
        };
        loadSuppliers();
    }, []);

    // New Product Form for Mal Kabul
    const [mkForm, setMkForm] = useState({
        name: '',
        sku: '',
        category: 'Genel',
        costPrice: '',
        sellPrice: '',
        quantity: '1',
        location: 'Eski Dükkan',
    });

    const [newRecord, setNewRecord] = useState({
        recordType: 'INCOME' as 'INCOME' | 'EXPENSE',
        category: 'TAHSILAT',
        amount: '',
        paymentMethod: 'NAKIT',
        description: '',
    });

    useEffect(() => {
        loadData();
    }, [lastUpdated, date]);

    const loadData = async () => {
        setLoading(true);
        try {
            const summaryData = await financeService.getSummary(date);
            setSummary(summaryData);
            const recordsData = await financeService.getRecords(date, date);
            setRecords(recordsData);
        } catch (error) {
            console.error('Failed to load finance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRecord = async () => {
        if (!newRecord.amount || !newRecord.category) {
            alert('Lütfen tutar ve kategori giriniz.');
            return;
        }

        try {
            await financeService.addRecord({
                recordType: newRecord.recordType,
                category: newRecord.category,
                amount: parseFloat(newRecord.amount),
                paymentMethod: newRecord.paymentMethod,
                description: newRecord.description,
                date: date
            });
            setShowAddModal(false);
            setNewRecord({
                recordType: 'INCOME',
                category: 'TAHSILAT',
                amount: '',
                paymentMethod: 'NAKIT',
                description: ''
            });
            triggerRefresh();
        } catch (error) {
            alert('Kayıt eklenirken hata oluştu.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
        try {
            await financeService.deleteRecord(id);
            triggerRefresh();
        } catch (error) {
            alert('Silme işlemi başarısız.');
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
    };

    // Mal Kabul Logic
    const handleSearch = async (term: string) => {
        setSearchTerm(term);
        if (term.length > 1) {
            try {
                const res = await inventoryService.getItems(1, 10, term);
                setSearchResults(res.data);
            } catch (e) {
                console.error(e);
            }
        } else {
            setSearchResults([]);
        }
    };

    const addToReceipt = (item: InventoryItem) => {
        const existing = receiptItems.find(x => x.item.id === item.id);
        if (existing) {
            setReceiptItems(receiptItems.map(x => x.item.id === item.id ? { ...x, quantity: x.quantity + 1 } : x));
        } else {
            setReceiptItems([...receiptItems, { item, quantity: 1, buyPrice: item.costPrice || 0 }]);
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const removeFromReceipt = (id: string) => {
        setReceiptItems(receiptItems.filter(x => x.item.id !== id));
    };

    const updateReceiptItem = (id: string, field: 'quantity' | 'buyPrice', value: number) => {
        setReceiptItems(receiptItems.map(x => x.item.id === id ? { ...x, [field]: value } : x));
    };

    const calculateReceiptTotal = () => {
        return receiptItems.reduce((sum, x) => sum + (x.quantity * x.buyPrice), 0);
    };

    const handleQuickAddProduct = async () => {
        if (!mkForm.name || !mkForm.sku || !mkForm.costPrice) {
            alert('Lütfen İsim, Barkod ve Alış Fiyatı alanlarını doldurun.');
            return;
        }

        try {
            const newItem: InventoryItem = {
                id: crypto.randomUUID(),
                name: mkForm.name,
                sku: mkForm.sku,
                category: mkForm.category,
                quantity: 0,
                price: parseFloat(mkForm.sellPrice) || 0,
                costPrice: parseFloat(mkForm.costPrice) || 0,
                location: mkForm.location,
                description: 'Mal Kabulde Eklendi',
                lastUpdated: new Date().toISOString(),
                aiTags: []
            };

            await inventoryService.addItem(newItem);
            addToReceiptWithDetails(newItem, parseInt(mkForm.quantity) || 1, parseFloat(mkForm.costPrice) || 0);

            setMkForm({
                name: '',
                sku: '',
                category: 'Genel',
                costPrice: '',
                sellPrice: '',
                quantity: '1',
                location: 'Eski Dükkan',
            });
            setMkMode('SEARCH');
            alert('Ürün oluşturuldu ve listeye eklendi.');
        } catch (e) {
            console.error(e);
            alert('Ürün eklenirken hata oluştu. Barkod zaten kullanılıyor olabilir.');
        }
    };

    const addToReceiptWithDetails = (item: InventoryItem, qty: number, cost: number) => {
        const existing = receiptItems.find(x => x.item.id === item.id);
        if (existing) {
            setReceiptItems(receiptItems.map(x => x.item.id === item.id ? { ...x, quantity: x.quantity + qty } : x));
        } else {
            setReceiptItems([...receiptItems, { item, quantity: qty, buyPrice: cost }]);
        }
    };

    const generateReceiptHtml = (data: { items: any[], total: number, date: string, description: string }) => {
        const itemsRows = data.items.map((item: any) => `
            <tr>
                <td class="font-mono">${item.item.sku}</td>
                <td class="font-bold">${item.item.name}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${formatCurrency(item.buyPrice)}</td>
                <td class="text-right font-bold">${formatCurrency(item.quantity * item.buyPrice)}</td>
            </tr>
        `).join('');

        return `
            <div class="header">
                <h1>TESLİM TESELLÜM TUTANAĞI</h1>
                <p><strong>Tarih:</strong> ${new Date(data.date).toLocaleDateString('tr-TR')}</p>
                <p>${data.description}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>BARKOD</th>
                        <th>ÜRÜN ADI</th>
                        <th class="text-right">MİKTAR</th>
                        <th class="text-right">BİRİM FİYAT</th>
                        <th class="text-right">TOPLAM</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4" class="text-right font-bold" style="border:none; padding-top:10px;">GENEL TOPLAM</td>
                        <td class="text-right font-bold" style="border:none; padding-top:10px;">${formatCurrency(data.total)}</td>
                    </tr>
                </tfoot>
            </table>
            <div class="footer">
                <div class="signature-box">
                    <p class="font-bold">TESLİM EDEN (İMZA)</p>
                    <div class="signature-line"></div>
                </div>
                <div class="signature-box">
                    <p class="font-bold">TESLİM ALAN (İMZA)</p>
                    <div class="signature-line"></div>
                </div>
            </div>
        `;
    };

    const handleGoodsReceiptSubmit = async () => {
        if (receiptItems.length === 0) {
            alert('Lütfen en az bir ürün ekleyin.');
            return;
        }

        const total = calculateReceiptTotal();
        const description = `Mal Kabul - ${receiptItems.length} Kalem Ürün`;

        const itemsPayload: GoodsReceiptItem[] = receiptItems.map(x => ({
            product_id: x.item.id,
            quantity: x.quantity,
            buy_price: x.buyPrice
        }));

        try {
            await financeService.processGoodsReceipt(
                itemsPayload,
                total,
                newRecord.paymentMethod,
                description,
                date,
                selectedSupplierId,
                invoiceNo
            );

            // Prepare for printing
            setLastReceiptForPrint({
                items: [...receiptItems],
                total: total,
                date: date,
                description: description
            });

            setShowGoodsReceiptModal(false);
            setReceiptItems([]);
            setSelectedSupplierId(''); // Reset state
            setInvoiceNo(''); // Reset state
            triggerRefresh();

            // Show Success Modal
            setShowSuccessModal(true);

        } catch (error) {
            console.error(error);
            alert('İşlem sırasında hata oluştu.');
        }
    };

    const handlePrintReceipt = async () => {
        if (lastReceiptForPrint) {
            const html = generateReceiptHtml(lastReceiptForPrint);
            await printContent(html);
        }
    };

    const handlePrintDraft = async () => {
        if (receiptItems.length === 0) {
            alert('Listede ürün yok.');
            return;
        }
        const draftData = {
            items: [...receiptItems],
            total: calculateReceiptTotal(),
            date: date,
            description: "Mal Kabul Listesi (Önizleme)"
        };
        const html = generateReceiptHtml(draftData);
        await printContent(html);
    };

    // Expense Categories Logic
    const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
    const [showCategoryManager, setShowCategoryManager] = useState(false);

    useEffect(() => {
        loadExpenseCategories();
    }, []);

    const loadExpenseCategories = async () => {
        try {
            const cats = await financeService.getExpenseCategories();
            setExpenseCategories(cats);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="p-4 md:p-6 h-full bg-gray-50 dark:bg-black text-gray-900 dark:text-white overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                <div>
                    <h1 className="text-4xl font-light text-black dark:text-white tracking-tighter mb-2">Finans Yönetimi</h1>
                    <div className="flex items-center gap-3">
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-3 py-1 text-sm font-bold uppercase tracking-wider outline-none"
                        />
                        <button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    const transactions = await inventoryService.getTransactionsByDateRange(date, date);
                                    const financeRecords = await financeService.getRecords(date, date);
                                    const exportRows: any[] = [];
                                    const BOM = "\uFEFF";

                                    transactions.forEach(tx => {
                                        if (tx.items && tx.items.length > 0) {
                                            tx.items.forEach(item => {
                                                exportRows.push({
                                                    date: new Date(tx.createdAt).toLocaleString('tr-TR'),
                                                    type: tx.transactionType === 'RETURN' ? 'İADE' : 'SATIŞ',
                                                    category: item.category || 'Genel',
                                                    description: item.name,
                                                    sku: item.sku,
                                                    quantity: item.cartQuantity || 1,
                                                    unitPrice: item.price,
                                                    total: (item.price * (item.cartQuantity || 1)),
                                                    paymentMethod: tx.paymentMethod,
                                                    isDetails: true
                                                });
                                            });
                                        } else {
                                            exportRows.push({
                                                date: new Date(tx.createdAt).toLocaleString('tr-TR'),
                                                type: tx.transactionType === 'RETURN' ? 'İADE' : 'SATIŞ',
                                                category: 'Genel',
                                                description: tx.note || 'İşlem Detaysız',
                                                sku: '-',
                                                quantity: 1,
                                                unitPrice: tx.total,
                                                total: tx.total,
                                                paymentMethod: tx.paymentMethod,
                                                isDetails: false
                                            });
                                        }
                                    });

                                    financeRecords.forEach(record => {
                                        exportRows.push({
                                            date: new Date(record.date).toLocaleDateString('tr-TR'),
                                            type: record.recordType === 'INCOME' ? 'GELİR' : 'GİDER',
                                            category: record.category,
                                            description: record.description || '',
                                            sku: '-',
                                            quantity: '-',
                                            unitPrice: record.amount,
                                            total: record.amount,
                                            paymentMethod: record.paymentMethod,
                                            isDetails: false
                                        });
                                    });

                                    const headers = ['Tarih', 'İşlem/Alım Türü', 'Kategori', 'Ürün/Açıklama', 'Barkod', 'Adet', 'Birim Fiyat', 'Toplam Tutar', 'Ödeme Yöntemi'];

                                    const csvContent = BOM + headers.join(";") + "\n" +
                                        exportRows.map(r => [
                                            `"${r.date}"`,
                                            r.type,
                                            `"${r.category}"`,
                                            `"${(r.description || '').replace(/"/g, '""')}"`,
                                            `"${r.sku}"`,
                                            r.quantity,
                                            typeof r.unitPrice === 'number' ? r.unitPrice.toFixed(2).replace('.', ',') : r.unitPrice,
                                            typeof r.total === 'number' ? r.total.toFixed(2).replace('.', ',') : r.total,
                                            `"${r.paymentMethod}"`
                                        ].join(";")).join("\n");

                                    await import('../services/tauriService').then(m => {
                                        const fileName = `Detayli_Finans_Raporu_${date}.csv`;
                                        m.downloadFile(csvContent, fileName);
                                        alert(`${fileName} başarıyla indirildi!`);
                                    });

                                } catch (error) {
                                    console.error("Export failed:", error);
                                    alert("Rapor oluşturulurken bir hata oluştu.");
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg text-xs font-bold uppercase hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Excel'e Aktar
                        </button>
                        <button
                            onClick={() => {
                                const printContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Günlük Kasa Raporu</title>
    <style>
        @page { size: A4; margin: 0; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            font-size: 11pt; 
            line-height: 1.4; 
            color: #000; 
            -webkit-print-color-adjust: exact; 
            background: #fff;
            
            width: 210mm;
            height: 295mm; /* Fixed height for A4 */
            margin: 0;
            padding: 15mm; /* Standard margin */
            box-sizing: border-box;
            
            display: flex;
            flex-direction: column;
        }
        
        /* HEADER LEFT ALIGNED */
        .header { text-align: left; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { font-size: 24px; font-weight: 900; margin: 0; letter-spacing: 1px; text-transform: uppercase; }
        .header p { font-size: 14pt; margin-top: 5px; font-weight: bold; }
        
        .content { flex: 1; }
        
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .box { border: 1px solid #ccc; padding: 20px; border-radius: 8px; break-inside: avoid; }
        .box-title { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 15px; font-size: 10pt; }
        
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11pt; }
        .label { font-weight: 500; color: #555; }
        .value { font-weight: bold; }
        .big-value { font-size: 24pt; font-weight: 900; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10pt; }
        th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f0f0f0; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .badge { padding: 2px 6px; border-radius: 4px; font-size: 8pt; font-weight: bold; color: #fff; background: #333; }
        .badge.income { background: green; }
        .badge.expense { background: red; }
        
        .footer {
            margin-top: auto;
            border-top: 2px solid #000;
            padding-top: 20px;
            display: flex;
            justify-content: flex-start;
        }
        .signature-box {
            text-align: center;
            width: 200px;
        }
    </style>
</head>
<body>
    <div class="content">
        <div class="header">
            <h1>GÜNLÜK KASA RAPORU</h1>
            <p>${new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        ${summary ? `
        <div class="summary-grid">
            <div class="box">
                <div class="box-title">GENEL DURUM</div>
                <div style="text-align: left; padding: 10px 0;">
                    <div style="font-size: 10pt; color: #666; text-transform: uppercase; font-weight: bold;">NET KASA</div>
                    <div class="big-value" style="color: ${summary.netBalance >= 0 ? 'black' : 'red'}">${formatCurrency(summary.netBalance)}</div>
                </div>
                <div class="row" style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
                    <span class="label">TOPLAM GELİR:</span>
                    <span class="value" style="color: green">${formatCurrency(summary.totalIncome)}</span>
                </div>
                <div class="row">
                    <span class="label">TOPLAM GİDER:</span>
                    <span class="value" style="color: red">${formatCurrency(summary.totalExpense)}</span>
                </div>
            </div>

            <div class="box">
                <div class="box-title">KASA DETAYI</div>
                <div class="row">
                    <span class="label">NAKİT:</span>
                    <span class="value">${formatCurrency(summary.cashBalance)}</span>
                </div>
                <div class="row">
                    <span class="label">KREDİ KARTI:</span>
                    <span class="value">${formatCurrency(summary.cardBalance)}</span>
                </div>
                <div class="row">
                    <span class="label">HAVALE / EFT:</span>
                    <span class="value">${formatCurrency(summary.bankBalance)}</span>
                </div>
            </div>
        </div>
        ` : ''}

        <h3 style="border-bottom: 2px solid #000; padding-bottom: 5px; text-transform: uppercase;">HAREKET DETAYLARI</h3>
        <table>
            <thead>
                <tr>
                    <th style="width: 100px;">SAAT</th>
                    <th style="width: 80px;">TÜR</th>
                    <th style="width: 150px;">KATEGORİ</th>
                    <th>AÇIKLAMA</th>
                    <th>ÖDEME</th>
                    <th class="text-right" style="width: 120px;">TUTAR</th>
                </tr>
            </thead>
            <tbody>
                ${records.map(record => `
                <tr>
                    <td>${new Date(record.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span class="badge ${record.recordType === 'INCOME' ? 'income' : 'expense'}">${record.recordType === 'INCOME' ? 'GELİR' : 'GİDER'}</span></td>
                    <td><strong>${record.category}</strong></td>
                    <td>${record.description || '-'}</td>
                    <td>${record.paymentMethod}</td>
                    <td class="text-right" style="font-weight: bold; font-family: monospace; font-size: 11pt; color: ${record.recordType === 'INCOME' ? 'green' : 'red'}">
                        ${record.recordType === 'INCOME' ? '+' : '-'}${formatCurrency(record.amount)}
                    </td>
                </tr>
                `).join('')}
                ${records.length === 0 ? '<tr><td colspan="6" class="text-center" style="padding: 20px; color: #999;">Kayıt bulunamadı.</td></tr>' : ''}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <div class="signature-box">
            <p style="font-weight: bold; margin-bottom: 40px;">Z RAPORU ALAN</p>
            <p style="border-top: 1px solid #000; padding-top: 5px;">(İmza)</p>
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
                            }}
                            className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg text-xs font-bold uppercase hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                            Yazdır
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 mt-6 md:mt-0 print:hidden">
                    <button
                        onClick={() => { setNewRecord({ ...newRecord, recordType: 'INCOME', category: 'TAHSILAT' }); setShowAddModal(true); }}
                        className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-xs rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all"
                    >
                        + Gelir Ekle
                    </button>
                    <button
                        onClick={() => { setNewRecord({ ...newRecord, recordType: 'EXPENSE', category: 'MASRAF' }); setShowAddModal(true); }}
                        className="px-6 py-3 bg-gray-600 dark:bg-gray-500 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all"
                    >
                        - Gider Ekle
                    </button>
                    <button
                        onClick={() => { setReceiptItems([]); setShowGoodsReceiptModal(true); }}
                        className="px-6 py-3 border-2 border-black dark:border-white text-black dark:text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:shadow-lg hover:-translate-y-1 transition-all"
                    >
                        Mal Kabul (Stok)
                    </button>
                </div>
            </div>


            {/* --- PRINTABLE SECTION REMOVED, USING IFRAME --- */}

            {/* --- PRINTABLE SECTION 2: GOODS RECEIPT (TESLİM TUTANAĞI) REMOVED FROM DOM, HANDLED BY IFRAME --- */}


            {/* Existing Grid for Screen (Hidden on Print) */}
            <div className="print:hidden">
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {/* Net Balance */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 relative overflow-hidden group">
                            <div className="relative z-10">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Net Kasa</div>
                                <div className={`text-3xl font-light ${summary.netBalance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                    {formatCurrency(summary.netBalance)}
                                </div>
                            </div>
                            <div className={`absolute right-0 bottom-0 w-24 h-24 rounded-tl-full opacity-10 ${summary.netBalance >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                        </div>

                        {/* Total Income */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 relative overflow-hidden group">
                            <div className="relative z-10">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Toplam Gelir</div>
                                <div className="text-3xl font-light text-green-500">{formatCurrency(summary.totalIncome)}</div>
                            </div>
                            <div className="absolute right-0 bottom-0 w-24 h-24 bg-green-500 rounded-tl-full opacity-5 group-hover:opacity-10 transition-opacity"></div>
                        </div>

                        {/* Total Expense */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 relative overflow-hidden group">
                            <div className="relative z-10">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Toplam Gider</div>
                                <div className="text-3xl font-light text-red-500">{formatCurrency(summary.totalExpense)}</div>
                            </div>
                            <div className="absolute right-0 bottom-0 w-24 h-24 bg-red-500 rounded-tl-full opacity-5 group-hover:opacity-10 transition-opacity"></div>
                        </div>

                        {/* Cash Breakdown */}
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 flex flex-col justify-center gap-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400 uppercase font-bold">Nakit</span>
                                <span className="font-mono font-bold dark:text-white">{formatCurrency(summary.cashBalance)}</span>
                            </div>
                            <div className="w-full h-px bg-gray-100 dark:bg-zinc-800"></div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400 uppercase font-bold">Kredi Kartı</span>
                                <span className="font-mono font-bold dark:text-white">{formatCurrency(summary.cardBalance)}</span>
                            </div>
                            <div className="w-full h-px bg-gray-100 dark:bg-zinc-800"></div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400 uppercase font-bold">Banka/Havale</span>
                                <span className="font-mono font-bold dark:text-white">{formatCurrency(summary.bankBalance)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Transactions List */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden print:hidden">
                <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-lg font-black uppercase tracking-tight dark:text-white">Hareketler</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-zinc-800/30 text-xs font-bold uppercase tracking-wider text-gray-400">
                                <th className="p-4 pl-6">Tür</th>
                                <th className="p-4">Kategori</th>
                                <th className="p-4">Açıklama</th>
                                <th className="p-4">Ödeme Yöntemi</th>
                                <th className="p-4 text-right">Tutar</th>
                                <th className="p-4 text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400 text-sm">Bu tarihte kayıt bulunamadı.</td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${record.recordType === 'INCOME'
                                                ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                                : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                                }`}>
                                                {record.recordType === 'INCOME' ? 'GELİR' : 'GİDER'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">{record.category}</td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400 font-medium">{record.description || '-'}</td>
                                        <td className="p-4 text-xs font-bold uppercase text-gray-500">{record.paymentMethod}</td>
                                        <td className={`p-4 text-right font-mono text-sm font-bold ${record.recordType === 'INCOME' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                            }`}>
                                            {record.recordType === 'INCOME' ? '+' : '-'}{formatCurrency(record.amount)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleDelete(record.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-2"
                                                title="Sil"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Record Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl transform transition-all scale-100">
                            <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
                                <h3 className="text-xl font-black text-black dark:text-white uppercase tracking-tight">
                                    {newRecord.recordType === 'INCOME' ? 'Yeni Gelir Ekle' : 'Yeni Gider Ekle'}
                                </h3>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Record Type Toggle */}
                                <div className="flex bg-gray-100 dark:bg-black p-1 rounded-xl">
                                    <button
                                        onClick={() => setNewRecord({ ...newRecord, recordType: 'INCOME' })}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${newRecord.recordType === 'INCOME' ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' : 'text-gray-400'}`}
                                    >
                                        Gelir
                                    </button>
                                    <button
                                        onClick={() => setNewRecord({ ...newRecord, recordType: 'EXPENSE' })}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${newRecord.recordType === 'EXPENSE' ? 'bg-white dark:bg-zinc-800 shadow-sm text-black dark:text-white' : 'text-gray-400'}`}
                                    >
                                        Gider
                                    </button>
                                </div>

                                {/* Category Select */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Kategori</label>
                                    <select
                                        value={newRecord.category}
                                        onChange={(e) => setNewRecord({ ...newRecord, category: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 dark:text-white"
                                    >
                                        {newRecord.recordType === 'INCOME' ? (
                                            <>
                                                <option value="TAHSILAT">TAHSİLAT (VERESİYE)</option>
                                                <option value="SATIS_DISI">SATIŞ DIŞI GELİR</option>
                                            </>
                                        ) : (
                                            <>
                                                {expenseCategories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                                <option value="MAL_KABUL">MAL KABUL (STOK)</option>
                                            </>
                                        )}
                                    </select>
                                    {newRecord.recordType === 'EXPENSE' && (
                                        <div className="text-right mt-1">
                                            <button onClick={() => setShowCategoryManager(true)} className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-wider">
                                                + Kategori Yönetimi
                                            </button>
                                        </div>
                                    )}

                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Tutar</label>
                                    <input
                                        type="number"
                                        value={newRecord.amount}
                                        onChange={(e) => setNewRecord({ ...newRecord, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl p-3 text-lg font-mono font-bold outline-none focus:border-blue-500 dark:text-white"
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Ödeme Yöntemi</label>
                                    <select
                                        value={newRecord.paymentMethod}
                                        onChange={(e) => setNewRecord({ ...newRecord, paymentMethod: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 dark:text-white"
                                    >
                                        <option value="NAKIT">NAKİT</option>
                                        <option value="KREDI_KARTI">KREDİ KARTI</option>
                                        <option value="BANKA_KARTI">BANKA KARTI</option>
                                        <option value="HAVALE">HAVALE/EFT</option>
                                    </select>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Açıklama / Firma Adı</label>
                                    <textarea
                                        value={newRecord.description}
                                        onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                                        rows={3}
                                        placeholder="Detay..."
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-medium outline-none focus:border-blue-500 dark:text-white resize-none"
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-zinc-800 flex gap-4">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleAddRecord}
                                    className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black font-bold uppercase tracking-widest text-xs rounded-xl hover:opacity-90 transition-opacity"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Mal Kabul Modal */}
            {
                showGoodsReceiptModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-black">
                                <h3 className="text-xl font-black text-black dark:text-white uppercase tracking-tight flex items-center gap-2">
                                    📦 Mal Kabul (Stok Girişi)
                                </h3>
                                <button onClick={() => setShowGoodsReceiptModal(false)} className="bg-gray-200 dark:bg-zinc-800 p-2 rounded-full hover:bg-gray-300 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                                {/* Left Side: Product Search / Add */}
                                <div className="w-full md:w-1/3 border-r border-gray-100 dark:border-zinc-800 flex flex-col bg-gray-50/50 dark:bg-zinc-900/50">
                                    {/* Tabs */}
                                    <div className="flex border-b border-gray-100 dark:border-zinc-800">
                                        <button
                                            onClick={() => setMkMode('SEARCH')}
                                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${mkMode === 'SEARCH' ? 'bg-white dark:bg-zinc-900 text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                        >
                                            Ürün Ara
                                        </button>
                                        <button
                                            onClick={() => setMkMode('NEW')}
                                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${mkMode === 'NEW' ? 'bg-white dark:bg-zinc-900 text-green-600 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                        >
                                            + Yeni Ürün
                                        </button>
                                    </div>

                                    {mkMode === 'SEARCH' ? (
                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="mb-4">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={searchTerm}
                                                    onChange={(e) => handleSearch(e.target.value)}
                                                    placeholder="Barkod veya İsim Ara..."
                                                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex-1 overflow-y-auto space-y-2">
                                                {searchResults.map(item => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => addToReceipt(item)}
                                                        className="bg-white dark:bg-black p-3 rounded-xl border border-gray-100 dark:border-zinc-800 cursor-pointer hover:border-blue-500 transition-all flex justify-between items-center group"
                                                    >
                                                        <div>
                                                            <div className="font-bold text-sm dark:text-white group-hover:text-blue-500 line-clamp-1">{item.name}</div>
                                                            <div className="text-xs font-mono text-gray-400">{item.sku}</div>
                                                        </div>
                                                        <div className="bg-gray-100 dark:bg-zinc-800 text-xs font-bold px-2 py-1 rounded text-gray-500">
                                                            +{item.quantity}
                                                        </div>
                                                    </div>
                                                ))}
                                                {searchTerm && searchResults.length === 0 && (
                                                    <div className="text-center">
                                                        <p className="text-gray-400 text-xs py-4">Ürün bulunamadı</p>
                                                        <button
                                                            onClick={() => {
                                                                setMkForm({ ...mkForm, sku: searchTerm, name: searchTerm });
                                                                setMkMode('NEW');
                                                            }}
                                                            className="text-blue-600 text-xs font-bold hover:underline"
                                                        >
                                                            Yeni Olarak Ekle?
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6 flex-1 overflow-y-auto space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Barkod</label>
                                                <input
                                                    value={mkForm.sku}
                                                    onChange={e => setMkForm({ ...mkForm, sku: e.target.value })}
                                                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-mono font-bold outline-none focus:border-green-500 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Ürün Adı</label>
                                                <input
                                                    value={mkForm.name}
                                                    onChange={e => setMkForm({ ...mkForm, name: e.target.value })}
                                                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-bold outline-none focus:border-green-500 dark:text-white"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Alış (Maliyet)</label>
                                                    <input
                                                        type="number"
                                                        value={mkForm.costPrice}
                                                        onChange={e => setMkForm({ ...mkForm, costPrice: e.target.value })}
                                                        className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-bold outline-none focus:border-green-500 dark:text-white"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Satış Fiyatı</label>
                                                    <input
                                                        type="number"
                                                        value={mkForm.sellPrice}
                                                        onChange={e => setMkForm({ ...mkForm, sellPrice: e.target.value })}
                                                        className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-bold outline-none focus:border-green-500 dark:text-white"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Giriş Miktarı</label>
                                                <input
                                                    type="number"
                                                    value={mkForm.quantity}
                                                    onChange={e => setMkForm({ ...mkForm, quantity: e.target.value })}
                                                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-bold outline-none focus:border-green-500 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Konum</label>
                                                <input
                                                    value={mkForm.location}
                                                    onChange={e => setMkForm({ ...mkForm, location: e.target.value })}
                                                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-bold outline-none focus:border-green-500 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Kategori</label>
                                                <input
                                                    value={mkForm.category}
                                                    onChange={e => setMkForm({ ...mkForm, category: e.target.value })}
                                                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-sm font-bold outline-none focus:border-green-500 dark:text-white"
                                                    list="cat-list"
                                                />
                                                <datalist id="cat-list">
                                                    <option value="Genel" />
                                                    <option value="Tekstil" />
                                                    <option value="Elektronik" />
                                                    <option value="Gıda" />
                                                </datalist>
                                            </div>

                                            <button
                                                onClick={handleQuickAddProduct}
                                                className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl mt-2 hover:opacity-90 transition-colors uppercase tracking-widest text-xs"
                                            >
                                                Kaydet ve Listeye Ekle
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Receipt List */}
                                <div className="flex-1 p-6 flex flex-col bg-white dark:bg-zinc-900">
                                    <div className="flex-1 overflow-y-auto mb-4">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-[10px] font-bold uppercase text-gray-400 border-b border-gray-100 dark:border-zinc-800">
                                                    <th className="pb-2">Ürün</th>
                                                    <th className="pb-2 w-24">Adet</th>
                                                    <th className="pb-2 w-32">Alış Fiyatı</th>
                                                    <th className="pb-2 w-32 text-right">Toplam</th>
                                                    <th className="pb-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                                {receiptItems.map((item) => (
                                                    <tr key={item.item.id} className="group">
                                                        <td className="py-3 pr-2">
                                                            <div className="font-bold text-sm dark:text-white">{item.item.name}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono">{item.item.sku}</div>
                                                        </td>
                                                        <td className="py-3 pr-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={(e) => updateReceiptItem(item.item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-sm font-bold text-center outline-none focus:border-blue-500"
                                                            />
                                                        </td>
                                                        <td className="py-3 pr-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={item.buyPrice}
                                                                onChange={(e) => updateReceiptItem(item.item.id, 'buyPrice', parseFloat(e.target.value) || 0)}
                                                                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-sm font-bold text-center outline-none focus:border-blue-500"
                                                            />
                                                        </td>
                                                        <td className="py-3 text-right font-mono font-bold text-sm dark:text-white">
                                                            {formatCurrency(item.quantity * item.buyPrice)}
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <button
                                                                onClick={() => removeFromReceipt(item.item.id)}
                                                                className="text-gray-300 hover:text-red-500 transition-colors"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {receiptItems.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="py-10 text-center text-gray-400 text-sm">
                                                            Henüz ürün eklenmedi. Soldaki panelden ürün arayıp ekleyin.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-black rounded-2xl p-5 border border-gray-100 dark:border-zinc-800">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-lg font-bold uppercase text-gray-500">Genel Toplam</span>
                                            <span className="text-3xl font-black text-black dark:text-white tracking-tighter">
                                                {formatCurrency(calculateReceiptTotal())}
                                            </span>
                                        </div>

                                        {/* Invoice Details Section */}
                                        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-100 dark:bg-zinc-800/50 rounded-xl border border-dashed border-gray-200 dark:border-zinc-700">
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Tedarikçi (Cari)</label>
                                                <select
                                                    value={selectedSupplierId}
                                                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                                                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500 dark:text-white"
                                                >
                                                    <option value="">-- Genel (Seçilmedi) --</option>
                                                    {suppliers.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Fatura No / Açıklama</label>
                                                <input
                                                    value={invoiceNo}
                                                    onChange={(e) => setInvoiceNo(e.target.value)}
                                                    placeholder="Belge No..."
                                                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500 dark:text-white"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Ödeme Yöntemi</label>
                                                <select
                                                    value={newRecord.paymentMethod}
                                                    onChange={(e) => setNewRecord({ ...newRecord, paymentMethod: e.target.value })}
                                                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 dark:text-white"
                                                >
                                                    <option value="NAKIT">NAKİT (KASADAN)</option>
                                                    <option value="BANKA_KARTI">BANKA KARTI</option>
                                                    <option value="HAVALE">HAVALE/EFT</option>
                                                    <option value="KREDI_KARTI">KREDİ KARTI</option>
                                                    <option value="VADELI">VADELİ (CARİ)</option>
                                                </select>
                                            </div>
                                            <button
                                                onClick={handlePrintDraft}
                                                disabled={receiptItems.length === 0}
                                                className="px-4 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-sm uppercase tracking-wider hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                Yazdır
                                            </button>
                                            <button
                                                onClick={handleGoodsReceiptSubmit}
                                                disabled={receiptItems.length === 0}
                                                className="flex-1 bg-green-600 text-white font-bold rounded-xl text-sm uppercase tracking-wider hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-1 transform transition-all"
                                            >
                                                Onayla ve Stoklara İşle
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Manage Categories Modal */}
            {
                showCategoryManager && (
                    <ManageCategoriesModal
                        onClose={() => setShowCategoryManager(false)}
                        categories={expenseCategories}
                        onReload={loadExpenseCategories}
                    />
                )
            }

            {/* Success / Print Modal */}
            {
                showSuccessModal && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">İşlem Başarılı!</h3>
                            <p className="text-gray-500 dark:text-zinc-400 mb-8 text-sm">Mal kabul işlemi kaydedildi ve stoklar güncellendi. Teslim tutanağı yazdırmak ister misiniz?</p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowSuccessModal(false); }}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    Kapat
                                </button>
                                <button
                                    onClick={handlePrintReceipt}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    Yazdır
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
};

export default FinancePage;