// Procedural chiptune BGM using Web Audio (no external files).
type Theme = {
  bpm: number;
  root: number; // midi
  scale: number[];
  lead: number[]; // scale degrees per 16th, -99 = rest
  bass: number[];
  leadWave: OscillatorType;
  drums: boolean;
};

const R = -99;
export const THEMES: Record<string, Theme> = {
  stage0: {
    bpm: 132,
    root: 57,
    scale: [0, 2, 3, 5, 7, 8, 10],
    lead: [7, R, 6, 7, 9, R, 7, 6, 4, R, 5, 6, 4, R, 2, R, 0, R, 2, 4, 5, R, 4, 2, 4, R, R, R, 3, 2, 1, R],
    bass: [0, R, 0, R, 5, R, 5, R, 3, R, 3, R, 4, R, 4, R],
    leadWave: "triangle",
    drums: false,
  },
  stage1: {
    bpm: 112,
    root: 62,
    scale: [0, 2, 3, 5, 7, 9, 10],
    lead: [4, R, R, 5, 4, R, 2, R, 1, R, 2, R, 4, R, R, R, 6, R, 5, R, 4, R, 2, R, 3, R, 2, R, 0, R, R, R],
    bass: [0, R, R, R, 3, R, R, R, 5, R, R, R, 4, R, R, R],
    leadWave: "sine",
    drums: false,
  },
  stage2: {
    bpm: 150,
    root: 52,
    scale: [0, 2, 3, 5, 7, 8, 11],
    lead: [7, 6, 7, R, 4, R, 7, R, 8, 7, 6, R, 4, R, 3, R, 4, 3, 4, R, 1, R, 4, R, 6, 5, 4, R, 3, R, 2, R],
    bass: [0, 0, R, 0, 5, 5, R, 5, 3, 3, R, 3, 4, 4, 6, 4],
    leadWave: "square",
    drums: true,
  },
  boss: {
    bpm: 176,
    root: 50,
    scale: [0, 1, 3, 5, 7, 8, 10],
    lead: [7, R, 8, 7, 5, R, 7, R, 10, R, 9, 8, 7, R, 5, 4, 3, R, 4, 5, 7, R, 5, R, 8, 7, 5, 4, 3, 2, 1, R],
    bass: [0, 0, 7, 0, 0, 0, 7, 0, 5, 5, 12, 5, 6, 6, 13, 6],
    leadWave: "sawtooth",
    drums: true,
  },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Bgm {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  timer: number | null = null;
  step = 0;
  next = 0;
  theme: Theme | null = null;
  shift = 0;
  muted = false;
  noise: AudioBuffer | null = null;

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.18;
      this.master.connect(this.ctx.destination);
      const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(name: string, shift = 0) {
    this.ensure();
    const t = THEMES[name];
    if (!t || (this.theme === t && this.shift === shift && this.timer)) return;
    this.stop();
    this.theme = t;
    this.shift = shift;
    this.step = 0;
    this.next = this.ctx!.currentTime + 0.05;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.theme = null;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.18, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + 0.16);
  }

  private hat(t: number, vol: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t);
    s.stop(t + 0.06);
  }

  private deg(d: number) {
    const t = this.theme!;
    const n = t.scale.length;
    const oct = Math.floor(d / n);
    const idx = ((d % n) + n) % n;
    return t.root + this.shift + oct * 12 + t.scale[idx]!;
  }

  private tick() {
    const ctx = this.ctx;
    const t = this.theme;
    if (!ctx || !t) return;
    const sixteenth = 60 / t.bpm / 4;
    while (this.next < ctx.currentTime + 0.12) {
      const s = this.step;
      const l = t.lead[s % t.lead.length]!;
      if (l !== R) this.tone(mtof(this.deg(l) + 12), this.next, sixteenth * 1.8, t.leadWave, t.leadWave === "sawtooth" || t.leadWave === "square" ? 0.12 : 0.25);
      const b = t.bass[s % t.bass.length]!;
      if (b !== R) this.tone(mtof(this.deg(b) - 12), this.next, sixteenth * 0.9, "triangle", 0.35);
      if (s % 4 === 0) this.tone(mtof(this.deg(l === R ? 2 : l + 2)), this.next, sixteenth * 3, "sine", 0.06);
      if (t.drums) {
        if (s % 4 === 0) this.kick(this.next);
        if (s % 2 === 1) this.hat(this.next, 0.15);
        if (s % 8 === 4) this.hat(this.next, 0.35);
      }
      this.next += sixteenth;
      this.step++;
    }
  }
}
