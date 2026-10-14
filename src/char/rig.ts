// ─────────────────────────────────────────────────────────────────────────────
//  Procedural cartoon fighter built from shared primitive geometries.
//  Hierarchy: root(pos/yaw) → body(hips offsets) → spine → chest → neck → head
//                                               → shoulders → elbows → gloves
//                                    → hips → knees → feet
// ─────────────────────────────────────────────────────────────────────────────
import {
  BoxGeometry, CapsuleGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, Group, Material, Mesh, MeshToonMaterial,
  Object3D, OctahedronGeometry, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { Appearance, EYE_COLORS, HAIR_COLORS, HairLook, ITEM, Pattern, SKIN_TONES, SkinLook } from '../meta/data';
import { canvasTex, toon } from '../engine/gfx';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BODY_OFF, JOINTS, Joint, Pose } from './pose';

// ── shared geometry (built once) ─────────────────────────────────────────────
const G = {
  sphere: new SphereGeometry(1, 20, 14),
  sphereLo: new SphereGeometry(1, 12, 8),
  capsule: new CapsuleGeometry(1, 1, 4, 12),
  cyl: new CylinderGeometry(1, 1, 1, 16, 1),
  cylOpen: new CylinderGeometry(1, 1, 1, 16, 1, true),
  box: new BoxGeometry(1, 1, 1),
  cone: new ConeGeometry(1, 1, 10),
  octa: new OctahedronGeometry(1, 0),
  torus: new TorusGeometry(1, 0.22, 8, 24),
  arc: new TorusGeometry(1, 0.25, 6, 16, Math.PI),
  cap: new SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
  capDeep: new SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
};

function mesh(geo: Mesh['geometry'], mat: Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  return m;
}

// ── outfit pattern textures (cached per skin) ───────────────────────────────
const patternCache = new Map<string, CanvasTexture>();
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export function patternTexture(key: string, pattern: Pattern, a: number, b: number, c: number): CanvasTexture {
  const k = key + pattern;
  const hit = patternCache.get(k);
  if (hit) return hit;
  const tex = canvasTex(256, 256, (g, w, h) => {
    const A = hex(a), B = hex(b), C = hex(c);
    g.fillStyle = A; g.fillRect(0, 0, w, h);
    switch (pattern) {
      case 'stripes':
        g.fillStyle = B; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 26, h);
        g.fillStyle = C; for (let x = 26; x < w; x += 64) g.fillRect(x, 0, 6, h);
        break;
      case 'checker':
        g.fillStyle = B; for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < w; x += 64) g.fillRect(x, y, 32, 32);
        break;
      case 'flames': {
        const flame = (col: string, s: number, off: number) => {
          g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
          for (let x = 0; x <= w; x += 32) { const tip = h * (0.25 + 0.3 * Math.abs(Math.sin(x * 0.07 + off))) * s; g.quadraticCurveTo(x + 8, h - tip * 0.6, x + 16, h - tip); g.quadraticCurveTo(x + 22, h - tip * 0.5, x + 32, h); }
          g.lineTo(w, h); g.closePath(); g.fill();
        };
        flame(B, 1.6, 0); flame(C, 1.0, 1.3);
        break;
      }
      case 'stars':
        g.fillStyle = B; g.fillRect(0, h * 0.42, w, h * 0.16);
        g.fillStyle = C;
        for (let i = 0; i < 9; i++) star(g, (i % 3) * 90 + 40 + ((i / 3) | 0) * 20, ((i / 3) | 0) * 88 + 30, 14);
        break;
      case 'camo':
        for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? B : C; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 26, 8 + Math.random() * 16, Math.random() * 3, 0, 7); g.fill(); }
        break;
      case 'bolt':
        g.strokeStyle = B; g.lineWidth = 10; g.lineJoin = 'miter';
        for (let x = -40; x < w; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, h * 0.4); g.lineTo(x + 8, h * 0.45); g.lineTo(x + 46, h); g.stroke(); }
        g.strokeStyle = C; g.lineWidth = 3;
        for (let x = -40; x < w; x += 85) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, h * 0.4); g.lineTo(x + 8, h * 0.45); g.lineTo(x + 46, h); g.stroke(); }
        break;
      case 'scales':
        g.strokeStyle = B; g.lineWidth = 4;
        for (let y = 0; y < h + 20; y += 20) for (let x = (y / 20) % 2 ? 0 : 16; x < w + 32; x += 32) { g.beginPath(); g.arc(x, y, 16, 0, Math.PI); g.stroke(); }
        g.fillStyle = C; g.globalAlpha = 0.25; g.fillRect(0, 0, w, h * 0.12); g.globalAlpha = 1;
        break;
      case 'galaxy': {
        const gr = g.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, A); gr.addColorStop(0.5, B); gr.addColorStop(1, A);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) { const rg = g.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 80); rg.addColorStop(0, C + '88'); rg.addColorStop(1, C + '00'); g.fillStyle = rg; g.fillRect(0, 0, w, h); }
        g.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { const s = Math.random() * 2.2; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
        break;
      }
      case 'tiger':
        g.fillStyle = B;
        for (let x = 0; x < w; x += 42) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 30, h * 0.3, x + 8, h * 0.55); g.quadraticCurveTo(x + 18, h * 0.3, x - 6, 0); g.fill(); g.beginPath(); g.moveTo(x + 20, h); g.quadraticCurveTo(x - 6, h * 0.7, x + 14, h * 0.45); g.quadraticCurveTo(x + 2, h * 0.75, x + 34, h); g.fill(); }
        break;
      case 'split':
        g.fillStyle = B; g.fillRect(w / 2, 0, w / 2, h);
        g.fillStyle = C; g.fillRect(w / 2 - 5, 0, 10, h); g.fillRect(0, h * 0.85, w, 10);
        break;
      default:
        g.fillStyle = C; g.fillRect(0, h * 0.86, w, h * 0.06);
    }
  });
  patternCache.set(k, tex);
  return tex;
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

