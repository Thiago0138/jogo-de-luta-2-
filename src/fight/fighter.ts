// ─────────────────────────────────────────────────────────────────────────────
//  Fighter: combat stats + runtime state for one wrestler in a match.
// ─────────────────────────────────────────────────────────────────────────────
import { Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { Animator } from '../char/animator';
import { Rig } from '../char/rig';
import { radialTex } from '../engine/gfx';
import { Appearance, ITEM, maxHpFor, PassiveKey, StatKey } from '../meta/data';
import type { MoveDef } from './moves';

export interface FighterSpec {
  app: Appearance;
  name: string;
  level: number;
  stats: Record<StatKey, number>;
  specials: string[]; // item ids
  super: string | null;
  passives: string[];
  consumables: string[]; // consumable ids, one use each
  hpMul?: number;
  boss?: string;
  isPlayer?: boolean;
  title?: string;
}

export type FState =
  | 'idle' | 'act' | 'react' | 'down' | 'getup' | 'grabbed' | 'running' | 'awaitRunner' | 'toCorner' | 'climb' | 'perch' | 'leap'
  | 'air' | 'pinning' | 'pinned' | 'apron' | 'enter' | 'exit' | 'ko' | 'celebrate' | 'stunned' | 'save' | 'intro' | 'tag';

const shadowGeo = new PlaneGeometry(1, 1);
let shadowMat: MeshBasicMaterial | null = null;

export class Fighter {
  rig: Rig;
  anim: Animator;
  shadow: Mesh;
  name: string;
  level: number;
  s: Record<StatKey, number>;
  maxHp: number;
  hp: number;
  dispHp: number; // trailing HUD value
  stamina = 100;
  meter = 0;
  pos = new Vector3();
  yaw = 0;
  vel = new Vector3();
  vy = 0;
  state: FState = 'idle';
  st = 0;
  move: MoveDef | null = null;
  mt = 0;
  hitIdx = 0;
  rate = 1;
  target: Fighter | null = null;
  holder: Fighter | null = null; // when grabbed: who holds us
  combo: string[] = [];
  thinkT = 0.5;
  downT = 0;
  downFace = false;
  invuln = 0;
  // buffs
  rageT = 0;
  shield = 0;
  frozenT = 0;
  secondWindUsed = false;
  phoenixUsed = false;
  passive: Partial<Record<PassiveKey, number>> = {};
  consumables: string[];
  potionCd = 4;
  // tag
  team: 0 | 1;
  legal = true;
  partner: Fighter | null = null;
  tagCd = 8;
  // pins
  pinCount = 0;
  kickoutAt = 0;
  // misc AI
  groundActs = 0;
  lastSpecial = -99;
  aura: number | 'rainbow' | undefined;
  hairFx: string | undefined;
  // running the ropes
  runDir = new Vector3();
  runBounced = false;
  // aerial
  leapFrom = new Vector3();
  leapTo = new Vector3();
  corner = new Vector3();
  apronSpot = new Vector3();
  // stats for results
  stats = { hits: 0, crits: 0, specials: 0, supers: 0, kickouts: 0, aerials: 0, grapples: 0, dodges: 0, blocks: 0, potions: 0, tags: 0, dmg: 0 };

  constructor(public spec: FighterSpec, team: 0 | 1) {
    this.team = team;
    this.rig = new Rig(spec.app);
    this.anim = new Animator(this.rig);
    this.name = spec.name;
    this.level = spec.level;
    this.s = { ...spec.stats };
    this.maxHp = Math.round(maxHpFor(spec.level, this.s.vit) * (spec.hpMul ?? 1));
    this.hp = this.dispHp = this.maxHp;
    this.consumables = [...spec.consumables];
    for (const id of spec.passives) { const p = ITEM[id]?.passive; if (p) this.passive[p.key] = (this.passive[p.key] ?? 0) + p.value; }
    this.aura = this.rig.look.aura;
    this.hairFx = this.rig.hairLook.fx;
    if (!shadowMat) shadowMat = new MeshBasicMaterial({ map: radialTex(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false });
    this.shadow = new Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.setScalar(1.1);
    this.shadow.renderOrder = 1;
  }

  get hpPct() { return Math.max(0, this.hp / this.maxHp); }
  get standing() { return this.state === 'idle' || this.state === 'react' || this.state === 'act' || this.state === 'toCorner' || this.state === 'awaitRunner' || this.state === 'stunned'; }
  get grounded() { return this.state === 'down' || this.state === 'pinned' || this.state === 'ko'; }
  get canDefend() { return (this.state === 'idle' || this.state === 'toCorner' || this.state === 'awaitRunner') && this.frozenT <= 0; }
  get inRing() { return this.state !== 'apron' && this.state !== 'enter' && this.state !== 'exit'; }

  // derived combat numbers ------------------------------------------------------
  get strMul() { return 1 + (this.s.str - 10) * 0.028; }
  get tecMul() { return 1 + (this.s.tec - 10) * 0.028; }
  get speedRate() { return Math.min(1.45, 1 + (this.s.spd - 10) * 0.007) * (this.frozenT > 0 ? 0.55 : 1) * (this.rageT > 0 ? 1.12 : 1); }
  get walkSpeed() { return 1.7 * (1 + (this.s.spd - 10) * 0.006) * (this.frozenT > 0 ? 0.5 : 1); }
  get dodgeChance() { return Math.min(0.38, 0.05 + (this.s.agi - 10) * 0.0055); }
  get blockChance() { return Math.min(0.42, 0.13 + (this.s.def - 10) * 0.0055); }
  get defMul() { return (1 / (1 + (this.s.def - 10) * 0.012)) * (1 - (this.passive.ironSkin ?? 0)); }
  get critChance() { return Math.min(0.45, 0.04 + (this.s.crt - 10) * 0.005 + (this.passive.critBoost ?? 0)); }
  get meterMul() { return (1 + (this.s.cha - 10) * 0.02) * (1 + (this.passive.showman ?? 0)); }
  get staRegen() { return 7 + this.s.sta * 0.32; }
  get dmgMul() {
    let m = 1;
    if (this.rageT > 0) m *= 1.3;
    if (this.passive.berserk && this.hpPct < 0.3) m *= 1 + this.passive.berserk;
    if (this.stamina < 15) m *= 0.85;
    return m;
  }
  get thinkDelay() { return Math.max(0.12, 0.42 - this.s.spd * 0.003); }

  getUpTime() {
    const base = 1.5 + (1 - this.hpPct) * 1.9 - (this.s.res - 10) * 0.022;
    return Math.max(0.6, base * (1 - (this.passive.quickRecovery ?? 0)));
  }

  kickoutChance(count: number) {
    if (this.hp <= 0) return 0;
    const c = 0.22 + this.hpPct * 1.7 + (this.s.res - 10) * 0.012 - (count >= 2 ? 0.12 : 0);
    return Math.max(0.04, Math.min(0.985, c));
  }

  face(target: Vector3, dt: number, speed = 10) {
    const want = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * speed);
  }
  faceNow(target: Vector3) { this.yaw = Math.atan2(target.x - this.pos.x, target.z - this.pos.z); }

  forward(out: Vector3) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  setState(s: FState) { this.state = s; this.st = 0; }

  sync() {
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.yaw;
    // shadow follows hips projected on the canvas (or arena floor when outside)
    const hips = this.rig.body.getWorldPosition(TMP);
    this.shadow.position.set(hips.x, this.pos.y > 0.6 ? 0.012 : this.pos.y + 0.012, hips.z);
    const lift = Math.max(0, hips.y - 0.95 * this.rig.heightScale - (this.pos.y > 0.6 ? 0 : this.pos.y));
    const lying = this.grounded || this.state === 'getup' ? 1.5 : 1.05;
    this.shadow.scale.setScalar(lying / (1 + lift * 0.4));
    (this.shadow.material as MeshBasicMaterial).opacity = 0.55;
  }

  dispose() {
    this.rig.dispose();
    this.shadow.removeFromParent();
  }
}
const TMP = new Vector3();
