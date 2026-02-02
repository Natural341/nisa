import React, { useState } from 'react';
import { tauriInvoke } from '../services/tauriService';
import { User } from '../types';

interface ChangePasswordModalProps {
    user: User;
    onPasswordChanged: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, onPasswordChanged }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validations
        if (newPassword.length < 8) {
            setError('Şifre en az 8 karakter olmalı');
            return;
        }

        if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setError('Şifre en az bir harf ve bir rakam içermeli');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Şifreler eşleşmiyor');
            return;
        }

        if (newPassword === 'admin123') {
            setError('Varsayılan şifre kullanılamaz');
            return;
        }

        setIsLoading(true);
        try {
            await tauriInvoke('change_password', { id: user.id, newPassword });
            onPasswordChanged();
        } catch (err) {
            setError(typeof err === 'string' ? err : 'Şifre değiştirilemedi');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Şifre Değiştirme Zorunlu</h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
                        Güvenliğiniz için varsayılan şifrenizi değiştirmeniz gerekmektedir.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                            Yeni Şifre
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all"
                            placeholder="En az 8 karakter (harf + rakam)"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                            Şifre Tekrar
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all"
                            placeholder="Şifreyi tekrar girin"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Kaydediliyor...
                            </span>
                        ) : (
                            'Şifreyi Değiştir'
                        )}
                    </button>
                </form>

                {/* Security Tips */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                        <strong>Güçlü şifre için:</strong> En az 8 karakter, büyük/küçük harf ve rakam kullanın.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
