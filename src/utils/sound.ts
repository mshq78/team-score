// Web Audio API Sound Synthesizer (No external assets required)

class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playClick() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  playPop() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  playShuffle() {
    const ctx = this.getContext();
    if (!ctx) return;

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (!this.getContext()) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300 + Math.random() * 400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }, i * 60);
    }
  }

  playFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [
      { f: 523.25, d: 0.12, t: 0 },    // C5
      { f: 659.25, d: 0.12, t: 0.12 }, // E5
      { f: 783.99, d: 0.14, t: 0.24 }, // G5
      { f: 1046.50, d: 0.4, t: 0.38 }  // C6
    ];

    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, ctx.currentTime + n.t);

      gain.gain.setValueAtTime(0.01, ctx.currentTime + n.t);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + n.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.t + n.d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + n.t);
      osc.stop(ctx.currentTime + n.t + n.d);
    });
  }

  playWhistle() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(2600, ctx.currentTime + 0.15);
    osc.frequency.linearRampToValueAtTime(2300, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  playTick() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  }

  playDrumroll(duration = 2.0) {
    const ctx = this.getContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    const hitInterval = 0.055;
    const totalHits = Math.floor(duration / hitInterval);

    for (let i = 0; i < totalHits; i++) {
      const hitTime = startTime + i * hitInterval;
      const progress = i / totalHits;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110 + Math.random() * 40 + progress * 70, hitTime);
      osc.frequency.exponentialRampToValueAtTime(50, hitTime + 0.04);

      const hitVol = 0.04 + progress * 0.22;
      gain.gain.setValueAtTime(hitVol, hitTime);
      gain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(hitTime);
      osc.stop(hitTime + 0.04);
    }

    // Final accented hit
    const finishTime = startTime + duration;
    const finalOsc = ctx.createOscillator();
    const finalGain = ctx.createGain();
    finalOsc.type = 'triangle';
    finalOsc.frequency.setValueAtTime(220, finishTime);
    finalOsc.frequency.exponentialRampToValueAtTime(70, finishTime + 0.25);
    finalGain.gain.setValueAtTime(0.35, finishTime);
    finalGain.gain.exponentialRampToValueAtTime(0.001, finishTime + 0.25);
    finalOsc.connect(finalGain);
    finalGain.connect(ctx.destination);
    finalOsc.start(finishTime);
    finalOsc.stop(finishTime + 0.25);
  }
}

export const sound = new SoundFX();
