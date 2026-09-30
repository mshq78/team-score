import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Drops the manifest link and inlines the icon, so opening the file makes no extra requests. */
function inlineHeadLinks(): Plugin {
  return {
    name: 'offline-head-links',
    transformIndexHtml(html) {
      const icon = fs.readFileSync(path.resolve(import.meta.dirname, 'public/icon.svg')).toString('base64');
      return html
        .replace(/<link rel="manifest"[^>]*>\s*/, '')
        .replace(/href="\/icon\.svg"/, `href="data:image/svg+xml;base64,${icon}"`);
    },
  };
}

/** Single-file offline build (draft + stage only). No API plugin, no network. */
export default defineConfig({
  plugins: [react(), tailwindcss(), inlineHeadLinks(), viteSingleFile()],
  publicDir: false,
  define: { 'import.meta.env.VITE_OFFLINE': JSON.stringify('1') },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  build: {
    outDir: 'dist-offline',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});