// ── shared face materials ────────────────────────────────────────────────────
let faceMats: { white: MeshToonMaterial; dark: MeshToonMaterial; teeth: MeshToonMaterial; gold: MeshToonMaterial } | null = null;
function face() {
  if (!faceMats) faceMats = { white: toon(0xffffff, { rim: false }), dark: toon(0x1a0f14, { rim: false }), teeth: toon(0xfff8ee, { rim: false }), gold: toon(0xffcc33, { emissive: 0x7a4a00, emissiveIntensity: 0.6 }) };
  return faceMats;
}

export interface RigOptions { referee?: boolean; lookOverride?: SkinLook }

export function resolveLook(app: Appearance): SkinLook {
  return ITEM[app.skin]?.look ?? ITEM['sk_classico'].look!;
}
export function resolveHair(app: Appearance): HairLook {
  if (app.hair.startsWith('h_')) return ITEM[app.hair]?.hair ?? { base: 'curto' };
  return { base: app.hair };
}

export class Rig {
  root = new Group();
  body = new Group();
  head = new Group();
  j = {} as Record<Joint, Group>;
  look: SkinLook;
  hairLook: HairLook;
  private flashMats: MeshToonMaterial[] = [];
  private flashBase: { m: MeshToonMaterial; e: Color; i: number }[] = [];
  private eyes: Object3D[] = [];
  private mouth!: Object3D;
  private blinkT = 2 + Math.random() * 3;
  private pain = 0;
  private flashV = 0;
  private ownMats: Material[] = [];
  hands: Object3D[] = [];
  feet: Object3D[] = [];
  hairAnchor = new Object3D();
  glowMats: MeshToonMaterial[] = [];
  heightScale = 1;

