import React, { useEffect, useState } from 'react';
import { Monitor, Wifi, WifiOff, Clock, RefreshCw, Activity, ChevronDown } from 'lucide-react';
import Card from '../components/ui/Card';
import api from '../services/api';

interface Device {
  id: number;
  dealerId: string;
  dealerName: string;
  licenseKey: string;
  deviceIdentifier: string;
  deviceName: string;
  lastSyncAt: string;
  lastIp: string;
  pendingTransactions: number;
  status: 'online' | 'idle' | 'offline';
  minutesSinceSync: number;
}

interface SyncStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  todayTransactions: number;
  todaySales: number;
}

const Devices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDealer, setSelectedDealer] = useState<string>('all');
  const [hoveredDevice, setHoveredDevice] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [devicesRes, statsRes] = await Promise.all([
        api.get('/sync/devices'),
        api.get('/sync/stats')
      ]);
      setDevices(devicesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-emerald-500';
      case 'idle': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'online': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'idle': return 'bg-amber-50 border-amber-200 text-amber-800';
      default: return 'bg-slate-50 border-slate-200 text-slate-600';
    }
  };

  const formatLastSync = (minutes: number | null) => {
    if (minutes === null) return 'Never';
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  const filteredDevices = selectedDealer === 'all'
    ? devices
    : devices.filter(d => d.dealerId === selectedDealer);

  const uniqueDealers = [...new Map(devices.map(d => [d.dealerId, { id: d.dealerId, name: d.dealerName }])).values()];

  if (loading && devices.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400 font-medium">
        Loading devices...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Device Sync Status</h2>
          <p className="text-slate-500 text-sm mt-0.5">Monitor connected devices and sync activity</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 mt-4 sm:mt-0 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Monitor size={20} className="text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats?.totalDevices || 0}</p>
              <p className="text-xs text-slate-500 font-medium">Total Devices</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Wifi size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats?.onlineDevices || 0}</p>
              <p className="text-xs text-slate-500 font-medium">Online Now</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Activity size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats?.todayTransactions || 0}</p>
              <p className="text-xs text-slate-500 font-medium">Today's Syncs</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <WifiOff size={20} className="text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-400">{stats?.offlineDevices || 0}</p>
              <p className="text-xs text-slate-500 font-medium">Offline</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <select
            value={selectedDealer}
            onChange={(e) => setSelectedDealer(e.target.value)}
            className="appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Dealers</option>
            {uniqueDealers.map(dealer => (
              <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <span className="text-sm text-slate-500">
          Showing {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((device) => (
          <div
            key={device.id}
            className="relative bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredDevice(device.id)}
            onMouseLeave={() => setHoveredDevice(null)}
          >
            {/* Status indicator */}
            <div className="absolute top-4 right-4">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBg(device.status)}`}>
                <span className={`w-2 h-2 rounded-full ${getStatusColor(device.status)} ${device.status === 'online' ? 'animate-pulse' : ''}`}></span>
                {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
              </span>
            </div>

            {/* Device info */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-100 rounded-xl">
                <Monitor size={24} className="text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">
                  {device.deviceName || 'Unknown Device'}
                </h3>
                <p className="text-sm text-slate-500 truncate">{device.dealerName}</p>
              </div>
            </div>

            {/* Details */}
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Last Sync</span>
                <span className="font-medium text-slate-700 flex items-center gap-1">
                  <Clock size={14} />
                  {formatLastSync(device.minutesSinceSync)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Pending</span>
                <span className={`font-bold ${device.pendingTransactions > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {device.pendingTransactions} transactions
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">License</span>
                <span className="font-mono text-xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded">
                  {device.licenseKey?.substring(0, 9)}...
                </span>
              </div>
            </div>

            {/* Hover detail tooltip */}
            {hoveredDevice === device.id && (
              <div className="absolute z-10 left-0 right-0 -bottom-2 translate-y-full bg-slate-900 text-white rounded-lg p-4 shadow-xl text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Device ID</span>
                    <span className="font-mono text-xs">{device.deviceIdentifier?.substring(0, 20)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">IP Address</span>
                    <span className="font-mono">{device.lastIp || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Sync Time</span>
                    <span>{device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : 'Never'}</span>
                  </div>
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-900 rotate-45"></div>
              </div>
            )}
          </div>
        ))}

        {filteredDevices.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <Monitor size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-medium">No devices found</p>
            <p className="text-sm mt-1">Devices will appear here once they sync</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Devices;
