/**
 * BOSS-ASSAULT-31 / #533 — 승인된 미사용 보상 정책 데이터만 선언한다.
 * DOC-14 v0.3 §9.4 / DOC-15 카드 31. 기존 MVP·legacy 설정을 변경하지 않는다.
 * 승인 URL은 CLI 사용자 결정의 대리 기록이며 저장 계약의 승인이 아니다.
 * 활성 정책은 이 버전에 없다. 활성화 전 별도 승인 및 버전 검토가 필요하다.
 * 계산·지급·스펠 실행·성장·저장·외부 입력 검증은 이 config의 책임이 아니다.
 */
import type { AssaultGameMode, ProfileId, RulesVersion } from '../src/types/assault.js';
import { deepFreeze } from '../src/utils/deepFreeze.js';

/** 0 지급 수치가 아니라 계산 자체가 적용되지 않는다는 명시적 계약이다. */
export interface AssaultRewardConfig {
  readonly schemaVersion: 1;
  readonly mode: AssaultGameMode;
  readonly rulesVersion: RulesVersion;
  readonly profileId: ProfileId;
  readonly status: 'disabled';
  readonly approval: {
    readonly policyUrl: string;
    readonly gateUrl: string;
  };
  readonly features: {
    readonly mana: 'unused';
    readonly spell: 'unused';
    readonly minion: 'unused';
    readonly growth: 'unused';
    readonly stardust: 'unused';
  };
  readonly calculation: {
    readonly unit: 'not-applicable';
    readonly perQuestionCap: 'not-applicable';
    readonly correctRatio: 'not-applicable';
    readonly rounding: 'not-applicable';
  };
}

export const DEFAULT_ASSAULT_REWARD_CONFIG: AssaultRewardConfig = deepFreeze({
  schemaVersion: 1,
  mode: 'boss_assault',
  rulesVersion: 'v0.3',
  profileId: 'assault_rewards_unused_v1',
  status: 'disabled',
  approval: {
    policyUrl: 'https://github.com/Choyounhwa/-dream-guardian/issues/533#issuecomment-6318603193',
    gateUrl: 'https://github.com/Choyounhwa/-dream-guardian/issues/503#issuecomment-6318617387',
  },
  features: {
    mana: 'unused',
    spell: 'unused',
    minion: 'unused',
    growth: 'unused',
    stardust: 'unused',
  },
  calculation: {
    unit: 'not-applicable',
    perQuestionCap: 'not-applicable',
    correctRatio: 'not-applicable',
    rounding: 'not-applicable',
  },
} as const);
