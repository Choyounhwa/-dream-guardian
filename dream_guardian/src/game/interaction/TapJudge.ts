/**
 * TapJudge.ts - 탭 인터랙션 타이밍 및 다중 requirement 판정기
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§5 인터랙션 판정 모델, §9 MRN-09)
 * @see Issue #483 [MRN-09]
 */

import type {
  MotionInteractionType,
  MotionNoteRuntime,
  MotionNoteResult,
  MotionRating,
  MotionPart,
} from '../../types/motion-note.js';
import { isFloorPart } from '../../types/motion-note.js';
import type { BodyPart } from '../../types/posture.js';
import type { FootKeynoteEvent } from '../../types/keynote.js';
import type { MotionIntent } from '../../types/motion-intent.js';
import {
  DEFAULT_STAR_TIMING_WINDOWS,
  type StarTimingWindows,
} from '../../../config/beat-motion.config.js';
import { judgeStarTiming } from '../../input/StarCollectionInput.js';
import type { TimingLeniencyConfig } from '../../../config/judgment.config.js';

export const EPSILON = 1e-6;

/**
 * 인터랙션 판정기 전략 패턴 인터페이스
 */
export interface InteractionJudge {
  readonly type: MotionInteractionType;
  /** 매 프레임 호출. 판정이 확정되면 결과 반환, 아니면 null */
  evaluate(rt: MotionNoteRuntime, input: MotionInputSnapshot, now: number): MotionNoteResult | null;
}

/**
 * input 레이어에서 생산 중인 정보를 game이 읽기 전용으로 묶은 스냅샷
 */
export interface MotionInputSnapshot {
  readonly cursorZones?: Partial<Record<BodyPart, number | null>>;
  readonly recentIntents?: readonly MotionIntent[];
  readonly recentFootEvents?: readonly FootKeynoteEvent[];
}

export interface TapJudgeOptions {
  timingWindows?: StarTimingWindows;
  timingLeniency?: TimingLeniencyConfig;
}

/**
 * TapJudge - 별 잡기 / 발판 밟기 등 tap 상호작용 판정 클래스
 */
export class TapJudge implements InteractionJudge {
  readonly type: MotionInteractionType = 'tap';
  private readonly _timingWindows: StarTimingWindows;
  private readonly _leniency?: TimingLeniencyConfig;

  constructor(options?: TapJudgeOptions | StarTimingWindows) {
    if (options && 'perfect' in options) {
      this._timingWindows = options;
    } else if (options && typeof options === 'object') {
      this._timingWindows = options.timingWindows ?? DEFAULT_STAR_TIMING_WINDOWS;
      this._leniency = options.timingLeniency;
    } else {
      this._timingWindows = DEFAULT_STAR_TIMING_WINDOWS;
    }
  }

  get timingWindows(): StarTimingWindows {
    return this._timingWindows;
  }

  /**
   * 타이밍 오차에 따른 순수 리듬 등급 산출
   */
  judgeTiming(currentTime: number, landingTime: number): MotionRating {
    return judgeStarTiming(currentTime, landingTime, this._timingWindows, this._leniency);
  }

  /**
   * 런타임 노트와 입력 스냅샷을 비교 평가
   */
  evaluate(rt: MotionNoteRuntime, input: MotionInputSnapshot, now: number): MotionNoteResult | null {
    if (rt.state === 'resolved' || rt.result) return null;
    if (rt.note.interaction !== 'tap') return null;

    const timeDiff = now - rt.landingTime;
    const absDiff = Math.abs(timeDiff);

    // 1. 아직 판정 윈도우 미도달 (조기 차단)
    if (now < rt.landingTime - this._timingWindows.late) {
      return null;
    }

    // 2. 판정 윈도우 내: 모든 requirement 만족 여부 확인
    if (absDiff <= this._timingWindows.late + EPSILON) {
      const reqs = rt.note.requirements;
      let allSatisfied = reqs.length > 0;
      const matchedParts: MotionPart[] = [];

      for (const req of reqs) {
        let satisfied = false;

        // 손, 머리, 골반 (BodyPart) 커서 판정
        if (!isFloorPart(req.part)) {
          if (input.cursorZones) {
            const zone = input.cursorZones[req.part as BodyPart];
            if (zone !== undefined && zone !== null && zone === req.zoneId) {
              satisfied = true;
            }
          }
        }

        // 바닥/발 부위 (FloorPart) 또는 발 이벤트 판정
        if (!satisfied && input.recentFootEvents && input.recentFootEvents.length > 0) {
          for (const fe of input.recentFootEvents) {
            if (fe.zoneId === req.zoneId) {
              const feDiff = Math.abs(fe.timestamp - rt.landingTime);
              if (feDiff <= this._timingWindows.late + EPSILON) {
                satisfied = true;
                break;
              }
            }
          }
        }

        // 폴백: cursorZones에 직접 바닥 부위가 전달된 경우
        if (!satisfied && input.cursorZones && (input.cursorZones as any)[req.part] === req.zoneId) {
          satisfied = true;
        }

        if (satisfied) {
          matchedParts.push(req.part);
        } else {
          allSatisfied = false;
          break;
        }
      }

      if (allSatisfied) {
        const rating = this.judgeTiming(now, rt.landingTime);
        return {
          noteId: rt.note.id,
          interaction: 'tap',
          rating,
          success: rating !== 'Miss',
          timingError: timeDiff,
          matchedParts,
        };
      }
    }

    // 3. 만료 시점 도달 시 Miss 확정
    if (now >= rt.landingTime + this._timingWindows.late - EPSILON) {
      return {
        noteId: rt.note.id,
        interaction: 'tap',
        rating: 'Miss',
        success: false,
        timingError: timeDiff,
        matchedParts: [],
      };
    }

    // 아직 윈도우 내 대기 중
    return null;
  }

  /**
   * 키보드/터치/외부 강제 입력 등 단일 직접 판정
   */
  evaluateDirect(
    rt: MotionNoteRuntime,
    now: number,
    matchedParts?: readonly MotionPart[],
  ): MotionNoteResult | null {
    if (rt.state === 'resolved' || rt.result) return null;
    const timeDiff = now - rt.landingTime;
    const absDiff = Math.abs(timeDiff);

    if (absDiff > this._timingWindows.late + EPSILON) {
      return null;
    }

    const rating = this.judgeTiming(now, rt.landingTime);
    return {
      noteId: rt.note.id,
      interaction: 'tap',
      rating,
      success: rating !== 'Miss',
      timingError: timeDiff,
      matchedParts: matchedParts ?? rt.note.requirements.map((r) => r.part),
    };
  }
}
