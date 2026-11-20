/**
 *    El proyecto en `/admin/` (desplegado como Cloudflare Worker) ejecuta antes de cada
 *    compilación un script `prebuild: "cp ../keystatic.config.ts ./keystatic.config.ts"`.
 * 
 *    Dado que este archivo posee extensión `.ts` (no `.tsx`), se utiliza `React.createElement`
 *    (abreviado como `h`) para instanciar componentes visuales. Esto evita incompatibilidades
 *    con el compilador de Vite y Rolldown durante el empaquetado del Cloudflare Worker.
 * 
 *    El editor incluye un overlay interactivo que detecta la posición del cursor de texto (caret)
 *    o el hover del mouse para previsualizar la fórmula con KaTeX en tiempo real sobre el texto.
 *    
 *    Al guardar, el archivo `.mdx` almacena Markdown puro que Starlight compila con `remark-math`
 *    y `rehype-katex`.
 */

import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { config, fields, collection } from '@keystatic/core';

const h = React.createElement;

interface MathMatch {
  type: 'inline' | 'block';
  /** contenido latex sin los delimitadores externos y sin espacios sobrantes */
  latex: string;
  /** cadena original completa con delimitadores incluidos */
  raw: string;
  /** Índice del carácter donde inicia el primer delimitador en el texto del bloque */
  start: number;
  /** Índice del carácter donde termina el último delimitador en el texto del bloque */
  end: number;
}

/**
 * Analiza un bloque de texto plano y determina si un offset numérico específico
 * (posición del cursor o puntero del ratón) cae dentro de una fórmula matemática delimitada.
 * 
 * Primero se evalúan las expresiones en bloque `$$...$$` para evitar que las expresiones
 * en línea `$..$` consuman erróneamente los signos de dólar adyacentes de un bloque.
 * 
 * @param text   Cadena completa de texto del nodo de bloque actual
 * @param offset Índice base 0 de la posición del cursor dentro de dicha cadena de texto
 * @returns
 */
function findMathAtOffset(text: string, offset: number): MathMatch | null {
  if (!text) return null;

  // fórmulas en bloque: delimitadas por $$ ... $$ (admite múltiples líneas con [\s\S]+?)
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    // comprobar si el cursor/mouse se encuentra entre los delimitadores (inclusivo)
    if (offset >= start && offset <= end) {
      return {
        type: 'block',
        latex: match[1].trim(),
        raw: match[0],
        start,
        end,
      };
    }
  }

  // fórmulas en línea: delimitadas por $ ... $
  const inlineRegex = /\$([^\$\n]+?)\$/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      return {
        type: 'inline',
        latex: match[1].trim(),
        raw: match[0],
        start,
        end,
      };
    }
  }

  return null;
}

// COMPONENTE VISUAL: popover

interface MathFloatingTooltipProps {
  match: MathMatch | null;
  /** rectángulo de coordenadas (bounding box) de la fórmula en el viewport del navegador */
  rect: DOMRect | null;
}

/**
 * Renderiza una tarjeta flotante en coordenadas de pantalla (`position: fixed`)
 * que muestra la fórmula matemática procesada mediante KaTeX.
 */
function MathFloatingTooltip({ match, rect }: MathFloatingTooltipProps) {
  if (!match || !rect) return null;

  // Renderizar la fórmula usando KaTeX
  let renderedHtml = '';
  try {
    renderedHtml = katex.renderToString(match.latex, {
      // si displaymode es true, se centra y se muestra en bloque; si es false, se muestra inline
      displayMode: match.type === 'block',
      // evitar que KaTeX lance errores de sintaxis y en su lugar devuelva un mensaje de error
      throwOnError: false,
    });
  } catch {
    renderedHtml = '<span style="color: #ef4444;">Error en sintaxis LaTeX</span>';
  }

  // Calcular coordenadas para posicionar la tarjeta flotante centrada sobre la fórmula
  // Se añade un margen de seguridad superior (mínimo 10px del borde de la pantalla)
  const top = Math.max(10, rect.top - 8);
  const left = Math.max(16, rect.left + rect.width / 2);

  return h(
    'div',
    {
      style: {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        // centrar horizontalmente y desplazar hacia arriba de la coordenada top
        transform: 'translate(-50%, -100%)',
        zIndex: 999999,
        pointerEvents: 'none',
        background: '#0f172a',
        color: '#f8fafc',
        border: '1px solid #334155',
        borderRadius: '8px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
        padding: '8px 14px',
        maxWidth: '480px',
        maxHeight: '260px',
        overflow: 'auto',
        fontSize: '0.95rem',
      },
    },
    // Contenedor de la fórmula renderizada
    h('div', {
      style: { textAlign: match.type === 'block' ? 'center' : 'left' },
      dangerouslySetInnerHTML: { __html: renderedHtml },
    })
  );
}


/**
 * Componente envoltorio que intercepta el editor estándar de Keystatic (`baseInput`), para que haga lo siguiente:
 * 
 * . Rastrea la posición del cursor de texto (Caret) mediante el evento nativo `selectionchange`.
 *   Calcula el nodo de texto y bloque HTML padre y mapea el offset textual.
 *  Rastrea el movimiento del ratón (`onMouseMove`) utilizando la API de colisiones de puntero
 *    (`document.caretPositionFromPoint` o `document.caretRangeFromPoint`).
 * 
 * Cuando el cursor o el puntero se posan sobre una fórmula, obtiene su rectángulo en pantalla
 *    (`getBoundingClientRect`) y actualiza el estado para presentar `MathFloatingTooltip`.
 */
