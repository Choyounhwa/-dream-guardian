/**
 * BOSS-ASSAULT-32 / #534 — 승인된 disabled 정책의 순수 계획과 요청 중복 평가.
 * 활성 보상 산식/상한/반올림은 not-applicable이며 이 버전에는 지급 명령이 없다.
 * 자원·저장·런타임 종료를 호출하지 않는다. 기존 결과/피해 receipt도 변경하지 않는다.
 */
import type { AssaultRewardConfig } from '../../../config/assault-reward.config.js';
import type { SessionId, RoundId } from '../../types/assault.js';
import type { AssaultRoundSummaryData } from './AssaultRoundSummary.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

export interface AssaultRewardPlan {
  readonly sessionId: SessionId;
  readonly roundId: RoundId;
  readonly effectType: 'round_reward';
  readonly rewardProfileId: AssaultRewardConfig['profileId'];
  readonly rulesVersion: AssaultRewardConfig['rulesVersion'];
  readonly status: AssaultRewardConfig['status'];
  /** 빈 명령만 허용한다. 활성 명령 추가는 별도 정책 승인/버전 검토 대상이다. */
  readonly commands: readonly [];
}

export interface AssaultRewardRequestResult {
  readonly requestKey: string;
  /** no-reward는 지급 성공 영수증이 아니라 무보상 평가 결과다. */
  readonly status: 'no-reward' | 'duplicate';
  readonly commands: readonly [];
  /** 호출자가 다음 요청에 전달할 평가 이력. 저장 영수증/영속 저장 계약이 아니다. */
  readonly processedKeys: readonly string[];
}

/**
 * #533의 승인된 typed profile만 소비한다. 외부 데이터 검증/활성 정책 지원은 하지 않는다.
 * 모든 기능이 미사용이므로 정오/timeout/aborted/문제 수/타격 수와 무관하게 빈 계획이다.
 * 초기 테스트 세션도 동일하며 완료 여부를 보상·문제 통계로 재해석하지 않는다.
 */
export function planAssaultRoundReward(
  summary: AssaultRoundSummaryData,
  profile: AssaultRewardConfig,
): AssaultRewardPlan {
  return deepFreeze({
    sessionId: summary.sessionId,
    roundId: summary.roundId,
    effectType: 'round_reward',
    rewardProfileId: profile.profileId,
    rulesVersion: profile.rulesVersion,
    status: profile.status,
    commands: [] as const,
  });
}

/**
 * 숨은 가변 상태 없이 이전 이력 → 평가 결과와 새 이력을 반환한다.
 * 무보상 평가도 한 번 기록하여 재전송/중복 종료를 식별하되 지급으로 표시하지 않는다.
 * 키는 충돌 없는 session/round/effect 튜플이며 저장 namespace/순위 비교 키가 아니다.
 */
export function requestAssaultRoundReward(
  plan: AssaultRewardPlan,
  processedKeys: readonly string[],
): AssaultRewardRequestResult {
  const requestKey = JSON.stringify([plan.sessionId, plan.roundId, plan.effectType]);
  const duplicate = processedKeys.includes(requestKey);
  return deepFreeze({
    requestKey,
    status: duplicate ? 'duplicate' : 'no-reward',
    commands: [] as const,
    processedKeys: duplicate ? [...processedKeys] : [...processedKeys, requestKey],
  });
}
