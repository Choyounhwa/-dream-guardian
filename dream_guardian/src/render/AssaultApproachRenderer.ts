/**
 * AssaultApproachRenderer.ts - 보스 접근전(Boss Assault) 접근 진행도 연출 렌더러
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§10.1, 15.3-C3)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-42 / Issue #545)
 *
 * 절대 규칙:
 * 1. Render 단일 책임: 진행도(0~1)를 바탕으로 보스 스케일, 배경 시차, 접근 거리 바를 화면에 그리기만 한다.
 * 2. 멱등성(Idempotency): 동일 스냅샷에 대해 반복 렌더링해도 외부 상태 변경 0회, 내부 상태 불변.
 * 3. 부작용 0건: 게임 진행/HP 계산 0회, DOM 조작 0회, 타이머 소유 0회.
 * 4. 레이아웃 안전 영역 보장: 상단 문제 헤더 및 좌우 30% 높이 선택 카드 영역과 겹치지 않는다.
 */

import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
  type AssaultVisualConfig,
} from '../../config/assault-visual.config.js';
import type { ViewportSize } from './NoteAnchorResolver.js';

export interface ApproachTransformResult {
  readonly scale: number;
  readonly parallaxOffset: { readonly x: number; readonly y: number };
  readonly progress: number;
}

export interface RectBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayoutExclusionBounds {
  readonly questionHeader: RectBounds;
  readonly leftChoiceCard: RectBounds;
  readonly rightChoiceCard: RectBounds;
}

export interface AssaultApproachSnapshot {
  readonly progress?: number;
  readonly completedQuestions?: number;
  readonly targetRounds?: number;
  readonly isRoundCompleted?: boolean;
  readonly bossName?: string;
  readonly currentRound?: number;
  readonly [key: string]: unknown;
}

/**
 * 스냅샷으로부터 0.0 ~ 1.0 범위의 접근 진행도를 안전하게 추출한다.
 */
export function resolveApproachProgress(snapshot?: AssaultApproachSnapshot | null): number {
  if (!snapshot) {
    return 0;
  }

  if (typeof snapshot.progress === 'number' && Number.isFinite(snapshot.progress)) {
    return Math.max(0, Math.min(1.0, snapshot.progress));
  }

  if (
    typeof snapshot.completedQuestions === 'number' &&
    typeof snapshot.targetRounds === 'number' &&
    snapshot.targetRounds > 0
  ) {
    const ratio = snapshot.completedQuestions / snapshot.targetRounds;
    return Math.max(0, Math.min(1.0, Number.isFinite(ratio) ? ratio : 0));
  }

  return 0;
}

export class AssaultApproachRenderer {
  private readonly _config: AssaultVisualConfig;

  constructor(config?: AssaultVisualConfig) {
    this._config = config ?? DEFAULT_ASSAULT_VISUAL_CONFIG;
  }

  get config(): AssaultVisualConfig {
    return this._config;
  }

  /**
   * 진행도(0~1)를 받아 visual config의 bossScaleRange 곡선으로 스케일과 시차 변위를 계산한다.
   */
  computeApproachTransform(
    progress: number,
    configOverride?: AssaultVisualConfig,
  ): ApproachTransformResult {
    const cfg = configOverride ?? this._config;
    const p = Math.max(0, Math.min(1.0, Number.isFinite(progress) ? progress : 0));

    const minScale = cfg.bossScaleRange.minScale;
    const maxScale = cfg.bossScaleRange.maxScale;
    const scale = minScale + (maxScale - minScale) * p;

    // 진행도에 비례한 원근 심도 변위 (수직 시차 오프셋)
    const parallaxOffset = {
      x: 0,
      y: (scale - minScale) * 40,
    };

    return {
      scale,
      parallaxOffset,
      progress: p,
    };
  }

