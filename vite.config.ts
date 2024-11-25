import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Assuming your backend runs on port 3000
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      external: ['react-router-dom']
    }
  },
  resolve: {
    alias: {
      '@': '/site'
    }
  }
});