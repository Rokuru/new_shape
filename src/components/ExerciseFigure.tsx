import { useEffect, useState } from 'react';
import type { MovePattern } from '../data/exerciseGuide';

type P = [number, number];
type Gear =
  | { t: 'bar' | 'db' | 'kb'; at: P }
  | { t: 'line'; from: P; to: P; w?: number }
  | { t: 'cable'; from: P; to: P };

/** Pose en vue de profil (tournée vers la droite) ou de face (`front`). Le 2e jeu de membres est dessiné en arrière-plan. */
interface Pose {
  head: P;
  neck: P;
  hip: P;
  knee: P;
  ankle: P;
  toe?: P;
  elbow: P;
  hand: P;
  knee2?: P;
  ankle2?: P;
  elbow2?: P;
  hand2?: P;
  gear?: Gear[];
  front?: boolean;
}

const GROUND = 112;
const up = (p: P, dy: number): P => [p[0], p[1] - dy];

// Debout, de profil
const STAND: Pose = { head: [60, 16], neck: [60, 27], hip: [60, 62], knee: [61, 86], ankle: [60, 110], elbow: [60, 41], hand: [62, 55] };
// Debout, de face
const FRONT: Pose = { front: true, head: [60, 14], neck: [60, 25], hip: [60, 60], knee: [55, 84], ankle: [54, 108], knee2: [65, 84], ankle2: [66, 108], elbow: [51, 40], hand: [49, 54], elbow2: [69, 40], hand2: [71, 54] };

const BENCH: Gear = { t: 'line', from: [18, 88], to: [92, 88], w: 6 };
const FLOOR_LYING = { neck: [80, 104] as P, head: [90, 103] as P, hip: [52, 106] as P };

// Machines guidées : assis de profil (siège + dossier), ou de face.
const SEAT: Gear = { t: 'line', from: [34, 82], to: [70, 82], w: 6 };
const BACKREST: Gear = { t: 'line', from: [37, 36], to: [37, 82], w: 6 };
const SIT = { head: [47, 30] as P, neck: [46, 41] as P, hip: [48, 76] as P, knee: [72, 76] as P, ankle: [73, 106] as P };
// De face et assis : cuisses vues en raccourci (genoux juste sous les hanches), dossier large derrière le buste.
const SIT_FRONT = { front: true, head: [60, 26] as P, neck: [60, 37] as P, hip: [60, 68] as P, knee: [55, 76] as P, ankle: [55, 104] as P, knee2: [65, 76] as P, ankle2: [65, 104] as P };
const SEAT_FRONT: Gear[] = [
  { t: 'line', from: [60, 22], to: [60, 66], w: 26 },
  { t: 'line', from: [40, 72], to: [80, 72], w: 6 },
];
const handle = (h: P, vertical = true): Gear => ({ t: 'line', from: vertical ? [h[0], h[1] - 6] : [h[0] - 6, h[1]], to: vertical ? [h[0], h[1] + 6] : [h[0] + 6, h[1]], w: 4 });
const RAILS: Gear[] = [
  { t: 'line', from: [40, -12], to: [40, 112], w: 2 },
  { t: 'line', from: [80, -12], to: [80, 112], w: 2 },
];

const hingeBottom = (gear: Gear[], hand: P = [74, 98], elbow: P = [75, 84]): Pose => ({ head: [86, 68], neck: [76, 70], hip: [44, 80], knee: [63, 88], ankle: [60, 110], elbow, hand, gear });

