import { describe, expect, it } from 'vitest';
import { visibleTabCount } from './tabs';

describe('visibleTabCount', () => {
  it.each([
    [496, 5, 5],
    [496, 6, 5],
    [384, 4, 4],
    [300, 3, 3],
    [100, 3, 1],
    [0, 3, 3],
  ])('fits %i px with %i tabs to %i', (available, count, expected) => {
    expect(visibleTabCount(available, count)).toBe(expected);
  });
});
