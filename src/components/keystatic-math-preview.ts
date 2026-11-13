/**
 * ============================================================================
 * SCRIPT DE PREVISUALIZACIÓN FLOTANTE DE LATEX PARA KEYSTATIC
 * ============================================================================
 * 
 * ¿POR QUÉ EXISTE ESTE ARCHIVO?
 * -----------------------------
 * En Keystatic, para escribir una fórmula con previsualización normalmente hay
 * que usar el mouse, hacer clic en "+", elegir "Fórmula", llenar el modal y
 * guardarlo. Esto interrumpe el flujo si estás redactando apuntes o documentación.
 * 
 * La forma más rápida de escribir matemáticas en Markdown siempre ha sido con el
 * teclado directo usando signos de dólar:
 *   - En línea: $E = mc^2$
 *   - En bloque: $$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$
 * 
 * Este script añade un "escáner" inteligente en el navegador que:
 * 1. Al pasar el mouse (hover) sobre cualquier texto con $ o $$, muestra un tooltip
 *    flotante con la fórmula renderizada en vivo mediante KaTeX.
 * 2. Al escribir con el teclado, si el cursor de texto está situado entre signos $,
 *    hace aparecer la ventanita flotante arriba del cursor mostrando la fórmula
 *    en tiempo real para que veas si la sintaxis es correcta sin tocar el mouse.
 */

import React from 'react';
import katex from 'katex';

// ============================================================================
// FUNCIÓN AUXILIAR: findMathAt
// ============================================================================
/**
 * Analiza una cadena de texto y una posición numérica (offset del cursor) para
 * determinar si esa posición se encuentra dentro de una fórmula matemática.
 * 
 * @param text   El texto completo del bloque/párrafo inspeccionado.
 * @param offset La posición (índice de carácter) del cursor o del puntero del mouse.
 * @returns      Un objeto con el código LaTeX y si es bloque, o null si no está en una fórmula.
 */
function findMathAt(text: string, offset: number): { latex: string; isBlock: boolean } | null {
  // --------------------------------------------------------------------------
  // 1. Detección de Fórmulas en Bloque: $$ ... $$
  // --------------------------------------------------------------------------
  // [\s\S]+? permite capturar fórmulas multilínea (incluyendo saltos de línea).
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    // Si la posición buscada está dentro de los límites de los $$...$$
    if (offset >= start && offset <= end) {
      return { latex: match[1].trim(), isBlock: true };
    }
  }

  // --------------------------------------------------------------------------
  // 2. Detección de Fórmulas en Línea: $ ... $
  // --------------------------------------------------------------------------
  // Aseguramos que el signo $ no esté pegado a otro $ para no confundirlo con $$
  const inlineRegex = /(?:^|[^\$])\$([^\$]+?)\$(?:[^\$]|$)/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    // Calculamos el inicio exacto del primer $
    const start = match.index + (match[0].startsWith('$') ? 0 : 1);
    const end = start + match[1].length + 2;
    // Si la posición buscada está dentro de los límites de $...$
    if (offset >= start && offset <= end) {
      return { latex: match[1].trim(), isBlock: false };
    }
  }

  return null;
}

// ============================================================================
// FUNCIÓN PRINCIPAL: initKeystaticMathPreview
// ============================================================================
/**
 * Inicializa el tooltip flotante e inyecta los escuchadores de eventos
 * (mousemove y selectionchange) en el documento del navegador.
 */
