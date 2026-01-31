import React, { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, Filter, Download, Package, DollarSign, Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface Transaction {
  id: string;
  dealerId: string;
  dealerName: string;
  deviceIdentifier: string;
  actionType: string;
  itemSku: string;
  itemName: string;
  quantityChange: number;
  oldValue: number | null;
  newValue: number | null;
  metadata: any;
  transactionTime: string;
  syncedAt: string;
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [filters, setFilters] = useState({
    actionType: '',
    dealerId: ''
  });

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        ...(filters.actionType && { action_type: filters.actionType }),
        ...(filters.dealerId && { dealer_id: filters.dealerId })
      });

      const response = await api.get(`/sync/transactions?${params}`);
      setTransactions(response.data.transactions);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, filters]);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'SALE': return <ArrowUpCircle size={16} className="text-emerald-500" />;
      case 'STOCK_IN': return <ArrowDownCircle size={16} className="text-blue-500" />;
      case 'STOCK_OUT': return <ArrowUpCircle size={16} className="text-amber-500" />;
      case 'PRICE_CHANGE': return <DollarSign size={16} className="text-purple-500" />;
      case 'ITEM_CREATE': return <Plus size={16} className="text-green-500" />;
      case 'ITEM_UPDATE': return <Edit size={16} className="text-slate-500" />;
      case 'ITEM_DELETE': return <Trash2 size={16} className="text-red-500" />;
      default: return <Package size={16} className="text-slate-400" />;
    }
  };

  const getActionBadge = (type: string) => {
    const styles: Record<string, string> = {
      'SALE': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'STOCK_IN': 'bg-blue-50 text-blue-700 border-blue-200',
      'STOCK_OUT': 'bg-amber-50 text-amber-700 border-amber-200',
      'PRICE_CHANGE': 'bg-purple-50 text-purple-700 border-purple-200',
      'ITEM_CREATE': 'bg-green-50 text-green-700 border-green-200',
      'ITEM_UPDATE': 'bg-slate-50 text-slate-700 border-slate-200',
      'ITEM_DELETE': 'bg-red-50 text-red-700 border-red-200'
    };
    return styles[type] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const exportCSV = () => {
    const headers = ['Time', 'Device', 'Action', 'SKU', 'Item', 'Qty Change', 'Value'];
    const rows = transactions.map(t => [
      new Date(t.transactionTime).toLocaleString(),
      t.deviceIdentifier,
      t.actionType,
      t.itemSku,
      t.itemName,
      t.quantityChange,
      t.newValue || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Transaction Log</h2>
          <p className="text-slate-500 text-sm mt-0.5">All sync transactions across devices</p>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-lg border border-slate-200">
        <Filter size={16} className="text-slate-400" />
        <select
          value={filters.actionType}
          onChange={(e) => setFilters(f => ({ ...f, actionType: e.target.value }))}
          className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="">All Actions</option>
          <option value="SALE">Sales</option>
          <option value="STOCK_IN">Stock In</option>
          <option value="STOCK_OUT">Stock Out</option>
          <option value="PRICE_CHANGE">Price Changes</option>
          <option value="ITEM_CREATE">Item Created</option>
          <option value="ITEM_UPDATE">Item Updated</option>
          <option value="ITEM_DELETE">Item Deleted</option>
        </select>

        <span className="text-sm text-slate-500 ml-auto">
          {total.toLocaleString()} total transactions
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Device</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Item</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">{formatTime(txn.transactionTime)}</span>
                        <span className="text-xs text-slate-400">{formatDate(txn.transactionTime)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">{txn.dealerName || 'Unknown'}</span>
                        <span className="text-xs text-slate-400 font-mono">{txn.deviceIdentifier?.substring(0, 12)}...</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getActionBadge(txn.actionType)}`}>
                        {getActionIcon(txn.actionType)}
                        {txn.actionType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">{txn.itemName || '-'}</span>
                        <span className="text-xs text-slate-400 font-mono">{txn.itemSku || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${txn.quantityChange > 0 ? 'text-emerald-600' : txn.quantityChange < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {txn.quantityChange > 0 ? '+' : ''}{txn.quantityChange || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {txn.newValue !== null ? (
                        <span className="text-sm font-medium text-slate-900">
                          ${txn.newValue?.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;