  /**
   * 문제 헤더 및 좌/우 선택 카드의 레이아웃 제외 영역을 계산한다.
   */
  computeSafeBounds(
    viewport: ViewportSize,
    configOverride?: AssaultVisualConfig,
  ): LayoutExclusionBounds {
    const cfg = configOverride ?? this._config;
    const vw = viewport.width || 1280;
    const vh = viewport.height || 720;

    // 문제 헤더: 상단 0 ~ 22% 높이
    const questionHeader: RectBounds = {
      x: 0,
      y: 0,
      width: vw,
      height: vh * 0.22,
    };

    // 좌측 선택 카드
    const leftCardW = cfg.choiceCard.widthRatio * vw;
    const leftCardH = cfg.choiceCard.heightRatio * vh;
    const leftCardCenterX = cfg.choiceCard.leftCenterRatio.x * vw;
    const leftCardCenterY = cfg.choiceCard.leftCenterRatio.y * vh;

    const leftChoiceCard: RectBounds = {
      x: leftCardCenterX - leftCardW / 2,
      y: leftCardCenterY - leftCardH / 2,
      width: leftCardW,
      height: leftCardH,
    };

    // 우측 선택 카드
    const rightCardW = cfg.choiceCard.widthRatio * vw;
    const rightCardH = cfg.choiceCard.heightRatio * vh;
    const rightCardCenterX = cfg.choiceCard.rightCenterRatio.x * vw;
    const rightCardCenterY = cfg.choiceCard.rightCenterRatio.y * vh;

    const rightChoiceCard: RectBounds = {
      x: rightCardCenterX - rightCardW / 2,
      y: rightCardCenterY - rightCardH / 2,
      width: rightCardW,
      height: rightCardH,
    };

    return {
      questionHeader,
      leftChoiceCard,
      rightChoiceCard,
    };
  }

  /**
   * 접근 거리 진행도 바의 위치 및 크기를 계산한다 (화면 최하단 안전 영역).
   */
  computeApproachBarBounds(viewport: ViewportSize): RectBounds {
    const vw = viewport.width || 1280;
    const vh = viewport.height || 720;

    const width = Math.min(560, vw * 0.44);
    const height = 12;
    const x = (vw - width) / 2;
    const y = vh * 0.91;

    return { x, y, width, height };
  }

  /**
   * 접근 진행도 연출을 캔버스에 렌더링한다 (순수 함수형 멱등 렌더링).
   */
  renderApproachProgress(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultApproachSnapshot,
    viewport?: ViewportSize,
    configOverride?: AssaultVisualConfig,
  ): void {
    if (!ctx || !snapshot) {
      return;
    }

    const cfg = configOverride ?? this._config;
    const vp = viewport ?? { width: 1280, height: 720 };
    const progress = resolveApproachProgress(snapshot);
    const transform = this.computeApproachTransform(progress, cfg);
    const barBounds = this.computeApproachBarBounds(vp);

    ctx.save();

    // 1. 배경 원근 심도 가이드 및 시차 그리드 렌더링
    this._renderPerspectiveGuide(ctx, vp, cfg, transform);

    // 2. 보스 실루엣 / 스케일 프레임 렌더링 (중앙 안전 영역)
    this._renderBossFrame(ctx, vp, cfg, transform);

    // 3. 하단 접근 거리 진행도 바 렌더링
    this._renderApproachBar(ctx, barBounds, transform, snapshot);

    ctx.restore();
  }

