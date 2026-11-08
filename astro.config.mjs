// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

import keystatic from '@keystatic/astro';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    integrations: [starlight({
        title: 'My Docs',
        social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
        sidebar: [
            {
                label: 'Oficial',
                items: [
                    // Each item here is one entry in the navigation menu.
                    { label: 'Índice', slug: 'oficial/example' },
                ],
            },
            {
                label: 'Reference',
                items: [{ autogenerate: { directory: 'reference' } }],
            },
        ],
		}),react() ,keystatic()],
		output: 'static',
		site: 'https://tomascaruso-hub.github.io',
		base: '/ergo-v2', // Si aplica para tu GitHub Pages
});