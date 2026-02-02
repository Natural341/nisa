import React, { useState } from 'react';
import { tauriInvoke, isTauri } from '../services/tauriService';

// Validation functions
const validatePhone = (phone: string): boolean => {
    if (!phone.trim()) return true; // Optional field
    // Turkish phone format: 05XX XXX XX XX or 5XX XXX XX XX (with or without spaces/dashes)
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(0?5\d{9})$/;
    return phoneRegex.test(cleanPhone);
};

const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const CreateCurrentAccount: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ phone?: string; email?: string }>({});

    const [formData, setFormData] = useState({
        name: '',
        type: 'CUSTOMER',
        taxNumber: '',
        phone: '',
        email: '',
        address: '',
        note: '',
        paymentTerm: 0
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'paymentTerm' ? parseInt(value) || 0 : value
        }));

        // Clear field-specific errors on change
        if (name === 'phone' || name === 'email') {
            setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        if (name === 'phone' && value.trim() && !validatePhone(value)) {
            setFieldErrors(prev => ({ ...prev, phone: 'Geçersiz telefon formatı (05XX XXX XX XX)' }));
        }
        if (name === 'email' && value.trim() && !validateEmail(value)) {
            setFieldErrors(prev => ({ ...prev, email: 'Geçersiz e-posta formatı' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Cari/Firma adı zorunludur.');
            return;
        }

        // Validate phone and email
        const errors: { phone?: string; email?: string } = {};
        if (formData.phone.trim() && !validatePhone(formData.phone)) {
            errors.phone = 'Geçersiz telefon formatı (05XX XXX XX XX)';
        }
        if (formData.email.trim() && !validateEmail(formData.email)) {
            errors.email = 'Geçersiz e-posta formatı';
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setError('Lütfen formu kontrol edin. Geçersiz alanlar var.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        setFieldErrors({});

        try {
            if (isTauri()) {
                // Check if account name exists
                const exists = await tauriInvoke<boolean>('check_current_account_exists', { name: formData.name.trim() });
                if (exists) {
                    setError('Bu isimde bir cari hesap zaten mevcut.');
                    setLoading(false);
                    return;
                }

                await tauriInvoke('create_current_account', { data: formData });
            }

            setSuccess('Cari hesap başarıyla oluşturuldu!');
            setFormData({
                name: '',
                type: 'CUSTOMER',
                taxNumber: '',
                phone: '',
                email: '',
                address: '',
                note: '',
                paymentTerm: 0
            });
        } catch (err) {
            console.error(err);
            setError('Kayıt oluşturulurken bir hata oluştu. (Backend komutu henüz tanımlı değil olabilir)');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col overflow-y-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cari Oluştur</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Yeni bir müşteri veya tedarikçi kartı oluşturun.</p>
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

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Cari/Firma Adı */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                            Cari / Firma Adı <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base"
                            placeholder="Firma veya kişi adını girin"
                        />
                    </div>

                    {/* Cari Türü & Vergi/TC */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                Cari Türü
                            </label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base"
                            >
                                <option value="CUSTOMER">Müşteri</option>
                                <option value="SUPPLIER">Tedarikçi</option>
                                <option value="BOTH">Müşteri + Tedarikçi</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                Vergi No / TC Kimlik No
                            </label>
                            <input
                                type="text"
                                name="taxNumber"
                                value={formData.taxNumber}
                                onChange={handleChange}
                                maxLength={11}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base"
                                placeholder="VKN veya TCKN"
                            />
                        </div>
                    </div>

                    {/* Telefon & E-posta */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                Telefon
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all text-base ${fieldErrors.phone
                                    ? 'border-red-500 focus:ring-red-500'
                                    : 'border-gray-200 dark:border-zinc-700 focus:ring-black dark:focus:ring-white'
                                    }`}
                                placeholder="0532 XXX XX XX"
                            />
                            {fieldErrors.phone && (
                                <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                E-posta
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all text-base ${fieldErrors.email
                                    ? 'border-red-500 focus:ring-red-500'
                                    : 'border-gray-200 dark:border-zinc-700 focus:ring-black dark:focus:ring-white'
                                    }`}
                                placeholder="ornek@email.com"
                            />
                            {fieldErrors.email && (
                                <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                            )}
                        </div>
                    </div>

                    {/* Adres */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                            Adres
                        </label>
                        <textarea
                            name="address"
                            rows={2}
                            value={formData.address}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all resize-none text-base"
                            placeholder="Açık adres"
                        />
                    </div>

                    {/* Vade & Not */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                Vade (Gün)
                            </label>
                            <input
                                type="number"
                                name="paymentTerm"
                                min="0"
                                value={formData.paymentTerm}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base"
                                placeholder="0"
                            />
                            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Ödeme vadesi (gün olarak)</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
                                Not
                            </label>
                            <input
                                type="text"
                                name="note"
                                value={formData.note}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-base"
                                placeholder="Ek notlar..."
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4">
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
                                    Cari Oluştur
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCurrentAccount;
