import React, { useState, useEffect } from 'react';
import { tauriInvoke } from '../services/tauriService';
import { User } from '../types';

interface CreateUserForm {
    username: string;
    password: string;
    displayName: string;
    role: 'admin' | 'user';
}

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [createForm, setCreateForm] = useState<CreateUserForm>({
        username: '',
        password: '',
        displayName: '',
        role: 'user'
    });

    const [editForm, setEditForm] = useState({
        username: '',
        displayName: '',
        role: 'user' as 'admin' | 'user'
    });

    const [newPassword, setNewPassword] = useState('');

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const data = await tauriInvoke<User[]>('get_all_users');
            setUsers(data);
        } catch (err) {
            setError(err as string);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!createForm.username.trim() || !createForm.password.trim() || !createForm.displayName.trim()) {
            setError('Tüm alanları doldurun');
            return;
        }

        try {
            await tauriInvoke('create_user', {
                request: {
                    username: createForm.username,
                    password: createForm.password,
                    displayName: createForm.displayName,
                    role: createForm.role
                }
            });
            setSuccess('Kullanıcı oluşturuldu');
            setShowCreateModal(false);
            setCreateForm({ username: '', password: '', displayName: '', role: 'user' });
            loadUsers();
        } catch (err) {
            setError(err as string);
        }
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        try {
            await tauriInvoke('update_user', {
                id: selectedUser.id,
                updates: {
                    username: editForm.username,
                    displayName: editForm.displayName,
                    role: editForm.role
                }
            });
            setSuccess('Kullanıcı güncellendi');
            setShowEditModal(false);
            setSelectedUser(null);
            loadUsers();
        } catch (err) {
            setError(err as string);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser || !newPassword.trim()) return;

        try {
            await tauriInvoke('change_password', {
                id: selectedUser.id,
                newPassword: newPassword
            });
            setSuccess('Şifre değiştirildi');
            setShowPasswordModal(false);
            setSelectedUser(null);
            setNewPassword('');
        } catch (err) {
            setError(err as string);
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`"${user.displayName}" kullanıcısını silmek istediğinize emin misiniz?`)) return;

        try {
            await tauriInvoke('delete_user', { id: user.id });
            setSuccess('Kullanıcı silindi');
            loadUsers();
        } catch (err) {
            setError(err as string);
        }
    };

    const openEditModal = (user: User) => {
        setSelectedUser(user);
        setEditForm({
            username: user.username,
            displayName: user.displayName,
            role: user.role
        });
        setShowEditModal(true);
    };

    const openPasswordModal = (user: User) => {
        setSelectedUser(user);
        setNewPassword('');
        setShowPasswordModal(true);
    };

    // Clear messages after 3 seconds
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    return (
        <div className="h-full overflow-auto p-6 bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kullanıcı Yönetimi</h1>
                    <p className="text-gray-500 dark:text-zinc-400">Sistem kullanıcılarını yönetin</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Yeni Kullanıcı
                </button>
            </div>

            {/* Messages */}
            {success && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400">
                    {success}
                </div>
            )}
            {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500 dark:text-zinc-400">Yükleniyor...</div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-zinc-400">Kullanıcı bulunamadı</div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-zinc-800">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Kullanıcı</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Rol</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Son Giriş</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <span className="text-gray-600 dark:text-zinc-300 font-semibold">
                                                    {user.displayName.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{user.displayName}</div>
                                                <div className="text-sm text-gray-500 dark:text-zinc-400">@{user.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${user.role === 'admin'
                                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                                            }`}>
                                            {user.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString('tr-TR') : 'Hiç giriş yapmadı'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="p-2 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                                                title="Düzenle"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => openPasswordModal(user)}
                                                className="p-2 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
                                                title="Şifre Değiştir"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user)}
                                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                title="Sil"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Yeni Kullanıcı Oluştur</h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    value={createForm.username}
                                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                    placeholder="kullanici_adi"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Şifre</label>
                                <input
                                    type="password"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Görünen İsim</label>
                                <input
                                    type="text"
                                    value={createForm.displayName}
                                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                    placeholder="Ahmet Yılmaz"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Rol</label>
                                <select
                                    value={createForm.role}
                                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'user' })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                >
                                    <option value="user">Kullanıcı</option>
                                    <option value="admin">Yönetici</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
                                >
                                    Oluştur
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Kullanıcı Düzenle</h3>
                        <form onSubmit={handleEditUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    value={editForm.username}
                                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                    placeholder="kullanici_adi"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Görünen İsim</label>
                                <input
                                    type="text"
                                    value={editForm.displayName}
                                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Rol</label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'user' })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                >
                                    <option value="user">Kullanıcı</option>
                                    <option value="admin">Yönetici</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showPasswordModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Şifre Değiştir - {selectedUser.displayName}
                        </h3>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Yeni Şifre</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowPasswordModal(false); setSelectedUser(null); setNewPassword(''); }}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-all"
                                >
                                    Değiştir
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
