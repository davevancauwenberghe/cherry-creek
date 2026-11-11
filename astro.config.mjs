// @ts-check
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Canonical origin used for <link rel="canonical">, Open Graph and the sitemap.
const site = process.env.SITE_URL || 'https://cherrycreek.app';

export default defineConfig({
  site,
  // Pages are prerendered to static HTML. Only /api/status and /healthz run
  // on demand, served by the small standalone Node server.
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'never',
  // Preserve single spaces between inline elements (Astro 7 defaults to 'jsx').
  compressHTML: true,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // Bundle server dependencies into dist/ so the runtime image needs no
    // node_modules at all.
    ssr: { noExternal: true },
  },
  server: { host: true },
});
