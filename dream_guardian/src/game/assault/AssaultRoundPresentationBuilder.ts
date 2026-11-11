/**
 * AssaultRoundPresentationBuilder.ts - 라운드 런타임 표시 스냅샷 불변 DTO 빌더
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§4, 5, 13.1, 15.2-B3)
 * @see docs/assault-loop/LOOP-03.md (ASSAULT-LOOP-03 / Issue #696)
 * @see docs/assault-loop/LOOP-13.md (ASSAULT-LOOP-13 / Issue #706)
 *
 * 핵심 책임:
 * 1. 라운드 컨트롤러의 표시 조립 단일 책임:
 *    - pair, hazard, text, progress DTO를 불변 AssaultRoundPresentation으로 조립.
 * 2. DOC-14 정답 플래그 비노출 계약 100% 보존:
 *    - correctSide, correctAnswerSide, isCorrect 등 내부 정답 정보를 외부에 누출하지 않음.
 * 3. deepFreeze를 통한 깊은 불변성(Object.freeze) 제공.
 * 4. 컨트롤러 private 객체의 직접 노출이나 무분별한 any 캐스팅 없이, 명시적인 읽기 전용 컨텍스트 수신.
 * 5. LOOP-13 루프 읽기 전용 스냅샷 합성:
 *    - loopPlan(timeline) 주입 시 구간, 잔여박, 기회수, 허용행동 등 실측 스냅샷 제공.
 *    - run_question 및 rest 구간에서는 pair, hazard, attackId를 undefined로 유지하여 비행/공격 노출 0회 보장.
 */

import type {
  SessionId,
  RoundId,
  AssaultRoundPhase,
  AssaultRoundPresentation,
  AssaultEncounterDef,
  AssaultAnswerSide,
  AssaultPairPresentation,
  AssaultHazardPresentation,
  AssaultPairPresentationStatus,
  AssaultHazardPresentationStatus,
  PairId,
  AttackId,
} from '../../types/assault.js';
import type {
  AssaultLoopPresentation,
  AssaultLoopSegmentDef,
  AssaultLoopSegmentKind,
  AssaultLoopSquatSubSegmentKind,
} from '../../types/assault-loop.js';
import type { AssaultLoopTimeline } from './AssaultLoopTimeline.js';
import type { AssaultRoundQuestionData } from './AssaultRoundTypes.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

declare module '../../types/assault.js' {
  interface AssaultRoundPresentation {
    readonly loop?: AssaultLoopPresentation;
  }
}

declare module '../../types/assault-loop.js' {
  interface AssaultLoopPresentation {
    readonly currentSegment?: {
      readonly kind: AssaultLoopSegmentKind;
      readonly segmentIndex: number;
      readonly startBeat: number;
      readonly endBeat: number;
      readonly durationBeats: number;
      readonly squatSubKind?: AssaultLoopSquatSubSegmentKind;
    };
    readonly opportunityIndex?: number;
    readonly allowedAction?: 'run' | 'punch' | 'squat' | 'rest';
    readonly isSelectable?: boolean;
    readonly isDodgeable?: boolean;
    readonly restNotice?: string | boolean;
  }
}

/**
 * 조우 표시 컨텍스트 포트
 * 컨트롤러 내부의 private 객체를 전체 노출하지 않고 필요한 읽기 전용 필드만 명시
 */
export interface AssaultPresentationEncounterContext {
  readonly def: AssaultEncounterDef | Record<string, unknown>;
  readonly index: number;
  readonly startSeconds: number;
  readonly arrivalSeconds: number;
  readonly deadlineSeconds: number;
  readonly endFired?: boolean;
  readonly pairJudge?: {
    readonly state: {
      readonly status: string;
      readonly lockedChoice?: AssaultAnswerSide | null;
      readonly resolvedTimestampMs?: number | null;
    };
  };
  readonly squatJudge?: {
    readonly state: {
      readonly status: string;
    };
  };
}

/**
 * 라운드 표시 스냅샷 조립용 읽기 전용 입력 컨텍스트
 */
export interface AssaultRoundPresentationContext {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly phase: AssaultRoundPhase;
  readonly question: AssaultRoundQuestionData;
  readonly optionsPairs?: Readonly<Record<string | number, unknown>>;
  readonly currentEncounter?: AssaultPresentationEncounterContext;
  readonly encounters?: readonly AssaultPresentationEncounterContext[];
  readonly currentEncounterIndex: number;
  readonly totalEncounters: number;
  readonly activeSeconds: number;
  readonly readingProgress: number;
  readonly isPaused: boolean;
  readonly throwDurationSeconds: number;
  readonly readingEndTime: number;
  readonly timeline?: AssaultLoopTimeline | null;
}

