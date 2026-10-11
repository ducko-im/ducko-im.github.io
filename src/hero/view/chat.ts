import { ACTION_PREFIX } from '../commands';
import { ME } from '../data';
import { groupMessages, type TimelineRow } from '../grouping';
import { partitionTabs, visibleTabCount } from '../tabs';
import type { Conversation, HeroState, Message } from '../types';
import { divider, titlebar, windowClass } from './chrome';
import { escapeHtml } from './escape';
import { formatDay, formatMinutesAgo, formatTime } from './format';
import { icons } from './icons';
import {
  activeConversation,
  activityIndicator,
  avatar,
  chatPresence,
  composerView,
  conversationName,
  menuClass,
  menuItemClass,
  messageText,
  nicknameStyle,
  participantAvatar,
  participantCaption,
} from './shared';
import { tw } from './tw';

const toolButton = tw`grid place-items-center text-label`;
const secondaryToolButton = tw`grid place-items-center text-secondary-label`;

function hintButton(anchor: string, label: string, content: string, classes = toolButton): string {
  return `<button type="button" data-action="hint" data-hint-anchor="${anchor}" aria-label="${label}" class="${classes}">${content}</button>`;
}

function lockMenu(): string {
  return hintButton('lock', 'Encryption', `${icons.lockOpen(13)}${icons.chevronDown(10.5)}`, tw`mr-[5px] ml-0.5 flex items-center gap-[2.5px] text-label`);
}

export function renderChatHeader(state: HeroState): string {
  const conversation = activeConversation(state);
  if (!conversation) return '';
  let identity: string;
  let tools: string;
  const room = conversation.kind === 'room' ? state.rooms[conversation.id] : null;
  if (room) {
    const caption = participantCaption(state, room);
    identity = `<span class="${tw`flex min-w-0 flex-col gap-0.5`}">
      <span class="${tw`truncate font-bold`}">${escapeHtml(room.name)}</span>
      ${caption ? `<span class="${tw`text-mac-caption text-secondary-label`}">${caption}</span>` : ''}
    </span>`;
    tools = hintButton('history', 'History', icons.clock(13)) + lockMenu() + hintButton('participants', 'Participants', icons.person2(13), secondaryToolButton);
  } else {
    const contact = state.contacts[conversation.id];
    const { dot, status } = chatPresence(state, contact.id);
    identity = `${avatar(contact.avatar, contact.name, 32, state.duckMode)}
      <span class="${tw`flex min-w-0 flex-col gap-0.5`}">
        <span class="${tw`truncate font-bold`}">${escapeHtml(contact.name)}</span>
        <span class="${tw`flex items-center gap-1`}">${dot}<span class="${tw`truncate text-mac-caption text-secondary-label`}">${escapeHtml(status)}</span></span>
      </span>`;
    tools = hintButton('info', 'Contact Info', icons.infoCircle(13)) + hintButton('history', 'History', icons.clock(13)) + lockMenu();
  }
  const subject = room?.subject
    ? `${divider}<div data-room-subject class="${tw`flex h-[23px] items-center gap-2 pr-[17px] pl-4 text-mac-callout`}">
        <span class="${tw`min-w-0 flex-1 truncate`}">${escapeHtml(room.subject)}</span>${hintButton('subject', 'Change Subject', icons.pencil(8), secondaryToolButton)}
      </div>`
    : '';
  const strip =
    state.ownPresence === 'offline'
      ? `<div data-offline-strip class="${tw`bg-mac-orange/12 px-4 py-1 text-mac-caption text-secondary-label`}">You're offline — messages will send when you reconnect.</div>`
      : '';
  return `<div class="${tw`flex items-center gap-2 px-4 py-2`}">
    ${identity}
    <span class="${tw`flex-1`}"></span>
    <span class="${tw`flex items-center gap-2.5`}">${tools}</span>
  </div>${subject}${strip}`;
}

function senderName(state: HeroState, conversation: Conversation, message: Message): string {
  if (message.direction === 'out') return ME.name;
  return conversation.kind === 'room' ? message.sender : state.contacts[message.sender].name;
}

