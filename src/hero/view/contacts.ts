import { ME, PRESENCE_LABELS } from '../data';
import type { Contact, Conversation, Group, HeroState, Presence, Room } from '../types';
import { divider, isKey, titlebar, windowClass } from './chrome';
import { escapeHtml } from './escape';
import { icon } from './icons';
import { activityIndicator, avatar, displayedPresence, isInRooms, menuClass, menuItemClass, menuSeparator, participantCaption, presenceDot } from './shared';
import { tw } from './tw';

const SELECTABLE_PRESENCES: Presence[] = ['available', 'away', 'xa', 'dnd', 'offline'];

// The window's metrics in points, which the markup must match: everything above the list (the title bar and divider
// from chrome.ts and the status header below), a group header and a row.
const HEADER_HEIGHT = 89;
const GROUP_HEADER_HEIGHT = 22;
const ROW_HEIGHT = 40;

/**
 * The open status menu, drawn in a layer over the Contacts window so a window fitted to a few rows can't clip it. Its
 * `top` counts from the window's top: the title bar's 32 pt plus 49 pt.
 */
export function renderStatusMenu(state: HeroState): string {
  if (state.openMenu !== 'status') return '';
  const items = SELECTABLE_PRESENCES.map(
    (presence) =>
      `<button type="button" role="menuitemradio" aria-checked="${presence === state.ownPresence}" data-action="set-presence" data-presence="${presence}" class="${menuItemClass} ${tw`group/item pl-2.5`}">
        ${presenceDot(presence)}<span>${escapeHtml(PRESENCE_LABELS[presence])}</span>${presence === state.ownPresence ? icon('checkmarkMenu', tw`ml-0.5`) : ''}
      </button>`,
  ).join('');
  const custom = `<button type="button" role="menuitem" data-action="hint" data-hint-anchor="custom-status" class="${menuItemClass}">Custom…</button>`;
  return `<div role="menu" aria-label="Status" class="${menuClass} ${tw`pointer-events-auto top-[81px] left-[23px]`}">${items}${menuSeparator}${custom}</div>`;
}

export function renderStatusHeader(state: HeroState): string {
  const hovered = state.forcedHover?.kind === 'status';
  const expanded = state.openMenu === 'status';
  return `<div class="${tw`flex items-center gap-2 px-3 py-2`}">
    ${presenceDot(state.ownPresence)}
    <div class="${tw`flex min-w-0 flex-col items-start gap-0.5`}">
      <span class="${tw`truncate font-semibold`}">${escapeHtml(ME.name)}</span>
      <button type="button" data-action="status-menu" aria-haspopup="menu" aria-expanded="${expanded}" class="${tw`-mx-[5px] flex items-center gap-[3px] rounded-[5px] px-[5px] py-px text-mac-callout text-secondary-label hover:bg-hover-fill`} ${hovered ? tw`bg-hover-fill` : ''}">
        <span>${escapeHtml(PRESENCE_LABELS[state.ownPresence])}</span>${icon('chevronDownStatus')}
      </button>
    </div>
    <div class="${tw`flex-1`}"></div>
    <button type="button" data-action="poke" aria-label="${escapeHtml(ME.name)}" class="${tw`rounded-full`}">${avatar(ME.avatar, ME.name, 40, state.duckMode)}</button>
  </div>`;
}

function groupCounts(state: HeroState, group: Group): string {
  const online = group.memberIds.filter((id) => displayedPresence(state, id) !== 'offline').length;
  return `<span class="${tw`text-mac-caption text-secondary-label tabular-nums`}">${online} of ${group.memberIds.length}</span>`;
}

function renderGroupHeader(state: HeroState, group: Group): string {
  const expanded = !group.collapsed;
  return `<button type="button" data-action="toggle-group" data-id="${group.id}" aria-expanded="${expanded}" class="${tw`flex h-[22px] w-full items-center gap-2 px-3 text-left`}">
    <span data-chevron class="${tw`flex w-2 justify-center text-secondary-label`} ${expanded ? tw`rotate-90` : ''}">${icon('chevronRightGroup')}</span>
    <span class="${tw`truncate text-mac-subheadline font-semibold text-secondary-label`}">${escapeHtml(group.name)}</span>
    <span class="${tw`flex-1`}"></span>
    ${group.kind === 'contacts' ? groupCounts(state, group) : ''}
  </button>`;
}

