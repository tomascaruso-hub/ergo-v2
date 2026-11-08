// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import cloudflare from '@astrojs/cloudflare';
import keystatic from '@keystatic/astro';
import react from '@astrojs/react';

const isAdmin = process.env.DEPLOY_TARGET === 'admin';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
      sidebar: [
        {
          label: 'Oficial',
          items: [{ label: 'Índice', slug: 'oficial/example' }],
        },
        {
          label: 'Reference',
          items: [{ autogenerate: { directory: 'reference' } }],
        },
      ],
    }),
    ...(isAdmin ? [react(), keystatic()] : []),
  ],
  output: isAdmin ? 'server' : 'static',
  adapter: isAdmin ? cloudflare() : undefined,
  ...(isAdmin
    ? {}
    : { site: 'https://tomascaruso-hub.github.io', base: '/ergo-v2' }),
});