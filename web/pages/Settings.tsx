import React, { useState } from 'react';
import { useLicense } from '../context/LicenseContext';
import { ShieldCheck, Calendar, Server, Clock, LogOut } from 'lucide-react';
import Card from '../components/ui/Card';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
    const { licenseInfo } = useLicense();

    const handleUnbind = () => {
        if (confirm('Are you sure you want to decouple this device? You will need a new activation key.')) {
            localStorage.removeItem('nexus_license_key');
            window.location.reload();
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h2>
                <p className="text-slate-500 text-sm mt-0.5">Manage application configuration and licensing</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* License Info Card */}
                <div className="md:col-span-2">
                    <Card title="License Information" className="h-full">
                        {licenseInfo ? (
                            <div className="space-y-6 mt-2">
                                <div className="flex items-center p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full mr-4">
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Status</p>
                                        <p className="text-lg font-bold text-emerald-900">Active License</p>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <p className="text-xs text-emerald-700 font-mono">{licenseInfo.key}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                                        <div className="flex items-center mb-2">
                                            <Server className="w-4 h-4 text-slate-400 mr-2" />
                                            <span className="text-xs font-bold text-slate-500 uppercase">Provider</span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900">{licenseInfo.dealerName}</p>
                                    </div>

                                    <div className="p-4 border border-slate-100 rounded-xl bg-slate-50">
                                        <div className="flex items-center mb-2">
                                            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                                            <span className="text-xs font-bold text-slate-500 uppercase">Expiration</span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900">
                                            {new Date(licenseInfo.expiryDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                                    <div className="flex items-center">
                                        <Clock className="w-5 h-5 text-slate-400 mr-3" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Validity Period</p>
                                            <p className="text-xs text-slate-500">Time remaining on current plan</p>
                                        </div>
                                    </div>
                                    <span className="text-xl font-bold text-slate-900">{licenseInfo.daysRemaining} <span className="text-sm font-normal text-slate-500">days</span></span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <p className="mb-2">License verified, but details are unavailable.</p>
                                <p className="text-xs font-mono bg-slate-100 inline-block px-2 py-1 rounded">{localStorage.getItem('nexus_license_key') || 'No Key Found'}</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 mt-6 md:mt-auto">
                            <button
                                onClick={handleUnbind}
                                className="text-red-600 hover:text-red-700 text-sm font-bold flex items-center transition-colors px-2 py-1 hover:bg-red-50 rounded"
                            >
                                <LogOut className="w-4 h-4 mr-2" /> Deactivate License on this Device
                            </button>
                            <p className="text-[10px] text-slate-400 mt-2 px-2">
                                * This will remove the license key from this device and require re-activation.
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Device Info (Placeholder) */}
                <div>
                    <Card title="Device Config" className="h-full">
                        <div className="space-y-4 mt-2">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Local IP</p>
                                <p className="text-sm font-mono text-slate-900">{window.location.hostname}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Device ID</p>
                                <p className="text-[10px] font-mono text-slate-400 break-all">{localStorage.getItem('nexus_device_id')}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">App Version</p>
                                <p className="text-sm text-slate-900">v1.0.2 (Beta)</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Settings;
