import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { ScanLine, Users, Server, TrendingUp, ArrowUpRight } from 'lucide-react';
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

  const pieData = stats?.pieData?.length ? stats.pieData : [
    { name: 'No Data', value: 1 }
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

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

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400 font-medium">Loading metrics...</div>;

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
      <div className="flex items-center mt-4">
        <span className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          +12.5% <ArrowUpRight className="w-3 h-3 ml-0.5" />
        </span>
        <span className="text-[10px] font-semibold text-slate-400 ml-2">vs last month</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm mt-0.5">Real-time system monitoring</p>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-emerald-800 tracking-wide">SYSTEM ONLINE</span>
        </div>
      </div>

      {/* Stats - Full Width Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <StatCard title="Total Dealers" value={stats?.totalDealers} icon={Users} />
        <StatCard title="Active Keys" value={stats?.activeLicenses} icon={Server} />
        <StatCard title="Daily Traffic" value={stats?.recentBackups || 0} icon={ScanLine} />
        <StatCard title="Revenue" value={`$${((stats?.totalRevenue || 0) / 1000).toFixed(1)}k`} icon={TrendingUp} />
      </div>

      {/* Main Content - Grid with Right Column Smaller */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 w-full">
        {/* Main Chart (Takes 3 columns now, was 2/3) */}
        <Card className="lg:col-span-3 shadow-sm border-slate-200" title="Transaction Traffic" subtitle="Live data stream (24h)">
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

        {/* Right Column (Pie + Activity) - Takes 1 Column (Smaller) */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* Pie Chart Card */}
          <Card title="License Status" className="flex-1 min-h-[200px]">
            <div className="h-[180px] w-full relative mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={3}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '4px', padding: '6px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-slate-900">98%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="p-1 rounded bg-slate-50">
                  <div className="text-lg font-bold text-slate-900">{entry.value}</div>
                  <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{entry.name}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity Feed */}
          <Card title="Audit Log" className="flex-1">
            <div className="space-y-4 mt-2">
              {activity.slice(0, 3).map((log) => (
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
    </div>
  );
};

export default Dashboard;