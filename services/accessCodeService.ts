import { invoke } from '@tauri-apps/api/core';
import { AccessCode, User } from '../types';

export const accessCodeService = {
    create: async (code: string, name: string, role: string): Promise<void> => {
        await invoke('create_access_code', { code, name, role });
    },

    getAll: async (): Promise<AccessCode[]> => {
        return await invoke('get_access_codes');
    },

    delete: async (id: number): Promise<void> => {
        await invoke('delete_access_code', { id });
    },

    login: async (code: string): Promise<User | null> => {
        return await invoke('login_with_code', { code });
    }
};
