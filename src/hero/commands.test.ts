import { describe, expect, it } from 'vitest';
import { parseOutgoing } from './commands';

describe('parseOutgoing', () => {
  it('reads /me as an action', () => {
    expect(parseOutgoing('/me waves')).toEqual({ kind: 'me', body: '/me waves', egg: false });
    expect(parseOutgoing('/meow').kind).toBe('text');
  });

  it('triggers the egg on whole words only', () => {
    expect(parseOutgoing('Quack!').egg).toBe(true);
    expect(parseOutgoing('quackers').egg).toBe(false);
  });
});
