# AGENTS.md

## Project

Lucid (Dreamwalker): a single-player browser adventure RPG. 3D hub (Three.js) with combat and upgrades; three 2D platformer dreams (Canvas 2D). Web Audio provides playback and synthesized fallback, with optional ElevenLabs-generated narration, voice-overs, effects, and scene music. See `SPEC.md` for the V1 spec and `README.md` for the development workflow.

Work is tracked as GitHub issues on `yxblee/Lucid-Dreamwalker` (use the `gh` CLI). Domain language lives in `GLOSSARY.md`; decisions live in `docs/adr/`. Use glossary terms in issue titles, test names, and proposals, and flag any output that contradicts an ADR.

## Commands

- Develop: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Browser campaign (dev server running): `npm run test:browser`
- Generate ElevenLabs audio (credentials required): `npm run audio:generate`

## Code style

Small ES modules with named exports; camelCase functions, PascalCase classes, data-driven level definitions. Rendering and DOM code stay separate from pure game rules: pure logic in `src/game/progression.js`, `physics.js`, and `levels.js` must stay free of DOM and Three.js imports so `node --test` can exercise it.

## Testing

Test-first (red-green-refactor) for every behavior change. Unit tests run with `node --test tests/*.test.js` and must stay deterministic (no timers, no randomness without a seed). Gameplay-affecting changes also get verified through `npm run test:browser` against the dev server.

## Boundaries

- Always: keep the campaign completable, validate saved data, support keyboard and touch, verify real gameplay.
- Ask first: new external services, licensed assets, backend dependencies. Author-time ElevenLabs audio generation is approved by ADR 0004.
- Never: collect personal data, commit secrets, use unapproved third-party art or audio.