function deliveryMark(message: Message): string {
  if (message.direction !== 'out' || message.status === 'sent') return '';
  const read = message.status === 'read';
  const label = read ? 'Read' : 'Delivered';
  return `<span class="${tw`mr-[1.5px] ml-px flex`}" aria-label="${label}" title="${label}" data-delivery="${message.status}">${icons.checkmark(9)}${read ? `<span class="${tw`-ml-0.5 flex`}">${icons.checkmark(9)}</span>` : ''}</span>`;
}

function editedLabel(state: HeroState, message: Message): string {
  return message.editedSecondsAgo === undefined ? '(edited)' : `(edited ${formatMinutesAgo(message.editedSecondsAgo, state.format)})`;
}

function renderMetadata(state: HeroState, row: TimelineRow, forced: boolean): string {
  const { message } = row;
  const visibility = row.isLastInGroup || forced ? tw`opacity-100` : tw`opacity-0 group-hover/row:opacity-100`;
  return `<span class="${tw`flex items-center gap-1 pb-px text-mac-caption text-secondary-label transition-opacity duration-150 ease-[ease-in-out] motion-reduce:transition-none`} ${visibility}">
    <span>${formatTime(message.time, state.format)}</span>${deliveryMark(message)}${message.edited ? `<span>${editedLabel(state, message)}</span>` : ''}
  </span>`;
}

/** The open context menu, drawn in a layer over the chat window so it can reach past the window's edge, as Ducko's does. */
export function renderContextMenu(state: HeroState): string {
  const messageId = state.contextMenu?.messageId;
  const message = messageId === undefined ? undefined : activeConversation(state)?.messages.find((m) => m.id === messageId);
  if (!message) return '';
  const item = (label: string, attrs: string) => `<button type="button" role="menuitem" ${attrs} class="${menuItemClass}">${label}</button>`;
  return `<div role="menu" aria-label="Message" data-anchor="${message.id}" class="${menuClass} ${tw`pointer-events-auto`}">
    ${item('Copy', 'data-action="hint" data-hint-anchor="copy"')}
    ${item('Reply', 'data-action="hint" data-hint-anchor="reply"')}
    ${item('Edit', `data-action="start-edit" data-id="${message.id}"`)}
    ${item('Retract', 'data-action="hint" data-hint-anchor="retract"')}
  </div>`;
}

function renderBubble(state: HeroState, conversation: Conversation, row: TimelineRow): string {
  const { message } = row;
  const outgoing = message.direction === 'out';
  const body = message.action
    ? `<em>* ${escapeHtml(senderName(state, conversation, message))} ${messageText(message.body.slice(ACTION_PREFIX.length))}</em>`
    : messageText(message.body);
  const participant =
    conversation.kind === 'room' && !outgoing ? state.rooms[conversation.id].participants.find((p) => p.nickname === message.sender) : undefined;
  const nickname = participant
    ? `<span class="${tw`pl-1 text-mac-caption font-semibold text-(--nick-light) dark:text-(--nick-dark)`}" style="${nicknameStyle(participant)}">${escapeHtml(participant.nickname)}</span>`
    : '';
  const forced = state.forcedHover?.kind === 'bubble' && state.forcedHover.id === message.id;
  const bubbleColors = outgoing ? tw`bg-bubble-out text-white` : tw`bg-bubble-in text-bubble-in-text`;
  return `<div class="${tw`flex min-w-0 flex-col gap-1`} ${outgoing ? tw`items-end` : tw`items-start`}">
    ${nickname}
    <div class="${tw`rounded-xl px-3 py-2 leading-4 break-words whitespace-pre-wrap`} ${bubbleColors}" ${outgoing ? 'data-own-bubble' : ''} data-id="${message.id}">${body}</div>
    ${renderMetadata(state, row, forced)}
  </div>`;
}

function renderSenderAvatar(state: HeroState, conversation: Conversation, row: TimelineRow): string {
  if (!row.isLastInGroup) return `<span class="${tw`size-8 shrink-0`}"></span>`;
  if (conversation.kind === 'chat') {
    const contact = state.contacts[conversation.id];
    return avatar(contact.avatar, contact.name, 32, state.duckMode);
  }
  const participant = state.rooms[conversation.id].participants.find((p) => p.nickname === row.message.sender)!;
  return participantAvatar(participant, 32, state.duckMode);
}

