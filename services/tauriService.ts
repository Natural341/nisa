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
/**
 * Write text file to disk
 */
export const writeTextFile = async (path: string, content: string): Promise<void> => {
    if (!isTauri()) {
        console.warn('Native file write not supported in web mode');
        return;
    }

    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, content);
};

/**
 * Save text content to a file with dialog
 */
export const saveTextFile = async (content: string, defaultName: string): Promise<boolean> => {
    if (!isTauri()) {
        // Web fallback: download as link
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", defaultName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    }

    try {
        const filePath = await saveFileDialog(defaultName, [{ name: 'CSV', extensions: ['csv'] }]);
        if (!filePath) return false;

        await writeTextFile(filePath, content);
        return true;
    } catch (e) {
        console.error('Save failed:', e);
        return false;
    }
};

/**
 * Force file download using browser behavior (Saves to Downloads folder)
 * This works in both Web and Tauri (WebView)
 */
export const downloadFile = (content: string, fileName: string, mimeType: string = 'text/csv;charset=utf-8;'): void => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Save file to Downloads folder via Rust backend
 */
export const saveToDownloads = async (content: string, filename: string): Promise<string | null> => {
    if (!isTauri()) {
        // Web fallback
        downloadFile(content, filename);
        return 'Web download initiated';
    }

    try {
        return await tauriInvoke<string>('save_to_downloads', { content, filename });
    } catch (error) {
        console.error('Save to downloads failed:', error);
        throw error;
    }
};
