/**
 * AssaultSceneRenderer.ts - 보스 접근전(Boss Assault) 읽기 전용 공격 장면 렌더러
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.4, 6.7, 11.1, A03, A05, A06)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-19 / Issue #521)
 *
 * 절대 규칙:
 * 1. Render 단일 책임: 스냅샷을 캔버스에 그리기만 하며 런타임/HP/정답 판정 일체 금지.
 * 2. 멱등성(Idempotency): 동일 스냅샷에 대해 render()를 다수 호출해도 스냅샷 및 외부 상태 불변.
 * 3. 부작용 0건: DOM 리스너 0회, rAF/타이머 0회, 정답 추론 0회.
 * 4. A03 투척/고정: throw_in 중 비행 투영, question_reading 이후 화면 상단 고정 표시.
 * 5. 답 쌍 및 스쿼트 안내: AssaultPairPainter와 스쿼트 회피 안내를 합성하여 화면 크기 변화에 대응.
 */

import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
  type AssaultVisualConfig,
} from '../../config/assault-visual.config.js';
import {
  AssaultPairPainter,
  type AssaultPairRenderSnapshot,
} from './AssaultPairPainter.js';
import type { ViewportSize } from './NoteAnchorResolver.js';
import { renderQuestionHeaderMath } from './QuestionRenderer.js';
import type {
  AssaultRoundPhase,
  AssaultRoundPresentation,
  AssaultPresentationDTO,
} from '../types/assault.js';

export interface AssaultSquatHazardRenderData {
  readonly active: boolean;
  readonly progress?: number;
  readonly promptText?: string;
  readonly status?: 'telegraph' | 'active' | 'evaded' | 'hit';
}

export interface AssaultSceneSnapshot {
  readonly sessionId?: string;
  readonly roundId?: string;
  readonly phase?: AssaultRoundPhase;
  readonly questionText: string;
  readonly throwProgress?: number;
  readonly readingProgress?: number;
  readonly leftChoiceText?: string;
  readonly rightChoiceText?: string;
  readonly pair?: AssaultPairRenderSnapshot;
  readonly squatHazard?: AssaultSquatHazardRenderData;
  readonly bossScaleProgress?: number;
  readonly comboCount?: number;
  readonly remainingTimeSeconds?: number;
  readonly warningActive?: boolean;
  readonly isPaused?: boolean;
}

export type AssaultAnyPresentationSnapshot =
  | AssaultSceneSnapshot
  | AssaultRoundPresentation
  | AssaultPresentationDTO;

export interface QuestionPositionResult {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly alpha: number;
}

export interface HazardBoundsResult {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class AssaultSceneRenderer {
  private readonly _pairPainter: AssaultPairPainter;
  private readonly _config: AssaultVisualConfig;

  constructor(
    pairPainter?: AssaultPairPainter,
    config?: AssaultVisualConfig,
  ) {
    this._config = config ?? DEFAULT_ASSAULT_VISUAL_CONFIG;
    this._pairPainter = pairPainter ?? new AssaultPairPainter(this._config);
  }

  get pairPainter(): AssaultPairPainter {
    return this._pairPainter;
  }

  get config(): AssaultVisualConfig {
    return this._config;
  }

  /**
   * 문제 텍스트 화면 위치 계산 (A03: 투척 시 비행, 이후 상단 고정)
   */
  computeQuestionPosition(
    snapshot: AssaultAnyPresentationSnapshot,
    viewport: ViewportSize,
    configOverride?: AssaultVisualConfig,
  ): QuestionPositionResult {
    const cfg = configOverride ?? this._config;
    const vw = viewport.width || 1280;
    const vh = viewport.height || 720;

    const phase = snapshot.phase ?? 'question_reading';
    const isThrowIn = phase === 'throw_in';

    if (isThrowIn) {
      const throwProgress =
        'throwProgress' in snapshot && snapshot.throwProgress !== undefined
          ? snapshot.throwProgress
          : 'readingProgress' in snapshot && snapshot.readingProgress !== undefined
          ? snapshot.readingProgress
          : 0;
      const p = Math.max(0, Math.min(1.0, throwProgress));

      const vx = cfg.bossAnchor.center.x * vw;
      const vy = cfg.bossAnchor.center.y * vh;
      const hx = vw * 0.5;
      const hy = vh * 0.16;

      const x = vx + (hx - vx) * p;
      const y = vy + (hy - vy) * p;
      const scale = 0.4 + 0.6 * p;
      const alpha = 0.3 + 0.7 * p;

      return { x, y, scale, alpha };
    }

    // A03: 투척 완료 후 상단 고정 (question_reading, encounters 등)
    return {
      x: vw * 0.5,
      y: vh * 0.16,
      scale: 1.0,
      alpha: 1.0,
    };
  }

