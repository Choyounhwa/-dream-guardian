/**
 * MotionNoteTimeline.ts - 통합 모션 리듬 노트 타임라인 관리자
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§5 인터랙션 판정 모델, §9 MRN-09)
 * @see Issue #483 [MRN-09]
 *
 * 핵심 역할:
 * - MotionNote 정의 목록을 로드하여 런타임(MotionNoteRuntime) 생성 및 시간 추적
 *   (landingTime = start + (beat-1) * spb, displayStart = landingTime - leadBeats * spb)
 * - 시간 경과에 따른 생명주기 상태 전이 (pending -> inFlight -> judging -> resolved)
 * - 등록된 InteractionJudge(TapJudge 등)에 매 프레임 평가 위임 및 결과 통지
 * - 렌더러에 전달할 읽기 전용 MotionNoteRenderItem[] 스냅샷(getRenderItems) 제공
 * - onRating 및 onComplete 콜백 관리
 */

import type {
  MotionNote,
  MotionNoteRuntime,
  MotionNoteResult,
  MotionNoteRenderItem,
  MotionInteractionType,
} from '../types/motion-note.js';
import type { FootKeynoteEvent } from '../types/keynote.js';
import {
  DEFAULT_STAR_TIMING_WINDOWS,
  type StarTimingWindows,
} from '../../config/beat-motion.config.js';
import type { TimingLeniencyConfig } from '../../config/judgment.config.js';
import {
  TapJudge,
  type InteractionJudge,
  type MotionInputSnapshot,
  EPSILON,
} from './interaction/TapJudge.js';
import { toRenderItem } from './adapters/starNoteAdapter.js';

export interface MotionNoteTimelineOptions {
  timingWindows?: StarTimingWindows;
  timingLeniency?: TimingLeniencyConfig;
  spb?: number;
  leadBeats?: number;
  judges?: Iterable<InteractionJudge>;
}

export interface LoadNotesOptions {
  sequenceStart?: number;
  spb?: number;
  leadBeats?: number;
}

export class MotionNoteTimeline {
  private readonly _timingWindows: StarTimingWindows;
  private readonly _timingLeniency?: TimingLeniencyConfig;
  private _spb: number;
  private _leadBeats: number;
  private readonly _judges = new Map<MotionInteractionType, InteractionJudge>();

  private _runtimes: MotionNoteRuntime[] = [];
  private _sequenceStart = 0;
  private _currentTime = 0;
  private _isStarted = false;
  private _isPaused = false;
  private _allCompletedNotified = false;

  private _ratingListeners: Array<(result: MotionNoteResult, runtime: MotionNoteRuntime) => void> = [];
  private _completeListeners: Array<() => void> = [];

  constructor(options?: MotionNoteTimelineOptions) {
    this._timingWindows = options?.timingWindows ?? DEFAULT_STAR_TIMING_WINDOWS;
    this._timingLeniency = options?.timingLeniency;
    this._spb = options?.spb ?? 0.5;
    this._leadBeats = options?.leadBeats ?? 2;

    // 기본 판정기 등록
    const defaultTapJudge = new TapJudge({
      timingWindows: this._timingWindows,
      timingLeniency: this._timingLeniency,
    });
    this.registerJudge(defaultTapJudge);

    if (options?.judges) {
      for (const judge of options.judges) {
        this.registerJudge(judge);
      }
    }
  }

  get timingWindows(): StarTimingWindows {
    return this._timingWindows;
  }

  get spb(): number {
    return this._spb;
  }

  get leadBeats(): number {
    return this._leadBeats;
  }

