import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOW, initialState } from './data';
import { createEngine } from './engine';
import { createIntro, introState } from './intro';
import { createStore } from './store';
import { createTimers } from './timers';
import type { HeroState } from './types';

function setup() {
  const target = initialState(FIXTURE_NOW);
  const store = createStore(introState(target));
  const timers = createTimers();
  const engine = createEngine(store, timers, { now: () => FIXTURE_NOW });
  const onDone = vi.fn();
  return { target, store, onDone, intro: createIntro(engine, timers, target, onDone) };
}

/** The intro lands on the target state exactly; only the replayed messages' ids are new. */
function expectBuiltUp(state: HeroState, target: HeroState) {
  const withoutIds = (s: HeroState) => ({
    ...s,
    conversations: Object.fromEntries(Object.entries(s.conversations).map(([id, c]) => [id, { ...c, messages: c.messages.map((m) => ({ ...m, id: '' })) }])),
  });
  expect(withoutIds(state)).toEqual(withoutIds(target));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createIntro', () => {
  it('builds up to the full hero', () => {
    const { target, store, onDone, intro } = setup();
    expect(store.getState().conversations.lena.messages).toHaveLength(0);
    intro.start();
    vi.runAllTimers();
    expectBuiltUp(store.getState(), target);
    expect(onDone).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('jumps to the full hero when skipped midway, leaving nothing scheduled', () => {
    const { target, store, onDone, intro } = setup();
    intro.start();
    vi.advanceTimersByTime(2500);
    intro.skip();
    expectBuiltUp(store.getState(), target);
    expect(onDone).toHaveBeenCalledExactlyOnceWith(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
