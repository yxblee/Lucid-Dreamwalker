# ElevenLabs-generated dream audio

Narration, Dreamer voice-overs, and sound effects may be generated with ElevenLabs ahead of time and shipped as local MP3 assets. Visuals remain procedural, and unapproved third-party art or audio remains prohibited.

**Status**: accepted; supersedes [0002](0002-no-external-assets.md) for audio only.

The original no-external-assets constraint kept the game self-contained and avoided licensing questions. Issue #2 explicitly asks for ElevenLabs narration, voice-overs, and sound effects, so audio now has a narrow exception with a controlled generation pipeline.

A Node command calls ElevenLabs' text-to-speech and sound-generation endpoints using environment variables for the API key and voice IDs. It writes local files under `public/audio/` and a browser-safe manifest in `src/game/generated-audio.js`. The browser never receives the key, calls ElevenLabs, or sends player data to the service. Existing files are reused so routine generation does not repeatedly incur charges.

`DreamAudio` plays manifest assets through the existing Web Audio graph. Synthesized sound remains the fallback when generated effects are absent or cannot be decoded, and the campaign requires no credentials or network access. Missing generated narration is silent. Mute persists, and starting a story cue or leaving its screen interrupts the previous narration.

**Consequences**: generation incurs ElevenLabs usage costs and requires an account with rights to use the selected voices and generated audio. Every regenerated batch requires listening review for pronunciation, pacing, loudness, and fit before shipping. Voice IDs are configuration rather than save data. Runtime remains local-only; deleting `public/audio/` and emptying the generated manifest restores the fully synthesized game.
