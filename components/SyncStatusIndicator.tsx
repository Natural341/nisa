import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';
import { tauriInvoke, isTauri } from '../services/tauriService';

interface SyncState {
  last_push_at: string | null;
  last_pull_at: string | null;
  sync_in_progress: boolean;
  pending_count: number;
}

const SyncStatusIndicator: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchSyncStatus = async () => {
    if (!isTauri()) return;

    try {
      const [state, running] = await Promise.all([
        tauriInvoke<SyncState>('get_device_sync_state'),
        tauriInvoke<boolean>('is_device_sync_running'),
      ]);
      setSyncState(state);
      setIsRunning(running);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (!isTauri() || isSyncing) return;

    setIsSyncing(true);
    try {
      await tauriInvoke('perform_device_sync');
      await fetchSyncStatus();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Henuz';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

    if (diff < 1) return 'Az once';
    if (diff < 60) return `${diff}dk once`;
    if (diff < 1440) return `${Math.floor(diff / 60)}sa once`;
    return `${Math.floor(diff / 1440)}g once`;
  };

  if (!isTauri()) return null;

  const hasPending = syncState && syncState.pending_count > 0;
  const lastSync = syncState?.last_push_at || syncState?.last_pull_at;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700">
      <div className="flex items-center gap-1.5">
        {isRunning ? (
          <Cloud size={14} className="text-emerald-500" />
        ) : (
          <CloudOff size={14} className="text-gray-400" />
        )}
        <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
          {formatLastSync(lastSync)}
        </span>
      </div>

      {hasPending && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
          {syncState.pending_count}
        </span>
      )}

      <button
        onClick={handleManualSync}
        disabled={isSyncing}
        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
        title="Manuel senkronizasyon"
      >
        {isSyncing ? (
          <RefreshCw size={12} className="animate-spin text-blue-500" />
        ) : (
          <RefreshCw size={12} className="text-gray-500 dark:text-zinc-500" />
        )}
      </button>
    </div>
  );
};

export default SyncStatusIndicator;
