import { describe, it, expect } from 'vitest';
import {
  reducePairState,
  createInitialPairState,
  AssaultPairJudge,
  DEFAULT_PAIR_JUDGE_CONFIG,
  type AssaultPairState,
  type AssaultPairPlan,
  type AssaultPairAction,
  type AssaultPairJudgeConfig,
} from '../../src/game/assault/AssaultPairJudge.js';

describe('[BOSS-ASSAULT-12 / #514] 답 쌍 순수 판정 reducer (AssaultPairJudge)', () => {
  const defaultPlan: AssaultPairPlan = Object.freeze({
    sessionId: 'session_test_01',
    roundId: 'round_test_01',
    attackId: 'attack_pair_01',
    pairId: 'pair_test_01',
    correctSide: 'left',
    arrivalMs: 2000,
    windowStartMs: 0,
  });

  const customConfig: AssaultPairJudgeConfig = Object.freeze({
    lateGraceMs: 170,
    rhythmWindows: {
      Perfect: 50,
      Good: 120,
      Late: 200,
    },
    simultaneousToleranceMs: 50,
  });

  describe('1. 순수 함수 / Reducer 기본 계약 및 불변성 보장', () => {
    it('DEFAULT_PAIR_JUDGE_CONFIG는 올바른 기본값(lateGraceMs=170, simultaneousToleranceMs=50)을 가져야 한다', () => {
      expect(DEFAULT_PAIR_JUDGE_CONFIG.lateGraceMs).toBe(170);
      expect(DEFAULT_PAIR_JUDGE_CONFIG.simultaneousToleranceMs).toBe(50);
      expect(DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.Perfect).toBe(50);
      expect(DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.Good).toBe(120);
      expect(DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.Late).toBe(170);
      expect(DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.EarlyMiss).toBe(170);
      expect(Object.isFrozen(DEFAULT_PAIR_JUDGE_CONFIG)).toBe(true);
    });

    it('createInitialPairState()는 pending 상태의 불변 초기 상태를 반환해야 한다', () => {
      const state: AssaultPairState = createInitialPairState();
      expect(state.status).toBe('pending');
      expect(state.lockedChoice).toBeNull();
      expect(state.isLocked).toBe(false);
      expect(state.isCorrect).toBeNull();
      expect(state.rhythmRating).toBeNull();
      expect(state.isSettled).toBe(false);
      expect(state.processedInputIds).toEqual([]);
      expect(Object.isFrozen(state)).toBe(true);
    });

    it('reducePairState()는 원본 state와 plan을 변경하지 않고 새 상태 객체를 반환해야 한다 (순수 함수)', () => {
      const initialState = createInitialPairState();
      const planClone = { ...defaultPlan };

      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1980,
        inputId: 'punch_left_01',
      };

      const result = reducePairState(initialState, action, customConfig, defaultPlan);

      expect(result.state).not.toBe(initialState);
      expect(initialState.status).toBe('pending');
      expect(initialState.lockedChoice).toBeNull();
      expect(defaultPlan).toEqual(planClone);
      expect(Object.isFrozen(result.state)).toBe(true);
      expect(Object.isFrozen(result.commands)).toBe(true);
    });
  });

  describe('2. DEC-A4 손-답 매핑 판정 (같은 쪽 손만 유효, 매핑 위반 무시)', () => {
    it('왼손 펀치는 left를 선택하고 오른손 펀치는 right를 선택해야 한다', () => {
      const initialState = createInitialPairState();
      const leftAction: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1950,
        inputId: 'punch_l1',
      };

      const resLeft = reducePairState(initialState, leftAction, customConfig, defaultPlan);
      expect(resLeft.state.lockedChoice).toBe('left');

      const rightAction: AssaultPairAction = {
        type: 'punch',
        hand: 'right',
        timestampMs: 1950,
        inputId: 'punch_r1',
      };

      const resRight = reducePairState(initialState, rightAction, customConfig, defaultPlan);
      expect(resRight.state.lockedChoice).toBe('right');
    });

    it('매핑 위반(왼손으로 right 타격 또는 오른손으로 left 타격) 입력은 무시해야 한다', () => {
      const initialState = createInitialPairState();
      const crossAction: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        targetSide: 'right', // 위반!
        timestampMs: 1950,
        inputId: 'punch_cross_01',
      };

      const result = reducePairState(initialState, crossAction, customConfig, defaultPlan);
      expect(result.state.status).toBe('pending');
      expect(result.state.lockedChoice).toBeNull();
      expect(result.state.isLocked).toBe(false);
      expect(result.commands).toHaveLength(0);
    });
  });

  describe('3. 정답 선택 시 잠금 및 보스 공격 무효화 (A05)', () => {
    it('정답 side를 타격하면 correct로 잠기고 boss_negate 명령 1건 및 플레이어 피해 0건을 반환해야 한다', () => {
      const initialState = createInitialPairState();
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1990,
        inputId: 'punch_correct_01',
      };

      const result = reducePairState(initialState, action, customConfig, defaultPlan);

      expect(result.state.status).toBe('correct');
      expect(result.state.lockedChoice).toBe('left');
      expect(result.state.isCorrect).toBe(true);
      expect(result.state.isLocked).toBe(true);
      expect(result.state.isSettled).toBe(true);

      // 명령 검증: boss_negate 1건, 플레이어 피해 0건
      expect(result.commands).toHaveLength(1);
      const cmd = result.commands[0];
      expect(cmd.target).toBe('boss');
      expect(cmd.resultKind).toBe('hit');
      expect(cmd.effectType).toBe('boss_negate');
      expect(cmd.sessionId).toBe(defaultPlan.sessionId);
      expect(cmd.roundId).toBe(defaultPlan.roundId);
      expect(cmd.attackId).toBe(defaultPlan.attackId);
      expect(cmd.idempotencyKey).toBe(`${defaultPlan.sessionId}:${defaultPlan.attackId}:boss_negate`);
    });

    it('정답 잠금 후 추가 입력(반대 손 또는 동일 손)은 잠금을 변경하지 않고 명령 0건이어야 한다', () => {
      const initialState = createInitialPairState();
      const firstPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1990,
        inputId: 'punch_c1',
      };

      const lockedRes = reducePairState(initialState, firstPunch, customConfig, defaultPlan);

      const secondPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'right',
        timestampMs: 2060, // 70ms 후 (simultaneousToleranceMs 50ms 초과)
        inputId: 'punch_r_after_lock',
      };

      const secondRes = reducePairState(lockedRes.state, secondPunch, customConfig, defaultPlan);
      expect(secondRes.state.status).toBe('correct');
      expect(secondRes.state.lockedChoice).toBe('left');
      expect(secondRes.commands).toHaveLength(0);
    });

    it('정답 확정 후 탄환 도착 시각(arrivalMs) 및 지연 마감(deadline)에 도달해도 플레이어 피해 정산 요청은 0건이어야 한다 (A05 취소 후 지연 도착)', () => {
      const initialState = createInitialPairState();
      const punchAction: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1900,
        inputId: 'punch_c_early',
      };

      const lockedRes = reducePairState(initialState, punchAction, customConfig, defaultPlan);

      // arrival 시각 tick
      const arrivalTick: AssaultPairAction = {
        type: 'tick',
        timestampMs: 2000,
      };
      const arrivalRes = reducePairState(lockedRes.state, arrivalTick, customConfig, defaultPlan);
      expect(arrivalRes.state.status).toBe('correct');
      expect(arrivalRes.commands).toHaveLength(0);

      // 마감 초과(지연 도착) tick
      const lateArrivalTick: AssaultPairAction = {
        type: 'tick',
        timestampMs: 2500,
      };
      const lateArrivalRes = reducePairState(arrivalRes.state, lateArrivalTick, customConfig, defaultPlan);
      expect(lateArrivalRes.state.status).toBe('correct');
      expect(lateArrivalRes.commands).toHaveLength(0);
    });
  });

  describe('4. 오답 선택 시 잠금 및 플레이어 피해 정산 (A06)', () => {
    it('오답 side를 타격하면 wrong_locked로 잠기고 player_damage 명령은 arrival 시점에 1건 반환해야 한다 (A06)', () => {
      const initialState = createInitialPairState();
      // defaultPlan.correctSide는 'left'이므로 'right'는 오답
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'right',
        timestampMs: 1950,
        inputId: 'punch_wrong_01',
      };

      const result = reducePairState(initialState, action, customConfig, defaultPlan);

      expect(result.state.status).toBe('wrong_locked');
      expect(result.state.lockedChoice).toBe('right');
      expect(result.state.isCorrect).toBe(false);
      expect(result.state.isLocked).toBe(true);
      expect(result.state.isSettled).toBe(false);
      // BUG-ASSAULT-003: 입력 순간 피해 명령 0건
      expect(result.commands).toHaveLength(0);

      // 도착 시점(arrival) 도달 시 피해 1건 발행
      const arrivalAction: AssaultPairAction = {
        type: 'arrival',
        timestampMs: 2000,
      };
      const arrivalResult = reducePairState(result.state, arrivalAction, customConfig, defaultPlan);
      expect(arrivalResult.state.status).toBe('wrong_locked');
      expect(arrivalResult.state.isSettled).toBe(true);
      expect(arrivalResult.commands).toHaveLength(1);
      const cmd = arrivalResult.commands[0];
      expect(cmd.target).toBe('player');
      expect(cmd.resultKind).toBe('miss');
      expect(cmd.effectType).toBe('player_damage');
      expect(cmd.sessionId).toBe(defaultPlan.sessionId);
      expect(cmd.roundId).toBe(defaultPlan.roundId);
      expect(cmd.attackId).toBe(defaultPlan.attackId);
      expect(cmd.idempotencyKey).toBe(`${defaultPlan.sessionId}:${defaultPlan.attackId}:player_damage`);
    });

    it('오답 잠금 후 반대쪽 손 재타격은 잠금을 바꾸지 않고 추가 피해를 발생시키지 않는다 (A06)', () => {
      const initialState = createInitialPairState();
      const wrongPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'right',
        timestampMs: 1920,
        inputId: 'punch_w1',
      };

      const lockedRes = reducePairState(initialState, wrongPunch, customConfig, defaultPlan);
      expect(lockedRes.commands).toHaveLength(0);

      // 이후 정답 방향인 왼손으로 재타격
      const retryPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1980,
        inputId: 'punch_l_retry',
      };

      const retryRes = reducePairState(lockedRes.state, retryPunch, customConfig, defaultPlan);
      expect(retryRes.state.status).toBe('wrong_locked');
      expect(retryRes.state.lockedChoice).toBe('right');
      expect(retryRes.commands).toHaveLength(0);

      // 도착 시 피해 1회만 발행
      const arrivalRes = reducePairState(retryRes.state, { type: 'arrival', timestampMs: 2000 }, customConfig, defaultPlan);
      expect(arrivalRes.commands).toHaveLength(1);
    });

    it('오답 잠금 후 arrival tick이나 후속 tick에서 중복 피해 명령이 발생하지 않아야 한다 (A14)', () => {
      const initialState = createInitialPairState();
      const wrongPunch: AssaultPairAction = {
        type: 'punch',
        hand: 'right',
        timestampMs: 1920,
        inputId: 'punch_w2',
      };

      const lockedRes = reducePairState(initialState, wrongPunch, customConfig, defaultPlan);
      expect(lockedRes.commands).toHaveLength(0);

      const arrivalTick: AssaultPairAction = {
        type: 'tick',
        timestampMs: 2000,
      };

      const arrivalRes = reducePairState(lockedRes.state, arrivalTick, customConfig, defaultPlan);
      expect(arrivalRes.commands).toHaveLength(1);

      // 이후 후속 tick에서 중복 피해 0건
      const postTick: AssaultPairAction = {
        type: 'tick',
        timestampMs: 2100,
      };
      const postRes = reducePairState(arrivalRes.state, postTick, customConfig, defaultPlan);
      expect(postRes.commands).toHaveLength(0);
    });
  });

  describe('5. 판정 마감(도착 + lateGraceMs) 및 만료/타임아웃 (A07, A08)', () => {
    // arrivalMs: 2000, lateGraceMs: 170 -> deadline = 2170ms
    it('마감 직전(t = 2169ms) 입력은 정상 유효 선택으로 처리되어야 한다', () => {
      const initialState = createInitialPairState();
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 2169,
        inputId: 'punch_just_before_deadline',
      };

      const result = reducePairState(initialState, action, customConfig, defaultPlan);
      expect(result.state.status).toBe('correct');
      expect(result.state.lockedChoice).toBe('left');
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].effectType).toBe('boss_negate');
    });

    it('마감 시각과 동일한 입력(t = 2170ms)은 만료보다 입력을 우선 처리해야 한다 (A08)', () => {
      const initialState = createInitialPairState();
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 2170, // 정확히 arrivalMs(2000) + lateGraceMs(170)
        inputId: 'punch_on_exact_deadline',
      };

      const result = reducePairState(initialState, action, customConfig, defaultPlan);
      expect(result.state.status).toBe('correct');
      expect(result.state.lockedChoice).toBe('left');
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].effectType).toBe('boss_negate');
    });

    it('마감 초과 시각(t = 2171ms)에 입력이 들어오면 입력을 무시하고 timeout으로 잠겨야 한다 (A07, A08)', () => {
      const initialState = createInitialPairState();
      const lateAction: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 2171, // 1ms 초과
        inputId: 'punch_late_expired',
      };

      const result = reducePairState(initialState, lateAction, customConfig, defaultPlan);
      expect(result.state.status).toBe('timeout');
      expect(result.state.lockedChoice).toBeNull();
      expect(result.state.isLocked).toBe(true);
      expect(result.state.isCorrect).toBe(false);

      expect(result.commands).toHaveLength(1);
      const cmd = result.commands[0];
      expect(cmd.target).toBe('player');
      expect(cmd.resultKind).toBe('timeout');
      expect(cmd.effectType).toBe('player_damage');
      expect(cmd.idempotencyKey).toBe(`${defaultPlan.sessionId}:${defaultPlan.attackId}:player_damage`);
    });

    it('입력 없이 tick이 마감 초과(t = 2171ms)에 도달하면 timeout으로 잠기고 player_damage 명령 1건을 반환해야 한다 (A07)', () => {
      const initialState = createInitialPairState();
      const tickAction: AssaultPairAction = {
        type: 'tick',
        timestampMs: 2171,
      };

      const result = reducePairState(initialState, tickAction, customConfig, defaultPlan);
      expect(result.state.status).toBe('timeout');
      expect(result.state.isLocked).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].resultKind).toBe('timeout');
      expect(result.commands[0].effectType).toBe('player_damage');

      // 이후 추가 tick에서는 0건 발행
      const nextTick: AssaultPairAction = {
        type: 'tick',
        timestampMs: 2500,
      };
      const nextRes = reducePairState(result.state, nextTick, customConfig, defaultPlan);
      expect(nextRes.commands).toHaveLength(0);
    });
  });

  describe('6. 수학 정오와 리듬 등급(Perfect / Good / Late) 분리', () => {
    it('오차 <= 50ms인 정답은 Perfect 등급과 correct 판정을 받아야 한다', () => {
      const initialState = createInitialPairState();
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 2020, // 오차 20ms
        inputId: 'p_perfect',
      };

      const result = reducePairState(initialState, action, customConfig, defaultPlan);
      expect(result.state.status).toBe('correct');
      expect(result.state.isCorrect).toBe(true);
      expect(result.state.rhythmRating).toBe('Perfect');
      expect(result.state.deltaMs).toBe(20);
    });

    it('50ms < 오차 <= 120ms인 정답은 Good 등급과 correct 판정을 받아야 한다', () => {
      const initialState = createInitialPairState();
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1910, // 오차 -90ms (절댓값 90ms)
        inputId: 'p_good',
      };

      const result = reducePairState(initialState, action, customConfig, defaultPlan);
      expect(result.state.status).toBe('correct');
      expect(result.state.isCorrect).toBe(true);
      expect(result.state.rhythmRating).toBe('Good');
      expect(result.state.deltaMs).toBe(-90);
    });

    it('120ms < 오차 <= 200ms인 정답은 Late 등급이지만 수학적 정답(correct)을 유지해야 한다', () => {
      const initialState = createInitialPairState();
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 2150, // 오차 +150ms
        inputId: 'p_late',
      };

      const result = reducePairState(initialState, action, customConfig, defaultPlan);
      expect(result.state.status).toBe('correct');
      expect(result.state.isCorrect).toBe(true);
      expect(result.state.rhythmRating).toBe('Late');
      expect(result.state.deltaMs).toBe(150);
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].effectType).toBe('boss_negate');
    });
  });

  describe('7. 양손 동시 타격(충돌 허용차 이내 동시 유입) 보류 및 재시도 허용 (A10)', () => {
    it('양손 펀치가 동시 배치로 유입되면 선택을 잠그지 않고 conflict로 보류해야 한다', () => {
      const initialState = createInitialPairState();
      const batchAction: AssaultPairAction = {
        type: 'punch_batch',
        punches: [
          { hand: 'left', timestampMs: 1000, inputId: 'p_l_simul' },
          { hand: 'right', timestampMs: 1000, inputId: 'p_r_simul' },
        ],
      };

      const result = reducePairState(initialState, batchAction, customConfig, defaultPlan);
      expect(result.state.status).toBe('pending');
      expect(result.state.lockedChoice).toBeNull();
      expect(result.state.isLocked).toBe(false);
      expect(result.state.conflictCount).toBe(1);
      expect(result.state.lastConflictTimestampMs).toBe(1000);
      expect(result.commands).toHaveLength(0);
    });

    it('동시 타격 보류 후 남은 유효 시간 내에 유효한 단일 펀치로 재시도 시 정상 잠금되어야 한다', () => {
      const initialState = createInitialPairState();
      // 1. 동시 입력 발생 (t = 1850, 도착 150ms 전 — EarlyMiss 170ms 유효창 내)
      const batchAction: AssaultPairAction = {
        type: 'punch_batch',
        punches: [
          { hand: 'left', timestampMs: 1850, inputId: 'p_l_simul' },
          { hand: 'right', timestampMs: 1850, inputId: 'p_r_simul' },
        ],
      };
      const conflictRes = reducePairState(initialState, batchAction, customConfig, defaultPlan);
      expect(conflictRes.state.status).toBe('pending');

      // 2. 재시도 (t = 1500, 정상 단일 왼손 펀치)
      const retryAction: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1950,
        inputId: 'p_l_retry_single',
      };
      const retryRes = reducePairState(conflictRes.state, retryAction, customConfig, defaultPlan);
      expect(retryRes.state.status).toBe('correct');
      expect(retryRes.state.lockedChoice).toBe('left');
      expect(retryRes.state.isLocked).toBe(true);
      expect(retryRes.commands).toHaveLength(1);
      expect(retryRes.commands[0].effectType).toBe('boss_negate');
    });

    it('동시 허용차(simultaneousToleranceMs=50ms) 이내의 순차 유입도 충돌로 판정되어 잠금을 취소해야 한다', () => {
      const initialState = createInitialPairState();
      // t = 1850ms left (도착 150ms 전 — EarlyMiss 170ms 유효창 내)
      const punch1: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1850,
        inputId: 'p1',
      };
      const res1 = reducePairState(initialState, punch1, customConfig, defaultPlan);

      // t = 1870ms right (20ms 차이 <= 50ms)
      const punch2: AssaultPairAction = {
        type: 'punch',
        hand: 'right',
        timestampMs: 1870,
        inputId: 'p2',
      };
      const res2 = reducePairState(res1.state, punch2, customConfig, defaultPlan);

      expect(res2.state.status).toBe('pending');
      expect(res2.state.lockedChoice).toBeNull();
      expect(res2.state.isLocked).toBe(false);
      expect(res2.state.conflictCount).toBe(1);
      expect(res2.commands).toHaveLength(0);
    });
  });

  describe('8. inputId 멱등성 검증', () => {
    it('동일 inputId의 중복 유입 시 상태 변경 없이 무시되어야 한다', () => {
      const initialState = createInitialPairState();
      const punch: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1950,
        inputId: 'unique_input_001',
      };

      const firstRes = reducePairState(initialState, punch, customConfig, defaultPlan);
      expect(firstRes.state.status).toBe('correct');
      expect(firstRes.commands).toHaveLength(1);

      // 동일 inputId 재유입
      const duplicateRes = reducePairState(firstRes.state, punch, customConfig, defaultPlan);
      expect(duplicateRes.state).toBe(firstRes.state);
      expect(duplicateRes.commands).toHaveLength(0);
    });

    it('서로 다른 pair는 각자의 inputId 스코프를 유지해야 한다 (A14)', () => {
      const pair1Plan: AssaultPairPlan = {
        ...defaultPlan,
        attackId: 'attack_01',
      };
      const pair2Plan: AssaultPairPlan = {
        ...defaultPlan,
        attackId: 'attack_02',
      };

      const punch: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1950,
        inputId: 'input_scoped_001',
      };

      const resPair1 = reducePairState(createInitialPairState(), punch, customConfig, pair1Plan);
      expect(resPair1.state.status).toBe('correct');
      expect(resPair1.commands[0].attackId).toBe('attack_01');

      // pair2에서도 동일 inputId가 각자의 스코프에서 정상 소비 가능
      const resPair2 = reducePairState(createInitialPairState(), punch, customConfig, pair2Plan);
      expect(resPair2.state.status).toBe('correct');
      expect(resPair2.commands[0].attackId).toBe('attack_02');
    });
  });

  describe('9. AssaultPairJudge 클래스 인터페이스 및 라이프사이클 래핑', () => {
    it('AssaultPairJudge 인스턴스를 통해 dispatch, punch, tick 편의 메소드가 동작해야 한다', () => {
      const judge = new AssaultPairJudge(defaultPlan, customConfig);

      expect(judge.state.status).toBe('pending');
      expect(judge.plan.correctSide).toBe('left');
      expect(judge.config.lateGraceMs).toBe(170);

      const commands = judge.punch({
        hand: 'left',
        timestampMs: 1990,
        inputId: 'judge_p1',
      });

      expect(judge.state.status).toBe('correct');
      expect(commands).toHaveLength(1);
      expect(commands[0].effectType).toBe('boss_negate');

      const tickCommands = judge.tick(2000);
      expect(tickCommands).toHaveLength(0);
    });
  });
});
