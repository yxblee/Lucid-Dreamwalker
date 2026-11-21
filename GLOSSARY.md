# Lucid (Dreamwalker)

A single-player dreamwalking adventure: a 3D ruin hub surrounding three 2D platformer dreams, joined by one mystery about the Somnus Lens.

## Language

**Dreamwalker**:
The player character, the one who can enter dreams. Used for the project name and the player's narrative role.
_Avoid_: player avatar, hero

**Hub**:
The 3D overworld of ancient ruins (Three.js) where the dreamwalker fights wisps, earns XP and crystals, and buys upgrades.
_Avoid_: overworld, map, world

**Dream**:
A 2D platformer sequence (Canvas 2D) entered from the hub. Three dreams exist, one per dreamer, unlocked in fixed order: bellwright, archivist, cartographer.
_Avoid_: level, stage, mission

**Dreamer**:
One of the three NPCs whose personal mystery holds a clue: Mara the bellwright, Ilex the archivist, Sera the cartographer.
_Avoid_: quest giver, boss

**Wisp**:
A hostile spirit in the hub, the game's only enemy type.

**Somnus Lens**:
The artifact the dreamwalker must recover to win. Hidden by the cartographer to keep the Hollow Hour asleep.
_Avoid_: macguffin, relic

**Hollow Hour**:
The frozen moment the ruins are trapped in; the story's name for the game's premise. Kept as in-fiction text only, not the project name.

**Clue**:
A line of the mystery, earned by completing a dream, that connects one dreamer to the next. Three clues together reveal where the Lens is.

**Crystal**:
Currency collected in the hub and dreams, spent on upgrades (Moonblade, Woven heart, Lucid vessel).
_Avoid_: coin, gem

**Focus**:
The resource spent on dream abilities (time slow, rewind), regenerated over time.
_Avoid_: mana, energy

**Save**:
The versioned progress record in `localStorage` under `SAVE_KEY`. Schema changes bump `version` and must migrate or reject old saves.
