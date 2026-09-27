/**
 * RhythmEngine - 8박자 단일 비트 시간원 엔진
 *
 * BPM 기반 메트로놈 및 8박(0~7) 비트 인덱스 순환
 * 프레임 지연(lag spike) 시 누락/중복 없는 순차 비트 발행 (Catch-up)
 * GameEngine의 dt(초 단위)만 입력으로 사용하는 결정론적 시간 모델
 *
 * @see Issue #177 [BEAT-CORE-001]
 */

import type { EventBus } from './EventBus.js';

export interface BeatEvent {
  /** 라운드 내 박자 인덱스 (0 ~ beatsPerRound - 1, e.g. 0 ~ 7) */
  beatIndex: number;
  /** 시작 이후 총 누적 박자 수 (0, 1, 2, ...) */
  totalBeats: number;
  /** 현재 라운드 번호 (0, 1, 2, ...) */
  roundIndex: number;
  /** 해당 라운드의 첫 번째 박 여부 (beatIndex === 0) */
  isFirstBeatOfRound: boolean;
  /** 해당 라운드의 마지막 박 여부 (beatIndex === beatsPerRound - 1) */
  isLastBeatOfRound: boolean;
  /** 현재 템포 (BPM) */
  bpm: number;
  /** 해당 비트의 이론적 타임스탬프 (초) */
  beatTime: number;
  /** 실제 엔진 누적 경과 시간 (초) */
  elapsedTime: number;
}

export interface RhythmEngineOptions {
  /** 템포 (분당 비트 수, 기본값: 120) */
  bpm?: number;
  /** 1라운드당 비트 수 (기본값: 8) */
  beatsPerRound?: number;
  /** 이벤트 버스 (선택 사항) */
  eventBus?: EventBus;
  /** 비트 콜백 리스너 */
  onBeat?: (event: BeatEvent) => void;
  /** 라운드 변경 콜백 리스너 (1라운드 이상부터 호출) */
  onRound?: (roundIndex: number) => void;
}

export class RhythmEngine {
  private _bpm: number;
  private _beatsPerRound: number;
  private _secondsPerBeat: number;
  private _secondsPerRound: number;

  private _elapsedTime = 0;
  private _lastBeatTime = 0;
  private _nextBeatTime = 0;
  private _totalBeatsEmitted = 0;

  private _running = false;
  private _paused = false;

  private readonly _beatListeners = new Set<(event: BeatEvent) => void>();
  private readonly _roundListeners = new Set<(roundIndex: number) => void>();
  private readonly _eventBus?: EventBus;

  constructor(options?: RhythmEngineOptions) {
    this._bpm = options?.bpm ?? 120;
    this._beatsPerRound = options?.beatsPerRound ?? 8;
    this._secondsPerBeat = 60 / this._bpm;
    this._secondsPerRound = this._secondsPerBeat * this._beatsPerRound;
    this._eventBus = options?.eventBus;

    if (options?.onBeat) {
      this._beatListeners.add(options.onBeat);
    }
    if (options?.onRound) {
      this._roundListeners.add(options.onRound);
    }
  }

  /** 현재 템포 (BPM) */
  get bpm(): number {
    return this._bpm;
  }

  /** 한 비트당 소요 시간 (초, BPM 120 시 0.5초) */
  get secondsPerBeat(): number {
    return this._secondsPerBeat;
  }

  /** 1라운드당 비트 수 (기본 8) */
  get beatsPerRound(): number {
    return this._beatsPerRound;
  }

  /** 1라운드(8박) 총 소요 시간 (초, BPM 120 8박 시 4.0초) */
  get secondsPerRound(): number {
    return this._secondsPerRound;
  }

  /** 엔진 누적 활성 경과 시간 (초, pause 제외) */
  get elapsedTime(): number {
    return this._elapsedTime;
  }

  /** 현재 비트 인덱스 (0 ~ beatsPerRound - 1) */
  get beatIndex(): number {
    if (this._totalBeatsEmitted === 0) return 0;
    return (this._totalBeatsEmitted - 1) % this._beatsPerRound;
  }

  /** 총 누적 경과 비트 수 (0부터 시작) */
  get totalBeats(): number {
    if (this._totalBeatsEmitted === 0) return 0;
    return this._totalBeatsEmitted - 1;
  }

  /** 현재 라운드 인덱스 (0부터 시작) */
  get roundIndex(): number {
    if (this._totalBeatsEmitted === 0) return 0;
    return Math.floor((this._totalBeatsEmitted - 1) / this._beatsPerRound);
  }

  /** 현재 비트 내부 진행률 (0.0 ~ 1.0) */
  get beatProgress(): number {
    if (this._totalBeatsEmitted === 0) return 0;
    const progressTime = this._elapsedTime - this._lastBeatTime;
    return Math.max(0, Math.min(1, progressTime / this._secondsPerBeat));
  }

  /** 현재 라운드(8박) 내부 진행률 (0.0 ~ 1.0) */
  get roundProgress(): number {
    if (this._totalBeatsEmitted === 0) return 0;
    return (this.beatIndex + this.beatProgress) / this._beatsPerRound;
  }

  /** 엔진 실행 중 여부 */
  get running(): boolean {
    return this._running;
  }

