import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export function resolveVoiceIds(env) {
  const sharedVoiceId = env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  return Object.fromEntries(['narrator', 'mara', 'ilex', 'sera'].map((role) => [
    role,
    env[`ELEVENLABS_${role.toUpperCase()}_VOICE_ID`] || sharedVoiceId
  ]));
}

async function readAudioStream(audio) {
  const chunks = [];
  let length = 0;
  for await (const chunk of audio) {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    chunks.push(bytes);
    length += bytes.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function requestAudioAsset(asset, { voiceIds, client }) {
  const sdk = client || new ElevenLabsClient();
  let audio;
  if (asset.kind === 'speech') {
    audio = await sdk.textToSpeech.convert(voiceIds[asset.voice], {
      text: asset.text,
      modelId: 'eleven_v4',
      voiceSettings: { stability: 0.7, similarityBoost: 0.5 }
    });
  } else {
    audio = await sdk.textToSoundEffects.convert({
      text: asset.prompt,
      modelId: 'eleven_text_to_sound_v3',
      durationSeconds: asset.duration,
      promptInfluence: 0.65,
      loop: asset.kind === 'music'
    });
  }
  return readAudioStream(audio);
}

export async function generateAudioLibrary(assets, options) {
  const { outputDir, manifestPath } = options;
  await mkdir(outputDir, { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });
  const manifest = {};

  for (const asset of assets) {
    const filename = `${asset.id}.mp3`;
    manifest[asset.id] = `audio/${filename}`;
    const outputPath = join(outputDir, filename);
    const exists = await stat(outputPath).then(() => true, () => false);
    if (exists) continue;
    const audio = await requestAudioAsset(asset, options);
    await writeFile(outputPath, audio);
  }

  await writeFile(manifestPath, `export const GENERATED_AUDIO = ${JSON.stringify(manifest, null, 2)};\n`);
  return manifest;
}
