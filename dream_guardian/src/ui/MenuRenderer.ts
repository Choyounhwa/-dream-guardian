/**
 * MenuRenderer - 메인 메뉴 챕터 카드 및 서브레벨 선택 Canvas 렌더링
 *
 * Issue #142 (Card #74 / UI-MENU-002):
 * - 홈 메뉴 2-2-1 와이드 다이아몬드 그리드 및 1:1 대형 폰트 적용
 * - 서브 메뉴 2열 3행 대형 와이드 그리드 개편
 * - 레거시 가로 1열 및 상단 뒤로가기 삭제, 하단 고정 바 우측 슬롯 연동
 *
 * Issue #439 (Card / UI-VIS-009):
 * - 메인·서브메뉴 공용 표시와 입력 레이아웃
 * - 선택적 불변 Presentation Context 주입 지원 (MenuPresentationContext)
 * - 5챕터 카드/타이틀/운동 버튼 및 서브메뉴 그리드/슬롯/헤더의 geometry/표시 속성 해석
 * - render / getChapterLayouts / getLocomotionButtonLayout / hitTest / hitTestLocomotion 단일 진실 공급원(SSOT) geometry 일원화
 * - getSubMenuLayouts / hitTestSub 단일 진실 공급원(SSOT) geometry 일원화
 * - 전역 UI_LAYOUT/이미지 캐시 무변형 및 다중 인스턴스 격리성 보장
 */

import type { SubLevelInfo } from '../types/index.js';
import type { UIPresentationDocument, UIPresentationPage } from '../data/UIPresentation.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import { UI_LAYOUT } from '../../config/ui.config.js';

export interface ChapterInfo {
  chapter: number;
  name: string;
  fullName: string;
  sub: string;
  boss: string;
  color: string;
}

export const CHAPTER_INFO: ChapterInfo[] = [
  {
    chapter: 1,
    name: '에메랄드 심해',
    fullName: '나비가 숨 쉬는 에메랄드 심해',
    sub: '덧셈 · 뺄셈',
    boss: '망각의 요괴 하얘시니',
    color: '#4DFFAA',
  },
  {
    chapter: 2,
    name: '사탕 바구니 숲',
    fullName: '별자리가 떨어진 사탕 바구니 숲',
    sub: '곱셈 · 나눗셈',
    boss: '성급의 요괴 재촉새',
    color: '#28E6FF',
  },
  {
    chapter: 3,
    name: '오르골 구름 서재',
    fullName: '거꾸로 흐르는 오르골 구름 서재',
    sub: '분수',
    boss: '왜곡의 요괴 따돌시니',
    color: '#FFCB4D',
  },
  {
    chapter: 4,
    name: '색종이 사파리',
    fullName: '크레용 화산과 색종이 사파리',
    sub: '소수',
    boss: '무기력의 요괴 풀죽새',
    color: '#C889FF',
  },
  {
    chapter: 5,
    name: '은하 회전목마',
    fullName: '끝없는 기억의 은하 회전목마',
    sub: '전 영역 종합',
    boss: '영원한 고립의 지배자 캄캄대왕',
    color: '#FF4444',
  },
];

export interface MenuState {
  unlockedChapter: number;
  stars: Record<number, number>;
  selectedChapter: number;
  locomotionLabel?: string;
  locomotionIcon?: string;
}

export interface SubCardLayout {
  subLevel: number; // -1: Back, 0: ALL, 1~N: SubLevel
  label: string;
  subLabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked?: boolean;
  lockReason?: string;
}

export interface ChapterCardLayout {
  chapter: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  subtitle?: string;
  color?: string;
  locked?: boolean;
  lockReason?: string;
}

export interface ChapterCardPresentationOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  title?: string;
  subtitle?: string;
  color?: string;
  locked?: boolean;
  lockReason?: string;
  assetId?: string;
  image?: HTMLImageElement | null;
}

export interface SubCardPresentationOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  label?: string;
  subLabel?: string;
  locked?: boolean;
  lockReason?: string;
  assetId?: string;
  image?: HTMLImageElement | null;
}

export interface TitlePresentationOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  assetId?: string;
  image?: HTMLImageElement | null;
}

export interface ButtonPresentationOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  label?: string;
  icon?: string;
  locked?: boolean;
  lockReason?: string;
  assetId?: string;
  image?: HTMLImageElement | null;
}

export interface SubMenuGridOverride {
  startX?: number;
  startY?: number;
  gapX?: number;
  gapY?: number;
  cols?: number;
  w?: number;
  h?: number;
}

