// ─────────────────────────────────────────────────────────────────────────────
//  Camera director: broadcast-style shots, cinematic cuts, shake and FOV kicks.
// ─────────────────────────────────────────────────────────────────────────────
import { PerspectiveCamera, Vector3 } from 'three';

export type ShotMode = 'hard' | 'top' | 'low' | 'corner' | 'orbit' | 'close' | 'fixed' | 'menu' | 'side';

export interface Shot {
  mode: ShotMode;
  /** world-space look target provider (defaults to the fight focus) */
  target?: () => Vector3;
  /** for 'close': which way the subject faces (radians) so we frame the front */
  facing?: () => number;
  dist?: number;
  height?: number;
  angle?: number; // azimuth (rad)
  fov?: number;
  cut?: boolean;
  /** fixed shot params */
  pos?: Vector3;
  look?: Vector3;
  /** seconds before auto director may change shot again */
  hold?: number;
  lerp?: number;
  orbitSpeed?: number;
  /** shift the framing (fraction of the viewport) to make room for UI panels.
   *  shiftX applies on landscape screens, shiftY on portrait screens. */
  shiftX?: number;
  shiftY?: number;
}

const tmp = new Vector3();
const tmp2 = new Vector3();

export class Director {
  shot: Shot = { mode: 'hard' };
  private pos = new Vector3(0, 7, 9);
  private look = new Vector3();
  private shakeAmt = 0;
  private fovKick = 0;
  private orbitA = 0;
  private holdT = 0;
  private autoT = 6;
  private fov = 42;
  focus = new Vector3();
  spread = 1.5;
  autoEnabled = true;
  private hardAngle = 0;

  constructor(private cam: PerspectiveCamera) {}

  set(shot: Shot) {
    this.shot = shot;
    this.holdT = shot.hold ?? 0;
    if (shot.mode === 'orbit') this.orbitA = shot.angle ?? this.currentAzimuth();
    if (shot.cut) { this.computeDesired(1 / 60, true); this.snapTo(); }
  }

  private currentAzimuth() {
    return Math.atan2(this.pos.x - this.look.x, this.pos.z - this.look.z);
  }

  shake(a: number) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  kick(a: number) { this.fovKick = Math.min(10, this.fovKick + a); }

  private desiredPos = new Vector3();
  private desiredLook = new Vector3();

  private aspectFactor() {
    const asp = this.cam.aspect;
    return asp < 1 ? Math.min(1.75, 1 / asp * 0.85) : 1;
  }

  private computeDesired(dt: number, snap = false) {
    const s = this.shot;
    const target = s.target ? s.target() : this.focus;
    const af = this.aspectFactor();
    const spreadDist = Math.max(0, this.spread - 1.2) * 0.9;
    switch (s.mode) {
      case 'hard': {
        const a = s.angle ?? this.hardAngle;
        const d = ((s.dist ?? 7.2) + spreadDist) * af;
        const h = (s.height ?? 5.4) * (0.85 + af * 0.15);
        this.desiredPos.set(target.x * 0.6 + Math.sin(a) * d, h, target.z * 0.6 + Math.cos(a) * d);
        this.desiredLook.set(target.x, 0.55, target.z);
        break;
      }
      case 'top': {
        const d = ((s.dist ?? 1.4)) * af;
        const h = (s.height ?? 12) + spreadDist * 1.2 + (af - 1) * 5;
        this.desiredPos.set(target.x * 0.8, h, target.z * 0.8 + d);
        this.desiredLook.set(target.x, 0, target.z);
        break;
      }
      case 'low': {
        const a = s.angle ?? 0.5;
        const d = (s.dist ?? 5.2) * af;
        this.desiredPos.set(Math.sin(a) * d, s.height ?? 0.9, Math.cos(a) * d);
        this.desiredLook.set(target.x, 1.1, target.z);
        break;
      }
      case 'corner': {
        const a = s.angle ?? Math.PI / 4;
        const d = ((s.dist ?? 6.8) + spreadDist) * af;
        this.desiredPos.set(Math.sin(a) * d, s.height ?? 3.6, Math.cos(a) * d);
        this.desiredLook.set(target.x, 0.8, target.z);
        break;
      }
      case 'side': {
        const a = s.angle ?? Math.PI / 2;
        const d = ((s.dist ?? 6) + spreadDist) * af;
        this.desiredPos.set(target.x + Math.sin(a) * d, s.height ?? 2.2, target.z + Math.cos(a) * d);
        this.desiredLook.set(target.x, 0.9, target.z);
        break;
      }
      case 'orbit': {
        this.orbitA += dt * (s.orbitSpeed ?? 0.25);
        const d = (s.dist ?? 6.5) * af;
        this.desiredPos.set(target.x + Math.sin(this.orbitA) * d, s.height ?? 3, target.z + Math.cos(this.orbitA) * d);
        this.desiredLook.set(target.x, target.y || 1, target.z);
        break;
      }
      case 'close': {
        const f = s.facing ? s.facing() : 0;
        const a = f + (s.angle ?? 0.6);
        const d = (s.dist ?? 2.6) * Math.min(1.4, af);
        this.desiredPos.set(target.x + Math.sin(a) * d, target.y + (s.height ?? 0.25), target.z + Math.cos(a) * d);
        this.desiredLook.copy(target);
        break;
      }
      case 'menu':
      case 'fixed': {
        this.desiredPos.copy(s.pos ?? this.pos);
        if (s.mode === 'menu' && af > 1) {
          // pull back on portrait screens
          tmp.copy(this.desiredPos).sub(s.look ?? target).multiplyScalar(af * 0.92);
          this.desiredPos.copy(s.look ?? target).add(tmp);
        }
        this.desiredLook.copy(s.look ?? target);
        break;
      }
    }
    if (snap) return;
  }

