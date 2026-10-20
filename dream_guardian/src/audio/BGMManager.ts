/**
 * BGMManager.ts - 배경음악(BGM) 갭리스 무한 루프 및 페이즈/더킹 사운드 관리자
 *
 * 제1장 하얘시니 하드 록 사운드트랙 오디오 에셋을 Web Audio API 기반으로
 * 갭리스 무한 루프 재생하며, 게임 페이즈(러닝/휴식/키노트)별 필터 모듈레이션,
 * TTS 오디오 더킹, 일시정지 및 볼륨 슬라이더 연동을 전담합니다.
 *
 * @see Issue #223 [AUDIO-SAMPLE-001]
 * @see Issue #630 [REFACTOR-DRY-003]
 */

import { createAudioContext } from './AudioContextFactory.js';

export type BGMPhase = 'DEFAULT' | 'RUN_QUESTION' | 'REST_READY' | 'KEYNOTE_PERFORMANCE';

export interface BGMManagerOptions {
  audioContext?: AudioContext;
  trackUrl?: string;
  volume?: number;
  bpm?: number;
}

export class BGMManager {
  private _audioCtx: AudioContext | null = null;
  private _trackUrl: string;
  private _bpm: number;
  private _volume: number;
  private _muted: boolean = false;
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  private _phase: BGMPhase = 'DEFAULT';
  private _isDucked: boolean = false;

  private _audioBuffer: AudioBuffer | null = null;
  private _currentSource: AudioBufferSourceNode | null = null;

  // Web Audio Nodes
  private _filterNode: BiquadFilterNode | null = null;
  private _duckingGain: GainNode | null = null;
  private _phaseGain: GainNode | null = null;
  private _masterGain: GainNode | null = null;

