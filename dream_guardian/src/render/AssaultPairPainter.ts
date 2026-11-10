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

export class AssaultPairPainter {
  private readonly _config: AssaultVisualConfig;

  constructor(config?: AssaultVisualConfig) {
    this._config = config ?? DEFAULT_ASSAULT_VISUAL_CONFIG;
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

    return {
      leftTarget: {
        x: leftTargetAnchor.x,
        y: leftTargetAnchor.y,
        radius: leftTargetAnchor.radius,
      },
      rightTarget: {
        x: rightTargetAnchor.x,
        y: rightTargetAnchor.y,
        radius: rightTargetAnchor.radius,
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

    // 투영 계산 (NoteProjection 공용 모듈 소비)
    const flightLeft = projectFlight(
      anchors.leftLaunch.x,
      anchors.leftLaunch.y,
      anchors.leftTarget.x,
      anchors.leftTarget.y,
      progress,
      { minScale: 0.45, maxScale: 1.0, easingExponent: 2.0 },
    );

    const flightRight = projectFlight(
      anchors.rightLaunch.x,
      anchors.rightLaunch.y,
      anchors.rightTarget.x,
      anchors.rightTarget.y,
      progress,
      { minScale: 0.45, maxScale: 1.0, easingExponent: 2.0 },
    );

    const choiceCard = (cfg as any).choiceCard ?? (cfg as any).choiceCardLayout;
    const colors = (cfg as any).colors ?? (cfg as any).colorPalette;

    const baseCardWidth = choiceCard.widthRatio * vw;
    const baseCardHeight = choiceCard.heightRatio * vh;

    ctx.save();

    // ─── 1. 타깃 착지 영역 가이드 및 어프로치 링 ───
    this._renderTargetZones(ctx, anchors, baseCardWidth, baseCardHeight, progress, status, colors);

    // ─── 2. 좌우 연결 선 (하나의 논리 조우임을 나타냄) ───
    this._renderPairConnection(ctx, flightLeft, flightRight, status, colors);

    // ─── 3. 좌측 답안 카드/탄환 렌더링 ───
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
    );

    // ─── 4. 우측 답안 카드/탄환 렌더링 ───
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
  ): void {
    const isNegated = status === 'negated' || status === 'disarmed' || status === 'cancelled';
    if (isNegated) {
      return;
    }

    const approachScale = computeApproachScale(progress, 1.8, 1.0);

    ctx.save();
    ctx.setLineDash?.([6, 6]);
    ctx.lineWidth = 2;

    // 좌측 타깃 박스
    ctx.strokeStyle = colors.leftChoice;
    this._drawRectOrRoundRect(
      ctx,
      anchors.leftTarget.x - cardWidth / 2,
      anchors.leftTarget.y - cardHeight / 2,
      cardWidth,
      cardHeight,
      8,
    );
    ctx.stroke();

    // 우측 타깃 박스
    ctx.strokeStyle = colors.rightChoice;
    this._drawRectOrRoundRect(
      ctx,
      anchors.rightTarget.x - cardWidth / 2,
      anchors.rightTarget.y - cardHeight / 2,
      cardWidth,
      cardHeight,
      8,
    );
    ctx.stroke();

    // 어프로치 링 (진행도에 따라 수축)
    if (progress > 0.05 && progress < 0.98) {
      ctx.lineWidth = 1.5;
      const ringW_L = cardWidth * approachScale;
      const ringH_L = cardHeight * approachScale;
      ctx.strokeStyle = colors.leftChoice;
      this._drawRectOrRoundRect(
        ctx,
        anchors.leftTarget.x - ringW_L / 2,
        anchors.leftTarget.y - ringH_L / 2,
        ringW_L,
        ringH_L,
        8,
      );
      ctx.stroke();

      const ringW_R = cardWidth * approachScale;
      const ringH_R = cardHeight * approachScale;
      ctx.strokeStyle = colors.rightChoice;
      this._drawRectOrRoundRect(
        ctx,
        anchors.rightTarget.x - ringW_R / 2,
        anchors.rightTarget.y - ringH_R / 2,
        ringW_R,
        ringH_R,
        8,
      );
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

    if (isNegated) {
      ctx.strokeStyle = colors.perfectGlow;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      ctx.setLineDash?.([4, 8]);
    } else if (isWrong) {
      ctx.strokeStyle = colors.hazardRed;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2.5;
      ctx.setLineDash?.([8, 4]);
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash?.([4, 4]);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * 개별 선택지 카드(탄환) 렌더링
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
  ): void {
    ctx.save();

    const isNegated = status === 'negated' || status === 'disarmed' || status === 'cancelled';
    const isWrongSide = (status === 'wrong_locked' || status === 'wrong_hit') &&
      (!lockedSide || lockedSide === side);
    const isTimeout = status === 'timeout';

    let strokeColor = side === 'left' ? colors.leftChoice : colors.rightChoice;
    let fillColor = 'rgba(20, 24, 38, 0.85)';
    let textColor = '#ffffff';

    if (isNegated) {
      ctx.globalAlpha = 0.3;
      strokeColor = colors.perfectGlow;
      fillColor = 'rgba(0, 255, 136, 0.15)';
      textColor = 'rgba(255, 255, 255, 0.5)';
    } else if (isWrongSide) {
      strokeColor = colors.hazardRed;
      fillColor = 'rgba(255, 77, 77, 0.3)';
      textColor = colors.hazardRed;
      ctx.shadowColor = colors.hazardRed;
      ctx.shadowBlur = 12;
    } else if (isTimeout) {
      strokeColor = colors.hazardRed;
      fillColor = 'rgba(40, 20, 20, 0.8)';
      textColor = 'rgba(255, 100, 100, 0.8)';
    }

    // 카드 배경 및 테두리
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isWrongSide ? 3.5 : 2.5;

    const x = cx - width / 2;
    const y = cy - height / 2;
    const radius = Math.min(12, height * 0.2);

    this._drawRectOrRoundRect(ctx, x, y, width, height, radius);
    ctx.fill();
    ctx.stroke();

    // 텍스트 라벨 렌더링
    const scaleFactor = viewportWidth / 1280;
    const fontSize = Math.max(14, Math.round(28 * scaleFactor * (width / (widthRatio * viewportWidth))));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(text, cx, cy);

    // 무효화/해체 태그 표시 (A05)
    if (isNegated) {
      ctx.font = `bold ${Math.max(10, Math.round(12 * scaleFactor))}px sans-serif`;
      ctx.fillStyle = colors.perfectGlow;
      ctx.fillText('DISARMED', cx, cy + height * 0.35);
    }

    ctx.restore();
  }

  /**
   * roundRect 지원 여부에 따른 안전한 사각형 드로잉
   */
  private _drawRectOrRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }
}
