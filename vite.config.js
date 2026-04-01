import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    historyApiFallback: true,
    proxy: {
      // Match server.js default PORT (8080); set VITE_API_PROXY if your local server uses another port
      '/api': { target: process.env.VITE_API_PROXY || 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },
  preview: { port: 3000, host: '0.0.0.0', allowedHosts: true },
});
