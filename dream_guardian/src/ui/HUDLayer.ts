/**
 * HUDLayer - 스트리트파이터 스타일 듀얼 HP HUD, 마나 플라스크, 실드
 *
 * Canvas 2D로 직접 렌더링하는 인게임 HUD
 * 체력/마나 부드러운 감쇠 애니메이션
 *
 * @see Issue #21 (GitHub #86)
 */

import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import { getBossName } from '../data/bossData.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import {
  LOCOMOTION_HUD_GUIDES,
  type LocomotionHUDGuide,
} from '../../config/locomotion.config.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';

/** UI_LAYOUT 가상 좌표계 기준 너비 */
const VIRTUAL_WIDTH = 1080;

export { LOCOMOTION_HUD_GUIDES };
export type { LocomotionHUDGuide };

export interface HUDData {
  playerHp: number;
  playerMaxHp: number;
  bossHp: number;
  bossMaxHp: number;
  combo: number;
  chapter: number;
  guardianStage: number;
}

export interface HUDSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  marginRight?: number;
  label?: string;
  color?: string;
  assetId?: string;
  image?: HTMLImageElement | null;
  visible?: boolean;
}

export interface HUDPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  playerHpBar?: HUDSlotOverride;
  bossHpBar?: HUDSlotOverride;
  bossName?: HUDSlotOverride;
  combo?: HUDSlotOverride;
}

export class HUDLayer {
  private _displayPlayerHp = 1;
  private _displayBossHp = 1;
  private _presentationContext?: HUDPresentationContext;

  constructor(presentationContext?: HUDPresentationContext) {
    if (presentationContext) {
      this.setPresentationContext(presentationContext);
    }
  }

  /**
   * Presentation Context 주입 (선택적 표시 컨텍스트)
   */
  setPresentationContext(context?: HUDPresentationContext): void {
    this._presentationContext = context;
  }

  /**
   * 주입된 Presentation Context 조회
   */
  getPresentationContext(): HUDPresentationContext | undefined {
    return this._presentationContext;
  }

