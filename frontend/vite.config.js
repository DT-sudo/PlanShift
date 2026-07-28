import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/static/',
  plugins: [react(), tailwindcss()],
  build: {
    manifest: true,
    modulePreload: { polyfill: false },
    rollupOptions: { input: 'src/main.jsx' },
  },
});
