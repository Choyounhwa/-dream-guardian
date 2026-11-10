/**
 * AssaultNoteAdapter.ts - MotionNote 논리 공격 생명주기 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§2.1, 6.5, 11.1, A05, A07, A11, A14)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-14 / Issue #516)
 *
 * 핵심 역할 및 규칙:
 * 1. 라운드 전체 계획 1회 로드:
 *    - loadNotes가 reset을 수행하는 기존 계약을 보존하고 라운드 전체 계획을 1회 일괄 적재한다 (pair마다 load/reset 금지).
 * 2. 0-based -> 1-based beat 변환:
 *    - AssaultEncounterDef의 startBeat(0-based)를 MotionNote의 beat(1-based, startBeat + 1)로 정규화한다.
 *    - 이 변환은 오직 본 어댑터 한 곳에서만 수행한다.
 * 3. 논리 노트 1개 매핑 및 시각 항목 분리:
 *    - 하나의 answer_pair 조우당 1개의 논리 MotionNote로 관리하여 정답 타격/취소/타임아웃 시
 *      형제(sibling) 탄환에 대해 가짜 Miss나 중복 hit가 발생하지 않도록 원천 차단한다.
 * 4. 순수 판정기(#514 AssaultPairJudge, #515 AssaultSquatJudge) 연동:
 *    - 판정 결과를 Timeline 생명주기(resolveRuntime)에 정확하고 멱등하게 반영한다.
 * 5. 기존 모션/노트 회귀 방지:
 *    - 기존 star, stomp, evade, jump 판정 및 공용 타임라인 기능 100% 정상 작동 유지.
 *    - HP 직접 변경 0회, DOM/Audio/effects 자원 부작용 0회.
 */

import type {
  AssaultEncounterDef,
  AssaultSessionPlan,
  AssaultEncounterKind,
} from '../../types/assault.js';
import type {
  MotionNote,
  MotionNoteResult,
  MotionRating,
} from '../../types/motion-note.js';
import {
  MotionNoteTimeline,
  type LoadNotesOptions,
} from '../MotionNoteTimeline.js';
import {
  AssaultInteractionJudge,
} from './AssaultInteractionJudge.js';
import type {
  AssaultPairState,
} from './AssaultPairJudge.js';
import type {
  AssaultSquatState,
} from './AssaultSquatJudge.js';
import type { MotionInputSnapshot } from '../interaction/TapJudge.js';

// ─── 1. 시각 표시 및 어댑터 옵션 타입 계약 ───

/**
 * 렌더러/UI 전용 시각 표시 항목
 */
export interface AssaultVisualItem {
  readonly attackId: string;
  readonly pairId?: string;
  readonly side: 'left' | 'right' | 'center';
  readonly kind: AssaultEncounterKind;
  readonly progress: number; // 0 (발사) ~ 1 (도착)
  readonly timeToLanding: number; // 초
  readonly visualProfileId: string;
  readonly status: 'pending' | 'inFlight' | 'hit' | 'miss' | 'cancelled';
  readonly isCancelled: boolean;
  readonly isHit: boolean;
  readonly isMiss: boolean;
}

export interface AssaultNoteAdapterOptions {
  readonly timeline?: MotionNoteTimeline;
  readonly spb?: number;
  readonly bpm?: number;
  readonly leadBeats?: number;
  readonly sequenceStart?: number;
}

interface EncounterVisualState {
  leftStatus?: 'pending' | 'inFlight' | 'hit' | 'miss' | 'cancelled';
  rightStatus?: 'pending' | 'inFlight' | 'hit' | 'miss' | 'cancelled';
  centerStatus?: 'pending' | 'inFlight' | 'hit' | 'miss' | 'cancelled';
}

// ─── 2. 순수 변환 함수 (0-based -> 1-based) ───

/**
 * 단일 AssaultEncounterDef를 단일 논리 MotionNote로 변환
 * (0-based startBeat -> 1-based beat: startBeat + 1)
 */
