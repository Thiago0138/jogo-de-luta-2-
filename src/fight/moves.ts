// ─────────────────────────────────────────────────────────────────────────────
//  Move library: keyframed clips for attackers & victims, hit timings, paired
//  grapple tracks and cinematic cues. Angles in degrees, times in seconds.
//  Conventions (character faces +Z): shoulder/hip rx<0 swings forward,
//  elbow rx<0 flexes, knee rx>0 flexes, body brx<0 falls backward.
// ─────────────────────────────────────────────────────────────────────────────
import { clip, Clip, Ease } from '../char/animator';
import { GUARD, makePose, mirror, NEUTRAL, Pose, PoseSpec, RELAXED } from '../char/pose';

export type React = 'head' | 'headR' | 'body' | 'spin' | 'stagger' | 'knockBack' | 'knockFace' | 'launch' | 'none';
export type FxKind = 'fire' | 'ice' | 'spark' | 'cosmic' | 'gold' | 'toxic' | 'shadow';

export interface HitDef {
  at: number;
  dmg: number;
  react: React;
  power: number; // 0..1 → shake, fx size, hitstop
  src: 'lh' | 'rh' | 'lf' | 'rf' | 'head' | 'body';
  /** knockback speed (m/s) along attacker facing, and launch vertical speed */
  push?: number;
  vy?: number;
  fx?: FxKind;
  /** grapples cannot be blocked/dodged once locked */
  unblockable?: boolean;
  sfx?: 'punch' | 'heavy' | 'slam' | 'chop' | 'kick';
}

export interface PairKey { t: number; x: number; y: number; z: number; yaw: number; p: PoseSpec; e?: Ease }

export interface MoveDef {
  id: string;
  name: string;
  kind: 'strike' | 'grapple' | 'ground' | 'running' | 'aerial' | 'special' | 'super' | 'taunt' | 'whip' | 'corner';
  range: number;
  clip: Clip;
  hits: HitDef[];
  /** victim locked to attacker frame */
  pair?: { clip: Clip; track: PairKey[]; end: 'back' | 'face' | 'stand' };
  /** forward root displacement keys [t, metres] */
  root?: [number, number][];
  /** attacker ends lying down and must get up */
  attackerDown?: 'back' | 'face';
  stamina: number;
  /** grapples: attacker stat used & reversal-able */
  grapple?: boolean;
  /** used by AI weighting */
  weight?: number;
  /** cinematic flags */
  cine?: 'special' | 'super';
  fx?: FxKind;
}

const D = (spec: PoseSpec, base: Pose = GUARD) => makePose(spec, base);

// ── shared poses ─────────────────────────────────────────────────────────────
export const DOWN_BACK = makePose({
  by: -0.8, brx: -90, spine: [0, 0, 0], chest: [0, 0, 0], neck: [-14, 0, 0],
  lSh: [-14, 0, 72], rSh: [-14, 0, -72], lEl: [-24, 0, 0], rEl: [-24, 0, 0],
  lHip: [-8, 0, 12], rHip: [-14, 0, -10], lKn: [20, 0, 0], rKn: [8, 0, 0],
}, NEUTRAL);
export const DOWN_FACE = makePose({
  by: -0.82, brx: 90, neck: [-30, 30, 0],
  lSh: [-150, 0, 30], rSh: [-40, 0, -40], lEl: [-30, 0, 0], rEl: [-50, 0, 0],
  lHip: [0, 0, 10], rHip: [-20, 0, -12], lKn: [30, 0, 0], rKn: [10, 0, 0],
}, NEUTRAL);
const SIT = D({ by: -0.78, brx: -12, spine: [18, 0, 0], chest: [8, 0, 0], neck: [10, 0, 0], lSh: [24, 0, 24], rSh: [24, 0, -24], lEl: [-10, 0, 0], rEl: [-10, 0, 0], lHip: [-84, 0, 10], rHip: [-70, 0, -10], lKn: [30, 0, 0], rKn: [60, 0, 0] }, NEUTRAL);
const KNEEL = D({ by: -0.45, spine: [24, 0, 0], neck: [-10, 0, 0], lSh: [-40, 0, 14], rSh: [-30, 0, -14], lEl: [-50, 0, 0], rEl: [-40, 0, 0], lHip: [-88, 0, 6], lKn: [92, 0, 0], rHip: [8, 0, -6], rKn: [104, 0, 0] }, NEUTRAL);
const HANDS_KNEES = D({ by: -0.55, brx: 50, spine: [10, 0, 0], neck: [-40, 0, 0], lSh: [-60, 0, 10], rSh: [-60, 0, -10], lEl: [0, 0, 0], rEl: [0, 0, 0], lHip: [-100, 0, 8], rHip: [-100, 0, -8], lKn: [120, 0, 0], rKn: [120, 0, 0] }, NEUTRAL);

