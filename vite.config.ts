import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works on GitHub Pages (/pokego/) or any static host.
export default defineConfig({
  base: './',
  plugins: [react()],
});
