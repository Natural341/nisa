import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { inventoryService } from '../services/inventoryService';
import { geminiService } from '../services/geminiService';
import { useRefresh } from '../src/context/RefreshContext';

const InventoryList: React.FC = () => {
    const { lastUpdated, triggerRefresh } = useRefresh();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [selectedCategory, setSelectedCategory] = useState<string>('HEPSİ');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formItem, setFormItem] = useState<Partial<InventoryItem>>({
        name: '', sku: '', location: '', quantity: 0, price: 0, costPrice: 0, image: '', category: ''
    });

    const [aiAnalysis, setAiAnalysis] = useState<{ analyzing: boolean, data: any } | null>(null);

    useEffect(() => {
        loadItems();
    }, [lastUpdated]);

    const loadItems = async () => {
        setLoading(true);
        const data = await inventoryService.getAllItems();
        setItems(data);
        setLoading(false);
    };

    // Derived Data
    const categories = ['HEPSİ', ...Array.from(new Set(items.map(i => i.category || 'Genel'))).sort()];

    const filteredItems = selectedCategory === 'HEPSİ'
        ? items
        : items.filter(i => (i.category || 'Genel') === selectedCategory);

    const openAddModal = () => {
        setEditingId(null);
        setFormItem({ name: '', sku: '', location: '', quantity: 0, price: 0, costPrice: 0, image: '', category: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (item: InventoryItem) => {
        setEditingId(item.id);
        setFormItem({ ...item });
        setIsModalOpen(true);
    };

    const handleDelete = async (sku: string) => {
        if (window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
            await inventoryService.deleteItem(sku);
            triggerRefresh();
        }
    }

    const handleAnalyze = async () => {
        if (!formItem.name || !formItem.sku) return;
        setAiAnalysis({ analyzing: true, data: null });
        // Use fallback if properties are undefined
        const result = await geminiService.analyzeProduct(formItem.name, formItem.sku);
        setAiAnalysis({ analyzing: false, data: result });

        // Auto-fill category if empty
        if (result && result.category && !formItem.category) {
            setFormItem(prev => ({ ...prev, category: result.category }));
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormItem(prev => ({ ...prev, image: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Merge AI data if available and not overridden
        const finalCategory = formItem.category || aiAnalysis?.data?.category || 'Genel';
        const finalDesc = aiAnalysis?.data?.description || formItem.description;
        const finalTags = aiAnalysis?.data?.tags || formItem.aiTags || [];

        if (editingId) {
            // Update
            const updated: InventoryItem = {
                ...formItem as InventoryItem,
                id: editingId,
                category: finalCategory,
                description: finalDesc,
                aiTags: finalTags,
                lastUpdated: new Date().toISOString(),
            };
            await inventoryService.updateItem(updated);
        } else {
            // Create
            const newItem: InventoryItem = {
                id: Math.random().toString(36).substr(2, 9),
                name: formItem.name || 'Bilinmiyor',
                sku: formItem.sku || '0000',
                location: formItem.location || 'Depo',
                quantity: formItem.quantity || 0,
                price: formItem.price || 0,
                costPrice: formItem.costPrice || 0,
                image: formItem.image,
                category: finalCategory,
                description: finalDesc,
                aiTags: finalTags,
                lastUpdated: new Date().toISOString()
            };
            await inventoryService.addItem(newItem);
        }

        setIsModalOpen(false);
        setAiAnalysis(null);
        triggerRefresh();
    };

    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [priceChangeCategory, setPriceChangeCategory] = useState<string>('HEPSİ');
    const [priceChangePercent, setPriceChangePercent] = useState<number>(0);

    const handlePriceChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (priceChangePercent === 0) return;

        if (window.confirm(`${priceChangeCategory} kategorisindeki ürünlere %${priceChangePercent} oranında ${priceChangePercent > 0 ? 'zam' : 'indirim'} yapılacaktır. Emin misiniz?`)) {
            await inventoryService.applyPriceChangeByCategory(priceChangeCategory, priceChangePercent);
            setIsPriceModalOpen(false);
            setPriceChangePercent(0);
            triggerRefresh();
        }
    };

    const handlePrintLabel = (item: InventoryItem) => {
        inventoryService.generatePdfLabel(item);
    };

    if (loading) return <div className="p-8 text-gray-500 dark:text-white font-mono text-xl animate-pulse">SİSTEM YÜKLENİYOR...</div>;

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-gray-50 dark:bg-black text-gray-900 dark:text-white transition-colors duration-300 flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tight">Stok Yönetimi</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ÜRÜN VE VARLIKLARI YÖNET</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsPriceModalOpen(true)}
                        className="bg-white dark:bg-zinc-800 text-black dark:text-white border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 px-6 py-3 rounded-xl text-sm font-bold transition-transform active:scale-95 shadow-sm flex items-center gap-2"
                    >
                        <span>%</span> TOPLU FİYAT GÜNCELLEME
                    </button>
                    <button
                        onClick={openAddModal}
                        className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 px-6 py-3 rounded-xl text-lg font-bold transition-transform active:scale-95 shadow-lg flex items-center gap-2"
                    >
                        <span>+</span> YENİ ÜRÜN
                    </button>
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border
                    ${selectedCategory === cat
                                ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-md'
                                : 'bg-white dark:bg-hub-panel text-gray-500 dark:text-gray-400 border-gray-200 dark:border-hub-border hover:border-gray-400 dark:hover:border-gray-500'
                            }
                  `}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grid/Table Layout */}
            <div className="bg-white dark:bg-hub-panel border border-gray-200 dark:border-hub-border rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-neutral-400">
                        <thead className="bg-gray-100 dark:bg-black text-gray-900 dark:text-white uppercase text-xs font-bold tracking-widest border-b border-gray-200 dark:border-hub-border">
                            <tr>
                                <th className="p-6 w-24">Görsel</th>
                                <th className="p-6">Ürün Detayları</th>
                                <th className="p-6 text-right">Fiyat</th>
                                <th className="p-6 text-right">Adet</th>
                                <th className="p-6 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-hub-border">
                            {filteredItems.length > 0 ? (
                                filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="p-6">
                                            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">RESİM</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs text-gray-400 dark:text-gray-500 mb-1">{item.sku}</span>
                                                <span className="text-gray-900 dark:text-white font-bold text-lg">{item.name}</span>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-xs bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wide">{item.category}</span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 py-0.5 border border-gray-200 dark:border-gray-800 px-2 rounded-md">{item.location}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono text-lg text-gray-900 dark:text-white">
                                                    {item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : '₺'}{item.price.toFixed(2)}
                                                </span>
                                                {item.costPrice && item.costPrice > 0 && (
                                                    <span className="text-xs text-gray-400 font-mono">
                                                        Geliş: {item.currency === 'USD' ? '$' : item.currency === 'EUR' ? '€' : '₺'}{item.costPrice.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`p-6 text-right font-mono text-2xl font-bold ${item.quantity < 10 ? 'text-red-500 dark:text-white underline decoration-wavy decoration-red-500' : 'text-gray-900 dark:text-white'}`}>
                                            {item.quantity}
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openEditModal(item)} className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-white transition-colors" title="Düzenle">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button onClick={() => handleDelete(item.sku)} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="Sil">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                                <button onClick={() => handlePrintLabel(item)} className="p-2 text-gray-500 hover:text-green-600 transition-colors" title="Etiket Yazdır">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400 dark:text-gray-600">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xl font-bold uppercase mb-2">Ürün Bulunamadı</span>
                                            <span className="text-sm">Farklı bir kategori seçin veya yeni ürün ekleyin.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ADD/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-hub-panel border border-gray-200 dark:border-hub-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in-up">
                        <div className="p-6 border-b border-gray-200 dark:border-hub-border flex justify-between items-center sticky top-0 bg-white dark:bg-hub-panel z-10">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-widest">{editingId ? 'Ürünü Düzenle' : 'Yeni Stok Kartı'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-black dark:hover:text-white text-2xl">&times;</button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            {/* Image Preview / File Upload */}
                            <div className="flex gap-6 items-start">
                                <div className="w-32 h-32 bg-gray-100 dark:bg-black border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative group">
                                    {formItem.image ? (
                                        <img src={formItem.image} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-gray-400 text-xs text-center px-2">Görsel Yok</span>
                                    )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-xs text-gray-500 dark:text-hub-muted uppercase font-bold tracking-wider">Ürün Görseli</label>
                                    <div className="flex items-center justify-center w-full">
                                        <label htmlFor={`dropzone-file-${editingId || 'new'}`} className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-black hover:bg-gray-100 dark:border-hub-border dark:hover:border-gray-500 dark:hover:bg-gray-900 transition-colors">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-500 dark:text-gray-400">
                                                <svg className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                                </svg>
                                                <p className="text-xs text-center"><span className="font-semibold">Yüklemek için tıkla</span> veya sürükle bırak</p>
                                            </div>
                                            <input id={`dropzone-file-${editingId || 'new'}`} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-500 dark:text-hub-muted uppercase font-bold tracking-wider">Barkod / Kod</label>
                                    <input
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-hub-border rounded-lg p-3 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formItem.sku} onChange={e => setFormItem({ ...formItem, sku: e.target.value })}
                                        placeholder="000-000"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-500 dark:text-hub-muted uppercase font-bold tracking-wider">Konum/Raf</label>
                                    <input
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-hub-border rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formItem.location} onChange={e => setFormItem({ ...formItem, location: e.target.value })}
                                        placeholder="Raf A-1"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 dark:text-hub-muted uppercase font-bold tracking-wider">Ürün Adı</label>
                                <input
                                    className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-hub-border rounded-lg p-3 text-gray-900 dark:text-white text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formItem.name} onChange={e => setFormItem({ ...formItem, name: e.target.value })}
                                    onBlur={handleAnalyze}
                                    placeholder="Tam Ürün Adı"
                                    required
                                />
                            </div>

                            {/* Category Input */}
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 dark:text-hub-muted uppercase font-bold tracking-wider">Kategori</label>
                                <div className="relative">
                                    <input
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-hub-border rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                        value={formItem.category || ''}
                                        onChange={e => setFormItem({ ...formItem, category: e.target.value })}
                                        placeholder="Kategori Seç veya Yaz"
                                        list="category-suggestions"
                                    />
                                    <datalist id="category-suggestions">
                                        {categories.filter(c => c !== 'HEPSİ').map(c => <option key={c} value={c} />)}
                                    </datalist>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 dark:text-hub-muted uppercase font-bold tracking-wider">Miktar</label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-hub-border rounded-lg p-3 text-gray-900 dark:text-white font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formItem.quantity} onChange={e => setFormItem({ ...formItem, quantity: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 dark:text-hub-muted uppercase font-bold tracking-wider">Birim</label>
                                <select
                                    className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-hub-border rounded-lg p-3 text-gray-900 dark:text-white font-bold outline-none"
                                    value={formItem.currency || 'TL'}
                                    onChange={e => setFormItem({ ...formItem, currency: e.target.value })}
                                >
                                    <option value="TL">TL</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-gray-500 dark:text-hub-muted uppercase font-bold tracking-wider">Satış Fiyatı</label>
                                <input
                                    type="number" step="0.01"
                                    className="w-full bg-gray-50 dark:bg-black border border-green-100 dark:border-green-900/30 rounded-lg p-3 text-gray-900 dark:text-white font-mono text-lg focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formItem.price} onChange={e => setFormItem({ ...formItem, price: Number(e.target.value) })}
                                />
                                {formItem.costPrice && formItem.costPrice > 0 && (
                                    <div className="text-[10px] text-gray-400 text-right mt-1">Geliş: {formItem.costPrice}</div>
                                )}
                            </div>

                            {/* AI Feedback */}
                            <div className="bg-gray-100 dark:bg-black p-4 rounded-xl border border-dashed border-gray-300 dark:border-hub-border">
                                {aiAnalysis?.analyzing ? (
                                    <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                                        <span className="animate-spin">✦</span>
                                        <span className="text-xs font-bold uppercase">Meta Veriler Oluşturuluyor...</span>
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        <p className="mb-1 uppercase font-bold text-gray-400 dark:text-gray-600">Yapay Zeka Önerileri</p>
                                        <p>{aiAnalysis?.data ? `${aiAnalysis.data.category} - ${aiAnalysis.data.description}` : 'Etiket ve kategori önerisi için Ürün Adı ve Barkod giriniz.'}</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-hub-border">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-lg text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-white/10">İPTAL</button>
                                <button type="submit" className="px-8 py-3 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:scale-[1.02] transition-transform shadow-lg">KAYDET</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PRICE CHANGE MODAL */}
            {isPriceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Toplu Fiyat Güncelleme</h3>
                            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">Seçili kategorideki tüm ürünlerin fiyatını değiştir</p>
                        </div>
                        <form onSubmit={handlePriceChange} className="p-6 space-y-6">

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase">Kategori</label>
                                <select
                                    className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-zinc-700 rounded-lg p-3 text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    value={priceChangeCategory}
                                    onChange={e => setPriceChangeCategory(e.target.value)}
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase">Yüzde Değişim (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-300 dark:border-zinc-700 rounded-lg p-3 text-gray-900 dark:text-white font-mono text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Örn: 10 (Zam) veya -10 (İndirim)"
                                        value={priceChangePercent}
                                        onChange={e => setPriceChangePercent(Number(e.target.value))}
                                    />
                                    <div className="absolute right-3 top-3 text-gray-400 font-bold">%</div>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Pozitif değer (+) zam, negatif değer (-) indirim yapar.
                                    <br />Örn: 20 yazarsanız fiyatlar %20 artar.
                                </p>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                <div className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                                    <span className="font-bold">Örnek:</span> 100 TL'lik bir ürün, %{priceChangePercent} değişim sonrası <span className="font-bold underline">{(100 * (1 + priceChangePercent / 100)).toFixed(2)} TL</span> olacaktır.
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPriceModalOpen(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-90 transition-opacity"
                                >
                                    Uygula
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default InventoryList;