import React, { useEffect, useState } from 'react';
import { RefreshCw, Search, Plus, ShieldOff, Copy, Check, Key, X, Filter, ChevronDown, Clock } from 'lucide-react';
import Card from '../components/ui/Card';
import { MockService } from '../services/api';
import { License, Dealer } from '../types';
import toast from 'react-hot-toast';

const Licenses: React.FC = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);

  // Generator Form State
  const [selectedDealer, setSelectedDealer] = useState<string>('');
  const [expiryType, setExpiryType] = useState('1year');
  const [maxDevices, setMaxDevices] = useState(1);
  const [licensePrice, setLicensePrice] = useState<number>(0);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lData, dData] = await Promise.all([
        MockService.getLicenses(),
        MockService.getDealers()
      ]);
      setLicenses(lData);
      setDealers(dData);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealer) {
      toast.error('Please select a dealer');
      return;
    }

    try {
      const date = new Date();
      if (expiryType === '1year') date.setFullYear(date.getFullYear() + 1);
      else if (expiryType === 'lifetime') date.setFullYear(date.getFullYear() + 99);

      const newLicense = await MockService.generateLicense(selectedDealer, date.toISOString().split('T')[0], maxDevices, licensePrice);

      setLicenses([newLicense, ...licenses]);
      setGeneratedKey(newLicense.key);
      setLicensePrice(0); // Reset price
      toast.success('License Generated');
    } catch (e) {
      toast.error('Generation Failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleResetHW = async (id: number) => {
    try {
      await MockService.resetLicense(id);
      setLicenses(prev => prev.map(l => l.id === id ? { ...l, macAddress: null } : l));
      toast.success('Cihaz kilidi sıfırlandı');
    } catch (e) {
      toast.error('Sıfırlama başarısız');
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await MockService.revokeLicense(id);
      setLicenses(prev => prev.map(l => l.id === id ? { ...l, status: 'revoked' } : l));
      toast.error('Lisans iptal edildi');
    } catch (e) {
      toast.error('İptal başarısız');
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await MockService.reactivateLicense(id);
      setLicenses(prev => prev.map(l => l.id === id ? { ...l, status: 'active' } : l));
      toast.success('Lisans tekrar aktifleştirildi');
    } catch (e) {
      toast.error('Aktifleştirme başarısız');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu lisansı kalıcı olarak silmek istediğinize emin misiniz?')) return;
    try {
      await MockService.deleteLicense(id);
      setLicenses(prev => prev.filter(l => l.id !== id));
      toast.success('Lisans silindi');
    } catch (e) {
      toast.error('Silme başarısız');
    }
  };

  const handleExtend = async (id: number) => {
    try {
      await MockService.extendLicense(id, '1year');
      toast.success('License Extended +1 Year');
      loadData(); // Refresh list to show new date
    } catch (e) {
      toast.error('Failed to extend license');
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">License Registry</h2>
          <p className="text-slate-500 text-sm mt-1">Manage software keys & activations</p>
        </div>
        <button
          onClick={() => { setShowGenerator(!showGenerator); setGeneratedKey(null); }}
          className={`
                flex items-center justify-center px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md
                ${showGenerator
              ? 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50'
              : 'bg-slate-900 border-2 border-transparent text-white hover:bg-slate-800 hover:shadow-lg'}
            `}
        >
          {showGenerator ? 'Close Panel' : 'Issue New License'}
          {showGenerator ? <X className="ml-2 w-4 h-4" /> : <Plus className="ml-2 w-4 h-4" />}
        </button>
      </div>

      {/* Generator Panel */}
      {showGenerator && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 animate-in slide-in-from-top-4 duration-300 w-full shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-widest mb-6">Configuration</h3>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">Assign to Partner</label>
                  <div className="relative">
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all appearance-none"
                      value={selectedDealer}
                      onChange={(e) => setSelectedDealer(e.target.value)}
                    >
                      <option value="">Select Partner...</option>
                      {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Süre</label>
                    <div className="relative">
                      <select
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all appearance-none"
                        value={expiryType}
                        onChange={(e) => setExpiryType(e.target.value)}
                      >
                        <option value="1year">1 Yıl</option>
                        <option value="lifetime">Süresiz</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Cihaz</label>
                    <input
                      type="number"
                      min="1" max="50"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                      value={maxDevices}
                      onChange={(e) => setMaxDevices(parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-2">Ücret (₺)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                      value={licensePrice || ''}
                      onChange={(e) => setLicensePrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <button type="submit" className="w-full mt-4 bg-slate-900 text-white font-bold text-sm py-3 rounded-lg hover:bg-slate-800 transition-all shadow-md hover:shadow-lg">
                  Generate Activation Key
                </button>
              </form>
            </div>

            {/* Result Panel */}
            <div className="flex flex-col justify-center border-l border-slate-100 pl-8">
              <div className={`
                    flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all h-full min-h-[250px]
                    ${generatedKey ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 border-slate-200'}
               `}>
                {generatedKey ? (
                  <div className="text-center w-full">
                    <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-900 text-white shadow-lg">
                      <Check className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mb-4">License Created Successfully</p>
                    <div
                      onClick={() => copyToClipboard(generatedKey)}
                      className="bg-white py-4 px-6 rounded-xl border-2 border-slate-200 cursor-pointer hover:border-slate-900 hover:shadow-md transition-all flex items-center justify-between gap-4 group"
                    >
                      <code className="text-lg font-mono text-slate-900 font-extrabold tracking-widest">{generatedKey}</code>
                      <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                        <Copy className="w-4 h-4 text-slate-600" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-3 font-medium">Click box to copy to clipboard</p>
                  </div>
                ) : (
                  <div className="text-center text-slate-400">
                    <Key className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-medium">Ready for generation</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Licenses Table - Full Width */}
      <Card className="p-0 overflow-hidden border-slate-200 shadow-sm w-full">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Key, Dealer or ID..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
            />
          </div>
          <div className="flex gap-2 self-end sm:self-auto">
            <button className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 uppercase tracking-wide transition-colors">
              <Filter className="w-3.5 h-3.5 mr-2" /> Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 uppercase font-extrabold text-xs text-slate-500 tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Lisans Anahtarı</th>
                <th className="px-6 py-4">Bayi</th>
                <th className="px-6 py-4">Cihaz</th>
                <th className="px-6 py-4">Ücret</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">Yükleniyor...</td></tr>
              ) : licenses.map((lic) => (
                <tr key={lic.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-1.5 bg-slate-100 rounded-lg text-slate-500 group-hover:text-slate-900 transition-colors cursor-pointer active:scale-95"
                        onClick={() => copyToClipboard(lic.key)}
                      >
                        <Key className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-slate-800 font-bold text-sm cursor-pointer hover:text-black decoration-2 hover:underline underline-offset-4" onClick={() => copyToClipboard(lic.key)}>
                        {lic.key}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-semibold">{lic.dealerName}</td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {lic.macAddress ? (
                      <span className="inline-flex items-center text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md font-medium">
                        {lic.macAddress.substring(0, 17)}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-[10px] uppercase font-bold tracking-wider pl-1">Bekliyor</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-semibold">
                    {lic.price ? `₺${lic.price.toLocaleString('tr-TR')}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide border
                      ${lic.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        lic.status === 'revoked' ? 'bg-red-50 text-red-700 border-red-100' :
                          'bg-slate-50 text-slate-600 border-slate-200'}
                    `}>
                      {lic.status === 'active' ? 'Aktif' : lic.status === 'revoked' ? 'İptal' : lic.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        onClick={() => handleResetHW(lic.id)}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 text-slate-500 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-500 transition-all shadow-sm"
                        disabled={!lic.macAddress}
                        title="Cihaz Sıfırla"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExtend(lic.id)}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-slate-500 transition-all shadow-sm"
                        title="Süre Uzat (+1 Yıl)"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      {lic.status === 'active' ? (
                        <button
                          onClick={() => handleRevoke(lic.id)}
                          className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-orange-600 hover:text-white hover:border-orange-600 text-slate-500 transition-all shadow-sm"
                          title="Lisansı İptal Et"
                        >
                          <ShieldOff className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(lic.id)}
                          className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-slate-500 transition-all shadow-sm"
                          title="Tekrar Aktifleştir"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(lic.id)}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-red-600 hover:text-white hover:border-red-600 text-slate-500 transition-all shadow-sm"
                        title="Kalıcı Sil"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Licenses;