// ─────────────────────────────────────────────────────────────────────────────
//  Match controller: AI, move execution, hit resolution, grapples, the ropes,
//  top-rope dives, pins with a referee count, tag team, supers & cinematics.
// ─────────────────────────────────────────────────────────────────────────────
import { Vector3 } from 'three';
import { Animator } from '../char/animator';
import { Rig } from '../char/rig';
import { CORNERS, RING } from '../engine/arena';
import { sfx } from '../engine/audio';
import type { World } from '../engine/world';
import { CONSUMABLE, ITEM } from '../meta/data';
import { Fighter, FighterSpec } from './fighter';
import { AERIALS, C, COMBOS, GRAPPLES, HitDef, MOVES, MoveDef, PairKey, RUNNING, TAUNTS } from './moves';

export type MatchMode = '1v1' | 'tag' | 'boss';
export type Method = 'KO' | 'PIN' | 'DECISION';
export interface MatchSetup { mode: MatchMode; teams: FighterSpec[][]; bossId?: string }

export interface MatchResult {
  winner: 0 | 1;
  method: Method;
  mode: MatchMode;
  bossId?: string;
  duration: number;
  hpPct: number;
  stats: Fighter['stats'];
  usedConsumables: string[];
}

export type CalloutStyle = 'move' | 'special' | 'super' | 'big' | 'count' | 'info' | 'ko' | 'combo';
export interface MatchHooks {
  callout(text: string, style: CalloutStyle, team?: 0 | 1, color?: string): void;
  damage(pos: Vector3, amount: number, crit: boolean, team: 0 | 1): void;
  flash(color: string, strength: number): void;
  phase(p: Match['phase']): void;
  end(r: MatchResult): void;
}

const LIM = RING.half - 0.22;
const DEG = Math.PI / 180;
const V = () => new Vector3();
const t1 = V(), t2 = V(), t3 = V();
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const chance = (p: number) => Math.random() < p;
const pickOne = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const clampRing = (p: Vector3, lim = LIM) => { p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z)); };
const flatDist = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

interface Pin { att: Fighter; vic: Fighter; t: number; count: number; kickAt: number; saveAt: number; saved: boolean }

class Referee {
  rig: Rig;
  anim: Animator;
  pos = new Vector3(0, 0, 2.2);
  yaw = Math.PI;
  mode: 'roam' | 'count' | 'raise' | 'wave' = 'roam';
  constructor() {
    this.rig = new Rig({ name: 'Árbitro', skinTone: 1, height: 0.97, build: 0, eyes: 0, eyeColor: 1, brows: 3, mouth: 1, beard: 1, hair: 'rapado', hairColor: 6, skin: 'sk_preto' }, {
      referee: true,
      lookOverride: { primary: 0xf4f4f4, secondary: 0x111111, accent: 0x111111, top: 'singlet', pattern: 'stripes', gloves: 0xffffff, boots: 0x111111 },
    });
    this.anim = new Animator(this.rig);
    this.anim.base = 'relaxed';
  }
}

export class Match {
  fighters: Fighter[] = [];
  teams: Fighter[][] = [[], []];
  ref = new Referee();
  phase: 'intro' | 'fight' | 'finish' | 'done' = 'intro';
  time = 0;
  speed = 1;
  private timeScale = 1;
  private slowT = 0;
  private slowTarget = 1;
  private hitstop = 0;
  private pin: Pin | null = null;
  private introT = 0;
  private finishT = 0;
  private winner: 0 | 1 = 0;
  private method: Method = 'KO';
  private cineLock = 0;
  private usedConsumables: string[] = [];
  private tag: boolean;
  private lastCallout = '';
  private ended = false;
  private comboCount = [0, 0];
  private comboT = [0, 0];

  constructor(private w: World, public setup: MatchSetup, private hooks: MatchHooks) {
    this.tag = setup.mode === 'tag';
    const scene = w.gfx.scene;
    setup.teams.forEach((specs, ti) => {
      specs.forEach((spec, i) => {
        const f = new Fighter(spec, ti as 0 | 1);
        f.legal = i === 0;
        this.fighters.push(f);
        this.teams[ti].push(f);
        scene.add(f.rig.root, f.shadow);
      });
    });
    for (const team of this.teams) if (team.length > 1) { team[0].partner = team[1]; team[1].partner = team[0]; }
    scene.add(this.ref.rig.root);
    this.placeIntro();
    w.arena.setScreen(`${this.teams[0][0].name} vs ${this.teams[1][0].name}`, this.tag ? 'TAG TEAM' : setup.mode === 'boss' ? 'DESAFIO LENDÁRIO' : 'COMBATE PRINCIPAL');
    w.director.autoEnabled = false;
    w.director.set({ mode: 'orbit', dist: 7.5, height: 3.4, orbitSpeed: 0.35, cut: true, target: () => t3.set(0, 1, 0) });
    sfx.crowdStart();
    sfx.crowdCheer(0.8);
    w.arena.hype(0.6);
  }

