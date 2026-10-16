import type { HeroState, HeroWindow } from '../types';
import { escapeHtml } from './escape';
import { conversationName } from './shared';
import { tw } from './tw';

export function isKey(state: HeroState, window: HeroWindow): boolean {
  return state.frontWindow === window;
}

export function windowTitle(state: HeroState, window: HeroWindow): string {
  if (window === 'contacts') return 'Contacts';
  const id = state.activeConversationId;
  if (id === null) return 'Chat';
  return conversationName(state, id);
}

const LIGHTS = {
  close: tw`bg-(image:--mac-light-close) shadow-light-close`,
  minimize: tw`bg-(image:--mac-light-minimize) shadow-light-minimize`,
  zoom: tw`bg-(image:--mac-light-zoom) shadow-light-zoom`,
  inactive: tw`bg-(image:--mac-light-inactive) shadow-light-inactive`,
};

export function renderTitlebar(state: HeroState, window: HeroWindow): string {
  const key = isKey(state, window);
  // The user can't resize Ducko's Contacts window, so its zoom button is drawn inactive even while the window is key.
  const lights = key ? [LIGHTS.close, LIGHTS.minimize, window === 'chat' ? LIGHTS.zoom : LIGHTS.inactive] : [LIGHTS.inactive, LIGHTS.inactive, LIGHTS.inactive];
  const buttons = lights
    .map((classes, index) => {
      const action = window === 'chat' && index === 0 ? 'data-action="close-chat-window"' : `data-action="hint" data-hint-anchor="lights-${window}"`;
      return `<button type="button" ${action} aria-label="${['Close', 'Minimize', 'Zoom'][index]} window" class="${tw`size-3.5 rounded-full`} ${classes}"></button>`;
    })
    .join('');
  return `<div class="${tw`absolute top-[9px] left-[9px] flex gap-[9px]`}">${buttons}</div><span class="${key ? tw`text-title` : tw`text-title-inactive`} ${tw`truncate pr-4 pl-[84px] font-bold`}">${escapeHtml(windowTitle(state, window))}</span>`;
}

export function titlebar(state: HeroState, window: HeroWindow): string {
  return `<div data-region="${window}-titlebar" class="${tw`relative flex h-8 shrink-0 items-center bg-titlebar shadow-titlebar`}">${renderTitlebar(state, window)}</div>`;
}

export const windowClass = tw`relative flex size-full cursor-default flex-col overflow-hidden rounded-window bg-window font-mac text-mac-body leading-[1.25] text-label shadow-window select-none`;

export const divider = `<div class="${tw`h-px shrink-0 bg-separator`}"></div>`;
