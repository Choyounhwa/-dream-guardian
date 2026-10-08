/**
 * SettingsView.ts - 게임 설정 모달 순수 렌더러 및 레이아웃/히트 테스트 모듈
 * (Issue #441 / UI-VIS-011)
 *
 * 개발 규칙 1절 (핵심 개발 철학) 및 12절 (UI 개발 규칙) 준수:
 * 1. 부작용 0건: localStorage, DOM fullscreen, camera, 전역 UI_ACCESSIBILITY/UIText 조작 없이 순수 DTO 및 Context만 수신하여 렌더링.
 * 2. 실게임 렌더러 재사용 10페이지 시각 UI 편집기와 런타임 SettingsModal 간의 단일 진실 공급원(SSOT) 뷰.
 * 3. 9개 설정 액션(close, camera, fullscreen, skeleton, sound, locomotion, fontScale, highContrast, stickmanScale)의 버튼 레이아웃 및 히트 판정 일원화.
 */

import { UI_LAYOUT } from '../../config/ui.config.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';

export type SettingsButtonAction =
  | 'close'
  | 'camera'
  | 'fullscreen'
  | 'skeleton'
  | 'sound'
  | 'locomotion'
  | 'fontScale'
  | 'highContrast'
  | 'stickmanScale';

export type SettingsAction = SettingsButtonAction | 'backdrop-close';

export const SETTINGS_BUTTON_ACTIONS: readonly SettingsButtonAction[] = [
  'close',
  'camera',
  'fullscreen',
  'skeleton',
  'sound',
  'locomotion',
  'fontScale',
  'highContrast',
  'stickmanScale',
] as const;

export interface ModalButtonSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SettingsViewModel {
  isOpen: boolean;
  isClosing?: boolean;
  alpha: number;
  scale: number;
  cameraEnabled: boolean;
  skeletonEnabled: boolean;
  soundEnabled: boolean;
  locomotionModeLabel: string;
  fontScale: number;
  fontScaleLabel?: string;
  highContrast: boolean;
  stickmanScale: number;
  stickmanScaleLabel?: string;
  isFullscreen?: boolean;
}

export type SettingsViewDTO = SettingsViewModel;

export interface SettingsButtonSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface SettingsModalBoundsOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface SettingsPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  modal?: SettingsModalBoundsOverride;
  buttons?: Partial<Record<SettingsButtonAction, SettingsButtonSlotOverride>>;
  closeBtn?: SettingsButtonSlotOverride;
  cameraBtn?: SettingsButtonSlotOverride;
  fullscreenBtn?: SettingsButtonSlotOverride;
  skeletonBtn?: SettingsButtonSlotOverride;
  soundBtn?: SettingsButtonSlotOverride;
  locomotionBtn?: SettingsButtonSlotOverride;
  fontScaleBtn?: SettingsButtonSlotOverride;
  highContrastBtn?: SettingsButtonSlotOverride;
  stickmanScaleBtn?: SettingsButtonSlotOverride;
}

/**
 * 폰트 스케일 수치 기반 표시 라벨 반환 (순수 함수)
 */
export function getFontScaleLabel(fontScale: number): string {
  if (Math.abs(fontScale - 1.5) < 0.05) return '크게 (1.5x)';
  if (Math.abs(fontScale - 2.0) < 0.05) return '매우 크게 (2.0x)';
  return '기본 (1.0x)';
}

/**
 * 스틱맨 스케일 수치 기반 표시 라벨 반환 (순수 함수)
 */
export function getStickmanScaleLabel(stickmanScale: number): string {
  if (Math.abs(stickmanScale - 1.25) < 0.05) return '크게 (1.25x)';
  if (Math.abs(stickmanScale - 1.5) < 0.05) return '매우 크게 (1.5x)';
  if (Math.abs(stickmanScale - 2.0) < 0.05) return '최대 (2.0x)';
  return '기본 (1.0x)';
}

/**
 * 기본 SettingsViewModel 생성 헬퍼
 */
export function createDefaultSettingsViewModel(
  overrides?: Partial<SettingsViewModel>,
): SettingsViewModel {
  return {
    isOpen: true,
    isClosing: false,
    alpha: 1.0,
    scale: 1.0,
    cameraEnabled: true,
    skeletonEnabled: true,
    soundEnabled: true,
    locomotionModeLabel: '제자리 달리기',
    fontScale: 1.0,
    fontScaleLabel: '기본 (1.0x)',
    highContrast: false,
    stickmanScale: 1.0,
    stickmanScaleLabel: '기본 (1.0x)',
    isFullscreen: false,
    ...overrides,
  };
}

