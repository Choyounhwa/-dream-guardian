/**
 * StarCollectionInput.ts - 11존 단일 별 Perfect Good Late Miss 리듬 판정 입력 모델
 *
 * 정답 확정 후 시퀀스로 출현하는 단일 별(StarTarget)을 지정 부위 커서와 목표 피트니스 존으로
 * 비트 착지 순간 수집하고 리듬 타이밍 판정(Perfect/Good/Late/Miss)을 반환하는 입력 처리기.
 *
 * - StarTarget의 cursorType/zoneId/landingTime에 대해 Perfect ±0.12s, Good ±0.25s, Late ±0.40s, Miss 판정
 * - 지정되지 않은 커서 차단, 유효하지 않은 존 차단, 중복 수집 차단, pause 상태 차단
 * - 현재 11존 경계(DEFAULT_FITNESS_ZONES)와 CursorTracker 좌표계 그대로 사용
 * - 4색 커서, 존 허용 매트릭스, Cover/미러 좌표, keyboard/touch fallback 완벽 지원
 * - Miss는 전투 페널티(hasBattlePenalty = false)를 일체 발생시키지 않음
 *
 * @see Issue #182 [INPUT-STAR-001]
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #181 [CHOREO-STAR-001]
 */

import {
  DEFAULT_FITNESS_ZONES,
  type FitnessZone,
  isValidZoneForCursor,
} from '../../config/zone.config.js';
import type { CursorType } from '../../config/cursor.config.js';
import {
  DEFAULT_STAR_COLLECTION_CONFIG,
  DEFAULT_STAR_TIMING_WINDOWS,
  type StarCollectionConfig,
  type StarTimingWindows,
} from '../../config/beat-motion.config.js';
import {
  CursorTracker,
  type CursorUpdateOptions,
  type PalmPositions,
  type ViewportProjectFn,
} from './CursorTracker.js';
import { isInsideZone } from './PostureMatcher.js';
import type { StarTarget } from '../types/star.js';
import type { BodyPart } from '../types/posture.js';
import type { NormalizedLandmark } from '../types/index.js';

export type StarRating = 'Perfect' | 'Good' | 'Late' | 'Miss';
export type StarJudgment = StarRating;

export interface ActiveStarTarget extends StarTarget {
  landingTime: number;
}

export interface StarCollectionResult {
  /** 수집 성공 여부 (Perfect, Good, Late는 true, Miss는 false) */
  collected: boolean;
  /** 리듬 판정 등급 */
  rating: StarRating;
  /** 착지 시각과의 차이 (초, currentTime - landingTime) */
  timeDiff: number;
  /** 목표 피트니스 존 ID (1~11) */
  zoneId: number;
  /** 수집에 사용된 커서 타입 */
  cursorType: CursorType | BodyPart;
  /** 대상 별 목표 정보 */
  target: ActiveStarTarget | StarTarget | null;
  /** 판정 시점 타임스탬프 (초) */
  timestamp: number;
  /** 입력 소스 */
  source: 'motion' | 'keyboard' | 'touch' | 'timeout';
  /** 전투 페널티 여부: 별 판정은 순수 리듬 통계이므로 Miss여도 항상 false */
  hasBattlePenalty: false;
}

const EPSILON = 1e-6;

/**
 * 시간 오차에 따른 순수 리듬 등급 판정 도우미
 *
 * - Perfect: ±0.12s 이내
 * - Good: ±0.25s 이내
 * - Late: ±0.40s 이내
 * - Miss: 0.40s 초과
 */
export function judgeStarTiming(
  currentTime: number,
  landingTime: number,
  windows: StarTimingWindows = DEFAULT_STAR_TIMING_WINDOWS,
): StarRating {
  const diff = Math.abs(currentTime - landingTime);
  if (diff <= windows.perfect + EPSILON) return 'Perfect';
  if (diff <= windows.good + EPSILON) return 'Good';
  if (diff <= windows.late + EPSILON) return 'Late';
  return 'Miss';
}

export class StarCollectionInput {
  private readonly _config: StarCollectionConfig;
  private readonly _cursorTracker: CursorTracker;
  private readonly _zones: readonly FitnessZone[];

  private _target: ActiveStarTarget | null = null;
  private _targetQueue: ActiveStarTarget[] = [];
  private _isCollected = false;
  private _paused = false;
  private _lastResult: StarCollectionResult | null = null;

  constructor(
    config?: Partial<StarCollectionConfig>,
    cursorTracker?: CursorTracker,
    zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES,
  ) {
    this._config = {
      ...DEFAULT_STAR_COLLECTION_CONFIG,
      ...config,
      timingWindows: {
        ...DEFAULT_STAR_TIMING_WINDOWS,
        ...config?.timingWindows,
      },
    };
    this._cursorTracker = cursorTracker ?? new CursorTracker({
      virtualWidth: this._config.virtualWidth,
      virtualHeight: this._config.virtualHeight,
    });
    this._zones = zones;
  }

