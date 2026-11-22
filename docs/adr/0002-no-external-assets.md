# No external art or audio assets

All visuals are built from code (Three.js geometry, Canvas 2D drawing, CSS) and all sound is synthesized with Web Audio at runtime. The repo contains no image, sprite, font-binary, or audio files, and never will.

**Status**: superseded by [0004](0004-elevenlabs-generated-audio.md) for audio; the no-external-art constraint remains accepted.

This started as a game-jam constraint and we kept it: it removes all asset licensing questions, keeps the repo fully self-contained, and forces a coherent procedural art direction. Fonts are the one partial exception: self-hosted via Fontsource npm packages (OFL-licensed), resolved at build time rather than fetched from a CDN.

**Consequences**: any future "nicer art" request is a rendering-code change, not an asset drop. Third-party art or audio stays on the "never" list in `SPEC.md`.
