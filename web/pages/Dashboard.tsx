import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ScanLine, Users, Server, TrendingUp } from 'lucide-react';
import Card from '../components/ui/Card';
import { MockService } from '../services/api';
import { DashboardStats, ActivityLog } from '../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Use real data if available, fallbacks for initial empty state
  const chartData = stats?.chartData?.length ? stats.chartData : [
    { name: '00:00', value: 0 }, { name: '06:00', value: 0 },
    { name: '12:00', value: 0 }, { name: '18:00', value: 0 }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, activityData] = await Promise.all([
          MockService.getStats(),
          MockService.getActivity()
        ]);
        setStats(statsData);
        setActivity(activityData);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400 font-medium">Yükleniyor...</div>;

  const StatCard = ({ title, value, icon: Icon }: any) => (
    <div className="bg-white p-6 rounded-lg border border-slate-200 flex flex-col justify-between hover:shadow-md transition-all duration-300 min-h-[140px]">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</span>
          <span className="text-3xl font-bold text-slate-900 tracking-tight">{value}</span>
        </div>
        <div className="p-2.5 bg-slate-50 rounded-lg text-slate-700 border border-slate-100">
          <Icon size={22} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Kontrol Paneli</h2>
          <p className="text-slate-500 text-sm mt-0.5">Sistem durumu ve istatistikler</p>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-emerald-800 tracking-wide">SİSTEM AKTİF</span>
        </div>
      </div>

      {/* Stats - Full Width Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <StatCard title="Toplam Bayi" value={stats?.totalDealers || 0} icon={Users} />
        <StatCard title="Aktif Lisans" value={stats?.activeLicenses || 0} icon={Server} />
        <StatCard title="Yedek Sayısı" value={stats?.recentBackups || 0} icon={ScanLine} />
        <StatCard title="Toplam Gelir" value={`₺${(stats?.totalRevenue || 0).toLocaleString('tr-TR')}`} icon={TrendingUp} />
      </div>

      {/* Main Content - Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* Main Chart */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200" title="Aktivite Grafiği" subtitle="Son 24 saat">
          <div className="h-[350px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '4px', padding: '8px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorScans)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Activity Feed */}
        <Card title="Son Aktiviteler" className="lg:col-span-1">
          <div className="space-y-4 mt-2">
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Henüz aktivite yok</p>
            ) : activity.slice(0, 6).map((log) => (
              <div key={log.id} className="flex gap-3 items-start border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 shadow-sm ${log.type === 'success' ? 'bg-emerald-500' : log.type === 'warning' ? 'bg-amber-500' : 'bg-slate-800'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-xs font-bold text-slate-900">{log.action}</span>
                    <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{log.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{log.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;