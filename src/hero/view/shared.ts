import { DUCK_AVATAR, EMPTY_COMPOSER, PRESENCE_LABELS } from '../data';
import type { Avatar, Conversation, HeroState, Message, Participant, Presence, Room } from '../types';
import { escapeHtml } from './escape';
import { icon } from './icons';
import { tw } from './tw';

const DOT_CLASSES: Record<Presence, string> = {
  available: tw`bg-presence-available`,
  away: tw`bg-presence-away`,
  xa: tw`bg-presence-away`,
  dnd: tw`bg-presence-dnd`,
  offline: tw`bg-presence-offline`,
};

const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*/gu;

/** Escapes `text` and enlarges its emoji: AppKit draws Apple Color Emoji about 1.28 times as large as the browser does at the same font size. */
export function messageText(text: string): string {
  return escapeHtml(text).replace(EMOJI, (emoji) => `<span class="${tw`relative top-px text-[1.28em] leading-0`}">${emoji}</span>`);
}

export function presenceDot(presence: Presence): string {
  return `<span class="${tw`size-2 shrink-0 rounded-full`} ${DOT_CLASSES[presence]}" data-presence="${presence}"></span>`;
}

const unknownPresenceRing = `<span class="${tw`-mx-px size-2.5 shrink-0 rounded-full inset-ring-[1.5px] inset-ring-presence-offline`}" data-presence="unknown"></span>`;

/**
 * A contact's presence as the chat window shows it: the dot in its header and tabs, and the header's status line. While
 * the visitor is offline, Ducko knows no contact's presence and draws a hollow ring instead.
 */
export function chatPresence(state: HeroState, contactId: string): { dot: string; status: string } {
  const { presence, status } = state.contacts[contactId];
  if (state.ownPresence === 'offline') return { dot: unknownPresenceRing, status: 'Presence unknown' };
  return { dot: presenceDot(presence), status: presence === 'offline' ? PRESENCE_LABELS.offline : (status ?? PRESENCE_LABELS[presence]) };
}

/** The presence the roster shows: everyone reads offline while the visitor is offline. */
export function displayedPresence(state: HeroState, contactId: string): Presence {
  return state.ownPresence === 'offline' ? 'offline' : state.contacts[contactId].presence;
}

export function conversationName(state: HeroState, id: string): string {
  return state.contacts[id]?.name ?? state.rooms[id].name;
}

export function activeConversation(state: HeroState): Conversation | null {
  return state.activeConversationId === null ? null : state.conversations[state.activeConversationId];
}

export function isInRooms(state: HeroState): boolean {
  return state.ownPresence !== 'offline';
}

/** The room's member count, which includes the visitor (hence `+ 1`), or null while the visitor is out of the rooms. */
export function participantCaption(state: HeroState, room: Room): string | null {
  return isInRooms(state) ? `${room.participants.length + 1} participants` : null;
}

/** Ducko's spoken unread count (`ChatTabBarView.activityDescription`). */
function unreadDescription(count: number): string {
  return count === 1 ? '1 unread message' : `${count} unread messages`;
}

/** Ducko's activity slot on tabs and on contact and room rows: the unread count, else a contact typing, else `idle`. */
export function activityIndicator(conversation: Conversation, idle: string): string {
  if (conversation.unread > 0) {
    return `<span class="${tw`grid size-4 place-items-center rounded-full bg-mac-red text-[9px] leading-none font-semibold text-white`}" role="img" aria-label="${unreadDescription(conversation.unread)}" data-unread>${conversation.unread > 9 ? '9+' : conversation.unread}</span>`;
  }
  if (conversation.kind === 'chat' && conversation.typing) return `<span class="${tw`text-secondary-label`}" data-typing>${icon('ellipsisBubbleFill')}</span>`;
  return idle;
}

/** What the composer shows for the active conversation. The server renders it and the client syncs the live textarea to it. */
export function composerView(state: HeroState): { draft: string; editing: Message | undefined; canSend: boolean } {
  const conversation = activeConversation(state);
  const { draft, editingMessageId } = conversation?.composer ?? EMPTY_COMPOSER;
  const editing = editingMessageId === null ? undefined : conversation?.messages.find((m) => m.id === editingMessageId);
  return { draft, editing, canSend: draft.trim() !== '' };
}

export function totalUnread(state: HeroState): number {
  return Object.values(state.conversations).reduce((sum, c) => sum + c.unread, 0);
}

function initials(name: string): string {
  const parts = name.split(' ');
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function avatar(avatar: Avatar, name: string, size: number, duckMode: boolean): string {
  const shown = duckMode ? DUCK_AVATAR : avatar;
  const base = tw`grid shrink-0 place-items-center overflow-hidden rounded-full leading-none text-white`;
  if (shown.emoji && shown.gradient) {
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.58)}px;background:linear-gradient(${shown.gradient[0]},${shown.gradient[1]})`;
    return `<span class="${base}" style="${style}" data-avatar>${shown.emoji}</span>`;
  }
  const style = `width:${size}px;height:${size}px;font-size:${size * 0.4}px;background:linear-gradient(135deg,var(--mac-blue),color-mix(in srgb,var(--mac-blue) 70%,transparent))`;
  return `<span class="${base} ${tw`font-semibold`}" style="${style}" data-avatar>${escapeHtml(initials(name))}</span>`;
}

export function nicknameStyle(participant: Participant): string {
  return `--nick-light:${participant.color.light};--nick-dark:${participant.color.dark}`;
}

export function participantAvatar(participant: Participant, size: number, duckMode: boolean): string {
  if (duckMode) return avatar(DUCK_AVATAR, participant.nickname, size, true);
  const style = `width:${size}px;height:${size}px;font-size:${size * 0.4}px;${nicknameStyle(participant)}`;
  return `<span class="${tw`grid shrink-0 place-items-center rounded-full bg-(--nick-light) leading-none font-semibold text-white dark:bg-(--nick-dark)`}" style="${style}" data-avatar>${escapeHtml(participant.nickname.slice(0, 2).toUpperCase())}</span>`;
}

/** A menu carries the window's typography itself: the status and context menus are drawn in layers outside their windows. */
export const menuClass = tw`absolute z-30 cursor-default rounded-[10px] bg-menu p-[5px] font-mac text-mac-body leading-[1.25] text-label shadow-menu backdrop-blur-xl backdrop-saturate-150 select-none`;
export const menuItemClass = tw`flex h-6 w-full items-center gap-1.5 rounded-[5px] px-[11.5px] text-left whitespace-nowrap hover:bg-accent hover:text-white`;
export const menuSeparator = `<div class="${tw`mx-[11px] my-[5px] h-px bg-menu-separator`}" role="separator"></div>`;
