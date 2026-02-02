import React, { useState, useEffect } from 'react';
import { ViewState } from './types';
import { tauriInvoke } from './services/tauriService';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import POSMode from './components/ScannerMode';
import Settings from './components/Settings';
import TransactionsPage from './components/TransactionsPage';

import FinancePage from './components/FinancePage';
import DailyCashReport from './components/DailyCashReport';
import CustomerStatement from './components/CustomerStatement';
import ExpensesPage from './components/ExpensesPage';
import UserManagement from './components/UserManagement';
import LoginPage from './components/LoginPage';
import ChangePasswordModal from './components/ChangePasswordModal';
import CreateCurrentAccount from './components/CreateCurrentAccount';
import CreateStockCard from './components/CreateStockCard';
import CreateProductGroup from './components/CreateProductGroup';
import GoodsReceipt from './components/GoodsReceipt';
import BulkPriceUpdate from './components/BulkPriceUpdate';
import ProductHistory from './components/ProductHistory';
import GoodsReceiptHistory from './components/GoodsReceiptHistory';
import { RefreshProvider } from './src/context/RefreshContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LicenseProvider, useLicense } from './src/context/LicenseContext';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';
import ActivationPage from './components/ActivationPage';

const AppContent: React.FC = () => {
  const { isAuthenticated, isAdmin, isLoading: isAuthLoading, user, updateCurrentUser, logout } = useAuth();
  const { isLicensed, isLoading: isLicenseLoading, daysUntilExpiry } = useLicense();

  const [currentView, setCurrentView] = useState<ViewState>(ViewState.SALES_CASH);
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
    // Start auto backup (every 6 hours)
    tauriInvoke('start_auto_backup', { intervalHours: 6 }).catch(console.error);

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

  // WARNING BANNER LOGIC
  const showExpiryWarning = daysUntilExpiry !== null && daysUntilExpiry !== undefined && daysUntilExpiry <= 14 && daysUntilExpiry >= 0;

  // Show loading while checking auth OR license
  if (isAuthLoading || isLicenseLoading) {
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

  // 1. License Check (Highest Priority)
  if (!isLicensed) {
    return <ActivationPage />;
  }

  // 2. Auth Check
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard />;
      case ViewState.INVENTORY:
        return <InventoryList onNavigate={setCurrentView} />;
      case ViewState.POS:
        return <POSMode defaultTab="NAKIT" />;
      case ViewState.SALES_CASH:
        return <POSMode defaultTab="NAKIT" hideTabs={true} />;
      case ViewState.SALES_CREDIT:
        return <POSMode defaultTab="VERESIYE" hideTabs={true} />;
      case ViewState.SALES_MAIL_ORDER:
        return <POSMode defaultTab="MAIL_ORDER" hideTabs={true} />;
      case ViewState.REFUND_CASH:
        return <POSMode defaultTab="IADE" returnType="CASH" hideTabs={true} />;
      case ViewState.REFUND_CREDIT:
        return <POSMode defaultTab="IADE" returnType="CREDIT" hideTabs={true} />;
      case ViewState.TRANSACTIONS:
        return <TransactionsPage />;
      case ViewState.FINANCE_DAILY:
        return <DailyCashReport />;
      case ViewState.FINANCE_EXPENSES:
        return <ExpensesPage />;
      case ViewState.FINANCE_STATEMENTS:
        return <CustomerStatement />;
      case ViewState.USERS:
        return <UserManagement />;
      case ViewState.SETTINGS:
        return <Settings />;
      case ViewState.CREATE_CURRENT_ACCOUNT:
        return <CreateCurrentAccount />;
      case ViewState.CREATE_STOCK_CARD:
        return <CreateStockCard />;
      case ViewState.CREATE_PRODUCT_GROUP:
        return <CreateProductGroup />;
      case ViewState.GOODS_RECEIPT:
        return <GoodsReceipt />;
      case ViewState.GOODS_RECEIPT_HISTORY:
        return <GoodsReceiptHistory />;
      case ViewState.BULK_PRICE_UPDATE:
        return <BulkPriceUpdate />;
      case ViewState.PRODUCT_HISTORY:
        return <ProductHistory onBack={() => setCurrentView(ViewState.INVENTORY)} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-black text-gray-900 dark:text-white overflow-hidden font-sans select-none transition-colors duration-300 flex-col">
      {/* LICENSE EXPIRY WARNING */}
      {showExpiryWarning && (
        <div className="bg-amber-500 text-black px-4 py-2 text-center text-sm font-bold flex justify-center items-center gap-2 shadow-md z-50">
          <span className="bg-black text-amber-500 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Dikkat</span>
          <span>Lisans süreniz {daysUntilExpiry} gün içinde dolacaktır. Lütfen bayinizle iletişime geçin.</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
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