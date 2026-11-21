# Three.js hub, Canvas 2D dreams, no framework

The game is vanilla JavaScript ES modules with two renderers: Three.js for the 3D hub and Canvas 2D for dreams, plus Web Audio for synthesized sound. No UI framework, no game engine, no TypeScript.

**Status**: accepted

We chose this because the game is small enough that a framework's state machinery would add more weight than it removes, and the hub/dream split maps cleanly onto two purpose-built renderers rather than one general engine. The constraint that keeps this viable is the seam in `AGENTS.md`: pure game rules (progression, physics, level contracts) never import DOM or Three.js APIs, so they stay testable under `node --test`.

**Consequences**: swapping renderers later means rewriting `hub.js` or `platformer.js` wholesale, but progression and level data survive any renderer change.