/** 텍스트 추출 헬퍼 (null/undefined/객체 형태 안전 파싱) */
function extractText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (obj.value !== undefined) return String(obj.value);
  }
  return '';
}

/** 답 쌍(Answer Pair) 표시 스냅샷 생성 헬퍼 */
function buildPairSnapshot(
  enc: AssaultPresentationEncounterContext | undefined,
  context: AssaultRoundPresentationContext,
): AssaultPairPresentation | undefined {
  if (!enc) return undefined;
  const def = enc.def as Record<string, unknown>;
  if (def.kind !== 'answer_pair') return undefined;

  const { question, optionsPairs, activeSeconds, phase } = context;
  const pairId = (def.pairId ?? def.id) as PairId;
  const questionPairs = (question as Record<string, unknown>).pairs as
    | Record<string | number, unknown>
    | undefined;

  const pairObj = (def.pair ??
    optionsPairs?.[pairId as string] ??
    optionsPairs?.[enc.index] ??
    questionPairs?.[pairId as string] ??
    questionPairs?.[enc.index]) as Record<string, unknown> | undefined;

  const leftCandidates = [
    def.leftText,
    def.leftChoiceText,
    extractText(def.left),
    Array.isArray(def.choices) ? extractText(def.choices[0]) : '',
    pairObj?.leftText,
    pairObj ? extractText(pairObj.left) : '',
    pairObj && Array.isArray(pairObj.choices) ? extractText(pairObj.choices[0]) : '',
    (question as Record<string, unknown>).leftChoiceText,
  ];
  const leftText = leftCandidates.find((t) => t && String(t).trim().length > 0) ?? '';

  const rightCandidates = [
    def.rightText,
    def.rightChoiceText,
    extractText(def.right),
    Array.isArray(def.choices) ? extractText(def.choices[1]) : '',
    pairObj?.rightText,
    pairObj ? extractText(pairObj.right) : '',
    pairObj && Array.isArray(pairObj.choices) ? extractText(pairObj.choices[1]) : '',
    (question as Record<string, unknown>).rightChoiceText,
  ];
  const rightText = rightCandidates.find((t) => t && String(t).trim().length > 0) ?? '';

  const flightDuration = Math.max(0.001, enc.arrivalSeconds - enc.startSeconds);
  const pairProgress = Math.max(0, Math.min(1.0, (activeSeconds - enc.startSeconds) / flightDuration));
  const isEarly =
    phase === 'throw_in' ||
    phase === 'question_reading' ||
    activeSeconds < enc.startSeconds;
  const throwProgress = isEarly ? 0.0 : pairProgress;

  let pairStatus: AssaultPairPresentationStatus;
  if (phase === 'round_failed') {
    pairStatus = enc.pairJudge?.state.status === 'correct' ? 'negated' : 'cancelled';
  } else if (enc.pairJudge) {
    const js = enc.pairJudge.state.status;
    if (js === 'correct') {
      pairStatus = 'negated';
    } else if (js === 'cancelled') {
      pairStatus = 'cancelled';
    } else if (js === 'timeout') {
      pairStatus = 'timeout';
    } else if (js === 'wrong_locked') {
      pairStatus = activeSeconds >= enc.arrivalSeconds ? 'wrong_hit' : 'wrong_locked';
    } else {
      pairStatus = isEarly ? 'pending' : 'flying';
    }
  } else {
    pairStatus = isEarly ? 'pending' : 'flying';
  }

  const promptText = (def.pairPromptText ??
    def.promptText ??
    pairObj?.pairPromptText ??
    pairObj?.promptText ??
    (question as Record<string, unknown>).pairPromptText) as string | undefined;

  const challengeFamily = (def.challengeFamily ??
    pairObj?.challengeFamily ??
    (question as Record<string, unknown>).challengeFamily) as string | undefined;

  const lockedAtSeconds =
    enc.pairJudge?.state.resolvedTimestampMs != null
      ? enc.pairJudge.state.resolvedTimestampMs / 1000
      : undefined;

  return Object.freeze({
    pairId,
    attackId: def.id as AttackId,
    leftText: String(leftText),
    rightText: String(rightText),
    throwProgress,
    progress: throwProgress,
    status: pairStatus,
    lockedSide: enc.pairJudge?.state.lockedChoice ?? null,
    ...(lockedAtSeconds !== undefined ? { lockedAtSeconds } : {}),
    arrivalSeconds: enc.arrivalSeconds,
    graceDeadlineSeconds: enc.deadlineSeconds,
    ...(promptText ? { pairPromptText: promptText } : {}),
    ...(challengeFamily ? { challengeFamily } : {}),
  });
}

