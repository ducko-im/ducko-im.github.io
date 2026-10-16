/** How far above the anchor point Ducko's context menu starts, so its first item sits under the pointer. */
const CONTEXT_MENU_LIFT = 5.5;

/** A point in a bubble, in unscaled points from its top-left corner. */
export interface BubblePoint {
  x: number;
  y: number;
}

function layerScale(layer: HTMLElement, layerRect = layer.getBoundingClientRect()): number {
  return layerRect.width / layer.offsetWidth;
}

export function pointInBubble(layer: HTMLElement, bubble: HTMLElement, clientX: number, clientY: number): BubblePoint {
  const scale = layerScale(layer);
  const rect = bubble.getBoundingClientRect();
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}

/**
 * Places the open context menu in its layer at `point` in its bubble, where the pointer opened it, as Ducko's opens at
 * the pointer. Without a point it sits at the bubble's center, where the captures click.
 *
 * The bubble moves with the timeline, so call this again after every paint, scroll and resize of the timeline. `layer`
 * and the chat window must share a parent. Measurements are divided by the layer's scale, so a scaled hero places
 * correctly.
 */
export function placeContextMenu(layer: HTMLElement, point?: BubblePoint) {
  const menu = layer.querySelector<HTMLElement>('[role="menu"][data-anchor]');
  const bubble = menu && layer.parentElement!.querySelector<HTMLElement>(`[data-own-bubble][data-id="${menu.dataset.anchor}"]`);
  if (!menu || !bubble) return;
  const layerRect = layer.getBoundingClientRect();
  const scale = layerScale(layer, layerRect);
  const bubbleRect = bubble.getBoundingClientRect();
  const { x, y } = point ?? { x: bubbleRect.width / 2 / scale, y: bubbleRect.height / 2 / scale };
  menu.style.left = `${(bubbleRect.left - layerRect.left) / scale + x}px`;
  menu.style.top = `${(bubbleRect.top - layerRect.top) / scale + y - CONTEXT_MENU_LIFT}px`;
}

/** Settles statically rendered chat windows the way the live hero does after a paint: newest message in view, context menu placed. */
export function settleChatWindows(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-region="timeline"]').forEach((timeline) => (timeline.scrollTop = 0));
  root.querySelectorAll<HTMLElement>('[data-region="context-menu"]').forEach((layer) => placeContextMenu(layer));
}