  private snapTo() {
    this.pos.copy(this.desiredPos);
    this.look.copy(this.desiredLook);
  }

  /** auto-cut between broadcast angles during neutral fighting */
  private auto(dt: number) {
    if (!this.autoEnabled) return;
    this.holdT -= dt;
    this.autoT -= dt;
    if (this.holdT > 0 || this.autoT > 0) return;
    const r = Math.random();
    const choices: Shot[] = [
      { mode: 'hard', angle: this.hardAngle, hold: 0 },
      { mode: 'hard', angle: this.hardAngle + 0.5, hold: 0 },
      { mode: 'top', hold: 0 },
      { mode: 'corner', angle: Math.PI / 4 + Math.floor(Math.random() * 4) * Math.PI / 2, hold: 0 },
      { mode: 'low', angle: (Math.random() - 0.5) * 1.6, hold: 0 },
      { mode: 'orbit', dist: 7, height: 3.2, orbitSpeed: 0.18, hold: 0 },
    ];
    const weights = [0.34, 0.14, 0.18, 0.14, 0.1, 0.1];
    let acc = 0, idx = 0;
    for (let i = 0; i < weights.length; i++) { acc += weights[i]; if (r <= acc) { idx = i; break; } }
    const shot = choices[idx];
    shot.cut = Math.random() < 0.2;
    this.set(shot);
    this.autoT = 7 + Math.random() * 6;
  }

  private sx = 0;
  private sy = 0;
  private applyShift(dt: number) {
    const portrait = this.cam.aspect < 1;
    const tx = portrait ? 0 : this.shot.shiftX ?? 0;
    const ty = portrait ? this.shot.shiftY ?? 0 : 0;
    const k = Math.min(1, dt * 6);
    this.sx += (tx - this.sx) * k;
    this.sy += (ty - this.sy) * k;
    if (Math.abs(this.sx) < 1e-3 && Math.abs(this.sy) < 1e-3) {
      if (this.cam.view) { this.cam.clearViewOffset(); }
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    this.cam.setViewOffset(w, h, this.sx * w, this.sy * h, w, h);
  }

  /** return to the main broadcast angle */
  neutral(cut = false) { this.set({ mode: 'hard', angle: this.hardAngle, cut }); this.autoT = 3 + Math.random() * 4; }

  update(dt: number) {
    const s = this.shot;
    if (this.autoEnabled && (s.mode === 'hard' || s.mode === 'top' || s.mode === 'corner' || s.mode === 'low' || s.mode === 'orbit')) this.auto(dt);
    else if (this.autoEnabled && (s.mode === 'side' || s.mode === 'close')) {
      // temporary action shots fall back to the broadcast angle once their hold ends
      this.holdT -= dt;
      if (this.holdT <= 0) this.neutral(false);
    }
    this.computeDesired(dt);
    const k = 1 - Math.exp(-dt * (s.lerp ?? (s.mode === 'close' ? 7 : s.mode === 'menu' ? 3 : 3.2)));
    this.pos.lerp(this.desiredPos, k);
    this.look.lerp(this.desiredLook, Math.min(1, k * 1.6));
    // keep the camera out of the ring posts' way on low shots
    if (this.pos.y < 0.4) this.pos.y = 0.4;
    this.cam.position.copy(this.pos);
    if (this.shakeAmt > 0.001) {
      const a = this.shakeAmt * this.shakeAmt * 0.25;
      this.cam.position.x += (Math.random() - 0.5) * a;
      this.cam.position.y += (Math.random() - 0.5) * a;
      this.cam.position.z += (Math.random() - 0.5) * a;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.4);
    }
    tmp2.copy(this.look);
    this.cam.lookAt(tmp2);
    this.applyShift(dt);
    const targetFov = (s.fov ?? 42) - this.fovKick;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 8);
    this.fovKick = Math.max(0, this.fovKick - dt * 22);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
}
