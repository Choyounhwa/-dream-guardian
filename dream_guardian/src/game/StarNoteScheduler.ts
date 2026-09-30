/**
 * StarNoteScheduler.ts - 별모으기 7개 노트 스케줄·판정창·단일 결과 라우터
 *
 * Issue #235 (BUG-STAR-SCHEDULE-001):
 * - 7개 노트 착지 일정(0.5s, 1.0s, 1.5s, 2.0s, 2.5s, 3.0s, 3.5s) 분리 예약
 * - 노트 ID/roundId로 각 결과 1회 보장 (중복 및 누락 0건)
 * - 미입력 시 landingTime + 0.40s 만료 시점에 Miss 1회 확정
 * - 손/머리 커서 판정 (update), 발 입력 (fromFoot), Space 키보드 (fromKeyboard), 터치 (fromTouch) 공통 결과 경로 지원
 * - instrument === 'foot'인 노트는 손/머리/골반 커서 판정을 바이패스하고 발 입력으로만 판정
 * - 7개 노트가 모두 hit/miss로 확정되고 currentTime >= startTime + 3.90s 경과 시 isComplete = true 반환
 *
 * @see Issue #235 [BUG-STAR-SCHEDULE-001]
 * @see Issue #182 [INPUT-STAR-001]
 * @see Issue #210 [BEAT-KEYNOTE-ENGINE-001]
 */

import {
  DEFAULT_FITNESS_ZONES,
  type FitnessZone,
  isValidZoneForCursor,
} from '../../config/zone.config.js';
import type { CursorType } from '../../config/cursor.config.js';
import {
  DEFAULT_STAR_TIMING_WINDOWS,
  type StarTimingWindows,
} from '../../config/beat-motion.config.js';
import {
  CursorTracker,
  type CursorUpdateOptions,
  type PalmPositions,
  type ViewportProjectFn,
} from '../input/CursorTracker.js';
import { isInsideZone } from '../input/PostureMatcher.js';
import {
  judgeStarTiming,
  type StarRating,
  type StarCollectionResult,
  type ActiveStarTarget,
} from '../input/StarCollectionInput.js';
import { STAR_COLLECT_ROUTINE, type StarCollectNote } from '../data/danceRoutineData.js';
import type { Keynote, KeynoteInstrument, FootKeynoteEvent } from '../types/keynote.js';
import type { BodyPart } from '../types/posture.js';
import type { NormalizedLandmark } from '../types/index.js';

export interface ScheduledStarNote extends ActiveStarTarget {
  id: string;
  roundId: number;
  index: number;
  beat: number;
  patternId: string;
  part: BodyPart;
  cursorType: CursorType;
  zoneId: number;
  instrument: KeynoteInstrument;
  landingTime: number;
  actionName?: string;
  resolved: boolean;
  result: StarCollectionResult | null;
}

export interface StarNoteSchedulerOptions {
  notes?: readonly (Keynote | StarCollectNote)[];
  secondsPerBeat?: number;
  timingWindows?: StarTimingWindows;
  cursorTracker?: CursorTracker;
  zones?: readonly FitnessZone[];
  onRating?: (result: StarCollectionResult) => void;
  onComplete?: () => void;
}

const EPSILON = 1e-6;

export class StarNoteScheduler {
  private readonly _options: StarNoteSchedulerOptions;
  private readonly _secondsPerBeat: number;
  private readonly _timingWindows: StarTimingWindows;
  private readonly _cursorTracker: CursorTracker;
  private readonly _zones: readonly FitnessZone[];

  private _notes: ScheduledStarNote[] = [];
  private _startTime = 0;
  private _currentTime = 0;
  private _roundId = 1;
  private _isStarted = false;
  private _isPaused = false;
  private _listeners: ((result: StarCollectionResult) => void)[] = [];

