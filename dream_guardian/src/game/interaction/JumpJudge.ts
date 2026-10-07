/**
 * JumpJudge.ts - 점프(Jump) 인터랙션 판정기
 *
 * 보스 바닥 충격파(dual_slam) 및 쓸기(sweep) 공격 등에 대응하여,
 * 착지 윈도우(±0.25s)에 jump intent 발생 시 Perfect/Good 판정을 수행하고,
 * 미발생 시 Miss를 판정한다.
 * pre-buffer(선행 입력 버퍼) 및 post-grace(후행 유예)를 지원한다.
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§5 인터랙션 판정 모델, §9 MRN-11)
 * @see Issue #485 [MRN-11]
 */

import type {
  MotionInteractionType,
  MotionNoteRuntime,
  MotionNoteResult,
  MotionRating,
} from '../../types/motion-note.js';
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

export interface JumpJudgeOptions {
  timingWindows?: StarTimingWindows & { early?: number };
  timingLeniency?: Partial<TimingLeniencyConfig>;
}

export interface JumpNoteResult extends MotionNoteResult {
  readonly details?: {
    readonly viaPreBuffer?: boolean;
    readonly viaGrace?: boolean;
    readonly intentType?: string;
    readonly method?: string;
    readonly reason?: string;
  };
}

export class JumpJudge implements InteractionJudge {
  readonly type: MotionInteractionType = 'jump';
  private readonly _timingWindows: StarTimingWindows & { early?: number };
  private readonly _timingLeniency: TimingLeniencyConfig;

  // 노트별 선행 입력 버퍼 (noteId -> MotionIntent)
  private readonly _bufferedIntents: Map<string, MotionIntent> = new Map();

  constructor(options?: JumpJudgeOptions) {
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
   * 내부 버퍼 초기화
   */
  clear(): void {
    this._bufferedIntents.clear();
  }

  /**
   * 외부에서 직접 모션 인텐트를 버퍼링 (수동 주입용)
   */
  bufferIntent(noteId: string, intent: MotionIntent): void {
    this._bufferedIntents.set(noteId, intent);
  }

  /**
   * 매 프레임 호출되어 점프 판정 여부를 평가한다.
   */
  evaluate(
    rt: MotionNoteRuntime,
    input: MotionInputSnapshot,
    now: number,
  ): JumpNoteResult | null {
    if (rt.note.interaction !== 'jump') {
      return null;
    }
    if (rt.state === 'resolved') {
      return null;
    }

    const note = rt.note;
    const landingTime = rt.landingTime;
    const early = this._timingWindows.early ?? this._timingWindows.late ?? 0.25;
    const late = this._timingWindows.late ?? 0.25;
    const perfect = this._timingWindows.perfect ?? 0.10;
    const good = this._timingWindows.good ?? 0.25;

    const preBufferWindow = this._timingLeniency.enablePreBuffer
      ? this._timingLeniency.preBufferWindow
      : 0;
    const postGraceWindow = this._timingLeniency.enablePostGrace
      ? this._timingLeniency.postGraceWindow
      : 0;

    const normalStart = landingTime - early;
    const normalEnd = landingTime + late;
    const bufferStart = normalStart - preBufferWindow;
    const graceEnd = normalEnd + postGraceWindow;

    // 1. 선행 입력 버퍼 창보다 이른 시점: 판정 유보
    if (now < bufferStart - EPSILON) {
      return null;
    }

    // 2. 모션 인텐트(Jump) 검사
    if (input.recentIntents && input.recentIntents.length > 0) {
      const jumpIntents = input.recentIntents.filter((i) => i.type === 'jump');

      for (const intent of jumpIntents) {
        const t = intent.timestamp;

        // A) 선행 입력(Pre-buffer) 구간 [bufferStart, normalStart)
        if (
          this._timingLeniency.enablePreBuffer &&
          t >= bufferStart - EPSILON &&
          t < normalStart - EPSILON
        ) {
          this._bufferedIntents.set(note.id, intent);
        }

        // B) 정규 판정 창 [normalStart, normalEnd]
        if (t >= normalStart - EPSILON && t <= normalEnd + EPSILON) {
          const diff = Math.abs(t - landingTime);
          const rating: MotionRating =
            diff <= perfect + EPSILON
              ? 'Perfect'
              : diff <= good + EPSILON
                ? 'Good'
                : 'Good';

          this._cleanNoteState(note.id);
          return {
            noteId: note.id,
            interaction: 'jump',
            rating,
            success: true,
            timingError: t - landingTime,
            matchedParts: note.requirements.map((r) => r.part),
            details: { intentType: 'jump' },
          };
        }

        // C) 후행 유예(Post-grace / Coyote Time) 구간 (normalEnd, graceEnd]
        if (
          this._timingLeniency.enablePostGrace &&
          t > normalEnd - EPSILON &&
          t <= graceEnd + EPSILON
        ) {
          this._cleanNoteState(note.id);
          return {
            noteId: note.id,
            interaction: 'jump',
            rating: 'Good',
            success: true,
            timingError: t - landingTime,
            matchedParts: note.requirements.map((r) => r.part),
            details: { viaGrace: true, intentType: 'jump' },
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
        interaction: 'jump',
        rating: 'Good',
        success: true,
        timingError: buffered.timestamp - landingTime,
        matchedParts: note.requirements.map((r) => r.part),
        details: { viaPreBuffer: true, intentType: buffered.type },
      };
    }

    // 4. 전체 판정 창 만료(graceEnd) 도달 시 점프 미발생으로 실패(Miss) 확정
    if (now >= graceEnd - EPSILON) {
      this._cleanNoteState(note.id);
      return {
        noteId: note.id,
        interaction: 'jump',
        rating: 'Miss',
        success: false,
        timingError: now - landingTime,
        matchedParts: [],
        details: { reason: 'jump_not_detected' },
      };
    }

    return null;
  }

  private _cleanNoteState(noteId: string): void {
    this._bufferedIntents.delete(noteId);
  }
}
