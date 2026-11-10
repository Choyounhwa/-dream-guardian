/**
 * AssaultPairJudge.ts - 보스 접근전(Boss Assault) 답 쌍 순수 판정 reducer
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.6, 7.1, 8.1, 15.1-A4, 15.2-B6)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-12 / Issue #514)
 *
 * 절대 규칙:
 * 1. Game 순수 판정 단일 책임: 하나의 논리 답 쌍(left/right) 조우에서 선택, 잠금, 무효화(취소), 만료(timeout)를
 *    순수 함수(Reducer) 및 불변 상태 전이로 판정한다.
 * 2. 런타임 부작용 0건:
 *    - HP 직접 변경 0회 (피해량 숫자는 일체 포함하지 않고 정산 명령만 발행).
 *    - requestAnimationFrame, setInterval, setTimeout 등 타이머 호출 0회.
 *    - DOM, Canvas, Audio, localStorage, 네트워크 호출 0회.
 * 3. 불변성(Immutability):
 *    - 입력 state, action, config, plan은 절대 변경되지 않는다.
 *    - 반환하는 state와 commands는 Object.freeze를 통해 동결된다.
 * 4. DEC-A4 손-답 매핑:
 *    - 같은 쪽 손만 해당 쪽 답 선택 유효 (왼손 펀치→left, 오른손 펀치→right).
 *    - 매핑 위반(교차 타격) 입력은 무시한다.
 * 5. 판정 마감 및 우선순위 (A08):
 *    - 판정 마감 시각 = arrivalMs + lateGraceMs (기본 170ms).
 *    - 마감 시각과 동일한 입력(t == deadline)은 만료보다 입력을 우선 처리한다.
 * 6. 수학적 정오와 리듬 등급 분리:
 *    - 유효 시간 내 정답이면 리듬 등급이 Late라도 정답(correct/boss_negate)으로 처리한다.
 * 7. 양손 동시 타격(A10):
 *    - 충돌 허용차 이내 동시 유입 시 선택을 잠그지 않고 보류(conflict), 남은 시간 내 재시도를 허용한다.
 * 8. inputId 멱등성:
 *    - 동일 inputId의 중복 유입은 무시한다.
 */

import type {
  SessionId,
  RoundId,
  AttackId,
  PairId,
  InputId,
  AssaultAnswerSide,
  AssaultRhythmRating,
  AssaultSettlementCommand,
} from '../../types/assault.js';
import type { AssaultHand } from '../../input/AssaultPunchAdapter.js';

// ─── 1. 상태 및 옵션 타입 계약 ───

/** 답 쌍 진행 상태 */
export type AssaultPairStatus =
  | 'pending'
  | 'correct'
  | 'wrong_locked'
  | 'timeout'
  | 'cancelled';

/** 답 쌍 불변 런타임 상태 */
export interface AssaultPairState {
  readonly status: AssaultPairStatus;
  readonly lockedChoice: AssaultAnswerSide | null;
  readonly isLocked: boolean;
  readonly isCorrect: boolean | null;
  readonly rhythmRating: AssaultRhythmRating | null;
  readonly deltaMs: number | null;
  readonly resolvedTimestampMs: number | null;
  readonly inputId: InputId | null;
  readonly processedInputIds: readonly InputId[];
  readonly conflictCount: number;
  readonly lastConflictTimestampMs: number | null;
  readonly isSettled: boolean;
}

/** 답 쌍 실행 계획 (불변) */
export interface AssaultPairPlan {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly attackId: AttackId;
  readonly pairId?: PairId;
  readonly correctSide: AssaultAnswerSide;
  readonly arrivalMs: number;
  readonly windowStartMs?: number;
  readonly arrivalBeat?: number;
}

/** 답 쌍 판정 설정 */
export interface AssaultPairJudgeConfig {
  /** 판정 마감 유예창 (기본값: 170ms, DEC-B6) */
  readonly lateGraceMs?: number;
  /** 리듬 판정 등급 유예창 (ms) */
  readonly rhythmWindows?: {
    readonly Perfect: number;
    readonly Good: number;
    readonly Late: number;
  };
  /** 양손 동시 타격 충돌 허용차 (ms, 기본값: 50ms) */
  readonly simultaneousToleranceMs?: number;
}

/** 기본 표준 설정값 */
export const DEFAULT_PAIR_JUDGE_CONFIG: Required<AssaultPairJudgeConfig> = Object.freeze({
  lateGraceMs: 170,
  rhythmWindows: Object.freeze({
    Perfect: 50,
    Good: 120,
    Late: 200,
  }),
  simultaneousToleranceMs: 50,
});

// ─── 2. 액션 타입 계약 ───

export interface AssaultPunchActionInput {
  readonly hand: AssaultHand;
  readonly targetSide?: AssaultHand;
  readonly timestampMs: number;
  readonly inputId: InputId;
}