  constructor(public app: Appearance, opts: RigOptions = {}) {
    this.look = opts.lookOverride ?? resolveLook(app);
    this.hairLook = resolveHair(app);
    const L = this.look;
    const skinCol = SKIN_TONES[app.skinTone % SKIN_TONES.length];
    const hairCol = this.hairLook.color ?? HAIR_COLORS[app.hairColor % HAIR_COLORS.length];
    const build = [0.88, 1, 1.16][app.build] ?? 1;

    const mk = (c: number, o?: Parameters<typeof toon>[1]) => { const m = toon(c, o); this.ownMats.push(m); return m; };
    const skin = mk(skinCol);
    const pat = patternTexture(app.skin, L.pattern, L.primary, L.secondary, L.accent);
    const trunks = mk(0xffffff, { map: pat });
    const accent = mk(L.accent, L.glow ? { emissive: L.glow, emissiveIntensity: 0.55 } : undefined);
    const secondary = mk(L.secondary);
    const gloves = mk(L.gloves, L.glow ? { emissive: L.glow, emissiveIntensity: 0.18 } : undefined);
    const boots = mk(L.boots);
    const hair = mk(hairCol, this.hairLook.glow ? { emissive: this.hairLook.glow, emissiveIntensity: 0.55 } : undefined);
    const iris = mk(EYE_COLORS[app.eyeColor % EYE_COLORS.length], { rim: false });
    if (L.glow) this.glowMats.push(accent);
    if (this.hairLook.glow) this.glowMats.push(hair);
    this.flashMats = [skin, trunks, secondary, gloves, boots, accent];
    this.flashBase = this.flashMats.map((m) => ({ m, e: m.emissive.clone(), i: m.emissiveIntensity }));

    const top = opts.referee ? 'singlet' : L.top;
    const topMat = top === 'none' ? skin : top === 'singlet' ? trunks : secondary;
    const legsMat = opts.referee ? secondary : skin;

    // hierarchy
    this.heightScale = app.height;
    this.root.scale.setScalar(app.height);
    this.root.add(this.body);
    this.body.position.y = 0.95;
    for (const name of JOINTS) this.j[name] = new Group();
    const J = this.j;
    J.spine.position.set(0, 0.04, 0);
    J.chest.position.set(0, 0.2, 0);
    J.neck.position.set(0, 0.36, 0.0);
    J.lSh.position.set(0.27 * build, 0.27, 0);
    J.rSh.position.set(-0.27 * build, 0.27, 0);
    J.lEl.position.set(0, -0.29, 0);
    J.rEl.position.set(0, -0.29, 0);
    J.lHip.position.set(0.11 * build, -0.05, 0);
    J.rHip.position.set(-0.11 * build, -0.05, 0);
    J.lKn.position.set(0, -0.43, 0);
    J.rKn.position.set(0, -0.43, 0);
    this.body.add(J.spine, J.lHip, J.rHip);
    J.spine.add(J.chest);
    J.chest.add(J.neck, J.lSh, J.rSh);
    J.neck.add(this.head);
    this.head.position.set(0, 0.08, 0.02);
    J.lSh.add(J.lEl);
    J.rSh.add(J.rEl);
    J.lHip.add(J.lKn);
    J.rHip.add(J.rKn);

    // pelvis / trunks
    this.body.add(mesh(G.cyl, trunks, 0, -0.06, 0, 0.19 * build, 0.24, 0.15 * build));
    this.body.add(mesh(G.torus, accent, 0, 0.06, 0, 0.19 * build, 0.155 * build, 0.3, Math.PI / 2));
    // abdomen + chest
    J.spine.add(mesh(G.sphere, topMat, 0, 0.12, 0, 0.18 * build, 0.17, 0.14 * build));
    J.chest.add(mesh(G.sphere, topMat, 0, 0.17, 0, 0.29 * build, 0.22, 0.18 * build));
    if (top === 'none') {
      // pecs + abs definition
      J.chest.add(mesh(G.sphereLo, skin, 0.1 * build, 0.2, 0.09 * build, 0.12 * build, 0.09, 0.08));
      J.chest.add(mesh(G.sphereLo, skin, -0.1 * build, 0.2, 0.09 * build, 0.12 * build, 0.09, 0.08));
    }
    if (top === 'jacket') {
      J.chest.add(mesh(G.torus, accent, 0, 0.33, 0, 0.17 * build, 0.13 * build, 0.4, Math.PI / 2));
      J.chest.add(mesh(G.box, accent, 0, 0.16, 0.17 * build, 0.04, 0.32, 0.03));
    }
    if (top === 'gi') {
      J.spine.add(mesh(G.torus, accent, 0, 0.06, 0, 0.18 * build, 0.145 * build, 0.45, Math.PI / 2));
      J.chest.add(mesh(G.box, secondary, 0.05, 0.2, 0.16 * build, 0.03, 0.34, 0.03, 0, 0, 0.4));
    }
    if (opts.referee) J.chest.add(mesh(G.box, face().dark, 0, 0.36, 0.16, 0.12, 0.05, 0.03));
    // neck
    J.neck.add(mesh(G.cyl, skin, 0, 0.03, 0, 0.085, 0.14, 0.085));

    // arms
    const sleeve = top === 'jacket' || top === 'gi' ? secondary : skin;
    for (const side of [1, -1]) {
      const sh = side === 1 ? J.lSh : J.rSh;
      const el = side === 1 ? J.lEl : J.rEl;
      sh.add(mesh(G.sphere, top === 'singlet' || top === 'none' ? skin : sleeve, 0, 0, 0, 0.105, 0.1, 0.1)); // deltoid
      sh.add(mesh(G.capsule, sleeve, 0, -0.14, 0, 0.075 * build, 0.16, 0.075 * build));
      el.add(mesh(G.capsule, skin, 0, -0.12, 0, 0.066 * build, 0.14, 0.066 * build));
      const hand = new Group();
      hand.position.set(0, -0.29, 0.01);
      el.add(hand);
      if (opts.referee) {
        hand.add(mesh(G.sphere, skin, 0, 0.03, 0, 0.06, 0.07, 0.06));
      } else {
        hand.add(mesh(G.sphere, gloves, 0, 0.02, 0.012, 0.105, 0.12, 0.118));
        hand.add(mesh(G.sphereLo, gloves, side * 0.06, 0.04, 0.05, 0.045, 0.05, 0.045)); // thumb
        hand.add(mesh(G.cyl, face().white, 0, 0.11, 0, 0.078, 0.07, 0.078)); // cuff
      }
      this.hands.push(hand);
    }

    // legs
    for (const side of [1, -1]) {
      const hip = side === 1 ? J.lHip : J.rHip;
      const kn = side === 1 ? J.lKn : J.rKn;
      hip.add(mesh(G.capsule, legsMat, 0, -0.2, 0, 0.1 * build, 0.24, 0.1 * build));
      kn.add(mesh(G.capsule, legsMat, 0, -0.16, 0, 0.08 * build, 0.22, 0.08 * build));
      kn.add(mesh(G.sphereLo, opts.referee ? legsMat : accent, 0, 0, 0.04, 0.085 * build, 0.08, 0.06)); // knee pad
      kn.add(mesh(G.cyl, boots, 0, -0.3, 0, 0.088 * build, 0.2, 0.088 * build)); // boot shaft
      const foot = mesh(G.box, boots, 0, -0.43, 0.05, 0.13, 0.08, 0.25);
      kn.add(foot);
      this.feet.push(foot);
    }

    this.buildHead(skin, hair, iris, opts.referee ?? false);
    // collapse static parts into one mesh per material per joint (big draw-call saving)
    this.root.traverse((o) => { if ((o as Group).isGroup || o === this.root) bake(o); });
  }

