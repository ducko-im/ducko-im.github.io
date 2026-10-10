import type { Message } from './types';
import { formatter } from './view/format';

const GROUPING_INTERVAL_MS = 120_000;

export interface TimelineRow {
  message: Message;
  startsDay: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

function dayKey(time: number, timeZone: string): string {
  return formatter('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
}

function isSameGroup(a: Message, b: Message | undefined): boolean {
  if (!b) return false;
  return a.direction === b.direction && a.sender === b.sender && Math.abs(a.time - b.time) <= GROUPING_INTERVAL_MS;
}

/** Ducko's `MessageGrouping`: same direction and sender within `GROUPING_INTERVAL_MS`. A day separator between two messages ends the group before it. */
export function groupMessages(messages: Message[], timeZone: string): TimelineRow[] {
  const days = messages.map((message) => dayKey(message.time, timeZone));
  const startsDay = days.map((day, index) => index === 0 || day !== days[index - 1]);
  return messages.map((message, index) => ({
    message,
    startsDay: startsDay[index],
    isFirstInGroup: startsDay[index] || !isSameGroup(message, messages[index - 1]),
    isLastInGroup: index === messages.length - 1 || startsDay[index + 1] || !isSameGroup(message, messages[index + 1]),
  }));
}
