import { type ContactId, type ConversationId, ME } from './data';
import type { Presence } from './types';

/** What a visitor's message can be about, most specific first. */
export type Intent =
  | 'bring'
  | 'notComing'
  | 'coming'
  | 'when'
  | 'where'
  | 'howAreYou'
  | 'thanks'
  | 'sorry'
  | 'bye'
  | 'greeting'
  | 'coffee'
  | 'food'
  | 'pond'
  | 'gym'
  | 'work'
  | 'weather'
  | 'app'
  | 'laugh'
  | 'yes'
  | 'no'
  | 'question'
  | 'emoji';

/**
 * A line said by the conversation's own voice (the contact, or a random room participant), or `[nickname, body]` for a
 * room. `{item}` stands for the thing the visitor said they'd bring.
 */
export type Line = string | readonly [sender: string, body: string];

export interface Persona {
  /** How many replies the visitor gets before the conversation signs off. */
  budget: number;
  lines: Partial<Record<Intent, Line[]>>;
  /** What the conversation brings up on its own, in order: the storyline's lines and the reply when nothing else fits. */
  beats: Line[];
  signOff: Line;
  /** The first reply while Away or Extended Away. */
  away?: Line;
  /** The first reply while Do Not Disturb. The next reply brings them out with `arrive`. */
  dnd?: Line;
  /** Said once, when they come online: after a message signs them on, out of Do Not Disturb, or at a storyline `announce`. */
  arrive?: Line;
}

export type HookKind = Extract<Intent, 'bring' | 'coming' | 'notComing'>;

/**
 * What the visitor can say they'll bring: a message counts as `bring` only when it names one, and the relay repeats it.
 * Bread is left out: the room has views on bread.
 */
export const HOOK_ITEMS = [
  'cake',
  'cookies',
  'coffee',
  'tea',
  'snacks',
  'crisps',
  'pretzels',
  'peas',
  'oats',
  'pizza',
  'lemonade',
  'drinks',
  'strawberries',
  'music',
];

export const EGG_LINES = ['Quack quack! 🦆', 'Did someone say duck? 🦆🦆', 'Adium walked so Ducko could waddle 🦆', 'QUACK. (That means hi.)'];

