/**
 * ResultRenderer - 결과 화면, 칼로리 계산, 별 등급
 *
 * Issue #143 (Card #75 / UI-INGAME-001):
 * - 마젠타 결과 카드 패널 (880x1580px, 네온 마젠타 외곽선)
 * - 타이틀 bold 100px (승리/패배), 챕터명 42px, 별점 54px
 * - 8개 운동 통계 1:1 매칭 74px 라인 x 44px 대형 폰트 리포트
 *
 * Issue #443 (Card #443 / UI-VIS-013):
 * - 결과 화면 표시 context와 통계 분리
 * - 선택적 ResultPresentationContext 주입 및 bounds 조회 메서드 지원
 * - 순수 읽기 전용 draw data 유지 및 무부작용 Fixture DTO 렌더 진입점 (renderFixture) 제공
 *
 * @see Issue #23 (GitHub #88), Issue #135, Issue #143, Issue #443
 */

import { CALORIE_RATES, LOCOMOTION_CALORIE_RATES } from '../../config/posture.config.js';
import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import type { BeatRhythmStats } from '../types/result.js';
import { getBossName } from '../data/bossData.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';

export interface ResultData {
  victory: boolean;
  chapter: number;
  correctCount: number;
  totalQuestions: number;
  maxCombo: number;
  steps: number;
  squats: number;
  jumps: number;
  elapsedTime: number;
  /** 스트레칭/자세 유지 시간 (초, Issue #135) */
  dwellTime?: number;
  /** 선택된 운동 모드 (Issue #155 / FEAT-GAME-002) */
  locomotionMode?: LocomotionMode;
  /** BEAT MOTION 리듬 통계 (Issue #206 / #184) */
  rhythmStats?: BeatRhythmStats;
  /** 사전 계산된 칼로리 (선택적) */
  calories?: number;
  /** 사전 계산된 별 등급 (선택적) */
  stars?: number;
  /** 사전 계산된 랭크 등급 (선택적) */
  rank?: RankGrade;
}

export interface ResultPanelLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ResultBounds = ResultPanelLayout;

export interface ResultPanelBoundsOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  backgroundColor?: string;
  borderColor?: string;
}

export interface ResultSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  fontSize?: number;
  lineHeight?: number;
}

export interface ResultPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  panel?: ResultPanelBoundsOverride;
  title?: ResultSlotOverride;
  chapterTitle?: ResultSlotOverride;
  grade?: ResultSlotOverride;
  rankStamp?: ResultSlotOverride;
  stats?: ResultSlotOverride;
  bottomPrompt?: ResultSlotOverride;
}

export interface ResultRendererFixtureDTO {
  animTime?: number;
  presentationContext?: ResultPresentationContext;
  resultData?: Partial<ResultData>;
}

export const DEFAULT_RESULT_FIXTURE_DATA: Readonly<ResultData> = Object.freeze({
  victory: true,
  chapter: 1,
  correctCount: 10,
  totalQuestions: 10,
  maxCombo: 10,
  steps: 200,
  squats: 10,
  jumps: 5,
  elapsedTime: 60,
  dwellTime: 10,
  locomotionMode: 'run',
});

/** 칼로리 계산 (자세 유지 시간 및 운동 모드별 METs 반영 확장, Issue #135 / #155) */
export function calcCalories(
  steps: number,
  squats: number,
  jumps: number,
  dwellTime = 0,
  mode: LocomotionMode = 'run',
): number {
  const stepRate = LOCOMOTION_CALORIE_RATES[mode] ?? CALORIE_RATES.step;
  return (
    steps * stepRate +
    squats * CALORIE_RATES.squat +
    jumps * CALORIE_RATES.jump +
    dwellTime * CALORIE_RATES.dwellPerSecond
  );
}

/** 운동 모드별 통계 텍스트 라인 포맷팅 (Issue #155 / FEAT-GAME-002) */
export function getLocomotionStatLine(mode: LocomotionMode = 'run', steps: number): string {
  switch (mode) {
    case 'hip_bounce':
      return `🦘 골반 바운스: ${steps}회`;
    case 'hip_sway':
      return `💃 골반 스웨이: ${steps}회`;
    case 'arm_cross':
      return `🚗 양손 교차: ${steps}회`;
    case 'run':
    default:
      return `🏃 달린 걸음: ${steps}보 (제자리 달리기)`;
  }
}

