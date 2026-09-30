/**
 * BandSynthesizer - 1단계(Ch.1) 록 앙상블 절차적 악기 사운드 합성기
 *
 * Issue #191 [AUDIO-BAND-001]:
 * - 손 (Zone 1~5): 일렉 기타 리드/리프/파워코드 왜곡(Overdrive/Distortion) 사운드
 * - 발 (Zone 9~11): 록 드럼 킥(Kick), 스네어(Snare), 하이햇/크래시(Cymbal) 타격음
 * - 정박(Sync) / 엇박(Stumble) / 미스(Miss) 실시간 키사운드 및 어긋남 피드백
 * - 2박 Ready 카운트 사운드 (READY... SET!)
 */

export type BandTimingQuality = 'sync' | 'stumble' | 'miss';

export interface BandSynthesizerOptions {
  audioContext?: AudioContext;
  muted?: boolean;
}

export const GUITAR_ZONE_FREQUENCIES: Record<number, number> = {
  1: 164.81, // E3 파워코드
  2: 196.00, // G3 파워코드
  3: 220.00, // A3 파워코드
  4: 261.63, // C4 리드
  5: 293.66, // D4 리드
  6: 164.81, // E3 폴백
  7: 196.00, // G3 폴백
  8: 220.00, // A3 폴백
};

function makeDistortionCurve(amount: number = 25): Float32Array {
  const k = amount;
  const nSamples = 256;
  const curve = new Float32Array(nSamples);
  const deg = Math.PI / 180;
  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export class BandSynthesizer {
  private _audioCtx: AudioContext | null = null;
  private _muted: boolean;
  private _distortionCurve: Float32Array;

  constructor(options?: BandSynthesizerOptions) {
    this._muted = options?.muted ?? false;
    this._distortionCurve = makeDistortionCurve(28);

    if (options?.audioContext) {
      this._audioCtx = options.audioContext;
    } else {
      this._initContext();
    }
  }

  private _initContext(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this._audioCtx = new AudioCtxClass();
      }
    } catch {
      // AudioContext 미지원 환경 무시
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
  }

  isGuitarZone(zoneId: number): boolean {
    return zoneId >= 1 && zoneId <= 8;
  }

  isDrumZone(zoneId: number): boolean {
    return zoneId >= 9 && zoneId <= 11;
  }

  private _ensureActive(): boolean {
    if (this._muted || !this._audioCtx) return false;
    if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
    return true;
  }

  /**
   * 미스 시 메인 악기 음소거 및 둔탁한 메트로놈 틱음
   */
  private _playMissTick(now: number): void {
    if (!this._audioCtx) return;
    const osc = this._audioCtx.createOscillator();
    const gain = this._audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this._audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * 일렉 기타 사운드 재생 (Zone 1~5)
   */
  playGuitarZone(zoneId: number, timingQuality: BandTimingQuality = 'sync'): void {
    if (!this._ensureActive() || !this._audioCtx) return;
    const now = this._audioCtx.currentTime;

    if (timingQuality === 'miss') {
      this._playMissTick(now);
      return;
    }

    const freq = GUITAR_ZONE_FREQUENCIES[zoneId] ?? 220.0;
    const osc = this._audioCtx.createOscillator();
    const gain = this._audioCtx.createGain();
    const shaper = this._audioCtx.createWaveShaper();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    // 엇박(stumble) 시 피치 벤드 글리치 및 디튠 적용
    if (timingQuality === 'stumble') {
      osc.detune.setValueAtTime(180, now);
      osc.detune.linearRampToValueAtTime(-120, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    } else {
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    }

    shaper.curve = this._distortionCurve as unknown as Float32Array<ArrayBuffer>;
    shaper.oversample = '4x';

    osc.connect(shaper);
    shaper.connect(gain);
    gain.connect(this._audioCtx.destination);

    osc.start(now);
    osc.stop(now + (timingQuality === 'stumble' ? 0.3 : 0.45));
  }

  /**
   * 록 드럼 사운드 재생 (Zone 9: Kick, Zone 10: Snare, Zone 11: Cymbal)
   */
  playDrumZone(zoneId: number, timingQuality: BandTimingQuality = 'sync'): void {
    if (!this._ensureActive() || !this._audioCtx) return;
    const now = this._audioCtx.currentTime;

    if (timingQuality === 'miss') {
      this._playMissTick(now);
      return;
    }

    const isStumble = timingQuality === 'stumble';

    if (zoneId === 9) {
      // 록 드럼 킥 (Kick: 130Hz -> 45Hz exponential pitch drop)
      const osc = this._audioCtx.createOscillator();
      const gain = this._audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isStumble ? 90 : 130, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

      gain.gain.setValueAtTime(isStumble ? 0.22 : 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (zoneId === 10) {
      // 록 드럼 스네어 (Snare: 노이즈 버퍼 + 스네어 톤)
      const bufferSize = Math.floor(this._audioCtx.sampleRate * 0.22) || 4096;
      const buffer = this._audioCtx.createBuffer(1, bufferSize, this._audioCtx.sampleRate || 44100);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this._audioCtx.createBufferSource();
      noise.buffer = buffer;
      const gain = this._audioCtx.createGain();

      gain.gain.setValueAtTime(isStumble ? 0.18 : 0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noise.connect(gain);
      gain.connect(this._audioCtx.destination);
      noise.start(now);
      noise.stop(now + 0.22);
    } else {
      // Zone 11: 크래시/하이햇 (Cymbal: 하이패스 필터링 노이즈)
      const bufferSize = Math.floor(this._audioCtx.sampleRate * 0.35) || 4096;
      const buffer = this._audioCtx.createBuffer(1, bufferSize, this._audioCtx.sampleRate || 44100);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this._audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this._audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(isStumble ? 4000 : 7000, now);

      const gain = this._audioCtx.createGain();
      gain.gain.setValueAtTime(isStumble ? 0.15 : 0.30, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this._audioCtx.destination);

      noise.start(now);
      noise.stop(now + 0.35);
    }
  }

  /**
   * 통합 존 사운드 트리거
   */
  playZoneSound(zoneId: number, timingQuality: BandTimingQuality = 'sync'): void {
    if (this.isDrumZone(zoneId)) {
      this.playDrumZone(zoneId, timingQuality);
    } else {
      this.playGuitarZone(zoneId, timingQuality);
    }
  }

  /**
   * 2박 준비 카운트다운 사운드 (READY... SET!)
   * @param beat 1 (READY) | 2 (SET)
   */
  playReadyCount(beat: 1 | 2): void {
    if (!this._ensureActive() || !this._audioCtx) return;
    const now = this._audioCtx.currentTime;

    const osc = this._audioCtx.createOscillator();
    const gain = this._audioCtx.createGain();

    if (beat === 1) {
      // READY (440Hz 도깨비 비프)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // SET (880Hz -> 1046Hz 상승 톤)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(1046.5, now + 0.25);
      gain.gain.setValueAtTime(0.30, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }
}
