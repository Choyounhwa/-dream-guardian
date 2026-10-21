/**
 * ChapterSelectView - 메인 챕터 선택 화면(2-2-1 와이드 다이아몬드) 드로잉 전담 서브 렌더러
 *
 * Issue #638 (REFACTOR-SRP-007):
 * - MenuRenderer에서 메인 챕터 선택 화면 드로잉 로직 분리
 * - 배경, 타이틀/슬로건, 운동 모드 버튼, 5개 챕터 카드, 별점, 잠금/난이도 인디케이터 드로잉 전담
 */

import type { MenuState, ChapterCardLayout, MenuPresentationContext, ChapterCardPresentationOverride } from '../MenuRenderer.js';
import { CHAPTER_INFO } from '../MenuRenderer.js';
import { UIText } from '../../utils/UIText.js';
import { imageLoader } from '../../utils/UIImageLoader.js';
import { UI_LAYOUT } from '../../../config/ui.config.js';

export interface ChapterSelectRenderOptions {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  state: MenuState;
  context?: MenuPresentationContext;
  chapterLayouts: ChapterCardLayout[];
  titleLayout: { x: number; y: number; w: number; h: number };
  locomotionLayout: { x: number; y: number; w: number; h: number };
  pulseTimer?: number;
}

export class ChapterSelectView {
  /**
   * 메인 챕터 선택 화면 전체 렌더링
   */
  render(options: ChapterSelectRenderOptions): void {
    const { ctx, w, h, state, context, chapterLayouts, titleLayout, locomotionLayout, pulseTimer = 0 } = options;
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 0. 배경 이미지 (설정 시)
    this.drawBackground(ctx, w, h, context);

    // 1. 상단 타이틀 영역
    this.drawTitle(ctx, scaleX, scaleY, titleLayout, context);

    // 1-1. 운동 모드 선택 버튼
    this.drawLocomotionButton(ctx, scaleX, locomotionLayout, state, context);

    // 2. 챕터 카드 5개 (2-2-1 와이드 다이아몬드)
    this.drawChapterCards(ctx, scaleX, scaleY, chapterLayouts, state, context, pulseTimer);

    ctx.restore();
  }

