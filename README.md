# Lucid (Dreamwalker)

A finishable, single-player browser adventure RPG. Explore a rendered 3D ancient ruin, fight wisps, improve stats, and enter three linked dreams that transform the game into a 2D platformer. Recover the Somnus Lens by solving each dreamer's personal mystery.

Built with vanilla JavaScript ES modules, Three.js (3D hub), Canvas 2D (dreams), and synthesized Web Audio. No external art or audio assets.

## Quickstart

```bash
npm install
npm run dev          # dev server
npm test             # unit tests (node:test)
npm run build        # production build
npm run preview      # preview the production build
npm run test:browser # scripted browser campaign (dev server must be running)
```

## Project structure

- `index.html`, `src/style.css`: application shell and responsive interface
- `src/main.js`: screens, HUD, input, saves, and mode transitions
- `src/game/`: progression, levels, physics, 3D hub, 2D engine, and audio
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
- Ask first: external services, licensed assets, backend dependencies.
- Never: collect personal data, commit secrets, use third-party art or audio.
