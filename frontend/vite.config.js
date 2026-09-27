import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces (required for Docker)
    host: '0.0.0.0',
    port: 5173,
    // Proxy API calls to the Go backend (avoids CORS in development)
    proxy: {
      '/api': {
        target: 'http://go-api:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://go-api:8080',
        ws: true,
      },
      '/health': {
        target: 'http://go-api:8080',
        changeOrigin: true,
      },
    },
  },
});
