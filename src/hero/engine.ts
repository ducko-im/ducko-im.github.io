import { isAction, parseOutgoing } from './commands';
import { EMPTY_COMPOSER, newMessageId } from './data';
import { type Offer, type Situation, createReplyBook } from './replies';
import type { Store } from './store';
import type { Timers } from './timers';
import type { Contact, Conversation, HeroState, HeroWindow, Message, MessageStatus, Presence } from './types';

const STATUS_RANK: Record<MessageStatus, number> = { sent: 0, delivered: 1, read: 2 };
const SITUATIONS: Record<Exclude<Presence, 'offline'>, Situation> = { available: 'available', away: 'away', xa: 'away', dnd: 'dnd' };
const POKES_FOR_DUCK_MODE = 7;

function patchConversation(state: HeroState, id: string, fn: (conversation: Conversation) => Conversation): HeroState {
  return { ...state, conversations: { ...state.conversations, [id]: fn(state.conversations[id]) } };
}

/** As in Ducko, the visitor sees a conversation only while it is the active one in an open, key chat window. */
function isInView(state: HeroState, id: string): boolean {
  return state.chatWindowOpen && state.frontWindow === 'chat' && state.activeConversationId === id;
}

function markSeen(state: HeroState): HeroState {
  const id = state.activeConversationId;
  if (id === null || !isInView(state, id) || state.conversations[id].unread === 0) return state;
  return patchConversation(state, id, (c) => ({ ...c, unread: 0 }));
}

/** Switches the chat window's conversation and, unless `quietly`, brings the window forward. */
function activate(state: HeroState, id: string | null, { quietly = false } = {}): HeroState {
  return markSeen({ ...state, activeConversationId: id, contextMenu: null, frontWindow: quietly ? state.frontWindow : 'chat' });
}

function withChatTab(state: HeroState, id: string): HeroState {
  return { ...state, openTabs: state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id], chatWindowOpen: true };
}

/** As in Ducko, a contact's message gives its chat a tab, shown only when no other is, and opens a closed chat window behind the key one. */
function openQuietly(state: HeroState, id: string): HeroState {
  const next = withChatTab(state, id);
  return next.activeConversationId === null ? activate(next, id, { quietly: true }) : next;
}

export interface EngineOptions {
  random?: () => number;
  now?: () => number;
}

/**
 * Owns every change to the live hero. Messages enter a conversation only through `send`, `receive` and the intro's
 * `replay`, and the active conversation changes only through `activate`, so that bookkeeping lives in one place.
 */
