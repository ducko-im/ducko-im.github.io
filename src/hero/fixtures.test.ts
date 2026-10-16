import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, type Content, stateFor } from './fixtures';

/** A small stand-in for the ducko repo's `content.json`, with the given entries for manifest states. */
function content(states: Content['states'], overrides: Partial<Content> = {}): Content {
  return {
    version: CONTENT_VERSION,
    presentation: { timeZone: 'UTC', locale: 'en_GB', date: '2026-10-10' },
    contacts: [
      { localpart: 'marco', name: 'Marco Rossi', group: 'Work', show: null, status: null },
      { localpart: 'lena', name: 'Lena Fischer', group: 'Friends', show: null, status: 'Feeding the ducks' },
      { localpart: 'jonas', name: 'Jonas Weber', group: 'Friends', show: 'away', status: null },
    ],
    rooms: [{ key: 'pondclub', name: 'Pond Club', subject: 'Peas, not bread', occupants: [{ nick: 'Lena' }, { nick: 'Marco' }] }],
    conversations: {
      pondclub: { peer: 'pondclub', kind: 'room', messages: [{ id: 'NICK', from: 'Marco', time: '12:00:00', body: '/me waves' }] },
      lena: {
        peer: 'lena',
        kind: 'chat',
        messages: [
          { id: 'EARLY', from: 'me', time: '14:00:00', body: 'Pond at six?', status: 'delivered' },
          { id: 'IN', from: 'peer', time: '14:05:00', body: 'Are you in?' },
          { id: 'OUT', from: 'me', time: '14:07:00', body: 'See you there', status: 'delivered', editedSecondsAgo: 120 },
        ],
      },
      // Another key with the same peer: a state's tab names a variant, not a contact.
      'lena-short': { peer: 'lena', kind: 'chat', messages: [{ id: 'SHORT', from: 'peer', time: '09:00:00', body: 'Morning' }] },
      marco: { peer: 'marco', kind: 'chat', messages: [{ id: 'REVIEW', from: 'peer', time: '13:00:00', body: 'In code review' }] },
    },
    states,
    ...overrides,
  };
}

