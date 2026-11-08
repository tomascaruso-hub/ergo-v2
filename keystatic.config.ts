import { config, fields, collection } from '@keystatic/core';

export default config({
    storage: {
        kind: 'cloud',
    },
    cloud: {
        project: 'ergo/ergo-v2'
    },
    collections: {
        docs: collection({
            label: 'Documentación Starlight',
            slugField: 'title',
            path: 'src/content/docs/**',
            format: { contentField: 'content' },
            schema: {
                title: fields.slug({ name: { label: 'Título' } }),
                description: fields.text({ label: 'Descripción' }),
                content: fields.markdoc({
                    label: 'Contenido',
                }),
            },
        }),
    },
});