const POSES: Record<MovePattern, Pose[]> = {
  squat: [
    { ...STAND, elbow: [50, 36], hand: [57, 28], gear: [{ t: 'bar', at: [57, 27] }] },
    { head: [61, 42], neck: [56, 52], hip: [43, 84], knee: [66, 88], ankle: [60, 110], elbow: [46, 60], hand: [53, 52], gear: [{ t: 'bar', at: [53, 51] }] },
  ],
  hinge: [hingeBottom([{ t: 'bar', at: [74, 103] }]), { ...STAND, elbow: [61, 41], hand: [63, 55], gear: [{ t: 'bar', at: [64, 58] }] }],
  swing: [
    { head: [83, 58], neck: [74, 62], hip: [44, 76], knee: [62, 88], ankle: [60, 110], elbow: [66, 74], hand: [58, 86], gear: [{ t: 'kb', at: [56, 92] }] },
    { ...STAND, elbow: [73, 30], hand: [87, 32], gear: [{ t: 'kb', at: [93, 34] }] },
  ],
  lunge: [STAND, { head: [57, 38], neck: [57, 49], hip: [56, 84], knee: [78, 88], ankle: [78, 110], knee2: [46, 104], ankle2: [26, 108], elbow: [57, 63], hand: [58, 77] }],
  bench: [
    { head: [88, 80], neck: [78, 82], hip: [44, 84], knee: [28, 80], ankle: [24, 110], elbow: [77, 68], hand: [77, 54], gear: [BENCH, { t: 'bar', at: [77, 52] }] },
    { head: [88, 80], neck: [78, 82], hip: [44, 84], knee: [28, 80], ankle: [24, 110], elbow: [68, 92], hand: [75, 76], gear: [BENCH, { t: 'bar', at: [75, 74] }] },
  ],
  pushup: [
    { head: [90, 78], neck: [80, 82], hip: [46, 92], knee: [29, 100], ankle: [12, 108], elbow: [80, 96], hand: [80, 110] },
    { head: [90, 97], neck: [80, 100], hip: [46, 103], knee: [29, 106], ankle: [12, 108], elbow: [68, 97], hand: [80, 110] },
  ],
  press: [
    { ...STAND, elbow: [67, 42], hand: [68, 28], gear: [{ t: 'bar', at: [68, 26] }] },
    { ...STAND, elbow: [62, 13], hand: [62, -1], gear: [{ t: 'bar', at: [62, -3] }] },
  ],
  vpull: [
    { head: [60, 20], neck: [60, 31], hip: [60, 65], knee: [60, 87], ankle: [58, 108], elbow: [63, 18], hand: [64, 4], gear: [{ t: 'line', from: [36, 3], to: [92, 3], w: 4 }] },
    { head: [60, -2], neck: [60, 13], hip: [60, 47], knee: [62, 70], ankle: [60, 92], elbow: [50, 18], hand: [64, 4], gear: [{ t: 'line', from: [36, 3], to: [92, 3], w: 4 }] },
  ],
  row: [
    { head: [87, 38], neck: [78, 44], hip: [50, 66], knee: [60, 87], ankle: [58, 110], elbow: [78, 58], hand: [78, 72], gear: [{ t: 'bar', at: [78, 75] }] },
    { head: [87, 38], neck: [78, 44], hip: [50, 66], knee: [60, 87], ankle: [58, 110], elbow: [64, 52], hand: [72, 62], gear: [{ t: 'bar', at: [72, 65] }] },
  ],
  curl: [
    { ...STAND, elbow: [60, 42], hand: [62, 56], gear: [{ t: 'db', at: [63, 57] }] },
    { ...STAND, elbow: [60, 42], hand: [71, 32], gear: [{ t: 'db', at: [72, 31] }] },
  ],
  pushdown: [
    { ...STAND, elbow: [60, 42], hand: [74, 40], gear: [{ t: 'cable', from: [84, -10], to: [74, 40] }] },
    { ...STAND, elbow: [60, 42], hand: [64, 56], gear: [{ t: 'cable', from: [84, -10], to: [64, 56] }] },
  ],
  overhead_ext: [
    { ...STAND, elbow: [63, 11], hand: [51, 20], gear: [{ t: 'db', at: [49, 21] }] },
    { ...STAND, elbow: [63, 11], hand: [64, -3], gear: [{ t: 'db', at: [64, -5] }] },
  ],
  raise: [
    { ...FRONT, gear: [{ t: 'db', at: [49, 56] }, { t: 'db', at: [71, 56] }] },
    { ...FRONT, elbow: [43, 29], hand: [30, 28], elbow2: [77, 29], hand2: [90, 28], gear: [{ t: 'db', at: [27, 28] }, { t: 'db', at: [93, 28] }] },
  ],
  fly: [
    { ...FRONT, elbow: [43, 32], hand: [30, 36], elbow2: [77, 32], hand2: [90, 36], gear: [{ t: 'cable', from: [8, 0], to: [30, 36] }, { t: 'cable', from: [112, 0], to: [90, 36] }] },
    { ...FRONT, elbow: [48, 38], hand: [57, 44], elbow2: [72, 38], hand2: [63, 44], gear: [{ t: 'cable', from: [8, 0], to: [57, 44] }, { t: 'cable', from: [112, 0], to: [63, 44] }] },
  ],
  calf: [
    { ...STAND, gear: [{ t: 'line', from: [50, 111], to: [80, 111], w: 3 }] },
    { ...STAND, head: up(STAND.head, 7), neck: up(STAND.neck, 7), hip: up(STAND.hip, 7), knee: up(STAND.knee, 7), ankle: [60, 103], toe: [69, 110], elbow: up(STAND.elbow, 7), hand: up(STAND.hand, 7), gear: [{ t: 'line', from: [50, 111], to: [80, 111], w: 3 }] },
  ],
  leg_ext: [
    { head: [46, 30], neck: [46, 41], hip: [50, 75], knee: [73, 75], ankle: [74, 99], elbow: [50, 57], hand: [57, 72], gear: [{ t: 'line', from: [36, 80], to: [76, 80], w: 6 }, { t: 'line', from: [38, 40], to: [38, 80], w: 6 }] },
    { head: [46, 30], neck: [46, 41], hip: [50, 75], knee: [73, 75], ankle: [96, 70], elbow: [50, 57], hand: [57, 72], gear: [{ t: 'line', from: [36, 80], to: [76, 80], w: 6 }, { t: 'line', from: [38, 40], to: [38, 80], w: 6 }] },
  ],
  leg_curl: [
    { head: [46, 30], neck: [46, 41], hip: [50, 75], knee: [73, 75], ankle: [96, 72], elbow: [50, 57], hand: [57, 72], gear: [{ t: 'line', from: [36, 80], to: [76, 80], w: 6 }, { t: 'line', from: [38, 40], to: [38, 80], w: 6 }] },
    { head: [46, 30], neck: [46, 41], hip: [50, 75], knee: [73, 75], ankle: [68, 98], elbow: [50, 57], hand: [57, 72], gear: [{ t: 'line', from: [36, 80], to: [76, 80], w: 6 }, { t: 'line', from: [38, 40], to: [38, 80], w: 6 }] },
  ],
  bridge: [
    { ...FLOOR_LYING, knee: [34, 90], ankle: [26, 110], elbow: [70, 108], hand: [60, 109] },
    { ...FLOOR_LYING, hip: [55, 88], knee: [35, 85], ankle: [26, 110], elbow: [70, 108], hand: [60, 109] },
  ],
  plank: [{ head: [90, 90], neck: [80, 94], hip: [46, 99], knee: [29, 103], ankle: [12, 107], elbow: [80, 108], hand: [93, 108] }],
  side_plank: [{ head: [90, 76], neck: [82, 84], hip: [50, 96], knee: [33, 102], ankle: [14, 107], elbow: [82, 108], hand: [90, 109], elbow2: [84, 70], hand2: [86, 56] }],
  crunch: [
    { ...FLOOR_LYING, knee: [36, 90], ankle: [26, 110], elbow: [86, 96], hand: [91, 101] },
    { head: [82, 82], neck: [73, 89], hip: [52, 106], knee: [36, 90], ankle: [26, 110], elbow: [82, 80], hand: [83, 87] },
  ],
  leg_raise: [
    { head: [60, 20], neck: [60, 31], hip: [60, 65], knee: [60, 87], ankle: [59, 108], elbow: [62, 18], hand: [63, 4], gear: [{ t: 'line', from: [36, 3], to: [92, 3], w: 4 }] },
    { head: [58, 20], neck: [58, 31], hip: [60, 65], knee: [82, 64], ankle: [104, 62], elbow: [62, 18], hand: [63, 4], gear: [{ t: 'line', from: [36, 3], to: [92, 3], w: 4 }] },
  ],
  dip: [
    { head: [64, 22], neck: [62, 34], hip: [58, 68], knee: [55, 90], ankle: [42, 97], elbow: [64, 48], hand: [66, 62], gear: [{ t: 'line', from: [48, 63], to: [86, 63], w: 4 }] },
    { head: [72, 42], neck: [66, 52], hip: [57, 85], knee: [52, 105], ankle: [38, 108], elbow: [52, 58], hand: [66, 62], gear: [{ t: 'line', from: [48, 63], to: [86, 63], w: 4 }] },
  ],
  jacks: [
    { ...FRONT, knee: [58, 84], ankle: [58, 108], knee2: [62, 84], ankle2: [62, 108] },
    { ...FRONT, elbow: [46, 13], hand: [38, 0], elbow2: [74, 13], hand2: [82, 0], knee: [50, 84], ankle: [42, 108], knee2: [70, 84], ankle2: [78, 108] },
  ],
  run: [
    { ...STAND, knee2: [78, 62], ankle2: [72, 84], elbow: [54, 41], hand: [64, 46], elbow2: [64, 40], hand2: [74, 32] },
    { ...STAND, knee: [78, 62], ankle: [72, 84], knee2: [60, 86], ankle2: [60, 110], elbow: [64, 40], hand: [74, 32], elbow2: [54, 41], hand2: [64, 46] },
  ],
  wall_sit: [{ head: [41, 41], neck: [41, 52], hip: [41, 86], knee: [65, 86], ankle: [65, 110], elbow: [44, 66], hand: [52, 78], gear: [{ t: 'line', from: [33, 20], to: [33, 112], w: 4 }] }],
  getup: [
    { ...FLOOR_LYING, knee: [36, 90], ankle: [26, 110], elbow: [81, 90], hand: [82, 76], gear: [{ t: 'kb', at: [82, 70] }] },
    { ...STAND, elbow: [61, 13], hand: [62, -1], gear: [{ t: 'kb', at: [62, -7] }] },
  ],
  clean: [hingeBottom([{ t: 'bar', at: [74, 103] }]), { ...STAND, elbow: [73, 36], hand: [66, 28], gear: [{ t: 'bar', at: [67, 27] }] }],
  superman: [
    { head: [92, 103], neck: [82, 106], hip: [50, 108], knee: [32, 108], ankle: [14, 108], elbow: [95, 106], hand: [108, 106] },
    { head: [90, 95], neck: [80, 100], hip: [50, 107], knee: [32, 104], ankle: [15, 98], elbow: [93, 95], hand: [106, 90] },
  ],

  // ---------- Machines guidées ----------
  machine_press: [
    { ...SIT, elbow: [38, 56], hand: [58, 54], gear: [SEAT, BACKREST, handle([58, 54])] },
    { ...SIT, elbow: [65, 52], hand: [86, 51], gear: [SEAT, BACKREST, handle([86, 51])] },
  ],
  seated_press: [
    { ...SIT, elbow: [58, 56], hand: [59, 40], gear: [SEAT, BACKREST, handle([59, 40], false)] },
    { ...SIT, elbow: [52, 24], hand: [55, 8], gear: [SEAT, BACKREST, handle([55, 8], false)] },
  ],
  pulldown: [
    { ...SIT, elbow: [55, 19], hand: [60, 3], gear: [SEAT, { t: 'line', from: [64, 70], to: [82, 70], w: 5 }, { t: 'cable', from: [60, -14], to: [60, 3] }, { t: 'line', from: [36, 3], to: [84, 3], w: 4 }] },
    { ...SIT, head: [45, 31], neck: [44, 42], elbow: [38, 58], hand: [56, 41], gear: [SEAT, { t: 'line', from: [64, 70], to: [82, 70], w: 5 }, { t: 'cable', from: [60, -14], to: [56, 41] }, { t: 'line', from: [32, 41], to: [80, 41], w: 4 }] },
  ],
  seated_row: [
    { ...SIT, head: [52, 31], neck: [50, 42], elbow: [72, 48], hand: [92, 50], gear: [SEAT, { t: 'line', from: [74, 40], to: [74, 66], w: 5 }, handle([92, 50])] },
    { ...SIT, head: [50, 30], neck: [48, 41], elbow: [30, 50], hand: [52, 52], gear: [SEAT, { t: 'line', from: [74, 40], to: [74, 66], w: 5 }, handle([52, 52])] },
  ],
  machine_curl: [
    { ...SIT, head: [53, 30], neck: [51, 41], elbow: [74, 62], hand: [94, 73], gear: [SEAT, { t: 'line', from: [56, 46], to: [78, 66], w: 5 }, { t: 'db', at: [96, 74] }] },
    { ...SIT, head: [53, 30], neck: [51, 41], elbow: [74, 62], hand: [66, 41], gear: [SEAT, { t: 'line', from: [56, 46], to: [78, 66], w: 5 }, { t: 'db', at: [65, 39] }] },
  ],
  seated_dip: [
    { ...SIT, elbow: [32, 52], hand: [52, 58], gear: [SEAT, BACKREST, handle([52, 58], false)] },
    { ...SIT, elbow: [48, 60], hand: [53, 79], gear: [SEAT, BACKREST, handle([53, 79], false)] },
  ],
  // De profil, assis face à la machine, poitrine contre l'appui : les bras partent devant et s'ouvrent vers l'arrière.
  rear_fly: [
    { ...SIT, head: [50, 30], neck: [49, 41], elbow: [68, 44], hand: [88, 45], gear: [SEAT, { t: 'line', from: [58, 40], to: [58, 70], w: 5 }, handle([88, 45])] },
    { ...SIT, head: [50, 30], neck: [49, 41], elbow: [36, 43], hand: [24, 45], elbow2: [62, 43], hand2: [70, 45], gear: [SEAT, { t: 'line', from: [58, 40], to: [58, 70], w: 5 }, handle([24, 45])] },
  ],
  abduct: [
    { ...SIT_FRONT, knee: [57, 76], ankle: [57, 104], knee2: [63, 76], ankle2: [63, 104], elbow: [48, 54], hand: [43, 68], elbow2: [72, 54], hand2: [77, 68], gear: SEAT_FRONT },
    { ...SIT_FRONT, knee: [41, 74], ankle: [39, 104], knee2: [79, 74], ankle2: [81, 104], elbow: [48, 54], hand: [43, 68], elbow2: [72, 54], hand2: [77, 68], gear: SEAT_FRONT },
  ],
  adduct: [
    { ...SIT_FRONT, knee: [41, 74], ankle: [39, 104], knee2: [79, 74], ankle2: [81, 104], elbow: [48, 54], hand: [43, 68], elbow2: [72, 54], hand2: [77, 68], gear: SEAT_FRONT },
    { ...SIT_FRONT, knee: [57, 76], ankle: [57, 104], knee2: [63, 76], ankle2: [63, 104], elbow: [48, 54], hand: [43, 68], elbow2: [72, 54], hand2: [77, 68], gear: SEAT_FRONT },
  ],
  kickback: [
    { head: [82, 38], neck: [73, 44], hip: [52, 64], knee: [64, 80], ankle: [57, 98], knee2: [54, 88], ankle2: [53, 110], elbow: [80, 56], hand: [90, 62], gear: [{ t: 'line', from: [66, 52], to: [84, 46], w: 5 }, handle([90, 62])] },
    { head: [82, 38], neck: [73, 44], hip: [52, 64], knee: [34, 66], ankle: [14, 64], knee2: [54, 88], ankle2: [53, 110], elbow: [80, 56], hand: [90, 62], gear: [{ t: 'line', from: [66, 52], to: [84, 46], w: 5 }, handle([90, 62])] },
  ],
  leg_press: [
    { head: [31, 46], neck: [36, 56], hip: [52, 86], knee: [64, 60], ankle: [84, 72], elbow: [44, 76], hand: [54, 86], gear: [{ t: 'line', from: [24, 46], to: [48, 92], w: 6 }, { t: 'line', from: [79, 62], to: [89, 82], w: 5 }] },
    { head: [31, 46], neck: [36, 56], hip: [52, 86], knee: [74, 70], ankle: [96, 56], elbow: [44, 76], hand: [54, 86], gear: [{ t: 'line', from: [24, 46], to: [48, 92], w: 6 }, { t: 'line', from: [91, 46], to: [101, 66], w: 5 }] },
  ],
  vleg_press: [
    { head: [20, 98], neck: [30, 100], hip: [58, 100], knee: [74, 80], ankle: [64, 62], toe: [64, 54], elbow: [44, 96], hand: [54, 104], gear: [{ t: 'line', from: [10, 106], to: [64, 106], w: 6 }, { t: 'line', from: [50, 54], to: [78, 54], w: 5 }] },
    { head: [20, 98], neck: [30, 100], hip: [58, 100], knee: [62, 74], ankle: [63, 48], toe: [63, 40], elbow: [44, 96], hand: [54, 104], gear: [{ t: 'line', from: [10, 106], to: [64, 106], w: 6 }, { t: 'line', from: [49, 40], to: [77, 40], w: 5 }] },
  ],
  lying_leg_curl: [
    { head: [92, 80], neck: [82, 83], hip: [50, 85], knee: [28, 85], ankle: [8, 85], toe: [6, 93], elbow: [90, 92], hand: [100, 92], gear: [{ t: 'line', from: [16, 91], to: [96, 91], w: 6 }] },
    { head: [92, 80], neck: [82, 83], hip: [50, 85], knee: [28, 85], ankle: [20, 63], toe: [12, 60], elbow: [90, 92], hand: [100, 92], gear: [{ t: 'line', from: [16, 91], to: [96, 91], w: 6 }] },
  ],
  machine_crunch: [
    { ...SIT, elbow: [57, 40], hand: [53, 29], gear: [SEAT, BACKREST, handle([53, 29], false)] },
    { ...SIT, head: [71, 62], neck: [63, 56], elbow: [75, 66], hand: [72, 55], gear: [SEAT, BACKREST, handle([72, 55], false)] },
  ],
  seated_ext: [
    { ...SIT, head: [73, 45], neck: [64, 51], elbow: [70, 64], hand: [62, 58], gear: [SEAT, { t: 'line', from: [56, 44], to: [62, 40], w: 6 }] },
    { ...SIT, head: [38, 31], neck: [42, 42], elbow: [53, 54], hand: [48, 46], gear: [SEAT, { t: 'line', from: [32, 44], to: [38, 38], w: 6 }] },
  ],
  rotary: [
    { ...SIT_FRONT, elbow: [48, 48], hand: [54, 40], elbow2: [72, 48], hand2: [66, 40], gear: SEAT_FRONT },
    { ...SIT_FRONT, neck: [62, 33], head: [62, 22], elbow: [60, 50], hand: [68, 42], elbow2: [80, 46], hand2: [76, 37], gear: SEAT_FRONT },
  ],
  smith_squat: [
    { ...STAND, elbow: [50, 36], hand: [57, 28], gear: [...RAILS, { t: 'bar', at: [57, 27] }] },
    { head: [61, 42], neck: [56, 52], hip: [43, 84], knee: [66, 88], ankle: [62, 110], elbow: [46, 60], hand: [53, 52], gear: [...RAILS, { t: 'bar', at: [53, 51] }] },
  ],
};

