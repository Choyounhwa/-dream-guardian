/**
 * BossController - 보스 전투 컨트롤러
 *
 * 5종 보스 체력 관리, 주기적 공격, 스쿼트 방어 판정
 * Ch.1~4 HP=10, Ch.5 HP=20
 *
 * @see Issue #16 (GitHub #81)
 */

import { DEFAULT_CONFIG } from '../core/Config.js';

export type BossPhase = 'idle' | 'warning' | 'attacking' | 'defeated';

export class BossController {
  private _hp: number;
  private _maxHp: number;
  private _chapter: number;
  private _phase: BossPhase = 'idle';
  private _attackTimer = 0;
  private _warningTimer = 0;
  private _attackDurationTimer = 0;
  private _attackInterval: number;
  private _warningDuration = 1.5;

  /**
   * @param chapter 챕터 번호 (1~5)
   * @param attackInterval 자동 기습 공격 주기 (초). 0이면 자동 공격 비활성화 (기본값 0, Issue #147)
   */
  constructor(chapter = 1, attackInterval = 0) {
    this._chapter = chapter;
    this._maxHp = chapter === 5
      ? DEFAULT_CONFIG.battle.bossHpNightmare
      : DEFAULT_CONFIG.battle.bossHpNormal;
    this._hp = this._maxHp;
    this._attackInterval = attackInterval;
    this._attackTimer = attackInterval;
  }

  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get chapter(): number { return this._chapter; }
  get phase(): BossPhase { return this._phase; }
  get isDefeated(): boolean { return this._hp <= 0; }
  get hpPercent(): number { return this._hp / this._maxHp; }
  /** 경고 중인지 (UI에서 경고 표시용) */
  get isWarning(): boolean { return this._phase === 'warning'; }
  /** 공격 중인지 (스쿼트 판정 타이밍 또는 오답 반격 모션) */
  get isAttacking(): boolean { return this._phase === 'attacking'; }

  /**
   * 오답 시 보스 반격 모션 트리거 (Issue #147)
   * @param duration 공격 상태 지속 시간 (초, 기본 0.5초)
   */
  triggerAttack(duration = 0.5): void {
    if (this._phase === 'defeated') return;
    this._phase = 'attacking';
    this._attackDurationTimer = duration;
  }

  /** 오답 반격 트리거 (triggerAttack 시맨틱 별칭) */
  triggerCounterAttack(duration = 0.5): void {
    this.triggerAttack(duration);
  }

  /**
   * 매 프레임 호출: 공격 지속 시간 및 자동 공격 타이머 관리
   * @returns 이번 프레임에 공격이 발동되었는지 (자동 타이머 모드 전용)
   */
  update(dt: number): boolean {
    if (this._phase === 'defeated') return false;

    // 공격 모션 진행 중일 때 지속 시간 감쇠 후 idle 복귀
    if (this._phase === 'attacking') {
      if (this._attackDurationTimer > 0) {
        this._attackDurationTimer = Math.max(0, this._attackDurationTimer - dt);
        if (this._attackDurationTimer <= 0) {
          this._phase = 'idle';
        }
      }
      return false;
    }

    // 자동 공격 타이머가 활성화된 경우만 동작 (attackInterval > 0)
    if (this._attackInterval > 0) {
      if (this._phase === 'idle') {
        this._attackTimer -= dt;
        if (this._attackTimer <= 0) {
          this._phase = 'warning';
          this._warningTimer = this._warningDuration;
        }
        return false;
      }

      if (this._phase === 'warning') {
        this._warningTimer -= dt;
        if (this._warningTimer <= 0) {
          this._phase = 'attacking';
          this._attackDurationTimer = 0.5;
          return true; // 공격 발동
        }
        return false;
      }
    }

    return false;
  }

  /**
   * 공격 결과 처리
   * @param shielded 스쿼트 방어 성공 여부
   * @returns 실제 플레이어 피해량 (방어 성공 시 0)
   */
  resolveAttack(shielded: boolean): number {
    this._phase = 'idle';
    this._attackTimer = this._attackInterval;
    this._attackDurationTimer = 0;

    if (shielded) return 0;
    return DEFAULT_CONFIG.player.bossAttackDamage;
  }

  /** 보스에게 데미지 적용 */
  takeDamage(amount: number): void {
    this._hp = Math.max(0, this._hp - amount);
    if (this._hp <= 0) {
      this._phase = 'defeated';
    }
  }

  /** 초기화 */
  reset(chapter?: number): void {
    if (chapter !== undefined) this._chapter = chapter;
    this._maxHp = this._chapter === 5
      ? DEFAULT_CONFIG.battle.bossHpNightmare
      : DEFAULT_CONFIG.battle.bossHpNormal;
    this._hp = this._maxHp;
    this._phase = 'idle';
    this._attackTimer = this._attackInterval;
    this._warningTimer = 0;
    this._attackDurationTimer = 0;
  }
}
