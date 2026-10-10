import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatSystemVersion, getLatestRelease, parseAppcast, toRelease } from './release';

const appcast = readFileSync(new URL('./__fixtures__/appcast.xml', import.meta.url), 'utf8');

describe('parseAppcast', () => {
  it('reads the newest item of the real appcast', () => {
    const release = toRelease(parseAppcast(appcast));
    expect(release).toEqual({
      version: '0.8.0',
      minimumSystemVersion: '26.0',
      hardwareRequirements: 'arm64',
      dmgUrl: 'https://github.com/ducko-im/ducko/releases/download/0.8.0/Ducko-0.8.0.dmg',
      releaseUrl: 'https://github.com/ducko-im/ducko/releases/tag/0.8.0',
      requirements: 'macOS 26 or later · Apple Silicon',
    });
  });

  it('throws when the first item has no short version', () => {
    const broken = appcast.replace('<sparkle:shortVersionString>0.8.0</sparkle:shortVersionString>', '');
    expect(() => parseAppcast(broken)).toThrow('shortVersionString');
  });

  it('throws when the short version is blank', () => {
    const blank = appcast.replace(
      '<sparkle:shortVersionString>0.8.0</sparkle:shortVersionString>',
      '<sparkle:shortVersionString>   </sparkle:shortVersionString>',
    );
    expect(() => parseAppcast(blank)).toThrow('shortVersionString');
  });
});

describe('getLatestRelease', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fails instead of falling back when the fetch is rejected', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('fetch failed')));
    await expect(getLatestRelease()).rejects.toThrow('Fetching the appcast failed');
  });

  it('fails on an error response', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(appcast, { status: 500, statusText: 'Internal Server Error' })));
    await expect(getLatestRelease()).rejects.toThrow('500');
  });

  it('reads the release from a good response', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(appcast)));
    await expect(getLatestRelease()).resolves.toMatchObject({ version: '0.8.0' });
  });
});

describe('formatSystemVersion', () => {
  it('trims trailing zero components', () => {
    expect(formatSystemVersion('26.0')).toBe('26');
    expect(formatSystemVersion('26.1')).toBe('26.1');
    expect(formatSystemVersion('26.1.2')).toBe('26.1.2');
  });
});