  // ── setup ──────────────────────────────────────────────────────────────────
  private placeIntro() {
    const corners = [CORNERS.red, CORNERS.blue];
    this.teams.forEach((team, ti) => {
      const c = corners[ti];
      const sx = Math.sign(c.x), sz = Math.sign(c.z);
      team.forEach((f, i) => {
        f.corner.set(sx * (RING.half - 0.3), 0, sz * (RING.half - 0.3));
        // apron: just outside the ropes on the side face next to the corner
        f.apronSpot.set(sx * (RING.rope + 0.32), 0, sz * (RING.post - 0.62));
        if (i === 0) {
          f.pos.set(sx * 1.9, 0, sz * 1.9);
          f.setState('intro');
          f.anim.play(pickOne([C.flex, C.crowd, C.comeOn]), { at: rnd(0, 0.3) });
        } else {
          f.pos.copy(f.apronSpot);
          f.setState('apron');
          f.anim.base = 'relaxed';
          f.anim.play(C.apronIdle, { loop: true });
        }
        f.faceNow(t1.set(0, 0, 0));
        if (i > 0) f.yaw = Math.atan2(-sx, 0); // face into the ring
      });
    });
    this.ref.pos.set(2.2, 0, -1.6);
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  legal(team: 0 | 1) { return this.teams[team].find((f) => f.legal)!; }
  opp(f: Fighter) { return this.legal((1 - f.team) as 0 | 1); }

  private slow(scale: number, dur: number) { this.slowTarget = scale; this.slowT = dur; }
  private stop(t: number) { this.hitstop = Math.max(this.hitstop, t); }

  private say(text: string, style: CalloutStyle, team?: 0 | 1, color?: string) {
    if (style === 'move' && text === this.lastCallout) return;
    this.lastCallout = text;
    this.hooks.callout(text, style, team, color);
  }

  get focus() {
    const a = this.legal(0), b = this.legal(1);
    return t3.set((a.pos.x + b.pos.x) / 2, 0, (a.pos.z + b.pos.z) / 2);
  }

  setSpeed(s: number) { this.speed = s; }

  skip() {
    if (this.phase === 'finish') { this.finishT = 99; return; }
    this.speed = 6;
  }

  // ── main loop ──────────────────────────────────────────────────────────────
  update(realDt: number) {
    const d = this.w.director;
    // time scale easing
    if (this.slowT > 0) { this.slowT -= realDt; if (this.slowT <= 0) this.slowTarget = 1; }
    this.timeScale += (this.slowTarget - this.timeScale) * Math.min(1, realDt * 10);
    let dt = Math.min(realDt, 1 / 25) * this.timeScale * this.speed;
    if (this.hitstop > 0) { this.hitstop -= realDt; dt = 0; }

    if (this.phase === 'intro') this.updateIntro(realDt);
    else if (this.phase === 'fight') this.time += dt;
    else if (this.phase === 'finish') this.updateFinish(realDt);

    if (this.cineLock > 0) this.cineLock -= dt;
    for (let i = 0; i < 2; i++) { this.comboT[i] -= dt; if (this.comboT[i] <= 0) this.comboCount[i] = 0; }

    if (dt > 0) {
      for (const f of this.fighters) this.step(f, dt);
      this.separate();
      if (this.pin) this.updatePin(dt);
      this.updateRef(dt);
      if (this.phase === 'fight' && this.time > 210) this.decision();
    }
    for (const f of this.fighters) {
      f.anim.update(dt);
      f.rig.update(dt);
      f.sync();
      f.dispHp += (f.hp - f.dispHp) * Math.min(1, realDt * 2.2);
      this.auraFx(f, realDt);
    }
    this.ref.anim.update(dt);
    this.ref.rig.update(dt);
    this.ref.rig.root.position.copy(this.ref.pos);
    this.ref.rig.root.rotation.y = this.ref.yaw;

    d.focus.copy(this.focus);
    const a = this.legal(0), b = this.legal(1);
    d.spread = flatDist(a.pos, b.pos);
    this.w.fx.update(realDt * Math.max(0.25, this.timeScale));
    this.w.arena.update(realDt);
    d.update(realDt);
  }

  private auraFx(f: Fighter, dt: number) {
    if (!f.rig.root.parent) return;
    const fx = this.w.fx;
    if (f.aura !== undefined) fx.emit(f.rig.chestWorld(t1), f.aura, f.state === 'act' ? 26 : 12, dt, 0.32, 1.1, 0.1);
    if (f.hairFx) {
      const head = f.rig.headWorld(t2); head.y += 0.22 * f.rig.heightScale;
      const col = f.hairFx === 'fire' ? 0xff6a1f : f.hairFx === 'ice' ? 0xbfefff : f.hairFx === 'spark' ? 0xffe14d : f.hairFx === 'galaxy' ? 'rainbow' : 0x93c5fd;
      fx.emit(head, col, f.hairFx === 'fire' ? 30 : 10, dt, 0.1, f.hairFx === 'fire' ? 1.4 : 0.6, f.hairFx === 'fire' ? 0.13 : 0.06);
    }
    if (f.rageT > 0) fx.emit(f.rig.chestWorld(t1), 0xff3b1f, 20, dt, 0.35, 1.5, 0.12);
    if (f.frozenT > 0) fx.emit(f.rig.chestWorld(t1), 0xbfefff, 18, dt, 0.4, 0.4, 0.08);
  }

  // ── intro / finish ─────────────────────────────────────────────────────────
  private updateIntro(dt: number) {
    this.introT += dt;
    const d = this.w.director;
    const a = this.legal(0), b = this.legal(1);
    if (this.introT > 1.6 && this.introT - dt <= 1.6) d.set({ mode: 'close', target: () => a.rig.headWorld(t1), facing: () => a.yaw, dist: 2.4, angle: 0.4, height: 0.05, cut: true, fov: 38 });
    if (this.introT > 2.8 && this.introT - dt <= 2.8) d.set({ mode: 'close', target: () => b.rig.headWorld(t1), facing: () => b.yaw, dist: 2.4, angle: -0.4, height: 0.05, cut: true, fov: 38 });
    if (this.introT > 4.0) {
      this.phase = 'fight';
      this.hooks.phase('fight');
      for (const f of [a, b]) { f.setState('idle'); f.anim.stop(0.2); f.thinkT = rnd(0.2, 0.6); }
      sfx.bell(1);
      sfx.crowdCheer(1);
      this.w.arena.hype(0.8);
      this.say('LUTA!', 'big');
      d.autoEnabled = true;
      d.neutral(true);
    }
  }

  private finish(winner: 0 | 1, method: Method) {
    if (this.phase !== 'fight') return;
    this.phase = 'finish';
    this.winner = winner;
    this.method = method;
    this.finishT = 0;
    this.hooks.phase('finish');
    this.w.director.autoEnabled = false;
    sfx.bell(3);
    sfx.crowdCheer(1);
    this.w.arena.hype(1);
    const loser = this.legal((1 - winner) as 0 | 1);
    if (method === 'KO') {
      this.slow(0.25, 1.4);
      this.say('K.O.!', 'ko');
      this.w.director.set({ mode: 'close', target: () => loser.rig.chestWorld(t1), facing: () => loser.yaw + Math.PI / 2, dist: 3.4, height: 1.6, cut: true, fov: 40 });
      this.ref.mode = 'wave';
      this.ref.anim.play(C.refWave, { loop: true });
    } else if (method === 'PIN') {
      this.say('VITÓRIA POR PINFALL!', 'ko');
    } else {
      this.say('DECISÃO DOS JUÍZES!', 'ko');
    }
  }

  private decision() {
    const a = this.legal(0), b = this.legal(1);
    this.finish(a.hpPct >= b.hpPct ? 0 : 1, 'DECISION');
  }

  private updateFinish(dt: number) {
    this.finishT += dt;
    const winners = this.teams[this.winner];
    const losers = this.teams[1 - this.winner];
    if (this.finishT > 1.6 && this.finishT - dt <= 1.6 || this.finishT > 99 && this.finishT - dt < 99) {
      // celebration
      this.pin = null;
      for (const f of losers) if (f.state !== 'ko' && f.state !== 'apron') { f.setState('down'); f.downT = 99; f.anim.play(f.downFace ? C.fallFace : C.fallBack, { hold: true, at: 0.6 }); }
      const center = this.legal(this.winner);
      winners.forEach((f, i) => {
        if (f.state === 'apron') { f.pos.set(center.pos.x + 1.1, 0, center.pos.z); clampRing(f.pos); }
        f.setState('celebrate');
        f.anim.play(C.victory, { hold: true, at: i * 0.2 });
        f.faceNow(t1.set(0, 0, 6));
      });
      this.ref.mode = 'raise';
      this.ref.pos.copy(center.pos).add(t1.set(-0.75, 0, 0.1));
      clampRing(this.ref.pos);
      this.ref.yaw = 0;
      this.ref.anim.play(C.refRaise, { hold: true });
      this.w.fx.confetti(new Vector3(0, 0, 0), 220);
      this.w.director.set({ mode: 'orbit', target: () => t2.set(center.pos.x, 1.2, center.pos.z), dist: 4.6, height: 2, orbitSpeed: 0.4, cut: true, angle: 0.2 });
      sfx.crowdCheer(1);
      this.w.arena.setScreen(`${center.name}`, 'VENCEDOR');
    }
    if (this.finishT > 6.5 && !this.ended) {
      this.ended = true;
      this.phase = 'done';
      const team0 = this.teams[0];
      const stats = { ...team0[0].stats };
      if (team0[1]) for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] += team0[1].stats[k];
      this.hooks.end({
        winner: this.winner, method: this.method, mode: this.setup.mode, bossId: this.setup.bossId,
        duration: this.time, hpPct: Math.max(...team0.map((f) => f.hpPct)), stats, usedConsumables: this.usedConsumables,
      });
    }
  }

  // ── per-fighter state machine ──────────────────────────────────────────────
  private step(f: Fighter, dt: number) {
    f.st += dt;
    f.invuln -= dt;
    f.potionCd -= dt;
    f.tagCd -= dt;
    if (f.rageT > 0) f.rageT -= dt;
    if (f.frozenT > 0) f.frozenT -= dt;
    if (this.phase === 'fight' && f.inRing && f.state !== 'act') f.stamina = Math.min(100, f.stamina + f.staRegen * dt * (f.state === 'down' ? 0.6 : 1));
    f.anim.fwd = 0; f.anim.side = 0;
    f.anim.speedMul = f.speedRate;

    switch (f.state) {
      case 'intro': case 'celebrate': case 'ko': break;
      case 'idle': this.idle(f, dt); break;
      case 'act': this.stepAct(f, dt); break;
      case 'react': if (f.st > 0.36 / f.speedRate) { f.setState('idle'); f.thinkT = rnd(0.05, 0.25); } this.knockback(f, dt); break;
      case 'stunned': break;
      case 'down':
        this.knockback(f, dt);
        if (this.phase !== 'fight') break;
        f.downT -= dt;
        if (f.downT <= 0 && f.hp > 0) this.getUp(f);
        break;
      case 'getup': if (!f.anim.playing) { f.setState('idle'); f.invuln = 0.4; f.anim.base = f.stamina < 25 ? 'tired' : 'guard'; f.thinkT = rnd(0.1, 0.3); } break;
      case 'grabbed': break; // driven by holder
      case 'air': this.stepAir(f, dt); break;
      case 'running': this.stepRunning(f, dt); break;
      case 'awaitRunner': this.stepAwait(f, dt); break;
      case 'toCorner': this.stepToCorner(f, dt); break;
      case 'tag': if (f.st > 0.35) this.doTagSwap(f); break;
      case 'climb': this.stepClimb(f, dt); break;
      case 'perch': this.stepPerch(f, dt); break;
      case 'leap': this.stepLeap(f, dt); break;
      case 'apron': this.stepApron(f, dt); break;
      case 'enter': case 'exit': this.stepRopeHop(f, dt); break;
      case 'save': this.stepSave(f, dt); break;
      case 'pinning': case 'pinned': break;
    }
  }

  private knockback(f: Fighter, dt: number) {
    if (f.vel.lengthSq() < 1e-4) return;
    f.pos.addScaledVector(f.vel, dt);
    f.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
    if (Math.abs(f.pos.x) > LIM) { f.pos.x = Math.sign(f.pos.x) * LIM; f.vel.x *= -0.4; }
    if (Math.abs(f.pos.z) > LIM) { f.pos.z = Math.sign(f.pos.z) * LIM; f.vel.z *= -0.4; }
  }

  private idle(f: Fighter, dt: number) {
    if (this.phase !== 'fight') return;
    const o = this.opp(f);
    const d = flatDist(f.pos, o.pos);
    const targetPos = o.grounded ? o.rig.body.getWorldPosition(t1) : o.pos;
    f.face(targetPos, dt, 8);
    f.anim.base = f.stamina < 22 ? 'tired' : 'guard';
    this.knockback(f, dt);
    // locomotion
    const want = o.grounded ? 0.95 : 1.0;
    const dd = flatDist(f.pos, targetPos);
    if (o.inRing && dd > want + 0.08 && o.state !== 'running' && o.state !== 'air') {
      const sp = f.walkSpeed * (dd > 2.5 ? 1.35 : 1);
      t2.copy(targetPos).sub(f.pos).setY(0).normalize();
      f.pos.addScaledVector(t2, sp * dt);
      f.anim.fwd = sp;
    } else if (!o.grounded && d < 0.78) {
      f.forward(t2);
      f.pos.addScaledVector(t2, -1.2 * dt);
      f.anim.fwd = -1;
    } else if (o.state === 'act' || o.state === 'react' || f.st % 3 < 1) {
      // circle a little while waiting
      const dir = f.team === 0 ? 1 : -1;
      f.forward(t2);
      f.pos.x += t2.z * dir * 0.5 * dt;
      f.pos.z += -t2.x * dir * 0.5 * dt;
      f.anim.side = 0.5;
    }
    clampRing(f.pos);
    f.thinkT -= dt;
    if (f.thinkT <= 0 && this.cineLock <= 0) {
      f.thinkT = f.thinkDelay * rnd(0.7, 1.5);
      this.decide(f, o, d);
    }
  }

