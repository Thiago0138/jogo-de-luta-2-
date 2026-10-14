// ─────────────────────────────────────────────────────────────────────────────
//  GPU-cheap effects: pooled instanced particles (one draw call per blend mode),
//  shockwave rings, light pillars and lightning ribbons.
// ─────────────────────────────────────────────────────────────────────────────
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedBufferAttribute,
  InstancedMesh, Mesh, MeshBasicMaterial, NormalBlending, PlaneGeometry, RingGeometry, ShaderMaterial, Vector3, Blending,
} from 'three';

export const enum Shape { Soft = 0, Spark = 1, Square = 2, Ring = 3 }

interface P {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  life: number; max: number; size: number; size1: number; r: number; g: number; b: number; g0: number; drag: number; shape: number; rot: number; vr: number;
}

class ParticlePool {
  mesh: InstancedMesh;
  private ps: P[] = [];
  private free: P[] = [];
  private aOff: InstancedBufferAttribute;
  private aCol: InstancedBufferAttribute;
  private aMisc: InstancedBufferAttribute;
  constructor(private cap: number, blending: Blending) {
    const geo = new PlaneGeometry(1, 1);
    this.aOff = new InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.aCol = new InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.aMisc = new InstancedBufferAttribute(new Float32Array(cap * 3), 3); // size, shape, rot
    for (const a of [this.aOff, this.aCol, this.aMisc]) a.setUsage(35048 /* DynamicDrawUsage */);
    geo.setAttribute('aOff', this.aOff);
    geo.setAttribute('aCol', this.aCol);
    geo.setAttribute('aMisc', this.aMisc);
    const mat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending,
      vertexShader: /* glsl */ `
        attribute vec3 aOff; attribute vec4 aCol; attribute vec3 aMisc;
        varying vec2 vUv; varying vec4 vCol; varying float vShape;
        void main(){
          vUv = uv; vCol = aCol; vShape = aMisc.y;
          vec4 mv = viewMatrix * vec4(aOff, 1.0);
          float c = cos(aMisc.z), s = sin(aMisc.z);
          vec2 p = mat2(c, s, -s, c) * position.xy;
          if (aMisc.y > 0.5 && aMisc.y < 1.5) p.y *= 2.6;
          mv.xy += p * aMisc.x;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec4 vCol; varying float vShape;
        void main(){
          vec2 q = vUv - 0.5;
          float a;
          if (vShape < 0.5) { a = smoothstep(0.5, 0.0, length(q)); a *= a; }
          else if (vShape < 1.5) { a = smoothstep(0.5, 0.05, length(q * vec2(1.0, 1.0))); }
          else if (vShape < 2.5) { a = 1.0; }
          else { float d = length(q); a = smoothstep(0.08, 0.0, abs(d - 0.38)); }
          gl_FragColor = vec4(vCol.rgb, vCol.a * a);
        }`,
    });
    this.mesh = new InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  spawn(o: Partial<P> & { x: number; y: number; z: number }) {
    if (this.ps.length >= this.cap) return;
    const p = this.free.pop() ?? ({} as P);
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.vz = o.vz ?? 0;
    p.max = p.life = o.life ?? 0.6;
    p.size = o.size ?? 0.2; p.size1 = o.size1 ?? 0;
    p.r = o.r ?? 1; p.g = o.g ?? 1; p.b = o.b ?? 1;
    p.g0 = o.g0 ?? 0; p.drag = o.drag ?? 0; p.shape = o.shape ?? 0; p.rot = o.rot ?? Math.random() * 6.28; p.vr = o.vr ?? 0;
    this.ps.push(p);
  }

  update(dt: number) {
    const off = this.aOff.array as Float32Array, col = this.aCol.array as Float32Array, misc = this.aMisc.array as Float32Array;
    let n = 0;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.ps[i] = this.ps[this.ps.length - 1]; this.ps.pop(); this.free.push(p); continue; }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy = p.vy * k - p.g0 * dt; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.g0 > 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.vr * dt;
    }
    for (const p of this.ps) {
      const t = 1 - p.life / p.max;
      off[n * 3] = p.x; off[n * 3 + 1] = p.y; off[n * 3 + 2] = p.z;
      col[n * 4] = p.r; col[n * 4 + 1] = p.g; col[n * 4 + 2] = p.b; col[n * 4 + 3] = Math.min(1, (1 - t) * 1.6);
      misc[n * 3] = p.size + (p.size1 - p.size) * t; misc[n * 3 + 1] = p.shape; misc[n * 3 + 2] = p.rot;
      n++;
    }
    this.mesh.count = n;
    if (n) { this.aOff.needsUpdate = true; this.aCol.needsUpdate = true; this.aMisc.needsUpdate = true; }
  }
  clear() { while (this.ps.length) this.free.push(this.ps.pop()!); this.mesh.count = 0; }
}

