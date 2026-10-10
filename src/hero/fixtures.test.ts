import { describe, expect, it } from 'vitest';
import manifest from '../../reference/states.json';
import { FIXTURE_IDS, stateFor } from './fixtures';

/** States that show the hero exactly as it loads. */
const DEFAULT_STATES = ['chat-key', 'chat-read', 'contacts-selected-inactive', 'dock-badge'];

describe('fixtures', () => {
  it('cover exactly the manifest states', () => {
    expect([...FIXTURE_IDS].sort()).toEqual(manifest.states.map((state) => state.id).sort());
  });

  it('keeps a fixture’s draft to its own conversation', () => {
    const { conversations } = stateFor('chat-input-filled');
    expect(conversations.lena.composer.draft).not.toBe('');
    expect(conversations.marco.composer.draft).toBe('');
  });

  it.each(FIXTURE_IDS)('builds %s, which differs from the default state unless it is one', (id) => {
    const defaultState = stateFor('chat-key');
    if (DEFAULT_STATES.includes(id)) expect(stateFor(id)).toEqual(defaultState);
    else expect(stateFor(id)).not.toEqual(defaultState);
  });
});
