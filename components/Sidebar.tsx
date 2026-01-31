import React, { useState } from 'react';
import { ViewState } from '../types';
import { useAuth } from '../src/context/AuthContext';
import { tauriInvoke } from '../services/tauriService';
import SyncStatusIndicator from './SyncStatusIndicator';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  collapsed: boolean; // Kept for prop compatibility but unused internally
  setCollapsed: (v: boolean) => void; // Kept for prop compatibility
  isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, theme, toggleTheme, isAdmin }) => {
  const { user, logout, updateCurrentUser } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', displayName: '', newPassword: '' });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // State for expanding/collapsing the "Veri Oluştur" menu
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  // State for expanding/collapsing the "Stok" menu
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
  // State for expanding/collapsing the "Satış" menu
  const [isSalesMenuOpen, setIsSalesMenuOpen] = useState(false);
  // State for expanding/collapsing the "İade" menu
  const [isReturnMenuOpen, setIsReturnMenuOpen] = useState(false);
  // State for expanding/collapsing the "Finans" menu
  const [isFinanceMenuOpen, setIsFinanceMenuOpen] = useState(false);

  // Define menu structure
  const menuStructure = [
    {
      type: 'group',
      groupKey: 'sales',
      label: 'Satış',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      adminOnly: false,
      children: [
        { id: ViewState.SALES_CASH, label: 'Nakit Satış' },
        { id: ViewState.SALES_CREDIT, label: 'Veresiye Satış' },
        { id: ViewState.SALES_MAIL_ORDER, label: 'Mail Order Satış' },
      ]
    },
    {
      type: 'group',
      groupKey: 'returns',
      label: 'İade',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
      adminOnly: false,
      children: [
        { id: ViewState.REFUND_CASH, label: 'Nakit İade' },
        { id: ViewState.REFUND_CREDIT, label: 'Veresiye İade' },
      ]
    },
    {
      type: 'group',
      groupKey: 'dataCreate',
      label: 'Veri Oluştur',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>,
      adminOnly: true,
      children: [
        { id: ViewState.CREATE_CURRENT_ACCOUNT, label: 'Cari Oluştur' },
        { id: ViewState.CREATE_STOCK_CARD, label: 'Stok Kart Oluştur' },
        { id: ViewState.CREATE_PRODUCT_GROUP, label: 'Ürün Grubu Oluştur' },
      ]
    },
    {
      type: 'group',
      groupKey: 'stock',
      label: 'Stok',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
      adminOnly: true,
      children: [
        { id: ViewState.GOODS_RECEIPT, label: 'Mal Kabul' },
        { id: ViewState.BULK_PRICE_UPDATE, label: 'Toplu Fiyat Güncelleme' },
        { id: ViewState.INVENTORY, label: 'Envanter' },
      ]
    },
    {
      type: 'group',
      groupKey: 'finance',
      label: 'Finans',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      adminOnly: true,
      children: [
        { id: ViewState.FINANCE_DAILY, label: 'Günlük Kasa' },
        { id: ViewState.FINANCE_STATEMENTS, label: 'Cari Extre' },
        { id: ViewState.FINANCE_EXPENSES, label: 'Masraf' },
      ]
    },
    {
      type: 'item',
      id: ViewState.SETTINGS,
      label: 'Ayarlar',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      adminOnly: true
    },
  ];

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
      <div className="w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 h-screen flex flex-col transition-all duration-300">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white dark:text-black font-black text-lg">N</span>
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">NEXUS</span>
          </div>
        </div>

        {/* User Info - Clickable */}
        {user && (
          <button
            onClick={openProfileModal}
            title="Profili Düzenle"
            className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-600 dark:text-zinc-300 font-semibold text-sm">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="overflow-hidden">
                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{user.displayName}</div>
                <div className="text-xs text-gray-500 dark:text-zinc-400">
                  {user.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menuStructure.map((item, index) => {
            if (item.adminOnly && !isAdmin) return null;

            if (item.type === 'group' && item.children) {
              // Group item (Stok, Veri Oluştur, etc.)
              const isGroupActive = item.children.some(child => child.id === currentView);
              const groupKey = (item as any).groupKey;

              let isOpen = false;
              let setOpen: (v: boolean) => void = () => { };

              if (groupKey === 'stock') {
                isOpen = isStockMenuOpen;
                setOpen = setIsStockMenuOpen;
              } else if (groupKey === 'dataCreate') {
                isOpen = isDataMenuOpen;
                setOpen = setIsDataMenuOpen;
              } else if (groupKey === 'sales') {
                isOpen = isSalesMenuOpen;
                setOpen = setIsSalesMenuOpen;
              } else if (groupKey === 'returns') {
                isOpen = isReturnMenuOpen;
                setOpen = setIsReturnMenuOpen;
              } else if (groupKey === 'finance') {
                isOpen = isFinanceMenuOpen;
                setOpen = setIsFinanceMenuOpen;
              }

              return (
                <div key={index} className="space-y-1">
                  <button
                    onClick={() => setOpen(!isOpen)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-base font-medium
                                ${isGroupActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Submenu */}
                  {isOpen && (
                    <div className="pl-4 space-y-1">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setView(child.id as ViewState)}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all text-sm font-medium
                                            ${currentView === child.id
                              ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white'
                              : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${currentView === child.id ? 'bg-black dark:bg-white' : 'bg-transparent border border-gray-400 dark:border-zinc-500'}`}></div>
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            } else {
              // Regular item
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as ViewState)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-base font-medium
                          ${currentView === item.id
                      ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            }
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-zinc-800 space-y-2">
          {/* Sync Status */}
          <SyncStatusIndicator />

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
            <span>{theme === 'dark' ? 'Açık Mod' : 'Koyu Mod'}</span>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Çıkış Yap</span>
          </button>
        </div>
      </div>

      {/* Profile Edit Modal - Unchanged */}
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