export const PERSONAS: Record<ConversationId, Persona> = {
  lena: {
    budget: 8,
    lines: {
      bring: ["{item}?! You're the best 🙌"],
      notComing: ['Nooo 😢 Next time then!'],
      coming: ['Yay, see you at six! 🎉'],
      when: ['Six! By the reeds, near the bench.', "Six-ish. Ducks don't wear watches 😄"],
      where: ['The bench by the reeds. Where the heron hangs out.', 'Same spot as last time 📍'],
      howAreYou: ['Good! Sunburnt nose, happy ducks 🦆', 'Still good. Counting down to six.'],
      thanks: ['Any time 😊'],
      sorry: ['No worries at all!'],
      greeting: ['Hey you 👋', 'Hi again 😄'],
      coffee: ['Oat flat white for me, please ☕️', "You're a hero. Bring the big thermos."],
      food: ['Jonas has snacks covered. Allegedly 😅', "I'm bringing strawberries 🍓"],
      pond: ['The ducklings are SO big now 🐣', 'Peas only, Kai will check 😄'],
      weather: ['Sun till eight, I checked twice ☀️'],
      work: ["No work talk at the pond, that's the rule 😄"],
      app: ['Wait, is this Ducko? It looks so Mac 😍'],
      laugh: ['😂', "Stop, I'm crying 😂"],
      yes: ['Yay! 🎉', 'Perfect 👌'],
      no: ['Oh no 😢', 'Fair enough!'],
      question: ['Hmm, good question 🤔', 'Ask me again at the pond 😄'],
      emoji: ['😄'],
    },
    beats: ['Kai says the heron is back 🪶', 'Do you have a blanket? Mine has a duck-sized hole 😅', 'Leaving in a bit, see you there!'],
    signOff: 'Okay, heading to the pond now. See you at six! 🦆',
  },
  jonas: {
    budget: 6,
    lines: {
      bring: ["{item}? Nice, then I'll skip the extra pretzels"],
      notComing: ['Booo. More snacks for me then 😄'],
      coming: ["Let's gooo 🙌"],
      when: ["Six, Lena said. I'll be late, as is tradition."],
      where: ['The reeds. Follow the quacking.'],
      howAreYou: ['Sore. Leg day 🦵', 'Alive. Barely 😅'],
      thanks: ['Anytime 👊'],
      sorry: ['All good!'],
      greeting: ['Yo! 👊', 'Yo again'],
      coffee: ['Coffee after leg day? Bold.'],
      food: ['Snacks are handled, relax 😄', "I'm bringing peas for the ducks too 🫛"],
      gym: ['Leg day. Do not ask me to walk far 🦵', 'Come with me next week, I dare you 💪'],
      pond: ["If a duck steals my pretzel again, I'm done."],
      laugh: ['😂😂', 'lol'],
      yes: ['👍', 'Bet.'],
      no: ['Fair.'],
      question: ['No clue tbh 🤷'],
      emoji: ['💪'],
    },
    beats: ['Crisps or pretzels for tonight?', 'Got both. Crisps AND pretzels 🥨', 'Lena says six sharp. So 6:20 for me 😄'],
    signOff: 'Showering, then pond. Laters 👋',
    away: 'Mid-set 💪 Back in 10',
  },
  noah: {
    budget: 5,
    lines: {
      bring: ['{item}, nice. Save me some?'],
      notComing: ["Ah, then I'm skipping too 😅"],
      coming: ["Ok ok, then I'm coming too"],
      when: ["Six? I'll try to make it 🤞"],
      where: ['The pond, I assume? 😄'],
      howAreYou: ['Tired but good. Long day.'],
      thanks: ['np!'],
      greeting: ['Hey! 👋'],
      food: ['I could eat. I can always eat.'],
      pond: ["Haven't been to the pond in ages"],
      laugh: ['haha'],
      yes: ['Cool cool'],
      no: ['Ah ok'],
      question: ['Not sure tbh'],
    },
    beats: ['Did I miss anything important?', 'Ok, reading the Pond Club backlog now 😅', 'Charging my phone, then I might come by 🔋'],
    signOff: "Battery at 2%, I'm out. Later! 🔋",
    arrive: 'Sorry, just saw this! Phone was dead 🔋',
  },
  priya: {
    budget: 6,
    lines: {
      bring: ['{item}? Count me in then 😄'],
      notComing: ['Next time!'],
      coming: ['Have fun tonight! 🦆'],
      when: ["I'm free after 4 if you need me"],
      howAreYou: ['Brain fried, but the migration is done 🎉'],
      thanks: ['Of course!'],
      sorry: ['No worries!'],
      greeting: ['Hey! 👋'],
      coffee: ['Coffee is the only reason I survived today ☕️'],
      pond: ['The pond thing at six? I might swing by 🦆'],
      work: ['The migration finally passed. All green ✅', "Marco's on your PR, right? He's thorough 😅"],
      laugh: ['😂'],
      yes: ['Great 👍'],
      no: ['Ok!'],
      question: ['Let me check and get back to you'],
    },
    beats: ['Standup notes are in the doc, by the way 📝', 'Your PR passed CI, did you see? ✅', 'Might come to the pond if the deploy behaves 🤞'],
    signOff: 'Logging off for today. Have fun at the pond! 🦆',
    dnd: 'Heads down till 3, will reply properly after 🦉',
    arrive: "Surfaced! 🦉 What's up?",
  },
  marco: {
    budget: 6,
    lines: {
      bring: ['{item}? Save me some 😄'],
      notComing: ['Next time then!'],
      coming: ['Have fun! 🦆'],
      howAreYou: ['Good! Drowning in reviews, as usual 😅'],
      thanks: ['Prego 😄'],
      sorry: ['No problem at all'],
      greeting: ['Ciao! 👋'],
      coffee: ['Espresso, please. Just one. Ok, two ☕️'],
      food: ['Did someone say snacks? 👀'],
      pond: ['The pond thing? I might come after the release 🤞'],
      work: ['The nit: duck typing works until it quacks like a goose 🪿', 'Two comments, nothing blocking 👍', 'Tests are green on my side ✅'],
      app: ['Is this the new XMPP client? Very slick 👀'],
      laugh: ['😂'],
      yes: ['Perfect 👌'],
      no: ['Ok, fair'],
      question: ['Let me look and get back to you 👀'],
    },
    beats: ['Saw your fix for the nit 👀', 'Approved ✅ Merge when ready.', "And it's merged 🚀 Nice one."],
    signOff: "Release is out, I'm logging off. Ciao! 👋",
  },
  'pond-club': {
    budget: 8,
    lines: {
      bring: [['Kai', '{item}! Nice 🙌']],
      notComing: [['Kai', 'Boo 😢 The ducks will miss you']],
      coming: [['Amara', 'Yay, the more the merrier 🎉']],
      when: [['Kai', "Six! Lena's organizing 🦆"]],
      where: [['Mateo', 'By the reeds, near the bench']],
      howAreYou: [['Mateo', 'Living the pond life 😎']],
      thanks: [['Amara', '🙌']],
      greeting: [
        ['Kai', `Hey ${ME.name} 👋`],
        ['Amara', 'Hi! 🦆'],
      ],
      food: [['Amara', "Defrosted peas are a duck's dream"]],
      pond: [
        ['Kai', 'Peas. Not bread. I will check bags 🫛'],
        ['Mateo', 'The heron is back, by the way 🪶'],
      ],
      weather: [['Mateo', 'Sunny till eight ☀️']],
      laugh: [['Amara', '😂']],
      yes: [['Kai', '👍']],
      question: [['Mateo', 'Good question 🤔']],
    },
    beats: [
      ['Amara', 'Who has a spare blanket?'],
      ['Mateo', 'I can bring my speaker 🎶'],
      ['Kai', 'Reminder: PEAS 🫛'],
      ['Amara', "Saw the ducklings this morning, they're huge 🐣"],
      ['Mateo', 'Leaving in 20!'],
    ],
    signOff: ['Kai', 'Right, off to the pond. Later all 👋'],
  },
};

