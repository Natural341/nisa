import React, { useState } from 'react';
import { ViewState } from '../types';
import { useAuth } from '../src/context/AuthContext';
import { tauriInvoke } from '../services/tauriService';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, theme, toggleTheme, collapsed, setCollapsed, isAdmin }) => {
  const { user, logout, updateCurrentUser } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', displayName: '', newPassword: '' });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // All menu items
  const allMenuItems = [
    {
      id: ViewState.DASHBOARD, label: 'Panel', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
      ), adminOnly: true
    },
    {
      id: ViewState.POS, label: 'Satış', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      ), adminOnly: false
    },
    {
      id: ViewState.INVENTORY, label: 'Envanter', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
      ), adminOnly: true
    },
    {
      id: ViewState.TRANSACTIONS, label: 'İşlemler', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
      ), adminOnly: true
    },
    {
      id: ViewState.CREDIT, label: 'Veresiye', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      ), adminOnly: true
    },
    {
      id: ViewState.USERS, label: 'Kullanıcılar', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ), adminOnly: true
    },
    {
      id: ViewState.SETTINGS, label: 'Ayarlar', icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      ), adminOnly: true
    },
  ];

  // Filter menu items based on user role
  const menuItems = isAdmin
    ? allMenuItems
    : allMenuItems.filter(item => !item.adminOnly);

  // Get current view label for collapsed mode
  const currentLabel = allMenuItems.find(i => i.id === currentView)?.label || '';

  const openProfileModal = () => {
    if (user) {
      setProfileForm({
        username: user.username,
        displayName: user.displayName,
        newPassword: ''
      });
      setProfileError(null);
      setProfileSuccess(null);
      setShowProfileModal(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setProfileError(null);
    setProfileSuccess(null);

    try {
      // Update user info
      await tauriInvoke('update_user', {
        id: user.id,
        updates: {
          username: profileForm.username,
          displayName: profileForm.displayName
        }
      });

      // Update password if provided
      if (profileForm.newPassword.trim()) {
        await tauriInvoke('change_password', {
          id: user.id,
          newPassword: profileForm.newPassword
        });
      }

      // Update local user state
      updateCurrentUser({
        ...user,
        username: profileForm.username,
        displayName: profileForm.displayName
      });

      setProfileSuccess('Profil güncellendi!');
      setTimeout(() => setShowProfileModal(false), 1500);
    } catch (err) {
      setProfileError(typeof err === 'string' ? err : 'Güncelleme başarısız');
    }
  };

  return (
    <>
      <div className={`${collapsed ? 'w-20' : 'w-56'} bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 h-screen flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white dark:text-black font-black text-lg">N</span>
            </div>
            {!collapsed && <span className="font-bold text-lg text-gray-900 dark:text-white">NEXUS</span>}
          </div>
        </div>

        {/* User Info - Clickable */}
        {user && (
          <button
            onClick={openProfileModal}
            title="Profili Düzenle"
            className={`px-3 py-3 border-b border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left ${collapsed ? 'text-center' : ''}`}
          >
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-600 dark:text-zinc-300 font-semibold text-sm">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              {!collapsed && (
                <div className="overflow-hidden">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{user.displayName}</div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400">
                    {user.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                  </div>
                </div>
              )}
            </div>
          </button>
        )}

        {/* Current Page Label - Only when collapsed */}
        {collapsed && (
          <div className="px-2 py-2 text-center border-b border-gray-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">
              {currentLabel}
            </span>
          </div>
        )}

        {/* Menu - Centered */}
        <nav className="flex-1 flex flex-col justify-center py-4 px-3">
          <div className="space-y-2">
            {menuItems.map(item => (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => setView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-base font-medium
                    ${currentView === item.id
                      ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-white'
                    }
                    ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </button>
                {/* Tooltip - Only when collapsed */}
                {collapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                    {item.label}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-zinc-800 space-y-2">
          <div className="relative group">
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all ${collapsed ? 'justify-center px-0' : ''}`}
            >
              {theme === 'dark' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
              {!collapsed && <span>{theme === 'dark' ? 'Açık' : 'Koyu'}</span>}
            </button>
            {collapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                {theme === 'dark' ? 'Açık Mod' : 'Koyu Mod'}
              </div>
            )}
          </div>
          <div className="relative group">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <svg className={`w-6 h-6 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              {!collapsed && <span>Daralt</span>}
            </button>
            {collapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                Genişlet
              </div>
            )}
          </div>
          {/* Logout Button */}
          <div className="relative group">
            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!collapsed && <span>Çıkış Yap</span>}
            </button>
            {collapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                Çıkış Yap
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showProfileModal && user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profili Düzenle</h3>

            {profileError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm">
                {profileSuccess}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Kullanıcı Adı</label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Görünen İsim</label>
                <input
                  type="text"
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Yeni Şifre (opsiyonel)</label>
                <input
                  type="password"
                  value={profileForm.newPassword}
                  onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  placeholder="Değiştirmek istemiyorsanız boş bırakın"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
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
    </>
  );
};

export default Sidebar;