  // ── AI ─────────────────────────────────────────────────────────────────────
  private decide(f: Fighter, o: Fighter, d: number) {
    if (this.tryConsumable(f, o)) return;
    // tag out
    if (this.tag && f.partner && f.partner.state === 'apron' && f.tagCd <= 0 && f.hpPct < 0.5 && f.partner.hpPct > f.hpPct + 0.12 && chance(0.45)) {
      f.setState('toCorner');
      return;
    }
    if (o.grounded) {
      if (o.state !== 'down') return;
      const nearCorner = this.nearestCorner(f.pos);
      if (d < 1.6 && (o.hp <= 0 || (((o.hpPct < 0.35 && chance(0.45)) || (o.hpPct < 0.55 && chance(0.12))) && o.downT > 0.6))) { this.startPin(f, o); return; }
      if (f.groundActs < 1 && o.downT > 1.5 && flatDist(f.pos, nearCorner) < 2.6 && chance(0.28 + (f.s.agi - 10) * 0.004) && f.stamina > 30) { this.startClimb(f, nearCorner); return; }
      if (d < 1.15 && f.groundActs < 2 && chance(0.7)) {
        f.groundActs++;
        this.startMove(f, MOVES[pickOne(['stomp', 'stomp', 'elbowdrop', 'legdrop'])], o);
        return;
      }
      if (chance(0.3)) { this.startMove(f, MOVES[pickOne(TAUNTS)], o); return; }
      return;
    }
    if (!o.standing || o.state === 'grabbed') return;
    if (d > 1.2) return; // keep approaching
    // tired: catch breath
    if (f.stamina < 18 && chance(0.6)) { f.anim.play(C.tired); f.setState('react'); f.st = -0.9; return; }
    // super!
    const sup = f.spec.super ? ITEM[f.spec.super] : null;
    if (sup && f.meter >= 100 && chance(0.65)) { this.startMove(f, MOVES[sup.move!], o); return; }
    // specials
    const specials = f.spec.specials.map((id) => ITEM[id]).filter((it) => it && f.meter >= (it.cost ?? 50));
    if (specials.length && this.time - f.lastSpecial > 5 && chance(0.4)) {
      const sp = pickOne(specials);
      this.startMove(f, MOVES[sp.move!], o);
      return;
    }
    if (flatDist(o.pos, this.nearestCorner(o.pos)) < 1.25 && chance(0.3)) { this.startMove(f, MOVES.cornerpunch, o); return; }
    const tecBias = 1 + (f.s.tec - f.s.str) * 0.02;
    const r = Math.random();
    const pG = 0.22 * Math.max(0.5, Math.min(1.8, tecBias));
    if (r < pG) { this.startMove(f, MOVES[pickOne(GRAPPLES.filter((g) => g !== 'powerbomb' || f.s.str > 14 || chance(0.4)))], o); return; }
    if (r < pG + 0.08) { this.startMove(f, MOVES.whip, o); return; }
    if (r < pG + 0.11 && f.hpPct > o.hpPct + 0.15) { this.startMove(f, MOVES[pickOne(TAUNTS)], o); return; }
    if (r < pG + 0.18) { f.forward(t2); f.vel.addScaledVector(t2, -2.5); f.thinkT = 0.35; return; }
    f.combo = [...pickOne(COMBOS)];
    this.startMove(f, MOVES[f.combo.shift()!], o);
  }

  private nearestCorner(p: Vector3) {
    const cx = p.x >= 0 ? 1 : -1, cz = p.z >= 0 ? 1 : -1;
    return t2.set(cx * (RING.half - 0.25), 0, cz * (RING.half - 0.25)).clone();
  }

  private tryConsumable(f: Fighter, o: Fighter): boolean {
    if (f.potionCd > 0 || !f.consumables.length) return false;
    const idx = f.consumables.findIndex((id) => {
      const c = CONSUMABLE[id];
      if (!c) return false;
      switch (c.effect) {
        case 'heal': return f.hpPct < 0.35;
        case 'elixir': return f.hpPct < 0.3;
        case 'meter': return f.meter < 45 && (f.hpPct < 0.65 || o.hpPct < 0.5);
        case 'rage': return o.hpPct < 0.55 || f.hpPct < 0.5;
        case 'shield': return f.hpPct < 0.55;
      }
    });
    if (idx < 0) return false;
    const id = f.consumables.splice(idx, 1)[0];
    const c = CONSUMABLE[id];
    f.potionCd = 6;
    f.stats.potions++;
    if (f.spec.isPlayer) this.usedConsumables.push(id);
    const p = f.rig.chestWorld(t1);
    switch (c.effect) {
      case 'heal': f.hp = Math.min(f.maxHp, f.hp + f.maxHp * c.value); this.w.fx.burst(p, 'toxic', 0.6); break;
      case 'elixir': f.hp = Math.min(f.maxHp, f.hp + f.maxHp * c.value); f.meter = 100; this.w.fx.burst(p, 'cosmic', 1); break;
      case 'meter': f.meter = Math.min(100, f.meter + c.value); this.w.fx.burst(p, 'gold', 0.7); break;
      case 'rage': f.rageT = 12; this.w.fx.burst(p, 'fire', 0.8); break;
      case 'shield': f.shield = c.value; this.w.fx.shock(f.pos, 0x38bdf8, 1.6, 0.5); break;
    }
    this.w.fx.pillar(f.pos, parseInt(c.color.slice(1), 16), 0.6, 2.4, 0.7, 0.5);
    sfx.ui('claim');
    this.say(c.name.toUpperCase() + '!', 'special', f.team, c.color);
    f.anim.play(C.flex, { rate: 1.6 });
    f.setState('react');
    f.st = -0.4;
    return true;
  }

  // ── moves ──────────────────────────────────────────────────────────────────
  startMove(f: Fighter, m: MoveDef, o: Fighter) {
    if (!m) return;
    // grapple reversal
    if (m.grapple && m.kind === 'grapple' && o.canDefend && m.id !== 'armdrag') {
      const rev = Math.max(0.03, Math.min(0.28, 0.08 + (o.s.tec - f.s.tec) * 0.008 + (o.passive.counter ?? 0) * 0.5));
      if (chance(rev)) {
        this.say('REVERSÃO!', 'special', o.team, '#22d3ee');
        sfx.crowdGasp();
        this.startMove(o, MOVES.armdrag, f);
        return;
      }
    }
    f.move = m;
    f.mt = 0;
    f.hitIdx = 0;
    f.target = o;
    f.rate = m.kind === 'strike' || m.kind === 'corner' ? f.speedRate * (f.stamina < 20 ? 0.85 : 1) : m.kind === 'super' ? 1 : Math.min(1.2, f.speedRate);
    f.stamina = Math.max(0, f.stamina - m.stamina);
    f.setState('act');
    f.anim.play(m.clip, { rate: f.rate, hold: !!m.attackerDown || !!m.pair || m.kind === 'super', fade: m.kind === 'strike' ? 0.05 : 0.1 });
    if (m.kind === 'grapple' || m.kind === 'special' && m.pair) f.stats.grapples++;
    if (m.pair || m.kind === 'whip') {
      o.move = null;
      o.combo.length = 0;
    }
    if (m.kind === 'whip') {
      o.setState('grabbed');
      o.holder = f;
      o.vel.set(0, 0, 0);
      o.anim.play(C.hitBody, { rate: 0.6 });
    }
    if (m.pair) {
      o.setState('grabbed');
      o.holder = f;
      o.vel.set(0, 0, 0);
      o.anim.play(m.pair.clip, { rate: 0, hold: true, fade: 0.12 });
      this.pairUpdate(f, o, 0);
    }
    if (m.kind !== 'strike' && m.kind !== 'ground' && m.kind !== 'corner' && m.kind !== 'taunt') this.say(m.name.toUpperCase(), m.kind === 'special' ? 'special' : m.kind === 'super' ? 'super' : 'move', f.team);
    if (m.kind === 'taunt') { sfx.crowdCheer(0.5); this.w.arena.hype(0.3); f.meter = Math.min(100, f.meter + 12 * f.meterMul); }
    if (m.kind === 'special') this.beginSpecial(f, o, m);
    if (m.kind === 'super') this.beginSuper(f, o, m);
    if (m.kind === 'grapple' && chance(0.45)) {
      this.w.director.set({ mode: 'side', angle: f.yaw + Math.PI / 2 * (chance(0.5) ? 1 : -1), dist: 5, height: 1.7, hold: m.clip.dur + 0.6, cut: true });
    }
    if (m.kind === 'strike' || m.kind === 'running') sfx.whoosh(m.hits[0]?.power ?? 0.3);
  }

  private beginSpecial(f: Fighter, o: Fighter, m: MoveDef) {
    const item = f.spec.specials.map((id) => ITEM[id]).find((it) => it?.move === m.id);
    f.meter = Math.max(0, f.meter - (item?.cost ?? 50));
    f.lastSpecial = this.time;
    f.stats.specials++;
    this.cineLock = 0.2;
    const d = this.w.director;
    d.set({ mode: 'close', target: () => f.rig.chestWorld(t1), facing: () => f.yaw, dist: 2.8, angle: 0.7, height: 0.35, cut: true, hold: 0.5, fov: 40 });
    setTimeout(() => { if (this.phase === 'fight') d.set({ mode: 'side', angle: f.yaw + Math.PI / 2, dist: 5.4, height: 1.6, hold: Math.max(0.6, m.clip.dur - 0.4), cut: true }); }, 380);
    this.w.arena.setDim(0.25);
    setTimeout(() => this.w.arena.setDim(0), 1400);
    this.w.fx.burst(f.rig.chestWorld(t1), m.fx ?? 'spark', 0.9);
    this.w.fx.shock(f.pos, 0xffffff, 1.8, 0.4, 0.6);
    sfx.superCharge(0.5);
    this.w.arena.hype(0.4);
    if (m.id === 'boltkick') sfx.zap();
  }