// ── reactions & state clips ──────────────────────────────────────────────────
export const C = {
  hitHead: clip('hitHead', [[0, GUARD], [0.07, { neck: [-38, 20, 0], spine: [-16, -14, 0], chest: [-12, 0, 0], bz: -0.07, lSh: [-30, 0, 20], rSh: [-20, 0, -20] }, 'out'], [0.38, GUARD]]),
  hitHeadR: clip('hitHeadR', [[0, GUARD], [0.07, { neck: [-30, -30, 0], spine: [-10, 24, 10], bz: -0.06, bry: 14 }, 'out'], [0.38, GUARD]]),
  hitBody: clip('hitBody', [[0, GUARD], [0.08, { spine: [42, 0, 0], chest: [22, 0, 0], neck: [18, 0, 0], by: -0.12, lSh: [-30, 0, -20], rSh: [-30, 0, 20], lEl: [-100, 0, 0], rEl: [-100, 0, 0] }, 'out'], [0.45, GUARD]]),
  hitSpin: clip('hitSpin', [[0, GUARD], [0.12, { bry: 120, neck: [-20, -40, 0], spine: [0, 30, 20], lSh: [-20, 0, 60], rSh: [-20, 0, -60], lEl: [-20, 0, 0], rEl: [-20, 0, 0] }, 'out'], [0.36, { bry: 300, spine: [20, 0, 0], by: -0.1 }], [0.65, { bry: 352 }]]),
  stagger: clip('stagger', [[0, GUARD], [0.1, { spine: [-20, 0, 8], neck: [-25, 0, 0], bz: -0.1, lSh: [-10, 0, 40], rSh: [-10, 0, -40], lEl: [-30, 0, 0], rEl: [-30, 0, 0] }, 'out'], [0.4, { spine: [20, 0, -6], by: -0.1, lHip: [-40, 0, 8], lKn: [50, 0, 0] }], [0.8, GUARD]]),
  block: clip('block', [[0, GUARD], [0.06, { lSh: [-74, 0, -14], rSh: [-74, 0, 14], lEl: [-140, 0, 0], rEl: [-140, 0, 0], neck: [18, 0, 0], spine: [16, 0, 0], by: -0.1, bz: -0.06 }, 'out'], [0.22, { lSh: [-74, 0, -14], rSh: [-74, 0, 14], lEl: [-140, 0, 0], rEl: [-140, 0, 0], neck: [18, 0, 0], spine: [16, 0, 0], by: -0.1 }], [0.38, GUARD]]),
  slipL: clip('slipL', [[0, GUARD], [0.08, { spine: [14, 0, 32], chest: [0, 0, 10], brz: 10, by: -0.12, bx: 0.14 }, 'out'], [0.26, { spine: [14, 0, 32], brz: 10, by: -0.12, bx: 0.14 }], [0.42, GUARD]]),
  duck: clip('duck', [[0, GUARD], [0.08, { by: -0.32, spine: [46, 0, 0], neck: [-30, 0, 0], lHip: [-60, 8, 6], rHip: [-10, -6, -6], lKn: [80, 0, 0], rKn: [80, 0, 0] }, 'out'], [0.26, { by: -0.32, spine: [46, 0, 0], neck: [-30, 0, 0], lHip: [-60, 8, 6], rHip: [-10, -6, -6], lKn: [80, 0, 0], rKn: [80, 0, 0] }], [0.44, GUARD]]),
  sway: clip('sway', [[0, GUARD], [0.08, { spine: [-30, 0, 0], chest: [-14, 0, 0], neck: [10, 0, 0], bz: -0.18, lHip: [-40, 8, 6], lKn: [10, 0, 0] }, 'out'], [0.24, { spine: [-30, 0, 0], chest: [-14, 0, 0], bz: -0.18 }], [0.42, GUARD]]),
  fallBack: clip('fallBack', [[0, GUARD], [0.14, { spine: [-24, 0, 0], neck: [-35, 0, 0], brx: -24, lSh: [-60, 0, 60], rSh: [-60, 0, -60], lEl: [-10, 0, 0], rEl: [-10, 0, 0], lHip: [-30, 0, 4], lKn: [10, 0, 0] }, 'out'], [0.42, DOWN_BACK, 'in'], [0.52, makePose({ by: -0.72, neck: [-30, 0, 0] }, DOWN_BACK), 'out'], [0.66, DOWN_BACK]]),
  fallFace: clip('fallFace', [[0, GUARD], [0.16, { spine: [40, 0, 0], neck: [-10, 0, 0], brx: 20, lSh: [-30, 0, 20], rSh: [-30, 0, -20] }, 'out'], [0.46, DOWN_FACE, 'in'], [0.56, makePose({ by: -0.76 }, DOWN_FACE), 'out'], [0.68, DOWN_FACE]]),
  airborne: clip('airborne', [[0, GUARD], [0.2, { brx: -55, spine: [-20, 0, 0], neck: [-40, 0, 0], lSh: [-150, 0, 40], rSh: [-150, 0, -40], lEl: [-10, 0, 0], rEl: [-10, 0, 0], lHip: [-50, 0, 8], rHip: [-20, 0, -8], lKn: [60, 0, 0], rKn: [30, 0, 0] }, 'out'], [0.7, { brx: -95, spine: [-10, 0, 0], neck: [-30, 0, 0], lSh: [-170, 0, 50], rSh: [-170, 0, -50], lHip: [-30, 0, 8], rHip: [-30, 0, -8], lKn: [30, 0, 0], rKn: [30, 0, 0] }]]),
  lieBack: clip('lieBack', [[0, DOWN_BACK], [1.2, makePose({ neck: [-4, 18, 0], lSh: [-30, 0, 60], rKn: [40, 0, 0], rHip: [-30, 0, -10] }, DOWN_BACK)], [2.4, DOWN_BACK]]),
  getUp: clip('getUp', [[0, DOWN_BACK], [0.4, SIT], [0.8, KNEEL], [1.15, GUARD]]),
  getUpFace: clip('getUpFace', [[0, DOWN_FACE], [0.45, HANDS_KNEES], [0.85, KNEEL], [1.2, GUARD]]),
  kipUp: clip('kipUp', [[0, DOWN_BACK], [0.18, makePose({ lHip: [-150, 0, 6], rHip: [-150, 0, -6], lKn: [80, 0, 0], rKn: [80, 0, 0], lSh: [-170, 0, 20], rSh: [-170, 0, -20], lEl: [-100, 0, 0], rEl: [-100, 0, 0] }, DOWN_BACK)], [0.38, D({ by: 0.1, brx: -20, lHip: [20, 0, 6], rHip: [20, 0, -6], lKn: [40, 0, 0], rKn: [40, 0, 0], lSh: [-150, 0, 30], rSh: [-150, 0, -30] }), 'out'], [0.62, GUARD]]),
  tired: clip('tired', [[0, GUARD], [0.3, { spine: [36, 0, 0], neck: [-24, 0, 0], lSh: [-40, 0, 10], rSh: [-40, 0, -10], lEl: [-30, 0, 0], rEl: [-30, 0, 0], lHip: [-24, 0, 8], rHip: [-24, 0, -8], lKn: [36, 0, 0], rKn: [36, 0, 0], by: -0.1 }], [1.1, { spine: [30, 0, 0], neck: [-28, 0, 0], lSh: [-40, 0, 10], rSh: [-40, 0, -10], lEl: [-30, 0, 0], rEl: [-30, 0, 0], lHip: [-24, 0, 8], rHip: [-24, 0, -8], lKn: [36, 0, 0], rKn: [36, 0, 0], by: -0.12 }], [1.4, GUARD]]),
  run: clip('run', [
    [0, { spine: [30, 0, 0], neck: [-24, 0, 0], lSh: [-70, 0, 10], rSh: [40, 0, -10], lEl: [-90, 0, 0], rEl: [-90, 0, 0], lHip: [-60, 0, 0], lKn: [40, 0, 0], rHip: [30, 0, 0], rKn: [80, 0, 0], by: 0.02 }],
    [0.16, { spine: [30, 0, 0], neck: [-24, 0, 0], lSh: [40, 0, 10], rSh: [-70, 0, -10], lEl: [-90, 0, 0], rEl: [-90, 0, 0], lHip: [30, 0, 0], lKn: [80, 0, 0], rHip: [-60, 0, 0], rKn: [40, 0, 0], by: 0.02 }],
    [0.32, { spine: [30, 0, 0], neck: [-24, 0, 0], lSh: [-70, 0, 10], rSh: [40, 0, -10], lEl: [-90, 0, 0], rEl: [-90, 0, 0], lHip: [-60, 0, 0], lKn: [40, 0, 0], rHip: [30, 0, 0], rKn: [80, 0, 0], by: 0.02 }],
  ], NEUTRAL),
  ropeBounce: clip('ropeBounce', [[0, D({ spine: [-30, 0, 0], brx: -14, lSh: [10, 0, 60], rSh: [10, 0, -60], neck: [-20, 0, 0] }, NEUTRAL)], [0.18, D({ spine: [-40, 0, 0], brx: -20, lSh: [20, 0, 70], rSh: [20, 0, -70], neck: [-30, 0, 0] }, NEUTRAL)], [0.3, D({ spine: [20, 0, 0], lSh: [-40, 0, 10], rSh: [-40, 0, -10] }, NEUTRAL)]]),
  // taunts
  flex: clip('flex', [[0, GUARD], [0.3, { spine: [-6, 0, 0], neck: [-14, 0, 0], lSh: [0, 0, 92], rSh: [0, 0, -92], lEl: [-120, 0, 0], rEl: [-120, 0, 0], by: -0.04, lHip: [-6, 0, 12], rHip: [-6, 0, -12] }, 'back'], [0.7, { spine: [-10, 0, 0], neck: [-20, 0, 0], lSh: [0, 0, 96], rSh: [0, 0, -96], lEl: [-140, 0, 0], rEl: [-140, 0, 0], by: -0.06, lHip: [-6, 0, 12], rHip: [-6, 0, -12] }], [1.1, { spine: [-6, 0, 0], neck: [-14, 0, 0], lSh: [0, 0, 92], rSh: [0, 0, -92], lEl: [-120, 0, 0], rEl: [-120, 0, 0], by: -0.04 }], [1.35, GUARD]]),
  crowd: clip('crowd', [[0, GUARD], [0.25, { spine: [-14, 40, 0], neck: [-20, 20, 0], lSh: [-170, 0, 20], lEl: [-10, 0, 0], rSh: [-20, 0, -30], rEl: [-30, 0, 0] }, 'back'], [0.6, { spine: [-14, 50, 0], neck: [-24, 24, 0], lSh: [-175, 0, 30], lEl: [-30, 0, 0] }], [0.9, { spine: [-14, 40, 0], lSh: [-170, 0, 20], lEl: [-10, 0, 0] }], [1.2, GUARD]]),
  comeOn: clip('comeOn', [[0, GUARD], [0.2, { spine: [-6, 0, 0], lSh: [-60, 0, 50], rSh: [-60, 0, -50], lEl: [-90, 0, 0], rEl: [-90, 0, 0], by: -0.12 }], [0.4, { lSh: [-60, 0, 50], rSh: [-60, 0, -50], lEl: [-40, 0, 0], rEl: [-40, 0, 0], by: -0.1 }], [0.6, { lSh: [-60, 0, 50], rSh: [-60, 0, -50], lEl: [-100, 0, 0], rEl: [-100, 0, 0], by: -0.12 }], [0.8, { lSh: [-60, 0, 50], rSh: [-60, 0, -50], lEl: [-40, 0, 0], rEl: [-40, 0, 0] }], [1.05, GUARD]]),
  victory: clip('victory', [[0, RELAXED], [0.4, D({ spine: [-14, 0, 0], neck: [-24, 0, 0], lSh: [-175, 0, 22], rSh: [-175, 0, -22], lEl: [-20, 0, 0], rEl: [-20, 0, 0], by: 0.02 }, RELAXED), 'back'], [1.0, D({ spine: [-18, 0, 0], neck: [-30, 0, 0], lSh: [-178, 0, 28], rSh: [-178, 0, -28], lEl: [-10, 0, 0], rEl: [-10, 0, 0], by: 0.04 }, RELAXED)]], RELAXED),
  sad: clip('sad', [[0, RELAXED], [0.6, D({ spine: [30, 0, 0], neck: [30, 0, 0], lSh: [10, 0, 6], rSh: [10, 0, -6], by: -0.04 }, RELAXED)]], RELAXED),
  // tag partner on the apron
  apronIdle: clip('apronIdle', [[0, D({ spine: [8, 0, 0], lSh: [-60, 0, 30], lEl: [-60, 0, 0], rSh: [-10, 0, -14] }, RELAXED)], [1.0, D({ spine: [12, 0, 0], lSh: [-64, 0, 30], lEl: [-50, 0, 0], rSh: [-12, 0, -16] }, RELAXED)], [2.0, D({ spine: [8, 0, 0], lSh: [-60, 0, 30], lEl: [-60, 0, 0], rSh: [-10, 0, -14] }, RELAXED)]], RELAXED),
  apronReach: clip('apronReach', [[0, RELAXED], [0.25, D({ spine: [30, 0, -14], neck: [-20, 0, 0], rSh: [-110, 0, 20], rEl: [-10, 0, 0], lSh: [-60, 0, 30], lEl: [-60, 0, 0] }, RELAXED)], [0.5, D({ spine: [34, 0, -16], neck: [-20, 0, 0], rSh: [-120, 0, 24], rEl: [0, 0, 0], lSh: [-60, 0, 30], lEl: [-60, 0, 0] }, RELAXED)], [0.75, D({ spine: [30, 0, -14], rSh: [-110, 0, 20], rEl: [-10, 0, 0], lSh: [-60, 0, 30], lEl: [-60, 0, 0] }, RELAXED)]], RELAXED),
  apronCheer: clip('apronCheer', [[0, RELAXED], [0.2, D({ lSh: [-160, 0, 20], rSh: [-80, 0, -20], rEl: [-60, 0, 0] }, RELAXED)], [0.4, D({ lSh: [-140, 0, 20], rSh: [-90, 0, -20], rEl: [-40, 0, 0] }, RELAXED)], [0.6, D({ lSh: [-160, 0, 20], rSh: [-80, 0, -20], rEl: [-60, 0, 0] }, RELAXED)], [0.9, RELAXED]], RELAXED),
  tagHand: clip('tagHand', [[0, GUARD], [0.15, { spine: [10, 0, 20], rSh: [-40, 0, -100], rEl: [-20, 0, 0] }, 'out'], [0.35, GUARD]]),
  // referee
  refCount: clip('refCount', [[0, D({ by: -0.5, brx: 50, lHip: [-100, 0, 10], rHip: [-100, 0, -10], lKn: [120, 0, 0], rKn: [120, 0, 0], neck: [-40, 0, 0], rSh: [-170, 0, -10], lSh: [-60, 0, 20] }, NEUTRAL)], [0.18, D({ by: -0.5, brx: 50, lHip: [-100, 0, 10], rHip: [-100, 0, -10], lKn: [120, 0, 0], rKn: [120, 0, 0], neck: [-40, 0, 0], rSh: [-60, 0, -10], lSh: [-60, 0, 20] }, NEUTRAL), 'in']], NEUTRAL),
  refRaise: clip('refRaise', [[0, RELAXED], [0.4, D({ rSh: [-170, 0, -40], lSh: [-30, 0, 20] }, RELAXED), 'back'], [3, D({ rSh: [-172, 0, -40], lSh: [-30, 0, 20] }, RELAXED)]], RELAXED),
  refWave: clip('refWave', [[0, RELAXED], [0.2, D({ lSh: [-90, 0, 0], rSh: [-90, 0, 0], lEl: [0, 0, 0], rEl: [0, 0, 0] }, RELAXED)], [0.4, D({ lSh: [-90, 40, 60], rSh: [-90, -40, -60] }, RELAXED)], [0.6, D({ lSh: [-90, 0, 0], rSh: [-90, 0, 0] }, RELAXED)], [0.8, D({ lSh: [-90, 40, 60], rSh: [-90, -40, -60] }, RELAXED)], [1.0, RELAXED]], RELAXED),
  climb: clip('climb', [[0, NEUTRAL], [0.25, D({ lHip: [-80, 0, 10], lKn: [90, 0, 0], lSh: [-150, 0, 10], rSh: [-110, 0, -10], spine: [20, 0, 0] }, NEUTRAL)], [0.5, D({ rHip: [-80, 0, -10], rKn: [90, 0, 0], rSh: [-150, 0, -10], lSh: [-110, 0, 10], spine: [20, 0, 0] }, NEUTRAL)], [0.75, D({ lHip: [-30, 0, 20], rHip: [-30, 0, -20], lKn: [50, 0, 0], rKn: [50, 0, 0], spine: [10, 0, 0], lSh: [-20, 0, 60], rSh: [-20, 0, -60], by: -0.12 }, NEUTRAL)]], NEUTRAL),
  perch: clip('perch', [[0, D({ lHip: [-30, 0, 20], rHip: [-30, 0, -20], lKn: [50, 0, 0], rKn: [50, 0, 0], spine: [10, 0, 0], lSh: [-20, 0, 60], rSh: [-20, 0, -60], by: -0.12 }, NEUTRAL)], [0.4, D({ lHip: [-10, 0, 14], rHip: [-10, 0, -14], lKn: [10, 0, 0], rKn: [10, 0, 0], spine: [-14, 0, 0], neck: [-20, 0, 0], lSh: [-170, 0, 30], rSh: [-170, 0, -30], lEl: [-10, 0, 0], rEl: [-10, 0, 0] }, NEUTRAL), 'back']], NEUTRAL),
  pinCover: clip('pinCover', [[0, GUARD], [0.25, D({ by: -0.72, brx: 84, spine: [0, 0, 0], neck: [-40, 0, 0], lSh: [-80, 0, 30], rSh: [-80, 0, -30], lEl: [-60, 0, 0], rEl: [-60, 0, 0], lHip: [-30, 0, 20], rHip: [10, 0, -10], lKn: [80, 0, 0], rKn: [40, 0, 0] }, NEUTRAL)]]),
};

