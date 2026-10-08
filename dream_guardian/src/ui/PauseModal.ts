/**
 * PauseModal - 인게임 일시정지(Pause) 팝업 모달 (Issue #172 / UI-PAUSE-001)
 *
 * X자 제스처 또는 Esc/P 키로 인게임에서 일시정지 시 표시되는 팝업 모달.
 * 항목:
 * - ▶ 게임으로 돌아가기 (Resume)
 * - 🏠 홈으로 나가기 (Quit)
 *
 * 양손 합장 제스처(MenuInput)로 0.8초 호버 체류(Dwell) 또는 마우스/터치 클릭으로 선택.
 *
 * [Issue #442 / UI-VIS-012] 실게임 렌더러 재사용 10페이지 시각 UI 편집기 연동:
 * - 선택적 PausePresentationContext 주입 및 bounds 조회 지원.
 * - getModalBounds / getButtonLayout / hitTest / render 간 Single Source of Truth Geometry 일원화.
 * - resume / quit 2개 액션만 지원 및 restart 등 미지원 액션 안전 거부.
 * - 결정적 Fixture DTO 렌더 진입점 (renderFixture) 및 무부작용(부작용 0건) 보장.
 */

import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';

export type PauseButtonAction = 'resume' | 'quit';

export const PAUSE_BUTTON_ACTIONS: readonly PauseButtonAction[] = ['resume', 'quit'] as const;

export type PauseAction = 'resume' | 'quit' | 'backdrop';

export interface ModalButtonSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PauseModalBoundsOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface PauseButtonSlotOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  label?: string;
  sublabel?: string;
}

export interface PauseTitleOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  subtext?: string;
  subtext2?: string;
}

export interface PausePresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  modal?: PauseModalBoundsOverride;
  title?: PauseTitleOverride;
  resumeBtn?: PauseButtonSlotOverride;
  quitBtn?: PauseButtonSlotOverride;
  buttons?: Partial<Record<PauseButtonAction, PauseButtonSlotOverride>>;
}

export interface PauseModalFixtureDTO {
  isOpen?: boolean;
  isClosing?: boolean;
  animProgress?: number;
  scale?: number;
  alpha?: number;
  hoverAction?: 'resume' | 'quit' | null;
  hoverProgress?: number;
  presentationContext?: PausePresentationContext;
}

export const PAUSE_DWELL_TIME = 0.8;

export function isSupportedPauseAction(action: unknown): action is PauseButtonAction {
  return action === 'resume' || action === 'quit';
}

function computeScale(animProgress: number, isClosing: boolean): number {
  if (isClosing) {
    const t = animProgress;
    return 1.0 - 0.1 * (t * t);
  }
  const t = animProgress;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const easeOutBack = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  return 0.8 + 0.2 * easeOutBack;
}

function computeAlpha(animProgress: number, isClosing: boolean): number {
  if (isClosing) {
    return Math.max(0, 1 - animProgress);
  }
  return Math.min(1, Math.max(0, animProgress));
}

export class PauseModal {
  private _isOpen = false;
  private _isClosing = false;
  private _animProgress = 0;
  private _animTimer = 0;
  private readonly OPEN_DURATION = 0.25;
  private readonly CLOSE_DURATION = 0.20;

  private _hoverAction: 'resume' | 'quit' | null = null;
  private _hoverTime = 0;

  // 1080x2160 가상 해상도 기준 모달 중앙 카드 (UI_LAYOUT.pause.modal 연동)
  private readonly MODAL_VIRTUAL = UI_LAYOUT.pause.modal;
  private _presentationContext?: PausePresentationContext;