export interface MenuPresentationContext {
  readonly version?: string;
  /** 메인 메뉴 타이틀 오버라이드 */
  readonly title?: TitlePresentationOverride;
  /** 운동 모드 버튼 오버라이드 */
  readonly locomotionBtn?: ButtonPresentationOverride;
  /** 챕터 카드 1~5 개별 오버라이드 */
  readonly chapterCards?: Record<number, ChapterCardPresentationOverride>;
  /** 배경 이미지 오버라이드 */
  readonly background?: {
    assetId?: string;
    image?: HTMLImageElement | null;
  };

  /** 서브 메뉴 헤더/타이틀 오버라이드 */
  readonly subMenuTitle?: TitlePresentationOverride;
  /** 서브 메뉴 뒤로가기 버튼 오버라이드 */
  readonly subMenuBackBtn?: ButtonPresentationOverride;
  /** 서브 메뉴 그리드 레이아웃 오버라이드 */
  readonly subMenuGrid?: SubMenuGridOverride;
  /** 서브레벨 카드 개별 오버라이드 (키: subLevel 번호, -1: 뒤로가기, 0: 전체 종합, 1~N: 각 서브레벨) */
  readonly subCards?: Record<number, SubCardPresentationOverride>;

  /** 에셋 리졸버 (assetId -> HTMLImageElement | null) */
  readonly assetResolver?: (assetId: string) => HTMLImageElement | null;
  /** 커스텀 이미지 에셋 맵 */
  readonly imageAssets?: Record<string, HTMLImageElement | null>;

  /** UIPresentationDocument / UIPresentationPage 직접 연동 지원 (선택 사항) */
  readonly presentationDocument?: UIPresentationDocument;
  readonly mainPage?: UIPresentationPage;
  readonly subPage?: UIPresentationPage;
}

export class MenuRenderer {
  private _pulseTimer = 0;
  private _presentationContext?: MenuPresentationContext;

  constructor(presentationContext?: MenuPresentationContext) {
    if (presentationContext) {
      this.setPresentationContext(presentationContext);
    }
  }

  /**
   * 1.5초 주기 펄스 애니메이션 타이머 갱신
   */
  update(dt: number): void {
    this._pulseTimer = (this._pulseTimer + dt) % 1.5;
  }

  get pulseTimer(): number {
    return this._pulseTimer;
  }

  /**
   * Presentation Context 주입 (선택적 불변 컨텍스트)
   */
  setPresentationContext(context?: MenuPresentationContext): void {
    this._presentationContext = context;
  }

  /**
   * 주입된 Presentation Context 조회
   */
  getPresentationContext(): MenuPresentationContext | undefined {
    return this._presentationContext;
  }