  get config(): StarCollectionConfig {
    return this._config;
  }

  get cursorTracker(): CursorTracker {
    return this._cursorTracker;
  }

  get currentTarget(): ActiveStarTarget | null {
    return this._target;
  }

  get targetQueue(): readonly ActiveStarTarget[] {
    return this._targetQueue;
  }

  /**
   * 다중 타깃 큐에 별 목표 추가
   */
  enqueueTarget(target: StarTarget | null, explicitLandingTime?: number): void {
    if (!target) return;
    const landingTime = explicitLandingTime ?? target.landingTime ?? 0;
    const active: ActiveStarTarget = {
      ...target,
      landingTime,
    };
    this._targetQueue.push(active);
    if (!this._target || this._isCollected) {
      this._target = active;
      this._isCollected = false;
      this._lastResult = null;
    }
  }

  /**
   * 큐의 다음 타깃으로 전진
   */
  advanceQueue(): ActiveStarTarget | null {
    if (this._targetQueue.length > 0) {
      this._targetQueue.shift();
    }
    this._target = this._targetQueue.length > 0 ? this._targetQueue[0] : null;
    this._isCollected = false;
    this._lastResult = null;
    return this._target;
  }

  get isCollected(): boolean {
    return this._isCollected;
  }

  get isPaused(): boolean {
    return this._paused;
  }

  get lastResult(): StarCollectionResult | null {
    return this._lastResult;
  }

  /**
   * 일시정지 상태 설정 (일시정지 중 모든 판정 차단)
   */
  setPaused(paused: boolean): void {
    this._paused = paused;
  }

  /**
   * 뷰포트 해상도 및 비디오 Cover 프로젝션 설정 동기화
   */
  setViewport(virtualWidth: number, virtualHeight: number, projectFn?: ViewportProjectFn): void {
    this._config.virtualWidth = virtualWidth;
    this._config.virtualHeight = virtualHeight;
    this._cursorTracker.setViewport(virtualWidth, virtualHeight, projectFn);
  }

  /**
   * 현재 활성 별 목표 설정
   * @param target 수집 대상 별
   * @param explicitLandingTime 명시적 착지 시각 (target.landingTime 대체 가능)
   */
  setTarget(target: StarTarget | null, explicitLandingTime?: number): void {
    if (!target) {
      this.clearTarget();
      return;
    }
    const landingTime = explicitLandingTime ?? target.landingTime ?? 0;
    this._target = {
      ...target,
      landingTime,
    };
    this._isCollected = false;
    this._lastResult = null;
  }

  /**
   * 현재 활성 별 목표 제거
   */
  clearTarget(): void {
    this._target = null;
    this._isCollected = false;
    this._lastResult = null;
  }

  /**
   * 전체 상태 초기화
   */
  reset(): void {
    this._target = null;
    this._targetQueue = [];
    this._isCollected = false;
    this._lastResult = null;
    this._cursorTracker.reset();
  }

  /**
   * 설정된 타이밍 윈도우 기준 등급 판정
   */
  judgeTiming(currentTime: number, landingTime?: number): StarRating {
    const targetTime = landingTime ?? this._target?.landingTime ?? 0;
    return judgeStarTiming(currentTime, targetTime, this._config.timingWindows);
  }

  /**
   * 단일 커서 좌표 및 타임스탬프로 별 수집 여부 평가
   */
  evaluateCursor(
    cursorType: CursorType | BodyPart,
    position: { x: number; y: number },
    currentTime: number,
  ): StarCollectionResult | null {
    if (!this._target || this._paused || this._isCollected) {
      return null;
    }

    const designatedCursor = this._target.cursorType ?? this._target.part;

    // 1. 지정되지 않은 커서 차단
    if (cursorType !== designatedCursor) {
      return null;
    }

    // 2. 유효하지 않은 존 차단 (존 허용 매트릭스 준수 검증)
    if (!isValidZoneForCursor(designatedCursor, this._target.zoneId)) {
      return null;
    }

    // 3. 목표 피트니스 존 경계 내 위치 여부 검증
    const zone = this._zones.find((z) => z.id === this._target!.zoneId);
    if (!zone) {
      return null;
    }

    const inside = isInsideZone(position, zone, this._config.entryMargin);
    if (!inside) {
      return null;
    }

    // 4. 타이밍 판정
    const landingTime = this._target.landingTime;
    const timeDiff = currentTime - landingTime;
    const absDiff = Math.abs(timeDiff);

    // 아직 타이밍 윈도우에 도달하지 않음 (이른 진입 대기)
    if (currentTime < landingTime - this._config.timingWindows.late) {
      return null;
    }

    // 타이밍 윈도우(±0.40s) 내 도달 -> 수집 성공 (Perfect / Good / Late)
    if (absDiff <= this._config.timingWindows.late + EPSILON) {
      const rating = judgeStarTiming(currentTime, landingTime, this._config.timingWindows);
      this._isCollected = true;

      const result: StarCollectionResult = {
        collected: true,
        rating,
        timeDiff,
        zoneId: this._target.zoneId,
        cursorType,
        target: this._target,
        timestamp: currentTime,
        source: 'motion',
        hasBattlePenalty: false,
      };
      this._lastResult = result;
      return result;
    }

    // 타이밍 윈도우 초과 (Late 한계 초과) -> Miss
    this._isCollected = true;
    const result: StarCollectionResult = {
      collected: false,
      rating: 'Miss',
      timeDiff,
      zoneId: this._target.zoneId,
      cursorType,
      target: this._target,
      timestamp: currentTime,
      source: 'motion',
      hasBattlePenalty: false,
    };
    this._lastResult = result;
    return result;
  }

