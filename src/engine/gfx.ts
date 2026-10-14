// ─────────────────────────────────────────────────────────────────────────────
//  Renderer, adaptive resolution, shared toon materials.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ACESFilmicToneMapping, Color, DataTexture, LinearSRGBColorSpace, MeshBasicMaterial, MeshToonMaterial, NearestFilter,
  PerspectiveCamera, RedFormat, Scene, SRGBColorSpace, WebGLRenderer, CanvasTexture, Texture, RepeatWrapping,
} from 'three';

export type Quality = 'low' | 'medium' | 'high';

export class Gfx {
  renderer: WebGLRenderer;
  scene = new Scene();
  camera = new PerspectiveCamera(42, 1, 0.1, 220);
  quality: Quality = 'high';
  auto = true;
  /** current render scale multiplier applied on top of device pixel ratio */
  scale = 1;
  private maxDpr = 2;
  private frameTimes: number[] = [];
  private lastAdjust = 0;
  width = 1;
  height = 1;

  constructor(canvas: HTMLCanvasElement) {
    // MSAA only where pixels are big (desktops); dense phone screens hide aliasing for free
    this.renderer = new WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 1.75, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new Color(0x0b0b1f);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q: 'auto' | Quality) {
    this.auto = q === 'auto';
    this.quality = q === 'auto' ? (isLowEndDevice() ? 'medium' : 'high') : q;
    this.maxDpr = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
    // MSAA on a big framebuffer is the most expensive thing on phones; we only
    // afford it through the higher pixel ratio on 'high'.
    this.scale = 1;
    this.applySize();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.applySize();
  }

  private applySize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr) * this.scale;
    this.renderer.setPixelRatio(Math.max(0.5, dpr));
    this.renderer.setSize(this.width, this.height, false);
  }

  /** Adaptive resolution: trade pixels for frame time. Changes are rare and
   *  one-directional-biased so the canvas never oscillates (each resize blanks a frame). */
  private drops = 0;
  sample(dt: number, now: number) {
    if (!this.auto || document.hidden) return;
    if (dt > 0.25) { this.frameTimes.length = 0; return; } // tab switch / hitch, ignore
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    if (this.frameTimes.length < 90) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p80 = sorted[Math.floor(sorted.length * 0.8)];
    const since = now - this.lastAdjust;
    if (p80 > 1 / 45 && this.scale > 0.6 && since > 3000) {
      this.scale = Math.max(0.6, this.scale - 0.15);
      this.drops++;
      this.applySize();
      this.lastAdjust = now;
      this.frameTimes.length = 0;
    } else if (p80 < 1 / 75 && this.scale < 1 && this.drops < 3 && since > 20000) {
      this.scale = Math.min(1, this.scale + 0.1);
      this.applySize();
      this.lastAdjust = now;
      this.frameTimes.length = 0;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

export function isLowEndDevice() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  return cores <= 4 || mem <= 3;
}

// ── Toon shading ─────────────────────────────────────────────────────────────
let gradient: DataTexture | null = null;
function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([70, 150, 215, 255]);
  gradient = new DataTexture(data, data.length, 1, RedFormat);
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.colorSpace = LinearSRGBColorSpace;
  gradient.needsUpdate = true;
  return gradient;
}

/** Shared rim-light uniforms so every character gets the same arena backlight. */
export const rimUniforms = {
  uRimColor: { value: new Color(0x9fb6ff) },
  uRimPower: { value: 2.6 },
  uRimStrength: { value: 0.55 },
};

const matCache = new Map<string, MeshToonMaterial>();

export interface ToonOpts { map?: Texture | null; emissive?: number; emissiveIntensity?: number; rim?: boolean; transparent?: boolean; opacity?: number }

/** Toon material with a cheap fresnel rim light injected into the shader. */
export function toon(color: number, opts: ToonOpts = {}): MeshToonMaterial {
  const m = new MeshToonMaterial({ color, gradientMap: toonGradient(), map: opts.map ?? null });
  if (opts.emissive !== undefined) { m.emissive.setHex(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity ?? 1; }
  if (opts.rim !== false) {
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, rimUniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimPower; uniform float uRimStrength;')
        .replace(
          '#include <opaque_fragment>',
          'float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), uRimPower);\n' +
            'outgoingLight += uRimColor * rimF * uRimStrength;\n#include <opaque_fragment>',
        );
    };
    m.customProgramCacheKey = () => 'toon-rim';
  }
  return m;
}

/** Cached shared toon material for static props. */
export function sharedToon(color: number, key = ''): MeshToonMaterial {
  const k = color.toString(16) + key;
  let m = matCache.get(k);
  if (!m) { m = toon(color); matCache.set(k, m); }
  return m;
}

export function basic(color: number, opts: { transparent?: boolean; opacity?: number; additive?: boolean; map?: Texture; depthWrite?: boolean } = {}) {
  const m = new MeshBasicMaterial({ color, transparent: opts.transparent || opts.additive, opacity: opts.opacity ?? 1, map: opts.map ?? null });
  if (opts.additive) { m.blending = 2; m.depthWrite = false; }
  if (opts.depthWrite === false) m.depthWrite = false;
  return m;
}

// ── Canvas texture helpers ───────────────────────────────────────────────────
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = false): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

let radial: CanvasTexture | null = null;
/** soft radial blob used for shadows, glows and particles */
export function radialTex(): CanvasTexture {
  if (radial) return radial;
  radial = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  radial.colorSpace = LinearSRGBColorSpace;
  return radial;
}
