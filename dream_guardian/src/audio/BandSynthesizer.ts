/**
 * BandSynthesizer - 1단계(Ch.1) 록 앙상블 절차적 악기 사운드 합성기
 *
 * Issue #191 [AUDIO-BAND-001]:
 * - 손 (Zone 1~5): 일렉 기타 리드/리프/파워코드 왜곡(Overdrive/Distortion) 사운드
 *   - Zone 1~3: 근음 + 5도 화음(완전5도) 파워코드 동시 합성
 *   - Zone 4~5: 단일 리드/리프 오버드라이브 음향
 * - 발 (Zone 9~11): 록 드럼 킥(Kick), 스네어(Snare: 노이즈 버퍼 + 스네어 톤 바디 펀치), 심벌(Cymbal)
 * - 판정별 음향: 정박(Sync: 클린 왜곡) / 엇박(Stumble: 디튠 피치 벤드) / 미스(Miss: 메인 악기 음소거 및 틱 사운드)
 * - 2박 Ready 카운트 사운드 (READY... SET!): #229에 의해 REST_READY 상태가 폐기되어 정규 루프 미채택(Unused)이나 카운트다운 유틸리티로 보존
 * - AudioContext 공유, 음소거(Mute), 일시정지/재개(suspend/resume), 종료(close) 생명주기 완비
 *
 * @see Issue #191 [AUDIO-BAND-001]
 * @see Issue #229 [SPEC-ROUTINE-VERIFY-001]
 */

import { DEFAULT_BAND_AUDIO_CONFIG, type BandAudioConfig } from '../../config/audio.config.js';

export type BandTimingQuality = 'sync' | 'stumble' | 'miss';

export interface BandSynthesizerOptions {
  audioContext?: AudioContext;
  muted?: boolean;
  config?: BandAudioConfig;
}

export const GUITAR_ZONE_FREQUENCIES: Record<number, number> = {
  ...DEFAULT_BAND_AUDIO_CONFIG.guitarFrequencies,
};

