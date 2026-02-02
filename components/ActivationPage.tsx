import React, { useState } from 'react';
import { useLicense } from '../src/context/LicenseContext';

const ActivationPage: React.FC = () => {
    const { activateLicense, error: contextError, clearError, isExpired } = useLicense();

    const [licenseKey, setLicenseKey] = useState('');
    // API URL - localhost for dev, production for build
    const [apiBaseUrl] = useState(
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : 'https://nisa.okilay.com'
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');
        clearError();

        if (!licenseKey.trim()) {
            setLocalError('Lütfen lisans anahtarını giriniz');
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await activateLicense(apiBaseUrl, licenseKey.trim());
            if (!success) {
                // Error is handled in context and set in contextError
                // But we can also set local state if needed
            } else {
                // Success! The App component strictly checks isLicensed, so it should auto-switch.
                window.location.reload(); // Reload to ensure clean state
            }
        } catch (err) {
            setLocalError('Beklenmeyen bir hata oluştu');
        } finally {
            setIsSubmitting(false);
        }
    };

    const finalError = localError || contextError;

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black p-4">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-5 dark:opacity-10 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            </div>

            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 relative z-10 transition-all">
                <div className="p-8 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-black/20 text-center">
                    <div className="w-16 h-16 bg-black dark:bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <svg className="w-8 h-8 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    {isExpired ? (
                        <>
                            <h2 className="text-2xl font-black text-red-600 dark:text-red-500 tracking-tight">Lisans Süresi Doldu</h2>
                            <p className="text-sm text-gray-500 mt-2">Kullanıma devam etmek için lütfen lisansınızı yenileyin veya yeni bir anahtar girin.</p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Ürün Aktivasyonu</h2>
                            <p className="text-sm text-gray-500 mt-2">Lütfen satın aldığınız lisans anahtarını girin</p>
                        </>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {finalError && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl font-bold border border-red-100 dark:border-red-900/30 flex items-start gap-3 animate-shake">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {finalError}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 ml-1">Lisans Anahtarı</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-700 rounded-xl pl-4 pr-10 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-mono tracking-widest"
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                required
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            </div>
                        </div>
                    </div>



                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-black dark:bg-white text-white dark:text-black font-black py-4 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                                Doğrulanıyor...
                            </>
                        ) : (
                            <>
                                LİSANSI ETKİNLEŞTİR
                                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </>
                        )}
                    </button>

                    <div className="text-center pt-2">
                        <p className="text-xs text-gray-400">Yardıma mı ihtiyacınız var? <a href="mailto:okan6226@gmail.com" className="underline hover:text-black dark:hover:text-white">Destek ekibiyle iletişime geçin.</a></p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ActivationPage;