// ── helpers to define strikes quickly ────────────────────────────────────────
function strike(id: string, name: string, keys: [number, PoseSpec | Pose, Ease?][], hit: Omit<HitDef, 'at'> & { at: number }, range = 1.1, stamina = 4, root?: [number, number][], weight = 1): MoveDef {
  return { id, name, kind: 'strike', range, clip: clip(id, keys), hits: [hit], stamina, root, weight };
}

const JAB_EXT: PoseSpec = { lSh: [-90, 0, -4], lEl: [-4, 0, 0], spine: [14, -24, 0], chest: [8, -12, 0], neck: [-8, 30, 0], bz: 0.06 };
const CROSS_EXT: PoseSpec = { rSh: [-92, 0, 6], rEl: [-4, 0, 0], spine: [16, 26, 0], chest: [8, 16, 0], neck: [-8, -20, 0], rHip: [24, -16, -6], rKn: [14, 0, 0], bz: 0.12, bry: 12 };

export const MOVES: Record<string, MoveDef> = {};
const reg = (m: MoveDef) => (MOVES[m.id] = m);

// strikes ----------------------------------------------------------------------
reg(strike('jab', 'Jab', [[0, GUARD], [0.07, JAB_EXT, 'out'], [0.13, JAB_EXT], [0.28, GUARD]], { at: 0.07, dmg: 3, react: 'head', power: 0.2, src: 'lh', sfx: 'punch' }, 1.05, 2, [[0.07, 0.08]], 1.4));
reg(strike('cross', 'Direto', [[0, GUARD], [0.05, { rSh: [-40, 0, 10], rEl: [-130, 0, 0], spine: [8, -14, 0], by: -0.08 }], [0.12, CROSS_EXT, 'out'], [0.2, CROSS_EXT], [0.4, GUARD]], { at: 0.12, dmg: 5, react: 'headR', power: 0.35, src: 'rh', sfx: 'punch' }, 1.1, 3, [[0.12, 0.12]], 1.3));
reg(strike('hook', 'Gancho', [[0, GUARD], [0.09, { spine: [8, -34, 0], chest: [4, -12, 0], lSh: [-30, 0, 78], lEl: [-96, 0, 0], by: -0.06 }], [0.19, { spine: [14, 36, 0], chest: [6, 16, 0], neck: [-6, -24, 0], lSh: [-78, 0, 74], lEl: [-84, 0, 0], bry: 10, lHip: [-30, 30, 6] }, 'out'], [0.26, { spine: [14, 40, 0], chest: [6, 18, 0], lSh: [-80, 0, 70], lEl: [-84, 0, 0], bry: 12 }], [0.5, GUARD]], { at: 0.19, dmg: 7, react: 'spin', power: 0.5, src: 'lh', sfx: 'heavy' }, 1.0, 5, [[0.19, 0.1]], 1));
reg(strike('upper', 'Uppercut', [[0, GUARD], [0.12, { by: -0.17, spine: [24, 14, 0], rSh: [-6, 0, 6], rEl: [-100, 0, 0], lHip: [-30, 8, 6], lKn: [50, 0, 0], rKn: [50, 0, 0] }], [0.22, { by: 0.04, spine: [-8, -22, 0], chest: [-6, -10, 0], neck: [-20, 10, 0], rSh: [-160, 0, 8], rEl: [-70, 0, 0], rHip: [10, -6, -6], rKn: [10, 0, 0], lKn: [10, 0, 0] }, 'out'], [0.3, { by: 0.04, spine: [-8, -22, 0], rSh: [-160, 0, 8], rEl: [-70, 0, 0] }], [0.58, GUARD]], { at: 0.22, dmg: 8, react: 'stagger', power: 0.6, src: 'rh', sfx: 'heavy', push: 1.2 }, 0.95, 6, [[0.22, 0.12]], 0.9));
reg(strike('body', 'Golpe ao Corpo', [[0, GUARD], [0.1, { by: -0.16, spine: [34, -30, 0], lSh: [-30, 0, 50], lEl: [-80, 0, 0], lKn: [50, 0, 0], rKn: [40, 0, 0] }], [0.2, { by: -0.18, spine: [36, 30, 0], chest: [10, 10, 0], lSh: [-64, 0, 40], lEl: [-70, 0, 0], lKn: [50, 0, 0], rKn: [40, 0, 0] }, 'out'], [0.48, GUARD]], { at: 0.2, dmg: 5, react: 'body', power: 0.35, src: 'lh', sfx: 'punch' }, 1.0, 4, [[0.2, 0.1]], 1));
reg(strike('teep', 'Pontapé Frontal', [[0, GUARD], [0.12, { rHip: [-84, 0, 0], rKn: [100, 0, 0], spine: [0, 0, 0], by: 0.02, lKn: [10, 0, 0] }], [0.22, { rHip: [-96, 0, 0], rKn: [4, 0, 0], spine: [-18, 0, 0], neck: [10, 0, 0], lKn: [10, 0, 0], lHip: [0, 8, 6], bz: 0.06 }, 'out'], [0.3, { rHip: [-90, 0, 0], rKn: [6, 0, 0], spine: [-18, 0, 0], lHip: [0, 8, 6] }], [0.6, GUARD]], { at: 0.22, dmg: 6, react: 'body', power: 0.45, src: 'rf', sfx: 'kick', push: 2.4 }, 1.25, 5, undefined, 0.8));
reg(strike('roundhouse', 'Pontapé Circular', [[0, GUARD], [0.13, { bry: 25, rHip: [-60, 0, -40], rKn: [100, 0, 0], spine: [0, 0, 12], lSh: [-60, 0, 30], rSh: [-30, 0, -50] }], [0.25, { bry: 70, rHip: [-56, 0, -88], rKn: [8, 0, 0], spine: [0, 0, 28], chest: [0, 0, 10], lHip: [0, 30, 10], lSh: [-60, 0, 30], rSh: [-20, 0, -60], rEl: [-30, 0, 0] }, 'out'], [0.34, { bry: 80, rHip: [-50, 0, -85], rKn: [10, 0, 0], spine: [0, 0, 28] }], [0.68, GUARD]], { at: 0.25, dmg: 9, react: 'spin', power: 0.65, src: 'rf', sfx: 'kick', push: 1.5 }, 1.25, 7, undefined, 0.8));
reg(strike('elbow', 'Cotovelada', [[0, GUARD], [0.1, { spine: [10, -30, 0], rSh: [-90, 0, -40], rEl: [-150, 0, 0], by: -0.05 }], [0.2, { spine: [14, 34, 0], chest: [4, 14, 0], rSh: [-96, 0, 30], rEl: [-150, 0, 0], bz: 0.1, bry: 10 }, 'out'], [0.45, GUARD]], { at: 0.2, dmg: 7, react: 'headR', power: 0.5, src: 'rh', sfx: 'heavy' }, 0.9, 5, [[0.2, 0.15]], 0.7));
reg(strike('knee', 'Joelhada', [[0, GUARD], [0.12, { lSh: [-90, 0, -10], rSh: [-90, 0, 10], lEl: [-50, 0, 0], rEl: [-50, 0, 0], spine: [16, 0, 0] }], [0.22, { lSh: [-60, 0, -10], rSh: [-60, 0, 10], lEl: [-70, 0, 0], rEl: [-70, 0, 0], spine: [-8, 0, 0], rHip: [-110, 0, 0], rKn: [120, 0, 0], by: 0.06, bz: 0.08 }, 'out'], [0.5, GUARD]], { at: 0.22, dmg: 7, react: 'body', power: 0.5, src: 'rf', sfx: 'heavy' }, 0.85, 5, [[0.22, 0.1]], 0.7));
reg(strike('chop', 'Chop', [[0, GUARD], [0.16, { spine: [0, -40, 0], rSh: [-30, 0, -110], rEl: [-30, 0, 0], neck: [-10, 30, 0], lSh: [-40, 0, 20] }], [0.26, { spine: [10, 34, 0], chest: [4, 14, 0], rSh: [-90, 0, 14], rEl: [-8, 0, 0], neck: [-10, -10, 0] }, 'out'], [0.56, GUARD]], { at: 0.26, dmg: 6, react: 'body', power: 0.45, src: 'rh', sfx: 'chop' }, 1.0, 4, undefined, 0.8));
reg(strike('headbutt', 'Cabeçada', [[0, GUARD], [0.16, { spine: [-14, 0, 0], neck: [-34, 0, 0], lSh: [-80, 0, -10], rSh: [-80, 0, 10], lEl: [-40, 0, 0], rEl: [-40, 0, 0] }], [0.26, { spine: [30, 0, 0], neck: [40, 0, 0], bz: 0.14, lSh: [-80, 0, -10], rSh: [-80, 0, 10], lEl: [-40, 0, 0], rEl: [-40, 0, 0] }, 'out'], [0.56, GUARD]], { at: 0.26, dmg: 8, react: 'stagger', power: 0.55, src: 'head', sfx: 'heavy', push: 0.8 }, 0.8, 6, [[0.26, 0.12]], 0.5));
reg(strike('backfist', 'Revés Giratório', [[0, GUARD], [0.12, { bry: 110, lSh: [-30, 0, 70], lEl: [-20, 0, 0], neck: [-6, -60, 0] }], [0.24, { bry: 270, lSh: [-70, 0, 84], lEl: [-4, 0, 0], spine: [8, 0, 10], neck: [-6, -20, 0] }, 'out'], [0.36, { bry: 330, lSh: [-60, 0, 70] }], [0.6, { bry: 352 }]], { at: 0.24, dmg: 9, react: 'spin', power: 0.65, src: 'lh', sfx: 'heavy' }, 1.1, 7, [[0.24, 0.15]], 0.5));
reg(strike('superman', 'Soco Super-Homem', [[0, GUARD], [0.14, { by: 0.22, rHip: [40, 0, 0], rKn: [60, 0, 0], lHip: [-50, 8, 6], lKn: [60, 0, 0], rSh: [-30, 0, 0], rEl: [-120, 0, 0], spine: [-6, 0, 0] }, 'out'], [0.28, { by: 0.14, rSh: [-130, 0, 4], rEl: [-6, 0, 0], spine: [20, 20, 0], rHip: [30, 0, 0], bz: 0.1 }, 'out'], [0.4, { by: 0, rSh: [-110, 0, 4], rEl: [-10, 0, 0] }], [0.7, GUARD]], { at: 0.28, dmg: 10, react: 'stagger', power: 0.7, src: 'rh', sfx: 'heavy', push: 1.6 }, 1.7, 8, [[0.28, 0.7]], 0.4));
reg(strike('bigboot', 'Bota Gigante', [[0, GUARD], [0.14, { rHip: [-60, 0, 0], rKn: [90, 0, 0], spine: [-8, 0, 0] }], [0.26, { rHip: [-128, 0, 0], rKn: [0, 0, 0], spine: [-30, 0, 0], neck: [20, 0, 0], lHip: [10, 0, 6], lKn: [10, 0, 0], bz: 0.1 }, 'out'], [0.62, GUARD]], { at: 0.26, dmg: 10, react: 'knockBack', power: 0.7, src: 'rf', sfx: 'kick', push: 2.4 }, 1.3, 7, [[0.26, 0.15]], 0.5));

