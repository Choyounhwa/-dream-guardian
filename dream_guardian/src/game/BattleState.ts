/**
 * BattleState - 플레이어 체력, 마나, 콤보 관리
 *
 * HP 100 기준, 정답 마나 +25, 오답 HP -25
 * 콤보 연속 카운트 및 리셋
 *
 * @see Issue #15 (GitHub #80)
 */

import { DEFAULT_CONFIG } from '../core/Config.js';

export class BattleState {
  private _hp: number;
  private _maxHp: number;
  private _mana = 0;
  private _combo = 0;
  private _maxCombo = 0;
  private _feverCombo = 0;
  private _correctCount = 0;
  private _wrongCount = 0;

  constructor(maxHp = DEFAULT_CONFIG.player.maxHp) {
    this._maxHp = maxHp;
    this._hp = maxHp;
  }

  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get mana(): number { return this._mana; }
  get combo(): number { return this._combo; }
  get maxCombo(): number { return this._maxCombo; }
  get feverCombo(): number { return this._feverCombo; }
  get correctCount(): number { return this._correctCount; }
  get wrongCount(): number { return this._wrongCount; }
  get totalQuestions(): number { return this._correctCount + this._wrongCount; }
  get isAlive(): boolean { return this._hp > 0; }
  get hpPercent(): number { return this._hp / this._maxHp; }
  get manaPercent(): number { return this._mana / DEFAULT_CONFIG.mana.spellCost; }

  /** 정답 처리: 마나 +25, 콤보 +1 */
  onCorrect(): void {
    this._correctCount++;
    this._combo++;
    if (this._combo > this._maxCombo) this._maxCombo = this._combo;
    this._mana += DEFAULT_CONFIG.mana.correctReward;
  }

  /** 오답 처리: HP -25, 콤보 리셋 */
  onWrong(): void {
    this._wrongCount++;
    this._combo = 0;
    this._hp = Math.max(0, this._hp - DEFAULT_CONFIG.player.wrongDamage);
  }

  /** 오답/타임아웃 기록: 콤보 0 리셋, 오답 카운트 누적 (HP 불변, Issue #225) */
  recordWrongAnswer(): void {
    this._wrongCount++;
    this._combo = 0;
  }

  /** 장판/바닥 충격파 회피 실패 피해: HP 차감 (Issue #225) */
  applyHazardDamage(amount = DEFAULT_CONFIG.player.wrongDamage): void {
    this._hp = Math.max(0, this._hp - amount);
  }

  /** 미니언 공격 피격 피해: HP 차감 (Issue #225) */
  applyMinionDamage(amount = DEFAULT_CONFIG.player.bossAttackDamage): void {
    this._hp = Math.max(0, this._hp - amount);
  }

  /** Phase B 보스 마법 공격 피격 피해: HP 차감 (Issue #225) */
  applyBossMagicDamage(amount = DEFAULT_CONFIG.player.bossAttackDamage): void {
    this._hp = Math.max(0, this._hp - amount);
  }

  /** 보스 공격 피격: HP -15 */
  onBossAttack(): void {
    this._hp = Math.max(0, this._hp - DEFAULT_CONFIG.player.bossAttackDamage);
  }

  /** 마나 100 이상 → 소모 후 true 반환 */
  trySpendMana(): boolean {
    if (this._mana >= DEFAULT_CONFIG.mana.spellCost) {
      this._mana -= DEFAULT_CONFIG.mana.spellCost;
      return true;
    }
    return false;
  }

  /** 피버 콤보 1 증가 후 반환 (Issue #213) */
  incrementFeverCombo(): number {
    this._feverCombo++;
    return this._feverCombo;
  }

  /** 피버 콤보 0 리셋 (Issue #213, #193) */
  resetFeverCombo(): void {
    this._feverCombo = 0;
  }

  /** HP를 직접 설정 (외부 이벤트용) */
  setHp(value: number): void {
    this._hp = Math.max(0, Math.min(this._maxHp, value));
  }

  /** 전투 초기화 */
  reset(): void {
    this._hp = this._maxHp;
    this._mana = 0;
    this._combo = 0;
    this._maxCombo = 0;
    this._feverCombo = 0;
    this._correctCount = 0;
    this._wrongCount = 0;
  }
}
