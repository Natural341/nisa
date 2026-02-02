import React, { useState, useRef, useEffect } from 'react';
import { tauriInvoke, isTauri } from '../services/tauriService';
import StockCardHistory from './StockCardHistory';

interface Category {
    id: string;
    name: string;
    parentId: string | null;
}

const UNITS = [
    { value: 'ADET', label: 'Adet' },
    { value: 'KG', label: 'Kilogram (kg)' },
    { value: 'GR', label: 'Gram (gr)' },
    { value: 'LT', label: 'Litre (lt)' },
    { value: 'ML', label: 'Mililitre (ml)' },
    { value: 'MT', label: 'Metre (mt)' },
    { value: 'CM', label: 'Santimetre (cm)' },
    { value: 'M2', label: 'Metrekare (m²)' },
    { value: 'PALET', label: 'Palet' },
    { value: 'KUTU', label: 'Kutu' },
    { value: 'PAKET', label: 'Paket' },
    { value: 'DUZINE', label: 'Düzine' },
];

const CreateStockCard: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [stockCards, setStockCards] = useState<StockCard[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; card: StockCard } | null>(null);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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

    const [formData, setFormData] = useState({
        barcode: '',
        name: '',
        brand: '',
        unit: 'ADET',
        categoryId: '',
        description: '',
        image: ''
    });

    // Load stock cards from backend
    const loadStockCards = async () => {
        if (isTauri()) {
            try {
                const cards = await tauriInvoke<StockCard[]>('get_stock_cards');
                setStockCards(cards);
            } catch (e) {
                console.log('No stock cards loaded');
            }
        }
    };

    // Load categories from backend (shared across all components)
    useEffect(() => {
        const loadCategories = async () => {
            if (isTauri()) {
                try {
                    // First, sync inventory categories to ensure all are in the table
                    await tauriInvoke('sync_inventory_categories');

                    // Load categories from backend
                    const backendCategories = await tauriInvoke<{ id: string; name: string; parentId: string | null; createdAt: string }[]>('get_categories');
                    const mapped = backendCategories.map(c => ({
                        id: c.id,
                        name: c.name,
                        parentId: c.parentId
                    }));
                    setCategories(mapped);
                } catch (err) {
                    console.log('Backend not available, falling back to localStorage');
                    const savedCategories = localStorage.getItem('nexus-categories');
                    if (savedCategories) {
                        setCategories(JSON.parse(savedCategories));
                    }
                }
            } else {
                const savedCategories = localStorage.getItem('nexus-categories');
                if (savedCategories) {
                    setCategories(JSON.parse(savedCategories));
                }
            }
        };
        loadCategories();
        loadStockCards();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setImagePreview(base64);
                setFormData(prev => ({ ...prev, image: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Ürün adı zorunludur.');
            return;
        }
        if (!formData.barcode.trim()) {
            setError('Barkod zorunludur.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const stockCardData = {
                id: crypto.randomUUID(),
                barcode: formData.barcode,
                name: formData.name,
                brand: formData.brand || null,
                unit: formData.unit,
                categoryId: formData.categoryId || null,
                description: formData.description || null,
                image: formData.image || null
            };

            if (isTauri()) {
                // Check if SKU exists
                const exists = await tauriInvoke<boolean>('check_sku_exists', { sku: formData.barcode });
                if (exists) {
                    setError('Aynı barkod numarasından halihazırda bir ürün var');
                    setLoading(false);
                    return;
                }

                await tauriInvoke('create_stock_card', { data: stockCardData });
            }

            setSuccess('Stok kartı başarıyla oluşturuldu!');
            setFormData({
                barcode: '',
                name: '',
                brand: '',
                unit: 'ADET',
                categoryId: '',
                description: '',
                image: ''
            });
            setImagePreview(null);
            loadStockCards(); // Reload list
        } catch (err) {
            console.error(err);
            setError('Kayıt oluşturulurken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    // Delete stock card handler
    const handleDeleteStockCard = async (card: StockCard) => {
        const confirmed = window.confirm(`"${card.name}" stok kartını silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz.`);
        if (!confirmed) return;

        try {
            await tauriInvoke('delete_stock_card', { id: card.id });
            setSuccess(`"${card.name}" stok kartı silindi.`);
            setTimeout(() => setSuccess(null), 3000);
            loadStockCards();
        } catch (e: any) {
            setError(e.toString() || 'Stok kartı silinirken hata oluştu.');
            setTimeout(() => setError(null), 5000);
        }
    };

    // Get main categories for display
    const mainCategories = categories.filter(c => !c.parentId);
    const getSubCategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

    if (selectedCardId) {
        return (
            <StockCardHistory
                selectedCardId={selectedCardId}
                onBack={() => setSelectedCardId(null)}
                onUpdate={() => {
                    loadStockCards();
                }}
            />
        );
    }

    return (
        <div className="p-6 h-full flex flex-col overflow-y-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stok Kart Oluştur</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Yeni bir ürün/stok kartı ekleyin.</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 max-w-3xl">
                {error && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-6 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Image Upload Section */}
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Photo */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                                Ürün Fotoğrafı
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-36 h-36 rounded-2xl border-2 border-dashed border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center cursor-pointer hover:border-gray-400 dark:hover:border-zinc-500 transition-all overflow-hidden"
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center p-4">
                                        <svg className="w-8 h-8 mx-auto text-gray-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-xs text-gray-400 dark:text-zinc-500 mt-1 block">Fotoğraf Ekle</span>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                            />
                        </div>

                        {/* Main Info */}
                        <div className="flex-1 space-y-4">
                            {/* Barkod & Ürün Adı */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                        Barkod <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="barcode"
                                        required
                                        value={formData.barcode}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                        placeholder="8690000000000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                        Ürün Adı <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                        placeholder="Ürün adı"
                                    />
                                </div>
                            </div>

                            {/* Marka & Birim */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                        Marka
                                    </label>
                                    <input
                                        type="text"
                                        name="brand"
                                        value={formData.brand}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                        placeholder="Marka adı"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                        Birim
                                    </label>
                                    <select
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                    >
                                        {UNITS.map(u => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                            Kategori
                        </label>
                        <select
                            name="categoryId"
                            value={formData.categoryId}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                        >
                            <option value="">-- Kategori Seçin --</option>
                            {mainCategories.map(mainCat => (
                                <optgroup key={mainCat.id} label={mainCat.name}>
                                    <option value={mainCat.id}>{mainCat.name} (Ana Kategori)</option>
                                    {getSubCategories(mainCat.id).map(subCat => (
                                        <option key={subCat.id} value={subCat.id}>↳ {subCat.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        {categories.length === 0 && (
                            <p className="text-xs text-amber-500 mt-1">Henüz kategori oluşturulmamış. "Ürün Grubu Oluştur" sayfasından kategori ekleyebilirsiniz.</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                            Açıklama
                        </label>
                        <textarea
                            name="description"
                            rows={2}
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none"
                            placeholder="Ürün hakkında kısa açıklama"
                        />
                    </div>

                    {/* Submit */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full md:w-auto px-8 py-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-base hover:bg-gray-800 dark:hover:bg-gray-100 transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Stok Kartı Oluştur
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div >

            {/* Stock Cards List */}
            {
                stockCards.length > 0 && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 max-w-3xl">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Mevcut Stok Kartları ({stockCards.length})
                        </h2>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {stockCards.map(card => (
                                <div
                                    key={card.id}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, card });
                                    }}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        {card.image ? (
                                            <img src={card.image} alt={card.name} className="w-10 h-10 rounded-lg object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-gray-400 text-xs">IMG</div>
                                        )}
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{card.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-zinc-400">
                                                {card.barcode} {card.brand && `• ${card.brand}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-zinc-700 rounded text-gray-600 dark:text-zinc-300">
                                            {card.unit}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-3 text-center">
                            💡 Sağ tık yaparak stok kart ekstresi görüntüleyebilirsiniz
                        </p>
                    </div>
                )
            }

            {/* Context Menu */}
            {
                contextMenu && (
                    <div
                        className="fixed bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 py-2 z-50 min-w-[180px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={() => setContextMenu(null)}
                    >
                        <button
                            onClick={() => {
                                setSelectedCardId(contextMenu.card.id);
                                setContextMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Stok Kart Ekstresi
                        </button>

                        {/* Separator */}
                        <div className="h-px bg-gray-200 dark:bg-zinc-700 my-1"></div>

                        {/* Delete Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStockCard(contextMenu.card);
                                setContextMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Stok Kartını Sil
                        </button>

                        <button
                            onClick={() => {
                                setContextMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            İptal
                        </button>
                    </div>
                )
            }

            {/* Click outside to close context menu */}
            {
                contextMenu && (
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setContextMenu(null)}
                    />
                )
            }
        </div >
    );
};

export default CreateStockCard;
