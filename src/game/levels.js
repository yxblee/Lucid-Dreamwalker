export const DREAMS = {
  bellwright: {
    name: 'The Unstrung Bell', dreamer: 'Mara, the bellwright', subtitle: 'A song remembers its ending.', lawIcon: 'gravity',
    palette: ['#071d2a', '#123f4c', '#72f1d1', '#f3cf7a'], timeLimit: 150,
    rule: 'Invert gravity. Ring the three memories, then reach the waking gate.'
  },
  archivist: {
    name: 'The Stolen Minute', dreamer: 'Ilex, the archivist', subtitle: 'Even a lost moment leaves an echo.', lawIcon: 'time',
    palette: ['#160e2c', '#39245b', '#b8a0ff', '#ffca7a'], timeLimit: 135,
    rule: 'Bend time, slip beneath the seals, and recover the three stolen minutes.'
  },
  cartographer: {
    name: 'The World Unmade', dreamer: 'Sera, the cartographer', subtitle: 'Every path was drawn to protect you.', lawIcon: 'fly',
    palette: ['#100f24', '#253557', '#f2b1a5', '#ff8d89'], timeLimit: 150,
    rule: 'Combine every gift. Unmake the barriers and find the Somnus Lens.'
  }
};

const floor = (x, w, y = 620) => ({ x, y, w, h: 100, kind: 'stone' });
const ledge = (x, y, w, extra = {}) => ({ x, y, w, h: 24, kind: 'ledge', ...extra });
const crystal = (x, y) => ({ x, y, w: 22, h: 28, kind: 'crystal', taken: false });
const memory = (x, y) => ({ x, y, w: 34, h: 34, kind: 'memory', taken: false });
const spikes = (x, y, w, direction = 'up') => ({ x, y, w, h: 24, direction });
const wisp = (x, y, range = 110) => ({ x, y, w: 38, h: 38, originX: x, range, direction: 1, health: 34, maxHealth: 34, alive: true });

