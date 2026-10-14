// ─────────────────────────────────────────────────────────────────────────────
//  The arena: ring, ropes, apron, stands, instanced crowd, light rig, screen.
//  Static geometry is merged per material to keep draw calls very low.
// ─────────────────────────────────────────────────────────────────────────────
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, Fog, Group,
  HemisphereLight, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry,
  ShaderMaterial, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex, Gfx, radialTex, sharedToon, toon } from './gfx';

export const RING = {
  half: 3.0, // playable half-size (inside the ropes)
  rope: 3.2,
  post: 3.38,
  apron: 3.75,
  floorY: -1.15,
  ropeY: [0.42, 0.82, 1.22],
  postTop: 1.42,
};

export const CORNERS = {
  red: new Vector3(-RING.post, 0, -RING.post),
  blue: new Vector3(RING.post, 0, RING.post),
  n1: new Vector3(RING.post, 0, -RING.post),
  n2: new Vector3(-RING.post, 0, RING.post),
};

type Geo = BufferGeometry;
function place(g: Geo, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Geo {
  const o = new Object3D();
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.updateMatrix();
  return g.clone().applyMatrix4(o.matrix);
}

export class Arena {
  root = new Group();
  private crowdMat!: ShaderMaterial;
  private beams: Mesh[] = [];
  private beamMat!: MeshBasicMaterial;
  private screenTex!: CanvasTexture;
  private screenCanvas!: HTMLCanvasElement;
  private hemi: HemisphereLight;
  private key: DirectionalLight;
  private baseHemi = 1.05;
  private baseKey = 1.7;
  private dim = 0;
  private dimTarget = 0;
  excitement = 0.25;
  private t = 0;
  private fog: Fog;

  constructor(gfx: Gfx, quality: 'low' | 'medium' | 'high') {
    const scene = gfx.scene;
    this.fog = new Fog(0x0b0b1f, 18, 46);
    scene.fog = this.fog;
    this.hemi = new HemisphereLight(0xaab6ff, 0x2a1838, this.baseHemi);
    this.key = new DirectionalLight(0xfff4e6, this.baseKey);
    this.key.position.set(3, 10, 6);
    scene.add(this.hemi, this.key);
    this.buildRing();
    this.buildFloor();
    this.buildStands(quality);
    this.buildRig();
    this.buildScreen();
    scene.add(this.root);
  }

  private buildRing() {
    const { half, rope, post, apron, floorY, ropeY, postTop } = RING;
    // mat with logo
    const matTex = canvasTex(1024, 1024, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.72);
      gr.addColorStop(0, '#3c3f8f');
      gr.addColorStop(0.6, '#262a6b');
      gr.addColorStop(1, '#14173f');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // canvas weave
      g.globalAlpha = 0.05; g.fillStyle = '#fff';
      for (let i = 0; i < w; i += 8) { g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
      g.globalAlpha = 1;
      // inner border
      g.strokeStyle = '#ff2e88'; g.lineWidth = 14; g.strokeRect(36, 36, w - 72, h - 72);
      g.strokeStyle = '#22d3ee'; g.lineWidth = 5; g.strokeRect(62, 62, w - 124, h - 124);
      // center emblem
      g.save(); g.translate(w / 2, h / 2);
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(0, 0, 210, 0, Math.PI * 2); g.fillStyle = 'rgba(10,10,40,.55)'; g.fill();
      g.lineWidth = 10; g.strokeStyle = '#ffd23f'; g.stroke();
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? 70 : 160; g.lineTo(Math.cos(a) * r, Math.sin(a) * r - 20); }
      g.closePath(); g.fillStyle = '#ffd23f'; g.fill();
      g.font = '900 64px "Russo One", system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffffff';
      g.fillText('RINGUE', 0, 150);
      g.font = '700 30px "Russo One", system-ui, sans-serif'; g.fillStyle = '#ff2e88';
      g.fillText('DE LENDAS', 0, 188);
      g.restore();
    });
    const matSize = apron * 2;
    const mat = new Mesh(new BoxGeometry(matSize, 0.16, matSize), [
      sharedToon(0x1a1d4a), sharedToon(0x1a1d4a), toon(0xffffff, { map: matTex, rim: false }), sharedToon(0x1a1d4a), sharedToon(0x1a1d4a), sharedToon(0x1a1d4a),
    ]);
    mat.position.y = -0.08;
    this.root.add(mat);

    // apron skirt with branding
    const skirtTex = canvasTex(1024, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#1b1446'); gr.addColorStop(1, '#0a0820');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ff2e88'; g.fillRect(0, 0, w, 8);
      g.font = '900 56px "Russo One", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffffff'; g.fillText('RINGUE DE LENDAS', w * 0.3, h / 2 + 6);
      g.fillStyle = '#ffd23f'; g.fillText('★ ★ ★', w * 0.78, h / 2 + 6);
    });
    const skirtH = -floorY - 0.16;
    const skirtGeo: Geo[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      skirtGeo.push(place(new PlaneGeometry(matSize, skirtH), Math.sin(a) * apron, -0.16 - skirtH / 2, Math.cos(a) * apron, 0, a, 0));
    }
    const skirt = new Mesh(mergeGeometries(skirtGeo), toon(0xffffff, { map: skirtTex, rim: false }));
    this.root.add(skirt);

    // posts
    const postGeo: Geo[] = [];
    const padGeo: { red: Geo[]; blue: Geo[]; white: Geo[] } = { red: [], blue: [], white: [] };
    const corners: [number, number, keyof typeof padGeo][] = [[-1, -1, 'red'], [1, 1, 'blue'], [1, -1, 'white'], [-1, 1, 'white']];
    for (const [sx, sz, col] of corners) {
      postGeo.push(place(new CylinderGeometry(0.07, 0.07, postTop + 0.2, 10), sx * post, (postTop - 0.2) / 2, sz * post));
      for (const y of ropeY) {
        const pad = new BoxGeometry(0.24, 0.3, 0.24);
        padGeo[col].push(place(pad, sx * (post - 0.07), y, sz * (post - 0.07), 0, Math.PI / 4, 0));
      }
    }
    this.root.add(new Mesh(mergeGeometries(postGeo), sharedToon(0xd8dbe6)));
    this.root.add(new Mesh(mergeGeometries(padGeo.red), sharedToon(0xe11d48)));
    this.root.add(new Mesh(mergeGeometries(padGeo.blue), sharedToon(0x2563eb)));
    this.root.add(new Mesh(mergeGeometries(padGeo.white), sharedToon(0xf1f1f6)));

    // ropes: 3 levels, colored top/mid/bottom
    const ropeColors = [0xff2e88, 0xffffff, 0x22d3ee];
    ropeY.forEach((y, li) => {
      const geos: Geo[] = [];
      const len = post * 2;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const g = new CylinderGeometry(0.035, 0.035, len, 6);
        geos.push(place(g, Math.sin(a) * rope, y, Math.cos(a) * rope, 0, a, Math.PI / 2));
      }
      const m = new Mesh(mergeGeometries(geos), toon(ropeColors[2 - li], { emissive: ropeColors[2 - li], emissiveIntensity: 0.25 }));
      this.root.add(m);
    });

    // steps at two corners
    const stepGeo: Geo[] = [];
    for (const [sx, sz] of [[-1, -1], [1, 1]] as const) {
      for (let s = 0; s < 3; s++) {
        stepGeo.push(place(new BoxGeometry(0.9, 0.36, 0.5), sx * (apron + 0.35 + s * 0.45) * 0.72, floorY + 0.18 + (2 - s) * 0.32, sz * (apron + 0.35 + s * 0.45) * 0.72, 0, Math.PI / 4, 0));
      }
    }
    this.root.add(new Mesh(mergeGeometries(stepGeo), sharedToon(0x3a3f5c)));
    void half;
  }

  private buildFloor() {
    const { floorY } = RING;
    const floorTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#0d0c22'; g.fillRect(0, 0, w, h);
      const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(120,90,255,.35)'); gr.addColorStop(0.5, 'rgba(255,46,136,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const floor = new Mesh(new PlaneGeometry(60, 60), new MeshBasicMaterial({ map: floorTex, color: 0xffffff }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    this.root.add(floor);
    // barricades
    const bGeo: Geo[] = [];
    const d = 7.0;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      bGeo.push(place(new BoxGeometry(d * 2, 0.9, 0.12), Math.sin(a) * d, floorY + 0.45, Math.cos(a) * d, 0, a, 0));
    }
    this.root.add(new Mesh(mergeGeometries(bGeo), sharedToon(0x1f2340)));
    const tGeo: Geo[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      tGeo.push(place(new BoxGeometry(d * 2, 0.06, 0.16), Math.sin(a) * d, floorY + 0.92, Math.cos(a) * d, 0, a, 0));
    }
    this.root.add(new Mesh(mergeGeometries(tGeo), new MeshBasicMaterial({ color: 0xff2e88 })));
  }

  private buildStands(quality: 'low' | 'medium' | 'high') {
    const { floorY } = RING;
    const rows = quality === 'low' ? 6 : quality === 'medium' ? 9 : 12;
    const spacing = quality === 'low' ? 0.78 : 0.6;
    // stepped bleachers
    const stepGeos: Geo[] = [];
    const seats: { x: number; y: number; z: number }[] = [];
    for (let side = 0; side < 4; side++) {
      const a = (side * Math.PI) / 2;
      for (let r = 0; r < rows; r++) {
        const dist = 8.4 + r * 0.9;
        const y = floorY + 0.3 + r * 0.55;
        const len = dist * 2;
        stepGeos.push(place(new BoxGeometry(len, 0.55, 0.9), Math.sin(a) * dist, y - 0.28, Math.cos(a) * dist, 0, a, 0));
        const n = Math.floor(len / spacing);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.06) continue;
          const u = -dist + (i + 0.5) * spacing + (Math.random() - 0.5) * 0.12;
          // rotate (u, dist) by side
          const px = Math.sin(a) * dist + Math.cos(a) * u;
          const pz = Math.cos(a) * dist - Math.sin(a) * u;
          seats.push({ x: px, y: y + 0.42, z: pz });
        }
      }
    }
    this.root.add(new Mesh(mergeGeometries(stepGeos), sharedToon(0x15142e)));

    // instanced crowd: camera-facing silhouettes drawn procedurally in the shader
    const geo = new PlaneGeometry(0.62, 0.95);
    geo.translate(0, 0.45, 0);
    this.crowdMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uExcite: { value: 0.2 }, uDim: { value: 0 }, fogColor: { value: new Color(0x0b0b1f) }, fogNear: { value: 18 }, fogFar: { value: 46 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aPhase;
        uniform float uTime; uniform float uExcite;
        varying vec2 vUv; varying vec3 vColor; varying float vFlash; varying float vFogDepth; varying float vArms;
        float hash(float n){ return fract(sin(n)*43758.5453); }
        void main(){
          vUv = uv; vColor = aColor;
          vec4 world = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
          float speed = 5.0 + aPhase * 3.0;
          float jump = max(0.0, sin(uTime * speed + aPhase * 30.0)) * (0.04 + uExcite * 0.22);
          vArms = step(0.55 - uExcite * 0.5, hash(aPhase * 91.0 + floor(uTime * 0.7 + aPhase * 3.0)));
          // cylindrical billboard
          vec3 toCam = normalize(vec3(cameraPosition.x - world.x, 0.0, cameraPosition.z - world.z));
          vec3 right = vec3(toCam.z, 0.0, -toCam.x);
          vec3 pos = world.xyz + right * position.x + vec3(0.0, position.y + jump, 0.0);
          float f = hash(aPhase * 77.0 + floor(uTime * 6.0));
          vFlash = step(0.9993 - uExcite * 0.0008, f);
          vec4 mv = viewMatrix * vec4(pos, 1.0);
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uDim; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        varying vec2 vUv; varying vec3 vColor; varying float vFlash; varying float vFogDepth; varying float vArms;
        void main(){
          vec2 p = vUv;
          float head = length((p - vec2(0.5, 0.76)) * vec2(1.0, 1.05)) - 0.17;
          vec2 b = abs(p - vec2(0.5, 0.3)) - vec2(0.36, 0.3);
          float body = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - 0.08;
          float armL = length(max(abs(p - vec2(0.2, 0.8)) - vec2(0.04, 0.17), 0.0)) - 0.03;
          float armR = length(max(abs(p - vec2(0.8, 0.8)) - vec2(0.04, 0.17), 0.0)) - 0.03;
          float arms = mix(1.0, min(armL, armR), vArms);
          float d = min(min(head, body), arms);
          if (d > 0.0) discard;
          vec3 col = vColor * (0.5 + 0.5 * p.y) * (1.0 - uDim * 0.75);
          col += vColor * 0.6 * smoothstep(0.02, -0.02, d + 0.03) * step(0.62, p.y);
          col += vec3(1.0) * vFlash * 0.9 * step(0.5, p.y);
          float fogF = smoothstep(fogNear, fogFar, vFogDepth);
          gl_FragColor = vec4(mix(col, fogColor, fogF), 1.0);
        }`,
    });
    const mesh = new InstancedMesh(geo, this.crowdMat, seats.length);
    const colors = new Float32Array(seats.length * 3);
    const phase = new Float32Array(seats.length);
    const palette = [0xff2e88, 0x22d3ee, 0xffd23f, 0x7c3aed, 0xf97316, 0x4ade80, 0xe5e7eb, 0x3b82f6, 0xef4444, 0x9ca3af];
    const m = new Matrix4();
    const c = new Color();
    seats.forEach((s, i) => {
      m.makeTranslation(s.x, s.y, s.z);
      mesh.setMatrixAt(i, m);
      c.setHex(palette[Math.floor(Math.random() * palette.length)]).multiplyScalar(0.18 + Math.random() * 0.26);
      colors.set([c.r, c.g, c.b], i * 3);
      phase[i] = Math.random();
    });
    geo.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
    geo.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1));
    mesh.frustumCulled = false;
    this.root.add(mesh);
  }

  private buildRig() {
    // overhead truss
    const trussGeo: Geo[] = [];
    const s = 4.4, y = 7.2;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      trussGeo.push(place(new BoxGeometry(s * 2 + 0.3, 0.22, 0.22), Math.sin(a) * s, y, Math.cos(a) * s, 0, a, 0));
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      trussGeo.push(place(new CylinderGeometry(0.16, 0.2, 0.32, 8), Math.cos(a) * s * 1.02, y - 0.25, Math.sin(a) * s * 1.02));
    }
    this.root.add(new Mesh(mergeGeometries(trussGeo), sharedToon(0x2b2d42)));
    // light cones
    const beamTex = canvasTex(16, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,.12)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    this.beamMat = new MeshBasicMaterial({ map: beamTex, color: 0xbfd0ff, transparent: true, opacity: 0.07, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
    const coneGeo = new ConeGeometry(1.7, 8, 20, 1, true);
    coneGeo.translate(0, -4, 0);
    const colors = [0xbfd0ff, 0xff9fd0, 0xbfd0ff, 0x9ff5ff];
    for (let i = 0; i < 4; i++) {
      const mat = this.beamMat.clone();
      mat.color.setHex(colors[i]);
      const cone = new Mesh(coneGeo, mat);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      cone.position.set(Math.cos(a) * 4.2, 7.0, Math.sin(a) * 4.2);
      const dir = new Vector3(-Math.cos(a) * 3.2, -7, -Math.sin(a) * 3.2).normalize();
      cone.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), dir);
      cone.userData.a = a;
      this.beams.push(cone);
      this.root.add(cone);
    }
    // soft light pool on the ring
    const pool = new Mesh(new PlaneGeometry(9, 9), new MeshBasicMaterial({ map: radialTex(), color: 0x6f6aff, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.012;
    this.root.add(pool);
    // little hanging lamps glow
    const bulbs = new InstancedMesh(new SphereGeometry(0.12, 8, 6), new MeshBasicMaterial({ color: 0xfff4d6, fog: false }), 8);
    const m = new Matrix4();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; m.makeTranslation(Math.cos(a) * s * 1.02, y - 0.45, Math.sin(a) * s * 1.02); bulbs.setMatrixAt(i, m); }
    this.root.add(bulbs);
  }

  private buildScreen() {
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512; this.screenCanvas.height = 256;
    this.screenTex = new CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = 'srgb';
    this.setScreen('RINGUE DE LENDAS', 'O MAIOR ESPETÁCULO');
    const scr = new Mesh(new PlaneGeometry(9, 4.5), new MeshBasicMaterial({ map: this.screenTex, fog: false }));
    scr.position.set(0, 7.5, -19);
    const frame = new Mesh(new BoxGeometry(9.5, 5, 0.3), sharedToon(0x111122));
    frame.position.set(0, 7.5, -19.2);
    this.root.add(frame, scr);
    const scr2 = scr.clone(); scr2.position.set(0, 7.5, 19); scr2.rotation.y = Math.PI;
    const frame2 = frame.clone(); frame2.position.set(0, 7.5, 19.2);
    this.root.add(frame2, scr2);
  }

  setScreen(title: string, sub: string, colorA = '#ff2e88', colorB = '#22d3ee') {
    const g = this.screenCanvas.getContext('2d')!;
    const w = 512, h = 256;
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#120a3a'); gr.addColorStop(1, '#2a0b3a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = colorA; g.fillRect(0, 0, w, 10);
    g.fillStyle = colorB; g.fillRect(0, h - 10, w, 10);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 46px "Russo One", system-ui, sans-serif';
    g.fillStyle = '#fff';
    g.fillText(title.toUpperCase(), w / 2, h / 2 - 22, w - 30);
    g.font = '700 26px "Russo One", system-ui, sans-serif';
    g.fillStyle = '#ffd23f';
    g.fillText(sub.toUpperCase(), w / 2, h / 2 + 34, w - 30);
    this.screenTex.needsUpdate = true;
  }

  /** dim the house lights (0..1) e.g. for super attacks */
  setDim(v: number) { this.dimTarget = v; }

  update(dt: number) {
    this.t += dt;
    this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 6);
    this.excitement = Math.max(0.15, this.excitement - dt * 0.08);
    this.crowdMat.uniforms.uTime.value = this.t;
    this.crowdMat.uniforms.uExcite.value = this.excitement;
    this.crowdMat.uniforms.uDim.value = this.dim;
    this.hemi.intensity = this.baseHemi * (1 - this.dim * 0.65);
    this.key.intensity = this.baseKey * (1 - this.dim * 0.5);
    for (const b of this.beams) {
      const a = b.userData.a + Math.sin(this.t * 0.4 + b.userData.a) * 0.15;
      b.position.set(Math.cos(a) * 4.2, 7.0, Math.sin(a) * 4.2);
      (b.material as MeshBasicMaterial).opacity = 0.05 + this.excitement * 0.06 + this.dim * 0.05;
    }
  }

  hype(v: number) { this.excitement = Math.min(1, this.excitement + v); }
}
