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
  Object.defineProperty(element, 'offsetWidth', { value: offsetWidth, configurable: true });
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

  // The chat window is drawn at half size: 250 px on screen for its 500 px layout.
  it('opens the context menu at its bubble’s centre in the window’s unscaled coordinates and keeps it there', () => {
    const { $, resize } = mount({ reducedMotion: true });
    const bubble = $('[data-own-bubble]');
    layout($('[data-region="context-menu"]'), { left: 100, top: 50, width: 250, height: 225 }, 500);
    layout(bubble, { left: 300, top: 150, width: 40, height: 20 });
    bubble.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const menu = $('[role="menu"][aria-label="Message"]');
    expect(menu.style.left).toBe('440px');
    expect(menu.style.top).toBe('214.5px');

    const timeline = $('[data-region="timeline"]');
    layout(bubble, { left: 300, top: 100, width: 40, height: 20 });
    timeline.dispatchEvent(new Event('scroll'));
    expect(menu.style.top).toBe('114.5px');
    layout(bubble, { left: 280, top: 100, width: 40, height: 20 });
    resize(timeline);
    expect(menu.style.left).toBe('400px');
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

describe('the Contacts window', () => {
  const work = '[data-action="toggle-group"][data-id="work"]';
  const resizeTime = (slot: HTMLElement) => parseFloat(slot.style.getPropertyValue('--contacts-resize-time'));

  /**
   * Stands in for two things happy-dom lacks. One is Chromium's `getAnimations()`, which returns only running
   * animations and skips detached elements. The other is a height for the Work rows: 200 px at rest, `reached` while
   * they slide, none once detached.
   */
  function motion() {
    const animate = vi.spyOn(Element.prototype, 'animate');
    const getAnimations = Element.prototype.getAnimations;
    vi.spyOn(Element.prototype, 'getAnimations').mockImplementation(function (this: Element) {
      return this.isConnected ? getAnimations.call(this).filter((animation) => animation.playState === 'running') : [];
    });
    const heights = { reached: 200 };
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (!this.isConnected || !this.matches('[data-group-rows]')) return 0;
      return this.getAnimations().length > 0 ? heights.reached : 200;
    });
    const animations = (selector: string) =>
      animate.mock.results.flatMap(({ value }, index) => {
        const target = animate.mock.contexts[index] as HTMLElement;
        if (!target.matches(selector)) return [];
        const [keyframes, options] = animate.mock.calls[index] as [Keyframe[], KeyframeAnimationOptions];
        // happy-dom leaves a cancelled animation's `finished` rejection unhandled; browsers mark it handled.
        (value as Animation).finished.catch(() => {});
        return [{ target, animation: value as Animation, keyframes, duration: options.duration as number, easing: options.easing }];
      });
    return { heights, slides: () => animations('[data-group-rows]'), turns: () => animations('[data-chevron]') };
  }

  it('fits its height to the expanded groups and slides the collapsing rows up into their header', () => {
    const { slides, turns } = motion();
    const { $ } = mount();
    const slot = $('[data-slot="contacts"]');
    expect(slot.style.getPropertyValue('--contacts-window-h')).toBe('555px');
    $(work).click();
    expect(slot.style.getPropertyValue('--contacts-window-h')).toBe('355px');
    expect($(work).getAttribute('aria-expanded')).toBe('false');

    // 0.2 s per 150 pt, for the window's transition and the slide alike.
    const [slide] = slides();
    expect(resizeTime(slot)).toBeCloseTo(0.2667, 4);
    expect(slide.duration).toBeCloseTo(266.67, 2);
    expect(slide.easing).toBe('ease-in-out');
    expect(slide.keyframes).toEqual([{ height: '200px' }, { height: '0px' }]);
    expect(slide.target.inert).toBe(true);
    expect(slide.target.previousElementSibling).toBe($(work));
    expect(slide.target.style.overflow).toBe('hidden');
    // Tailwind's rotate-90 sets `rotate`, so the chevron's turn animates that property: a `transform` would add to it.
    expect(turns()[0].keyframes).toEqual([{ rotate: '90deg' }, { rotate: '0deg' }]);

    slide.animation.finish();
    expect($('[data-group-rows="work"]')).toBeNull();
  });

  it('slides an expanding group’s rows down out of their header, then leaves them as rendered', () => {
    const { heights, slides, turns } = motion();
    const { $ } = mount();
    $(work).click();
    slides()[0].animation.finish();
    $(work).click();
    const slide = slides()[1];
    expect(slide.keyframes).toEqual([{ height: '0px' }, { height: '200px' }]);
    expect(slide.target).toBe($('[data-group-rows="work"]'));
    expect(slide.target.style.overflow).toBe('hidden');
    expect(turns()[1].keyframes).toEqual([{ rotate: '0deg' }, { rotate: '90deg' }]);

    slide.animation.finish();
    expect(slide.target.isConnected).toBe(true);
    expect(slide.target.getAttribute('style')).toBeNull();

    // At rest again, the rows collapse from their full height, whatever the finished slide passed through.
    heights.reached = 126;
    $(work).click();
    expect(slides()[2].keyframes).toEqual([{ height: '200px' }, { height: '0px' }]);
  });

  // The repaint detaches the sliding rows before the next slide starts, so the old slide has to be cancelled through
  // its animation. Left running, it would finish first and strip the styles of the rows sliding again.
  it('continues an interrupted slide from the height it reached, at the pace of the distance left', () => {
    const { heights, slides } = motion();
    const { $ } = mount();
    const slot = $('[data-slot="contacts"]');
    $(work).click();
    slides()[0].animation.finish();

    $(work).click();
    const expanding = slides()[1];
    heights.reached = 126;
    $(work).click();
    const collapsing = slides()[2];
    expect(expanding.animation.playState).toBe('idle');
    expect(collapsing.target).toBe(expanding.target);
    expect(collapsing.keyframes).toEqual([{ height: '126px' }, { height: '0px' }]);
    expect(collapsing.duration).toBeCloseTo(168, 2);
    expect(collapsing.target.style.overflow).toBe('hidden');
    expect(slot.style.getPropertyValue('--contacts-window-h')).toBe('355px');

    heights.reached = 80;
    $(work).click();
    const [, , , again] = slides();
    expect(collapsing.animation.playState).toBe('idle');
    expect(again.keyframes).toEqual([{ height: '80px' }, { height: '200px' }]);
    expect(again.duration).toBeCloseTo(160, 2);
    again.animation.finish();
    expect(again.target.getAttribute('style')).toBeNull();
    expect(document.querySelectorAll('[data-group-rows="work"]')).toHaveLength(1);
  });

  it('starts from the rows in the list when another repaint dropped the sliding ones', () => {
    const { heights, slides } = motion();
    const { $ } = mount();
    $(work).click();
    slides()[0].animation.finish();
    $(work).click();
    heights.reached = 126;
    $('[data-action="select-row"][data-id="jonas"]').click();
    expect(slides()[1].target.isConnected).toBe(false);

    $(work).click();
    expect(slides()[2].keyframes).toEqual([{ height: '200px' }, { height: '0px' }]);
  });

  it('resizes without sliding under reduced motion', () => {
    const { slides, turns } = motion();
    const { $ } = mount({ reducedMotion: true });
    const slot = $('[data-slot="contacts"]');
    $(work).click();
    expect(slot.style.getPropertyValue('--contacts-window-h')).toBe('355px');
    expect($('[data-group-rows="work"]')).toBeNull();
    $(work).click();
    expect(slot.style.getPropertyValue('--contacts-window-h')).toBe('555px');
    expect($('[data-group-rows="work"]').getAttribute('style')).toBeNull();
    expect([...slides(), ...turns()]).toEqual([]);
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

  it('keeps the newest message in view when one is sent', () => {
    const { $, input } = mount({ reducedMotion: true });
    const timeline = $('[data-region="timeline"]');
    Object.defineProperty(timeline, 'scrollHeight', { value: 900 });
    timeline.scrollTop = 0;
    type(input, 'hi');
    press(input, 'Enter');
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
