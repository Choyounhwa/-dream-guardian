/**
 * QuestionApproachRenderer - 문제 출제 첫 2박 원근 접근(소실점 → 정면) 연출 렌더러
 *
 * Issue #212 (RENDER-QUESTION-APPROACH-001):
 * - 문제 출제 첫 2박 동안 소실점(vanishingX, vanishingY)에서 정면 목표 좌표로 서서히 접근
 * - 진행도 t(0~1)에 따라 ease-out 감속 보간, 크기 스케일(0.15 → 1.0), 투명도(0.10 → 1.0) 제어
 * - t=1.0 도달 이후 및 6박 동안은 픽셀 왜곡 없이 정면 렌더링 유지
 */

import { renderQuestionHeaderMath } from './QuestionRenderer.js';
import {
  DEFAULT_QUESTION_APPROACH_CONFIG,
  type QuestionApproachConfig,
} from '../../config/beat-motion.config.js';

export interface QuestionApproachState {
  /** 접근 진행도 (0.0: 소실점 ~ 1.0: 정면 완전 도달) */
  progress: number;
  /** 소실점 X 좌표 */
  vanishingX: number;
  /** 소실점 Y 좌표 */
  vanishingY: number;
}

export interface QuestionApproachTransform {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  easedProgress: number;
}

export class QuestionApproachRenderer {
  private readonly _config: QuestionApproachConfig;

  constructor(config?: Partial<QuestionApproachConfig>) {
    this._config = {
      ...DEFAULT_QUESTION_APPROACH_CONFIG,
      ...config,
    };
  }

  get config(): QuestionApproachConfig {
    return this._config;
  }

  /**
   * 진행도(t)에 따른 변환 수치(x, y, scale, alpha, easedProgress) 계산
   */
  computeTransform(
    progress: number,
    targetX: number,
    targetY: number,
    vanishingX: number,
    vanishingY: number,
  ): QuestionApproachTransform {
    const rawClamped = Math.max(0, Math.min(1.0, progress));

    if (rawClamped >= 1.0) {
      return {
        x: targetX,
        y: targetY,
        scale: 1.0,
        alpha: 1.0,
        easedProgress: 1.0,
      };
    }

    // Ease-out 보간 (기본 quadratic: 1 - (1 - t)^p)
    const eased = 1.0 - Math.pow(1.0 - rawClamped, this._config.easePower);

    const x = vanishingX + (targetX - vanishingX) * eased;
    const y = vanishingY + (targetY - vanishingY) * eased;
    const scale = this._config.minScale + (1.0 - this._config.minScale) * eased;
    const alpha = this._config.startAlpha + (1.0 - this._config.startAlpha) * eased;

    return {
      x,
      y,
      scale,
      alpha,
      easedProgress: eased,
    };
  }

  /**
   * 문제 수식 원근 접근 렌더링
   * @param ctx CanvasRenderingContext2D
   * @param questionText 문제 텍스트
   * @param targetX 정면 목표 중심 X
   * @param targetY 정면 목표 중심 Y
   * @param baseScaleX 화면 비율 scaleX
   * @param state 접근 상태 (progress, vanishingX, vanishingY)
   * @param isRunningPhase 러닝 헤더 규격 여부 (기본 true)
   */
  render(
    ctx: CanvasRenderingContext2D,
    questionText: string,
    targetX: number,
    targetY: number,
    baseScaleX: number,
    state: QuestionApproachState,
    isRunningPhase: boolean = true,
  ): void {
    const t = this.computeTransform(
      state.progress,
      targetX,
      targetY,
      state.vanishingX,
      state.vanishingY,
    );

    // t=1.0(완전 도달) 시점에는 변환 행렬 적용 없이 기존 렌더링 직접 호출 (100% 픽셀 동일성 보장)
    if (t.scale >= 1.0 && t.alpha >= 1.0 && t.x === targetX && t.y === targetY) {
      renderQuestionHeaderMath(ctx, questionText, targetX, targetY, baseScaleX, isRunningPhase);
      return;
    }

    // t < 1.0 접근 구간: 위치 이동 및 원근 축소/투명도 변환 적용
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, t.alpha));

    // 중심점 기준 스케일 적용
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);

    // (0, 0)을 중심으로 렌더링
    renderQuestionHeaderMath(ctx, questionText, 0, 0, baseScaleX, isRunningPhase);

    ctx.restore();
  }
}
