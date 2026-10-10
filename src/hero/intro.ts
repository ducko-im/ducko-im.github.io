import type { Engine } from './engine';
import type { Timers } from './timers';
import type { HeroState } from './types';

const OWNER = 'intro';
/** The conversations that fill in: the open chat and the room whose unread badge counts up. The rest keep their history. */
const BUILT_UP = ['lena', 'pond-club'];

/** Where the intro starts from: the visitor offline, the roster gray, and the visible conversations empty. */
export function introState(state: HeroState): HeroState {
  const contacts = Object.fromEntries(Object.entries(state.contacts).map(([id, c]) => [id, { ...c, presence: 'offline' as const, status: null }]));
  const conversations = { ...state.conversations };
  for (const id of BUILT_UP) conversations[id] = { ...conversations[id], messages: [], unread: 0 };
  return { ...state, ownPresence: 'offline', contacts, conversations };
}

/**
 * Plays the hero from `introState` up to `target`: the visitor comes online, contacts sign on one by one, and the
 * conversations fill in. `skip` jumps to the end, so an early click in a window or focus on the input lands on the finished state.
 */
export function createIntro(engine: Engine, timers: Timers, target: HeroState, onDone: () => void) {
  const steps: [at: number, run: () => void][] = [[300, () => engine.setPresence(target.ownPresence)]];
  let started = false;
  let next = 0;

  Object.values(target.contacts)
    .filter((c) => c.presence !== 'offline')
    .forEach((c, index) => steps.push([500 + index * 120, () => engine.updateContact(c.id, { presence: c.presence, status: c.status })]));

  let at = 1400;
  for (const message of target.conversations.lena.messages) {
    if (message.direction === 'in') {
      steps.push([at, () => engine.setTyping('lena', true)]);
      steps.push([
        at + 700,
        () => {
          engine.setTyping('lena', false);
          engine.receive('lena', message);
        },
      ]);
      at += 1300;
    } else {
      let id = '';
      steps.push([
        at,
        () => {
          id = engine.replay('lena', message);
        },
      ]);
      steps.push([at + 300, () => engine.advanceStatus('lena', id, 'delivered')]);
      steps.push([at + 600, () => engine.advanceStatus('lena', id, message.status)]);
      at += 900;
    }
  }
  target.conversations['pond-club'].messages.forEach((message, index) => steps.push([1800 + index * 1400, () => engine.receive('pond-club', message)]));
  steps.sort((a, b) => a[0] - b[0]);

  function run() {
    steps[next][1]();
    next += 1;
    if (next === steps.length) onDone();
  }

  return {
    start() {
      if (started || next === steps.length) return;
      started = true;
      steps.forEach(([delay]) => timers.schedule(OWNER, delay, run));
    },
    skip() {
      if (next === steps.length) return;
      timers.cancelOwner(OWNER);
      while (next < steps.length) run();
    },
  };
}
