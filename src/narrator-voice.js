// Original nonverbal character sounds. Chinese controls timing, never phonemes.
import { shapeNarratorScore } from './narrator-prosody.js';
export const NARRATOR_LINE_REST = 1.5;
export const NARRATOR_VOICE_GAIN = .42;
export const NARRATOR_SYLLABLE_DURATION = .128;
export const NARRATOR_VOICE_STYLES = ['murmur', 'pixel', 'reed'];
export const NARRATOR_DEFAULT_STYLE = 'reed';
export const NARRATOR_PULSE_RATE = 1.45;
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh-CN', { granularity: 'word' }) : null;
const plans = new Map();

function speechUnits(word) {
  const han = word.match(/\p{Script=Han}/gu)?.length || 0;
  // Latin words and numbers occupy reading time, not one sound per letter/digit.
  return han || (/[\p{L}\p{N}]/u.test(word) ? Math.max(1, Math.ceil(word.length / 3)) : 0);
}
function makePlan(text) {
  const words = segmenter ? [...segmenter.segment(text)].map(s => s.segment) : (text.match(/\p{Script=Han}{1,2}|[\p{L}\p{N}]+|[^\p{L}\p{N}]/gu) || []);
  const notes = [], phrases = [];
  let at = .12, units = 0, totalUnits = 0, phrase = '', lastPause = 0;
  const ordinary = [0, 2, 1, 3, 0, 1, 2, 3];
  function flush(ending = '') {
    if (!units) return;
    const duration = Math.max(.29, units * .18);
    const start = at, first = notes.length;
    // Two/three short sounds, a little space, then on. No character/vowel mapping.
    let pulse = 0, offset = 0;
    const intervals = [.23, .27, .35, .24, .29];
    while (offset + NARRATOR_SYLLABLE_DURATION <= duration) {
      const index = notes.length;
      let tone = ordinary[index % ordinary.length];
      if (pulse === 2 && phrases.length % 3 === 1) tone = 4 + (phrases.length % 2);
      notes.push({ at: start + offset, tone });
      offset += intervals[pulse++ % intervals.length] / NARRATOR_PULSE_RATE;
    }
    if (notes.length > first && ending) notes.at(-1).tone = /[？?]/u.test(ending) ? 8 : /[！!]/u.test(ending) ? 5 : 6 + (phrases.length % 2);
    phrases.push({ text: phrase.trim() + (ending === '.' ? '' : ending), at: start, end: start + duration });
    at += duration; units = 0; phrase = '';
  }
  for (const word of words) {
    if (/^[，、,：:；;。！？.!?…\n]+$/u.test(word)) {
      flush(word);
      // Ellipses / repeated punctuation produce one pause, not stacked silences.
      const pause = /[。！？.!?…\n]/u.test(word) ? .5 : .26;
      at += Math.max(0, pause - lastPause); lastPause = Math.max(lastPause, pause);
      continue;
    }
    const size = speechUnits(word);
    if (!size) { phrase += word; continue; }
    lastPause = 0;
    phrase += word; units += size; totalUnits += size;
  }
  flush('.');
  const end = notes.length ? notes.at(-1).at + NARRATOR_SYLLABLE_DURATION : 0;
  // Keep the opening's existing reading budget. Trailing punctuation is already
  // followed by the 1.5-second line rest, so don't charge for that pause twice.
  const reading = totalUnits * .19 + .8 + (text.match(/[，、,：:；;]/gu)?.length || 0) * .15;
  return { notes, phrases, reading: Math.max(3.2, reading, end + .65) };
}
function plan(text) {
  text = String(text || '').slice(0, 2048);
  if (!plans.has(text)) {
    if (plans.size >= 128) plans.delete(plans.keys().next().value);
    plans.set(text, makePlan(text));
  }
  return plans.get(text);
}
export const narratorScore = (text,delivery) => {const p=plan(text);return shapeNarratorScore(p.notes,p.phrases,delivery);};
export const narratorPhrases = text => plan(text).phrases;
export const narratorReadingTime = text => plan(text).reading;

