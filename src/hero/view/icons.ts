/** Inline stand-ins for the SF Symbols the windows use. Each takes its rendered size in px (a wide icon, its height). */

function svg(size: number | [number, number], body: string, viewBox = '0 0 16 16'): string {
  const [width, height] = typeof size === 'number' ? [size, size] : size;
  return `<svg width="${width}" height="${height}" viewBox="${viewBox}" fill="none" aria-hidden="true" class="shrink-0">${body}</svg>`;
}

/**
 * The masks the icons below cut their holes with, drawn once per page that shows the windows. A mask inside each icon
 * would repeat its id, and `url(#id)` resolves to the first copy, which draws nothing inside a hidden subtree.
 */
export const iconMasks = `<svg width="0" height="0" class="absolute" aria-hidden="true">
  <mask id="ellipsis-holes"><rect width="13" height="13" fill="#fff"/><circle cx="3.5" cy="5.25" r=".85" fill="#000"/><circle cx="6.5" cy="5.25" r=".85" fill="#000"/><circle cx="9.5" cy="5.25" r=".85" fill="#000"/></mask>
  <mask id="bubbles-gap"><rect width="37" height="31" fill="#fff"/><path d="M19.5 8.5h11a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-1v4l-6-4h-4a5 5 0 0 1-5-5v-7a5 5 0 0 1 5-5Z" fill="#000" stroke="#000" stroke-width="2"/></mask>
  <mask id="bubbles-fill-gap"><rect width="23" height="16" fill="#fff"/><path d="M10.6 2.5h10a3.6 3.6 0 0 1 3.6 3.6v5.8a3.6 3.6 0 0 1-3.6 3.6h-.6v2.4l-6.4-2.4H10.6A3.6 3.6 0 0 1 7 11.9V6.1a3.6 3.6 0 0 1 3.6-3.6Z" fill="#000"/></mask>
</svg>`;

const stroke = (width: number) => `stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

export const icons = {
  chevronRight: (size: number) => svg(size, `<path d="M6 3.5 10.5 8 6 12.5" ${stroke(2)}/>`),
  chevronDown: (size: number) => svg(size, `<path d="M3.5 6 8 10.5 12.5 6" ${stroke(2)}/>`),
  infoCircle: (size: number) =>
    svg(
      size,
      `<circle cx="6.5" cy="6.5" r="6" ${stroke(1)}/><path d="M4.6 6h2v4.3M4.5 10h4" stroke="currentColor"/><circle cx="6.45" cy="3.5" r=".9" fill="currentColor"/>`,
      '0 0 13 13',
    ),
  clock: (size: number) =>
    svg(size, `<circle cx="6.5" cy="6.5" r="6" ${stroke(1)}/><path d="M6.5 2.2v4.4H1.8" stroke="currentColor" stroke-width="1.1"/>`, '0 0 13 13'),
  lockOpen: (height: number) =>
    svg(
      [(height * 15) / 13, height],
      `<rect x="2" y="6.5" width="7.5" height="6.5" rx="1.2" ${stroke(1)}/><path d="M8.4 6.5V3.6a2.7 2.7 0 0 1 5.4 0V6" ${stroke(1)}/>`,
      '0 0 15 13',
    ),
  paperclip: (size: number) =>
    svg(size, `<path d="M11 4.5 5.6 9.9a1.4 1.4 0 0 0 2 2l5.6-5.6a2.8 2.8 0 0 0-4-4L3.6 8a4.2 4.2 0 0 0 6 6L14 9.6" ${stroke(1.2)}/>`),
  arrowUpCircleFill: (size: number) =>
    svg(
      size,
      `<circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M8 12.2V3.9M4.6 7.3 8 3.9l3.4 3.4" stroke="var(--mac-window)" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
  xmarkCircleFill: (size: number) =>
    svg(
      size,
      `<circle cx="8" cy="8" r="8" fill="currentColor"/><path d="m5.4 5.4 5.2 5.2m0-5.2-5.2 5.2" stroke="var(--mac-window)" stroke-width="1.5" stroke-linecap="round"/>`,
    ),
  ellipsisBubbleFill: (size: number) =>
    svg(
      size,
      `<g mask="url(#ellipsis-holes)" fill="currentColor"><rect x=".25" y=".5" width="12.5" height="10" rx="2.2"/><path d="M3.1 10h2.9l-2.5 2.6h-.4Z"/></g>`,
      '0 0 13 13',
    ),
  bubbles: (height: number) =>
    svg(
      [(height * 37) / 31, height],
      `<path mask="url(#bubbles-gap)" d="M6 2h14.5A4.5 4.5 0 0 1 25 6.5v11a4.5 4.5 0 0 1-4.5 4.5H13l-5.5 5.5V22H6a4.5 4.5 0 0 1-4.5-4.5v-11A4.5 4.5 0 0 1 6 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M19.5 8.5h11a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-1v4l-6-4h-4a5 5 0 0 1-5-5v-7a5 5 0 0 1 5-5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
      '0 0 37 31',
    ),
  /** The front bubble cuts a 1 pt gap into the back one, through a mask so the gap shows whatever lies behind the row. */
  bubblesFill: (height: number) =>
    svg(
      [(height * 23) / 16, height],
      `<path mask="url(#bubbles-fill-gap)" d="M3.6 0h10.3a2.6 2.6 0 0 1 2.6 2.6v6.3a2.6 2.6 0 0 1-2.6 2.6H7.7L5 14.2h-.5v-2.7h-.9A2.6 2.6 0 0 1 1 8.9V2.6A2.6 2.6 0 0 1 3.6 0Z" fill="currentColor"/><path d="M10.6 3.5h8.8a2.6 2.6 0 0 1 2.6 2.6v4.8a2.6 2.6 0 0 1-2.6 2.6h-1.9v2.1h-.6l-2.5-2.1h-3.8A2.6 2.6 0 0 1 8 10.9V6.1a2.6 2.6 0 0 1 2.6-2.6Z" fill="currentColor"/>`,
      '0 0 23 16',
    ),
  checkmark: (size: number) => svg(size, `<path d="M1 4.7 3.6 7.8 8.3 1.2" ${stroke(1.05)}/>`, '0 0 9 9'),
  number: (size: number) => svg(size, `<path d="M6.2 2.5 4.8 13.5M11.2 2.5 9.8 13.5M2.8 5.8h11M2.2 10.2h11" ${stroke(1.3)}/>`),
  person2: (height: number) =>
    svg(
      [(height * 19.5) / 13, height],
      `<circle cx="12.8" cy="4.3" r="2.3" stroke="currentColor"/><path d="M8.2 12.4v-.9c0-1.9 2.3-3.1 5.1-3.1s5.2 1.2 5.2 3.1v.9Z" stroke="currentColor" stroke-linejoin="round"/><circle cx="5.5" cy="4.6" r="1.9" stroke="currentColor"/><path d="M6 12.4H.9v-.8c0-1.9 2-3 4.5-3 .8 0 1.5.1 2.1.4" stroke="currentColor" stroke-linejoin="round"/>`,
      '0 0 19.5 13',
    ),
  pencil: (size: number) => svg(size, `<path d="m.4 10.6.7-2.5L8.5.7a1 1 0 0 1 1.4 0l.4.4a1 1 0 0 1 0 1.4L2.9 9.9Z" fill="currentColor"/>`, '0 0 11 11'),
};