export function encounterToMotionNote(
  encounter: AssaultEncounterDef,
  options?: { defaultLeadBeats?: number },
): MotionNote {
  const normalizedBeat = encounter.startBeat + 1;
  const leadBeats = encounter.durationBeats > 0 ? encounter.durationBeats : options?.defaultLeadBeats;

  switch (encounter.kind) {
    case 'answer_pair':
      return {
        id: encounter.id,
        patternId: encounter.pairId ?? encounter.id,
        beat: normalizedBeat,
        requirements: [
          { part: 'leftHand', zoneId: 4 },
          { part: 'rightHand', zoneId: 5 },
        ],
        interaction: 'tap',
        profileId: encounter.visualProfileId,
        leadBeats,
        source: 'assault',
      };

    case 'squat':
      return {
        id: encounter.id,
        patternId: encounter.id,
        beat: normalizedBeat,
        requirements: [
          { part: 'fullBody', zoneId: 10 },
        ],
        interaction: 'evade',
        profileId: encounter.visualProfileId,
        leadBeats,
        source: 'assault',
      };

    case 'jump':
      return {
        id: encounter.id,
        patternId: encounter.id,
        beat: normalizedBeat,
        requirements: [
          { part: 'fullBody', zoneId: 10 },
        ],
        interaction: 'jump',
        profileId: encounter.visualProfileId,
        leadBeats,
        source: 'assault',
      };

    default:
      // 기본 tap 폴백
      return {
        id: encounter.id,
        patternId: encounter.id,
        beat: normalizedBeat,
        requirements: [
          { part: 'leftHand', zoneId: 4 },
          { part: 'rightHand', zoneId: 5 },
        ],
        interaction: 'tap',
        profileId: encounter.visualProfileId,
        leadBeats,
        source: 'assault',
      };
  }
}

/**
 * 조우 정의 목록 전체를 논리 MotionNote 목록으로 일괄 변환
 */
export function encountersToMotionNotes(
  encounters: readonly AssaultEncounterDef[],
  options?: { defaultLeadBeats?: number },
): readonly MotionNote[] {
  return encounters.map((enc) => encounterToMotionNote(enc, options));
}

// ─── 3. AssaultNoteAdapter 클래스 ───

export class AssaultNoteAdapter {
  private readonly _timeline: MotionNoteTimeline;
  private readonly _judge: AssaultInteractionJudge;
  private _encounters: readonly AssaultEncounterDef[] = [];
  private _logicalNotes: readonly MotionNote[] = [];
  private readonly _visualStates = new Map<string, EncounterVisualState>();
  private readonly _resolvedAttacks = new Set<string>();
  private _isLoaded = false;

  constructor(options?: AssaultNoteAdapterOptions) {
    if (options?.timeline) {
      this._timeline = options.timeline;
    } else {
      const spb = options?.bpm ? 60 / options.bpm : (options?.spb ?? 0.5);
      this._timeline = new MotionNoteTimeline({
        spb,
        leadBeats: options?.leadBeats ?? 2,
      });
    }

    // 기존 탭 판정기를 래핑하는 AssaultInteractionJudge 등록
    const existingTapJudge = this._timeline.getJudge('tap');
    this._judge = new AssaultInteractionJudge({
      delegate: existingTapJudge,
      type: 'tap',
    });
    this._timeline.registerJudge(this._judge);
  }

  get timeline(): MotionNoteTimeline {
    return this._timeline;
  }

  get encounters(): readonly AssaultEncounterDef[] {
    return this._encounters;
  }