export function initKeystaticMathPreview() {
  // Protección para SSR (Server-Side Rendering): solo se ejecuta en el navegador
  if (typeof document === 'undefined') return;

  // Patrón Singleton: evita crear más de un tooltip si la función se llama varias veces
  if (document.getElementById('keystatic-math-tooltip')) return;

  // --------------------------------------------------------------------------
  // Creación del Elemento DOM del Tooltip
  // --------------------------------------------------------------------------
  const tooltip = document.createElement('div');
  tooltip.id = 'keystatic-math-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    z-index: 999999;
    display: none;
    pointer-events: none; /* No intercepta clics del mouse ni interrumpe la escritura */
    background: #18181b;
    color: #f4f4f5;
    border: 1px solid #3f3f46;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 14px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
    max-width: 90vw;
    overflow-x: auto;
    transition: opacity 0.15s ease, transform 0.15s ease;
    transform: translateY(4px);
    opacity: 0;
  `;
  document.body.appendChild(tooltip);

  // --------------------------------------------------------------------------
  // Sub-función: Mostrar Tooltip posicionado
  // --------------------------------------------------------------------------
  function show(latex: string, isBlock: boolean, rect: DOMRect) {
    if (!latex) {
      hide();
      return;
    }
    try {
      // 1. Renderizamos la fórmula matemática a HTML con KaTeX
      const html = katex.renderToString(latex, {
        displayMode: isBlock,
        throwOnError: false, // Si hay error de sintaxis, no rompe la UI
      });
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';

      // 2. Calculamos las coordenadas (X, Y) para ubicar el tooltip justo arriba
      const tooltipRect = tooltip.getBoundingClientRect();
      let top = rect.top - tooltipRect.height - 10;
      let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

      // 3. Ajustes de seguridad para que no se salga de los bordes de la pantalla
      if (top < 10) top = rect.bottom + 10; // Si choca con el techo, mostrar abajo
      if (left < 10) left = 10;
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
      }

      // 4. Aplicamos la posición y la animación de aparición
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
    } catch {
      hide();
    }
  }

  // --------------------------------------------------------------------------
  // Sub-función: Ocultar Tooltip
  // --------------------------------------------------------------------------
  function hide() {
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(4px)';
    setTimeout(() => {
      // Una vez terminada la transición de desvanecimiento, ocultamos el display
      if (tooltip.style.opacity === '0') {
        tooltip.style.display = 'none';
      }
    }, 150);
  }

  // --------------------------------------------------------------------------
  // EVENTO 1: Mousemove (Previsualización al pasar el cursor / Hover)
  // --------------------------------------------------------------------------
  document.addEventListener('mousemove', (e) => {
    const target = e.target as HTMLElement | null;
    // Solo actuamos si el mouse está sobre el editor enriquecido (ProseMirror de Keystatic)
    const pm = target?.closest('.ProseMirror');
    if (!pm) {
      hide();
      return;
    }

    // Obtenemos el punto exacto de texto bajo las coordenadas del puntero
    let range: Range | null = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    }

    if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer;
      const parent = textNode.parentElement;
      const fullText = parent?.textContent || textNode.textContent || '';
      
      // Calculamos la posición del carácter relativa al párrafo padre
      let offset = range.startOffset;
      if (parent) {
        let count = 0;
        for (const child of Array.from(parent.childNodes)) {
          if (child === textNode) {
            offset = count + range.startOffset;
            break;
          }
          count += child.textContent?.length || 0;
        }
      }

      // Verificamos si bajo el puntero hay una fórmula $...$ o $$...$$
      const match = findMathAt(fullText, offset);
      if (match) {
        const rect = range.getBoundingClientRect();
        show(match.latex, match.isBlock, rect.width ? rect : parent?.getBoundingClientRect() || rect);
        return;
      }
    }
    hide();
  });

  // --------------------------------------------------------------------------
  // EVENTO 2: Selectionchange (Previsualización en tiempo real mientras escribes)
  // --------------------------------------------------------------------------
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const pm = node.parentElement?.closest('.ProseMirror');
    if (!pm) return;

    // Si el cursor de texto está dentro de un nodo de texto editable
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      const fullText = parent?.textContent || node.textContent || '';
      let offset = range.startOffset;
      if (parent) {
        let count = 0;
        for (const child of Array.from(parent.childNodes)) {
          if (child === node) {
            offset = count + range.startOffset;
            break;
          }
          count += child.textContent?.length || 0;
        }
      }

      // Si el cursor está tipeando adentro de una fórmula, mostramos el preview en vivo
      const match = findMathAt(fullText, offset);
      if (match) {
        const rect = range.getBoundingClientRect();
        show(match.latex, match.isBlock, rect.width ? rect : parent?.getBoundingClientRect() || rect);
        return;
      }
    }
  });
}

// ============================================================================
// COMPONENTE PUENTE: MathLivePreviewBrandMark
// ============================================================================
/**
 * Componente React que se conecta en la configuración de Keystatic:
 *   ui: { brand: { mark: MathLivePreviewBrandMark } }
 * 
 * Cumple dos propósitos:
 * 1. Renderiza un ícono SVG elegante en la esquina superior izquierda del CMS.
 * 2. Gracias al hook `React.useEffect`, ejecuta `initKeystaticMathPreview()` en el
 *    navegador tan pronto como Keystatic termina de cargar en pantalla.
 */
export const MathLivePreviewBrandMark: React.FC = () => {
  React.useEffect(() => {
    initKeystaticMathPreview();
  }, []);

  return React.createElement(
    'svg',
    {
      width: 28,
      height: 28,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      style: { color: '#6366f1' },
      'aria-label': 'Ergo Docs Logo',
    },
    React.createElement('path', {
      d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    })
  );
};