  /**
   * Presentation Context 초기화
   */
  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  /**
   * UIPresentationDocument로부터 HUD 관련 슬롯 추출
   */
  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId?: UIPresentationPageId | string
  ): HUDPresentationContext {
    const result: HUDPresentationContext = {
      presentationDocument: doc,
      pageId,
    };
    if (!doc?.pages) return result;

    const targetPages = pageId && doc.pages[pageId as UIPresentationPageId]
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
          w: b.width ?? (b as any).w,
          h: b.height ?? (b as any).h,
          label: el.text,
        };

        if (
          el.id === 'hud_player_hp' ||
          el.id === 'player_hp' ||
          el.dynamicBinding === 'preview_player_hp'
        ) {
          result.playerHpBar = { ...boundsObj, ...result.playerHpBar };
        } else if (
          el.id === 'hud_boss_hp' ||
          el.id === 'boss_hp' ||
          el.dynamicBinding === 'preview_boss_hp'
        ) {
          result.bossHpBar = { ...boundsObj, ...result.bossHpBar };
        } else if (
          el.id === 'hud_boss_name' ||
          el.id === 'boss_name' ||
          el.id === 'boss_hud'
        ) {
          result.bossName = { ...boundsObj, ...result.bossName };
        } else if (
          el.id === 'hud_combo' ||
          el.id === 'run_combo' ||
          el.id === 'combo' ||
          el.dynamicBinding === 'preview_combo'
        ) {
          result.combo = { ...boundsObj, ...result.combo };
        }
      }
    }

    return result;
  }

  private _resolveContext(): HUDPresentationContext | undefined {
    if (!this._presentationContext) return undefined;
    const ctx = this._presentationContext;
    if (!ctx.presentationDocument) return ctx;

    const docCtx = HUDLayer.fromPresentationDocument(ctx.presentationDocument, ctx.pageId);
    return {
      ...docCtx,
      ...ctx,
      playerHpBar: { ...docCtx.playerHpBar, ...ctx.playerHpBar },
      bossHpBar: { ...docCtx.bossHpBar, ...ctx.bossHpBar },
      bossName: { ...docCtx.bossName, ...ctx.bossName },
      combo: { ...docCtx.combo, ...ctx.combo },
    };
  }

  /**
   * 매 프레임 호출: 부드러운 감쇠 보간
   */
  update(dt: number, data: HUDData): void {
    const lerpSpeed = 5;
    const targetPHp = data.playerHp / data.playerMaxHp;
    const targetBHp = data.bossHp / data.bossMaxHp;

    this._displayPlayerHp += (targetPHp - this._displayPlayerHp) * lerpSpeed * dt;
    this._displayBossHp += (targetBHp - this._displayBossHp) * lerpSpeed * dt;
  }

  /**
   * Canvas에 HUD 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, _h: number, data: HUDData): void {
    this._renderHpBars(ctx, w, data);
    this._renderCombo(ctx, w, data);
    this._renderBossName(ctx, w, data);
  }

  /**
   * 플레이어 HP바 바운딩 박스 조회
   */
  getPlayerHpBarBounds(w: number = VIRTUAL_WIDTH, _h?: number): { x: number; y: number; w: number; h: number } {
    const resolved = this._resolveContext();
    const hpSlot = UI_LAYOUT.hud.playerHpBar;
    const defaultW = Math.min(hpSlot.w, this._hpBarMaxWidth(w));
    const defaultH = this.getHpBarHeight();
    const defaultX = hpSlot.x;
    const defaultY = hpSlot.y;

    return {
      x: resolved?.playerHpBar?.x ?? defaultX,
      y: resolved?.playerHpBar?.y ?? defaultY,
      w: resolved?.playerHpBar?.w ?? defaultW,
      h: resolved?.playerHpBar?.h ?? defaultH,
    };
  }

  /**
   * 보스 HP바 바운딩 박스 조회
   */
  getBossHpBarBounds(w: number = VIRTUAL_WIDTH, _h?: number): { x: number; y: number; w: number; h: number } {
    const resolved = this._resolveContext();
    const bossSlot = UI_LAYOUT.hud.bossHpBar;
    const defaultW = Math.min(bossSlot.w, this._hpBarMaxWidth(w));
    const defaultH = this._scaledHpBarHeight(bossSlot.h);
    // 우측 앵커: 1080 기준 오른쪽 여백을 실제 화면 너비에서도 유지
    const marginRight = VIRTUAL_WIDTH - bossSlot.x - bossSlot.w;
    const defaultX = w - marginRight - defaultW;
    const defaultY = bossSlot.y;

    return {
      x: resolved?.bossHpBar?.x ?? defaultX,
      y: resolved?.bossHpBar?.y ?? defaultY,
      w: resolved?.bossHpBar?.w ?? defaultW,
      h: resolved?.bossHpBar?.h ?? defaultH,
    };
  }

  /**
   * HP바 바운딩 박스 범용 조회 ('player' | 'boss')
   */
  getHpBarBounds(
    target: 'player' | 'boss',
    w: number = VIRTUAL_WIDTH,
    h?: number
  ): { x: number; y: number; w: number; h: number } {
    return target === 'player' ? this.getPlayerHpBarBounds(w, h) : this.getBossHpBarBounds(w, h);
  }

  /**
   * 보스 이름 플레이트 바운딩 박스 조회
   */
  getBossNameBounds(w: number = VIRTUAL_WIDTH, _h?: number): { x: number; y: number; w: number; h: number } {
    const resolved = this._resolveContext();
    const nameSlot = UI_LAYOUT.hud.bossName;
    const plateW = nameSlot.w;
    const plateH = nameSlot.h;
    // 중앙 앵커: 1080 기준 x를 실제 화면 너비의 중앙 이동량만큼 평행 이동
    const defaultX = nameSlot.x + (w - VIRTUAL_WIDTH) / 2;
    const defaultY = nameSlot.y;

    return {
      x: resolved?.bossName?.x ?? defaultX,
      y: resolved?.bossName?.y ?? defaultY,
      w: resolved?.bossName?.w ?? plateW,
      h: resolved?.bossName?.h ?? plateH,
    };
  }

  /**
   * 콤보 배지 바운딩 박스 조회
   */
  getComboBounds(w: number = VIRTUAL_WIDTH, _h?: number): { x: number; y: number; w: number; h: number } {
    const resolved = this._resolveContext();
    const badgeSlot = (UI_LAYOUT.hud.comboBadge as any) ?? { w: 160, h: 48, y: 48, marginRight: 24 };
    const defaultW = badgeSlot.w;
    const defaultH = badgeSlot.h;
    const defaultX = badgeSlot.x !== undefined ? badgeSlot.x : w - defaultW - (badgeSlot.marginRight ?? 24);
    const defaultY = badgeSlot.y;

    return {
      x: resolved?.combo?.x ?? defaultX,
      y: resolved?.combo?.y ?? defaultY,
      w: resolved?.combo?.w ?? defaultW,
      h: resolved?.combo?.h ?? defaultH,
    };
  }

  /**
   * HP바 높이 산출 (Issue #265 / A11Y-004: 저시력 모드 fontScale 반영, 기본 32px -> 상한 64px 클램프)
   */
  getHpBarHeight(fontScale?: number): number {
    return this._scaledHpBarHeight(UI_LAYOUT.hud.playerHpBar?.h ?? 32, fontScale);
  }

  private _scaledHpBarHeight(baseH: number, fontScale?: number): number {
    const scale = fontScale ?? UIText.getAccessibility().fontScale ?? 1.0;
    return Math.min(UI_LAYOUT.hud.hpBarMax.h, baseH * scale);
  }

  /** HP바 너비 상한: 1080 가상 px 기준 값을 화면 너비 비율로 환산 (매 호출 시 UI_LAYOUT 재조회) */
  private _hpBarMaxWidth(w: number): number {
    return w * (UI_LAYOUT.hud.hpBarMax.w / VIRTUAL_WIDTH);
  }

  private _renderHpBars(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    // Issue #132: 1m+ 원거리 가독성을 위한 HP바 및 수치 텍스트 대형화 (UI_LAYOUT 슬롯 참조)
    // Issue #265: 저시력 모드(A11Y-004) 동적 스케일링 (기본 32px -> Math.min(64, 32 * fontScale))
    const hud = UI_LAYOUT.hud as any;
    const resolved = this._resolveContext();
    const pBounds = this.getPlayerHpBarBounds(w);
    const pad = pBounds.x;
    const y = pBounds.y;
    const barW = pBounds.w;
    const barH = pBounds.h;

    // 플레이어 HP (좌측)
    const hpFrameImg = resolved?.playerHpBar?.image ?? imageLoader.get('hud', 'hpBarFrame');
    const playerFillImg = imageLoader.get('hud', 'hpBarFillPlayer');
    const legacyPlayerImg = imageLoader.get('hud', 'playerHpBar');

    if (hpFrameImg || playerFillImg) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(pad, y, barW, barH);

      const currentRatio = Math.max(0, Math.min(1, this._displayPlayerHp));
      if (currentRatio > 0) {
        const fillW = barW * currentRatio;
        if (playerFillImg) {
          const srcW = playerFillImg.width * currentRatio;
          ctx.drawImage(playerFillImg, 0, 0, srcW, playerFillImg.height, pad, y, fillW, barH);
        } else {
          const pGrad = ctx.createLinearGradient(pad, 0, pad + barW, 0);
          pGrad.addColorStop(0, resolved?.playerHpBar?.color ?? '#28E6FF');
          pGrad.addColorStop(1, '#4DFFAA');
          ctx.fillStyle = pGrad;
          ctx.fillRect(pad, y, fillW, barH);
        }
      }

      if (hpFrameImg) {
        ctx.drawImage(hpFrameImg, pad, y, barW, barH);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(pad, y, barW, barH);
      }
    } else if (legacyPlayerImg) {
      ctx.drawImage(legacyPlayerImg, pad, y, barW, barH);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(pad, y, barW, barH);
      const pGrad = ctx.createLinearGradient(pad, 0, pad + barW, 0);
      pGrad.addColorStop(0, resolved?.playerHpBar?.color ?? '#28E6FF');
      pGrad.addColorStop(1, '#4DFFAA');
      ctx.fillStyle = pGrad;
      ctx.fillRect(pad, y, barW * Math.max(0, this._displayPlayerHp), barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(pad, y, barW, barH);
    }

    // 라벨 (최소 26px 볼드 + 섀도우)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fff';
    const playerHpScale =
      hud.playerHpBar?.textScale !== undefined && hud.playerHpBar.textScale !== 1.0
        ? hud.playerHpBar.textScale
        : hud.playerHpText?.textScale !== undefined && hud.playerHpText.textScale !== 1.0
          ? hud.playerHpText.textScale
          : hud.playerHp?.textScale ?? hud.playerHpText?.textScale ?? hud.playerHpBar?.textScale ?? 1.0;
    ctx.font = UIText.getFont(
      'caption',
      1.0 * playerHpScale,
      'bold',
      'sans-serif',
      Math.round(26 * playerHpScale),
    );
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const playerHpLabel = resolved?.playerHpBar?.label ?? `HP ${data.playerHp}/${data.playerMaxHp}`;
    ctx.fillText(playerHpLabel, pad + UI_LAYOUT.hud.hpLabelInset.x, y + barH / 2);
    ctx.restore();

    // 보스 HP (우측)
    const bBounds = this.getBossHpBarBounds(w);
    const bx = bBounds.x;
    const by = bBounds.y;
    const bossBarW = bBounds.w;
    const bossBarH = bBounds.h;

    const bossFrameImg = resolved?.bossHpBar?.image ?? hpFrameImg;
    const bossFillImg = imageLoader.get('hud', 'hpBarFillBoss');
    const legacyBossImg = imageLoader.get('hud', 'bossHpBar');

    if (bossFrameImg || bossFillImg) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, by, bossBarW, bossBarH);

      const currentRatio = Math.max(0, Math.min(1, this._displayBossHp));
      if (currentRatio > 0) {
        const fillW = bossBarW * currentRatio;
        if (bossFillImg) {
          const srcW = bossFillImg.width * currentRatio;
          const srcX = bossFillImg.width - srcW;
          ctx.drawImage(bossFillImg, srcX, 0, srcW, bossFillImg.height, bx + bossBarW - fillW, by, fillW, bossBarH);
        } else {
          const bGrad = ctx.createLinearGradient(bx + bossBarW, 0, bx, 0);
          bGrad.addColorStop(0, resolved?.bossHpBar?.color ?? '#FF4444');
          bGrad.addColorStop(1, '#FF8844');
          ctx.fillStyle = bGrad;
          ctx.fillRect(bx + bossBarW - fillW, by, fillW, bossBarH);
        }
      }

      if (bossFrameImg) {
        ctx.drawImage(bossFrameImg, bx, by, bossBarW, bossBarH);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx, by, bossBarW, bossBarH);
      }
    } else if (legacyBossImg) {
      ctx.drawImage(legacyBossImg, bx, by, bossBarW, bossBarH);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, by, bossBarW, bossBarH);
      const bGrad = ctx.createLinearGradient(bx + bossBarW, 0, bx, 0);
      bGrad.addColorStop(0, resolved?.bossHpBar?.color ?? '#FF4444');
      bGrad.addColorStop(1, '#FF8844');
      ctx.fillStyle = bGrad;
      const fillBossW = bossBarW * Math.max(0, this._displayBossHp);
      ctx.fillRect(bx + bossBarW - fillBossW, by, fillBossW, bossBarH);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, by, bossBarW, bossBarH);
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    const bossHpScale =
      hud.bossHpBar?.textScale !== undefined && hud.bossHpBar.textScale !== 1.0
        ? hud.bossHpBar.textScale
        : hud.bossHpText?.textScale !== undefined && hud.bossHpText.textScale !== 1.0
          ? hud.bossHpText.textScale
          : hud.bossHp?.textScale ?? hud.bossHpText?.textScale ?? hud.bossHpBar?.textScale ?? 1.0;
    ctx.font = UIText.getFont(
      'caption',
      1.0 * bossHpScale,
      'bold',
      'sans-serif',
      Math.round(26 * bossHpScale),
    );
    const bossHpLabel = resolved?.bossHpBar?.label ?? `HP ${data.bossHp}/${data.bossMaxHp}`;
    ctx.fillText(bossHpLabel, bx + bossBarW - UI_LAYOUT.hud.hpLabelInset.x, by + bossBarH / 2);
    ctx.restore();
  }

  private _renderCombo(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    if (data.combo <= 0) return;
    const resolved = this._resolveContext();
    const cBounds = this.getComboBounds(w);
    const badgeW = cBounds.w;
    const badgeH = cBounds.h;
    const badgeX = cBounds.x;
    const badgeY = cBounds.y;

    const comboImg = resolved?.combo?.image ?? imageLoader.get('hud', 'comboBadge');
    if (comboImg) {
      ctx.drawImage(comboImg, badgeX, badgeY, badgeW, badgeH);
    }

    const comboText = resolved?.combo?.label ?? `COMBO x${data.combo}`;
    const hud = UI_LAYOUT.hud as any;
    const comboScale =
      hud.comboBadge?.textScale !== undefined && hud.comboBadge.textScale !== 1.0
        ? hud.comboBadge.textScale
        : hud.comboText?.textScale ?? hud.comboBadge?.textScale ?? 1.0;
    const font = UIText.getFont(data.combo >= 5 ? 'body' : 'badge', 1.0 * comboScale, 'bold');

    ctx.save();
    ctx.font = font;

    const comboIcon = imageLoader.get('hud', 'comboIcon');
    const textRight = badgeX + badgeW;
    const textY = badgeY + badgeH / 2 + UI_LAYOUT.hud.comboTextOffsetY;

    if (comboIcon) {
      const textW = ctx.measureText ? ctx.measureText(comboText).width : 80;
      const iconSlot = UI_LAYOUT.hud.comboIcon;
      const iconX = textRight - textW - iconSlot.w - iconSlot.gapX;
      const iconY = textY - iconSlot.h / 2;
      ctx.drawImage(comboIcon, iconX, iconY, iconSlot.w, iconSlot.h);
    }

    ctx.shadowColor = data.combo >= 5 ? '#FFCB4D' : '#28E6FF';
    ctx.shadowBlur = 10;
    ctx.fillStyle = resolved?.combo?.color ?? (data.combo >= 5 ? '#FFCB4D' : '#fff');
    ctx.textAlign = 'right';
    ctx.fillText(comboText, textRight, textY);
    ctx.restore();
  }

  private _renderBossName(ctx: CanvasRenderingContext2D, w: number, data: HUDData): void {
    const resolved = this._resolveContext();
    const nameBounds = this.getBossNameBounds(w);
    const plateW = nameBounds.w;
    const plateH = nameBounds.h;
    const plateX = nameBounds.x;
    const plateY = nameBounds.y;

    const bossNameplate = resolved?.bossName?.image ?? imageLoader.get('hud', 'bossNameplate');
    if (bossNameplate) {
      ctx.drawImage(bossNameplate, plateX, plateY, plateW, plateH);
    }

    ctx.save();
    ctx.shadowColor = '#FF4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = resolved?.bossName?.color ?? '#FFCB4D';
    const hud = UI_LAYOUT.hud as any;
    const bossNameScale =
      hud.bossName?.textScale !== undefined && hud.bossName.textScale !== 1.0
        ? hud.bossName.textScale
        : hud.bossNameText?.textScale ?? hud.bossName?.textScale ?? 1.0;
    ctx.font = UIText.getFont(
      'badge',
      1.0 * bossNameScale,
      'bold',
      'sans-serif',
      Math.round(28 * bossNameScale),
    );
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bossText = resolved?.bossName?.label ?? `Ch.${data.chapter} ${getBossName(data.chapter)}`;
    ctx.fillText(bossText, plateX + plateW / 2, plateY + plateH / 2);
    ctx.restore();
  }

  /**
   * 선택된 운동 모드의 인게임 모션 가이드 조회 (Issue #155)
   */
  getLocomotionGuide(mode: LocomotionMode = 'run'): LocomotionHUDGuide {
    return LOCOMOTION_HUD_GUIDES[mode] ?? LOCOMOTION_HUD_GUIDES.run;
  }

  reset(): void {
    this._displayPlayerHp = 1;
    this._displayBossHp = 1;
  }
}
