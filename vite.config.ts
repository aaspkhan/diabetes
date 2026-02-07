import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // This ensures process.env.API_KEY is replaced with the actual value during build
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});