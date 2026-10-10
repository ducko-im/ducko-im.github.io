import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOW, ROOM_LINES, initialState } from './data';
import { createEngine } from './engine';
import { createAmbient } from './scheduler';
import { createStore } from './store';
import { createTimers } from './timers';

/** Plays the given random values in order, then repeats the last one. */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function setup(random = () => 0.5) {
  const store = createStore(initialState(FIXTURE_NOW));
  const timers = createTimers();
  const engine = createEngine(store, timers, { random: () => 0.5, now: () => FIXTURE_NOW });
  const ambient = createAmbient(engine, timers, random);
  return {
    state: store.getState,
    engine,
    ambient,
    marcoUnread: () => store.getState().conversations.marco.unread,
    last: (id: string) => store.getState().conversations[id].messages.at(-1)!,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createAmbient', () => {
  it('fires events while nothing pauses it', () => {
    const { marcoUnread } = setup();
    vi.advanceTimersByTime(8500);
    expect(marcoUnread()).toBe(1);
  });

  it('stays quiet while the input has focus, without stalling a reply', () => {
    const { engine, ambient, marcoUnread, last } = setup();
    ambient.setPaused('focus', true);
    engine.send('lena', 'hi');
    vi.advanceTimersByTime(60_000);
    expect(marcoUnread()).toBe(0);
    expect(last('lena').direction).toBe('in');
  });

  it('resumes only once every pause reason has cleared', () => {
    const { ambient, marcoUnread } = setup();
    ambient.setPaused('focus', true);
    ambient.setPaused('hidden', true);
    ambient.setPaused('focus', false);
    vi.advanceTimersByTime(60_000);
    expect(marcoUnread()).toBe(0);
    ambient.setPaused('hidden', false);
    vi.advanceTimersByTime(8500);
    expect(marcoUnread()).toBe(1);
  });

  // Each event reads: its delay, the event roll, then the event's own picks.
  it('changes a contact other than the open chat’s', () => {
    const { state } = setup(sequence(0, 0.1, 0, 0.5, 0));
    vi.advanceTimersByTime(5000);
    expect(state().contacts.lena).toEqual(initialState(FIXTURE_NOW).contacts.lena);
    expect(state().contacts.jonas).toMatchObject({ presence: 'available', status: null });
  });

  it('signs an offline contact on', () => {
    const { state } = setup(sequence(0, 0.1, 0.3));
    vi.advanceTimersByTime(5000);
    expect(state().contacts.noah.presence).toBe('available');
  });

  it('posts room chatter from a participant, but not into the open room', () => {
    const background = setup(sequence(0, 0.9, 0, 0));
    vi.advanceTimersByTime(5000);
    expect(background.last('pond-club')).toMatchObject({ sender: 'Greta', body: ROOM_LINES[0] });

    const open = setup(sequence(0, 0.9, 0, 0));
    open.engine.selectRow('pond-club');
    const count = open.state().conversations['pond-club'].messages.length;
    vi.advanceTimersByTime(5000);
    expect(open.state().conversations['pond-club'].messages).toHaveLength(count);
  });
});