// ground attacks ---------------------------------------------------------------
reg({ id: 'stomp', name: 'Pisadela', kind: 'ground', range: 1.1, stamina: 3, hits: [{ at: 0.28, dmg: 5, react: 'none', power: 0.4, src: 'rf', sfx: 'slam', unblockable: true }],
  clip: clip('stomp', [[0, GUARD], [0.18, { rHip: [-70, 0, 0], rKn: [100, 0, 0], spine: [6, 0, 0], neck: [20, 0, 0], lSh: [-40, 0, 40], rSh: [-30, 0, -40] }], [0.28, { rHip: [-26, 0, 0], rKn: [24, 0, 0], spine: [26, 0, 0], neck: [26, 0, 0], by: -0.08 }, 'in'], [0.55, GUARD]]) });
reg({ id: 'elbowdrop', name: 'Cotovelo Voador', kind: 'ground', range: 1.0, stamina: 6, attackerDown: 'face', hits: [{ at: 0.5, dmg: 9, react: 'none', power: 0.65, src: 'rh', sfx: 'slam', unblockable: true }],
  clip: clip('elbowdrop', [[0, GUARD], [0.2, { by: 0.3, rSh: [-20, 0, -120], rEl: [-140, 0, 0], lSh: [-60, 0, 40], spine: [-10, 0, 0] }, 'out'], [0.5, { by: -0.72, brz: -80, brx: 20, rSh: [-80, 0, -40], rEl: [-150, 0, 0], spine: [10, 0, 0], lHip: [-30, 0, 10], rHip: [-30, 0, -10] }, 'in'], [0.8, makePose({}, DOWN_FACE)]]), root: [[0.5, 0.35]] });
reg({ id: 'legdrop', name: 'Queda de Perna', kind: 'ground', range: 1.0, stamina: 6, attackerDown: 'back', hits: [{ at: 0.48, dmg: 10, react: 'none', power: 0.7, src: 'rf', sfx: 'slam', unblockable: true }],
  clip: clip('legdrop', [[0, GUARD], [0.22, { by: 0.35, rHip: [-90, 0, 0], rKn: [0, 0, 0], lSh: [-20, 0, 70], rSh: [-20, 0, -70], spine: [-20, 0, 0] }, 'out'], [0.48, { by: -0.75, brx: -70, rHip: [-90, 0, 0], rKn: [0, 0, 0], lHip: [-60, 0, 0], lKn: [0, 0, 0], lSh: [10, 0, 60], rSh: [10, 0, -60] }, 'in'], [0.8, DOWN_BACK]]), root: [[0.48, 0.4]] });

// grapples (paired) ----------------------------------------------------------------
const GRAB: PoseSpec = { spine: [30, 0, 0], neck: [-10, 0, 0], lSh: [-100, 0, -8], rSh: [-100, 0, 8], lEl: [-50, 0, 0], rEl: [-50, 0, 0], by: -0.04 };
const BENT: PoseSpec = { spine: [64, 0, 0], chest: [20, 0, 0], neck: [20, 0, 0], lSh: [-40, 0, 10], rSh: [-40, 0, -10], lEl: [-40, 0, 0], rEl: [-40, 0, 0], by: -0.08 };

function paired(id: string, name: string, kind: MoveDef['kind'], att: [number, PoseSpec | Pose, Ease?][], vic: PairKey[], hits: HitDef[], end: 'back' | 'face' | 'stand', extra: Partial<MoveDef> = {}): MoveDef {
  const vclip = clip(id + '_v', vic.map((k) => [k.t, k.p, k.e] as [number, PoseSpec, Ease?]), NEUTRAL);
  return { id, name, kind, range: 0.95, clip: clip(id, att), hits, pair: { clip: vclip, track: vic, end }, stamina: 9, grapple: true, ...extra };
}

reg(paired('suplex', 'Suplex', 'grapple',
  [[0, GUARD], [0.25, GRAB], [0.6, { spine: [-10, 0, 0], neck: [-20, 0, 0], lSh: [-170, 0, -8], rSh: [-170, 0, 8], lEl: [-40, 0, 0], rEl: [-40, 0, 0], by: 0.02 }], [0.95, { by: -0.78, brx: -90, spine: [-10, 0, 0], neck: [-20, 0, 0], lSh: [-170, 0, 10], rSh: [-170, 0, -10], lEl: [-20, 0, 0], rEl: [-20, 0, 0], lHip: [-30, 0, 10], rHip: [-30, 0, -10] }, 'in'], [1.25, DOWN_BACK]],
  [
    { t: 0, x: 0, y: 0, z: 0.95, yaw: 180, p: GUARD as unknown as PoseSpec },
    { t: 0.25, x: 0, y: 0, z: 0.55, yaw: 180, p: BENT },
    { t: 0.6, x: 0, y: 0.95, z: 0.15, yaw: 180, p: { brx: 175, spine: [10, 0, 0], neck: [10, 0, 0], lSh: [-30, 0, 30], rSh: [-30, 0, -30], lHip: [0, 0, 6], rHip: [0, 0, -6], lKn: [10, 0, 0], rKn: [10, 0, 0] } },
    { t: 0.95, x: 0, y: 0, z: -1.05, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-30, 0, 70], rSh: [-30, 0, -70], lHip: [-10, 0, 12], rHip: [-10, 0, -12] }, e: 'in' },
    { t: 1.25, x: 0, y: 0, z: -1.1, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72], lHip: [-8, 0, 12], rHip: [-14, 0, -10], lKn: [20, 0, 0], rKn: [8, 0, 0], neck: [-14, 0, 0] } },
  ],
  [{ at: 0.95, dmg: 12, react: 'none', power: 0.8, src: 'body', sfx: 'slam', unblockable: true }], 'back', { attackerDown: 'back', weight: 1 }));

reg(paired('bodyslam', 'Body Slam', 'grapple',
  [[0, GUARD], [0.25, { spine: [40, 0, 0], by: -0.2, lSh: [-90, 0, -10], rSh: [-60, 0, 10], lEl: [-70, 0, 0], rEl: [-80, 0, 0], lKn: [50, 0, 0], rKn: [50, 0, 0] }], [0.7, { spine: [-8, 0, 0], by: 0.02, lSh: [-160, 0, 0], rSh: [-150, 0, 0], lEl: [-60, 0, 0], rEl: [-60, 0, 0] }], [0.98, { spine: [50, 0, 0], neck: [20, 0, 0], by: -0.18, lSh: [-90, 0, 0], rSh: [-90, 0, 0], lEl: [-10, 0, 0], rEl: [-10, 0, 0], lKn: [40, 0, 0], rKn: [40, 0, 0] }, 'in'], [1.35, GUARD]],
  [
    { t: 0, x: 0, y: 0, z: 0.95, yaw: 180, p: GUARD as unknown as PoseSpec },
    { t: 0.25, x: 0, y: 0.15, z: 0.45, yaw: 180, p: { spine: [40, 0, 0], lSh: [-20, 0, 40], rSh: [-20, 0, -40], by: -0.05 } },
    { t: 0.7, x: 0.1, y: 1.1, z: 0.05, yaw: 90, p: { brz: 90, brx: 0, spine: [-10, 0, 0], lSh: [-20, 0, 70], rSh: [-20, 0, -70], lHip: [-20, 0, 0], rHip: [-20, 0, 0], lKn: [30, 0, 0], rKn: [30, 0, 0] } },
    { t: 0.98, x: 0, y: 0, z: 0.85, yaw: 90, p: { brz: 0, brx: -90, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72], lHip: [-8, 0, 12], rHip: [-14, 0, -10] }, e: 'in' },
    { t: 1.35, x: 0, y: 0, z: 0.85, yaw: 90, p: { brx: -90, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72], lHip: [-8, 0, 12], rHip: [-14, 0, -10], lKn: [20, 0, 0], neck: [-14, 0, 0] } },
  ],
  [{ at: 0.98, dmg: 10, react: 'none', power: 0.75, src: 'body', sfx: 'slam', unblockable: true }], 'back', { weight: 1 }));

