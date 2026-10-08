/**
 * BeatHUDRenderer - 8박 러닝 페이즈 및 보스 장판/운동 카운트 HUD 렌더러
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - main.ts에 인라인되어 있던 renderRunningPhase()를 독립 렌더러 모듈로 분리
 * - 하드코딩 매직넘버(5, 44px, 색상 등)를 BEAT_HUD_CONFIG로 외부화
 * - #192 KeynoteRenderer와의 렌더링 영역 및 책임 경계 명확화
 */

import type { GeneratedQuestion } from '../question/QuestionEvaluator.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';
import {
  BEAT_HUD_CONFIG,
  LOCOMOTION_DISPLAY_CONFIG,
} from '../../config/locomotion.config.js';
import { HazardZoneRenderer } from './HazardZoneRenderer.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';

export interface BeatHUDBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface BeatHUDSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  title?: string;
  subtitle?: string;
  text?: string;
  color?: string;
  fontSize?: number;
  visible?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
}

export interface BeatHUDPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  exerciseBadge?: BeatHUDSlotOverride;
  beatDots?: BeatHUDSlotOverride;
  stepCounter?: BeatHUDSlotOverride;
  hazardGuide?: BeatHUDSlotOverride;
}

export const BEAT_HUD_SLOT_IDS = [
  'exerciseBadge',
  'beatDots',
  'stepCounter',
  'hazardGuide',
  'hazard_zone_protection',
  'floor_strike_line_run',
] as const;

export const PROTECTED_BEAT_HUD_SLOT_IDS = [
  'hazard_zone_protection',
  'floor_strike_line_run',
] as const;

export interface BeatHUDFixtureDTO {
  state?: Partial<BeatHUDState>;
  locomotionMode?: LocomotionMode;
  totalSteps?: number;
  completedExerciseBeats?: number;
  exerciseBeats?: number;
  activeHazardPattern?: PhaseAHazardPattern | null;
  hazardBeatProgress?: number;
  vanishingX?: number;
  vanishingY?: number;
  showBeatDots?: boolean;
  presentationContext?: BeatHUDPresentationContext;
}

export const DEFAULT_BEAT_HUD_FIXTURE: BeatHUDFixtureDTO = Object.freeze({
  locomotionMode: 'run',
  totalSteps: 12,
  completedExerciseBeats: 4,
  exerciseBeats: 8,
  showBeatDots: true,
});

export const HAZARD_BEAT_HUD_FIXTURE: BeatHUDFixtureDTO = Object.freeze({
  locomotionMode: 'run',
  activeHazardPattern: 'left_step',
  hazardBeatProgress: 0.5,
  totalSteps: 8,
  showBeatDots: false,
});

export interface BeatHUDRendererOptions {
  /**
   * 8박자 원형 인디케이터 표시 여부 (기본값: false)
   * Issue #368 (RUN-MAT-005) 정책: RUN-MAT 매트가 시간 박수와 인정 수를 분리하여 단일 소유하므로,
   * null-hazard 러닝 경로에서는 중복/상충하는 N개 운동 목표처럼 보이지 않도록 showBeatDots를 기본 숨김(false)으로 유지합니다.
   */
  showBeatDots?: boolean;
  presentationContext?: BeatHUDPresentationContext;
}

export interface BeatHUDState {
  question?: GeneratedQuestion | null;
  totalSteps?: number;
  completedExerciseBeats?: number;
  exerciseBeats?: number;
  locomotionMode?: LocomotionMode;
  activeHazardPattern?: PhaseAHazardPattern | null;
  hazardBeatProgress?: number;
  /** Issue #212 / #322: 레거시 호환 필드 (수식 렌더링은 QuestionRenderer로 일원화됨) */
  questionApproachProgress?: number;
  /** 원근 접근 소실점 좌표 */
  vanishingX?: number;
  vanishingY?: number;
}

export class BeatHUDRenderer {
  private _showBeatDots: boolean;
  private readonly _hazardRenderer: HazardZoneRenderer;
  private _presentationContext?: BeatHUDPresentationContext;

  constructor(options?: BeatHUDRendererOptions) {
    this._showBeatDots = options?.showBeatDots ?? false;
    this._hazardRenderer = new HazardZoneRenderer();
    if (options?.presentationContext) {
      this._presentationContext = options.presentationContext;
    }
  }

  get showBeatDots(): boolean {
    return this._showBeatDots;
  }

  set showBeatDots(value: boolean) {
    this._showBeatDots = value;
  }

  get hazardRenderer(): HazardZoneRenderer {
    return this._hazardRenderer;
  }

  setPresentationContext(context?: BeatHUDPresentationContext): void {
    this._presentationContext = context;
  }

