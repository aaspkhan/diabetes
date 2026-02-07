import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // This ensures process.env.API_KEY is replaced with the actual value during build
  // If API_KEY is missing, it falls back to an empty string to prevent build errors
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  build: {
    outDir: 'dist',
  }
});