  private beginSuper(f: Fighter, o: Fighter, m: MoveDef) {
    f.meter = 0;
    f.stats.supers++;
    this.cineLock = 0.5;
    if (!m.pair) { o.setState('stunned'); o.vel.set(0, 0, 0); o.anim.play(C.tired, { hold: true, rate: 0.6 }); }
    o.invuln = 0;
    this.w.arena.setDim(0.6);
    this.slow(0.8, 1.2);
    const d = this.w.director;
    d.autoEnabled = false;
    d.set({ mode: 'close', target: () => f.rig.headWorld(t1), facing: () => f.yaw, dist: 2.2, angle: 0.25, height: 0.0, cut: true, fov: 36 });
    this.hooks.flash('#ffffff', 0.5);
    sfx.superCharge(1.4);
    sfx.crowdCheer(0.9);
    this.w.arena.hype(1);
    const col = m.fx === 'fire' ? 0xff5a1f : m.fx === 'cosmic' ? 0xb07bff : m.fx === 'spark' ? 0x7dd3fc : 0xffd23f;
    this.w.fx.pillar(f.pos, col, 0.9, 6, 1.4, 0.55);
    this.w.fx.shock(f.pos, col, 3, 0.6);
    const shotChange = Math.min(1.2, m.hits[0].at * 0.7);
    setTimeout(() => {
      if (this.phase !== 'fight') return;
      if (m.id === 'sup_meteor') d.set({ mode: 'low', angle: f.yaw + 2.6, dist: 5, height: 0.6, cut: true });
      else d.set({ mode: 'side', angle: f.yaw + Math.PI / 2, dist: 5.6, height: 1.5, cut: true, fov: 44 });
    }, shotChange * 1000);
  }

  private endCine() {
    this.w.arena.setDim(0);
    if (this.phase === 'fight') { this.w.director.autoEnabled = true; }
  }

  private stepAct(f: Fighter, dt: number) {
    const m = f.move!;
    const o = f.target!;
    const prev = f.mt;
    f.mt += dt * f.rate;
    // root motion
    if (m.root) {
      const a = sampleRoot(m.root, prev), b = sampleRoot(m.root, f.mt);
      if (b !== a) {
        f.forward(t1);
        let delta = b - a;
        // never run through a standing opponent
        if (o.standing && !m.pair) { const gap = flatDist(f.pos, o.pos) - 0.72; delta = Math.min(delta, Math.max(0, gap)); }
        f.pos.addScaledVector(t1, delta);
        clampRing(f.pos);
      }
    }
    // face target while winding up
    if (f.mt < (m.hits[0]?.at ?? 0.3) && o.inRing && !m.pair && m.kind !== 'aerial') f.face(o.grounded ? o.rig.body.getWorldPosition(t1) : o.pos, dt, 10);
    this.superScript(f, o, m, prev, f.mt, dt);
    if (m.pair && o.state === 'grabbed' && o.holder === f) this.pairUpdate(f, o, f.mt);
    // hits
    while (f.hitIdx < m.hits.length && f.mt >= m.hits[f.hitIdx].at) {
      const h = m.hits[f.hitIdx++];
      this.resolveHit(f, o, h, m);
      if (f.state !== 'act' || f.move !== m) return; // interrupted
    }
    // whip release
    if (m.kind === 'whip' && prev < 0.38 && f.mt >= 0.38 && o.state === 'grabbed') this.releaseWhip(f, o);
    // combo chaining (cancel recovery)
    const cancelAt = m.kind === 'strike' && m.hits.length ? m.hits[m.hits.length - 1].at + 0.1 : Infinity;
    if (f.combo.length && f.mt >= cancelAt && o.standing && o.state !== 'grabbed' && flatDist(f.pos, o.pos) < 1.3) {
      const next = MOVES[f.combo.shift()!];
      this.startMove(f, next, o);
      return;
    }
    if (f.mt >= m.clip.dur) this.endMove(f, o, m);
  }

  private endMove(f: Fighter, o: Fighter, m: MoveDef) {
    f.move = null;
    f.combo.length = 0;
    if (m.pair && o.state === 'grabbed' && o.holder === f) {
      o.holder = null;
      if (m.pair.end === 'stand') { o.setState('react'); o.st = -0.6; o.anim.play(C.tired, { rate: 1.6 }); }
      else this.knockDown(o, m.pair.end === 'face', 0, false);
      if (o.hp <= 0 && (m.kind === 'special' || m.kind === 'super')) { o.setState('ko'); o.downT = 99; this.finish(f.team, 'KO'); }
    }
    if (m.kind === 'super' || m.kind === 'special') this.endCine();
    if (o.state === 'stunned') { o.setState('idle'); o.anim.stop(0.2); }
    if (m.kind === 'whip' && o.state === 'grabbed' && o.holder === f) { o.holder = null; o.setState('idle'); }
    if (m.attackerDown) {
      f.setState('down');
      f.downFace = m.attackerDown === 'face';
      f.downT = m.kind === 'aerial' ? 0.7 : 0.35;
      f.pos.y = 0;
      return;
    }
    if (m.kind === 'whip') { f.setState('awaitRunner'); return; }
    f.pos.y = 0;
    f.setState('idle');
    f.anim.stop(0.12);
    f.thinkT = rnd(0.05, 0.25) * (m.kind === 'strike' ? 1 : 1.6);
  }

  private pairUpdate(f: Fighter, o: Fighter, t: number) {
    const track = f.move!.pair!.track;
    const k = sampleTrack(track, t);
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    o.pos.set(f.pos.x + k.x * c + k.z * s, f.pos.y + k.y, f.pos.z - k.x * s + k.z * c);
    o.yaw = f.yaw + k.yaw * DEG;
    o.anim.clipT = t;
  }

  // ── hit resolution ─────────────────────────────────────────────────────────
  private srcPos(f: Fighter, o: Fighter, h: HitDef, out: Vector3) {
    switch (h.src) {
      case 'lh': return f.rig.handWorld(0, out);
      case 'rh': return f.rig.handWorld(1, out);
      case 'lf': return f.rig.footWorld(0, out);
      case 'rf': return f.rig.footWorld(1, out);
      case 'head': return f.rig.headWorld(out);
      default: return o.rig.chestWorld(out);
    }
  }

  private resolveHit(f: Fighter, o: Fighter, h: HitDef, m: MoveDef) {
    if (!o.inRing || o.state === 'ko') return;
    const fx = this.w.fx;
    const standingMove = m.kind === 'strike' || m.kind === 'special' && !m.pair || m.kind === 'running' || m.kind === 'corner' || m.kind === 'super' && !m.pair;
    // whiff checks
    if (standingMove && !h.unblockable && (o.grounded || o.state === 'air')) return;
    if (standingMove && m.kind !== 'super' && flatDist(f.pos, o.pos) > m.range + 0.5) { sfx.whoosh(0.3); return; }
    if (m.kind === 'ground' && !o.grounded) return;
    if (o.invuln > 0 && !h.unblockable) return;

    // defence
    if (!h.unblockable && o.canDefend) {
      const dodge = o.dodgeChance - (f.s.spd - 10) * 0.003;
      if (chance(Math.max(0.02, dodge))) {
        o.anim.play(pickOne([C.slipL, C.duck, C.sway]), { rate: o.speedRate });
        o.setState('react'); o.st = 0.05;
        o.stats.dodges++;
        sfx.whoosh(0.4);
        if (chance(0.3)) this.say('ESQUIVA!', 'move', o.team, '#4ade80');
        f.combo.length = 0;
        // counter-attack
        if (chance(0.22 + (o.passive.counter ?? 0))) { o.thinkT = 0; o.combo = ['cross', 'hook']; setTimeout(() => { if (o.state === 'react' || o.state === 'idle') this.startMove(o, MOVES.cross, f); }, 120); }
        return;
      }
      if (chance(o.blockChance)) {
        o.anim.play(C.block, { rate: o.speedRate });
        o.setState('react'); o.st = 0.1;
        o.stats.blocks++;
        const chip = h.dmg * 0.15 * f.strMul;
        this.damage(f, o, chip, false, h, true);
        fx.block(this.srcPos(f, o, h, t1));
        sfx.hit('block');
        o.vel.copy(f.forward(t2)).multiplyScalar(0.8);
        if (chance(0.25)) this.say('BLOQUEIO!', 'move', o.team, '#38bdf8');
        if (chance(o.passive.counter ?? 0)) { o.combo = ['hook']; setTimeout(() => { if (o.state === 'react' || o.state === 'idle') this.startMove(o, MOVES.upper, f); }, 150); }
        f.combo.length = Math.min(f.combo.length, 1);
        return;
      }
    }
    if (o.shield > 0 && !(m.kind === 'super')) {
      o.shield--;
      fx.shock(o.rig.chestWorld(t1), 0x38bdf8, 1.4, 0.3);
      sfx.hit('block');
      this.say('ESCUDO!', 'move', o.team, '#38bdf8');
      return;
    }

    // interrupt: hitting someone mid-attack is a counter hit
    const counterHit = o.state === 'act' && o.move?.kind === 'strike' && o.mt < (o.move.hits[0]?.at ?? 0);
    const crit = chance(f.critChance) || counterHit && chance(0.5);
    const statMul = m.grapple || m.kind === 'ground' || m.kind === 'aerial' ? f.tecMul : f.strMul;
    let dmg = h.dmg * 1.15 * statMul * f.dmgMul * o.defMul * (crit ? 1.6 : 1) * (counterHit ? 1.2 : 1) * rnd(0.9, 1.1);
    if (m.kind === 'super') dmg *= 1 + (f.level - 1) * 0.01;
    dmg = Math.max(1, Math.round(dmg));
    const pos = this.srcPos(f, o, h, t1).clone();
    this.damage(f, o, dmg, crit, h, false, pos);
    if (counterHit) { this.say('CONTRA-ATAQUE!', 'move', f.team, '#ffd23f'); o.move = null; }

    // feel
    const pw = Math.min(1, h.power + (crit ? 0.2 : 0));
    fx.hit(pos, pw, h.fx === 'fire' ? 0xff7a1f : h.fx === 'ice' ? 0x9fe8ff : h.fx === 'cosmic' ? 0xd8b4fe : h.fx === 'shadow' ? 0xa78bfa : 0xffe7a0);
    if (h.fx) fx.burst(pos, h.fx, 0.5 + pw * 0.8);
    if (h.sfx === 'slam') fx.slam(o.rig.chestWorld(t2), pw);
    this.stop(0.03 + pw * 0.07 + (crit ? 0.04 : 0));
    this.w.director.shake(pw * 0.7);
    this.w.director.kick(pw * 4);
    sfx.hit(h.sfx ?? 'punch', pw);
    o.rig.flash(0.8);
    o.rig.hurt();
    if (crit) { this.say('CRÍTICO!', 'move', f.team, '#ff4d8d'); sfx.crowdGasp(); }
    if (h.sfx === 'chop' && chance(0.7)) { sfx.crowdChant(1); this.say('WOOO!', 'info'); }
    if (pw > 0.75) { sfx.crowdCheer(pw * 0.7); this.w.arena.hype(pw * 0.35); if (navigator.vibrate && f.spec.isPlayer !== undefined) try { navigator.vibrate(pw > 0.9 ? 40 : 15); } catch { /* */ } }
    // combos
    this.comboCount[f.team]++;
    this.comboT[f.team] = 1.1;
    if (this.comboCount[f.team] >= 4 && this.comboCount[f.team] % 2 === 0) this.say(`${this.comboCount[f.team]} COMBO`, 'combo', f.team);

    // death / reactions
    if (o.hp <= 0) {
      if (o.passive.phoenix && !o.phoenixUsed) {
        o.phoenixUsed = true;
        o.hp = Math.round(o.maxHp * o.passive.phoenix);
        fx.burst(o.rig.chestWorld(t1), 'fire', 2);
        fx.pillar(o.pos, 0xff7a1f, 1, 5, 1.2, 0.7);
        this.say('ALMA DE FÉNIX!', 'special', o.team, '#ff7a1f');
        sfx.boom();
      } else {
        o.hp = 0;
        const koMove = m.kind === 'strike' || m.kind === 'special' || m.kind === 'super' || m.kind === 'running' || m.kind === 'corner';
        if (o.state === 'grabbed') {
          // resolved when the hold ends (endMove)
        } else if (koMove || o.state !== 'down') {
          this.applyReaction(f, o, { ...h, react: h.react === 'none' || h.react === 'head' || h.react === 'headR' || h.react === 'body' ? 'knockBack' : h.react }, true);
          const airborne = (o.state as string) === 'air';
          if (!airborne) { o.setState('ko'); o.downT = 99; }
          this.finish(f.team, 'KO');
          return;
        }
        // grounded at 0 HP: they can't kick out of the next pin
      }
    }
    if (o.passive.secondWind && !o.secondWindUsed && o.hp > 0 && o.hpPct < 0.25) {
      o.secondWindUsed = true;
      o.hp += o.maxHp * o.passive.secondWind;
      this.say('SEGUNDO FÔLEGO!', 'special', o.team, '#2dd4bf');
      fx.burst(o.rig.chestWorld(t1), 'toxic', 1);
    }
    this.applyReaction(f, o, h, false);
  }