  constructor(presentationContext?: PausePresentationContext) {
    if (presentationContext) {
      this.setPresentationContext(presentationContext);
    }
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  get isClosing(): boolean {
    return this._isClosing;
  }

  get animProgress(): number {
    return this._animProgress;
  }

  get scale(): number {
    return computeScale(this._animProgress, this._isClosing);
  }

  get alpha(): number {
    return computeAlpha(this._animProgress, this._isClosing);
  }

  get hoverAction(): 'resume' | 'quit' | null {
    return this._hoverAction;
  }

  get hoverProgress(): number {
    return Math.min(1, Math.max(0, this._hoverTime / PAUSE_DWELL_TIME));
  }

  /**
   * Presentation Context 주입 (선택적 표시 컨텍스트)
   */
  setPresentationContext(context?: PausePresentationContext): void {
    this._presentationContext = context;
  }

  /**
   * 주입된 Presentation Context 조회
   */
  getPresentationContext(): PausePresentationContext | undefined {
    return this._presentationContext;
  }

  /**
   * Presentation Context 초기화
   */
  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  /**
   * 특정 액션이 지원되는지 검사 (resume/quit만 허용, restart 등 거부)
   */
  isActionSupported(action: string): boolean {
    return isSupportedPauseAction(action);
  }

  /**
   * 액션 수행 요청 처리 (미지원 액션은 안전하게 false 반환 및 무시)
   */
  handleAction(action: string): boolean {
    if (!isSupportedPauseAction(action)) {
      return false;
    }
    if (action === 'resume') {
      this.close();
      return true;
    }
    if (action === 'quit') {
      return true;
    }
    return false;
  }

  /**
   * UIPresentationDocument로부터 PausePresentationContext 추출
   */
  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'pause',
  ): PausePresentationContext {
    const result: PausePresentationContext = {
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
          el.id === 'pause_modal' ||
          el.id === 'modal' ||
          el.id === 'pause-dialog' ||
          el.id === 'dialog'
        ) {
          result.modal = { ...boundsObj, ...result.modal };
        } else if (
          el.id === 'pause_title' ||
          el.id === 'title' ||
          el.id === 'pause-title'
        ) {
          result.title = {
            ...boundsObj,
            text: el.text,
            ...result.title,
          };
        } else if (
          el.id === 'btn_pause_resume' ||
          el.id === 'pause-resume-btn' ||
          (el.actionId as string | undefined) === 'pause_resume' ||
          (el.actionId as string | undefined) === 'resume'
        ) {
          result.resumeBtn = {
            ...boundsObj,
            label: el.text,
            ...result.resumeBtn,
          };
          if (!result.buttons) result.buttons = {};
          result.buttons.resume = { ...boundsObj, label: el.text, ...result.buttons.resume };
        } else if (
          el.id === 'btn_pause_quit' ||
          el.id === 'pause-exit-btn' ||
          (el.actionId as string | undefined) === 'pause_quit' ||
          (el.actionId as string | undefined) === 'quit' ||
          (el.actionId as string | undefined) === 'quitToMenu'
        ) {
          result.quitBtn = {
            ...boundsObj,
            label: el.text,
            ...result.quitBtn,
          };
          if (!result.buttons) result.buttons = {};
          result.buttons.quit = { ...boundsObj, label: el.text, ...result.buttons.quit };
        }
      }
    }
    return result;
  }

  private _resolveContext(overrideCtx?: PausePresentationContext): PausePresentationContext | undefined {
    const ctx = overrideCtx ?? this._presentationContext;
    if (!ctx) return undefined;
    if (!ctx.presentationDocument) return ctx;

    const docCtx = PauseModal.fromPresentationDocument(ctx.presentationDocument, ctx.pageId);
    return {
      ...docCtx,
      ...ctx,
      modal: { ...docCtx.modal, ...ctx.modal },
      title: { ...docCtx.title, ...ctx.title },
      resumeBtn: { ...docCtx.resumeBtn, ...ctx.resumeBtn },
      quitBtn: { ...docCtx.quitBtn, ...ctx.quitBtn },
      buttons: {
        ...docCtx.buttons,
        ...ctx.buttons,
      },
    };
  }

  /**
   * 모달 창 바운딩 박스 반환 (UI_LAYOUT.pause.modal 연동 및 PresentationContext 지원)
   */
  getModalBounds(w: number, h: number, context?: PausePresentationContext): ModalButtonSlot {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const base = this.MODAL_VIRTUAL;

    const x = ctx?.modal?.x !== undefined ? ctx.modal.x * scaleX : base.x * scaleX;
    const y = ctx?.modal?.y !== undefined ? ctx.modal.y * scaleY : base.y * scaleY;
    const mw = ctx?.modal?.w !== undefined ? ctx.modal.w * scaleX : base.w * scaleX;
    const mh = ctx?.modal?.h !== undefined ? ctx.modal.h * scaleY : base.h * scaleY;

    return { x, y, w: mw, h: mh };
  }

  /**
   * 타이틀 영역 바운딩 박스 반환
   */
  getTitleBounds(w: number, h: number, context?: PausePresentationContext): ModalButtonSlot {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);
    const modal = this.getModalBounds(w, h, context);

    if (ctx?.title) {
      return {
        x: ctx.title.x !== undefined ? ctx.title.x * scaleX : modal.x + 40 * scaleX,
        y: ctx.title.y !== undefined ? ctx.title.y * scaleY : modal.y + 50 * scaleY,
        w: ctx.title.w !== undefined ? ctx.title.w * scaleX : modal.w - 80 * scaleX,
        h: ctx.title.h !== undefined ? ctx.title.h * scaleY : 120 * scaleY,
      };
    }

    return {
      x: modal.x + 40 * scaleX,
      y: modal.y + 50 * scaleY,
      w: modal.w - 80 * scaleX,
      h: 120 * scaleY,
    };
  }

  open(): void {
    this._isOpen = true;
    this._isClosing = false;
    this._animProgress = 0;
    this._animTimer = 0;
    this.resetHover();
  }

  close(immediate = false): void {
    if (immediate) {
      this._isOpen = false;
      this._isClosing = false;
      this._animProgress = 0;
      this._animTimer = 0;
      this.resetHover();
      return;
    }
    if (!this._isOpen || this._isClosing) return;
    this._isClosing = true;
    this._animProgress = 0;
    this._animTimer = 0;
    this.resetHover();
  }

  toggle(): void {
    if (this._isOpen && !this._isClosing) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 모달 애니메이션 진행도 갱신
   */
  update(dt: number): void {
    if (!this._isOpen) return;

    if (this._isClosing) {
      this._animTimer += dt;
      this._animProgress = Math.min(1, Math.max(0, this._animTimer / this.CLOSE_DURATION));
      if (this._animTimer >= this.CLOSE_DURATION) {
        this._isOpen = false;
        this._isClosing = false;
        this._animProgress = 0;
        this._animTimer = 0;
      }
    } else {
      this._animTimer += dt;
      this._animProgress = Math.min(1, Math.max(0, this._animTimer / this.OPEN_DURATION));
    }
  }

  resetHover(): void {
    this._hoverAction = null;
    this._hoverTime = 0;
  }

  /**
   * 버튼 레이아웃 좌표 반환 (UI_LAYOUT.pause 연동 및 PresentationContext 오버라이드 지원)
   * resume/quit만 유효하며 restart 등 미지원 액션은 null을 반환합니다.
   */
  getButtonLayout(action: 'resume' | 'quit', w: number, h: number, context?: PausePresentationContext): ModalButtonSlot;
  getButtonLayout(action: string, w: number, h: number, context?: PausePresentationContext): ModalButtonSlot | null;
  getButtonLayout(action: string, w: number, h: number, context?: PausePresentationContext): ModalButtonSlot | null {
    if (!isSupportedPauseAction(action)) {
      return null;
    }

    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const ctx = this._resolveContext(context);

    const directOverride =
      action === 'resume'
        ? (ctx?.resumeBtn ?? ctx?.buttons?.resume)
        : (ctx?.quitBtn ?? ctx?.buttons?.quit);

    const baseSlot = action === 'resume' ? UI_LAYOUT.pause.resumeBtn : UI_LAYOUT.pause.quitBtn;

    const x = directOverride?.x !== undefined ? directOverride.x * scaleX : baseSlot.x * scaleX;
    const y = directOverride?.y !== undefined ? directOverride.y * scaleY : baseSlot.y * scaleY;
    const slotW = directOverride?.w !== undefined ? directOverride.w * scaleX : baseSlot.w * scaleX;
    const slotH = directOverride?.h !== undefined ? directOverride.h * scaleY : baseSlot.h * scaleY;

    return {
      x,
      y,
      w: slotW,
      h: slotH,
    };
  }

  /**
   * 모든 유효 버튼의 바운딩 박스 맵 반환 (resume, quit)
   */
  getButtonLayouts(w: number, h: number, context?: PausePresentationContext): Record<PauseButtonAction, ModalButtonSlot> {
    return {
      resume: this.getButtonLayout('resume', w, h, context)!,
      quit: this.getButtonLayout('quit', w, h, context)!,
    };
  }

  /**
   * 클릭 / 터치 히트 테스트 (단일 진실 공급원 Geometry 일치)
   */
  hitTest(x: number, y: number, w: number, h: number, context?: PausePresentationContext): PauseAction | null {
    const resumeBtn = this.getButtonLayout('resume', w, h, context);
    if (
      resumeBtn &&
      x >= resumeBtn.x &&
      x <= resumeBtn.x + resumeBtn.w &&
      y >= resumeBtn.y &&
      y <= resumeBtn.y + resumeBtn.h
    ) {
      return 'resume';
    }

    const quitBtn = this.getButtonLayout('quit', w, h, context);
    if (
      quitBtn &&
      x >= quitBtn.x &&
      x <= quitBtn.x + quitBtn.w &&
      y >= quitBtn.y &&
      y <= quitBtn.y + quitBtn.h
    ) {
      return 'quit';
    }

    const modalBounds = this.getModalBounds(w, h, context);
    if (
      x < modalBounds.x ||
      x > modalBounds.x + modalBounds.w ||
      y < modalBounds.y ||
      y > modalBounds.y + modalBounds.h
    ) {
      return 'backdrop';
    }

    return null;
  }

  /**
   * 양손 합장 커서 호버 갱신 (0.8초 체류 시 확정 action 반환)
   */
  updateHover(
    x: number,
    y: number,
    w: number,
    h: number,
    dt: number,
  ): { action: 'resume' | 'quit' | null; progress: number } {
    if (!this._isOpen) {
      return { action: null, progress: 0 };
    }

    const hit = this.hitTest(x, y, w, h);
    if (hit === 'resume' || hit === 'quit') {
      if (this._hoverAction === hit) {
        this._hoverTime += dt;
      } else {
        this._hoverAction = hit;
        this._hoverTime = dt;
      }

      const progress = Math.min(1, this._hoverTime / PAUSE_DWELL_TIME);
      if (progress >= 1) {
        return { action: hit, progress: 1 };
      }
      return { action: null, progress };
    }

    this.resetHover();
    return { action: null, progress: 0 };
  }

  /**
   * 제스처 기반 호버 갱신 (MenuInput / HandsManager 연동)
   * restart 등 미지원 액션 입력 시 즉시 리셋 후 null을 반환합니다.
   */
  updateGestureHover(action: 'resume' | 'quit' | null, dt: number): 'resume' | 'quit' | null {
    if (!this._isOpen && this._animProgress === 0) {
      this.resetHover();
      return null;
    }

    if (!action || !isSupportedPauseAction(action)) {
      this.resetHover();
      return null;
    }

    if (this._hoverAction === action) {
      this._hoverTime += dt;
    } else {
      this._hoverAction = action;
      this._hoverTime = dt;
    }

    if (this._hoverTime >= PAUSE_DWELL_TIME) {
      const selected = this._hoverAction;
      this.resetHover();
      return selected;
    }

    return null;
  }

  /**
   * 모달 렌더링 (DTO 수신 시 결정적 Fixture 렌더링 지원)
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, dto?: PauseModalFixtureDTO): void {
    const isEffectiveOpen = dto?.isOpen !== undefined ? dto.isOpen : this._isOpen;
    if (!isEffectiveOpen) return;

    const scaleX = w / 1080;
    const scaleY = h / 2160;

    let effScale: number;
    let effAlpha: number;

    if (dto) {
      const animProg = dto.animProgress !== undefined ? dto.animProgress : (isEffectiveOpen ? 1.0 : 0);
      const isClosing = dto.isClosing ?? false;
      effScale = dto.scale !== undefined ? dto.scale : computeScale(animProg, isClosing);
      effAlpha = dto.alpha !== undefined ? dto.alpha : computeAlpha(animProg, isClosing);
    } else {
      effScale = this.scale;
      effAlpha = this.alpha;
    }

    const effHoverAction = dto ? (dto.hoverAction ?? null) : this._hoverAction;
    const effHoverProgress = dto ? (dto.hoverProgress ?? 0) : this.hoverProgress;
    const effContext = this._resolveContext(dto?.presentationContext);

    ctx.save();

    // 1. 딤 백드롭 (반투명 검정 오버레이)
    const dimAlpha = 0.65 * effAlpha;
    ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // 2. 모달 베이스 카드
    const modalBounds = this.getModalBounds(w, h, effContext);
    const mx = modalBounds.x;
    const my = modalBounds.y;
    const mw = modalBounds.w;
    const mh = modalBounds.h;
    const radius = 24 * scaleX;

    // 중앙 기준 카드 스케일 transform
    const cx = mx + mw / 2;
    const cy = my + mh / 2;

    ctx.save();
    ctx.translate?.(cx, cy);
    ctx.scale?.(effScale, effScale);
    ctx.translate?.(-cx, -cy);
    ctx.globalAlpha = effAlpha;

    const modalBgImg = imageLoader.get('pause', 'modalBg');
    if (modalBgImg) {
      ctx.drawImage(modalBgImg, mx, my, mw, mh);
    } else {
      ctx.fillStyle = 'rgba(15, 20, 36, 0.98)';
      ctx.strokeStyle = '#FFCB4D';
      ctx.lineWidth = 3.5 * scaleX;
      ctx.shadowColor = '#FFCB4D';
      ctx.shadowBlur = 20 * scaleX;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(mx, my, mw, mh, radius);
      } else {
        ctx.rect(mx, my, mw, mh);
      }
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
    }

    // 3. 타이틀 및 안내 문구
    const titleOverride = effContext?.title;
    const titleText = titleOverride?.text ?? '⏸ 일시정지 (PAUSED)';
    const subtitleText1 = titleOverride?.subtext ?? '양손을 모아 합장 커서로 선택하세요';
    const subtitleText2 = titleOverride?.subtext2 ?? 'X자 제스처로 다시 열고 닫을 수 있습니다';

    ctx.font = UIText.getFont('subheading', scaleX, 'bold');
    ctx.fillStyle = '#FFCB4D';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(titleText, mx + mw / 2, my + 50 * scaleY);

    ctx.font = UIText.getFont('badge', scaleX, 'normal');
    ctx.fillStyle = '#C8D4E6';
    ctx.fillText(subtitleText1, mx + mw / 2, my + 130 * scaleY);
    ctx.fillText(subtitleText2, mx + mw / 2, my + 175 * scaleY);

    // 4. 버튼 렌더링 헬퍼
    const renderBtn = (
      btn: ModalButtonSlot,
      action: 'resume' | 'quit',
      label: string,
      accentColor: string,
    ) => {
      const isHovered = effHoverAction === action;
      const progress = isHovered ? effHoverProgress : 0;

      ctx.save();

      const btnKey = action === 'resume' ? 'resumeBtn' : 'quitBtn';
      const modalBtnKey = action === 'resume' ? 'btnResume' : 'btnQuit';
      const btnImg = imageLoader.get('modal', modalBtnKey) ?? imageLoader.get('pause', btnKey);

      if (btnImg) {
        if (isHovered) {
          ctx.shadowColor = '#4DFFAA';
          ctx.shadowBlur = 16 * scaleX;
        }
        ctx.drawImage(btnImg, btn.x, btn.y, btn.w, btn.h);
        if (isHovered) {
          ctx.strokeStyle = '#4DFFAA';
          ctx.lineWidth = 4 * scaleX;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 20 * scaleX);
          } else {
            ctx.rect(btn.x, btn.y, btn.w, btn.h);
          }
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = isHovered ? 'rgba(40, 230, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)';
        ctx.strokeStyle = isHovered ? '#4DFFAA' : accentColor;
        ctx.lineWidth = (isHovered ? 4 : 2.5) * scaleX;

        if (isHovered) {
          ctx.shadowColor = '#4DFFAA';
          ctx.shadowBlur = 16 * scaleX;
        }

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 20 * scaleX);
        } else {
          ctx.rect(btn.x, btn.y, btn.w, btn.h);
        }
        ctx.fill();
        ctx.stroke();

        // 라벨 텍스트
        ctx.font = UIText.getFont('body', scaleX, 'bold');
        ctx.fillStyle = isHovered ? '#FFFFFF' : '#E8F0FE';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      }

      // 호버 진행도 충전 게이지 (바닥 바)
      if (progress > 0) {
        ctx.fillStyle = '#4DFFAA';
        ctx.beginPath();
        const barH = 8 * scaleY;
        const barY = btn.y + btn.h - barH;
        const barW = btn.w * progress;
        if (ctx.roundRect) {
          ctx.roundRect(btn.x, barY, barW, barH, 4 * scaleX);
        } else {
          ctx.rect(btn.x, barY, barW, barH);
        }
        ctx.fill();
      }

      ctx.restore();
    };

    const resumeOverride = effContext?.resumeBtn ?? effContext?.buttons?.resume;
    const resumeLabel = resumeOverride?.label ?? '▶  게임으로 돌아가기';
    const resumeBtn = this.getButtonLayout('resume', w, h, effContext);
    renderBtn(resumeBtn, 'resume', resumeLabel, '#28E6FF');

    const quitOverride = effContext?.quitBtn ?? effContext?.buttons?.quit;
    const quitLabel = quitOverride?.label ?? '🏠  홈으로 나가기';
    const quitBtn = this.getButtonLayout('quit', w, h, effContext);
    renderBtn(quitBtn, 'quit', quitLabel, '#FF865E');

    ctx.restore(); // 카드 transform 복원
    ctx.restore(); // 최상단 save 복원
  }

  /**
   * 결정적 Fixture DTO 렌더 진입 (인스턴스 기반, 게임 라이프사이클 영향 0건)
   */
  renderFixture(ctx: CanvasRenderingContext2D, w: number, h: number, dto?: PauseModalFixtureDTO): void {
    this.render(ctx, w, h, {
      isOpen: true,
      animProgress: 1.0,
      ...dto,
    });
  }

  /**
   * 정적 Fixture DTO 렌더 진입 (에디터 프리뷰 등에서 인스턴스 없이 직접 렌더링)
   */
  static renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dto?: PauseModalFixtureDTO,
  ): void {
    const tempModal = new PauseModal(dto?.presentationContext);
    tempModal.renderFixture(ctx, w, h, dto);
  }
}
