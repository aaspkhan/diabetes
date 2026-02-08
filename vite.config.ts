import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Check for API_KEY or VITE_API_KEY
  const apiKey = env.API_KEY || env.VITE_API_KEY || '';

  return {
    plugins: [react()],
    // This injects the API_KEY from your .env file into the client-side code
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    build: {
      outDir: 'dist',
    }
  };
});