  get logicalNotes(): readonly MotionNote[] {
    return this._logicalNotes;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * 조우 목록 전체를 라운드 단위로 1회 일괄 적재
   * (MotionNoteTimeline.loadNotes가 reset을 수행하므로 라운드 시작 시 1회만 호출)
   */
  loadEncounters(
    encounters: readonly AssaultEncounterDef[],
    options?: LoadNotesOptions,
  ): readonly MotionNote[] {
    this._encounters = [...encounters];
    this._logicalNotes = encountersToMotionNotes(encounters, {
      defaultLeadBeats: options?.leadBeats,
    });
    this._visualStates.clear();
    this._resolvedAttacks.clear();

    // 시각 상태 초기화
    for (const enc of encounters) {
      if (enc.kind === 'answer_pair') {
        this._visualStates.set(enc.id, {
          leftStatus: 'pending',
          rightStatus: 'pending',
        });
      } else {
        this._visualStates.set(enc.id, {
          centerStatus: 'pending',
        });
      }
    }

    this._timeline.loadNotes(this._logicalNotes, options);
    this._isLoaded = true;
    return this._logicalNotes;
  }

  /**
   * AssaultSessionPlan 객체로 일괄 적재
   */
  loadPlan(
    plan: AssaultSessionPlan | { readonly encounters: readonly AssaultEncounterDef[] },
    options?: LoadNotesOptions,
  ): readonly MotionNote[] {
    return this.loadEncounters(plan.encounters, options);
  }

  /**
   * 매 프레임 타임라인 갱신
   */
  update(now: number, input?: MotionInputSnapshot): MotionNoteResult[] {
    return this._timeline.update(now, input);
  }

  /**
   * 답 쌍 순수 판정(#514 AssaultPairJudge) 결과를 논리 노트 생명주기에 반영
   */
  applyPairResult(attackId: string, state: AssaultPairState): MotionNoteResult | null {
    // 멱등성: 이미 확정된 공격은 중복 처리/재콜백 방지
    if (this._resolvedAttacks.has(attackId)) {
      return null;
    }

    const rt = this._timeline.getRuntime(attackId);
    if (!rt || rt.state === 'resolved') {
      this._resolvedAttacks.add(attackId);
      return null;
    }

    this._resolvedAttacks.add(attackId);

    const deltaMs = state.deltaMs ?? (state as unknown as { timingErrorMs?: number }).timingErrorMs ?? 0;
    const timingErrorSec = deltaMs != null ? deltaMs / 1000 : 0;
    const visualState = this._visualStates.get(attackId) ?? {};

    let result: MotionNoteResult;

    switch (state.status) {
      case 'correct': {
        const lockedSide = state.lockedChoice ?? 'left';
        const matchedHand = lockedSide === 'left' ? 'leftHand' : 'rightHand';
        result = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating: (state.rhythmRating as MotionRating) ?? 'Perfect',
          success: true,
          timingError: timingErrorSec,
          matchedParts: [matchedHand],
        };
        // 시각 상태: 맞힌 쪽은 hit, 형제(sibling) 쪽은 cancelled (가짜 Miss 없음!)
        visualState.leftStatus = lockedSide === 'left' ? 'hit' : 'cancelled';
        visualState.rightStatus = lockedSide === 'right' ? 'hit' : 'cancelled';
        break;
      }

      case 'wrong_locked': {
        const lockedSide = state.lockedChoice ?? 'left';
        const matchedHand = lockedSide === 'left' ? 'leftHand' : 'rightHand';
        result = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating: (state.rhythmRating as MotionRating) ?? 'Miss',
          success: false,
          timingError: timingErrorSec,
          matchedParts: [matchedHand],
        };
        visualState.leftStatus = lockedSide === 'left' ? 'miss' : 'cancelled';
        visualState.rightStatus = lockedSide === 'right' ? 'miss' : 'cancelled';
        break;
      }

      case 'timeout': {
        result = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating: 'Miss',
          success: false,
          timingError: 0,
          matchedParts: [],
        };
        visualState.leftStatus = 'miss';
        visualState.rightStatus = 'miss';
        break;
      }

