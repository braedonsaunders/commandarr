import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8484',
      '/ws': { target: 'ws://localhost:8484', ws: true },
      '/webhooks': 'http://localhost:8484',
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
