import test from 'node:test';
import assert from 'node:assert/strict';
import { DreamAudio } from '../src/game/audio.js';

function audioParam(value = 0) {
  return {
    value,
    setValueAtTime(next) { this.value = next; },
    setTargetAtTime(next) { this.value = next; },
    exponentialRampToValueAtTime(next) { this.value = next; }
  };
}

class FakeAudioContext {
  static instances = [];

  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 10;
    this.destination = {};
    this.oscillators = [];
    this.sources = [];
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    return { gain: audioParam(), connect: (target) => target };
  }

  createOscillator() {
    const oscillator = {
      frequency: audioParam(),
      detune: { value: 0 },
      connect: (target) => target,
      start() { this.started = true; },
      stop() { this.stopped = true; }
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createBuffer(channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }

  createBufferSource() {
    const source = {
      connect: (target) => target,
      start() { this.started = true; },
      stop() { this.stopped = true; }
    };
    this.sources.push(source);
    return source;
  }

  createBiquadFilter() {
    return { frequency: { value: 0 }, connect: (target) => target };
  }

  async decodeAudioData(bytes) {
    return { bytes };
  }

  async resume() {
    this.state = 'running';
  }
}

function createAudio(options = {}) {
  return new DreamAudio({
    contextClass: FakeAudioContext,
    setInterval: () => 1,
    random: () => 0.5,
    storage: {
      getItem: () => null,
      setItem: () => {}
    },
    ...options
  });
}

test('DreamAudio plays a generated sound effect through its public sfx interface', async () => {
  const requests = [];
  const audio = createAudio({
    assets: { 'sfx-jump': '/audio/sfx-jump.mp3' },
    fetchImpl: async (url) => {
      requests.push(url);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const oscillatorCount = context.oscillators.length;

  await audio.sfx('jump');

  assert.deepEqual(requests, ['/audio/sfx-jump.mp3']);
  assert.equal(context.sources.at(-1).started, true);
  assert.equal(context.oscillators.length, oscillatorCount, 'does not also play the synthesized effect');
});

test('DreamAudio retains synthesized effects when no generated asset exists', async () => {
  const audio = createAudio({ assets: {} });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const oscillatorCount = context.oscillators.length;

  await audio.sfx('jump');

  assert.ok(context.oscillators.length > oscillatorCount);
});

test('DreamAudio interrupts the previous narration when a new story cue starts', async () => {
  const audio = createAudio({
    assets: {
      'narration-opening': '/audio/narration-opening.mp3',
      'narration-win': '/audio/narration-win.mp3'
    },
    fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);

  await audio.narrate('narration-opening');
  const opening = context.sources.at(-1);
  await audio.narrate('narration-win');
  const ending = context.sources.at(-1);

  assert.equal(opening.stopped, true);
  assert.equal(ending.started, true);
  assert.notEqual(opening, ending);
});

test('DreamAudio mute persists and stops an in-progress narration', async () => {
  let savedMute;
  const audio = createAudio({
    assets: { 'narration-opening': '/audio/narration-opening.mp3' },
    fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    storage: {
      getItem: () => null,
      setItem: (key, value) => { savedMute = [key, value]; }
    }
  });
  await audio.start();
  await audio.narrate('narration-opening');
  const context = FakeAudioContext.instances.at(-1);
  const narration = context.sources.at(-1);

  const muted = audio.toggle();

  assert.equal(muted, true);
  assert.deepEqual(savedMute, ['lucid-muted', 'true']);
  assert.equal(narration.stopped, true);
});

test('DreamAudio falls back to synthesis when a generated asset request fails', async () => {
  const audio = createAudio({
    assets: { 'sfx-jump': 'audio/missing.mp3' },
    fetchImpl: async () => new Response('Missing', { status: 404 })
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const oscillatorCount = context.oscillators.length;

  await audio.sfx('jump');

  assert.ok(context.oscillators.length > oscillatorCount);
});

test('DreamAudio falls back to synthesis when a generated asset cannot be decoded', async () => {
  class UndecodableAudioContext extends FakeAudioContext {
    async decodeAudioData() {
      throw new Error('Invalid audio');
    }
  }
  const audio = createAudio({
    contextClass: UndecodableAudioContext,
    assets: { 'sfx-jump': 'audio/invalid.mp3' },
    fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const oscillatorCount = context.oscillators.length;

  await audio.sfx('jump');

  assert.ok(context.oscillators.length > oscillatorCount);
});
