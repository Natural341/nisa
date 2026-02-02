import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/context/AuthContext';
import { useLicense } from '../src/context/LicenseContext';

type ViewMode = 'license' | 'login';

const LoginPage: React.FC = () => {
    const { login, error } = useAuth();
    const { license, isLicensed, isLoading: licenseLoading, error: licenseError, activateLicense, clearError } = useLicense();

    const [viewMode, setViewMode] = useState<ViewMode>('license');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // License activation form state - boş başlasın, kullanıcı girsin
    const [apiBaseUrl, setApiBaseUrl] = useState('');
    const [licenseKey, setLicenseKey] = useState('');

    // Determine view mode based on license status
    useEffect(() => {
        if (!licenseLoading) {
            if (isLicensed) {
                setViewMode('login');
            } else {
                setViewMode('license');
            }
        }
    }, [isLicensed, licenseLoading]);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');

        if (!username.trim()) {
            setLocalError('Kullanici adi gerekli');
            return;
        }
        if (!password.trim()) {
            setLocalError('Sifre gerekli');
            return;
        }

        setIsSubmitting(true);
        const success = await login(username.trim(), password);
        setIsSubmitting(false);

        if (!success) {
            setLocalError(error || 'Giris basarisiz');
        }
    };

    const handleLicenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        clearError();

        if (!apiBaseUrl.trim()) {
            setLocalError('API adresi gerekli');
            return;
        }
        if (!licenseKey.trim()) {
            setLocalError('Lisans anahtari gerekli');
            return;
        }

        setIsSubmitting(true);
        const success = await activateLicense(apiBaseUrl.trim(), licenseKey.trim());
        setIsSubmitting(false);

        if (success) {
            setViewMode('login');
        }
    };

    // Loading state
    if (licenseLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-black">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-black dark:bg-white rounded-2xl mb-4 shadow-lg animate-pulse">
                        <span className="text-white dark:text-black font-black text-4xl">N</span>
                    </div>
                    <p className="text-gray-500 dark:text-zinc-400">Lisans kontrol ediliyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-black p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-black dark:bg-white rounded-2xl mb-4 shadow-lg">
                        <span className="text-white dark:text-black font-black text-4xl">N</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">NEXUS</h1>
                    <p className="text-gray-500 dark:text-zinc-400 mt-1">Envanter Yonetim Sistemi</p>
                    {license && (
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                            {license.dealerName}
                        </p>
                    )}
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 p-8">
                    {viewMode === 'license' ? (
                        /* License Activation Form */
                        <>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
                                Lisans Aktivasyonu
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 text-center mb-6">
                                Uygulamayi kullanmak icin lisans anahtarinizi girin
                            </p>

                            <form onSubmit={handleLicenseSubmit} className="space-y-5">
                                {/* API Base URL */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                                        API Sunucu Adresi
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                            </svg>
                                        </div>
                                        <input
                                            type="url"
                                            value={apiBaseUrl}
                                            onChange={(e) => setApiBaseUrl(e.target.value)}
                                            placeholder="https://api.example.com"
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                {/* License Key */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                                        Lisans Anahtari
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={licenseKey}
                                            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                                            placeholder="NEXUS-XXXX-XXXX-XXXX"
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all font-mono"
                                            autoFocus
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                {/* Error Message */}
                                {(localError || licenseError) && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {localError || licenseError}
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 px-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Aktive ediliyor...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                            Lisansi Aktive Et
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        /* Login Form */
                        <>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
                                Giris Yap
                            </h2>

                            <form onSubmit={handleLoginSubmit} className="space-y-5">
                                {/* Username Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                                        Kullanici Adi
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="admin"
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
                                            autoFocus
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                                        Sifre
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="********"
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                {/* Error Message */}
                                {(localError || error) && (
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {localError || error}
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 px-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Giris yapiliyor...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                            </svg>
                                            Giris Yap
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Footer hint */}
                            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-800">
                                <p className="text-xs text-gray-400 dark:text-zinc-500 text-center">
                                    Yardim icin sistem yoneticinize basvurun
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* License info at bottom */}
                {license && viewMode === 'login' && (
                    <div className="mt-4 text-center">
                        <p className="text-xs text-gray-400 dark:text-zinc-500">
                            Lisans: {license.licenseKey.substring(0, 10)}...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
