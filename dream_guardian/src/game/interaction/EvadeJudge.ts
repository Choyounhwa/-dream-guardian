/**
 * EvadeJudge.ts - 장판 및 위험 요소 회피(Evade) 인터랙션 판정기
 *
 * pre-buffer(선행 입력 버퍼) 및 coyote time(후행 유예)을 적용한
 * 모션 인텐트 및 신체 위치 기반 회피 판정을 수행한다.
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§5 인터랙션 판정 모델, §9 MRN-10)
 * @see Issue #484 [MRN-10]
 */

import type {
  MotionInteractionType,
  MotionNoteRuntime,
  MotionNoteResult,
  MotionRating,
  MotionNote,
} from '../../types/motion-note.js';
import { isFloorPart } from '../../types/motion-note.js';
import type { MotionIntent } from '../../types/motion-intent.js';
import {
  DEFAULT_STAR_TIMING_WINDOWS,
  type StarTimingWindows,
} from '../../../config/beat-motion.config.js';
import {
  DEFAULT_TIMING_LENIENCY_CONFIG,
  type TimingLeniencyConfig,
} from '../../../config/judgment.config.js';
import type {
  InteractionJudge,
  MotionInputSnapshot,
} from './TapJudge.js';
import { EPSILON } from './TapJudge.js';

export interface EvadeJudgeOptions {
  timingWindows?: StarTimingWindows & { early?: number };
  timingLeniency?: Partial<TimingLeniencyConfig>;
}

export interface EvadeNoteResult extends MotionNoteResult {
  readonly details?: {
    readonly viaPreBuffer?: boolean;
    readonly viaGrace?: boolean;
    readonly intentType?: string;
    readonly method?: string;
    readonly reason?: string;
  };
}

export class EvadeJudge implements InteractionJudge {
  readonly type: MotionInteractionType = 'evade';
  private readonly _timingWindows: StarTimingWindows & { early?: number };
  private readonly _timingLeniency: TimingLeniencyConfig;

  // 노트별 선행 입력 버퍼 (noteId -> MotionIntent)
  private readonly _bufferedIntents: Map<string, MotionIntent> = new Map();
  // 노트별 위험 구역 진입 이력 추적 (noteId -> boolean)
  private readonly _dangerHistory: Map<string, boolean> = new Map();

  constructor(options?: EvadeJudgeOptions) {
    this._timingWindows = options?.timingWindows ?? DEFAULT_STAR_TIMING_WINDOWS;
    this._timingLeniency = {
      ...DEFAULT_TIMING_LENIENCY_CONFIG,
      ...(options?.timingLeniency ?? {}),
    };
  }

  get timingWindows(): StarTimingWindows {
    return this._timingWindows;
  }

  get timingLeniency(): TimingLeniencyConfig {
    return this._timingLeniency;
  }

  /**
   * 내부 버퍼 및 추적 이력 초기화
   */
  clear(): void {
    this._bufferedIntents.clear();
    this._dangerHistory.clear();
  }

  /**
   * 외부에서 직접 모션 인텐트를 버퍼링 (수동 주입용)
   */
  bufferIntent(noteId: string, intent: MotionIntent): void {
    this._bufferedIntents.set(noteId, intent);
  }

