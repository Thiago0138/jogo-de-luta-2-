// ─────────────────────────────────────────────────────────────────────────────
//  Pose animator: procedural locomotion base layer + keyframed action clips
//  with crossfades. Zero allocations per frame.
// ─────────────────────────────────────────────────────────────────────────────
import { BODY_OFF, GUARD, JOINTS, makePose, Pose, POSE_LEN, PoseSpec, RELAXED } from './pose';
import type { Rig } from './rig';

export type Ease = 'io' | 'out' | 'in' | 'lin' | 'snap' | 'back';
export interface Key { t: number; p: Pose; e: Ease }
export interface Clip { name: string; keys: Key[]; dur: number }

const easeFn: Record<Ease, (x: number) => number> = {
  io: (x) => x * x * (3 - 2 * x),
  out: (x) => 1 - (1 - x) * (1 - x) * (1 - x),
  in: (x) => x * x * x,
  lin: (x) => x,
  snap: (x) => (x < 1 ? 0 : 1),
  back: (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
};

/** Build a clip. Each key: [time (s), pose spec relative to `base` or a Pose, ease into this key] */
export function clip(name: string, keys: [number, PoseSpec | Pose, Ease?][], base: Pose = GUARD): Clip {
  const k: Key[] = keys.map(([t, p, e]) => ({ t, p: p instanceof Float32Array ? p : makePose(p, base), e: e ?? 'io' }));
  return { name, keys: k, dur: k[k.length - 1].t };
}

export function sampleClip(c: Clip, t: number, out: Pose): Pose {
  const ks = c.keys;
  if (t <= ks[0].t) { out.set(ks[0].p); return out; }
  for (let i = 1; i < ks.length; i++) {
    const b = ks[i];
    if (t <= b.t) {
      const a = ks[i - 1];
      const x = (t - a.t) / Math.max(1e-4, b.t - a.t);
      const k = easeFn[b.e](Math.min(1, Math.max(0, x)));
      for (let j = 0; j < POSE_LEN; j++) out[j] = a.p[j] + (b.p[j] - a.p[j]) * k;
      return out;
    }
  }
  out.set(ks[ks.length - 1].p);
  return out;
}

export type BaseMode = 'guard' | 'relaxed' | 'tired';

const IDX = (j: (typeof JOINTS)[number]) => JOINTS.indexOf(j) * 3;
const I = { lHip: IDX('lHip'), rHip: IDX('rHip'), lKn: IDX('lKn'), rKn: IDX('rKn'), lSh: IDX('lSh'), rSh: IDX('rSh'), spine: IDX('spine'), chest: IDX('chest'), lEl: IDX('lEl'), rEl: IDX('rEl'), neck: IDX('neck') };
const TIRED = makePose({ spine: [32, 0, 0], chest: [12, 0, 0], neck: [-20, 0, 0], lSh: [-30, 0, 10], rSh: [-30, 0, -10], lEl: [-40, 0, 0], rEl: [-40, 0, 0], lHip: [-20, 0, 8], rHip: [-20, 0, -8], lKn: [30, 0, 0], rKn: [30, 0, 0], by: -0.08 });

export class Animator {
  base: BaseMode = 'guard';
  /** world-space locomotion relative to facing: forward speed and strafe speed (m/s) */
  fwd = 0;
  side = 0;
  speedMul = 1;
  private phase = Math.random() * 10;
  private t = 0;
  clip: Clip | null = null;
  clipT = 0;
  rate = 1;
  hold = false;
  loop = false;
  private out: Pose = new Float32Array(POSE_LEN);
  private target: Pose = new Float32Array(POSE_LEN);
  private snap: Pose = new Float32Array(POSE_LEN);
  private fade = 0;
  private fadeDur = 0.1;
  onEnd: (() => void) | null = null;

  constructor(private rig: Rig) {
    this.out.set(GUARD);
  }

  private snapshot() {
    this.snap.set(this.out);
    // unwind full spins so crossfades never rotate the long way round
    for (let i = BODY_OFF + 3; i < BODY_OFF + 6; i++) this.snap[i] = Math.atan2(Math.sin(this.snap[i]), Math.cos(this.snap[i]));
  }

  play(c: Clip, opts: { rate?: number; fade?: number; hold?: boolean; at?: number; loop?: boolean } = {}) {
    this.snapshot();
    this.clip = c;
    this.clipT = opts.at ?? 0;
    this.rate = opts.rate ?? 1;
    this.hold = opts.hold ?? false;
    this.loop = opts.loop ?? false;
    this.fadeDur = opts.fade ?? 0.08;
    this.fade = this.fadeDur > 0 ? 0 : 1;
    this.onEnd = null;
  }

  stop(fade = 0.15) {
    if (!this.clip) return;
    this.snapshot();
    this.clip = null;
    this.hold = false;
    this.loop = false;
    this.fadeDur = fade;
    this.fade = fade > 0 ? 0 : 1;
  }

  get playing() { return !!this.clip && (this.hold || this.clipT < this.clip.dur); }
  get progress() { return this.clip ? Math.min(1, this.clipT / this.clip.dur) : 1; }

  /** current output pose (read-only) */
  get pose() { return this.out; }

  private basePose(dt: number, out: Pose) {
    const moving = Math.hypot(this.fwd, this.side);
    this.phase += dt * (this.base === 'relaxed' ? 1.6 : 2.4) * this.speedMul + dt * moving * 4.2;
    const src = this.base === 'guard' ? GUARD : this.base === 'tired' ? TIRED : RELAXED;
    out.set(src);
    const t = this.t;
    // breathing / bounce
    const bounce = this.base === 'guard' ? Math.abs(Math.sin(this.phase * 1.4)) * 0.025 : Math.sin(t * 1.7) * 0.006;
    out[BODY_OFF + 1] += bounce - (this.base === 'guard' ? 0.012 : 0);
    out[I.chest] += Math.sin(t * (this.base === 'tired' ? 5 : 2)) * (this.base === 'tired' ? 0.08 : 0.025);
    if (this.base === 'guard') {
      // glove bob, subtle head weave
      out[I.lSh] += Math.sin(this.phase * 1.4) * 0.06;
      out[I.rSh] += Math.sin(this.phase * 1.4 + 1.2) * 0.06;
      out[I.neck + 2] += Math.sin(this.phase * 0.7) * 0.05;
      out[BODY_OFF + 5] += Math.sin(this.phase * 0.7) * 0.04;
    } else if (this.base === 'relaxed') {
      out[I.lSh + 2] += Math.sin(t * 1.3) * 0.03;
      out[I.rSh + 2] -= Math.sin(t * 1.3) * 0.03;
    }
    if (moving > 0.05) {
      const k = Math.min(1, moving / 1.8);
      const s = Math.sin(this.phase * 2.2);
      const c = Math.cos(this.phase * 2.2);
      const dirF = moving > 0 ? this.fwd / moving : 0;
      const dirS = moving > 0 ? this.side / moving : 0;
      const swing = 0.55 * k;
      out[I.lHip] += s * swing * dirF;
      out[I.rHip] -= s * swing * dirF;
      out[I.lHip + 2] += s * swing * dirS * 0.6;
      out[I.rHip + 2] += s * swing * dirS * 0.6;
      out[I.lKn] += Math.max(0, -c) * 0.8 * k;
      out[I.rKn] += Math.max(0, c) * 0.8 * k;
      out[BODY_OFF + 1] += Math.abs(c) * 0.03 * k;
      out[I.spine] += 0.12 * k * Math.max(0, dirF);
      if (this.base !== 'guard') { out[I.lSh] -= s * swing * 0.7; out[I.rSh] += s * swing * 0.7; }
    }
  }

  update(dt: number) {
    this.t += dt;
    if (this.clip) {
      this.clipT += dt * this.rate;
      if (this.loop && this.clipT >= this.clip.dur) this.clipT %= this.clip.dur;
      if (this.clipT >= this.clip.dur && !this.hold) {
        const cb = this.onEnd;
        sampleClip(this.clip, this.clip.dur, this.target);
        this.out.set(this.target);
        this.stop(0.14);
        cb?.();
      }
    }
    if (this.clip) sampleClip(this.clip, this.clipT, this.target);
    else this.basePose(dt, this.target);
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / Math.max(1e-3, this.fadeDur));
      const k = this.fade * this.fade * (3 - 2 * this.fade);
      for (let i = 0; i < POSE_LEN; i++) this.out[i] = this.snap[i] + (this.target[i] - this.snap[i]) * k;
    } else {
      this.out.set(this.target);
    }
    this.rig.applyPose(this.out);
  }
}
