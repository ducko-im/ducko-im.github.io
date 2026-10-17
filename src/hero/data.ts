import { TAB_BAR_INSET } from './tabs';
import type { Avatar, Composer, Contact, Conversation, Group, HeroState, Message, Participant, Presence, Room } from './types';

export const ME = { name: 'Tobias', avatar: { emoji: '🦆', gradient: ['rgb(255 219 89)', 'rgb(255 184 51)'] } satisfies Avatar };

export const DUCK_AVATAR: Avatar = ME.avatar;

export const EMPTY_COMPOSER: Composer = { draft: '', editingMessageId: null };

export const WINDOW_SIZES = { contacts: { width: 200 }, chat: { width: 500, height: 450 } };

export const DESKTOP_TAB_BAR_WIDTH = WINDOW_SIZES.chat.width - 2 * TAB_BAR_INSET;

/** A fixed moment to build a state at, so its seeded message times are stable. */
export const FIXTURE_NOW = Date.UTC(2026, 9, 10, 14, 30, 0);

export const PRESENCE_LABELS: Record<Presence, string> = {
  available: 'Available',
  away: 'Away',
  xa: 'Extended Away',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

function contact<Id extends string>(
  id: Id,
  name: string,
  presence: Presence,
  status: string | null,
  avatar: Avatar,
  lastSeen: string | null = null,
): Contact & { id: Id } {
  return { id, name, presence, status, lastSeen, avatar };
}

const CONTACTS = [
  contact('lena', 'Lena Fischer', 'available', 'Feeding the ducks', { emoji: '🦊', gradient: ['rgb(252 204 158)', 'rgb(250 158 107)'] }),
  contact('jonas', 'Jonas Silva', 'away', 'At the gym', { emoji: '🐼', gradient: ['rgb(189 230 204)', 'rgb(120 199 163)'] }),
  contact('noah', 'Noah Kim', 'offline', null, {}, '2 hours ago'),
  contact('priya', 'Priya Nair', 'dnd', 'Deep work until 3', { emoji: '🦉', gradient: ['rgb(204 199 247)', 'rgb(148 140 230)'] }),
  contact('marco', 'Marco Rossi', 'available', 'In code review', { emoji: '🐻', gradient: ['rgb(184 219 252)', 'rgb(107 173 242)'] }),
];

const PARTICIPANTS: Participant[] = [
  { nickname: 'Amara', color: { light: '#e32f00', dark: '#ff7166' } },
  { nickname: 'Kai', color: { light: '#8752ff', dark: '#a78bff' } },
  { nickname: 'Mateo', color: { light: '#e000a2', dark: '#ff63c3' } },
];

const ROOMS = [{ id: 'pond-club', name: 'Pond Club', subject: 'Peas, not bread 🫛', participants: PARTICIPANTS }] as const satisfies readonly Room[];

export type ContactId = (typeof CONTACTS)[number]['id'];
export type ConversationId = ContactId | (typeof ROOMS)[number]['id'];

const GROUPS = [
  { id: 'friends', name: 'Friends', kind: 'contacts', memberIds: ['jonas', 'lena', 'noah'], collapsed: false },
  { id: 'work', name: 'Work', kind: 'contacts', memberIds: ['marco', 'priya'], collapsed: false },
  { id: 'rooms', name: 'Rooms', kind: 'rooms', memberIds: ['pond-club'], collapsed: false },
] satisfies (Group & { memberIds: ConversationId[] })[];

type Seed = [direction: 'in' | 'out', secondsAgo: number, body: string, sender?: string];

const SEEDS: Partial<Record<ConversationId, Seed[]>> = {
  lena: [
    ['in', 1580, 'Meeting at the pond at six. Are you in? 🦆'],
    ['out', 1488, "Sounds good! I'll bring coffee ☕️"],
    ['in', 1452, 'Perfect. Jonas is bringing snacks.'],
    ['out', 1375, 'See you there!'],
  ],
  jonas: [
    ['in', 5400, 'Spotting you at the pond later? 🏋️'],
    ['out', 5300, 'Only if you carry the snacks.'],
  ],
  priya: [['out', 3600, 'Ping me when you surface 🙂']],
  marco: [['in', 2400, 'Your PR looks great. One nit about duck typing 🦆']],
  'pond-club': [
    ['in', 900, "Who's bringing bread?", 'Amara'],
    ['in', 840, 'Not bread! Peas are better for ducks 🫛', 'Kai'],
    ['in', 780, 'Oats work too.', 'Mateo'],
  ],
};

export const AMBIENT_STATUSES: [Presence, string | null][] = [
  ['available', null],
  ['available', 'Feeding the ducks'],
  ['available', 'Coffee break ☕️'],
  ['away', 'Lunch 🥪'],
  ['away', null],
  ['xa', 'Walking the dog'],
  ['dnd', 'In a meeting'],
];

let nextMessageId = 0;

export function newMessageId(): string {
  nextMessageId += 1;
  return `m${nextMessageId}`;
}

function seedMessages(id: ConversationId, now: number): Message[] {
  return (SEEDS[id] ?? []).map(([direction, secondsAgo, body, sender]) => ({
    id: `${id}-${secondsAgo}`,
    direction,
    sender: direction === 'out' ? 'me' : (sender ?? id),
    body,
    time: now - secondsAgo * 1000,
    status: direction === 'out' ? 'read' : 'sent',
    edited: false,
    action: false,
  }));
}

function conversation(id: ConversationId, kind: Conversation['kind'], now: number, unread = 0): Conversation {
  return { id, kind, messages: seedMessages(id, now), unread, typing: false, composer: { ...EMPTY_COMPOSER }, pendingReply: null };
}

export function initialState(now = Date.now(), format: HeroState['format'] = { locale: 'en-GB', timeZone: 'UTC' }): HeroState {
  const conversations: Record<string, Conversation> = {};
  for (const { id } of CONTACTS) conversations[id] = conversation(id, 'chat', now);
  for (const { id } of ROOMS) conversations[id] = conversation(id, 'room', now, 3);
  return {
    ownPresence: 'available',
    contacts: Object.fromEntries(CONTACTS.map((c) => [c.id, c])),
    groups: GROUPS,
    rooms: Object.fromEntries(ROOMS.map((r) => [r.id, r])),
    conversations,
    openTabs: ['lena', 'marco', 'pond-club'] satisfies ConversationId[],
    activeConversationId: 'lena' satisfies ConversationId,
    tabBarWidth: DESKTOP_TAB_BAR_WIDTH,
    selectedRowId: 'lena' satisfies ConversationId,
    chatWindowOpen: true,
    frontWindow: 'chat',
    openMenu: null,
    contextMenu: null,
    hint: null,
    duckMode: false,
    splash: 0,
    forcedHover: null,
    forcedSelection: null,
    format,
  };
}