export function createEngine(store: Store<HeroState>, timers: Timers, { random = Math.random, now = Date.now }: EngineOptions = {}) {
  const { getState, update } = store;
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + random() * (max - min);
  const book = createReplyBook(voice);
  let pokes = 0;

  function newMessage(direction: Message['direction'], sender: string, body: string, action: boolean, time = now()): Message {
    return { id: newMessageId(), direction, sender, body, time, status: 'sent', edited: false, action };
  }

  /** `time` is for the intro, which replays seeded messages at their seeded times. */
  function receive(conversationId: string, { sender, body, time }: Pick<Message, 'sender' | 'body'> & Partial<Pick<Message, 'time'>>) {
    const message = newMessage('in', sender, body, isAction(body), time);
    update((s) => {
      const opened = s.conversations[conversationId].kind === 'chat' ? openQuietly(s, conversationId) : s;
      return patchConversation(opened, conversationId, (c) => ({
        ...c,
        messages: [...c.messages, message],
        unread: isInView(opened, conversationId) ? c.unread : c.unread + 1,
      }));
    });
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

  /** Who says a line that names no sender: the contact, or someone in the room. */
  function voice(conversationId: string): string {
    const s = getState();
    return s.conversations[conversationId].kind === 'room' ? pick(s.rooms[conversationId].participants).nickname : conversationId;
  }

  /** A signed-off contact stays offline for the rest of the visit. */
  function updateContact(id: string, patch: Partial<Pick<Contact, 'presence' | 'status'>>) {
    if (book.isSignedOff(id) && patch.presence !== 'offline') return;
    update((s) => {
      const contact = { ...s.contacts[id], ...patch };
      // A contact who comes online has no last-seen time to show the next time they go offline.
      if (contact.presence !== 'offline') contact.lastSeen = null;
      return { ...s, contacts: { ...s.contacts, [id]: contact } };
    });
  }

  function situationOf(conversationId: string, arriving: boolean): Situation {
    const s = getState();
    if (arriving) return 'arriving';
    if (s.conversations[conversationId].kind === 'room') return 'available';
    const { presence } = s.contacts[conversationId];
    return presence === 'offline' ? 'available' : SITUATIONS[presence];
  }

  /** Answers the visitor's messages as they read now, edits included. */
  function commitReply(conversationId: string, arriving: boolean) {
    const conversation = getState().conversations[conversationId];
    const { messageIds, egg } = conversation.pendingReply!;
    const text = conversation.messages
      .filter((m) => messageIds.includes(m.id))
      .map((m) => m.body)
      .join('\n');
    book.hear(conversationId, text);
    const reply = book.reply(conversationId, text, situationOf(conversationId, arriving), egg);
    update((state) => patchConversation(state, conversationId, (c) => ({ ...c, typing: false, pendingReply: null })));
    if (reply.arrives) updateContact(conversationId, { presence: 'available', status: null });
    receive(conversationId, reply);
    // Not the conversation's own timer, which a message sent right after the sign-off would cancel.
    if (reply.signsOff && conversation.kind === 'chat')
      timers.schedule('presence', 1500, () => updateContact(conversationId, { presence: 'offline', status: null }));
  }

  /** Delivered, then read once the contact gets to it, then typing and one reply. */
  function replyLifecycle(conversationId: string, arriving: boolean) {
    const presence = getState().contacts[conversationId].presence;
    const readAt = presence === 'available' ? 1500 : between(5000, 9000);
    timers.schedule(conversationId, 600, () => advanceOutgoing(conversationId, 'delivered'));
    timers.schedule(conversationId, readAt, () => advanceOutgoing(conversationId, 'read'));
    timers.schedule(conversationId, readAt + 500, () => setTyping(conversationId, true));
    timers.schedule(conversationId, readAt + 500 + between(1500, 3000), () => commitReply(conversationId, arriving));
  }

  /**
   * The reply owed for the visitor's latest messages, timed by the contact's presence. Away and Do Not Disturb read late.
   * An offline contact signs on first, leaving the messages undelivered until then. A conversation that signed off never
   * answers. Rooms skip the receipts and typing and get only the reply.
   */
  function scheduleLifecycle(conversationId: string) {
    timers.cancelOwner(conversationId);
    if (book.isSignedOff(conversationId)) return;
    const s = getState();
    if (s.conversations[conversationId].kind === 'room') {
      timers.schedule(conversationId, between(1500, 3000), () => commitReply(conversationId, false));
    } else if (s.contacts[conversationId].presence === 'offline') {
      timers.schedule(conversationId, between(10_000, 20_000), () => {
        updateContact(conversationId, { presence: 'available', status: null });
        replyLifecycle(conversationId, true);
      });
    } else {
      replyLifecycle(conversationId, false);
    }
  }

  /**
   * Whether the conversation is busy with the visitor (a reply owed, even one held while the visitor is offline) or
   * typing, so anything it would bring up on its own waits.
   */
  function isBusy(conversationId: string): boolean {
    const { pendingReply, typing } = getState().conversations[conversationId];
    return pendingReply !== null || typing;
  }

  /** Whether the conversation can bring something up now: it hasn't signed off, isn't busy, and is a room or an online contact. */
  function canSpeak(conversationId: string): boolean {
    const s = getState();
    if (book.isSignedOff(conversationId) || isBusy(conversationId)) return false;
    return s.conversations[conversationId].kind === 'room' || s.contacts[conversationId].presence !== 'offline';
  }

  /**
   * Says an offered line after typing, as a reply has; a room skips the typing. The line is claimed only on delivery, so
   * one cancelled by the visitor's message or going offline is offered again later.
   */
  function speak(conversationId: string, offer: Offer | null) {
    if (!offer) return;
    const deliver = () => {
      if (offer.take()) receive(conversationId, offer.said);
    };
    if (getState().conversations[conversationId].kind === 'room') return deliver();
    setTyping(conversationId, true);
    timers.schedule(conversationId, 1500, () => {
      setTyping(conversationId, false);
      deliver();
    });
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
    updateContact,
    isBusy,
    isSignedOff: book.isSignedOff,

    /** Says the conversation's next storyline beat, if it can speak and has one left. */
    tell(conversationId: string) {
      if (canSpeak(conversationId)) speak(conversationId, book.beat(conversationId));
    },

    /** Says the contact's `arrive` line, if it can speak and hasn't said it yet. */
    announce(conversationId: string) {
      if (canSpeak(conversationId)) speak(conversationId, book.arrival(conversationId));
    },

    /** Passes a plan the visitor mentioned to another conversation that can speak. Returns whether one was passed on. */
    relayHook(): boolean {
      const offer = book.relay(canSpeak);
      if (offer) speak(offer.conversationId, offer);
      return offer !== null;
    },

    selectRow(id: string | null) {
      update((s) => (s.selectedRowId === id ? s : { ...s, selectedRowId: id }));
    },

    /**
     * Moves the selection one row down or up across the expanded groups, stopping at the ends, as the arrow keys do in
     * Ducko's table. With no visible row selected, it starts at the first or last row.
     */
    selectAdjacentRow(step: 1 | -1) {
      update((s) => {
        const rows = s.groups.flatMap((group) => (group.collapsed ? [] : group.memberIds));
        const index = s.selectedRowId === null ? -1 : rows.indexOf(s.selectedRowId);
        let next: string | undefined;
        if (index === -1) next = rows.at(step === 1 ? 0 : -1);
        else next = rows[Math.min(Math.max(index + step, 0), rows.length - 1)];
        return next === undefined || next === s.selectedRowId ? s : { ...s, selectedRowId: next };
      });
    },

    openChat(id: string) {
      update((s) => activate({ ...withChatTab(s, id), selectedRowId: id }, id));
    },

    activateTab(id: string) {
      update((s) => activate({ ...s, openMenu: null }, id));
    },

    closeTab(id: string) {
      const { openTabs, activeConversationId } = getState();
      const index = openTabs.indexOf(id);
      if (index === -1) return;
      abortConversation(id);
      const remaining = openTabs.filter((tab) => tab !== id);
      update((s) => {
        const next = patchConversation({ ...s, openTabs: remaining }, id, (c) => ({ ...c, composer: EMPTY_COMPOSER, pendingReply: null }));
        return activeConversationId === id ? activate(next, remaining[index] ?? remaining[index - 1] ?? null) : next;
      });
    },

    /** Keeps the tabs, as Ducko does, and leaves the Contacts window key. */
    closeChatWindow() {
      update((s) => ({ ...s, chatWindowOpen: false, frontWindow: 'contacts' }));
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
      const owesReply = !book.isSignedOff(conversationId);
      update((state) => ({
        ...patchConversation(state, conversationId, (c) => ({
          ...c,
          messages: [...c.messages, message],
          composer: EMPTY_COMPOSER,
          pendingReply: owesReply ? { messageIds: [...(c.pendingReply?.messageIds ?? []), message.id], egg } : null,
        })),
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
      // A closed chat window can't become key.
      update((s) => (s.frontWindow === frontWindow || (frontWindow === 'chat' && !s.chatWindowOpen) ? s : markSeen({ ...s, frontWindow })));
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
  };
}

export type Engine = ReturnType<typeof createEngine>;
