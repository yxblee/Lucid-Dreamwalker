import { CLUES } from './progression.js';

export const AUDIO_ASSETS = [
  {
    id: 'narration-opening',
    kind: 'speech',
    voice: 'narrator',
    text: 'Every dream is a door. Every memory, a piece of the truth. Find Mara’s dream beneath the cyan arch.'
  },
  {
    id: 'voice-bellwright-intro',
    kind: 'speech',
    voice: 'mara',
    text: 'A song remembers its ending. Dreamwalker, follow my final note.'
  },
  {
    id: 'voice-archivist-intro',
    kind: 'speech',
    voice: 'ilex',
    text: 'Every erased name leaves a margin. Bring back the minute they stole.'
  },
  {
    id: 'voice-cartographer-intro',
    kind: 'speech',
    voice: 'sera',
    text: 'No path is lost while someone remembers it. Find the promise beneath my map.'
  },
  ...['bellwright', 'archivist', 'cartographer'].map((dream) => ({
    id: `clue-${dream}`,
    kind: 'speech',
    voice: { bellwright: 'mara', archivist: 'ilex', cartographer: 'sera' }[dream],
    text: CLUES[dream]
  })),
  {
    id: 'narration-dais',
    kind: 'speech',
    voice: 'narrator',
    text: 'Three hollows wait in the stone. Follow the dreamers’ memories; only their shared truth can wake the Lens.'
  },
  {
    id: 'narration-sealed',
    kind: 'speech',
    voice: 'narrator',
    text: 'This arch has no reflection. Another dreamer’s memory will show you the way here.'
  },
  {
    id: 'narration-win',
    kind: 'speech',
    voice: 'narrator',
    text: 'Mara’s song, Ilex’s minute, and Sera’s path were never separate. They were a promise made to the dreamwalker—you. The Hollow Hour is quiet. The ruins can finally wake.'
  },
  ...Object.entries({
    jump: ['A soft ethereal platformer jump, airy cloth and a quick magical lift, no music', 0.5],
    double: ['A second magical platformer jump with a bright sparkling lift, short and delicate', 0.6],
    crystal: ['Collecting a small moon crystal, glassy magical chime, bright and brief', 0.7],
    memory: ['Recovering a lost memory, warm shimmering magical sigil with a soft bell', 1.4],
    attack: ['A swift spectral sword slash through air, sharp magical blade, no voice', 0.5],
    hit: ['A soft impact against a spirit, muted magical thump, not graphic', 0.5],
    enemy: ['A hostile wisp dissolving into harmless sparks, airy spectral release', 0.9],
    gravity: ['Gravity flipping in a dream, rising whoosh with a deep magical inversion', 0.9],
    slide: ['A quick platformer slide across smooth ancient stone, soft friction', 0.6],
    time: ['Time slowing in a dream, descending clocklike magical shimmer, no ticking loop', 1.2],
    rewind: ['Two seconds rewinding, rising reversed magical shimmer, brief and clear', 1.2],
    break: ['An imagined stone wall shattering into dream fragments, one restrained crash', 1.1],
    portal: ['Crossing a luminous dream portal, gentle dimensional whoosh and soft resonance', 1.6],
    level: ['Dream level increased, short hopeful magical ascending motif', 1.4],
    win: ['The Somnus Lens restored, serene triumphant magical resolution, short and gentle', 2.8],
    click: ['A subtle soft stone interface click, extremely short and quiet', 0.5]
  }).map(([name, [prompt, duration]]) => ({
    id: `sfx-${name}`,
    kind: 'sound',
    prompt,
    duration
  }))
];
