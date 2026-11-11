/**
 * assault-loop.ts - 보스 접근전 러닝·선택·휴식 루프 도메인 순수 타입 계약
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 * @see docs/assault-loop/LOOP-01.md (ASSAULT-LOOP-01 / Issue #694)
 *
 * 절대 규칙:
 * 1. Types 레이어 단일 책임: 순수 타입 계약만 정의한다.
 * 2. 런타임 가드, 프로필 상수, 실행 함수, 타이머 또는 수치 기본값을 포함하지 않는다.
 * 3. 기존 types/assault.ts의 AssaultEncounterKind / AssaultRoundPhase union 확장은 절대 금지!
 * 4. 박자(beats) 및 초(seconds) 단위를 명확히 명시한다.
 * 5. Presentation 계약은 정답 플래그나 수학적 정오를 노출하지 않는 읽기 전용 실측 스냅샷이다.
 */

import type {
  AttackId,
  PairId,
  ProfileId,
  RulesVersion,
  RoundId,
  AssaultEncounterDef,
  AssaultPresentationDTO,
} from './assault.js';

// ─── 1. 루프 구간 및 서브 구간 종류 ───

/**
 * 루프 구간 종류 (Loop Segment Kind)
 * - run_question: 문제를 읽으며 달리는 첫 구간 (8박)
 * - answer: 인식 및 답을 선택하는 구간 (4박)
 * - rest: 답 선택 직후 무공격·무피해 휴식 구간 (2박)
 * - squat: 휴식 후 별도 삽입되는 스쿼트 회피 구간 (4박)
 */
export type AssaultLoopSegmentKind = 'run_question' | 'answer' | 'rest' | 'squat';

/**
 * 스쿼트 서브 구간 종류 (Squat Sub-Segment Kind)
 * 권장 상세안: 예고(notice 1박) + 회피(dodge 2박) + 직립 복귀(stand 1박) = 총 4박
 */
export type AssaultLoopSquatSubSegmentKind = 'notice' | 'dodge' | 'stand';

/**
 * 스쿼트 삽입 가능 후보 gap 번호 (선택 1~2 사이: 1, 2~3 사이: 2, 3~4 사이: 3)
 */
export type AssaultLoopGapIndex = 1 | 2 | 3;

// ─── 2. 루프 프로필 계약 (Versioned Loop Profile) ───

/**
 * 스쿼트 하위 박자 구성
 */
export interface AssaultLoopSquatSubBeats {
  readonly notice: number;
  readonly dodge: number;
  readonly stand: number;
}

/**
 * 버전 있는 루프 프로필 (AssaultLoopProfile)
 */
export interface AssaultLoopProfile {
  readonly profileId: ProfileId;
  readonly rulesVersion: RulesVersion;
  readonly defaultBpm: number;
  readonly playerMaxHp: number;
  readonly wrongDamage: number;
  readonly missDamage: number;
  readonly squatFailDamage: number;
  readonly targetRounds: number;
  readonly runBeats: number;
  readonly answerBeats: number;
  readonly restBeats: number;
  readonly answerOpportunities: number;
  readonly squatBeats: number;
  readonly squatSubBeats: AssaultLoopSquatSubBeats;
  readonly candidateGaps: readonly number[];
  readonly minSquatsPerRound: number;
  readonly maxSquatsPerRound: number;
  readonly baseBeats: number;
}

// ─── 3. 불변 구간 및 라운드 계획 계약 ───

/**
 * 스쿼트 서브 구간 정의 (Squat Sub-Segment Definition)
 */
export interface AssaultLoopSquatSubSegmentDef {
  readonly kind: AssaultLoopSquatSubSegmentKind;
  readonly startBeat: number;
  readonly durationBeats: number;
  readonly endBeat: number;
  readonly startSeconds: number;
  readonly durationSeconds: number;
  readonly endSeconds: number;
}

/**
 * 조우/공격 참조 정보 (Encounter Reference)
 */
export interface AssaultLoopEncounterRef {
  readonly attackId?: AttackId;
  readonly pairId?: PairId;
  readonly kind?: 'answer_pair' | 'squat';
}

/**
 * 단일 루프 구간 불변 정의 (Loop Segment Definition)
 * 박자(beats) 및 초(seconds) 단위를 명확히 분리하여 표현한다.
 */
