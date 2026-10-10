import { describe, expect, it } from 'vitest';
import { groupMessages } from './grouping';
import type { Message } from './types';

const BASE = Date.UTC(2026, 9, 10, 23, 58, 0);

function message(id: string, secondsAfterBase: number, direction: Message['direction'] = 'in', sender = 'lena'): Message {
  return { id, direction, sender, body: id, time: BASE + secondsAfterBase * 1000, status: 'sent', edited: false, action: false };
}

function firsts(messages: Message[]): boolean[] {
  return groupMessages(messages, 'UTC').map((row) => row.isFirstInGroup);
}

describe('groupMessages', () => {
  it('groups the same sender within 120 s', () => {
    expect(firsts([message('a', 0), message('b', 119)])).toEqual([true, false]);
    expect(firsts([message('a', 0), message('b', 121)])).toEqual([true, true]);
  });

  it('splits on a direction change', () => {
    expect(firsts([message('a', 0), message('b', 10, 'out', 'me')])).toEqual([true, true]);
  });

  it('splits on a day boundary', () => {
    const rows = groupMessages([message('a', 60), message('b', 150)], 'UTC');
    expect(rows.map((row) => [row.startsDay, row.isFirstInGroup, row.isLastInGroup])).toEqual([
      [true, true, true],
      [true, true, true],
    ]);
  });
});
