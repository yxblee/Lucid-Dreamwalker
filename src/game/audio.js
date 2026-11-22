import { GENERATED_AUDIO } from './generated-audio.js';

const MUSIC_GAINS = {
  title: 0.9,
  hub: 0.43,
  bellwright: 0.1,
  archivist: 0.92,
  cartographer: 0.1,
  win: 0.09
};

export class DreamAudio {
  constructor({
    assets = GENERATED_AUDIO,
    fetchImpl = globalThis.fetch.bind(globalThis),
    contextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
    setInterval = globalThis.setInterval.bind(globalThis),
    storage = globalThis.localStorage,
    random = Math.random
  } = {}) {
    this.context = null;
    this.master = null;
    this.assets = assets;
    this.fetchImpl = fetchImpl;
    this.contextClass = contextClass;
    this.setInterval = setInterval;
    this.storage = storage;
    this.random = random;
    this.buffers = new Map();
    this.narrationSource = null;
    this.narrationToken = 0;
    this.muted = storage.getItem('lucid-muted') === 'true';
    this.mode = 'title';
    this.step = 0;
    this.musicTimer = null;
    this.musicSource = null;
    this.musicGain = null;
    this.musicToken = 0;
  }

  async start() {
    if (!this.context) {
      if (!this.contextClass) return;
      this.context = new this.contextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.context.destination);
      this.createAmbience();
      this.musicTimer = this.setInterval(() => this.musicStep(), 430);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (!this.musicSource) await this.syncMusic();
  }

  setMode(mode) {
    this.mode = mode;
    this.step = 0;
    return this.syncMusic();
  }