export interface AssaultLoopSegmentDef {
  /** 라운드 내 구간 순번 (0-based) */
  readonly segmentIndex: number;
  /** 구간 종류 */
  readonly kind: AssaultLoopSegmentKind;
  /** 시작 박자 (라운드 시작 기준 상대 비트) */
  readonly startBeat: number;
  /** 구간 지속 박자 */
  readonly durationBeats: number;
  /** 종료 박자 (startBeat + durationBeats) */
  readonly endBeat: number;
  /** 시작 시간 (초) */
  readonly startSeconds: number;
  /** 구간 지속 시간 (초) */
  readonly durationSeconds: number;
  /** 종료 시간 (초, startSeconds + durationSeconds) */
  readonly endSeconds: number;
  /** 선택 기회 번호 (answer: 1..4, rest: 1..4, 기타: undefined) */
  readonly opportunityIndex?: number;
  /** 스쿼트 삽입 gap 번호 (1, 2, 3 또는 undefined) */
  readonly gapIndex?: number;
  /** 전투 공격/조우 식별자 참조 */
  readonly attackId?: AttackId;
  /** 보기 쌍 식별자 참조 */
  readonly pairId?: PairId;
  /** 스쿼트 세부 하위 구간 목록 (kind === 'squat'일 때) */
  readonly squatSubSegments?: readonly AssaultLoopSquatSubSegmentDef[];
}

/**
 * 불변 라운드 루프 계획 (AssaultLoopRoundPlan)
 * 정답/오답 여부와 무관하게 사전 확정된 불변 실행 타임라인.
 */
export interface AssaultLoopRoundPlan<TCompiledPlan = unknown> {
  readonly roundId?: RoundId;
  readonly profileId: ProfileId;
  readonly rulesVersion: RulesVersion;
  readonly bpm: number;
  readonly totalBeats: number;
  readonly totalSeconds: number;
  /** 스쿼트가 배치된 gap 번호 목록 (예: [1], [1, 3] 등) */
  readonly squatGapIndices: readonly number[];
  /** 배치된 스쿼트 수 (1 또는 2) */
  readonly squatCount: number;
  /** 전체 순차 루프 구간 목록 */
  readonly segments: readonly AssaultLoopSegmentDef[];
  /** 전투 조우 목록 (answer_pair 4개 + squat 1~2개, run/rest는 포함하지 않음) */
  readonly encounters: readonly AssaultEncounterDef[];
  /** 기존 AssaultCompiledPlan과의 결합 참조 (선택) */
  readonly compiledPlan?: TCompiledPlan;
}

// ─── 4. 읽기 전용 실측 표시 계약 (Loop Presentation) ───

/**
 * 루프 읽기 전용 실측 구간 표시 스냅샷 계약 (AssaultLoopPresentation)
 * UI가 시간이나 랜덤 계획을 직접 계산하지 않도록 Game이 제공하는 순수 표시 상태.
 */
export interface AssaultLoopPresentation {
  /** 현재 활성 구간 순번 (0-based) */
  readonly currentSegmentIndex: number;
  /** 현재 활성 구간 종류 */
  readonly currentSegmentKind: AssaultLoopSegmentKind;
  /** 현재 구간 내 경과 박자 */
  readonly segmentElapsedBeats: number;
  /** 현재 구간 내 잔여 박자 */
  readonly segmentRemainingBeats: number;
  /** 현재 구간 내 경과 시간(초) */
  readonly segmentElapsedSeconds: number;
  /** 현재 구간 내 잔여 시간(초) */
  readonly segmentRemainingSeconds: number;
  /** 현재 선택 기회 (1..4, run_question이나 rest 구간일 때는 0 또는 직전 기회 번호) */
  readonly currentOpportunity: number;
  /** 전체 선택 기회 수 (기본 4) */
  readonly totalOpportunities: number;
  /** 스쿼트 진행 중일 때 하위 구간 ('notice' | 'dodge' | 'stand') */
  readonly currentSquatSubSegment?: AssaultLoopSquatSubSegmentKind;
  /** 현재 정답 선택 입력 허용 여부 (answer 구간에서만 true) */
  readonly canSelectAnswer: boolean;
  /** 현재 휴식 상태 여부 (rest 구간일 때 true) */
  readonly isResting: boolean;
  /** 현재 스쿼트 상태 여부 (squat 구간일 때 true) */
  readonly isSquatActive: boolean;
  /** 화면 안내 문구 힌트 (예: '달리기', '선택', '휴식', '스쿼트 준비' 등) */
  readonly actionPrompt?: string;
}

/**
 * 루프 표시가 독립 필드로 합성된 프레젠테이션 스냅샷 (AssaultPresentationWithLoop)
 * 기존 AssaultPresentationDTO 계약을 오염시키지 않고 확장/합성한다.
 */
export interface AssaultPresentationWithLoop extends AssaultPresentationDTO {
  readonly loop?: AssaultLoopPresentation;
}