  private damage(f: Fighter, o: Fighter, dmg: number, crit: boolean, h: HitDef, blocked: boolean, pos?: Vector3) {
    o.hp -= dmg;
    f.stats.dmg += dmg;
    if (!blocked) { f.stats.hits++; if (crit) f.stats.crits++; }
    f.meter = Math.min(100, f.meter + dmg * (blocked ? 0.4 : 0.85) * f.meterMul);
    o.meter = Math.min(100, o.meter + dmg * 0.45 * o.meterMul);
    if (f.passive.vampire && !blocked) f.hp = Math.min(f.maxHp, f.hp + dmg * f.passive.vampire);
    if (o.passive.thorns && !blocked) f.hp = Math.max(1, f.hp - dmg * o.passive.thorns);
    if (!blocked && pos) this.hooks.damage(pos, dmg, crit, f.team);
    void h;
  }

  private applyReaction(f: Fighter, o: Fighter, h: HitDef, forced: boolean) {
    if (o.state === 'grabbed' || o.state === 'pinned') return;
    if (o.grounded && !forced) {
      // ground hit: small bounce
      o.rig.flash(1);
      if (o.state === 'down') o.downT = Math.max(o.downT, 0.6);
      return;
    }
    f.forward(t1);
    const push = h.push ?? 0.6;
    switch (h.react) {
      case 'none': return;
      case 'knockBack': this.knockDown(o, false, push, true, t1); return;
      case 'knockFace': this.knockDown(o, true, push, true, t1); return;
      case 'launch': {
        o.setState('air');
        o.vy = h.vy ?? 6;
        o.vel.copy(t1).multiplyScalar(push);
        o.anim.play(C.airborne, { hold: true });
        o.faceNow(t2.copy(f.pos));
        return;
      }
      default: {
        o.setState('react');
        o.move = null;
        o.combo.length = 0;
        o.anim.play(h.react === 'head' ? C.hitHead : h.react === 'headR' ? C.hitHeadR : h.react === 'body' ? C.hitBody : h.react === 'spin' ? C.hitSpin : C.stagger, { rate: 1 });
        o.vel.copy(t1).multiplyScalar(push);
        if (h.react === 'stagger' || h.react === 'spin') o.st = -0.3;
      }
    }
  }

  private knockDown(o: Fighter, face: boolean, push: number, play: boolean, dir?: Vector3) {
    o.setState('down');
    o.move = null;
    o.combo.length = 0;
    o.downFace = face;
    o.downT = o.getUpTime();
    o.pos.y = 0;
    if (dir) o.vel.copy(dir).multiplyScalar(push);
    if (play) o.anim.play(face ? C.fallFace : C.fallBack, { hold: true });
    if (play) setTimeout(() => { if (o.state === 'down') { this.w.fx.slam(o.rig.chestWorld(t1), 0.5); sfx.hit('slam', 0.4); } }, 420);
    // the attacker gets a fresh ground-game budget
    this.opp(o).groundActs = 0;
  }

  private getUp(f: Fighter) {
    f.setState('getup');
    f.vel.set(0, 0, 0);
    const kip = !f.downFace && f.hpPct > 0.55 && f.s.agi > 16 && chance(0.35);
    f.anim.play(kip ? C.kipUp : f.downFace ? C.getUpFace : C.getUp, { rate: f.speedRate * (kip ? 1 : 1.1) });
    if (kip) { this.say('KIP-UP!', 'move', f.team, '#4ade80'); sfx.crowdCheer(0.4); }
    // getting up from face-down: rotate so we face the way the body lay
  }

  // ── airborne victims ───────────────────────────────────────────────────────
  private stepAir(f: Fighter, dt: number) {
    f.vy -= 16 * dt;
    f.pos.y += f.vy * dt;
    f.pos.addScaledVector(f.vel, dt);
    if (Math.abs(f.pos.x) > LIM) { f.pos.x = Math.sign(f.pos.x) * LIM; f.vel.x *= -0.5; this.w.director.shake(0.3); sfx.hit('slam', 0.3); }
    if (Math.abs(f.pos.z) > LIM) { f.pos.z = Math.sign(f.pos.z) * LIM; f.vel.z *= -0.5; this.w.director.shake(0.3); sfx.hit('slam', 0.3); }
    if (f.pos.y <= 0 && f.vy < 0) {
      f.pos.y = 0;
      f.vel.multiplyScalar(0.3);
      this.w.fx.slam(f.rig.chestWorld(t1), 0.8);
      sfx.hit('slam', 0.8);
      this.w.director.shake(0.6);
      if (f.hp <= 0 && this.phase !== 'fight') { f.setState('ko'); f.anim.play(C.fallBack, { hold: true, at: 0.4 }); return; }
      this.knockDown(f, false, 0, false);
      f.anim.play(C.fallBack, { hold: true, at: 0.42 });
      if (f.hp <= 0) f.setState('ko');
    }
  }

  // ── irish whip & running attacks ───────────────────────────────────────────
  private releaseWhip(f: Fighter, o: Fighter) {
    o.holder = null;
    o.setState('running');
    f.forward(o.runDir);
    o.yaw = Math.atan2(o.runDir.x, o.runDir.z);
    o.runBounced = false;
    o.anim.play(C.run, { loop: true });
    sfx.whoosh(0.6);
  }

  private stepRunning(f: Fighter, dt: number) {
    const sp = 5.2;
    if (f.st < 0) { return; }
    f.pos.addScaledVector(f.runDir, sp * dt);
    f.yaw = Math.atan2(f.runDir.x, f.runDir.z);
    const hitX = Math.abs(f.pos.x) > LIM + 0.05, hitZ = Math.abs(f.pos.z) > LIM + 0.05;
    if (hitX || hitZ) {
      clampRing(f.pos, LIM + 0.05);
      if (f.runBounced) { f.setState('idle'); f.anim.stop(); return; }
      if (hitX) f.runDir.x *= -1;
      if (hitZ) f.runDir.z *= -1;
      f.runBounced = true;
      f.anim.play(C.ropeBounce);
      f.st = -0.28;
      sfx.hit('slam', 0.2);
      setTimeout(() => { if (f.state === 'running') f.anim.play(C.run, { loop: true }); }, 280);
    }
    if (f.st > 3.5) { f.setState('idle'); f.anim.stop(); }
  }