export interface AssaultPunchAction extends AssaultPunchActionInput {
  readonly type: 'punch';
}

export interface AssaultPunchBatchAction {
  readonly type: 'punch_batch';
  readonly punches: readonly AssaultPunchActionInput[];
}

export interface AssaultSimultaneousPunchesAction {
  readonly type: 'simultaneous_punches';
  readonly punches: readonly AssaultPunchActionInput[];
}

export interface AssaultTickAction {
  readonly type: 'tick';
  readonly timestampMs: number;
}

export interface AssaultArrivalAction {
  readonly type: 'arrival';
  readonly timestampMs?: number;
}

export type AssaultPairAction =
  | AssaultPunchAction
  | AssaultPunchBatchAction
  | AssaultSimultaneousPunchesAction
  | AssaultTickAction
  | AssaultArrivalAction;

/** Reducer 반환 결과 */
export interface AssaultPairReductionResult {
  readonly state: AssaultPairState;
  readonly commands: readonly AssaultSettlementCommand[];
}

// ─── 3. 내부 헬퍼 ───

/** 초기 상태 생성 */
export function createInitialPairState(): AssaultPairState {
  return Object.freeze({
    status: 'pending',
    lockedChoice: null,
    isLocked: false,
    isCorrect: null,
    rhythmRating: null,
    deltaMs: null,
    resolvedTimestampMs: null,
    inputId: null,
    processedInputIds: Object.freeze([]),
    conflictCount: 0,
    lastConflictTimestampMs: null,
    isSettled: false,
  });
}

function resolvePairJudgeConfig(
  config?: AssaultPairJudgeConfig
): Required<AssaultPairJudgeConfig> {
  if (!config) {
    return DEFAULT_PAIR_JUDGE_CONFIG;
  }
  return Object.freeze({
    lateGraceMs: config.lateGraceMs ?? DEFAULT_PAIR_JUDGE_CONFIG.lateGraceMs,
    rhythmWindows: Object.freeze({
      Perfect:
        config.rhythmWindows?.Perfect ?? DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.Perfect,
      Good: config.rhythmWindows?.Good ?? DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.Good,
      Late: config.rhythmWindows?.Late ?? DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.Late,
    }),
    simultaneousToleranceMs:
      config.simultaneousToleranceMs ?? DEFAULT_PAIR_JUDGE_CONFIG.simultaneousToleranceMs,
  });
}

function createBossNegateCommand(plan: AssaultPairPlan): AssaultSettlementCommand {
  return Object.freeze({
    sessionId: plan.sessionId,
    roundId: plan.roundId,
    attackId: plan.attackId,
    target: 'boss',
    resultKind: 'hit',
    effectType: 'boss_negate',
    idempotencyKey: `${plan.sessionId}:${plan.attackId}:boss_negate`,
  });
}