reg(paired('ddt', 'DDT', 'grapple',
  [[0, GUARD], [0.25, { spine: [40, 0, 0], lSh: [-90, 0, -40], lEl: [-110, 0, 0], rSh: [-60, 0, 10], by: -0.08 }], [0.42, { spine: [20, 0, 0], by: 0.12, lSh: [-90, 0, -40], lEl: [-110, 0, 0], lHip: [-40, 0, 6], rHip: [-40, 0, -6] }, 'out'], [0.62, { by: -0.78, brx: -90, lSh: [-90, 0, -40], lEl: [-110, 0, 0], lHip: [-40, 0, 6], rHip: [-40, 0, -6] }, 'in'], [0.9, DOWN_BACK]],
  [
    { t: 0, x: 0, y: 0, z: 0.95, yaw: 180, p: GUARD as unknown as PoseSpec },
    { t: 0.25, x: 0.05, y: 0, z: 0.5, yaw: 180, p: BENT },
    { t: 0.42, x: 0.05, y: 0.05, z: 0.4, yaw: 180, p: { spine: [80, 0, 0], neck: [20, 0, 0], brx: 30, lSh: [-60, 0, 20], rSh: [-60, 0, -20], lHip: [20, 0, 0], rHip: [20, 0, 0] } },
    { t: 0.62, x: 0.05, y: 0, z: 0.3, yaw: 180, p: { brx: 150, by: -0.35, spine: [10, 0, 0], neck: [30, 0, 0], lSh: [-140, 0, 20], rSh: [-140, 0, -20], lHip: [10, 0, 0], rHip: [10, 0, 0] }, e: 'in' },
    { t: 0.9, x: 0.05, y: 0, z: 0.55, yaw: 180, p: { brx: 90, by: -0.82, neck: [-30, 30, 0], lSh: [-150, 0, 30], rSh: [-40, 0, -40], lEl: [-30, 0, 0], rEl: [-50, 0, 0], lHip: [0, 0, 10], rHip: [-20, 0, -12], lKn: [30, 0, 0], rKn: [10, 0, 0] } },
  ],
  [{ at: 0.62, dmg: 13, react: 'none', power: 0.85, src: 'body', sfx: 'slam', unblockable: true }], 'face', { attackerDown: 'back', weight: 0.8 }));

reg(paired('hiptoss', 'Projeção de Anca', 'grapple',
  [[0, GUARD], [0.2, { spine: [20, 60, 0], bry: 40, lSh: [-90, 0, 0], rSh: [-110, 0, -40], by: -0.15, lKn: [40, 0, 0], rKn: [40, 0, 0] }], [0.5, { spine: [50, 90, 0], bry: 80, lSh: [-60, 0, 0], rSh: [-130, 0, -20], by: -0.2, lKn: [40, 0, 0], rKn: [40, 0, 0] }, 'out'], [0.85, GUARD]],
  [
    { t: 0, x: 0, y: 0, z: 0.95, yaw: 180, p: GUARD as unknown as PoseSpec },
    { t: 0.2, x: -0.1, y: 0, z: 0.4, yaw: 180, p: { spine: [20, 0, 0], lSh: [-60, 0, 20] } },
    { t: 0.38, x: 0.1, y: 0.8, z: 0.2, yaw: 160, p: { brx: 150, spine: [-10, 0, 0], lSh: [-150, 0, 40], rSh: [-150, 0, -40], lHip: [-30, 0, 10], rHip: [-30, 0, -10] }, e: 'out' },
    { t: 0.5, x: 0.9, y: 0, z: 0.3, yaw: 120, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72] }, e: 'in' },
    { t: 0.85, x: 0.95, y: 0, z: 0.3, yaw: 120, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72], lHip: [-8, 0, 12], rHip: [-14, 0, -10], lKn: [20, 0, 0], neck: [-14, 0, 0] } },
  ],
  [{ at: 0.5, dmg: 8, react: 'none', power: 0.6, src: 'body', sfx: 'slam', unblockable: true }], 'back', { weight: 1.1, stamina: 6 }));

const PB_GRAB: PoseSpec = { spine: [50, 0, 0], by: -0.22, lSh: [-90, 0, 20], rSh: [-90, 0, -20], lEl: [-60, 0, 0], rEl: [-60, 0, 0], lKn: [60, 0, 0], rKn: [60, 0, 0], lHip: [-50, 0, 14], rHip: [-50, 0, -14] };
const PB_LIFT: PoseSpec = { spine: [-6, 0, 0], neck: [-24, 0, 0], by: 0.03, lSh: [-170, 0, 30], rSh: [-170, 0, -30], lEl: [-40, 0, 0], rEl: [-40, 0, 0] };
const PB_SLAM: PoseSpec = { spine: [60, 0, 0], neck: [20, 0, 0], by: -0.5, lSh: [-100, 0, 20], rSh: [-100, 0, -20], lEl: [-20, 0, 0], rEl: [-20, 0, 0], lHip: [-90, 0, 14], rHip: [-90, 0, -14], lKn: [110, 0, 0], rKn: [110, 0, 0] };
const PB_VIC: PairKey[] = [
  { t: 0, x: 0, y: 0, z: 0.95, yaw: 180, p: GUARD as unknown as PoseSpec },
  { t: 0.3, x: 0, y: 0, z: 0.45, yaw: 180, p: { ...BENT, spine: [80, 0, 0] } },
  { t: 0.8, x: 0, y: 1.2, z: 0.2, yaw: 180, p: { brx: 200, spine: [-30, 0, 0], neck: [-20, 0, 0], lSh: [-150, 0, 50], rSh: [-150, 0, -50], lHip: [-60, 0, 10], rHip: [-60, 0, -10], lKn: [90, 0, 0], rKn: [90, 0, 0] } },
  { t: 1.1, x: 0, y: 0, z: 0.75, yaw: 180, p: { brx: 270, by: -0.78, spine: [-20, 0, 0], lSh: [-30, 0, 70], rSh: [-30, 0, -70], lHip: [-90, 0, 10], rHip: [-90, 0, -10], lKn: [60, 0, 0], rKn: [60, 0, 0] }, e: 'in' },
  { t: 1.55, x: 0, y: 0, z: 0.9, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72], lHip: [-8, 0, 12], rHip: [-14, 0, -10], lKn: [20, 0, 0], neck: [-14, 0, 0] } },
];
reg(paired('powerbomb', 'Powerbomb', 'grapple', [[0, GUARD], [0.3, PB_GRAB], [0.8, PB_LIFT], [1.1, PB_SLAM, 'in'], [1.55, GUARD]], PB_VIC,
  [{ at: 1.1, dmg: 15, react: 'none', power: 0.95, src: 'body', sfx: 'slam', unblockable: true }], 'back', { weight: 0.6, stamina: 12 }));

// irish whip → victim runs the ropes
reg({ id: 'whip', name: 'Atirar às Cordas', kind: 'whip', range: 0.95, stamina: 4, hits: [], grapple: true, weight: 0.9,
  clip: clip('whip', [[0, GUARD], [0.2, { rSh: [-90, 0, -10], rEl: [-20, 0, 0], spine: [10, 20, 0] }], [0.4, { rSh: [-60, 0, -60], rEl: [-10, 0, 0], spine: [10, -40, 0], bry: -30 }, 'out'], [0.7, GUARD]]) });

// running attacks (used against a victim bouncing off the ropes)
reg({ id: 'clothesline', name: 'Clothesline', kind: 'running', range: 1.0, stamina: 6, hits: [{ at: 0.12, dmg: 11, react: 'knockBack', power: 0.8, src: 'rh', sfx: 'heavy', push: 0.8, unblockable: true }],
  clip: clip('clothesline', [[0, GUARD], [0.12, { rSh: [-70, 0, -88], rEl: [0, 0, 0], spine: [16, 20, 0], neck: [-10, -20, 0], lSh: [-30, 0, 40] }, 'out'], [0.3, { rSh: [-70, 0, -88], rEl: [-10, 0, 0], spine: [10, 40, 0] }], [0.6, GUARD]]) });
reg({ id: 'spear', name: 'Spear', kind: 'running', range: 1.1, stamina: 9, attackerDown: 'face', hits: [{ at: 0.16, dmg: 14, react: 'knockBack', power: 0.9, src: 'body', sfx: 'slam', push: 3.5, unblockable: true }],
  clip: clip('spear', [[0, GUARD], [0.16, { spine: [70, 0, 0], neck: [-40, 0, 0], by: -0.3, lSh: [-110, 0, 30], rSh: [-110, 0, -30], lEl: [-60, 0, 0], rEl: [-60, 0, 0], lHip: [20, 0, 6], rHip: [-40, 0, -6], rKn: [60, 0, 0] }, 'out'], [0.42, DOWN_FACE, 'in'], [0.6, DOWN_FACE]]), root: [[0.16, 0.3], [0.42, 1.2]] });
reg({ id: 'dropkick', name: 'Dropkick', kind: 'running', range: 1.4, stamina: 9, attackerDown: 'back', hits: [{ at: 0.26, dmg: 12, react: 'knockBack', power: 0.85, src: 'lf', sfx: 'kick', push: 3, unblockable: false }],
  clip: clip('dropkick', [[0, GUARD], [0.14, { by: 0.4, lHip: [-60, 0, 6], rHip: [-60, 0, -6], lKn: [100, 0, 0], rKn: [100, 0, 0], spine: [10, 0, 0] }, 'out'], [0.26, { by: 0.5, brx: -80, lHip: [-10, 0, 6], rHip: [-10, 0, -6], lKn: [0, 0, 0], rKn: [0, 0, 0], lSh: [-20, 0, 60], rSh: [-20, 0, -60], spine: [-10, 0, 0] }, 'out'], [0.55, { by: -0.78, brx: -90, lHip: [-30, 0, 10], rHip: [-30, 0, -10] }, 'in'], [0.7, DOWN_BACK]]), root: [[0.26, 0.6], [0.55, 0.8]] });
reg(paired('backdrop', 'Back Body Drop', 'running',
  [[0, GUARD], [0.15, { spine: [70, 0, 0], by: -0.35, lKn: [70, 0, 0], rKn: [70, 0, 0], lSh: [-40, 0, 40], rSh: [-40, 0, -40] }], [0.4, { spine: [-10, 0, 0], by: 0.05, lSh: [-170, 0, 30], rSh: [-170, 0, -30] }, 'out'], [0.8, GUARD]],
  [
    { t: 0, x: 0, y: 0, z: 0.85, yaw: 180, p: { spine: [30, 0, 0] } },
    { t: 0.15, x: 0, y: 0.4, z: 0.3, yaw: 180, p: { brx: 60, spine: [20, 0, 0], lSh: [-60, 0, 40], rSh: [-60, 0, -40] } },
    { t: 0.4, x: 0, y: 1.6, z: -0.3, yaw: 180, p: { brx: 190, lSh: [-150, 0, 50], rSh: [-150, 0, -50], lHip: [-40, 0, 10], rHip: [-10, 0, -10] }, e: 'out' },
    { t: 0.62, x: 0, y: 0, z: -1.2, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72] }, e: 'in' },
    { t: 0.8, x: 0, y: 0, z: -1.25, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72], lHip: [-8, 0, 12], rHip: [-14, 0, -10], lKn: [20, 0, 0], neck: [-14, 0, 0] } },
  ],
  [{ at: 0.62, dmg: 11, react: 'none', power: 0.8, src: 'body', sfx: 'slam', unblockable: true }], 'back', { range: 1.0 }));

