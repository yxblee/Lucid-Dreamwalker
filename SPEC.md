# Spec: LUCID — Dreamwalker V1

## Objective
A finishable, single-player browser adventure RPG. Explore a rendered 3D ancient ruin, fight wisps, improve stats, and enter three linked dreams that transform the game into a 2D platformer. Recover the Somnus Lens by solving each dreamer's personal mystery.

## Tech Stack
Vanilla JavaScript ES modules, Three.js for the hub, Canvas 2D for dreams, Web Audio for playback and synthesized fallback sound, ElevenLabs for author-time narration/voice-over/effect/scene-music generation, Vite, and Node's built-in test runner. No external art assets.

## Commands
- Develop: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Preview production build: `npm run preview`
- Browser campaign (with the dev server running): `npm run test:browser`

## Project Structure
- `index.html`, `src/style.css`: application shell and responsive interface
- `src/main.js`: screens, HUD, input, saves, and mode transitions
- `src/game/`: progression, levels, physics, 3D hub, 2D engine, and audio
- `tests/`: deterministic unit tests for progression, level contracts, and collisions

## Code Style
Small ES modules with named exports; camelCase functions, PascalCase classes, and data-driven level definitions. Rendering and DOM code stay separate from pure game rules.

```js
export function addExperience(state, amount) {
  return { ...state, xp: state.xp + amount };
}
```

## Testing Strategy
Unit-test pure progression, unlock, upgrade, collision, and level-validity rules. Run a production build and browser checks of start, hub movement/combat, all dream transitions, pause/restart, save/continue, and the win flow.

## Boundaries
- Always: keep the campaign completable, validate saved data, support keyboard and touch, and verify real gameplay.
- Ask first: new external services, licensed assets, or backend dependencies. Author-time ElevenLabs audio generation is the approved exception in ADR 0004.
- Never: collect personal data, commit secrets, or use unapproved third-party art/audio.

## Success Criteria
- Start, continue, pause, defeat/restart, and win screens work without reloads.
- The hub has real 3D terrain, collision, animated character, dynamic lights, particles, enemies, XP, crystals, and upgrades.
- Gravity flipping, double jump, sliding, time slow/rewind, flight, wall breaking, moving/rotating/vanishing platforms, hazards, puzzles, and time limits are playable and required where introduced.
- Three dreams unlock in order; their clues connect the dreamers and recovering the Somnus Lens produces a win screen.
- Progress and settings persist locally; sound can be muted; controls and objectives remain visible.
- Unit tests and production build pass, with no browser runtime errors in the tested path.

## Out of Scope (Deferred)
Networked play, gamepad-specific UI, user-generated levels, and a large multi-hour content campaign.

## Open Questions
None; the browser, local-save, and compact-campaign assumptions were stated before implementation.
