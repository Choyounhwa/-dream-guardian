/**
 * StageBGMSynthesizer.ts - 스테이지 진입 록 드럼 비트 및 베이스 그루브 Web Audio 절차적 합성 BGM 재생기
 *
 * 외부 오디오 파일 의존성 없이 Web Audio API(Oscillator, BiquadFilter, BufferSource, Gain)를
 * 사용하여 4/4 박자 8비트 드럼(Kick, Snare, Hi-hat) 및 드라이빙 베이스 라인을 실시간으로 합성 및 루프 재생합니다.
 *
 * @see Issue #305 [AUDIO-BGM-001]
 */

import {
  type BGMAudioConfig,
  DEFAULT_BGM_AUDIO_CONFIG,
} from '../../config/audio.config.js';

export interface StageBGMSynthesizerOptions {
  audioContext?: AudioContext;
  bpm?: number;
  volume?: number;
  config?: BGMAudioConfig;
}

export class StageBGMSynthesizer {
  private _audioCtx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _config: BGMAudioConfig;
  private _bpm: number;
  private _volume: number;
  private _muted: boolean = false;
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;

  private _schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private _fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
  private _nextStepTime: number = 0;
  private _currentStep: number = 0;
  private _noiseBuffer: AudioBuffer | null = null;

  constructor(options?: StageBGMSynthesizerOptions) {
    this._config = options?.config ?? DEFAULT_BGM_AUDIO_CONFIG;
    this._bpm = options?.bpm ?? this._config.bpm;
    this._volume = options?.volume ?? this._config.masterVolume;

    if (options?.audioContext) {
      this._audioCtx = options.audioContext;
      this._initMasterNodes();
    }
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get isMuted(): boolean {
    return this._muted;
  }

  get bpm(): number {
    return this._bpm;
  }

  get volume(): number {
    return this._volume;
  }

  get currentStep(): number {
    return this._currentStep;
  }

  get audioContext(): AudioContext | null {
    return this._audioCtx;
  }

  private _ensureAudioContext(): AudioContext | null {
    if (!this._audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this._audioCtx = new AudioCtxClass();
      }
    }
    if (this._audioCtx && !this._masterGain) {
      this._initMasterNodes();
    }
    return this._audioCtx;
  }

  private _initMasterNodes(): void {
    if (!this._audioCtx) return;
    try {
      this._masterGain = this._audioCtx.createGain();
      const initialGain = this._muted ? 0 : this._volume;
      this._masterGain.gain.setValueAtTime(initialGain, this._audioCtx.currentTime);
      this._masterGain.connect(this._audioCtx.destination);

      // 공용 화이트 노이즈 버퍼 사전 생성 (1초)
      const sampleRate = this._audioCtx.sampleRate || 44100;
      const bufferSize = sampleRate;
      this._noiseBuffer = this._audioCtx.createBuffer(1, bufferSize, sampleRate);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } catch {
      // AudioContext mock 또는 지원 불가 환경 예외 처리
    }
  }

  /**
   * BGM 재생 시작
   */
  start(): void {
    if (this._isPlaying) return;

    const ctx = this._ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (this._fadeOutTimer) {
      clearTimeout(this._fadeOutTimer);
      this._fadeOutTimer = null;
    }

    if (this._masterGain) {
      this._masterGain.gain.setValueAtTime(
        this._muted ? 0 : this._volume,
        ctx.currentTime
      );
    }

    this._isPlaying = true;
    this._isPaused = false;
    this._currentStep = 0;
    this._nextStepTime = ctx.currentTime + 0.05;

    this._startScheduler();
  }

  /**
   * BGM 일시정지 (Modal 팝업 등)
   */
  pause(): void {
    if (!this._isPlaying) return;

    this._stopScheduler();
    this._isPlaying = false;
    this._isPaused = true;
  }

  /**
   * BGM 재개
   */
  resume(): void {
    if (!this._isPaused) return;

    const ctx = this._ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    this._isPlaying = true;
    this._isPaused = false;
    this._nextStepTime = ctx.currentTime + 0.05;

    this._startScheduler();
  }

  /**
   * BGM 완전 정지 및 리셋
   */
  stop(): void {
    this._stopScheduler();
    if (this._fadeOutTimer) {
      clearTimeout(this._fadeOutTimer);
      this._fadeOutTimer = null;
    }
    this._isPlaying = false;
    this._isPaused = false;
    this._currentStep = 0;
  }

  /**
   * 부드러운 볼륨 페이드아웃 후 정지
   */
  fadeOut(duration: number = 0.5): void {
    if (!this._isPlaying || !this._audioCtx || !this._masterGain) {
      this.stop();
      return;
    }

    const now = this._audioCtx.currentTime;
    this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
    this._masterGain.gain.linearRampToValueAtTime(0.001, now + duration);

    this._fadeOutTimer = setTimeout(() => {
      this.stop();
      if (this._masterGain && this._audioCtx) {
        this._masterGain.gain.setValueAtTime(
          this._muted ? 0 : this._volume,
          this._audioCtx.currentTime
        );
      }
      this._fadeOutTimer = null;
    }, duration * 1000);
  }

