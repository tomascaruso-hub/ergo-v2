// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import keystatic from '@keystatic/astro';
import react from '@astrojs/react';

// para editar en local con `npm run dev:admin`
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
  ...(isAdmin
    ? {}
    : { site: 'https://tomascaruso-hub.github.io', base: '/ergo-v2' }),
});