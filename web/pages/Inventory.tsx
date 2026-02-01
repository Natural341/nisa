import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Users, Calendar, RefreshCw } from 'lucide-react';
import api from '../services/api';

interface RevenueData {
  totalRevenue: number;
  monthlyRevenue: number;
  dealerCount: number;
  licenseCount: number;
  recentLicenses: {
    id: number;
    dealerName: string;
    price: number;
    createdAt: string;
  }[];
}

const Revenue: React.FC = () => {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch licenses with prices
      const licensesRes = await api.get('/license');
      const dealersRes = await api.get('/dealers');

      const licenses = licensesRes.data || [];
      const dealers = dealersRes.data || [];

      // Calculate totals
      const totalRevenue = licenses.reduce((sum: number, lic: any) => sum + (parseFloat(lic.price) || 0), 0);

      // This month's revenue
      const now = new Date();
      const thisMonth = licenses.filter((lic: any) => {
        const created = new Date(lic.createdAt || lic.created_at);
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      });
      const monthlyRevenue = thisMonth.reduce((sum: number, lic: any) => sum + (parseFloat(lic.price) || 0), 0);

      // Recent licenses with prices
      const recentLicenses = licenses
        .filter((lic: any) => parseFloat(lic.price) > 0)
        .slice(0, 10)
        .map((lic: any) => ({
          id: lic.id,
          dealerName: lic.dealerName || 'Bilinmiyor',
          price: parseFloat(lic.price) || 0,
          createdAt: lic.createdAt || lic.created_at
        }));

      setData({
        totalRevenue,
        monthlyRevenue,
        dealerCount: dealers.length,
        licenseCount: licenses.filter((l: any) => l.status === 'active').length,
        recentLicenses
      });
    } catch (error) {
      console.error('Failed to fetch revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Gelir Raporu</h2>
          <p className="text-slate-500 text-sm mt-0.5">Lisans satışlarından elde edilen gelirler</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 mt-4 sm:mt-0"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Yenile
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Toplam Gelir</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(data?.totalRevenue || 0)}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Bu Ay</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(data?.monthlyRevenue || 0)}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Toplam Bayi</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{data?.dealerCount || 0}</p>
            </div>
            <div className="p-3 bg-slate-100 rounded-xl">
              <Users className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Aktif Lisans</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{data?.licenseCount || 0}</p>
            </div>
            <div className="p-3 bg-slate-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Son Satışlar</h3>
          <p className="text-sm text-slate-500">Ücretli lisans satışları</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Bayi</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Ücret</th>
                <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.recentLicenses && data.recentLicenses.length > 0 ? (
                data.recentLicenses.map((lic) => (
                  <tr key={lic.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{lic.dealerName}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-emerald-600">{formatCurrency(lic.price)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-slate-500">{formatDate(lic.createdAt)}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                    Henüz ücretli satış yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Revenue;