function makeDistortionCurve(amount: number = 28): Float32Array {
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
  private _config: BandAudioConfig;
  private _distortionCurve: Float32Array;

  constructor(options?: BandSynthesizerOptions) {
    this._muted = options?.muted ?? false;
    this._config = options?.config ?? DEFAULT_BAND_AUDIO_CONFIG;
    this._distortionCurve = makeDistortionCurve(this._config.distortionAmount);

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
    osc.frequency.setValueAtTime(this._config.missTick.freq, now);
    gain.gain.setValueAtTime(this._config.missTick.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + this._config.missTick.duration);

    osc.connect(gain);
    gain.connect(this._audioCtx.destination);
    osc.start(now);
    osc.stop(now + this._config.missTick.duration);
  }

  /**
   * 일렉 기타 사운드 재생 (Zone 1~5)
   * - Zone 1~3: 파워코드(근음 + 완전5도 화음 동시 출력)
   * - Zone 4~5: 단일 리드/리프
   */
  playGuitarZone(zoneId: number, timingQuality: BandTimingQuality = 'sync'): void {
    if (!this._ensureActive() || !this._audioCtx) return;
    const now = this._audioCtx.currentTime;

    if (timingQuality === 'miss') {
      this._playMissTick(now);
      return;
    }

    const freq = this._config.guitarFrequencies[zoneId] ?? 220.0;
    const isPowerChord = this._config.powerChordZones.includes(zoneId);
    const isStumble = timingQuality === 'stumble';
    const duration = isStumble ? 0.3 : 0.45;

    const gain = this._audioCtx.createGain();
    const shaper = this._audioCtx.createWaveShaper();

    if (isStumble) {
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    } else {
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    }

    shaper.curve = this._distortionCurve as unknown as Float32Array<ArrayBuffer>;
    shaper.oversample = '4x';
    shaper.connect(gain);
    gain.connect(this._audioCtx.destination);

    // 1. 근음 오실레이터
    const rootOsc = this._audioCtx.createOscillator();
    rootOsc.type = 'sawtooth';
    rootOsc.frequency.setValueAtTime(freq, now);

    if (isStumble) {
      rootOsc.detune.setValueAtTime(180, now);
      rootOsc.detune.linearRampToValueAtTime(-120, now + 0.15);
    }
    rootOsc.connect(shaper);
    rootOsc.start(now);
    rootOsc.stop(now + duration);

    // 2. 파워코드인 경우 5도 화음(fifth) 오실레이터 동시 합성
    if (isPowerChord) {
      const fifthOsc = this._audioCtx.createOscillator();
      fifthOsc.type = 'sawtooth';
      fifthOsc.frequency.setValueAtTime(freq * this._config.fifthRatio, now);

      if (isStumble) {
        fifthOsc.detune.setValueAtTime(180, now);
        fifthOsc.detune.linearRampToValueAtTime(-120, now + 0.15);
      }
      fifthOsc.connect(shaper);
      fifthOsc.start(now);
      fifthOsc.stop(now + duration);
    }
  }

  /**
   * 록 드럼 사운드 재생 (Zone 9: Kick, Zone 10: Snare, Zone 11: Cymbal)
   * - Zone 10(스네어): 스네어 와이어 노이즈 버퍼 + 스네어 톤(바디 펀치감) 동시 합성
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
      const kickCfg = this._config.drum.kick;
      const osc = this._audioCtx.createOscillator();
      const gain = this._audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isStumble ? kickCfg.stumbleStartFreq : kickCfg.startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(kickCfg.endFreq, now + 0.18);

      gain.gain.setValueAtTime(isStumble ? kickCfg.stumbleGain : kickCfg.syncGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + kickCfg.duration);

      osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start(now);
      osc.stop(now + kickCfg.duration);
    } else if (zoneId === 10) {
      // 록 드럼 스네어 (Snare: 노이즈 버퍼 + 스네어 톤 바디 펀치)
      const snareCfg = this._config.drum.snare;

      // 1. 스네어 와이어 노이즈 버퍼
      const bufferSize = Math.floor(this._audioCtx.sampleRate * snareCfg.noiseDuration) || 4096;
      const buffer = this._audioCtx.createBuffer(1, bufferSize, this._audioCtx.sampleRate || 44100);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this._audioCtx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this._audioCtx.createGain();

      noiseGain.gain.setValueAtTime(isStumble ? snareCfg.stumbleNoiseGain : snareCfg.syncNoiseGain, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + snareCfg.noiseDuration);

      noise.connect(noiseGain);
      noiseGain.connect(this._audioCtx.destination);
      noise.start(now);
      noise.stop(now + snareCfg.noiseDuration);

      // 2. 스네어 톤 (헤드 타격 바디 피치 펀치: 180Hz -> 80Hz)
      const toneOsc = this._audioCtx.createOscillator();
      const toneGain = this._audioCtx.createGain();

      toneOsc.type = 'triangle';
      toneOsc.frequency.setValueAtTime(snareCfg.toneStartFreq, now);
      toneOsc.frequency.exponentialRampToValueAtTime(snareCfg.toneEndFreq, now + snareCfg.toneDuration);

      toneGain.gain.setValueAtTime(isStumble ? snareCfg.toneGain * 0.6 : snareCfg.toneGain, now);
      toneGain.gain.exponentialRampToValueAtTime(0.001, now + snareCfg.toneDuration);

      toneOsc.connect(toneGain);
      toneGain.connect(this._audioCtx.destination);
      toneOsc.start(now);
      toneOsc.stop(now + snareCfg.toneDuration);
    } else {
      // Zone 11: 크래시/하이햇 (Cymbal: 하이패스 필터링 노이즈)
      const cymbalCfg = this._config.drum.cymbal;
      const bufferSize = Math.floor(this._audioCtx.sampleRate * cymbalCfg.duration) || 4096;
      const buffer = this._audioCtx.createBuffer(1, bufferSize, this._audioCtx.sampleRate || 44100);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this._audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this._audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(isStumble ? cymbalCfg.stumbleFilterFreq : cymbalCfg.syncFilterFreq, now);

      const gain = this._audioCtx.createGain();
      gain.gain.setValueAtTime(isStumble ? cymbalCfg.stumbleGain : cymbalCfg.syncGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + cymbalCfg.duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this._audioCtx.destination);

      noise.start(now);
      noise.stop(now + cymbalCfg.duration);
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
   * @notice Issue #229 계약에 의해 REST_READY 상태가 폐기되어 정규 루프에서는 미채택(Unused) 상태입니다.
   *         카운트다운 또는 튜토리얼 연출 시 선택적 유틸리티로 안전하게 호출할 수 있도록 유지합니다.
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
      osc.frequency.setValueAtTime(this._config.readyCount.readyFreq, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + this._config.readyCount.readyDuration);
      osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start(now);
      osc.stop(now + this._config.readyCount.readyDuration);
    } else {
      // SET (880Hz -> 1046Hz 상승 톤)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this._config.readyCount.setStartFreq, now);
      osc.frequency.linearRampToValueAtTime(this._config.readyCount.setEndFreq, now + this._config.readyCount.setDuration);
      gain.gain.setValueAtTime(0.30, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + this._config.readyCount.setDuration);
      osc.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start(now);
      osc.stop(now + this._config.readyCount.setDuration);
    }
  }

  /**
   * AudioContext 일시정지 (게임 일시정지 모달 등과 연동)
   */
  async suspend(): Promise<void> {
    if (this._audioCtx && typeof this._audioCtx.suspend === 'function') {
      await this._audioCtx.suspend();
    }
  }

  /**
   * AudioContext 재개 (일시정지 복귀 또는 브라우저 유저 제스처 후 재개)
   */
  async resume(): Promise<void> {
    if (this._audioCtx && typeof this._audioCtx.resume === 'function') {
      await this._audioCtx.resume();
    }
  }

  /**
   * AudioContext 리소스 정리
   */
  async close(): Promise<void> {
    if (this._audioCtx && typeof this._audioCtx.close === 'function') {
      await this._audioCtx.close();
    }
  }
}
