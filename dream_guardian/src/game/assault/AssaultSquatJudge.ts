/**
 * AssaultSquatJudge.ts - 보스 접근전(Boss Assault) 스쿼트 공격 순수 판정 reducer 및 판정기
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§8.2, 9.2, A12, A13, A14)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-13 / Issue #515)
 *
 * 절대 규칙:
 * 1. Game 순수 판정 단일 책임:
 *    - 스쿼트 공격의 판정창(시작 시각~도착/마감 시각)과 #512의 스쿼트 자세 증거(AssaultSquatResult)를
 *      대조하여 회피 성공(evaded) 또는 실패(miss) 및 정산 명령을 산출한다.
 *    - 좌표 임계값 재계산 금지 (#512의 결과 소비).
 * 2. 연속 앉기(Holding) 방지 및 Generation 소비 (A13):
 *    - 첫 번째 스쿼트 공격에서 회피에 성공한 후 직립 복귀 없이 계속 웅크린 상태로 다음 스쿼트 공격을
 *      맞이할 경우 자동 성공하지 않고 실패(miss) 처리한다.
 *    - 이미 사용된 standGeneration은 다음 공격에 재사용할 수 없다.
 * 3. 정산 명령(Settlement Command) 계약 및 멱등성 (DOC-14 §6.6, A12, A14):
 *    - 회피 성공 시: `evade_success` 결과, 플레이어 피해 명령 0건 발행.
 *    - 회피 실패 시(마감까지 안전 자세 없음): `miss`/`player_damage` 정산 명령 1건 발행.
 *    - 동일 attackId에 대해 중복 도착/프레임 유입 시 정산 명령 중복 발행 0회 (멱등성).
 *    - 이전 문제의 오답 피해를 취소하지 않음 (A12).
 * 4. 런타임 부작용 0건:
 *    - HP 직접 변경 0회, DOM/rAF/이펙트 부작용 0회.
 *    - 불변 상태 반환.
 */

import type {
  SessionId,
  RoundId,
  AttackId,
  AssaultHitResult,
  AssaultEffectType,
  AssaultSettlementCommand,
} from '../../types/assault.js';
import type {
  AssaultSquatPosture,
  AssaultSquatResult,
} from '../../motion/AssaultSquatAdapter.js';

// ─── 1. 상태 및 옵션 타입 계약 ───

/** 스쿼트 공격 판정 상태 */
export type AssaultSquatStatus = 'pending' | 'evaded' | 'miss';

/**
 * 스쿼트 공격 실행 계획 DTO
 */
export interface AssaultSquatPlan {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly attackId: AttackId;
  readonly windowStartMs: number;
  readonly arrivalMs: number;
  readonly startBeat?: number;
  readonly durationBeats?: number;
  readonly arrivalBeat?: number;
  readonly windowStartSeconds?: number;
  readonly arrivalSeconds?: number;
  readonly startSeconds?: number;
  readonly durationSeconds?: number;
}

/**
 * 스쿼트 판정기 설정 옵션
 */
export interface AssaultSquatJudgeConfig {
  /** 판정 마감 후행 유예 시간 (ms, 기본 170ms) */
  readonly lateGraceMs?: number;
  /** 최소 스쿼트 유지 시간 (ms, 기본 0ms: 1프레임 이상 안전 자세 만족 시 성공) */
  readonly minDuckingDurationMs?: number;
  /** 회피 성공 시 evade_success 정산 명령 발행 여부 (기본 false: 실패 시에만 player_damage 발행) */
  readonly emitEvadeSuccessCommand?: boolean;
}

/**
 * 스쿼트 판정기 기본 설정 (불변)
 */
export const DEFAULT_SQUAT_JUDGE_CONFIG: Readonly<Required<AssaultSquatJudgeConfig>> = Object.freeze({
  lateGraceMs: 170,
  minDuckingDurationMs: 0,
  emitEvadeSuccessCommand: false,
});

/**
 * 스쿼트 판정 불변 런타임 상태
 */
export interface AssaultSquatState {
  readonly status: AssaultSquatStatus;
  readonly isLocked: boolean;
  readonly isSettled: boolean;
  readonly resultKind: AssaultHitResult | null;
  readonly effectType: AssaultEffectType | null;
  readonly deltaMs: number | null;
  readonly resolvedTimestampMs: number | null;
  readonly duckingStartTimeMs: number | null;
  readonly duckingDurationMs: number;
  readonly consumedGenerations: readonly number[];
  readonly currentStandGeneration: number;
  readonly hasStoodUpSinceLastEvade: boolean;
  readonly lastPosture: AssaultSquatPosture;
  readonly lastEvaluatedResult: AssaultSquatResult | null;
}

