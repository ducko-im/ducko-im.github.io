import manifest from '../../reference/states.json';
import { isAction } from './commands';
import { EMPTY_COMPOSER, FIXTURE_NOW, initialState } from './data';
import { TAB_BAR_INSET } from './tabs';
import type { Contact, Conversation, Group, HeroState, Message, MessageStatus, Participant, Presence, Room } from './types';

/** The `content.json` contract version these fixtures read. */
export const CONTENT_VERSION = 1;

interface ContentMessage {
  id: string;
  /** `me`, `peer`, or a room occupant's nick. */
  from: string;
  time: string;
  body: string;
  status?: MessageStatus;
  editedSecondsAgo?: number;
}

interface ContentConversation {
  peer: string;
  kind: 'chat' | 'room';
  messages: ContentMessage[];
}

interface ContentState {
  key?: string;
  tabs?: string[];
  overflow?: boolean;
  lastOutgoingStatus?: MessageStatus | null;
  closeAllTabs?: boolean;
  rooms?: string[];
  unread?: Record<string, number>;
  collapsedGroups?: string[];
  selectedContact?: string | null;
  ownStatus?: Presence;
  typing?: string[];
  input?: string | null;
  editing?: string | null;
  hover?: { statusPicker?: boolean; tab?: string; message?: string } | null;
  menu?: 'status' | { message: string } | null;
}

/** The ducko repo's demo content: what every reference state shows. */
export interface Content {
  version: number;
  presentation: { timeZone: string; locale: string; date: string };
  contacts: { localpart: string; name: string; group: string; show: Exclude<Presence, 'available'> | null; status: string | null }[];
  rooms: { key: string; name: string; subject: string | null; occupants: { nick: string }[] }[];
  conversations: Record<string, ContentConversation>;
  states: Record<string, ContentState>;
}

/** What a state field means when its entry leaves it out, as in the capture tool's `DEFAULTS`. */
const DEFAULTS: Required<Omit<ContentState, 'key'>> = {
  tabs: ['lena'],
  overflow: false,
  lastOutgoingStatus: null,
  closeAllTabs: false,
  rooms: [],
  unread: {},
  collapsedGroups: [],
  selectedContact: null,
  ownStatus: 'available',
  typing: [],
  input: null,
  editing: null,
  hover: null,
  menu: null,
};

/**
 * Ducko's `Color.forNickname` for the content's room occupants (XEP-0392 hue, HSLuv saturation 100, lightness 50 in
 * light and 65 in dark), computed once by running Ducko's `ConsistentColorHue` and `HSLuvColor`. Ducko's HSLuv
 * conversion yields no chroma, so every nick comes out gray, as the captures show.
 */
const OCCUPANT_COLORS: Record<string, Participant['color']> = {
  Lena: { light: '#777777', dark: '#9e9e9e' },
  Marco: { light: '#777777', dark: '#9e9e9e' },
  Priya: { light: '#777777', dark: '#9e9e9e' },
};

function resolve<T>(value: T | undefined, reference: string): T {
  if (value === undefined) throw new Error(`content.json references unknown ${reference}`);
  return value;
}

function emptyConversation(id: string, kind: Conversation['kind']): Conversation {
  return { id, kind, messages: [], unread: 0, typing: false, composer: { ...EMPTY_COMPOSER }, pendingReply: null };
}

function message(content: Content, conversation: ContentConversation, m: ContentMessage): Message {
  const outgoing = m.from === 'me';
  return {
    id: m.id,
    direction: outgoing ? 'out' : 'in',
    sender: outgoing ? 'me' : m.from === 'peer' ? conversation.peer : m.from,
    body: m.body,
    time: Date.parse(`${content.presentation.date}T${m.time}Z`),
    status: outgoing ? (m.status ?? 'sent') : 'sent',
    edited: m.editedSecondsAgo !== undefined,
    editedSecondsAgo: m.editedSecondsAgo,
    action: isAction(m.body),
  };
}

function room(content: Content, key: string): Room {
  const { name, subject, occupants } = resolve(
    content.rooms.find((r) => r.key === key),
    `room ${key}`,
  );
  const participants = occupants.map(({ nick }) => {
    const color = OCCUPANT_COLORS[nick];
    if (!color) throw new Error(`No nickname color for occupant ${nick}: add it to OCCUPANT_COLORS`);
    return { nickname: nick, color };
  });
  return { id: key, name, subject, participants };
}

