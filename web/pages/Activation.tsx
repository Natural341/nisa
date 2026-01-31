import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Key, Server, Loader2 } from 'lucide-react';
import { MockService } from '../services/api'; // Using real service logic
import { useLicense } from '../context/LicenseContext';
import toast from 'react-hot-toast';

const Activation: React.FC = () => {
    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { checkLicense } = useLicense();

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const deviceId = localStorage.getItem('nexus_device_id') || 'dev-' + Math.random().toString(36).substring(2, 15);
            if (!localStorage.getItem('nexus_device_id')) localStorage.setItem('nexus_device_id', deviceId);

            const result = await MockService.activateLicense(key, deviceId, 'Admin PC');

            if (result.success) {
                localStorage.setItem('nexus_license_key', key);
                await checkLicense(); // Update context
                toast.success('License activated successfully!');
                navigate('/');
            } else {
                toast.error(result.message || 'Activation failed');
            }
        } catch (error: any) {
            toast.error(error.message || 'Connection failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-emerald-600 p-8 text-center">
                    <div className="mx-auto bg-emerald-500 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <ShieldCheck className="text-white w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Activate Nexus</h2>
                    <p className="text-emerald-100 mt-1">Reference Number: {localStorage.getItem('nexus_device_id') || 'Initializing...'}</p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleActivate} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">License Key</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={key}
                                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                                    placeholder="XXXX-YYYY-ZZZZ-WWWW"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono uppercase tracking-wide"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Activate License'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-400">
                            Your Device ID is used to bind your license.
                            <br />Please contact support if you need to migrate.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Activation;
