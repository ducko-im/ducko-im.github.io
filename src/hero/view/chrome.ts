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

export function renderTitlebar(state: HeroState, window: HeroWindow): string {
  const key = isKey(state, window);
  const lights = key ? [tw`bg-light-close`, tw`bg-light-minimize`, tw`bg-light-zoom`] : [tw`bg-light-inactive`, tw`bg-light-inactive`, tw`bg-light-inactive`];
  const buttons = lights
    .map(
      (color, index) =>
        `<button type="button" data-action="hint" data-hint-anchor="lights-${window}" aria-label="${['Close', 'Minimize', 'Zoom'][index]} window" class="${tw`size-3 rounded-full shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.18)]`} ${color}"></button>`,
    )
    .join('');
  return `<div class="${tw`absolute top-[10px] left-[13px] flex gap-2`}">${buttons}</div><span class="${key ? tw`text-label` : tw`text-tertiary-label`} ${tw`truncate px-20 font-bold`}">${escapeHtml(windowTitle(state, window))}</span>`;
}

export function titlebar(state: HeroState, window: HeroWindow): string {
  return `<div data-region="${window}-titlebar" class="${tw`relative flex h-8 shrink-0 items-center justify-center`}">${renderTitlebar(state, window)}</div>`;
}

export const windowClass = tw`relative flex size-full cursor-default flex-col overflow-hidden rounded-window bg-window font-mac text-mac-body leading-[1.25] text-label shadow-window select-none`;

export const divider = `<div class="${tw`h-px shrink-0 bg-separator`}"></div>`;
