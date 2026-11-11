/**
 * AssaultRoundTypes.ts - 보스 접근전(Boss Assault) 라운드 컨트롤러 타입 계약
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-15)
 */

import type {
  SessionId,
  RoundId,
  AssaultRoundPhase,
  AssaultEncounterDef,
  AssaultSettlementCommand,
} from '../../types/assault.js';
import type {
  AssaultLoopRoundPlan,
  AssaultLoopSegmentDef,
} from '../../types/assault-loop.js';
import type { AssaultLoopSquatWindows } from './AssaultLoopTimeline.js';
import type {
  AssaultCompiledPlan,
  AssaultCompiledEncounter,
} from './AssaultPlanCompiler.js';
import type { AssaultPairJudge } from './AssaultPairJudge.js';
import type { AssaultSquatJudge } from './AssaultSquatJudge.js';
import type {
  AssaultSquatPosture,
  AssaultSquatResult,
} from '../../motion/AssaultSquatAdapter.js';
import type { AssaultTimingAndBalanceConfig } from '../../../config/assault.config.js';
import type { AssaultNoteAdapter } from './AssaultNoteAdapter.js';
import type { AssaultRoundSummaryData } from './AssaultRoundSummary.js';

/** 문제 데이터 계약 */
export interface AssaultRoundQuestionData {
  readonly id: string;
  readonly text: string;
  readonly type?: string;
  readonly minReadSeconds?: number;
  readonly level?: number;
  readonly [key: string]: unknown;
}

/**
 * normalizeAssaultRoundQuestion - QuestionCandidate, AssaultRoundQuestionData, 문자열 등 다양한 입력 형식을
 * 단일 AssaultRoundQuestionData 계약으로 안전하게 정규화한다. (DRY SSOT)
 */
export function normalizeAssaultRoundQuestion(
  raw: unknown,
  fallbackRoundId: string = 'round_01',
): AssaultRoundQuestionData {
  if (typeof raw === 'string') {
    return {
      id: `q_${fallbackRoundId}`,
      text: raw,
    };
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const text =
      typeof r.text === 'string' && r.text.length > 0
        ? r.text
        : typeof r.questionText === 'string' && r.questionText.length > 0
        ? r.questionText
        : typeof r.questionTemplate === 'string'
        ? r.questionTemplate
        : '';
    const id =
      typeof r.id === 'string' || typeof r.id === 'number'
        ? String(r.id)
        : `q_${fallbackRoundId}`;
    return {
      ...r,
      id,
      text,
    };
  }
  return {
    id: `q_${fallbackRoundId}`,
    text: '',
  };
}

/** 조우 런타임 상태 */
export interface RuntimeEncounter {
  readonly def: AssaultEncounterDef;
  readonly index: number;
  startSeconds: number;
  readyUntilSeconds?: number;
  arrivalSeconds: number;
  deadlineSeconds: number;
  endSeconds: number;
  readonly lateGraceSeconds: number;
  pairJudge?: AssaultPairJudge;
  squatJudge?: AssaultSquatJudge;
  startFired: boolean;
  arrivalFired: boolean;
  deadlineFired: boolean;
  endFired: boolean;
  isResolved: boolean;
}

/** 라운드 컨트롤러 확장 설정 계약 */
export interface AssaultRoundConfig extends AssaultTimingAndBalanceConfig {
  readonly lateGraceMs: number;
  readonly minDuckingDurationMs: number;
  readonly trackingLossGraceSeconds: number;
  readonly simultaneousPunchGraceMs: number;
}

/** 라운드 간 직립 세대 및 복귀 상태 보존 DTO (REC-26) */
export interface AssaultSquatStandState {
  readonly consumedGenerations: readonly number[];
  readonly hasStoodUpSinceLastEvade: boolean;
  readonly currentStandGeneration: number;
}

/** 타임라인 내부 이벤트 */
export type TimelineEventType =
  | 'readable'
  | 'reading_end'
  | 'encounter_start'
  | 'user_input'
  | 'encounter_arrival'
  | 'encounter_deadline'
  | 'encounter_end'
  | 'loop_segment'
  | 'timeline_complete';

export interface PendingInput {
  type: 'punch' | 'squat';
  hand?: 'left' | 'right';
  posture?: AssaultSquatPosture | 'squatting';
  timestampMs: number;
  activeSeconds: number;
  inputId?: string;
  standGeneration?: number;
  squatResult?: AssaultSquatResult;
}

export interface TimelineEvent {
  type: TimelineEventType;
  time: number;
  priority: number;
  encounterIndex?: number;
  input?: PendingInput;
  loopSegment?: AssaultLoopSegmentDef;
  prevLoopSegment?: AssaultLoopSegmentDef;
}

/** 라운드 컨트롤러 생성 옵션 */
export interface AssaultRoundControllerOptions {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly question: AssaultRoundQuestionData | string;
  readonly plan?:
    | AssaultCompiledPlan
    | { readonly encounters: readonly (AssaultEncounterDef | AssaultCompiledEncounter)[] };
  readonly loopPlan?: AssaultLoopRoundPlan;
  readonly onLoopSegmentChange?: (segment: AssaultLoopSegmentDef, prevSegment?: AssaultLoopSegmentDef) => void;
  readonly onRunEnd?: () => void;
  readonly bpm?: number;
  readonly config?: Partial<AssaultRoundConfig>;
  readonly throwDurationSeconds?: number;
  readonly noteAdapter?: AssaultNoteAdapter;
  readonly onTtsSpeak?: (questionText: string) => void;
  readonly onPhaseChange?: (phase: AssaultRoundPhase, prevPhase: AssaultRoundPhase) => void;
  readonly onEncounterStart?: (encounter: AssaultEncounterDef, index: number) => void;
  readonly onEncounterEnd?: (encounter: AssaultEncounterDef, index: number) => void;
  readonly onRoundComplete?: (result: {
    sessionId: SessionId;
    roundId: RoundId;
    success: boolean;
    reason?: string;
  }) => void;
  readonly onSettlementCommand?: (command: AssaultSettlementCommand) => void;
  /** 라운드 요약 확정 시 최대 1회 호출 (REC-11 / #596) */
  readonly onSummaryFinalized?: (summary: AssaultRoundSummaryData) => void;
  /** 이전 라운드로부터 주입받은 스쿼트 직립/세대 소비 상태 (REC-26 / #614) */
  readonly initialSquatStandState?: AssaultSquatStandState;
}

export type { AssaultLoopSquatWindows };
