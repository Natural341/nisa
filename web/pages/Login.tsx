import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MockService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Hexagon, Lock, User as UserIcon, ArrowRight, ScanBarcode } from 'lucide-react';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await MockService.login(username, password);
      login(response.token, response.user);
      toast.success('Welcome back.');
      navigate('/');
    } catch (error) {
      toast.error('Invalid Credentials (Try: admin/admin)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-nexus-base font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm p-8"
      >
        <div className="flex flex-col items-center mb-10">
            <div className="w-12 h-12 bg-nexus-primary text-white flex items-center justify-center rounded-lg mb-4">
                <ScanBarcode className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-nexus-primary tracking-tight">Nexus Admin</h1>
            <p className="text-nexus-secondary text-sm mt-1">Sign in to manage inventory</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-nexus-secondary tracking-wider ml-1">Username</label>
                <div className="relative group">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-nexus-primary transition-colors" />
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-nexus-primary placeholder-slate-400 focus:outline-none focus:border-nexus-primary focus:ring-1 focus:ring-nexus-primary transition-all shadow-sm"
                        placeholder="admin"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-nexus-secondary tracking-wider ml-1">Password</label>
                <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-nexus-primary transition-colors" />
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-nexus-primary placeholder-slate-400 focus:outline-none focus:border-nexus-primary focus:ring-1 focus:ring-nexus-primary transition-all shadow-sm"
                        placeholder="••••"
                    />
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-nexus-primary hover:bg-slate-800 text-white font-medium py-3 rounded-lg transition-all shadow-md flex items-center justify-center group mt-2"
            >
                {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        Continue <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-400">
                &copy; 2024 Nexus Inventory Systems. <br/>
                Protected by Hardware Lock Technology.
            </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;