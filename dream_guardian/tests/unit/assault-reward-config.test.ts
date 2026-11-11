import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DEFAULT_ASSAULT_REWARD_CONFIG,
  type AssaultRewardConfig,
} from '../../config/assault-reward.config.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { DEFAULT_CONFIG } from '../../src/core/Config.js';

describe('[BOSS-ASSAULT-31 / #533] 명시적 미사용 보상 정책', () => {
  const config = DEFAULT_ASSAULT_REWARD_CONFIG;

  it('승인된 버전·모드·프로필과 disabled 상태를 선언한다', () => {
    expect(config.schemaVersion).toBe(1);
    expect(config.mode).toBe('boss_assault');
    expect(config.rulesVersion).toBe('v0.3');
    expect(config.profileId).toBe('assault_rewards_unused_v1');
    expect(config.status).toBe('disabled');
    expectTypeOf(config).toMatchTypeOf<AssaultRewardConfig>();
  });

  it('CLI 사용자 결정 대리 기록인 정책 승인·G5 부분 해제 URL을 추적한다', () => {
    expect(config.approval).toEqual({
      policyUrl: 'https://github.com/Choyounhwa/-dream-guardian/issues/533#issuecomment-6318603193',
      gateUrl: 'https://github.com/Choyounhwa/-dream-guardian/issues/503#issuecomment-6318617387',
    });
  });

  it('마나·스펠·미니언·성장·별가루를 각각 unused로 명시한다', () => {
    expect(config.features).toEqual({
      mana: 'unused',
      spell: 'unused',
      minion: 'unused',
      growth: 'unused',
      stardust: 'unused',
    });
  });

  it('단위·문제당 상한·정답 비율·반올림을 0 추정 없이 not-applicable로 선언한다', () => {
    expect(config.calculation).toEqual({
      unit: 'not-applicable',
      perQuestionCap: 'not-applicable',
      correctRatio: 'not-applicable',
      rounding: 'not-applicable',
    });
  });

  // 선언형 데이터 카드이므로 외부 입력 validator는 만들지 않는다.
  // 아래 fixture는 정확한 계약과의 불일치 및 tsc 타입 제약을 검증한다.
  it.each(['unit', 'perQuestionCap', 'correctRatio', 'rounding'] as const)(
    '%s 누락 fixture는 승인된 미사용 계산 계약과 다르다',
    (key) => {
      const fixture = { ...config.calculation };
      Reflect.deleteProperty(fixture, key);
      expect(fixture).not.toEqual(config.calculation);
      expect(config.calculation[key]).toBe('not-applicable');
    },
  );

  it.each([0, 25, -1, NaN, Infinity, -Infinity, undefined, null])(
    '상한 %s fixture는 not-applicable 계약이 아니다 (0/+25도 미승인)',
    (cap) => {
      const fixture = { ...config.calculation, perQuestionCap: cap };
      expectTypeOf(fixture).not.toMatchTypeOf<AssaultRewardConfig['calculation']>();
      expect(fixture).not.toEqual(config.calculation);
      expect(config.calculation.perQuestionCap).toBe('not-applicable');
    },
  );

  it('반올림·기능 누락 및 활성 상태는 타입 계약에 포함되지 않는다', () => {
    expectTypeOf<Omit<AssaultRewardConfig['calculation'], 'rounding'>>()
      .not.toMatchTypeOf<AssaultRewardConfig['calculation']>();
    expectTypeOf<Omit<AssaultRewardConfig['features'], 'mana'>>()
      .not.toMatchTypeOf<AssaultRewardConfig['features']>();
    expectTypeOf<'enabled'>().not.toMatchTypeOf<AssaultRewardConfig['status']>();
    expectTypeOf<'active'>().not.toMatchTypeOf<AssaultRewardConfig['features']['spell']>();
  });

  it('최상위와 모든 중첩 객체는 동결되어 변경·추가·삭제되지 않는다', () => {
    for (const object of [config, config.approval, config.features, config.calculation]) {
      expect(Object.isFrozen(object)).toBe(true);
      expect(Reflect.set(object, 'extra', true)).toBe(false);
      const key = Object.keys(object)[0];
      expect(Reflect.set(object, key, 'changed')).toBe(false);
      expect(Reflect.deleteProperty(object, key)).toBe(false);
    }
    expect(config.features.mana).toBe('unused');
    expect(config.calculation.perQuestionCap).toBe('not-applicable');
  });

  it('readonly 타입으로 최상위·중첩 속성 쓰기를 허용하지 않는다', () => {
    // 실행하지 않는 타입 fixture: npm run build의 tsc가 오류 존재를 확인한다.
    const typeFixture = (): void => {
      // @ts-expect-error 정책 상태는 readonly다.
      config.status = 'disabled';
      // @ts-expect-error 기능별 선언은 readonly다.
      config.features.mana = 'unused';
      // @ts-expect-error 계산 계약은 readonly다.
      config.calculation.rounding = 'not-applicable';
      // @ts-expect-error 승인 근거는 readonly다.
      config.approval.policyUrl = config.approval.policyUrl;
    };
    expect(typeof typeFixture).toBe('function');
  });

  it('직렬화 가능한 데이터만 내보내며 실행·계산·저장 함수를 포함하지 않는다', () => {
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);
    expect(Object.keys(config).sort()).toEqual([
      'approval', 'calculation', 'features', 'mode', 'profileId', 'rulesVersion',
      'schemaVersion', 'status',
    ]);
  });

  it('MVP 프로필에 보상을 추가하지 않고 legacy +25/100/4 보상을 보존한다', () => {
    expect(DEFAULT_ASSAULT_CONFIG.profileId).toBe('assault_mvp_v1');
    expect(DEFAULT_ASSAULT_CONFIG).not.toHaveProperty('reward');
    expect(DEFAULT_ASSAULT_CONFIG).not.toHaveProperty('mana');
    expect(DEFAULT_CONFIG.mana).toEqual({ correctReward: 25, spellCost: 100 });
    expect(DEFAULT_CONFIG.battle.spellDamage).toBe(4);
    expect(DEFAULT_CONFIG.battle.minionsPerCorrect).toBe(1);
    expect(DEFAULT_CONFIG.battle.stardustReward).toEqual({ Perfect: 4, Good: 3, Late: 2, Miss: 0 });
  });
});
