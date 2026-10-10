// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startHero } from './client';
import { initialState } from './data';
import { renderChatWindow } from './view/chat';
import { renderContactsWindow } from './view/contacts';

let intersect: (isIntersecting: boolean) => void;
const resizeCallbacks = new Map<Element, () => void>();

function mount({ reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reducedMotion && query.includes('reduced-motion') }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = (isIntersecting) => callback([{ isIntersecting }]);
      }
      observe() {}
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: () => void) {}
      observe(element: Element) {
        resizeCallbacks.set(element, this.callback);
      }
    },
  );
  const state = initialState();
  document.body.innerHTML = `<main data-hero>
    <button type="button" data-hero-icon><span data-dock-badge></span></button>
    <section data-windows-frame>
      <div data-windows data-front="${state.frontWindow}">
        <div class="hero-slot" data-slot="contacts">${renderContactsWindow(state)}</div>
        <div class="hero-slot" data-slot="chat">${renderChatWindow(state)}</div>
      </div>
    </section>
  </main>`;
  const hero = document.querySelector<HTMLElement>('[data-hero]')!;
  startHero(hero);
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => hero.querySelector<T>(selector)!;
  return {
    $,
    input: $<HTMLTextAreaElement>('[data-composer-input]'),
    messageCount: () => $('[data-region="timeline"]').querySelectorAll('[data-message-id]').length,
    marcoUnread: () => $('[data-tab="marco"]').querySelector('[data-unread]'),
    resize: (element: Element) => resizeCallbacks.get(element)!(),
  };
}

/** Gives an element the layout happy-dom does not compute. */
function layout(element: HTMLElement, rect: { left: number; top: number; width: number; height: number }, offsetWidth = rect.width) {
  element.getBoundingClientRect = () => DOMRect.fromRect({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  Object.defineProperty(element, 'offsetWidth', { value: offsetWidth });
}

function type(input: HTMLTextAreaElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the intro', () => {
  it('builds the conversation up from empty once the windows come into view', () => {
    const { messageCount } = mount();
    expect(messageCount()).toBe(0);
    intersect(true);
    vi.advanceTimersByTime(10_000);
    expect(messageCount()).toBe(4);
  });

  it('plays nothing under reduced motion, whatever the visitor does', () => {
    const { $, input, messageCount } = mount({ reducedMotion: true });
    intersect(true);
    $('[data-slot="contacts"] [data-action="select-row"][data-id="lena"]').click();
    input.focus();
    vi.advanceTimersByTime(10_000);
    expect(messageCount()).toBe(4);
    expect($('[data-dock-badge]').textContent).toBe('3');
  });
});

describe('clicks', () => {
  it('shows the hint for a traffic light of the window behind and brings that window forward', () => {
    const { $ } = mount({ reducedMotion: true });
    $('[data-region="contacts-titlebar"] [data-action="hint"]').click();
    expect($('[data-windows]').dataset.front).toBe('contacts');
    expect($('[data-slot="contacts"] [role="status"]').textContent).toContain('real app');
  });

  // The window is drawn at half size: 140 px on screen for its 280 px layout. The hint stays 80 px from its edges.
  it.each([
    [160, '126px'],
    [104, '80px'],
    [230, '200px'],
  ])('places the hint for a control at %i px in the window’s unscaled coordinates, at %s', (anchorLeft, left) => {
    const { $ } = mount({ reducedMotion: true });
    layout($('[data-slot="contacts"]'), { left: 100, top: 50, width: 140, height: 235 }, 280);
    const light = $('[data-region="contacts-titlebar"] [data-action="hint"]');
    layout(light, { left: anchorLeft, top: 54, width: 6, height: 6 });
    light.click();
    const hint = $('[data-slot="contacts"] [role="status"]');
    expect(hint.style.left).toBe(left);
    expect(hint.style.top).toBe('26px');
  });

  it('closes an open menu on a click outside the hero', () => {
    const { $ } = mount({ reducedMotion: true });
    $('[data-action="status-menu"]').click();
    expect($('[role="menu"][aria-label="Status"]')).not.toBeNull();
    document.body.click();
    expect($('[role="menu"][aria-label="Status"]')).toBeNull();
  });

  // Three 90 px tabs and their gaps need 278 px: a 290 px bar fits them only if its 24 px insets are ignored.
  it('moves tabs that no longer fit into the overflow menu when the tab bar narrows', () => {
    const { $, resize } = mount({ reducedMotion: true });
    const tabs = $('[data-region="tabs"]');
    expect(tabs.querySelector('[data-action="overflow-menu"]')).toBeNull();
    Object.defineProperty(tabs, 'clientWidth', { value: 290 });
    resize(tabs);
    expect(tabs.querySelector('[data-action="overflow-menu"]')).not.toBeNull();
  });
});

describe('the composer', () => {
  it('enables Send only while the draft has text', () => {
    const { $, input } = mount({ reducedMotion: true });
    const send = $<HTMLButtonElement>('[data-action="send"]');
    expect(send.disabled).toBe(true);
    type(input, 'hi');
    expect(send.disabled).toBe(false);
    type(input, '  ');
    expect(send.disabled).toBe(true);
  });

  it('keeps the newest message in view when the timeline resizes', () => {
    const { $, resize } = mount({ reducedMotion: true });
    const timeline = $('[data-region="timeline"]');
    Object.defineProperty(timeline, 'scrollHeight', { value: 900 });
    timeline.scrollTop = 0;
    resize(timeline);
    expect(timeline.scrollTop).toBe(900);
  });

  it('sends on Return, but not on Shift-Return or while an IME composes', () => {
    const { input, messageCount } = mount({ reducedMotion: true });
    type(input, 'hi');
    press(input, 'Enter', { shiftKey: true });
    press(input, 'Enter', { isComposing: true });
    expect(messageCount()).toBe(4);
    press(input, 'Enter');
    expect(messageCount()).toBe(5);
    expect(input.value).toBe('');
  });

  it('cancels an edit on Escape', () => {
    const { $, input } = mount({ reducedMotion: true });
    $('[data-own-bubble]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    $('[data-action="start-edit"]').click();
    expect($('[data-edit-bar]').hidden).toBe(false);
    press(input, 'Escape');
    expect($('[data-edit-bar]').hidden).toBe(true);
    expect(input.value).toBe('');
  });
});

describe('the ambient stream', () => {
  // A roll of 0.6 makes every event a message in a background tab: Marco's.
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.6));

  it('brings background messages while the visitor is online', () => {
    const { marcoUnread } = mount({ reducedMotion: true });
    vi.advanceTimersByTime(13_000);
    expect(marcoUnread()).not.toBeNull();
  });

  it('pauses while the visitor is offline', () => {
    const { $, marcoUnread } = mount({ reducedMotion: true });
    $('[data-action="status-menu"]').click();
    $('[data-action="set-presence"][data-presence="offline"]').click();
    vi.advanceTimersByTime(60_000);
    expect(marcoUnread()).toBeNull();
  });
});
