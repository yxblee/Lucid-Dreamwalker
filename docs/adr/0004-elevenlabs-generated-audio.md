# ElevenLabs-generated dream audio

Narration, Dreamer voice-overs, sound effects, and scene music may be generated with ElevenLabs ahead of time and shipped as local MP3 assets. Visuals remain procedural, and unapproved third-party art or audio remains prohibited.

**Status**: accepted; supersedes [0002](0002-no-external-assets.md) for audio only.

The original no-external-assets constraint kept the game self-contained and avoided licensing questions. Issue #2 explicitly asks for ElevenLabs narration, voice-overs, and sound effects, so audio now has a narrow exception with a controlled generation pipeline.

A Node command uses the official `@elevenlabs/elevenlabs-js` SDK with `eleven_v4` speech and `eleven_text_to_sound_v3` effects. The same sound model generates 30-second instrumental loops with its native loop option because the Music API requires a paid plan; the user approved this alternative. Scene changes crossfade the matching title, Hub, Dream, or win loop, with stale-load protection, per-scene gains calibrated to measured track loudness, and synthesized music fallback. The API key comes from the environment, with optional shared or role-specific voice IDs; George is the default pre-made voice. It writes local files under `public/audio/` and a browser-safe manifest in `src/game/generated-audio.js`. The browser never receives the key, calls ElevenLabs, or sends player data to the service. Existing files are reused so routine generation does not repeatedly incur charges.

`DreamAudio` plays manifest assets through the existing Web Audio graph. Synthesized sound remains the fallback when generated effects are absent or cannot be decoded, and the campaign requires no credentials or network access. Missing generated narration is silent. Mute persists, and starting a story cue or leaving its screen interrupts the previous narration.

**Consequences**: generation incurs ElevenLabs usage costs and requires an account with rights to use the selected voices and generated audio. Every regenerated batch requires listening review for pronunciation, pacing, loudness, and fit before shipping. Voice IDs are configuration rather than save data. Runtime remains local-only; deleting `public/audio/` and emptying the generated manifest restores the fully synthesized game.