// corner flurry
reg({ id: 'cornerpunch', name: 'Socos no Canto', kind: 'corner', range: 1.05, stamina: 8, weight: 1,
  hits: Array.from({ length: 8 }, (_, i) => ({ at: 0.12 + i * 0.2, dmg: 2.2, react: (i % 2 ? 'headR' : 'head') as React, power: 0.25, src: (i % 2 ? 'rh' : 'lh') as HitDef['src'], sfx: 'punch' as const, unblockable: true })),
  clip: clip('cornerpunch', Array.from({ length: 9 }, (_, i): [number, PoseSpec | Pose, Ease?] => (i === 8 ? [1.85, GUARD] : [0.12 + i * 0.2, i % 2 ? CROSS_EXT : JAB_EXT, 'out']))),
});

// aerial (from the top turnbuckle, the leap is driven by the match)
reg({ id: 'splash', name: 'Splash do Poste', kind: 'aerial', range: 99, stamina: 10, attackerDown: 'face', hits: [{ at: 0.01, dmg: 15, react: 'none', power: 1, src: 'body', sfx: 'slam', unblockable: true }],
  clip: clip('splash', [[0, D({ brx: 30, lSh: [-90, 0, 80], rSh: [-90, 0, -80], lEl: [0, 0, 0], rEl: [0, 0, 0], lHip: [10, 0, 20], rHip: [10, 0, -20], spine: [-10, 0, 0] }, NEUTRAL)], [0.4, D({ brx: 85, lSh: [-90, 0, 90], rSh: [-90, 0, -90], lEl: [0, 0, 0], rEl: [0, 0, 0], lHip: [10, 0, 20], rHip: [10, 0, -20], neck: [-40, 0, 0] }, NEUTRAL)]], NEUTRAL) });
reg({ id: 'moonsault', name: 'Moonsault', kind: 'aerial', range: 99, stamina: 12, attackerDown: 'face', hits: [{ at: 0.01, dmg: 17, react: 'none', power: 1, src: 'body', sfx: 'slam', unblockable: true }],
  clip: clip('moonsault', [[0, D({ brx: -40, lSh: [-170, 0, 20], rSh: [-170, 0, -20], spine: [-30, 0, 0], neck: [-40, 0, 0] }, NEUTRAL)], [0.35, D({ brx: -200, lSh: [-170, 0, 20], rSh: [-170, 0, -20], lHip: [-80, 0, 0], rHip: [-80, 0, 0], lKn: [90, 0, 0], rKn: [90, 0, 0] }, NEUTRAL)], [0.6, D({ brx: -270, lSh: [-90, 0, 70], rSh: [-90, 0, -70], lHip: [0, 0, 10], rHip: [0, 0, -10] }, NEUTRAL)]], NEUTRAL) });
reg({ id: 'flyelbow', name: 'Cotovelo do Céu', kind: 'aerial', range: 99, stamina: 10, attackerDown: 'face', hits: [{ at: 0.01, dmg: 14, react: 'none', power: 0.95, src: 'rh', sfx: 'slam', unblockable: true }],
  clip: clip('flyelbow', [[0, D({ rSh: [-170, 0, -20], rEl: [-150, 0, 0], lSh: [-30, 0, 80], spine: [-20, 0, 0] }, NEUTRAL)], [0.45, D({ brx: 70, brz: -40, rSh: [-90, 0, -40], rEl: [-150, 0, 0], lSh: [-30, 0, 80] }, NEUTRAL)]], NEUTRAL) });

// taunts
reg({ id: 'taunt_flex', name: 'Pose', kind: 'taunt', range: 99, stamina: -12, hits: [], clip: C.flex });
reg({ id: 'taunt_crowd', name: 'Público', kind: 'taunt', range: 99, stamina: -12, hits: [], clip: C.crowd });
reg({ id: 'taunt_comeon', name: 'Provocação', kind: 'taunt', range: 99, stamina: -10, hits: [], clip: C.comeOn });

// ── SPECIALS ─────────────────────────────────────────────────────────────────
reg({ id: 'flurry', name: 'Chuva de Socos', kind: 'special', cine: 'special', range: 1.05, stamina: 10, fx: 'spark',
  hits: [...Array.from({ length: 8 }, (_, i) => ({ at: 0.1 + i * 0.1, dmg: 2.2, react: (i % 2 ? 'headR' : 'head') as React, power: 0.3, src: (i % 2 ? 'rh' : 'lh') as HitDef['src'], sfx: 'punch' as const, unblockable: i > 0 })),
    { at: 1.08, dmg: 9, react: 'knockBack', power: 0.9, src: 'rh', sfx: 'heavy', push: 2.5, fx: 'spark', unblockable: true }],
  clip: clip('flurry', [...Array.from({ length: 8 }, (_, i): [number, PoseSpec | Pose, Ease?] => [0.1 + i * 0.1, i % 2 ? CROSS_EXT : JAB_EXT, 'out']),
    [0.96, { by: -0.17, spine: [24, 14, 0], rSh: [-6, 0, 6], rEl: [-100, 0, 0] }], [1.08, { by: 0.05, spine: [-8, -22, 0], rSh: [-165, 0, 8], rEl: [-60, 0, 0] }, 'out'], [1.45, GUARD]]),
  root: [[0.9, 0.3]] });
reg({ id: 'flyingknee', name: 'Joelhada Voadora', kind: 'special', cine: 'special', range: 2.2, stamina: 10, fx: 'spark',
  hits: [{ at: 0.32, dmg: 15, react: 'knockBack', power: 0.9, src: 'rf', sfx: 'heavy', push: 2.8, fx: 'spark' }],
  clip: clip('flyingknee', [[0, GUARD], [0.16, { by: 0.1, spine: [20, 0, 0], lHip: [-40, 0, 6], rHip: [30, 0, -6], rKn: [60, 0, 0], lSh: [-100, 0, 10], rSh: [30, 0, -10] }], [0.32, { by: 0.55, spine: [-10, 0, 0], rHip: [-120, 0, 0], rKn: [130, 0, 0], lHip: [20, 0, 6], lKn: [80, 0, 0], lSh: [-30, 0, 70], rSh: [-30, 0, -70] }, 'out'], [0.55, { by: 0.1 }], [0.8, GUARD]]),
  root: [[0.32, 1.4], [0.55, 1.6]] });
reg({ id: 'fireupper', name: 'Gancho de Fogo', kind: 'special', cine: 'special', range: 1.0, stamina: 10, fx: 'fire',
  hits: [{ at: 0.42, dmg: 16, react: 'launch', power: 1, src: 'rh', sfx: 'heavy', vy: 7.5, push: 1.2, fx: 'fire' }],
  clip: clip('fireupper', [[0, GUARD], [0.3, { by: -0.3, spine: [40, 20, 0], rSh: [20, 0, 10], rEl: [-110, 0, 0], lKn: [80, 0, 0], rKn: [80, 0, 0], lHip: [-60, 8, 6], rHip: [-10, 0, -6] }], [0.42, { by: 0.35, spine: [-14, -30, 0], neck: [-30, 0, 0], rSh: [-178, 0, 4], rEl: [-20, 0, 0], lHip: [-20, 0, 6], rHip: [30, 0, -6], rKn: [40, 0, 0] }, 'out'], [0.7, { by: 0.3, rSh: [-178, 0, 4], rEl: [-20, 0, 0] }], [1.0, GUARD]]) });
reg({ id: 'tornado', name: 'Lariat Tornado', kind: 'special', cine: 'special', range: 1.8, stamina: 12, fx: 'spark',
  hits: [{ at: 0.62, dmg: 17, react: 'knockBack', power: 0.95, src: 'rh', sfx: 'heavy', push: 3.2 }],
  clip: clip('tornado', [[0, GUARD], [0.16, { bry: -40, rSh: [-80, 0, -90], lSh: [-80, 0, 90], rEl: [0, 0, 0], lEl: [0, 0, 0] }], [0.62, { bry: 680, rSh: [-80, 0, -90], lSh: [-80, 0, 90], rEl: [0, 0, 0], lEl: [0, 0, 0], spine: [10, 0, 0] }, 'lin'], [0.8, { bry: 720 }], [1.0, { bry: 712 }]]),
  root: [[0.62, 1.2]] });
reg({ id: 'icehammer', name: 'Martelo de Gelo', kind: 'special', cine: 'special', range: 1.0, stamina: 10, fx: 'ice',
  hits: [{ at: 0.48, dmg: 15, react: 'knockFace', power: 1, src: 'rh', sfx: 'slam', push: 0.4, fx: 'ice' }],
  clip: clip('icehammer', [[0, GUARD], [0.3, { spine: [-24, 0, 0], neck: [-20, 0, 0], lSh: [-190, 0, -16], rSh: [-190, 0, 16], lEl: [-20, 0, 0], rEl: [-20, 0, 0], by: 0.06 }, 'out'], [0.48, { spine: [50, 0, 0], neck: [10, 0, 0], lSh: [-70, 0, -10], rSh: [-70, 0, 10], lEl: [0, 0, 0], rEl: [0, 0, 0], by: -0.2, lKn: [50, 0, 0], rKn: [50, 0, 0] }, 'in'], [0.9, GUARD]]) });
