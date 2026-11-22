import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateAudioLibrary, requestAudioAsset } from '../scripts/elevenlabs-client.js';

test('ElevenLabs speech generation authenticates and sends the narration contract', async () => {
  let request;
  const audio = new Uint8Array([1, 2, 3]);
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(audio, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  };

  const result = await requestAudioAsset({
    id: 'narration-opening',
    kind: 'speech',
    voice: 'narrator',
    text: 'Every dream is a door.'
  }, {
    apiKey: 'test-key',
    voiceIds: { narrator: 'voice-narrator' },
    fetchImpl
  });

  assert.equal(request.url, 'https://api.elevenlabs.io/v1/text-to-speech/voice-narrator?output_format=mp3_44100_128');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['xi-api-key'], 'test-key');
  assert.equal(request.options.headers.Accept, 'audio/mpeg');
  assert.deepEqual(JSON.parse(request.options.body), {
    text: 'Every dream is a door.',
    model_id: 'eleven_multilingual_v2'
  });
  assert.deepEqual(result, audio);
});

test('ElevenLabs sound generation sends the effect prompt and duration', async () => {
  let request;
  const audio = new Uint8Array([4, 5, 6]);
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(audio, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  };

  const result = await requestAudioAsset({
    id: 'sfx-jump',
    kind: 'sound',
    prompt: 'A soft ethereal platformer jump, short and non-musical',
    duration: 0.5
  }, {
    apiKey: 'test-key',
    voiceIds: {},
    fetchImpl
  });

  assert.equal(request.url, 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128');
  assert.equal(request.options.headers['xi-api-key'], 'test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    text: 'A soft ethereal platformer jump, short and non-musical',
    duration_seconds: 0.5,
    prompt_influence: 0.65,
    loop: false
  });
  assert.deepEqual(result, audio);
});

test('ElevenLabs generation reports API errors without exposing the key', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ detail: { message: 'Invalid API key' } }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });

  await assert.rejects(requestAudioAsset({
    id: 'narration-opening',
    kind: 'speech',
    voice: 'narrator',
    text: 'Every dream is a door.'
  }, {
    apiKey: 'secret-test-key',
    voiceIds: { narrator: 'voice-narrator' },
    fetchImpl
  }), (error) => {
    assert.match(error.message, /401/);
    assert.match(error.message, /Invalid API key/);
    assert.doesNotMatch(error.message, /secret-test-key/);
    return true;
  });
});

test('audio library generation writes local assets and reuses existing files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lucid-audio-'));
  const outputDir = join(directory, 'audio');
  const manifestPath = join(directory, 'generated-audio.js');
  let requests = 0;
  const fetchImpl = async () => {
    requests += 1;
    return new Response(new Uint8Array([7, 8, 9]), { status: 200 });
  };
  const assets = [{
    id: 'sfx-jump',
    kind: 'sound',
    prompt: 'A soft ethereal jump',
    duration: 0.5
  }];
  const options = { apiKey: 'test-key', voiceIds: {}, fetchImpl, outputDir, manifestPath };

  try {
    const manifest = await generateAudioLibrary(assets, options);
    assert.deepEqual(manifest, { 'sfx-jump': 'audio/sfx-jump.mp3' });
    assert.deepEqual(new Uint8Array(await readFile(join(outputDir, 'sfx-jump.mp3'))), new Uint8Array([7, 8, 9]));
    assert.match(await readFile(manifestPath, 'utf8'), /"sfx-jump": "audio\/sfx-jump\.mp3"/);
    assert.equal(requests, 1);

    await generateAudioLibrary(assets, options);
    assert.equal(requests, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