  private stepAwait(f: Fighter, dt: number) {
    const o = this.opp(f);
    if (o.state !== 'running') { f.setState('idle'); return; }
    f.face(o.pos, dt, 12);
    const d = flatDist(f.pos, o.pos);
    if (!o.runBounced) return;
    // runner approaching?
    t1.copy(f.pos).sub(o.pos);
    if (t1.dot(o.runDir) <= 0) { f.setState('idle'); return; }
    if (!f.combo.length) f.combo = [pickOne(RUNNING)];
    const m = MOVES[f.combo[0]];
    const trigger = 5.2 * (m.hits[0]?.at ?? 0.15) + (m.pair ? 0.9 : m.range * 0.75);
    if (d <= trigger) {
      f.combo.length = 0;
      f.faceNow(o.pos);
      if (m.pair) { o.anim.stop(0); }
      this.startMove(f, m, o);
      if (!m.pair) {
        // the runner keeps running into it
      }
    }
  }

  // ── tag team ───────────────────────────────────────────────────────────────
  private stepToCorner(f: Fighter, dt: number) {
    const p = f.partner;
    if (!p || p.state !== 'apron') { f.setState('idle'); return; }
    const d = flatDist(f.pos, f.corner);
    if (d < 0.35) {
      f.setState('tag');
      f.faceNow(p.pos);
      f.anim.play(C.tagHand);
      p.anim.play(C.apronReach);
      return;
    }
    t1.copy(f.corner).sub(f.pos).setY(0).normalize();
    f.pos.addScaledVector(t1, f.walkSpeed * 1.25 * dt);
    f.yaw = Math.atan2(t1.x, t1.z);
    f.anim.base = 'guard';
    f.anim.fwd = f.walkSpeed * 1.25;
    if (d < 1.6 && !p.anim.playing) p.anim.play(C.apronReach, { loop: true });
    if (f.st > 6) f.setState('idle');
  }

  private doTagSwap(f: Fighter) {
    const p = f.partner!;
    f.legal = false;
    p.legal = true;
    f.tagCd = 12;
    p.tagCd = 12;
    f.stats.tags++;
    f.setState('exit');
    f.leapFrom.copy(f.pos);
    f.leapTo.copy(f.apronSpot);
    p.setState('enter');
    p.leapFrom.copy(p.pos);
    p.leapTo.copy(f.corner).multiplyScalar(0.82);
    p.anim.base = 'guard';
    p.anim.stop(0.1);
    const hot = p.hpPct > 0.75;
    p.rageT = hot ? (p.passive.tagMaster ? 9 : 5) : 0;
    this.say(hot ? 'HOT TAG!' : 'TAG!', 'big', p.team);
    sfx.hit('chop', 0.6);
    sfx.crowdCheer(hot ? 1 : 0.6);
    this.w.arena.hype(hot ? 0.8 : 0.4);
    this.w.director.set({ mode: 'corner', angle: Math.atan2(f.corner.x, f.corner.z), dist: 5.5, height: 2.6, hold: 1.4, cut: true });
    // the opponent loses track of a target that's leaving
    const o = this.opp(p);
    if (o.state === 'act' && o.target === f && !o.move?.pair) { /* finishes harmlessly */ }
  }

  private stepRopeHop(f: Fighter, dt: number) {
    const dur = 0.75;
    const k = Math.min(1, f.st / dur);
    f.pos.lerpVectors(f.leapFrom, f.leapTo, k);
    f.pos.y = Math.sin(k * Math.PI) * 1.4;
    f.yaw = Math.atan2(f.leapTo.x - f.leapFrom.x, f.leapTo.z - f.leapFrom.z);
    if (k === 1 || f.st === dt) f.anim.play(C.climb, { rate: 1.5, at: 0.4 });
    if (k >= 1) {
      f.pos.y = 0;
      if (f.state === 'enter') { f.setState('idle'); f.thinkT = 0.2; f.anim.stop(0.1); }
      else { f.setState('apron'); f.anim.base = 'relaxed'; f.anim.play(C.apronIdle, { loop: true }); f.faceNow(t1.set(0, 0, 0)); }
    }
  }

