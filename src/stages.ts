// ─────────────────────────────────────────────────────────────────────────────
//  3D "stages": what the shared world shows behind each screen.
// ─────────────────────────────────────────────────────────────────────────────
import { AdditiveBlending, BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { Animator } from './char/animator';
import { Rig } from './char/rig';
import { sfx } from './engine/audio';
import { radialTex, toon } from './engine/gfx';
import type { World } from './engine/world';
import { C, MOVES } from './fight/moves';
import { Appearance, CHEST, RARITY, Rarity } from './meta/data';

export interface Stage { update(dt: number): void; dispose(): void }

const t1 = new Vector3();

/** a posed fighter used in menus (no combat) */
class Showcase {
  rig: Rig;
  anim: Animator;
  shadow: Mesh;
  private tauntT = 3 + Math.random() * 3;
  yaw = 0;
  constructor(private w: World, app: Appearance, pos: Vector3, yaw: number, private guard = false) {
    this.rig = new Rig(app);
    this.anim = new Animator(this.rig);
    this.anim.base = guard ? 'guard' : 'relaxed';
    this.rig.root.position.copy(pos);
    this.yaw = yaw;
    this.rig.root.rotation.y = yaw;
    this.shadow = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ map: radialTex(), color: 0, transparent: true, opacity: 0.55, depthWrite: false }));
    this.shadow.geometry.dispose();
    this.shadow.geometry = new CylinderGeometry(0.55, 0.55, 0.001, 24);
    this.shadow.position.set(pos.x, 0.012, pos.z);
    w.gfx.scene.add(this.rig.root, this.shadow);
  }
  update(dt: number, taunts = true) {
    if (taunts) {
      this.tauntT -= dt;
      if (this.tauntT < 0 && !this.anim.playing) {
        this.tauntT = 4 + Math.random() * 4;
        const opts = this.guard ? [C.comeOn, MOVES.jab.clip, MOVES.cross.clip, C.flex] : [C.flex, C.crowd, C.comeOn];
        this.anim.play(opts[Math.floor(Math.random() * opts.length)]);
      }
    }
    this.rig.root.rotation.y = this.yaw;
    this.anim.update(dt);
    this.rig.update(dt);
    const look = this.rig.look;
    if (look.aura !== undefined) this.w.fx.emit(this.rig.chestWorld(t1), look.aura, 14, dt, 0.32, 1.1, 0.1);
    const hf = this.rig.hairLook.fx;
    if (hf) {
      const head = this.rig.headWorld(t1); head.y += 0.22;
      fxHair(this.w, hf, head, dt);
    }
  }
  dispose() {
    this.rig.dispose();
    this.shadow.removeFromParent();
    (this.shadow.material as MeshBasicMaterial).dispose();
    this.shadow.geometry.dispose();
  }
}

export function fxHair(w: World, fx: string, head: Vector3, dt: number) {
  const col = fx === 'fire' ? 0xff6a1f : fx === 'ice' ? 0xbfefff : fx === 'spark' ? 0xffe14d : fx === 'galaxy' ? 'rainbow' : 0x93c5fd;
  w.fx.emit(head, col, fx === 'fire' ? 30 : 10, dt, 0.1, fx === 'fire' ? 1.4 : 0.6, fx === 'fire' ? 0.13 : 0.06);
}

/** Hub: the player's fighter standing proud in the middle of the ring. */
export class MenuStage implements Stage {
  hero: Showcase;
  rival: Showcase | null = null;
  private t = 0;
  constructor(private w: World, app: Appearance, public mode: 'hub' | 'creator' | 'vs' = 'hub', rivalApp?: Appearance) {
    const heroPos = mode === 'vs' ? new Vector3(-0.9, 0, 0) : new Vector3(0, 0, 0);
    this.hero = new Showcase(w, app, heroPos, mode === 'vs' ? Math.PI / 2 : 0, mode === 'vs');
    if (rivalApp) this.rival = new Showcase(w, rivalApp, new Vector3(0.9, 0, 0), -Math.PI / 2, true);
    w.director.autoEnabled = false;
    w.fx.clear();
    w.arena.setDim(0);
    this.frame(true);
  }
  setYaw(y: number) { this.hero.yaw = y; }
  private frame(cut = false) {
    const d = this.w.director;
    if (this.mode === 'creator') d.set({ mode: 'menu', pos: new Vector3(0, 1.45, 3.3), look: new Vector3(0, 1.0, 0), cut, fov: 38, lerp: 5, shiftX: 0.16, shiftY: 0.24 });
    else if (this.mode === 'vs') d.set({ mode: 'menu', pos: new Vector3(0, 1.6, 4.4), look: new Vector3(0, 1.1, 0), cut, fov: 40 });
    else d.set({ mode: 'menu', pos: new Vector3(1.6, 1.9, 4.3), look: new Vector3(0, 1.05, 0), cut, fov: 40 });
  }
  rebuild(app: Appearance) {
    const yaw = this.hero.yaw;
    const pos = this.hero.rig.root.position.clone();
    this.hero.dispose();
    this.hero = new Showcase(this.w, app, pos, yaw, this.mode === 'vs');
  }
  playClip(name: 'flex' | 'crowd' | 'victory') { this.hero.anim.play(C[name]); }
  update(dt: number) {
    this.t += dt;
    if (this.mode === 'hub') {
      // slow cinematic drift
      const a = Math.sin(this.t * 0.12) * 0.5 + 0.35;
      this.w.director.shot.pos = new Vector3(Math.sin(a) * 4.3, 1.9 + Math.sin(this.t * 0.2) * 0.15, Math.cos(a) * 4.3);
    }
    this.hero.update(dt, this.mode !== 'creator');
    this.rival?.update(dt);
    this.w.fx.update(dt);
    this.w.arena.update(dt);
    this.w.director.update(dt);
  }
  dispose() { this.hero.dispose(); this.rival?.dispose(); }
}

