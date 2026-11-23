export class TankArenaAudio {
  private ctx: AudioContext | null = null;
  private activeVoices = 0;
  private maxVoices = 12;
  private masterVol = 0.7;
  private effectsVol = 0.8;
  private musicVol = 0.25;
  private muted = false;
  private musicInterval: number | null = null;
  private musicStep = 0;

  public unlock(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setVolumes(opts: { master?: number; effects?: number; music?: number; muted?: boolean }): void {
    if (opts.master !== undefined) this.masterVol = opts.master;
    if (opts.effects !== undefined) this.effectsVol = opts.effects;
    if (opts.music !== undefined) this.musicVol = opts.music;
    if (opts.muted !== undefined) this.muted = opts.muted;
  }

  public startMusic(mode: 'menu' | 'game'): void {
    this.stopMusic();
    if (typeof window === 'undefined') return;
    const notes =
      mode === 'game'
        ? [196, 220, 261.6, 293.7, 329.6, 293.7, 261.6, 220]
        : [261.6, 329.6, 392, 329.6];
    this.musicStep = 0;
    this.musicInterval = window.setInterval(() => {
      if (this.muted || this.masterVol * this.musicVol <= 0.01) return;
      if (!this.ctx || this.ctx.state !== 'running') return;
      const freq = notes[this.musicStep % notes.length];
      this.musicStep += 1;
      this.playTone(freq, mode === 'game' ? 0.14 : 0.35, mode === 'game' ? 'triangle' : 'sine', this.masterVol * this.musicVol * 0.25, 0);
    }, mode === 'game' ? 280 : 650);
  }

  public stopMusic(): void {
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private panFromX(x?: number): number {
    if (x === undefined) return 0;
    return Math.max(-0.85, Math.min(0.85, (x / 1792) * 2 - 1));
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType,
    gainVal: number,
    pan: number,
    endFreq?: number,
  ): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    if (this.activeVoices >= this.maxVoices) return;
    const vol = gainVal * this.masterVol * this.effectsVol;
    if (vol <= 0.005) return;

    this.activeVoices += 1;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationSec);
    }

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, now);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(this.ctx.destination);
    }

    osc.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playFire(x?: number, isOwn = false): void {
    const pitchJitter = 0.95 + Math.random() * 0.1;
    this.playTone(220 * pitchJitter, 0.12, 'sawtooth', isOwn ? 0.32 : 0.16, this.panFromX(x), 75);
  }

  public playDryClick(): void {
    this.playTone(680, 0.045, 'square', 0.18, 0, 320);
  }

  public playBrickHit(x?: number): void {
    this.playTone(150, 0.09, 'triangle', 0.2, this.panFromX(x), 80);
  }

  public playSteelPing(x?: number): void {
    this.playTone(980, 0.08, 'sine', 0.16, this.panFromX(x), 640);
  }

  public playCrateBreak(x?: number): void {
    this.playTone(240, 0.11, 'square', 0.22, this.panFromX(x), 95);
  }

  public playExplosion(x?: number, isOwn = false): void {
    const pan = this.panFromX(x);
    this.playTone(130, 0.34, 'sawtooth', isOwn ? 0.42 : 0.24, pan, 34);
    this.playTone(88, 0.26, 'square', isOwn ? 0.28 : 0.16, pan, 28);
  }

  public playPowerPickup(x?: number): void {
    const pan = this.panFromX(x);
    this.playTone(440, 0.12, 'sine', 0.24, pan, 660);
    setTimeout(() => this.playTone(660, 0.16, 'sine', 0.24, pan, 880), 75);
  }

  public playShieldPop(x?: number): void {
    this.playTone(520, 0.16, 'triangle', 0.24, this.panFromX(x), 180);
  }

  public playFlagPickup(): void {
    this.playTone(520, 0.14, 'sawtooth', 0.22, 0, 680);
  }

  public playFlagReturn(): void {
    this.playTone(480, 0.14, 'sine', 0.2, 0, 720);
  }

  public playFlagCapture(): void {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.2, 'triangle', 0.28, 0), i * 85);
    });
  }

  public playCountdown(isGo = false): void {
    this.playTone(isGo ? 880 : 440, isGo ? 0.25 : 0.12, 'sine', 0.25, 0);
  }

  public playWin(): void {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.25, 'sine', 0.3, 0), i * 110);
    });
  }

  public playUiClick(): void {
    this.playTone(540, 0.04, 'sine', 0.14, 0, 420);
  }

  public playUiJoin(): void {
    this.playTone(480, 0.08, 'sine', 0.16, 0, 640);
  }
}

export const tankAudio = new TankArenaAudio();