function renderRow(state: HeroState, conversation: Conversation, row: TimelineRow): string {
  const outgoing = row.message.direction === 'out';
  const spacer = `<span class="${tw`min-w-[60px] flex-1`}"></span>`;
  const day = row.startsDay
    ? `<div class="${tw`pt-2 pb-[9px] text-center text-mac-caption text-secondary-label`}">${formatDay(row.message.time, state.format)}</div>`
    : '';
  const content = renderBubble(state, conversation, row);
  const inner = outgoing ? spacer + content : renderSenderAvatar(state, conversation, row) + content + spacer;
  return `${day}<div data-message-id="${row.message.id}" class="${tw`group/row flex items-end gap-2 px-4`} ${row.isFirstInGroup ? tw`pt-2` : tw`pt-0.5`}">${inner}</div>`;
}

export function renderTimeline(state: HeroState): string {
  const conversation = activeConversation(state);
  if (!conversation) return '';
  const rows = groupMessages(conversation.messages, state.format.timeZone)
    .map((row) => renderRow(state, conversation, row))
    .join('');
  return `<div class="${tw`mt-auto pb-[9px]`}">${rows}</div>`;
}

export function renderComposer(state: HeroState): string {
  const { draft, editing, canSend } = composerView(state);
  return `<div data-edit-bar class="${tw`flex items-center gap-2.5 bg-edit-bar pt-1.5 pr-[13px] pb-[7px] pl-[13px]`}" ${editing ? '' : 'hidden'}>
    <span class="${tw`relative top-px text-secondary-label`}">${icons.pencil(11)}</span>
    <span class="${tw`flex min-w-0 flex-col gap-0.5`}">
      <span class="${tw`text-mac-caption font-semibold`}">Editing message</span>
      <span data-edit-preview class="${tw`truncate text-mac-caption text-secondary-label`}">${escapeHtml(editing?.body ?? '')}</span>
    </span>
    <span class="${tw`flex-1`}"></span>
    <button type="button" data-action="cancel-edit" aria-label="Cancel editing" class="${tw`text-secondary-label`}">${icons.xmarkCircleFill(13)}</button>
  </div>
  <div class="${tw`flex items-end gap-2 py-[13px] pr-[13.5px] pl-3`}">
    ${hintButton('paperclip', 'Attach file', icons.paperclip(17), tw`relative -top-px grid h-[18px] place-items-center text-label`)}
    <label for="hero-message" class="${tw`sr-only`}">Message</label>
    <textarea id="hero-message" data-composer-input rows="1" placeholder="Message" class="${tw`relative top-0.5 max-h-[5lh] min-h-[1lh] flex-1 resize-none [scrollbar-width:none] overflow-y-auto bg-transparent leading-[18px] outline-none placeholder:text-secondary-label`}">${escapeHtml(draft)}</textarea>
    <button type="button" data-action="send" aria-label="Send" class="${tw`grid h-[18px] place-items-center text-label disabled:opacity-50`}" ${canSend ? '' : 'disabled'}>${icons.arrowUpCircleFill(17)}</button>
  </div>`;
}

function tabLeadingSlot(state: HeroState, conversation: Conversation, forcedHover: boolean): string {
  const close = `<button type="button" data-action="close-tab" data-id="${conversation.id}" aria-label="Close tab" class="${tw`absolute inset-0 z-10 place-items-center text-secondary-label`} ${forcedHover ? tw`grid` : tw`hidden group-hover/tab:grid`}">${icons.xmarkCircleFill(13)}</button>`;
  const idle = conversation.kind === 'room' ? `<span class="${tw`text-secondary-label`}">${icons.number(12)}</span>` : chatPresence(state, conversation.id).dot;
  const indicator = activityIndicator(conversation, idle);
  return `<span class="${tw`relative grid size-4 shrink-0 place-items-center`}">${close}<span class="${tw`grid place-items-center`} ${forcedHover ? tw`invisible` : tw`group-hover/tab:invisible`}">${indicator}</span></span>`;
}