/** Who passes on a plan heard in another conversation, in order of preference. */
export const RELAYS: Record<HookKind, [ConversationId, Line][]> = {
  bring: [
    ['jonas', "Heard you're bringing {item}? Legend 🙌"],
    ['lena', "Heard you're bringing {item}! 🙌"],
    ['pond-club', ['Amara', "Heard someone's bringing {item} 👀"]],
  ],
  coming: [
    ['pond-club', ['Mateo', `Heard ${ME.name} is coming tonight 🎉`]],
    ['lena', "Heard you're coming! 🎉"],
    ['noah', "Heard you're going tonight? Might join 👀"],
  ],
  notComing: [
    ['lena', "Heard you can't make it tonight 😢"],
    ['pond-club', ['Kai', `Heard ${ME.name} is skipping tonight 😢`]],
  ],
};

export type StoryStep =
  | { say: ConversationId }
  | {
      presence: ContactId;
      to: [Presence, string | null];
      /** Also says the contact's `arrive` line. */
      announce?: boolean;
    };

/** The afternoon the ambient stream plays once: the six o'clock pond meetup coming together. */
export const STORY: StoryStep[] = [
  { say: 'pond-club' },
  { say: 'jonas' },
  { presence: 'noah', to: ['available', null] },
  { say: 'lena' },
  { say: 'marco' },
  { say: 'pond-club' },
  { say: 'noah' },
  { presence: 'priya', to: ['available', null], announce: true },
  { say: 'jonas' },
  { presence: 'jonas', to: ['available', 'Back from the gym'] },
  { say: 'pond-club' },
  { say: 'priya' },
  { say: 'lena' },
  { say: 'marco' },
  { say: 'noah' },
  { say: 'pond-club' },
  { say: 'jonas' },
  { say: 'priya' },
  { say: 'marco' },
  { say: 'pond-club' },
  { say: 'lena' },
  { say: 'noah' },
];