/**
 * 스쿼트 판정 액션
 */
export type AssaultSquatAction =
  | { type: 'squat_frame'; result: AssaultSquatResult }
  | { type: 'squat_result'; result: AssaultSquatResult }
  | { type: 'duck'; timestampMs: number; standGeneration?: number; isValid?: boolean }
  | { type: 'stand'; timestampMs: number; standGeneration?: number }
  | { type: 'tick'; timestampMs: number }
  | { type: 'arrival'; timestampMs?: number }
  | { type: 'start_encounter'; plan: AssaultSquatPlan }
  | { type: 'next_encounter'; plan: AssaultSquatPlan }
  | { type: 'cancel' };

/**
 * Reducer 반환 결과
 */
export interface AssaultSquatReducerResult {
  readonly state: AssaultSquatState;
  readonly commands: readonly AssaultSettlementCommand[];
}

// ─── 2. 팩토리 및 헬퍼 함수 ───

/**
 * 불변 초기 상태 생성
 */
export function createInitialSquatState(
  initialOptions?: Partial<AssaultSquatState>
): AssaultSquatState {
  return Object.freeze({
    status: 'pending',
    isLocked: false,
    isSettled: false,
    resultKind: null,
    effectType: null,
    deltaMs: null,
    resolvedTimestampMs: null,
    duckingStartTimeMs: null,
    duckingDurationMs: 0,
    consumedGenerations: Object.freeze(initialOptions?.consumedGenerations ? [...initialOptions.consumedGenerations] : []),
    currentStandGeneration: initialOptions?.currentStandGeneration ?? 0,
    hasStoodUpSinceLastEvade: initialOptions?.hasStoodUpSinceLastEvade ?? true,
    lastPosture: initialOptions?.lastPosture ?? 'unknown',
    lastEvaluatedResult: null,
    ...initialOptions,
  });
}

/**
 * 플레이어 피해 정산 명령 생성
 */
export function createPlayerDamageCommand(
  plan: AssaultSquatPlan,
  resultKind: AssaultHitResult = 'miss'
): AssaultSettlementCommand {
  return Object.freeze({
    sessionId: plan.sessionId,
    roundId: plan.roundId,
    attackId: plan.attackId,
    target: 'player',
    resultKind,
    effectType: 'player_damage',
    idempotencyKey: `${plan.sessionId}:${plan.attackId}:player_damage`,
  });
}

/**
 * 회피 성공 정산 명령 생성
 */
export function createEvadeSuccessCommand(
  plan: AssaultSquatPlan
): AssaultSettlementCommand {
  return Object.freeze({
    sessionId: plan.sessionId,
    roundId: plan.roundId,
    attackId: plan.attackId,
    target: 'player',
    resultKind: 'evaded',
    effectType: 'evade_success',
    idempotencyKey: `${plan.sessionId}:${plan.attackId}:evade_success`,
  });
}

// ─── 3. 순수 Reducer (reduceSquatState) ───

/**
 * 스쿼트 공격 순수 판정 Reducer
 */
