import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build output goes to frontend/dist; the Express app serves it in production.
// In dev, proxy API/docs/mcp calls to the backend on :3003 so the SPA and API
// share an origin during `npm run dev`.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3003',
      '/docs': 'http://localhost:3003',
      '/mcp': 'http://localhost:3003',
    },
  },
});
