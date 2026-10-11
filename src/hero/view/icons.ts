import { symbols } from './symbols';

/** An inline SVG at the symbol's image size, which AppKit lays it out at. */
export function icon(name: keyof typeof symbols, classes = ''): string {
  const { width, height, path } = symbols[name];
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="currentColor" aria-hidden="true" class="shrink-0 ${classes}"><path d="${path}"/></svg>`;
}
