import React, { useState, useEffect } from 'react';
import { tauriInvoke, isTauri } from '../services/tauriService';

interface Category {
    id: string;
    name: string;
    parentId: string | null;
    children?: Category[];
}

const CreateProductGroup: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [categories, setCategories] = useState<Category[]>([]);
    const [mode, setMode] = useState<'MAIN' | 'SUB'>('MAIN');

    const [formData, setFormData] = useState({
        name: '',
        parentId: ''
    });

    // Load existing categories from backend
    useEffect(() => {
        const loadCategories = async () => {
            if (isTauri()) {
                try {
                    // First, sync inventory categories to ensure all product categories are in the table
                    await tauriInvoke('sync_inventory_categories');

                    // Then load all categories
                    const backendCategories = await tauriInvoke<{ id: string; name: string; parentId: string | null; createdAt: string }[]>('get_categories');
                    // Map backend format to frontend format
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
                // Fallback to localStorage for non-Tauri environment
                const savedCategories = localStorage.getItem('nexus-categories');
                if (savedCategories) {
                    setCategories(JSON.parse(savedCategories));
                }
            }
        };
        loadCategories();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Kategori adı zorunludur.');
            return;
        }

        if (mode === 'SUB' && !formData.parentId) {
            setError('Alt kategori için bir ana kategori seçmelisiniz.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const categoryData = {
                id: crypto.randomUUID(),
                name: formData.name.trim(),
                parentId: mode === 'SUB' ? formData.parentId : null
            };

            // Save to backend first
            if (isTauri()) {
                await tauriInvoke('create_category', { data: categoryData });
                // Reload categories from backend to ensure sync
                const backendCategories = await tauriInvoke<{ id: string; name: string; parentId: string | null; createdAt: string }[]>('get_categories');
                const mapped = backendCategories.map(c => ({
                    id: c.id,
                    name: c.name,
                    parentId: c.parentId
                }));
                setCategories(mapped);
            } else {
                // Fallback to localStorage
                const newCategory: Category = {
                    id: categoryData.id,
                    name: categoryData.name,
                    parentId: categoryData.parentId
                };
                const updatedCategories = [...categories, newCategory];
                localStorage.setItem('nexus-categories', JSON.stringify(updatedCategories));
                setCategories(updatedCategories);
            }

            setSuccess(mode === 'MAIN' ? 'Ana kategori oluşturuldu!' : 'Alt kategori oluşturuldu!');
            setFormData({ name: '', parentId: '' });
        } catch (err) {
            console.error(err);
            setError('Kategori oluşturulurken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const deleteCategory = async (id: string) => {
        try {
            if (isTauri()) {
                // Check usage first
                const usageCount = await tauriInvoke<number>('check_category_usage', { categoryId: id });
                if (usageCount > 0) {
                    // Since deleteCategory is triggered by a button, we might want to alert directly or set error state
                    // Ideally use confirm dialog, but since we are blocking it, an alert or setting Error state is fine. 
                    // The component has an 'error' state but it might be far from the list.
                    // A simple alert is safer for immediate feedback in a list action context.
                    alert(`Bu kategoriye ait ${usageCount} adet ürün/stok kartı var. Önce ürünleri taşıyın veya silin.`);
                    return;
                }

                await tauriInvoke('delete_category', { id });
                // Reload from backend
                const backendCategories = await tauriInvoke<{ id: string; name: string; parentId: string | null; createdAt: string }[]>('get_categories');
                const mapped = backendCategories.map(c => ({
                    id: c.id,
                    name: c.name,
                    parentId: c.parentId
                }));
                setCategories(mapped);
            } else {
                const updatedCategories = categories.filter(c => c.id !== id && c.parentId !== id);
                localStorage.setItem('nexus-categories', JSON.stringify(updatedCategories));
                setCategories(updatedCategories);
            }
        } catch (err: any) {
            console.error('Error deleting category:', err);
            // If error state is visible used it, otherwise alert
            alert('Kategori silinirken hata oluştu: ' + (err.toString()));
        }
    };

    // Get main categories (no parent)
    const mainCategories = categories.filter(c => !c.parentId);

    // Get subcategories for a given parent
    const getSubCategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

    return (
        <div className="p-6 h-full flex flex-col overflow-y-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ürün Grubu Oluştur</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Ana kategori ve alt kategoriler oluşturun.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
                {/* Form Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800">
                    {error && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {success}
                        </div>
                    )}

                    {/* Mode Toggle */}
                    <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-xl p-1 mb-6">
                        <button
                            type="button"
                            onClick={() => { setMode('MAIN'); setFormData({ name: '', parentId: '' }); }}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${mode === 'MAIN'
                                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                                }`}
                        >
                            Ana Kategori
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('SUB'); setFormData({ name: '', parentId: '' }); }}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${mode === 'SUB'
                                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                                }`}
                        >
                            Alt Kategori
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'SUB' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                    Ana Kategori Seçin <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="parentId"
                                    value={formData.parentId}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                >
                                    <option value="">-- Seçiniz --</option>
                                    {mainCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                {mainCategories.length === 0 && (
                                    <p className="text-xs text-amber-500 mt-1">Önce bir ana kategori oluşturmalısınız.</p>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                {mode === 'MAIN' ? 'Ana Kategori Adı' : 'Alt Kategori Adı'} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                placeholder={mode === 'MAIN' ? 'Örn: Gıda, Elektronik' : 'Örn: Süt Ürünleri, Telefon'}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || (mode === 'SUB' && mainCategories.length === 0)}
                            className={`w-full py-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-base hover:bg-gray-800 dark:hover:bg-gray-100 transition-all flex items-center justify-center gap-2 ${loading || (mode === 'SUB' && mainCategories.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                    {mode === 'MAIN' ? 'Ana Kategori Oluştur' : 'Alt Kategori Oluştur'}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Categories List Section */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        Mevcut Kategoriler
                    </h2>

                    {mainCategories.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 dark:text-zinc-500">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p>Henüz kategori oluşturulmamış.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {mainCategories.map(mainCat => (
                                <div key={mainCat.id} className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-3">
                                    {/* Main Category */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-black dark:bg-white"></div>
                                            <span className="font-medium text-gray-900 dark:text-white">{mainCat.name}</span>
                                        </div>
                                        <button
                                            onClick={() => deleteCategory(mainCat.id)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            title="Sil"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Sub Categories */}
                                    {getSubCategories(mainCat.id).length > 0 && (
                                        <div className="mt-2 ml-4 pl-3 border-l-2 border-gray-200 dark:border-zinc-600 space-y-1">
                                            {getSubCategories(mainCat.id).map(subCat => (
                                                <div key={subCat.id} className="flex items-center justify-between py-1">
                                                    <span className="text-sm text-gray-600 dark:text-zinc-400">{subCat.name}</span>
                                                    <button
                                                        onClick={() => deleteCategory(subCat.id)}
                                                        className="p-1 rounded text-gray-400 hover:text-red-500 transition-all"
                                                        title="Sil"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateProductGroup;
