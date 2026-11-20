/**
 * Procedural Web Audio API Sound Engine for Hearthplow.
 * Synthesizes warm vintage engine rumble, snow-scraping crunch,
 * pentatonic combo chimes, boost surges, and contract fanfares.
 */

const PENTATONIC_FREQS = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private scrapeSource: AudioBufferSourceNode | null = null;
  private scrapeGain: GainNode | null = null;
  private scrapeFilter: BiquadFilterNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean = false;
  private initialized: boolean = false;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.65;
      this.masterGain.connect(this.ctx.destination);
      this.buildNoiseBuffer();
      this.startContinuousLoops();
      this.initialized = true;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private buildNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    // Warm pink-ish noise for natural snow texture
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
    }
    this.noiseBuffer = buffer;
  }

  private startContinuousLoops(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    // Warm vintage pickup engine purr
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 135;
    this.engineFilter.Q.value = 1.8;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 46;

    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 23;

    this.engineOsc.connect(this.engineFilter);
    this.engineSubOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc.start();
    this.engineSubOsc.start();

    // Snow-scraping granular noise loop
    this.scrapeFilter = this.ctx.createBiquadFilter();
    this.scrapeFilter.type = 'bandpass';
    this.scrapeFilter.frequency.value = 920;
    this.scrapeFilter.Q.value = 0.9;

    this.scrapeGain = this.ctx.createGain();
    this.scrapeGain.gain.value = 0.0;

    this.scrapeSource = this.ctx.createBufferSource();
    this.scrapeSource.buffer = this.noiseBuffer;
    this.scrapeSource.loop = true;

    this.scrapeSource.connect(this.scrapeFilter);
    this.scrapeFilter.connect(this.scrapeGain);
    this.scrapeGain.connect(this.masterGain);
    this.scrapeSource.start();

    // Police cruiser hi-lo siren loop (gain 0 until chase active)
    const sirenFilter = this.ctx.createBiquadFilter();
    sirenFilter.type = 'lowpass';
    sirenFilter.frequency.value = 1150;

    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;

    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 640;

    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 2.6;

    const sirenModDepth = this.ctx.createGain();
    sirenModDepth.gain.value = 135;

    this.sirenLfo.connect(sirenModDepth);
    sirenModDepth.connect(this.sirenOsc.frequency);
    this.sirenOsc.connect(sirenFilter);
    sirenFilter.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);

    this.sirenOsc.start();
    this.sirenLfo.start();

    // Ambient winter wind bed (responds smoothly to flurries & heavy blizzards)
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 340;
    this.windFilter.Q.value = 1.4;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;

    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = this.noiseBuffer;
    this.windSource.loop = true;

    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windSource.start();
  }

  public setWeatherWind(windIntensity01: number): void {
    if (!this.initialized || !this.ctx || !this.windGain || !this.windFilter) return;
    const now = this.ctx.currentTime;
    const w = Math.max(0, Math.min(1, windIntensity01));
    this.windGain.gain.setTargetAtTime(w > 0.08 ? w * 0.075 : 0.0, now, 0.25);
    this.windFilter.frequency.setTargetAtTime(260 + w * 460, now, 0.25);
  }

  public updateDriveTelemetry(active: boolean, speedRatio: number, snowClearedIntensity: number, isBoosting: boolean): void {
    if (!this.initialized || !this.ctx || !this.engineGain || !this.engineOsc || !this.engineSubOsc || !this.engineFilter || !this.scrapeGain || !this.scrapeFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.scrapeGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }

    const clampedSpeed = Math.max(0, Math.min(1.4, speedRatio));
    const baseFreq = 44 + clampedSpeed * 42 + (isBoosting ? 18 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(120 + clampedSpeed * 180 + (isBoosting ? 140 : 0), now, 0.06);
    this.engineGain.gain.setTargetAtTime(0.055 + clampedSpeed * 0.055, now, 0.08);

    const scrapeLevel = Math.min(1, snowClearedIntensity);
    const targetScrapeGain = scrapeLevel > 0.02 ? 0.04 + scrapeLevel * 0.14 : 0;
    this.scrapeGain.gain.setTargetAtTime(targetScrapeGain, now, 0.04);
    this.scrapeFilter.frequency.setTargetAtTime(750 + clampedSpeed * 520 + scrapeLevel * 380, now, 0.05);
  }

  public playComboStep(comboLevel: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const idx = Math.min(PENTATONIC_FREQS.length - 1, Math.max(0, comboLevel - 1));
    const freq = PENTATONIC_FREQS[idx];

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.38);
    osc2.stop(now + 0.38);
  }

  public playPriorityClear(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  public playBoostSurge(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Hydraulic thump
    const thump = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + 0.18);
    thumpGain.gain.setValueAtTime(0.24, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    thump.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    thump.start(now);
    thump.stop(now + 0.24);

    // Snow whoosh
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.25);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.01, now);
    nGain.gain.linearRampToValueAtTime(0.18, now + 0.06);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.44);
  }

  public playBankBreach(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // Deep snow-wall impact thud
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.19);
    subGain.gain.setValueAtTime(0.26, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.24);

    // Crisp granular snow scatter burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(1850, now + 0.22);
    filter.Q.value = 0.85;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.01, now);
    nGain.gain.linearRampToValueAtTime(0.24, now + 0.03);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.32);
  }

  public playUpgradePurchase(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Mechanical wrench click + ascending power chord
    const freqs = [392.0, 493.88, 587.33, 783.99];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(idx === 0 ? 0.09 : 0.15, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playContractComplete(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25];
    chord.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.0);
    });
  }

  public setPoliceSiren(active: boolean): void {
    if (!this.initialized || !this.ctx || !this.sirenGain) return;
    const now = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(active ? 0.085 : 0.0, now, 0.06);
  }

  public playNpcImpact(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Soft bump thud + surprised cartoon whistle chirp
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(160, now);
    thud.frequency.exponentialRampToValueAtTime(52, now + 0.16);
    thudGain.gain.setValueAtTime(0.24, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.2);

    const chirp = this.ctx.createOscillator();
    const chirpGain = this.ctx.createGain();
    chirp.type = 'triangle';
    chirp.frequency.setValueAtTime(520, now + 0.02);
    chirp.frequency.exponentialRampToValueAtTime(290, now + 0.22);
    chirpGain.gain.setValueAtTime(0.001, now + 0.02);
    chirpGain.gain.linearRampToValueAtTime(0.14, now + 0.05);
    chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    chirp.connect(chirpGain);
    chirpGain.connect(this.masterGain);
    chirp.start(now + 0.02);
    chirp.stop(now + 0.26);
  }

  public playArrestTicket(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 311.13, 261.63];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public dispose(): void {
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      this.scrapeSource?.stop();
      this.windSource?.stop();
      this.sirenOsc?.stop();
      this.sirenLfo?.stop();
      void this.ctx?.close();
    } catch {
      // ignore cleanup errors
    }
    this.ctx = null;
    this.initialized = false;
  }
}
