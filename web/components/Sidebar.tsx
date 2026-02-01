import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Key,
  CloudDownload,
  X,
  ScanBarcode,
  LogOut,
  Settings,
  Monitor,
  History,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar: React.FC<{ isOpen: boolean; toggle: () => void }> = ({ isOpen, toggle }) => {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const links = [
    { name: 'Genel Bakış', path: '/', icon: LayoutDashboard },
    { name: 'Bayiler', path: '/dealers', icon: Users },
    { name: 'Lisanslar', path: '/licenses', icon: Key },
    { name: 'Gelir', path: '/inventory', icon: TrendingUp },
    { name: 'Cihazlar', path: '/devices', icon: Monitor },
    { name: 'İşlemler', path: '/transactions', icon: History },
    { name: 'Yedekler', path: '/backups', icon: CloudDownload },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="h-24 flex items-center px-8 border-b border-slate-100 bg-white shrink-0">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-white border border-slate-100 shadow-sm leading-none">
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">N</span>
          </div>
        </div>
        <div className="ml-4">
          <h1 className="text-xl font-black text-slate-900 tracking-tight">NEXUS</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin Panel</p>
        </div>
        <button onClick={toggle} className="ml-auto md:hidden text-slate-400 hover:text-slate-900">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto bg-white">
        {links.map((link) => {
          const isActive = pathname === link.path;
          const Icon = link.icon;

          return (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => { if (window.innerWidth < 768) toggle(); }}
              className={`
                group flex items-center px-5 py-4 rounded-2xl text-base font-bold transition-all duration-200
                ${isActive
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
              `}
            >
              <Icon className={`w-5 h-5 mr-4 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR (Static, always visible) */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-72 flex-col bg-white border-r border-slate-200 shadow-sm z-30">
        <SidebarContent />
      </aside>

      {/* MOBILE SIDEBAR (Drawer with animation) */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggle}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl md:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;