  private buildHead(skin: MeshToonMaterial, hair: MeshToonMaterial, iris: MeshToonMaterial, referee: boolean) {
    const H = this.head, app = this.app, L = this.look, F = face();
    const cy = 0.17;
    H.add(mesh(G.sphere, skin, 0, cy, 0, 0.2, 0.215, 0.19));
    // jaw
    H.add(mesh(G.sphere, skin, 0, cy - 0.08, 0.03, 0.15, 0.12, 0.15));
    // ears
    H.add(mesh(G.sphereLo, skin, 0.195, cy, -0.01, 0.04, 0.06, 0.03));
    H.add(mesh(G.sphereLo, skin, -0.195, cy, -0.01, 0.04, 0.06, 0.03));
    // nose
    H.add(mesh(G.sphereLo, skin, 0, cy - 0.02, 0.19, 0.035, 0.035, 0.035));

    // eyes
    const style = app.eyes;
    const big = style === 3 ? 1.22 : 1;
    const eyeY = cy + 0.03;
    for (const side of [1, -1]) {
      const eye = new Group();
      eye.position.set(side * 0.074, eyeY, 0.168);
      const white = mesh(G.sphere, F.white, 0, 0, 0, 0.052 * big, 0.062 * big, 0.03);
      const pupil = mesh(G.sphere, iris, 0, -0.004, 0.022, 0.03 * big, 0.036 * big, 0.016);
      const shine = mesh(G.sphereLo, F.white, 0.012, 0.012, 0.035, 0.009, 0.009, 0.006);
      const core = mesh(G.sphereLo, F.dark, 0, -0.004, 0.032, 0.014 * big, 0.018 * big, 0.008);
      eye.add(white, pupil, core, shine);
      // lids
      if (style === 1 || style === 2 || style === 4) {
        const lid = mesh(G.box, skin, 0, style === 2 ? 0.03 : 0.045, 0.02, 0.13, 0.06, 0.05);
        lid.rotation.z = style === 4 ? side * 0.45 : style === 1 ? side * 0.2 : 0;
        eye.add(lid);
      }
      if (style === 5) eye.scale.y = 0.55;
      H.add(eye);
      this.eyes.push(eye);
      // brows
      const bs = app.brows;
      if (bs !== 5) {
        const thick = bs === 1 ? 0.03 : bs === 3 ? 0.012 : 0.02;
        const brow = mesh(G.box, hair, side * 0.075, eyeY + 0.075, 0.185, 0.08, thick, 0.02);
        brow.rotation.z = bs === 2 ? side * 0.35 : bs === 4 ? -side * 0.25 : side * 0.05;
        H.add(brow);
      }
    }
    if (app.brows === 5) H.add(mesh(G.box, hair, 0, eyeY + 0.075, 0.185, 0.2, 0.026, 0.02));

    // mouth
    const mouth = new Group();
    mouth.position.set(0, cy - 0.085, 0.175);
    switch (app.mouth) {
      case 0: mouth.add(mesh(G.arc, F.dark, 0, 0.02, 0, 0.05, 0.035, 0.03, 0, 0, Math.PI)); break;
      case 1: mouth.add(mesh(G.box, F.dark, 0, 0, 0, 0.08, 0.012, 0.02)); break;
      case 2: mouth.add(mesh(G.sphere, F.dark, 0, 0, 0, 0.045, 0.035, 0.02)); break;
      case 3: mouth.add(mesh(G.box, F.teeth, 0, 0, 0, 0.09, 0.03, 0.02), mesh(G.box, F.dark, 0, 0, -0.002, 0.098, 0.038, 0.016)); break;
      case 4: mouth.add(mesh(G.arc, F.dark, 0.015, 0.02, 0, 0.05, 0.03, 0.03, 0, 0, Math.PI + 0.25)); break;
      default: mouth.add(mesh(G.sphere, F.dark, 0, 0, 0, 0.02, 0.02, 0.015));
    }
    this.mouth = mouth;
    H.add(mouth);

    // beard
    const hc = hair;
    switch (app.beard) {
      case 1: H.add(mesh(G.capsule, hc, 0, cy - 0.05, 0.18, 0.022, 0.08, 0.022, 0, 0, Math.PI / 2)); break;
      case 2: H.add(mesh(G.cone, hc, 0, cy - 0.17, 0.12, 0.04, 0.08, 0.04, Math.PI, 0, 0)); break;
      case 3: H.add(mesh(G.sphere, hc, 0, cy - 0.1, 0.05, 0.165, 0.12, 0.15)); H.add(mouth); break;
      case 4: H.add(mesh(G.sphere, hc, 0, cy - 0.13, 0.06, 0.17, 0.16, 0.16)); H.add(mesh(G.cone, hc, 0, cy - 0.3, 0.1, 0.06, 0.14, 0.05, Math.PI, 0, 0)); H.add(mouth); break;
      case 5: for (const s of [1, -1]) H.add(mesh(G.box, hc, s * 0.18, cy - 0.03, 0.05, 0.03, 0.12, 0.07)); break;
    }
    if (app.beard === 3 || app.beard === 4) mouth.position.z = 0.205;

    // mask
    const mask = referee ? 'none' : L.mask ?? 'none';
    if (mask === 'luchador' || mask === 'demon') {
      const mm = mask === 'demon' ? this.mk(L.secondary) : this.mk(0xffffff, { map: patternTexture('mask' + app.skin, 'split', L.primary, L.secondary, L.accent) });
      H.add(mesh(G.capDeep, mm, 0, cy - 0.04, 0, 0.207, 0.235, 0.198));
      H.add(mesh(G.sphere, mm, 0, cy - 0.06, 0.02, 0.19, 0.16, 0.17));
      for (const side of [1, -1]) H.add(mesh(G.torus, this.mk(L.accent), side * 0.074, eyeY, 0.19, 0.062, 0.07, 0.4));
      if (mask === 'demon') for (const side of [1, -1]) H.add(mesh(G.cone, this.mk(L.accent, { emissive: L.glow ?? L.accent, emissiveIntensity: 0.4 }), side * 0.12, cy + 0.2, 0.02, 0.04, 0.16, 0.04, 0, 0, -side * 0.5));
    } else if (mask === 'half') {
      H.add(mesh(G.sphere, this.mk(L.secondary), 0, cy - 0.07, 0.035, 0.175, 0.11, 0.17));
    } else if (mask === 'visor') {
      H.add(mesh(G.torus, this.mk(0x111122, { emissive: L.glow ?? L.accent, emissiveIntensity: 1.1 }), 0, eyeY, 0.0, 0.205, 0.2, 0.25, Math.PI / 2, 0, 0));
    }

    // hair
    this.hairAnchor.position.set(0, cy + 0.2, 0);
    H.add(this.hairAnchor);
    if (!(mask === 'luchador' || mask === 'demon')) buildHair(H, this.hairLook.base, hair, cy, this);
    if (this.hairLook.crown) {
      const crown = new Group();
      crown.position.set(0, cy + 0.2, -0.01);
      crown.add(mesh(G.cylOpen, face().gold, 0, 0, 0, 0.13, 0.06, 0.13));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; crown.add(mesh(G.cone, face().gold, Math.cos(a) * 0.13, 0.06, Math.sin(a) * 0.13, 0.025, 0.07, 0.025)); }
      crown.add(mesh(G.octa, this.mk(0xff3b5c, { emissive: 0xff3b5c, emissiveIntensity: 0.6 }), 0, 0.03, 0.135, 0.025, 0.035, 0.015));
      crown.rotation.x = -0.15;
      H.add(crown);
    }
  }

  mk(c: number, o?: Parameters<typeof toon>[1]) { const m = toon(c, o); this.ownMats.push(m); return m; }

  applyPose(p: Pose) {
    for (let i = 0; i < JOINTS.length; i++) this.j[JOINTS[i]].rotation.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    this.body.position.set(p[BODY_OFF], 0.95 + p[BODY_OFF + 1], p[BODY_OFF + 2]);
    this.body.rotation.set(p[BODY_OFF + 3], p[BODY_OFF + 4], p[BODY_OFF + 5]);
  }

  flash(v = 1) { this.flashV = Math.max(this.flashV, v); }
  hurt(t = 0.35) { this.pain = t; }

  update(dt: number) {
    // blink & pain squint
    this.blinkT -= dt;
    let ey = this.app.eyes === 5 ? 0.55 : 1;
    if (this.pain > 0) { this.pain -= dt; ey *= 0.25; }
    else if (this.blinkT < 0) { ey *= 0.1; if (this.blinkT < -0.1) this.blinkT = 2 + Math.random() * 4; }
    for (const e of this.eyes) e.scale.y = ey;
    this.mouth.scale.set(1, this.pain > 0 ? 2.2 : 1, 1);
    if (this.flashV > 0) {
      this.flashV = Math.max(0, this.flashV - dt * 9);
      const f = this.flashV * 0.55;
      for (const b of this.flashBase) { b.m.emissive.copy(b.e).lerp(WHITE, f); b.m.emissiveIntensity = Math.max(b.i, f); }
    }
  }

  worldOf(o: Object3D, out: Vector3, y = 0) { return o.localToWorld(out.set(0, y, 0)); }
  headWorld(out: Vector3) { return this.head.localToWorld(out.set(0, 0.17, 0.05)); }
  chestWorld(out: Vector3) { return this.j.chest.localToWorld(out.set(0, 0.15, 0.1)); }
  handWorld(side: 0 | 1, out: Vector3) { return this.hands[side].localToWorld(out.set(0, 0, 0)); }
  footWorld(side: 0 | 1, out: Vector3) { return this.feet[side].localToWorld(out.set(0, 0, 0.1)); }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => { const m = o as Mesh; if (m.isMesh && m.geometry.userData.baked) m.geometry.dispose(); });
    for (const m of this.ownMats) m.dispose();
  }
}
const WHITE = new Color(1, 1, 1);

