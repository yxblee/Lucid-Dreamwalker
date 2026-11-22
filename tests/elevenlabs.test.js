import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateAudioLibrary, requestAudioAsset, resolveVoiceIds } from '../scripts/elevenlabs-client.js';
import { AUDIO_ASSETS } from '../src/game/audio-library.js';
import { GENERATED_AUDIO } from '../src/game/generated-audio.js';

test('ElevenLabs SDK speech generation sends the narration contract', async () => {
  let request;
  const audio = new Uint8Array([1, 2, 3]);
  const client = {
    textToSpeech: {
      convert: async (voiceId, options) => {
        request = { voiceId, options };
        return new Response(audio).body;
      }
    }
  };

  const result = await requestAudioAsset({
    id: 'narration-opening',
    kind: 'speech',
    voice: 'narrator',
    text: 'Every dream is a door.'
  }, {
    voiceIds: { narrator: 'voice-narrator' },
    client
  });

  assert.equal(request.voiceId, 'voice-narrator');
  assert.deepEqual(request.options, {
    text: 'Every dream is a door.',
    modelId: 'eleven_v4',
    voiceSettings: { stability: 0.7, similarityBoost: 0.5 }
  });
  assert.deepEqual(result, audio);
});

test('ElevenLabs SDK sound generation sends the effect prompt and duration', async () => {
  let request;
  const audio = new Uint8Array([4, 5, 6]);
  const client = {
    textToSoundEffects: {
      convert: async (options) => {
        request = options;
        return new Response(audio).body;
      }
    }
  };

  const result = await requestAudioAsset({
    id: 'sfx-jump',
    kind: 'sound',
    prompt: 'A soft ethereal platformer jump, short and non-musical',
    duration: 0.5
  }, {
    voiceIds: {},
    client
  });

  assert.deepEqual(request, {
    text: 'A soft ethereal platformer jump, short and non-musical',
    modelId: 'eleven_text_to_sound_v3',
    durationSeconds: 0.5,
    promptInfluence: 0.65,
    loop: false
  });
  assert.deepEqual(result, audio);
});

test('ElevenLabs SDK generation propagates API errors', async () => {
  const client = {
    textToSpeech: {
      convert: async () => { throw new Error('401: Invalid API key'); }
    }
  };

  await assert.rejects(requestAudioAsset({
    id: 'narration-opening',
    kind: 'speech',
    voice: 'narrator',
    text: 'Every dream is a door.'
  }, {
    voiceIds: { narrator: 'voice-narrator' },
    client
  }), (error) => {
    assert.match(error.message, /401/);
    assert.match(error.message, /Invalid API key/);
    return true;
  });
});

test('audio library generation writes local assets and reuses existing files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lucid-audio-'));
  const outputDir = join(directory, 'audio');
  const manifestPath = join(directory, 'generated-audio.js');
  let requests = 0;
  const client = {
    textToSoundEffects: {
      convert: async () => {
        requests += 1;
        return new Response(new Uint8Array([7, 8, 9])).body;
      }
    }
  };
  const assets = [{
    id: 'sfx-jump',
    kind: 'sound',
    prompt: 'A soft ethereal jump',
    duration: 0.5
  }];
  const options = { voiceIds: {}, client, outputDir, manifestPath };

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

test('generated audio manifest covers every narration, effect, and scene music asset', async () => {
  assert.equal(Object.keys(GENERATED_AUDIO).length, AUDIO_ASSETS.length);
  for (const asset of AUDIO_ASSETS) {
    const path = GENERATED_AUDIO[asset.id];
    assert.ok(path, `Missing manifest entry for ${asset.id}`);
    await access(new URL(`../public/${path}`, import.meta.url));
  }
});

test('voice configuration uses George for every narration role by default', () => {
  assert.deepEqual(resolveVoiceIds({}), {
    narrator: 'JBFqnCBsd6RMkjVDRZzb',
    mara: 'JBFqnCBsd6RMkjVDRZzb',
    ilex: 'JBFqnCBsd6RMkjVDRZzb',
    sera: 'JBFqnCBsd6RMkjVDRZzb'
  });
});

test('voice configuration applies shared and Dreamer-specific overrides', () => {
  assert.deepEqual(resolveVoiceIds({
    ELEVENLABS_VOICE_ID: 'shared-voice',
    ELEVENLABS_MARA_VOICE_ID: 'mara-voice'
  }), {
    narrator: 'shared-voice',
    mara: 'mara-voice',
    ilex: 'shared-voice',
    sera: 'shared-voice'
  });
});

test('ElevenLabs SDK instrumental generation sends the scene prompt and loop contract', async () => {
  let request;
  const audio = new Uint8Array([10, 11, 12]);
  const client = {
    textToSoundEffects: {
      convert: async (options) => {
        request = options;
        return new Response(audio).body;
      }
    }
  };

  const result = await requestAudioAsset({
    id: 'music-hub',
    kind: 'music',
    prompt: 'Ancient ruins exploration, instrumental seamless loop',
    duration: 30
  }, {
    voiceIds: {},
    client
  });

  assert.deepEqual(request, {
    text: 'Ancient ruins exploration, instrumental seamless loop',
    modelId: 'eleven_text_to_sound_v3',
    durationSeconds: 30,
    promptInfluence: 0.65,
    loop: true
  });
  assert.deepEqual(result, audio);
});
