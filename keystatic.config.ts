/**
 * ARCHIVO DE CONFIGURACIÓN DE KEYSTATIC (Panel de Administración / CMS)
 * Este archivo define cómo funciona el CMS (Keystatic) para los colaboradores:
 * 1. Dónde se guardan los datos (almacenamiento en GitHub).
 * 2. Qué colecciones existen (en este caso, la documentación de Starlight).
 * 3. Qué campos tiene cada documento (título, descripción, contenido MDX).
 * 4. Componentes visuales personalizados para escribir LaTeX con previsualización
 *    en vivo (`Formula` y `MathInline`).
 * 5. Inyección del sistema de tooltip flotante para previsualización con hover.
 */

import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { config, fields, collection } from '@keystatic/core';
import { block, inline } from '@keystatic/core/content-components';
import { MathLivePreviewBrandMark } from './src/components/keystatic-math-preview';

/**
 * Define un componente de tipo "bloque" para Keystatic.
 * 
 * - Se inserta desde la interfaz con el botón "+" o menú de componentes.
 * - Al guardarse en el archivo .mdx, se almacena como:
 *     <Formula latex="\\int_0^1 x dx" />
 * - ContentView: Se encarga de dibujar el componente DENTRO del editor de Keystatic.
 *   Utiliza KaTeX para renderizar la fórmula en vivo mientras el usuario escribe.
 */
export const Formula = block({
  label: 'Bloque LaTeX',
  // definimos el esquema de datos que tendrá este bloque personalizado
  schema: {
    latex: fields.text({
      label: 'Código LaTeX',
      multiline: true,
      description: 'Ejemplo: \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
    }),
  },
  // renderizamos la vista previa del bloque dentro del editor de Keystatic
  ContentView(props) {
    const raw = props.value.latex || '';
    // si el campo está vacío, mostramos un mensaje de ayuda
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
        'No hay contenido LaTeX en el bloque, presiona "Edit"'
      );
    }

    // renderizamos la fórmula con KaTeX en modo bloque
    try {
      const html = katex.renderToString(raw, {
        displayMode: true,     // renderiza como bloque (centrado y con saltos de línea)
        throwOnError: false,   // no lanza error si la sintaxis es incorrecta, solo muestra un mensaje de error
      });

      return React.createElement('div', {
        style: {
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          overflowX: 'auto',   // permite scroll horizontal si la fórmula es muy larga
          textAlign: 'center',
        },
        dangerouslySetInnerHTML: { __html: html },
      });
    } catch {
      return React.createElement(
        'div',
        { style: { color: '#ef4444', padding: '8px', textAlign: 'center' } },
        'Error de sintaxis LaTeX'
      );
    }
  },
});

/**
 * Define un componente de tipo "en línea" (inline) para Keystatic.
 * 
 * - Se inserta dentro de una oración o párrafo (ej: para variables o ecuaciones breves).
 * - Se guarda en el archivo .mdx como:
 *     <MathInline latex="E = mc^2" />
 * - ContentView: Muestra la vista previa compacta sin saltos de línea (displayMode: false).
 */
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

// configuración principal de Keystatic para el proyecto
export default config({
  // marca y nombre del CMS en la interfaz de administración
  ui: {
    brand: {
      name: 'Ergo Docs',
      mark: MathLivePreviewBrandMark,
    },
  },

  // estrategia de almacenamiento 
  storage: {
    kind: 'github',
    repo: {
      owner: 'tomascaruso-hub', 
      name: 'ergo-v2',          
    },
  },

  // definición de colecciones de contenido
  collections: {
    docs: collection({
      label: 'Documentación Starlight',
      slugField: 'title',             // el nombre del archivo se genera a partir del título
      path: 'src/content/docs/**',    // ruta donde Astro Starlight lee los documentos
      format: { contentField: 'content' }, // separamos el contenido MDX en un campo específico
      schema: {
        title: fields.slug({ name: { label: 'Título' } }),
        description: fields.text({ label: 'Descripción' }),
        content: fields.mdx({
          label: 'Contenido',
          extension: 'mdx', // guardamos como .mdx para poder usar React y componentes personalizados
          components: {
            Formula,        
            MathInline,     
          },
        }),
      },
    }),
  },
});