const LEVELS = {
  bellwright: {
    width: 5250, height: 720, spawn: { x: 100, y: 560 }, exit: { x: 5080, y: 520, w: 64, h: 100 },
    platforms: [
      floor(0, 900), floor(1030, 850), floor(2020, 650), floor(2820, 920), floor(3910, 1340),
      { x: 0, y: 0, w: 1150, h: 80, kind: 'ceiling' }, { x: 1300, y: 0, w: 1100, h: 80, kind: 'ceiling' },
      { x: 2550, y: 0, w: 1150, h: 80, kind: 'ceiling' }, { x: 3880, y: 0, w: 1370, h: 80, kind: 'ceiling' },
      ledge(530, 440, 230), ledge(1160, 460, 190), ledge(1450, 350, 220, { motion: { axis: 'y', amount: 110, speed: 1.1 } }),
      ledge(1840, 230, 180), ledge(2180, 440, 240), ledge(2490, 260, 160, { motion: { axis: 'x', amount: 130, speed: 0.9 } }),
      ledge(2930, 430, 200), ledge(3260, 280, 200), ledge(3560, 150, 180),
      ledge(4020, 430, 220, { motion: { axis: 'y', amount: 100, speed: 1.3 } }), ledge(4480, 350, 230), ledge(4800, 480, 180)
    ],
    hazards: [spikes(900, 660, 130), spikes(1880, 596, 140), spikes(2670, 660, 150), spikes(3740, 596, 170), spikes(1210, 80, 90, 'down'), spikes(2400, 80, 150, 'down'), spikes(3700, 80, 180, 'down')],
    collectibles: [memory(620, 380), memory(2510, 120), memory(4550, 290), crystal(330, 550), crystal(1200, 400), crystal(1520, 280), crystal(2200, 380), crystal(3000, 370), crystal(3600, 90), crystal(4100, 360), crystal(4870, 420)],
    enemies: [wisp(1110, 574), wisp(2130, 574), wisp(2940, 574), wisp(4210, 574)], walls: [], gates: [], checkpoints: [{ x: 2050, y: 550 }, { x: 3940, y: 550 }]
  },
  archivist: {
    width: 6000, height: 720, spawn: { x: 100, y: 560 }, exit: { x: 5820, y: 510, w: 64, h: 110 },
    platforms: [
      floor(0, 820), floor(940, 850), floor(1930, 710), floor(2790, 890), floor(3830, 760), floor(4740, 1260),
      ledge(700, 430, 160, { vanish: { period: 4, on: 2.7 } }), ledge(950, 340, 180, { motion: { axis: 'y', amount: 120, speed: 1.4 } }),
      ledge(1290, 450, 200), ledge(1580, 310, 170, { vanish: { period: 3.4, on: 2.2 } }), ledge(1830, 190, 180),
      ledge(2160, 430, 190, { motion: { axis: 'x', amount: 140, speed: 1.3 } }), ledge(2500, 310, 160, { vanish: { period: 4.2, on: 2.8 } }),
      ledge(2840, 440, 180), ledge(3150, 320, 190, { motion: { axis: 'y', amount: 130, speed: 1.6 } }), ledge(3480, 190, 160),
      ledge(3750, 410, 150, { vanish: { period: 3.2, on: 2 } }), ledge(4090, 310, 200), ledge(4420, 190, 170, { motion: { axis: 'x', amount: 150, speed: 1 } }),
      ledge(4790, 430, 190, { vanish: { period: 4, on: 2.5 } }), ledge(5140, 320, 180), ledge(5480, 440, 200)
    ],
    hazards: [spikes(820, 660, 120), spikes(1790, 660, 140), spikes(2640, 660, 150), spikes(3680, 596, 150), spikes(4590, 660, 150), spikes(1390, 596, 90), spikes(3270, 596, 100), spikes(5210, 596, 100)],
    collectibles: [memory(1600, 245), memory(3500, 125), memory(5160, 255), crystal(400, 550), crystal(730, 370), crystal(1330, 390), crystal(2200, 370), crystal(2870, 380), crystal(4110, 250), crystal(4470, 130), crystal(4830, 370), crystal(5520, 380)],
    enemies: [wisp(1040, 574), wisp(2020, 574), wisp(2900, 574), wisp(3950, 574), wisp(4850, 574)], walls: [],
    gates: [{ x: 1190, y: 525, w: 55, h: 65 }, { x: 3020, y: 525, w: 55, h: 65 }, { x: 5000, y: 525, w: 55, h: 65 }],
    checkpoints: [{ x: 1950, y: 550 }, { x: 3860, y: 550 }]
  },
  cartographer: {
    width: 6600, height: 720, spawn: { x: 100, y: 560 }, exit: { x: 6400, y: 500, w: 72, h: 120 },
    platforms: [
      floor(0, 760), floor(920, 640), floor(1730, 670), floor(2580, 580), floor(3340, 700), floor(4230, 610), floor(5020, 1580),
      { x: 0, y: 0, w: 900, h: 70, kind: 'ceiling' }, { x: 1100, y: 0, w: 1000, h: 70, kind: 'ceiling' },
      { x: 2320, y: 0, w: 1100, h: 70, kind: 'ceiling' }, { x: 3650, y: 0, w: 1100, h: 70, kind: 'ceiling' }, { x: 4960, y: 0, w: 1640, h: 70, kind: 'ceiling' },
      ledge(650, 420, 150, { rotate: 1 }), ledge(920, 330, 180, { motion: { axis: 'y', amount: 140, speed: 1.2 } }),
      ledge(1240, 220, 160, { vanish: { period: 3.4, on: 2.2 }, rotate: -1 }), ledge(1530, 410, 160, { motion: { axis: 'x', amount: 120, speed: 1.5 } }),
      ledge(1860, 300, 180, { rotate: 1 }), ledge(2190, 160, 170, { vanish: { period: 4, on: 2.8 } }), ledge(2460, 360, 150, { rotate: -1 }),
      ledge(2770, 440, 180, { motion: { axis: 'y', amount: 160, speed: 1.4 } }), ledge(3080, 260, 160, { vanish: { period: 3.2, on: 2.1 } }),
      ledge(3410, 170, 180, { rotate: 1 }), ledge(3730, 390, 190, { motion: { axis: 'x', amount: 150, speed: 1.2 } }),
      ledge(4070, 240, 150, { vanish: { period: 4, on: 2.4 }, rotate: -1 }), ledge(4430, 410, 180), ledge(4770, 250, 170, { motion: { axis: 'y', amount: 120, speed: 1.5 } }),
      ledge(5100, 380, 160, { rotate: 1 }), ledge(5440, 190, 180, { vanish: { period: 3.5, on: 2.4 } }), ledge(5790, 350, 190, { motion: { axis: 'x', amount: 140, speed: 1.4 } }), ledge(6150, 460, 180)
    ],
    hazards: [spikes(760, 660, 160), spikes(1560, 660, 170), spikes(2400, 660, 180), spikes(3160, 660, 180), spikes(4040, 660, 190), spikes(4840, 660, 180), spikes(1020, 596, 100), spikes(2100, 70, 120, 'down'), spikes(3500, 70, 150, 'down'), spikes(5600, 596, 110)],
    collectibles: [memory(1260, 150), memory(3430, 105), memory(5450, 125), crystal(400, 550), crystal(680, 350), crystal(1550, 340), crystal(1900, 240), crystal(2500, 290), crystal(3100, 190), crystal(3770, 320), crystal(4460, 340), crystal(5130, 310), crystal(5840, 280), crystal(6200, 400)],
    enemies: [wisp(980, 574), wisp(1810, 574), wisp(2650, 574), wisp(3400, 574), wisp(4300, 574), wisp(5150, 574)],
    walls: [{ x: 1430, y: 440, w: 48, h: 180, health: 1, broken: false }, { x: 3930, y: 400, w: 48, h: 220, health: 1, broken: false }, { x: 5680, y: 430, w: 48, h: 190, health: 1, broken: false }],
    gates: [{ x: 2890, y: 525, w: 55, h: 65 }], checkpoints: [{ x: 1750, y: 550 }, { x: 4250, y: 550 }]
  }
};

export function createDream(id) {
  const source = LEVELS[id];
  if (!source) throw new Error(`Unknown dream: ${id}`);
  return { id, ...DREAMS[id], ...structuredClone(source) };
}