describe('stateFor', () => {
  it('gives an empty entry the capture tool’s defaults', () => {
    const state = stateFor('chat-key', content({ 'chat-key': {} }), 500);
    expect(state).toMatchObject({ frontWindow: 'chat', ownPresence: 'available', openTabs: ['lena'], activeConversationId: 'lena', tabBarWidth: 476 });
    expect(state.conversations.lena.messages.map((m) => [m.direction, m.body, m.status])).toEqual([
      ['out', 'Pond at six?', 'delivered'],
      ['in', 'Are you in?', 'sent'],
      ['out', 'See you there', 'delivered'],
    ]);
    expect(state.conversations.marco.messages).toEqual([]);
    expect(state.contacts).toMatchObject({
      jonas: { name: 'Jonas Weber', presence: 'away', status: null },
      lena: { presence: 'available', status: 'Feeding the ducks', avatar: { emoji: '🦊' } },
    });
    expect(state).toMatchObject({ openMenu: null, contextMenu: null, forcedHover: null, selectedRowId: null });
    expect(state.groups.map((g) => g.id)).toEqual(['friends', 'work']);
  });

  it('maps a message’s sender, time, edit and action', () => {
    const state = stateFor('chat-room', content({ 'chat-room': { tabs: ['pondclub', 'lena'], rooms: ['pondclub'] } }), 500);
    expect(state.conversations.pondclub).toMatchObject({ kind: 'room', messages: [{ sender: 'Marco', action: true, time: Date.UTC(2026, 9, 10, 12) }] });
    expect(state.conversations.lena.messages.map((m) => [m.sender, m.edited, m.editedSecondsAgo])).toEqual([
      ['me', false, undefined],
      ['lena', false, undefined],
      ['me', true, 120],
    ]);
    expect(state.format.locale).toBe('en-GB');
  });

  it('keeps the rooms a state names, in a Rooms group after the contacts', () => {
    const state = stateFor('contacts-room-row', content({ 'contacts-room-row': { rooms: ['pondclub'], unread: { pondclub: 2 } } }), 500);
    expect(state.groups.at(-1)).toMatchObject({ kind: 'rooms', memberIds: ['pondclub'] });
    expect(state.rooms.pondclub).toMatchObject({ name: 'Pond Club', subject: 'Peas, not bread', participants: [{ nickname: 'Lena' }, { nickname: 'Marco' }] });
    expect(state.conversations.pondclub.unread).toBe(2);
    expect(state.frontWindow).toBe('contacts');
  });

  it.each<[string, Content['states'][string], Partial<ReturnType<typeof stateFor>>]>([
    ['contacts-inactive', { key: 'chat' }, { frontWindow: 'chat' }],
    ['contacts-status-offline', { ownStatus: 'offline' }, { ownPresence: 'offline' }],
    ['contacts-selected-key', { selectedContact: 'lena' }, { selectedRowId: 'lena' }],
    ['contacts-status-menu', { menu: 'status' }, { openMenu: 'status', contextMenu: null }],
    ['contacts-status-hover', { hover: { statusPicker: true } }, { forcedHover: { kind: 'status', id: 'own' } }],
    ['chat-context-menu', { menu: { message: 'OUT' } }, { openMenu: null, contextMenu: { messageId: 'OUT' } }],
    ['chat-tab-hover', { tabs: ['lena', 'marco'], hover: { tab: 'marco' } }, { forcedHover: { kind: 'tab', id: 'marco' } }],
    ['chat-bubble-hover', { tabs: ['lena-short'], hover: { message: 'SHORT' } }, { openTabs: ['lena'], forcedHover: { kind: 'bubble', id: 'SHORT' } }],
    ['contacts-lights-hover', { hover: { trafficLights: true } }, { forcedHover: { kind: 'lights', id: 'contacts' } }],
    ['chat-text-selected-key', { select: { message: 'IN', range: [4, 7] } }, { forcedSelection: { messageId: 'IN', start: 4, end: 7 } }],
    ['chat-empty', { closeAllTabs: true }, { openTabs: [], activeConversationId: null }],
    ['chat-tabs', { tabs: ['lena', 'marco'] }, { openTabs: ['lena', 'marco'], tabBarWidth: 576 }],
  ])('maps the fields of %s', (id, entry, expected) => {
    expect(stateFor(id, content({ [id]: entry }), 600)).toMatchObject(expected);
  });

  it('marks who is typing and the last outgoing message’s delivery', () => {
    const state = stateFor('chat-read', content({ 'chat-read': { typing: ['marco'], lastOutgoingStatus: 'read' } }), 500);
    expect(state.conversations.marco.typing).toBe(true);
    expect(state.conversations.lena.typing).toBe(false);
    expect(state.conversations.lena.messages.filter((m) => m.direction === 'out').map((m) => m.status)).toEqual(['delivered', 'read']);
  });

  it('orders the roster as Ducko does: groups and their members by name', () => {
    const { groups } = stateFor('contacts-group-collapsed', content({ 'contacts-group-collapsed': { collapsedGroups: ['Work'] } }), 500);
    expect(groups.map((g) => [g.name, g.memberIds, g.collapsed])).toEqual([
      ['Friends', ['jonas', 'lena'], false],
      ['Work', ['marco'], true],
    ]);
  });

  it('gives the draft to the first tab only, and an edit takes its message’s text over the draft', () => {
    const filled = stateFor('chat-input-filled', content({ 'chat-input-filled': { tabs: ['lena', 'marco'], input: 'On my way' } }), 500);
    expect(filled.conversations.lena.composer.draft).toBe('On my way');
    expect(filled.conversations.marco.composer.draft).toBe('');
    const editing = stateFor('chat-editing', content({ 'chat-editing': { input: 'On my way', editing: 'OUT' } }), 500);
    expect(editing.conversations.lena.composer).toEqual({ draft: 'See you there', editingMessageId: 'OUT' });
  });

  it('refuses a Dock state that names no key window', () => {
    expect(() => stateFor('dock-badge', content({ 'dock-badge': {} }), 500)).toThrow('names no key window');
  });

  it.each([
    ['a state without an entry', {}, {}, 'no state entry for chat-key'],
    ['an unknown conversation', { 'chat-key': { tabs: ['noah'] } }, {}, 'unknown conversation noah'],
    ['an unknown group', { 'chat-key': { collapsedGroups: ['Family'] } }, {}, 'unknown group Family'],
    ['an unknown message', { 'chat-key': { editing: 'GONE' } }, {}, 'unknown message GONE'],
    ['another contract version', { 'chat-key': {} }, { version: CONTENT_VERSION + 1 }, 'not the supported version'],
    ['a time zone other than UTC', { 'chat-key': {} }, { presentation: { timeZone: 'Europe/Berlin', locale: 'en_GB', date: '2026-10-10' } }, 'is not UTC'],
  ])('names %s instead of building a wrong state', (_, states, overrides, error) => {
    expect(() => stateFor('chat-key', content(states, overrides), 500)).toThrow(error);
  });
});
