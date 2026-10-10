import { FIXTURE_NOW, initialState } from './data';
import type { HeroState, Message } from './types';

type Edit = (state: HeroState) => void;

function lastOutgoing(state: HeroState, id = 'lena'): Message {
  return state.conversations[id].messages.findLast((m) => m.direction === 'out')!;
}

function outgoing(id: string, body: string, secondsAgo: number, extra: Partial<Message> = {}): Message {
  return { id, direction: 'out', sender: 'me', body, time: FIXTURE_NOW - secondsAgo * 1000, status: 'read', edited: false, action: false, ...extra };
}

const contactsKey = (s: HeroState): HeroState => Object.assign(s, { frontWindow: 'contacts' as const, selectedRowId: null });

const FIXTURES: Record<string, Edit> = {
  'contacts-key': contactsKey,
  'contacts-inactive': (s) => (s.selectedRowId = null),
  'contacts-selected-key': (s) => (s.frontWindow = 'contacts'),
  'contacts-selected-inactive': () => {},
  'contacts-group-collapsed': (s) => {
    contactsKey(s);
    s.groups.find((g) => g.id === 'work')!.collapsed = true;
  },
  'contacts-status-menu': (s) => Object.assign(contactsKey(s), { openMenu: 'status' }),
  'contacts-status-hover': (s) => Object.assign(contactsKey(s), { forcedHover: { kind: 'status', id: 'own' } }),
  'contacts-status-away': (s) => Object.assign(contactsKey(s), { ownPresence: 'away' }),
  'contacts-status-dnd': (s) => Object.assign(contactsKey(s), { ownPresence: 'dnd' }),
  'contacts-status-offline': (s) => Object.assign(contactsKey(s), { ownPresence: 'offline' }),
  'contacts-room-row': (s) => {
    contactsKey(s);
    s.groups.forEach((g) => (g.collapsed = g.kind === 'contacts'));
  },
  'chat-key': () => {},
  'chat-inactive': (s) => (s.frontWindow = 'contacts'),
  'chat-typing': (s) => (s.conversations.lena.typing = true),
  'chat-delivered': (s) => (lastOutgoing(s).status = 'delivered'),
  'chat-read': (s) => (lastOutgoing(s).status = 'read'),
  'chat-input-filled': (s) => (s.conversations.lena.composer.draft = "Can't wait! 🦆"),
  'chat-tabs': (s) => {
    s.openTabs = ['lena', 'marco', 'pond-club', 'jonas', 'mia', 'priya', 'sofia'];
    s.conversations.jonas.unread = 2;
  },
  'chat-tab-hover': (s) => (s.forcedHover = { kind: 'tab', id: 'marco' }),
  'chat-bubble-hover': (s) => {
    const messages = s.conversations.lena.messages;
    messages.splice(1, 0, { ...messages[0], id: 'lena-1550', body: 'Bring a jacket, it’s windy 🌬️', time: FIXTURE_NOW - 1550_000 });
    s.forcedHover = { kind: 'bubble', id: messages[0].id };
  },
  'chat-me': (s) => s.conversations.lena.messages.push(outgoing('lena-me', '/me waves', 60, { action: true })),
  'chat-edited': (s) => (lastOutgoing(s).edited = true),
  'chat-room': (s) => {
    Object.assign(s, { activeConversationId: 'pond-club', selectedRowId: 'pond-club' });
    s.conversations['pond-club'].unread = 0;
    s.conversations['pond-club'].messages.push(outgoing('pond-me', "I'll bring peas!", 700));
  },
  'chat-empty': (s) => Object.assign(s, { activeConversationId: null, selectedRowId: null, openTabs: [] }),
  'chat-context-menu': (s) => (s.contextMenu = { messageId: lastOutgoing(s).id }),
  'chat-editing': (s) => {
    const message = lastOutgoing(s);
    s.conversations.lena.composer = { draft: message.body, editingMessageId: message.id };
  },
  'chat-offline': (s) => (s.ownPresence = 'offline'),
  'dock-badge': () => {},
};

export const FIXTURE_IDS = Object.keys(FIXTURES);

/** The static hero state each manifest state shows, built by direct edits with no engine timers. */
export function stateFor(id: string): HeroState {
  const edit = FIXTURES[id];
  if (!edit) throw new Error(`No fixture for state ${id}`);
  const state = structuredClone(initialState(FIXTURE_NOW));
  edit(state);
  return state;
}
