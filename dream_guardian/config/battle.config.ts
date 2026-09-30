/**
 * battle.config.ts - 전투 시스템 설정값
 *
 * @see Issue #240 [BATTLE-PHASE-A-SETTLEMENT-001]
 * @see GDD 3.1 전투 시스템 스펙
 */

export interface StardustRewardConfig {
  Perfect: number;
  Good: number;
  Late: number;
  Miss: number;
}

export interface FeverConfig {
  /** 피버 별 수집 성공 시 기본 피해량 (기본: 1) */
  baseDamage: number;
  /** 판정 등급별 가중치 (Perfect 1.5, Good 1.0, Late 0.5, Miss 0) */
  ratingWeights: {
    Perfect: number;
    Good: number;
    Late: number;
    Miss: number;
  };
  /** 콤보 1회당 증가 배율 (기본: 0.1) */
  comboMultiplierStep: number;
  /** 콤보 최대 배율 상한 (기본: 3.0) */
  maxComboMultiplier: number;
}

export interface BossHazardConfig {
  /** 공격 간격 (초, 기본: 5.0) */
  attackInterval: number;
  /** 경고(전조) 시간 (초, 기본: 1.5) */
  warningDuration: number;
  /** 판정/활성 시간 (초, 기본: 1.0) */
  activeDuration: number;
  /** 피격 시 플레이어 피해량 (기본: 15) */
  damage: number;
  /** 광폭화 발동 체력 비율 (기본: 0.3 = 30%) */
  enrageHpRatio: number;
  /** 광폭화 시 공격 속도 가속 배율 (기본: 1.5 = 간격 / 1.5) */
  enrageSpeedMultiplier: number;
  /** 피격 시 아군 미니언 탈락 수량 (기본: 1) */
  minionCasualtyCount: number;
}

export const DEFAULT_BOSS_HAZARD_CONFIG: BossHazardConfig = {
  attackInterval: 5.0,
  warningDuration: 1.5,
  activeDuration: 1.0,
  damage: 15,
  enrageHpRatio: 0.3,
  enrageSpeedMultiplier: 1.5,
  minionCasualtyCount: 1,
};

export interface BattleConfig {
  /** 정답 시 보스 기본 피해량 */
  correctDamage: number;
  /** 마나 100 도달 시 수호신 스펠 피해량 */
  spellDamage: number;
  /** 일반 보스 (Ch.1~4) 기본 HP */
  bossHpNormal: number;
  /** 나이트메어 보스 (Ch.5) 기본 HP */
  bossHpNightmare: number;
  /** Phase A 총 문제 라운드 수 */
  phaseAQuestionCount: number;
  /** Phase A 보스 체력 하한선 (비치명 보장 최소 HP) */
  phaseAMinBossHp: number;
  /** 플레이어 최대 HP */
  playerMaxHp: number;
  /** 오답/장판 회피 실패 시 기본 피해량 */
  wrongDamage: number;
  /** 보스/미니언 공격 피해량 */
  bossAttackDamage: number;
  /** 정답 시 획득 마나 */
  manaCorrectReward: number;
  /** 수호신 스펠 시전 필요 마나 */
  spellCost: number;
  /** Phase A 시작 시 기본 미니언 수 (기본 3) */
  initialMinions: number;
  /** Phase A 미니언 최대 수량 (기본 13: 초기 3 + 정답 10) */
  maxMinions: number;
  /** 정답 당 미니언 증원 수 (기본 1) */
  minionsPerCorrect: number;
  /** 별 등급별 별가루 획득량 (Perfect 4, Good 3, Late 2, Miss 0) */
  stardustReward: {
    Perfect: number;
    Good: number;
    Late: number;
    Miss: number;
  };
  /** Phase B 피버 모드 및 보스 타격 밸런스 설정 (Issue #213) */
  fever: FeverConfig;
  /** Phase B 보스 패턴 공격 및 광폭화 설정 (Issue #193) */
  bossHazard: BossHazardConfig;
}

export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  correctDamage: 1,
  spellDamage: 4,
  bossHpNormal: 10,
  bossHpNightmare: 20,
  phaseAQuestionCount: 10,
  phaseAMinBossHp: 1,
  playerMaxHp: 100,
  wrongDamage: 25,
  bossAttackDamage: 15,
  manaCorrectReward: 25,
  spellCost: 100,
  initialMinions: 3,
  maxMinions: 13,
  minionsPerCorrect: 1,
  stardustReward: {
    Perfect: 4,
    Good: 3,
    Late: 2,
    Miss: 0,
  },
  fever: {
    baseDamage: 1,
    ratingWeights: {
      Perfect: 1.5,
      Good: 1.0,
      Late: 0.5,
      Miss: 0,
    },
    comboMultiplierStep: 0.1,
    maxComboMultiplier: 3.0,
  },
  bossHazard: DEFAULT_BOSS_HAZARD_CONFIG,
};
