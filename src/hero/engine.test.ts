import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EGG_REPLIES, FIXTURE_NOW, ROOM_LINES, initialState } from './data';
import { createEngine } from './engine';
import { createStore } from './store';
import { createTimers } from './timers';

function setup() {
  const store = createStore(initialState(FIXTURE_NOW));
  const engine = createEngine(store, createTimers(), { random: () => 0.5, now: () => FIXTURE_NOW });
  const state = () => store.getState();
  const last = (id: string) => state().conversations[id].messages.at(-1)!;
  return { store, engine, state, last };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('send', () => {
  it('runs delivered, read, typing, then the reply', () => {
    const { engine, state, last } = setup();
    engine.send('lena', 'hi');
    const sent = last('lena');
    expect(sent).toMatchObject({ direction: 'out', body: 'hi', status: 'sent' });
    vi.advanceTimersByTime(600);
    expect(last('lena').status).toBe('delivered');
    vi.advanceTimersByTime(900);
    expect(last('lena').status).toBe('read');
    vi.advanceTimersByTime(500);
    expect(state().conversations.lena.typing).toBe(true);
    vi.advanceTimersByTime(2250);
    expect(last('lena')).toMatchObject({ direction: 'in', sender: 'lena' });
    expect(state().conversations.lena.typing).toBe(false);
  });

  it('advances every outgoing message in one update and never moves a read one back', () => {
    const { store, engine, state } = setup();
    engine.send('lena', 'hi');
    engine.send('lena', 'there');
    const updates = vi.fn();
    store.subscribe(updates);
    vi.advanceTimersByTime(600);
    expect(updates).toHaveBeenCalledOnce();
    const statuses = state()
      .conversations.lena.messages.filter((m) => m.direction === 'out')
      .map((m) => m.status);
    expect(statuses).toEqual(['read', 'read', 'delivered', 'delivered']);
  });

  it('leaves the state alone when a status would not move', () => {
    const { store, engine } = setup();
    const before = store.getState();
    engine.advanceStatus('lena', 'lena-1375', 'delivered');
    expect(store.getState()).toBe(before);
  });

  it('gives a room message no receipts and a reply from a participant', () => {
    const { engine, state, last } = setup();
    engine.selectRow('pond-club');
    engine.send('pond-club', 'peas?');
    vi.runAllTimers();
    const messages = state().conversations['pond-club'].messages;
    expect(messages.at(-2)).toMatchObject({ direction: 'out', body: 'peas?', status: 'sent' });
    expect(state().rooms['pond-club'].participants.map((p) => p.nickname)).toContain(last('pond-club').sender);
    expect(ROOM_LINES).toContain(last('pond-club').body);
  });

  it('sends /me as an action, and an edit can turn a message into one', () => {
    const { engine, state, last } = setup();
    engine.send('lena', '/me waves');
    expect(last('lena')).toMatchObject({ body: '/me waves', action: true });
    engine.startEdit('lena-1375');
    engine.send('lena', '/me nods');
    expect(state().conversations.lena.messages.find((m) => m.id === 'lena-1375')).toMatchObject({ body: '/me nods', action: true, edited: true });
  });

  it('answers a duck word with a splash and an egg reply', () => {
    const { engine, state, last } = setup();
    engine.send('lena', 'quack');
    expect(state().splash).toBe(1);
    vi.runAllTimers();
    expect(EGG_REPLIES).toContain(last('lena').body);
  });

  it('ignores a blank message', () => {
    const { engine, state } = setup();
    engine.send('lena', '  \n ');
    expect(state().conversations.lena.messages).toHaveLength(4);
  });
});

describe('receive', () => {
  it('counts unread for every inactive conversation, open tab or not, and never for the active one', () => {
    const { engine, state } = setup();
    engine.closeTab('pond-club');
    engine.receive('marco', { sender: 'marco', body: 'ping' });
    engine.receive('pond-club', { sender: 'Kai', body: 'hey' });
    engine.receive('lena', { sender: 'lena', body: 'hi' });
    expect(state().conversations.marco.unread).toBe(1);
    expect(state().conversations['pond-club'].unread).toBe(4);
    expect(state().conversations.lena.unread).toBe(0);
    expect(state().openTabs).not.toContain('pond-club');
  });
});

describe('selectRow and activateTab', () => {
  it('opens one tab for a new conversation and brings the chat window forward', () => {
    const { engine, state } = setup();
    engine.setFrontWindow('contacts');
    engine.selectRow('jonas');
    engine.selectRow('jonas');
    expect(state().openTabs).toEqual(['lena', 'marco', 'pond-club', 'jonas']);
    expect(state()).toMatchObject({ activeConversationId: 'jonas', selectedRowId: 'jonas', frontWindow: 'chat' });
  });

  it('closes the overflow menu when a tab is picked from it', () => {
    const { engine, state } = setup();
    engine.openMenu('overflow');
    engine.activateTab('marco');
    expect(state()).toMatchObject({ openMenu: null, activeConversationId: 'marco' });
  });
});

describe('closeTab', () => {
  it('drops the pending reply and activates the right neighbor', () => {
    const { engine, state, last } = setup();
    engine.send('lena', 'hi');
    vi.advanceTimersByTime(2100);
    engine.closeTab('lena');
    vi.runAllTimers();
    expect(last('lena').direction).toBe('out');
    expect(state().conversations.lena.typing).toBe(false);
    expect(state().activeConversationId).toBe('marco');
  });

  it('falls back to the left neighbor when closing the rightmost tab', () => {
    const { engine, state } = setup();
    engine.activateTab('pond-club');
    engine.closeTab('pond-club');
    expect(state().activeConversationId).toBe('marco');
  });

  it('clears the neighbor’s unread and selects its row', () => {
    const { engine, state } = setup();
    engine.receive('marco', { sender: 'marco', body: 'ping' });
    engine.closeTab('lena');
    expect(state().conversations.marco.unread).toBe(0);
    expect(state().selectedRowId).toBe('marco');
  });

  it('leaves another conversation’s edit and the active conversation alone when closing a background tab', () => {
    const { engine, state } = setup();
    engine.startEdit('lena-1375');
    engine.closeTab('marco');
    expect(state().activeConversationId).toBe('lena');
    expect(state().conversations.lena.composer).toEqual({ draft: 'See you there!', editingMessageId: 'lena-1375' });
  });

  it('shows the empty state after the last tab and ignores sends', () => {
    const { engine, state } = setup();
    ['lena', 'marco', 'pond-club'].forEach((id) => engine.closeTab(id));
    expect(state().activeConversationId).toBeNull();
    engine.send('lena', 'hi');
    expect(state().conversations.lena.messages).toHaveLength(4);
  });
});

describe('offline', () => {
  it('changes the state once when going offline with nothing in flight', () => {
    const { store, engine } = setup();
    const updates = vi.fn();
    store.subscribe(updates);
    engine.setPresence('offline');
    expect(updates).toHaveBeenCalledOnce();
  });

  it('appends no reply when going offline mid-flight', () => {
    const { engine, last } = setup();
    engine.send('lena', 'hi');
    vi.advanceTimersByTime(800);
    engine.setPresence('offline');
    vi.runAllTimers();
    expect(last('lena')).toMatchObject({ direction: 'out', status: 'delivered' });
  });

  it('holds a message sent offline and resumes it on reconnect', () => {
    const { engine, last } = setup();
    engine.setPresence('offline');
    engine.send('lena', 'hi');
    expect(last('lena').status).toBe('sent');
    expect(vi.getTimerCount()).toBe(0);
    engine.setPresence('available');
    vi.advanceTimersByTime(600);
    expect(last('lena').status).toBe('delivered');
    vi.advanceTimersByTime(900);
    expect(last('lena').status).toBe('read');
    vi.runAllTimers();
    expect(last('lena').direction).toBe('in');
  });

  it('works with no active conversation, and the next one sends normally', () => {
    const { engine, last } = setup();
    ['lena', 'marco', 'pond-club'].forEach((id) => engine.closeTab(id));
    engine.setPresence('offline');
    engine.setPresence('available');
    engine.selectRow('jonas');
    engine.send('jonas', 'hi');
    vi.runAllTimers();
    expect(last('jonas')).toMatchObject({ direction: 'in', sender: 'jonas' });
  });

  it('keeps pending replies through away, extended away and do not disturb', () => {
    const { engine, state, last } = setup();
    engine.send('lena', 'hi');
    engine.setPresence('away');
    engine.setPresence('xa');
    engine.setPresence('dnd');
    expect(state().ownPresence).toBe('dnd');
    vi.runAllTimers();
    expect(last('lena').direction).toBe('in');
  });
});

describe('edit', () => {
  it('replaces the body and schedules nothing', () => {
    const { engine, state, last } = setup();
    engine.startEdit('lena-1375');
    engine.send('lena', 'See you at six!');
    expect(last('lena')).toMatchObject({ id: 'lena-1375', body: 'See you at six!', edited: true });
    expect(state().conversations.lena.messages).toHaveLength(4);
    expect(state().conversations.lena.composer).toEqual({ draft: '', editingMessageId: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps an edit to its own conversation across tab switches', () => {
    const { engine, state, last } = setup();
    engine.startEdit('lena-1375');
    engine.activateTab('marco');
    expect(state().conversations.marco.composer).toEqual({ draft: '', editingMessageId: null });
    engine.send('marco', 'yo');
    expect(last('marco')).toMatchObject({ direction: 'out', body: 'yo', edited: false });
    expect(last('lena')).toMatchObject({ body: 'See you there!', edited: false });
    engine.activateTab('lena');
    expect(state().conversations.lena.composer).toEqual({ draft: 'See you there!', editingMessageId: 'lena-1375' });
  });

  it('keeps a draft across tab switches', () => {
    const { engine, state } = setup();
    engine.setDraft('hel');
    engine.activateTab('marco');
    engine.activateTab('lena');
    expect(state().conversations.lena.composer.draft).toBe('hel');
  });

  it('lets a pending reply arrive after cancelling an edit', () => {
    const { engine, last } = setup();
    engine.send('lena', 'hi');
    engine.startEdit(last('lena').id);
    engine.cancelEdit('lena');
    vi.runAllTimers();
    expect(last('lena').direction).toBe('in');
  });

  it('resets the composer of a closed conversation', () => {
    const { engine, state } = setup();
    engine.startEdit('lena-1375');
    engine.closeTab('lena');
    expect(state().conversations.lena.composer).toEqual({ draft: '', editingMessageId: null });
  });
});

describe('hints and the duck', () => {
  it('clears a hint on its own', () => {
    const { engine, state } = setup();
    engine.showHint('info');
    expect(state().hint).toEqual({ anchorId: 'info' });
    vi.advanceTimersByTime(2500);
    expect(state().hint).toBeNull();
  });

  it('turns on duck mode at the seventh quick poke, not before', () => {
    const { engine, state } = setup();
    for (let i = 0; i < 6; i++) engine.pokeDuck();
    expect(state().duckMode).toBe(false);
    engine.pokeDuck();
    expect(state().duckMode).toBe(true);
  });
});
