import { ME, PRESENCE_LABELS } from '../data';
import type { Contact, Group, HeroState, Presence, Room } from '../types';
import { divider, isKey, titlebar, windowClass } from './chrome';
import { escapeHtml } from './escape';
import { icons } from './icons';
import { avatar, displayedPresence, isInRooms, menuClass, menuItemClass, menuSeparator, participantCaption, presenceDot, unreadDescription } from './shared';
import { tw } from './tw';

const SELECTABLE_PRESENCES: Presence[] = ['available', 'away', 'xa', 'dnd', 'offline'];

function renderStatusMenu(state: HeroState): string {
  const items = SELECTABLE_PRESENCES.map(
    (presence) =>
      `<button type="button" role="menuitemradio" aria-checked="${presence === state.ownPresence}" data-action="set-presence" data-presence="${presence}" class="${menuItemClass} group/item">
        <span class="${tw`w-3`}">${presence === state.ownPresence ? icons.checkmark(11) : ''}</span>${presenceDot(presence)}<span>${escapeHtml(PRESENCE_LABELS[presence])}</span>
      </button>`,
  ).join('');
  const custom = `<button type="button" role="menuitem" data-action="hint" data-hint-anchor="custom-status" class="${menuItemClass}"><span class="${tw`w-3`}"></span>Custom…</button>`;
  return `<div role="menu" aria-label="Status" class="${menuClass} ${tw`top-[46px] left-6`}">${items}${menuSeparator}${custom}</div>`;
}

export function renderStatusHeader(state: HeroState): string {
  const hovered = state.forcedHover?.kind === 'status';
  const expanded = state.openMenu === 'status';
  return `<div class="${tw`relative flex items-center gap-2 px-3 py-2`}">
    ${presenceDot(state.ownPresence)}
    <div class="${tw`flex min-w-0 flex-col items-start gap-0.5`}">
      <span class="${tw`truncate font-semibold`}">${escapeHtml(ME.name)}</span>
      <button type="button" data-action="status-menu" aria-haspopup="menu" aria-expanded="${expanded}" class="${tw`-mx-[5px] flex items-center gap-[3px] rounded-[5px] px-[5px] py-px text-mac-callout text-secondary-label hover:bg-hover-fill`} ${hovered ? tw`bg-hover-fill` : ''}">
        <span>${escapeHtml(PRESENCE_LABELS[state.ownPresence])}</span>${icons.chevronDown(8)}
      </button>
    </div>
    <div class="${tw`flex-1`}"></div>
    <button type="button" data-action="poke" aria-label="${escapeHtml(ME.name)}" class="${tw`rounded-full`}">${avatar(ME.avatar, ME.name, 40, state.duckMode)}</button>
    ${expanded ? renderStatusMenu(state) : ''}
  </div>`;
}

function groupCounts(state: HeroState, group: Group): string {
  const online = group.memberIds.filter((id) => displayedPresence(state, id) !== 'offline').length;
  return `<span class="${tw`text-mac-caption text-secondary-label tabular-nums`}">${online} of ${group.memberIds.length}</span>`;
}

function renderGroupHeader(state: HeroState, group: Group): string {
  const expanded = !group.collapsed;
  return `<button type="button" data-action="toggle-group" data-id="${group.id}" aria-expanded="${expanded}" class="${tw`flex w-full items-center gap-2 px-3 py-1 text-left`}">
    <span class="${tw`flex w-2 justify-center text-secondary-label transition-transform duration-200 ease-in-out motion-reduce:transition-none`} ${expanded ? tw`rotate-90` : ''}">${icons.chevronRight(9)}</span>
    <span class="${tw`truncate text-mac-subheadline font-semibold text-secondary-label`}">${escapeHtml(group.name)}</span>
    <span class="${tw`flex-1`}"></span>
    ${group.kind === 'contacts' ? groupCounts(state, group) : ''}
  </button>`;
}

function rowClasses(state: HeroState, id: string): { row: string; secondary: string; tertiary: string } {
  if (state.selectedRowId !== id) return { row: '', secondary: tw`text-secondary-label`, tertiary: tw`text-tertiary-label` };
  if (isKey(state, 'contacts')) return { row: tw`bg-selection text-white`, secondary: tw`text-white/80`, tertiary: tw`text-white/60` };
  return { row: tw`bg-selection-inactive`, secondary: tw`text-secondary-label`, tertiary: tw`text-tertiary-label` };
}

function contactCaption(state: HeroState, contact: Contact, classes: ReturnType<typeof rowClasses>): string {
  const presence = displayedPresence(state, contact.id);
  const status = presence === 'offline' ? null : (contact.status ?? PRESENCE_LABELS[presence]);
  if (status) return `<span class="${tw`truncate text-mac-caption`} ${classes.secondary}">${escapeHtml(status)}</span>`;
  if (contact.lastSeen) return `<span class="${tw`truncate text-mac-caption`} ${classes.tertiary}">Last seen ${escapeHtml(contact.lastSeen)}</span>`;
  return '';
}

function renderContactRow(state: HeroState, contact: Contact): string {
  const classes = rowClasses(state, contact.id);
  return `<button type="button" data-action="select-row" data-id="${contact.id}" aria-pressed="${state.selectedRowId === contact.id}" class="${tw`flex w-full items-center gap-2 px-3 py-1 text-left`} ${classes.row}">
    ${presenceDot(displayedPresence(state, contact.id))}
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
  const unread = state.conversations[room.id].unread;
  const caption = room.subject ?? participantCaption(state, room);
  return `<button type="button" data-action="select-row" data-id="${room.id}" aria-pressed="${state.selectedRowId === room.id}" class="${tw`flex w-full items-center gap-2 px-3 py-1 text-left`} ${classes.row}">
    ${presenceDot(isInRooms(state) ? 'available' : 'offline')}
    <span class="${tw`flex min-w-0 flex-col gap-0.5`}">
      <span class="${tw`truncate font-medium`}">${escapeHtml(room.name)}</span>
      ${caption ? `<span class="${tw`truncate text-mac-caption`} ${classes.secondary}">${escapeHtml(caption)}</span>` : ''}
    </span>
    <span class="${tw`flex-1`}"></span>
    ${unread > 0 ? `<span class="${tw`rounded-full bg-mac-red px-1.5 py-0.5 text-mac-caption leading-none font-bold text-white`}" role="img" aria-label="${unreadDescription(unread)}">${unread}</span>` : ''}
    <span class="${tw`grid size-8 shrink-0 place-items-center`} ${classes.secondary}">${icons.bubblesFill(15)}</span>
  </button>`;
}

export function renderContactsList(state: HeroState): string {
  return state.groups
    .map((group) => {
      const members = group.collapsed
        ? ''
        : group.memberIds
            .map((id) => (group.kind === 'contacts' ? renderContactRow(state, state.contacts[id]) : renderRoomRow(state, state.rooms[id])))
            .join('');
      return renderGroupHeader(state, group) + members;
    })
    .join('');
}

export function renderContactsWindow(state: HeroState): string {
  return `<div data-window="contacts" class="${windowClass}">
    ${titlebar(state, 'contacts')}
    <div data-region="status">${renderStatusHeader(state)}</div>
    ${divider}
    <div data-region="contacts-list" class="${tw`min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto`}">${renderContactsList(state)}</div>
  </div>`;
}
