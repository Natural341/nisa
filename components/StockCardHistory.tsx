
import React, { useState, useEffect, useRef } from 'react';
import { tauriInvoke, isTauri } from '../services/tauriService';

interface StockCard {
    id: string;
    barcode: string;
    name: string;
    brand: string | null;
    unit: string;
    categoryId: string | null;
    description: string | null;
    image: string | null;
    supplierId: string | null;
    createdAt: string;
    updatedAt: string;
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

interface StockCardHistoryProps {
    selectedCardId: string;
    onBack: () => void;
    onUpdate: () => void;
}

const StockCardHistory: React.FC<StockCardHistoryProps> = ({ selectedCardId, onBack, onUpdate }) => {
    const [card, setCard] = useState<StockCard | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [currentAccounts, setCurrentAccounts] = useState<CurrentAccount[]>([]);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        barcode: '',
        name: '',
        brand: '',
        unit: 'ADET',
        categoryId: '',
        supplierId: '',
        description: '',
        image: ''
    });

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                if (isTauri()) {
                    // Load categories
                    const backendCategories = await tauriInvoke<{ id: string; name: string; parentId: string | null }[]>('get_categories');
                    const mapped = backendCategories.map(c => ({
                        id: c.id,
                        name: c.name,
                        parentId: c.parentId
                    }));
                    setCategories(mapped);

                    // Load accounts
                    const accounts = await tauriInvoke<CurrentAccount[]>('get_current_accounts');
                    setCurrentAccounts(accounts.filter(a => a.accountType === 'SUPPLIER' || a.accountType === 'BOTH'));

                    // Load Stock Cards and find the selected one
                    // Note: Ideally we should have get_stock_card_by_id, but for now we fetch all
                    const allCards = await tauriInvoke<StockCard[]>('get_stock_cards');
                    const found = allCards.find(c => c.id === selectedCardId);

                    if (found) {
                        setCard(found);
                        setFormData({
                            barcode: found.barcode,
                            name: found.name,
                            brand: found.brand || '',
                            unit: found.unit,
                            categoryId: found.categoryId || '',
                            supplierId: found.supplierId || '',
                            description: found.description || '',
                            image: found.image || ''
                        });
                        setImagePreview(found.image);
                    }
                }
            } catch (err) {
                console.error('Failed to load data:', err);
            }
            setLoading(false);
        };
        loadData();
    }, [selectedCardId]);

    const getMainCategories = () => categories.filter(c => !c.parentId);
    const getSubCategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setImagePreview(base64String);
                setFormData(prev => ({ ...prev, image: base64String }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!card) return;

        setSaving(true);
        try {
            if (isTauri()) {
                await tauriInvoke('update_stock_card', {
                    data: {
                        id: card.id,
                        ...formData,
                        brand: formData.brand || null,
                        categoryId: formData.categoryId || null,
                        supplierId: formData.supplierId || null,
                        description: formData.description || null,
                        image: formData.image || null
                    }
                });
                onUpdate(); // Refresh parent list
                onBack(); // Go back to list
                alert('Stok kartı güncellendi!');
            }
        } catch (err) {
            console.error(err);
            alert('Güncelleme sırasında hata oluştu.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin text-blue-500 text-4xl">✦</div>
            </div>
        );
    }

    if (!card) {
        return <div className="p-8 text-center text-red-500">Stok kartı bulunamadı.</div>;
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-400"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{card.name}</h1>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">Stok Kartı Detayı ve Düzenleme</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-gray-200 dark:border-zinc-800 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Column - Image & Basic Info */}
                            <div className="space-y-6">
                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Ürün Görseli</label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="relative group cursor-pointer border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-4 transition-all hover:border-black dark:hover:border-white h-64 flex items-center justify-center bg-gray-50 dark:bg-zinc-800/50 overflow-hidden"
                                    >
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="text-center">
                                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">Görsel Yükle</p>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <p className="text-white font-bold">Resmi Değiştir</p>
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageChange}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                </div>

                                {/* Barkod */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">BARKOD / SKU</label>
                                    <input
                                        type="text"
                                        name="barcode"
                                        required
                                        value={formData.barcode}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-mono text-lg focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                                    />
                                </div>
                            </div>

                            {/* Right Column - Details */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">STOK KARTI ADI</label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white text-lg focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">MARKA</label>
                                        <input
                                            type="text"
                                            name="brand"
                                            value={formData.brand}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">BİRİM</label>
                                        <select
                                            name="unit"
                                            value={formData.unit}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                                        >
                                            <option value="ADET">ADET</option>
                                            <option value="KG">KG</option>
                                            <option value="METRE">METRE</option>
                                            <option value="PAKET">PAKET</option>
                                            <option value="KOLİ">KOLİ</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">KATEGORİ</label>
                                    <select
                                        name="categoryId"
                                        value={formData.categoryId}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                                    >
                                        <option value="">Seçiniz...</option>
                                        {getMainCategories().map(mainCat => (
                                            <optgroup key={mainCat.id} label={mainCat.name}>
                                                <option value={mainCat.id}>{mainCat.name}</option>
                                                {getSubCategories(mainCat.id).map(subCat => (
                                                    <option key={subCat.id} value={subCat.id}>
                                                        &nbsp;&nbsp;↳ {subCat.name}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>



                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-2">AÇIKLAMA</label>
                                    <textarea
                                        name="description"
                                        rows={3}
                                        value={formData.description}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-4 border-t border-gray-100 dark:border-zinc-800 pt-6">
                            <button
                                type="button"
                                onClick={onBack}
                                className="px-6 py-3 rounded-xl text-gray-600 dark:text-zinc-400 font-bold hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                            >
                                İPTAL
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-8 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold hover:scale-[1.02] transition-transform shadow-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <span className="animate-spin">↻</span>}
                                GÜNCELLE
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default StockCardHistory;