/** 위험/스쿼트/점프(Hazard) 표시 스냅샷 생성 헬퍼 */
function buildHazardSnapshot(
  enc: AssaultPresentationEncounterContext | undefined,
  context: AssaultRoundPresentationContext,
): AssaultHazardPresentation | undefined {
  if (!enc) return undefined;
  const def = enc.def as Record<string, unknown>;
  if (def.kind !== 'squat' && def.kind !== 'jump') return undefined;

  const { activeSeconds, phase } = context;
  const hazardDuration = Math.max(0.001, enc.arrivalSeconds - enc.startSeconds);
  const hazardProgress = Math.max(0, Math.min(1.0, (activeSeconds - enc.startSeconds) / hazardDuration));

  let hazardStatus: AssaultHazardPresentationStatus;
  if (phase === 'round_failed') {
    hazardStatus = 'cancelled';
  } else if (enc.squatJudge?.state.status === 'evaded' || enc.squatJudge?.state.status === 'dodged') {
    hazardStatus = 'evaded';
  } else if (enc.squatJudge?.state.status === 'miss' || enc.squatJudge?.state.status === 'hit' || enc.squatJudge?.state.status === 'timeout') {
    hazardStatus = 'hit';
  } else if (activeSeconds < enc.startSeconds) {
    hazardStatus = 'telegraph';
  } else {
    hazardStatus = 'active';
  }

  const prompt =
    (def.promptText as string | undefined) ??
    (def.kind === 'jump' ? '점프로 장애물을 뛰어넘으세요!' : '스쿼트로 숙여서 회피하세요!');

  return Object.freeze({
    hazardId: (def.hazardId ?? def.id) as AttackId,
    attackId: def.id as AttackId,
    kind: def.kind === 'jump' ? 'jump' : 'squat',
    active: phase === 'encounters' && !enc.endFired,
    progress: hazardProgress,
    approachProgress: hazardProgress,
    status: hazardStatus,
    promptText: prompt,
    arrivalSeconds: enc.arrivalSeconds,
    evasionDeadlineSeconds: enc.deadlineSeconds,
  });
}

