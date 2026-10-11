import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import manifest from '../../../reference/states.json';
import { WINDOW_SIZES } from '../../hero/data';
import { CONTENT_VERSION, type Content, stateFor } from '../../hero/fixtures';
import type { HeroState, HeroWindow } from '../../hero/types';

export type Appearance = 'light' | 'dark';
export type LabWindow = HeroWindow | 'dock';

interface Size {
  width: number;
  height: number;
}

interface Rect extends Size {
  x: number;
  y: number;
}

interface CaptureEntry {
  id: string;
  appearance: Appearance;
  window: LabWindow;
  file: string;
  size: Size;
  layers: { kind: 'menu'; file: string; offset: { x: number; y: number }; size: Size }[];
  tileSize?: number;
  iconRect?: Rect;
}

interface CaptureJson {
  displayScale: number;
  content: { version: number; sha256: string };
  captures: CaptureEntry[];
  skipped: { id: string; appearance: Appearance; reason: string }[];
}

export interface Capture {
  src: string;
  size: Size;
  layers: { src: string; rect: Rect }[];
  tileSize?: number;
  iconRect?: Rect;
}

/** Where a state's web window and capture sit in a frame that holds the window and any menu layer reaching past it. */
export interface Layout {
  frame: Size;
  window: Rect;
  /** The icon artwork's rect, inside the Dock tile. */
  icon: Rect;
}

const DIR = resolve('reference/captures');
const DOCK_TILE = 128;

function readJson<T>(name: string, problems: string[]): { json: T; text: string } | null {
  const file = resolve(DIR, name);
  if (!existsSync(file)) {
    problems.push(`${name} is missing`);
    return null;
  }
  const text = readFileSync(file, 'utf8');
  try {
    return { json: JSON.parse(text), text };
  } catch (error) {
    problems.push(`${name} is not valid JSON: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Reads and validates the local capture set. Captures are served from disk by Vite's /@fs/ route and never enter the
 * module graph, so no capture can reach a build.
 */
export function loadCaptures() {
  const problems: string[] = [];
  const captureJson = readJson<CaptureJson>('capture.json', problems)?.json;
  const contentFile = readJson<Content>('content.json', problems);
  const content = contentFile?.json ?? null;
  const captures = new Map<string, Capture>();

  if (captureJson) {
    const scale = captureJson.displayScale;
    const source = (name: string, size: Size): string | null => {
      const file = resolve(DIR, name);
      if (!existsSync(file)) {
        problems.push(`${name} is missing`);
        return null;
      }
      const header = readFileSync(file).subarray(16, 24);
      const [width, height] = [header.readUInt32BE(0), header.readUInt32BE(4)];
      if (width !== Math.round(size.width * scale) || height !== Math.round(size.height * scale)) {
        problems.push(`${name} is ${width}×${height} px, expected ${size.width}×${size.height} pt at ${scale}×`);
      }
      return `/@fs${file}`;
    };
    for (const entry of captureJson.captures) {
      if (entry.window === 'dock' && (entry.tileSize === undefined || entry.iconRect === undefined)) problems.push(`${entry.file} has no tileSize or iconRect`);
      const src = source(entry.file, entry.size);
      const layers = entry.layers.flatMap((layer) => {
        const layerSrc = source(layer.file, layer.size);
        return layerSrc ? [{ src: layerSrc, rect: { ...layer.offset, ...layer.size } }] : [];
      });
      if (src) captures.set(`${entry.id}.${entry.appearance}`, { src, size: entry.size, layers, tileSize: entry.tileSize, iconRect: entry.iconRect });
    }
    for (const { id, appearance, reason } of captureJson.skipped) problems.push(`${id} (${appearance}) was skipped: ${reason}`);
    for (const state of manifest.states) {
      for (const appearance of state.appearances) {
        const listed = [...captureJson.captures, ...captureJson.skipped].some((c) => c.id === state.id && c.appearance === appearance);
        if (!listed) problems.push(`${state.id} (${appearance}) has no capture`);
      }
    }
    const sha256 = contentFile && createHash('sha256').update(contentFile.text).digest('hex');
    if (sha256 && sha256 !== captureJson.content.sha256)
      problems.push(`content.json has SHA-256 ${sha256}, but capture.json records ${captureJson.content.sha256}`);
  }
  if (content && content.version !== CONTENT_VERSION)
    problems.push(`content.json is version ${content.version}; the fixtures support version ${CONTENT_VERSION}`);

  return { problems, content, capture: (id: string, appearance: Appearance) => captures.get(`${id}.${appearance}`) ?? null };
}

type Captures = ReturnType<typeof loadCaptures>;

/** macOS draws an app icon's artwork at 824/1024 of its Dock tile, centered. */
function artwork(tile: Rect): Rect {
  const inset = (tile.width * 100) / 1024;
  return { x: tile.x + inset, y: tile.y + inset, width: tile.width - 2 * inset, height: tile.height - 2 * inset };
}

function layoutFor(window: LabWindow, capture: Capture | null): Layout {
  const size = capture?.size ?? (window === 'dock' ? { width: DOCK_TILE, height: DOCK_TILE } : WINDOW_SIZES[window]);
  const rects = [{ x: 0, y: 0, ...size }, ...(capture?.layers.map((layer) => layer.rect) ?? [])];
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  return {
    frame: { width: Math.max(...rects.map((r) => r.x + r.width)) - left, height: Math.max(...rects.map((r) => r.y + r.height)) - top },
    window: { x: -left, y: -top, ...size },
    icon: artwork(capture?.iconRect ?? { x: 0, y: 0, width: DOCK_TILE, height: DOCK_TILE }),
  };
}

/** Builds a state's fixture, or the reason it can't be built, so one broken state never takes down the page. */
function labState(id: string, window: LabWindow, captures: Captures, layout: Layout): { state: HeroState } | { error: string } {
  if (!captures.content) return { error: 'content.json could not be read' };
  try {
    return { state: stateFor(id, captures.content, window === 'chat' ? layout.window.width : WINDOW_SIZES.chat.width) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export function labCase(captures: Captures, id: string, window: LabWindow, appearance: Appearance) {
  const capture = captures.capture(id, appearance);
  const layout = layoutFor(window, capture);
  return { capture, layout, built: labState(id, window, captures, layout) };
}

export function sizeStyle({ width, height }: Size): string {
  return `width:${width}px;height:${height}px`;
}

export function box(rect: Rect): string {
  return `left:${rect.x}px;top:${rect.y}px;${sizeStyle(rect)}`;
}
