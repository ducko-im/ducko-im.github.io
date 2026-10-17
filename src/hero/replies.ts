import { EGG_LINES, HOOK_ITEMS, type HookKind, type Intent, type Line, PERSONAS, type Persona, RELAYS } from './script';

/** How the contact's presence shapes the next reply. `arriving` is the reply right after a message brought them online. */
export type Situation = 'available' | 'away' | 'dnd' | 'arriving';

export interface Said {
  sender: string;
  body: string;
}

interface Reply extends Said {
  /** The contact leaves Do Not Disturb with this reply. */
  arrives: boolean;
  signsOff: boolean;
}

/** A line the conversation will say after a moment's typing. `take` claims it on delivery, and refuses once a reply has said it. */
export interface Offer {
  said: Said;
  take(): boolean;
}

const ITEM = new RegExp(`\\b(${HOOK_ITEMS.join('|')})\\b`);

/** In priority order: the first intent with an unused line answers. */
const PATTERNS: [Intent, RegExp][] = [
  ['bring', /\b(bring|bringing|grab|grabbing|get|getting|make|making|bake|baking)\b/],
  ['notComing', /\b(can'?t (make it|come)|cannot (make it|come)|not coming|won'?t (make it|be there)|skip(ping)? (it|tonight)|i'?m out)\b/],
  ['coming', /\b(i'?m in|count me in|i'?ll (be there|come)|i'?m coming|see you (there|at six|tonight)|on my way|omw)\b/],
  ['when', /\b(what time|when)\b/],
  ['where', /\bwhere\b/],
  ['howAreYou', /\b(how are (you|u|things)|how'?s it going|how r u|hru|what'?s up|what'?s new|how have you been|how'?s your day)\b/],
  ['thanks', /\b(thanks|thank you|thx|ty|cheers)\b/],
  ['sorry', /\b(sorry|my bad|apologies|oops)\b/],
  ['bye', /\b(bye|cya|see ya|ttyl|gotta (go|run)|good ?night|(talk|speak|chat) (to you )?later)\b/],
  ['greeting', /^(hi|hey|heya|hello|hiya|yo|howdy|sup|morning|good (morning|afternoon|evening))\b|\bhello\b/],
  ['coffee', /\b(coffee|latte|espresso|cappuccino|flat white|thermos|tea)\b/],
  ['food', /\b(snacks?|crisps|chips|pretzels?|food|hungry|eat|pizza|lunch|dinner|cake|cookies|strawberr(y|ies))\b/],
  ['pond', /\b(pond|ducks|ducklings?|peas|oats|bread|heron|swans?|geese|reeds|bench|picnic)\b/],
  ['gym', /\b(gym|workout|leg day|lifting|training|running|exercise)\b/],
  ['work', /\b(pr|pull request|review|code|bug|merge|deploy|nit|ci|tests?|release|migration|standup|meeting|work)\b/],
  ['weather', /\b(weather|rain|raining|sun|sunny|cold|warm|hot|sunset)\b/],
  ['app', /\b(ducko|xmpp|jabber|app|mac|messenger|client)\b/],
  ['laugh', /\b(haha+|hehe+|lol|lmao|rofl)\b|😂|🤣|😆/u],
  ['yes', /^(yes|yeah|yep|yup|sure|ok|okay|sounds good|deal|definitely|of course|absolutely)\b|^👍/u],
  ['no', /^(no|nope|nah|not really)\b/],
  ['question', /\?/],
];

/** What the visitor's text is about, most specific first, and the hook item it names, if any. English only. */
function intentsOf(text: string): { intents: Intent[]; item: string | null } {
  const normalized = text.toLowerCase().replaceAll('’', "'").trim();
  const item = ITEM.exec(normalized)?.[1] ?? null;
  const intents = PATTERNS.filter(([intent, pattern]) => pattern.test(normalized) && (intent !== 'bring' || item !== null)).map(([intent]) => intent);
  if (intents.length === 0 && !/[\p{L}\p{N}]/u.test(normalized)) intents.push('emoji');
  return { intents, item };
}

function fill(body: string, item: string | null): string {
  if (item === null) return body;
  return body.replace('{item}', body.startsWith('{item}') ? item.charAt(0).toUpperCase() + item.slice(1) : item);
}

/**
 * What each conversation has left to say. A conversation says each of its lines at most once per visit, and the duck
 * lines are said once across all of them. A conversation signs off at a goodbye, or once its budget or its material
 * runs out. `voice` says the lines that name no sender: the contact, or a room participant.
 */
export function createReplyBook(voice: (conversationId: string) => string) {
  const personas: Record<string, Persona> = PERSONAS;
  const taken = new Map<string, Set<Line>>();
  const ducksTaken = new Set<Line>();
  const replies = new Map<string, number>();
  const signedOff = new Set<string>();
  const hooks = new Map<HookKind, { item: string | null; from: string }>();
  const relayed = new Set<HookKind>();

  function takenIn(id: string): Set<Line> {
    let lines = taken.get(id);
    if (!lines) taken.set(id, (lines = new Set()));
    return lines;
  }

  function take(lines: readonly (Line | undefined)[], from: Set<Line>): Line | undefined {
    const line = lines.find((l) => l !== undefined && !from.has(l));
    if (line !== undefined) from.add(line);
    return line;
  }

  function said(id: string, line: Line, item: string | null = null): Said {
    return typeof line === 'string' ? { sender: voice(id), body: fill(line, item) } : { sender: line[0], body: fill(line[1], item) };
  }

  function answer(
    id: string,
    line: Line,
    { item = null, arrives = false, signsOff = false }: Partial<Pick<Reply, 'arrives' | 'signsOff'>> & { item?: string | null } = {},
  ): Reply {
    return { ...said(id, line, item), arrives, signsOff };
  }

  function signOff(id: string): Reply {
    signedOff.add(id);
    return answer(id, personas[id].signOff, { signsOff: true });
  }

  function offer(id: string, line: Line | undefined, item: string | null = null, hook?: HookKind): Offer | null {
    if (line === undefined || signedOff.has(id) || takenIn(id).has(line)) return null;
    return {
      said: said(id, line, item),
      take() {
        if (signedOff.has(id) || takenIn(id).has(line) || (hook && relayed.has(hook))) return false;
        takenIn(id).add(line);
        if (hook) relayed.add(hook);
        return true;
      },
    };
  }

  return {
    isSignedOff: (id: string) => signedOff.has(id),

    reply(id: string, text: string, situation: Situation, egg: boolean): Reply {
      const persona = personas[id];
      const lines = takenIn(id);
      const count = (replies.get(id) ?? 0) + 1;
      replies.set(id, count);

      if (situation === 'dnd') {
        const dnd = take([persona.dnd], lines);
        if (dnd !== undefined) return answer(id, dnd);
        const arrive = take([persona.arrive], lines);
        if (arrive !== undefined) return answer(id, arrive, { arrives: true });
      }
      if (situation === 'away' || situation === 'arriving') {
        const first = take([situation === 'away' ? persona.away : persona.arrive], lines);
        if (first !== undefined) return answer(id, first);
      }

      const { intents, item } = intentsOf(text);
      if (count > persona.budget || intents.includes('bye')) return signOff(id);
      const duck = egg ? take(EGG_LINES, ducksTaken) : undefined;
      if (duck !== undefined) return answer(id, duck);
      for (const intent of intents) {
        const line = take(persona.lines[intent] ?? [], lines);
        if (line !== undefined) return answer(id, line, { item });
      }
      const beat = take(persona.beats, lines);
      return beat === undefined ? signOff(id) : answer(id, beat);
    },

    /** The conversation's next beat, or null once it has signed off or has none left. */
    beat(id: string): Offer | null {
      const lines = takenIn(id);
      return offer(
        id,
        personas[id].beats.find((line) => !lines.has(line)),
      );
    },

    /** The conversation's `arrive` line, or null once it was said or the conversation signed off. */
    arrival(id: string): Offer | null {
      return offer(id, personas[id].arrive);
    },

    /** Notes a plan the visitor mentioned, for another conversation to pick up. Only the first of each counts, and coming or not is one plan. */
    hear(id: string, text: string) {
      const { intents, item } = intentsOf(text);
      if (intents.includes('bring') && !hooks.has('bring')) hooks.set('bring', { item, from: id });
      const plan = (['notComing', 'coming'] as const).find((kind) => intents.includes(kind));
      if (plan && !hooks.has('coming') && !hooks.has('notComing')) hooks.set(plan, { item: null, from: id });
    },

    /** Offers a heard plan to the first conversation that can speak, never back to where it was said. It stays heard until one takes it. */
    relay(canSpeak: (id: string) => boolean): (Offer & { conversationId: string }) | null {
      for (const [kind, { item, from }] of hooks) {
        if (relayed.has(kind)) continue;
        const target = RELAYS[kind].find(([id]) => id !== from && canSpeak(id));
        const offered = target && offer(target[0], target[1], item, kind);
        if (offered) return { conversationId: target[0], ...offered };
      }
      return null;
    },
  };
}
