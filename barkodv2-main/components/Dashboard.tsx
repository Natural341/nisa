import React, { useEffect, useState, useMemo } from 'react';
import { inventoryService } from '../services/inventoryService';
import { InventoryItem, Transaction } from '../types';
import { isTauri, tauriInvoke } from '../services/tauriService';
import { useRefresh } from '../src/context/RefreshContext';

type DashboardView = 'MAIN' | 'REVENUE' | 'STOCK' | 'SKUS' | 'CRITICAL' | 'TRANSACTIONS';
type TimeRange = '7D' | '30D' | '3M' | '1Y' | 'YTD';

interface ChartPoint {
    label: string;
    value: number;
}

const Dashboard: React.FC = () => {
    const { lastUpdated } = useRefresh();
    const [currentView, setCurrentView] = useState<DashboardView>('MAIN');
    const [stats, setStats] = useState({
        totalItems: 0,
        totalStock: 0,
        lowStock: 0,
        totalRevenue: 0
    });
    const [allItems, setAllItems] = useState<InventoryItem[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [chartData, setChartData] = useState<ChartPoint[]>([]);

    // Date State
    const [timeRange, setTimeRange] = useState<TimeRange | 'CUSTOM'>('7D');
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadInitialStats();
    }, [lastUpdated]);

    useEffect(() => {
        loadRangeData();
    }, [startDate, endDate, lastUpdated]);

    const loadInitialStats = async () => {
        const [items, dashStats] = await Promise.all([
            inventoryService.getAllItems(),
            inventoryService.getDashboardStats()
        ]);
        setAllItems(items);
        if (dashStats) {
            setStats({
                totalItems: dashStats.totalItems,
                totalStock: dashStats.totalQuantity,
                lowStock: dashStats.lowStockCount,
                totalRevenue: dashStats.totalRevenue
            });
        }
    };

    const handlePresetChange = (range: TimeRange) => {
        setTimeRange(range);
        const end = new Date();
        const start = new Date();
        let days = 7;

        switch (range) {
            case '7D': days = 7; break;
            case '30D': days = 30; break;
            case '3M': days = 90; break;
            case '1Y': days = 365; break;
            case 'YTD':
                days = Math.ceil((end.getTime() - new Date(end.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24));
                break;
        }
        start.setDate(end.getDate() - days);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };

    const handleDateChange = (type: 'start' | 'end', val: string) => {
        setTimeRange('CUSTOM');
        if (type === 'start') setStartDate(val);
        else setEndDate(val);
    };

    const loadRangeData = async () => {
        try {
            // Fetch filtered transactions
            console.log('[Dashboard] Fetching transactions for range:', startDate, 'to', endDate);
            const txns = await inventoryService.getTransactionsByDateRange(startDate, endDate);
            console.log('[Dashboard] Received transactions:', txns.length, txns);
            setTransactions(txns);

            // Generate Chart Data from these transactions
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include end date

            // Determine points (daily for short ranges, weekly/monthly for long)
            let points = diffDays;
            let stepDays = 1;
            let format: 'day' | 'month' = 'day';

            if (diffDays > 31) {
                points = 12; // approximate for simplicity or 30
                stepDays = Math.ceil(diffDays / points);
                format = diffDays > 90 ? 'month' : 'day';
            }

            const dataPoints: ChartPoint[] = [];

            for (let i = 0; i < diffDays; i += stepDays) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);

                // Don't go past end date
                if (d > end) break;

                const nextD = new Date(d);
                nextD.setDate(nextD.getDate() + stepDays);

                // Sum transactions in this slice
                let sliceTotal = 0;
                txns.forEach(t => {
                    const tDate = new Date(t.createdAt);
                    if (tDate >= d && tDate < nextD) {
                        sliceTotal += (t.transactionType === 'RETURN' ? -Math.abs(t.total) : t.total);
                    }
                });

                let label = '';
                if (format === 'day') {
                    label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                } else {
                    label = d.toLocaleDateString('tr-TR', { month: 'short' });
                }

                dataPoints.push({ label, value: sliceTotal > 0 ? sliceTotal : 0 }); // Show 0 if negative for chart aesthetics or handle differently
            }

            setChartData(dataPoints);

        } catch (error) {
            console.error(error);
        }
    };

    const maxSale = Math.max(...chartData.map(d => d.value), 1);
    const lowStockItems = useMemo(() => allItems.filter(item => item.quantity < 10).slice(0, 6), [allItems]);

    const categoryStats = useMemo(() => {
        return allItems.reduce((acc, item) => {
            const cat = item.category || 'Diğer';
            if (!acc[cat]) acc[cat] = { count: 0, value: 0 };
            acc[cat].count += item.quantity;
            acc[cat].value += item.price * item.quantity;
            return acc;
        }, {} as Record<string, { count: number; value: number }>);
    }, [allItems]);

    const totalValue = Object.values(categoryStats).reduce((sum, c) => sum + c.value, 0);

    const handleStatClick = (view: DashboardView) => {
        setCurrentView(view);
    };

    const StatCard = ({ title, value, prefix = '', alert, targetView }: {
        title: string, value: number, prefix?: string, alert?: boolean, colorClass?: string, targetView: DashboardView
    }) => (
        <div
            onClick={() => handleStatClick(targetView)}
            className={`group relative overflow-hidden bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 p-8 cursor-pointer 
            transition-all duration-300 hover:border-black dark:hover:border-white`}
        >
            <div className="flex flex-col h-full justify-between relative z-10">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500 mb-4 group-hover:text-black dark:group-hover:text-white transition-colors">
                    {title}
                </div>
                <div className={`text-4xl md:text-5xl font-light tracking-tight ${alert ? 'text-black dark:text-white' : 'text-black dark:text-white'}`}>
                    {prefix}{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
                </div>
                {alert && (
                    <div className="absolute top-8 right-8 w-2 h-2 rounded-full bg-black dark:bg-white animate-pulse" />
                )}
            </div>
            <div className="absolute inset-0 bg-gray-50 dark:bg-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-0"></div>
        </div>
    );

    const BackHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
        <div className="flex items-center justify-between mb-12 pb-6 border-b border-gray-200 dark:border-zinc-800">
            <button
                onClick={() => setCurrentView('MAIN')}
                className="group flex items-center gap-3 px-6 py-3 border border-gray-200 dark:border-zinc-800 text-sm font-bold uppercase tracking-wider hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
            >
                <span>←</span> Geri
            </button>
            <div className="text-right">
                <h2 className="text-3xl font-light text-black dark:text-white uppercase tracking-wide">{title}</h2>
                <p className="text-gray-400 dark:text-zinc-500 text-sm mt-2 font-mono">{subtitle}</p>
            </div>
        </div>
    );

    // --- REUSABLE COMPONENTS ---
    const TableView = ({ title, subtitle, data, type }: { title: string, subtitle: string, data: InventoryItem[], type: 'STOCK' | 'SKUS' | 'CRITICAL' }) => (
        <div className="max-w-7xl mx-auto">
            <BackHeader title={title} subtitle={subtitle} />

            <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Barkod / Kod</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Ürün Adı</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Kategori</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 text-right">Fiyat</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 text-right">Maliyet</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 text-right">Stok</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 text-right">Durum</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {data.map(item => (
                            <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <td className="p-4 font-mono text-xs text-gray-400 dark:text-zinc-500">{item.sku}</td>
                                <td className="p-4 font-bold text-gray-900 dark:text-white">{item.name}</td>
                                <td className="p-4 text-sm text-gray-600 dark:text-zinc-400">
                                    <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 text-xs font-bold uppercase">{item.category}</span>
                                </td>
                                <td className="p-4 text-right font-mono text-sm text-gray-900 dark:text-white">₺{item.price.toFixed(2)}</td>
                                <td className="p-4 text-right font-mono text-sm text-gray-500 dark:text-zinc-500">₺{(item.costPrice || 0).toFixed(2)}</td>
                                <td className="p-4 text-right font-mono text-sm font-bold text-gray-900 dark:text-white">{item.quantity}</td>
                                <td className="p-4 text-right">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${item.quantity === 0 ? 'text-red-500' :
                                        item.quantity < 10 ? 'text-orange-500' : 'text-green-500'
                                        }`}>
                                        {item.quantity === 0 ? 'Tükendi' : item.quantity < 10 ? 'Kritik' : 'Stokta'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length === 0 && (
                    <div className="p-12 text-center text-gray-400 dark:text-zinc-600">
                        <p className="text-sm uppercase tracking-widest">Veri Bulunamadı</p>
                    </div>
                )}
            </div>
        </div>
    );

    // --- REVENUE VIEW (UPDATED) ---
    const RevenueView = () => (
        <div className="max-w-7xl mx-auto">
            <BackHeader title="Gelir Analizi" subtitle="Detaylı Satış Raporu" />

            {/* Time Range Selector */}
            <div className="flex flex-wrap gap-4 mb-10">
                {(['7D', '30D', '3M', '1Y', 'YTD'] as TimeRange[]).map(range => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-8 py-3 text-xs font-bold uppercase tracking-widest transition-all border
                            ${timeRange === range
                                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                                : 'bg-transparent text-gray-400 border-gray-200 dark:border-zinc-800 dark:text-zinc-500 hover:border-gray-400 dark:hover:border-zinc-600'}`}
                    >
                        {range === '7D' ? '7 Gün' : range === '30D' ? '30 Gün' : range === '3M' ? '3 Ay' : range === '1Y' ? '1 Yıl' : 'YTD'}
                    </button>
                ))}
            </div>

            {/* Main Chart */}
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 p-10 mb-10">
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <h3 className="text-xl font-bold text-black dark:text-white uppercase tracking-wider mb-2">Satış Grafiği</h3>
                        <p className="text-sm font-mono text-gray-400 dark:text-zinc-500">
                            {new Date(startDate).toLocaleDateString('tr-TR')} - {new Date(endDate).toLocaleDateString('tr-TR')}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-5xl font-light text-black dark:text-white mb-1">
                            ₺{chartData.reduce((s, d) => s + d.value, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Dönem Toplam</div>
                    </div>
                </div>

                {/* Chart Container */}
                <div className="h-96 flex items-end gap-2 px-4">
                    {chartData.map((point, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-10">
                                <div className="bg-black text-white dark:bg-white dark:text-black text-xs px-3 py-2 font-mono whitespace-nowrap">
                                    ₺{point.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-black dark:border-t-white border-r-[6px] border-r-transparent mx-auto"></div>
                            </div>

                            {/* Bar */}
                            <div className="w-full relative flex flex-col justify-end group cursor-crosshair" style={{ height: '100%' }}>
                                <div
                                    className="w-full bg-black dark:bg-white transition-all duration-500 ease-out opacity-20 group-hover:opacity-100"
                                    style={{ height: `${Math.max((point.value / maxSale) * 100, 1)}%` }}
                                ></div>
                            </div>

                            {/* Label */}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 dark:text-zinc-700 mt-4 group-hover:text-black dark:group-hover:text-white transition-colors rotate-0">
                                {point.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detailed Transaction List */}
            <h3 className="text-xl font-bold text-black dark:text-white uppercase tracking-wider mb-6">Son İşlemler</h3>
            <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">ID</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Tarih</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Tip</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Ödeme</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 text-right">Tutar</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500 text-right">Not</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {transactions.slice(0, 20).map(tx => (
                            <tr key={tx.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <td className="p-4 font-mono text-xs text-gray-400 dark:text-zinc-500">#{tx.id.slice(0, 6)}</td>
                                <td className="p-4 font-mono text-xs text-gray-900 dark:text-white">
                                    {new Date(tx.createdAt).toLocaleString('tr-TR')}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tx.transactionType === 'RETURN' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                        }`}>
                                        {tx.transactionType === 'RETURN' ? 'İADE' : 'SATIŞ'}
                                    </span>
                                </td>
                                <td className="p-4 text-xs font-bold uppercase text-gray-600 dark:text-zinc-400">{tx.paymentMethod}</td>
                                <td className={`p-4 text-right font-mono text-sm font-bold ${tx.transactionType === 'RETURN' ? 'text-red-500' : 'text-gray-900 dark:text-white'
                                    }`}>
                                    {tx.transactionType === 'RETURN' ? '-' : ''}₺{Math.abs(tx.total).toFixed(2)}
                                </td>
                                <td className="p-4 text-right text-xs text-gray-400 dark:text-zinc-500 italic">
                                    {tx.note || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // --- VIEW ROUTING ---
    if (currentView === 'REVENUE') return <div className="p-8 md:p-12 h-full bg-white dark:bg-black overflow-y-auto"><RevenueView /></div>;

    if (currentView === 'STOCK') return (
        <div className="p-8 md:p-12 h-full bg-white dark:bg-black overflow-y-auto">
            <TableView
                title="Toplam Stok"
                subtitle="Envanterdeki tüm ürünler ve stok durumları"
                data={allItems}
                type="STOCK"
            />
        </div>
    );

    if (currentView === 'SKUS') return (
        <div className="p-8 md:p-12 h-full bg-white dark:bg-black overflow-y-auto">
            <TableView
                title="Aktif Ürünler (SKU)"
                subtitle="Tanımlı tüm ürün kartları"
                data={allItems}
                type="SKUS"
            />
        </div>
    );

    if (currentView === 'CRITICAL') return (
        <div className="p-8 md:p-12 h-full bg-white dark:bg-black overflow-y-auto">
            <TableView
                title="Kritik Stok"
                subtitle="Stok seviyesi 10 ve altı olan ürünler"
                data={allItems.filter(i => i.quantity < 10)}
                type="CRITICAL"
            />
        </div>
    );

    return (
        <div className="p-8 md:p-12 h-full bg-white dark:bg-black overflow-y-auto transition-colors duration-500">
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 pb-8 border-b border-gray-200 dark:border-zinc-800">
                    <div>
                        <h2 className="text-6xl font-light text-black dark:text-white tracking-tighter mb-2">Nexus</h2>
                        <div className="flex items-center gap-3">
                            <span className="h-px w-8 bg-black dark:bg-white"></span>
                            <span className="text-sm font-bold uppercase tracking-widest text-black dark:text-white">Inventory v2.0</span>
                        </div>
                    </div>
                    <div className="mt-6 md:mt-0 text-right">
                        <p className="text-4xl font-light text-gray-300 dark:text-zinc-700">
                            {new Date().toLocaleDateString('tr-TR', { day: 'numeric' })}
                        </p>
                        <p className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-600">
                            {new Date().toLocaleDateString('tr-TR', { month: 'long', weekday: 'long' })}
                        </p>

                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 mb-16">
                    <StatCard title="Toplam Gelir" value={stats.totalRevenue} prefix="₺" targetView="REVENUE" />
                    <StatCard title="Toplam Stok" value={stats.totalStock} targetView="STOCK" />
                    <StatCard title="Aktif SKU" value={stats.totalItems} targetView="SKUS" />
                    <StatCard title="Kritik Stok" value={stats.lowStock} alert={stats.lowStock > 0} targetView="CRITICAL" />
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Revenue Chart Section */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-light text-black dark:text-white">Satış Performansı</h3>
                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex gap-2 bg-white dark:bg-black p-1 rounded-lg border border-gray-200 dark:border-zinc-800">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => handleDateChange('start', e.target.value)}
                                        className="bg-transparent text-xs font-bold outline-none text-black dark:text-white uppercase p-1"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => handleDateChange('end', e.target.value)}
                                        className="bg-transparent text-xs font-bold outline-none text-black dark:text-white uppercase p-1"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    {(['7D', '30D', '3M'] as TimeRange[]).map(range => (
                                        <button
                                            key={range}
                                            onClick={() => handlePresetChange(range)}
                                            className={`text-xs font-bold uppercase tracking-widest transition-colors pb-1 border-b-2
                                                ${timeRange === range
                                                    ? 'text-black border-black dark:text-white dark:border-white'
                                                    : 'text-gray-400 border-transparent hover:text-gray-600 dark:text-zinc-600 dark:hover:text-zinc-400'}`}
                                        >
                                            {range === '7D' ? '7G' : range === '30D' ? '30G' : '3A'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-zinc-900/30 border border-gray-100 dark:border-zinc-800 p-8 h-[400px] flex flex-col justify-between">
                            <div className="flex items-end gap-2 h-full">
                                {chartData.map((point, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center group h-full justify-end relative">
                                        <div className="w-full bg-black dark:bg-white opacity-10 group-hover:opacity-100 transition-all duration-300"
                                            style={{ height: `${Math.max((point.value / maxSale) * 100, 2)}%` }}></div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-6 mt-4 border-t border-gray-200 dark:border-zinc-800">
                                <div>
                                    <span className="text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wider mr-2">Toplam Hacim</span>
                                    <span className="text-xl font-light text-black dark:text-white">${chartData.reduce((s, d) => s + d.value, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <button onClick={() => setCurrentView('REVENUE')} className="text-xs font-bold uppercase tracking-widest text-black dark:text-white hover:underline">
                                    Detaylı Rapor →
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-12">
                        {/* Categories */}
                        <div>
                            <h3 className="text-xl font-light text-black dark:text-white mb-8">Kategori Dağılımı</h3>
                            <div className="space-y-6">
                                {Object.entries(categoryStats).slice(0, 5).map(([cat, data]) => {
                                    const percent = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
                                    return (
                                        <div key={cat} className="group">
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="font-bold text-gray-900 dark:text-white">{cat}</span>
                                                <span className="font-mono text-gray-400 dark:text-zinc-500">{percent.toFixed(0)}%</span>
                                            </div>
                                            <div className="h-1 bg-gray-100 dark:bg-zinc-800 w-full">
                                                <div className="h-full bg-black dark:bg-white transition-all duration-1000 ease-out" style={{ width: `${percent}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {Object.keys(categoryStats).length === 0 && (
                                    <p className="text-gray-400 dark:text-zinc-600 text-sm">Veri bulunamadı.</p>
                                )}
                            </div>
                        </div>

                        {/* Recent Transactions */}
                        <div>
                            <h3 className="text-xl font-light text-black dark:text-white mb-8">Son İşlemler</h3>
                            <div className="border-t border-gray-200 dark:border-zinc-800">
                                {transactions.slice(0, 5).map(tx => (
                                    <div key={tx.id} className="flex justify-between items-center py-4 border-b border-gray-100 dark:border-zinc-800/50 group hover:bg-gray-50 dark:hover:bg-zinc-900/30 transition-colors px-2 -mx-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`text-sm font-bold ${tx.transactionType === 'RETURN' ? 'text-red-500' : 'text-black dark:text-white'}`}>
                                                    {tx.transactionType === 'RETURN' ? 'İADE' : 'SATIŞ'} #{tx.id.slice(0, 6)}
                                                </div>
                                                <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-gray-500 font-bold uppercase">
                                                    {tx.paymentMethod}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 dark:text-zinc-500 font-mono">
                                                {new Date(tx.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-bold ${tx.transactionType === 'RETURN' ? 'text-red-500' : 'text-black dark:text-white'}`}>
                                                {tx.transactionType === 'RETURN' ? '-' : ''}${Math.abs(tx.total).toFixed(2)}
                                            </div>
                                            <div className="text-xs text-gray-400 dark:text-zinc-500 italic max-w-[80px] truncate">
                                                {tx.note || ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {transactions.length === 0 && (
                                    <p className="py-4 text-gray-400 dark:text-zinc-600 text-sm">İşlem yok.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;