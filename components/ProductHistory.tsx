import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem } from '../types';
import { tauriInvoke, isTauri } from '../services/tauriService';

interface Transaction {
    id: string;
    items: Array<{ id: string; sku: string; name: string; cartQuantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    transactionType: string;
    status: string;
    createdAt: string;
}

interface CurrentAccount {
    id: string;
    name: string;
    accountType: string;
}

interface InventoryLot {
    id: string;
    productId: string;
    supplierId?: string;
    supplierName?: string;
    quantity: number;
    initialQuantity: number;
    buyPrice: number;
    sellPrice?: number;
    receiptDate: string;
    invoiceNo?: string;
    createdAt: string;
}

interface ProductHistoryProps {
    selectedProductId?: string;
    onBack?: () => void;
}

interface Category {
    id: string;
    name: string;
    parentId: string | null;
}

const ProductHistory: React.FC<ProductHistoryProps> = ({ selectedProductId, onBack }) => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
    const [productLots, setProductLots] = useState<InventoryLot[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Selected product for detail view
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

    // Filters
    const [filterCategory, setFilterCategory] = useState<string>('');
    const [filterBrand, setFilterBrand] = useState<string>('');
    const [filterCari, setFilterCari] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                if (isTauri()) {
                    const invItems = await tauriInvoke<InventoryItem[]>('get_all_items');
                    setItems(invItems);

                    const txns = await tauriInvoke<Transaction[]>('get_transactions');
                    setTransactions(txns);

                    try {
                        const accounts = await tauriInvoke<CurrentAccount[]>('get_current_accounts');
                        setCurrentAccounts(accounts);
                    } catch { }

                    // Load categories for display
                    try {
                        const cats = await tauriInvoke<{ id: string; name: string; parentId: string | null }[]>('get_categories');
                        setCategories(cats);
                    } catch { }

                    // Auto-select if selectedProductId is provided via prop or sessionStorage
                    const storedId = selectedProductId || sessionStorage.getItem('selectedProductId');
                    if (storedId) {
                        const found = invItems.find(i => i.id === storedId);
                        if (found) setSelectedItem(found);
                        sessionStorage.removeItem('selectedProductId'); // Clear after use
                    }
                }
            } catch (err) {
                console.error('Failed to load data:', err);
            }
            setLoading(false);
        };
        loadData();
    }, [selectedProductId]);

    // Load lots when selectedItem changes
    useEffect(() => {
        const loadLots = async () => {
            if (selectedItem && isTauri()) {
                try {
                    const lots = await tauriInvoke<InventoryLot[]>('get_product_lots', { productId: selectedItem.id });
                    setProductLots(lots);
                } catch (err) {
                    console.log('No lots found:', err);
                    setProductLots([]);
                }
            } else {
                setProductLots([]);
            }
        };
        loadLots();
    }, [selectedItem]);

    // Extract unique categories and brands
    const uniqueCategories = useMemo(() => {
        const cats = new Set(items.map(i => i.category).filter(Boolean));
        return Array.from(cats).sort();
    }, [items]);

    const uniqueBrands = useMemo(() => {
        const brands = new Set<string>();
        items.forEach(item => {
            if (item.brand && item.brand.trim()) {
                brands.add(item.brand.trim());
            }
        });
        return Array.from(brands).sort();
    }, [items]);

    // Filter items
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (filterCategory && item.category !== filterCategory) return false;
            if (filterBrand && item.brand !== filterBrand) return false;
            if (filterCari && item.supplierId !== filterCari) return false;
            return true;
        });
    }, [items, filterCategory, filterBrand, filterCari]);

    // Get transactions for selected item
    const itemTransactions = useMemo(() => {
        if (!selectedItem) return [];

        return transactions.filter(tx => {
            // Check if transaction is within date range
            const txDate = new Date(tx.createdAt);
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            to.setHours(23, 59, 59);

            if (txDate < from || txDate > to) return false;

            // Check if transaction contains the selected item
            return tx.items.some(item => item.id === selectedItem.id || item.sku === selectedItem.sku);
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [selectedItem, transactions, dateFrom, dateTo]);

    // Calculate statistics
    const stats = useMemo(() => {
        if (!selectedItem || itemTransactions.length === 0) {
            return { totalSold: 0, totalRevenue: 0, totalPurchased: 0, totalReturned: 0, avgPrice: 0 };
        }

        let totalSold = 0;
        let totalRevenue = 0;
        let totalPurchased = 0;
        let totalReturned = 0;

        itemTransactions.forEach(tx => {
            const item = tx.items.find(i => i.id === selectedItem.id || i.sku === selectedItem.sku);
            if (item) {
                if (tx.transactionType === 'SALE') {
                    totalSold += item.cartQuantity;
                    totalRevenue += item.cartQuantity * item.price;
                } else if (tx.transactionType === 'RETURN') {
                    totalReturned += item.cartQuantity;
                } else if (tx.transactionType === 'PURCHASE') {
                    totalPurchased += item.cartQuantity;
                }
            }
        });

        return {
            totalSold,
            totalRevenue,
            totalPurchased,
            totalReturned,
            avgPrice: totalSold > 0 ? totalRevenue / totalSold : 0
        };
    }, [selectedItem, itemTransactions]);

    // Get brand from item (using actual brand field)
    const getBrand = (item: InventoryItem) => {
        return item.brand || '-';
    };

    // Get category display with parent-child format (e.g., "Boya - İç Cephe")
    const getCategoryDisplay = (categoryName: string) => {
        // Find the category by name
        const category = categories.find(c => c.name === categoryName);
        if (!category) return categoryName || '-';

        // If it has a parent, show as "Parent - Child"
        if (category.parentId) {
            const parent = categories.find(c => c.id === category.parentId);
            if (parent) {
                return `${parent.name} - ${category.name}`;
            }
        }

        return category.name;
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-full">
                <div className="text-gray-500 dark:text-zinc-400 animate-pulse">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <svg className="w-5 h-5 text-gray-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ürün Ekstresi</h1>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Ürün bazlı hareket geçmişi ve istatistikler</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left: Product List */}
                <div className="w-80 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
                    {/* Filters */}
                    <div className="p-4 border-b border-gray-200 dark:border-zinc-800 space-y-3">
                        <select
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm"
                        >
                            <option value="">Tüm Kategoriler</option>
                            {/* Sort categories to show hierarchy if possible */}
                            {categories.length > 0 ? (
                                categories
                                    .filter(c => !c.parentId) // Main categories
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(main => {
                                        const sub = categories.filter(c => c.parentId === main.id).sort((a, b) => a.name.localeCompare(b.name));
                                        return (
                                            <React.Fragment key={main.id}>
                                                <option value={main.name}>{main.name}</option>
                                                {sub.map(s => (
                                                    <option key={s.id} value={s.name}>&nbsp;&nbsp;&nbsp;↳ {s.name}</option>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })
                            ) : (
                                uniqueCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))
                            )}
                        </select>
                        <select
                            value={filterBrand}
                            onChange={e => setFilterBrand(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm"
                        >
                            <option value="">Tüm Markalar</option>
                            {uniqueBrands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>
                        <select
                            value={filterCari}
                            onChange={e => setFilterCari(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm"
                            disabled={currentAccounts.length === 0}
                        >
                            <option value="">Tüm Cariler</option>
                            {currentAccounts.filter(a => a.accountType === 'SUPPLIER').map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Product List */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredItems.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 dark:text-zinc-600">
                                Ürün bulunamadı
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {filteredItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        className={`w-full p-4 text-left transition-colors ${selectedItem?.id === item.id
                                            ? 'bg-gray-100 dark:bg-zinc-800'
                                            : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-200 dark:bg-zinc-700 rounded-lg overflow-hidden flex-shrink-0">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">IMG</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-zinc-400">{item.sku}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">₺{item.price.toFixed(0)}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Detail View */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!selectedItem ? (
                        <div className="h-full flex items-center justify-center text-gray-400 dark:text-zinc-600">
                            <div className="text-center">
                                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p>Detay görüntülemek için sol listeden bir ürün seçin</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 max-w-4xl">
                            {/* Product Header */}
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800">
                                <div className="flex gap-6">
                                    <div className="w-24 h-24 bg-gray-100 dark:bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0">
                                        {selectedItem.image ? (
                                            <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">GÖRSEL</div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedItem.name}</h2>
                                        <div className="flex flex-wrap gap-3 mt-2">
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs font-medium text-gray-600 dark:text-zinc-400">
                                                Barkod: {selectedItem.sku}
                                            </span>
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs font-medium text-gray-600 dark:text-zinc-400">
                                                Marka: {getBrand(selectedItem)}
                                            </span>
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs font-medium text-gray-600 dark:text-zinc-400">
                                                Kategori: {getCategoryDisplay(selectedItem.category)}
                                            </span>
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs font-medium text-gray-600 dark:text-zinc-400">
                                                Konum: {selectedItem.location || '-'}
                                            </span>
                                            {selectedItem.supplierId && (
                                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-xs font-medium text-blue-600 dark:text-blue-400">
                                                    Cari/Tedarikçi: {currentAccounts.find(a => a.id === selectedItem.supplierId)?.name || 'Bilinmiyor'}
                                                </span>
                                            )}
                                            {!selectedItem.supplierId && (
                                                <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs font-medium text-gray-400 dark:text-zinc-500">
                                                    Cari: Belirtilmemiş
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-bold text-gray-900 dark:text-white">₺{selectedItem.price.toFixed(2)}</p>
                                        <p className="text-sm text-gray-500 dark:text-zinc-400">Satış Fiyatı</p>
                                        {selectedItem.costPrice && selectedItem.costPrice > 0 && (
                                            <p className="text-sm text-gray-400 mt-1">Alış: ₺{selectedItem.costPrice.toFixed(2)}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
                                    <p className="text-xs text-gray-400 dark:text-zinc-500 uppercase font-bold">Mevcut Stok</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{selectedItem.quantity}</p>
                                </div>
                                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
                                    <p className="text-xs text-green-600 dark:text-green-400 uppercase font-bold">Toplam Alım</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.totalPurchased} adet</p>
                                </div>
                                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold">Toplam Satış</p>
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.totalSold} adet</p>
                                </div>
                                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
                                    <p className="text-xs text-gray-400 dark:text-zinc-500 uppercase font-bold">Toplam Gelir</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">₺{stats.totalRevenue.toFixed(0)}</p>
                                </div>
                                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
                                    <p className="text-xs text-orange-600 dark:text-orange-400 uppercase font-bold">İade</p>
                                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{stats.totalReturned} adet</p>
                                </div>
                            </div>

                            {/* Date Range */}
                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Tarih Aralığı:</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={e => setDateFrom(e.target.value)}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={e => setDateTo(e.target.value)}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-sm"
                                    />
                                </div>
                            </div>

                            {/* Lot/Parti Takibi */}
                            {productLots.length > 0 && (
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            <svg className="w-5 h-5 text-gray-700 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                            Lot/Parti Takibi ({productLots.length})
                                        </h3>
                                        <span className="text-xs text-gray-500 dark:text-zinc-400">FIFO - İlk giren ilk çıkar</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 dark:bg-zinc-800/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Tarih</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Tedarikçi</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Fatura No</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Giriş</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Kalan</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Alış ₺</th>
                                                    <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Satış ₺</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                                {productLots.map((lot, idx) => (
                                                    <tr key={lot.id} className={`${idx === 0 ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                                                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                                                            {new Date(lot.receiptDate).toLocaleDateString('tr-TR')}
                                                            {idx === 0 && <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">• Sırada</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600 dark:text-zinc-300">
                                                            {lot.supplierName || <span className="text-gray-400">-</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">
                                                            {lot.invoiceNo || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                                            {lot.initialQuantity}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={`font-bold ${lot.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                                                {lot.quantity}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-gray-600 dark:text-zinc-300">
                                                            ₺{lot.buyPrice.toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-medium">
                                                            {lot.sellPrice ? `₺${lot.sellPrice.toFixed(2)}` : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Transaction History */}
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">İşlem Geçmişi ({itemTransactions.length})</h3>
                                </div>

                                {itemTransactions.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 dark:text-zinc-600">
                                        Bu tarih aralığında işlem bulunamadı.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
                                        {itemTransactions.map(tx => {
                                            const txItem = tx.items.find(i => i.id === selectedItem.id || i.sku === selectedItem.sku);
                                            if (!txItem) return null;

                                            const isSale = tx.transactionType === 'SALE';
                                            const isPurchase = tx.transactionType === 'PURCHASE';
                                            const isReturn = tx.transactionType === 'RETURN';

                                            const getTypeLabel = () => {
                                                if (isSale) return 'Satış';
                                                if (isPurchase) return 'Mal Kabul';
                                                if (isReturn) return 'İade';
                                                return tx.transactionType;
                                            };

                                            const getTypeStyle = () => {
                                                if (isSale) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
                                                if (isPurchase) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
                                                if (isReturn) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
                                                return 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-400';
                                            };

                                            const getQuantityPrefix = () => {
                                                if (isSale) return '-';
                                                if (isPurchase) return '+';
                                                if (isReturn) return '+';
                                                return '';
                                            };

                                            return (
                                                <div key={tx.id} className="px-6 py-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${getTypeStyle()}`}>
                                                            {getTypeLabel()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {getQuantityPrefix()}{txItem.cartQuantity} adet
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-zinc-400">
                                                                {new Date(tx.createdAt).toLocaleDateString('tr-TR')} {new Date(tx.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                            ₺{(txItem.cartQuantity * txItem.price).toFixed(2)}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-zinc-400">
                                                            @ ₺{txItem.price.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductHistory;
