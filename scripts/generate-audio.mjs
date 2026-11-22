import { fileURLToPath } from 'node:url';
import { AUDIO_ASSETS } from '../src/game/audio-library.js';
import { generateAudioLibrary, resolveVoiceIds } from './elevenlabs-client.js';

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceIds = resolveVoiceIds(process.env);

if (!apiKey) {
  console.error('Set ELEVENLABS_API_KEY before generating audio. No requests were made.');
  process.exitCode = 1;
} else {
  const missingVoices = Object.entries(voiceIds).filter(([, id]) => !id).map(([role]) => role);
  if (missingVoices.length) {
    console.error(`Set ELEVENLABS_VOICE_ID or role-specific voice IDs for: ${missingVoices.join(', ')}. No requests were made.`);
    process.exitCode = 1;
  } else {
    try {
      const manifest = await generateAudioLibrary(AUDIO_ASSETS, {
        apiKey,
        voiceIds,
        outputDir: fileURLToPath(new URL('../public/audio/', import.meta.url)),
        manifestPath: fileURLToPath(new URL('../src/game/generated-audio.js', import.meta.url))
      });
      console.log(`Audio library ready: ${Object.keys(manifest).length} local assets. Review the MP3s before shipping.`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