  constructor(options?: StarNoteSchedulerOptions) {
    this._options = options ?? {};
    this._secondsPerBeat = options?.secondsPerBeat ?? 0.5;
    this._timingWindows = {
      ...DEFAULT_STAR_TIMING_WINDOWS,
      ...options?.timingWindows,
    };
    this._cursorTracker = options?.cursorTracker ?? new CursorTracker();
    this._zones = options?.zones ?? DEFAULT_FITNESS_ZONES;

    if (options?.onRating) {
      this._listeners.push(options.onRating);
    }
  }

  get notes(): readonly ScheduledStarNote[] {
    return this._notes;
  }

  get roundId(): number {
    return this._roundId;
  }

  get startTime(): number {
    return this._startTime;
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

  get pendingCount(): number {
    return this._notes.filter((n) => !n.resolved).length;
  }

  get resolvedCount(): number {
    return this._notes.filter((n) => n.resolved).length;
  }

  get cursorTracker(): CursorTracker {
    return this._cursorTracker;
  }

  /**
   * 미수집/대기 중인 활성 노트 목록 (렌더러용)
   */
  get activeNotes(): readonly ScheduledStarNote[] {
    return this._notes.filter((n) => !n.resolved);
  }

  /**
   * 가장 먼저 도달할 미판정 타겟 (단일 타깃 호환 인터페이스)
   */
  get currentTarget(): ScheduledStarNote | null {
    const pending = this._notes.filter((n) => !n.resolved);
    return pending.length > 0 ? pending[0] : null;
  }

  /**
   * 7개 노트가 모두 hit/miss로 확정되고 currentTime >= startTime + 3.90s 경과 시 true
   */
  get isComplete(): boolean {
    if (!this._isStarted || this._notes.length === 0) return false;
    const allResolved = this._notes.every((n) => n.resolved);
    return allResolved && this._currentTime >= this._startTime + 3.90 - EPSILON;
  }

  onRating(listener: (result: StarCollectionResult) => void): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  setPaused(paused: boolean): void {
    this._isPaused = paused;
  }

  setViewport(virtualWidth: number, virtualHeight: number, projectFn?: ViewportProjectFn): void {
    this._cursorTracker.setViewport(virtualWidth, virtualHeight, projectFn);
  }

  /**
   * 7개 노트 착지 일정(0.5s ~ 3.5s) 분리 예약 시작
   */
  start(
    startTime: number,
    options?: { roundId?: number; notes?: readonly (Keynote | StarCollectNote)[] },
  ): void {
    this._startTime = startTime;
    this._currentTime = startTime;
    this._isStarted = true;
    this._isPaused = false;
    this._roundId = options?.roundId ?? 1;

    const sourceNotes =
      options?.notes && options.notes.length > 0
        ? options.notes
        : this._options.notes && this._options.notes.length > 0
          ? this._options.notes
          : STAR_COLLECT_ROUTINE.notes;

    this._notes = sourceNotes.map((note, index) => {
      const beat = 'beat' in note ? note.beat : (note as any).beatIndex ?? index + 2;
      const landingTime = startTime + (index + 1) * this._secondsPerBeat;
      const instrument: KeynoteInstrument =
        note.instrument ?? (note.part === 'hip' ? 'foot' : 'hand');
      const cursorType = (note.part === 'hip' ? 'hip' : (note.part as CursorType)) ?? 'leftHand';

      return {
        id: `${this._roundId}_note_${index}_b${beat}`,
        roundId: this._roundId,
        index,
        beat,
        beatIndex: beat,
        patternId: note.patternId,
        part: note.part,
        cursorType,
        zoneId: note.zoneId,
        instrument,
        landingTime,
        actionName: (note as any).actionName,
        resolved: false,
        result: null,
      };
    });
  }

  reset(): void {
    this._notes = [];
    this._startTime = 0;
    this._currentTime = 0;
    this._isStarted = false;
    this._isPaused = false;
    this._cursorTracker.reset();
  }

  /**
   * 매 프레임 업데이트 및 포즈/랜드마크 커서 판정
   */
  update(
    currentTime: number,
    landmarks?: readonly NormalizedLandmark[] | null,
    palms?: PalmPositions,
    isMirrored = false,
    options?: CursorUpdateOptions,
  ): StarCollectionResult[] {
    if (!this._isStarted || this._isPaused) return [];
    this._currentTime = Math.max(this._currentTime, currentTime);

    const results: StarCollectionResult[] = [];

    // 1. 미입력 만료 노트 체크 (landingTime + 0.40s)
    const expired = this._checkExpirations(currentTime);
    results.push(...expired);

    // 2. 포즈 커서 기반 판정 (landmarks가 있을 때만)
    if (!landmarks) {
      this._checkCompletion();
      return results;
    }

    const cursors = this._cursorTracker.update(landmarks, palms, isMirrored, options);

    // 손/머리 커서 판정: instrument === 'foot'인 노트는 바이패스
    for (const note of this._notes) {
      if (note.resolved) continue;

      // 발 전용 노트는 손/머리/골반 커서 판정을 바이패스
      if (note.instrument === 'foot') {
        continue;
      }

      const landingTime = note.landingTime;
      const timeDiff = currentTime - landingTime;
      const absDiff = Math.abs(timeDiff);

      // 아직 판정 윈도우 미도달
      if (currentTime < landingTime - this._timingWindows.late) {
        continue;
      }

      // 판정 윈도우 초과 (만료 체크에서 처리됨)
      if (absDiff > this._timingWindows.late + EPSILON) {
        continue;
      }

      const designatedCursor = note.cursorType ?? note.part;
      if (!isValidZoneForCursor(designatedCursor, note.zoneId)) {
        continue;
      }

      const zone = this._zones.find((z) => z.id === note.zoneId);
      if (!zone) continue;

      const cursor = cursors.get(designatedCursor as CursorType);
      if (!cursor) continue;

      const inside = isInsideZone({ x: cursor.x, y: cursor.y }, zone, 0.05);
      if (inside) {
        const rating = judgeStarTiming(currentTime, landingTime, this._timingWindows);
        const res = this._resolveNote(note, rating, currentTime, 'motion');
        results.push(res);
      }
    }

    this._checkCompletion();
    return results;
  }

  /**
   * 발 입력 처리 (FootKeynoteEvent 또는 zoneId)
   */
  fromFoot(
    eventOrZoneId: FootKeynoteEvent | number,
    timestamp?: number,
  ): StarCollectionResult | null {
    if (!this._isStarted || this._isPaused) return null;

    const zoneId = typeof eventOrZoneId === 'number' ? eventOrZoneId : eventOrZoneId.zoneId;
    const currentTime =
      timestamp ?? (typeof eventOrZoneId === 'object' ? eventOrZoneId.timestamp : this._currentTime);
    this._currentTime = Math.max(this._currentTime, currentTime);

    this._checkExpirations(currentTime);

    // 유효한 타이밍 윈도우 내의 발(foot) 노트 후보 탐색
    const candidates = this._notes.filter(
      (n) =>
        !n.resolved &&
        n.instrument === 'foot' &&
        Math.abs(currentTime - n.landingTime) <= this._timingWindows.late + EPSILON,
    );

    if (candidates.length === 0) return null;

    // 가장 착지 시각에 가까운 노트 선택
    candidates.sort(
      (a, b) => Math.abs(currentTime - a.landingTime) - Math.abs(currentTime - b.landingTime),
    );
    const targetNote = candidates[0];

    // 존 호환성 검증 (지정 존 일치 또는 센터 존 10)
    if (targetNote.zoneId !== zoneId && zoneId !== 10) {
      return null;
    }

    const rating = judgeStarTiming(currentTime, targetNote.landingTime, this._timingWindows);
    const result = this._resolveNote(targetNote, rating, currentTime, 'foot');
    this._checkCompletion();
    return result;
  }

  /**
   * Space 키보드 폴백 수집
   */
  fromKeyboard(currentTime: number, _key?: string): StarCollectionResult | null {
    if (!this._isStarted || this._isPaused) return null;
    this._currentTime = Math.max(this._currentTime, currentTime);

    this._checkExpirations(currentTime);

    const candidates = this._notes.filter(
      (n) =>
        !n.resolved &&
        Math.abs(currentTime - n.landingTime) <= this._timingWindows.late + EPSILON,
    );

    if (candidates.length === 0) return null;

    candidates.sort(
      (a, b) => Math.abs(currentTime - a.landingTime) - Math.abs(currentTime - b.landingTime),
    );
    const targetNote = candidates[0];

    const rating = judgeStarTiming(currentTime, targetNote.landingTime, this._timingWindows);
    const result = this._resolveNote(targetNote, rating, currentTime, 'keyboard');
    this._checkCompletion();
    return result;
  }

  /**
   * 터치/클릭 폴백 수집
   */
  fromTouch(zoneId: number, currentTime: number): StarCollectionResult | null {
    if (!this._isStarted || this._isPaused) return null;
    this._currentTime = Math.max(this._currentTime, currentTime);

    this._checkExpirations(currentTime);

    const candidates = this._notes.filter(
      (n) =>
        !n.resolved &&
        n.zoneId === zoneId &&
        Math.abs(currentTime - n.landingTime) <= this._timingWindows.late + EPSILON,
    );

    if (candidates.length === 0) return null;

    candidates.sort(
      (a, b) => Math.abs(currentTime - a.landingTime) - Math.abs(currentTime - b.landingTime),
    );
    const targetNote = candidates[0];

    const rating = judgeStarTiming(currentTime, targetNote.landingTime, this._timingWindows);
    const result = this._resolveNote(targetNote, rating, currentTime, 'touch');
    this._checkCompletion();
    return result;
  }

  /**
   * landingTime + 0.40s 만료 미입력 노트 Miss 확정
   */
  private _checkExpirations(currentTime: number): StarCollectionResult[] {
    const expiredResults: StarCollectionResult[] = [];
    const maxLate = this._timingWindows.late;

    for (const note of this._notes) {
      if (note.resolved) continue;

      if (currentTime > note.landingTime + maxLate + EPSILON) {
        const res: StarCollectionResult = {
          collected: false,
          rating: 'Miss',
          timeDiff: currentTime - note.landingTime,
          zoneId: note.zoneId,
          cursorType: note.cursorType,
          target: note,
          timestamp: currentTime,
          source: 'timeout',
          hasBattlePenalty: false,
        };
        note.resolved = true;
        note.result = res;
        expiredResults.push(res);
        this._notifyRating(res);
      }
    }

    return expiredResults;
  }

  private _resolveNote(
    note: ScheduledStarNote,
    rating: StarRating,
    currentTime: number,
    source: 'motion' | 'keyboard' | 'touch' | 'foot',
  ): StarCollectionResult {
    const collected = rating !== 'Miss';
    const res: StarCollectionResult = {
      collected,
      rating,
      timeDiff: currentTime - note.landingTime,
      zoneId: note.zoneId,
      cursorType: note.cursorType,
      target: note,
      timestamp: currentTime,
      source: source as any,
      hasBattlePenalty: false,
    };
    note.resolved = true;
    note.result = res;
    this._notifyRating(res);
    return res;
  }

  private _notifyRating(result: StarCollectionResult): void {
    for (const listener of this._listeners) {
      try {
        listener(result);
      } catch (err) {
        console.error('[StarNoteScheduler] Listener error:', err);
      }
    }
  }

  private _checkCompletion(): void {
    if (this.isComplete) {
      this._options.onComplete?.();
    }
  }
}
