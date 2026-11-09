// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import keystatic from '@keystatic/astro';
import react from '@astrojs/react';
import autoImport from 'astro-auto-import';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// para editar en local con `npm run dev:admin`
const isAdmin = process.env.DEPLOY_TARGET === 'admin';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      customCss: [
        'katex/dist/katex.min.css',
      ],
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
    autoImport({
      imports: [
        './src/components/Formula.astro',
        './src/components/MathInline.astro',
      ],
    }),
    ...(isAdmin ? [react(), keystatic()] : []),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  output: isAdmin ? 'server' : 'static',
  ...(isAdmin
    ? {}
    : { site: 'https://tomascaruso-hub.github.io', base: '/ergo-v2' }),
});