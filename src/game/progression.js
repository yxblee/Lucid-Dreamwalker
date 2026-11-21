export const SAVE_KEY = 'lucid-hollow-hour-v1';

export const DREAM_ORDER = ['bellwright', 'archivist', 'cartographer'];
export const CLUES = {
  bellwright: 'The bellwright did not forget the song. She gave its final note to an archivist.',
  archivist: 'The archive names no thief. The cartographer hid the Lens to keep the Hollow Hour asleep.',
  cartographer: 'Three memories, one promise: the Somnus Lens was never lost—only entrusted to you.'
};

export const UPGRADES = {
  blade: { name: 'Moonblade', cost: 12, detail: '+6 strike damage', max: 3 },
  vitality: { name: 'Woven heart', cost: 10, detail: '+20 maximum health', max: 3 },
  focus: { name: 'Lucid vessel', cost: 14, detail: '+25 focus and faster recovery', max: 3 }
};

export function createNewGame() {
  return {
    version: 1,
    crystals: 0,
    level: 1,
    xp: 0,
    completed: [],
    unlocked: ['bellwright'],
    abilities: { gravity: true, doubleJump: false, slide: false, time: false, fly: false },
    upgrades: { blade: 0, vitality: 0, focus: 0 },
    clues: [],
    artifact: false,
    playTime: 0,
    deaths: 0,
    enemiesDefeated: 0,
    crystalsCollected: 0
  };
}

export function getStats(state) {
  return {
    maxHealth: 100 + (state.level - 1) * 10 + state.upgrades.vitality * 20,
    damage: 16 + (state.level - 1) * 2 + state.upgrades.blade * 6,
    maxFocus: 100 + (state.level - 1) * 5 + state.upgrades.focus * 25,
    speed: 250 + Math.min(50, (state.level - 1) * 5),
    focusRegen: 13 + state.upgrades.focus * 3
  };
}

export function addExperience(state, amount) {
  const next = { ...state, xp: state.xp + Math.max(0, amount) };
  while (next.xp >= next.level * 100) {
    next.xp -= next.level * 100;
    next.level += 1;
  }
  return next;
}

export function purchaseUpgrade(state, id) {
  const upgrade = UPGRADES[id];
  if (!upgrade || state.crystals < upgrade.cost || state.upgrades[id] >= upgrade.max) return state;
  return {
    ...state,
    crystals: state.crystals - upgrade.cost,
    upgrades: { ...state.upgrades, [id]: state.upgrades[id] + 1 }
  };
}

export function completeDream(state, id) {
  const index = DREAM_ORDER.indexOf(id);
  if (index < 0 || state.completed.includes(id) || !state.unlocked.includes(id)) return state;
  const completed = [...state.completed, id];
  const unlocked = [...state.unlocked];
  if (DREAM_ORDER[index + 1]) unlocked.push(DREAM_ORDER[index + 1]);
  const abilities = { ...state.abilities };
  if (id === 'bellwright') Object.assign(abilities, { doubleJump: true, slide: true });
  if (id === 'archivist') Object.assign(abilities, { time: true, fly: true });
  return {
    ...state,
    completed,
    unlocked,
    abilities,
    clues: [...state.clues, CLUES[id]],
    crystals: state.crystals + 15,
    artifact: id === 'cartographer' ? true : state.artifact
  };
}

export function validateSave(value) {
  if (!value || value.version !== 1 || !Number.isFinite(value.crystals) || !Number.isFinite(value.level)) return null;
  if (!Array.isArray(value.completed) || !Array.isArray(value.unlocked) || !value.upgrades) return null;
  const fresh = createNewGame();
  return {
    ...fresh,
    ...value,
    completed: value.completed.filter((id) => DREAM_ORDER.includes(id)),
    unlocked: value.unlocked.filter((id) => DREAM_ORDER.includes(id)),
    clues: Array.isArray(value.clues) ? value.clues.filter((clue) => typeof clue === 'string') : [],
    abilities: { ...fresh.abilities, ...value.abilities },
    upgrades: { ...fresh.upgrades, ...value.upgrades }
  };
}