/** 별 등급 (1~3) 산출 */
export function calcStars(correctCount: number, totalQuestions: number, elapsedTime: number): number {
  if (totalQuestions === 0) return 1;
  const accuracy = correctCount / totalQuestions;
  if (accuracy >= 0.9 && elapsedTime < 120) return 3;
  if (accuracy >= 0.7) return 2;
  return 1;
}

export type RankGrade = 'S' | 'A' | 'B' | 'C';

/** 종합 평가 랭크 등급 (S / A / B / C) 산출 (GDD / 정답률 및 시간 기준) */
export function calcRank(
  correctCount: number,
  totalQuestions: number,
  elapsedTime: number,
  victory = true,
): RankGrade {
  if (!victory || totalQuestions === 0) return 'C';
  const accuracy = correctCount / totalQuestions;
  if (accuracy >= 0.9 && elapsedTime < 120) return 'S';
  if (accuracy >= 0.8) return 'A';
  if (accuracy >= 0.6) return 'B';
  return 'C';
}

export class ResultRenderer {
  private _animTime: number = 10.0; // 기본값: 안착 완료 상태 (기존 테스트 호환성 유지)
  private _presentationContext?: ResultPresentationContext;
  readonly slideDuration: number = 0.5;
  readonly statStaggerDelay: number = 0.08;
  readonly statFadeDuration: number = 0.15;

  constructor(presentationContext?: ResultPresentationContext) {
    if (presentationContext) {
      this.setPresentationContext(presentationContext);
    }
  }

  get animTime(): number {
    return this._animTime;
  }

  get isPanelSettled(): boolean {
    return this._animTime >= this.slideDuration;
  }

  resetAnimation(initialTime = 0): void {
    this._animTime = initialTime;
  }

  update(dt: number): void {
    this._animTime += dt;
  }

  /**
   * Presentation Context 주입 (선택적 표시 컨텍스트)
   */
  setPresentationContext(context?: ResultPresentationContext): void {
    this._presentationContext = context;
  }

  /**
   * 주입된 Presentation Context 조회
   */
  getPresentationContext(): ResultPresentationContext | undefined {
    return this._presentationContext;
  }

  /**
   * Presentation Context 초기화
   */
  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  private _resolveContext(overrideCtx?: ResultPresentationContext): ResultPresentationContext | undefined {
    const ctx = overrideCtx ?? this._presentationContext;
    if (!ctx) return undefined;
    if (!ctx.presentationDocument) return ctx;

    const docCtx = ResultRenderer.fromPresentationDocument(ctx.presentationDocument, ctx.pageId);
    return {
      ...docCtx,
      ...ctx,
      panel: { ...docCtx.panel, ...ctx.panel },
      title: { ...docCtx.title, ...ctx.title },
      chapterTitle: { ...docCtx.chapterTitle, ...ctx.chapterTitle },
      grade: { ...docCtx.grade, ...ctx.grade },
      rankStamp: { ...docCtx.rankStamp, ...ctx.rankStamp },
      stats: { ...docCtx.stats, ...ctx.stats },
      bottomPrompt: { ...docCtx.bottomPrompt, ...ctx.bottomPrompt },
    };
  }