function rowClasses(state: HeroState, id: string): { row: string; secondary: string; tertiary: string } {
  if (state.selectedRowId !== id) return { row: '', secondary: tw`text-secondary-label`, tertiary: tw`text-tertiary-label` };
  if (isKey(state, 'contacts')) return { row: tw`bg-selection text-white`, secondary: tw`text-white/70`, tertiary: tw`text-white/60` };
  return { row: tw`bg-selection-inactive`, secondary: tw`text-secondary-label`, tertiary: tw`text-tertiary-label` };
}

function contactCaption(state: HeroState, contact: Contact, classes: ReturnType<typeof rowClasses>): string {
  const presence = displayedPresence(state, contact.id);
  const status = presence === 'offline' ? null : (contact.status ?? PRESENCE_LABELS[presence]);
  if (status) return `<span class="${tw`truncate text-mac-caption`} ${classes.secondary}">${escapeHtml(status)}</span>`;
  if (contact.lastSeen) return `<span class="${tw`truncate text-mac-caption`} ${classes.tertiary}">Last seen ${escapeHtml(contact.lastSeen)}</span>`;
  return '';
}

/** A 16 pt slot laid out as wide as the 8 pt presence dot, so names stay aligned with the status header's. */
function activitySlot(conversation: Conversation, idle: string): string {
  return `<span class="${tw`-mx-1 grid size-4 shrink-0 place-items-center`}">${activityIndicator(conversation, idle)}</span>`;
}

function renderContactRow(state: HeroState, contact: Contact): string {
  const classes = rowClasses(state, contact.id);
  return `<button type="button" data-action="select-row" data-id="${contact.id}" aria-pressed="${state.selectedRowId === contact.id}" class="${tw`flex w-full items-center gap-2 px-3 py-1 text-left`} ${classes.row}">
    ${activitySlot(state.conversations[contact.id], presenceDot(displayedPresence(state, contact.id)))}
    <span class="${tw`flex min-w-0 flex-col gap-0.5`}">
      <span class="${tw`truncate font-medium`}">${escapeHtml(contact.name)}</span>
      ${contactCaption(state, contact, classes)}
    </span>
    <span class="${tw`flex-1`}"></span>
    ${avatar(contact.avatar, contact.name, 32, state.duckMode)}
  </button>`;
}

function renderRoomRow(state: HeroState, room: Room): string {
  const classes = rowClasses(state, room.id);
  const caption = room.subject ?? participantCaption(state, room);
  return `<button type="button" data-action="select-row" data-id="${room.id}" aria-pressed="${state.selectedRowId === room.id}" class="${tw`flex w-full items-center gap-2 px-3 py-1 text-left`} ${classes.row}">
    ${activitySlot(state.conversations[room.id], presenceDot(isInRooms(state) ? 'available' : 'offline'))}
    <span class="${tw`flex min-w-0 flex-col gap-0.5`}">
      <span class="${tw`truncate font-medium`}">${escapeHtml(room.name)}</span>
      ${caption ? `<span class="${tw`truncate text-mac-caption`} ${classes.secondary}">${escapeHtml(caption)}</span>` : ''}
    </span>
    <span class="${tw`flex-1`}"></span>
    <span class="${tw`grid size-8 shrink-0 place-items-center`} ${classes.secondary}">${icon('bubblesFillRoom')}</span>
  </button>`;
}

export function renderContactsList(state: HeroState): string {
  return state.groups
    .map((group) => {
      const members = group.collapsed
        ? ''
        : `<div data-group-rows="${group.id}">${group.memberIds
            .map((id) => (group.kind === 'contacts' ? renderContactRow(state, state.contacts[id]) : renderRoomRow(state, state.rooms[id])))
            .join('')}</div>`;
      return renderGroupHeader(state, group) + members;
    })
    .join('');
}

/** The height Ducko fits the Contacts window to: its content, counting only the expanded groups' rows. */
export function contactsWindowHeight(state: HeroState): number {
  const list = state.groups.reduce((sum, group) => sum + GROUP_HEADER_HEIGHT + (group.collapsed ? 0 : group.memberIds.length * ROW_HEIGHT), 0);
  return HEADER_HEIGHT + list;
}

export function renderContactsWindow(state: HeroState): string {
  return `<div data-window="contacts" class="${windowClass}">
    ${titlebar(state, 'contacts')}
    <div data-region="status">${renderStatusHeader(state)}</div>
    ${divider}
    <div data-region="contacts-list" class="${tw`min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto`}">${renderContactsList(state)}</div>
  </div>
  <div data-region="status-menu" class="${tw`pointer-events-none absolute inset-0`}">${renderStatusMenu(state)}</div>`;
}
