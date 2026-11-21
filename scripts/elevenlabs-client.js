import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const API_ROOT = 'https://api.elevenlabs.io/v1';
const OUTPUT_FORMAT = 'mp3_44100_128';

export async function requestAudioAsset(asset, { apiKey, voiceIds, fetchImpl = fetch }) {
  const isSpeech = asset.kind === 'speech';
  const voiceId = voiceIds[asset.voice];
  const url = isSpeech
    ? `${API_ROOT}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`
    : `${API_ROOT}/sound-generation?output_format=${OUTPUT_FORMAT}`;
  const body = isSpeech ? {
    text: asset.text,
    model_id: 'eleven_multilingual_v2'
  } : {
    text: asset.prompt,
    duration_seconds: asset.duration,
    prompt_influence: 0.65,
    loop: false
  };
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs ${asset.id} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return new Uint8Array(await response.arrayBuffer());
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