  /**
   * 볼륨 설정 (0.0 ~ 1.0)
   */
  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this._masterGain && this._audioCtx && !this._muted) {
      this._masterGain.gain.setValueAtTime(this._volume, this._audioCtx.currentTime);
    }
  }

  /**
   * 음소거 설정
   */
  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this._masterGain && this._audioCtx) {
      this._masterGain.gain.setValueAtTime(
        this._muted ? 0 : this._volume,
        this._audioCtx.currentTime
      );
    }
  }

  /**
   * BPM 설정 (60 ~ 240 클램프)
   */
  setBpm(bpm: number): void {
    this._bpm = Math.max(60, Math.min(240, bpm));
  }

  private _startScheduler(): void {
    this._stopScheduler();

    // Lookahead 스케줄러: 25ms 주기로 150ms 앞선 시간까지 오디오 노드 스케줄링
    this._schedulerTimer = setInterval(() => {
      this._schedulerTick();
    }, 25);
    this._schedulerTick();
  }

  private _stopScheduler(): void {
    if (this._schedulerTimer) {
      clearInterval(this._schedulerTimer);
      this._schedulerTimer = null;
    }
  }

  private _schedulerTick(): void {
    if (!this._isPlaying || !this._audioCtx) return;

    const lookAheadTime = 0.15; // 150ms ahead
    const stepDuration = 30 / this._bpm; // 8th note duration in seconds

    while (this._nextStepTime < this._audioCtx.currentTime + lookAheadTime) {
      this._scheduleStep(this._currentStep, this._nextStepTime, stepDuration);
      this._nextStepTime += stepDuration;
      const totalSteps = this._config.bass.patternNotes.length || 16;
      this._currentStep = (this._currentStep + 1) % totalSteps;
    }
  }

  /**
   * 8분음표 단위 단일 스텝 합성 스케줄링
   */
  private _scheduleStep(step: number, time: number, stepDuration: number): void {
    if (!this._audioCtx || !this._masterGain) return;

    // 1. 드럼 스케줄링 (4/4 박자 8비트)
    const beatInBar = step % 8;

    // Kick: 1박(step 0) 및 3박(step 4)
    if (beatInBar === 0 || beatInBar === 4) {
      this._scheduleKick(time);
    }

    // Snare: 2박(step 2) 및 4박(step 6)
    if (beatInBar === 2 || beatInBar === 6) {
      this._scheduleSnare(time);
    }

    // Hi-hat: 매 8분음표 (정박/엇박 미세 악센트 차이)
    const isAccent = beatInBar % 2 === 0;
    this._scheduleHihat(time, isAccent);

    // 2. 록 베이스 그루브 스케줄링 (E2/G2/A2 등)
    const notes = this._config.bass.patternNotes;
    if (notes.length > 0) {
      const noteFreq = notes[step % notes.length];
      if (noteFreq > 0) {
        this._scheduleBass(noteFreq, time, stepDuration * this._config.bass.durationRatio);
      }
    }
  }

  private _scheduleKick(time: number): void {
    if (!this._audioCtx || !this._masterGain) return;
    const kickCfg = this._config.drum;

    const osc = this._audioCtx.createOscillator();
    const gain = this._audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(kickCfg.kickStartFreq, time);
    osc.frequency.exponentialRampToValueAtTime(
      kickCfg.kickEndFreq,
      time + kickCfg.kickDuration
    );

    gain.gain.setValueAtTime(kickCfg.kickGain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + kickCfg.kickDuration);

    osc.connect(gain);
    gain.connect(this._masterGain);

    osc.start(time);
    osc.stop(time + kickCfg.kickDuration);
  }

  private _scheduleSnare(time: number): void {
    if (!this._audioCtx || !this._masterGain) return;
    const snareCfg = this._config.drum;

    // 1) 스네어 와이어 노이즈
    if (this._noiseBuffer) {
      const noise = this._audioCtx.createBufferSource();
      noise.buffer = this._noiseBuffer;

      const filter = this._audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, time);

      const noiseGain = this._audioCtx.createGain();
      noiseGain.gain.setValueAtTime(snareCfg.snareGain, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + snareCfg.snareDuration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this._masterGain);

      noise.start(time);
      noise.stop(time + snareCfg.snareDuration);
    }

    // 2) 스네어 톤 바디
    const toneOsc = this._audioCtx.createOscillator();
    const toneGain = this._audioCtx.createGain();

    toneOsc.type = 'triangle';
    toneOsc.frequency.setValueAtTime(snareCfg.snareToneFreq, time);
    toneOsc.frequency.exponentialRampToValueAtTime(70, time + snareCfg.snareDuration * 0.7);

    toneGain.gain.setValueAtTime(snareCfg.snareGain * 0.7, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + snareCfg.snareDuration * 0.7);

    toneOsc.connect(toneGain);
    toneGain.connect(this._masterGain);

    toneOsc.start(time);
    toneOsc.stop(time + snareCfg.snareDuration * 0.7);
  }

  private _scheduleHihat(time: number, isAccent: boolean): void {
    if (!this._audioCtx || !this._masterGain || !this._noiseBuffer) return;
    const hihatCfg = this._config.drum;

    const noise = this._audioCtx.createBufferSource();
    noise.buffer = this._noiseBuffer;

    const filter = this._audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(hihatCfg.hihatFilterFreq, time);

    const gain = this._audioCtx.createGain();
    const targetGain = isAccent ? hihatCfg.hihatGain : hihatCfg.hihatGain * 0.65;
    gain.gain.setValueAtTime(targetGain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + hihatCfg.hihatDuration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);

    noise.start(time);
    noise.stop(time + hihatCfg.hihatDuration);
  }

  private _scheduleBass(freq: number, time: number, duration: number): void {
    if (!this._audioCtx || !this._masterGain) return;
    const bassCfg = this._config.bass;

    const osc = this._audioCtx.createOscillator();
    const filter = this._audioCtx.createBiquadFilter();
    const gain = this._audioCtx.createGain();

    // 록 베이스: 배음이 풍부한 Sawtooth 파형 + Lowpass 필터
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(bassCfg.filterFreq, time);
    filter.Q.setValueAtTime(bassCfg.filterQ, time);

    gain.gain.setValueAtTime(bassCfg.gain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);

    osc.start(time);
    osc.stop(time + duration);
  }
}
