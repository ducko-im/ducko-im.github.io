// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { FIXTURE_NOW, initialState } from '../data';
import type { HeroState, MessageStatus } from '../types';
import { renderChatHeader, renderChatWindow, renderComposer, renderTabs, renderTimeline } from './chat';
import { renderContactsList } from './contacts';
import { escapeHtml } from './escape';
import { formatTime } from './format';

function state(edit: (state: HeroState) => void = () => {}): HeroState {
  const s = structuredClone(initialState(FIXTURE_NOW));
  edit(s);
  return s;
}

function dom(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

describe('escapeHtml', () => {
  it('neutralizes markup, attribute breakouts and ampersands', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml('" onmouseover="x')).toBe('&quot; onmouseover=&quot;x');
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });
});

describe('formatTime', () => {
  it('formats in the given time zone', () => {
    expect(formatTime(FIXTURE_NOW, { locale: 'en-GB', timeZone: 'UTC' })).toBe('14:30');
    expect(formatTime(FIXTURE_NOW, { locale: 'en-GB', timeZone: 'Europe/Berlin' })).toBe('16:30');
  });
});

describe('renderContactsList', () => {
  it('drops a collapsed group’s rows and keeps its count', () => {
    const html = renderContactsList(state((s) => (s.groups[1].collapsed = true)));
    expect(html).not.toContain('data-id="priya"');
    expect(html).toContain('4 of 5');
  });

  it('labels a single unread in the singular', () => {
    const doc = dom(renderContactsList(state((s) => (s.conversations['pond-club'].unread = 1))));
    expect(doc.querySelector('[data-id="pond-club"] [role="img"]')!.getAttribute('aria-label')).toBe('1 unread message');
  });

  it('shows every contact offline while the visitor is offline', () => {
    const doc = dom(renderContactsList(state((s) => (s.ownPresence = 'offline'))));
    const presences = new Set([...doc.querySelectorAll('[data-action="select-row"] [data-presence]')].map((dot) => dot.getAttribute('data-presence')));
    expect([...presences]).toEqual(['offline']);
  });
});

describe('renderTimeline', () => {
  function lastMark(status: MessageStatus): number {
    const html = renderTimeline(state((s) => (s.conversations.lena.messages.at(-1)!.status = status)));
    return dom(html).querySelectorAll(`[data-message-id="lena-1375"] [data-delivery="${status}"] svg`).length;
  }

  it('escapes typed bodies, including /me actions', () => {
    for (const body of ['<img src=x onerror=alert(1)>', '/me <img src=x onerror=alert(1)>']) {
      const doc = dom(renderTimeline(state((s) => Object.assign(s.conversations.lena.messages.at(-1)!, { body, action: body.startsWith('/me ') }))));
      expect(doc.querySelector('img')).toBeNull();
      expect(doc.querySelector('[data-message-id="lena-1375"]')!.textContent).toContain('<img src=x onerror=alert(1)>');
    }
  });

  it('renders /me as an italic action with the sender’s name', () => {
    const doc = dom(renderTimeline(state((s) => Object.assign(s.conversations.lena.messages.at(-1)!, { body: '/me waves', action: true }))));
    const row = doc.querySelector('[data-message-id="lena-1375"]')!;
    expect(row.querySelector('em')?.textContent).toBe('* Tobias waves');
  });

  it('labels the day separator with a date and each message with a time', () => {
    const doc = dom(renderTimeline(state()));
    expect(doc.body.textContent).toContain('10 Oct 2026');
    expect(doc.querySelector('[data-message-id="lena-1375"]')!.textContent).toContain('14:07');
  });

  it('renders two checks for read and one for delivered', () => {
    expect(lastMark('read')).toBe(2);
    expect(lastMark('delivered')).toBe(1);
  });
});