/** 루프 읽기 전용 실측 스냅샷 조립 헬퍼 */
function buildLoopPresentation(
  timeline: AssaultLoopTimeline,
  context: AssaultRoundPresentationContext,
  enc?: AssaultPresentationEncounterContext,
): AssaultLoopPresentation {
  const { activeSeconds } = context;
  const secondsPerBeat = timeline.secondsPerBeat;

  let seg = timeline.getCurrentSegment(activeSeconds);
  if (!seg) {
    if (activeSeconds < 0) {
      seg = timeline.segments[0] ?? null;
    } else if (activeSeconds >= timeline.totalSeconds) {
      seg = timeline.segments[timeline.segments.length - 1] ?? null;
    }
  }

  if (!seg) {
    return {
      currentSegmentIndex: 0,
      currentSegmentKind: 'run_question',
      segmentElapsedBeats: 0,
      segmentRemainingBeats: 0,
      segmentElapsedSeconds: 0,
      segmentRemainingSeconds: 0,
      currentOpportunity: 0,
      opportunityIndex: 1,
      totalOpportunities: 4,
      allowedAction: 'run',
      isSelectable: false,
      canSelectAnswer: false,
      isDodgeable: false,
      isResting: false,
      isSquatActive: false,
    };
  }

  const segmentElapsedSeconds = Math.max(0, Math.min(seg.durationSeconds, activeSeconds - seg.startSeconds));
  const segmentRemainingSeconds = Math.max(0, seg.durationSeconds - segmentElapsedSeconds);
  const segmentElapsedBeats = Math.max(0, Math.min(seg.durationBeats, segmentElapsedSeconds / secondsPerBeat));
  const segmentRemainingBeats = Math.max(0, seg.durationBeats - segmentElapsedBeats);

  let squatSubKind: AssaultLoopSquatSubSegmentKind | undefined;
  if (seg.kind === 'squat' && seg.squatSubSegments && seg.squatSubSegments.length > 0) {
    for (const sub of seg.squatSubSegments) {
      if (activeSeconds >= sub.startSeconds - 1e-6 && activeSeconds < sub.endSeconds - 1e-6) {
        squatSubKind = sub.kind;
        break;
      }
    }
    if (!squatSubKind) {
      squatSubKind = seg.squatSubSegments[seg.squatSubSegments.length - 1].kind;
    }
  }

  const allowedAction: 'run' | 'punch' | 'squat' | 'rest' =
    seg.kind === 'run_question'
      ? 'run'
      : seg.kind === 'answer'
        ? 'punch'
        : seg.kind === 'squat'
          ? 'squat'
          : 'rest';

  const isDodgeable = seg.kind === 'squat' && squatSubKind === 'dodge';
  const isResting = seg.kind === 'rest';
  const isSquatActive = seg.kind === 'squat';

  const oppIndex = seg.opportunityIndex ?? (seg.kind === 'squat' ? (seg.gapIndex ?? 1) : 1);
  const currentOpportunity = seg.kind === 'run_question' ? 0 : oppIndex;

  let isSelectable = false;
  if (seg.kind === 'answer') {
    const targetEnc = (seg.attackId
      ? context.encounters?.find((e) => {
          const d = e.def as Record<string, unknown>;
          return d.id === seg!.attackId || d.attackId === seg!.attackId;
        })
      : undefined) ?? enc;

    const status = targetEnc?.pairJudge?.state.status;
    const isLockedOrResolved = Boolean(status && status !== 'pending' && status !== 'flying');
    const isExpired = targetEnc ? activeSeconds >= targetEnc.arrivalSeconds : false;
    isSelectable = !isLockedOrResolved && !isExpired;
  }
  const canSelectAnswer = isSelectable;

  let restNotice: string | undefined;
  if (isResting) {
    restNotice = seg.opportunityIndex === 4
      ? '마지막 휴식: 호흡을 가다듬으세요'
      : '휴식: 호흡을 가다듬고 다음 문제를 준비하세요';
  }

  let actionPrompt: string;
  switch (seg.kind) {
    case 'run_question':
      actionPrompt = '문제를 읽으며 달리세요';
      break;
    case 'answer':
      actionPrompt = '정답을 향해 펀치하세요';
      break;
    case 'squat':
      actionPrompt = '스쿼트로 장애물을 피하세요';
      break;
    case 'rest':
    default:
      actionPrompt = '호흡을 가다듬으세요';
      break;
  }

  const currentSegmentKind: AssaultLoopSegmentKind = seg.kind;

  return {
    currentSegmentIndex: seg.segmentIndex,
    currentSegmentKind,
    currentSegment: {
      kind: currentSegmentKind,
      segmentIndex: seg.segmentIndex,
      startBeat: seg.startBeat,
      endBeat: seg.endBeat,
      durationBeats: seg.durationBeats,
      ...(squatSubKind ? { squatSubKind } : {}),
    },
    segmentElapsedBeats,
    segmentRemainingBeats,
    segmentElapsedSeconds,
    segmentRemainingSeconds,
    currentOpportunity,
    opportunityIndex: oppIndex,
    totalOpportunities: 4,
    allowedAction,
    isSelectable,
    canSelectAnswer,
    isDodgeable,
    isResting,
    isSquatActive,
    currentSquatSubSegment: squatSubKind,
    actionPrompt,
    ...(restNotice ? { restNotice } : {}),
  };
}