/** Ducko's default roster order: groups by name, members by display name, rooms last. */
function groups(content: Content, collapsed: string[], roomIds: string[]): Group[] {
  const byName = (a: string, b: string) => a.localeCompare(b);
  const names = [...new Set(content.contacts.map((c) => c.group))].sort(byName);
  const unknown = collapsed.find((name) => !names.includes(name));
  if (unknown) throw new Error(`content.json references unknown group ${unknown}`);
  const contactGroups: Group[] = names.map((name) => ({
    id: name.toLowerCase(),
    name,
    kind: 'contacts',
    memberIds: content.contacts
      .filter((c) => c.group === name)
      .sort((a, b) => byName(a.name, b.name))
      .map((c) => c.localpart),
    collapsed: collapsed.includes(name),
  }));
  return roomIds.length === 0 ? contactGroups : [...contactGroups, { id: 'rooms', name: 'Rooms', kind: 'rooms', memberIds: roomIds, collapsed: false }];
}

/** The static hero state a manifest state shows, built from `content` with no engine timers. `chatWidth` sets the tab bar's width. */
export function stateFor(id: string, content: Content, chatWidth: number): HeroState {
  if (content.version !== CONTENT_VERSION) throw new Error(`content.json version ${content.version} is not the supported version ${CONTENT_VERSION}`);
  const { timeZone, locale } = content.presentation;
  if (timeZone !== 'UTC') throw new Error(`content.json time zone ${timeZone} is not UTC`);
  const entry = content.states[id];
  if (!entry) throw new Error(`content.json has no state entry for ${id}`);
  const manifestState = resolve(
    manifest.states.find((s) => s.id === id),
    `manifest state ${id}`,
  );
  const spec = { ...DEFAULTS, key: manifestState.window, ...entry };
  const frontWindow = spec.key;
  if (frontWindow !== 'contacts' && frontWindow !== 'chat') throw new Error(`State ${id} names no key window`);

  const base = initialState(FIXTURE_NOW, { locale: locale.replace('_', '-'), timeZone });
  const contacts: Record<string, Contact> = Object.fromEntries(
    content.contacts.map((c) => [
      c.localpart,
      { id: c.localpart, name: c.name, presence: c.show ?? 'available', status: c.status, lastSeen: null, avatar: base.contacts[c.localpart]?.avatar ?? {} },
    ]),
  );
  const rooms = spec.rooms.map((key) => room(content, key));
  const conversations: Record<string, Conversation> = {};
  for (const contactId of Object.keys(contacts)) conversations[contactId] = emptyConversation(contactId, 'chat');
  for (const r of rooms) conversations[r.id] = emptyConversation(r.id, 'room');

  const variant = (name: string) => resolve(content.conversations[name], `conversation ${name}`);
  const peer = (name: string) => resolve(conversations[variant(name).peer], `peer of ${name}`);
  for (const name of spec.tabs) peer(name).messages = variant(name).messages.map((m) => message(content, variant(name), m));
  for (const [name, count] of Object.entries(spec.unread)) peer(name).unread = count;
  for (const contactId of spec.typing) resolve(conversations[contactId], `contact ${contactId}`).typing = true;

  const openTabs = spec.closeAllTabs ? [] : spec.tabs.map((name) => peer(name).id);
  const active = openTabs.length === 0 ? null : conversations[openTabs[0]];
  const activeMessage = (messageId: string) =>
    resolve(
      active?.messages.find((m) => m.id === messageId),
      `message ${messageId}`,
    );
  if (spec.lastOutgoingStatus)
    resolve(
      active?.messages.findLast((m) => m.direction === 'out'),
      'last outgoing message',
    ).status = spec.lastOutgoingStatus;
  if (active && spec.input) active.composer.draft = spec.input;
  if (active && spec.editing) active.composer = { draft: activeMessage(spec.editing).body, editingMessageId: spec.editing };

  const { hover, menu } = spec;
  let forcedHover: HeroState['forcedHover'] = null;
  if (hover?.statusPicker) forcedHover = { kind: 'status', id: 'own' };
  else if (hover?.tab) forcedHover = { kind: 'tab', id: peer(hover.tab).id };
  else if (hover?.message) forcedHover = { kind: 'bubble', id: activeMessage(hover.message).id };

  return {
    ...base,
    ownPresence: spec.ownStatus,
    contacts,
    groups: groups(
      content,
      spec.collapsedGroups,
      rooms.map((r) => r.id),
    ),
    rooms: Object.fromEntries(rooms.map((r) => [r.id, r])),
    conversations,
    openTabs,
    activeConversationId: active?.id ?? null,
    tabBarWidth: chatWidth - 2 * TAB_BAR_INSET,
    selectedRowId: spec.selectedContact === null ? null : resolve(contacts[spec.selectedContact], `contact ${spec.selectedContact}`).id,
    frontWindow,
    openMenu: menu === 'status' ? 'status' : null,
    contextMenu: menu && menu !== 'status' ? { messageId: activeMessage(menu.message).id } : null,
    forcedHover,
  };
}
