import { AMBIENT_STATUSES } from './data';
import type { Engine } from './engine';
import { STORY, type StoryStep } from './script';
import type { Timers } from './timers';

export type PauseReason = 'draft' | 'hidden' | 'offscreen' | 'offline' | 'intro';

const OWNER = 'ambient';

/**
 * The ambient stream: the storyline once, then only now and then a presence change. Plans the visitor mentioned are
 * passed on first. It runs only while no pause reason is active.
 */
export function createAmbient(engine: Engine, timers: Timers, random = Math.random) {
  const reasons = new Set<PauseReason>();
  let scheduled = false;
  let next = 0;
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

  /**
   * Plays a step, which says nothing once its conversation has signed off or while its contact is offline. While the
   * conversation is busy with the visitor, it returns false and the step waits for the next event.
   */
  function play(step: StoryStep): boolean {
    const id = 'say' in step ? step.say : step.presence;
    if (engine.isBusy(id)) return false;
    if ('say' in step) {
      engine.tell(id);
    } else {
      const [presence, status] = step.to;
      engine.updateContact(id, { presence, status });
      if (step.announce) engine.announce(id);
    }
    return true;
  }

  function changePresence() {
    const s = engine.state();
    const contacts = Object.values(s.contacts).filter((c) => c.id !== s.activeConversationId && !engine.isSignedOff(c.id) && !engine.isBusy(c.id));
    if (contacts.length === 0) return;
    const contact = pick(contacts);
    if (contact.presence === 'offline') {
      engine.updateContact(contact.id, { presence: 'available', status: null });
    } else if (random() < 0.15) {
      engine.updateContact(contact.id, { presence: 'offline', status: null });
    } else {
      const [presence, status] = pick(AMBIENT_STATUSES);
      engine.updateContact(contact.id, { presence, status });
    }
  }

  function runEvent() {
    if (engine.relayHook()) return;
    if (next === STORY.length) changePresence();
    else if (play(STORY[next])) next += 1;
  }

  function scheduleNext() {
    if (scheduled || reasons.size > 0) return;
    scheduled = true;
    const delay = next === STORY.length ? 15_000 + random() * 15_000 : 5000 + random() * 7000;
    timers.schedule(OWNER, delay, () => {
      scheduled = false;
      runEvent();
      scheduleNext();
    });
  }

  scheduleNext();

  return {
    setPaused(reason: PauseReason, paused: boolean) {
      if (paused === reasons.has(reason)) return;
      if (paused) {
        reasons.add(reason);
        timers.cancelOwner(OWNER);
        scheduled = false;
      } else {
        reasons.delete(reason);
        scheduleNext();
      }
    },
  };
}