  private _fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: BGMManagerOptions) {
    this._trackUrl = options?.trackUrl ?? '/audio/bgm/ch1_hayesini_rock_sample.wav';
    this._volume = Math.max(0, Math.min(1, options?.volume ?? 0.5));
    this._bpm = options?.bpm ?? 120;

    if (options?.audioContext) {
      this._audioCtx = options.audioContext;
      this._initNodes();
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

  get volume(): number {
    return this._volume;
  }

  get bpm(): number {
    return this._bpm;
  }

  get phase(): BGMPhase {
    return this._phase;
  }

  get isDucked(): boolean {
    return this._isDucked;
  }

  get trackUrl(): string {
    return this._trackUrl;
  }

  get audioContext(): AudioContext | null {
    return this._audioCtx;
  }

  /**
   * 브라우저 AudioContext 준비 및 노드 초기화
   */
  private _ensureAudioContext(): AudioContext | null {
    if (!this._audioCtx) {
      this._audioCtx = createAudioContext();
    }
    if (this._audioCtx && !this._masterGain) {
      this._initNodes();
    }
    return this._audioCtx;
  }

  private _initNodes(): void {
    if (!this._audioCtx) return;
    try {
      // 1. 저역통과 필터 (REST_READY 숨고르기 Muffled 연출)
      this._filterNode = this._audioCtx.createBiquadFilter();
      this._filterNode.type = 'lowpass';
      this._filterNode.frequency.setValueAtTime(20000, this._audioCtx.currentTime);
      this._filterNode.Q.setValueAtTime(1, this._audioCtx.currentTime);

      // 2. TTS 낭독 오디오 더킹 게인
      this._duckingGain = this._audioCtx.createGain();
      this._duckingGain.gain.setValueAtTime(1.0, this._audioCtx.currentTime);

      // 3. 페이즈별 사운드 밸런스 게인
      this._phaseGain = this._audioCtx.createGain();
      this._phaseGain.gain.setValueAtTime(1.0, this._audioCtx.currentTime);

      // 4. 마스터 게인
      this._masterGain = this._audioCtx.createGain();
      const currentVol = this._muted ? 0 : this._volume;
      this._masterGain.gain.setValueAtTime(currentVol, this._audioCtx.currentTime);

      // 연결 체인: Filter -> DuckingGain -> PhaseGain -> MasterGain -> Destination
      this._filterNode.connect(this._duckingGain);
      this._duckingGain.connect(this._phaseGain);
      this._phaseGain.connect(this._masterGain);
      this._masterGain.connect(this._audioCtx.destination);
    } catch {
      // AudioContext mock 환경 안전 처리
    }
  }

  /**
   * 오디오 에셋 버퍼 비동기 로드 및 디코딩 (캐싱)
   */
  async loadTrack(url?: string): Promise<AudioBuffer | null> {
    const targetUrl = url ?? this._trackUrl;
    if (this._audioBuffer && targetUrl === this._trackUrl) {
      return this._audioBuffer;
    }

    const ctx = this._ensureAudioContext();
    if (!ctx) return null;

    try {
      if (typeof fetch !== 'undefined') {
        const response = await fetch(targetUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch BGM track: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        this._audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this._trackUrl = targetUrl;
        return this._audioBuffer;
      }
    } catch {
      // fetch/decodeAudioData 불가 환경 또는 목(Mock) 환경 대비 폴백 버퍼 생성
      if (ctx.createBuffer) {
        this._audioBuffer = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
        return this._audioBuffer;
      }
    }
    return null;
  }

  /**
   * 사용자 제스처 대응 AudioContext unlock
   */
  async unlock(): Promise<void> {
    const ctx = this._ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // 무시
      }
    }
  }

  /**
   * BGM 무한 루프 재생
   */
  async play(trackUrl?: string): Promise<void> {
    if (this._isPlaying) return;

    this._isPlaying = true;
    this._isPaused = false;

    await this.unlock();
    const ctx = this._ensureAudioContext();

    if (trackUrl && trackUrl !== this._trackUrl) {
      this._trackUrl = trackUrl;
      this._audioBuffer = null;
    }

    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
    }

    if (ctx) {
      try {
        let buffer = this._audioBuffer;
        if (!buffer) {
          buffer = await this.loadTrack(this._trackUrl);
        }

        if (this._currentSource) {
          try {
            this._currentSource.stop();
          } catch {
            // 무시
          }
          this._currentSource = null;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        if (this._filterNode) {
          source.connect(this._filterNode);
        } else if (this._masterGain) {
          source.connect(this._masterGain);
        }

        source.start();
        this._currentSource = source;
      } catch {
        // 재생 오류 시 안전 폴백
      }
    }
  }

  /**
   * BGM 시작 (play의 별칭)
   */
  async start(): Promise<void> {
    return this.play();
  }

  /**
   * BGM 일시정지 (PauseModal 등)
   */
  pause(): void {
    if (!this._isPlaying && !this._isPaused) return;

    if (this._currentSource) {
      try {
        this._currentSource.stop();
      } catch {
        // 무시
      }
      this._currentSource = null;
    }

    this._isPlaying = false;
    this._isPaused = true;
  }

  /**
   * BGM 재개
   */
  async resume(): Promise<void> {
    if (!this._isPaused) return;
    return this.play();
  }

  /**
   * BGM 완전 정지 및 초기화
   */
  stop(): void {
    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
    }

    if (this._currentSource) {
      try {
        this._currentSource.stop();
      } catch {
        // 무시
      }
      this._currentSource = null;
    }

    this._isPlaying = false;
    this._isPaused = false;
  }

  /**
   * 마스터 볼륨 설정 (0.0 ~ 1.0)
   */
  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    this._updateMasterGain();
  }

  /**
   * 음소거 설정
   */
  setMuted(muted: boolean): void {
    this._muted = muted;
    this._updateMasterGain();
  }

  private _updateMasterGain(): void {
    if (!this._masterGain || !this._audioCtx) return;
    const targetVol = this._muted ? 0 : this._volume;
    try {
      this._masterGain.gain.setValueAtTime(targetVol, this._audioCtx.currentTime);
    } catch {
      this._masterGain.gain.value = targetVol;
    }
  }

  /**
   * 페이즈 연동 사운드 모듈레이션
   * - REST_READY: Muffled 저역통과 필터 (800Hz) 숨고르기 연출
   * - KEYNOTE_PERFORMANCE: 필터 바이패스 (20000Hz) & 100% 풀 볼륨
   * - RUN_QUESTION / DEFAULT: 록 리듬 표준 밸런스
   */
  setPhase(phase: BGMPhase): void {
    this._phase = phase;
    if (!this._audioCtx) return;

    const now = this._audioCtx.currentTime;
    try {
      if (this._filterNode) {
        if (phase === 'REST_READY') {
          // 숨고르기: 800Hz 로우패스
          this._filterNode.frequency.setValueAtTime(800, now);
        } else {
          // 풀 개방: 20000Hz
          this._filterNode.frequency.setValueAtTime(20000, now);
        }
      }

      if (this._phaseGain) {
        if (phase === 'REST_READY') {
          this._phaseGain.gain.setValueAtTime(0.7, now);
        } else if (phase === 'KEYNOTE_PERFORMANCE') {
          this._phaseGain.gain.setValueAtTime(1.0, now);
        } else if (phase === 'RUN_QUESTION') {
          this._phaseGain.gain.setValueAtTime(0.9, now);
        } else {
          this._phaseGain.gain.setValueAtTime(1.0, now);
        }
      }
    } catch {
      // mock 환경 처리
    }
  }

  /**
   * TTS 오디오 더킹
   * QuestionSpeech 낭독 시 음악 볼륨을 0.35배로 감쇠
   */
  setDucking(active: boolean): void {
    this._isDucked = active;
    if (!this._duckingGain || !this._audioCtx) return;

    const now = this._audioCtx.currentTime;
    const targetGain = active ? 0.35 : 1.0;

    try {
      this._duckingGain.gain.setValueAtTime(targetGain, now);
    } catch {
      this._duckingGain.gain.value = targetGain;
    }
  }

  /**
   * 부드러운 페이드인 재생
   */
  fadeIn(duration: number = 0.5): void {
    this.play();
    if (!this._masterGain || !this._audioCtx || this._muted) return;

    const now = this._audioCtx.currentTime;
    const target = this._volume;

    try {
      this._masterGain.gain.setValueAtTime(0, now);
      this._masterGain.gain.linearRampToValueAtTime(target, now + Math.max(0.05, duration));
    } catch {
      this._masterGain.gain.value = target;
    }
  }

  /**
   * 부드러운 페이드아웃 후 정지
   */
  fadeOut(duration: number = 0.4): void {
    if (!this._isPlaying) return;

    if (this._masterGain && this._audioCtx && !this._muted) {
      const now = this._audioCtx.currentTime;
      try {
        this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
        this._masterGain.gain.linearRampToValueAtTime(0, now + Math.max(0.05, duration));
      } catch {
        // 무시
      }
    }

    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
    }

    this._fadeTimer = setTimeout(() => {
      this.stop();
      this._updateMasterGain();
      this._fadeTimer = null;
    }, Math.max(50, Math.floor(duration * 1000)));
  }
}
