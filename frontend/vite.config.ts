import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    mdx({
      providerImportSource: '@mdx-js/react'
    }),
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4000'
    }
  },
  resolve: {
    tsconfigPaths: true
  }
});
