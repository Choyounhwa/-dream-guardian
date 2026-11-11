/**
 * QuestionApproachRenderer - 문제 출제 첫 2박 원근 접근(소실점 → 정면) 연출 렌더러
 *
 * Issue #212 (RENDER-QUESTION-APPROACH-001):
 * - 문제 출제 첫 2박 동안 소실점(vanishingX, vanishingY)에서 정면 목표 좌표로 서서히 접근
 * - 진행도 t(0~1)에 따라 ease-out 감속 보간, 크기 스케일(0.15 → 1.0), 투명도(0.10 → 1.0) 제어
 * - t=1.0 도달 이후 및 6박 동안은 픽셀 왜곡 없이 정면 렌더링 유지
 *
 * Issue #445 (UI-VIS-015):
 * - 선택적 표시 컨텍스트(QuestionPresentationContext) 주입 및 bounds 조회 지원
 * - getHeaderBounds, getChoiceButtonBounds 지원
 * - 결정론적 renderFixture (인스턴스 및 정적) 지원
 */

import {
  renderQuestionHeaderMath,
  QuestionRenderer,
  type QuestionPresentationContext,
  type QuestionBounds,
  type QuestionHeaderMathOptions,
} from './QuestionRenderer.js';
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

export interface QuestionApproachFixtureDTO {
  questionText: string;
  progress?: number;
  vanishingX?: number;
  vanishingY?: number;
  shapeCode?: string | null;
  hasShape?: boolean;
}

export interface QuestionApproachTransform {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  blur: number;
  brightness: number;
  easedProgress: number;
}

export class QuestionApproachRenderer {
  private readonly _config: QuestionApproachConfig;
  private _presentationContext?: QuestionPresentationContext;

  constructor(
    config?: Partial<QuestionApproachConfig>,
    presentationContext?: QuestionPresentationContext,
  ) {
    this._config = {
      ...DEFAULT_QUESTION_APPROACH_CONFIG,
      ...config,
    };
    if (presentationContext) {
      this.setPresentationContext(presentationContext);
    }
  }

  get config(): QuestionApproachConfig {
    return this._config;
  }

  setPresentationContext(context?: QuestionPresentationContext): void {
    this._presentationContext = context;
  }

  getPresentationContext(): QuestionPresentationContext | undefined {
    return this._presentationContext;
  }

  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  getHeaderBounds(
    w: number,
    h: number,
    options?: { hasShape?: boolean },
  ): QuestionBounds {
    const renderer = new QuestionRenderer(this._presentationContext);
    return renderer.getHeaderBounds(w, h, options);
  }

  getChoiceButtonBounds(choiceIndex: 0 | 1, w: number, h: number): QuestionBounds {
    const renderer = new QuestionRenderer(this._presentationContext);
    return renderer.getChoiceButtonBounds(choiceIndex, w, h);
  }

  renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fixture: QuestionApproachFixtureDTO,
    contextOverride?: QuestionPresentationContext,
  ): void {
    const prevContext = this._presentationContext;
    if (contextOverride) {
      this._presentationContext = contextOverride;
    }
    try {
      const scaleX = w / 1080;
      const scaleY = h / 2160;
      const targetX = w / 2;
      const hasShape = Boolean(fixture.hasShape || fixture.shapeCode);
      const targetY = hasShape ? 320 * scaleY + 70 * scaleY : 320 * scaleY + 220 * scaleY;
      const state: QuestionApproachState = {
        progress: fixture.progress ?? 1.0,
        vanishingX: fixture.vanishingX ?? w / 2,
        vanishingY: fixture.vanishingY ?? h * 0.24,
      };
      this.render(ctx, fixture.questionText, targetX, targetY, scaleX, state, true, {
        hasShape,
      });
    } finally {
      this._presentationContext = prevContext;
    }
  }

  static renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fixture: QuestionApproachFixtureDTO,
    contextOverride?: QuestionPresentationContext,
  ): void {
    const renderer = new QuestionApproachRenderer(undefined, contextOverride);
    renderer.renderFixture(ctx, w, h, fixture);
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
        blur: 0,
        brightness: 1.0,
        easedProgress: 1.0,
      };
    }

    // Ease-out 보간 (기본 quadratic: 1 - (1 - t)^p)
    const eased = 1.0 - Math.pow(1.0 - rawClamped, this._config.easePower);

    const x = vanishingX + (targetX - vanishingX) * eased;
    const y = vanishingY + (targetY - vanishingY) * eased;
    const scale = this._config.minScale + (1.0 - this._config.minScale) * eased;
    const alpha = this._config.startAlpha + (1.0 - this._config.startAlpha) * eased;
    const blur = (this._config.startBlur ?? 12) * (1.0 - eased);
    const startBright = this._config.startBrightness ?? 0.40;
    const brightness = startBright + (1.0 - startBright) * eased;

    return {
      x,
      y,
      scale,
      alpha,
      blur,
      brightness,
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
   * @param options 추가 폰트/스타일 옵션
   */
  render(
    ctx: CanvasRenderingContext2D,
    questionText: string,
    targetX: number,
    targetY: number,
    baseScaleX: number,
    state: QuestionApproachState,
    isRunningPhase: boolean = true,
    options?: QuestionHeaderMathOptions,
  ): void {
    const t = this.computeTransform(
      state.progress,
      targetX,
      targetY,
      state.vanishingX,
      state.vanishingY,
    );

    const resolvedCtx = this._presentationContext;
    const mergedOptions: QuestionHeaderMathOptions = {
      ...options,
      color: resolvedCtx?.header?.color ?? options?.color,
      shadowColor: resolvedCtx?.header?.shadowColor ?? options?.shadowColor,
      shadowBlur: resolvedCtx?.header?.shadowBlur ?? options?.shadowBlur,
    };

    // t=1.0(완전 도달) 시점에는 변환 행렬 적용 없이 기존 렌더링 직접 호출 (100% 픽셀 동일성 보장)
    if (t.scale >= 1.0 && t.alpha >= 1.0 && t.x === targetX && t.y === targetY) {
      renderQuestionHeaderMath(ctx, questionText, targetX, targetY, baseScaleX, isRunningPhase, mergedOptions);
      return;
    }

    // t < 1.0 접근 구간: 위치 이동 및 원근 축소/투명도/블러/밝기 변환 적용
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, t.alpha));

    // Issue #711: 원거리 블러 및 점진적 브라이트닝 필터 적용
    if (t.blur > 0.01 || t.brightness < 0.99) {
      if ('filter' in ctx && typeof ctx.filter === 'string') {
        ctx.filter = `blur(${t.blur.toFixed(1)}px) brightness(${t.brightness.toFixed(2)})`;
      }
    }

    // 중심점 기준 스케일 적용
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);

    // (0, 0)을 중심으로 렌더링
    renderQuestionHeaderMath(ctx, questionText, 0, 0, baseScaleX, isRunningPhase, mergedOptions);

    ctx.restore();
  }
}