  get sequenceStart(): number {
    return this._sequenceStart;
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get isStarted(): boolean {
    return this._isStarted;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get runtimes(): readonly MotionNoteRuntime[] {
    return this._runtimes;
  }

  get notes(): readonly MotionNote[] {
    return this._runtimes.map((r) => r.note);
  }

  get currentTarget(): MotionNoteRuntime | null {
    const pending = this._runtimes.filter((r) => r.state !== 'resolved');
    return pending.length > 0 ? pending[0] : null;
  }

  get isAllResolved(): boolean {
    return this._isStarted && this._runtimes.length > 0 && this._runtimes.every((r) => r.state === 'resolved');
  }

  get isComplete(): boolean {
    if (!this._isStarted || this._runtimes.length === 0) return false;
    const allResolved = this._runtimes.every((r) => r.state === 'resolved');
    const lastLanding = this._runtimes.reduce((max, r) => Math.max(max, r.landingTime), 0);
    const completeAt = lastLanding + this._timingWindows.late;
    return allResolved && this._currentTime >= completeAt - EPSILON;
  }

  registerJudge(judge: InteractionJudge): void {
    this._judges.set(judge.type, judge);
  }

  getJudge(type: MotionInteractionType): InteractionJudge | undefined {
    return this._judges.get(type);
  }

  setPaused(paused: boolean): void {
    this._isPaused = paused;
  }

  reset(): void {
    this._runtimes = [];
    this._isStarted = false;
    this._isPaused = false;
    this._currentTime = 0;
    this._sequenceStart = 0;
    this._allCompletedNotified = false;
  }

  /**
   * MotionNote 정의 목록을 로드하여 런타임 인스턴스 생성
   * landingTime = sequenceStart + (beat - 1) * spb
   * displayStart = landingTime - leadBeats * spb
   */
  loadNotes(notes: readonly MotionNote[], options?: LoadNotesOptions): void {
    this.reset();
    this._sequenceStart = options?.sequenceStart ?? 0;
    this._spb = options?.spb ?? this._spb;
    this._leadBeats = options?.leadBeats ?? this._leadBeats;
    this._currentTime = this._sequenceStart;
    this._isStarted = true;

    this._runtimes = notes.map((note) => {
      const leadBeats = note.leadBeats ?? this._leadBeats;
      const landingTime = this._sequenceStart + (note.beat - 1) * this._spb;
      const displayStart = landingTime - leadBeats * this._spb;

      return {
        note,
        landingTime,
        displayStart,
        state: 'pending',
      };
    });
  }

  /**
   * 매 프레임 시간 갱신, 상태 전이 및 판정 평가 수행
   */
  update(now: number, input?: MotionInputSnapshot): MotionNoteResult[] {
    if (!this._isStarted || this._isPaused) return [];

    this._currentTime = Math.max(this._currentTime, now);
    const results: MotionNoteResult[] = [];

    // 1. 생명주기 상태 전이 (pending -> inFlight -> judging)
    for (const rt of this._runtimes) {
      if (rt.state === 'resolved') continue;

      if (now < rt.displayStart) {
        rt.state = 'pending';
      } else if (now < rt.landingTime - this._timingWindows.late) {
        rt.state = 'inFlight';
      } else {
        rt.state = 'judging';
      }
    }

    // 2. 등록된 판정기를 통한 판정 평가
    for (const rt of this._runtimes) {
      if (rt.state === 'resolved') continue;

      const judge = this._judges.get(rt.note.interaction);
      if (!judge) continue;

      const result = judge.evaluate(rt, input ?? {}, now);
      if (result) {
        rt.state = 'resolved';
        rt.result = result;
        results.push(result);
        this._notifyRating(result, rt);
      }
    }

    // 3. 전체 완료 확인
    this._checkCompletion();

    return results;
  }

  /**
   * 렌더러가 소비할 읽기 전용 MotionNoteRenderItem[] 스냅샷 반환
   */
  getRenderItems(now?: number): MotionNoteRenderItem[] {
    const queryTime = now ?? this._currentTime;
    const items: MotionNoteRenderItem[] = [];

    for (const rt of this._runtimes) {
      // 표시 시작 이전 노트 제외
      if (queryTime < rt.displayStart) continue;

      // 이미 판정 완료된 노트는 연출 표시 시간(0.35s) 후 컬링
      if (rt.state === 'resolved' && queryTime > rt.landingTime + 0.35) {
        continue;
      }

      items.push(toRenderItem(rt, queryTime));
    }

    return items;
  }

  /**
   * 발 입력 처리 (FootKeynoteEvent 또는 zoneId)
   */
  fromFoot(
    eventOrZoneId: FootKeynoteEvent | number,
    timestamp?: number,
  ): MotionNoteResult | null {
    if (!this._isStarted || this._isPaused) return null;

    const zoneId = typeof eventOrZoneId === 'number' ? eventOrZoneId : eventOrZoneId.zoneId;
    const currentTime =
      timestamp ?? (typeof eventOrZoneId === 'object' ? eventOrZoneId.timestamp : this._currentTime);
    this._currentTime = Math.max(this._currentTime, currentTime);

    // 먼저 만료 처리
    this.update(currentTime);

    const judge = this._judges.get('tap') as TapJudge | undefined;
    if (!judge) return null;

    // 타이밍 윈도우 내의 일치하는 발 노트 탐색
    for (const rt of this._runtimes) {
      if (rt.state === 'resolved') continue;

      const req = rt.note.requirements[0];
      if (!req || req.zoneId !== zoneId) continue;

      const timeDiff = currentTime - rt.landingTime;
      if (Math.abs(timeDiff) <= this._timingWindows.late + EPSILON) {
        const rating = judge.judgeTiming(currentTime, rt.landingTime);
        const res: MotionNoteResult = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating,
          success: rating !== 'Miss',
          timingError: timeDiff,
          matchedParts: [req.part],
        };
        rt.state = 'resolved';
        rt.result = res;
        this._notifyRating(res, rt);
        this._checkCompletion();
        return res;
      }
    }

    return null;
  }

  /**
   * 키보드(Space 등) 직접 입력 처리
   */
  fromKeyboard(timestamp?: number): MotionNoteResult | null {
    if (!this._isStarted || this._isPaused) return null;

    const currentTime = timestamp ?? this._currentTime;
    this._currentTime = Math.max(this._currentTime, currentTime);

    this.update(currentTime);

    const judge = this._judges.get('tap') as TapJudge | undefined;
    if (!judge) return null;

    for (const rt of this._runtimes) {
      if (rt.state === 'resolved') continue;

      const timeDiff = currentTime - rt.landingTime;
      if (Math.abs(timeDiff) <= this._timingWindows.late + EPSILON) {
        const rating = judge.judgeTiming(currentTime, rt.landingTime);
        const res: MotionNoteResult = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating,
          success: rating !== 'Miss',
          timingError: timeDiff,
          matchedParts: rt.note.requirements.map((r) => r.part),
        };
        rt.state = 'resolved';
        rt.result = res;
        this._notifyRating(res, rt);
        this._checkCompletion();
        return res;
      }
    }

    return null;
  }

