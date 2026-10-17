import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOW, initialState } from './data';
import { createEngine } from './engine';
import { createAmbient } from './scheduler';
import { PERSONAS, STORY } from './script';
import { createStore } from './store';
import { createTimers } from './timers';

/** Plays the given random values in turn, over and over. */
function cycle(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
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
    roomCount: () => store.getState().conversations['pond-club'].messages.length,
    last: (id: string) => store.getState().conversations[id].messages.at(-1)!,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createAmbient', () => {
  const [firstRoomSender, firstRoomBeat] = PERSONAS['pond-club'].beats[0];

  it('plays the storyline in order, into chats without a tab too', () => {
    const { state, last } = setup();
    vi.advanceTimersByTime(8500);
    expect(last('pond-club')).toMatchObject({ sender: firstRoomSender, body: firstRoomBeat });
    vi.advanceTimersByTime(8500);
    expect(state().conversations.jonas.typing).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(last('jonas')).toMatchObject({ sender: 'jonas', body: PERSONAS.jonas.beats[0] });
    expect(state().conversations.jonas.unread).toBe(1);
  });

  it('stays quiet while the visitor drafts a message, without stalling a reply', () => {
    const { engine, ambient, roomCount, last } = setup();
    ambient.setPaused('draft', true);
    const count = roomCount();
    engine.send('lena', 'hi');
    vi.advanceTimersByTime(60_000);
    expect(roomCount()).toBe(count);
    expect(last('lena').direction).toBe('in');
  });

  it('resumes only once every pause reason has cleared', () => {
    const { ambient, roomCount } = setup();
    const count = roomCount();
    ambient.setPaused('draft', true);
    ambient.setPaused('hidden', true);
    ambient.setPaused('draft', false);
    vi.advanceTimersByTime(60_000);
    expect(roomCount()).toBe(count);
    ambient.setPaused('hidden', false);
    vi.advanceTimersByTime(8500);
    expect(roomCount()).toBe(count + 1);
  });

  it('holds a step while its conversation answers the visitor', () => {
    const { engine, last, roomCount } = setup();
    const count = roomCount();
    vi.advanceTimersByTime(8000);
    engine.send('pond-club', 'anyone there?');
    vi.advanceTimersByTime(2250);
    expect(roomCount()).toBe(count + 2);
    vi.advanceTimersByTime(8500);
    expect(last('pond-club')).toMatchObject({ sender: firstRoomSender, body: firstRoomBeat });
  });

  it('passes on a plan the visitor mentioned before the story goes on', () => {
    const { engine, last, roomCount } = setup();
    const count = roomCount();
    engine.send('lena', "I'll bring cake");
    vi.advanceTimersByTime(10_000);
    expect(last('jonas')).toMatchObject({ sender: 'jonas', body: "Heard you're bringing cake? Legend 🙌" });
    expect(roomCount()).toBe(count);
  });

  it('after the story only changes presence, and leaves signed-off contacts alone', () => {
    const { engine, state } = setup(cycle(0, 0.3, 0.6, 0.9, 0.1, 0.45, 0.75, 0.2, 0.99, 0.5));
    engine.openChat('marco');
    engine.send('marco', 'bye');
    vi.advanceTimersByTime(STORY.length * 12_000 + 2000);
    const transcript = JSON.stringify(Object.values(state().conversations).map((c) => c.messages));
    engine.openChat('lena');
    for (let i = 0; i < 40; i++) {
      vi.advanceTimersByTime(30_000);
      expect(state().contacts.marco.presence).toBe('offline');
    }
    expect(JSON.stringify(Object.values(state().conversations).map((c) => c.messages))).toBe(transcript);
    const initial = initialState(FIXTURE_NOW).contacts;
    expect(Object.values(state().contacts).some((c) => c.presence !== initial[c.id].presence)).toBe(true);
  });
});