function renderTab(state: HeroState, id: string): string {
  const conversation = state.conversations[id];
  const selected = state.activeConversationId === id;
  const forcedHover = state.forcedHover?.kind === 'tab' && state.forcedHover.id === id;
  const name = escapeHtml(conversationName(state, id));
  return `<div role="tab" aria-selected="${selected}" data-tab="${id}" class="${tw`group/tab relative flex max-w-80 min-w-[90px] shrink items-center gap-1 rounded-md py-[5px] pr-2 pl-1`} ${selected ? tw`bg-accent/15` : ''}" title="${name}">
    ${tabLeadingSlot(state, conversation, forcedHover)}
    <button type="button" data-action="activate-tab" data-id="${id}" class="${tw`min-w-0 flex-1 truncate text-left after:absolute after:inset-0`}">${name}</button>
  </div>`;
}

function renderOverflowMenu(state: HeroState, overflow: string[]): string {
  const items = overflow
    .map(
      (id) =>
        `<button type="button" role="menuitem" data-action="activate-tab" data-id="${id}" class="${menuItemClass}">${escapeHtml(conversationName(state, id))}</button>`,
    )
    .join('');
  return `<div role="menu" aria-label="More tabs" class="${menuClass} ${tw`right-0 bottom-full mb-1`}">${items}</div>`;
}

export function renderTabs(state: HeroState): string {
  const { visible, overflow } = partitionTabs(state.openTabs, visibleTabCount(state.tabBarWidth, state.openTabs.length), state.activeConversationId);
  const overflowControl =
    overflow.length > 0
      ? `<span class="${tw`relative`}">
          <button type="button" data-action="overflow-menu" aria-haspopup="menu" aria-expanded="${state.openMenu === 'overflow'}" aria-label="More tabs" class="${tw`grid size-[22px] place-items-center text-label`}">${icons.chevronDown(16)}</button>
          ${state.openMenu === 'overflow' ? renderOverflowMenu(state, overflow) : ''}
        </span>`
      : '';
  return `<div role="tablist" aria-label="Conversations" class="${tw`flex min-w-0 flex-1 items-center gap-1`}">${visible.map((id) => renderTab(state, id)).join('')}</div>${overflowControl}`;
}

function renderEmptyState(): string {
  return `<div class="${tw`flex flex-1 flex-col items-center justify-center gap-3 pt-0.5`}">
    <span class="${tw`mb-0.5 text-secondary-label`}">${icons.bubbles(31)}</span>
    <span class="${tw`text-secondary-label`}">No conversation open</span>
    <button type="button" data-action="hint" data-hint-anchor="new-chat" class="${tw`h-6 rounded-lg bg-black/7 px-[15px] dark:bg-white/7`}">New Chat</button>
  </div>`;
}

export function renderChatWindow(state: HeroState): string {
  const hasConversation = state.activeConversationId !== null;
  return `<div data-window="chat" class="${windowClass}">
    ${titlebar(state, 'chat')}
    <div data-view="conversation" class="${tw`flex min-h-0 flex-1 flex-col`}" ${hasConversation ? '' : 'hidden'}>
      <div data-region="chat-header">${renderChatHeader(state)}</div>
      ${divider}
      <div data-region="timeline" class="${tw`flex min-h-0 flex-1 [scrollbar-width:none] flex-col overflow-y-auto`}">${renderTimeline(state)}</div>
      ${divider}
      <div data-region="composer">${renderComposer(state)}</div>
    </div>
    <div data-view="empty" class="${tw`flex min-h-0 flex-1 flex-col`}" ${hasConversation ? 'hidden' : ''}>${renderEmptyState()}</div>
    ${divider}
    <div data-region="tabs" class="${tw`flex h-[34px] shrink-0 items-center px-3`}">${renderTabs(state)}</div>
  </div>
  <div data-region="context-menu" class="${tw`pointer-events-none absolute inset-0`}">${renderContextMenu(state)}</div>`;
}
