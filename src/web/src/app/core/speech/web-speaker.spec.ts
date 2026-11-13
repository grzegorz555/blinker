// Spec 006, T5: speech on the device only (R8). A fake speechSynthesis stands in for the browser.
import { FakeSpeaker } from './fake-speaker';
import {
  WebSpeaker,
  createWebSpeaker,
  pickVoice,
  type UtteranceLike,
  type VoiceLike,
} from './web-speaker';

const voice = (
  name: string,
  lang: string,
  localService: boolean,
  isDefault = false,
): VoiceLike => ({
  name,
  lang,
  localService,
  default: isDefault,
});

const POLISH_LOCAL = voice('Paulina', 'pl-PL', true);
const POLISH_NETWORK = voice('Google polski', 'pl-PL', false, true);
const ENGLISH_LOCAL = voice('Zira', 'en-US', true, true);

function fakeSynth(voices: VoiceLike[]) {
  const spoken: UtteranceLike[] = [];
  let cancels = 0;
  return {
    spoken,
    get cancels() {
      return cancels;
    },
    getVoices: () => voices,
    speak: (u: UtteranceLike) => spoken.push(u),
    cancel: () => {
      cancels++;
    },
  };
}
const utterance = (text: string): UtteranceLike => ({
  text,
  lang: '',
  rate: 1,
  voice: null,
  onend: null,
  onerror: null,
});

describe('pickVoice', () => {
  it('picks an on-device Polish voice and never a network one, even if it is the default', () => {
    expect(pickVoice([POLISH_NETWORK, ENGLISH_LOCAL, POLISH_LOCAL], 'pl')).toBe(POLISH_LOCAL);
  });

  it('returns null when only network voices speak the language', () => {
    expect(pickVoice([POLISH_NETWORK, ENGLISH_LOCAL], 'pl')).toBeNull();
  });

  it('prefers the exact tag, then the default; "pl_PL" from Android counts as pl-PL', () => {
    const plain = voice('A', 'pl', true);
    const exact = voice('B', 'pl_PL', true);
    expect(pickVoice([plain, exact], 'pl-PL')).toBe(exact);
    const def = voice('C', 'pl-PL', true, true);
    expect(pickVoice([POLISH_LOCAL, def], 'pl')).toBe(def);
  });
});

describe('WebSpeaker', () => {
  it('says the text with the local Polish voice and the rate, and reports speaking until the end', () => {
    const synth = fakeSynth([POLISH_NETWORK, POLISH_LOCAL]);
    const speaker = new WebSpeaker(synth, utterance);
    const changes: boolean[] = [];
    speaker.subscribe((s) => changes.push(s));

    expect(speaker.say('CHCĘ PIĆ', { lang: 'pl', rate: 1.5 })).toBe('started');
    const [u] = synth.spoken;
    expect([u.text, u.voice, u.lang, u.rate]).toEqual(['CHCĘ PIĆ', POLISH_LOCAL, 'pl-PL', 1.5]);
    expect(speaker.speaking).toBe(true);
    u.onend?.();
    expect(speaker.speaking).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('with no local voice says nothing and reports no-local-voice', () => {
    const synth = fakeSynth([POLISH_NETWORK]);
    const speaker = new WebSpeaker(synth, utterance);
    expect(speaker.say('TAK', { lang: 'pl' })).toBe('no-local-voice');
    expect(synth.spoken).toEqual([]);
    expect(speaker.speaking).toBe(false);
  });

  it('a new say() cancels the previous one; the old end event no longer counts', () => {
    const synth = fakeSynth([POLISH_LOCAL]);
    const speaker = new WebSpeaker(synth, utterance);
    speaker.say('JEDEN', { lang: 'pl' });
    speaker.say('DWA', { lang: 'pl' });
    expect(synth.cancels).toBe(2); // every say() first clears anything queued
    synth.spoken[0].onend?.(); // the first one ends late
    expect(speaker.speaking).toBe(true);
    synth.spoken[1].onerror?.();
    expect(speaker.speaking).toBe(false);
  });

  it('cancel() stops at once; the rate is kept within 0.5–2', () => {
    const synth = fakeSynth([POLISH_LOCAL]);
    const speaker = new WebSpeaker(synth, utterance);
    speaker.say('A', { lang: 'pl', rate: 9 });
    expect(synth.spoken[0].rate).toBe(2);
    speaker.cancel();
    expect(speaker.speaking).toBe(false);
  });

  it('reports unsupported without speechSynthesis', () => {
    expect(createWebSpeaker({}).say('A', { lang: 'pl' })).toBe('unsupported');
    expect(new WebSpeaker(null, utterance).say('A', { lang: 'pl' })).toBe('unsupported');
  });
});

describe('FakeSpeaker', () => {
  it('records what would be said and can pretend there is no local voice', () => {
    const fake = new FakeSpeaker();
    fake.say('A', { lang: 'pl' });
    expect(fake.said).toEqual([{ text: 'A', options: { lang: 'pl' } }]);
    fake.result = 'no-local-voice';
    expect(fake.say('B', { lang: 'pl' })).toBe('no-local-voice');
    expect(fake.said).toHaveLength(1);
  });
});