function MathInteractiveEditor({ baseInput, ...fieldProps }: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeMath, setActiveMath] = useState<MathMatch | null>(null);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);

  /**
   * Determina si el cursor de texto (caret) se encuentra dentro de una fórmula matemática.
   */
  const checkCaretMath = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !containerRef.current) return;

    const range = sel.getRangeAt(0);
    let node: Node | null = range.startContainer;

    // Asegurar que la selección pertenece a nuestro contenedor editable
    if (!containerRef.current.contains(node)) {
      setActiveMath(null);
      setTooltipRect(null);
      return;
    }

    // Ascender en el árbol DOM hasta hallar el elemento de bloque contenedor de texto
    let blockElement: HTMLElement | null =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;

    while (
      blockElement &&
      blockElement !== containerRef.current &&
      !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE'].includes(
        blockElement.tagName
      )
    ) {
      blockElement = blockElement.parentElement;
    }

    if (!blockElement) {
      //setea el estado a null si no se encuentra un bloque válido
      setActiveMath(null);
      // setea el rectángulo del tooltip a null para ocultarlo
      setTooltipRect(null);
      return;
    }
    
    const text = blockElement.textContent || '';

    // Calcular el offset acumulado dentro del bloque recorriendo sus nodos de texto
    let offset = 0;
    const walker = document.createTreeWalker(blockElement, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();
    let found = false;

    while (currentNode) {
      if (currentNode === range.startContainer) {
        offset += range.startOffset;
        found = true;
        break;
      }
      offset += currentNode.textContent?.length || 0;
      currentNode = walker.nextNode();
    }

    if (!found) offset = range.startOffset;

    // Buscar si existe una fórmula que cubra el offset actual
    const math = findMathAtOffset(text, offset);
    if (math) {
      setActiveMath(math);
      // Usar las coordenadas exactas del cursor en pantalla
      setTooltipRect(range.getBoundingClientRect());
    } else {
      setActiveMath(null);
      setTooltipRect(null);
    }
  };

  /**
   * Detecta si el puntero del ratón está sobrevolando (hover) alguna fórmula matemática.
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    // Si el usuario tiene una selección activa de texto con el cursor, priorizamos el caret
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) return;

    let targetRange: Range | null = null;

    // Intentar con la API moderna de posición de cursor
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos && pos.offsetNode) {
        targetRange = document.createRange();
        targetRange.setStart(pos.offsetNode, pos.offset);
        targetRange.collapse(true);
      }
    } 
    // Fallback para motores WebKit antiguos
    else if ((document as any).caretRangeFromPoint) {
      targetRange = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
    }

    // Verificar que el punto de colisión esté dentro de nuestro editor
    if (!targetRange || !containerRef.current?.contains(targetRange.startContainer)) {
      return;
    }

    const node = targetRange.startContainer;
    const parentBlock =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;

    if (!parentBlock) return;
    const text = parentBlock.textContent || '';
    const offset = targetRange.startOffset;

    // Buscar si hay una fórmula bajo el puntero
    const math = findMathAtOffset(text, offset);
    if (math) {
      setActiveMath(math);
      setTooltipRect(targetRange.getBoundingClientRect());
    }
  };

  /**
   * Al retirar el mouse del contenedor, se revalida la posición del caret de teclado.
   */
  const handleMouseLeave = () => {
    checkCaretMath();
  };

  // Registrar el listener global de selección para actualizar el tooltip al escribir o mover flechas
  useEffect(() => {
    document.addEventListener('selectionchange', checkCaretMath);
    return () => {
      document.removeEventListener('selectionchange', checkCaretMath);
    };
  }, []);

  return h(
    'div',
    {
      ref: containerRef,
      style: { position: 'relative' },
      onKeyUp: checkCaretMath,
      onClick: checkCaretMath,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
    // Instancia del editor nativo de Keystatic
    h(baseInput, fieldProps),
    // Overlay flotante con la fórmula KaTeX activa
    h(MathFloatingTooltip, { match: activeMath, rect: tooltipRect })
  );
}

/**
 * Crea una definición de campo para Keystatic que extiende `fields.mdx`.
 * 
 * Permite conservar la serialización, almacenamiento y esquema MDX estándar de Keystatic
 * al tiempo que inyecta el componente interactivo `MathInteractiveEditor` en el método `Input`.
 */
function mathContentField() {
  const base = fields.mdx({
    label: 'Contenido',
    description: 'Cualquier fórmula en LaTeX de la forma $inline$ y $$bloque$$ se previsualizan aquí y se renderizan en el sitio al publicar.',
    extension: 'mdx',
  });

  return {
    ...base,
    Input(props: any) {
      return h(MathInteractiveEditor, {
        baseInput: base.Input,
        ...props,
      });
    },
  };
}

// CONFIG PRINCIPAL DE KEYSTATIC
/**
 * - `storage`: Selección dinámica de backend según el entorno:
 *    - `PROD` (Cloudflare Worker): Almacenamiento en repositorio GitHub.
 *    - `DEV` (Localhost): Sistema de archivos local directo.
 */
export default config({
  storage: import.meta.env.PROD
    ? { kind: 'github', repo: { owner: 'tomascaruso-hub', name: 'ergo-v2' } }
    : { kind: 'local' },
  collections: {
    docs: collection({
      label: 'Documentación Starlight',
      slugField: 'title',
      path: 'src/content/docs/**',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Título' } }),
        description: fields.text({ label: 'Descripción' }),
        content: mathContentField(),
      },
    }),
  },
});
