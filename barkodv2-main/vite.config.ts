import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Vite options tailored for Tauri development
      clearScreen: false,
      server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
          ? {
              protocol: 'ws',
              host,
              port: 1421,
            }
          : undefined,
        watch: {
          // 3. tell vite to ignore watching `src-tauri`
          ignored: ['**/src-tauri/**'],
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
