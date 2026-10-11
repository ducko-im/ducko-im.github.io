/** How far above the anchor point Ducko's context menu starts, so its first item sits under the pointer. */
const CONTEXT_MENU_LIFT = 5.5;

/**
 * Places the open context menu in its layer at the center of the bubble it belongs to, where a click opens Ducko's.
 * The bubble moves with the timeline, so call this again after every paint, scroll and resize of the timeline.
 * `layer` and the chat window must share a parent. Measurements are divided by the layer's scale, so a scaled hero
 * places correctly.
 */
export function placeContextMenu(layer: HTMLElement) {
  const menu = layer.querySelector<HTMLElement>('[role="menu"][data-anchor]');
  const bubble = menu && layer.parentElement!.querySelector<HTMLElement>(`[data-own-bubble][data-id="${menu.dataset.anchor}"]`);
  if (!menu || !bubble) return;
  const layerRect = layer.getBoundingClientRect();
  const scale = layerRect.width / layer.offsetWidth;
  const bubbleRect = bubble.getBoundingClientRect();
  menu.style.left = `${(bubbleRect.left + bubbleRect.width / 2 - layerRect.left) / scale}px`;
  menu.style.top = `${(bubbleRect.top + bubbleRect.height / 2 - layerRect.top) / scale - CONTEXT_MENU_LIFT}px`;
}

/** Settles statically rendered chat windows the way the live hero does after a paint: newest message in view, context menu placed. */
export function settleChatWindows(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-region="timeline"]').forEach((timeline) => (timeline.scrollTop = 0));
  root.querySelectorAll<HTMLElement>('[data-region="context-menu"]').forEach(placeContextMenu);
}
