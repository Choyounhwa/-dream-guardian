/**
 * AdaptiveTolerance.ts - 니어미스(Near Miss) 기반 적응형 관용 및 일시적 완화 관리자
 *
 * 판정 임계치에 근소하게 미달한 니어미스(threshold * 0.85 <= score < threshold)를 추적하고,
 * 3회 연속 니어미스 시 최대 20%까지 마진 및 관용치를 점진적으로 완화(+7%/step)하며,
 * 성공 1회 발생 시 즉시 원복(1.0배)하는 세션 내 적응형 난이도 보정 엔진.
 *
 * @see Issue #254 [INPUT-TOLERANCE-006]
 */

import {
  DEFAULT_ADAPTIVE_TOLERANCE_CONFIG,
  type AdaptiveToleranceConfig,
} from '../../config/judgment.config.js';

export interface AttemptResult {
  isNearMiss: boolean;
  isSuccess: boolean;
  multiplier: number;
}

export class AdaptiveToleranceTracker {
  private _config: AdaptiveToleranceConfig;
  private _nearMissStreak = 0;
  private _currentRelaxRatio = 0;

  constructor(config?: Partial<AdaptiveToleranceConfig>) {
    this._config = {
      ...DEFAULT_ADAPTIVE_TOLERANCE_CONFIG,
      ...config,
    };
  }

  get config(): AdaptiveToleranceConfig {
    return this._config;
  }

  get nearMissStreak(): number {
    return this._nearMissStreak;
  }

  get multiplier(): number {
    return 1.0 + this._currentRelaxRatio;
  }

  get isRelaxed(): boolean {
    return this._currentRelaxRatio > 0;
  }

  /**
   * 시도 점수 기록 및 완화 배율 계산
   */
  recordAttempt(score: number, threshold = 0.70): AttemptResult {
    if (!this._config.enableAdaptiveTolerance) {
      return {
        isNearMiss: false,
        isSuccess: score >= threshold,
        multiplier: 1.0,
      };
    }

    // 1. 성공 시 즉시 원복
    if (score >= threshold) {
      this._nearMissStreak = 0;
      this._currentRelaxRatio = 0;
      return {
        isNearMiss: false,
        isSuccess: true,
        multiplier: 1.0,
      };
    }

    // 2. 니어미스 (threshold * nearMissRatio <= score < threshold)
    if (score >= threshold * this._config.nearMissRatio) {
      this._nearMissStreak++;

      if (this._nearMissStreak >= this._config.nearMissStreakThreshold) {
        const extraSteps = this._nearMissStreak - this._config.nearMissStreakThreshold + 1;
        this._currentRelaxRatio = Math.min(
          this._config.maxRelaxRatio,
          extraSteps * this._config.stepRelaxRatio
        );
      }

      return {
        isNearMiss: true,
        isSuccess: false,
        multiplier: 1.0 + this._currentRelaxRatio,
      };
    }

    // 3. 완전 실패 (score < threshold * nearMissRatio)
    // 스트릭을 리셋하되 이미 적용된 완화는 라운드 전환 또는 성공 시까지 유지
    this._nearMissStreak = 0;
    return {
      isNearMiss: false,
      isSuccess: false,
      multiplier: 1.0 + this._currentRelaxRatio,
    };
  }

  /**
   * 라운드/문제 전환 시 리셋
   */
  onRoundChange(): void {
    if (this._config.resetOnRoundChange) {
      this.reset();
    }
  }

  /**
   * 상태 완전 초기화
   */
  reset(): void {
    this._nearMissStreak = 0;
    this._currentRelaxRatio = 0;
  }
}