function Gear({ g }: { g: Gear }) {
  switch (g.t) {
    case 'bar':
      return (
        <g>
          <circle cx={g.at[0]} cy={g.at[1]} r={9} className="fig-plate" />
          <circle cx={g.at[0]} cy={g.at[1]} r={2.5} className="fig-gear-fill" />
        </g>
      );
    case 'db':
      return <rect x={g.at[0] - 6} y={g.at[1] - 3.5} width={12} height={7} rx={2} className="fig-gear-fill" />;
    case 'kb':
      return (
        <g>
          <circle cx={g.at[0]} cy={g.at[1] + 2} r={6} className="fig-gear-fill" />
          <path d={`M${g.at[0] - 4} ${g.at[1] - 2}a4 4 0 0 1 8 0`} className="fig-gear-line" strokeWidth={2.5} fill="none" />
        </g>
      );
    case 'line':
      return <line x1={g.from[0]} y1={g.from[1]} x2={g.to[0]} y2={g.to[1]} className="fig-gear-line" strokeWidth={g.w ?? 4} />;
    case 'cable':
      return <line x1={g.from[0]} y1={g.from[1]} x2={g.to[0]} y2={g.to[1]} className="fig-cable" strokeWidth={1.5} />;
  }
}

function Figure({ pose }: { pose: Pose }) {
  const seg = (a: P, b: P, cls: string) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={cls} />;
  const toe = pose.front ? undefined : (pose.toe ?? ([pose.ankle[0] + 9, pose.ankle[1]] as P));
  const toe2 = pose.front || !pose.ankle2 ? undefined : ([pose.ankle2[0] + 9, pose.ankle2[1]] as P);
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {pose.gear?.filter((g) => g.t === 'line' || g.t === 'cable').map((g, i) => <Gear key={'b' + i} g={g} />)}
      {/* membres en arrière-plan */}
      {pose.knee2 && pose.ankle2 && (
        <>
          {seg(pose.hip, pose.knee2, 'fig-limb2')}
          {seg(pose.knee2, pose.ankle2, 'fig-limb2')}
          {toe2 && seg(pose.ankle2, toe2, 'fig-limb2')}
        </>
      )}
      {pose.elbow2 && pose.hand2 && (
        <>
          {seg(pose.neck, pose.elbow2, 'fig-limb2')}
          {seg(pose.elbow2, pose.hand2, 'fig-limb2')}
        </>
      )}
      {seg(pose.neck, pose.hip, 'fig-body')}
      {seg(pose.hip, pose.knee, 'fig-limb')}
      {seg(pose.knee, pose.ankle, 'fig-limb')}
      {toe && seg(pose.ankle, toe, 'fig-limb')}
      {seg(pose.neck, pose.elbow, 'fig-limb')}
      {seg(pose.elbow, pose.hand, 'fig-limb')}
      <circle cx={pose.head[0]} cy={pose.head[1]} r={7} className="fig-head" />
      {pose.gear?.filter((g) => g.t !== 'line' && g.t !== 'cable').map((g, i) => <Gear key={'f' + i} g={g} />)}
    </g>
  );
}

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const JOINTS = ['head', 'neck', 'hip', 'knee', 'ankle', 'toe', 'elbow', 'hand', 'knee2', 'ankle2', 'elbow2', 'hand2'] as const;