export class AssaultRoundPresentationBuilder {
  /**
   * 읽기 전용 컨텍스트를 받아 불변 AssaultRoundPresentation DTO를 빌드하여 반환합니다.
   * DOC-14 정답 플래그 비노출 계약을 엄격히 준수합니다.
   */
  static build(context: AssaultRoundPresentationContext): AssaultRoundPresentation {
    const {
      sessionId,
      roundId,
      phase,
      question,
      currentEncounter: enc,
      currentEncounterIndex,
      totalEncounters,
      activeSeconds,
      readingProgress,
      isPaused,
      throwDurationSeconds,
      readingEndTime,
      timeline,
    } = context;

    let seg: AssaultLoopSegmentDef | null = null;
    let loop: AssaultLoopPresentation | undefined;

    if (timeline) {
      loop = buildLoopPresentation(timeline, context, enc);
      seg = timeline.getCurrentSegment(activeSeconds) ??
        (activeSeconds < 0
          ? (timeline.segments[0] ?? null)
          : activeSeconds >= timeline.totalSeconds
            ? (timeline.segments[timeline.segments.length - 1] ?? null)
            : null);
    }

    let pairSnapshot: AssaultPairPresentation | undefined;
    let hazardSnapshot: AssaultHazardPresentation | undefined;

    if (timeline && seg) {
      let matchedEncounter: AssaultPresentationEncounterContext | undefined;
      if (seg.attackId) {
        matchedEncounter = context.encounters?.find((e) => {
          const d = e.def as Record<string, unknown>;
          return d.id === seg!.attackId || d.attackId === seg!.attackId;
        });
      }
      if (!matchedEncounter && (seg.kind === 'answer' || seg.kind === 'squat')) {
        matchedEncounter = enc;
      }

      if (seg.kind === 'answer') {
        pairSnapshot = buildPairSnapshot(matchedEncounter, context);
      } else if (seg.kind === 'squat') {
        hazardSnapshot = buildHazardSnapshot(matchedEncounter, context);
      }
      // run_question and rest: pairSnapshot and hazardSnapshot remain undefined
    } else {
      pairSnapshot = buildPairSnapshot(enc, context);
      hazardSnapshot = buildHazardSnapshot(enc, context);
    }

    const roundThrowProgress =
      phase === 'throw_in'
        ? (throwDurationSeconds > 0
            ? Math.min(1.0, activeSeconds / throwDurationSeconds)
            : 1.0)
        : (pairSnapshot ? pairSnapshot.throwProgress : 1.0);

    const finalThrowProgress = timeline
      ? (seg?.kind === 'answer' && pairSnapshot ? pairSnapshot.throwProgress : 0.0)
      : roundThrowProgress;

    let remainingSeconds: number | undefined;
    if (timeline && seg) {
      remainingSeconds = Math.max(0, seg.endSeconds - activeSeconds);
    } else if (phase === 'encounters' && enc) {
      remainingSeconds = Math.max(0, enc.deadlineSeconds - activeSeconds);
    } else if (phase === 'question_reading') {
      remainingSeconds = Math.max(0, readingEndTime - activeSeconds);
    } else if (phase === 'throw_in') {
      remainingSeconds = Math.max(0, throwDurationSeconds - activeSeconds);
    }

    const activeArrival =
      timeline && seg
        ? (seg.kind === 'answer' || seg.kind === 'squat' ? (pairSnapshot?.arrivalSeconds ?? hazardSnapshot?.arrivalSeconds ?? 0) : 0)
        : (enc ? enc.arrivalSeconds : 0);

    const bossScaleProgress =
      phase === 'throw_in'
        ? roundThrowProgress ?? 0
        : phase === 'question_reading' || (timeline && (seg?.kind === 'run_question' || seg?.kind === 'rest'))
          ? 1.0
          : activeArrival > 0
            ? Math.min(1.0, activeSeconds / activeArrival)
            : 1.0;

    const presentation: AssaultRoundPresentation = {
      sessionId,
      roundId,
      phase,
      questionText:
        question.text ||
        (question as any).questionText ||
        (question as any).questionTemplate ||
        '',
      currentEncounterIndex,
      totalEncounters,
      activeSeconds,
      readingProgress,
      isPaused,
      throwProgress: finalThrowProgress,
      ...(remainingSeconds !== undefined ? { remainingSeconds } : {}),
      bossScaleProgress,
      ...(pairSnapshot
        ? {
            pair: pairSnapshot,
            pairId: pairSnapshot.pairId,
            attackId: pairSnapshot.attackId,
            leftChoiceText: pairSnapshot.leftText,
            rightChoiceText: pairSnapshot.rightText,
            lockedSide: pairSnapshot.lockedSide,
            ...(pairSnapshot.pairPromptText ? { pairPromptText: pairSnapshot.pairPromptText } : {}),
            ...(pairSnapshot.challengeFamily ? { challengeFamily: pairSnapshot.challengeFamily } : {}),
          }
        : {}),
      ...(hazardSnapshot
        ? {
            hazard: hazardSnapshot,
            attackId: hazardSnapshot.attackId,
          }
        : {}),
      ...(loop ? { loop } : {}),
    };

    return deepFreeze(presentation);
  }
}

/** 함수형 인터페이스 제공 */
export function buildAssaultRoundPresentation(
  context: AssaultRoundPresentationContext,
): AssaultRoundPresentation {
  return AssaultRoundPresentationBuilder.build(context);
}