function createPlayerDamageCommand(
  plan: AssaultPairPlan,
  resultKind: 'miss' | 'timeout'
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

function calculateRhythmRating(
  deltaMs: number,
  rhythmWindows: { readonly Perfect: number; readonly Good: number; readonly Late: number }
): AssaultRhythmRating {
  const absDelta = Math.abs(deltaMs);
  if (absDelta <= rhythmWindows.Perfect) {
    return 'Perfect';
  }
  if (absDelta <= rhythmWindows.Good) {
    return 'Good';
  }
  return 'Late';
}

// ─── 4. 순수 판정 Reducer (reducePairState) ───

/**
 * 하나의 답 쌍 상태를 액션에 따라 전이하고 정산 명령을 반환하는 순수 Reducer
 */
export function reducePairState(
  state: AssaultPairState,
  action: AssaultPairAction,
  config?: AssaultPairJudgeConfig,
  plan?: AssaultPairPlan
): AssaultPairReductionResult {
  const resolvedConfig = resolvePairJudgeConfig(config);

  const fallbackPlan: AssaultPairPlan = {
    sessionId: 'session_unknown',
    roundId: 'round_unknown',
    attackId: 'attack_unknown',
    correctSide: 'left',
    arrivalMs: 2000,
    windowStartMs: 0,
  };
  const currentPlan = plan ?? fallbackPlan;
  const deadlineMs = currentPlan.arrivalMs + resolvedConfig.lateGraceMs;

  // 1. tick / arrival 액션 처리
  if (action.type === 'tick' || action.type === 'arrival') {
    const currentTimestampMs =
      action.type === 'tick'
        ? action.timestampMs
        : (action.timestampMs ?? currentPlan.arrivalMs);

    // 이미 잠겼거나 정산 완료된 경우: 추가 정산 명령 0건
    if (state.isLocked || state.status !== 'pending') {
      return Object.freeze({
        state,
        commands: Object.freeze([]),
      });
    }

    // 마감 시각 초과 검증 (deadline 초과 시 미선택 timeout 확정, A07)
    if (currentTimestampMs > deadlineMs) {
      const nextState: AssaultPairState = Object.freeze({
        ...state,
        status: 'timeout',
        isLocked: true,
        isCorrect: false,
        rhythmRating: 'Miss',
        deltaMs: currentTimestampMs - currentPlan.arrivalMs,
        resolvedTimestampMs: currentTimestampMs,
        isSettled: true,
      });

      const damageCmd = createPlayerDamageCommand(currentPlan, 'timeout');
      return Object.freeze({
        state: nextState,
        commands: Object.freeze([damageCmd]),
      });
    }

    // 아직 마감 전이면 상태 유지
    return Object.freeze({
      state,
      commands: Object.freeze([]),
    });
  }

  // 2. 동시 펀치 배치 (punch_batch / simultaneous_punches) 처리 (A10)
  if (action.type === 'punch_batch' || action.type === 'simultaneous_punches') {
    const rawPunches = action.punches;
    if (!rawPunches || rawPunches.length === 0) {
      return Object.freeze({ state, commands: Object.freeze([]) });
    }

    // 이미 처리된 inputId 제외
    const freshPunches = rawPunches.filter(
      (p) => !state.processedInputIds.includes(p.inputId)
    );
    if (freshPunches.length === 0) {
      return Object.freeze({ state, commands: Object.freeze([]) });
    }

    const updatedProcessedIds = Object.freeze([
      ...state.processedInputIds,
      ...freshPunches.map((p) => p.inputId),
    ]);

    // 이미 잠긴 상태라면 입력 기록만 갱신
    if (state.isLocked) {
      return Object.freeze({
        state: Object.freeze({
          ...state,
          processedInputIds: updatedProcessedIds,
        }),
        commands: Object.freeze([]),
      });
    }

    // 배치 내 양손 동시 타격(left & right) 충돌 확인
    const leftPunches = freshPunches.filter((p) => p.hand === 'left');
    const rightPunches = freshPunches.filter((p) => p.hand === 'right');

    if (leftPunches.length > 0 && rightPunches.length > 0) {
      const leftTime = leftPunches[0].timestampMs;
      const rightTime = rightPunches[0].timestampMs;
      if (
        Math.abs(leftTime - rightTime) <= resolvedConfig.simultaneousToleranceMs
      ) {
        // 동시 타격 충돌: 잠그지 않고 보류 (conflict)
        const conflictState: AssaultPairState = Object.freeze({
          ...state,
          conflictCount: state.conflictCount + 1,
          lastConflictTimestampMs: Math.min(leftTime, rightTime),
          processedInputIds: updatedProcessedIds,
        });
        return Object.freeze({
          state: conflictState,
          commands: Object.freeze([]),
        });
      }
    }

    // 한쪽 손만 유효한 경우 첫 번째 펀치로 단일 처리
    return reducePairState(
      Object.freeze({
        ...state,
        processedInputIds: updatedProcessedIds,
      }),
      {
        type: 'punch',
        ...freshPunches[0],
      },
      resolvedConfig,
      currentPlan
    );
  }

  // 3. 단일 펀치 (punch) 액션 처리
  if (action.type === 'punch') {
    const punch = action;

    // inputId 멱등성 검증 (중복 처리 거부)
    if (state.processedInputIds.includes(punch.inputId)) {
      return Object.freeze({
        state,
        commands: Object.freeze([]),
      });
    }

  const newProcessedInputIds = Object.freeze([
    ...state.processedInputIds,
    punch.inputId,
  ]);

  // 순차 유입 중 동시 타격 허용차(simultaneousToleranceMs) 이내 반대 손 유입 시 충돌 판정 및 잠금 롤백 (A10)
  if (
    state.isLocked &&
    state.resolvedTimestampMs !== null &&
    state.lockedChoice !== null &&
    punch.hand !== state.lockedChoice &&
    Math.abs(punch.timestampMs - state.resolvedTimestampMs) <=
      resolvedConfig.simultaneousToleranceMs &&
    state.status !== 'timeout'
  ) {
    const rolledBackState: AssaultPairState = Object.freeze({
      ...state,
      status: 'pending',
      lockedChoice: null,
      isLocked: false,
      isCorrect: null,
      rhythmRating: null,
      deltaMs: null,
      resolvedTimestampMs: null,
      inputId: null,
      conflictCount: state.conflictCount + 1,
      lastConflictTimestampMs: punch.timestampMs,
      isSettled: false,
      processedInputIds: newProcessedInputIds,
    });
    return Object.freeze({
      state: rolledBackState,
      commands: Object.freeze([]),
    });
  }

  // 이미 잠긴 상태에서 추가 입력(반대손 재타격 등)은 무시 (A06)
  if (state.isLocked) {
    return Object.freeze({
      state: Object.freeze({
        ...state,
        processedInputIds: newProcessedInputIds,
      }),
      commands: Object.freeze([]),
    });
  }

  // 마감 초과 검증 (deadline = arrivalMs + lateGraceMs)
  // A08: 마감 시각과 동일한 입력(t === deadlineMs)은 만료보다 입력을 우선 처리
  if (punch.timestampMs > deadlineMs) {
    const timeoutState: AssaultPairState = Object.freeze({
      ...state,
      status: 'timeout',
      lockedChoice: null,
      isLocked: true,
      isCorrect: false,
      rhythmRating: 'Miss',
      deltaMs: punch.timestampMs - currentPlan.arrivalMs,
      resolvedTimestampMs: punch.timestampMs,
      processedInputIds: newProcessedInputIds,
      isSettled: true,
    });
    const damageCmd = createPlayerDamageCommand(currentPlan, 'timeout');
    return Object.freeze({
      state: timeoutState,
      commands: Object.freeze([damageCmd]),
    });
  }

  // DEC-A4: 같은 쪽 손만 유효 (왼손→left, 오른손→right)
  const targetSide: AssaultHand = punch.targetSide ?? punch.hand;
  if (punch.hand !== targetSide) {
    // 교차 타격 매핑 위반: 입력 무시
    return Object.freeze({
      state: Object.freeze({
        ...state,
        processedInputIds: newProcessedInputIds,
      }),
      commands: Object.freeze([]),
    });
  }

  const chosenSide: AssaultAnswerSide = punch.hand;
  const isCorrect = chosenSide === currentPlan.correctSide;
  const deltaMs = punch.timestampMs - currentPlan.arrivalMs;
  const rhythmRating = calculateRhythmRating(deltaMs, resolvedConfig.rhythmWindows);

  if (isCorrect) {
    // 정답 선택 시: correct 잠금, boss_negate 1건, 플레이어 피해 0건 (A05)
    const nextState: AssaultPairState = Object.freeze({
      ...state,
      status: 'correct',
      lockedChoice: chosenSide,
      isLocked: true,
      isCorrect: true,
      rhythmRating,
      deltaMs,
      resolvedTimestampMs: punch.timestampMs,
      inputId: punch.inputId,
      processedInputIds: newProcessedInputIds,
      isSettled: true,
    });
    const bossCmd = createBossNegateCommand(currentPlan);
    return Object.freeze({
      state: nextState,
      commands: Object.freeze([bossCmd]),
    });
  } else {
    // 오답 선택 시: wrong_locked 잠금, player_damage 1건 (A06)
    const nextState: AssaultPairState = Object.freeze({
      ...state,
      status: 'wrong_locked',
      lockedChoice: chosenSide,
      isLocked: true,
      isCorrect: false,
      rhythmRating,
      deltaMs,
      resolvedTimestampMs: punch.timestampMs,
      inputId: punch.inputId,
      processedInputIds: newProcessedInputIds,
      isSettled: true,
    });
    const damageCmd = createPlayerDamageCommand(currentPlan, 'miss');
    return Object.freeze({
      state: nextState,
      commands: Object.freeze([damageCmd]),
    });
  }
  }

  return Object.freeze({
    state,
    commands: Object.freeze([]),
  });
}

// ─── 5. AssaultPairJudge 클래스 ───

/**
 * 순수 reducer를 감싸 단일 답 쌍의 라이프사이클을 관리하는 편의 클래스
 */
export class AssaultPairJudge {
  private _state: AssaultPairState;
  private readonly _config: Required<AssaultPairJudgeConfig>;
  private readonly _plan: AssaultPairPlan;

  constructor(
    plan: AssaultPairPlan,
    config?: AssaultPairJudgeConfig,
    initialState?: AssaultPairState
  ) {
    this._plan = Object.freeze({ ...plan });
    this._config = resolvePairJudgeConfig(config);
    this._state = initialState ?? createInitialPairState();
  }

  get state(): AssaultPairState {
    return this._state;
  }

  get plan(): AssaultPairPlan {
    return this._plan;
  }

  get config(): Required<AssaultPairJudgeConfig> {
    return this._config;
  }

  dispatch(action: AssaultPairAction): readonly AssaultSettlementCommand[] {
    const result = reducePairState(this._state, action, this._config, this._plan);
    this._state = result.state;
    return result.commands;
  }

  punch(action: Omit<AssaultPunchAction, 'type'>): readonly AssaultSettlementCommand[] {
    return this.dispatch({
      type: 'punch',
      ...action,
    });
  }

  tick(timestampMs: number): readonly AssaultSettlementCommand[] {
    return this.dispatch({
      type: 'tick',
      timestampMs,
    });
  }
}