interface Timed { mesh: Mesh; t: number; dur: number; kind: 'ring' | 'pillar' | 'bolt'; s0: number; s1: number; op: number }

const tmpC = new Color();
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  root = new Group();
  add: ParticlePool;
  norm: ParticlePool;
  private timed: Timed[] = [];
  private ringGeo = new RingGeometry(0.82, 1, 48);
  private pillarGeo = new CylinderGeometry(1, 1, 1, 24, 1, true);
  /** quality multiplier for particle counts */
  density = 1;

  constructor(quality: 'low' | 'medium' | 'high') {
    this.density = quality === 'low' ? 0.45 : quality === 'medium' ? 0.75 : 1;
    this.add = new ParticlePool(quality === 'low' ? 500 : 1200, AdditiveBlending);
    this.norm = new ParticlePool(quality === 'low' ? 250 : 600, NormalBlending);
    this.pillarGeo.translate(0, 0.5, 0);
    this.root.add(this.add.mesh, this.norm.mesh);
  }

  private n(count: number) { return Math.max(1, Math.round(count * this.density)); }

  /** punch / kick impact: hot flash + sparks + sweat */
  hit(pos: Vector3, power: number, color = 0xffe7a0) {
    tmpC.setHex(color);
    this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, size: 0.3 + power * 0.5, size1: 1.0 + power * 1.4, life: 0.16, r: 1, g: 0.95, b: 0.85 });
    this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, size: 0.2, size1: 0.9 + power * 1.1, life: 0.22, shape: Shape.Ring, r: tmpC.r, g: tmpC.g, b: tmpC.b });
    for (let i = 0; i < this.n(6 + power * 12); i++) {
      const a = Math.random() * Math.PI * 2, u = rnd(-1, 1), sp = rnd(2.5, 6) * (0.6 + power);
      const s = Math.sqrt(1 - u * u);
      this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * s * sp, vy: u * sp + 1.5, vz: Math.sin(a) * s * sp, g0: 9, drag: 2.5, life: rnd(0.2, 0.45), size: rnd(0.04, 0.08), size1: 0.01, shape: Shape.Spark, r: tmpC.r, g: tmpC.g, b: tmpC.b });
    }
    for (let i = 0; i < this.n(3 + power * 5); i++) {
      this.norm.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rnd(-2, 2), vy: rnd(0.5, 3), vz: rnd(-2, 2), g0: 9.8, life: rnd(0.4, 0.7), size: rnd(0.03, 0.06), size1: 0.02, r: 0.75, g: 0.9, b: 1 });
    }
  }

  block(pos: Vector3) {
    this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, size: 0.4, size1: 1.1, life: 0.2, shape: Shape.Ring, r: 0.4, g: 0.8, b: 1 });
    for (let i = 0; i < this.n(8); i++) this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rnd(-3, 3), vy: rnd(-1, 3), vz: rnd(-3, 3), drag: 4, life: 0.25, size: 0.05, shape: Shape.Spark, r: 0.5, g: 0.85, b: 1 });
  }

  /** body hitting the canvas: dust puff + floor ring */
  slam(pos: Vector3, power: number) {
    for (let i = 0; i < this.n(10 + power * 16); i++) {
      const a = Math.random() * Math.PI * 2, sp = rnd(1, 3.5) * (0.5 + power);
      this.norm.spawn({ x: pos.x + Math.cos(a) * 0.3, y: 0.08, z: pos.z + Math.sin(a) * 0.3, vx: Math.cos(a) * sp, vy: rnd(0.2, 1.2), vz: Math.sin(a) * sp, drag: 3.5, life: rnd(0.5, 0.9), size: rnd(0.2, 0.35), size1: rnd(0.5, 0.9), r: 0.55, g: 0.55, b: 0.7 });
    }
    this.shock(pos, 0x9fb0ff, 0.6 + power * 1.8, 0.35, 0.55);
  }

  shock(pos: Vector3, color: number, size: number, dur = 0.45, opacity = 0.8) {
    const m = new Mesh(this.ringGeo, new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, Math.max(0.03, pos.y), pos.z);
    this.root.add(m);
    this.timed.push({ mesh: m, t: 0, dur, kind: 'ring', s0: 0.2, s1: size, op: opacity });
  }

  pillar(pos: Vector3, color: number, radius: number, height: number, dur: number, opacity = 0.6) {
    const m = new Mesh(this.pillarGeo, new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    m.position.copy(pos);
    m.scale.set(radius, height, radius);
    this.root.add(m);
    this.timed.push({ mesh: m, t: 0, dur, kind: 'pillar', s0: radius, s1: radius * 0.2, op: opacity });
  }

  /** jagged lightning ribbon between two points */
  bolt(a: Vector3, b: Vector3, color = 0xbfe9ff, width = 0.08, dur = 0.25) {
    const segs = 10;
    const pts: Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = a.clone().lerp(b, t);
      if (i > 0 && i < segs) p.add(new Vector3(rnd(-0.25, 0.25), rnd(-0.25, 0.25), rnd(-0.25, 0.25)));
      pts.push(p);
    }
    const pos = new Float32Array((segs + 1) * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const p = pts[i];
      pos.set([p.x - width, p.y, p.z, p.x + width, p.y, p.z], i * 6);
      if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setIndex(idx);
    // second ribbon rotated 90° so it reads from any angle
    const pos2 = new Float32Array(pos.length);
    for (let i = 0; i <= segs; i++) { const p = pts[i]; pos2.set([p.x, p.y, p.z - width, p.x, p.y, p.z + width], i * 6); }
    const geo2 = new BufferGeometry();
    geo2.setAttribute('position', new BufferAttribute(pos2, 3));
    geo2.setIndex(idx);
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    for (const g of [geo, geo2]) {
      const m = new Mesh(g, mat.clone());
      this.root.add(m);
      this.timed.push({ mesh: m, t: 0, dur, kind: 'bolt', s0: 1, s1: 1, op: 1 });
    }
  }

  /** elemental burst used by specials */
  burst(pos: Vector3, kind: 'fire' | 'ice' | 'spark' | 'cosmic' | 'gold' | 'toxic' | 'shadow', amount = 1) {
    const n = this.n(28 * amount);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = rnd(-0.3, 1), sp = rnd(1.5, 5) * Math.sqrt(amount);
      const s = Math.sqrt(1 - Math.min(1, u * u));
      let r = 1, g = 1, b = 1, g0 = 0, size = rnd(0.12, 0.3), life = rnd(0.4, 0.9), shape = Shape.Soft, vyb = 0;
      switch (kind) {
        case 'fire': { const t = Math.random(); r = 1; g = 0.35 + t * 0.5; b = 0.08; g0 = -3; vyb = 1; break; }
        case 'ice': r = 0.7; g = 0.9; b = 1; g0 = 5; shape = Shape.Spark; size = rnd(0.06, 0.12); break;
        case 'spark': r = 1; g = 0.95; b = 0.45; shape = Shape.Spark; size = rnd(0.04, 0.09); g0 = 6; break;
        case 'cosmic': tmpC.setHSL(Math.random(), 0.9, 0.65); r = tmpC.r; g = tmpC.g; b = tmpC.b; break;
        case 'gold': r = 1; g = 0.8; b = 0.3; shape = Math.random() < 0.5 ? Shape.Spark : Shape.Soft; g0 = 3; break;
        case 'toxic': r = 0.5; g = 1; b = 0.2; g0 = -1; break;
        case 'shadow': r = 0.55; g = 0.25; b = 1; g0 = -1.5; break;
      }
      this.add.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * s * sp, vy: u * sp + vyb, vz: Math.sin(a) * s * sp, g0, drag: 2.2, life, size, size1: size * 0.2, shape, r, g, b });
    }
  }

  /** continuous emitter used for auras / burning hair; call each frame */
  emit(pos: Vector3, color: number | 'rainbow', rate: number, dt: number, spread = 0.35, rise = 1.2, size = 0.12) {
    let count = rate * dt * this.density;
    while (count > 0) {
      if (count < 1 && Math.random() > count) break;
      count--;
      if (color === 'rainbow') tmpC.setHSL((performance.now() * 0.0003 + Math.random() * 0.3) % 1, 0.9, 0.62); else tmpC.setHex(color);
      this.add.spawn({ x: pos.x + rnd(-spread, spread), y: pos.y + rnd(-spread, spread) * 1.6, z: pos.z + rnd(-spread, spread), vx: rnd(-0.2, 0.2), vy: rise * rnd(0.6, 1.2), vz: rnd(-0.2, 0.2), life: rnd(0.4, 0.8), size, size1: 0, r: tmpC.r, g: tmpC.g, b: tmpC.b });
    }
  }

  confetti(center: Vector3, amount = 160) {
    const cols = [0xff2e88, 0x22d3ee, 0xffd23f, 0x4ade80, 0xa855f7, 0xffffff];
    for (let i = 0; i < this.n(amount); i++) {
      tmpC.setHex(cols[i % cols.length]);
      this.norm.spawn({ x: center.x + rnd(-4, 4), y: center.y + rnd(4, 7), z: center.z + rnd(-4, 4), vx: rnd(-0.6, 0.6), vy: rnd(-1.5, -0.4), vz: rnd(-0.6, 0.6), g0: 0.6, drag: 0.4, life: rnd(3, 5), size: rnd(0.06, 0.1), size1: 0.06, shape: Shape.Square, vr: rnd(-8, 8), r: tmpC.r, g: tmpC.g, b: tmpC.b });
    }
  }

  update(dt: number) {
    this.add.update(dt);
    this.norm.update(dt);
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const e = this.timed[i];
      e.t += dt;
      const k = e.t / e.dur;
      const mat = e.mesh.material as MeshBasicMaterial;
      if (k >= 1) {
        this.root.remove(e.mesh);
        mat.dispose();
        if (e.kind === 'bolt') e.mesh.geometry.dispose();
        this.timed.splice(i, 1);
        continue;
      }
      if (e.kind === 'ring') { const s = e.s0 + (e.s1 - e.s0) * (1 - Math.pow(1 - k, 3)); e.mesh.scale.set(s, s, s); mat.opacity = e.op * (1 - k); }
      else if (e.kind === 'pillar') { const s = e.s0 + (e.s1 - e.s0) * k; e.mesh.scale.x = e.mesh.scale.z = s; mat.opacity = e.op * (1 - k * k); }
      else { mat.opacity = Math.random() < 0.3 ? 0.3 : 1 - k; }
    }
  }

  clear() {
    this.add.clear(); this.norm.clear();
    for (const e of this.timed) { this.root.remove(e.mesh); (e.mesh.material as MeshBasicMaterial).dispose(); if (e.kind === 'bolt') e.mesh.geometry.dispose(); }
    this.timed.length = 0;
  }
}
