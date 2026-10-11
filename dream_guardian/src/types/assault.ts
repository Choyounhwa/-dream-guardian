/**
 * assault.ts - 보스 접근전(Boss Assault) 도메인 순수 타입 계약
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §6.1~6.6)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-02 / Issue #504)
 *
 * 절대 규칙:
 * 1. Types 레이어 단일 책임: 순수 타입 계약만 정의한다.
 * 2. 런타임 가드, 프로필 상수, 실행 함수, HP 사본 또는 수치 기본값을 포함하지 않는다.
 * 3. 피해량(damage) 수치는 settlement command에 포함하지 않고 정산기가 balanceProfile을 통해 해석한다.
 * 4. Presentation DTO는 정답 플래그를 노출하지 않는 읽기 전용 스냅샷이다.
 */

// ─── 1. 식별자 (Identifiers - DOC-14 §6.1) ───

/** 세션 식별자 (재시작·모드 전환 구분) */
export type SessionId = string;

/** 라운드 식별자 (문제 하나의 생명주기) */
export type RoundId = string;

/** 보기 쌍 식별자 (좌우 보기 한 쌍) */
export type PairId = string;

/** 공격/조우 식별자 (피해 또는 회피를 정산하는 공격) */
export type AttackId = string;

/** 모션/폴백 단일 입력 식별자 */
export type InputId = string;

/** 규칙 계약 버전 */
export type RulesVersion = string;

/** 프로필 식별자 (타이밍/밸런스/인터랙션/비주얼) */
export type ProfileId = string;

/** 모드 식별자 */
export type AssaultGameMode = 'boss_assault';

// ─── 2. 조우 종류 및 프로필 참조 (DOC-14 §6.5) ───

/** 승인된 조우 종류 */
export type AssaultEncounterKind = 'answer_pair' | 'squat' | 'jump';

/** 정답/선택 방향 */
export type AssaultAnswerSide = 'left' | 'right';

/** 타이밍 프로필 참조 */
export interface AssaultTimingProfileRef {
  readonly profileId: ProfileId;
  readonly rulesVersion: RulesVersion;
}

// ─── 3. 불변 정의 및 세션 계획 (DOC-14 §6.5) ───

/**
 * 단일 조우/공격 불변 정의 (Encounter Definition)
 * 박자는 0-based 상대 비트로 표현한다.
 */
export interface AssaultEncounterDef {
  readonly id: AttackId;
  readonly kind: AssaultEncounterKind;
  readonly startBeat: number;
  readonly durationBeats: number;
  readonly interactionProfileId: ProfileId;
  readonly visualProfileId: ProfileId;
  readonly answerPolicyId?: string;
  readonly pairId?: PairId;
}

/**
 * 불변 세션 실행 계획 (DOC-14 §6.5, §6.6)
 * 컴파일 후 런타임에서 변경되지 않는다.
 */
export interface AssaultSessionPlan {
  readonly schemaVersion: string;
  readonly sessionId: SessionId;
  readonly rulesVersion: RulesVersion;
  readonly timingProfileId: ProfileId;
  readonly balanceProfileId: ProfileId;
  readonly encounters: readonly AssaultEncounterDef[];
}

// ─── 4. 런타임 상태 (DOC-14 §6.2) ───

/** 라운드 생명주기 단계 */
export type AssaultRoundPhase =
  | 'idle'
  | 'ready'
  | 'question_reading'
  | 'choice_window'
  | 'strike_resolve'
  | 'round_clear'
  | 'round_failed';

/**
 * 가변 라운드 런타임 진행 상태
 * 세션 및 라운드 ID는 불변이며, 진행 단계와 누적 판정 ID는 가변이다.
 */
export interface AssaultRoundRuntimeState {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  phase: AssaultRoundPhase;
  currentEncounterIndex: number;
  lockedChoice: AssaultAnswerSide | null;
  negatedAttackIds: readonly AttackId[];
  appliedResultIds: readonly string[];
}

// ─── 5. 판정 및 평가 결과 (DOC-14 §6.2, §6.6) ───

/** 조우 타격/회피 결과 */
export type AssaultHitResult = 'hit' | 'miss' | 'timeout' | 'evaded';

/** 리듬 판정 등급 */
export type AssaultRhythmRating = 'Perfect' | 'Good' | 'Late' | 'Miss';

/**
 * 단일 입력 판정 평가 결과
 */
export interface AssaultHitEvaluation {
  readonly inputId: InputId;
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly attackId: AttackId;
  readonly rating: AssaultRhythmRating;
  readonly hitResult: AssaultHitResult;
  readonly timestampMs: number;
}

// ─── 6. 정산 커맨드 (DOC-14 §6.6 - 피해량 수치 없는 결과 Intent) ───

/** 정산 대상 */
export type AssaultSettlementTarget = 'player' | 'boss';

/** 부작용 효과 유형 */
export type AssaultEffectType =
  | 'player_damage'
  | 'boss_stagger'
  | 'boss_negate'
  | 'evade_success';

/**
 * 정산 명령 (Settlement Command)
 * 피해량 숫자를 직접 담지 않고 정산기가 balanceProfile을 기반으로 안전하게 해석한다.
 */
export interface AssaultSettlementCommand {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly attackId: AttackId;
  readonly target: AssaultSettlementTarget;
  readonly resultKind: AssaultHitResult;
  readonly effectType: AssaultEffectType;
  /** 중복 차단 멱등성 키: (sessionId, attackId, effectType) */
  readonly idempotencyKey: string;
}

// ─── 7. 읽기 전용 표시 DTO (DOC-14 §6.2) ───

/**
 * 렌더러/UI 전용 읽기 전용 표시 스냅샷
 * 정답 여부나 피해 계산 로직을 누출하지 않으며 순수 표시 상태만 담는다.
 */
export interface AssaultPresentationDTO {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly phase: AssaultRoundPhase;
  readonly questionText: string;
  readonly leftChoiceText: string;
  readonly rightChoiceText: string;
  readonly bossScaleProgress: number;
  readonly comboCount: number;
  readonly remainingTimeSeconds: number;
  readonly warningActive: boolean;
}

/** 표시 스냅샷 타입 별칭 */
export type AssaultPresentationSnapshot = AssaultPresentationDTO;
