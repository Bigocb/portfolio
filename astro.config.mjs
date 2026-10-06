import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://me.cloutier.work',
  vite: {
    ssr: {
      external: ['sharp']
    }
  },
  output: 'static',
  integrations: [
    // Tailored /for/<token> pages are private and must not be indexed.
    sitemap({ filter: (page) => !page.includes('/for/') })
  ]
});