  private stepApron(f: Fighter, dt: number) {
    if (this.phase !== 'fight') return;
    f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.012 * (1 + (f.passive.tagMaster ?? 0)) * dt);
    f.stamina = Math.min(100, f.stamina + 20 * dt);
    f.face(this.legal(f.team).pos, dt, 2);
    if (!f.anim.playing) f.anim.play(C.apronIdle, { loop: true });
    // cheap shot on an opponent standing by our corner
    const o = this.opp(f);
    if (f.st > 4 && o.standing && o.state !== 'act' && flatDist(o.pos, f.apronSpot) < 1.25 && chance(dt * 0.6)) {
      f.st = 0;
      f.anim.play(C.tagHand, { rate: 1.3 });
      this.damage(f, o, 3, false, MOVES.jab.hits[0], false, o.rig.headWorld(t1).clone());
      this.applyReaction(f, o, { ...MOVES.jab.hits[0], react: 'head', push: 0.6 }, false);
      this.w.fx.hit(o.rig.headWorld(t1), 0.3);
      sfx.hit('punch', 0.4);
      this.say('GOLPE ILEGAL!', 'move', f.team, '#ff8a3d');
      sfx.crowdGasp();
    }
  }

  // ── top rope ───────────────────────────────────────────────────────────────
  private startClimb(f: Fighter, corner: Vector3) {
    f.setState('climb');
    f.corner.copy(corner);
    f.leapFrom.copy(f.pos);
    f.groundActs = 9;
  }

  private stepClimb(f: Fighter, dt: number) {
    const inner = f.corner;
    const top = t1.set(Math.sign(inner.x) * (RING.rope - 0.08), 1.26, Math.sign(inner.z) * (RING.rope - 0.08));
    const d = flatDist(f.pos, inner);
    if (f.st < 3 && d > 0.15 && f.pos.y < 0.01) {
      t2.copy(inner).sub(f.pos).setY(0).normalize();
      f.pos.addScaledVector(t2, f.walkSpeed * 1.3 * dt);
      f.yaw = Math.atan2(t2.x, t2.z);
      f.anim.fwd = f.walkSpeed;
      f.st = Math.min(f.st, 0.5);
      return;
    }
    if (!f.move && f.pos.y === 0 && f.anim.clip?.name !== 'climb') {
      f.anim.play(C.climb, { hold: true });
      f.yaw = Math.atan2(top.x, top.z);
      f.leapFrom.copy(f.pos);
      f.st = 0;
      this.w.director.set({ mode: 'close', target: () => f.rig.chestWorld(t3), facing: () => f.yaw + Math.PI, dist: 3.4, height: -0.3, angle: 0.5, cut: true, hold: 2 });
      sfx.crowdCheer(0.6);
      this.w.arena.hype(0.5);
    }
    const k = Math.min(1, f.st / 0.85);
    f.pos.lerpVectors(f.leapFrom, top, k);
    if (k >= 1) {
      f.setState('perch');
      f.anim.play(C.perch, { hold: true });
      f.faceNow(t2.set(0, 0, 0));
      this.say('NO TOPO DO POSTE!', 'move', f.team, '#ffd23f');
      sfx.crowdCheer(0.9);
    }
  }

  private stepPerch(f: Fighter, dt: number) {
    const o = this.opp(f);
    f.face(o.grounded ? o.rig.body.getWorldPosition(t1) : o.pos, dt, 6);
    if (f.st < 0.75) return;
    const m = MOVES[pickOne(AERIALS)];
    f.setState('leap');
    f.move = m;
    f.target = o;
    f.mt = 0;
    f.hitIdx = 0;
    f.leapFrom.copy(f.pos);
    const tgt = o.grounded ? o.rig.body.getWorldPosition(t1) : o.pos;
    f.leapTo.set(tgt.x, 0, tgt.z);
    f.faceNow(f.leapTo);
    f.anim.play(m.clip, { hold: true });
    f.stats.aerials++;
    this.say(m.name.toUpperCase() + '!', 'special', f.team);
    sfx.whoosh(1);
    this.w.director.set({ mode: 'side', angle: f.yaw + Math.PI / 2, dist: 6, height: 2.4, cut: true, hold: 1.4 });
    this.slow(0.55, 0.6);
  }

  private stepLeap(f: Fighter, dt: number) {
    const dur = 0.72;
    const k = Math.min(1, f.st / dur);
    f.pos.x = f.leapFrom.x + (f.leapTo.x - f.leapFrom.x) * k;
    f.pos.z = f.leapFrom.z + (f.leapTo.z - f.leapFrom.z) * k;
    f.pos.y = f.leapFrom.y * (1 - k) + Math.sin(k * Math.PI) * 1.1;
    f.mt = k * f.move!.clip.dur;
    if (k < 1) return;
    f.pos.y = 0;
    const o = f.target!;
    const m = f.move!;
    const hit = flatDist(o.rig.body.getWorldPosition(t1), f.pos) < 1.3 && o.inRing && (o.grounded || o.standing);
    if (hit) {
      const wasStanding = o.standing;
      this.resolveHit(f, o, { ...m.hits[0], unblockable: true, react: wasStanding ? 'knockBack' : 'none' }, m);
      this.w.fx.slam(f.pos, 1);
      this.w.director.shake(0.9);
      if (o.state === 'down') o.downT = Math.max(o.downT, 1.4);
    } else {
      this.w.fx.slam(f.pos, 0.8);
      f.hp = Math.max(1, f.hp - 8);
      this.say('FALHOU!', 'big', o.team, '#ff4d4d');
      sfx.hit('slam', 0.9);
      sfx.crowdGasp();
    }
    f.move = null;
    f.setState('down');
    f.downFace = true;
    f.downT = hit ? 0.5 : 1.6;
    f.groundActs = 0;
    this.endCine();
  }

  // ── pins ───────────────────────────────────────────────────────────────────
  private startPin(f: Fighter, o: Fighter) {
    if (this.pin) return;
    f.setState('pinning');
    o.setState('pinned');
    // lie across the victim's chest
    const chest = o.rig.chestWorld(t1);
    const side = t2.set(Math.cos(o.yaw), 0, -Math.sin(o.yaw));
    f.pos.set(chest.x + side.x * 0.55, 0, chest.z + side.z * 0.55);
    f.yaw = Math.atan2(-side.x, -side.z);
    f.anim.play(C.pinCover, { hold: true });
    let kickAt = 99;
    if (o.hp > 0) {
      if (chance(o.kickoutChance(1) * 0.55)) kickAt = rnd(0.95, 1.45);
      else if (chance(o.kickoutChance(2))) kickAt = rnd(1.75, 2.38);
    }
    let saveAt = 99;
    const p = o.partner;
    if (this.tag && p && p.state === 'apron' && p.hpPct > 0.25 && kickAt > 2.4 && chance(0.7)) saveAt = rnd(1.5, 2.0);
    this.pin = { att: f, vic: o, t: 0, count: 0, kickAt, saveAt, saved: false };
    this.ref.mode = 'count';
    this.say('PIN!', 'move', f.team);
    sfx.crowdGasp();
    const d = this.w.director;
    d.autoEnabled = false;
    d.set({ mode: 'close', target: () => o.rig.chestWorld(t3), facing: () => o.yaw + Math.PI / 2, dist: 3.2, height: 0.9, angle: 0.3, cut: true, fov: 40 });
  }

  private updatePin(dt: number) {
    const p = this.pin!;
    p.t += dt;
    const counts = [0.95, 1.75, 2.55];
    if (p.saveAt < 99 && p.t >= p.saveAt && !p.saved) {
      p.saved = true;
      const partner = p.vic.partner!;
      partner.setState('save');
      partner.leapFrom.copy(partner.pos);
      partner.target = p.att;
    }
    if (p.t >= p.kickAt) { this.endPin(true); return; }
    while (p.count < 3 && p.t >= counts[p.count]) {
      p.count++;
      this.ref.anim.play(C.refCount, { hold: true });
      sfx.count(p.count);
      this.say(String(p.count), 'count');
      this.w.director.shake(0.15);
      if (p.count === 3) {
        p.vic.hp = Math.min(p.vic.hp, 0);
        const winner = p.att.team;
        p.vic.setState('ko');
        this.pin = null;
        this.finish(winner, 'PIN');
        return;
      }
    }
  }

  private endPin(kickout: boolean) {
    const p = this.pin;
    if (!p) return;
    this.pin = null;
    this.ref.mode = 'roam';
    this.ref.anim.stop(0.2);
    if (kickout) {
      p.vic.stats.kickouts++;
      const close = p.count >= 2;
      this.say(close ? 'KICK-OUT AOS 2.9!' : 'KICK-OUT!', close ? 'big' : 'move', p.vic.team, '#4ade80');
      sfx.crowdCheer(close ? 1 : 0.5);
      this.w.arena.hype(close ? 0.9 : 0.4);
      p.vic.meter = Math.min(100, p.vic.meter + 15 * p.vic.meterMul);
      if (close) this.slow(0.4, 0.5);
    }
    p.vic.setState('down');
    p.vic.downT = 0.5 + (kickout ? 0.2 : 0.6);
    p.att.setState('down');
    p.att.downFace = true;
    p.att.downT = 0.25;
    t1.copy(p.att.pos).sub(p.vic.pos).setY(0).normalize();
    p.att.vel.copy(t1).multiplyScalar(2);
    p.att.anim.play(C.fallFace, { hold: true, at: 0.5 });
    p.att.groundActs = 0;
    this.endCine();
    this.w.director.neutral(false);
  }

  private stepSave(f: Fighter, dt: number) {
    const tgt = f.target!;
    if (f.pos.y > 0 || flatDist(f.pos, f.apronSpot) < 0.6 && f.st < 0.8) {
      // hop over the ropes
      const k = Math.min(1, f.st / 0.5);
      const inside = t1.copy(f.apronSpot).multiplyScalar(0.8);
      f.pos.lerpVectors(f.leapFrom, inside, k);
      f.pos.y = Math.sin(k * Math.PI) * 1.3;
      if (k >= 1) f.pos.y = 0;
      return;
    }
    if (!this.pin || this.pin.att !== tgt) { this.returnToApron(f); return; }
    const d = flatDist(f.pos, tgt.pos);
    if (d > 0.9) {
      t1.copy(tgt.pos).sub(f.pos).setY(0).normalize();
      f.pos.addScaledVector(t1, 5 * dt);
      f.yaw = Math.atan2(t1.x, t1.z);
      if (f.anim.clip?.name !== 'run') f.anim.play(C.run, { loop: true });
      return;
    }
    // break it up!
    f.anim.play(MOVES.stomp.clip, { rate: 1.4 });
    this.endPin(false);
    this.damage(f, tgt, 6, false, MOVES.stomp.hits[0], false, tgt.rig.chestWorld(t1).clone());
    this.w.fx.hit(tgt.rig.chestWorld(t1), 0.6);
    sfx.hit('heavy', 0.7);
    this.say('SALVAMENTO!', 'big', f.team, '#22d3ee');
    sfx.crowdCheer(0.9);
    this.returnToApron(f);
    setTimeout(() => {}, 0);
  }

  private returnToApron(f: Fighter) {
    f.setState('exit');
    f.leapFrom.copy(f.pos);
    f.leapTo.copy(f.apronSpot);
  }

  // ── referee ────────────────────────────────────────────────────────────────
  private updateRef(dt: number) {
    const r = this.ref;
    if (r.mode === 'count' && this.pin) {
      const v = this.pin.vic;
      const head = v.rig.headWorld(t1);
      const tgt = t2.copy(head).sub(v.rig.chestWorld(t3)).setY(0).normalize().multiplyScalar(0.55).add(head);
      tgt.y = 0;
      const d = flatDist(r.pos, tgt);
      if (d > 0.1) { t3.copy(tgt).sub(r.pos).setY(0).normalize(); r.pos.addScaledVector(t3, Math.min(d, 6 * dt)); r.anim.fwd = 3; }
      r.yaw = Math.atan2(head.x - r.pos.x, head.z - r.pos.z);
      if (this.pin.count === 0 && d < 0.3 && r.anim.clip?.name !== 'refCount') r.anim.play(C.refCount, { hold: true, at: 0.18 });
      return;
    }
    if (r.mode !== 'roam') return;
    const a = this.legal(0), b = this.legal(1);
    const mid = t1.set((a.pos.x + b.pos.x) / 2, 0, (a.pos.z + b.pos.z) / 2);
    const axis = t2.set(b.pos.x - a.pos.x, 0, b.pos.z - a.pos.z);
    if (axis.lengthSq() < 1e-4) axis.set(1, 0, 0);
    axis.normalize();
    // stand perpendicular to the action, on the side facing the hard cam
    const perp = t3.set(-axis.z, 0, axis.x);
    // stay on the far side so the referee never blocks the broadcast camera
    if (perp.z > 0) perp.multiplyScalar(-1);
    const want = mid.clone().addScaledVector(perp, 2.0);
    clampRing(want, LIM - 0.1);
    const d = flatDist(r.pos, want);
    r.anim.fwd = 0;
    if (d > 0.5) {
      t3.copy(want).sub(r.pos).setY(0).normalize();
      r.pos.addScaledVector(t3, Math.min(d, 1.8 * dt));
      r.anim.fwd = 1.6;
    }
    let dy = Math.atan2(mid.x - r.pos.x, mid.z - r.pos.z) - r.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    r.yaw += dy * Math.min(1, dt * 4);
    for (const f of this.fighters) {
      if (!f.inRing) continue;
      const dd = flatDist(r.pos, f.pos);
      if (dd < 0.7) { t3.copy(r.pos).sub(f.pos).setY(0).normalize(); r.pos.addScaledVector(t3, (0.7 - dd)); }
    }
    clampRing(r.pos, LIM);
  }

  private separate() {
    const list = this.fighters.filter((f) => f.inRing && (f.state === 'idle' || f.state === 'react' || f.state === 'act' && !f.move?.pair || f.state === 'getup' || f.state === 'toCorner' || f.state === 'awaitRunner' || f.state === 'stunned'));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const d = flatDist(a.pos, b.pos);
      const min = 0.72;
      if (d < min && d > 1e-4) {
        t1.set(b.pos.x - a.pos.x, 0, b.pos.z - a.pos.z).normalize().multiplyScalar((min - d) / 2);
        a.pos.sub(t1); b.pos.add(t1);
        clampRing(a.pos); clampRing(b.pos);
      }
    }
  }

  // ── super & special scripts ────────────────────────────────────────────────
  private superScript(f: Fighter, o: Fighter, m: MoveDef, t0: number, t: number, dt: number) {
    const fx = this.w.fx;
    const crossed = (x: number) => t0 < x && t >= x;
    const chestF = () => f.rig.chestWorld(t1);
    switch (m.id) {
      case 'fireupper': if (t < 0.42) fx.emit(f.rig.handWorld(1, t1), 0xff6a1f, 70, dt, 0.08, 1, 0.14); break;
      case 'flyingknee': case 'phantom': if (t > 0.1 && t < 0.45) fx.emit(chestF(), m.id === 'phantom' ? 0x8b5cf6 : 0xffffff, 90, dt, 0.35, 0.2, 0.25); break;
      case 'tornado': if (t > 0.15 && t < 0.7) { fx.emit(f.rig.handWorld(1, t1), 0xd8f3ff, 80, dt, 0.1, 0.4, 0.1); fx.emit(f.rig.handWorld(0, t1), 0xd8f3ff, 80, dt, 0.1, 0.4, 0.1); } break;
      case 'icehammer': if (t < 0.48) fx.emit(f.rig.handWorld(1, t1), 0xbfefff, 60, dt, 0.1, 0.3, 0.1); if (crossed(0.48)) { o.frozenT = 4; fx.shock(o.pos, 0x9fe8ff, 2.4, 0.5); this.say('CONGELADO!', 'move', f.team, '#9fe8ff'); } break;
      case 'quake': if (crossed(1.0)) { fx.shock(f.pos, 0xffd23f, 5, 0.8); fx.shock(f.pos, 0xffffff, 3, 0.5); this.w.director.shake(1.2); sfx.boom(); this.slow(0.35, 0.5); } break;
      case 'boltkick':
        if (crossed(0.32)) {
          const from = f.pos.clone().setY(1);
          o.forward(t2);
          f.pos.copy(o.pos).addScaledVector(t2, -0.95);
          clampRing(f.pos);
          f.faceNow(o.pos);
          fx.bolt(from, f.pos.clone().setY(1), 0xbfe9ff, 0.07, 0.3);
          fx.burst(f.rig.chestWorld(t1), 'spark', 1.2);
          sfx.zap();
          this.hooks.flash('#bfe9ff', 0.4);
        }
        break;
      case 'atomic': if (crossed(1.1)) { fx.burst(o.rig.chestWorld(t1), 'fire', 2.5); fx.pillar(o.pos, 0xff5a1f, 1.4, 5, 1, 0.7); fx.shock(o.pos, 0xff7a1f, 4.5, 0.7); sfx.boom(); this.hooks.flash('#ffb37a', 0.6); this.slow(0.3, 0.6); } break;
      case 'bearhug': if (t > 0.5 && t < 1.6) { o.stamina = Math.max(0, o.stamina - 25 * dt); } break;
      // ── supers ──
      case 'sup_bomb': case 'sup_triple': {
        if (t < 0.6) fx.emit(chestF(), 0xffd23f, 60, dt, 0.4, 1.2, 0.12);
        const last = m.hits[m.hits.length - 1].at;
        if (crossed(last)) this.superImpact(f, o, 0xffd23f, 'gold');
        break;
      }
      case 'sup_thunder':
        if (t > 0.4 && t < 1.5 && Math.floor(t * 8) !== Math.floor(t0 * 8)) { const h = f.rig.handWorld(1, t2).clone(); fx.bolt(new Vector3(h.x + rnd(-1, 1), 9, h.z + rnd(-1, 1)), h, 0xbfe9ff, 0.06, 0.18); sfx.zap(); this.w.director.shake(0.15); }
        if (t > 0.4 && t < 1.55) fx.emit(f.rig.handWorld(1, t2), 0x9fe8ff, 80, dt, 0.12, 0.6, 0.12);
        if (crossed(1.55)) { this.superImpact(f, o, 0x7dd3fc, 'spark'); fx.bolt(f.rig.handWorld(1, t2).clone(), o.rig.chestWorld(t3).clone().addScaledVector(f.forward(t1), 3), 0xffffff, 0.12, 0.4); }
        break;
      case 'sup_meteor': {
        const tgt = o.rig.body.getWorldPosition(t2);
        if (t >= 0.6 && t < 1.6) {
          const k = (t - 0.6) / 1.0;
          f.pos.y = Math.pow(k, 0.6) * 14;
          if (k > 0.5) { f.pos.x += (tgt.x - f.pos.x) * Math.min(1, dt * 6); f.pos.z += (tgt.z - f.pos.z) * Math.min(1, dt * 6); }
          if (crossed(0.6)) { sfx.whoosh(1); this.w.fx.shock(f.pos, 0xff7a1f, 2, 0.4); }
        } else if (t >= 1.6 && t < 2.15) {
          const k = (t - 1.6) / 0.55;
          f.pos.x = tgt.x; f.pos.z = tgt.z;
          f.pos.y = 14 * (1 - k * k);
          fx.emit(f.rig.chestWorld(t1), 0xff6a1f, 160, dt, 0.4, 3, 0.35);
          fx.emit(f.rig.chestWorld(t1), 0xffd23f, 60, dt, 0.25, 2, 0.2);
          if (crossed(1.6)) { this.w.director.set({ mode: 'top', height: 9, cut: true, hold: 1.5 }); }
        } else if (t >= 2.15) f.pos.y = 0;
        if (crossed(2.15)) { this.superImpact(f, o, 0xff5a1f, 'fire'); if (o.state !== 'ko') { this.knockDown(o, false, 0, true); } }
        break;
      }
      case 'sup_dragon': {
        if (t > 0.6 && t < 1.6) {
          const k = (t - 0.6) / 1.0;
          f.pos.y = k * 2.6;
          o.state = 'stunned';
          f.forward(t1);
          o.pos.set(f.pos.x + t1.x * 0.75, f.pos.y + 0.3, f.pos.z + t1.z * 0.75);
          const a = t * 14;
          for (let i = 0; i < 2; i++) { const aa = a + i * Math.PI; fx.add.spawn({ x: f.pos.x + Math.cos(aa) * 0.9, y: f.pos.y + 0.9 + Math.sin(t * 5) * 0.3, z: f.pos.z + Math.sin(aa) * 0.9, vy: 1.5, life: 0.6, size: 0.35, size1: 0.05, r: 1, g: 0.45 + Math.random() * 0.3, b: 0.1 }); }
        } else if (t >= 1.6 && t < 2.6) {
          f.pos.y = Math.max(0, 2.6 * (1 - (t - 1.6) / 0.6));
        } else if (t >= 2.6) f.pos.y = 0;
        if (crossed(1.6)) { this.superImpact(f, o, 0xff5a1f, 'fire'); this.w.fx.pillar(t2.set(f.pos.x, 0, f.pos.z), 0xff4500, 1.3, 7, 1.2, 0.6); }
        break;
      }
      case 'sup_nova': {
        if (t < 0.6) f.pos.y = (t / 0.6) * 1.4;
        else if (t < 2.3) {
          f.pos.y = 1.4 + Math.sin(t * 4) * 0.08;
          // energy converging
          const c = f.rig.chestWorld(t1);
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2, r = rnd(2, 3.5), y = rnd(-1, 1.5);
            const col = new Vector3().setScalar(0);
            void col;
            fx.add.spawn({ x: c.x + Math.cos(a) * r, y: c.y + y, z: c.z + Math.sin(a) * r, vx: -Math.cos(a) * r * 1.6, vy: -y * 1.6, vz: -Math.sin(a) * r * 1.6, life: 0.6, size: 0.12, size1: 0.02, r: 0.6 + Math.random() * 0.4, g: 0.5, b: 1 });
          }
          if (crossed(1.0)) this.w.director.set({ mode: 'low', angle: f.yaw + 2.4, dist: 4.5, height: 0.5, cut: true });
        } else if (t < 3.0) f.pos.y = Math.max(0, 1.4 * (1 - (t - 2.3) / 0.5));
        else f.pos.y = 0;
        if (crossed(2.3)) {
          this.superImpact(f, o, 0xb07bff, 'cosmic');
          fx.pillar(t2.set(f.pos.x, 0, f.pos.z), 0xffffff, 2.5, 12, 1.5, 0.8);
          fx.shock(t2, 0x7df9ff, 7, 1);
          this.hooks.flash('#ffffff', 1);
        }
        break;
      }
    }
  }

  private superImpact(f: Fighter, o: Fighter, color: number, kind: 'gold' | 'fire' | 'spark' | 'cosmic') {
    const fx = this.w.fx;
    const p = o.rig.chestWorld(t1).clone();
    fx.burst(p, kind, 3);
    fx.shock(new Vector3(p.x, 0.05, p.z), color, 6, 0.9);
    fx.shock(new Vector3(p.x, 0.05, p.z), 0xffffff, 3.5, 0.5);
    fx.pillar(new Vector3(p.x, 0, p.z), color, 1.2, 8, 1.1, 0.6);
    this.hooks.flash('#ffffff', 0.85);
    sfx.boom();
    sfx.crowdCheer(1);
    this.w.director.shake(1.2);
    this.w.director.kick(8);
    this.stop(0.18);
    this.slow(0.25, 0.9);
    this.w.arena.hype(1);
    void f;
  }
}