describe('renderTabs', () => {
  function lenaSlot(edit: (state: HeroState) => void): Element {
    return dom(renderTabs(state(edit))).querySelector('[data-tab="lena"]')!;
  }

  it('shows unread over typing over the presence dot', () => {
    expect(lenaSlot(() => {}).querySelector('[data-presence]')).not.toBeNull();
    expect(lenaSlot((s) => (s.conversations.lena.typing = true)).querySelector('[data-typing]')).not.toBeNull();
    const both = lenaSlot((s) => Object.assign(s.conversations.lena, { typing: true, unread: 2 }));
    expect(both.querySelector('[data-unread]')?.textContent).toBe('2');
    expect(both.querySelector('[data-typing]')).toBeNull();
  });

  it('never nests a button inside a button', () => {
    expect(dom(renderTabs(state())).querySelectorAll('button button')).toHaveLength(0);
  });

  it('draws a forced hover tab with its close button showing', () => {
    const close = lenaSlot((s) => (s.forcedHover = { kind: 'tab', id: 'lena' })).querySelector('[data-action="close-tab"]')!;
    expect(close.classList.contains('grid')).toBe(true);
    expect(close.classList.contains('hidden')).toBe(false);
  });

  it('keeps the active tab visible when the rest overflow', () => {
    const tabs = ['lena', 'marco', 'pond-club', 'jonas', 'mia', 'priya'];
    const doc = dom(renderTabs(state((s) => Object.assign(s, { openTabs: tabs, activeConversationId: 'priya', tabBarWidth: 300, openMenu: 'overflow' }))));
    const visible = [...doc.querySelectorAll('[data-tab]')].map((tab) => tab.getAttribute('data-tab'));
    const overflow = [...doc.querySelectorAll('[role="menu"] [data-action="activate-tab"]')].map((item) => item.getAttribute('data-id'));
    expect(visible).toContain('priya');
    expect([...visible, ...overflow].sort()).toEqual([...tabs].sort());
    expect(overflow).not.toContain('priya');
  });
});

describe('renderComposer', () => {
  function composer(draft: string, editingMessageId: string | null = null): Document {
    return dom(renderComposer(state((s) => (s.conversations.lena.composer = { draft, editingMessageId }))));
  }

  it('escapes the draft and enables sending only for a non-blank draft', () => {
    expect(composer('<b>"hi"</b>').querySelector('textarea')!.value).toBe('<b>"hi"</b>');
    expect(composer('').querySelector('[data-action="send"]')!.hasAttribute('disabled')).toBe(true);
    expect(composer(' \n ').querySelector('[data-action="send"]')!.hasAttribute('disabled')).toBe(true);
    expect(composer('hi').querySelector('[data-action="send"]')!.hasAttribute('disabled')).toBe(false);
  });

  it('enables sending while offline', () => {
    const offline = state((s) => {
      s.ownPresence = 'offline';
      s.conversations.lena.composer.draft = 'hi';
    });
    const doc = dom(renderComposer(offline));
    expect(doc.querySelector('[data-action="send"]')!.hasAttribute('disabled')).toBe(false);
  });

  it('shows the edit bar only while editing', () => {
    expect(composer('hi').querySelector('[data-edit-bar]')!.hasAttribute('hidden')).toBe(true);
    expect(composer('See you there', 'lena-1375').querySelector('[data-edit-bar]')!.hasAttribute('hidden')).toBe(false);
  });
});

describe('renderChatHeader', () => {
  it('shows a room’s participant count while the visitor is in the room, whatever the status, and not offline', () => {
    const room = (edit: (s: HeroState) => void = () => {}) =>
      renderChatHeader(
        state((s) => {
          s.activeConversationId = 'pond-club';
          edit(s);
        }),
      );
    expect(room()).toContain('4 participants');
    expect(room((s) => (s.ownPresence = 'away'))).toContain('4 participants');
    expect(room((s) => (s.ownPresence = 'offline'))).not.toContain('4 participants');
  });

  it('adds the offline strip while offline', () => {
    expect(renderChatHeader(state((s) => (s.ownPresence = 'offline')))).toContain("You're offline — messages will send when you reconnect.");
    expect(renderChatHeader(state())).not.toContain("You're offline");
  });
});

describe('renderChatWindow', () => {
  it('shows the empty state when no conversation is active', () => {
    const doc = dom(renderChatWindow(state((s) => Object.assign(s, { activeConversationId: null, openTabs: [] }))));
    expect(doc.querySelector('[data-view="empty"]')!.hasAttribute('hidden')).toBe(false);
    expect(doc.querySelector('[data-view="conversation"]')!.hasAttribute('hidden')).toBe(true);
  });
});