  /**
   * 매 프레임 호출되어 회피 성공/실패 여부를 평가한다.
   */
  evaluate(
    rt: MotionNoteRuntime,
    input: MotionInputSnapshot,
    now: number,
  ): EvadeNoteResult | null {
    if (rt.note.interaction !== 'evade') {
      return null;
    }
    if (rt.state === 'resolved') {
      return null;
    }

    const note = rt.note;
    const landingTime = rt.landingTime;
    const early = this._timingWindows.early ?? this._timingWindows.late;
    const late = this._timingWindows.late;
    const preBufferWindow = this._timingLeniency.enablePreBuffer
      ? this._timingLeniency.preBufferWindow
      : 0;
    const postGraceWindow = this._timingLeniency.enablePostGrace
      ? this._timingLeniency.postGraceWindow
      : 0;

    const preBufferStart = landingTime - early - preBufferWindow;
    const normalStart = landingTime - early;
    const normalEnd = landingTime + late;
    const graceEnd = normalEnd + postGraceWindow;

    // 1. 판정 윈도우(선행 버퍼 포함) 시작 전에는 대기
    if (now < preBufferStart - EPSILON) {
      return null;
    }

    // 2. 인텐트 기반 회피 평가 (input.recentIntents)
    if (input.recentIntents && input.recentIntents.length > 0) {
      for (const intent of input.recentIntents) {
        if (!this._isIntentMatchingNote(intent, note)) {
          continue;
        }

        const t = intent.timestamp ?? now;

        // A) 선행 입력 버퍼 구간 [preBufferStart, normalStart)
        if (t >= preBufferStart - EPSILON && t < normalStart - EPSILON) {
          if (this._timingLeniency.enablePreBuffer) {
            this._bufferedIntents.set(note.id, intent);
            // 현재 시간이 아직 정규 창 이전이면 버퍼링 상태 유지 후 대기
            if (now < normalStart - EPSILON) {
              return null;
            }
          }
        }

        // B) 정규 입력 윈도우 구간 [normalStart, normalEnd]
        if (t >= normalStart - EPSILON && t <= normalEnd + EPSILON) {
          const diff = Math.abs(t - landingTime);
          const rating: MotionRating =
            diff <= this._timingWindows.perfect + EPSILON
              ? 'Perfect'
              : diff <= this._timingWindows.good + EPSILON
                ? 'Good'
                : 'Good';

          this._cleanNoteState(note.id);
          return {
            noteId: note.id,
            interaction: 'evade',
            rating,
            success: true,
            timingError: t - landingTime,
            matchedParts: note.requirements.map((r) => r.part),
            details: { intentType: intent.type },
          };
        }

        // C) 후행 유예(Coyote Time) 구간 (normalEnd, graceEnd]
        if (
          this._timingLeniency.enablePostGrace &&
          t > normalEnd - EPSILON &&
          t <= graceEnd + EPSILON
        ) {
          this._cleanNoteState(note.id);
          return {
            noteId: note.id,
            interaction: 'evade',
            rating: 'Good',
            success: true,
            timingError: t - landingTime,
            matchedParts: note.requirements.map((r) => r.part),
            details: { viaGrace: true, intentType: intent.type },
          };
        }
      }
    }

    // 3. 기 버퍼링된 선행 입력 확인 (정규 창 도달 시 소비)
    if (this._bufferedIntents.has(note.id) && now >= normalStart - EPSILON) {
      const buffered = this._bufferedIntents.get(note.id)!;
      this._cleanNoteState(note.id);
      return {
        noteId: note.id,
        interaction: 'evade',
        rating: 'Good',
        success: true,
        timingError: buffered.timestamp - landingTime,
        matchedParts: note.requirements.map((r) => r.part),
        details: { viaPreBuffer: true, intentType: buffered.type },
      };
    }

    // 4. 위치 기반 회피 평가 (cursorZones 및 recentFootEvents)
    const inDanger = this._isPlayerInHazardZone(note, input, landingTime);
    if (inDanger) {
      this._dangerHistory.set(note.id, true);
    }

    // 착지 시점(landingTime) 이후부터 위치 기반 판정 유효
    if (now >= landingTime - EPSILON) {
      const hadDangerHistory = this._dangerHistory.get(note.id) ?? false;

      // 4-A. 위험 구역 밖으로 안전하게 위치한 경우
      if (!inDanger) {
        // 정규 창 내부 [landingTime, normalEnd]
        if (now <= normalEnd + EPSILON) {
          const diff = Math.abs(now - landingTime);
          const rating: MotionRating =
            diff <= this._timingWindows.perfect + EPSILON ? 'Perfect' : 'Good';

          this._cleanNoteState(note.id);
          return {
            noteId: note.id,
            interaction: 'evade',
            rating,
            success: true,
            timingError: now - landingTime,
            matchedParts: note.requirements.map((r) => r.part),
            details: { method: 'position_outside' },
          };
        }

        // Coyote Time 구간 (normalEnd, graceEnd]: 처음에 위험 구역에 있었으나 탈출한 경우
        if (
          this._timingLeniency.enablePostGrace &&
          now <= graceEnd + EPSILON &&
          hadDangerHistory
        ) {
          this._cleanNoteState(note.id);
          return {
            noteId: note.id,
            interaction: 'evade',
            rating: 'Good',
            success: true,
            timingError: now - landingTime,
            matchedParts: note.requirements.map((r) => r.part),
            details: { method: 'position_outside', viaGrace: true },
          };
        }
      }

      // 4-B. 위험 구역에 체류 중인 경우: coyote 만료 전까지는 탈출 기회 제공을 위해 대기
      if (inDanger && now < graceEnd - EPSILON) {
        return null;
      }
    }

    // 5. 전체 유예 만료(graceEnd) 도달 시 회피 실패(Miss) 확정
    if (now >= graceEnd - EPSILON) {
      this._cleanNoteState(note.id);
      return {
        noteId: note.id,
        interaction: 'evade',
        rating: 'Miss',
        success: false,
        timingError: now - landingTime,
        matchedParts: [],
        details: { reason: inDanger ? 'occupied_hazard_zone' : 'timeout' },
      };
    }

    return null;
  }