export function reduceSquatState(
  state: AssaultSquatState,
  action: AssaultSquatAction,
  plan?: AssaultSquatPlan,
  config?: AssaultSquatJudgeConfig
): AssaultSquatReducerResult {
  const resolvedConfig: Required<AssaultSquatJudgeConfig> = {
    lateGraceMs: config?.lateGraceMs ?? DEFAULT_SQUAT_JUDGE_CONFIG.lateGraceMs,
    minDuckingDurationMs: config?.minDuckingDurationMs ?? DEFAULT_SQUAT_JUDGE_CONFIG.minDuckingDurationMs,
    emitEvadeSuccessCommand: config?.emitEvadeSuccessCommand ?? DEFAULT_SQUAT_JUDGE_CONFIG.emitEvadeSuccessCommand,
  };

  const fallbackPlan: AssaultSquatPlan = {
    sessionId: 'default_session',
    roundId: 'default_round',
    attackId: 'default_squat',
    windowStartMs: 0,
    arrivalMs: 2000,
  };
  const currentPlan = plan ?? fallbackPlan;

  const windowStartMs =
    currentPlan.windowStartMs ??
    (currentPlan.windowStartSeconds !== undefined ? currentPlan.windowStartSeconds * 1000 : 0);

  const arrivalMs =
    currentPlan.arrivalMs ??
    (currentPlan.arrivalSeconds !== undefined
      ? currentPlan.arrivalSeconds * 1000
      : windowStartMs + (currentPlan.durationSeconds !== undefined ? currentPlan.durationSeconds * 1000 : 2000));

  const deadlineMs = arrivalMs + resolvedConfig.lateGraceMs;

  // 1. 공격 전환 액션 (start_encounter / next_encounter)
  if (action.type === 'start_encounter' || action.type === 'next_encounter') {
    const nextState: AssaultSquatState = Object.freeze({
      ...state,
      status: 'pending',
      isLocked: false,
      isSettled: false,
      resultKind: null,
      effectType: null,
      deltaMs: null,
      resolvedTimestampMs: null,
      duckingStartTimeMs: null,
      duckingDurationMs: 0,
      lastEvaluatedResult: null,
    });
    return Object.freeze({
      state: nextState,
      commands: Object.freeze([]),
    });
  }

  // 2. 취소 액션 (cancel)
  if (action.type === 'cancel') {
    if (state.isSettled) {
      return Object.freeze({ state, commands: Object.freeze([]) });
    }
    const cancelledState: AssaultSquatState = Object.freeze({
      ...state,
      status: 'pending',
      isLocked: true,
      isSettled: true,
    });
    return Object.freeze({
      state: cancelledState,
      commands: Object.freeze([]),
    });
  }

  // 3. 시간 흐름 및 마감 액션 (tick / arrival)
  if (action.type === 'tick' || action.type === 'arrival') {
    const currentTimestampMs =
      action.type === 'tick'
        ? action.timestampMs
        : (action.timestampMs ?? arrivalMs);

    // 이미 잠겼거나 정산 완료된 경우: 추가 정산 명령 0건 (멱등성 보장)
    if (state.isSettled || state.status !== 'pending') {
      return Object.freeze({
        state,
        commands: Object.freeze([]),
      });
    }

    // 마감 시각 도달 또는 초과 검증 (마감까지 유효 안전 자세가 없으면 miss 확정)
    // arrival 액션의 경우 지정 시각이 arrivalMs 이상이거나 deadlineMs 도달 시 판정 마감
    const isTimeout =
      action.type === 'arrival'
        ? currentTimestampMs >= arrivalMs
        : currentTimestampMs > deadlineMs;

    if (isTimeout) {
      const missState: AssaultSquatState = Object.freeze({
        ...state,
        status: 'miss',
        isLocked: true,
        isSettled: true,
        resultKind: 'miss',
        effectType: 'player_damage',
        deltaMs: currentTimestampMs - arrivalMs,
        resolvedTimestampMs: currentTimestampMs,
      });

      const damageCmd = createPlayerDamageCommand(currentPlan, 'miss');
      return Object.freeze({
        state: missState,
        commands: Object.freeze([damageCmd]),
      });
    }

    return Object.freeze({
      state,
      commands: Object.freeze([]),
    });
  }

  // 4. 스쿼트 프레임 / 모션 입력 액션 (squat_frame, squat_result, duck, stand)
  let timestampMs = 0;
  let isDucking = false;
  let isStanding = false;
  let isValid = true;
  let standGeneration: number | undefined;
  let posture: AssaultSquatPosture = 'unknown';
  let evaluatedResult: AssaultSquatResult | null = null;

  if (action.type === 'squat_frame' || action.type === 'squat_result') {
    const res = action.result;
    timestampMs = res.timestampMs;
    isDucking = res.isDucking;
    isStanding = res.isStanding;
    isValid = res.isValid !== false;
    standGeneration = res.standGeneration;
    posture = res.posture;
    evaluatedResult = res;
  } else if (action.type === 'duck') {
    timestampMs = action.timestampMs;
    isDucking = true;
    isStanding = false;
    isValid = action.isValid !== false;
    standGeneration = action.standGeneration;
    posture = 'ducking';
  } else if (action.type === 'stand') {
    timestampMs = action.timestampMs;
    isDucking = false;
    isStanding = true;
    isValid = true;
    standGeneration = action.standGeneration;
    posture = 'standing';
  }

  // 직립 복귀 감지 및 플래그 갱신 (A13)
  // 직립이 확인되면 hasStoodUpSinceLastEvade = true 로 전이
  let hasStoodUp = state.hasStoodUpSinceLastEvade;
  let nextStandGeneration = state.currentStandGeneration;

  if (standGeneration !== undefined) {
    nextStandGeneration = standGeneration;
  }

  if (isStanding || posture === 'standing') {
    hasStoodUp = true;
  }

  // 이미 정산 완료된 상태라면 상태 메타데이터만 갱신하고 명령 발행 0건
  if (state.isSettled) {
    const updatedState: AssaultSquatState = Object.freeze({
      ...state,
      hasStoodUpSinceLastEvade: hasStoodUp,
      currentStandGeneration: nextStandGeneration,
      lastPosture: posture,
      lastEvaluatedResult: evaluatedResult ?? state.lastEvaluatedResult,
    });
    return Object.freeze({
      state: updatedState,
      commands: Object.freeze([]),
    });
  }

  // 유효한 안전 자세(ducking)가 아닌 경우: 자세 상태만 업데이트하고 대기
  if (!isDucking || !isValid) {
    const updatedState: AssaultSquatState = Object.freeze({
      ...state,
      hasStoodUpSinceLastEvade: hasStoodUp,
      currentStandGeneration: nextStandGeneration,
      lastPosture: posture,
      lastEvaluatedResult: evaluatedResult ?? state.lastEvaluatedResult,
    });
    return Object.freeze({
      state: updatedState,
      commands: Object.freeze([]),
    });
  }

  // ─── 연속 앉기(Holding) 방지 및 Generation 소비 검증 (A12, A13) ───
  // 1) 직전 회피 이후 직립 복귀를 한 번도 하지 않은 채 계속 앉아있는 경우
  // 2) 이미 이전 공격에서 소비된 standGeneration인 경우
  const isGenerationAlreadyConsumed =
    standGeneration !== undefined && state.consumedGenerations.includes(standGeneration);

  if (!hasStoodUp || isGenerationAlreadyConsumed) {
    // 연속 앉기는 자동 성공을 거부하고 pending 유지 (창 마감 시 miss 처리 유도)
    const holdState: AssaultSquatState = Object.freeze({
      ...state,
      hasStoodUpSinceLastEvade: false,
      currentStandGeneration: nextStandGeneration,
      lastPosture: posture,
      lastEvaluatedResult: evaluatedResult ?? state.lastEvaluatedResult,
    });
    return Object.freeze({
      state: holdState,
      commands: Object.freeze([]),
    });
  }

  // ─── 판정창(Window) 경계값 대조 ───
  // A08: 마감 시각과 동일한 입력(t === deadlineMs)은 유효 입력 우선 처리
  if (timestampMs < windowStartMs) {
    // 창 시작 전 조기 스쿼트: 창 진입 전이므로 성공 잠금하지 않고 상태만 기록
    const earlyState: AssaultSquatState = Object.freeze({
      ...state,
      duckingStartTimeMs: state.duckingStartTimeMs ?? timestampMs,
      hasStoodUpSinceLastEvade: hasStoodUp,
      currentStandGeneration: nextStandGeneration,
      lastPosture: posture,
      lastEvaluatedResult: evaluatedResult ?? state.lastEvaluatedResult,
    });
    return Object.freeze({
      state: earlyState,
      commands: Object.freeze([]),
    });
  }

  if (timestampMs > deadlineMs) {
    // 마감 시각 초과 스쿼트: 늦은 입력으로 판정 실패(miss) 확정
    const lateState: AssaultSquatState = Object.freeze({
      ...state,
      status: 'miss',
      isLocked: true,
      isSettled: true,
      resultKind: 'miss',
      effectType: 'player_damage',
      deltaMs: timestampMs - arrivalMs,
      resolvedTimestampMs: timestampMs,
      hasStoodUpSinceLastEvade: false,
      currentStandGeneration: nextStandGeneration,
      lastPosture: posture,
      lastEvaluatedResult: evaluatedResult ?? state.lastEvaluatedResult,
    });
    const damageCmd = createPlayerDamageCommand(currentPlan, 'miss');
    return Object.freeze({
      state: lateState,
      commands: Object.freeze([damageCmd]),
    });
  }

  // 판정창 내부 유효 스쿼트: 회피 성공(evaded) 확정!
  const targetGeneration = standGeneration !== undefined ? standGeneration : nextStandGeneration;
  const newConsumedGenerations = state.consumedGenerations.includes(targetGeneration)
    ? state.consumedGenerations
    : Object.freeze([...state.consumedGenerations, targetGeneration]);

  const evadedState: AssaultSquatState = Object.freeze({
    ...state,
    status: 'evaded',
    isLocked: true,
    isSettled: true,
    resultKind: 'evaded',
    effectType: 'evade_success',
    deltaMs: timestampMs - arrivalMs,
    resolvedTimestampMs: timestampMs,
    duckingStartTimeMs: state.duckingStartTimeMs ?? timestampMs,
    duckingDurationMs: (state.duckingStartTimeMs !== null) ? timestampMs - state.duckingStartTimeMs : 0,
    consumedGenerations: newConsumedGenerations,
    currentStandGeneration: nextStandGeneration,
    hasStoodUpSinceLastEvade: false, // 다음 공격을 위해 직립 복귀 필요
    lastPosture: posture,
    lastEvaluatedResult: evaluatedResult ?? state.lastEvaluatedResult,
  });

  const commands = resolvedConfig.emitEvadeSuccessCommand
    ? Object.freeze([createEvadeSuccessCommand(currentPlan)])
    : Object.freeze([]);

  return Object.freeze({
    state: evadedState,
    commands,
  });
}

