// ─────────────────────────────────────────────────────────────────────────────
//  Procedural audio (no asset downloads): punches, slams, bell, crowd bed,
//  cheers, whooshes, UI blips, chest fanfares and a light menu groove.
// ─────────────────────────────────────────────────────────────────────────────

class Sfx {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private crowdLevel = 0.12;
  private musicTimer = 0;
  private musicOn = false;
  sfxVol = 0.8;
  musicVol = 0.5;

  /** must be called from a user gesture */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.setVolumes(this.sfxVol, this.musicVol);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.6 + b * 3; }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx; this.musicVol = music;
    if (!this.ctx) return;
    this.sfxBus.gain.value = sfx;
    this.musicBus.gain.value = music * 0.5;
  }

  private now() { return this.ctx!.currentTime; }

  private noise(dur: number, filterType: BiquadFilterType, freq: number, q: number, gain: number, attack = 0.002, when = 0, freqEnd?: number) {
    const c = this.ctx!; const t = this.now() + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, freqEnd?: number, attack = 0.004, bus?: GainNode) {
    const c = this.ctx!; const t = this.now() + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hit(kind: 'punch' | 'heavy' | 'slam' | 'chop' | 'kick' | 'block', power = 0.5) {
    if (!this.ctx) return;
    const p = 0.6 + power * 0.6;
    switch (kind) {
      case 'punch':
        this.noise(0.09, 'bandpass', 1800 + Math.random() * 600, 0.9, 0.5 * p);
        this.tone(140 + Math.random() * 30, 0.1, 'sine', 0.6 * p, 0, 60);
        break;
      case 'heavy':
      case 'kick':
        this.noise(0.14, 'lowpass', 2400, 0.7, 0.7 * p);
        this.tone(110, 0.2, 'sine', 0.9 * p, 0, 45);
        this.noise(0.05, 'highpass', 4000, 0.7, 0.25 * p);
        break;
      case 'chop':
        this.noise(0.12, 'highpass', 2600, 0.6, 0.9 * p);
        this.tone(320, 0.05, 'triangle', 0.3, 0, 200);
        break;
      case 'slam':
        this.tone(70, 0.45, 'sine', 1.0 * p, 0, 32);
        this.noise(0.35, 'lowpass', 900, 0.9, 0.9 * p, 0.004, 0, 200);
        this.noise(0.25, 'bandpass', 300, 2, 0.5 * p, 0.01, 0.03); // ring rattle
        break;
      case 'block':
        this.noise(0.07, 'bandpass', 900, 1.5, 0.45);
        this.tone(220, 0.08, 'square', 0.08, 0, 160);
        break;
    }
  }

  whoosh(power = 0.5) {
    if (!this.ctx) return;
    this.noise(0.22 + power * 0.2, 'bandpass', 600, 1.2, 0.18 + power * 0.25, 0.06, 0, 2200);
  }

  bell(times = 1) {
    if (!this.ctx) return;
    for (let i = 0; i < times; i++) {
      const w = i * 0.32;
      for (const [f, g] of [[880, 0.35], [1320, 0.18], [2290, 0.1], [3120, 0.06]] as const) this.tone(f, 1.6, 'sine', g, w, undefined, 0.002);
      this.noise(0.04, 'highpass', 5000, 0.5, 0.25, 0.001, w);
    }
  }

  count(n: number) {
    if (!this.ctx) return;
    this.noise(0.08, 'bandpass', 1200, 0.8, 0.8);
    this.tone(90, 0.12, 'sine', 0.7, 0, 50);
    if (n >= 3) this.bell(3);
  }

  superCharge(dur = 1.2) {
    if (!this.ctx) return;
    this.tone(110, dur, 'sawtooth', 0.12, 0, 880, 0.2);
    this.tone(55, dur, 'sine', 0.3, 0, 110, 0.3);
    this.noise(dur, 'bandpass', 400, 4, 0.15, 0.3, 0, 3000);
  }

  boom() {
    if (!this.ctx) return;
    this.tone(55, 1.2, 'sine', 1.2, 0, 25, 0.005);
    this.noise(1.0, 'lowpass', 1200, 0.7, 1.0, 0.005, 0, 80);
    this.noise(0.4, 'highpass', 3000, 0.7, 0.4, 0.002);
  }

  zap() {
    if (!this.ctx) return;
    this.noise(0.25, 'highpass', 3500, 1, 0.5, 0.001);
    this.tone(1400, 0.2, 'square', 0.1, 0, 200);
  }

  ui(kind: 'tap' | 'back' | 'buy' | 'error' | 'claim' | 'level' = 'tap') {
    if (!this.ctx) return;
    switch (kind) {
      case 'tap': this.tone(660, 0.06, 'triangle', 0.18, 0, 880); break;
      case 'back': this.tone(520, 0.07, 'triangle', 0.15, 0, 360); break;
      case 'buy': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.2, i * 0.06)); break;
      case 'error': this.tone(180, 0.18, 'square', 0.1, 0, 120); break;
      case 'claim': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.22, i * 0.07)); break;
      case 'level': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.22, i * 0.09)); this.crowdCheer(0.8); break;
    }
  }

  reveal(tier: number) {
    if (!this.ctx) return;
    const base = 392 * Math.pow(1.12, tier);
    const notes = tier >= 4 ? [1, 1.25, 1.5, 2, 2.5, 3] : tier >= 2 ? [1, 1.25, 1.5, 2] : [1, 1.5];
    notes.forEach((m, i) => this.tone(base * m, 0.4 + tier * 0.08, 'triangle', 0.2, i * 0.07));
    if (tier >= 4) { this.boom(); this.noise(1.4, 'highpass', 6000, 0.5, 0.2, 0.1); }
  }

  rumble(dur = 1) {
    if (!this.ctx) return;
    this.noise(dur, 'lowpass', 180, 1, 0.6, 0.2);
    this.tone(48, dur, 'sine', 0.4, 0, 40, 0.2);
  }

  // ── crowd bed ──
  crowdStart() {
    if (!this.ctx || this.crowdGain) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    this.crowdFilter = c.createBiquadFilter();
    this.crowdFilter.type = 'bandpass'; this.crowdFilter.frequency.value = 700; this.crowdFilter.Q.value = 0.6;
    this.crowdGain = c.createGain();
    this.crowdGain.gain.value = 0.0001;
    src.connect(this.crowdFilter).connect(this.crowdGain).connect(this.sfxBus);
    src.start();
    this.crowdGain.gain.setTargetAtTime(this.crowdLevel, this.now(), 0.8);
  }
  crowdStop() {
    if (!this.crowdGain || !this.ctx) return;
    const g = this.crowdGain;
    g.gain.setTargetAtTime(0.0001, this.now(), 0.4);
    setTimeout(() => g.disconnect(), 2000);
    this.crowdGain = null;
  }
  crowdCheer(amount = 0.5) {
    if (!this.ctx) return;
    this.noise(1.2 + amount * 1.5, 'bandpass', 900 + amount * 500, 0.5, 0.15 + amount * 0.35, 0.15);
    if (this.crowdGain) {
      const t = this.now();
      this.crowdGain.gain.cancelScheduledValues(t);
      this.crowdGain.gain.setTargetAtTime(this.crowdLevel + amount * 0.25, t, 0.05);
      this.crowdGain.gain.setTargetAtTime(this.crowdLevel, t + 0.6 + amount, 0.8);
    }
  }
  crowdGasp() {
    if (!this.ctx) return;
    this.noise(0.6, 'bandpass', 1400, 1.4, 0.2, 0.05, 0, 600);
  }
  crowdChant(times = 3) {
    if (!this.ctx) return;
    for (let i = 0; i < times; i++) this.noise(0.25, 'bandpass', 500, 2, 0.35, 0.03, i * 0.5);
  }

  // ── tiny menu groove ──
  music(on: boolean) {
    if (!this.ctx || on === this.musicOn) return;
    this.musicOn = on;
    clearInterval(this.musicTimer);
    if (!on) return;
    let step = 0;
    const bpm = 104, s16 = 60 / bpm / 4;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 82.4, 73.4, 0, 65.4, 0];
    const chordRoots = [220, 220, 174.6, 196];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || document.hidden) return;
      for (let k = 0; k < 4; k++) {
        const w = k * s16;
        const i = step % 64;
        const b16 = i % 16;
        if (b16 % 4 === 0) { this.tone(60, 0.18, 'sine', 0.35, w, 40, 0.003, this.musicBus); }
        if (b16 % 8 === 4) this.noiseTo(0.12, 'highpass', 1800, 0.25, w);
        if (b16 % 2 === 1) this.noiseTo(0.03, 'highpass', 7000, 0.07, w);
        const bn = bass[b16]; if (bn) this.tone(bn, s16 * 1.6, 'triangle', 0.22, w, undefined, 0.005, this.musicBus);
        if (b16 === 0) { const r = chordRoots[Math.floor(i / 16) % 4]; for (const m of [1, 1.26, 1.5]) this.tone(r * m, s16 * 14, 'sine', 0.035, w, undefined, 0.2, this.musicBus); }
        step++;
      }
    }, s16 * 4 * 1000);
  }
  private noiseTo(dur: number, type: BiquadFilterType, freq: number, gain: number, when: number) {
    const c = this.ctx!; const t = this.now() + when;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }
}

export const sfx = new Sfx();
