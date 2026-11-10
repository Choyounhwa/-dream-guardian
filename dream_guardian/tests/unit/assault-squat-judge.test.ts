import { describe, it, expect } from 'vitest';
import {
  reduceSquatState,
  createInitialSquatState,
  createPlayerDamageCommand,
  createEvadeSuccessCommand,
  AssaultSquatJudge,
  DEFAULT_SQUAT_JUDGE_CONFIG,
  type AssaultSquatState,
  type AssaultSquatPlan,
  type AssaultSquatAction,
  type AssaultSquatJudgeConfig,
} from '../../src/game/assault/AssaultSquatJudge.js';
import type { AssaultSquatResult } from '../../src/motion/AssaultSquatAdapter.js';

describe('[BOSS-ASSAULT-13 / #515] 스쿼트 공격 순수 판정 (AssaultSquatJudge)', () => {
  const defaultPlan: AssaultSquatPlan = Object.freeze({
    sessionId: 'session_test_squat_01',
    roundId: 'round_test_squat_01',
    attackId: 'attack_squat_01',
    windowStartMs: 1000,
    arrivalMs: 2000,
  });

  const customConfig: AssaultSquatJudgeConfig = Object.freeze({
    lateGraceMs: 100,
    minDuckingDurationMs: 0,
    emitEvadeSuccessCommand: false,
  });

  const createMockSquatResult = (overrides: Partial<AssaultSquatResult> = {}): AssaultSquatResult =>
    Object.freeze({
      isValid: true,
      posture: 'ducking',
      isDucking: true,
      isStanding: false,
      standGeneration: 0,
      deltaY: 0.08,
      normalizedCurrentY: 0.58,
      normalizedBaselineY: 0.50,
      timestampMs: 1500,
      ...overrides,
    });

  describe('1. 순수 함수 / Reducer 기본 계약 및 불변성 보장', () => {
    it('DEFAULT_SQUAT_JUDGE_CONFIG는 올바른 기본값을 가져야 한다', () => {
      expect(DEFAULT_SQUAT_JUDGE_CONFIG.lateGraceMs).toBe(170);
      expect(DEFAULT_SQUAT_JUDGE_CONFIG.minDuckingDurationMs).toBe(0);
      expect(DEFAULT_SQUAT_JUDGE_CONFIG.emitEvadeSuccessCommand).toBe(false);
      expect(Object.isFrozen(DEFAULT_SQUAT_JUDGE_CONFIG)).toBe(true);
    });

    it('createInitialSquatState()는 pending 상태의 불변 초기 상태를 반환해야 한다', () => {
      const state: AssaultSquatState = createInitialSquatState();
      expect(state.status).toBe('pending');
      expect(state.isLocked).toBe(false);
      expect(state.isSettled).toBe(false);
      expect(state.resultKind).toBeNull();
      expect(state.effectType).toBeNull();
      expect(state.consumedGenerations).toEqual([]);
      expect(state.hasStoodUpSinceLastEvade).toBe(true);
      expect(Object.isFrozen(state)).toBe(true);
    });

    it('reduceSquatState는 원본 state, action, config, plan을 일체 변경하지 않아야 한다', () => {
      const state = createInitialSquatState();
      const action: AssaultSquatAction = Object.freeze({
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1500 }),
      });

      const next = reduceSquatState(state, action, defaultPlan, customConfig);
      expect(Object.isFrozen(next.state)).toBe(true);
      expect(Object.isFrozen(next.commands)).toBe(true);
      expect(state.status).toBe('pending');
      expect(state.isSettled).toBe(false);
    });
  });

  describe('2. 판정창(Window) 대조 및 경계값 검증 (창 시작/끝 직전·동일·직후)', () => {
    it('창 시작 직전(t=999)에만 스쿼트하고 창 내부에서는 서 있을 경우 실패(miss) 처리되어야 한다', () => {
      let state = createInitialSquatState();

      // t=999 (창 시작 직전) 스쿼트
      const earlyDuckAction: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 999, isDucking: true, posture: 'ducking' }),
      };
      state = reduceSquatState(state, earlyDuckAction, defaultPlan, customConfig).state;

      // 창 내부 진입 후 서 있음
      const standingAction: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1500, isDucking: false, isStanding: true, posture: 'standing' }),
      };
      state = reduceSquatState(state, standingAction, defaultPlan, customConfig).state;

      // 마감 시각 도착
      const arrivalAction: AssaultSquatAction = {
        type: 'arrival',
        timestampMs: 2200, // arrivalMs(2000) + lateGraceMs(100) 초과
      };
      const res = reduceSquatState(state, arrivalAction, defaultPlan, customConfig);

      expect(res.state.status).toBe('miss');
      expect(res.state.resultKind).toBe('miss');
      expect(res.state.effectType).toBe('player_damage');
      expect(res.commands).toHaveLength(1);
      expect(res.commands[0].effectType).toBe('player_damage');
      expect(res.commands[0].target).toBe('player');
    });

    it('창 시작 시각과 동일(t=1000)한 시점의 스쿼트는 유효하게 회피(evaded)되어야 한다', () => {
      const state = createInitialSquatState();
      const action: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1000, isDucking: true }),
      };

      const res = reduceSquatState(state, action, defaultPlan, customConfig);
      expect(res.state.status).toBe('evaded');
      expect(res.state.resultKind).toBe('evaded');
      expect(res.state.effectType).toBe('evade_success');
      expect(res.commands).toHaveLength(0); // 플레이어 피해 명령 0건
    });

    it('창 내부(t=1500)에서의 스쿼트는 성공(evaded) 판정되어야 한다', () => {
      const state = createInitialSquatState();
      const action: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1500, isDucking: true }),
      };

      const res = reduceSquatState(state, action, defaultPlan, customConfig);
      expect(res.state.status).toBe('evaded');
      expect(res.state.resultKind).toBe('evaded');
      expect(res.state.effectType).toBe('evade_success');
      expect(res.commands).toHaveLength(0);
    });

    it('창 종료/도착 시각과 동일(t=2000)한 시점의 스쿼트는 입력 우선으로 회피 성공해야 한다 (A08)', () => {
      const state = createInitialSquatState();
      const action: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 2000, isDucking: true }),
      };

      const res = reduceSquatState(state, action, defaultPlan, customConfig);
      expect(res.state.status).toBe('evaded');
      expect(res.state.resultKind).toBe('evaded');
      expect(res.commands).toHaveLength(0);
    });

    it('마감 시각(arrivalMs + lateGraceMs = 2100) 직후(t=2101)의 스쿼트는 만료 실패(miss) 처리되어야 한다', () => {
      const state = createInitialSquatState();
      const action: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 2101, isDucking: true }),
      };

      const res = reduceSquatState(state, action, defaultPlan, customConfig);
      expect(res.state.status).toBe('miss');
      expect(res.state.resultKind).toBe('miss');
      expect(res.state.effectType).toBe('player_damage');
      expect(res.commands).toHaveLength(1);
    });

    it('마감 시각까지 안전 자세가 전혀 없으면 arrival 시점에 miss 및 player_damage 명령이 1건 발행되어야 한다', () => {
      const state = createInitialSquatState();
      const arrivalAction: AssaultSquatAction = {
        type: 'arrival',
        timestampMs: 2150,
      };

      const res = reduceSquatState(state, arrivalAction, defaultPlan, customConfig);
      expect(res.state.status).toBe('miss');
      expect(res.state.resultKind).toBe('miss');
      expect(res.commands).toHaveLength(1);
      expect(res.commands[0].effectType).toBe('player_damage');
    });

    it('좌표 임계값 재계산 없이 #512의 isValid가 false인 프레임은 안전 자세로 인정하지 않아야 한다', () => {
      const state = createInitialSquatState();
      const invalidAction: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({
          timestampMs: 1500,
          isValid: false,
          invalidReason: 'TRACKING_LOST',
          isDucking: true,
        }),
      };

      const res = reduceSquatState(state, invalidAction, defaultPlan, customConfig);
      expect(res.state.status).toBe('pending'); // 유효하지 않으므로 pending 유지

      // 이후 arrival 도착 시 miss
      const arrivalRes = reduceSquatState(res.state, { type: 'arrival', timestampMs: 2200 }, defaultPlan, customConfig);
      expect(arrivalRes.state.status).toBe('miss');
      expect(arrivalRes.commands).toHaveLength(1);
    });
  });

  describe('3. 연속 앉기(Holding) 방지 및 Generation 소비 (A12, A13)', () => {
    const attack1Plan: AssaultSquatPlan = Object.freeze({
      sessionId: 'session_holding_01',
      roundId: 'round_holding_01',
      attackId: 'squat_atk_01',
      windowStartMs: 1000,
      arrivalMs: 2000,
    });

    const attack2Plan: AssaultSquatPlan = Object.freeze({
      sessionId: 'session_holding_01',
      roundId: 'round_holding_01',
      attackId: 'squat_atk_02',
      windowStartMs: 3000,
      arrivalMs: 4000,
    });

    it('첫 번째 공격 회피 후 직립 복귀 없이 계속 앉아있을 경우 다음 공격은 자동 성공하지 않고 실패(miss) 처리되어야 한다 (A13)', () => {
      // 1. 공격 1 회피 성공 (generation 0 소비)
      let state = createInitialSquatState();
      const duckAttack1: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1500, isDucking: true, standGeneration: 0 }),
      };
      state = reduceSquatState(state, duckAttack1, attack1Plan, customConfig).state;
      expect(state.status).toBe('evaded');
      expect(state.consumedGenerations).toContain(0);
      expect(state.hasStoodUpSinceLastEvade).toBe(false);

      // 2. 공격 2로 전환 (직립 복귀 없이 계속 앉아있음, standGeneration=0 유지)
      state = reduceSquatState(state, { type: 'next_encounter', plan: attack2Plan }, attack2Plan, customConfig).state;
      expect(state.status).toBe('pending');

      // t=3500 공격 2 창 내에서 여전히 앉아있음 (standGeneration=0, 직립 복귀 없음)
      const holdDuckAction: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 3500, isDucking: true, standGeneration: 0 }),
      };
      const holdRes = reduceSquatState(state, holdDuckAction, attack2Plan, customConfig);
      // 이미 소비된 generation 및 직립 복귀 부재로 인해 evade 인정되지 않음
      expect(holdRes.state.status).toBe('pending');

      // 마감 시각 도착 -> miss 처리 및 피해 1회 발행
      const arrivalRes = reduceSquatState(holdRes.state, { type: 'arrival', timestampMs: 4200 }, attack2Plan, customConfig);
      expect(arrivalRes.state.status).toBe('miss');
      expect(arrivalRes.commands).toHaveLength(1);
      expect(arrivalRes.commands[0].attackId).toBe('squat_atk_02');
      expect(arrivalRes.commands[0].effectType).toBe('player_damage');
    });

    it('첫 번째 공격 회피 후 직립 복귀하여 새로운 generation을 획득하면 다음 공격도 정상 회피되어야 한다', () => {
      // 1. 공격 1 회피 성공
      let state = createInitialSquatState();
      state = reduceSquatState(state, {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1500, isDucking: true, standGeneration: 0 }),
      }, attack1Plan, customConfig).state;
      expect(state.status).toBe('evaded');

      // 2. 공격 사이(t=2500) 직립 복귀 (isStanding=true, standGeneration=1)
      state = reduceSquatState(state, {
        type: 'squat_frame',
        result: createMockSquatResult({
          timestampMs: 2500,
          isDucking: false,
          isStanding: true,
          posture: 'standing',
          standGeneration: 1,
        }),
      }, attack1Plan, customConfig).state;
      expect(state.hasStoodUpSinceLastEvade).toBe(true);

      // 3. 공격 2 진입
      state = reduceSquatState(state, { type: 'next_encounter', plan: attack2Plan }, attack2Plan, customConfig).state;

      // 4. 공격 2 창 내(t=3500)에서 새로운 스쿼트 실행 (standGeneration=1)
      const duckAttack2: AssaultSquatAction = {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 3500, isDucking: true, standGeneration: 1 }),
      };
      const attack2Res = reduceSquatState(state, duckAttack2, attack2Plan, customConfig);
      expect(attack2Res.state.status).toBe('evaded');
      expect(attack2Res.commands).toHaveLength(0);
      expect(attack2Res.state.consumedGenerations).toContain(0);
      expect(attack2Res.state.consumedGenerations).toContain(1);
    });

    it('AssaultSquatJudge 클래스 인스턴스에서 setPlan을 통한 공격 간 연속 앉기가 차단되어야 한다', () => {
      const judge = new AssaultSquatJudge(attack1Plan, customConfig);

      // 공격 1: 스쿼트 회피 성공
      judge.feed(createMockSquatResult({ timestampMs: 1500, isDucking: true, standGeneration: 0 }));
      expect(judge.state.status).toBe('evaded');

      // 공격 2 설정 (직립 복귀 없음)
      judge.setPlan(attack2Plan);
      expect(judge.state.status).toBe('pending');

      // 공격 2: 여전히 generation 0으로 웅크려 있음
      judge.feed(createMockSquatResult({ timestampMs: 3500, isDucking: true, standGeneration: 0 }));
      expect(judge.state.status).toBe('pending'); // 자동 회피 거부

      // 마감 도착 -> miss 확정
      const commands = judge.arrival(4200);
      expect(judge.state.status).toBe('miss');
      expect(commands).toHaveLength(1);
      expect(commands[0].attackId).toBe('squat_atk_02');
    });
  });

  describe('4. 정산 명령(Settlement Command) 멱등성 및 이전 피해 보존 (A12, A14)', () => {
    it('회피 성공 시 플레이어 피해 명령은 0건이어야 한다', () => {
      const state = createInitialSquatState();
      const res = reduceSquatState(state, {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1500, isDucking: true }),
      }, defaultPlan, customConfig);

      expect(res.state.status).toBe('evaded');
      const playerDamageCmds = res.commands.filter((c) => c.effectType === 'player_damage');
      expect(playerDamageCmds).toHaveLength(0);
      expect(res.commands).toHaveLength(0);
    });

    it('emitEvadeSuccessCommand가 활성화되면 evade_success 정산 명령을 1건 발행할 수 있어야 한다', () => {
      const emitConfig: AssaultSquatJudgeConfig = {
        ...customConfig,
        emitEvadeSuccessCommand: true,
      };
      const state = createInitialSquatState();
      const res = reduceSquatState(state, {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1500, isDucking: true }),
      }, defaultPlan, emitConfig);

      expect(res.commands).toHaveLength(1);
      expect(res.commands[0].effectType).toBe('evade_success');
      expect(res.commands[0].resultKind).toBe('evaded');
      expect(res.commands[0].target).toBe('player');
    });

    it('회피 실패 시 정확히 1건의 player_damage 정산 명령이 발행되어야 한다', () => {
      const state = createInitialSquatState();
      const res = reduceSquatState(state, { type: 'arrival', timestampMs: 2200 }, defaultPlan, customConfig);

      expect(res.commands).toHaveLength(1);
      expect(res.commands[0].effectType).toBe('player_damage');
      expect(res.commands[0].resultKind).toBe('miss');
      expect(res.commands[0].target).toBe('player');
      expect(res.commands[0].idempotencyKey).toBe(`${defaultPlan.sessionId}:${defaultPlan.attackId}:player_damage`);
    });

    it('동일 attackId에 대해 중복 도착 또는 추가 프레임이 발생해도 정산 명령이 중복 발행되지 않아야 한다 (멱등성)', () => {
      // 1차 실패 확정
      const initial = createInitialSquatState();
      const firstRes = reduceSquatState(initial, { type: 'arrival', timestampMs: 2200 }, defaultPlan, customConfig);
      expect(firstRes.commands).toHaveLength(1);
      expect(firstRes.state.isSettled).toBe(true);

      // 2차 중복 arrival
      const secondRes = reduceSquatState(firstRes.state, { type: 'arrival', timestampMs: 2300 }, defaultPlan, customConfig);
      expect(secondRes.commands).toHaveLength(0);
      expect(secondRes.state).toBe(firstRes.state);

      // 3차 추가 frame 유입
      const thirdRes = reduceSquatState(firstRes.state, {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 2400 }),
      }, defaultPlan, customConfig);
      expect(thirdRes.commands).toHaveLength(0);
    });

    it('스쿼트 회피 성공은 이전 오답 피해 명령을 취소하거나 롤백 명령을 발행하지 않아야 한다 (A12)', () => {
      // 이전 단계에서 오답으로 인해 이미 발행된 settlement command 목록 시뮬레이션
      const priorCommands = [
        createPlayerDamageCommand({
          sessionId: 'session_test_squat_01',
          roundId: 'round_test_squat_01',
          attackId: 'attack_prior_answer_01',
          windowStartMs: 0,
          arrivalMs: 1000,
        }),
      ];

      // 스쿼트 회피 성공
      const squatRes = reduceSquatState(createInitialSquatState(), {
        type: 'squat_frame',
        result: createMockSquatResult({ timestampMs: 1500, isDucking: true }),
      }, defaultPlan, customConfig);

      expect(squatRes.state.status).toBe('evaded');
      // 스쿼트 결과로 인해 이전 커맨드가 변경되거나 취소 커맨드가 나오지 않음
      expect(squatRes.commands).toHaveLength(0);
      expect(priorCommands).toHaveLength(1);
      expect(priorCommands[0].attackId).toBe('attack_prior_answer_01');
      expect(priorCommands[0].effectType).toBe('player_damage');
    });
  });

  describe('5. 편의 래퍼 클래스 및 헬퍼 함수', () => {
    it('createPlayerDamageCommand와 createEvadeSuccessCommand는 올바른 불변 객체를 생성해야 한다', () => {
      const dmgCmd = createPlayerDamageCommand(defaultPlan);
      expect(dmgCmd.sessionId).toBe(defaultPlan.sessionId);
      expect(dmgCmd.attackId).toBe(defaultPlan.attackId);
      expect(dmgCmd.effectType).toBe('player_damage');
      expect(dmgCmd.resultKind).toBe('miss');
      expect(dmgCmd.idempotencyKey).toBe(`${defaultPlan.sessionId}:${defaultPlan.attackId}:player_damage`);
      expect(Object.isFrozen(dmgCmd)).toBe(true);

      const evadeCmd = createEvadeSuccessCommand(defaultPlan);
      expect(evadeCmd.sessionId).toBe(defaultPlan.sessionId);
      expect(evadeCmd.attackId).toBe(defaultPlan.attackId);
      expect(evadeCmd.effectType).toBe('evade_success');
      expect(evadeCmd.resultKind).toBe('evaded');
      expect(evadeCmd.idempotencyKey).toBe(`${defaultPlan.sessionId}:${defaultPlan.attackId}:evade_success`);
      expect(Object.isFrozen(evadeCmd)).toBe(true);
    });

    it('AssaultSquatJudge 클래스는 dispatch/feed/tick/arrival 편의 메서드를 제공해야 한다', () => {
      const judge = new AssaultSquatJudge(defaultPlan, customConfig);
      expect(judge.plan).toBe(defaultPlan);
      expect(judge.config.lateGraceMs).toBe(100);

      // feed
      judge.feed(createMockSquatResult({ timestampMs: 1500, isDucking: true }));
      expect(judge.state.status).toBe('evaded');

      // arrival after evasion -> 0 commands
      const cmds = judge.arrival(2000);
      expect(cmds).toHaveLength(0);

      // reset
      judge.reset();
      expect(judge.state.status).toBe('pending');
    });
  });
});
