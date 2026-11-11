/**
 * AssaultLoopTimeline.ts - 36/40박 명시 구간 루프 활성시계 및 타임라인 전담 관리자
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 * @see docs/assault-loop/LOOP-04.md (ASSAULT-LOOP-04 / Issue #697)
 *
 * 절대 규칙:
 * 1. 시간 진행 단일 책임:
 *    - 36/40박(120 BPM 기준 18.0초/20.0초) 무중단 기본 길이와 안전 재준비로 실제 늘어난 시간(shift)을 명확히 구분.
 * 2. 불변 계획 투영:
 *    - AssaultLoopRoundPlan의 segments를 기반으로 초 단위 구간 경계를 관리.
 * 3. 단조 시간축 및 경계 전이:
 *    - activeSeconds에 따른 현재 활성 구간 조회 및 순차적 경계 진입 이벤트(getPendingTransitions) 제공.
 * 4. 1,000줄 미만 단일 책임 유지.
 */

import type {
  AssaultLoopRoundPlan,
  AssaultLoopSegmentDef,
} from '../../types/assault-loop.js';

export interface AssaultLoopSegmentTransition {
  readonly segment: AssaultLoopSegmentDef;
  readonly prevSegment?: AssaultLoopSegmentDef;
  readonly time: number;
}

export interface AssaultLoopTimelineShiftOptions {
  readonly attackId?: string;
  readonly fromSeconds?: number;
  readonly deltaSeconds: number;
}

export interface AssaultLoopSquatWindows {
  readonly startSeconds: number;
  readonly dodgeStartSeconds: number;
  readonly dodgeEndSeconds: number;
  readonly standEndSeconds: number;
  readonly windowStartMs: number;
  readonly arrivalMs: number;
  readonly lateGraceMs: number;
}

export class AssaultLoopTimeline {
  readonly plan: AssaultLoopRoundPlan;
  readonly bpm: number;
  readonly secondsPerBeat: number;
  readonly baseTotalBeats: number;
  readonly baseTotalSeconds: number;

  private _totalShiftSeconds: number = 0;
  private _segments: AssaultLoopSegmentDef[];
  private _dispatchedIndex: number = -1;
  private _currentSegmentIndex: number = -1;

  constructor(plan: AssaultLoopRoundPlan, bpm?: number) {
    this.plan = plan;
    this.bpm = bpm ?? plan.bpm ?? 120;
    this.secondsPerBeat = 60 / this.bpm;
    this.baseTotalBeats = plan.totalBeats;
    this.baseTotalSeconds = (this.baseTotalBeats * 60) / this.bpm;

    // 구간들의 startSeconds / durationSeconds / endSeconds 초기화
    this._segments = plan.segments.map((seg) => {
      const startSeconds = (seg.startBeat * 60) / this.bpm;
      const durationSeconds = (seg.durationBeats * 60) / this.bpm;
      const endSeconds = (seg.endBeat * 60) / this.bpm;
      return {
        ...seg,
        startSeconds,
        durationSeconds,
        endSeconds,
      };
    });
  }

  get totalShiftSeconds(): number {
    return this._totalShiftSeconds;
  }

  get totalSeconds(): number {
    return this.baseTotalSeconds + this._totalShiftSeconds;
  }

  get segments(): readonly AssaultLoopSegmentDef[] {
    return Object.freeze([...this._segments]);
  }

  get currentSegment(): AssaultLoopSegmentDef | null {
    if (this._currentSegmentIndex >= 0 && this._currentSegmentIndex < this._segments.length) {
      return this._segments[this._currentSegmentIndex];
    }
    return null;
  }

  get currentSegmentIndex(): number {
    return this._currentSegmentIndex;
  }

  /**
   * 지정된 활성 시각(activeSeconds)에 해당하는 활성 구간을 조회합니다.
   * [startSeconds, endSeconds) 범위에 속하는 구간을 반환하며, 범위를 벗어나면 null을 반환합니다.
   */
  getCurrentSegment(activeSeconds: number): AssaultLoopSegmentDef | null {
    if (activeSeconds < 0 || activeSeconds >= this.totalSeconds) {
      return null;
    }
    for (let i = 0; i < this._segments.length; i++) {
      const seg = this._segments[i];
      if (activeSeconds >= seg.startSeconds - 1e-6 && activeSeconds < seg.endSeconds - 1e-6) {
        return seg;
      }
    }
    // 마지막 구간의 경계 처리 (부동소수점 오차 보정)
    if (this._segments.length > 0) {
      const last = this._segments[this._segments.length - 1];
      if (activeSeconds >= last.startSeconds - 1e-6 && activeSeconds < this.totalSeconds) {
        return last;
      }
    }
    return null;
  }

  /**
   * 박자(beat) 번호로 구간을 조회합니다.
   */
  getSegmentAtBeat(beat: number): AssaultLoopSegmentDef | null {
    if (beat < 0 || beat >= this.baseTotalBeats) {
      return null;
    }
    for (const seg of this._segments) {
      if (beat >= seg.startBeat && beat < seg.endBeat) {
        return seg;
      }
    }
    return null;
  }

  getSegmentByIndex(index: number): AssaultLoopSegmentDef | undefined {
    return this._segments[index];
  }

