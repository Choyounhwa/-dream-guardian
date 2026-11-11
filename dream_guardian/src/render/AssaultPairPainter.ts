/**
 * AssaultPairPainter.ts - 보스 접근전(Boss Assault) 답 쌍 순수 캔버스 페인터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.4, 6.7, 11.1, A05, A06)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-19 / Issue #521)
 *
 * 절대 규칙:
 * 1. Render 단일 책임: 답 쌍(좌/우 보기)의 궤적, 앵커, 박스, 라벨 및 상태를 화면에 그리기만 한다.
 * 2. 읽기 전용 불변성: 전달받은 snapshot, config, viewport를 절대 수정하지 않는다.
 * 3. 부작용 0건: HP 계산 0회, 정답 판정 0회, 타이머 소유 0회, DOM 리스너 0회.
 * 4. 공용 앵커 일치: 좌/우 착지 앵커는 NoteAnchorResolver(zone 4, zone 5)와 100% 동일한 수치를 소비한다.
 * 5. 논리 pair 일체성: 좌/우 답안을 연결하는 시각 표시(에너지 선/궤적)를 그려 하나의 조우임을 알린다.
 */

import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
  type AssaultVisualConfig,
} from '../../config/assault-visual.config.js';
import type { AssaultImpactVFX } from './assault/AssaultImpactVFX.js';
import {
  resolveAnchor,
  type ViewportSize,
} from './NoteAnchorResolver.js';
import {
  projectFlight,
  computeApproachScale,
} from './NoteProjection.js';

export type AssaultPairVisualStatus =
  | 'pending'
  | 'inFlight'
  | 'flying'
  | 'negated'
  | 'disarmed'
  | 'cancelled'
  | 'wrong_hit'
  | 'wrong_locked'
  | 'timeout'
  | 'hit'
  | 'miss';

export interface AssaultPairRenderSnapshot {
  readonly pairId?: string;
  readonly attackId?: string;
  readonly leftText: string;
  readonly rightText: string;
  readonly progress?: number; // 0.0 (발사) ~ 1.0 (착지)
  readonly status?: AssaultPairVisualStatus;
  readonly lockedSide?: 'left' | 'right' | null;
}

export interface AssaultPairAnchors {
  readonly leftTarget: { x: number; y: number; radius: number };
  readonly rightTarget: { x: number; y: number; radius: number };
  readonly leftLaunch: { x: number; y: number };
  readonly rightLaunch: { x: number; y: number };
}

export interface AssaultPairPainterOptions {
  impactVFX?: AssaultImpactVFX;
}

export class AssaultPairPainter {
  private readonly _config: AssaultVisualConfig;
  private _impactVFX?: AssaultImpactVFX;

  constructor(config?: AssaultVisualConfig, options?: AssaultPairPainterOptions) {
    this._config = config ?? DEFAULT_ASSAULT_VISUAL_CONFIG;
    this._impactVFX = options?.impactVFX;
  }

  public get impactVFX(): AssaultImpactVFX | undefined {
    return this._impactVFX;
  }

  public setImpactVFX(impactVFX?: AssaultImpactVFX): void {
    this._impactVFX = impactVFX;
  }

  /**
   * 답안 카드의 최종 착지 반지름 산출 (단일 진실 공급원 SSOT)
   */
  getFinalChoiceRadius(viewport: ViewportSize, configOverride?: AssaultVisualConfig): number {
    const cfg = configOverride ?? this._config;
    const vw = viewport.width || 1280;
    const vh = viewport.height || 720;
    const cardWidth = cfg.choiceCard.widthRatio * vw;
    const cardHeight = cfg.choiceCard.heightRatio * vh;
    const circleRatio = cfg.choiceCardCircleRatio ?? 0.46;
    return Math.min(cardWidth, cardHeight) * circleRatio;
  }

