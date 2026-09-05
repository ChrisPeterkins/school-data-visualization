import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/paschools/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Shared vendor chunks so a chart or map library downloads once and
        // only when a page that uses it is opened.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'axios'],
          recharts: ['recharts'],
          leaflet: ['leaflet', 'react-leaflet'],
          grid: ['@silevis/reactgrid'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});