      case 'cancelled': {
        result = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating: 'Miss',
          success: false,
          timingError: 0,
          matchedParts: [],
        };
        visualState.leftStatus = 'cancelled';
        visualState.rightStatus = 'cancelled';
        break;
      }

      default:
        // pending 등 미확정 상태는 런타임 resolve 하지 않음
        this._resolvedAttacks.delete(attackId);
        return null;
    }

    this._visualStates.set(attackId, visualState);
    this._timeline.resolveRuntime(rt, result);
    return result;
  }

  /**
   * 스쿼트 공격 순수 판정(#515 AssaultSquatJudge) 결과를 논리 노트 생명주기에 반영
   */
  applySquatResult(attackId: string, state: AssaultSquatState): MotionNoteResult | null {
    if (this._resolvedAttacks.has(attackId)) {
      return null;
    }

    const rt = this._timeline.getRuntime(attackId);
    if (!rt || rt.state === 'resolved') {
      this._resolvedAttacks.add(attackId);
      return null;
    }

    this._resolvedAttacks.add(attackId);
    const visualState = this._visualStates.get(attackId) ?? {};

    let result: MotionNoteResult;

    switch (state.status) {
      case 'evaded': {
        result = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating: 'Perfect',
          success: true,
          timingError: 0,
          matchedParts: ['fullBody'],
        };
        visualState.centerStatus = 'hit';
        break;
      }

      case 'miss': {
        result = {
          noteId: rt.note.id,
          interaction: rt.note.interaction,
          rating: 'Miss',
          success: false,
          timingError: 0,
          matchedParts: [],
        };
        visualState.centerStatus = 'miss';
        break;
      }

      default:
        this._resolvedAttacks.delete(attackId);
        return null;
    }

    this._visualStates.set(attackId, visualState);
    this._timeline.resolveRuntime(rt, result);
    return result;
  }

  /**
   * 특정 조우 수동 취소 (형제 Miss나 추가 hit 없이 안전하게 확정)
   */
  cancelPair(attackId: string): MotionNoteResult | null {
    return this.applyPairResult(attackId, {
      status: 'cancelled',
      lockedChoice: null,
      isLocked: true,
      isCorrect: null,
      rhythmRating: null,
      deltaMs: null,
      resolvedTimestampMs: null,
      inputId: null,
      processedInputIds: [],
      conflictCount: 0,
      lastConflictTimestampMs: null,
      isSettled: true,
    });
  }

  /**
   * 렌더러가 소비할 시각 표시 항목(AssaultVisualItem[]) 생성
   */
  getVisualItems(now?: number): readonly AssaultVisualItem[] {
    const queryTime = now ?? this._timeline.currentTime;
    const items: AssaultVisualItem[] = [];

    for (const enc of this._encounters) {
      const rt = this._timeline.getRuntime(enc.id);
      if (!rt) continue;

      const duration = rt.landingTime - rt.displayStart;
      const progress = duration > 0 ? (queryTime - rt.displayStart) / duration : 1.0;
      const timeToLanding = rt.landingTime - queryTime;
      const visState = this._visualStates.get(enc.id);

      const deriveStatus = (
        explicitStatus?: 'pending' | 'inFlight' | 'hit' | 'miss' | 'cancelled',
      ): 'pending' | 'inFlight' | 'hit' | 'miss' | 'cancelled' => {
        if (explicitStatus && explicitStatus !== 'pending') {
          return explicitStatus;
        }
        if (rt.state === 'resolved') {
          return rt.result?.success ? 'hit' : 'miss';
        }
        if (rt.state === 'pending') {
          return 'pending';
        }
        return 'inFlight';
      };

      if (enc.kind === 'answer_pair') {
        const leftStatus = deriveStatus(visState?.leftStatus);
        const rightStatus = deriveStatus(visState?.rightStatus);

        items.push({
          attackId: enc.id,
          pairId: enc.pairId,
          side: 'left',
          kind: 'answer_pair',
          progress,
          timeToLanding,
          visualProfileId: enc.visualProfileId,
          status: leftStatus,
          isCancelled: leftStatus === 'cancelled',
          isHit: leftStatus === 'hit',
          isMiss: leftStatus === 'miss',
        });

        items.push({
          attackId: enc.id,
          pairId: enc.pairId,
          side: 'right',
          kind: 'answer_pair',
          progress,
          timeToLanding,
          visualProfileId: enc.visualProfileId,
          status: rightStatus,
          isCancelled: rightStatus === 'cancelled',
          isHit: rightStatus === 'hit',
          isMiss: rightStatus === 'miss',
        });
      } else {
        const centerStatus = deriveStatus(visState?.centerStatus);
        items.push({
          attackId: enc.id,
          pairId: enc.pairId,
          side: 'center',
          kind: enc.kind,
          progress,
          timeToLanding,
          visualProfileId: enc.visualProfileId,
          status: centerStatus,
          isCancelled: centerStatus === 'cancelled',
          isHit: centerStatus === 'hit',
          isMiss: centerStatus === 'miss',
        });
      }
    }

    return items;
  }
}
