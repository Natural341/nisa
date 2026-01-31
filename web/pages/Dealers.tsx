import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Calendar, MoreHorizontal, Plus, ArrowRight, X } from 'lucide-react';
import Card from '../components/ui/Card';
import { MockService } from '../services/api';
import { Dealer } from '../types';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const Dealers: React.FC = () => {
    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Menu State
    const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);

    // Form State
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedDealerId, setSelectedDealerId] = useState<string | number | null>(null);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

    useEffect(() => {
        fetchDealers();
    }, []);

    const fetchDealers = () => {
        MockService.getDealers().then(setDealers).finally(() => setLoading(false));
    };

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleCreateOrUpdateDealer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email) {
            toast.error('Name and Email are required');
            return;
        }

        try {
            if (isEditMode && selectedDealerId) {
                await MockService.updateDealer(selectedDealerId, formData);
                toast.success('Dealer updated successfully');
            } else {
                await MockService.createDealer(formData);
                toast.success('Dealer registered successfully');
            }

            setIsModalOpen(false);
            setFormData({ name: '', email: '', phone: '' });
            fetchDealers();
        } catch (err) {
            toast.error(isEditMode ? 'Failed to update dealer' : 'Failed to create dealer');
        }
    };

    const handleDeleteDealer = async (id: string | number) => {
        if (!window.confirm('Are you sure you want to delete this dealer?')) return;

        try {
            await MockService.deleteDealer(id);
            toast.success('Dealer deleted successfully');
            setDealers(dealers.filter(d => d.id !== id));
        } catch (error) {
            toast.error('Failed to delete dealer');
        }
    };

    const openCreateModal = () => {
        setIsEditMode(false);
        setFormData({ name: '', email: '', phone: '' });
        setSelectedDealerId(null);
        setIsModalOpen(true);
    };

    const openEditModal = (dealer: Dealer) => {
        setIsEditMode(true);
        setFormData({ name: dealer.name, email: dealer.email, phone: dealer.phone });
        setSelectedDealerId(dealer.id);
        setIsModalOpen(true);
        setActiveMenuId(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Partner Network</h2>
                    <p className="text-slate-500 mt-1 text-sm">Authorized distributors & resellers</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center justify-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow-md hover:shadow-lg font-bold text-sm"
                >
                    <Plus className="mr-2 w-4 h-4" /> Register Partner
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="text-slate-400 col-span-3 text-center py-24 text-sm italic">Loading network data...</div>
                ) : dealers.map((dealer) => (
                    <Card key={dealer.id} className="group hover:-translate-y-1 hover:shadow-lg transition-all duration-300 border-slate-200 relative">
                        {/* Header / Avatar */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-700">
                                    {dealer.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{dealer.name}</h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={`w-2 h-2 rounded-full ${(dealer as any).active_licenses > 0 ? 'bg-emerald-500' : 'bg-slate-300'} shadow-sm`}></span>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{(dealer as any).active_licenses > 0 ? 'Licensed' : 'No License'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3 Dots Menu */}
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(activeMenuId === dealer.id ? null : dealer.id);
                                    }}
                                    className="text-slate-300 hover:text-slate-900 transition-colors p-1.5 hover:bg-slate-50 rounded-md"
                                >
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>

                                {activeMenuId === dealer.id && (
                                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-10 py-1 origin-top-right">
                                        <button
                                            onClick={() => openEditModal(dealer)}
                                            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                        >
                                            Edit Details
                                        </button>
                                        <button
                                            onClick={() => handleDeleteDealer(dealer.id)}
                                            className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contact Details */}
                        <div className="space-y-3 mb-6">
                            <div className="flex items-center p-3 rounded-lg bg-slate-50 border border-slate-100 group-hover:border-slate-200 transition-colors">
                                <div className="text-slate-400 mr-3">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Email Address</p>
                                    <p className="text-xs text-slate-900 font-semibold truncate">{dealer.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center p-3 rounded-lg bg-slate-50 border border-slate-100 group-hover:border-slate-200 transition-colors">
                                <div className="text-slate-400 mr-3">
                                    <Phone className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Phone Number</p>
                                    <p className="text-xs text-slate-900 font-semibold">{dealer.phone}</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <div className="flex items-center font-medium">
                                <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                <span>
                                    {dealer.latest_expiration
                                        ? new Date(dealer.latest_expiration).toLocaleDateString()
                                        : 'No Active License'}
                                </span>
                            </div>
                            <button
                                onClick={() => openEditModal(dealer)}
                                className="text-slate-900 font-bold hover:underline flex items-center cursor-pointer"
                            >
                                Manage <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* ADD/EDIT DEALER MODAL */}
            <AnimatePresence>
                {isModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
                        >
                            <div className="bg-white w-full max-w-md p-8 rounded-xl shadow-2xl pointer-events-auto mx-4 border border-slate-200">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">{isEditMode ? 'Edit Partner' : 'New Partner'}</h3>
                                        <p className="text-sm text-slate-500">{isEditMode ? 'Update partner details.' : 'Add a new distributor to the network.'}</p>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <form onSubmit={handleCreateOrUpdateDealer} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Company Name</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                                            placeholder="e.g. Apex Systems Ltd."
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Contact Email</label>
                                        <input
                                            type="email"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                                            placeholder="contact@company.com"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Phone Number</label>
                                        <input
                                            type="tel"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                                            placeholder="+1 (555) 000-0000"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="pt-4 flex gap-3">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                                            Cancel
                                        </button>
                                        <button type="submit" className="flex-1 py-3 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-md transition-colors">
                                            {isEditMode ? 'Update Partner' : 'Create Partner'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dealers;