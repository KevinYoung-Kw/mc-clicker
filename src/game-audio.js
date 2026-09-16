import {facilityInactive} from './facility-storage.js';
import { ensureRecords } from "./records.js";
import { narratorScore, narratorSound, narratorSoundKey, NARRATOR_VOICE_GAIN } from './narrator-voice.js';
import { narratorDelivery } from './narrator-prosody.js';

const clamp = v => Math.max(0, Math.min(1, v));
const SFX = {
  tap: ["wood", 65], back: ["wood", 110], switch: ["wood", 90],
  blocked: ["stone", 180], buy: ["metal", 160], land: ["stone", 220],
  place: ["wood", 150], build: ["wood", 200], mine: ["stone", 85],
  harvest: ["leaf", 140], pickup: ["metal", 120], start: ["wood", 180],
  event: ["metal", 1000], enter: ["wood", 200],
};

// Cosmetic playback only: no callbacks into action(), advance(), jobs or power.
export class GameAudio {
  constructor({ state, base = "./", changed = () => {}, media = () => new Audio(),
    context = () => new (window.AudioContext || window.webkitAudioContext)(), now = () => performance.now(), random = Math.random }) {
    Object.assign(this, { state, base, changed, media, context, now, random });
    this.lastState = state();
    this.active = true;
    this.unlocked = false;
    this.positions = new Map();
    this.voices = new Set();
    this.limits = new Map();
    this.failure = "";
    this.serial = 0;
    this.playCount = 0;
    this.musicClock = now();
    this.shuffleBag = [];
  }
  canPlay() {
    const s = this.state();
    return this.active && this.unlocked && s.sound && s.counts.L1 > 0;
  }
  stopEffects() {
    this.stopNarrator(); this.narratorLine = null;
    for (const voice of this.voices) voice.stop();
    this.voices.clear(); this.limits.clear();
    if (this.rainLoop) {
      this.rainLoop.source.stop();
      this.rainLoop.source.disconnect();
      this.rainLoop.filter.disconnect();
      this.rainLoop.gain.disconnect();
      this.rainLoop = null;
    }
  }
  unlock() {
    this.unlocked = true;
    if (!this.canPlay()) return;
    try {
      this.ctx ||= this.context();
      if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
    } catch { /* Music remains available if a device has no Web Audio. */ }
    // A failed autoplay may be retried only by a real user gesture.
    this.failure = "";
    if (this.deck?.media.error) { this.clear(this.deck); this.deck = null; }
    if (this.deck?.media.paused && !this.deck.pending) this.start(this.deck);
    this.tick();
  }
  clear(deck) {
    if (!deck) return;
    deck.dead = true;
    deck.media.onended = null;
    deck.media.onerror = null;
    deck.media.onloadedmetadata = null;
    deck.media.pause();
    deck.source?.disconnect();
    deck.volume?.disconnect();
    deck.media.removeAttribute("src");
    deck.media.load();
  }
  setVolume(deck, value) {
    // Route music through Web Audio too: some mobile media elements ignore .volume.
    if (deck.volume) deck.volume.gain.setTargetAtTime(value, this.ctx.currentTime, .012);
    else deck.media.volume = value;
  }
  start(deck) {
    if (!deck || deck.dead || deck.pending || !this.canPlay()) return;
    deck.pending = true;
    this.playCount++;
    Promise.resolve(deck.media.play()).then(() => {
      deck.pending = false;
      if (deck.dead || !this.canPlay()) deck.media.pause();
      else {
        deck.fadeAt = this.now();
        if (this.retiring) this.retiring.fadeAt = this.now();
      }
    }).catch(() => {
      deck.pending = false;
      if (!deck.dead && this.active) this.failure = "点播放重试";
      if (this.retiring) this.retiring.fadeAt = this.now();
    });
  }
  transition(id) {
    if (!id && !this.deck) return;
    if (this.deck?.id === id) return;
    this.clear(this.retiring);
    this.retiring = this.deck;
    if (this.retiring) {
      this.retiring.from = this.retiring.gain;
      this.retiring.fadeAt = id ? Infinity : this.now();
    }
    this.deck = null;
    if (!id) return;
    const media = this.media();
    const deck = { media, id, gain: 0, fadeAt: this.now(), fadeDuration: this.naturalFade ? 900 : 280, pending: false, token: ++this.serial };
    this.naturalFade = false;
    this.deck = deck;
    media.preload = "auto";
    media.src = `${this.base}audio/records/${id}.mp3`;
    media.volume = 0;
    if (this.ctx?.createMediaElementSource) {
      deck.volume = this.ctx.createGain();
      deck.volume.gain.value = 0;
      deck.source = this.ctx.createMediaElementSource(media);
      deck.source.connect(deck.volume); deck.volume.connect(this.ctx.destination);
      media.volume = 1;
    }
    media.loop = ensureRecords(this.state()).mode === 'single';
    const offset = this.positions.get(id) || 0;
    try { media.currentTime = offset; } catch {
      media.onloadedmetadata = () => { if (!deck.dead) media.currentTime = Math.min(offset, Math.max(0, media.duration - .1)); };
    }
    media.onended = () => {
      if (deck !== this.deck || deck.dead) return;
      this.positions.set(id, 0);
      this.clear(deck); this.deck = null;
      const r = ensureRecords(this.state());
      if (r.mode === 'once') r.playing = false;
      else if (r.mode !== 'single') this.interlude = { from: id, remaining: 3000 };
      this.musicClock = this.now();
      this.changed();
    };
    media.onerror = () => { if (deck === this.deck) this.failure = "音频未能载入 · 点播放重试"; };
    this.start(deck);
  }
  command({ skipGap = false } = {}) {
    if (skipGap) this.interlude = null;
    this.musicClock = this.now();
    this.failure = ""; this.unlock(); this.tick();
  }
  nextId() {
    const r = ensureRecords(this.state()), owned = r.owned;
    if (r.mode !== 'shuffle') return owned[(owned.indexOf(r.selected) + 1) % owned.length];
    const signature = owned.join('|');
    if (this.shuffleOwned !== signature) { this.shuffleBag = []; this.shuffleOwned = signature; }
    this.shuffleBag = this.shuffleBag.filter(id => owned.includes(id) && id !== r.selected);
    if (!this.shuffleBag.length) {
      this.shuffleBag = owned.filter(id => id !== r.selected);
      for (let i = this.shuffleBag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.shuffleBag[i], this.shuffleBag[j]] = [this.shuffleBag[j], this.shuffleBag[i]];
      }
    }
    return this.shuffleBag.shift() || r.selected;
  }
  next() {
    const r = ensureRecords(this.state());
    if (!this.state().counts.L1 || !r.owned.length) return;
    const id = this.nextId();
    this.positions.set(id, 0);
    if (this.deck?.id === id) this.deck.media.currentTime = 0;
    r.selected = id; r.playing = true;
    this.command({ skipGap: true }); this.changed();
  }
  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    this.musicClock = this.now();
    if (!active) {
      this.stopNarrator();
      if (this.deck) this.positions.set(this.deck.id, this.deck.media.currentTime);
      this.clear(this.retiring); this.retiring = null;
      this.deck?.media.pause();
      for (const voice of this.voices) voice.stop();
      this.voices.clear(); this.limits.clear();
      this.ctx?.suspend().catch(() => {});
    } else if (this.canPlay()) {
      this.ctx?.resume().catch(() => {});
      // Resume at the same position; no elapsed-time catch-up or queued sounds.
      if (this.deck) { this.deck.gain = 0; this.deck.fadeAt = this.now(); }
      this.tick();
      if (this.deck?.media.paused && !this.deck.pending) this.start(this.deck);
    }
  }
  tick() {
    const s = this.state(), r = ensureRecords(s), now = this.now();
    const elapsed = Math.max(0, now - this.musicClock); this.musicClock = now;
    if (s !== this.lastState) {
      this.clear(this.deck); this.clear(this.retiring); this.deck = this.retiring = null;
      this.stopEffects();
      this.positions.clear(); this.lastState = s;
      this.interlude = null; this.shuffleBag = []; this.shuffleOwned = null;
    }
    if (this.sfxBus) this.sfxBus.gain.value = this.canPlay() ? 1 : 0;
    if (!this.canNarrate()) this.stopNarrator();
    else if (this.narratorGain) this.narratorGain.gain.value = clamp(s.audio.narratorVolume ?? .45) * NARRATOR_VOICE_GAIN;
    // Reset/import may revoke ownership while audio or a play() promise is live.
    if (!(s.counts.L1 > 0)) {
      this.clear(this.deck); this.clear(this.retiring); this.deck = this.retiring = null;
      this.stopEffects();
      this.interlude = null;
      return;
    }
    if(facilityInactive(s,'L1')){
      if(this.deck)this.positions.set(this.deck.id,this.deck.media.currentTime);
      this.clear(this.deck);this.clear(this.retiring);this.deck=this.retiring=null;
      return;
    }
    if (!this.active) return;
    this.ambientTick();
    if (this.interlude) {
      if (r.selected !== this.interlude.from || r.mode === 'single') this.interlude = null;
      else if (r.mode === 'once') { this.interlude = null; r.playing = false; this.changed(); }
      else if (this.canPlay() && r.playing) {
        this.interlude.remaining -= elapsed;
        if (this.interlude.remaining <= 0) {
          r.selected = this.nextId(); this.positions.set(r.selected, 0);
          this.interlude = null; this.naturalFade = true; this.changed();
        }
      }
    }
    const desired = !this.interlude && this.canPlay() && r.playing && r.owned.includes(r.selected) ? r.selected : null;
    this.transition(desired);
    const volume = s.sound ? clamp(s.audio.musicVolume) : 0;
    if (this.deck) {
      const deck = this.deck;
      const tail = r.mode !== 'single' && Number.isFinite(deck.media.duration)
        ? clamp((deck.media.duration - deck.media.currentTime) / .9) : 1;
      deck.gain = deck.pending ? 0 : clamp((now - deck.fadeAt) / deck.fadeDuration) * tail;
      this.setVolume(deck, volume * deck.gain);
      deck.media.loop = r.mode === 'single';
      this.positions.set(deck.id, deck.media.currentTime);
    }
    if (this.retiring) {
      const deck = this.retiring;
      this.setVolume(deck, volume * deck.from * (1 - clamp((now - deck.fadeAt) / 280)));
      if (now - deck.fadeAt >= 280) { this.clear(deck); this.retiring = null; }
    }
  }
  ambient({rain=0,indoor=false}={}) {this.ambientTarget={rain,indoor};}
  canNarrate() {
    const s = this.state();
    return this.canPlay() && s.guidance?.info && s.guidance.notices && s.audio.narratorVoice !== false && (s.audio.narratorVolume ?? .45) > 0;
  }
  stopNarrator() {
    if (!this.narratorSource) return;
    const source = this.narratorSource; this.narratorSource = null;
    try { source.stop(); } catch {}
    source.disconnect();
  }
  narrate(line) {
    if (this.narratorState !== this.state()) {
      this.stopNarrator(); this.narratorLine = null; this.narratorState = this.state();
    }
    if (!line?.text || line.speaking === false) { this.stopNarrator(); return false; }
    const key = `${line.id}:${line.startedAt}:${line.index}:${line.text}`;
    if (this.narratorLine?.key !== key) {
      this.stopNarrator(); this.narratorLine = { key, score: narratorScore(line.text,narratorDelivery(line)), elapsed: Math.max(-.01, line.elapsed - .08) };
    }
    const track = this.narratorLine, before = track.elapsed;
    track.elapsed = line.elapsed;
    const note = track.score.findLast(note => note.at > before && note.at <= line.elapsed);
    // A delayed frame consumes missed accents; it never queues a burst later.
    if (!note || line.elapsed - note.at > .12 || !this.canNarrate()) { if (!this.canNarrate()) this.stopNarrator(); return false; }
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return false;
    this.stopNarrator();
    this.narratorBuffers ||= new Map();
    const bufferKey=narratorSoundKey(note);
    if (!this.narratorBuffers.has(bufferKey)) {
      const data = narratorSound(ctx.sampleRate, note), buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      if(this.narratorBuffers.size>=64)this.narratorBuffers.delete(this.narratorBuffers.keys().next().value);
      buffer.getChannelData(0).set(data); this.narratorBuffers.set(bufferKey, buffer);
    }
    if (!this.narratorGain) { this.narratorGain = ctx.createGain(); this.narratorGain.connect(ctx.destination); }
    this.narratorGain.gain.value = clamp(this.state().audio.narratorVolume ?? .45) * NARRATOR_VOICE_GAIN;
    const source = ctx.createBufferSource(); source.buffer = this.narratorBuffers.get(bufferKey);
    source.connect(this.narratorGain); this.narratorSource = source;
    source.onended = () => { source.disconnect(); if (this.narratorSource === source) this.narratorSource = null; };
    source.start(); this.narratorPulseCount = (this.narratorPulseCount || 0) + 1;
    return true;
  }
  ambientTick() {
    const {rain=0,indoor=false}=this.ambientTarget||{},s=this.state(),ctx=this.ctx;
    if(!ctx || !this.unlocked || !ctx.createBiquadFilter)return;
    const volume=this.canPlay()?Math.max(0,rain)*s.audio.sfxVolume*(indoor?.007:.022):0;
    if(volume>.0001&&!this.rainLoop) {
      const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);let low=0;
      for(let i=0;i<data.length;i++){low=low*.78+(Math.random()*2-1)*.22;data[i]=low;}
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
      source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=1100;gain.gain.value=0;
      source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();this.rainLoop={source,filter,gain};
    }
    if(this.rainLoop){this.rainLoop.gain.gain.setTargetAtTime(volume,ctx.currentTime,.35);this.rainLoop.filter.frequency.setTargetAtTime(indoor?550:1300,ctx.currentTime,.4);}
  }
  sfx(type = "tap", { automatic = false, visible = true } = {}) {
    const s = this.state();
    if (!this.canPlay() || !s.audio.sfxVolume || (automatic && !visible)) return false;
    const now = this.now(), [material, interval] = SFX[type] || SFX.tap;
    if (now - (this.limits.get(type) ?? -Infinity) < interval ||
        now - (this.limits.get("all") ?? -Infinity) < 40 ||
        (automatic && now - (this.limits.get("auto") ?? -Infinity) < 1200) || this.voices.size >= 6) return false;
    let ctx;
    try { ctx = this.ctx ||= this.context(); } catch { return false; }
    if (ctx.state !== "running") return false;
    this.limits.set(type, now); this.limits.set("all", now); if (automatic) this.limits.set("auto", now);
    const duration = { event: .4, build: .24, land: .24, start: .19, enter: .15, back: .08 }[type] || .11;
    const frames = Math.ceil(ctx.sampleRate * duration), buffer = ctx.createBuffer(1, frames, ctx.sampleRate), data = buffer.getChannelData(0);
    const pitch = ({ back: .7, switch: 1.2, blocked: .55, buy: 1.1, pickup: 1.5, start: .8, enter: .9, build: .7, land: .6 }[type] || 1) * (.94 + Math.random() * .12);
    let smooth = 0;
    for (let i = 0; i < frames; i++) {
      const t = i / ctx.sampleRate, noise = Math.random() * 2 - 1;
      smooth = smooth * .78 + noise * .22;
      const base = material === "wood" ? 540 : material === "stone" ? 195 : material === "metal" ? 920 : 1200;
      const ring = Math.sin(2 * Math.PI * base * pitch * t) * Math.exp(-t * (material === "metal" ? 30 : 60));
      const secondary = Math.sin(2 * Math.PI * base * 2.37 * pitch * t) * Math.exp(-t * 80);
      let value = material === "leaf" ? smooth * Math.exp(-t * 40) : ring * .22 + secondary * .055 + smooth * Math.exp(-t * 65) * .65;
      if (type === "buy" || type === "pickup") value += .09 * Math.sin(2 * Math.PI * 1450 * t) * Math.exp(-t * 45);
      if (type === "build" || type === "land") value += .24 * smooth * Math.exp(-Math.abs(t - .1) * 55);
      if (type === "start" && t > .065) value += .18 * smooth * Math.exp(-(t - .065) * 48);
      if (type === "event") for (const [at, hz] of [[.09, 720], [.18, 1080]]) {
        if (t > at) value += .08 * Math.sin(2 * Math.PI * hz * (t - at)) * Math.exp(-(t - at) * 32);
      }
      data[i] = value * Math.min(1, t * 1800) * Math.min(1, (duration - t) * 100);
    }
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = clamp(s.audio.sfxVolume) * (automatic ? .12 : .35);
    if (!this.sfxBus) { this.sfxBus = ctx.createGain(); this.sfxBus.connect(ctx.destination); }
    source.connect(gain); gain.connect(this.sfxBus);
    const voice = { stop: () => { try { source.stop(); } catch {} source.disconnect(); gain.disconnect(); } };
    this.voices.add(voice);
    source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); };
    source.start();
    return true;
  }
  snapshot() {
    return { selected: this.deck?.id || null,
      interlude: this.interlude ? Math.max(0, this.interlude.remaining) : 0,
      playing: !!this.deck && !this.deck.media.paused, active: this.active,
      decks: [this.deck, this.retiring].filter(Boolean).length, voices: this.voices.size,
      playCount: this.playCount, position: this.deck?.media.currentTime || 0, failure: this.failure,
      narratorVoices: this.narratorSource ? 1 : 0, narratorPulses: this.narratorPulseCount || 0 };
  }
}
