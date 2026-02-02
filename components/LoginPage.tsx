import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/context/AuthContext';
// Lisans sistemi devre dışı
// import { useLicense } from '../src/context/LicenseContext';
import { tauriInvoke } from '../services/tauriService';

type ViewMode = 'setup' | 'login';

interface UserLoginDisplay {
    id: string;
    username: string;
    displayName: string;
    role: string;
}

const LoginPage: React.FC = () => {
    const { login, error, updateCurrentUser } = useAuth();
    // Lisans sistemi devre dışı - direkt kullanıcı kontrolüne geç

    const [viewMode, setViewMode] = useState<ViewMode>('login');
    const [users, setUsers] = useState<UserLoginDisplay[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Setup State
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [localError, setLocalError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Admin şifre modalı için state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserLoginDisplay | null>(null);
    const [adminPassword, setAdminPassword] = useState('');

    // Kullanıcı varlığını kontrol et (Lisans kontrolü kaldırıldı)
    useEffect(() => {
        const checkStatus = async () => {
            try {
                // Kullanıcı var mı kontrol et
                const userList = await tauriInvoke<UserLoginDisplay[]>('get_users_for_login');
                if (userList && userList.length > 0) {
                    setUsers(userList);
                    setViewMode('login');
                } else {
                    setViewMode('setup');
                }
            } catch (e) {
                console.error("User fetch failed:", e);
                // Kullanıcı yoksa setup ekranına git
                setViewMode('setup');
            } finally {
                setIsInitialLoading(false);
            }
        };
        checkStatus();
    }, []);

    const handleUserClick = async (user: UserLoginDisplay) => {
        setLocalError('');

        // Admin için şifre modalı aç
        if (user.role === 'admin') {
            setSelectedUser(user);
            setAdminPassword('');
            setShowPasswordModal(true);
            return;
        }

        // Diğer kullanıcılar direkt giriş
        setIsSubmitting(true);
        const success = await login(user.username, "");

        if (!success) {
            setIsSubmitting(false);
            setLocalError(error || 'Giriş başarısız. Lütfen tekrar deneyin.');
        }
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setIsSubmitting(true);
        setLocalError('');

        const success = await login(selectedUser.username, adminPassword);

        if (!success) {
            setIsSubmitting(false);
            setLocalError(error || 'Hatalı şifre');
        } else {
            setShowPasswordModal(false);
        }
    };

    const handleSetupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError('');

        if (!username.trim()) {
            setLocalError('Kullanıcı adı gerekli');
            return;
        }

        // Admin için şifre zorunlu
        if (!password.trim()) {
            setLocalError('Yönetici hesabı için şifre zorunludur');
            return;
        }

        if (password !== confirmPassword) {
            setLocalError('Şifreler eşleşmiyor');
            return;
        }

        setIsSubmitting(true);
        try {
            await tauriInvoke('create_user', {
                request: {
                    username: username.trim(),
                    displayName: 'Yönetici',
                    password: password,
                    role: 'admin'
                }
            });

            // Login immediately after creation
            await login(username.trim(), password);
        } catch (err: any) {
            setLocalError(typeof err === 'string' ? err : 'Kurulum başarısız');
            setIsSubmitting(false);
        }
    };

    // Yükleme ekranı
    if (isInitialLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
            </div>
        );
    }

    // =========================================================================
    // LOGIN MODE: USER SELECTION GRID
    // =========================================================================
    if (viewMode === 'login') {
        return (
            <div className="flex h-screen bg-gray-100 dark:bg-black overflow-hidden relative">

                {/* Admin Şifre Modalı */}
                {showPasswordModal && selectedUser && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-zinc-800">
                            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-black/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-black flex items-center justify-center">
                                        <svg className="w-7 h-7 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                            {selectedUser.displayName || selectedUser.username}
                                        </h3>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Yönetici Girişi</p>
                                    </div>
                                </div>
                            </div>
                            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
                                {localError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl font-medium border border-red-100 dark:border-red-900/30">
                                        {localError}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">Şifre</label>
                                    <input
                                        type="password"
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                        placeholder="Şifrenizi girin"
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPasswordModal(false);
                                            setSelectedUser(null);
                                            setAdminPassword('');
                                            setLocalError('');
                                        }}
                                        className="flex-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 bg-black dark:bg-white text-white dark:text-black font-bold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Giriş...' : 'Giriş Yap'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Background Pattern */}
                <div className="absolute inset-0 z-0 opacity-5 dark:opacity-10 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                </div>

                <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-8">

                    <div className="text-center mb-12 animate-fade-in-down">
                        <div className="w-20 h-20 bg-black dark:bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                            <span className="text-white dark:text-black font-black text-3xl">N</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Hoş Geldiniz</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Devam etmek için hesabınızı seçin</p>
                    </div>

                    {localError && !showPasswordModal && (
                        <div className="mb-8 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-6 py-3 rounded-2xl border border-red-100 dark:border-red-900/30 font-bold text-sm shadow-sm animate-shake">
                            {localError}
                        </div>
                    )}

                    {/* User Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-4xl max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                        {users.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => handleUserClick(user)}
                                disabled={isSubmitting}
                                className="group relative bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-zinc-800 hover:border-black dark:hover:border-white text-center flex flex-col items-center gap-4 active:scale-95 touch-target"
                            >
                                <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-black border-4 border-white dark:border-zinc-800 shadow-inner flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 group-hover:rotate-3">
                                    <svg className="w-12 h-12 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>

                                <div>
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-black dark:group-hover:text-white transition-colors">
                                        {user.displayName || user.username}
                                    </h3>
                                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mt-1">
                                        {user.role === 'admin' ? 'Yönetici' : 'Personel'}
                                    </p>
                                </div>

                                {/* Kilit ikonu admin için */}
                                {user.role === 'admin' && (
                                    <div className="absolute top-3 right-3 w-6 h-6 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}

                                {/* Loading Overlay on Submit */}
                                {isSubmitting && !showPasswordModal && (
                                    <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-3xl flex items-center justify-center z-20">
                                        <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="mt-12 text-center">
                        <p className="text-xs text-gray-400 font-mono">v1.0.0</p>
                    </div>

                </div>
            </div>
        );
    }

    // Setup Screen (Only shown if no users exist)
    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-zinc-800">
                <div className="p-8 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-black/20">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Sistem Kurulumu</h2>
                    <p className="text-sm text-gray-500 mt-1">İlk yönetici hesabını oluşturun</p>
                </div>

                <form onSubmit={handleSetupSubmit} className="p-8 space-y-5">
                    {localError && (
                        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl font-medium border border-red-100">
                            {localError}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">Kullanıcı Adı</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">Şifre *</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                placeholder="Zorunlu"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">Şifre Tekrar *</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                                placeholder="Zorunlu"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg active:scale-[0.98]"
                    >
                        {isSubmitting ? 'Kuruluyor...' : 'KURULUMU TAMAMLA'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