  /**
   * 포즈 랜드마크 및 뷰포트 상태로부터 별 수집 평가
   */
  update(
    currentTime: number,
    landmarks?: readonly NormalizedLandmark[] | null,
    palms?: PalmPositions,
    isMirrored = this._config.isMirrored,
    options?: CursorUpdateOptions,
  ): StarCollectionResult | null {
    if (!this._target || this._paused || this._isCollected) {
      return null;
    }

    // 타임아웃 Miss 체크
    const timeoutRes = this.checkTimeout(currentTime);
    if (timeoutRes) {
      return timeoutRes;
    }

    if (!landmarks) {
      return null;
    }

    const cursors = this._cursorTracker.update(landmarks, palms, isMirrored, options);
    const designatedCursor = (this._target.cursorType ?? this._target.part) as CursorType;
    const cursor = cursors.get(designatedCursor);

    if (!cursor) {
      return null;
    }

    return this.evaluateCursor(designatedCursor, { x: cursor.x, y: cursor.y }, currentTime);
  }

  /**
   * updateFromPose 별칭 메서드 (호환성 제공)
   */
  updateFromPose(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    currentTime: number,
    palms?: PalmPositions,
    isMirrored = this._config.isMirrored,
    options?: CursorUpdateOptions,
  ): StarCollectionResult | null {
    return this.update(currentTime, landmarks, palms, isMirrored, options);
  }

  /**
   * 키보드 폴백 수집 (스페이스/엔터 등)
   */
  fromKeyboard(currentTime: number, _key?: string): StarCollectionResult | null {
    if (!this._target || this._paused || this._isCollected) {
      return null;
    }

    const designatedCursor = this._target.cursorType ?? this._target.part;
    if (!isValidZoneForCursor(designatedCursor, this._target.zoneId)) {
      return null;
    }

    const landingTime = this._target.landingTime;
    const timeDiff = currentTime - landingTime;
    const rating = judgeStarTiming(currentTime, landingTime, this._config.timingWindows);
    const collected = rating !== 'Miss';

    this._isCollected = true;
    const result: StarCollectionResult = {
      collected,
      rating,
      timeDiff,
      zoneId: this._target.zoneId,
      cursorType: designatedCursor,
      target: this._target,
      timestamp: currentTime,
      source: 'keyboard',
      hasBattlePenalty: false,
    };
    this._lastResult = result;
    return result;
  }

  /**
   * 터치/클릭 폴백 수집 (지정 존 터치)
   */
  fromTouch(zoneId: number, currentTime: number): StarCollectionResult | null {
    if (!this._target || this._paused || this._isCollected) {
      return null;
    }

    // 목표 존 불일치 시 차단
    if (zoneId !== this._target.zoneId) {
      return null;
    }

    const designatedCursor = this._target.cursorType ?? this._target.part;
    if (!isValidZoneForCursor(designatedCursor, zoneId)) {
      return null;
    }

    const landingTime = this._target.landingTime;
    const timeDiff = currentTime - landingTime;
    const rating = judgeStarTiming(currentTime, landingTime, this._config.timingWindows);
    const collected = rating !== 'Miss';

    this._isCollected = true;
    const result: StarCollectionResult = {
      collected,
      rating,
      timeDiff,
      zoneId,
      cursorType: designatedCursor,
      target: this._target,
      timestamp: currentTime,
      source: 'touch',
      hasBattlePenalty: false,
    };
    this._lastResult = result;
    return result;
  }

  /**
   * 비트 착지 만료 시각(+0.40s) 초과 타임아웃 판정
   */
  checkTimeout(currentTime: number): StarCollectionResult | null {
    if (!this._target || this._paused || this._isCollected) {
      return null;
    }

    const maxLateTime = this._target.landingTime + this._config.timingWindows.late;
    if (currentTime > maxLateTime + EPSILON) {
      this._isCollected = true;
      const designatedCursor = this._target.cursorType ?? this._target.part;
      const result: StarCollectionResult = {
        collected: false,
        rating: 'Miss',
        timeDiff: currentTime - this._target.landingTime,
        zoneId: this._target.zoneId,
        cursorType: designatedCursor,
        target: this._target,
        timestamp: currentTime,
        source: 'timeout',
        hasBattlePenalty: false,
      };
      this._lastResult = result;
      return result;
    }

    return null;
  }
}