function buildHair(H: Group, style: string, mat: MeshToonMaterial, cy: number, rig: Rig) {
  const add = (m: Mesh) => H.add(m);
  const cap = (deep = false, s = 1) => add(mesh(deep ? G.capDeep : G.cap, mat, 0, cy - 0.005, -0.012, 0.212 * s, 0.232 * s, 0.205 * s, -0.25, 0, 0));
  switch (style) {
    case 'careca': break;
    case 'rapado': add(mesh(G.cap, mat, 0, cy, -0.01, 0.205, 0.222, 0.196, -0.3, 0, 0)); break;
    case 'curto':
      cap(true);
      add(mesh(G.sphere, mat, 0.05, cy + 0.17, 0.11, 0.09, 0.05, 0.07, 0.3, 0, 0.2));
      break;
    case 'espetado':
      cap(true);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = 0.12;
        add(mesh(G.cone, mat, Math.cos(a) * r, cy + 0.18, Math.sin(a) * r - 0.01, 0.06, 0.16, 0.06, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7));
      }
      add(mesh(G.cone, mat, 0, cy + 0.26, 0, 0.07, 0.18, 0.07));
      break;
    case 'moicano':
      add(mesh(G.cap, mat, 0, cy, -0.01, 0.204, 0.22, 0.196, -0.3, 0, 0));
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const a = -0.4 + t * 2.0;
        add(mesh(G.cone, mat, 0, cy + Math.cos(a) * 0.2 + 0.07, Math.sin(-a) * 0.2 + 0.04, 0.035, 0.2, 0.08, -a * 0.9, 0, 0));
      }
      break;
    case 'afro':
      add(mesh(G.sphere, mat, 0, cy + 0.1, -0.04, 0.3, 0.27, 0.29));
      add(mesh(G.sphere, mat, 0, cy + 0.02, -0.08, 0.27, 0.22, 0.24));
      break;
    case 'rabo':
      cap(true);
      add(mesh(G.sphere, mat, 0, cy + 0.12, -0.2, 0.06, 0.06, 0.06));
      add(mesh(G.capsule, mat, 0, cy - 0.04, -0.27, 0.05, 0.22, 0.05, 0.35, 0, 0));
      break;
    case 'comprido':
      cap(true, 1.03);
      add(mesh(G.box, mat, 0, cy - 0.06, -0.14, 0.38, 0.4, 0.12, 0.08, 0, 0));
      for (const s of [1, -1]) add(mesh(G.capsule, mat, s * 0.19, cy - 0.06, 0.03, 0.045, 0.24, 0.05));
      break;
    case 'franja':
      cap(true, 1.02);
      add(mesh(G.box, mat, 0.02, cy + 0.14, 0.15, 0.36, 0.09, 0.08, 0.35, 0, -0.15));
      break;
    case 'dreads':
      cap(true);
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * 0.15 + (i / 13) * Math.PI * 1.7;
        add(mesh(G.capsule, mat, Math.cos(a) * 0.19, cy - 0.06, -Math.abs(Math.sin(a)) * 0.17 - 0.02, 0.025, 0.22, 0.025, -0.15, 0, Math.cos(a) * 0.25));
      }
      break;
    case 'coque':
      cap(true);
      add(mesh(G.sphere, mat, 0, cy + 0.24, -0.06, 0.08, 0.075, 0.08));
      add(mesh(G.torus, face().dark, 0, cy + 0.2, -0.05, 0.05, 0.05, 0.3, Math.PI / 2, 0, 0));
      break;
    case 'topete':
      cap(true);
      add(mesh(G.capsule, mat, 0, cy + 0.2, 0.08, 0.1, 0.18, 0.1, Math.PI / 2 - 0.5, 0, 0));
      add(mesh(G.sphere, mat, 0, cy + 0.27, 0.17, 0.11, 0.08, 0.1));
      break;
    case 'cristal':
      cap(true);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        add(mesh(G.octa, mat, Math.cos(a) * 0.1, cy + 0.2 + (i % 2) * 0.04, Math.sin(a) * 0.1 - 0.03, 0.05, 0.14, 0.05, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5));
      }
      add(mesh(G.octa, mat, 0, cy + 0.3, -0.02, 0.07, 0.17, 0.07));
      break;
    case 'super':
      cap(true, 1.04);
      for (let i = 0; i < 11; i++) {
        const a = -1.2 + (i / 10) * 2.4;
        const up = 0.9 - Math.abs(a) * 0.25;
        add(mesh(G.cone, mat, Math.sin(a) * 0.14, cy + 0.18 + up * 0.06, -0.06 - Math.cos(a) * 0.03, 0.07, 0.3, 0.07, -0.65, 0, -a * 0.75));
      }
      for (let i = 0; i < 3; i++) add(mesh(G.cone, mat, (i - 1) * 0.09, cy + 0.17, 0.15, 0.04, 0.14, 0.04, 1.2, 0, (i - 1) * 0.4));
      break;
    case 'chamas':
      cap(true, 1.02);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        add(mesh(G.cone, mat, Math.cos(a) * 0.1, cy + 0.24, Math.sin(a) * 0.1 - 0.04, 0.07, 0.26 + (i % 3) * 0.06, 0.07, Math.sin(a) * 0.4 - 0.3, 0, -Math.cos(a) * 0.4));
      }
      add(mesh(G.cone, mat, 0, cy + 0.36, -0.06, 0.09, 0.34, 0.09, -0.3, 0, 0));
      break;
    default:
      cap(true);
  }
  void rig;
}

const baked = new WeakSet<Object3D>();
function bake(group: Object3D) {
  if (baked.has(group)) return;
  baked.add(group);
  const byMat = new Map<Material, Mesh[]>();
  for (const c of group.children) {
    const m = c as Mesh;
    if (!m.isMesh || Array.isArray(m.material)) continue;
    const list = byMat.get(m.material as Material) ?? [];
    list.push(m);
    byMat.set(m.material as Material, list);
  }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.clone() : m.geometry.clone();
      return g.applyMatrix4(m.matrix);
    });
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.userData.baked = true;
    for (const m of list) group.remove(m);
    group.add(new Mesh(merged, mat));
  }
}