  /**
   * 스쿼트 회피 장애물 구역 경계 계산
   */
  computeSquatHazardBounds(viewport: ViewportSize): HazardBoundsResult {
    const vw = viewport.width || 1280;
    const vh = viewport.height || 720;

    return {
      x: 0,
      y: vh * 0.68,
      width: vw,
      height: vh * 0.22,
    };
  }

  /**
   * 공격 장면 종합 렌더링 (순수 캔버스 표시)
   */
  render(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultAnyPresentationSnapshot,
    viewport?: ViewportSize,
    configOverride?: AssaultVisualConfig,
  ): void {
    if (!ctx || !snapshot) {
      return;
    }

    const cfg = configOverride ?? this._config;
    const vp: ViewportSize = {
      width: viewport?.width || ctx.canvas?.width || 1280,
      height: viewport?.height || ctx.canvas?.height || 720,
    };

    ctx.save();

    // 1. 보스 앵커 및 텔레그래프 가이드 렌더링
    this._renderBossTelegraph(ctx, snapshot, vp, cfg);

    // 2. 문제 수식 텍스트 렌더링 (A03: 투척 비행 / 상단 고정)
    const qPos = this.computeQuestionPosition(snapshot, vp, cfg);
    this._renderQuestionHeader(ctx, snapshot.questionText, qPos, vp, cfg);

    // 3. 답 쌍(Left/Right) 탄환 렌더링
    this._renderAnswerPair(ctx, snapshot, vp, cfg);

    // 4. 스쿼트 회피 위험 경고(Squat hazard telegraph) 및 웅크리기 안내 렌더링
    this._renderSquatHazard(ctx, snapshot, vp, cfg);

    ctx.restore();
  }