  getPresentationContext(): BeatHUDPresentationContext | undefined {
    return this._presentationContext;
  }

  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  isSlotLocked(slotId: string): boolean {
    return (PROTECTED_BEAT_HUD_SLOT_IDS as readonly string[]).includes(slotId);
  }

  getSlotLockReason(slotId: string): string | null {
    if (this.isSlotLocked(slotId)) {
      return '보스 공격 장판 영역 및 판정선은 물리 판정 핵심 구역으로 위치 및 크기 변경이 원자적으로 잠겨 있습니다.';
    }
    return null;
  }

  validatePresentationContext(
    context?: BeatHUDPresentationContext,
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!context) return { valid: true, issues };
    return { valid: issues.length === 0, issues };
  }

  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'running_question',
  ): BeatHUDPresentationContext {
    const page = doc.pages[pageId as UIPresentationPageId];
    let exerciseBadge: BeatHUDSlotOverride | undefined;
    let beatDots: BeatHUDSlotOverride | undefined;
    let stepCounter: BeatHUDSlotOverride | undefined;

    if (page?.elements) {
      for (const el of page.elements) {
        if (el.id === 'run_header' || el.id === 'exercise_badge') {
          exerciseBadge = {
            x: el.bounds.x,
            y: el.bounds.y,
            w: el.bounds.width,
            h: el.bounds.height,
            title: el.text,
          };
        } else if (el.id === 'beat_dots' || el.id === 'run_beat_dots') {
          beatDots = {
            x: el.bounds.x,
            y: el.bounds.y,
            w: el.bounds.width,
            h: el.bounds.height,
          };
        } else if (el.id === 'step_counter' || el.id === 'run_step_counter') {
          stepCounter = {
            x: el.bounds.x,
            y: el.bounds.y,
            w: el.bounds.width,
            h: el.bounds.height,
          };
        }
      }
    }

    if (!exerciseBadge) {
      exerciseBadge = {
        title: '제자리 달리기',
        subtitle: '리듬에 맞춰 달려보세요',
      };
    }

    return {
      presentationDocument: doc,
      pageId,
      exerciseBadge,
      beatDots,
      stepCounter,
    };
  }

  getExerciseBadgeBounds(vw: number, vh: number): BeatHUDBounds {
    const cx = vw / 2;
    const cy = vh * 0.52;
    const scaleX = vw / 1080;
    const scaleY = vh / 2160;
    const w = 480 * scaleX;
    const h = 100 * scaleY;
    const x = cx - w / 2;
    const y = cy - 80 * scaleY;
    const override = this._presentationContext?.exerciseBadge;
    return {
      x: override?.x ?? x,
      y: override?.y ?? y,
      w: override?.w ?? w,
      h: override?.h ?? h,
      width: override?.w ?? w,
      height: override?.h ?? h,
    };
  }

  getBeatDotsBounds(vw: number, vh: number): BeatHUDBounds {
    const cx = vw / 2;
    const cy = vh * 0.52;
    const scaleX = vw / 1080;
    const scaleY = vh / 2160;
    const dotY = cy + 260 * scaleY;
    const dotSpacing = 44 * scaleX;
    const w = (7 * dotSpacing) + 40 * scaleX;
    const h = 40 * scaleY;
    const x = cx - w / 2;
    const y = dotY - h / 2;
    const override = this._presentationContext?.beatDots;
    return {
      x: override?.x ?? x,
      y: override?.y ?? y,
      w: override?.w ?? w,
      h: override?.h ?? h,
      width: override?.w ?? w,
      height: override?.h ?? h,
    };
  }

  getStepCounterBounds(vw: number, vh: number): BeatHUDBounds {
    const cx = vw / 2;
    const cy = vh * 0.52;
    const scaleX = vw / 1080;
    const scaleY = vh / 2160;
    const dotY = cy + 260 * scaleY;
    const y = dotY + 44 * scaleY - 20 * scaleY;
    const w = 320 * scaleX;
    const h = 40 * scaleY;
    const x = cx - w / 2;
    const override = this._presentationContext?.stepCounter;
    return {
      x: override?.x ?? x,
      y: override?.y ?? y,
      w: override?.w ?? w,
      h: override?.h ?? h,
      width: override?.w ?? w,
      height: override?.h ?? h,
    };
  }

  getHazardGuideBounds(vw: number, vh: number): BeatHUDBounds {
    const cx = vw / 2;
    const cy = vh * 0.52;
    const scaleX = vw / 1080;
    const scaleY = vh / 2160;
    const w = 500 * scaleX;
    const h = 120 * scaleY;
    const x = cx - w / 2;
    const y = cy - 80 * scaleY;
    const override = this._presentationContext?.hazardGuide;
    return {
      x: override?.x ?? x,
      y: override?.y ?? y,
      w: override?.w ?? w,
      h: override?.h ?? h,
      width: override?.w ?? w,
      height: override?.h ?? h,
    };
  }

  renderFixture(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    dto?: BeatHUDFixtureDTO,
    contextOverride?: BeatHUDPresentationContext,
  ): void {
    const prevContext = this._presentationContext;
    const prevShowBeatDots = this._showBeatDots;
    if (contextOverride || dto?.presentationContext) {
      this._presentationContext = contextOverride ?? dto?.presentationContext;
    }
    if (dto?.showBeatDots !== undefined) {
      this._showBeatDots = dto.showBeatDots;
    }
    try {
      const state: BeatHUDState = {
        locomotionMode: dto?.locomotionMode ?? 'run',
        totalSteps: dto?.totalSteps ?? 0,
        completedExerciseBeats: dto?.completedExerciseBeats,
        exerciseBeats: dto?.exerciseBeats,
        activeHazardPattern: dto?.activeHazardPattern ?? null,
        hazardBeatProgress: dto?.hazardBeatProgress,
        vanishingX: dto?.vanishingX,
        vanishingY: dto?.vanishingY,
        ...(dto?.state ?? {}),
      };
      this.render(ctx, vw, vh, state);
    } finally {
      this._presentationContext = prevContext;
      this._showBeatDots = prevShowBeatDots;
    }
  }

  static renderFixture(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    dto?: BeatHUDFixtureDTO,
    contextOverride?: BeatHUDPresentationContext,
  ): void {
    const renderer = new BeatHUDRenderer({ showBeatDots: dto?.showBeatDots });
    renderer.renderFixture(ctx, vw, vh, dto, contextOverride);
  }

  render(ctx: CanvasRenderingContext2D, vw: number, vh: number, state: BeatHUDState): void {
    const cx = vw / 2;
    const cy = vh * 0.52;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const scaleX = vw / 1080;
    const scaleY = vh / 2160;

    const vx = state.vanishingX ?? cx;
    const vy = state.vanishingY ?? vh * 0.24;

    // Issue #322: 문제 수식 렌더링은 QuestionRenderer(SSOT)로 일원화되었으므로
    // BeatHUDRenderer는 순수 러닝 HUD(보스 장판, 박자 도트, 운동 카운터)만 담당한다.

    // 1. Phase A 보스 장판 박자 안내 및 운동 모드 가이드
    const hazard = state.activeHazardPattern;
    const mode = state.locomotionMode ?? 'run';
    const displayConfig =
      LOCOMOTION_DISPLAY_CONFIG[mode] ?? LOCOMOTION_DISPLAY_CONFIG.run;

    if (hazard) {
      const hazardGuide: Record<PhaseAHazardPattern, { title: string; subtitle: string; color: string }> = {
        left_step: { title: '왼발 피하기!', subtitle: '왼발을 들어 장판을 피하세요', color: '#28E6FF' },
        right_step: { title: '오른발 피하기!', subtitle: '오른발을 들어 장판을 피하세요', color: '#FFCB4D' },
        jump: { title: '양발 피하기!', subtitle: '점프해서 바닥 충격파를 넘으세요', color: '#FF865E' },
        balance_left: { title: '왼발로 균형!', subtitle: '오른발을 들고 한발로 버티세요', color: '#C889FF' },
        balance_right: { title: '오른발로 균형!', subtitle: '왼발을 들고 한발로 버티세요', color: '#C889FF' },
      };
      const guide = hazardGuide[hazard];

      ctx.font = UIText.getFont('subheading', scaleX, 'bold', 'sans-serif', 24);
      ctx.fillStyle = guide.color;
      ctx.shadowColor = guide.color;
      ctx.shadowBlur = 24;
      ctx.fillText(guide.title, cx, cy - 60);
      ctx.shadowBlur = 0;

      // Phase A 보스 장판 회피 힌트 (A11Y-001: 최소 24px 하한선 보장)
      ctx.font = UIText.getFont('label', scaleX, 'bold', 'sans-serif', 24);
      ctx.fillStyle = BEAT_HUD_CONFIG.TEXT_COLOR_SUBTITLE;
      ctx.fillText(guide.subtitle, cx, cy - 5);

      // 3. 3D 원근 그리드 바닥 보스 장판 렌더링 (Issue #228 - RENDER-HAZARD-001)
      this._hazardRenderer.render(ctx, vw, vh, {
        activePattern: hazard,
        beatProgress: state.hazardBeatProgress ?? 0,
        vanishingX: vx,
        vanishingY: vy,
      });
    } else {
      // Issue #368 (RUN-MAT-005): null-hazard 시 허위 완료/대기 안내('장판 루틴 완료!')를 제거하고
      // 모드 중립적인 운동 가이드 안내 표시 (매트 렌더러와 상충하는 '계속 뛰기' 등 지양)
      const badgeOverride = this._presentationContext?.exerciseBadge;
      const guideTitle = badgeOverride?.title ?? displayConfig.guideTitle;
      const guideSubtitle = badgeOverride?.subtitle ?? displayConfig.guideSubtitle;
      const titleColor = badgeOverride?.color ?? BEAT_HUD_CONFIG.TITLE_COLOR_CENTER;

      ctx.font = UIText.getFont('subheading', scaleX, 'bold', 'sans-serif', 24);
      ctx.fillStyle = titleColor;
      ctx.shadowColor = titleColor;
      ctx.shadowBlur = 24;
      ctx.fillText(guideTitle, cx, cy - 60);
      ctx.shadowBlur = 0;

      ctx.font = UIText.getFont('label', scaleX, 'bold', 'sans-serif', 24);
      ctx.fillStyle = BEAT_HUD_CONFIG.TEXT_COLOR_SUBTITLE;
      ctx.fillText(guideSubtitle, cx, cy - 5);
    }

    const dotY = cy + 260 * scaleY;

    // 3.5 원형 인디케이터 (옵션 활성화 시)
    if (this._showBeatDots) {
      const completedBeats = state.completedExerciseBeats ?? 0;
      const totalBeats = state.exerciseBeats ?? BEAT_HUD_CONFIG.TOTAL_BEATS;
      const dotScale = totalBeats > 8 ? 8 / totalBeats : 1.0;
      const dotRadius = BEAT_HUD_CONFIG.DOT_RADIUS * scaleX * dotScale;
      const dotGap = BEAT_HUD_CONFIG.DOT_GAP * scaleX * dotScale;
      const startX = cx - ((totalBeats - 1) * dotGap) / 2;
      const indicatorY = cy + BEAT_HUD_CONFIG.DOT_OFFSET_Y;

      // 이미지 에셋 조회 (Issue #291: UI-ASSET-010)
      const activeDotImg = imageLoader.get('hud', 'beatDotActive');
      const inactiveDotImg = imageLoader.get('hud', 'beatDotInactive');
      const targetDotImg = imageLoader.get('hud', 'beatDotTarget');

      for (let i = 0; i < totalBeats; i++) {
        const bx = startX + i * dotGap;

        let dotImg: HTMLImageElement | null = null;
        if (i < completedBeats) {
          dotImg = activeDotImg;
        } else if (i === completedBeats) {
          dotImg = targetDotImg ?? activeDotImg;
        } else {
          dotImg = inactiveDotImg;
        }

        if (dotImg) {
          // 비트맵 이미지 드로잉
          const size = dotRadius * 2;
          ctx.drawImage(dotImg, bx - dotRadius, indicatorY - dotRadius, size, size);
        } else {
          // 100% 무중단 프로시저럴 폴백
          ctx.beginPath();
          ctx.arc(bx, indicatorY, dotRadius, 0, Math.PI * 2);
          if (i < completedBeats) {
            const splitBeat = Math.round((totalBeats * 5) / 8);
            const color = this._presentationContext?.beatDots?.color ??
              (i >= splitBeat ? BEAT_HUD_CONFIG.COLOR_LATE : BEAT_HUD_CONFIG.COLOR_EARLY);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // 인디케이터 번호 (A11Y-001: 최소 24px 하한선 보장)
        const fontMin = totalBeats > 8 ? 16 : 24;
        ctx.font = UIText.getFont('caption', scaleX * dotScale, 'bold', 'sans-serif', fontMin);
        ctx.fillStyle = i < completedBeats ? '#000000' : 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`${i + 1}`, bx, indicatorY);
      }
    }

    // 4. 누적 운동 통계 표시 (Issue #368: 4개 모드별 누적 라벨 및 올바른 단위 구분)
    const totalSteps = state.totalSteps ?? 0;
    const stepColor = this._presentationContext?.stepCounter?.color ?? BEAT_HUD_CONFIG.STEP_COUNT_COLOR;
    ctx.font = UIText.getFont('body', scaleX, 'bold', 'sans-serif', 24);
    ctx.fillStyle = stepColor;
    ctx.fillText(`${displayConfig.cumulativeLabel}: ${totalSteps}${displayConfig.unit}`, cx, dotY + 60);

    ctx.restore();
  }
}
