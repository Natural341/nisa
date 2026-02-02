import React, { useState, useEffect } from 'react';
import { inventoryService } from '../services/inventoryService';
import { cloudService } from '../services/cloudService';
import { isTauri } from '../services/tauriService';
import { useLicense } from '../src/context/LicenseContext';
import { useRefresh } from '../src/context/RefreshContext';
import { SyncStatus, CloudStatusResponse } from '../types';

interface DbStats {
    itemCount: number;
    totalQuantity: number;
    totalValue: number;
}

const Settings: React.FC = () => {
    const { license, isLicensed } = useLicense();
    const { triggerRefresh } = useRefresh();

    // Currency State
    const [currency, setCurrency] = useState<string>(localStorage.getItem('app_currency') || 'TL');

    // Stats State
    const [dbStats, setDbStats] = useState<DbStats>({ itemCount: 0, totalQuantity: 0, totalValue: 0 });

    // Cloud Sync State
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [cloudStatus, setCloudStatus] = useState<CloudStatusResponse | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string>('');

    // Auto Sync State
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [autoSyncInterval, setAutoSyncInterval] = useState(30);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [importStatus, setImportStatus] = useState<string>('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

    useEffect(() => {
        loadDbStats();
        loadSyncStatus();
    }, []);

    const handleCurrencyChange = (newCurrency: string) => {
        setCurrency(newCurrency);
        localStorage.setItem('app_currency', newCurrency);
    };

    const loadDbStats = async () => {
        try {
            const items = await inventoryService.getAllItems();
            const totalQuantity = items.reduce((acc, i) => acc + i.quantity, 0);
            const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            setDbStats({
                itemCount: items.length,
                totalQuantity,
                totalValue
            });
        } catch (error) {
            console.error('Hata:', error);
        }
    };

    const loadSyncStatus = async () => {
        try {
            const status = await cloudService.getSyncStatus();
            setSyncStatus(status);
            setAutoSyncEnabled(status.autoSyncEnabled);
            setAutoSyncInterval(status.autoSyncIntervalMinutes);

            // Also get cloud status if licensed
            if (isLicensed) {
                try {
                    const cloud = await cloudService.getCloudStatus();
                    setCloudStatus(cloud);
                } catch (e) {
                    console.log('Cloud status alinamadi:', e);
                }
            }
        } catch (error) {
            console.error('Sync status alinamadi:', error);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: currency === 'TL' ? 'TRY' : currency,
            minimumFractionDigits: 2
        }).format(value);
    };

    const handleExport = async () => {
        setIsLoading(true);
        try {
            const msg = await inventoryService.exportToExcel();
            setImportStatus(msg);
        } catch (e) {
            setImportStatus(`Hata: ${e}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        setImportStatus('');
        setIsLoading(true);
        if (!isTauri()) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = async (e: any) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        const csvText = evt.target?.result as string;
                        try {
                            await inventoryService.importFromCsv(csvText);
                            setImportStatus('Ice aktarma basarili!');
                            loadDbStats();
                        } catch (err) {
                            setImportStatus(`Hata: ${err}`);
                        } finally {
                            setIsLoading(false);
                        }
                    };
                    reader.readAsText(file);
                } else {
                    setIsLoading(false);
                }
            };
            input.click();
        } else {
            try {
                const result = await inventoryService.importFromCsv("");
                setImportStatus(result);
                loadDbStats();
            } catch (error) {
                setImportStatus(`Hata: ${error}`);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleCloudBackup = async () => {
        setIsSyncing(true);
        setSyncMessage('');
        try {
            const response = await cloudService.backup();
            if (response.success) {
                setSyncMessage('Cloud yedekleme basarili!');
                loadSyncStatus();
            } else {
                setSyncMessage(`Yedekleme basarisiz: ${response.error || response.message}`);
            }
        } catch (error) {
            setSyncMessage(`Hata: ${error}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCloudRestore = async () => {
        setIsRestoreModalOpen(false);
        setIsSyncing(true);
        setSyncMessage('');
        try {
            await cloudService.restore();
            setSyncMessage('Cloud geri yukleme basarili!');
            // Refresh all data without page reload
            triggerRefresh();
            loadSyncStatus();
            loadDbStats();
        } catch (error) {
            setSyncMessage(`Geri yukleme hatasi: ${error}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAutoSyncChange = async (enabled: boolean) => {
        setAutoSyncEnabled(enabled);
        try {
            await cloudService.setAutoSync(enabled, autoSyncInterval);
            loadSyncStatus();
        } catch (error) {
            console.error('Auto sync ayari kaydedilemedi:', error);
        }
    };

    const handleAutoSyncIntervalChange = async (interval: number) => {
        setAutoSyncInterval(interval);
        try {
            await cloudService.setAutoSync(autoSyncEnabled, interval);
            loadSyncStatus();
        } catch (error) {
            console.error('Auto sync interval kaydedilemedi:', error);
        }
    };

    const handleClearDatabase = async () => {
        setIsLoading(true);
        try {
            await inventoryService.clearDatabase();
            setDbStats({ itemCount: 0, totalQuantity: 0, totalValue: 0 });
            setImportStatus('Veritabani temizlendi.');
            setIsDeleteModalOpen(false);
        } catch (error) {
            setImportStatus(`Hata: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 h-full bg-gray-50 dark:bg-black overflow-y-auto relative">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Ayarlar</h1>
                    <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Yapilandirma ve veri yonetimi</p>
                </div>

                {/* Currency Selector */}
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-1.5">
                    <span className="text-xs font-bold text-gray-500 dark:text-zinc-500 px-2 uppercase">Para Birimi:</span>
                    {['TL', 'USD', 'EUR', 'GBP'].map(c => (
                        <button
                            key={c}
                            onClick={() => handleCurrencyChange(c)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currency === c
                                ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800'
                                }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* License Info */}
                {license && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    <span className="font-bold text-blue-800 dark:text-blue-300">Lisans Bilgileri</span>
                                </div>
                                <div className="mt-2 space-y-1 text-sm">
                                    <p className="text-blue-700 dark:text-blue-400">Bayi: <span className="font-semibold">{license.dealerName}</span></p>
                                    <p className="text-blue-600 dark:text-blue-500">Lisans: <span className="font-mono">{license.licenseKey.substring(0, 15)}...</span></p>
                                    {license.expiresAt && (
                                        <p className="text-blue-600 dark:text-blue-500">Bitis: {new Date(license.expiresAt).toLocaleDateString('tr-TR')}</p>
                                    )}
                                </div>
                            </div>
                            <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                Aktif
                            </div>
                        </div>
                    </div>
                )}

                {/* Cloud Sync Section */}
                {isLicensed && (
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 dark:text-zinc-500 uppercase mb-3">Cloud Senkronizasyon</h3>
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
                            {/* Sync Status */}
                            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-zinc-800">
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">Senkronizasyon Durumu</div>
                                    <div className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
                                        Son Yedekleme: {cloudService.formatLastSync(syncStatus?.lastBackupAt)}
                                    </div>
                                    {cloudStatus?.has_backup && cloudStatus.backup_size_bytes && (
                                        <div className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                                            Cloud boyutu: {cloudService.formatFileSize(cloudStatus.backup_size_bytes)}
                                        </div>
                                    )}
                                </div>
                                <div className={`w-3 h-3 rounded-full ${syncStatus?.lastBackupAt ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </div>

                            {/* Backup & Restore Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleCloudBackup}
                                    disabled={isSyncing}
                                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                                >
                                    {isSyncing ? (
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    )}
                                    Cloud'a Yedekle
                                </button>
                                <button
                                    onClick={() => setIsRestoreModalOpen(true)}
                                    disabled={isSyncing || !cloudStatus?.has_backup}
                                    className="flex items-center justify-center gap-2 bg-gray-800 text-white px-4 py-3 rounded-lg font-bold text-sm hover:bg-gray-700 transition-all disabled:opacity-50"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                    </svg>
                                    Cloud'dan Geri Yukle
                                </button>
                            </div>

                            {/* Sync Message */}
                            {syncMessage && (
                                <div className={`text-sm p-3 rounded-lg ${syncMessage.includes('basarili') ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                                    {syncMessage}
                                </div>
                            )}

                            {/* Auto Sync Toggle */}
                            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">Otomatik Yedekleme</div>
                                        <p className="text-xs text-gray-500 dark:text-zinc-500">Belirli araliklarla otomatik yedekle</p>
                                    </div>
                                    <button
                                        onClick={() => handleAutoSyncChange(!autoSyncEnabled)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${autoSyncEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-zinc-700'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoSyncEnabled ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>
                                {autoSyncEnabled && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-sm text-gray-500 dark:text-zinc-500">Her</span>
                                        <select
                                            value={autoSyncInterval}
                                            onChange={(e) => handleAutoSyncIntervalChange(Number(e.target.value))}
                                            className="bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg px-3 py-1.5 text-sm font-medium"
                                        >
                                            <option value={5}>5 dakika</option>
                                            <option value={15}>15 dakika</option>
                                            <option value={30}>30 dakika</option>
                                            <option value={60}>1 saat</option>
                                            <option value={360}>6 saat</option>
                                            <option value={1440}>24 saat</option>
                                        </select>
                                        <span className="text-sm text-gray-500 dark:text-zinc-500">otomatik yedekle</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Database Stats */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-zinc-500 uppercase mb-3">Veritabani Durumu</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-gray-900 dark:text-white">{dbStats.itemCount}</div>
                            <div className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Stok Karti (Cesit)</div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-gray-900 dark:text-white">{dbStats.totalQuantity}</div>
                            <div className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Toplam Urun Adedi</div>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                            <div className="text-2xl font-black text-green-600">{formatCurrency(dbStats.totalValue)}</div>
                            <div className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Toplam Stok Degeri</div>
                        </div>
                    </div>
                </div>

                {/* Export */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-bold text-gray-900 dark:text-white">Disa Aktar (CSV)</div>
                            <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Tum verileri CSV olarak indir</p>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={isLoading}
                            className="bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                        >
                            {isLoading ? 'Kaydediliyor...' : 'Indir'}
                        </button>
                    </div>
                </div>

                {/* Import */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-bold text-gray-900 dark:text-white">Ice Aktar (CSV)</div>
                            <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">CSV dosyasindan urun yukle</p>
                        </div>
                        <button
                            onClick={handleImport}
                            disabled={isLoading}
                            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                            {isLoading ? 'Yukleniyor...' : 'Dosya Sec'}
                        </button>
                    </div>
                    {importStatus && (
                        <div className={`mt-3 text-sm ${importStatus.includes('basarili') || importStatus.includes('aktarildi') ? 'text-green-600' : 'text-red-500'}`}>
                            {importStatus}
                        </div>
                    )}
                </div>

                {/* DB Export/Import Section */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-zinc-500 uppercase mb-3">Veritabani Yedekleme</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                            <div className="flex flex-col gap-3">
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-white">DB Disa Aktar</div>
                                    <p className="text-gray-500 dark:text-zinc-500 text-xs mt-1">Veritabanini dosya olarak kaydet</p>
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
                                    <div className="font-bold text-gray-900 dark:text-white">DB Ice Aktar</div>
                                    <p className="text-gray-500 dark:text-zinc-500 text-xs mt-1">Yedek dosyasindan yukle</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        setIsLoading(true);
                                        try {
                                            const msg = await inventoryService.importDatabase();
                                            setImportStatus(msg);
                                            if (msg.includes('basarili')) {
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
                                    className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    Yukle
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Developer Tools */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-bold text-gray-900 dark:text-white">Yapay Veri Uret</div>
                            <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Test icin rastgele urun ve satis verisi ekle</p>
                        </div>
                        <button
                            onClick={async () => {
                                setIsLoading(true);
                                try {
                                    const msg = await inventoryService.seedDatabase();
                                    setImportStatus(msg);
                                    loadDbStats();
                                } catch (e) {
                                    setImportStatus(`Hata: ${e}`);
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            disabled={isLoading}
                            className="bg-gray-800 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-700 transition-all disabled:opacity-50"
                        >
                            Veri Uret
                        </button>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="font-bold text-red-600 dark:text-red-400">Verileri Sifirla</div>
                            <p className="text-red-400 dark:text-red-500/70 text-sm mt-1">Tum urun ve satis gecmisini kalici olarak siler</p>
                        </div>
                        <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            disabled={isLoading}
                            className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                            Verileri Sil
                        </button>
                    </div>
                </div>
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
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">EMIN MISINIZ?</h3>
                            <p className="text-gray-500 dark:text-zinc-400 text-sm mb-8">
                                Bu islem geri alinamaz. Tum urun veritabani ve satis gecmisi <span className="font-bold text-red-500">KALICI OLARAK SILINECEKTIR.</span>
                            </p>
                            <div className="flex w-full gap-3">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 px-5 py-3 rounded-xl font-bold text-sm border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Iptal
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

            {/* Restore Confirmation Modal */}
            {isRestoreModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full p-8">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-6">
                                <svg className="h-8 w-8 text-yellow-600 dark:text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Cloud'dan Geri Yukle</h3>
                            <p className="text-gray-500 dark:text-zinc-400 text-sm mb-4">
                                Bu islem mevcut veritabaninizi cloud yedegi ile degistirecek.
                            </p>
                            {cloudStatus?.last_backup_at && (
                                <p className="text-sm text-blue-600 dark:text-blue-400 mb-6">
                                    Yedek tarihi: {new Date(cloudStatus.last_backup_at).toLocaleString('tr-TR')}
                                </p>
                            )}
                            <div className="flex w-full gap-3">
                                <button
                                    onClick={() => setIsRestoreModalOpen(false)}
                                    className="flex-1 px-5 py-3 rounded-xl font-bold text-sm border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                    Iptal
                                </button>
                                <button
                                    onClick={handleCloudRestore}
                                    className="flex-1 px-5 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    Geri Yukle
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