  /**
   * Presentation Context 초기화
   */
  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  /**
   * Presentation Context 해석 및 UIPresentationDocument/Page 병합 (순수 불변 연산)
   */
  private _resolveContext(explicitCtx?: MenuPresentationContext): MenuPresentationContext | undefined {
    const base = explicitCtx ?? this._presentationContext;
    if (!base) return undefined;

    const doc = base.presentationDocument;
    const mainPage = base.mainPage ?? doc?.pages?.main_home;
    const subPage = base.subPage ?? doc?.pages?.submenu;

    const extractedChapterCards: Record<number, ChapterCardPresentationOverride> = {};
    let extractedTitle: TitlePresentationOverride | undefined;
    let extractedLocomotion: ButtonPresentationOverride | undefined;
    let extractedSubTitle: TitlePresentationOverride | undefined;
    let extractedSubBackBtn: ButtonPresentationOverride | undefined;
    const extractedSubCards: Record<number, SubCardPresentationOverride> = {};

    const parseMainElement = (el: any) => {
      if (!el || !el.bounds) return;
      const b = el.bounds;

      // 챕터 카드 판별
      const chMatch =
        el.actionId?.match(/^select_chapter_(\d)$/) ||
        el.id?.match(/^(?:btn_)?ch(?:apter)?_?(\d)$/i);
      if (chMatch) {
        const chNum = Number(chMatch[1]);
        if (chNum >= 1 && chNum <= 5) {
          extractedChapterCards[chNum] = {
            x: b.x,
            y: b.y,
            w: b.width ?? b.w,
            h: b.height ?? b.h,
            title: el.text,
            locked: el.locked,
            lockReason: el.lockReason,
            assetId: el.assetId,
          };
        }
      }

      // 메인 타이틀 판별
      if (el.id === 'home_title' || el.id === 'main_title' || (el.type === 'text' && el.text?.includes('수호신'))) {
        extractedTitle = {
          x: b.x,
          y: b.y,
          w: b.width ?? b.w,
          h: b.height ?? b.h,
          text: el.text,
          color: el.color,
          assetId: el.assetId,
        };
      }

      // 운동 버튼 판별
      if (el.actionId === 'nav_workout' || el.id === 'btn_locomotion' || el.id === 'locomotion_btn') {
        extractedLocomotion = {
          x: b.x,
          y: b.y,
          w: b.width ?? b.w,
          h: b.height ?? b.h,
          label: el.text,
        };
      }
    };

    const parseSubElement = (el: any) => {
      if (!el || !el.bounds) return;
      const b = el.bounds;

      // 서브 타이틀 판별
      if (el.id === 'sub_title') {
        extractedSubTitle = {
          x: b.x,
          y: b.y,
          w: b.width ?? b.w,
          h: b.height ?? b.h,
          text: el.text,
          color: el.color,
        };
      }

      // 서브 뒤로가기 버튼 판별
      if (el.actionId === 'close_submenu' || el.id === 'btn_close_sub' || el.id === 'back_btn') {
        extractedSubBackBtn = {
          x: b.x,
          y: b.y,
          w: b.width ?? b.w,
          h: b.height ?? b.h,
          label: el.text,
        };
      }

      // 서브레벨 슬롯 판별 (sub_1, sub_2 등)
      const subMatch =
        el.id?.match(/^(?:btn_)?sub(?:level)?_?(\d)$/i) ||
        el.actionId?.match(/^select_sub(?:level)?_?(\d)$/);
      if (subMatch) {
        const subNum = Number(subMatch[1]);
        extractedSubCards[subNum] = {
          x: b.x,
          y: b.y,
          w: b.width ?? b.w,
          h: b.height ?? b.h,
          label: el.text,
          locked: el.locked,
          lockReason: el.lockReason,
        };
      }
    };

    if (mainPage?.elements) {
      for (const el of mainPage.elements) parseMainElement(el);
    }
    if (subPage?.elements) {
      for (const el of subPage.elements) parseSubElement(el);
    }

    return {
      ...base,
      title: { ...extractedTitle, ...base.title },
      locomotionBtn: { ...extractedLocomotion, ...base.locomotionBtn },
      chapterCards: { ...extractedChapterCards, ...base.chapterCards },
      subMenuTitle: { ...extractedSubTitle, ...base.subMenuTitle },
      subMenuBackBtn: { ...extractedSubBackBtn, ...base.subMenuBackBtn },
      subCards: { ...extractedSubCards, ...base.subCards },
    };
  }

  /**
   * 상단 메인 타이틀 레이아웃 계산
   */
  getTitleLayout(w: number, h: number, context?: MenuPresentationContext): { x: number; y: number; w: number; h: number } {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const resolved = this._resolveContext(context);
    const titleSlot = UI_LAYOUT.menu.title;
    const override = resolved?.title;

    return {
      x: (override?.x !== undefined ? override.x : titleSlot.x) * scaleX,
      y: (override?.y !== undefined ? override.y : titleSlot.y) * scaleY,
      w: (override?.w !== undefined ? override.w : titleSlot.w) * scaleX,
      h: (override?.h !== undefined ? override.h : titleSlot.h) * scaleY,
    };
  }

  /**
   * 챕터 카드 레이아웃 계산 (2-2-1 와이드 다이아몬드 레이아웃, Issue #142 / UI-MENU-002, UI_LAYOUT 연동)
   * 1080x2160 가상 해상도 기준:
   * - 개별 카드: 360 x 380px
   * - 1행: Ch.1 (120, 460), Ch.2 (600, 460)
   * - 2행: Ch.3 (120, 920), Ch.4 (600, 920)
   * - 3행: Ch.5 (360, 1380, 중앙 정렬)
   */
  getChapterLayouts(w: number, h: number, context?: MenuPresentationContext): ChapterCardLayout[] {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const resolved = this._resolveContext(context);

    return UI_LAYOUT.menu.chapterCards.map((slot) => {
      const override = resolved?.chapterCards?.[slot.chapter];
      const cardX = override?.x !== undefined ? override.x * scaleX : slot.x * scaleX;
      const cardY = override?.y !== undefined ? override.y * scaleY : slot.y * scaleY;
      const cardW = override?.w !== undefined ? override.w * scaleX : UI_LAYOUT.menu.cardWidth * scaleX;
      const cardH = override?.h !== undefined ? override.h * scaleY : UI_LAYOUT.menu.cardHeight * scaleY;

      return {
        chapter: slot.chapter,
        x: cardX,
        y: cardY,
        w: cardW,
        h: cardH,
        title: override?.title,
        subtitle: override?.subtitle,
        color: override?.color,
        locked: override?.locked,
        lockReason: override?.lockReason,
      };
    });
  }

