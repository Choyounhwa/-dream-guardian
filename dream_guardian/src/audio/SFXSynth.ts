/**
 * SFXSynth - Web Audio API 기반 절차적 사운드 효과 신디사이저
 *
 * Issue #136 (Card #67): [AUDIO-002]
 * - 체류 충전음 (Dwell Charge): 진행도 0.0~1.0에 따라 피치 상승(220Hz -> 880Hz)
 * - 자세 완성 화음 (Posture Complete): 맑은 3화음 (C5, E5, G5)
 * - 12종 기본 효과음(정답, 오답, 호버, 시작, 피격, 크리스털, 스텝 등) 절차적 합성
 * - 음소거 및 브라우저 AudioContext 자동 재개 안전 처리
 */

export type SFXType =
  | 'correct'
  | 'wrong'
  | 'hover'
  | 'start'
  | 'monster_hit'
  | 'player_hurt'
  | 'shatter'
  | 'shield_deflect'
  | 'jump_whoosh'
  | 'crystal_pickup'
  | 'warning'
  | 'step_beat'
  | 'posture_complete'
  | 'metronome_strong'
  | 'metronome_weak'
  | 'beat_tick';

export interface SFXSynthOptions {
  audioContext?: AudioContext;
  muted?: boolean;
}

export class SFXSynth {
  private _audioCtx: AudioContext | null = null;
  private _dwellOsc: OscillatorNode | null = null;
  private _dwellGain: GainNode | null = null;
  private _muted = false;

  constructor(options?: SFXSynthOptions) {
    this._muted = options?.muted ?? false;
    if (options?.audioContext) {
      this._audioCtx = options.audioContext;
    } else {
      this._initContext();
    }
  }

  private _initContext(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this._audioCtx = new AudioCtxClass();
      }
    } catch {
      // AudioContext 미지원 또는 제한 환경 무시
    }
  }

  get audioContext(): AudioContext | null {
    return this._audioCtx;
  }

  get isMuted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (muted) {
      this.stopDwellCharge();
    }
  }

  async suspend(): Promise<void> {
    if (this._audioCtx && typeof this._audioCtx.suspend === 'function') {
      await this._audioCtx.suspend();
    }
  }

  async resume(): Promise<void> {
    if (this._audioCtx && typeof this._audioCtx.resume === 'function') {
      await this._audioCtx.resume();
    }
  }

  async close(): Promise<void> {
    this.stopDwellCharge();
    if (this._audioCtx && typeof this._audioCtx.close === 'function') {
      await this._audioCtx.close();
    }
  }

  private _ensureActive(): boolean {
    if (this._muted || !this._audioCtx) return false;
    if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
    return true;
  }

  /**
   * 단발성 효과음 재생
   */
  play(type: SFXType): void {
    if (!this._ensureActive() || !this._audioCtx) return;
    const now = this._audioCtx.currentTime;

    try {
      switch (type) {
        case 'correct': {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.1);
          osc.frequency.setValueAtTime(783.99, now + 0.2);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        }

        case 'wrong': {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(150, now);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        }

        case 'posture_complete': {
          // 맑은 3화음 (C5: 523Hz, E5: 659Hz, G5: 784Hz)
          const notes = [523.25, 659.25, 783.99];
          for (let i = 0; i < notes.length; i++) {
            const osc = this._audioCtx.createOscillator();
            const gain = this._audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(notes[i], now + i * 0.04);
            gain.gain.setValueAtTime(0.25, now + i * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain);
            gain.connect(this._audioCtx.destination);
            osc.start(now + i * 0.04);
            osc.stop(now + 0.6);
          }
          break;
        }

        case 'hover': {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'step_beat': {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(120, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'metronome_strong': {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.06);
          break;
        }

        case 'metronome_weak': {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(480, now);
          osc.frequency.exponentialRampToValueAtTime(260, now + 0.04);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
        }

        case 'beat_tick': {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        }

        case 'jump_whoosh': {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(960, now + 0.22);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.25);
          break;
        }

        default: {
          const osc = this._audioCtx.createOscillator();
          const gain = this._audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.connect(gain);
          gain.connect(this._audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        }
      }
    } catch {
      // 오디오 에러 무시
    }
  }

  /**
   * 체류 진행도(0.0 ~ 1.0)에 따른 실시간 점진적 피치 상승 충전음 (Issue #136)
   */
  updateDwellCharge(progress: number): void {
    if (!this._ensureActive() || !this._audioCtx || progress <= 0) {
      this.stopDwellCharge();
      return;
    }

    const now = this._audioCtx.currentTime;
    // 220Hz(A3) -> 880Hz(A5) 부드러운 지수 피치 상승
    const targetFreq = 220 * Math.pow(4, Math.min(1, progress));

    if (!this._dwellOsc || !this._dwellGain) {
      try {
        this._dwellOsc = this._audioCtx.createOscillator();
        this._dwellGain = this._audioCtx.createGain();
        this._dwellOsc.type = 'sine';
        this._dwellOsc.frequency.setValueAtTime(targetFreq, now);

        this._dwellGain.gain.setValueAtTime(0.001, now);
        this._dwellGain.gain.linearRampToValueAtTime(0.12, now + 0.05);

        this._dwellOsc.connect(this._dwellGain);
        this._dwellGain.connect(this._audioCtx.destination);
        this._dwellOsc.start(now);
      } catch {
        this._dwellOsc = null;
        this._dwellGain = null;
      }
    } else {
      try {
        this._dwellOsc.frequency.setTargetAtTime(targetFreq, now, 0.03);
        const gainVal = 0.08 + progress * 0.08;
        this._dwellGain.gain.setTargetAtTime(gainVal, now, 0.03);
      } catch {}
    }
  }

  /**
   * 체류 충전음 즉시 정지 및 페이드아웃
   */
  stopDwellCharge(): void {
    if (this._dwellGain && this._audioCtx) {
      try {
        const now = this._audioCtx.currentTime;
        this._dwellGain.gain.setValueAtTime(this._dwellGain.gain.value, now);
        this._dwellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      } catch {}
    }

    if (this._dwellOsc && this._audioCtx) {
      const osc = this._dwellOsc;
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      }, 90);
      this._dwellOsc = null;
      this._dwellGain = null;
    }
  }
}
