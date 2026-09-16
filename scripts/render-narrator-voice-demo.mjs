import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { narratorScore, narratorSyllable, narratorPhrases, narratorReadingTime, NARRATOR_LINE_REST, NARRATOR_VOICE_GAIN, NARRATOR_VOICE_STYLES, NARRATOR_PULSE_RATE, NARRATOR_DEFAULT_STYLE } from '../src/narrator-voice.js';

const lines = ['再攒够一块地的钱，就能往外盖东西了。这块草皮我已经看腻了。', '行，那我写下来。'];
const sampleRate = 48000, volume = .45 * NARRATOR_VOICE_GAIN;
let duration = 0;
const timeline = lines.map(text => {
  const at = duration, reading = narratorReadingTime(text);
  duration += reading + NARRATOR_LINE_REST;
  return { text, at, reading, notes: narratorScore(text), phrases: narratorPhrases(text) };
});
const dir = new URL('../docs/v1.7/qa/narrator-voice/', import.meta.url);
mkdirSync(dir, { recursive: true });
// Keep the rejected one-character-per-sound prototype available for comparison.
if (!existsSync(new URL('voice-demo-rejected.wav', dir)) && existsSync(new URL('voice-demo.wav', dir))) copyFileSync(new URL('voice-demo.wav', dir), new URL('voice-demo-rejected.wav', dir));
const variants = [];
for (const style of NARRATOR_VOICE_STYLES) {
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  for (const { at, notes } of timeline) for (const note of notes) {
    const syllable = narratorSyllable(sampleRate, note.tone, style), start = Math.round((at + note.at) * sampleRate);
    for (let i = 0; i < syllable.length && start + i < samples.length; i++) samples[start + i] += syllable[i] * volume;
  }
  let peak = 0, energy = 0;
  for (const value of samples) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
  const pcm = Buffer.alloc(44 + samples.length * 2);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(pcm.length - 8, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(sampleRate, 24); pcm.writeUInt32LE(sampleRate * 2, 28);
  pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  const file = `voice-${style}.wav`;
  writeFileSync(new URL(file, dir), pcm);
  if (style === NARRATOR_DEFAULT_STYLE) writeFileSync(new URL('voice-demo.wav', dir), pcm);
  // Reference mix: actual meadow record at the game's default music level.
  // This is a music comparison, not a claim that all gameplay SFX were auditioned.
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', fileURLToPath(new URL(file, dir)),
    '-ss', '8', '-i', fileURLToPath(new URL('../public/audio/records/meadow.mp3', import.meta.url)),
    '-filter_complex', '[1:a]volume=0.55,afade=t=in:st=0:d=0.3[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[out]',
    '-map', '[out]', '-ac', '1', '-ar', String(sampleRate), fileURLToPath(new URL(`voice-${style}-mix.wav`, dir))]);
  variants.push({ style, file, mix: `voice-${style}-mix.wav`, peak, rms: Math.sqrt(energy / samples.length), clipping: peak >= 1 });
}
const report = { revision: 'phrase-sketches-6', pulseRate: NARRATOR_PULSE_RATE, original: true, sampleRate, duration, matching: 'Same text, timing, envelope and RMS; perceived loudness still requires listening.', timeline, variants };
writeFileSync(new URL('audio-report.json', dir), JSON.stringify(report, null, 2) + '\n');
// Inline metadata keeps captions / comparison working when opened via file://.
const page = new URL('index.html', dir);
if (existsSync(page)) {
  const html = readFileSync(page, 'utf8').replace(/(<script id="voice-data" type="application\/json">)[\s\S]*?(<\/script>)/, (_, open, close) => open + JSON.stringify(report).replace(/</g, '\\u003c') + close);
  writeFileSync(page, html);
}
console.log(JSON.stringify({ duration, variants }, null, 2));
