/**
 * BossController - 보스 전투 컨트롤러
 *
 * 5종 보스 체력 관리 및 오답 반격 모션 상태 관리
 * Ch.1~4 HP=10, Ch.5 HP=20
 *
 * @see Issue #16 (GitHub #81), #147, #208
 */

import { DEFAULT_CONFIG } from '../core/Config.js';

export type BossPhase = 'idle' | 'warning' | 'attacking' | 'defeated';

export interface BossInitOptions {
  maxHp?: number;
  initialHp?: number;
}

export class BossController {
  private _hp: number;
  private _maxHp: number;
  private _chapter: number;
  private _phase: BossPhase = 'idle';
  private _attackDurationTimer = 0;

  /**
   * @param chapter 챕터 번호 (1~5)
   * @param options 선택적 초기 체력 주입 옵션 (Issue #539)
   */
  constructor(chapter = 1, options?: BossInitOptions) {
    const { maxHp, hp } = this._resolveHp(chapter, options);
    this._chapter = chapter;
    this._maxHp = maxHp;
    this._hp = hp;
  }

  get hp(): number { return this._hp; }
  get maxHp(): number { return this._maxHp; }
  get chapter(): number { return this._chapter; }
  get phase(): BossPhase { return this._phase; }
  get isDefeated(): boolean { return this._hp <= 0; }
  get hpPercent(): number { return this._hp / this._maxHp; }
  /** 경고 중인지 (UI에서 경고 표시용) */
  get isWarning(): boolean { return this._phase === 'warning'; }
  /** 공격 중인지 (오답 반격 모션) */
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

  /** Phase B 전용 보스 마법 공격 트리거 (Issue #225) */
  triggerMagicAttack(duration = 0.5): void {
    this.triggerAttack(duration);
  }

  /**
   * 매 프레임 호출: 공격 지속 시간 관리
   * @returns 항상 false (자동 기습 공격 비활성화)
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

    return false;
  }

  /**
   * 보스에게 데미지 적용
   * @param amount 피해량
   * @param options minHp: 체력 하한선 (Phase A 비치명 피해 시 1 지정)
   */
  takeDamage(amount: number, options?: { minHp?: number }): void {
    const minHp = options?.minHp ?? 0;
    this._hp = Math.max(minHp, this._hp - amount);
    if (this._hp <= 0) {
      this._phase = 'defeated';
    }
  }

  /**
   * 비치명 피해 적용 (Phase A 전용, 최소 HP 1 보장)
   */
  takeNonLethalDamage(amount: number, minHp = 1): void {
    this.takeDamage(amount, { minHp });
  }

  /**
   * 초기화
   * @param chapter 변경할 챕터 번호 (생략 시 현재 챕터 유지)
   * @param options 선택적 초기 체력 주입 옵션 (Issue #539)
   */
  reset(chapter?: number, options?: BossInitOptions): void {
    const nextChapter = chapter !== undefined ? chapter : this._chapter;
    const { maxHp, hp } = this._resolveHp(nextChapter, options);
    this._chapter = nextChapter;
    this._maxHp = maxHp;
    this._hp = hp;
    this._phase = 'idle';
    this._attackDurationTimer = 0;
  }

  /**
   * 챕터 및 옵션에 따른 HP/maxHp 결정 및 유효성 검증
   */
  private _resolveHp(chapter: number, options?: BossInitOptions): { maxHp: number; hp: number } {
    if (options !== undefined) {
      if (options.maxHp !== undefined) {
        if (typeof options.maxHp !== 'number' || !Number.isFinite(options.maxHp) || options.maxHp <= 0) {
          throw new Error(`[BossController] Invalid maxHp: ${options.maxHp}. Must be a positive finite number.`);
        }
      }
      if (options.initialHp !== undefined) {
        if (typeof options.initialHp !== 'number' || !Number.isFinite(options.initialHp) || options.initialHp <= 0) {
          throw new Error(`[BossController] Invalid initialHp: ${options.initialHp}. Must be a positive finite number.`);
        }
      }
    }

    const defaultMaxHp = chapter === 5
      ? DEFAULT_CONFIG.battle.bossHpNightmare
      : DEFAULT_CONFIG.battle.bossHpNormal;

    const maxHp = options?.maxHp !== undefined ? options.maxHp : defaultMaxHp;
    const hp = options?.initialHp !== undefined ? Math.min(options.initialHp, maxHp) : maxHp;

    return { maxHp, hp };
  }
}
