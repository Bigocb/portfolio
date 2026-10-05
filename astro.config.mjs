import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://example.com',
  vite: {
    ssr: {
      external: ['sharp']
    }
  },
  output: 'static',
  integrations: [
    sitemap()
  ]
});
