import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { useRefresh } from '../src/context/RefreshContext';
import UserManagement from './UserManagement';
import { useLicense } from '../src/context/LicenseContext';
import { licenseService } from '../services/licenseService';

interface DbStats {
    itemCount: number;
    totalQuantity: number;
}

type SettingsTab = 'general' | 'users' | 'license';

const LicenseSettings: React.FC = () => {
    const { license, deactivateLicense, activateLicense, daysUntilExpiry } = useLicense();
    const [showRenewForm, setShowRenewForm] = useState(false);
    const [newLicenseKey, setNewLicenseKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [renewError, setRenewError] = useState('');
    const [renewSuccess, setRenewSuccess] = useState('');

    // API URL - localhost for dev, production for build
    const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://nisa.okilay.com';

    const handleDeactivate = async () => {
        if (confirm('Bu lisansı bu cihazdan kaldırmak istediğinize emin misiniz? Tekrar giriş yapmanız gerekecektir.')) {
            await deactivateLicense();
            window.location.reload();
        }
    };

    const handleRenewLicense = async (e: React.FormEvent) => {
        e.preventDefault();
        setRenewError('');
        setRenewSuccess('');

        if (!newLicenseKey.trim()) {
            setRenewError('Lütfen yeni lisans anahtarını giriniz');
            return;
        }

        setIsSubmitting(true);
        try {
            // Önce mevcut lisansı kaldır
            await deactivateLicense();

            // Yeni lisansı aktive et
            const success = await activateLicense(apiBaseUrl, newLicenseKey.trim());

            if (success) {
                setRenewSuccess('Lisans başarıyla yenilendi! Sayfa yenileniyor...');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setRenewError('Lisans aktivasyonu başarısız. Anahtarı kontrol ediniz.');
            }
        } catch (err) {
            setRenewError('Beklenmeyen bir hata oluştu');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Lisans uyarı rengi
    const getExpiryWarning = () => {
        if (!daysUntilExpiry) return null;
        if (daysUntilExpiry <= 7) return { color: 'red', text: `${daysUntilExpiry} gün kaldı!` };
        if (daysUntilExpiry <= 30) return { color: 'yellow', text: `${daysUntilExpiry} gün kaldı` };
        return null;
    };

    const expiryWarning = getExpiryWarning();

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">Lisans Yönetimi</h2>
                <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Yazılım lisans ve aktivasyon bilgileri</p>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Mevcut Lisans Bilgisi */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6">
                    {license ? (
                        <div className="space-y-6">
                            <div className="flex items-center p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900 rounded-xl">
                                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full mr-4">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Durum</p>
                                    <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Aktif Lisans</p>
                                </div>
                                {expiryWarning && (
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        expiryWarning.color === 'red'
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    }`}>
                                        {expiryWarning.text}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 border border-gray-100 dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-800">
                                    <p className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-1">Bayi / Sağlayıcı</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{license.dealerName || 'Bilinmiyor'}</p>
                                </div>
                                <div className="p-4 border border-gray-100 dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-800">
                                    <p className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-1">Son Kullanma</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {licenseService.formatExpiryDate(license)}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 border border-gray-100 dark:border-zinc-800 rounded-xl bg-gray-50 dark:bg-zinc-800">
                                <p className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-1">Lisans Anahtarı</p>
                                <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white break-all">{license.licenseKey}</p>
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 flex flex-wrap gap-3">
                                <button
                                    onClick={() => setShowRenewForm(!showRenewForm)}
                                    className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg text-sm font-bold transition-colors flex items-center"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Lisansı Yenile
                                </button>
                                <button
                                    onClick={handleDeactivate}
                                    className="px-4 py-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-sm font-bold transition-colors flex items-center"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    Lisansı Kaldır
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            <p>Lisans bilgisi bulunamadı.</p>
                        </div>
                    )}
                </div>

                {/* Lisans Yenileme Formu */}
                {showRenewForm && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900 rounded-xl p-6">
                        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            Yeni Lisans Anahtarı Gir
                        </h3>
                        <form onSubmit={handleRenewLicense} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                                    Lisans Anahtarı
                                </label>
                                <input
                                    type="text"
                                    value={newLicenseKey}
                                    onChange={(e) => setNewLicenseKey(e.target.value.toUpperCase())}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    className="w-full px-4 py-3 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white font-mono text-center text-lg tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {renewError && (
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                                    {renewError}
                                </div>
                            )}

                            {renewSuccess && (
                                <div className="p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
                                    {renewSuccess}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            İşleniyor...
                                        </>
                                    ) : (
                                        'Lisansı Yenile'
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowRenewForm(false);
                                        setNewLicenseKey('');
                                        setRenewError('');
                                    }}
                                    className="px-4 py-3 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg font-bold text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                >
                                    İptal
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

const Settings: React.FC = () => {
    const { triggerRefresh, lastUpdated } = useRefresh();

    // Active Tab State
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    // Stats State
    const [dbStats, setDbStats] = useState<DbStats>({ itemCount: 0, totalQuantity: 0 });

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [importStatus, setImportStatus] = useState<string>('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        loadDbStats();
    }, [lastUpdated]);

    const loadDbStats = async () => {
        try {
            const items = await inventoryService.getAllItems();
            const totalQuantity = items.reduce((acc, i) => acc + i.quantity, 0);

            setDbStats({
                itemCount: items.length,
                totalQuantity
            });
        } catch (error) {
            console.error('Hata:', error);
        }
    };

    const handleClearDatabase = async () => {
        setIsLoading(true);
        try {
            await inventoryService.clearDatabase();
            setDbStats({ itemCount: 0, totalQuantity: 0 });
            setImportStatus('Veritabanı temizlendi.');
            setIsDeleteModalOpen(false);
        } catch (error) {
            setImportStatus(`Hata: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        {
            id: 'general',
            label: 'Genel Ayarlar',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
        {
            id: 'users',
            label: 'Kullanıcılar',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            )
        },
        {
            id: 'license',
            label: 'Lisans',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
            )
        }
    ];

    return (
        <div className="h-full flex bg-gray-50 dark:bg-black">
            {/* Sidebar */}
            <div className="w-56 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col">
                <h1 className="text-xl font-black text-gray-900 dark:text-white mb-6 px-2">Ayarlar</h1>
                <nav className="space-y-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-black dark:bg-white text-white dark:text-black'
                                : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'general' ? (
                    <div className="p-6">
                        <div className="mb-6">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white">Genel Ayarlar</h2>
                            <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Yapılandırma ve veri yönetimi</p>
                        </div>

                        <div className="max-w-2xl space-y-6">
                            {/* Database Stats */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 dark:text-zinc-500 uppercase mb-3">Veritabanı Durumu</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                                        <div className="text-2xl font-black text-gray-900 dark:text-white">{dbStats.itemCount}</div>
                                        <div className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Stok Kartı (Çeşit)</div>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                                        <div className="text-2xl font-black text-gray-900 dark:text-white">{dbStats.totalQuantity}</div>
                                        <div className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Toplam Ürün Adedi</div>
                                    </div>
                                </div>
                            </div>

                            {/* DB Export/Import Section */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 dark:text-zinc-500 uppercase mb-3">Veritabanı Yedekleme (Yerel)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">DB Dışa Aktar</div>
                                                <p className="text-gray-500 dark:text-zinc-500 text-xs mt-1">Veritabanını dosya olarak kaydet</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    setIsLoading(true);
                                                    try {
                                                        const msg = await inventoryService.exportDatabase();
                                                        setImportStatus(msg);
                                                    } catch (e) {
                                                        setImportStatus(`Hata: ${e}`);
                                                    } finally {
                                                        setIsLoading(false);
                                                    }
                                                }}
                                                disabled={isLoading}
                                                className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Kaydet
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white">DB İçe Aktar</div>
                                                <p className="text-gray-500 dark:text-zinc-500 text-xs mt-1">Yedek dosyasından yükle</p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    setIsLoading(true);
                                                    try {
                                                        const msg = await inventoryService.importDatabase();
                                                        setImportStatus(msg);
                                                        if (msg.includes('başarılı')) {
                                                            triggerRefresh();
                                                            loadDbStats();
                                                        }
                                                    } catch (e) {
                                                        setImportStatus(`Hata: ${e}`);
                                                    } finally {
                                                        setIsLoading(false);
                                                    }
                                                }}
                                                disabled={isLoading}
                                                className="w-full bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                                Yükle
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cloud Backup Section */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-500 dark:text-zinc-500 uppercase mb-3 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                                    Bulut Yedekleme (Cloud)
                                </h3>
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900 rounded-xl p-5">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-center sm:text-left">
                                            <div className="font-bold text-emerald-900 dark:text-emerald-100">Buluta Şimdi Yedekle</div>
                                            <p className="text-emerald-700/70 dark:text-emerald-400/70 text-xs mt-1">Verilerinizi güvenli sunucuya anlık olarak gönderin.</p>
                                        </div>
                                        <div className="flex gap-3 w-full sm:w-auto">
                                            <button
                                                onClick={async () => {
                                                    setIsLoading(true);
                                                    try {
                                                        interface CloudBackupResult {
                                                            success: boolean;
                                                            message?: string;
                                                            error?: string;
                                                        }
                                                        const { tauriInvoke } = await import('../services/tauriService');
                                                        const result = await tauriInvoke<CloudBackupResult>('cloud_backup');
                                                        if (result.success) {
                                                            setImportStatus('✅ Bulut yedeği başarıyla alındı!');
                                                        } else {
                                                            setImportStatus(`❌ Bulut yedekleme hatası: ${result.message || result.error}`);
                                                        }
                                                    } catch (e) {
                                                        setImportStatus(`❌ Hata: ${e}`);
                                                    } finally {
                                                        setIsLoading(false);
                                                    }
                                                }}
                                                disabled={isLoading}
                                                className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                Yedekle
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    if (!confirm('Bulut yedeğinden geri yüklemek mevcut verilerinizi üzerine yazacaktır. Devam etmek istiyor musunuz?')) return;

                                                    setIsLoading(true);
                                                    try {
                                                        const { tauriInvoke } = await import('../services/tauriService');
                                                        await tauriInvoke('cloud_restore');
                                                        setImportStatus('✅ Buluttan başarıyla geri yüklendi! Uygulama yeniden başlatılıyor...');
                                                        setTimeout(() => window.location.reload(), 2000);
                                                    } catch (e) {
                                                        setImportStatus(`❌ Geri yükleme hatası: ${e}`);
                                                    } finally {
                                                        setIsLoading(false);
                                                    }
                                                }}
                                                disabled={isLoading}
                                                className="flex-1 sm:flex-none px-6 py-2.5 bg-white border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg font-bold text-sm transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                Geri Yükle
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {importStatus && (
                                <div className={`mt-4 p-4 rounded-lg font-medium text-sm flex items-center gap-2 ${importStatus.includes('başarılı') || importStatus.includes('✅')
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {importStatus}
                                </div>
                            )}

                            {/* Danger Zone */}
                            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-gray-900 dark:text-white">Verileri Sıfırla</div>
                                        <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Tüm ürün ve satış geçmişini kalıcı olarak siler</p>
                                    </div>
                                    <button
                                        onClick={() => setIsDeleteModalOpen(true)}
                                        disabled={isLoading}
                                        className="bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-all disabled:opacity-50"
                                    >
                                        Verileri Sil
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'users' ? (
                    /* Users Tab - Embedded UserManagement Component */
                    <UserManagement />
                ) : (
                    /* License Tab */
                    <LicenseSettings />
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-8">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                                <svg className="h-8 w-8 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">EMİN MİSİNİZ?</h3>
                            <p className="text-gray-500 dark:text-zinc-400 text-sm mb-8">
                                Bu işlem geri alınamaz. Tüm ürün veritabanı ve satış geçmişi <span className="font-bold text-red-500">KALICI OLARAK SİLİNECEKTİR.</span>
                            </p>
                            <div className="flex w-full gap-3">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 px-5 py-3 rounded-xl font-bold text-sm border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleClearDatabase}
                                    className="flex-1 px-5 py-3 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700"
                                >
                                    Evet, Hepsini Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
