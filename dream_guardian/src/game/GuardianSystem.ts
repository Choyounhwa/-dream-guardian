/**
 * GuardianSystem - 수호신 마법 캐스팅 및 4단계 성장
 *
 * 마나 100 → 보스 4 데미지, 캐스팅 횟수에 따라 성장
 * 1단계(요정) → 2단계(오브2) → 3단계(오브4) → 4단계(날개)
 *
 * @see Issue #17 (GitHub #82)
 */

import { DEFAULT_CONFIG } from '../core/Config.js';

export type GuardianStage = 1 | 2 | 3 | 4;

/** 성장 단계 전이 기준 (캐스팅 횟수) */
const STAGE_THRESHOLDS: Record<GuardianStage, number> = {
  1: 0,
  2: 2,
  3: 5,
  4: 10,
};

/** 성장 단계 이름 */
export const STAGE_NAMES: Record<GuardianStage, string> = {
  1: '작은 요정',
  2: '빛의 오브 2개',
  3: '빛의 오브 4개',
  4: '천사 날개',
};

export class GuardianSystem {
  private _stage: GuardianStage = 1;
  private _castCount = 0;
  private _isCasting = false;
  private _castTimer = 0;
  private _castDuration = 1.0; // 캐스팅 연출 시간

  get stage(): GuardianStage { return this._stage; }
  get stageName(): string { return STAGE_NAMES[this._stage]; }
  get castCount(): number { return this._castCount; }
  get isCasting(): boolean { return this._isCasting; }
  get spellDamage(): number { return DEFAULT_CONFIG.battle.spellDamage; }

  /**
   * 매 프레임 호출: 캐스팅 타이머 관리
   * @returns 캐스팅 연출이 완료되었는지
   */
  update(dt: number): boolean {
    if (!this._isCasting) return false;

    this._castTimer -= dt;
    if (this._castTimer <= 0) {
      this._isCasting = false;
      return true; // 캐스팅 완료
    }
    return false;
  }

  /**
   * 마법 시전 시작
   * @returns 보스에게 가할 데미지
   */
  cast(): number {
    this._castCount++;
    this._isCasting = true;
    this._castTimer = this._castDuration;
    this._updateStage();
    return DEFAULT_CONFIG.battle.spellDamage;
  }

  /**
   * 별가루 소비형 강화 수호신 마법 시전 (Issue #194)
   * @param bonusDamage 추가 데미지
   */
  castEnhanced(bonusDamage = 0): number {
    this._castCount++;
    this._isCasting = true;
    this._castTimer = this._castDuration;
    this._updateStage();
    return DEFAULT_CONFIG.battle.spellDamage + bonusDamage;
  }

  /** 성장 단계 갱신 */
  private _updateStage(): void {
    if (this._castCount >= STAGE_THRESHOLDS[4]) {
      this._stage = 4;
    } else if (this._castCount >= STAGE_THRESHOLDS[3]) {
      this._stage = 3;
    } else if (this._castCount >= STAGE_THRESHOLDS[2]) {
      this._stage = 2;
    } else {
      this._stage = 1;
    }
  }

  /** 초기화 */
  reset(): void {
    this._stage = 1;
    this._castCount = 0;
    this._isCasting = false;
    this._castTimer = 0;
  }
}
