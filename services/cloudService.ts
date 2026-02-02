import { tauriInvoke, isTauri } from './tauriService';
import { SyncStatus, CloudBackupResponse, CloudStatusResponse } from '../types';

class CloudService {
  /**
   * Backup database to cloud
   */
  async backup(): Promise<CloudBackupResponse> {
    if (!isTauri()) {
      return {
        success: true,
        backupId: 'dev-backup-' + Date.now(),
        timestamp: new Date().toISOString(),
        message: 'Development mode - backup simulated',
      };
    }
    return tauriInvoke<CloudBackupResponse>('cloud_backup');
  }

  /**
   * Restore database from cloud
   */
  async restore(): Promise<void> {
    if (!isTauri()) {
      console.log('Development mode - restore simulated');
      return;
    }
    return tauriInvoke<void>('cloud_restore');
  }

  /**
   * Get local sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    if (!isTauri()) {
      return {
        lastBackupAt: new Date(Date.now() - 3600000).toISOString(),
        lastRestoreAt: undefined,
        autoSyncEnabled: false,
        autoSyncIntervalMinutes: 30,
      };
    }
    return tauriInvoke<SyncStatus>('get_sync_status');
  }

  /**
   * Get cloud backup status from server
   */
  async getCloudStatus(): Promise<CloudStatusResponse> {
    if (!isTauri()) {
      return {
        has_backup: true,
        last_backup_at: new Date(Date.now() - 3600000).toISOString(),
        backup_size_bytes: 1024 * 1024,
        backup_count: 5,
      };
    }
    return tauriInvoke<CloudStatusResponse>('get_cloud_status');
  }

  /**
   * Set auto sync settings
   */
  async setAutoSync(enabled: boolean, intervalMinutes: number): Promise<void> {
    if (!isTauri()) {
      console.log('Development mode - auto sync settings:', { enabled, intervalMinutes });
      return;
    }
    return tauriInvoke<void>('set_auto_sync', {
      enabled,
      intervalMinutes,
    });
  }

  /**
   * Format last sync time for display
   */
  formatLastSync(timestamp?: string): string {
    if (!timestamp) return 'Henuz yedeklenmedi';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Az once';
    if (minutes < 60) return `${minutes} dakika once`;
    if (hours < 24) return `${hours} saat once`;
    if (days < 7) return `${days} gun once`;

    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes?: number): string {
    if (!bytes) return 'Bilinmiyor';

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

export const cloudService = new CloudService();