  /**
   * 플레이어가 장판 위험 존에 위치하고 있는지 검사
   */
  private _isPlayerInHazardZone(
    note: MotionNote,
    input: MotionInputSnapshot,
    landingTime: number,
  ): boolean {
    const cursor = input.cursorZones as Record<string, number | null | undefined> | undefined;

    // jump 패턴의 경우: 전체 바닥 레인 대상
    if (note.patternId === 'jump') {
      if (cursor) {
        const lf = cursor.leftFoot;
        const rf = cursor.rightFoot;
        // 양발 중 하나라도 바닥 존(9, 10, 11)에 닿아 있으면 위험 구역 체류
        if (
          (lf !== undefined && lf !== null && (lf === 9 || lf === 10 || lf === 11)) ||
          (rf !== undefined && rf !== null && (rf === 9 || rf === 10 || rf === 11))
        ) {
          return true;
        }
      }
    }

    for (const req of note.requirements) {
      // 1. cursorZones 검사
      if (cursor) {
        const directZone = cursor[req.part];
        if (directZone !== undefined && directZone !== null && directZone === req.zoneId) {
          return true;
        }

        // 바닥/발 부위인데 hip이나 다른 발이 해당 존에 있는 경우
        if (isFloorPart(req.part)) {
          const hipZone = cursor.hip;
          if (hipZone !== undefined && hipZone !== null && hipZone === req.zoneId) {
            return true;
          }
        }
      }

      // 2. recentFootEvents 검사
      if (input.recentFootEvents && input.recentFootEvents.length > 0) {
        for (const fe of input.recentFootEvents) {
          if (fe.zoneId === req.zoneId) {
            const feDiff = Math.abs(fe.timestamp - landingTime);
            if (feDiff <= this._timingWindows.late + EPSILON) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * 모션 인텐트가 노트의 회피 조건과 일치하는지 판별
   */
  private _isIntentMatchingNote(intent: MotionIntent, note: MotionNote): boolean {
    const type = intent.type;
    const pat = note.patternId;

    if (pat === 'jump' && type === 'jump') return true;
    if ((pat === 'left_step' || pat === 'balance_left') && type === 'stepLeft') return true;
    if ((pat === 'right_step' || pat === 'balance_right') && type === 'stepRight') return true;

    // 페이로드 명시 액션 또는 패턴 확인
    if (intent.payload?.action === pat || intent.payload?.pattern === pat) return true;

    // 요구사항 기반 검사
    for (const req of note.requirements) {
      if ((req.part === 'bothFeet' || req.part === 'fullBody' || req.zoneId === 10) && type === 'jump') {
        return true;
      }
      if ((req.part === 'leftFoot' || req.zoneId === 9) && type === 'stepLeft') {
        return true;
      }
      if ((req.part === 'rightFoot' || req.zoneId === 11) && type === 'stepRight') {
        return true;
      }
    }

    return false;
  }

  private _cleanNoteState(noteId: string): void {
    this._bufferedIntents.delete(noteId);
    this._dangerHistory.delete(noteId);
  }
}
