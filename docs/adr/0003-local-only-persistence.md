# Local-only persistence in localStorage

Progress and settings persist in `localStorage` under a versioned save key (`lucid-hollow-hour-v1`, kept stable across the project rename so existing saves survive). There is no backend, no account system, and no analytics; nothing leaves the browser.

**Status**: accepted

A single-player jam-scale game needs no server, and local-only storage keeps the "never collect personal data" boundary trivially true. The save schema carries a `version` field; any schema change must bump it and migrate or cleanly reject old saves, since `createNewGame` is the only constructor of valid state.

**Consequences**: saves are per-browser and per-device, with no sync. If cross-device play ever matters, this ADR must be revisited first, and the "ask first: backend dependencies" boundary applies.
