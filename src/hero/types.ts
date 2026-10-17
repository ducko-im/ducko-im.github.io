export type Presence = 'available' | 'away' | 'xa' | 'dnd' | 'offline';

export type HeroWindow = 'contacts' | 'chat';

export interface Avatar {
  emoji?: string;
  gradient?: [string, string];
}

export interface Contact {
  id: string;
  name: string;
  presence: Presence;
  status: string | null;
  lastSeen: string | null;
  avatar: Avatar;
}

export interface Group {
  id: string;
  name: string;
  kind: 'contacts' | 'rooms';
  memberIds: string[];
  collapsed: boolean;
}

export interface Participant {
  nickname: string;
  color: { light: string; dark: string };
}

export interface Room {
  id: string;
  name: string;
  subject: string | null;
  participants: Participant[];
}

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  direction: 'in' | 'out';
  /** A contact id, a room nickname, or `me`. */
  sender: string;
  body: string;
  time: number;
  status: MessageStatus;
  edited: boolean;
  /** How long ago the edit happened, for a relative "(edited …)" label. The live hero leaves it unset. */
  editedSecondsAgo?: number;
  action: boolean;
}

export interface Composer {
  draft: string;
  editingMessageId: string | null;
}

export interface Conversation {
  id: string;
  kind: 'chat' | 'room';
  messages: Message[];
  unread: number;
  typing: boolean;
  composer: Composer;
  /** A reply is owed for these outgoing messages, answered together. It survives going offline and resumes on reconnect. */
  pendingReply: { messageIds: string[]; egg: boolean } | null;
}

export interface HeroState {
  ownPresence: Presence;
  contacts: Record<string, Contact>;
  groups: Group[];
  rooms: Record<string, Room>;
  conversations: Record<string, Conversation>;
  openTabs: string[];
  activeConversationId: string | null;
  tabBarWidth: number;
  selectedRowId: string | null;
  chatWindowOpen: boolean;
  frontWindow: HeroWindow;
  openMenu: 'status' | 'overflow' | null;
  contextMenu: { messageId: string } | null;
  hint: { anchorId: string } | null;
  duckMode: boolean;
  splash: number;
  forcedHover: { kind: 'status' | 'tab' | 'bubble' | 'lights'; id: string } | null;
  /** A text selection drawn as markup, for the lab: `start` and `end` are UTF-16 offsets into the message body. */
  forcedSelection: { messageId: string; start: number; end: number } | null;
  format: { locale: string; timeZone: string };
}