  /**
   * 공용 판정 앵커(NoteAnchorResolver) 및 발사 좌표 산출
   */
  getAnchors(viewport: ViewportSize, configOverride?: AssaultVisualConfig): AssaultPairAnchors {
    const cfg = configOverride ?? this._config;
    const vw = viewport.width || 1280;
    const vh = viewport.height || 720;

    const leftTargetAnchor = resolveAnchor({ part: 'leftHand', zoneId: 4 }, viewport);
    const rightTargetAnchor = resolveAnchor({ part: 'rightHand', zoneId: 5 }, viewport);

    const leftLaunch = {
      x: cfg.projectileLaunchRatios.left.x * vw,
      y: cfg.projectileLaunchRatios.left.y * vh,
    };
    const rightLaunch = {
      x: cfg.projectileLaunchRatios.right.x * vw,
      y: cfg.projectileLaunchRatios.right.y * vh,
    };

    const finalRadius = this.getFinalChoiceRadius(viewport, cfg);

    return {
      leftTarget: {
        x: leftTargetAnchor.x,
        y: leftTargetAnchor.y,
        radius: finalRadius,
      },
      rightTarget: {
        x: rightTargetAnchor.x,
        y: rightTargetAnchor.y,
        radius: finalRadius,
      },
      leftLaunch,
      rightLaunch,
    };
  }