  /**
   * 배경 이미지 렌더링
   */
  drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, context?: MenuPresentationContext): void {
    const bgImg =
      context?.background?.image ||
      (context?.background?.assetId ? (context?.imageAssets?.[context.background.assetId] || context?.assetResolver?.(context.background.assetId)) : null) ||
      context?.imageAssets?.['background'] ||
      (context?.assetResolver ? context.assetResolver('background') : null) ||
      imageLoader.get('menu', 'background');

    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, w, h);
    }
  }

  /**
   * 상단 타이틀 및 슬로건 렌더링
   */
  drawTitle(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    scaleY: number,
    titleSlot: { x: number; y: number; w: number; h: number },
    context?: MenuPresentationContext
  ): void {
    const menuLayout = UI_LAYOUT.menu;
    const titleCenterY = titleSlot.y + titleSlot.h / 2 - menuLayout.titleText.liftY * scaleY;
    const titleBgImg =
      context?.title?.image ||
      (context?.title?.assetId ? (context?.imageAssets?.[context.title.assetId] || context?.assetResolver?.(context.title.assetId)) : null) ||
      context?.imageAssets?.['titleBg'] ||
      context?.imageAssets?.['banner'] ||
      (context?.assetResolver ? (context.assetResolver('titleBg') || context.assetResolver('banner')) : null) ||
      imageLoader.get('menu', 'titleBg') ||
      imageLoader.get('menu', 'banner');

    if (titleBgImg) {
      const bannerW = titleSlot.w;
      const bannerH = menuLayout.titleBanner.h * scaleY;
      ctx.drawImage(titleBgImg, titleSlot.x + (titleSlot.w - bannerW) / 2, titleCenterY - bannerH / 2, bannerW, bannerH);
    } else {
      const titleScale = menuLayout.title?.textScale ?? 1.0;
      ctx.font = UIText.getFont('title', scaleX * titleScale, 'bold');
      const titleColor = context?.title?.color ?? '#C889FF';
      ctx.fillStyle = titleColor;
      ctx.shadowColor = titleColor;
      ctx.shadowBlur = 16 * scaleX;
      const titleText = context?.title?.text ?? '꿈속 세계 탐험';
      ctx.fillText(titleText, titleSlot.x + titleSlot.w / 2, titleCenterY);
      ctx.shadowBlur = 0;

      // 상단 슬로건 배너 텍스트 (Issue #216 / UI-STORY-001)
      const sloganScale = menuLayout.slogan?.textScale ?? 1.0;
      ctx.font = UIText.getFont('caption', scaleX * sloganScale, 'normal');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        '깨비와 함께 신비로운 꿈의 성역으로 다이빙!',
        titleSlot.x + titleSlot.w / 2,
        titleCenterY + menuLayout.titleText.sloganGapY * scaleY
      );
    }
  }

  /**
   * 운동 모드 선택 버튼 렌더링
   */
  drawLocomotionButton(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    lBtn: { x: number; y: number; w: number; h: number },
    state: MenuState,
    context?: MenuPresentationContext
  ): void {
    const locomotionLabel = context?.locomotionBtn?.label ?? state.locomotionLabel;
    if (!locomotionLabel) return;

    ctx.fillStyle = 'rgba(40, 230, 255, 0.12)';
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 2 * scaleX;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(lBtn.x, lBtn.y, lBtn.w, lBtn.h, 16 * scaleX);
    } else {
      ctx.rect(lBtn.x, lBtn.y, lBtn.w, lBtn.h);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = UIText.getFont('badge', scaleX, 'bold');
    ctx.fillStyle = '#FFFFFF';
    const icon = context?.locomotionBtn?.icon ?? state.locomotionIcon ?? '🏃';
    ctx.fillText(`${icon} 운동 모드: ${locomotionLabel} ⚙`, lBtn.x + lBtn.w / 2, lBtn.y + lBtn.h / 2);
  }

  /**
   * 챕터 카드 5개 일괄 렌더링
   */
  drawChapterCards(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    scaleY: number,
    layouts: ChapterCardLayout[],
    state: MenuState,
    context: MenuPresentationContext | undefined,
    pulseTimer: number
  ): void {
    for (let i = 0; i < layouts.length; i++) {
      const item = layouts[i];
      const info = CHAPTER_INFO[i];
      const ch = item.chapter;
      const chOverride = context?.chapterCards?.[ch];
      const locked = item.locked !== undefined ? item.locked : ch > state.unlockedChapter;
      const selected = ch === state.selectedChapter;
      const cardColor = item.color ?? chOverride?.color ?? info.color;

      this.drawChapterCard(
        ctx,
        scaleX,
        scaleY,
        item,
        info,
        ch,
        locked,
        selected,
        cardColor,
        state,
        context,
        chOverride,
        pulseTimer
      );
    }
  }

  /**
   * 개별 챕터 카드 렌더링
   */
  drawChapterCard(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    scaleY: number,
    item: ChapterCardLayout,
    info: (typeof CHAPTER_INFO)[number],
    ch: number,
    locked: boolean,
    selected: boolean,
    cardColor: string,
    state: MenuState,
    context: MenuPresentationContext | undefined,
    chOverride: ChapterCardPresentationOverride | undefined,
    pulseTimer: number
  ): void {
    const menuLayout = UI_LAYOUT.menu;
    ctx.save();
    if (locked) {
      ctx.globalAlpha = 0.55;
    }

    const pulse = Math.sin((pulseTimer / 1.5) * Math.PI * 2) * 0.5 + 0.5;

    // 카드 배경 및 테두리 (라운드 코너 24px)
    const customImg =
      chOverride?.image ||
      (chOverride?.assetId ? (context?.imageAssets?.[chOverride.assetId] || context?.assetResolver?.(chOverride.assetId)) : null) ||
      context?.imageAssets?.[`cardFrame_${ch}`] ||
      (context?.assetResolver ? context.assetResolver(`cardFrame_${ch}`) : null) ||
      context?.imageAssets?.['cardFrame'] ||
      (context?.assetResolver ? context.assetResolver('cardFrame') : null);
    const cardFrameImg = customImg || imageLoader.get('menu', 'cardFrame');

    if (cardFrameImg) {
      ctx.drawImage(cardFrameImg, item.x, item.y, item.w, item.h);
      if (selected) {
        ctx.strokeStyle = cardColor;
        ctx.lineWidth = (3.5 + 1.5 * pulse) * scaleX;
        ctx.shadowColor = cardColor;
        ctx.shadowBlur = (12 + 12 * pulse) * scaleX;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(item.x, item.y, item.w, item.h, 24 * scaleX);
        } else {
          ctx.rect(item.x, item.y, item.w, item.h);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    } else {
      const fillAlpha = selected ? 0.12 + 0.1 * pulse : 0.08;
      const hexAlpha = Math.round(fillAlpha * 255)
        .toString(16)
        .padStart(2, '0');
      ctx.fillStyle = locked ? 'rgba(255, 255, 255, 0.03)' : `${cardColor}${hexAlpha}`;
      ctx.strokeStyle = locked ? 'rgba(255, 255, 255, 0.15)' : selected ? cardColor : `${cardColor}75`;
      ctx.lineWidth = selected ? (3.5 + 1.5 * pulse) * scaleX : 2.5 * scaleX;
      if (selected) {
        ctx.shadowColor = cardColor;
        ctx.shadowBlur = (12 + 12 * pulse) * scaleX;
      }
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(item.x, item.y, item.w, item.h, 24 * scaleX);
      } else {
        ctx.rect(item.x, item.y, item.w, item.h);
      }
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 카드 내부 텍스트 (칸별 높이 1:1 매핑, [LAYOUT-002] UI_LAYOUT.menu.cardText)
    const cardText = menuLayout.cardText;
    const starsY = item.y + cardText.starsY * scaleY;

    // 1) 챕터 번호 (Ch.X): bold 48px
    const chapterScale = cardText?.chapter?.textScale ?? 1.0;
    ctx.fillStyle = locked ? '#999999' : cardColor;
    ctx.font = UIText.getFont('subheading', scaleX * chapterScale, 'bold');
    ctx.fillText(`Ch.${ch}`, item.x + item.w / 2, item.y + cardText.chapterY * scaleY);

    // 2) 챕터명 (꿈속 탐험 테마): bold 44px
    const nameScale = cardText?.name?.textScale ?? 1.0;
    ctx.fillStyle = locked ? '#888888' : '#FFFFFF';
    ctx.font = UIText.getFont('subheading', scaleX * nameScale, 'bold');
    const cardTitle = item.title ?? chOverride?.title ?? (locked ? '???' : info.name);
    ctx.fillText(cardTitle, item.x + item.w / 2, item.y + cardText.nameY * scaleY);

    // 3) 학습 영역 / 테마 부제: 26px
    const subScale = cardText?.sub?.textScale ?? 1.0;
    ctx.fillStyle = locked ? '#777777' : '#BBBBBB';
    ctx.font = UIText.getFont('label', scaleX * subScale, 'normal');
    const lockReasonText = item.lockReason ?? chOverride?.lockReason ?? '미개방 성역';
    const subTitleText = item.subtitle ?? chOverride?.subtitle ?? info.sub;
    ctx.fillText(locked ? lockReasonText : subTitleText, item.x + item.w / 2, item.y + cardText.subY * scaleY);

    // 4) 별점 (★★★) 또는 잠금 (🔒)
    if (!locked) {
      this.drawStars(ctx, scaleX, item, ch, state, context, starsY);
    } else {
      this.drawLock(ctx, scaleX, item, context, starsY);
    }

    ctx.restore();
  }

  /**
   * 별점 (3성) 렌더링
   */
  drawStars(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    item: ChapterCardLayout,
    ch: number,
    state: MenuState,
    context: MenuPresentationContext | undefined,
    starsY: number
  ): void {
    const menuLayout = UI_LAYOUT.menu;
    const metaScale = menuLayout.cardText?.meta?.textScale ?? 1.0;
    const starCount = Math.max(0, Math.min(3, state.stars[ch] ?? 0));

    const starFullImg =
      context?.imageAssets?.['starFull'] ||
      (context?.assetResolver ? context.assetResolver('starFull') : null) ||
      imageLoader.get('menu', 'starFull');
    const starEmptyImg =
      context?.imageAssets?.['starEmpty'] ||
      (context?.assetResolver ? context.assetResolver('starEmpty') : null) ||
      imageLoader.get('menu', 'starEmpty');

    if (starFullImg && starEmptyImg) {
      const starSize = 36 * scaleX;
      const gap = 8 * scaleX;
      const totalW = 3 * starSize + 2 * gap;
      const startX = item.x + (item.w - totalW) / 2;
      const startY = starsY - starSize / 2;
      for (let s = 0; s < 3; s++) {
        const sImg = s < starCount ? starFullImg : starEmptyImg;
        ctx.drawImage(sImg, startX + s * (starSize + gap), startY, starSize, starSize);
      }
    } else {
      const starStr = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
      ctx.font = UIText.getFont('heading', scaleX * metaScale, 'bold');
      ctx.fillStyle = '#FFCB4D';
      ctx.fillText(starStr, item.x + item.w / 2, starsY);
    }
  }

  /**
   * 잠금 아이콘 렌더링
   */
  drawLock(
    ctx: CanvasRenderingContext2D,
    scaleX: number,
    item: ChapterCardLayout,
    context: MenuPresentationContext | undefined,
    starsY: number
  ): void {
    const menuLayout = UI_LAYOUT.menu;
    const metaScale = menuLayout.cardText?.meta?.textScale ?? 1.0;

    const lockImg =
      context?.imageAssets?.['lockIcon'] ||
      context?.imageAssets?.['lock'] ||
      (context?.assetResolver ? (context.assetResolver('lockIcon') || context.assetResolver('lock')) : null) ||
      imageLoader.get('menu', 'lockIcon') ||
      imageLoader.get('menu', 'lock');

    if (lockImg) {
      const lockSize = 40 * scaleX;
      ctx.drawImage(lockImg, item.x + (item.w - lockSize) / 2, starsY - lockSize / 2, lockSize, lockSize);
    } else {
      ctx.font = UIText.getFont('heading', scaleX * metaScale, 'bold');
      ctx.fillStyle = '#888888';
      ctx.fillText('🔒', item.x + item.w / 2, starsY);
    }
  }
}
