import type { HeroState, HeroWindow } from '../types';
import { escapeHtml } from './escape';
import { icon } from './icons';
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

const INACTIVE_LIGHT = tw`bg-(image:--mac-light-inactive) shadow-light-inactive`;

// As in macOS, the pointer over any light colors every enabled one and shows its glyph.
const LIGHTS = [
  {
    label: 'Close',
    fill: tw`bg-(image:--mac-light-close) shadow-light-close`,
    hover: tw`group-hover/lights:bg-(image:--mac-light-close) group-hover/lights:shadow-light-close`,
    glyph: 'xmarkLight',
    glyphClasses: tw`text-light-close-glyph`,
  },
  {
    label: 'Minimize',
    fill: tw`bg-(image:--mac-light-minimize) shadow-light-minimize`,
    hover: tw`group-hover/lights:bg-(image:--mac-light-minimize) group-hover/lights:shadow-light-minimize`,
    glyph: 'minusLight',
    glyphClasses: tw`text-light-minimize-glyph`,
  },
  {
    label: 'Zoom',
    fill: tw`bg-(image:--mac-light-zoom) shadow-light-zoom`,
    hover: tw`group-hover/lights:bg-(image:--mac-light-zoom) group-hover/lights:shadow-light-zoom`,
    glyph: 'plusLight',
    glyphClasses: tw`relative -top-px text-light-zoom-glyph`,
  },
] as const;

export function renderTitlebar(state: HeroState, window: HeroWindow): string {
  const key = isKey(state, window);
  const hovered = state.forcedHover?.kind === 'lights' && state.forcedHover.id === window;
  const buttons = LIGHTS.map(({ label, fill, hover, glyph, glyphClasses }) => {
    const action = window === 'chat' && label === 'Close' ? 'data-action="close-chat-window"' : `data-action="hint" data-hint-anchor="lights-${window}"`;
    // The user can't resize Ducko's Contacts window, so its zoom button stays inactive, key or under the pointer.
    const disabled = window === 'contacts' && label === 'Zoom';
    let classes = INACTIVE_LIGHT;
    if (!disabled) classes = key || hovered ? fill : `${INACTIVE_LIGHT} ${hover}`;
    const content = disabled ? '' : icon(glyph, `${glyphClasses} ${hovered ? '' : tw`invisible group-hover/lights:visible`}`);
    return `<button type="button" ${action} aria-label="${label} window" class="${tw`grid size-3.5 place-items-center rounded-full`} ${classes}">${content}</button>`;
  }).join('');
  return `<div class="${tw`group/lights absolute top-[9px] left-[9px] flex gap-[9px]`}">${buttons}</div><span class="${key ? tw`text-title` : tw`text-title-inactive`} ${tw`truncate pr-4 pl-[84px] font-bold`}">${escapeHtml(windowTitle(state, window))}</span>`;
}

export function titlebar(state: HeroState, window: HeroWindow): string {
  return `<div data-region="${window}-titlebar" class="${tw`relative flex h-8 shrink-0 items-center bg-titlebar shadow-titlebar`}">${renderTitlebar(state, window)}</div>`;
}

export const windowClass = tw`relative flex size-full cursor-default flex-col overflow-hidden rounded-window bg-window font-mac text-mac-body leading-[1.25] text-label shadow-window select-none`;

export const divider = `<div class="${tw`h-px shrink-0 bg-separator`}"></div>`;