  /**
   * 운동 모드 선택 버튼 레이아웃
   */
  getLocomotionButtonLayout(w: number, h: number, context?: MenuPresentationContext): { x: number; y: number; w: number; h: number } {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const resolved = this._resolveContext(context);
    const lBtn = UI_LAYOUT.menu.locomotionBtn;
    const override = resolved?.locomotionBtn;

    return {
      x: (override?.x !== undefined ? override.x : lBtn.x) * scaleX,
      y: (override?.y !== undefined ? override.y : lBtn.y) * scaleY,
      w: (override?.w !== undefined ? override.w : lBtn.w) * scaleX,
      h: (override?.h !== undefined ? override.h : lBtn.h) * scaleY,
    };
  }

  /**
   * 운동 모드 선택 버튼 히트 테스트
   */
  hitTestLocomotion(x: number, y: number, w: number, h: number, padding = 10, context?: MenuPresentationContext): boolean {
    const scaleX = w / 1080;
    const btn = this.getLocomotionButtonLayout(w, h, context);
    const pad = padding * scaleX;
    return (
      x >= btn.x - pad &&
      x <= btn.x + btn.w + pad &&
      y >= btn.y - pad &&
      y <= btn.y + btn.h + pad
    );
  }

  /**
   * 서브 메뉴 상단 헤더/타이틀 레이아웃 계산
   */
  getSubMenuTitleLayout(w: number, h: number, context?: MenuPresentationContext): { x: number; y: number; w: number; h: number } {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const resolved = this._resolveContext(context);
    const titleSlot = UI_LAYOUT.subMenu.title;
    const override = resolved?.subMenuTitle;

    return {
      x: (override?.x !== undefined ? override.x : titleSlot.x) * scaleX,
      y: (override?.y !== undefined ? override.y : titleSlot.y) * scaleY,
      w: (override?.w !== undefined ? override.w : titleSlot.w) * scaleX,
      h: (override?.h !== undefined ? override.h : titleSlot.h) * scaleY,
    };
  }

  /**
   * 서브 메뉴 뒤로가기 버튼 레이아웃 계산
   */
  getSubMenuBackButtonLayout(w: number, h: number, context?: MenuPresentationContext): { x: number; y: number; w: number; h: number } {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const resolved = this._resolveContext(context);
    const backBtn = UI_LAYOUT.subMenu.backBtn;
    const override = resolved?.subMenuBackBtn ?? resolved?.subCards?.[-1];

    return {
      x: (override?.x !== undefined ? override.x : backBtn.x) * scaleX,
      y: (override?.y !== undefined ? override.y : backBtn.y) * scaleY,
      w: (override?.w !== undefined ? override.w : backBtn.w) * scaleX,
      h: (override?.h !== undefined ? override.h : backBtn.h) * scaleY,
    };
  }