// ─── 4. 편의 래퍼 클래스 (AssaultSquatJudge) ───

/**
 * 스쿼트 공격 판정기 편의 클래스
 */
export class AssaultSquatJudge {
  private _state: AssaultSquatState;
  private _plan: AssaultSquatPlan;
  private readonly _config: Required<AssaultSquatJudgeConfig>;

  constructor(
    plan: AssaultSquatPlan,
    config?: AssaultSquatJudgeConfig,
    initialOptions?: Partial<AssaultSquatState>
  ) {
    this._plan = plan;
    this._config = Object.freeze({
      lateGraceMs: config?.lateGraceMs ?? DEFAULT_SQUAT_JUDGE_CONFIG.lateGraceMs,
      minDuckingDurationMs: config?.minDuckingDurationMs ?? DEFAULT_SQUAT_JUDGE_CONFIG.minDuckingDurationMs,
      emitEvadeSuccessCommand: config?.emitEvadeSuccessCommand ?? DEFAULT_SQUAT_JUDGE_CONFIG.emitEvadeSuccessCommand,
    });
    this._state = createInitialSquatState(initialOptions);
  }

  get state(): AssaultSquatState {
    return this._state;
  }

  get plan(): AssaultSquatPlan {
    return this._plan;
  }

  get config(): Required<AssaultSquatJudgeConfig> {
    return this._config;
  }