/**
 * 모달 다이얼로그 전체 바운딩 박스 계산
 */
export function getSettingsModalBounds(
  w: number,
  h: number,
  context?: SettingsPresentationContext,
): ModalButtonSlot {
  const scaleX = w / 1080;
  const scaleY = h / 2160;
  const baseModal = UI_LAYOUT.settings.modal;
  const mx = (context?.modal?.x ?? baseModal.x) * scaleX;
  const my = (context?.modal?.y ?? baseModal.y) * scaleY;
  const mw = (context?.modal?.w ?? baseModal.w) * scaleX;
  const baseH = context?.modal?.h ?? Math.max(baseModal.h, 1200);
  const mh = baseH * scaleY;
  return { x: mx, y: my, w: mw, h: mh };
}

/**
 * 특정 액션 버튼의 바운딩 박스 계산 (UI_LAYOUT.settings 연동 및 context 오버라이드 지원)
 */
export function getSettingsButtonLayout(
  action: SettingsButtonAction,
  w: number,
  h: number,
  context?: SettingsPresentationContext,
): ModalButtonSlot {
  const scaleX = w / 1080;
  const scaleY = h / 2160;

  const directOverride =
    context?.buttons?.[action] ??
    (context as Record<string, any> | undefined)?.[`${action}Btn`];

  if (action === 'close') {
    const baseSlot = UI_LAYOUT.settings.closeBtn;
    const x = directOverride?.x ?? baseSlot.x;
    const y = directOverride?.y ?? baseSlot.y;
    const slotW = directOverride?.w ?? baseSlot.w;
    const slotH = directOverride?.h ?? baseSlot.h;
    return {
      x: x * scaleX,
      y: y * scaleY,
      w: slotW * scaleX,
      h: slotH * scaleY,
    };
  }

  const btnSlot = (UI_LAYOUT.settings.buttons as Record<string, ModalButtonSlot | undefined>)?.[action];
  if (btnSlot) {
    const x = directOverride?.x ?? btnSlot.x;
    const y = directOverride?.y ?? btnSlot.y;
    const slotW = directOverride?.w ?? btnSlot.w;
    const slotH = directOverride?.h ?? btnSlot.h;
    return {
      x: x * scaleX,
      y: y * scaleY,
      w: slotW * scaleX,
      h: slotH * scaleY,
    };
  }

  const modalSlot = getSettingsModalBounds(w, h, context);
  const mx = modalSlot.x;
  const my = modalSlot.y;
  const mw = modalSlot.w;

  const actionOrder: SettingsButtonAction[] = [
    'camera',
    'fullscreen',
    'skeleton',
    'sound',
    'locomotion',
    'fontScale',
    'highContrast',
    'stickmanScale',
  ];
  const idx = actionOrder.indexOf(action);
  const offsetY = idx >= 0 ? 140 + idx * 130 : 140;

  const defaultSlot: ModalButtonSlot = {
    x: mx + 60 * scaleX,
    y: my + offsetY * scaleY,
    w: mw - 120 * scaleX,
    h: 110 * scaleY,
  };

  if (directOverride) {
    return {
      x: directOverride.x !== undefined ? directOverride.x * scaleX : defaultSlot.x,
      y: directOverride.y !== undefined ? directOverride.y * scaleY : defaultSlot.y,
      w: directOverride.w !== undefined ? directOverride.w * scaleX : defaultSlot.w,
      h: directOverride.h !== undefined ? directOverride.h * scaleY : defaultSlot.h,
    };
  }

  return defaultSlot;
}

/**
 * 9개 버튼 전체의 바운딩 박스 맵 계산
 */
export function getSettingsButtonLayouts(
  w: number,
  h: number,
  modelOrContext?: SettingsViewModel | SettingsPresentationContext,
  context?: SettingsPresentationContext,
): Record<SettingsButtonAction, ModalButtonSlot> {
  const effectiveContext =
    context ??
    (modelOrContext && !('isOpen' in modelOrContext)
      ? (modelOrContext as SettingsPresentationContext)
      : undefined);

  const result = {} as Record<SettingsButtonAction, ModalButtonSlot>;
  for (const act of SETTINGS_BUTTON_ACTIONS) {
    result[act] = getSettingsButtonLayout(act, w, h, effectiveContext);
  }
  return result;
}

