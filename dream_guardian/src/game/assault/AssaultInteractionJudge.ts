/**
 * AssaultInteractionJudge.ts - 보스 접근전(Boss Assault) 전용 인터랙션 판정기 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.5, 6.6, 11.1, A05, A07, A14)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-14 / Issue #516)
 *
 * 역할:
 * 1. InteractionJudge 인터페이스를 구현하여 MotionNoteTimeline의 judgment 포트에 등록된다.
 * 2. source === 'assault'인 노트에 대해서는 기존 TapJudge의 다중 커서 존 판정이 개입하지 않도록 차단하고,
 *    #514(AssaultPairJudge) 및 #515(AssaultSquatJudge)의 순수 판정 결과와 생명주기를 연동한다.
 * 3. source !== 'assault' (star, stomp 등) 노트는 기존 위임 판정기(_delegate)로 전달하여
 *    기존 리듬 게임 시스템과의 100% 하위 호환성을 보존한다.
 */

import type {
  MotionInteractionType,
  MotionNoteRuntime,
  MotionNoteResult,
} from '../../types/motion-note.js';
import type {
  InteractionJudge,
  MotionInputSnapshot,
} from '../interaction/TapJudge.js';

export interface AssaultInteractionJudgeOptions {
  readonly delegate?: InteractionJudge;
  readonly type?: MotionInteractionType;
}

export class AssaultInteractionJudge implements InteractionJudge {
  readonly type: MotionInteractionType;
  private readonly _delegate?: InteractionJudge;
  private readonly _stagedResults = new Map<string, MotionNoteResult>();

  constructor(options?: AssaultInteractionJudgeOptions) {
    this.type = options?.type ?? 'tap';
    this._delegate = options?.delegate;
  }

  get delegate(): InteractionJudge | undefined {
    return this._delegate;
  }

  /**
   * 사전 확정된 순수 판정 결과 등록
   */
  stageResult(noteId: string, result: MotionNoteResult): void {
    this._stagedResults.set(noteId, result);
  }

  /**
   * 등록된 결과 취소/제거
   */
  clearStagedResult(noteId: string): void {
    this._stagedResults.delete(noteId);
  }

  /**
   * 매 프레임 판정 평가
   */
  evaluate(rt: MotionNoteRuntime, input: MotionInputSnapshot, now: number): MotionNoteResult | null {
    if (rt.state === 'resolved' || rt.result) return null;

    // assault 출처 노트인 경우
    if (rt.note.source === 'assault') {
      const staged = this._stagedResults.get(rt.note.id);
      if (staged) {
        this._stagedResults.delete(rt.note.id);
        return staged;
      }
      // assault 노트는 순수 판정기(#514/#515)에 의해 직접 resolve되거나 stageResult를 통해 주입된다.
      // 기본 TapJudge의 cursorZones 복합 일치 검사로 인한 오판정(fake miss)을 방지한다.
      return null;
    }

    // 비 assault (star, stomp 등) 노트는 기존 delegate로 위임
    if (this._delegate && this._delegate.type === rt.note.interaction) {
      return this._delegate.evaluate(rt, input, now);
    }

    return null;
  }
}
