/**
 * Tauri IPC Service Wrapper
 * Provides platform detection and fallback for web development
 */

// Check if running in Tauri
export const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Dynamic import of Tauri API
let invoke: any = null;

const initTauri = async () => {
    if (isTauri() && !invoke) {
        const tauri = await import('@tauri-apps/api/core');
        invoke = tauri.invoke;
    }
};

// Initialize on load
if (typeof window !== 'undefined') {
    initTauri();
}

/**
 * Invoke a Tauri command with fallback for web
 */
export const tauriInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    if (!isTauri()) {
        throw new Error(`Tauri not available. Command: ${command}`);
    }

    await initTauri();

    if (!invoke) {
        throw new Error('Failed to initialize Tauri invoke');
    }

    return invoke(command, args);
};

/**
 * Open native file save dialog
 */
export const saveFileDialog = async (defaultPath?: string, filters?: { name: string; extensions: string[] }[]): Promise<string | null> => {
    if (!isTauri()) {
        return null;
    }

    const { save } = await import('@tauri-apps/plugin-dialog');
    return save({
        defaultPath,
        filters: filters || [{ name: 'CSV', extensions: ['csv'] }]
    });
};

/**
 * Open native file open dialog
 */
export const openFileDialog = async (filters?: { name: string; extensions: string[] }[], multiple?: boolean): Promise<string | string[] | null> => {
    if (!isTauri()) {
        return null;
    }

    const { open } = await import('@tauri-apps/plugin-dialog');
    return open({
        multiple: multiple || false,
        filters: filters || [{ name: 'All Files', extensions: ['*'] }]
    });
};
