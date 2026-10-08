/**
 * BottomBar - 전 화면 공통 하단 고정 바 (Issue #141 / UI-BAR-001)
 *
 * 1080x2160 가상 해상도 기준 y: 1960px, h: 200px
 * 좌측: ⚙ 설정 버튼 (140x140)
 * 우측: 각 페이즈별 액션 버튼 슬롯 (240x140 기본, 커스텀 슬롯 지원)
 */

import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';

export interface BottomBarSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BOTTOM_BAR_CONFIG = UI_LAYOUT.bottomBar;

export interface BottomBarSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  label?: string;
  color?: string;
  assetId?: string;
  image?: HTMLImageElement | null;
  visible?: boolean;
}

export interface BottomBarPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  bar?: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    height?: number;
  };
  settingsBtn?: BottomBarSlotOverride;
  actionBtn?: BottomBarSlotOverride;
  manaBar?: BottomBarSlotOverride;
  pageOverrides?: Partial<Record<string, {
    actionBtn?: BottomBarSlotOverride;
    settingsBtn?: BottomBarSlotOverride;
    manaBar?: BottomBarSlotOverride;
  }>>;
}

export interface BottomBarRenderOptions {
  actionLabel?: string;
  actionColor?: string;
  customActionSlot?: BottomBarSlot;
  pageId?: string;
  settingsHoverProgress?: number;
  actionHoverProgress?: number;
  mana?: number;
  manaMax?: number;
  combo?: number;
}

export class BottomBar {
  private _presentationContext?: BottomBarPresentationContext;

  constructor(presentationContext?: BottomBarPresentationContext) {
    if (presentationContext) {
      this.setPresentationContext(presentationContext);
    }
  }

  /**
   * Presentation Context 주입 (선택적 표시 컨텍스트)
   */
  setPresentationContext(context?: BottomBarPresentationContext): void {
    this._presentationContext = context;
  }

  /**
   * 주입된 Presentation Context 조회
   */
  getPresentationContext(): BottomBarPresentationContext | undefined {
    return this._presentationContext;
  }

