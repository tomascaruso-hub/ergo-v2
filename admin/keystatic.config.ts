import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { config, fields, collection } from '@keystatic/core';
import { block, inline } from '@keystatic/core/content-components';

export const Formula = block({
  label: 'Fórmula Matemática (Bloque)',
  schema: {
    latex: fields.text({
      label: 'Código LaTeX',
      multiline: true,
      description: 'Ejemplo: \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
    }),
  },
  ContentView(props) {
    const raw = props.value.latex || '';
    if (!raw.trim()) {
      return React.createElement(
        'div',
        {
          style: {
            padding: '14px',
            border: '1px dashed #64748b',
            borderRadius: '8px',
            color: '#64748b',
            fontStyle: 'italic',
            textAlign: 'center',
          },
        },
        'Fórmula LaTeX vacía. Haz clic para editar...'
      );
    }
    try {
      const html = katex.renderToString(raw, {
        displayMode: true,
        throwOnError: false,
      });
      return React.createElement('div', {
        style: {
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          overflowX: 'auto',
          textAlign: 'center',
        },
        dangerouslySetInnerHTML: { __html: html },
      });
    } catch {
      return React.createElement(
        'div',
        { style: { color: '#ef4444', padding: '8px' } },
        'Error de sintaxis LaTeX'
      );
    }
  },
});

export const MathInline = inline({
  label: 'Fórmula en línea',
  schema: {
    latex: fields.text({
      label: 'LaTeX en línea',
      description: 'Ejemplo: E = mc^2',
    }),
  },
  ContentView(props) {
    const raw = props.value.latex || '';
    if (!raw.trim()) {
      return React.createElement('span', { style: { color: '#64748b', fontStyle: 'italic' } }, '[fórmula]');
    }
    try {
      const html = katex.renderToString(raw, {
        displayMode: false,
        throwOnError: false,
      });
      return React.createElement('span', {
        style: { padding: '0 4px' },
        dangerouslySetInnerHTML: { __html: html },
      });
    } catch {
      return React.createElement('span', { style: { color: '#ef4444' } }, '[error LaTeX]');
    }
  },
});

export default config({
  storage: {
    kind: 'github',
    repo: {
      owner: 'tomascaruso-hub',
      name: 'ergo-v2',
    },
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
        content: fields.mdx({
          label: 'Contenido',
          extension: 'mdx',
          components: {
            Formula,
            MathInline,
          },
        }),
      },
    }),
  },
});
