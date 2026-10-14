// ─────────────────────────────────────────────────────────────────────────────
//  Pose representation: a flat Float32Array (cheap to blend, zero allocations).
//  Authoring is done in degrees on top of a base pose with P({...}).
// ─────────────────────────────────────────────────────────────────────────────

export const JOINTS = ['spine', 'chest', 'neck', 'lSh', 'lEl', 'rSh', 'rEl', 'lHip', 'lKn', 'rHip', 'rKn'] as const;
export type Joint = (typeof JOINTS)[number];
export const BODY_OFF = JOINTS.length * 3; // bx, by, bz, brx, bry, brz
export const POSE_LEN = BODY_OFF + 6;
export type Pose = Float32Array;

const D = Math.PI / 180;

export interface PoseSpec extends Partial<Record<Joint, [number, number, number]>> {
  bx?: number; by?: number; bz?: number; brx?: number; bry?: number; brz?: number;
}

export function makePose(spec: PoseSpec, base?: Pose): Pose {
  const p = base ? new Float32Array(base) : new Float32Array(POSE_LEN);
  JOINTS.forEach((j, i) => {
    const v = spec[j];
    if (v) { p[i * 3] = v[0] * D; p[i * 3 + 1] = v[1] * D; p[i * 3 + 2] = v[2] * D; }
  });
  if (spec.bx !== undefined) p[BODY_OFF] = spec.bx;
  if (spec.by !== undefined) p[BODY_OFF + 1] = spec.by;
  if (spec.bz !== undefined) p[BODY_OFF + 2] = spec.bz;
  if (spec.brx !== undefined) p[BODY_OFF + 3] = spec.brx * D;
  if (spec.bry !== undefined) p[BODY_OFF + 4] = spec.bry * D;
  if (spec.brz !== undefined) p[BODY_OFF + 5] = spec.brz * D;
  return p;
}

/** swap left/right and mirror rotations across the sagittal plane */
export function mirror(p: Pose): Pose {
  const o = new Float32Array(p);
  const swap = (a: Joint, b: Joint) => {
    const ia = JOINTS.indexOf(a) * 3, ib = JOINTS.indexOf(b) * 3;
    for (let k = 0; k < 3; k++) { o[ia + k] = p[ib + k]; o[ib + k] = p[ia + k]; }
  };
  swap('lSh', 'rSh'); swap('lEl', 'rEl'); swap('lHip', 'rHip'); swap('lKn', 'rKn');
  for (let i = 0; i < JOINTS.length; i++) { o[i * 3 + 1] *= -1; o[i * 3 + 2] *= -1; }
  o[BODY_OFF] *= -1; o[BODY_OFF + 4] *= -1; o[BODY_OFF + 5] *= -1;
  return o;
}

export function lerpPose(out: Pose, a: Pose, b: Pose, t: number): Pose {
  for (let i = 0; i < POSE_LEN; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

// ── base poses ───────────────────────────────────────────────────────────────
export const NEUTRAL = makePose({
  lSh: [0, 0, 8], rSh: [0, 0, -8], lEl: [-8, 0, 0], rEl: [-8, 0, 0],
  lHip: [0, 0, 3], rHip: [0, 0, -3],
});

/** boxing guard: gloves up near the chin, knees bent, one foot forward */
export const GUARD = makePose({
  spine: [10, -8, 0], chest: [6, -4, 0], neck: [-8, 14, 0],
  lSh: [-58, 0, -6], lEl: [-112, 0, 0],
  rSh: [-46, 0, 10], rEl: [-124, 0, 0],
  lHip: [-22, 8, 6], lKn: [26, 0, 0],
  rHip: [14, -6, -6], rKn: [22, 0, 0],
  by: -0.06, bry: -8,
});

export const RELAXED = makePose({
  spine: [2, 0, 0], neck: [-2, 0, 0],
  lSh: [4, 0, 12], rSh: [4, 0, -12], lEl: [-14, 0, 0], rEl: [-14, 0, 0],
  lHip: [-2, 0, 4], rHip: [2, 0, -4], lKn: [4, 0, 0], rKn: [4, 0, 0],
});
