import { initialState } from './data';
import { createEngine } from './engine';
import { createIntro, introState } from './intro';
import { createAmbient } from './scheduler';
import { createStore } from './store';
import { TAB_BAR_INSET } from './tabs';
import { createTimers } from './timers';
import type { HeroState, HeroWindow } from './types';
import { renderChatHeader, renderTabs, renderTimeline } from './view/chat';
import { renderTitlebar } from './view/chrome';
import { renderContactsList, renderStatusHeader } from './view/contacts';
import { composerView, displayedPresence, totalUnread } from './view/shared';
import { tw } from './view/tw';

const REGIONS: [name: string, render: (state: HeroState) => string][] = [
  ['contacts-titlebar', (s) => renderTitlebar(s, 'contacts')],
  ['status', renderStatusHeader],
  ['contacts-list', renderContactsList],
  ['chat-titlebar', (s) => renderTitlebar(s, 'chat')],
  ['chat-header', renderChatHeader],
  ['timeline', renderTimeline],
  ['tabs', renderTabs],
];

const LONG_PRESS_MS = 500;

interface HintPlacement {
  slot: HTMLElement;
  anchorId: string;
  left: number;
  top: number;
}

export function startHero(hero: HTMLElement) {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const target = initialState(Date.now(), { locale: navigator.language, timeZone });
  const store = createStore(reducedMotion.matches ? target : introState(target));
  const timers = createTimers();
  const engine = createEngine(store, timers);
  const ambient = createAmbient(engine, timers);
  const intro = reducedMotion.matches ? null : createIntro(engine, timers, target, () => ambient.setPaused('intro', false));
  if (intro) ambient.setPaused('intro', true);

  const $ = <T extends HTMLElement>(selector: string) => hero.querySelector<T>(selector)!;
  const frame = $('[data-windows-frame]');
  const dockIcon = $('[data-hero-icon]');
  const dockBadge = $('[data-dock-badge]');
  const deck = $('[data-windows]');
  const input = $<HTMLTextAreaElement>('[data-composer-input]');
  const sendButton = $<HTMLButtonElement>('[data-action="send"]');
  const editBar = $('[data-edit-bar]');
  const editPreview = $('[data-edit-preview]');
  const conversationView = $('[data-view="conversation"]');
  const emptyView = $('[data-view="empty"]');
  const regions = new Map(REGIONS.map(([name]) => [name, $(`[data-region="${name}"]`)]));
  const painted = new Map<string, string>();
  let seenMessages = new Set<string>();
  let hintBubble: HTMLElement | null = null;

  function animate(element: Element | null, className: string) {
    if (!element || reducedMotion.matches) return;
    element.classList.remove(className);
    void (element as HTMLElement).offsetWidth;
    element.classList.add(className);
    element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
  }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
  }

  function syncComposer(state: HeroState) {
    const { draft, editing, canSend } = composerView(state);
    if (input.value !== draft) {
      input.value = draft;
      autosize();
    }
    editBar.hidden = !editing;
    editPreview.textContent = editing?.body ?? '';
    sendButton.disabled = !canSend;
  }

  function highlightSignOns(state: HeroState, previous: HeroState) {
    if (state.ownPresence !== previous.ownPresence) return;
    for (const id of Object.keys(state.contacts)) {
      if (displayedPresence(previous, id) === 'offline' && displayedPresence(state, id) !== 'offline') {
        animate(regions.get('contacts-list')!.querySelector(`[data-id="${id}"]`), 'sign-on');
      }
    }
  }

  function revealNewMessages(state: HeroState, previous: HeroState | null) {
    const timeline = regions.get('timeline')!;
    const ids = new Set([...timeline.querySelectorAll<HTMLElement>('[data-message-id]')].map((row) => row.dataset.messageId!));
    if (previous && previous.activeConversationId === state.activeConversationId) {
      ids.forEach((id) => !seenMessages.has(id) && animate(timeline.querySelector(`[data-message-id="${id}"]`), 'fade-in'));
    }
    seenMessages = ids;
    timeline.scrollTop = timeline.scrollHeight;
  }

  function splash() {
    if (reducedMotion.matches) return;
    const slot = $('[data-slot="chat"]');
    for (let i = 0; i < 14; i++) {
      const duck = document.createElement('span');
      duck.textContent = '🦆';
      duck.className = tw`emoji-drop pointer-events-none absolute top-0 z-50 text-2xl`;
      duck.style.left = `${Math.random() * 90}%`;
      duck.style.animationDelay = `${Math.random() * 0.6}s`;
      duck.addEventListener('animationend', () => duck.remove());
      slot.append(duck);
    }
  }

  function paint(state: HeroState, previous: HeroState | null) {
    for (const [name, render] of REGIONS) {
      const html = render(state);
      if (painted.get(name) === html) continue;
      regions.get(name)!.innerHTML = html;
      painted.set(name, html);
      if (name === 'timeline') revealNewMessages(state, previous);
    }
    if (previous) highlightSignOns(state, previous);
    conversationView.hidden = state.activeConversationId === null;
    emptyView.hidden = state.activeConversationId !== null;
    deck.dataset.front = state.frontWindow;
    syncComposer(state);
    if (previous && state.splash !== previous.splash) splash();
    if (!state.hint) hintBubble?.remove();
    const unread = totalUnread(state);
    dockBadge.textContent = String(unread);
    dockBadge.hidden = unread === 0;
    if (previous && unread > totalUnread(previous)) animate(dockIcon, 'dock-bounce');
    ambient.setPaused('offline', state.ownPresence === 'offline');
  }

  // Measured before the click repaints anything: a repaint can detach the anchor, which then has no slot or position.
  function placeHint(anchor: HTMLElement, slot: HTMLElement): HintPlacement {
    const slotRect = slot.getBoundingClientRect();
    const scale = slotRect.width / slot.offsetWidth;
    const anchorRect = anchor.getBoundingClientRect();
    return {
      slot,
      anchorId: anchor.dataset.hintAnchor!,
      left: Math.min(Math.max((anchorRect.left + anchorRect.width / 2 - slotRect.left) / scale, 80), slot.offsetWidth - 80),
      top: (anchorRect.bottom - slotRect.top) / scale + 6,
    };
  }

  function showHint({ slot, anchorId, left, top }: HintPlacement) {
    hintBubble?.remove();
    hintBubble = document.createElement('div');
    hintBubble.setAttribute('role', 'status');
    hintBubble.className = tw`fade-in pointer-events-none absolute z-50 -translate-x-1/2 rounded-md bg-slate-900/90 px-2 py-1 font-mac text-[11px] whitespace-nowrap text-white shadow-lg`;
    hintBubble.textContent = 'That’s in the real app 🦆';
    hintBubble.style.left = `${left}px`;
    hintBubble.style.top = `${top}px`;
    slot.append(hintBubble);
    engine.showHint(anchorId);
  }

  function send() {
    const id = store.getState().activeConversationId;
    if (id !== null) engine.send(id, input.value);
  }

  function handleAction(target: HTMLElement) {
    const { action, id = '' } = target.dataset;
    const state = store.getState();
    switch (action) {
      case 'select-row':
        return engine.selectRow(id);
      case 'toggle-group':
        return engine.toggleGroup(id);
      case 'status-menu':
        return state.openMenu === 'status' ? engine.closeMenus() : engine.openMenu('status');
      case 'overflow-menu':
        return state.openMenu === 'overflow' ? engine.closeMenus() : engine.openMenu('overflow');
      case 'set-presence':
        return engine.setPresence(target.dataset.presence as HeroState['ownPresence']);
      case 'activate-tab':
        return engine.activateTab(id);
      case 'close-tab':
        return engine.closeTab(id);
      case 'start-edit':
        engine.startEdit(id);
        return input.focus();
      case 'cancel-edit':
        return state.activeConversationId && engine.cancelEdit(state.activeConversationId);
      case 'send':
        return send();
      case 'poke':
        engine.pokeDuck();
        return animate(target.querySelector('[data-avatar]'), 'wiggle');
    }
  }

  let heroClick: Event | undefined;

  // Front-window changes happen on click, not pointerdown: a repaint between the two would replace the pressed element
  // and the click would never reach it.
  hero.addEventListener('click', (event) => {
    heroClick = event;
    const slot = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]');
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-hero-icon]');
    const hint = slot && target?.dataset.action === 'hint' ? placeHint(target, slot) : null;
    if (slot) {
      intro?.skip();
      engine.setFrontWindow(slot.dataset.slot as HeroWindow);
    }
    if (target?.hasAttribute('data-hero-icon')) {
      engine.pokeDuck();
      return animate(target, 'wiggle');
    }
    const action = target?.dataset.action;
    if (!target?.closest('[role="menu"]') && action !== 'status-menu' && action !== 'overflow-menu') engine.closeMenus();
    if (hint) showHint(hint);
    else if (target) handleAction(target);
  });

  // Compared by event rather than by target: by the time the click bubbles here, a repaint may have detached its target.
  document.addEventListener('click', (event) => {
    if (event !== heroClick) engine.closeMenus();
  });

  deck.addEventListener('contextmenu', (event) => {
    const bubble = (event.target as HTMLElement).closest<HTMLElement>('[data-own-bubble]');
    if (!bubble) return;
    event.preventDefault();
    engine.openContextMenu(bubble.dataset.id!);
  });

  let longPress: ReturnType<typeof setTimeout> | undefined;
  deck.addEventListener('pointerdown', (event) => {
    const bubble = (event.target as HTMLElement).closest<HTMLElement>('[data-own-bubble]');
    if (!bubble || event.pointerType !== 'touch') return;
    longPress = setTimeout(() => engine.openContextMenu(bubble.dataset.id!), LONG_PRESS_MS);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointermove'] as const) deck.addEventListener(type, () => clearTimeout(longPress));

  input.addEventListener('input', () => {
    engine.setDraft(input.value);
    autosize();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (event.altKey) {
      input.setRangeText('\n', input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new Event('input'));
    } else {
      send();
    }
  });

  hero.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const state = store.getState();
    engine.closeMenus();
    const id = state.activeConversationId;
    if (id && state.conversations[id].composer.editingMessageId) engine.cancelEdit(id);
  });

  input.addEventListener('focus', () => {
    intro?.skip();
    ambient.setPaused('focus', true);
  });
  input.addEventListener('blur', () => ambient.setPaused('focus', false));
  ambient.setPaused('hidden', document.hidden);
  document.addEventListener('visibilitychange', () => ambient.setPaused('hidden', document.hidden));
  new IntersectionObserver(([entry]) => {
    ambient.setPaused('offscreen', !entry.isIntersecting);
    if (entry.isIntersecting) intro?.start();
  }).observe(deck);

  // The edit bar or a multi-line draft shortens the timeline; keep its newest message in view.
  const timeline = regions.get('timeline')!;
  new ResizeObserver(() => (timeline.scrollTop = timeline.scrollHeight)).observe(timeline);

  const tabs = regions.get('tabs')!;
  new ResizeObserver(() => engine.setTabBarWidth(Math.round(tabs.clientWidth - 2 * TAB_BAR_INSET))).observe(tabs);

  // Side by side, the grid sets the frame's width and height, so both bound the scale. Stacked, the frame's height follows the windows, so only its width does.
  function fit() {
    const widthScale = frame.clientWidth / deck.offsetWidth;
    let scale = Math.min(1, widthScale, frame.clientHeight / deck.offsetHeight);
    if (matchMedia('(width < 64rem)').matches) scale = Math.min(1, widthScale);
    if (matchMedia('(width < 43.75rem)').matches) scale = 1;
    hero.style.setProperty('--hero-scale', String(scale));
  }
  new ResizeObserver(fit).observe(frame);
  addEventListener('resize', fit);
  fit();

  store.subscribe(paint);
  paint(store.getState(), null);
}