/**
 * 버튼 히트 테스트
 */
export function hitTestSettingsButton(
  x: number,
  y: number,
  w: number,
  h: number,
  modelOrContext?: SettingsViewModel | SettingsPresentationContext,
  context?: SettingsPresentationContext,
  padding = 0,
): SettingsButtonAction | null {
  if (modelOrContext && 'isOpen' in modelOrContext) {
    if (!modelOrContext.isOpen || modelOrContext.isClosing) {
      return null;
    }
  }

  const effectiveContext =
    context ??
    (modelOrContext && !('isOpen' in modelOrContext)
      ? (modelOrContext as SettingsPresentationContext)
      : undefined);

  const layouts = getSettingsButtonLayouts(w, h, modelOrContext, effectiveContext);

  for (const act of SETTINGS_BUTTON_ACTIONS) {
    const btn = layouts[act];
    if (
      x >= btn.x - padding &&
      x <= btn.x + btn.w + padding &&
      y >= btn.y - padding &&
      y <= btn.y + btn.h + padding
    ) {
      return act;
    }
  }

  return null;
}

/**
 * 설정 모달 전체(버튼 및 배경 바깥) 히트 테스트
 */
export function hitTestSettings(
  x: number,
  y: number,
  w: number,
  h: number,
  modelOrContext?: SettingsViewModel | SettingsPresentationContext,
  context?: SettingsPresentationContext,
  padding = 0,
): SettingsAction | null {
  if (modelOrContext && 'isOpen' in modelOrContext) {
    if (!modelOrContext.isOpen || modelOrContext.isClosing) {
      return null;
    }
  }

  const effectiveContext =
    context ??
    (modelOrContext && !('isOpen' in modelOrContext)
      ? (modelOrContext as SettingsPresentationContext)
      : undefined);

  const modalBounds = getSettingsModalBounds(w, h, effectiveContext);

  // 1. 모달 다이얼로그 바깥 클릭 시 backdrop-close
  if (
    x < modalBounds.x ||
    x > modalBounds.x + modalBounds.w ||
    y < modalBounds.y ||
    y > modalBounds.y + modalBounds.h
  ) {
    return 'backdrop-close';
  }

  // 2. 내부 버튼 히트 체크
  return hitTestSettingsButton(x, y, w, h, modelOrContext, effectiveContext, padding);
}

/**
 * 순수 설정 모달 렌더링 함수
 */