  /**
   * 답 쌍 캔버스 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    pair: AssaultPairRenderSnapshot,
    viewport: ViewportSize,
    configOverride?: AssaultVisualConfig,
  ): void {
    if (!ctx || !pair) {
      return;
    }

    const cfg = configOverride ?? this._config;
    const vw = viewport.width || 1280;
    const vh = viewport.height || 720;
    const anchors = this.getAnchors(viewport, cfg);

    const rawProgress = pair.progress ?? 0;
    const progress = Math.max(0, Math.min(1.0, rawProgress));
    const status: AssaultPairVisualStatus = pair.status ?? 'inFlight';

    const minScale = (cfg as any)?.projectileMinScale ?? 0.45;
    const maxScale = (cfg as any)?.projectileMaxScale ?? 1.0;
    const easingExponent = (cfg as any)?.projectileEasingExponent ?? 2.0;

    // 투영 계산 (NoteProjection 공용 모듈 소비)
    const flightLeft = projectFlight(
      anchors.leftLaunch.x,
      anchors.leftLaunch.y,
      anchors.leftTarget.x,
      anchors.leftTarget.y,
      progress,
      { minScale, maxScale, easingExponent },
    );

    const flightRight = projectFlight(
      anchors.rightLaunch.x,
      anchors.rightLaunch.y,
      anchors.rightTarget.x,
      anchors.rightTarget.y,
      progress,
      { minScale, maxScale, easingExponent },
    );

    const choiceCard = (cfg as any).choiceCard ?? (cfg as any).choiceCardLayout;
    const colors = (cfg as any).colors ?? (cfg as any).colorPalette;

    const baseCardWidth = choiceCard.widthRatio * vw;
    const baseCardHeight = choiceCard.heightRatio * vh;

    ctx.save();

    // ─── 1. 타깃 착지 영역 가이드 및 어프로치 링 ───
    this._renderTargetZones(ctx, anchors, baseCardWidth, baseCardHeight, progress, status, colors, cfg);

    // ─── 2. 좌우 연결 선 (하나의 논리 조우임을 나타냄) ───
    this._renderPairConnection(ctx, flightLeft, flightRight, status, colors);

    // ─── 2.5 원형 답안 줌인 비행 원근 속도감 Trail (고스트 잔상) (ASSAULT-TRAIL-001) ───
    this._renderApproachTrail(ctx, anchors, baseCardWidth, baseCardHeight, progress, status, colors, cfg);

    // ─── 3. 좌측 답안 원형 카드 렌더링 ───
    this._renderChoiceCard(
      ctx,
      pair.leftText,
      flightLeft.x,
      flightLeft.y,
      baseCardWidth * flightLeft.scale,
      baseCardHeight * flightLeft.scale,
      'left',
      status,
      pair.lockedSide,
      colors,
      choiceCard.widthRatio,
      vw,
      cfg,
      progress,
    );

    // ─── 4. 우측 답안 원형 카드 렌더링 ───
    this._renderChoiceCard(
      ctx,
      pair.rightText,
      flightRight.x,
      flightRight.y,
      baseCardWidth * flightRight.scale,
      baseCardHeight * flightRight.scale,
      'right',
      status,
      pair.lockedSide,
      colors,
      choiceCard.widthRatio,
      vw,
      cfg,
      progress,
    );

    ctx.restore();
  }

  /**
   * 착지 목표 구역 및 어프로치 링 렌더링
   */
  private _renderTargetZones(
    ctx: CanvasRenderingContext2D,
    anchors: AssaultPairAnchors,
    cardWidth: number,
    cardHeight: number,
    progress: number,
    status: AssaultPairVisualStatus,
    colors: any,
    cfg?: AssaultVisualConfig,
  ): void {
    const isNegated = status === 'negated' || status === 'disarmed' || status === 'cancelled';
    if (isNegated) {
      return;
    }

    const maxScale = (cfg as any)?.approachRingMaxScale ?? 2.0;
    const approachScale = computeApproachScale(progress, maxScale, 1.0);

    ctx.save();

    const targetScale = cfg?.targetReceptorScale ?? 1.0;
    const circleRatio = cfg?.choiceCardCircleRatio ?? 0.46;

    const baseRadiusL =
      anchors.leftTarget.radius > 0
        ? anchors.leftTarget.radius
        : Math.min(cardWidth, cardHeight) * circleRatio;
    const baseRadiusR =
      anchors.rightTarget.radius > 0
        ? anchors.rightTarget.radius
        : Math.min(cardWidth, cardHeight) * circleRatio;

    const radiusL = baseRadiusL * targetScale;
    const radiusR = baseRadiusR * targetScale;

    // ─── 1. 고정 기준 판정 링 (Hit Receptor) ───
    // 착지 직전(progress >= 0.88)에는 저스트 타이밍 플래시(백색 강렬한 발광) 적용!
    const isJustTiming = progress >= 0.88 && progress <= 1.0;
    const flashColor = '#FFFFFF';

    ctx.lineWidth = isJustTiming ? 3.5 : 2.0;
    ctx.setLineDash?.([]); // 네모난 점선 틀 제거: 세련된 실선 네온 링

    // 좌측 기준 링
    ctx.strokeStyle = isJustTiming ? flashColor : colors.leftChoice;
    ctx.shadowColor = isJustTiming ? flashColor : colors.leftChoice;
    ctx.shadowBlur = isJustTiming ? 16 : 8;
    ctx.beginPath();
    ctx.arc?.(anchors.leftTarget.x, anchors.leftTarget.y, radiusL, 0, Math.PI * 2);
    ctx.stroke();

    // 우측 기준 링
    ctx.strokeStyle = isJustTiming ? flashColor : colors.rightChoice;
    ctx.shadowColor = isJustTiming ? flashColor : colors.rightChoice;
    ctx.shadowBlur = isJustTiming ? 16 : 8;
    ctx.beginPath();
    ctx.arc?.(anchors.rightTarget.x, anchors.rightTarget.y, radiusR, 0, Math.PI * 2);
    ctx.stroke();

    // ─── 2. 수축 어프로치 링 (Shrinking Approach Ring / 핵심 타이밍 게이지) ───
    // 2.0배에서 시작하여 progress 1.0일 때 기준 링과 1:1로 정확히 포개어짐
    if (progress > 0.05 && progress < 0.98) {
      ctx.lineWidth = 2.0;
      ctx.setLineDash?.([]);

      const ringRadiusL = radiusL * approachScale;
      ctx.strokeStyle = colors.leftChoice;
      ctx.shadowColor = colors.leftChoice;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc?.(anchors.leftTarget.x, anchors.leftTarget.y, ringRadiusL, 0, Math.PI * 2);
      ctx.stroke();

      const ringRadiusR = radiusR * approachScale;
      ctx.strokeStyle = colors.rightChoice;
      ctx.shadowColor = colors.rightChoice;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc?.(anchors.rightTarget.x, anchors.rightTarget.y, ringRadiusR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 좌우 답을 연결하는 에너지 빔 / 궤적선 렌더링
   */
  private _renderPairConnection(
    ctx: CanvasRenderingContext2D,
    leftPos: { x: number; y: number },
    rightPos: { x: number; y: number },
    status: AssaultPairVisualStatus,
    colors: any,
  ): void {
    const isNegated = status === 'negated' || status === 'disarmed' || status === 'cancelled';
    const isWrong = status === 'wrong_locked' || status === 'wrong_hit';

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(leftPos.x, leftPos.y);
    ctx.lineTo(rightPos.x, rightPos.y);

    // [ASSAULT-VIS-CARD-001]: 투박한 점선 대신 은은한 극저투명도(0.12) 소프트 연결선 적용
    ctx.setLineDash?.([]);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = isNegated ? colors.perfectGlow : (isWrong ? colors.hazardRed : 'rgba(255, 255, 255, 0.2)');
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 원형 답안 줌인 비행 원근 속도감 Trail(고스트 잔상) 효과 렌더링 (ASSAULT-TRAIL-001)
   */
  private _renderApproachTrail(
    ctx: CanvasRenderingContext2D,
    anchors: AssaultPairAnchors,
    baseCardWidth: number,
    baseCardHeight: number,
    progress: number,
    status: AssaultPairVisualStatus,
    colors: any,
    cfg?: AssaultVisualConfig,
    side?: 'left' | 'right',
  ): void {
    // 착지 완료(progress >= 1.0) 또는 대기 중(progress <= 0), 또는 비행 상태가 아닐 때 연산 및 드로잉 0회 (Zero Overhead)
    if (progress <= 0 || progress >= 1.0) {
      return;
    }
    const isNonFlight =
      status === 'negated' ||
      status === 'disarmed' ||
      status === 'cancelled' ||
      status === 'hit' ||
      status === 'miss' ||
      status === 'timeout' ||
      status === 'pending';
    if (isNonFlight) {
      return;
    }

    const ghostCfg = (cfg as any)?.ghostTrail ?? DEFAULT_ASSAULT_VISUAL_CONFIG.ghostTrail;
    if (ghostCfg?.enabled === false) {
      return;
    }

    const stepOffsets: readonly number[] = ghostCfg?.stepOffsets ?? [0.035, 0.070, 0.105];
    const alphas: readonly number[] = ghostCfg?.alphas ?? [0.28, 0.20, 0.12];

    const minScale = (cfg as any)?.projectileMinScale ?? 0.45;
    const maxScale = (cfg as any)?.projectileMaxScale ?? 1.0;
    const easingExponent = (cfg as any)?.projectileEasingExponent ?? 2.0;
    const circleRatio = cfg?.choiceCardCircleRatio ?? 0.46;

    ctx.save();

    for (let i = 0; i < stepOffsets.length; i++) {
      const offset = stepOffsets[i];
      const ghostProgress = progress - offset;
      if (ghostProgress <= 0) {
        continue;
      }
      const alpha = alphas[i] ?? 0.15;
      ctx.globalAlpha = alpha;

      // 좌측 답안 잔상 (시안 고스트 펄스 링)
      if (!side || side === 'left') {
        const flightLeft = projectFlight(
          anchors.leftLaunch.x,
          anchors.leftLaunch.y,
          anchors.leftTarget.x,
          anchors.leftTarget.y,
          ghostProgress,
          { minScale, maxScale, easingExponent },
        );
        const radiusL = Math.min(baseCardWidth * flightLeft.scale, baseCardHeight * flightLeft.scale) * circleRatio;

        ctx.lineWidth = 2.0;
        ctx.strokeStyle = colors.leftChoice;
        ctx.shadowColor = colors.leftChoice;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc?.(flightLeft.x, flightLeft.y, radiusL, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 우측 답안 잔상 (보라 고스트 펄스 링)
      if (!side || side === 'right') {
        const flightRight = projectFlight(
          anchors.rightLaunch.x,
          anchors.rightLaunch.y,
          anchors.rightTarget.x,
          anchors.rightTarget.y,
          ghostProgress,
          { minScale, maxScale, easingExponent },
        );
        const radiusR = Math.min(baseCardWidth * flightRight.scale, baseCardHeight * flightRight.scale) * circleRatio;

        ctx.lineWidth = 2.0;
        ctx.strokeStyle = colors.rightChoice;
        ctx.shadowColor = colors.rightChoice;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc?.(flightRight.x, flightRight.y, radiusR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * 개별 선택지 카드(원형 펄스 탄환) 렌더링
   */
  private _renderChoiceCard(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    cy: number,
    width: number,
    height: number,
    side: 'left' | 'right',
    status: AssaultPairVisualStatus,
    lockedSide: 'left' | 'right' | null | undefined,
    colors: any,
    widthRatio: number,
    viewportWidth: number,
    cfg?: AssaultVisualConfig,
    progress: number = 1.0,
  ): void {
    ctx.save();

    // 점진적 투명도(Fade-in) 출현 (10% -> 100%)
    // 정답 활성화(착지) 전까지 투명도 0.10에서 차츰 짙어지도록 설정
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const fadeAlpha = 0.10 + 0.90 * clampedProgress;
    ctx.globalAlpha = fadeAlpha;

    const poppingScale = this._impactVFX?.getPoppingScale(side) ?? 1.0;
    if (poppingScale !== 1.0) {
      ctx.translate(cx, cy);
      ctx.scale(poppingScale, poppingScale);
      ctx.translate(-cx, -cy);
    }

    const isNegated = status === 'negated' || status === 'disarmed' || status === 'cancelled';
    const isWrongSide = (status === 'wrong_locked' || status === 'wrong_hit') &&
      (!lockedSide || lockedSide === side);
    const isTimeout = status === 'timeout';

    let strokeColor = side === 'left' ? colors.leftChoice : colors.rightChoice;
    let fillColor = 'rgba(20, 24, 38, 0.85)';
    let textColor = '#ffffff';

    if (isNegated) {
      const isPopping = poppingScale > 1.02;
      ctx.globalAlpha = isPopping
        ? ctx.globalAlpha * Math.min(1.0, 0.4 + (poppingScale - 1.0) * 1.5)
        : ctx.globalAlpha * 0.3;
      strokeColor = colors.perfectGlow;
      fillColor = isPopping ? 'rgba(0, 255, 136, 0.35)' : 'rgba(0, 255, 136, 0.15)';
      textColor = isPopping ? '#00FF88' : 'rgba(255, 255, 255, 0.5)';
      if (isPopping) {
        ctx.shadowColor = colors.perfectGlow;
        ctx.shadowBlur = Math.min(32, 16 + (poppingScale - 1.0) * 30);
      }
    } else if (isWrongSide) {
      const isPopping = poppingScale > 1.02;
      strokeColor = colors.hazardRed;
      fillColor = isPopping ? 'rgba(255, 77, 77, 0.5)' : 'rgba(255, 77, 77, 0.3)';
      textColor = colors.hazardRed;
      ctx.shadowColor = colors.hazardRed;
      ctx.shadowBlur = isPopping ? Math.min(32, 20 + (poppingScale - 1.0) * 30) : 16;
    } else if (isTimeout) {
      strokeColor = colors.hazardRed;
      fillColor = 'rgba(40, 20, 20, 0.8)';
      textColor = 'rgba(255, 100, 100, 0.8)';
    }

    // ─── 원형 두꺼운 펄스 테두리 드로잉 ───
    const circleRatio = cfg?.choiceCardCircleRatio ?? 0.46;
    const circleRadius = Math.min(width, height) * circleRatio;
    const pulseFactor = (Math.sin(clampedProgress * Math.PI * 4) + 1) * 0.5; // 0.0 ~ 1.0
    const borderWidth = isWrongSide ? 5.5 : 4.5 + pulseFactor * 1.5; // 항상 4.5 ~ 6.0px 두꺼운 펄스

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = borderWidth;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = isWrongSide ? 16 : 14;

    ctx.beginPath();
    ctx.arc?.(cx, cy, Math.max(1, circleRadius), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 텍스트 라벨 렌더링 (원형 내부에 맞춘 폰트 크기 적용)
    const scaleFactor = viewportWidth / 1280;
    const baseQuestionSize = (cfg as any)?.questionFontSizePx ?? 100;
    const fontScaleRatio = (cfg as any)?.choiceFontScaleRatio ?? (100 / 100);
    const baseChoiceFontSize = (cfg as any)?.choiceBaseFontSizePx ?? Math.round(baseQuestionSize * fontScaleRatio);
    const minFontSize = (cfg as any)?.labelMinFontSizePx ?? 20;

    const flightScale = width / (widthRatio * viewportWidth);
    let fontSize = Math.max(minFontSize, Math.round(baseChoiceFontSize * scaleFactor * flightScale));

    // 원형 경계 대비 텍스트 폭 안전 수용
    const maxAllowedWidth = circleRadius * 1.6;
    ctx.font = `bold ${fontSize}px sans-serif`;
    if (typeof ctx.measureText === 'function') {
      const measured = ctx.measureText(text).width;
      if (measured > maxAllowedWidth && measured > 0) {
        fontSize = Math.max(minFontSize, Math.round(fontSize * (maxAllowedWidth / measured)));
        ctx.font = `bold ${fontSize}px sans-serif`;
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(text, cx, cy);

    // 무효화/해체 태그 표시 (A05)
    if (isNegated) {
      ctx.font = `bold ${Math.max(10, Math.round(12 * scaleFactor))}px sans-serif`;
      ctx.fillStyle = colors.perfectGlow;
      ctx.fillText('DISARMED', cx, cy + circleRadius * 0.5);
    }

    ctx.restore();
  }
}
