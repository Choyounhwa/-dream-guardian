/**
 * battle.config.ts - 전투 시스템 설정값
 *
 * @see Issue #240 [BATTLE-PHASE-A-SETTLEMENT-001]
 * @see GDD 3.1 전투 시스템 스펙
 */

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
};