// ── track sampling ─────────────────────────────────────────────────────────────
const ease = (x: number) => x * x * (3 - 2 * x);
const easeIn = (x: number) => x * x;
const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const tk = { x: 0, y: 0, z: 0, yaw: 0 };
function sampleTrack(keys: PairKey[], t: number) {
  if (t <= keys[0].t) { Object.assign(tk, { x: keys[0].x, y: keys[0].y, z: keys[0].z, yaw: keys[0].yaw }); return tk; }
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b.t) {
      const a = keys[i - 1];
      const x = (t - a.t) / Math.max(1e-4, b.t - a.t);
      const k = b.e === 'in' ? easeIn(x) : b.e === 'out' ? easeOut(x) : ease(x);
      tk.x = a.x + (b.x - a.x) * k; tk.y = a.y + (b.y - a.y) * k; tk.z = a.z + (b.z - a.z) * k; tk.yaw = a.yaw + (b.yaw - a.yaw) * k;
      return tk;
    }
  }
  const l = keys[keys.length - 1];
  Object.assign(tk, { x: l.x, y: l.y, z: l.z, yaw: l.yaw });
  return tk;
}
function sampleRoot(keys: [number, number][], t: number) {
  let pt = 0, pv = 0;
  for (const [kt, kv] of keys) {
    if (t <= kt) { const x = (t - pt) / Math.max(1e-4, kt - pt); return pv + (kv - pv) * Math.max(0, Math.min(1, x)); }
    pt = kt; pv = kv;
  }
  return pv;
}
