/** Inline stand-ins for the SF Symbols the windows use. Each takes its rendered size in px. */

function svg(size: number, body: string, viewBox = '0 0 16 16', extra = ''): string {
  return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" aria-hidden="true" class="shrink-0" ${extra}>${body}</svg>`;
}

const stroke = (width: number) => `stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

export const icons = {
  chevronRight: (size: number) => svg(size, `<path d="M6 3.5 10.5 8 6 12.5" ${stroke(2)}/>`),
  chevronDown: (size: number) => svg(size, `<path d="M3.5 6 8 10.5 12.5 6" ${stroke(2)}/>`),
  infoCircle: (size: number) =>
    svg(size, `<circle cx="8" cy="8" r="6.6" ${stroke(1.2)}/><path d="M8 7.2v4" ${stroke(1.4)}/><circle cx="8" cy="4.9" r=".9" fill="currentColor"/>`),
  clock: (size: number) => svg(size, `<circle cx="8" cy="8" r="6.6" ${stroke(1.2)}/><path d="M8 4.4V8l2.4 1.6" ${stroke(1.3)}/>`),
  lockOpen: (size: number) =>
    svg(size, `<rect x="3.2" y="7" width="9.6" height="7.4" rx="1.6" ${stroke(1.2)}/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.5-.8" ${stroke(1.3)}/>`),
  paperclip: (size: number) =>
    svg(size, `<path d="M11 4.5 5.6 9.9a1.4 1.4 0 0 0 2 2l5.6-5.6a2.8 2.8 0 0 0-4-4L3.6 8a4.2 4.2 0 0 0 6 6L14 9.6" ${stroke(1.2)}/>`),
  arrowUpCircleFill: (size: number) =>
    svg(
      size,
      `<circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M8 11.6V4.6M5 7.4l3-3 3 3" stroke="var(--mac-window)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    ),
  xmarkCircleFill: (size: number) =>
    svg(
      size,
      `<circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="var(--mac-window)" stroke-width="1.4" stroke-linecap="round"/>`,
    ),
  ellipsisBubbleFill: (size: number) =>
    svg(
      size,
      `<path d="M8 2.2c3.6 0 6.5 2.3 6.5 5.2s-2.9 5.2-6.5 5.2c-.7 0-1.4-.1-2-.3L3 13.8l.7-2.6C2.3 10.3 1.5 9 1.5 7.4 1.5 4.5 4.4 2.2 8 2.2Z" fill="currentColor"/><circle cx="5" cy="7.4" r="1" fill="var(--mac-window)"/><circle cx="8" cy="7.4" r="1" fill="var(--mac-window)"/><circle cx="11" cy="7.4" r="1" fill="var(--mac-window)"/>`,
    ),
  bubbles: (size: number) =>
    svg(
      size,
      `<path d="M6.5 2.5c2.8 0 5 1.8 5 4s-2.2 4-5 4c-.5 0-1-.1-1.5-.2L2.6 11.5l.6-2C2 8.8 1.5 7.7 1.5 6.5c0-2.2 2.2-4 5-4Z" ${stroke(0.9)}/><path d="M12.2 5.6c1.4.6 2.3 1.8 2.3 3.1 0 .9-.4 1.7-1.1 2.3l.5 1.7-2-.9c-.4.1-.9.2-1.4.2-1.4 0-2.6-.5-3.4-1.3" ${stroke(0.9)}/>`,
    ),
  bubblesFill: (size: number) =>
    svg(
      size,
      `<path d="M6.5 2.5c2.8 0 5 1.8 5 4s-2.2 4-5 4c-.5 0-1-.1-1.5-.2L2.6 11.5l.6-2C2 8.8 1.5 7.7 1.5 6.5c0-2.2 2.2-4 5-4Z" fill="currentColor"/><path d="M12.4 5.8c1.3.6 2.1 1.7 2.1 2.9 0 .9-.4 1.7-1.1 2.3l.5 1.7-2-.9c-.4.1-.9.2-1.4.2-1.3 0-2.4-.4-3.2-1.1 2.8-.3 4.9-2.2 5.1-5.1Z" fill="currentColor"/>`,
    ),
  checkmark: (size: number) => svg(size, `<path d="m3 8.6 3.2 3.2L13 4.6" ${stroke(1.8)}/>`),
  number: (size: number) => svg(size, `<path d="M6.2 2.5 4.8 13.5M11.2 2.5 9.8 13.5M2.8 5.8h11M2.2 10.2h11" ${stroke(1.3)}/>`),
  person2: (size: number) =>
    svg(
      size,
      `<circle cx="6" cy="5.6" r="2.4" ${stroke(1.2)}/><path d="M1.8 13.2c.4-2.3 2.1-3.6 4.2-3.6s3.8 1.3 4.2 3.6" ${stroke(1.2)}/><path d="M10.6 3.4a2.3 2.3 0 0 1 0 4.4M12 9.8c1.2.5 2 1.6 2.2 3.4" ${stroke(1.2)}/>`,
    ),
  pencil: (size: number) => svg(size, `<path d="m10.6 2.8 2.6 2.6-7.8 7.8-3.3.7.7-3.3 7.8-7.8ZM9.2 4.2l2.6 2.6" ${stroke(1.2)}/>`),
};