  /**
   * 터치 화면 입력 처리
   */
  fromTouch(zoneId: number, timestamp?: number): MotionNoteResult | null {
    if (!this._isStarted || this._isPaused) return null;

    const currentTime = timestamp ?? this._currentTime;
    this._currentTime = Math.max(this._currentTime, currentTime);

    this.update(currentTime);

    const judge = this._judges.get('tap') as TapJudge | undefined;
    if (!judge) return null;

    for (const rt of this._runtimes) {
      if (rt.state === 'resolved') continue;

      const matchReq = rt.note.requirements.some((r) => r.zoneId === zoneId);
      if (!matchReq) continue;

      const timeDiff = currentTime - rt.landingTime;
      if (Math.abs(timeDiff) <= this._timingWindows.late + EPSILON) {
        const rating = judge.judgeTiming(currentTime, rt.landingTime);
        const res: MotionNoteResult = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating,
          success: rating !== 'Miss',
          timingError: timeDiff,
          matchedParts: rt.note.requirements.map((r) => r.part),
        };
        rt.state = 'resolved';
        rt.result = res;
        this._notifyRating(res, rt);
        this._checkCompletion();
        return res;
      }
    }

    return null;
  }

  /**
   * noteId로 런타임 인스턴스 조회 (additive)
   */
  getRuntime(noteId: string): MotionNoteRuntime | undefined {
    return this._runtimes.find((r) => r.note.id === noteId);
  }

  /**
   * noteId로 런타임 노트 강제/수동 판정 확정 (additive)
   */
  resolveNote(noteId: string, result: MotionNoteResult): boolean {
    const rt = this.getRuntime(noteId);
    if (!rt || rt.state === 'resolved') return false;
    this.resolveRuntime(rt, result);
    return true;
  }

  /**
   * 런타임 노트 강제/수동 판정 확정
   */
  resolveRuntime(rt: MotionNoteRuntime, result: MotionNoteResult): void {
    if (rt.state === 'resolved') return;
    rt.state = 'resolved';
    rt.result = result;
    this._notifyRating(result, rt);
    this._checkCompletion();
  }

  onRating(listener: (result: MotionNoteResult, runtime: MotionNoteRuntime) => void): () => void {
    this._ratingListeners.push(listener);
    return () => {
      this._ratingListeners = this._ratingListeners.filter((l) => l !== listener);
    };
  }

  onComplete(listener: () => void): () => void {
    this._completeListeners.push(listener);
    return () => {
      this._completeListeners = this._completeListeners.filter((l) => l !== listener);
    };
  }

  private _notifyRating(result: MotionNoteResult, runtime: MotionNoteRuntime): void {
    for (const listener of [...this._ratingListeners]) {
      try {
        listener(result, runtime);
      } catch (err) {
        console.error('[MotionNoteTimeline] onRating listener error:', err);
      }
    }
  }

  private _checkCompletion(): void {
    if (this.isComplete && !this._allCompletedNotified) {
      this._allCompletedNotified = true;
      for (const listener of [...this._completeListeners]) {
        try {
          listener();
        } catch (err) {
          console.error('[MotionNoteTimeline] onComplete listener error:', err);
        }
      }
    }
  }
}
