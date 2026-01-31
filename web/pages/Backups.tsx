
import React, { useEffect, useState } from 'react';
import { Download, FileArchive, Database, Upload, X } from 'lucide-react';
import Card from '../components/ui/Card';
import api, { MockService } from '../services/api';
import { Backup, Dealer } from '../types';
import toast from 'react-hot-toast';

const Backups: React.FC = () => {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [dealers, setDealers] = useState<Dealer[]>([]); // New state for dealers
    const [loading, setLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedDealerId, setSelectedDealerId] = useState<string>('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [backupsData, dealersData] = await Promise.all([
                MockService.getBackups(),
                MockService.getDealers()
            ]);
            setBackups(backupsData);
            setDealers(dealersData);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDownload = async (backup: Backup) => {
        try {
            toast.loading('Preparing download...');
            // We use the ADMIN specific restore endpoint which uses JWT auth instead of License key
            const response = await api.post('/cloud/admin/restore', {
                dealer_id: backup.dealerId,
            });

            if (response.data.success && response.data.backup_data) {
                // Convert Base64 to Blob
                const binaryString = window.atob(response.data.backup_data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'application/x-sqlite3' });

                // Create link
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = backup.fileName || ('backup-' + backup.dealerId + '.db');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.dismiss();
                toast.success('Download started!');
            } else {
                toast.error('Backup data not found.');
            }
        } catch (e: any) {
            toast.dismiss();
            console.error(e);
            toast.error('Download failed: ' + (e.response?.data?.message || e.message));
        }
    };

    const handleUpload = async () => {
        if (!selectedDealerId) {
            toast.error('Please select a dealer.');
            return;
        }
        if (!uploadFile) {
            toast.error('Please select a file to upload.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const base64String = (reader.result as string).split(',')[1]; // Remove data URL prefix

                toast.loading('Uploading backup...');
                const response = await api.post('/cloud/admin/backup', {
                    dealer_id: selectedDealerId,
                    backup_data: base64String,
                    file_name: uploadFile.name // Include file name for backend
                });

                if (response.data.success) {
                    toast.dismiss();
                    toast.success('Backup uploaded successfully');
                    setIsUploadModalOpen(false);
                    fetchData(); // Refresh list
                    setUploadFile(null);
                    setSelectedDealerId('');
                }
            } catch (error: any) {
                toast.dismiss();
                toast.error('Upload failed: ' + (error.response?.data?.message || error.message));
            }
        };
        reader.readAsDataURL(uploadFile);
    };

    return (
        <div className="space-y-8 relative">
            <div className="border-b border-slate-200 pb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900">Cloud Backups</h2>
                    <p className="text-slate-500 mt-2 text-base">Manage client database snapshots</p>
                </div>
                <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="inline-flex items-center px-5 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all text-sm font-bold shadow-lg shadow-slate-200"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Backup
                </button>
            </div>

            <Card className="p-0 overflow-hidden border-slate-200 shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-sm font-extrabold border-b border-slate-200 tracking-wider">
                            <tr>
                                <th className="px-8 py-5">Dealer Name</th>
                                <th className="px-8 py-5">Filename</th>
                                <th className="px-8 py-5">Size</th>
                                <th className="px-8 py-5">Uploaded At</th>
                                <th className="px-8 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-16 text-center text-slate-400 text-lg">Scanning cloud storage...</td></tr>
                            ) : backups.length === 0 ? (
                                <tr><td colSpan={5} className="p-16 text-center text-slate-400 text-lg">No backups found.</td></tr>
                            ) : backups.map((backup) => (
                                <tr key={backup.id} className="text-slate-700 hover:bg-slate-50 transition-colors group">
                                    <td className="px-8 py-5 font-bold text-slate-900 text-base">
                                        <div className="flex items-center">
                                            <div className="p-2 bg-slate-100 rounded-lg mr-4 text-slate-400 group-hover:text-slate-900 transition-colors">
                                                <Database className="w-5 h-5" />
                                            </div>
                                            {backup.dealerName || backup.dealerId}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 flex items-center font-mono text-base text-slate-600">
                                        <FileArchive className="w-5 h-5 mr-3 text-slate-400" />
                                        {backup.fileName}
                                    </td>
                                    <td className="px-8 py-5 text-base text-slate-500 font-mono font-medium">{backup.fileSize}</td>
                                    <td className="px-8 py-5 text-base text-slate-500">{backup.uploadedAt}</td>
                                    <td className="px-8 py-5 text-right">
                                        <button
                                            onClick={() => handleDownload(backup)}
                                            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all text-sm font-bold shadow-sm"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Download
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900">Upload Manual Backup</h3>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Select Dealer</label>
                                <select
                                    className="w-full rounded-xl border-slate-200 focus:ring-slate-900 focus:border-slate-900 font-medium"
                                    value={selectedDealerId}
                                    onChange={(e) => setSelectedDealerId(e.target.value)}
                                >
                                    <option value="">Select a dealer...</option>
                                    {dealers.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Backup File (.db)</label>
                                <input
                                    type="file"
                                    accept=".db,.sqlite,application/x-sqlite3"
                                    className="w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-all"
                                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                                >
                                    Upload
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// export default Backups;
export { Backups };