  /**
   * 보스 앵커/실루엣 텔레그래프 렌더링
   */
  private _renderBossTelegraph(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultAnyPresentationSnapshot,
    vp: ViewportSize,
    cfg: AssaultVisualConfig,
  ): void {
    const bossProgress =
      'bossScaleProgress' in snapshot && typeof snapshot.bossScaleProgress === 'number'
        ? snapshot.bossScaleProgress
        : 0;

    const scale =
      cfg.bossScaleRange.minScale +
      (cfg.bossScaleRange.maxScale - cfg.bossScaleRange.minScale) * Math.max(0, Math.min(1.0, bossProgress));

    const cx = cfg.bossAnchor.center.x * vp.width;
    const cy = cfg.bossAnchor.center.y * vp.height;

    ctx.save();
    ctx.strokeStyle = 'rgba(200, 137, 255, 0.25)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, 32 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // 양손 발사 앵커 포인트 힌트
    const lx = cfg.projectileLaunchRatios.left.x * vp.width;
    const ly = cfg.projectileLaunchRatios.left.y * vp.height;
    const rx = cfg.projectileLaunchRatios.right.x * vp.width;
    const ry = cfg.projectileLaunchRatios.right.y * vp.height;

    ctx.fillStyle = 'rgba(40, 230, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(lx, ly, 6 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 203, 77, 0.4)';
    ctx.beginPath();
    ctx.arc(rx, ry, 6 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 문제 텍스트 헤더 렌더링 (A03: QuestionRenderer의 renderQuestionHeaderMath 결합)
   */
  private _renderQuestionHeader(
    ctx: CanvasRenderingContext2D,
    questionText: string,
    qPos: QuestionPositionResult,
    vp: ViewportSize,
    _cfg: AssaultVisualConfig,
  ): void {
    if (!questionText) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = qPos.alpha;

    const scaleX = (vp.width / 1280) * qPos.scale;

    // renderQuestionHeaderMath 호출을 통한 일관된 수식 렌더링
    try {
      renderQuestionHeaderMath(ctx, questionText, qPos.x, qPos.y, scaleX, false, {
        color: '#ffffff',
        shadowColor: 'rgba(40, 230, 255, 0.6)',
        shadowBlur: 14,
        maxHeight: 120 * scaleX,
        maxWidth: 900 * scaleX,
      });
    } catch {
      // 단위 테스트 환경 fallback
      const fontSize = Math.max(20, Math.round(54 * scaleX));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(40, 230, 255, 0.6)';
      ctx.shadowBlur = 12;
      ctx.fillText(questionText, qPos.x, qPos.y);
    }

    ctx.restore();
  }

  /**
   * 답 쌍 렌더링 위임
   */
  private _renderAnswerPair(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultAnyPresentationSnapshot,
    vp: ViewportSize,
    cfg: AssaultVisualConfig,
  ): void {
    // 1. 직접 전달된 pair가 있는 경우
    if ('pair' in snapshot && snapshot.pair) {
      this._pairPainter.render(ctx, snapshot.pair, vp, cfg);
      return;
    }

    // 2. AssaultPresentationDTO 또는 좌/우 텍스트가 있는 경우
    if ('leftChoiceText' in snapshot && 'rightChoiceText' in snapshot) {
      const leftText = snapshot.leftChoiceText;
      const rightText = snapshot.rightChoiceText;

      if (!leftText && !rightText) {
        return;
      }

      // 투척 중이거나 읽기 중일 때는 아직 발사되지 않음(pending/대기)
      const phase = snapshot.phase ?? 'choice_window';
      const isEarlyPhase = phase === 'throw_in' || phase === 'question_reading';

      const pairSnapshot: AssaultPairRenderSnapshot = {
        leftText: leftText ?? '',
        rightText: rightText ?? '',
        progress: isEarlyPhase ? 0.0 : 0.6,
        status: isEarlyPhase ? 'pending' : 'inFlight',
      };

      this._pairPainter.render(ctx, pairSnapshot, vp, cfg);
    }
  }

  /**
   * 스쿼트 회피 장애물(Squat hazard telegraph) 및 웅크리기 안내 렌더링
   */
  private _renderSquatHazard(
    ctx: CanvasRenderingContext2D,
    snapshot: AssaultAnyPresentationSnapshot,
    vp: ViewportSize,
    cfg: AssaultVisualConfig,
  ): void {
    const isWarning =
      ('warningActive' in snapshot && snapshot.warningActive) ||
      ('squatHazard' in snapshot && snapshot.squatHazard?.active);

    if (!isWarning) {
      return;
    }

    const colors = (cfg as any).colors ?? (cfg as any).colorPalette;
    const hazardBounds = this.computeSquatHazardBounds(vp);
    const squatData = 'squatHazard' in snapshot ? snapshot.squatHazard : undefined;
    const promptText = squatData?.promptText ?? '▼ SQUAT! 웅크리기 회피 ▼';

    ctx.save();

    // 1. 하단 위험 경고 띠 (Hazard Sweep Zone)
    ctx.fillStyle = 'rgba(255, 77, 77, 0.18)';
    ctx.fillRect(hazardBounds.x, hazardBounds.y, hazardBounds.width, hazardBounds.height);

    ctx.strokeStyle = colors.hazardRed;
    ctx.lineWidth = 3;
    ctx.setLineDash?.([16, 8]);
    ctx.strokeRect(hazardBounds.x, hazardBounds.y, hazardBounds.width, hazardBounds.height);

    // 2. 웅크리기 가이드 문구 (문제와 겹치지 않는 중하단 영역)
    const scaleFactor = vp.width / 1280;
    const fontSize = Math.max(16, Math.round(28 * scaleFactor));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.hazardRed;
    ctx.shadowColor = colors.hazardRed;
    ctx.shadowBlur = 10;

    const textY = hazardBounds.y + hazardBounds.height * 0.5;
    ctx.fillText(promptText, vp.width * 0.5, textY);

    ctx.restore();
  }
}