  /**
   * 배경 원근 심도 가이드 및 시차 라인 렌더링
   */
  private _renderPerspectiveGuide(
    ctx: CanvasRenderingContext2D,
    vp: ViewportSize,
    cfg: AssaultVisualConfig,
    transform: ApproachTransformResult,
  ): void {
    const cx = cfg.bossAnchor.center.x * vp.width;
    const cy = cfg.bossAnchor.center.y * vp.height;
    const groundY = vp.height * 0.76;
    const p = transform.progress;

    ctx.save();
    ctx.strokeStyle = `rgba(100, 180, 255, ${0.12 + 0.18 * p})`;
    ctx.lineWidth = 1.5;

    // 바닥 원근 수렴선 (소실점: 보스 앵커 하단)
    const perspectiveLanes = [-0.35, -0.18, 0, 0.18, 0.35];
    for (const lane of perspectiveLanes) {
      const startX = cx + lane * vp.width * 0.2;
      const endX = cx + lane * vp.width * 1.1;

      ctx.beginPath();
      ctx.moveTo(startX, cy + 30);
      ctx.lineTo(endX, vp.height);
      ctx.stroke();
    }

    // 시차 변위 수평 원근선 (거리감 심도)
    const baseOffsetY = transform.parallaxOffset.y;
    for (let i = 1; i <= 4; i++) {
      const lineY = groundY + i * 28 + (baseOffsetY % 28);
      if (lineY <= vp.height) {
        ctx.beginPath();
        ctx.moveTo(vp.width * 0.1, lineY);
        ctx.lineTo(vp.width * 0.9, lineY);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * 보스 실루엣 및 접근 스케일 프레임 렌더링
   */
  private _renderBossFrame(
    ctx: CanvasRenderingContext2D,
    vp: ViewportSize,
    cfg: AssaultVisualConfig,
    transform: ApproachTransformResult,
  ): void {
    const cx = cfg.bossAnchor.center.x * vp.width;
    const cy = cfg.bossAnchor.center.y * vp.height;
    const scale = transform.scale;
    const p = transform.progress;

    ctx.save();

    // 외부 보스 실루엣 오라 링 (상단 헤더 및 좌우 카드와 완전 분리되는 안전 반경)
    const auraRadius = 32 * scale;
    ctx.strokeStyle = `rgba(200, 137, 255, ${0.25 + 0.25 * p})`;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 다이아몬드 타깃 마커
    const diamondHalf = 18 * scale;
    ctx.strokeStyle = `rgba(40, 230, 255, ${0.35 + 0.35 * p})`;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, cy - diamondHalf);
    ctx.lineTo(cx + diamondHalf, cy);
    ctx.lineTo(cx, cy + diamondHalf);
    ctx.lineTo(cx - diamondHalf, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 하단 접근 거리 바 렌더링
   */
  private _renderApproachBar(
    ctx: CanvasRenderingContext2D,
    barBounds: RectBounds,
    transform: ApproachTransformResult,
    snapshot: AssaultApproachSnapshot,
  ): void {
    const { x, y, width, height } = barBounds;
    const p = transform.progress;

    ctx.save();

    // 1. 트랙 배경
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, 6);
    } else {
      ctx.rect(x, y, width, height);
    }
    ctx.fill();
    ctx.stroke();

    // 2. 진행도 채우기
    if (p > 0) {
      const fillW = Math.max(4, width * p);
      const gradient = ctx.createLinearGradient(x, y, x + fillW, y);
      gradient.addColorStop(0, '#28E6FF');
      gradient.addColorStop(1, '#C889FF');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, fillW, height, 6);
      } else {
        ctx.rect(x, y, fillW, height);
      }
      ctx.fill();
    }

    // 3. 라운드 틱 마크 (targetRounds 기준)
    const targetRounds = snapshot.targetRounds ?? 10;
    if (targetRounds > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 1; i < targetRounds; i++) {
        const tickX = x + (width / targetRounds) * i;
        ctx.beginPath();
        ctx.moveTo(tickX, y + 2);
        ctx.lineTo(tickX, y + height - 2);
        ctx.stroke();
      }
    }

    // 4. 정보 텍스트 (바 상단)
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const completed = snapshot.completedQuestions ?? Math.round(p * targetRounds);
    const label = `APPROACH ${Math.round(p * 100)}% (${completed}/${targetRounds})`;
    ctx.fillText(label, x + width / 2, y - 4);

    ctx.restore();
  }
}