  /**
   * 메인 챕터 선택 메뉴 렌더링 (2-2-1 와이드 다이아몬드 레이아웃)
   */
  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: MenuState,
    context?: MenuPresentationContext
  ): void {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const resolved = this._resolveContext(context);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 0. 배경 이미지 (설정 시)
    const bgImg =
      resolved?.background?.image ||
      (resolved?.background?.assetId ? (resolved?.imageAssets?.[resolved.background.assetId] || resolved?.assetResolver?.(resolved.background.assetId)) : null) ||
      resolved?.imageAssets?.['background'] ||
      (resolved?.assetResolver ? resolved.assetResolver('background') : null) ||
      imageLoader.get('menu', 'background');
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, w, h);
    }

    // 1. 상단 타이틀 영역 (Red Box: x: 140, y: 180, w: 800, h: 220)
    const titleSlot = this.getTitleLayout(w, h, resolved);
    const titleCenterY = (titleSlot.y + titleSlot.h / 2 - 30) * scaleY;
    const titleBgImg =
      resolved?.title?.image ||
      (resolved?.title?.assetId ? (resolved?.imageAssets?.[resolved.title.assetId] || resolved?.assetResolver?.(resolved.title.assetId)) : null) ||
      resolved?.imageAssets?.['titleBg'] ||
      resolved?.imageAssets?.['banner'] ||
      (resolved?.assetResolver ? (resolved.assetResolver('titleBg') || resolved.assetResolver('banner')) : null) ||
      imageLoader.get('menu', 'titleBg') ||
      imageLoader.get('menu', 'banner');

    if (titleBgImg) {
      const bannerW = titleSlot.w;
      const bannerH = 120 * scaleY;
      ctx.drawImage(titleBgImg, titleSlot.x + (titleSlot.w - bannerW) / 2, titleCenterY - bannerH / 2, bannerW, bannerH);
    } else {
      ctx.font = UIText.getFont('title', scaleX, 'bold');
      const titleColor = resolved?.title?.color ?? '#C889FF';
      ctx.fillStyle = titleColor;
      ctx.shadowColor = titleColor;
      ctx.shadowBlur = 16 * scaleX;
      const titleText = resolved?.title?.text ?? '꿈속 세계 탐험';
      ctx.fillText(titleText, titleSlot.x + titleSlot.w / 2, titleCenterY);
      ctx.shadowBlur = 0;

      // 상단 슬로건 배너 텍스트 (Issue #216 / UI-STORY-001)
      ctx.font = UIText.getFont('caption', scaleX, 'normal');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('깨비와 함께 신비로운 꿈의 성역으로 다이빙!', titleSlot.x + titleSlot.w / 2, titleCenterY + 54 * scaleY);
    }

    // 1-1. 운동 모드 선택 버튼 (배지 형태)
    const locomotionLabel = resolved?.locomotionBtn?.label ?? state.locomotionLabel;
    if (locomotionLabel) {
      const lBtn = this.getLocomotionButtonLayout(w, h, resolved);
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
      const icon = resolved?.locomotionBtn?.icon ?? state.locomotionIcon ?? '🏃';
      ctx.fillText(`${icon} 운동 모드: ${locomotionLabel} ⚙`, lBtn.x + lBtn.w / 2, lBtn.y + lBtn.h / 2);
    }

    // 2. 챕터 카드 5개 (2-2-1 와이드 다이아몬드)
    const layouts = this.getChapterLayouts(w, h, resolved);

    for (let i = 0; i < layouts.length; i++) {
      const item = layouts[i];
      const info = CHAPTER_INFO[i];
      const ch = item.chapter;
      const chOverride = resolved?.chapterCards?.[ch];
      const locked = item.locked !== undefined ? item.locked : ch > state.unlockedChapter;
      const selected = ch === state.selectedChapter;
      const cardColor = item.color ?? chOverride?.color ?? info.color;

      ctx.save();
      if (locked) {
        ctx.globalAlpha = 0.55;
      }

      const pulse = Math.sin((this._pulseTimer / 1.5) * Math.PI * 2) * 0.5 + 0.5;

      // 카드 배경 및 테두리 (라운드 코너 24px)
      const customImg =
        chOverride?.image ||
        (chOverride?.assetId ? (resolved?.imageAssets?.[chOverride.assetId] || resolved?.assetResolver?.(chOverride.assetId)) : null) ||
        resolved?.imageAssets?.[`cardFrame_${ch}`] ||
        (resolved?.assetResolver ? resolved.assetResolver(`cardFrame_${ch}`) : null) ||
        resolved?.imageAssets?.['cardFrame'] ||
        (resolved?.assetResolver ? resolved.assetResolver('cardFrame') : null);
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

      // 카드 내부 텍스트 (칸별 높이 1:1 매핑)
      // 1) 챕터 번호 (Ch.X): bold 48px
      ctx.fillStyle = locked ? '#999999' : cardColor;
      ctx.font = UIText.getFont('subheading', scaleX, 'bold');
      ctx.fillText(`Ch.${ch}`, item.x + item.w / 2, item.y + 75 * scaleY);

      // 2) 챕터명 (꿈속 탐험 테마): bold 44px
      ctx.fillStyle = locked ? '#888888' : '#FFFFFF';
      ctx.font = UIText.getFont('subheading', scaleX, 'bold');
      const cardTitle = item.title ?? chOverride?.title ?? (locked ? '???' : info.name);
      ctx.fillText(cardTitle, item.x + item.w / 2, item.y + 160 * scaleY);

      // 3) 학습 영역 / 테마 부제: 26px
      ctx.fillStyle = locked ? '#777777' : '#BBBBBB';
      ctx.font = UIText.getFont('label', scaleX, 'normal');
      const lockReasonText = item.lockReason ?? chOverride?.lockReason ?? '미개방 성역';
      const subTitleText = item.subtitle ?? chOverride?.subtitle ?? info.sub;
      ctx.fillText(locked ? lockReasonText : subTitleText, item.x + item.w / 2, item.y + 225 * scaleY);

      // 4) 별점 (★★★) 또는 잠금 (🔒)
      if (!locked) {
        const starCount = Math.max(0, Math.min(3, state.stars[ch] ?? 0));
        const starFullImg =
          resolved?.imageAssets?.['starFull'] ||
          (resolved?.assetResolver ? resolved.assetResolver('starFull') : null) ||
          imageLoader.get('menu', 'starFull');
        const starEmptyImg =
          resolved?.imageAssets?.['starEmpty'] ||
          (resolved?.assetResolver ? resolved.assetResolver('starEmpty') : null) ||
          imageLoader.get('menu', 'starEmpty');

        if (starFullImg && starEmptyImg) {
          const starSize = 36 * scaleX;
          const gap = 8 * scaleX;
          const totalW = 3 * starSize + 2 * gap;
          const startX = item.x + (item.w - totalW) / 2;
          const startY = item.y + 305 * scaleY - starSize / 2;
          for (let s = 0; s < 3; s++) {
            const sImg = s < starCount ? starFullImg : starEmptyImg;
            ctx.drawImage(sImg, startX + s * (starSize + gap), startY, starSize, starSize);
          }
        } else {
          const starStr = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);
          ctx.font = UIText.getFont('heading', scaleX, 'bold');
          ctx.fillStyle = '#FFCB4D';
          ctx.fillText(starStr, item.x + item.w / 2, item.y + 305 * scaleY);
        }
      } else {
        const lockImg =
          resolved?.imageAssets?.['lockIcon'] ||
          resolved?.imageAssets?.['lock'] ||
          (resolved?.assetResolver ? (resolved.assetResolver('lockIcon') || resolved.assetResolver('lock')) : null) ||
          imageLoader.get('menu', 'lockIcon') ||
          imageLoader.get('menu', 'lock');
        if (lockImg) {
          const lockSize = 40 * scaleX;
          ctx.drawImage(
            lockImg,
            item.x + (item.w - lockSize) / 2,
            item.y + 305 * scaleY - lockSize / 2,
            lockSize,
            lockSize
          );
        } else {
          ctx.font = UIText.getFont('heading', scaleX, 'bold');
          ctx.fillStyle = '#888888';
          ctx.fillText('🔒', item.x + item.w / 2, item.y + 305 * scaleY);
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 서브 메뉴 레이아웃 계산 (2열 3행 대형 와이드 그리드 카드들 + 하단 뒤로가기 버튼)
   * 오버로딩 지원:
   * - getSubMenuLayouts(w, h, chapter, subLevels, context?)
   * - getSubMenuLayouts(w, h, subLevels, context?)
   */
  getSubMenuLayouts(
    w: number,
    h: number,
    chapterOrSubLevels: number | SubLevelInfo[],
    subLevelsOrContext?: SubLevelInfo[] | MenuPresentationContext,
    context?: MenuPresentationContext
  ): SubCardLayout[] {
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    let subLevels: SubLevelInfo[] = [];
    let explicitCtx: MenuPresentationContext | undefined = context;

    if (Array.isArray(chapterOrSubLevels)) {
      subLevels = chapterOrSubLevels;
      if (subLevelsOrContext && !Array.isArray(subLevelsOrContext)) {
        explicitCtx = subLevelsOrContext as MenuPresentationContext;
      }
    } else {
      if (Array.isArray(subLevelsOrContext)) {
        subLevels = subLevelsOrContext;
      }
    }

    const resolved = this._resolveContext(explicitCtx);
    const layouts: SubCardLayout[] = [];

    // 1. 단계 목록 + 전체 종합(ALL)
    const allItems = [
      ...subLevels.map((s) => ({
        subLevel: s.subLevel,
        label: s.title || `단계 ${s.subLevel}`,
        subLabel: `${s.count}문항`,
      })),
      {
        subLevel: 0,
        label: '전체 종합 (ALL)',
        subLabel: '전체 혼합 풀',
      },
    ];

    const grid = UI_LAYOUT.subMenu.grid;
    const gridOverride = resolved?.subMenuGrid;
    const cardW = (gridOverride?.w ?? grid.w) * scaleX;
    const cardH = (gridOverride?.h ?? grid.h) * scaleY;
    const startX = (gridOverride?.startX ?? grid.startX) * scaleX;
    const startY = (gridOverride?.startY ?? grid.startY) * scaleY;
    const gapX = (gridOverride?.gapX ?? grid.gapX) * scaleX;
    const gapY = (gridOverride?.gapY ?? grid.gapY) * scaleY;
    const cols = gridOverride?.cols ?? grid.cols;

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const r = Math.floor(i / cols);
      const c = i % cols;
      const defaultX = startX + c * (cardW + gapX);
      const defaultY = startY + r * (cardH + gapY);

      const override = resolved?.subCards?.[item.subLevel];
      const x = override?.x !== undefined ? override.x * scaleX : defaultX;
      const y = override?.y !== undefined ? override.y * scaleY : defaultY;
      const w = override?.w !== undefined ? override.w * scaleX : cardW;
      const h = override?.h !== undefined ? override.h * scaleY : cardH;

      layouts.push({
        subLevel: item.subLevel,
        label: override?.label ?? item.label,
        subLabel: override?.subLabel ?? item.subLabel,
        x,
        y,
        w,
        h,
        locked: override?.locked,
        lockReason: override?.lockReason,
      });
    }

    // 2. 뒤로가기 버튼: 하단 고정 바 우측 슬롯 연동 (UI_LAYOUT.subMenu.backBtn)
    const backLayout = this.getSubMenuBackButtonLayout(w, h, explicitCtx);
    const backOverride = resolved?.subMenuBackBtn ?? resolved?.subCards?.[-1];
    layouts.push({
      subLevel: -1,
      label: backOverride?.label ?? '← 뒤로',
      subLabel: '챕터 선택',
      x: backLayout.x,
      y: backLayout.y,
      w: backLayout.w,
      h: backLayout.h,
      locked: backOverride?.locked,
      lockReason: backOverride?.lockReason,
    });

    return layouts;
  }

  /**
   * 챕터별 서브레벨 선택 화면 렌더링 (2열 3행 대형 와이드 그리드, Issue #142)
   */
  renderSubMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    chapter: number,
    subLevels: SubLevelInfo[],
    selectedSubLevel?: number,
    context?: MenuPresentationContext
  ): void {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const resolved = this._resolveContext(context);

    const chInfo = CHAPTER_INFO[chapter - 1] || CHAPTER_INFO[0];
    const layouts = this.getSubMenuLayouts(w, h, chapter, subLevels, resolved);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 0. 배경 이미지 (설정 시)
    const bgImg =
      resolved?.background?.image ||
      (resolved?.background?.assetId ? (resolved?.imageAssets?.[resolved.background.assetId] || resolved?.assetResolver?.(resolved.background.assetId)) : null) ||
      resolved?.imageAssets?.['background'] ||
      (resolved?.assetResolver ? resolved.assetResolver('background') : null) ||
      imageLoader.get('menu', 'background');
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, w, h);
    }

    // 1. 상단 헤더 영역 (Red Box: x: 80, y: 160, w: 920, h: 200)
    const titleSlot = this.getSubMenuTitleLayout(w, h, resolved);
    const titleCenterY = 240 * scaleY;
    const titleBgImg =
      resolved?.subMenuTitle?.image ||
      (resolved?.subMenuTitle?.assetId ? (resolved?.imageAssets?.[resolved.subMenuTitle.assetId] || resolved?.assetResolver?.(resolved.subMenuTitle.assetId)) : null) ||
      resolved?.imageAssets?.['titleBg'] ||
      resolved?.imageAssets?.['banner'] ||
      (resolved?.assetResolver ? (resolved.assetResolver('titleBg') || resolved.assetResolver('banner')) : null) ||
      imageLoader.get('menu', 'titleBg') ||
      imageLoader.get('menu', 'banner');

    if (titleBgImg) {
      const bannerW = titleSlot.w;
      const bannerH = 120 * scaleY;
      ctx.drawImage(titleBgImg, titleSlot.x + (titleSlot.w - bannerW) / 2, titleCenterY - bannerH / 2, bannerW, bannerH);
    } else {
      ctx.font = UIText.getFont('heading', scaleX, 'bold');
      const titleColor = resolved?.subMenuTitle?.color ?? chInfo.color;
      ctx.fillStyle = titleColor;
      ctx.shadowColor = titleColor;
      ctx.shadowBlur = 12 * scaleX;
      const titleText = resolved?.subMenuTitle?.text ?? `Ch.${chapter} ${chInfo.name} - 탐험 구역 선택`;
      ctx.fillText(titleText, titleSlot.x + titleSlot.w / 2, titleCenterY);
      ctx.shadowBlur = 0;

      // 안내 문구: 풀 테마명 및 학습 영역
      ctx.font = UIText.getFont('label', scaleX, 'normal');
      ctx.fillStyle = '#CCCCCC';
      ctx.fillText(`${chInfo.fullName} (${chInfo.sub})`, titleSlot.x + titleSlot.w / 2, titleCenterY + 65 * scaleY);
    }

    // 2. 단계 카드 6개 (2열 3행)
    for (const item of layouts) {
      if (item.subLevel === -1) {
        // 뒤로가기 버튼은 BottomBar에서 하단 고정 바 우측 슬롯으로 전담 렌더링
        continue;
      }

      const isAll = item.subLevel === 0;
      const isSelected = selectedSubLevel !== undefined && item.subLevel === selectedSubLevel;
      const baseColor = isAll ? '#FFCB4D' : chInfo.color;
      const locked = item.locked === true;

      ctx.save();
      if (locked) {
        ctx.globalAlpha = 0.55;
      }

      // 카드 배경 및 테두리 (라운드 코너 24px)
      const subCardBgImg =
        resolved?.imageAssets?.['sublevelCardBg'] ||
        (resolved?.assetResolver ? resolved.assetResolver('sublevelCardBg') : null) ||
        imageLoader.get('menu', 'sublevelCardBg');
      if (subCardBgImg) {
        ctx.drawImage(subCardBgImg, item.x, item.y, item.w, item.h);
        if (isSelected) {
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 4 * scaleX;
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 16 * scaleX;
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
        ctx.fillStyle = isSelected ? 'rgba(30, 20, 60, 0.95)' : 'rgba(20, 10, 40, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(item.x, item.y, item.w, item.h, 24 * scaleX);
        } else {
          ctx.rect(item.x, item.y, item.w, item.h);
        }
        ctx.fill();

        ctx.strokeStyle = isSelected ? baseColor : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isSelected ? 4 * scaleX : 1.5 * scaleX;
        if (isSelected) {
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 16 * scaleX;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 텍스트 (칸별 높이 1:1 매핑)
      // 1) 단계명 (대형 38px)
      ctx.fillStyle = locked ? '#888888' : isSelected ? baseColor : '#FFFFFF';
      ctx.font = UIText.getFont('heading', scaleX, 'bold');
      ctx.fillText(item.label, item.x + item.w / 2, item.y + 140 * scaleY);

      // 2) 부제 (문항 수 또는 잠금 사유)
      ctx.fillStyle = locked ? '#777777' : '#BBBBBB';
      ctx.font = UIText.getFont('subheading', scaleX, 'normal');
      const displaySubLabel = locked ? (item.lockReason ?? '도전 불가') : item.subLabel;
      ctx.fillText(displaySubLabel, item.x + item.w / 2, item.y + 230 * scaleY);

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 챕터 카드 클릭 판정 (getChapterLayouts와 100% 동기화)
   */
  hitTest(x: number, y: number, w: number, h: number, padding = 0, context?: MenuPresentationContext): number {
    const layouts = this.getChapterLayouts(w, h, context);
    for (const card of layouts) {
      if (
        x >= card.x - padding &&
        x <= card.x + card.w + padding &&
        y >= card.y - padding &&
        y <= card.y + card.h + padding
      ) {
        return card.chapter;
      }
    }
    return 0;
  }

  /**
   * 서브레벨 클릭 판정 (getSubMenuLayouts와 100% 동기화)
   * 오버로딩 지원:
   * - hitTestSub(x, y, w, h, chapter, subLevels, padding?, context?)
   * - hitTestSub(x, y, w, h, subLevels, padding?, context?)
   */
  hitTestSub(
    x: number,
    y: number,
    w: number,
    h: number,
    chapterOrSubLevels: number | SubLevelInfo[],
    subLevelsOrPadding?: SubLevelInfo[] | number,
    paddingOrContext?: number | MenuPresentationContext,
    context?: MenuPresentationContext
  ): number | null {
    let chapter = 1;
    let subLevels: SubLevelInfo[] = [];
    let padding = 0;
    let explicitCtx: MenuPresentationContext | undefined = context;

    if (Array.isArray(chapterOrSubLevels)) {
      subLevels = chapterOrSubLevels;
      if (typeof subLevelsOrPadding === 'number') {
        padding = subLevelsOrPadding;
      }
      if (typeof paddingOrContext === 'object' && paddingOrContext !== null) {
        explicitCtx = paddingOrContext as MenuPresentationContext;
      }
    } else {
      chapter = chapterOrSubLevels;
      if (Array.isArray(subLevelsOrPadding)) {
        subLevels = subLevelsOrPadding;
      }
      if (typeof paddingOrContext === 'number') {
        padding = paddingOrContext;
      }
    }

    const layouts = this.getSubMenuLayouts(w, h, chapter, subLevels, explicitCtx);
    for (const item of layouts) {
      if (
        x >= item.x - padding &&
        x <= item.x + item.w + padding &&
        y >= item.y - padding &&
        y <= item.y + item.h + padding
      ) {
        return item.subLevel;
      }
    }
    return null;
  }
}
