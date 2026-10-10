export const ACTION_PREFIX = '/me ';

export function isAction(body: string): boolean {
  return body.startsWith(ACTION_PREFIX);
}

export interface Outgoing {
  kind: 'text' | 'me';
  body: string;
  egg: boolean;
}

export function parseOutgoing(text: string): Outgoing {
  const body = text.trim();
  const kind = isAction(body) ? 'me' : 'text';
  const egg = /\b(quack|duck|adium)\b/i.test(body);
  return { kind, body, egg };
}