reg(paired('quake', 'Suplex Sísmico', 'special',
  [[0, GUARD], [0.3, { spine: [30, 0, 0], lSh: [-80, 0, -30], rSh: [-80, 0, 30], lEl: [-90, 0, 0], rEl: [-90, 0, 0], by: -0.1 }], [0.7, { spine: [-40, 0, 0], neck: [-30, 0, 0], brx: -40, lSh: [-80, 0, -30], rSh: [-80, 0, 30], lEl: [-90, 0, 0], rEl: [-90, 0, 0], by: 0.1 }], [1.0, { brx: -150, by: -0.4, spine: [-30, 0, 0], neck: [-40, 0, 0], lSh: [-80, 0, -30], rSh: [-80, 0, 30], lEl: [-90, 0, 0], rEl: [-90, 0, 0] }, 'in'], [1.35, DOWN_BACK]],
  [
    { t: 0, x: 0, y: 0, z: 0.95, yaw: 0, p: GUARD as unknown as PoseSpec },
    { t: 0.3, x: 0, y: 0, z: 0.4, yaw: 0, p: { spine: [10, 0, 0], lSh: [-20, 0, 30], rSh: [-20, 0, -30] } },
    { t: 0.7, x: 0, y: 1.0, z: 0.1, yaw: 0, p: { brx: -100, lSh: [-120, 0, 50], rSh: [-120, 0, -50], lHip: [-30, 0, 10], rHip: [-30, 0, -10] } },
    { t: 1.0, x: 0, y: 0, z: -0.9, yaw: 0, p: { brx: -200, by: -0.6, spine: [30, 0, 0], neck: [40, 0, 0], lSh: [-150, 0, 40], rSh: [-150, 0, -40] }, e: 'in' },
    { t: 1.35, x: 0, y: 0, z: -1.0, yaw: 0, p: { brx: -270, by: -0.82, neck: [-30, 30, 0], lSh: [-150, 0, 30], rSh: [-40, 0, -40], lEl: [-30, 0, 0], rEl: [-50, 0, 0], lHip: [0, 0, 10], rHip: [-20, 0, -12], lKn: [30, 0, 0], rKn: [10, 0, 0] } },
  ],
  [{ at: 1.0, dmg: 20, react: 'none', power: 1, src: 'body', sfx: 'slam', unblockable: true, fx: 'gold' }], 'face', { attackerDown: 'back', cine: 'special', fx: 'gold', stamina: 12 }));
reg({ id: 'boltkick', name: 'Pontapé Relâmpago', kind: 'special', cine: 'special', range: 3, stamina: 12, fx: 'spark',
  hits: [{ at: 0.55, dmg: 18, react: 'knockFace', power: 1, src: 'rf', sfx: 'kick', push: 2.2, fx: 'spark', unblockable: true }],
  clip: clip('boltkick', [[0, GUARD], [0.2, { by: -0.2, spine: [30, 0, 0], lKn: [70, 0, 0], rKn: [70, 0, 0] }], [0.32, { by: -0.2, spine: [30, 0, 0], lKn: [70, 0, 0], rKn: [70, 0, 0] }, 'snap'], [0.42, { bry: 25, rHip: [-60, 0, -40], rKn: [100, 0, 0] }], [0.55, { bry: 70, rHip: [-56, 0, -88], rKn: [8, 0, 0], spine: [0, 0, 28], lHip: [0, 30, 10] }, 'out'], [0.95, GUARD]]) });
reg({ id: 'phantom', name: 'Lariat Fantasma', kind: 'special', cine: 'special', range: 3.2, stamina: 12, fx: 'shadow',
  hits: [{ at: 0.4, dmg: 19, react: 'launch', power: 1, src: 'rh', sfx: 'heavy', vy: 4, push: 4, fx: 'shadow', unblockable: true }],
  clip: clip('phantom', [[0, GUARD], [0.15, { spine: [40, 0, 0], by: -0.15, rSh: [30, 0, -60], lSh: [-60, 0, 30] }], [0.4, { spine: [20, 30, 0], rSh: [-80, 0, -88], rEl: [0, 0, 0], lSh: [-30, 0, 40], neck: [-10, -20, 0] }, 'out'], [0.6, { spine: [10, 50, 0], rSh: [-80, 0, -88] }], [0.9, GUARD]]),
  root: [[0.15, 0.1], [0.4, 2.3], [0.6, 2.5]] });
reg(paired('atomic', 'Bomba Atómica', 'special', [[0, GUARD], [0.3, PB_GRAB], [0.8, { ...PB_LIFT, by: 0.25 }], [1.1, PB_SLAM, 'in'], [1.55, GUARD]], PB_VIC.map((k) => (k.t === 0.8 ? { ...k, y: 1.5 } : k)),
  [{ at: 1.1, dmg: 22, react: 'none', power: 1, src: 'body', sfx: 'slam', unblockable: true, fx: 'fire' }], 'back', { cine: 'special', fx: 'fire', stamina: 12 }));
reg(paired('bearhug', 'Abraço do Urso', 'special',
  [[0, GUARD], [0.3, { spine: [-10, 0, 0], neck: [-10, 0, 0], lSh: [-90, 0, -40], rSh: [-90, 0, 40], lEl: [-90, 0, 0], rEl: [-90, 0, 0], by: -0.05 }], [0.6, { spine: [-30, 0, 0], neck: [-20, 0, 0], lSh: [-90, 0, -50], rSh: [-90, 0, 50], lEl: [-100, 0, 0], rEl: [-100, 0, 0], by: 0.02 }], [0.9, { spine: [-26, 0, 0], lSh: [-90, 0, -40], rSh: [-90, 0, 40], lEl: [-90, 0, 0], rEl: [-90, 0, 0] }], [1.2, { spine: [-32, 0, 0], lSh: [-90, 0, -52], rSh: [-90, 0, 52], lEl: [-104, 0, 0], rEl: [-104, 0, 0] }], [1.5, { spine: [-26, 0, 0], lSh: [-90, 0, -40], rSh: [-90, 0, 40], lEl: [-90, 0, 0], rEl: [-90, 0, 0] }], [1.8, { spine: [30, 0, 0], lSh: [-60, 0, 20], rSh: [-60, 0, -20] }], [2.1, GUARD]],
  [
    { t: 0, x: 0, y: 0, z: 0.95, yaw: 180, p: GUARD as unknown as PoseSpec },
    { t: 0.3, x: 0, y: 0.2, z: 0.4, yaw: 180, p: { spine: [-20, 0, 0], neck: [-30, 0, 0], lSh: [-40, 0, 60], rSh: [-40, 0, -60], lHip: [10, 0, 0], rHip: [10, 0, 0], lKn: [30, 0, 0], rKn: [30, 0, 0] } },
    { t: 0.9, x: 0, y: 0.3, z: 0.38, yaw: 180, p: { spine: [-30, 0, 0], neck: [-40, 0, 0], lSh: [-150, 0, 40], rSh: [-150, 0, -40], lHip: [20, 0, 0], rHip: [-10, 0, 0], lKn: [50, 0, 0], rKn: [20, 0, 0] } },
    { t: 1.5, x: 0, y: 0.3, z: 0.38, yaw: 180, p: { spine: [-36, 0, 0], neck: [-50, 0, 0], lSh: [-160, 0, 50], rSh: [-160, 0, -50], lHip: [-10, 0, 0], rHip: [20, 0, 0], lKn: [20, 0, 0], rKn: [50, 0, 0] } },
    { t: 1.8, x: 0, y: 0, z: 0.7, yaw: 180, p: { spine: [40, 0, 0], neck: [20, 0, 0], by: -0.1, lSh: [-20, 0, 20], rSh: [-20, 0, -20] } },
    { t: 2.1, x: 0, y: 0, z: 0.85, yaw: 180, p: { spine: [36, 0, 0], neck: [-24, 0, 0], lSh: [-40, 0, 10], rSh: [-40, 0, -10], by: -0.1, lKn: [36, 0, 0], rKn: [36, 0, 0] } },
  ],
  [0.6, 0.9, 1.2, 1.5].map((at) => ({ at, dmg: 3.2, react: 'none' as React, power: 0.35, src: 'body' as const, sfx: 'heavy' as const, unblockable: true })), 'stand', { cine: 'special', stamina: 10 }));

// ── SUPERS (cinematic) ───────────────────────────────────────────────────────
reg(paired('sup_bomb', 'BOMBA FINAL', 'super', [[0, GUARD], [0.45, PB_GRAB], [1.3, { ...PB_LIFT, by: 0.3 }], [1.85, PB_SLAM, 'in'], [2.5, GUARD]],
  PB_VIC.map((k) => ({ ...k, t: k.t === 0.3 ? 0.45 : k.t === 0.8 ? 1.3 : k.t === 1.1 ? 1.85 : k.t === 1.55 ? 2.5 : k.t, y: k.t === 0.8 ? 1.75 : k.y })),
  [{ at: 1.85, dmg: 30, react: 'none', power: 1, src: 'body', sfx: 'slam', unblockable: true, fx: 'gold' }], 'back', { cine: 'super', fx: 'gold', stamina: 0 }));
reg(paired('sup_triple', 'SUPLEX GIGANTE', 'super',
  [[0, GUARD], [0.25, GRAB], [0.6, { spine: [-10, 0, 0], lSh: [-170, 0, -8], rSh: [-170, 0, 8], lEl: [-40, 0, 0], rEl: [-40, 0, 0] }], [0.9, { spine: [-50, 0, 0], brx: -50, by: -0.3, lSh: [-170, 0, -8], rSh: [-170, 0, 8], lEl: [-40, 0, 0], rEl: [-40, 0, 0] }, 'in'],
    [1.25, GRAB], [1.6, { spine: [-10, 0, 0], lSh: [-170, 0, -8], rSh: [-170, 0, 8], lEl: [-40, 0, 0], rEl: [-40, 0, 0], by: 0.05 }], [1.9, { spine: [-50, 0, 0], brx: -50, by: -0.3, lSh: [-170, 0, -8], rSh: [-170, 0, 8] }, 'in'],
    [2.25, GRAB], [2.75, { spine: [-14, 0, 0], neck: [-30, 0, 0], lSh: [-175, 0, -8], rSh: [-175, 0, 8], lEl: [-20, 0, 0], rEl: [-20, 0, 0], by: 0.45 }, 'out'], [3.1, { by: -0.78, brx: -90, lSh: [-170, 0, 10], rSh: [-170, 0, -10] }, 'in'], [3.5, DOWN_BACK]],
  [
    { t: 0, x: 0, y: 0, z: 0.95, yaw: 180, p: GUARD as unknown as PoseSpec },
    { t: 0.25, x: 0, y: 0, z: 0.55, yaw: 180, p: BENT },
    { t: 0.6, x: 0, y: 0.95, z: 0.15, yaw: 180, p: { brx: 175, lSh: [-30, 0, 30], rSh: [-30, 0, -30] } },
    { t: 0.9, x: 0, y: 0, z: -0.7, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-30, 0, 70], rSh: [-30, 0, -70] }, e: 'in' },
    { t: 1.1, x: 0, y: 0, z: 0.4, yaw: 180, p: { ...SIT_SPEC(), brx: 0 } },
    { t: 1.25, x: 0, y: 0, z: 0.55, yaw: 180, p: BENT },
    { t: 1.6, x: 0, y: 0.95, z: 0.15, yaw: 180, p: { brx: 175, lSh: [-30, 0, 30], rSh: [-30, 0, -30] } },
    { t: 1.9, x: 0, y: 0, z: -0.7, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-30, 0, 70], rSh: [-30, 0, -70] }, e: 'in' },
    { t: 2.1, x: 0, y: 0, z: 0.4, yaw: 180, p: { ...SIT_SPEC(), brx: 0 } },
    { t: 2.25, x: 0, y: 0, z: 0.55, yaw: 180, p: BENT },
    { t: 2.75, x: 0, y: 2.2, z: 0.1, yaw: 180, p: { brx: 180, lSh: [-30, 0, 40], rSh: [-30, 0, -40] }, e: 'out' },
    { t: 3.1, x: 0, y: 0, z: -1.1, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-30, 0, 70], rSh: [-30, 0, -70] }, e: 'in' },
    { t: 3.5, x: 0, y: 0, z: -1.15, yaw: 180, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72], lHip: [-8, 0, 12], rHip: [-14, 0, -10], lKn: [20, 0, 0], neck: [-14, 0, 0] } },
  ],
  [{ at: 0.9, dmg: 8, react: 'none', power: 0.7, src: 'body', sfx: 'slam', unblockable: true }, { at: 1.9, dmg: 9, react: 'none', power: 0.8, src: 'body', sfx: 'slam', unblockable: true }, { at: 3.1, dmg: 16, react: 'none', power: 1, src: 'body', sfx: 'slam', unblockable: true, fx: 'gold' }], 'back', { cine: 'super', attackerDown: 'back', fx: 'gold', stamina: 0 }));
