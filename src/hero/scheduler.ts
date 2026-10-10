import { AMBIENT_LINES, AMBIENT_STATUSES, ROOM_LINES } from './data';
import type { Engine } from './engine';
import type { Timers } from './timers';

export type PauseReason = 'focus' | 'hidden' | 'offscreen' | 'offline' | 'intro';

const OWNER = 'ambient';

/** The ambient stream: presence changes, sign-ons, room chatter and background messages. It runs only while no pause reason is active. */
export function createAmbient(engine: Engine, timers: Timers, random = Math.random) {
  const reasons = new Set<PauseReason>();
  let scheduled = false;
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

  function changePresence() {
    const s = engine.state();
    const contact = pick(Object.values(s.contacts).filter((c) => c.id !== s.activeConversationId));
    if (contact.presence === 'offline') {
      engine.updateContact(contact.id, { presence: 'available', status: null });
    } else if (random() < 0.15) {
      engine.updateContact(contact.id, { presence: 'offline', status: null });
    } else {
      const [presence, status] = pick(AMBIENT_STATUSES);
      engine.updateContact(contact.id, { presence, status });
    }
  }

  function roomChatter() {
    const s = engine.state();
    const room = Object.values(s.rooms).find((r) => r.id !== s.activeConversationId);
    if (room) engine.receive(room.id, { sender: pick(room.participants).nickname, body: pick(ROOM_LINES) });
  }

  function backgroundMessage() {
    const s = engine.state();
    const chats = s.openTabs.filter((id) => id !== s.activeConversationId && s.conversations[id].kind === 'chat' && s.contacts[id].presence !== 'offline');
    if (chats.length === 0) return roomChatter();
    const id = pick(chats);
    engine.receive(id, { sender: id, body: pick(AMBIENT_LINES) });
  }

  function runEvent() {
    const roll = random();
    if (roll < 0.5) changePresence();
    else if (roll < 0.75) backgroundMessage();
    else roomChatter();
  }

  function scheduleNext() {
    if (scheduled || reasons.size > 0) return;
    scheduled = true;
    timers.schedule(OWNER, 5000 + random() * 7000, () => {
      scheduled = false;
      runEvent();
      scheduleNext();
    });
  }

  scheduleNext();

  return {
    setPaused(reason: PauseReason, paused: boolean) {
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