  async syncMusic() {
    const token = ++this.musicToken;
    const previousSource = this.musicSource;
    const previousGain = this.musicGain;
    const id = `music-${this.mode}`;
    if (!this.context || this.muted || !this.assets[id]) {
      if (previousSource) previousSource.stop();
      this.musicSource = null;
      this.musicGain = null;
      return false;
    }
    const buffer = await this.loadGenerated(id);
    if (!buffer) {
      if (token === this.musicToken) {
        if (previousSource) previousSource.stop();
        this.musicSource = null;
        this.musicGain = null;
      }
      return false;
    }
    if (this.muted || token !== this.musicToken) return false;
    const now = this.context.currentTime;
    const fadeDuration = 0.8;
    if (previousSource) {
      previousGain.gain.cancelScheduledValues(now);
      previousGain.gain.setValueAtTime(previousGain.gain.value, now);
      previousGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
      previousSource.stop(now + fadeDuration);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(MUSIC_GAINS[this.mode] || 0.16, now + fadeDuration);
    source.connect(gain).connect(this.master);
    source.start();
    this.musicSource = source;
    this.musicGain = gain;
    return true;
  }

  async toggle() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopNarration();
      this.stopMusic();
    }
    this.storage.setItem('lucid-muted', String(this.muted));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.context.currentTime, 0.04);
    }
    if (!this.muted) await this.syncMusic();
    return this.muted;
  }

  stopMusic() {
    this.musicToken += 1;
    if (this.musicSource) this.musicSource.stop();
    this.musicSource = null;
    this.musicGain = null;
  }

  createAmbience() {
    const ctx = this.context;
    const ambience = ctx.createGain();
    ambience.gain.value = 0.055;
    ambience.connect(this.master);
    [55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 4 - 3;
      gain.gain.value = 0.45 / (index + 1);
      oscillator.connect(gain).connect(ambience);
      oscillator.start();
    });
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (this.random() * 2 - 1) * 0.12;
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noise.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    noiseGain.gain.value = 0.07;
    noise.connect(filter).connect(noiseGain).connect(ambience);
    noise.start();
  }

  musicStep() {
    if (!this.context || this.muted || this.musicSource || this.context.state !== 'running') return;
    const sequences = {
      title: [0, 7, 3, 10, 5, 12, 7, 3],
      hub: [0, 3, 7, 10, 7, 5, 3, -2],
      bellwright: [0, 7, 12, 5, 10, 3, 7, 14],
      archivist: [0, 3, 10, 7, 2, 12, 5, 8],
      cartographer: [0, 5, 8, 12, 3, 10, 7, 15],
      win: [0, 4, 7, 12, 11, 7, 4, 12]
    };
    const sequence = sequences[this.mode] || sequences.hub;
    const base = this.mode === 'archivist' ? 196 : 164.81;
    const note = base * 2 ** (sequence[this.step % sequence.length] / 12);
    if (this.step % 2 === 0 || this.mode.includes('wright')) this.tone(note, 0.7, 0.035, 'sine');
    if (this.step % 8 === 0) this.tone(base / 2, 2.4, 0.04, 'triangle');
    this.step += 1;
  }

  tone(frequency, duration = 0.2, volume = 0.1, type = 'sine', delay = 0) {
    if (!this.context || this.muted) return;
    const ctx = this.context;
    const at = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.03);
  }

  sweep(from, to, duration = 0.25, volume = 0.1, type = 'sine') {
    if (!this.context || this.muted) return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.03);
  }

  async loadGenerated(id) {
    if (!this.buffers.has(id)) {
      const loading = this.fetchImpl(this.assets[id])
        .then((response) => {
          if (!response.ok) throw new Error(`Audio asset ${id} returned ${response.status}`);
          return response.arrayBuffer();
        })
        .then((bytes) => this.context.decodeAudioData(bytes));
      this.buffers.set(id, loading);
    }
    try {
      return await this.buffers.get(id);
    } catch {
      this.buffers.delete(id);
      return null;
    }
  }

  async playGenerated(id, volume = 0.75) {
    if (!this.context || this.muted || !this.assets[id]) return false;
    const buffer = await this.loadGenerated(id);
    if (!buffer || this.muted) return false;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start();
    return source;
  }

  stopNarration() {
    this.narrationToken += 1;
    if (this.narrationSource) this.narrationSource.stop();
    this.narrationSource = null;
  }

  async narrate(id) {
    this.stopNarration();
    if (!this.context || this.muted || !this.assets[id]) return false;
    const token = this.narrationToken;
    const source = await this.playGenerated(id, 1);
    if (!source) return false;
    if (token !== this.narrationToken) {
      source.stop();
      return false;
    }
    this.narrationSource = source;
    source.onended = () => {
      if (this.narrationSource === source) this.narrationSource = null;
    };
    return true;
  }

  async sfx(name) {
    if (!this.context || this.muted) return false;
    const id = `sfx-${name}`;
    if (this.assets[id] && await this.playGenerated(id)) return true;
    this.playSynthSfx(name);
    return true;
  }

  playSynthSfx(name) {
    const sounds = {
      jump: () => this.sweep(180, 390, 0.16, 0.09, 'triangle'),
      double: () => { this.sweep(260, 650, 0.2, 0.09); this.tone(780, 0.2, 0.04, 'sine', 0.06); },
      crystal: () => { this.tone(660, 0.18, 0.08); this.tone(990, 0.35, 0.06, 'sine', 0.08); },
      memory: () => [0, 4, 7, 12].forEach((n, i) => this.tone(330 * 2 ** (n / 12), 0.65, 0.07, 'sine', i * 0.1)),
      attack: () => this.sweep(240, 70, 0.13, 0.12, 'sawtooth'),
      hit: () => this.sweep(110, 45, 0.2, 0.15, 'square'),
      enemy: () => this.sweep(380, 90, 0.32, 0.08, 'triangle'),
      gravity: () => this.sweep(90, 720, 0.38, 0.1),
      slide: () => this.sweep(170, 80, 0.2, 0.06, 'sawtooth'),
      time: () => { this.sweep(600, 110, 0.5, 0.08); this.tone(55, 0.7, 0.08, 'triangle'); },
      rewind: () => { this.sweep(80, 840, 0.65, 0.09); this.sweep(120, 1200, 0.5, 0.04, 'triangle'); },
      break: () => { this.sweep(100, 35, 0.35, 0.17, 'square'); this.tone(55, 0.4, 0.1, 'sawtooth'); },
      portal: () => [110, 165, 220, 330].forEach((n, i) => this.tone(n, 1.3, 0.06, 'sine', i * 0.12)),
      level: () => [440, 554, 659, 880].forEach((n, i) => this.tone(n, 0.5, 0.07, 'triangle', i * 0.09)),
      win: () => [220, 277, 330, 440, 554, 660].forEach((n, i) => this.tone(n, 2.4, 0.08, 'sine', i * 0.16)),
      click: () => this.tone(440, 0.08, 0.04, 'triangle')
    };
    sounds[name]?.();
  }
}