/** Pose intermédiaire entre le départ et l'arrivée (t de 0 à 1). */
function between(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = { ...(t < 0.5 ? a : b) };
  for (const k of JOINTS) {
    const pa = a[k];
    const pb = b[k];
    if (pa && pb) out[k] = lerp(pa, pb, t);
  }
  // Matériel : déplacé avec le corps quand les deux poses ont le même, sinon on bascule à mi-chemin.
  const ga = a.gear ?? [];
  const gb = b.gear ?? [];
  if (ga.length === gb.length && ga.every((g, i) => g.t === gb[i].t))
    out.gear = ga.map((g, i) => {
      const h = gb[i];
      if ((g.t === 'bar' || g.t === 'db' || g.t === 'kb') && 'at' in h) return { ...g, at: lerp(g.at, h.at, t) };
      if ((g.t === 'line' || g.t === 'cable') && 'from' in h) return { ...g, from: lerp(g.from, h.from, t), to: lerp(g.to, h.to, t) };
      return g;
    });
  return out;
}

/** Cycle d'une répétition : départ (pause), effort, arrivée (pause), retour. */
const CYCLE = [
  { label: 'Départ', ms: 600 },
  { label: 'Effort', ms: 1100 },
  { label: 'Arrivée', ms: 500 },
  { label: 'Retour (lent)', ms: 1800 },
];
const CYCLE_MS = CYCLE.reduce((s, c) => s + c.ms, 0);
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

