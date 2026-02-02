import React, { useState, useEffect, useMemo } from 'react';
import { tauriInvoke, isTauri } from '../services/tauriService';

interface InventoryItem {
    id: string;
    sku: string;
    name: string;
    category: string;
    price: number;
    costPrice?: number;
    image?: string;
    description?: string;
    location?: string;
    quantity?: number;
    lastUpdated?: string;
    currency?: string;
    supplierId?: string;
    brand?: string;
}

interface Category {
    id: string;
    name: string;
    parentId: string | null;
}

interface CurrentAccount {
    id: string;
    name: string;
    accountType: string;
}

// Round price to nearest 5 (5+ → 10, 2+ → 5, else keep)
const roundPrice = (price: number): number => {
    const intPart = Math.floor(price);
    const decimal = price - intPart;

    // Get the last digit
    const lastDigit = intPart % 10;

    // Round based on last digit
    let roundedInt = intPart;
    if (lastDigit >= 5) {
        roundedInt = intPart + (10 - lastDigit); // Round up to next 10
    } else if (lastDigit >= 2) {
        roundedInt = intPart + (5 - lastDigit); // Round up to 5
    }
    // If lastDigit < 2, keep as is (or round to 0)

    // If there's a decimal, round up
    if (decimal > 0) {
        if (lastDigit >= 5) {
            roundedInt = intPart + (10 - lastDigit);
        } else if (lastDigit >= 2 || decimal >= 0.5) {
            roundedInt = intPart + (5 - lastDigit);
        } else {
            roundedInt = intPart + 1;
        }
    }

    return roundedInt;
};

