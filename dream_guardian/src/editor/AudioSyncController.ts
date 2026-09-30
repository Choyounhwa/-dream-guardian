/**
 * AudioSyncController.ts - Web Audio API 기반 오디오 비트 동기화 및 메트로놈 신디사이저
 *
 * 명세서 (docs/06_DANCE_CHOREO_EDITOR_SPEC.md 3.5절):
 * - BPM: 기본 95 (secondsPerBeat = 60 / BPM)
 * - 박자: 4/4 박자
 * - 마디 첫 박(Downbeat / 880Hz) 및 보조 박(440Hz) 구분 합성
 * - 오디오 클록 정밀 동기화 및 Lookahead 스케줄러 지원
 */

export interface AudioSyncOptions {
  bpm?: number;
  timeSignature?: [number, number];
  enableAudioNode?: boolean;
}

export type TickCallback = (beat: number, isDownbeat: boolean) => void;

export class AudioSyncController {
  private _bpm: number;
  private _timeSignature: [number, number];
  private _isPlaying: boolean = false;
  private _isMuted: boolean = false;
  private _currentBeat: number = 0;
  private _startBeat: number = 0;
  private _startTimeMs: number = 0;
  private _lastTickedBeat: number = 0;
  private _timerId: any = null;

  private _audioCtx: AudioContext | null = null;
  private readonly _enableAudioNode: boolean;

  public onTick: TickCallback | null = null;

  constructor(options?: AudioSyncOptions) {
    this._bpm = options?.bpm ?? 95;
    this._timeSignature = options?.timeSignature ?? [4, 4];
    this._enableAudioNode = options?.enableAudioNode ?? true;
  }

  get bpm(): number {
    return this._bpm;
  }

  get timeSignature(): [number, number] {
    return this._timeSignature;
  }

  get secondsPerBeat(): number {
    return 60 / this._bpm;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  setBpm(bpm: number): void {
    const clamped = Math.max(40, Math.min(240, Math.round(bpm)));
    if (this._isPlaying) {
      // 재생 중 BPM 변경 시 현재 비트 위치 보존
      const now = this.nowMs();
      this._startBeat = this.getCurrentBeat();
      this._startTimeMs = now;
    }
    this._bpm = clamped;
  }

  setMuted(muted: boolean): void {
    this._isMuted = muted;
  }

  start(fromBeat: number = 0): void {
    this.initAudioContext();
    this._isPlaying = true;
    this._startBeat = fromBeat;
    this._currentBeat = fromBeat;
    this._lastTickedBeat = Math.floor(fromBeat);
    this._startTimeMs = this.nowMs();

    if (this._timerId) {
      clearInterval(this._timerId);
    }
    this._timerId = setInterval(() => this.checkTickSchedule(), 20);
  }

  stop(): void {
    if (this._isPlaying) {
      this._currentBeat = this.getCurrentBeat();
      this._isPlaying = false;
    }
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  seek(beat: number): void {
    const wasPlaying = this._isPlaying;
    this._currentBeat = beat;
    this._startBeat = beat;
    this._lastTickedBeat = Math.floor(beat);
    this._startTimeMs = this.nowMs();

    if (!wasPlaying) {
      this._isPlaying = false;
    }
  }

  getCurrentBeat(): number {
    if (!this._isPlaying) {
      return this._currentBeat;
    }
    const elapsedSec = (this.nowMs() - this._startTimeMs) / 1000;
    return this._startBeat + elapsedSec / this.secondsPerBeat;
  }

  private nowMs(): number {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  private initAudioContext(): void {
    if (!this._enableAudioNode) return;
    if (typeof window === 'undefined') return;

    if (!this._audioCtx) {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this._audioCtx = new AudioCtxClass();
      }
    }

    if (this._audioCtx && this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
  }

  private checkTickSchedule(): void {
    if (!this._isPlaying) return;

    const currentBeat = this.getCurrentBeat();
    const nextIntegerBeat = Math.floor(currentBeat);

    if (nextIntegerBeat > this._lastTickedBeat) {
      for (let b = this._lastTickedBeat + 1; b <= nextIntegerBeat; b++) {
        // 4/4 박자에서 1박(Downbeat) 판정 (1, 5, 9, 13...)
        const isDownbeat = (b - 1) % this._timeSignature[0] === 0;

        if (!this._isMuted) {
          this.playTickSound(isDownbeat);
        }

        if (this.onTick) {
          this.onTick(b, isDownbeat);
        }
      }
      this._lastTickedBeat = nextIntegerBeat;
    }
  }

  /**
   * Web Audio API 오실레이터로 틱 사운드 합성
   */
  private playTickSound(isDownbeat: boolean): void {
    if (!this._audioCtx || !this._enableAudioNode) return;

    try {
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isDownbeat ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(isDownbeat ? 880 : 440, ctx.currentTime);

      gain.gain.setValueAtTime(isDownbeat ? 0.35 : 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // 오디오 노드 에러 무시
    }
  }
}