  /** 일시정지 여부 */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * 리듬 엔진 가동 시작
   * @param options.emitFirstBeat t=0 시점에 0번째 비트를 즉시 발행할지 여부 (기본 true)
   */
  start(options?: { emitFirstBeat?: boolean }): void {
    const emitFirst = options?.emitFirstBeat ?? true;
    this._running = true;
    this._paused = false;

    if (this._totalBeatsEmitted === 0) {
      this._lastBeatTime = 0;
      this._nextBeatTime = this._secondsPerBeat;

      if (emitFirst) {
        const event: BeatEvent = {
          beatIndex: 0,
          totalBeats: 0,
          roundIndex: 0,
          isFirstBeatOfRound: true,
          isLastBeatOfRound: this._beatsPerRound === 1,
          bpm: this._bpm,
          beatTime: 0,
          elapsedTime: this._elapsedTime,
        };
        this._totalBeatsEmitted = 1;
        this._dispatchBeat(event);
      }
    }
  }

  /** 일시정지 (시간 진행 및 비트 발행 중단) */
  pause(): void {
    if (this._running) {
      this._paused = true;
    }
  }

  /** 일시정지 해제 (현재 시점부터 재개) */
  resume(): void {
    if (this._running) {
      this._paused = false;
    }
  }

  /** 정지 (running = false) */
  stop(): void {
    this._running = false;
  }

  /** 모든 시간, 비트 기록 및 상태 완전 초기화 */
  reset(): void {
    this._elapsedTime = 0;
    this._lastBeatTime = 0;
    this._nextBeatTime = 0;
    this._totalBeatsEmitted = 0;
    this._running = false;
    this._paused = false;
  }

  /**
   * 프레임 델타타임(dt: 초 단위)을 입력받아 비트 시간원을 전진
   * 프레임 지연으로 여러 박이 경과해도 누락 없이 순차 발행 (Catch-up)
   * @param dt 경과 시간 (초 단위)
   * @returns 해당 프레임 틱에서 발행된 BeatEvent 배열
   */
  update(dt: number): BeatEvent[] {
    if (!this._running || this._paused || dt <= 0) {
      return [];
    }

    this._elapsedTime += dt;
    const emitted: BeatEvent[] = [];

    // EPSILON 1e-9로 부동소수점 오차 보정
    while (this._elapsedTime >= this._nextBeatTime - 1e-9) {
      const totalBeats = this._totalBeatsEmitted;
      const beatIndex = totalBeats % this._beatsPerRound;
      const roundIndex = Math.floor(totalBeats / this._beatsPerRound);
      const isFirstBeatOfRound = beatIndex === 0;
      const isLastBeatOfRound = beatIndex === this._beatsPerRound - 1;

      const event: BeatEvent = {
        beatIndex,
        totalBeats,
        roundIndex,
        isFirstBeatOfRound,
        isLastBeatOfRound,
        bpm: this._bpm,
        beatTime: totalBeats * this._secondsPerBeat,
        elapsedTime: this._elapsedTime,
      };

      this._lastBeatTime = this._nextBeatTime;
      this._nextBeatTime += this._secondsPerBeat;
      this._totalBeatsEmitted++;

      emitted.push(event);
      this._dispatchBeat(event);

      if (isFirstBeatOfRound && roundIndex > 0) {
        this._dispatchRound(roundIndex);
      }
    }

    return emitted;
  }

  /**
   * 템포 동적 변경
   * @param newBpm 새 BPM (양수)
   */
  setBpm(newBpm: number): void {
    if (newBpm <= 0) return;
    this._bpm = newBpm;
    this._secondsPerBeat = 60 / newBpm;
    this._secondsPerRound = this._secondsPerBeat * this._beatsPerRound;

    if (this._totalBeatsEmitted > 0) {
      this._nextBeatTime = this._lastBeatTime + this._secondsPerBeat;
    }
  }

  /** 비트 이벤트 리스너 등록 (구독 해제 함수 반환) */
  onBeat(callback: (event: BeatEvent) => void): () => void {
    this._beatListeners.add(callback);
    return () => this.offBeat(callback);
  }

  /** 비트 이벤트 리스너 해제 */
  offBeat(callback: (event: BeatEvent) => void): void {
    this._beatListeners.delete(callback);
  }

  /** 라운드 변경 이벤트 리스너 등록 (구독 해제 함수 반환) */
  onRound(callback: (roundIndex: number) => void): () => void {
    this._roundListeners.add(callback);
    return () => this._roundListeners.delete(callback);
  }

  /** 내부 비트 이벤트 전파 */
  private _dispatchBeat(event: BeatEvent): void {
    for (const listener of this._beatListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[RhythmEngine] onBeat listener error:', err);
      }
    }

    if (this._eventBus) {
      this._eventBus.emit('rhythm:beat' as any, event as any);
    }
  }

  /** 내부 라운드 변경 이벤트 전파 */
  private _dispatchRound(roundIndex: number): void {
    for (const listener of this._roundListeners) {
      try {
        listener(roundIndex);
      } catch (err) {
        console.error('[RhythmEngine] onRound listener error:', err);
      }
    }

    if (this._eventBus) {
      this._eventBus.emit('rhythm:round' as any, { roundIndex } as any);
    }
  }
}
