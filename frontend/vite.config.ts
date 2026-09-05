import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_TARGET = process.env.API_TARGET || 'http://localhost:3000';

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
      '/api': { target: API_TARGET, changeOrigin: true },
      // The app calls /paschools/api/... (nginx strips the prefix in production).
      '/paschools/api': { target: API_TARGET, changeOrigin: true, rewrite: (p) => p.replace(/^\/paschools/, '') },
    },
  },
  // `vite preview` mirrors production paths so the end-to-end checks can run
  // against a built frontend and a local backend (see scripts/e2e.mjs).
  preview: {
    port: 4173,
    host: true,
    proxy: {
      '/paschools/api': { target: API_TARGET, changeOrigin: true, rewrite: (p) => p.replace(/^\/paschools/, '') },
    },
  },
});