import test from 'node:test';
import assert from 'node:assert/strict';
import { DreamAudio } from '../src/game/audio.js';

function audioParam(value = 0) {
  return {
    value,
    setValueAtTime(next) { this.value = next; },
    setTargetAtTime(next) { this.value = next; },
    exponentialRampToValueAtTime(next) { this.value = next; },
    linearRampToValueAtTime(next, at) { this.value = next; this.linearTarget = next; this.linearAt = at; },
    cancelScheduledValues() {}
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
      connect(target) { this.gain = target; return target; },
      start() { this.started = true; },
      stop(at) { this.stopped = true; this.stopAt = at; }
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

  const muted = await audio.toggle();

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

test('DreamAudio starts looping the generated title music', async () => {
  const requests = [];
  const audio = createAudio({
    assets: { 'music-title': 'audio/music-title.mp3' },
    fetchImpl: async (url) => {
      requests.push(url);
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
  });

  await audio.start();

  const context = FakeAudioContext.instances.at(-1);
  assert.deepEqual(requests, ['audio/music-title.mp3']);
  assert.equal(context.sources.at(-1).loop, true);
  assert.equal(context.sources.at(-1).started, true);
});

test('DreamAudio crossfades between scene music loops', async () => {
  const audio = createAudio({
    assets: {
      'music-title': 'audio/music-title.mp3',
      'music-hub': 'audio/music-hub.mp3'
    },
    fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const title = context.sources.at(-1);

  await audio.setMode('hub');
  const hub = context.sources.at(-1);

  assert.notEqual(hub, title);
  assert.equal(hub.loop, true);
  assert.equal(title.gain.gain.linearTarget, 0);
  assert.equal(title.stopAt, 0.8);
  assert.equal(hub.gain.gain.linearTarget, 0.43);
  assert.equal(hub.gain.gain.linearAt, 0.8);
});

test('DreamAudio ignores a stale music load after a rapid scene change', async () => {
  let resolveTitle;
  const audio = createAudio({
    assets: {
      'music-title': 'audio/music-title.mp3',
      'music-hub': 'audio/music-hub.mp3'
    },
    fetchImpl: (url) => url === 'audio/music-title.mp3'
      ? new Promise((resolve) => { resolveTitle = () => resolve(new Response(new Uint8Array([1]), { status: 200 })); })
      : Promise.resolve(new Response(new Uint8Array([2]), { status: 200 }))
  });

  const starting = audio.start();
  const changing = audio.setMode('hub');
  resolveTitle();
  await Promise.all([starting, changing]);

  const context = FakeAudioContext.instances.at(-1);
  assert.equal(context.sources.length, 2, 'only ambience and the Hub track start');
  assert.equal(context.sources.at(-1).loop, true);
});

test('DreamAudio mute stops and unmute restarts the current scene music', async () => {
  const audio = createAudio({
    assets: { 'music-title': 'audio/music-title.mp3' },
    fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const title = context.sources.at(-1);

  assert.equal(await audio.toggle(), true);
  assert.equal(title.stopped, true);
  assert.equal(await audio.toggle(), false);
  const restarted = context.sources.at(-1);

  assert.notEqual(restarted, title);
  assert.equal(restarted.loop, true);
  assert.equal(restarted.started, true);
});

test('DreamAudio start does not restart scene music on later UI actions', async () => {
  let requests = 0;
  const audio = createAudio({
    assets: { 'music-title': 'audio/music-title.mp3' },
    fetchImpl: async () => {
      requests += 1;
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const sourceCount = context.sources.length;

  await audio.start();

  assert.equal(requests, 1);
  assert.equal(context.sources.length, sourceCount);
});

test('DreamAudio retains synthesized music when a scene track is unavailable', async () => {
  const audio = createAudio({
    assets: { 'music-title': 'audio/music-title.mp3' },
    fetchImpl: async () => new Response('Missing', { status: 404 })
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const oscillatorCount = context.oscillators.length;

  audio.musicStep();

  assert.ok(context.oscillators.length > oscillatorCount);
});

test('DreamAudio stops the old scene and synthesizes when the next scene track fails', async () => {
  const audio = createAudio({
    assets: {
      'music-title': 'audio/music-title.mp3',
      'music-hub': 'audio/music-hub.mp3'
    },
    fetchImpl: async (url) => url === 'audio/music-hub.mp3'
      ? new Response('Missing', { status: 404 })
      : new Response(new Uint8Array([1, 2, 3]), { status: 200 })
  });
  await audio.start();
  const context = FakeAudioContext.instances.at(-1);
  const title = context.sources.at(-1);
  const oscillatorCount = context.oscillators.length;

  await audio.setMode('hub');
  audio.musicStep();

  assert.equal(title.stopped, true);
  assert.ok(context.oscillators.length > oscillatorCount);
});
