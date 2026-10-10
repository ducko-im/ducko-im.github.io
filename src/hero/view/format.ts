import type { HeroState } from '../types';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Building a formatter costs far more than formatting with one, and every paint formats each message. */
export function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, cached);
  }
  return cached;
}

export function formatTime(time: number, { locale, timeZone }: HeroState['format']): string {
  return formatter(locale, { timeStyle: 'short', timeZone }).format(time);
}

export function formatDay(time: number, { locale, timeZone }: HeroState['format']): string {
  return formatter(locale, { dateStyle: 'medium', timeZone }).format(time);
}