function SIT_SPEC(): PoseSpec { return { by: -0.6, spine: [30, 0, 0], neck: [-10, 0, 0], lSh: [-40, 0, 20], rSh: [-40, 0, -20], lHip: [-80, 0, 10], rHip: [-80, 0, -10], lKn: [60, 0, 0], rKn: [60, 0, 0] }; }

reg({ id: 'sup_thunder', name: 'PUNHO DO TROVÃO', kind: 'super', cine: 'super', range: 1.4, stamina: 0, fx: 'spark',
  hits: [{ at: 1.55, dmg: 32, react: 'launch', power: 1, src: 'rh', sfx: 'heavy', push: 9, vy: 3, fx: 'spark', unblockable: true }],
  clip: clip('sup_thunder', [[0, GUARD], [0.5, { by: -0.25, spine: [-10, -40, 0], rSh: [40, 0, -30], rEl: [-90, 0, 0], lSh: [-100, 0, 30], lEl: [-20, 0, 0], lKn: [60, 0, 0], rKn: [60, 0, 0], neck: [-30, 40, 0] }], [1.3, { by: -0.3, spine: [-14, -50, 0], rSh: [50, 0, -40], rEl: [-100, 0, 0], lSh: [-110, 0, 30], lEl: [-10, 0, 0], lKn: [70, 0, 0], rKn: [70, 0, 0], neck: [-30, 50, 0] }], [1.55, { by: 0, spine: [20, 40, 0], chest: [6, 20, 0], rSh: [-94, 0, 6], rEl: [0, 0, 0], lSh: [-30, 0, 40], rHip: [30, -20, -6], bz: 0.2 }, 'out'], [2.2, { spine: [20, 40, 0], rSh: [-94, 0, 6], rEl: [0, 0, 0], bz: 0.2 }], [2.6, GUARD]]),
  root: [[1.3, 0], [1.55, 0.5]] });
reg({ id: 'sup_meteor', name: 'METEORO', kind: 'super', cine: 'super', range: 99, stamina: 0, fx: 'fire', attackerDown: 'face',
  hits: [{ at: 2.15, dmg: 34, react: 'none', power: 1, src: 'body', sfx: 'slam', unblockable: true, fx: 'fire' }],
  clip: clip('sup_meteor', [[0, GUARD], [0.45, { by: -0.35, spine: [40, 0, 0], lSh: [40, 0, 30], rSh: [40, 0, -30], lKn: [100, 0, 0], rKn: [100, 0, 0], lHip: [-80, 0, 6], rHip: [-80, 0, -6] }], [0.6, D({ spine: [-20, 0, 0], lSh: [-175, 0, 20], rSh: [-175, 0, -20], lHip: [10, 0, 6], rHip: [10, 0, -6] }, NEUTRAL), 'out'], [1.6, D({ brx: 90, lSh: [-170, 0, 20], rSh: [-170, 0, -20], lEl: [0, 0, 0], rEl: [0, 0, 0] }, NEUTRAL)], [2.15, D({ brx: 90, by: -0.7, lSh: [-120, 0, 60], rSh: [-120, 0, -60] }, NEUTRAL), 'in'], [2.5, DOWN_FACE]]) });
reg({ id: 'sup_dragon', name: 'DRAGÃO ASCENDENTE', kind: 'super', cine: 'super', range: 1.0, stamina: 0, fx: 'fire',
  hits: [{ at: 0.6, dmg: 8, react: 'none', power: 0.7, src: 'rh', sfx: 'heavy', unblockable: true, fx: 'fire' }, { at: 1.1, dmg: 10, react: 'none', power: 0.8, src: 'rh', sfx: 'heavy', unblockable: true, fx: 'fire' }, { at: 1.6, dmg: 16, react: 'launch', power: 1, src: 'rh', sfx: 'heavy', vy: 2, push: 3, unblockable: true, fx: 'fire' }],
  clip: clip('sup_dragon', [[0, GUARD], [0.5, { by: -0.35, spine: [40, 30, 0], rSh: [30, 0, 10], rEl: [-110, 0, 0], lKn: [90, 0, 0], rKn: [90, 0, 0], lHip: [-60, 0, 6] }], [0.6, { bry: 90, spine: [-14, -30, 0], rSh: [-178, 0, 4], rEl: [-20, 0, 0], rKn: [60, 0, 0], rHip: [30, 0, -6] }, 'out'], [1.6, { bry: 1080, spine: [-14, -30, 0], rSh: [-178, 0, 4], rEl: [-20, 0, 0], rKn: [60, 0, 0], lHip: [-40, 0, 6] }, 'lin'], [2.6, { bry: 1080, rSh: [-178, 0, 4], rEl: [-10, 0, 0], lHip: [-30, 0, 6], lKn: [40, 0, 0] }], [3.0, { bry: 1080 + 352 - 360 }]]) });
reg({ id: 'sup_nova', name: 'SUPERNOVA', kind: 'super', cine: 'super', range: 99, stamina: 0, fx: 'cosmic',
  hits: [{ at: 2.3, dmg: 36, react: 'launch', power: 1, src: 'body', sfx: 'slam', vy: 6, push: 6, unblockable: true, fx: 'cosmic' }],
  clip: clip('sup_nova', [[0, GUARD], [0.6, D({ spine: [-10, 0, 0], neck: [-20, 0, 0], lSh: [-60, 0, 80], rSh: [-60, 0, -80], lEl: [-30, 0, 0], rEl: [-30, 0, 0], lHip: [-30, 0, 10], rHip: [-10, 0, -10], lKn: [70, 0, 0], rKn: [40, 0, 0] }, NEUTRAL)], [1.9, D({ spine: [20, 0, 0], neck: [10, 0, 0], lSh: [-80, 0, -10], rSh: [-80, 0, 10], lEl: [-120, 0, 0], rEl: [-120, 0, 0], lHip: [-60, 0, 10], rHip: [-60, 0, -10], lKn: [100, 0, 0], rKn: [100, 0, 0] }, NEUTRAL)], [2.3, D({ spine: [-30, 0, 0], neck: [-40, 0, 0], lSh: [-170, 0, 60], rSh: [-170, 0, -60], lEl: [0, 0, 0], rEl: [0, 0, 0], lHip: [0, 0, 20], rHip: [0, 0, -20] }, NEUTRAL), 'out'], [3.0, D({ spine: [-20, 0, 0], lSh: [-160, 0, 60], rSh: [-160, 0, -60] }, NEUTRAL)], [3.4, GUARD]]) });

// reversal clip for counters (quick arm drag)
reg(paired('armdrag', 'Reversão', 'grapple',
  [[0, GUARD], [0.15, { spine: [10, 50, 0], rSh: [-90, 0, -20], lSh: [-90, 0, 20], by: -0.1 }], [0.45, { spine: [40, 100, 0], bry: 60, rSh: [-60, 0, -40], by: -0.3, lKn: [60, 0, 0], rKn: [60, 0, 0] }, 'out'], [0.75, GUARD]],
  [
    { t: 0, x: 0, y: 0, z: 0.95, yaw: 180, p: GUARD as unknown as PoseSpec },
    { t: 0.15, x: 0, y: 0, z: 0.55, yaw: 180, p: { spine: [20, 0, 0], lSh: [-90, 0, 0] } },
    { t: 0.35, x: 0.4, y: 0.9, z: 0.2, yaw: 120, p: { brx: 160, lSh: [-150, 0, 30], rSh: [-150, 0, -30] }, e: 'out' },
    { t: 0.45, x: 0.95, y: 0, z: -0.1, yaw: 90, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72] }, e: 'in' },
    { t: 0.75, x: 1.0, y: 0, z: -0.1, yaw: 90, p: { brx: 270, by: -0.8, lSh: [-14, 0, 72], rSh: [-14, 0, -72], lHip: [-8, 0, 12], rHip: [-14, 0, -10] } },
  ],
  [{ at: 0.45, dmg: 7, react: 'none', power: 0.6, src: 'body', sfx: 'slam', unblockable: true }], 'back', { stamina: 4, weight: 0 }));

/** Strike combos the AI chains together. */
export const COMBOS: string[][] = [
  ['jab', 'jab', 'cross'], ['jab', 'cross', 'hook'], ['cross', 'hook', 'upper'], ['body', 'hook'], ['jab', 'cross', 'teep'],
  ['chop', 'chop'], ['elbow', 'knee'], ['jab', 'roundhouse'], ['jab', 'jab', 'cross', 'hook'], ['body', 'body', 'upper'],
  ['headbutt'], ['backfist'], ['superman'], ['bigboot'], ['cross', 'roundhouse'], ['hook', 'body', 'upper'],
];
export const GRAPPLES = ['suplex', 'bodyslam', 'ddt', 'hiptoss', 'powerbomb'];
export const RUNNING = ['clothesline', 'spear', 'dropkick', 'backdrop'];
export const AERIALS = ['splash', 'moonsault', 'flyelbow'];
export const TAUNTS = ['taunt_flex', 'taunt_crowd', 'taunt_comeon'];
export { mirror };
