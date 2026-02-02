import React, { useState, useEffect } from 'react';
import { ViewState } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import POSMode from './components/ScannerMode';
import Settings from './components/Settings';
import TransactionsPage from './components/TransactionsPage';

import CreditPage from './components/CreditPage';
import UserManagement from './components/UserManagement';
import LoginPage from './components/LoginPage';
import ChangePasswordModal from './components/ChangePasswordModal';
import { RefreshProvider } from './src/context/RefreshContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LicenseProvider } from './src/context/LicenseContext';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';

const AppContent: React.FC = () => {
  const { isAuthenticated, isAdmin, isLoading, user, updateCurrentUser, logout } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.POS);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    // Load saved theme from localStorage
    const saved = localStorage.getItem('nexus-theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    setView: setCurrentView,
    onEscape: () => setShowPasswordModal(false),
  });

  useEffect(() => {
    // Apply theme to HTML element and save to localStorage
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('nexus-theme', theme);
  }, [theme]);

  // Check if user needs to change password
  useEffect(() => {
    if (user?.mustChangePassword) {
      setShowPasswordModal(true);
    }
  }, [user]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handlePasswordChanged = () => {
    // Update user to remove mustChangePassword flag
    if (user) {
      updateCurrentUser({ ...user, mustChangePassword: false });
    }
    setShowPasswordModal(false);
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-black dark:bg-white rounded-2xl flex items-center justify-center animate-pulse">
            <span className="text-white dark:text-black font-black text-2xl">N</span>
          </div>
          <p className="text-gray-500 dark:text-zinc-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard />;
      case ViewState.INVENTORY:
        return <InventoryList />;
      case ViewState.POS:
        return <POSMode />;
      case ViewState.TRANSACTIONS:
        return <TransactionsPage />;

      case ViewState.CREDIT:
        return <CreditPage />;
      case ViewState.USERS:
        return <UserManagement />;
      case ViewState.SETTINGS:
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-black text-gray-900 dark:text-white overflow-hidden font-sans select-none transition-colors duration-300">
      {/* Password Change Modal - Cannot be dismissed */}
      {showPasswordModal && user && (
        <ChangePasswordModal user={user} onPasswordChanged={handlePasswordChanged} />
      )}

      <Sidebar
        currentView={currentView}
        setView={setCurrentView}
        theme={theme}
        toggleTheme={toggleTheme}
        collapsed={isSidebarCollapsed}
        setCollapsed={setIsSidebarCollapsed}
        isAdmin={isAdmin}
      />
      <main className="flex-1 overflow-hidden relative bg-gray-50 dark:bg-black transition-colors duration-300">
        <div className="relative h-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LicenseProvider>
      <AuthProvider>
        <RefreshProvider>
          <AppContent />
        </RefreshProvider>
      </AuthProvider>
    </LicenseProvider>
  );
};

export default App;