  /**
   * 새 공격 계획 설정 (직립 복귀 및 세션 히스토리 보존)
   */
  setPlan(newPlan: AssaultSquatPlan): void {
    this._plan = newPlan;
    const res = reduceSquatState(this._state, { type: 'next_encounter', plan: newPlan }, this._plan, this._config);
    this._state = res.state;
  }

  /**
   * 스쿼트 모션 결과 주입 및 판정
   */
  feed(result: AssaultSquatResult): readonly AssaultSettlementCommand[] {
    const res = reduceSquatState(this._state, { type: 'squat_frame', result }, this._plan, this._config);
    this._state = res.state;
    return res.commands;
  }

  /**
   * 게임 루프 틱 갱신
   */
  tick(timestampMs: number): readonly AssaultSettlementCommand[] {
    const res = reduceSquatState(this._state, { type: 'tick', timestampMs }, this._plan, this._config);
    this._state = res.state;
    return res.commands;
  }

  /**
   * 공격 도착 시각 호출
   */
  arrival(timestampMs?: number): readonly AssaultSettlementCommand[] {
    const res = reduceSquatState(this._state, { type: 'arrival', timestampMs }, this._plan, this._config);
    this._state = res.state;
    return res.commands;
  }

  /**
   * 임의 액션 디스패치
   */
  dispatch(action: AssaultSquatAction): readonly AssaultSettlementCommand[] {
    const res = reduceSquatState(this._state, action, this._plan, this._config);
    this._state = res.state;
    return res.commands;
  }

  /**
   * 판정기 리셋
   */
  reset(plan?: AssaultSquatPlan): void {
    if (plan) {
      this._plan = plan;
    }
    this._state = createInitialSquatState({
      consumedGenerations: this._state.consumedGenerations,
      hasStoodUpSinceLastEvade: this._state.hasStoodUpSinceLastEvade,
      currentStandGeneration: this._state.currentStandGeneration,
    });
  }
}