function phaseAt(ms: number): { t: number; label: string } {
  let rest = ms % CYCLE_MS;
  for (const [i, c] of CYCLE.entries()) {
    if (rest < c.ms) {
      const x = rest / c.ms;
      return { label: c.label, t: i === 0 ? 0 : i === 1 ? ease(x) : i === 2 ? 1 : 1 - ease(x) };
    }
    rest -= c.ms;
  }
  return { label: CYCLE[0].label, t: 0 };
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Frame({ pose, label, live }: { pose: Pose; label: string; live?: boolean }) {
  return (
    <figure className="fig-frame">
      <svg viewBox="0 -14 120 132" role="img" aria-label={live ? 'Animation du mouvement' : label}>
        <line x1={4} y1={GROUND} x2={116} y2={GROUND} className="fig-ground" />
        <Figure pose={pose} />
      </svg>
      <figcaption aria-live="off">{label}</figcaption>
    </figure>
  );
}

/**
 * Schéma du mouvement : animation d'une répétition (départ → arrivée → retour lent),
 * ou les deux positions côte à côte. Position unique pour le gainage.
 */
export default function ExerciseFigure({ pattern }: { pattern: MovePattern }) {
  const poses = POSES[pattern];
  const [animate, setAnimate] = useState(() => !reducedMotion());
  const [phase, setPhase] = useState({ t: 0, label: CYCLE[0].label });
  const moving = animate && poses.length > 1;

  useEffect(() => {
    if (!moving) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setPhase(phaseAt(now - start));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [moving, pattern]);

  if (poses.length === 1) return <div className="fig-row single"><Frame pose={poses[0]} label="Position à tenir" /></div>;
  return (
    <div className="fig-wrap">
      {moving ? (
        <div className="fig-row single">
          <Frame pose={between(poses[0], poses[1], phase.t)} label={phase.label} live />
        </div>
      ) : (
        <div className="fig-row">
          <Frame pose={poses[0]} label="Départ" />
          <svg className="fig-arrow" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 12h14M13 6l6 6-6 6" />
          </svg>
          <Frame pose={poses[1]} label="Arrivée" />
        </div>
      )}
      <button type="button" className="btn ghost sm fig-toggle" onClick={() => setAnimate((a) => !a)}>
        {moving ? 'Voir départ et arrivée' : '▶ Animer le mouvement'}
      </button>
    </div>
  );
}
