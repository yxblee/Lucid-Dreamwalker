# Lucid (Dreamwalker)

A finishable, single-player browser adventure RPG. Explore a rendered 3D ancient ruin, fight wisps, improve stats, and enter three linked dreams that transform the game into a 2D platformer. Recover the Somnus Lens by solving each dreamer's personal mystery.

Built with vanilla JavaScript ES modules, Three.js (3D hub), Canvas 2D (dreams), and Web Audio. Narration, Dreamer voice-overs, effects, and scene music can be generated with ElevenLabs; synthesized audio keeps the game playable without generated assets. Visuals remain procedural.

## Quickstart

```bash
npm install
npm run dev          # dev server
npm test             # unit tests (node:test)
npm run build        # production build
npm run preview      # preview the production build
npm run test:browser # scripted browser campaign (dev server must be running)
```

## ElevenLabs dream audio

The game uses local generated assets when present and synthesized effects otherwise. No API key is shipped to the browser, and gameplay never calls ElevenLabs.

Generation requires an ElevenLabs account and uses your plan's credits. After `npx -y @elevenlabs/cli@latest onboard init`, generate with the key stored in `.env.local`:

```bash
npm run audio:generate
```

The official `@elevenlabs/elevenlabs-js` SDK uses `eleven_v4` for speech and `eleven_text_to_sound_v3` for effects and 30-second instrumental scene loops. Title, Hub, Dream, and win music loops crossfade with scene changes, with per-scene gains calibrated to measured track loudness; synthesized music remains the fallback. George is the default pre-made voice. Set `ELEVENLABS_VOICE_ID` to choose another shared voice, or configure `ELEVENLABS_NARRATOR_VOICE_ID`, `ELEVENLABS_MARA_VOICE_ID`, `ELEVENLABS_ILEX_VOICE_ID`, and `ELEVENLABS_SERA_VOICE_ID` for distinct performances. Role-specific IDs override the shared ID. The command generates opening/ending narration, Dreamer introductions and Clues, hub voice-overs, and all gameplay effects through the [speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) and [sound-generation](https://elevenlabs.io/docs/api-reference/sound-generation) APIs. The command loads `.env.local` when present and otherwise uses existing environment variables.

MP3s are written to `public/audio/` and the browser manifest to `src/game/generated-audio.js`. Existing MP3s are reused; delete only the files you intend to regenerate. Review every new batch for pronunciation, pacing, loudness, content, and your plan's usage rights before committing it. Environment files are ignored by Git; do not put credentials in source files or command output.

## Project structure

- `index.html`, `src/style.css`: application shell and responsive interface
- `src/main.js`: screens, HUD, input, saves, and mode transitions
- `src/game/`: progression, levels, physics, 3D hub, 2D engine, audio content, and playback
- `scripts/`: author-time ElevenLabs generation and local asset manifest
- `tests/`: deterministic unit tests plus a scripted browser campaign
- `SPEC.md`: the V1 product spec (objective, boundaries, success criteria)
- `GLOSSARY.md`: shared domain vocabulary
- `docs/adr/`: architecture decision records

## Development workflow (SDLC)

This repo follows a spec-driven, test-first workflow:

| Stage | Practice | Output |
| --- | --- | --- |
| Docs | Keep domain language and decisions current | `GLOSSARY.md` terms, ADRs in `docs/adr/` |
| Spec | Write a spec before any non-trivial work | A spec published as a GitHub issue |
| Tickets | Break the spec into tracer bullets | Small issues with explicit blocking edges |
| Implement | Red-green-refactor, one vertical slice at a time | Failing test first, then the fix |
| Review | Review against repo standards and the spec | Standards + spec-fidelity review before merge |
| PR | Evidence over assertion | PR body with visual summary, before/after evidence, merge-danger call |

Principles, in short:

1. **Spec before code.** Non-trivial work starts as a spec (`SPEC.md` for V1; GitHub issues afterwards), so intent is reviewable before implementation.
2. **Tickets stay small.** Each ticket is a tracer bullet: one thin, end-to-end slice that declares what blocks it.
3. **Red-green-refactor.** Every behavior change starts with a failing test. Unit-test pure game rules (progression, unlocks, collisions, level validity); verify real gameplay with the browser campaign.
4. **Decisions get recorded.** Hard-to-reverse or surprising choices become ADRs in `docs/adr/`; domain language lives in `GLOSSARY.md`.
5. **Review before merge.** A change is reviewed against both the repo's standards and its originating spec, then shipped as a PR with evidence it works.

## Boundaries

- Always: keep the campaign completable, validate saved data, support keyboard and touch, verify real gameplay.
- Ask first: new external services, licensed assets, backend dependencies. Author-time ElevenLabs audio generation is approved by ADR 0004.
- Never: collect personal data, commit secrets, use unapproved third-party art or audio.
