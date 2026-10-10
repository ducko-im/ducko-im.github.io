// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://ducko.im',
  trailingSlash: 'always',
  build: { format: 'directory' },
  server: { port: 13269 },
  integrations: [sitemap({ filter: (page) => !page.endsWith('/impressum/') })],
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Nunito',
      cssVariable: '--font-rounded',
      weights: [400, 700, 900],
      styles: ['normal'],
      fallbacks: ['sans-serif'],
      display: 'swap',
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