/** Chest opening: the chest falls into the centre of the ring and bursts open. */
export class ChestStage implements Stage {
  private g = new Group();
  private lid = new Group();
  private glowMat: MeshBasicMaterial;
  private halo: Mesh;
  private t = 0;
  phase: 'drop' | 'idle' | 'shake' | 'open' | 'done' = 'drop';
  private shakeN = 0;
  private shakeT = 0;
  private openT = 0;
  private peakColor: number;
  private peakTier: number;
  onOpened: (() => void) | null = null;
  private disposables: { dispose(): void }[] = [];

  constructor(private w: World, chestId: string, peak: Rarity) {
    const def = CHEST[chestId];
    const [bodyC, trimC, glowC] = def.colors;
    this.peakColor = RARITY[peak].hex;
    this.peakTier = RARITY[peak].tier;
    const body = toon(bodyC), trim = toon(trimC, { emissive: trimC, emissiveIntensity: 0.25 });
    const lockM = toon(glowC, { emissive: glowC, emissiveIntensity: 0.9 });
    this.disposables.push(body, trim, lockM);
    const box = (sx: number, sy: number, sz: number, m: typeof body, x = 0, y = 0, z = 0) => {
      const geo = new BoxGeometry(sx, sy, sz); this.disposables.push(geo);
      const mm = new Mesh(geo, m); mm.position.set(x, y, z); return mm;
    };
    // base
    this.g.add(box(1.3, 0.62, 0.86, body, 0, 0.31, 0));
    this.g.add(box(1.36, 0.1, 0.92, trim, 0, 0.05, 0));
    this.g.add(box(1.36, 0.08, 0.92, trim, 0, 0.6, 0));
    for (const x of [-0.42, 0.42]) this.g.add(box(0.12, 0.64, 0.92, trim, x, 0.31, 0));
    this.g.add(box(0.26, 0.28, 0.06, lockM, 0, 0.44, 0.45));
    // lid (pivot on back edge)
    this.lid.position.set(0, 0.62, -0.43);
    const lidGeo = new CylinderGeometry(0.43, 0.43, 1.3, 20, 1, false, 0, Math.PI); this.disposables.push(lidGeo);
    const lidM = new Mesh(lidGeo, body);
    lidM.rotation.z = Math.PI / 2;
    lidM.position.set(0, 0, 0.43);
    this.lid.add(lidM);
    for (const x of [-0.42, 0.42]) {
      const bandGeo = new CylinderGeometry(0.45, 0.45, 0.12, 20, 1, false, 0, Math.PI); this.disposables.push(bandGeo);
      const band = new Mesh(bandGeo, trim);
      band.rotation.z = Math.PI / 2;
      band.position.set(x, 0, 0.43);
      this.lid.add(band);
    }
    this.g.add(this.lid);
    // inner glow
    this.glowMat = new MeshBasicMaterial({ map: radialTex(), color: this.peakColor, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    const sg = new SphereGeometry(1, 16, 12); this.disposables.push(sg, this.glowMat);
    this.halo = new Mesh(sg, this.glowMat);
    this.halo.scale.setScalar(0.1);
    this.halo.position.y = 0.6;
    this.g.add(this.halo);
    this.g.position.set(0, 9, 0);
    this.g.scale.setScalar(1.15);
    w.gfx.scene.add(this.g);
    w.director.autoEnabled = false;
    w.fx.clear();
    w.director.set({ mode: 'menu', pos: new Vector3(0, 2.4, 4.6), look: new Vector3(0, 0.8, 0), cut: true, fov: 42, lerp: 4 });
    w.arena.setDim(0.55);
    sfx.whoosh(1);
  }

  /** player tap */
  tap() {
    if (this.phase === 'idle' || this.phase === 'shake') {
      if (this.phase === 'idle') this.phase = 'shake';
      this.shakeN++;
      this.shakeT = 0;
      sfx.rumble(0.35);
      this.w.director.shake(0.25 + this.shakeN * 0.1);
      this.w.fx.burst(new Vector3(0, 0.9, 0.3), this.peakTier >= 5 ? 'cosmic' : this.peakTier >= 3 ? 'gold' : 'spark', 0.3 + this.shakeN * 0.2);
      if (this.shakeN >= 3) this.open();
    }
  }

  private open() {
    this.phase = 'open';
    this.openT = 0;
    const fx = this.w.fx;
    const p = new Vector3(0, 0.7, 0);
    fx.pillar(new Vector3(0, 0, 0), this.peakColor, 0.9, 14, 2.2, 0.7);
    fx.shock(new Vector3(0, 0.05, 0), this.peakColor, 6, 0.8);
    fx.shock(new Vector3(0, 0.05, 0), 0xffffff, 3, 0.5);
    fx.burst(p, this.peakTier >= 6 ? 'cosmic' : this.peakTier >= 4 ? 'gold' : 'spark', 1.5 + this.peakTier * 0.4);
    if (this.peakTier >= 4) fx.confetti(new Vector3(0, 0, 0), 120 + this.peakTier * 30);
    this.w.director.shake(0.6 + this.peakTier * 0.1);
    this.w.arena.hype(1);
    sfx.reveal(this.peakTier);
    sfx.crowdCheer(0.4 + this.peakTier * 0.1);
    this.w.director.set({ mode: 'menu', pos: new Vector3(0, 3.2, 5.6), look: new Vector3(0, 1.4, 0), fov: 44, lerp: 2 });
  }

  update(dt: number) {
    this.t += dt;
    const g = this.g;
    if (this.phase === 'drop') {
      g.position.y = Math.max(0, g.position.y - dt * (6 + this.t * 26));
      g.rotation.y += dt * 2;
      if (g.position.y <= 0) {
        g.position.y = 0;
        this.phase = 'idle';
        this.w.fx.slam(new Vector3(0, 0, 0), 0.9);
        this.w.director.shake(0.6);
        sfx.hit('slam', 0.9);
        sfx.crowdCheer(0.5);
      }
    } else if (this.phase === 'idle') {
      g.rotation.y += (0.35 - g.rotation.y) * Math.min(1, dt * 4);
      g.position.y = Math.abs(Math.sin(this.t * 2.2)) * 0.05;
      this.glowMat.opacity = 0.15 + Math.sin(this.t * 4) * 0.08;
      this.halo.scale.setScalar(1.1);
      if (Math.random() < dt * 6) this.w.fx.emit(new Vector3(0, 0.8, 0), this.peakTier >= 6 ? 'rainbow' : 0xffe9a8, 30, dt, 0.7, 0.8, 0.06);
    } else if (this.phase === 'shake') {
      this.shakeT += dt;
      const amp = Math.max(0, 0.18 - this.shakeT * 0.5) * (1 + this.shakeN * 0.3);
      g.rotation.z = Math.sin(this.shakeT * 50) * amp;
      g.position.y = Math.max(0, Math.sin(this.shakeT * 25)) * amp * 0.6;
      this.lid.rotation.x = -Math.max(0, Math.sin(this.shakeT * 30)) * amp * 1.3;
      this.glowMat.opacity = 0.25 + this.shakeN * 0.18;
      this.halo.scale.setScalar(1.1 + this.shakeN * 0.35);
      lockGlow(this.disposables, this.shakeN);
      this.w.fx.emit(new Vector3(0, 0.7, 0.4), this.peakColor, 20 + this.shakeN * 20, dt, 0.5, 1.4, 0.1);
    } else if (this.phase === 'open') {
      this.openT += dt;
      g.rotation.z *= 0.8;
      this.lid.rotation.x = Math.max(-2.2, this.lid.rotation.x - dt * 14);
      this.glowMat.opacity = Math.min(1, 0.6 + this.openT);
      this.halo.scale.setScalar(1.6 + Math.sin(this.t * 3) * 0.2);
      this.w.fx.emit(new Vector3(0, 0.9, 0), this.peakTier >= 6 ? 'rainbow' : this.peakColor, 60, dt, 0.4, 3.5, 0.14);
      if (this.openT > 0.9 && this.onOpened) { const cb = this.onOpened; this.onOpened = null; cb(); }
    }
    this.w.fx.update(dt);
    this.w.arena.update(dt);
    this.w.director.update(dt);
  }

  dispose() {
    this.g.removeFromParent();
    for (const d of this.disposables) d.dispose();
    this.w.arena.setDim(0);
  }
}

function lockGlow(list: { dispose(): void }[], n: number) {
  const m = list[2] as unknown as { emissiveIntensity: number };
  if (m && 'emissiveIntensity' in m) m.emissiveIntensity = 0.9 + n * 0.8;
}
