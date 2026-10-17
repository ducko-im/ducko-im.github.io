import { describe, expect, it } from 'vitest';
import { type Situation, createReplyBook } from './replies';
import { EGG_LINES, PERSONAS } from './script';

const { lena, jonas, noah } = PERSONAS;

function setup() {
  const book = createReplyBook((id) => id);
  return {
    book,
    reply: (id: string, text: string, situation: Situation = 'available') => book.reply(id, text, situation, false),
    relay: () => book.relay(() => true),
  };
}

describe('createReplyBook', () => {
  it('answers what a message is about, the most specific first', () => {
    const { reply } = setup();
    expect(reply('lena', 'Hey, how are you?').body).toBe(lena.lines.howAreYou![0]);
    expect(reply('lena', 'Thanks! See you at six').body).toBe(lena.lines.coming![0]);
    expect(reply('lena', '🦆🦆').body).toBe(lena.lines.emoji![0]);
  });

  it('moves on to its own topics when nothing fits, German included', () => {
    const { reply } = setup();
    expect(reply('lena', 'Hallo, wie geht es dir').body).toBe(lena.beats[0]);
    expect(reply('lena', 'I’ll bring my sister').body).toBe(lena.beats[1]);
  });

  it('never says the same line twice in a conversation, and keeps each conversation’s lines its own', () => {
    const { reply } = setup();
    const bodies = ['what time?', 'what time?', 'what time?', 'what time?', 'what time?'].map((text) => reply('lena', text).body);
    expect(bodies).toEqual([...lena.lines.when!, ...lena.lines.question!, lena.beats[0]]);
    expect(reply('lena', 'haha').body).toBe('😂');
    expect(reply('marco', 'haha').body).toBe('😂');
  });

  it('fills in the item, capitalized at the start, and leaves other lines as written', () => {
    const { reply } = setup();
    expect(reply('lena', 'I’ll bring cake').body).toBe("Cake?! You're the best 🙌");
    expect(reply('noah', 'lol').body).toBe('haha');
  });

  it('signs off past its budget, or once its material runs out', () => {
    const chatty = setup();
    const texts = ['hi', 'how are you?', 'thanks', 'sorry', 'where?', 'coffee', 'haha', 'yes'];
    texts.forEach((text) => expect(chatty.reply('lena', text).signsOff).toBe(false));
    expect(chatty.reply('lena', 'nice weather')).toMatchObject({ body: lena.signOff, signsOff: true });
    expect(chatty.book.isSignedOff('lena')).toBe(true);

    const quiet = setup();
    const gibberish = ['asdf', 'qwer', 'zxcv', 'uiop'].map((text) => quiet.reply('noah', text).body);
    expect(gibberish).toEqual([...noah.beats, noah.signOff]);
  });

  it('opens with the away line once, and says the arrival line once however it comes up', () => {
    const { book, reply } = setup();
    expect(reply('jonas', 'hi', 'away').body).toBe(jonas.away);
    expect(reply('jonas', 'hi', 'away').body).toBe(jonas.lines.greeting![0]);
    expect(reply('noah', 'hi', 'arriving').body).toBe(noah.arrive);
    expect(book.arrival('noah')).toBeNull();
  });

  it('says each duck line once across every conversation', () => {
    const { book } = setup();
    const ducks = ['lena', 'jonas', 'marco', 'priya', 'lena'].map((id) => book.reply(id, 'quack', 'available', true).body);
    expect(ducks.slice(0, 4)).toEqual(EGG_LINES);
    expect(EGG_LINES).not.toContain(ducks[4]);
  });

  it('refuses an offered beat once a reply has said it', () => {
    const { book, reply } = setup();
    const offer = book.beat('noah')!;
    expect(reply('noah', 'asdf').body).toBe(offer.said.body);
    expect(offer.take()).toBe(false);
    expect(book.beat('noah')!.said.body).toBe(noah.beats[1]);
  });

  it('offers a heard plan until one conversation takes it, never back to where it was said', () => {
    const { book, relay } = setup();
    book.hear('jonas', 'I’ll bring cake');
    expect(book.relay(() => false)).toBeNull();
    const offer = relay()!;
    expect(offer).toMatchObject({ conversationId: 'lena', said: { sender: 'lena', body: "Heard you're bringing cake! 🙌" } });
    expect(relay()?.conversationId).toBe('lena');
    expect(offer.take()).toBe(true);
    expect(relay()).toBeNull();
  });

  it('takes the first of coming or not coming as the plan', () => {
    const { book, relay } = setup();
    book.hear('lena', 'count me in');
    book.hear('lena', 'actually I can’t make it');
    const offer = relay()!;
    expect(offer).toMatchObject({ conversationId: 'pond-club', said: { sender: 'Mateo' } });
    offer.take();
    expect(relay()).toBeNull();
  });
});
