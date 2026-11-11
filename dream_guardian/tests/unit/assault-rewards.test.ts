import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ASSAULT_REWARD_CONFIG } from '../../config/assault-reward.config.js';
import {
  planAssaultRoundReward,
  requestAssaultRoundReward,
} from '../../src/game/assault/AssaultRewardPolicy.js';
import {
  createAssaultRoundSummary,
  type AssaultRoundSummaryData,
} from '../../src/game/assault/AssaultRoundSummary.js';

const profile = DEFAULT_ASSAULT_REWARD_CONFIG;

function summary(overrides: Partial<AssaultRoundSummaryData> = {}): AssaultRoundSummaryData {
  return {
    ...createAssaultRoundSummary({ sessionId: 'session-1', roundId: 'round-0' }),
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('#534 승인된 미사용 라운드 보상 정책', () => {
  it.each([
    ['정답 0', 0, 3, 0],
    ['일부 정답', 1, 1, 1],
    ['전부 정답', 3, 0, 0],
    ['전부 timeout', 0, 0, 3],
    ['3쌍 이상', 10, 2, 1],
    ['답 기회 0', 0, 0, 0],
  ])('%s에서도 비율/상한 계산 없이 명령은 비어 있다', (_name, correct, wrong, timeout) => {
    const input = summary({
      correctCount: correct,
      wrongCount: wrong,
      timeoutCount: timeout,
      attemptedAnswerHits: correct + wrong + timeout,
    });
    const plan = planAssaultRoundReward(input, profile);
    expect(plan.status).toBe('disabled');
    expect(plan.commands).toEqual([]);
    expect(requestAssaultRoundReward(plan, []).commands).toEqual([]);
  });

  it.each([
    { isAborted: true, completedQuestions: 0 },
    { isDefeated: true, isAborted: true, completedQuestions: 0 },
    { completedQuestions: 0 },
  ])('중단/사망/완료 문제 0은 지급 요청을 만들지 않는다: %j', (flags) => {
    const plan = planAssaultRoundReward(summary(flags), profile);
    const result = requestAssaultRoundReward(plan, []);
    expect(result.status).toBe('no-reward');
    expect(result.commands).toEqual([]);
  });

  it('round-0과 승인 프로필 식별자를 보존하고 계산 숫자를 발명하지 않는다', () => {
    const plan = planAssaultRoundReward(summary(), profile);
    expect(plan).toEqual({
      sessionId: 'session-1',
      roundId: 'round-0',
      effectType: 'round_reward',
      rewardProfileId: profile.profileId,
      rulesVersion: profile.rulesVersion,
      status: profile.status,
      commands: [],
    });
  });

  it('같은 입력의 순수 계획 계산은 이전 요청과 무관하게 동일하다', () => {
    const input = summary();
    const first = planAssaultRoundReward(input, profile);
    requestAssaultRoundReward(first, []);
    expect(planAssaultRoundReward(input, profile)).toEqual(first);
  });

  it('두 번째 요청과 중복 종료는 duplicate이며 무보상 평가 이력만 보존한다', () => {
    const plan = planAssaultRoundReward(summary(), profile);
    const first = requestAssaultRoundReward(plan, []);
    const second = requestAssaultRoundReward(plan, first.processedKeys);
    const third = requestAssaultRoundReward(plan, second.processedKeys);
    expect(first.status).toBe('no-reward');
    expect(first.processedKeys).toEqual([first.requestKey]);
    expect(second.status).toBe('duplicate');
    expect(third).toEqual(second);
    expect(third.commands).toEqual([]);
    expect(third.processedKeys).toHaveLength(1);
  });

  it.each([
    { sessionId: 'session-2' },
    { roundId: 'round-1' },
  ])('다른 session/round는 혼동하지 않는다: %j', (identity) => {
    const first = requestAssaultRoundReward(planAssaultRoundReward(summary(), profile), []);
    const next = requestAssaultRoundReward(
      planAssaultRoundReward(summary(identity), profile), first.processedKeys,
    );
    expect(next.status).toBe('no-reward');
    expect(next.requestKey).not.toBe(first.requestKey);
    expect(next.processedKeys).toHaveLength(2);
  });

  it('같은 session/round라도 다른 effect 이력은 중복으로 오인하지 않는다', () => {
    const prior = [JSON.stringify(['session-1', 'round-0', 'player_damage'])];
    const result = requestAssaultRoundReward(planAssaultRoundReward(summary(), profile), prior);
    expect(result.status).toBe('no-reward');
    expect(result.processedKeys).toEqual([...prior, result.requestKey]);
  });

  it('구분자/따옴표를 포함한 ID도 충돌하지 않는다', () => {
    const first = requestAssaultRoundReward(
      planAssaultRoundReward(summary({ sessionId: 'a:b', roundId: 'c"' }), profile), [],
    );
    const next = requestAssaultRoundReward(
      planAssaultRoundReward(summary({ sessionId: 'a', roundId: 'b:c"' }), profile),
      first.processedKeys,
    );
    expect(next.status).toBe('no-reward');
    expect(next.requestKey).not.toBe(first.requestKey);
  });

  it('입력 summary/receipt 식별자/정책/중복 이력을 변경하거나 동결하지 않는다', () => {
    const input = summary({
      completedQuestions: 1,
      actualDamage: 10,
      totalPlayerDamage: 10,
      processedReceiptIds: ['damage-receipt'],
    });
    const mutableProfile = structuredClone(profile);
    const previous = ['existing-key'];
    const before = structuredClone({ input, mutableProfile, previous });
    const plan = planAssaultRoundReward(input, mutableProfile);
    const first = requestAssaultRoundReward(plan, previous);
    requestAssaultRoundReward(plan, first.processedKeys);
    expect({ input, mutableProfile, previous }).toEqual(before);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.processedReceiptIds)).toBe(false);
    expect(Object.isFrozen(mutableProfile)).toBe(false);
    expect(Object.isFrozen(previous)).toBe(false);
  });

  it('계획/결과/명령/반환 이력은 readonly이며 깊게 동결된다', () => {
    const plan = planAssaultRoundReward(summary(), profile);
    const first = requestAssaultRoundReward(plan, []);
    const duplicate = requestAssaultRoundReward(plan, first.processedKeys);
    for (const value of [plan, plan.commands, first, first.commands, first.processedKeys,
      duplicate, duplicate.commands, duplicate.processedKeys]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(() => (first.processedKeys as string[]).push('bad')).toThrow();
    if (false) {
      // @ts-expect-error 계획의 식별자는 readonly다.
      plan.sessionId = 'bad';
      // @ts-expect-error 활성 명령은 이 버전에 존재하지 않는다.
      plan.commands.push({ kind: 'mana', amount: 25 });
      // @ts-expect-error 요청 결과 상태도 readonly다.
      first.status = 'duplicate';
      // @ts-expect-error 반환 이력을 직접 갱신하지 않는다.
      first.processedKeys.push('bad');
    }
  });

  it('초기 테스트 세션에서도 저장/기존 보상 API 없이 빈 명령만 반환한다', () => {
    const setItem = vi.fn(() => { throw new Error('저장 금지'); });
    vi.stubGlobal('localStorage', { setItem });
    const result = requestAssaultRoundReward(
      planAssaultRoundReward(summary({ sessionId: 'internal-test' }), profile), [],
    );
    expect(result.status).toBe('no-reward');
    expect(result.commands).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
  });
});