  /**
   * Presentation Context 초기화
   */
  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  /**
   * UIPresentationDocument로부터 BottomBar 관련 슬롯 추출
   */
  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId?: UIPresentationPageId | string
  ): BottomBarPresentationContext {
    const result: BottomBarPresentationContext = {
      presentationDocument: doc,
      pageId,
      pageOverrides: {},
    };
    if (!doc?.pages) return result;

    for (const [pKey, page] of Object.entries(doc.pages)) {
      if (!page?.elements) continue;
      for (const el of page.elements) {
        if (!el?.bounds) continue;
        const b = el.bounds;
        const boundsObj = {
          x: b.x,
          y: b.y,
          w: b.width ?? (b as any).w,
          h: b.height ?? (b as any).h,
          label: el.text,
        };

        if (
          el.id === 'btn_opt' ||
          el.id === 'btn_settings' ||
          el.actionId === 'open_settings'
        ) {
          result.settingsBtn = { ...boundsObj, ...result.settingsBtn };
        } else if (
          el.id === 'run_bottom_bar'
        ) {
          result.bar = { ...boundsObj, ...result.bar };
        } else if (
          el.id === 'mana_bar' ||
          (el.dynamicBinding as string) === 'preview_mana'
        ) {
          result.manaBar = { ...boundsObj, ...result.manaBar };
        }

        // Page specific action buttons
        if (
          el.actionId === 'close_submenu' ||
          el.actionId === 'close_settings' ||
          el.actionId === 'pause_resume' ||
          el.actionId === 'ready_start' ||
          el.actionId === 'result_retry' ||
          el.id === 'btn_action'
        ) {
          if (!result.pageOverrides![pKey]) {
            result.pageOverrides![pKey] = {};
          }
          result.pageOverrides![pKey]!.actionBtn = {
            ...boundsObj,
            ...result.pageOverrides![pKey]!.actionBtn,
          };
        }
      }
    }

    return result;
  }

  private _resolveContext(): BottomBarPresentationContext | undefined {
    if (!this._presentationContext) return undefined;
    const ctx = this._presentationContext;
    if (!ctx.presentationDocument) return ctx;

    const docCtx = BottomBar.fromPresentationDocument(ctx.presentationDocument, ctx.pageId);
    return {
      ...docCtx,
      ...ctx,
      settingsBtn: { ...docCtx.settingsBtn, ...ctx.settingsBtn },
      actionBtn: { ...docCtx.actionBtn, ...ctx.actionBtn },
      manaBar: { ...docCtx.manaBar, ...ctx.manaBar },
      bar: { ...docCtx.bar, ...ctx.bar },
      pageOverrides: { ...docCtx.pageOverrides, ...ctx.pageOverrides },
    };
  }

  /**
   * 하단 바 전체 영역 바운딩 박스 조회
   */
  getBottomBarBounds(w: number = 1080, h: number = 2160): { x: number; y: number; w: number; h: number } {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext();
    const barOverride = ctx?.bar;

    const bx = (barOverride?.x ?? BOTTOM_BAR_CONFIG.x ?? 0) * scaleX;
    const by = (barOverride?.y ?? BOTTOM_BAR_CONFIG.y) * scaleY;
    const bw = (barOverride?.w ?? BOTTOM_BAR_CONFIG.w ?? 1080) * scaleX;
    const bh = (barOverride?.h ?? barOverride?.height ?? BOTTOM_BAR_CONFIG.height) * scaleY;
    return { x: bx, y: by, w: bw, h: bh };
  }

  /**
   * 설정 버튼 바운딩 박스 조회
   */
  getSettingsButtonBounds(
    w: number = 1080,
    h: number = 2160,
    optionsOrPageId?: string | { pageId?: string }
  ): { x: number; y: number; w: number; h: number } {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const pageId = typeof optionsOrPageId === 'string' ? optionsOrPageId : optionsOrPageId?.pageId;
    const ctx = this._resolveContext();
    const effectivePageId = pageId ?? ctx?.pageId;
    const pageOverride = effectivePageId && ctx?.pageOverrides ? ctx.pageOverrides[effectivePageId]?.settingsBtn : undefined;
    const commonOverride = ctx?.settingsBtn;
    const resolved = pageOverride ?? commonOverride;
    const btn = BOTTOM_BAR_CONFIG.settingsBtn;

    const sx = (resolved?.x ?? btn.x) * scaleX;
    const sy = (resolved?.y ?? btn.y) * scaleY;
    const sw = (resolved?.w ?? btn.w) * scaleX;
    const sh = (resolved?.h ?? btn.h) * scaleY;
    return { x: sx, y: sy, w: sw, h: sh };
  }

  /**
   * 액션 버튼 바운딩 박스 조회 (Page Override > customActionSlot > Common Override > Default)
   */
  getActionButtonBounds(
    w: number = 1080,
    h: number = 2160,
    customSlotOrOptions?:
      | BottomBarSlot
      | string
      | { customSlot?: BottomBarSlot; customActionSlot?: BottomBarSlot; pageId?: string }
  ): { x: number; y: number; w: number; h: number } {
    let pageId: string | undefined;
    let customSlot: BottomBarSlot | undefined;

    if (typeof customSlotOrOptions === 'string') {
      pageId = customSlotOrOptions;
    } else if (customSlotOrOptions && typeof customSlotOrOptions === 'object') {
      if ('x' in customSlotOrOptions && 'y' in customSlotOrOptions && 'w' in customSlotOrOptions && 'h' in customSlotOrOptions) {
        customSlot = customSlotOrOptions as BottomBarSlot;
      } else {
        const opt = customSlotOrOptions as { customSlot?: BottomBarSlot; customActionSlot?: BottomBarSlot; pageId?: string };
        pageId = opt.pageId;
        customSlot = opt.customSlot ?? opt.customActionSlot;
      }
    }

    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext();
    const effectivePageId = pageId ?? ctx?.pageId;
    const pageOverride = effectivePageId && ctx?.pageOverrides ? ctx.pageOverrides[effectivePageId]?.actionBtn : undefined;
    const commonOverride = ctx?.actionBtn;
    const defaultBtn = BOTTOM_BAR_CONFIG.actionBtn;

    let bx: number, by: number, bw: number, bh: number;
    if (pageOverride) {
      bx = (pageOverride.x ?? defaultBtn.x) * scaleX;
      by = (pageOverride.y ?? defaultBtn.y) * scaleY;
      bw = (pageOverride.w ?? defaultBtn.w) * scaleX;
      bh = (pageOverride.h ?? defaultBtn.h) * scaleY;
    } else if (customSlot) {
      bx = customSlot.x * scaleX;
      by = customSlot.y * scaleY;
      bw = customSlot.w * scaleX;
      bh = customSlot.h * scaleY;
    } else if (commonOverride) {
      bx = (commonOverride.x ?? defaultBtn.x) * scaleX;
      by = (commonOverride.y ?? defaultBtn.y) * scaleY;
      bw = (commonOverride.w ?? defaultBtn.w) * scaleX;
      bh = (commonOverride.h ?? defaultBtn.h) * scaleY;
    } else {
      bx = defaultBtn.x * scaleX;
      by = defaultBtn.y * scaleY;
      bw = defaultBtn.w * scaleX;
      bh = defaultBtn.h * scaleY;
    }

    return { x: bx, y: by, w: bw, h: bh };
  }

  /**
   * 마나 바 바운딩 박스 조회
   */
  getManaBarBounds(
    w: number = 1080,
    h: number = 2160,
    optionsOrPageId?: string | { pageId?: string }
  ): { x: number; y: number; w: number; h: number } {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const pageId = typeof optionsOrPageId === 'string' ? optionsOrPageId : optionsOrPageId?.pageId;
    const ctx = this._resolveContext();
    const effectivePageId = pageId ?? ctx?.pageId;
    const pageOverride = effectivePageId && ctx?.pageOverrides ? ctx.pageOverrides[effectivePageId]?.manaBar : undefined;
    const commonOverride = ctx?.manaBar;
    const resolved = pageOverride ?? commonOverride;
    const manaSlot = BOTTOM_BAR_CONFIG.manaBar ?? { x: 210, y: 2038, w: 560, h: 50 };
    const scaledManaH = this.getManaBarHeight();

    const mx = (resolved?.x ?? manaSlot.x) * scaleX;
    const my = (resolved?.y ?? manaSlot.y) * scaleY;
    const mw = (resolved?.w ?? manaSlot.w) * scaleX;
    const mh = (resolved?.h ?? scaledManaH) * scaleY;
    return { x: mx, y: my, w: mw, h: mh };
  }

  /**
   * 설정 버튼 히트 테스트 (bounds와 1:1 일치)
   */
  hitTestSettings(
    x: number,
    y: number,
    w: number = 1080,
    h: number = 2160,
    padding: number = 0,
    optionsOrPageId?: string | { pageId?: string }
  ): boolean {
    const bounds = this.getSettingsButtonBounds(w, h, optionsOrPageId);
    return (
      x >= bounds.x - padding &&
      x <= bounds.x + bounds.w + padding &&
      y >= bounds.y - padding &&
      y <= bounds.y + bounds.h + padding
    );
  }

  /**
   * 우측 액션 버튼 히트 테스트 (bounds와 1:1 일치)
   */
  hitTestAction(
    x: number,
    y: number,
    w: number = 1080,
    h: number = 2160,
    padding: number = 0,
    customSlotOrOptions?:
      | BottomBarSlot
      | string
      | { customSlot?: BottomBarSlot; customActionSlot?: BottomBarSlot; pageId?: string }
  ): boolean {
    const bounds = this.getActionButtonBounds(w, h, customSlotOrOptions);
    return (
      x >= bounds.x - padding &&
      x <= bounds.x + bounds.w + padding &&
      y >= bounds.y - padding &&
      y <= bounds.y + bounds.h + padding
    );
  }

  /**
   * 마나 게이지 높이 산출 (Issue #265 / A11Y-004: 저시력 모드 fontScale 반영, 기본 50px -> 상한 100px 클램프)
   */
  getManaBarHeight(fontScale?: number): number {
    const scale = fontScale ?? UIText.getAccessibility().fontScale ?? 1.0;
    const ctx = this._resolveContext();
    const baseH = ctx?.manaBar?.h ?? BOTTOM_BAR_CONFIG.manaBar?.h ?? 50;
    return Math.min(100, baseH * scale);
  }

  /**
   * 공통 하단 바 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, options?: BottomBarRenderOptions): void {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const barBounds = this.getBottomBarBounds(w, h);
    const barY = barBounds.y;
    const barH = barBounds.h;

    ctx.save();

    // 1. 하단 바 배경 (반투명 다크 네이비 또는 이미지)
    const barBgImg = imageLoader.get('bottomBar', 'barBg');
    if (barBgImg) {
      ctx.drawImage(barBgImg, barBounds.x, barY, barBounds.w, barH);
    } else {
      ctx.fillStyle = 'rgba(10, 14, 26, 0.92)';
      ctx.fillRect(barBounds.x, barY, barBounds.w, barH);

      // 2. 상단 2px 네온 골드 구분선
      ctx.strokeStyle = '#FFCB4D';
      ctx.lineWidth = 2 * scaleY;
      ctx.beginPath();
      ctx.moveTo(barBounds.x, barY);
      ctx.lineTo(barBounds.x + barBounds.w, barY);
      ctx.stroke();
    }

    // 3. 좌측 "⚙ 설정" 버튼 (Cyan Box)
    const resCtx = this._resolveContext();
    const effectivePageId = options?.pageId ?? resCtx?.pageId;
    const pageSettingsOverride = effectivePageId && resCtx?.pageOverrides ? resCtx.pageOverrides[effectivePageId]?.settingsBtn : undefined;
    const resolvedSettings = pageSettingsOverride ?? resCtx?.settingsBtn;

    if (resolvedSettings?.visible !== false) {
      const sBounds = this.getSettingsButtonBounds(w, h, options);
      const sx = sBounds.x;
      const sy = sBounds.y;
      const sw = sBounds.w;
      const sh = sBounds.h;
      const sRadius = 20 * scaleX;

      const settingsIconImg = resolvedSettings?.image ?? imageLoader.get('bottomBar', 'settingsIcon');
      if (settingsIconImg) {
        ctx.drawImage(settingsIconImg, sx, sy, sw, sh);
      } else {
        ctx.fillStyle = resolvedSettings?.color ? `${resolvedSettings.color}1F` : 'rgba(40, 230, 255, 0.12)';
        ctx.strokeStyle = resolvedSettings?.color ?? '#28E6FF';
        ctx.lineWidth = 3 * scaleX;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(sx, sy, sw, sh, sRadius);
        } else {
          ctx.rect(sx, sy, sw, sh);
        }
        ctx.fill();
        ctx.stroke();

        // 설정 텍스트
        ctx.font = UIText.getFont('body', scaleX, 'bold');
        ctx.fillStyle = resolvedSettings?.color ?? '#28E6FF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const settingsText = resolvedSettings?.label ?? '⚙ 설정';
        ctx.fillText(settingsText, sx + sw / 2, sy + sh / 2);
      }

      // 설정 버튼 호버 게이지 아크
      if (options?.settingsHoverProgress && options.settingsHoverProgress > 0) {
        const progress = Math.min(1, Math.max(0, options.settingsHoverProgress));
        ctx.strokeStyle = resolvedSettings?.color ?? '#28E6FF';
        ctx.lineWidth = 5 * scaleX;
        ctx.beginPath();
        ctx.arc(sx + sw / 2, sy + sh / 2, (sw / 2) + 6 * scaleX, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
        ctx.stroke();
      }
    }

    // 4. 중앙 수평 마나 게이지 & 콤보 배지 (Issue #143)
    if (options?.mana !== undefined) {
      const mana = Math.max(0, options.mana);
      const manaMax = options.manaMax || 100;
      const ratio = Math.min(1, mana / manaMax);

      const mBounds = this.getManaBarBounds(w, h, options);
      const mx = mBounds.x;
      const my = mBounds.y;
      const mw = mBounds.w;
      const mh = mBounds.h;
      const mRadius = 14 * scaleX;

      // 콤보 표시
      if (options.combo && options.combo > 1) {
        ctx.font = UIText.getFont('label', scaleX, 'bold');
        ctx.fillStyle = '#FFCB4D';
        ctx.shadowColor = '#FFCB4D';
        ctx.shadowBlur = 10 * scaleX;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`🔥 COMBO x${options.combo}`, mx + mw / 2, my - 4 * scaleY);
        ctx.shadowBlur = 0;
      }

      // 마나 게이지 배경 및 채움 (이미지 분기 또는 기존 프로시저럴 드로잉)
      const manaFrameImg = imageLoader.get('bottomBar', 'manaFrame');
      const manaFillImg = imageLoader.get('bottomBar', 'manaFill');

      if (manaFrameImg || manaFillImg) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(mx, my, mw, mh, mRadius);
        } else {
          ctx.rect(mx, my, mw, mh);
        }
        ctx.fill();

        if (ratio > 0) {
          const fillW = mw * ratio;
          if (manaFillImg) {
            const srcW = manaFillImg.width * ratio;
            ctx.drawImage(manaFillImg, 0, 0, srcW, manaFillImg.height, mx, my, fillW, mh);
          } else {
            const mGrad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
            mGrad.addColorStop(0, '#C889FF');
            mGrad.addColorStop(1, '#FF65C3');
            ctx.fillStyle = mGrad;
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(mx, my, fillW, mh, mRadius);
            } else {
              ctx.rect(mx, my, fillW, mh);
            }
            ctx.fill();
          }
        }

        if (manaFrameImg) {
          ctx.drawImage(manaFrameImg, mx, my, mw, mh);
        } else {
          ctx.strokeStyle = 'rgba(200, 137, 255, 0.5)';
          ctx.lineWidth = 2 * scaleX;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(mx, my, mw, mh, mRadius);
          } else {
            ctx.rect(mx, my, mw, mh);
          }
          ctx.stroke();
        }
      } else {
        // 마나 게이지 배경
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.strokeStyle = 'rgba(200, 137, 255, 0.5)';
        ctx.lineWidth = 2 * scaleX;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(mx, my, mw, mh, mRadius);
        } else {
          ctx.rect(mx, my, mw, mh);
        }
        ctx.fill();
        ctx.stroke();

        // 마나 게이지 채우기
        if (ratio > 0) {
          const fillW = Math.max(mRadius * 2, mw * ratio);
          const mGrad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
          mGrad.addColorStop(0, '#C889FF');
          mGrad.addColorStop(1, '#FF65C3');
          ctx.fillStyle = mGrad;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(mx, my, fillW, mh, mRadius);
          } else {
            ctx.rect(mx, my, fillW, mh);
          }
          ctx.fill();
        }
      }

      // 마나 텍스트 라벨
      ctx.font = UIText.getFont('label', scaleX, 'bold');
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4 * scaleX;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`MANA ${Math.round(mana)} / ${manaMax}`, mx + mw / 2, my + mh / 2);
      ctx.shadowBlur = 0;
    }

    // 5. 우측 액션 버튼
    const pageActionOverride = effectivePageId && resCtx?.pageOverrides ? resCtx.pageOverrides[effectivePageId]?.actionBtn : undefined;
    const resolvedAction = pageActionOverride ?? resCtx?.actionBtn;
    const effectiveLabel = resolvedAction?.label ?? options?.actionLabel;

    if (effectiveLabel && resolvedAction?.visible !== false) {
      const aBounds = this.getActionButtonBounds(w, h, options);
      const ax = aBounds.x;
      const ay = aBounds.y;
      const aw = aBounds.w;
      const ah = aBounds.h;
      const aColor = resolvedAction?.color ?? options?.actionColor ?? '#FF4444';
      const aRadius = 20 * scaleX;

      const actionBtnImg = resolvedAction?.image ?? imageLoader.get('bottomBar', 'actionButton');
      if (actionBtnImg) {
        ctx.drawImage(actionBtnImg, ax, ay, aw, ah);
      } else {
        ctx.fillStyle = resolvedAction?.color ? `${resolvedAction.color}26` : 'rgba(255, 68, 68, 0.15)';
        ctx.strokeStyle = aColor;
        ctx.lineWidth = 3 * scaleX;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(ax, ay, aw, ah, aRadius);
        } else {
          ctx.rect(ax, ay, aw, ah);
        }
        ctx.fill();
        ctx.stroke();

        ctx.font = UIText.getFont('body', scaleX, 'bold');
        ctx.fillStyle = aColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(effectiveLabel, ax + aw / 2, ay + ah / 2);
      }

      // 액션 버튼 호버 게이지 아크
      if (options?.actionHoverProgress && options.actionHoverProgress > 0) {
        const progress = Math.min(1, Math.max(0, options.actionHoverProgress));
        ctx.strokeStyle = aColor;
        ctx.lineWidth = 5 * scaleX;
        ctx.beginPath();
        ctx.arc(ax + aw / 2, ay + ah / 2, (ah / 2) + 6 * scaleX, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
