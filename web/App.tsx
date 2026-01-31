import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Menu, Loader2 } from 'lucide-react';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Licenses from './pages/Licenses';
import Dealers from './pages/Dealers';
import DealerDetail from './pages/DealerDetail';
import { Backups } from './pages/Backups';
import Login from './pages/Login';
import Activation from './pages/Activation';
import Settings from './pages/Settings';
import Devices from './pages/Devices';
import Transactions from './pages/Transactions';
import Inventory from './pages/Inventory';

import { AuthProvider, useAuth } from './context/AuthContext';
import { LicenseProvider, useLicense } from './context/LicenseContext';

// Guard Component
const LicenseGuard = ({ children }: { children: React.ReactElement }) => {
  const { isLicensed, loading } = useLicense();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nexus-base">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Allow access to activation page
  if (location.pathname === '/activate') {
    if (isLicensed) return <Navigate to="/" />; // Already licensed
    return children;
  }

  if (!isLicensed) {
    return <Navigate to="/activate" />;
  }

  return children;
};

// Layout Wrapper
const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-nexus-base text-nexus-primary font-sans">
      {/* Sidebar Component handles its own positioning */}
      <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(false)} />

      {/* Main Content Area - Pushed right on Desktop (matches w-72 sidebar) */}
      <main className="md:ml-72 flex flex-col min-h-screen transition-all duration-300">
        {/* Mobile Header */}
        <header className="md:hidden h-16 flex items-center justify-between px-4 border-b border-slate-200 bg-white sticky top-0 z-20">
          <div className="font-bold text-base text-nexus-primary tracking-tight">NEXUS ADMIN</div>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-md">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Content Container - FULL WIDTH (No max-w constraint) */}
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LicenseProvider>
      <AuthProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'text-sm font-medium',
              style: {
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Activation route kept but optional/unused in admin context */}
            <Route path="/activate" element={<Activation />} />

            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/licenses" element={<Licenses />} />
              <Route path="/dealers" element={<Dealers />} />
              <Route path="/dealers/:id" element={<DealerDetail />} />
              <Route path="/backups" element={<Backups />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LicenseProvider>
  );
};

export default App;