  /**
   * 활성 시각이 toSeconds까지 전진하면서 새로 진입한 구간 전이 목록을 시간순으로 반환합니다.
   */
  getPendingTransitions(toSeconds: number): AssaultLoopSegmentTransition[] {
    const transitions: AssaultLoopSegmentTransition[] = [];

    while (this._dispatchedIndex + 1 < this._segments.length) {
      const nextIndex = this._dispatchedIndex + 1;
      const nextSeg = this._segments[nextIndex];

      if (toSeconds >= nextSeg.startSeconds - 1e-6) {
        const prevSeg = this._dispatchedIndex >= 0 ? this._segments[this._dispatchedIndex] : undefined;
        transitions.push({
          segment: nextSeg,
          prevSegment: prevSeg,
          time: nextSeg.startSeconds,
        });
        this._dispatchedIndex = nextIndex;
        this._currentSegmentIndex = nextIndex;
      } else {
        break;
      }
    }

    return transitions;
  }

  /**
   * 재개 시 미확정 공격 유예로 인한 시간 시프트(deltaSeconds)를 적용합니다.
   * 지정된 attackId의 구간 종료 시각 및 이후 모든 구간(최종 rest 포함)을 deltaSeconds만큼 지연시킵니다.
   */
  applyShift(options: AssaultLoopTimelineShiftOptions): void {
    const { attackId, fromSeconds, deltaSeconds } = options;
    if (deltaSeconds <= 0) {
      return;
    }

    let matchIndex = -1;
    if (attackId) {
      matchIndex = this._segments.findIndex((s) => s.attackId === attackId);
    }
    if (matchIndex < 0 && fromSeconds !== undefined) {
      matchIndex = this._segments.findIndex((s) => s.endSeconds >= fromSeconds - 1e-6);
    }

    if (matchIndex >= 0) {
      // 해당 구간 종료 시각 연장
      const targetSeg = this._segments[matchIndex];
      this._segments[matchIndex] = {
        ...targetSeg,
        durationSeconds: targetSeg.durationSeconds + deltaSeconds,
        endSeconds: targetSeg.endSeconds + deltaSeconds,
      };

      // 이후 모든 구간의 start/end 시프트
      for (let i = matchIndex + 1; i < this._segments.length; i++) {
        const seg = this._segments[i];
        this._segments[i] = {
          ...seg,
          startSeconds: seg.startSeconds + deltaSeconds,
          endSeconds: seg.endSeconds + deltaSeconds,
        };
      }
    } else {
      // 매칭되는 구간이 없을 경우 전체를 뒤로 시프트
      for (let i = 0; i < this._segments.length; i++) {
        const seg = this._segments[i];
        this._segments[i] = {
          ...seg,
          startSeconds: seg.startSeconds + deltaSeconds,
          endSeconds: seg.endSeconds + deltaSeconds,
        };
      }
    }

    this._totalShiftSeconds += deltaSeconds;
  }

  /**
   * 타임라인이 최종 종료 시각(totalSeconds)에 도달했는지 확인합니다.
   */
  isCompleted(activeSeconds: number): boolean {
    return activeSeconds >= this.totalSeconds - 1e-6;
  }

  /**
   * 스쿼트 하위창(notice 1박 + dodge 2박 + stand 1박) 타이밍을 계산합니다.
   *
   * @param startBeat 스쿼트 시작 박자
   * @param durationBeats 스쿼트 전체 지속 박자 (기본 4박)
   */
  calculateSquatWindows(startBeat: number, durationBeats: number = 4): AssaultLoopSquatWindows {
    const noticeBeats = 1;
    const dodgeBeats = 2;
    const startSeconds = (startBeat * 60) / this.bpm;
    const dodgeStartSeconds = ((startBeat + noticeBeats) * 60) / this.bpm;
    const dodgeEndSeconds = ((startBeat + noticeBeats + dodgeBeats) * 60) / this.bpm;
    const standEndSeconds = ((startBeat + durationBeats) * 60) / this.bpm;

    return Object.freeze({
      startSeconds,
      dodgeStartSeconds,
      dodgeEndSeconds,
      standEndSeconds,
      windowStartMs: Math.round(dodgeStartSeconds * 1000),
      arrivalMs: Math.round(dodgeEndSeconds * 1000),
      lateGraceMs: 0,
    });
  }

  /**
   * 지정된 활성 시각이 평화 구간(run_question 또는 rest)에 해당하는지 확인합니다.
   * 평화 구간에서는 펀치, 답 선택, 피해 발행 명령이 일체 발생하지 않습니다.
   */
  isPeaceful(activeSeconds: number): boolean {
    const seg = this.getCurrentSegment(activeSeconds);
    if (!seg) {
      return false;
    }
    return seg.kind === 'run_question' || seg.kind === 'rest';
  }

  /**
   * 구간 전이 이벤트의 실행 우선순위를 결정합니다.
   * rest 구간 진입은 해당 정각의 사용자 입력(우선순위 2) 및 마감 정산(우선순위 3)이
   * 완전히 처리된 후 실행되도록 우선순위 4를 부여합니다.
   */
  getTransitionPriority(segment: AssaultLoopSegmentDef): number {
    return segment.kind === 'rest' ? 4 : 0;
  }
}
