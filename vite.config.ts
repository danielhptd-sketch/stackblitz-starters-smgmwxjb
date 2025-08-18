import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: 'src/main.tsx', name: 'HPTDConfigurator', formats: ['iife'], fileName: () => 'app.js' },
    rollupOptions: { output: { assetFileNames: (a) => (a.name?.endsWith('.css') ? 'app.css' : 'app.[ext]') } },
  },
});