  /**
   * UIPresentationDocument로부터 ResultPresentationContext 추출
   */
  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'result',
  ): ResultPresentationContext {
    const result: ResultPresentationContext = {
      presentationDocument: doc,
      pageId,
    };
    if (!doc?.pages) return result;

    const targetPages =
      pageId && doc.pages[pageId as UIPresentationPageId]
        ? [doc.pages[pageId as UIPresentationPageId]]
        : Object.values(doc.pages);

    for (const page of targetPages) {
      if (!page?.elements) continue;
      for (const el of page.elements) {
        if (!el?.bounds) continue;
        const b = el.bounds;
        const boundsObj = {
          x: b.x,
          y: b.y,
          w: b.width ?? (b as any).w ?? 0,
          h: b.height ?? (b as any).h ?? 0,
        };

        if (
          el.id === 'result_panel' ||
          el.id === 'panel' ||
          el.id === 'res_panel' ||
          el.id === 'card'
        ) {
          result.panel = {
            ...boundsObj,
            backgroundColor: (el as any).style?.backgroundColor,
            borderColor: (el as any).style?.borderColor,
            ...result.panel,
          };
        } else if (
          el.id === 'res_title' ||
          el.id === 'result_title' ||
          el.id === 'title'
        ) {
          result.title = {
            ...boundsObj,
            text: el.text,
            color: (el as any).style?.fillColor ?? (el as any).style?.textColor,
            fontSize: (el as any).style?.fontSize,
            ...result.title,
          };
        } else if (
          el.id === 'res_chapter' ||
          el.id === 'result_chapter' ||
          el.id === 'chapter'
        ) {
          result.chapterTitle = {
            ...boundsObj,
            text: el.text,
            color: (el as any).style?.fillColor ?? (el as any).style?.textColor,
            fontSize: (el as any).style?.fontSize,
            ...result.chapterTitle,
          };
        } else if (
          el.id === 'res_grade' ||
          el.id === 'result_grade' ||
          el.id === 'grade' ||
          el.id === 'stars'
        ) {
          result.grade = {
            ...boundsObj,
            text: el.text,
            ...result.grade,
          };
        } else if (
          el.id === 'res_rank' ||
          el.id === 'rank_stamp' ||
          el.id === 'rank'
        ) {
          result.rankStamp = {
            ...boundsObj,
            ...result.rankStamp,
          };
        } else if (
          el.id === 'res_stats' ||
          el.id === 'result_stats' ||
          el.id === 'stats'
        ) {
          result.stats = {
            ...boundsObj,
            fontSize: (el as any).style?.fontSize,
            ...result.stats,
          };
        } else if (
          el.id === 'res_footer' ||
          el.id === 'result_footer' ||
          el.id === 'footer' ||
          el.id === 'bottom_prompt'
        ) {
          result.bottomPrompt = {
            ...boundsObj,
            text: el.text,
            ...result.bottomPrompt,
          };
        }
      }
    }
    return result;
  }

  /**
   * 패널 등장 슬라이드 오프셋 (0.5초 동안 아래에서 위로 easeOutBack 보간)
   */
  getSlideOffsetY(h: number): number {
    if (this._animTime >= this.slideDuration) {
      return 0;
    }
    const startOffset = 360 * (h / 2160);
    if (this._animTime <= 0) {
      return startOffset;
    }
    const t = this._animTime / this.slideDuration;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const ease = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    return Math.max(0, (1 - ease) * startOffset);
  }

  /** getSlideOffsetY 별칭 */
  getPanelOffsetY(h: number): number {
    return this.getSlideOffsetY(h);
  }

  /**
   * 패널 안착(0.5초) 후 8개 통계 라인 순차 페이드 인 알파 (0 -> 1)
   */
  getStatLineAlpha(index: number): number {
    const startTime = this.slideDuration + index * this.statStaggerDelay;
    if (this._animTime <= startTime) return 0;
    if (this._animTime >= startTime + this.statFadeDuration) return 1;
    return (this._animTime - startTime) / this.statFadeDuration;
  }

  /**
   * 결과 패널 바운딩 박스 반환 (UI_LAYOUT.result.panel 연동 및 PresentationContext 지원)
   */
  getPanelBounds(w: number, h: number, context?: ResultPresentationContext): ResultBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const slot = UI_LAYOUT.result.panel;

    const x = ctx?.panel?.x !== undefined ? ctx.panel.x * scaleX : slot.x * scaleX;
    const y = ctx?.panel?.y !== undefined ? ctx.panel.y * scaleY : slot.y * scaleY;
    const pw = ctx?.panel?.w !== undefined ? ctx.panel.w * scaleX : slot.w * scaleX;
    const ph = ctx?.panel?.h !== undefined ? ctx.panel.h * scaleY : slot.h * scaleY;

    return { x, y, w: pw, h: ph };
  }

  /**
   * 마젠타 결과 카드 패널 레이아웃 (1080x2160 기준 UI_LAYOUT.result.panel 연동)
   */
  getPanelLayout(w: number, h: number): ResultPanelLayout {
    return this.getPanelBounds(w, h);
  }

  /**
   * 타이틀 영역 바운딩 박스 반환
   */
  getTitleBounds(w: number, h: number, context?: ResultPresentationContext): ResultBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const slot = UI_LAYOUT.result.title;

    const x = ctx?.title?.x !== undefined ? ctx.title.x * scaleX : slot.x * scaleX;
    const y = ctx?.title?.y !== undefined ? ctx.title.y * scaleY : slot.y * scaleY;
    const tw = ctx?.title?.w !== undefined ? ctx.title.w * scaleX : slot.w * scaleX;
    const th = ctx?.title?.h !== undefined ? ctx.title.h * scaleY : slot.h * scaleY;

    return { x, y, w: tw, h: th };
  }

  /**
   * 챕터/보스명 영역 바운딩 박스 반환
   */
  getChapterTitleBounds(w: number, h: number, context?: ResultPresentationContext): ResultBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const slot = UI_LAYOUT.result.chapter;

    const x = ctx?.chapterTitle?.x !== undefined ? ctx.chapterTitle.x * scaleX : slot.x * scaleX;
    const y = ctx?.chapterTitle?.y !== undefined ? ctx.chapterTitle.y * scaleY : slot.y * scaleY;
    const cw = ctx?.chapterTitle?.w !== undefined ? ctx.chapterTitle.w * scaleX : slot.w * scaleX;
    const rh = ctx?.chapterTitle?.h !== undefined ? ctx.chapterTitle.h * scaleY : slot.h * scaleY;

    return { x, y, w: cw, h: rh };
  }

  /**
   * 별 등급 영역 바운딩 박스 반환
   */
  getGradeBounds(w: number, h: number, context?: ResultPresentationContext): ResultBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const slot = UI_LAYOUT.result.stars;

    const x = ctx?.grade?.x !== undefined ? ctx.grade.x * scaleX : slot.x * scaleX;
    const y = ctx?.grade?.y !== undefined ? ctx.grade.y * scaleY : slot.y * scaleY;
    const rw = ctx?.grade?.w !== undefined ? ctx.grade.w * scaleX : slot.w * scaleX;
    const rh = ctx?.grade?.h !== undefined ? ctx.grade.h * scaleY : slot.h * scaleY;

    return { x, y, w: rw, h: rh };
  }

  /**
   * 랭크 스탬프 바운딩 박스 반환
   */
  getRankStampBounds(w: number, h: number, context?: ResultPresentationContext): ResultBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const slot = UI_LAYOUT.result.stamp;

    const x =
      ctx?.rankStamp?.x !== undefined
        ? ctx.rankStamp.x * scaleX
        : slot.x * scaleX;
    const y =
      ctx?.rankStamp?.y !== undefined
        ? ctx.rankStamp.y * scaleY
        : slot.y * scaleY;
    const rw = ctx?.rankStamp?.w !== undefined ? ctx.rankStamp.w * scaleX : slot.w * scaleX;
    const rh = ctx?.rankStamp?.h !== undefined ? ctx.rankStamp.h * scaleY : slot.h * scaleY;

    return { x, y, w: rw, h: rh };
  }

  /**
   * 랭크 스탬프 레이아웃 (우측 상단 엠블럼, 기존 호환성 유지)
   */
  getRankStampLayout(w: number, h: number): ResultBounds {
    return this.getRankStampBounds(w, h);
  }

  /**
   * 통계 리포트 전체 영역 바운딩 박스 반환
   */
  getStatsBounds(w: number, h: number, context?: ResultPresentationContext): ResultBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const slot = UI_LAYOUT.result.stats;
    const lineH = ctx?.stats?.lineHeight !== undefined ? Math.round(ctx.stats.lineHeight * scaleY) : this.getStatLineHeight(h);
    const defaultTotalH = slot?.h !== undefined ? slot.h * scaleY : 8 * lineH;
    const totalH = ctx?.stats?.h !== undefined ? ctx.stats.h * scaleY : defaultTotalH;

    const x = ctx?.stats?.x !== undefined ? ctx.stats.x * scaleX : slot.x * scaleX;
    const y = ctx?.stats?.y !== undefined ? ctx.stats.y * scaleY : slot.y * scaleY;
    const sw = ctx?.stats?.w !== undefined ? ctx.stats.w * scaleX : slot.w * scaleX;
    const sh = totalH;

    return { x, y, w: sw, h: sh };
  }

  /**
   * 개별 통계 라인 바운딩 박스 반환
   */
  getStatLineBounds(index: number, w: number, h: number, context?: ResultPresentationContext): ResultBounds {
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const statsBounds = this.getStatsBounds(w, h, ctx);
    const lineH = ctx?.stats?.lineHeight !== undefined ? Math.round(ctx.stats.lineHeight * scaleY) : this.getStatLineHeight(h);

    return {
      x: statsBounds.x,
      y: statsBounds.y + index * lineH,
      w: statsBounds.w,
      h: lineH,
    };
  }

  /**
   * 하단 안내 문구 바운딩 박스 반환
   */
  getBottomPromptBounds(w: number, h: number, context?: ResultPresentationContext): ResultBounds {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const slot = UI_LAYOUT.result.prompt ?? { x: 100, y: 1750, w: 880, h: 40 };

    const x = ctx?.bottomPrompt?.x !== undefined ? ctx.bottomPrompt.x * scaleX : slot.x * scaleX;
    const y = ctx?.bottomPrompt?.y !== undefined ? ctx.bottomPrompt.y * scaleY : slot.y * scaleY;
    const pw = ctx?.bottomPrompt?.w !== undefined ? ctx.bottomPrompt.w * scaleX : slot.w * scaleX;
    const rh = ctx?.bottomPrompt?.h !== undefined ? ctx.bottomPrompt.h * scaleY : slot.h * scaleY;

    return { x, y, w: pw, h: rh };
  }

  /**
   * 통계 1줄 높이 (2160 기준 74px, UI_LAYOUT.result.statLineHeight 연동)
   */
  getStatLineHeight(h: number = 2160): number {
    return Math.round(UI_LAYOUT.result.statLineHeight * (h / 2160));
  }

  /**
   * 통계 폰트 크기 (1080 기준 44px)
   */
  getStatFontSize(w: number): number {
    const statScale = (UI_LAYOUT.result.stats?.label?.textScale ?? 1.0) * (UI_LAYOUT.result.stats?.value?.textScale ?? 1.0);
    return Math.round(UIText.getFontSize('subheading', w / 1080) * statScale);
  }

  /**
   * 결정적 Fixture DTO 렌더 진입 (인스턴스 기반, 게임 라이프사이클 영향 0건)
   */
  renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dto?: ResultRendererFixtureDTO,
  ): void {
    const rawData = dto?.resultData ?? {};
    const effectiveData: ResultData = {
      ...DEFAULT_RESULT_FIXTURE_DATA,
      ...rawData,
    };
    const prevAnim = this._animTime;
    const prevCtx = this._presentationContext;

    if (dto?.animTime !== undefined) {
      this._animTime = dto.animTime;
    }
    if (dto?.presentationContext) {
      this._presentationContext = dto.presentationContext;
    }

    try {
      this.render(ctx, w, h, effectiveData);
    } finally {
      this._animTime = prevAnim;
      this._presentationContext = prevCtx;
    }
  }

  /**
   * 정적 Fixture DTO 렌더 진입 (에디터 프리뷰 등에서 인스턴스 없이 직접 렌더링)
   */
  static renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dto?: ResultRendererFixtureDTO,
  ): void {
    const renderer = new ResultRenderer(dto?.presentationContext);
    renderer.renderFixture(ctx, w, h, dto);
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, data: ResultData): void {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const effectiveCtx = this._resolveContext();

    ctx.save();

    // 1. 전체 화면 딤 오버레이
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, w, h);

    const slideOffsetY = this.getSlideOffsetY(h);
    ctx.save();
    if (slideOffsetY !== 0) {
      ctx.translate(0, slideOffsetY);
    }

    // 2. 마젠타 결과 카드 패널 (x: 100, y: 240, w: 880, h: 1580)
    const panel = this.getPanelBounds(w, h, effectiveCtx);
    const panelImg = imageLoader.get('result', 'panelBg');
    if (panelImg) {
      ctx.drawImage(panelImg, panel.x, panel.y, panel.w, panel.h);
    } else {
      ctx.fillStyle = effectiveCtx?.panel?.backgroundColor ?? 'rgba(20, 10, 30, 0.95)';
      ctx.strokeStyle = effectiveCtx?.panel?.borderColor ?? '#FF28D8';
      ctx.lineWidth = 3.5 * scaleX;
      ctx.shadowColor = effectiveCtx?.panel?.borderColor ?? '#FF28D8';
      ctx.shadowBlur = 18 * scaleX;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 28 * scaleX);
      } else {
        ctx.rect(panel.x, panel.y, panel.w, panel.h);
      }
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 3. 타이틀 영역: bold 100px ("승리!" / "패배...")
    const titleBounds = this.getTitleBounds(w, h, effectiveCtx);
    const titleImg = data.victory
      ? (imageLoader.get('result', 'victoryTitle') ?? imageLoader.get('result', 'victoryBadge'))
      : (imageLoader.get('result', 'defeatTitle') ?? imageLoader.get('result', 'defeatBadge'));
    if (titleImg) {
      ctx.drawImage(titleImg, titleBounds.x, titleBounds.y, titleBounds.w, titleBounds.h);
    } else {
      const defaultTitle = data.victory ? '승리!' : '패배...';
      const defaultColor = data.victory ? '#4DFFAA' : '#FF4444';
      const titleText = effectiveCtx?.title?.text ?? defaultTitle;
      const titleColor = effectiveCtx?.title?.color ?? defaultColor;
      const titleScale = UI_LAYOUT.result.title?.textScale ?? 1.0;
      ctx.font = UIText.getFont('hero', scaleX * titleScale, 'bold');
      ctx.fillStyle = titleColor;
      ctx.shadowColor = titleColor;
      ctx.shadowBlur = 20 * scaleX;
      ctx.fillText(titleText, titleBounds.x + titleBounds.w / 2, titleBounds.y + titleBounds.h / 2);
      ctx.shadowBlur = 0;
    }

    // 챕터명: bold 42px
    const chapterBounds = this.getChapterTitleBounds(w, h, effectiveCtx);
    const chapterText = effectiveCtx?.chapterTitle?.text ?? `Ch.${data.chapter} ${getBossName(data.chapter)}`;
    const chapterScale = UI_LAYOUT.result.chapter?.textScale ?? 1.0;
    ctx.font = UIText.getFont('body', scaleX * chapterScale, 'bold');
    ctx.fillStyle = effectiveCtx?.chapterTitle?.color ?? '#FFCB4D';
    ctx.fillText(chapterText, chapterBounds.x + chapterBounds.w / 2, chapterBounds.y + chapterBounds.h / 2);

    // 별 등급 (승리 시): bold 54px
    if (data.victory) {
      const stars = data.stars ?? calcStars(data.correctCount, data.totalQuestions, data.elapsedTime);
      const gradeBounds = this.getGradeBounds(w, h, effectiveCtx);
      const starFilledImg = imageLoader.get('result', 'starFilled');
      const starEmptyImg = imageLoader.get('result', 'starEmpty');
      if (starFilledImg && starEmptyImg) {
        const starSize = Math.min(gradeBounds.w / 3, gradeBounds.h);
        const startX = gradeBounds.x;
        const starY = gradeBounds.y;
        for (let s = 0; s < 3; s++) {
          const sImg = s < stars ? starFilledImg : starEmptyImg;
          ctx.drawImage(sImg, startX + s * starSize, starY, starSize, starSize);
        }
      } else {
        const starScale = UI_LAYOUT.result.stars?.textScale ?? 1.0;
        ctx.font = UIText.getFont('heading', scaleX * starScale, 'bold');
        ctx.fillStyle = '#FFCB4D';
        ctx.shadowColor = '#FFCB4D';
        ctx.shadowBlur = 14 * scaleX;
        ctx.fillText('★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)), gradeBounds.x + gradeBounds.w / 2, gradeBounds.y + gradeBounds.h / 2);
        ctx.shadowBlur = 0;
      }
    }

    // 3.5. 종합 평가 랭크 스탬프 (S / A / B / C)
    const rank = data.rank ?? calcRank(data.correctCount, data.totalQuestions, data.elapsedTime, data.victory);
    const stampLayout = this.getRankStampBounds(w, h, effectiveCtx);
    const stampKey = `rankStamp${rank}` as const;
    const stampImg = imageLoader.get('result', stampKey);

    if (stampImg) {
      ctx.drawImage(stampImg, stampLayout.x, stampLayout.y, stampLayout.w, stampLayout.h);
    } else {
      // 프로시저럴 스탬프 폴백 (원형 엠블럼 + 랭크 레터)
      const cx = stampLayout.x + stampLayout.w / 2;
      const cy = stampLayout.y + stampLayout.h / 2;
      const r = stampLayout.w / 2 - 6 * scaleX;

      const rankColors: Record<RankGrade, string> = {
        S: '#FFD700',
        A: '#4DFFAA',
        B: '#28E6FF',
        C: '#C889FF',
      };
      const color = rankColors[rank];

      ctx.save();

      // 외곽 링
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5 * scaleX;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // 내부 링
      ctx.lineWidth = 1.5 * scaleX;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 8 * scaleX, 0, Math.PI * 2);
      ctx.stroke();

      const stampScale = UI_LAYOUT.result.stamp?.textScale ?? 1.0;

      // RANK 라벨
      ctx.font = UIText.getFont('badge', scaleX * stampScale, 'bold');
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RANK', cx, cy - r + 20 * scaleY);

      // 중앙 랭크 등급 레터
      ctx.font = UIText.getFont('title', scaleX * stampScale, 'bold');
      ctx.fillText(rank, cx, cy + 8 * scaleY);

      ctx.restore();
    }

    // 4. 8개 운동 통계 리포트 (74px 라인 x bold 44px 1:1 매칭)
    const statsBounds = this.getStatsBounds(w, h, effectiveCtx);
    const lineH = effectiveCtx?.stats?.lineHeight !== undefined
      ? Math.round(effectiveCtx.stats.lineHeight * scaleY)
      : this.getStatLineHeight(h);
    const statStartY = effectiveCtx?.stats?.y !== undefined
      ? statsBounds.y
      : (data.victory
          ? (UI_LAYOUT.result.stats?.victoryY ?? UI_LAYOUT.result.stats?.y ?? 710) * scaleY
          : (UI_LAYOUT.result.stats?.defeatY ?? (UI_LAYOUT.result.stats?.y ? UI_LAYOUT.result.stats.y - 90 : 620)) * scaleY);
    const statScale = (UI_LAYOUT.result.stats?.label?.textScale ?? 1.0) * (UI_LAYOUT.result.stats?.value?.textScale ?? 1.0);
    const statFontSize = effectiveCtx?.stats?.fontSize !== undefined
      ? Math.round(effectiveCtx.stats.fontSize * scaleX * statScale)
      : this.getStatFontSize(w);

    ctx.font = effectiveCtx?.stats?.fontSize !== undefined
      ? `bold ${statFontSize}px sans-serif`
      : UIText.getFont('subheading', scaleX * statScale, 'bold');
    ctx.fillStyle = '#FFFFFF';

    const accuracy = data.totalQuestions > 0
      ? Math.round((data.correctCount / data.totalQuestions) * 100)
      : 0;
    const dwell = data.dwellTime ?? 0;
    const calories = data.calories ?? calcCalories(data.steps, data.squats, data.jumps, dwell, data.locomotionMode);
    const timeStr = `${Math.floor(data.elapsedTime / 60)}분 ${String(Math.floor(data.elapsedTime % 60)).padStart(2, '0')}초`;
    const stepLine = getLocomotionStatLine(data.locomotionMode, data.steps);

    const statItems: Array<{
      iconKey: string | null;
      rawText: string;
      cleanText: string;
      highlight?: boolean;
    }> = [
      {
        iconKey: 'statIcon_accuracy',
        rawText: `🎯 정답률: ${data.correctCount} / ${data.totalQuestions} (${accuracy}%)`,
        cleanText: `정답률: ${data.correctCount} / ${data.totalQuestions} (${accuracy}%)`,
      },
      {
        iconKey: 'statIcon_combo',
        rawText: `🔥 최대 콤보: ${data.maxCombo} COMBO`,
        cleanText: `최대 콤보: ${data.maxCombo} COMBO`,
      },
      {
        iconKey: 'statIcon_time',
        rawText: `⏱️ 플레이 시간: ${timeStr}`,
        cleanText: `플레이 시간: ${timeStr}`,
      },
      {
        iconKey: 'statIcon_run',
        rawText: stepLine,
        cleanText: stepLine.replace(/^[^\w가-힣0-9A-Za-z]+\s*/, ''),
      },
      {
        iconKey: 'statIcon_squat',
        rawText: `🏋️ 스쿼트: ${data.squats}회`,
        cleanText: `스쿼트: ${data.squats}회`,
      },
      {
        iconKey: 'statIcon_jump',
        rawText: `🦘 점프: ${data.jumps}회`,
        cleanText: `점프: ${data.jumps}회`,
      },
      {
        iconKey: 'statIcon_pose',
        rawText: `🧘 자세 유지: ${dwell.toFixed(1)}초`,
        cleanText: `자세 유지: ${dwell.toFixed(1)}초`,
      },
      {
        iconKey: 'statIcon_calorie',
        rawText: `⚡ 소모 칼로리: ${calories.toFixed(1)} kcal`,
        cleanText: `소모 칼로리: ${calories.toFixed(1)} kcal`,
        highlight: true,
      },
    ];

    if (data.rhythmStats) {
      statItems.push({
        iconKey: null,
        rawText: `⭐ 리듬 별: ${data.rhythmStats.beatStarsCollected}개 (타임아웃 ${data.rhythmStats.timeoutCount}회)`,
        cleanText: `리듬 별: ${data.rhythmStats.beatStarsCollected}개 (타임아웃 ${data.rhythmStats.timeoutCount}회)`,
      });
    }

    const iconSize = 44 * scaleX;
    for (let i = 0; i < statItems.length; i++) {
      const item = statItems[i];
      const ly = statStartY + i * lineH;
      const lineAlpha = this.getStatLineAlpha(i);
      if (lineAlpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = (ctx.globalAlpha || 1) * lineAlpha;

      // 은은한 구분선 배경 바
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)';
      ctx.fillRect(panel.x + 40 * scaleX, ly - lineH / 2 + 6 * scaleY, panel.w - 80 * scaleX, lineH - 12 * scaleY);

      ctx.fillStyle = item.highlight || i >= 7 ? '#FFCB4D' : '#EAEAEA';

      const iconImg = item.iconKey ? imageLoader.get('result', item.iconKey) : null;
      if (iconImg) {
        const iconX = (UI_LAYOUT.result.stats?.x !== undefined ? statsBounds.x + 10 * scaleX : panel.x + 70 * scaleX);
        const iconY = ly - iconSize / 2;
        ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);

        ctx.textAlign = 'left';
        ctx.fillText(item.cleanText, iconX + iconSize + 16 * scaleX, ly);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(item.rawText, w / 2, ly);
      }

      ctx.restore();
    }

    // 5. 하단 안내문
    const promptBounds = this.getBottomPromptBounds(w, h, effectiveCtx);
    const promptText = effectiveCtx?.bottomPrompt?.text ?? '양손을 모으거나 하단 [메뉴로] 버튼을 클릭하세요';
    const promptScale = (UI_LAYOUT.result.prompt?.textScale ?? 1.0) * (UI_LAYOUT.result.button?.textScale ?? 1.0);
    ctx.textAlign = 'center';
    ctx.font = UIText.getFont('label', scaleX * promptScale, 'normal');
    ctx.fillStyle = '#BBBBBB';
    if (effectiveCtx?.bottomPrompt?.color) {
      ctx.fillStyle = effectiveCtx.bottomPrompt.color;
    }
    ctx.fillText(promptText, promptBounds.x + promptBounds.w / 2, promptBounds.y + promptBounds.h / 2);

    ctx.restore();
    ctx.restore();
  }
}