const BulkPriceUpdate: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [formData, setFormData] = useState({
        // Combined filters (all can be active at same time)
        filterCategory: '',
        filterBrand: '',
        filterCari: '',
        changeType: 'PERCENTAGE', // PERCENTAGE, FIXED
        changeDirection: 'INCREASE', // INCREASE, DECREASE
        amount: 0,
        roundPrices: true // New option for rounding
    });

    // Load items and current accounts from database
    useEffect(() => {
        const loadData = async () => {
            try {
                if (isTauri()) {
                    const invItems = await tauriInvoke<InventoryItem[]>('get_all_items');
                    setItems(invItems);

                    try {
                        const accounts = await tauriInvoke<CurrentAccount[]>('get_current_accounts');
                        setCurrentAccounts(accounts);
                    } catch (e) {
                        console.log('No current accounts loaded');
                    }

                    try {
                        const cats = await tauriInvoke<Category[]>('get_categories');
                        setCategories(cats);
                    } catch (e) {
                        console.log('No categories loaded');
                    }
                }
            } catch (err) {
                console.error('Failed to load data:', err);
            }
        };
        loadData();
    }, []);

    // Get child category IDs for a parent category
    const getChildCategoryIds = (parentCategoryName: string): string[] => {
        // Find the parent category
        const parentCat = categories.find(c => c.name === parentCategoryName);
        if (!parentCat) return [parentCategoryName];

        // Find all children
        const childNames = categories
            .filter(c => c.parentId === parentCat.id)
            .map(c => c.name);

        // Return parent + all children
        return [parentCategoryName, ...childNames];
    };

    // Build hierarchical category list for display
    const hierarchicalCategories = useMemo(() => {
        const result: { name: string; isParent: boolean; displayName: string }[] = [];

        // Get parent categories (no parentId)
        const parents = categories.filter(c => !c.parentId).sort((a, b) => a.name.localeCompare(b.name));

        parents.forEach(parent => {
            // Add parent
            result.push({ name: parent.name, isParent: true, displayName: parent.name });

            // Add children
            const children = categories
                .filter(c => c.parentId === parent.id)
                .sort((a, b) => a.name.localeCompare(b.name));

            children.forEach(child => {
                result.push({ name: child.name, isParent: false, displayName: `    └─ ${child.name}` });
            });
        });

        // Add orphan categories (categories without parents that are not in the parent list)
        const allCategoryNames = new Set(items.map(i => i.category).filter(Boolean));
        const listedNames = new Set(result.map(r => r.name));
        allCategoryNames.forEach(catName => {
            if (!listedNames.has(catName)) {
                result.push({ name: catName, isParent: false, displayName: catName });
            }
        });

        return result;
    }, [categories, items]);

    // Extract unique brands from actual brand field
    const uniqueBrands = useMemo(() => {
        const brands = new Set<string>();
        items.forEach(item => {
            if (item.brand && item.brand.trim()) {
                brands.add(item.brand.trim());
            }
        });
        return Array.from(brands).sort();
    }, [items]);

    // Filter items with combined filters (AND logic)
    useEffect(() => {
        let filtered = [...items];

        // Filter by category (hierarchical - include children if parent selected)
        if (formData.filterCategory) {
            const selectedCat = hierarchicalCategories.find(c => c.name === formData.filterCategory);
            if (selectedCat?.isParent) {
                // Parent selected - include all children
                const allowedCategories = getChildCategoryIds(formData.filterCategory);
                filtered = filtered.filter(i => allowedCategories.includes(i.category));
            } else {
                // Child selected - exact match
                filtered = filtered.filter(i => i.category === formData.filterCategory);
            }
        }

        // Filter by brand (using actual brand field)
        if (formData.filterBrand) {
            filtered = filtered.filter(i => i.brand === formData.filterBrand);
        }

        // Filter by cari
        if (formData.filterCari) {
            filtered = filtered.filter(i => i.supplierId === formData.filterCari);
        }

        setFilteredItems(filtered);
        setSelectedIds(new Set(filtered.map(i => i.id)));
    }, [formData.filterCategory, formData.filterBrand, formData.filterCari, items, hierarchicalCategories]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : (name === 'amount' ? parseFloat(value) || 0 : value)
        }));
    };

    const clearFilters = () => {
        setFormData(prev => ({
            ...prev,
            filterCategory: '',
            filterBrand: '',
            filterCari: ''
        }));
    };

    const toggleItem = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(filteredItems.map(i => i.id)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    // Calculate new price with optional rounding
    const calculateNewPrice = (originalPrice: number): number => {
        const changeAmount = formData.changeType === 'PERCENTAGE'
            ? originalPrice * (formData.amount / 100)
            : formData.amount;

        let newPrice: number;
        if (formData.changeDirection === 'INCREASE') {
            newPrice = originalPrice + changeAmount;
        } else {
            newPrice = Math.max(0, originalPrice - changeAmount);
        }

        // Apply rounding if enabled
        if (formData.roundPrices) {
            newPrice = roundPrice(newPrice);
        }

        return newPrice;
    };

    const selectedItems = filteredItems.filter(i => selectedIds.has(i.id));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedItems.length === 0) {
            setError('En az bir ürün seçmelisiniz.');
            return;
        }

        if (formData.amount <= 0) {
            setError('Değişim miktarı 0\'dan büyük olmalı.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (isTauri()) {
                for (const item of selectedItems) {
                    const newPrice = calculateNewPrice(item.price);
                    await tauriInvoke('update_item', {
                        item: {
                            ...item,
                            price: newPrice,
                            lastUpdated: new Date().toISOString()
                        }
                    });
                }
            }

            setSuccess(`${selectedItems.length} ürünün fiyatı güncellendi!`);

            if (isTauri()) {
                const invItems = await tauriInvoke<InventoryItem[]>('get_all_items');
                setItems(invItems);
            }
        } catch (err) {
            console.error(err);
            setError('Güncelleme sırasında bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col overflow-y-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Toplu Fiyat Güncelleme</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Ürünleri seçin ve fiyatlarını toplu olarak güncelleyin.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl flex-1">
                {/* Left: Filter + Product List */}
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

                    {/* Filter */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Filtre</h3>
                            {(formData.filterCategory || formData.filterBrand || formData.filterCari) && (
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                                >
                                    Filtreleri Temizle
                                </button>
                            )}
                        </div>

                        {/* Combined Filter Dropdowns */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Category Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5 uppercase">Kategori</label>
                                <select
                                    name="filterCategory"
                                    value={formData.filterCategory}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"
                                >
                                    <option value="">Tümü</option>
                                    {hierarchicalCategories.map(cat => (
                                        <option key={cat.name} value={cat.name} style={{ fontWeight: cat.isParent ? 'bold' : 'normal' }}>
                                            {cat.displayName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Brand Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5 uppercase">Marka</label>
                                <select
                                    name="filterBrand"
                                    value={formData.filterBrand}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"
                                >
                                    <option value="">Tümü</option>
                                    {uniqueBrands.map(brand => (
                                        <option key={brand} value={brand}>{brand}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Cari Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5 uppercase">Cari (Tedarikçi)</label>
                                <select
                                    name="filterCari"
                                    value={formData.filterCari}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm"
                                    disabled={currentAccounts.length === 0}
                                >
                                    <option value="">Tümü</option>
                                    {currentAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                                {currentAccounts.length === 0 && (
                                    <p className="text-xs text-amber-500 mt-1">Henüz cari kaydı yok</p>
                                )}
                            </div>
                        </div>

                        {/* Active Filters Display */}
                        {(formData.filterCategory || formData.filterBrand || formData.filterCari) && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {formData.filterCategory && (
                                    <span className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black text-xs rounded-lg font-medium">
                                        Kategori: {formData.filterCategory}
                                    </span>
                                )}
                                {formData.filterBrand && (
                                    <span className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black text-xs rounded-lg font-medium">
                                        Marka: {formData.filterBrand}
                                    </span>
                                )}
                                {formData.filterCari && (
                                    <span className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black text-xs rounded-lg font-medium">
                                        Cari: {currentAccounts.find(a => a.id === formData.filterCari)?.name}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Product List */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                Ürünler ({selectedIds.size}/{filteredItems.length} seçili)
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={selectAll}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
                                >
                                    Tümünü Seç
                                </button>
                                <button
                                    onClick={deselectAll}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
                                >
                                    Seçimi Kaldır
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {filteredItems.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 dark:text-zinc-500">
                                    <p>Ürün bulunamadı.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {filteredItems.map(item => {
                                        const isSelected = selectedIds.has(item.id);
                                        const newPrice = calculateNewPrice(item.price);

                                        return (
                                            <label
                                                key={item.id}
                                                className={`flex items-center gap-4 px-6 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all ${isSelected ? 'bg-gray-50 dark:bg-zinc-800/30' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleItem(item.id)}
                                                    className="w-5 h-5 rounded border-gray-300 dark:border-zinc-600 text-black dark:text-white accent-black dark:accent-white"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-zinc-400">{item.sku} • {item.category}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-gray-400 dark:text-zinc-500">₺{item.price.toFixed(2)}</p>
                                                    {formData.amount > 0 && isSelected && (
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            → ₺{newPrice.toFixed(2)}
                                                        </p>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Price Settings */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 sticky top-6">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Fiyat Ayarları</h3>

                        <div className="space-y-4">
                            {/* Direction */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">İşlem</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, changeDirection: 'INCREASE' }))}
                                        className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-all border ${formData.changeDirection === 'INCREASE'
                                            ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                            : 'bg-transparent text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700'
                                            }`}
                                    >
                                        ↑ Zam
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, changeDirection: 'DECREASE' }))}
                                        className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-all border ${formData.changeDirection === 'DECREASE'
                                            ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                            : 'bg-transparent text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700'
                                            }`}
                                    >
                                        ↓ İndirim
                                    </button>
                                </div>
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Tip</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, changeType: 'PERCENTAGE' }))}
                                        className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-all border ${formData.changeType === 'PERCENTAGE'
                                            ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                            : 'bg-transparent text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700'
                                            }`}
                                    >
                                        Yüzde (%)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, changeType: 'FIXED' }))}
                                        className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-all border ${formData.changeType === 'FIXED'
                                            ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                                            : 'bg-transparent text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700'
                                            }`}
                                    >
                                        Sabit (₺)
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                    Miktar {formData.changeType === 'PERCENTAGE' ? '(%)' : '(₺)'}
                                </label>
                                <input
                                    type="number"
                                    name="amount"
                                    min="0"
                                    step={formData.changeType === 'PERCENTAGE' ? '1' : '0.01'}
                                    value={formData.amount}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-lg font-medium text-center"
                                    placeholder="0"
                                />
                            </div>

                            {/* Round prices option */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="roundPrices"
                                    checked={formData.roundPrices}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded border-gray-300 dark:border-zinc-600 accent-black dark:accent-white"
                                />
                                <span className="text-sm text-gray-700 dark:text-zinc-300">
                                    Fiyatları yuvarla (5'e/10'a)
                                </span>
                            </label>
                        </div>

                        <hr className="my-5 border-gray-100 dark:border-zinc-800" />

                        {/* Summary */}
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Seçili Ürün</span>
                                <span className="text-gray-900 dark:text-white font-medium">{selectedIds.size}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-zinc-400">Değişim</span>
                                <span className="text-gray-900 dark:text-white font-medium">
                                    {formData.changeDirection === 'INCREASE' ? '+' : '-'}
                                    {formData.amount}{formData.changeType === 'PERCENTAGE' ? '%' : '₺'}
                                </span>
                            </div>
                            {formData.roundPrices && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500 dark:text-zinc-400">Yuvarlama</span>
                                    <span className="text-gray-900 dark:text-white font-medium">Aktif</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading || selectedIds.size === 0 || formData.amount <= 0}
                            className={`mt-5 w-full py-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold transition-all flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 ${(loading || selectedIds.size === 0 || formData.amount <= 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Güncelleniyor...' : `${selectedIds.size} Ürünü Güncelle`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkPriceUpdate;
