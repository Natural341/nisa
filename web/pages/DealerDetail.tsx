import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Trash2, Mail, Phone, Calendar, 
  Key, ShieldCheck, AlertCircle, History 
} from 'lucide-react';
import Card from '../components/ui/Card';
import { MockService } from '../services/api';
import { Dealer, License } from '../types';
import toast from 'react-hot-toast';

const DealerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit Form State
  const [form, setForm] = useState({ name: '', email: '', phone: '', status: 'active' });

  useEffect(() => {
    if (id) {
      loadDealerData(parseInt(id));
    }
  }, [id]);

  const loadDealerData = async (dealerId: number) => {
    try {
      setLoading(true);
      const [dData, lData] = await Promise.all([
        MockService.getDealer(dealerId),
        MockService.getLicenses(dealerId)
      ]);
      setDealer(dData);
      setLicenses(lData);
      setForm({
        name: dData.name,
        email: dData.email,
        phone: dData.phone,
        status: dData.status
      });
    } catch (e) {
      toast.error('Dealer not found');
      navigate('/dealers');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer) return;
    setSaving(true);
    try {
      // TypeScript partial fix by casting status
      const updatedData = { ...form, status: form.status as 'active' | 'inactive' };
      const updated = await MockService.updateDealer(dealer.id, updatedData);
      setDealer(updated);
      toast.success('Profile updated successfully');
    } catch (e) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!dealer) return;
    if (window.confirm('Are you sure you want to delete this partner? This cannot be undone.')) {
      try {
        await MockService.deleteDealer(dealer.id);
        toast.success('Partner deleted');
        navigate('/dealers');
      } catch (e) {
        toast.error('Delete failed');
      }
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-400">Loading details...</div>;
  if (!dealer) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={() => navigate('/dealers')} 
          className="p-2 rounded-full hover:bg-white hover:shadow-sm transition-all text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partner Management</h1>
          <p className="text-sm text-slate-500">View and edit details for <span className="font-semibold text-slate-800">{dealer.name}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${dealer.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {dealer.status}
            </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Edit Profile */}
        <div className="lg:col-span-1 space-y-6">
          <Card title="Profile Settings" className="border-slate-200">
            <form onSubmit={handleSave} className="space-y-5 pt-2">
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Company Name</label>
                  <input 
                    type="text" 
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  />
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-2">
                     <Mail className="w-3 h-3" /> Email Address
                  </label>
                  <input 
                    type="email" 
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  />
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-2">
                     <Phone className="w-3 h-3" /> Phone
                  </label>
                  <input 
                    type="tel" 
                    value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  />
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Account Status</label>
                  <select 
                    value={form.status}
                    onChange={e => setForm({...form, status: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
               </div>

               <div className="pt-4 flex flex-col gap-3">
                 <button 
                    type="submit" 
                    disabled={saving}
                    className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2"
                 >
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
                 </button>
                 
                 <button 
                    type="button" 
                    onClick={handleDelete}
                    className="w-full bg-white text-red-600 border border-red-100 font-bold py-3 rounded-lg hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-2"
                 >
                    <Trash2 className="w-4 h-4" /> Delete Partner
                 </button>
               </div>
            </form>
          </Card>

          <Card className="bg-slate-50 border-slate-200">
             <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                   <h4 className="text-sm font-bold text-slate-900">Partner Metadata</h4>
                   <p className="text-xs text-slate-500 mt-1">ID: <span className="font-mono text-slate-700">#{dealer.id}</span></p>
                   <p className="text-xs text-slate-500">Joined: <span className="font-mono text-slate-700">{new Date(dealer.createdAt).toLocaleDateString()}</span></p>
                </div>
             </div>
          </Card>
        </div>

        {/* Right Column: License History */}
        <div className="lg:col-span-2 space-y-6">
          <Card 
            title="Assigned Licenses" 
            subtitle={`${licenses.length} active keys associated with this account`}
            className="h-full border-slate-200"
          >
             {licenses.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                    <History className="w-12 h-12 mb-3 text-slate-200" />
                    <p className="text-sm font-medium">No licenses issued yet.</p>
                </div>
             ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">License Key</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Expires</th>
                                <th className="px-4 py-3">Terminals</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {licenses.map(lic => (
                                <tr key={lic.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-mono font-bold text-slate-700 flex items-center gap-2">
                                        <Key className="w-3.5 h-3.5 text-slate-400" /> {lic.key}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            lic.status === 'active' ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${lic.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                            {lic.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {lic.expiryDate}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                            {lic.maxDevices} Devices
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DealerDetail;