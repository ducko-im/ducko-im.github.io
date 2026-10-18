import { site } from '../data/site';

export interface AppcastItem {
  version: string;
  minimumSystemVersion: string;
  hardwareRequirements: string;
}

export interface Release extends AppcastItem {
  dmgUrl: string;
  releaseUrl: string;
  requirements: string;
}

const HARDWARE_NAMES: Record<string, string> = { arm64: 'Apple Silicon' };

function readTag(item: string, tag: string): string {
  const value = item.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1].trim();
  if (!value) throw new Error(`Appcast item has no <${tag}>`);
  return value;
}

export function parseAppcast(xml: string): AppcastItem {
  const item = xml.match(/<item>([\s\S]*?)<\/item>/)?.[1];
  if (!item) throw new Error('Appcast has no <item>');
  return {
    version: readTag(item, 'sparkle:shortVersionString'),
    minimumSystemVersion: readTag(item, 'sparkle:minimumSystemVersion'),
    hardwareRequirements: readTag(item, 'sparkle:hardwareRequirements'),
  };
}

export function formatSystemVersion(version: string): string {
  return version.replace(/(\.0)+$/, '');
}

export function toRelease(item: AppcastItem): Release {
  const hardware = HARDWARE_NAMES[item.hardwareRequirements] ?? item.hardwareRequirements;
  return {
    ...item,
    dmgUrl: `${site.repoUrl}/releases/download/${item.version}/Ducko-${item.version}.dmg`,
    releaseUrl: `${site.repoUrl}/releases/tag/${item.version}`,
    requirements: `macOS ${formatSystemVersion(item.minimumSystemVersion)} or later · ${hardware}`,
  };
}

const EXPECTED_VERSION_ATTEMPTS = 40;
const EXPECTED_VERSION_DELAY_MS = 15_000;

async function fetchAppcast(): Promise<string> {
  const response = await fetch(site.appcastUrl).catch((cause: unknown) => {
    throw new Error(`Fetching the appcast failed (${site.appcastUrl})`, { cause });
  });
  if (!response.ok) throw new Error(`Fetching the appcast failed: ${response.status} ${response.statusText} (${site.appcastUrl})`);
  return response.text();
}

// Ducko's release workflow passes the version it just published as DUCKO_VERSION.
// raw.githubusercontent.com caches the appcast for up to five minutes, so wait until it lists that version.
export async function getLatestRelease(): Promise<Release> {
  const expectedVersion = process.env.DUCKO_VERSION;
  for (let attempt = 1; ; attempt++) {
    const release = toRelease(parseAppcast(await fetchAppcast()));
    if (!expectedVersion || release.version === expectedVersion) return release;
    if (attempt === EXPECTED_VERSION_ATTEMPTS) {
      throw new Error(`The appcast still lists ${release.version} instead of ${expectedVersion} (${site.appcastUrl})`);
    }
    await new Promise((resolve) => setTimeout(resolve, EXPECTED_VERSION_DELAY_MS));
  }
}
