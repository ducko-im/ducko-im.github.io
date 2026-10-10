import { isAction, parseOutgoing } from './commands';
import { EGG_REPLIES, EMPTY_COMPOSER, REPLIES, ROOM_LINES, newMessageId } from './data';
import type { Store } from './store';
import type { Timers } from './timers';
import type { Contact, Conversation, HeroState, HeroWindow, Message, MessageStatus, Presence } from './types';

const STATUS_RANK: Record<MessageStatus, number> = { sent: 0, delivered: 1, read: 2 };
const POKES_FOR_DUCK_MODE = 7;

function patchConversation(state: HeroState, id: string, fn: (conversation: Conversation) => Conversation): HeroState {
  return { ...state, conversations: { ...state.conversations, [id]: fn(state.conversations[id]) } };
}

export interface EngineOptions {
  random?: () => number;
  now?: () => number;
}

/**
 * Owns every change to the live hero. Messages enter a conversation only through `send`, `receive` and the intro's
 * `replay`, and the active conversation changes only through `activate`, so every path gets the same bookkeeping.
 */
export function createEngine(store: Store<HeroState>, timers: Timers, { random = Math.random, now = Date.now }: EngineOptions = {}) {
  const { getState, update } = store;
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + random() * (max - min);
  let pokes = 0;

  function activate(id: string | null) {
    update((s) => {
      const next: HeroState = { ...s, activeConversationId: id, selectedRowId: id, frontWindow: 'chat', contextMenu: null };
      return id === null ? next : patchConversation(next, id, (c) => ({ ...c, unread: 0 }));
    });
  }

  function newMessage(direction: Message['direction'], sender: string, body: string, action: boolean, time = now()): Message {
    return { id: newMessageId(), direction, sender, body, time, status: 'sent', edited: false, action };
  }

  /** `time` is for the intro, which replays seeded messages at their seeded times. */
  function receive(conversationId: string, { sender, body, time }: Pick<Message, 'sender' | 'body'> & Partial<Pick<Message, 'time'>>) {
    const message = newMessage('in', sender, body, isAction(body), time);
    update((s) =>
      patchConversation(s, conversationId, (c) => ({
        ...c,
        messages: [...c.messages, message],
        unread: s.activeConversationId === conversationId ? c.unread : c.unread + 1,
      })),
    );
  }

  /** The intro's own lines: an outgoing message with no lifecycle, whose status the intro advances itself. */
  function replay(conversationId: string, { body, time }: Pick<Message, 'body' | 'time'>): string {
    const message = newMessage('out', 'me', body, false, time);
    update((s) => patchConversation(s, conversationId, (c) => ({ ...c, messages: [...c.messages, message] })));
    return message.id;
  }

  /** Moves the matching messages forward to `status`, never back, in one update. Leaves the state untouched when none moves. */
  function advanceMessages(conversationId: string, status: MessageStatus, matches: (message: Message) => boolean) {
    update((s) => {
      const { messages } = s.conversations[conversationId];
      const advanced = messages.map((m) => (matches(m) && STATUS_RANK[status] > STATUS_RANK[m.status] ? { ...m, status } : m));
      return advanced.every((m, index) => m === messages[index]) ? s : patchConversation(s, conversationId, (c) => ({ ...c, messages: advanced }));
    });
  }

  function advanceStatus(conversationId: string, messageId: string, status: MessageStatus) {
    advanceMessages(conversationId, status, (m) => m.id === messageId);
  }

  function advanceOutgoing(conversationId: string, status: MessageStatus) {
    advanceMessages(conversationId, status, (m) => m.direction === 'out');
  }

  function setTyping(conversationId: string, typing: boolean) {
    update((s) => (s.conversations[conversationId].typing === typing ? s : patchConversation(s, conversationId, (c) => ({ ...c, typing }))));
  }

  function commitReply(conversationId: string) {
    const s = getState();
    const conversation = s.conversations[conversationId];
    const egg = conversation.pendingReply?.egg;
    update((state) => patchConversation(state, conversationId, (c) => ({ ...c, typing: false, pendingReply: null })));
    if (conversation.kind === 'room') {
      receive(conversationId, { sender: pick(s.rooms[conversationId].participants).nickname, body: pick(egg ? EGG_REPLIES : ROOM_LINES) });
    } else {
      receive(conversationId, { sender: conversationId, body: pick(egg ? EGG_REPLIES : REPLIES[conversationId]) });
    }
  }

  /** Delivered and read for every outgoing message not yet read, then typing and one reply. Rooms skip the receipts and typing and get only the reply. */
  function scheduleLifecycle(conversationId: string) {
    timers.cancelOwner(conversationId);
    if (getState().conversations[conversationId].kind === 'room') {
      timers.schedule(conversationId, between(1500, 3000), () => commitReply(conversationId));
      return;
    }
    timers.schedule(conversationId, 600, () => advanceOutgoing(conversationId, 'delivered'));
    timers.schedule(conversationId, 1500, () => advanceOutgoing(conversationId, 'read'));
    timers.schedule(conversationId, 2000, () => setTyping(conversationId, true));
    timers.schedule(conversationId, 2000 + between(1500, 3000), () => commitReply(conversationId));
  }

  /** Stops a conversation's lifecycle where it stands: messages keep their status and typing stops. `pendingReply` stays, so `resumePending` can restart it. */
  function abortConversation(conversationId: string) {
    timers.cancelOwner(conversationId);
    setTyping(conversationId, false);
  }

  function resumePending() {
    for (const conversation of Object.values(getState().conversations)) {
      if (conversation.pendingReply) scheduleLifecycle(conversation.id);
    }
  }

  return {
    state: getState,
    receive,
    replay,
    advanceStatus,
    setTyping,

    selectRow(id: string) {
      update((s) => (s.openTabs.includes(id) ? s : { ...s, openTabs: [...s.openTabs, id] }));
      activate(id);
    },

    activateTab(id: string) {
      update((s) => ({ ...s, openMenu: null }));
      activate(id);
    },

    closeTab(id: string) {
      const { openTabs, activeConversationId } = getState();
      const index = openTabs.indexOf(id);
      if (index === -1) return;
      abortConversation(id);
      const remaining = openTabs.filter((tab) => tab !== id);
      update((s) => patchConversation({ ...s, openTabs: remaining }, id, (c) => ({ ...c, composer: EMPTY_COMPOSER, pendingReply: null })));
      if (activeConversationId === id) activate(remaining[index] ?? remaining[index - 1] ?? null);
    },

    send(conversationId: string, text: string) {
      const s = getState();
      if (text.trim() === '' || s.activeConversationId === null) return;
      const { kind, body, egg } = parseOutgoing(text);
      const editingId = s.conversations[conversationId].composer.editingMessageId;
      if (editingId) {
        update((state) =>
          patchConversation(state, conversationId, (c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === editingId ? { ...m, body, edited: true, action: kind === 'me' } : m)),
            composer: EMPTY_COMPOSER,
          })),
        );
        return;
      }
      const message = newMessage('out', 'me', body, kind === 'me');
      update((state) => ({
        ...patchConversation(state, conversationId, (c) => ({ ...c, messages: [...c.messages, message], composer: EMPTY_COMPOSER, pendingReply: { egg } })),
        splash: egg ? state.splash + 1 : state.splash,
      }));
      if (s.ownPresence !== 'offline') scheduleLifecycle(conversationId);
    },

    setPresence(presence: Presence) {
      const previous = getState().ownPresence;
      update((s) => ({ ...s, ownPresence: presence, openMenu: null }));
      if (presence === 'offline') {
        Object.keys(getState().conversations).forEach(abortConversation);
      } else if (previous === 'offline') {
        resumePending();
      }
    },

    setDraft(draft: string) {
      update((s) =>
        s.activeConversationId === null ? s : patchConversation(s, s.activeConversationId, (c) => ({ ...c, composer: { ...c.composer, draft } })),
      );
    },

    startEdit(messageId: string) {
      update((s) => {
        const id = s.activeConversationId;
        const message = id === null ? undefined : s.conversations[id].messages.find((m) => m.id === messageId);
        if (id === null || message?.direction !== 'out') return s;
        return { ...patchConversation(s, id, (c) => ({ ...c, composer: { draft: message.body, editingMessageId: messageId } })), contextMenu: null };
      });
    },

    cancelEdit(conversationId: string) {
      update((s) => patchConversation(s, conversationId, (c) => ({ ...c, composer: EMPTY_COMPOSER })));
    },

    openMenu(kind: 'status' | 'overflow') {
      update((s) => ({ ...s, openMenu: kind, contextMenu: null }));
    },

    closeMenus() {
      update((s) => (s.openMenu === null && s.contextMenu === null ? s : { ...s, openMenu: null, contextMenu: null }));
    },

    openContextMenu(messageId: string) {
      update((s) => {
        const own =
          s.activeConversationId !== null && s.conversations[s.activeConversationId].messages.some((m) => m.id === messageId && m.direction === 'out');
        return own ? { ...s, contextMenu: { messageId }, openMenu: null } : s;
      });
    },

    setFrontWindow(frontWindow: HeroWindow) {
      update((s) => (s.frontWindow === frontWindow ? s : { ...s, frontWindow }));
    },

    toggleGroup(id: string) {
      update((s) => ({ ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)) }));
    },

    showHint(anchorId: string) {
      update((s) => ({ ...s, hint: { anchorId }, openMenu: null, contextMenu: null }));
      timers.cancelOwner('hint');
      timers.schedule('hint', 2500, () => update((s) => ({ ...s, hint: null })));
    },

    pokeDuck() {
      pokes += 1;
      timers.cancelOwner('poke');
      timers.schedule('poke', 1000, () => (pokes = 0));
      if (pokes < POKES_FOR_DUCK_MODE) return;
      pokes = 0;
      update((s) => ({ ...s, duckMode: true }));
      timers.cancelOwner('duck');
      timers.schedule('duck', 4000, () => update((s) => ({ ...s, duckMode: false })));
    },

    setTabBarWidth(tabBarWidth: number) {
      update((s) => (s.tabBarWidth === tabBarWidth ? s : { ...s, tabBarWidth }));
    },

    updateContact(id: string, patch: Partial<Pick<Contact, 'presence' | 'status'>>) {
      update((s) => ({ ...s, contacts: { ...s.contacts, [id]: { ...s.contacts[id], ...patch } } }));
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