// Review sketches, not selectable game skins. The game uses a single voice.
// Fixed spectra: no switching between artificial a/e/i/o/u mouths.
const STYLES = {
  murmur: { base: 192, harmonics: [.45, .82, .62, .24, .10, .13, .09, .04, .02] },
  pixel: { base: 286, harmonics: [1, .04, .30, .02, .10, .01, .04, 0, .012] },
  reed: { base: 226, harmonics: [.83, .62, .35, .32, .14, .10, .08, .03, .02] },
};
// Hand-set semitone contours: four passing sounds, two accents, three endings.
const CONTOURS = [[-.1,.15,-.3],[.15,.35,-.1],[-.35,-.1,-.4],[.25,.05,-.25],[-.1,.8,.25],[.2,1,.35],[.05,-.1,-.9],[-.2,-.4,-1],[0,.45,1.25]];
export function narratorSyllable(sampleRate, tone = 0, style = NARRATOR_DEFAULT_STYLE, pitch = 0, articulation = {}) {
  const profile = STYLES[style] || STYLES[NARRATOR_DEFAULT_STYLE];
  const contour = CONTOURS[((tone % CONTOURS.length) + CONTOURS.length) % CONTOURS.length];
  const transpose=Number.isFinite(pitch)?Math.max(-7,Math.min(7,pitch)):0;
  const duration = Number.isFinite(articulation.duration)?Math.max(.06,Math.min(.4,articulation.duration)):NARRATOR_SYLLABLE_DURATION;
  const destination=Number.isFinite(articulation.pitchEnd)?Math.max(-7,Math.min(7,articulation.pitchEnd)):transpose;
  const joinAt=Number.isFinite(articulation.joinAt)?Math.max(.06,Math.min(duration-.04,articulation.joinAt)):0;
  const level=Number.isFinite(articulation.level)?Math.max(.4,Math.min(1.06,articulation.level)):1;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let phase = 0, energy = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, p = t / duration;
    const bend = p < .45 ? contour[0] + (contour[1] - contour[0]) * p / .45 : contour[1] + (contour[2] - contour[1]) * (p - .45) / .55;
    // One oscillator phase across linked sounds, with a small breath dip instead
    // of a second attack or overlapping buffer sources. Pitch glides through it.
    const glide=joinAt?Math.max(0,Math.min(1,(t-joinAt+.07)/.14)):p;
    const smooth=glide*glide*(3-2*glide);
    const hz = profile.base * 2 ** ((bend+transpose+(destination-transpose)*smooth) / 12);
    phase += 2 * Math.PI * hz / sampleRate;
    const opening = .72 + .28 * Math.sin(Math.PI * Math.min(1, t / .055) / 2);
    let voice = 0, previous = 0, harmonic = Math.sin(phase);
    const twiceCosine = 2 * Math.cos(phase);
    for (let h = 0; h < profile.harmonics.length && hz * (h + 1) < sampleRate * .45; h++) {
      voice += harmonic * profile.harmonics[h] * (h ? opening : 1);
      const next = twiceCosine * harmonic - previous; previous = harmonic; harmonic = next;
    }
    const attack = Math.sin(Math.min(1, t / .014) * Math.PI / 2) ** 2;
    const release = Math.sin(Math.min(1, (duration - t) / Math.min(.038,duration*.3)) * Math.PI / 2) ** 2;
    const breath=joinAt?1-.38*Math.exp(-(((t-joinAt+.014)/.026)**2)):1;
    samples[i] = voice * attack * release * breath;
    energy += samples[i] ** 2; peak = Math.max(peak, Math.abs(samples[i]));
  }
  // Matched RMS for A/B comparisons; leave ample mixing headroom.
  const gain = Math.min(.245*level / Math.sqrt(energy / samples.length || 1), .7 / Math.max(peak, .001));
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

// The runtime and audition renderer share the complete articulation parameters.
export const narratorSound=(sampleRate,note)=>narratorSyllable(sampleRate,note.tone,NARRATOR_DEFAULT_STYLE,note.pitch,note);
export const narratorSoundKey=note=>[note.tone,note.pitch,note.duration,note.pitchEnd,note.joinAt||0,note.level].join(':');
