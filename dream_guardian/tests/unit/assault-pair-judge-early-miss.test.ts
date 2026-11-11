import { describe, it, expect } from 'vitest';
import {
  reducePairState,
  createInitialPairState,
  AssaultPairJudge,
  DEFAULT_PAIR_JUDGE_CONFIG,
  type AssaultPairPlan,
  type AssaultPairJudgeConfig,
  type AssaultPairAction,
} from '../../src/game/assault/AssaultPairJudge.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';

describe('FEAT-ASSAULT-RHYTHM-001 (#730) 접근전 답안 조기 타격 Early Miss 판정', () => {
  const defaultPlan: AssaultPairPlan = Object.freeze({
    sessionId: 'session_test_01',
    roundId: 'round_test_01',
    attackId: 'attack_pair_01',
    pairId: 'pair_test_01',
    correctSide: 'left',
    arrivalMs: 2000,
    windowStartMs: 0,
  });

  const baseConfig: AssaultPairJudgeConfig = Object.freeze({
    lateGraceMs: 170,
    rhythmWindows: {
      Perfect: 50,
      Good: 120,
      Late: 170,
    },
    simultaneousToleranceMs: 50,
  });

  const earlyMissConfig: AssaultPairJudgeConfig = Object.freeze({
    lateGraceMs: 170,
    rhythmWindows: {
      Perfect: 50,
      Good: 120,
      Late: 170,
      EarlyMiss: 250,
    },
    simultaneousToleranceMs: 50,
  });

  it('1. [#745] EarlyMiss 미설정(undefined): 기본값(170ms) 적용 -> deltaMs = -2000 정답 펀치도 MISS(잠금/피해 없음)', () => {
    const state = createInitialPairState();
    const action: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 0, // deltaMs = 0 - 2000 = -2000
      inputId: 'punch_1',
    };

    const next = reducePairState(state, action, baseConfig, defaultPlan);
    expect(next.state.status).toBe('pending');
    expect(next.state.isLocked).toBe(false);
    expect(next.state.isCorrect).toBeNull();
    expect(next.commands).toHaveLength(0);
    expect(next.state.earlyMissCount).toBe(1);
  });

  it('2. EarlyMiss: 250: deltaMs = -300 정답 펀치 -> 커맨드 0건, status === pending, earlyMissCount === 1, lastEarlyMissTimestampMs 기록', () => {
    const state = createInitialPairState();
    const action: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1700, // deltaMs = 1700 - 2000 = -300 < -250
      inputId: 'punch_early_1',
    };

    const next = reducePairState(state, action, earlyMissConfig, defaultPlan);
    expect(next.state.status).toBe('pending');
    expect(next.state.isLocked).toBe(false);
    expect(next.state.lockedChoice).toBeNull();
    expect(next.commands).toHaveLength(0);
    expect(next.state.earlyMissCount).toBe(1);
    expect(next.state.lastEarlyMissTimestampMs).toBe(1700);
  });

  it('3. 조기 미스 이후 deltaMs = -30 정답 재타격 -> correct, rhythmRating === Perfect, boss_negate 1건', () => {
    const state = createInitialPairState();
    const action1: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1700, // deltaMs = -300 (Early Miss)
      inputId: 'punch_early_1',
    };
    const next1 = reducePairState(state, action1, earlyMissConfig, defaultPlan);

    const action2: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1970, // deltaMs = 1970 - 2000 = -30 (Perfect)
      inputId: 'punch_perfect_2',
    };
    const next2 = reducePairState(next1.state, action2, earlyMissConfig, defaultPlan);

    expect(next2.state.status).toBe('correct');
    expect(next2.state.isLocked).toBe(true);
    expect(next2.state.rhythmRating).toBe('Perfect');
    expect(next2.commands).toHaveLength(1);
    expect(next2.commands[0].effectType).toBe('boss_negate');
    expect(next2.state.earlyMissCount).toBe(1);
  });

  it('4. 조기 미스 이후 deltaMs = -100 정답 재타격 -> correct, rhythmRating === Good', () => {
    const state = createInitialPairState();
    const action1: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1700,
      inputId: 'punch_early_1',
    };
    const next1 = reducePairState(state, action1, earlyMissConfig, defaultPlan);

    const action2: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1900, // deltaMs = -100 (Good)
      inputId: 'punch_good_2',
    };
    const next2 = reducePairState(next1.state, action2, earlyMissConfig, defaultPlan);

    expect(next2.state.status).toBe('correct');
    expect(next2.state.isLocked).toBe(true);
    expect(next2.state.rhythmRating).toBe('Good');
    expect(next2.commands).toHaveLength(1);
    expect(next2.commands[0].effectType).toBe('boss_negate');
  });

  it('5. EarlyMiss: 250, deltaMs = -250 (경계) -> 조기 미스 아님 (정상 판정, rhythmRating === Early)', () => {
    const state = createInitialPairState();
    const action: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1750, // deltaMs = 1750 - 2000 = -250
      inputId: 'punch_boundary',
    };

    const next = reducePairState(state, action, earlyMissConfig, defaultPlan);
    expect(next.state.status).toBe('correct');
    expect(next.state.isLocked).toBe(true);
    expect(next.state.rhythmRating).toBe('Early');
    expect(next.commands).toHaveLength(1);
    expect(next.commands[0].effectType).toBe('boss_negate');
    expect(next.state.earlyMissCount ?? 0).toBe(0);
  });

  it('6. EarlyMiss: 250: 오답 쪽 deltaMs = -400 -> 잠금 없음, 피해 0건, 이후 정답 재타격 가능', () => {
    const state = createInitialPairState();
    const wrongAction: AssaultPairAction = {
      type: 'punch',
      hand: 'right',
      timestampMs: 1600, // deltaMs = 1600 - 2000 = -400 < -250
      inputId: 'punch_wrong_early',
    };

    const next1 = reducePairState(state, wrongAction, earlyMissConfig, defaultPlan);
    expect(next1.state.status).toBe('pending');
    expect(next1.state.isLocked).toBe(false);
    expect(next1.commands).toHaveLength(0);
    expect(next1.state.earlyMissCount).toBe(1);

    // 이후 정답 재타격
    const correctAction: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1980, // deltaMs = -20 (Perfect)
      inputId: 'punch_correct_after_wrong',
    };
    const next2 = reducePairState(next1.state, correctAction, earlyMissConfig, defaultPlan);
    expect(next2.state.status).toBe('correct');
    expect(next2.state.rhythmRating).toBe('Perfect');
    expect(next2.commands).toHaveLength(1);
    expect(next2.commands[0].effectType).toBe('boss_negate');
  });

  it('7. 조기 미스 후 재타격 없이 마감 -> 기존 timeout 경로 (Miss + player_damage)', () => {
    const state = createInitialPairState();
    const action1: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1700,
      inputId: 'punch_early_1',
    };
    const next1 = reducePairState(state, action1, earlyMissConfig, defaultPlan);

    const tickAction: AssaultPairAction = {
      type: 'tick',
      timestampMs: 2200,
    };
    const next2 = reducePairState(next1.state, tickAction, earlyMissConfig, defaultPlan);

    expect(next2.state.status).toBe('timeout');
    expect(next2.state.isLocked).toBe(true);
    expect(next2.state.rhythmRating).toBe('Miss');
    expect(next2.commands).toHaveLength(1);
    expect(next2.commands[0].effectType).toBe('player_damage');
    expect(next2.state.earlyMissCount).toBe(1);
  });

  it('8. 같은 inputId 재전달 -> 멱등 (카운트 증가 없음)', () => {
    const state = createInitialPairState();
    const action: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1700,
      inputId: 'punch_idempotent_1',
    };

    const next1 = reducePairState(state, action, earlyMissConfig, defaultPlan);
    expect(next1.state.earlyMissCount).toBe(1);

    const next2 = reducePairState(next1.state, action, earlyMissConfig, defaultPlan);
    expect(next2.state.earlyMissCount).toBe(1);
    expect(next2.commands).toHaveLength(0);
  });

  it('9. EarlyMiss: 0 또는 null -> 비활성 (조기 미스 아님)', () => {
    const disabledConfig0: AssaultPairJudgeConfig = {
      lateGraceMs: 170,
      rhythmWindows: {
        Perfect: 50,
        Good: 120,
        Late: 170,
        EarlyMiss: 0,
      },
      simultaneousToleranceMs: 50,
    };
    const disabledConfigNull: AssaultPairJudgeConfig = {
      lateGraceMs: 170,
      rhythmWindows: {
        Perfect: 50,
        Good: 120,
        Late: 170,
        EarlyMiss: null,
      },
      simultaneousToleranceMs: 50,
    };

    const state = createInitialPairState();
    const action: AssaultPairAction = {
      type: 'punch',
      hand: 'left',
      timestampMs: 1700, // deltaMs = -300
      inputId: 'punch_test',
    };

    const res0 = reducePairState(state, action, disabledConfig0, defaultPlan);
    expect(res0.state.status).toBe('correct');
    expect(res0.state.earlyMissCount ?? 0).toBe(0);

    const resNull = reducePairState(state, action, disabledConfigNull, defaultPlan);
    expect(resNull.state.status).toBe('correct');
    expect(resNull.state.earlyMissCount ?? 0).toBe(0);
  });

  it('10. AssaultPairJudge 클래스 인스턴스 경로에서도 조기 미스 및 재타격 정상 동작 확인', () => {
    const judge = new AssaultPairJudge(defaultPlan, earlyMissConfig);

    const r1 = judge.dispatch({
      type: 'punch',
      hand: 'left',
      timestampMs: 1600, // deltaMs = -400 (Early Miss)
      inputId: 'class_early_1',
    });
    expect(r1).toHaveLength(0);
    expect(judge.state.status).toBe('pending');
    expect(judge.state.earlyMissCount).toBe(1);

    const r2 = judge.dispatch({
      type: 'punch',
      hand: 'left',
      timestampMs: 2010, // deltaMs = +10 (Perfect)
      inputId: 'class_perfect_2',
    });
    expect(r2).toHaveLength(1);
    expect(r2[0].effectType).toBe('boss_negate');
    expect(judge.state.status).toBe('correct');
    expect(judge.state.rhythmRating).toBe('Perfect');
  });

  describe('[#745] 기본 설정: 시간 전(deltaMs < -170) 정답/오답 무관 MISS 처리 및 재선택 허용', () => {
    it('11. DEFAULT_ASSAULT_CONFIG.rhythmWindows.EarlyMiss === 170 (config SSOT)', () => {
      expect(DEFAULT_ASSAULT_CONFIG.rhythmWindows.EarlyMiss).toBe(170);
    });

    it('12. DEFAULT_PAIR_JUDGE_CONFIG가 config의 EarlyMiss를 덮어쓰지 않는다', () => {
      expect(DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.EarlyMiss).toBe(
        DEFAULT_ASSAULT_CONFIG.rhythmWindows.EarlyMiss
      );
    });

    it('13. 기본 설정 오답 시간 전 펀치(-500ms) -> 잠금/피해 없음, 이후 정답 재선택 가능', () => {
      const judge = new AssaultPairJudge(defaultPlan);
      const r1 = judge.dispatch({ type: 'punch', hand: 'right', timestampMs: 1500, inputId: 'w1' });
      expect(r1).toHaveLength(0);
      expect(judge.state.status).toBe('pending');
      expect(judge.state.isLocked).toBe(false);
      expect(judge.state.lockedChoice).toBeNull();
      expect(judge.state.isCorrect).toBeNull();
      expect(judge.state.earlyMissCount).toBe(1);

      // 도착 시점 tick에서도 피해 정산이 발생하지 않는다
      expect(judge.dispatch({ type: 'tick', timestampMs: 1900 })).toHaveLength(0);

      const r2 = judge.dispatch({ type: 'punch', hand: 'left', timestampMs: 1990, inputId: 'c2' });
      expect(r2).toHaveLength(1);
      expect(r2[0].effectType).toBe('boss_negate');
      expect(judge.state.status).toBe('correct');
    });

    it('14. 기본 설정 정답 시간 전 펀치(-171ms) -> MISS (정답 여부 판단 안 함)', () => {
      const judge = new AssaultPairJudge(defaultPlan);
      expect(judge.dispatch({ type: 'punch', hand: 'left', timestampMs: 1829, inputId: 'e1' })).toHaveLength(0);
      expect(judge.state.status).toBe('pending');
      expect(judge.state.earlyMissCount).toBe(1);
    });

    it('15. 기본 설정 경계 -170ms 펀치 -> 유효 판정 (오답은 wrong_locked)', () => {
      const judge = new AssaultPairJudge(defaultPlan);
      judge.dispatch({ type: 'punch', hand: 'right', timestampMs: 1830, inputId: 'b1' });
      expect(judge.state.status).toBe('wrong_locked');
      expect(judge.state.rhythmRating).toBe('Early');
    });
  });
});