export function renderSettingsView(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  model: SettingsViewModel,
  context?: SettingsPresentationContext,
): void {
  if (!model.isOpen) return;

  const scaleX = w / 1080;
  const scaleY = h / 2160;

  const animAlpha = model.alpha;
  const animScale = model.scale;

  ctx.save();

  // 1. 전체 화면 딤 오버레이 (0 -> 0.75 보간)
  const dimAlpha = (0.75 * animAlpha).toFixed(3);
  ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
  ctx.fillRect(0, 0, w, h);

  // 2. 모달 카드 배경 및 콘텐츠 (스케일 및 알파 보간)
  const modalBounds = getSettingsModalBounds(w, h, context);
  const mx = modalBounds.x;
  const my = modalBounds.y;
  const mw = modalBounds.w;
  const mh = modalBounds.h;
  const radius = 28 * scaleX;

  const cx = mx + mw / 2;
  const cy = my + mh / 2;

  ctx.save();
  ctx.translate?.(cx, cy);
  ctx.scale?.(animScale, animScale);
  ctx.translate?.(-cx, -cy);
  ctx.globalAlpha = animAlpha;

  const dialogBgImg =
    imageLoader.get('settings', 'modalBg') ?? imageLoader.get('settings', 'dialogBg');
  if (dialogBgImg) {
    ctx.drawImage(dialogBgImg, mx, my, mw, mh);
  } else {
    ctx.fillStyle = 'rgba(15, 20, 36, 0.98)';
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 3 * scaleX;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(mx, my, mw, mh, radius);
    } else {
      ctx.rect(mx, my, mw, mh);
    }
    ctx.fill();
    ctx.stroke();
  }

  // 3. 타이틀
  ctx.font = UIText.getFont('subheading', scaleX, 'bold');
  ctx.fillStyle = '#FFCB4D';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('⚙ 게임 설정', mx + 60 * scaleX, my + 45 * scaleY);

  // 4. 닫기 버튼
  const closeBtn = getSettingsButtonLayout('close', w, h, context);
  const closeIconImg =
    imageLoader.get('modal', 'btnCloseX') ?? imageLoader.get('settings', 'closeIcon');
  if (closeIconImg) {
    ctx.drawImage(closeIconImg, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2 * scaleX;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12 * scaleX);
    } else {
      ctx.rect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = UIText.getFont('body', scaleX, 'bold');
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2);
  }

  // 5. 옵션 리스트 렌더링 헬퍼
  const renderOptionBtn = (
    btn: ModalButtonSlot,
    title: string,
    statusText: string,
    isActive: boolean,
    iconKey?: string,
  ) => {
    ctx.fillStyle = isActive ? 'rgba(40, 230, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = isActive ? '#28E6FF' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2.5 * scaleX;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 18 * scaleX);
    } else {
      ctx.rect(btn.x, btn.y, btn.w, btn.h);
    }
    ctx.fill();
    ctx.stroke();

    // 옵션 아이콘 비트맵 우선 드로잉
    const iconImg = iconKey
      ? (imageLoader.get('modal', iconKey) ?? imageLoader.get('settings', iconKey))
      : null;

    let textStartX = btn.x + 36 * scaleX;
    if (iconImg) {
      const iconSize = Math.min(btn.h * 0.7, 44 * scaleX);
      const iconX = btn.x + 24 * scaleX;
      const iconY = btn.y + (btn.h - iconSize) / 2;
      ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
      textStartX = iconX + iconSize + 14 * scaleX;
    }

    // 옵션 명
    ctx.font = UIText.getFont('body', scaleX, 'bold');
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, textStartX, btn.y + btn.h / 2);

    // 상태 태그 또는 토글 버튼 이미지 (이미지 우선 분기)
    const isToggleState = statusText === 'ON' || statusText === 'OFF';
    const toggleImg = isToggleState
      ? imageLoader.get('settings', isActive ? 'toggleOn' : 'toggleOff')
      : null;

    if (toggleImg) {
      const tw = 100 * scaleX;
      const th = 50 * scaleY;
      const tx = btn.x + btn.w - tw - 24 * scaleX;
      const ty = btn.y + (btn.h - th) / 2;
      ctx.drawImage(toggleImg, tx, ty, tw, th);
    } else {
      // 기존 텍스트 태그 폴백
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.fillStyle = isActive ? '#28E6FF' : '#BBBBBB';
      ctx.textAlign = 'right';
      ctx.fillText(statusText, btn.x + btn.w - 36 * scaleX, btn.y + btn.h / 2);
    }
  };

  // 카메라 버튼
  renderOptionBtn(
    getSettingsButtonLayout('camera', w, h, context),
    '📷 카메라',
    model.cameraEnabled ? 'ON' : 'OFF',
    model.cameraEnabled,
    'iconCamera',
  );

  // 전체화면 버튼
  const isFull = !!model.isFullscreen;
  renderOptionBtn(
    getSettingsButtonLayout('fullscreen', w, h, context),
    '⛶ 전체화면',
    isFull ? 'ON' : 'OFF',
    isFull,
    'iconFullscreen',
  );

  // 스켈레톤 본(웹캠 선/점) 표시 버튼 (Issue #280)
  renderOptionBtn(
    getSettingsButtonLayout('skeleton', w, h, context),
    '🦴 스켈레톤 본',
    model.skeletonEnabled ? 'ON' : 'OFF',
    model.skeletonEnabled,
    'iconSkeleton',
  );

  // 사운드 버튼
  renderOptionBtn(
    getSettingsButtonLayout('sound', w, h, context),
    '🔊 사운드 효과음',
    model.soundEnabled ? 'ON' : 'OFF',
    model.soundEnabled,
    'iconSound',
  );

  // 운동 방식 선택 버튼
  renderOptionBtn(
    getSettingsButtonLayout('locomotion', w, h, context),
    '🏃 운동 방식',
    `${model.locomotionModeLabel} ⚙`,
    true,
  );

  // 글씨 크기 버튼
  renderOptionBtn(
    getSettingsButtonLayout('fontScale', w, h, context),
    '🔤 글씨 크기',
    model.fontScaleLabel ?? getFontScaleLabel(model.fontScale),
    model.fontScale > 1.0,
  );

  // 고대비 모드 버튼
  renderOptionBtn(
    getSettingsButtonLayout('highContrast', w, h, context),
    '👁 고대비 모드',
    model.highContrast ? 'ON' : 'OFF',
    model.highContrast,
  );

  // 졸라맨 크기 버튼 (Issue #420)
  renderOptionBtn(
    getSettingsButtonLayout('stickmanScale', w, h, context),
    '🧍 졸라맨 크기',
    model.stickmanScaleLabel ?? getStickmanScaleLabel(model.stickmanScale),
    model.stickmanScale > 1.0,
    'iconSkeleton',
  );

  ctx.restore(); // 카드 transform 복원
  ctx.restore(); // 최상단 save 복원
}

/**
 * SettingsView 클래스 래퍼
 */
export class SettingsView {
  private _context?: SettingsPresentationContext;

  constructor(context?: SettingsPresentationContext) {
    this._context = context;
  }

  setPresentationContext(context?: SettingsPresentationContext): void {
    this._context = context;
  }

  getPresentationContext(): SettingsPresentationContext | undefined {
    return this._context;
  }

  clearPresentationContext(): void {
    this._context = undefined;
  }

  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    model: SettingsViewModel,
    context?: SettingsPresentationContext,
  ): void {
    renderSettingsView(ctx, w, h, model, context ?? this._context);
  }

  getButtonLayout(
    action: SettingsButtonAction,
    w: number,
    h: number,
    context?: SettingsPresentationContext,
  ): ModalButtonSlot {
    return getSettingsButtonLayout(action, w, h, context ?? this._context);
  }

  getButtonLayouts(
    w: number,
    h: number,
    modelOrContext?: SettingsViewModel | SettingsPresentationContext,
    context?: SettingsPresentationContext,
  ): Record<SettingsButtonAction, ModalButtonSlot> {
    return getSettingsButtonLayouts(w, h, modelOrContext, context ?? this._context);
  }

  hitTestButton(
    x: number,
    y: number,
    w: number,
    h: number,
    modelOrContext?: SettingsViewModel | SettingsPresentationContext,
    context?: SettingsPresentationContext,
    padding = 0,
  ): SettingsButtonAction | null {
    return hitTestSettingsButton(x, y, w, h, modelOrContext, context ?? this._context, padding);
  }

  hitTest(
    x: number,
    y: number,
    w: number,
    h: number,
    modelOrContext?: SettingsViewModel | SettingsPresentationContext,
    context?: SettingsPresentationContext,
    padding = 0,
  ): SettingsAction | null {
    return hitTestSettings(x, y, w, h, modelOrContext, context ?? this._context, padding);
  }

  /**
   * UIPresentationDocument로부터 Settings 관련 슬롯 추출
   */
  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId?: UIPresentationPageId | string,
  ): SettingsPresentationContext {
    const result: SettingsPresentationContext = {
      presentationDocument: doc,
      pageId,
      buttons: {},
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
        const boundsObj: ModalButtonSlot = {
          x: b.x,
          y: b.y,
          w: b.width ?? (b as any).w ?? 0,
          h: b.height ?? (b as any).h ?? 0,
        };

        if (
          el.id === 'modal' ||
          el.id === 'opt_dialog' ||
          el.id === 'settings_modal'
        ) {
          result.modal = { ...boundsObj, ...result.modal };
        } else if (
          el.id === 'btn_opt_close' ||
          el.id === 'btn_close' ||
          el.actionId === 'close_settings'
        ) {
          result.closeBtn = { ...boundsObj, ...result.closeBtn };
          if (!result.buttons) result.buttons = {};
          result.buttons.close = { ...boundsObj, ...result.buttons.close };
        } else if (
          el.actionId &&
          SETTINGS_BUTTON_ACTIONS.includes(el.actionId as SettingsButtonAction)
        ) {
          if (!result.buttons) result.buttons = {};
          result.buttons[el.actionId as SettingsButtonAction] = {
            ...boundsObj,
            ...result.buttons[el.actionId as SettingsButtonAction],
          };
        }
      }
    }

    return result;
  }
}
