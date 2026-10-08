/**
 * SettingsModal - 게임 설정 팝업 모달 드로어 (Issue #141 / UI-BAR-001, Refactor #441 / UI-VIS-011)
 *
 * 화면 중앙 오버레이 팝업 모달
 * 순수 뷰 렌더러인 SettingsView로 실제 draw/layout/hitTest를 위임하며,
 * 런타임 수명주기, 애니메이션, 상태 관리, 접근성 입출력(localStorage/UI_ACCESSIBILITY)을 담당합니다.
 * 비활성 텍스트 및 태그 색상: '#BBBBBB'
 */

import { UIText } from '../utils/UIText.js';
import { UI_LAYOUT, UI_ACCESSIBILITY } from '../../config/ui.config.js';
import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';
import {
  SettingsView,
  type SettingsButtonAction,
  type SettingsAction,
  type ModalButtonSlot,
  type SettingsViewModel,
  type SettingsPresentationContext,
} from './SettingsView.js';

export type {
  SettingsButtonAction,
  SettingsAction,
  ModalButtonSlot,
  SettingsViewModel,
  SettingsPresentationContext,
};

export class SettingsModal {
  private _isOpen = false;
  private _isClosing = false;
  private _animProgress = 0;
  private _animTimer = 0;
  private readonly OPEN_DURATION = 0.25;
  private readonly CLOSE_DURATION = 0.20;

  private _cameraEnabled = true;
  private _renderVideoEnabled = true;
  private _skeletonEnabled = true;
  private _soundEnabled = true;
  private _locomotionModeLabel = '제자리 달리기';
  private _fontScale = UI_ACCESSIBILITY.fontScale ?? 1.0;
  private _highContrast = UI_ACCESSIBILITY.highContrast ?? false;
  private _stickmanScale = STICKMAN_CONFIG.scale ?? 1.0;
  public onStickmanScaleChange?: (scale: number) => void;
  public onRenderVideoChange?: (enabled: boolean) => void;

  // 순수 뷰 렌더러 및 프레젠테이션 컨텍스트
  private readonly _view = new SettingsView();
  private _presentationContext?: SettingsPresentationContext;

  // 모달 다이얼로그 가상 기준 (UI_LAYOUT.settings.modal 연동)
  public readonly MODAL_VIRTUAL = UI_LAYOUT.settings.modal;

  constructor() {
    this.loadAccessibility();
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
    if (this._isClosing) {
      // 닫기 애니메이션: 1.0 -> 0.9 (easeIn)
      const t = this._animProgress;
      return 1.0 - 0.1 * (t * t);
    }
    // 열기 애니메이션: 0.8 -> 1.0 (easeOutBack)
    const t = this._animProgress;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easeOutBack = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    return 0.8 + 0.2 * easeOutBack;
  }

  get alpha(): number {
    if (this._isClosing) {
      return Math.max(0, 1 - this._animProgress);
    }
    return Math.min(1, Math.max(0, this._animProgress));
  }

  get cameraEnabled(): boolean {
    return this._cameraEnabled;
  }

  set cameraEnabled(val: boolean) {
    this._cameraEnabled = val;
  }

  get renderVideoEnabled(): boolean {
    return this._renderVideoEnabled;
  }

  set renderVideoEnabled(val: boolean) {
    this._renderVideoEnabled = val;
    this.saveAccessibility();
    this.onRenderVideoChange?.(val);
  }

  toggleRenderVideo(): boolean {
    this.renderVideoEnabled = !this._renderVideoEnabled;
    return this._renderVideoEnabled;
  }

  get skeletonEnabled(): boolean {
    return this._skeletonEnabled;
  }

  set skeletonEnabled(val: boolean) {
    this._skeletonEnabled = val;
  }

  get soundEnabled(): boolean {
    return this._soundEnabled;
  }

  set soundEnabled(val: boolean) {
    this._soundEnabled = val;
  }

  get locomotionModeLabel(): string {
    return this._locomotionModeLabel;
  }

  set locomotionModeLabel(val: string) {
    this._locomotionModeLabel = val;
  }

  get fontScale(): number {
    return this._fontScale;
  }

  set fontScale(val: number) {
    this._fontScale = val;
    UI_ACCESSIBILITY.fontScale = val;
    UIText.setFontScale(val);
    this.saveAccessibility();
  }

  get fontScaleLabel(): string {
    if (Math.abs(this._fontScale - 1.5) < 0.05) return '크게 (1.5x)';
    if (Math.abs(this._fontScale - 2.0) < 0.05) return '매우 크게 (2.0x)';
    return '기본 (1.0x)';
  }

  get highContrast(): boolean {
    return this._highContrast;
  }

  set highContrast(val: boolean) {
    this._highContrast = val;
    UI_ACCESSIBILITY.highContrast = val;
    UIText.setHighContrast(val);
    this.saveAccessibility();
  }

  cycleFontScale(): number {
    if (Math.abs(this._fontScale - 1.0) < 0.05) {
      this.fontScale = 1.5;
    } else if (Math.abs(this._fontScale - 1.5) < 0.05) {
      this.fontScale = 2.0;
    } else {
      this.fontScale = 1.0;
    }
    return this._fontScale;
  }

  toggleHighContrast(): boolean {
    this.highContrast = !this._highContrast;
    return this._highContrast;
  }

  get stickmanScale(): number {
    return this._stickmanScale;
  }

  set stickmanScale(val: number) {
    this._stickmanScale = val;
    STICKMAN_CONFIG.scale = val;
    this.onStickmanScaleChange?.(val);
    this.saveAccessibility();
  }

  get stickmanScaleLabel(): string {
    if (Math.abs(this._stickmanScale - 1.25) < 0.05) return '크게 (1.25x)';
    if (Math.abs(this._stickmanScale - 1.5) < 0.05) return '매우 크게 (1.5x)';
    if (Math.abs(this._stickmanScale - 2.0) < 0.05) return '최대 (2.0x)';
    return '기본 (1.0x)';
  }

  cycleStickmanScale(): number {
    if (Math.abs(this._stickmanScale - 1.0) < 0.05) {
      this.stickmanScale = 1.25;
    } else if (Math.abs(this._stickmanScale - 1.25) < 0.05) {
      this.stickmanScale = 1.5;
    } else if (Math.abs(this._stickmanScale - 1.5) < 0.05) {
      this.stickmanScale = 2.0;
    } else {
      this.stickmanScale = 1.0;
    }
    return this._stickmanScale;
  }

  setPresentationContext(context?: SettingsPresentationContext): void {
    this._presentationContext = context;
    this._view.setPresentationContext(context);
  }

  getPresentationContext(): SettingsPresentationContext | undefined {
    return this._presentationContext;
  }

  clearPresentationContext(): void {
    this._presentationContext = undefined;
    this._view.clearPresentationContext();
  }

  /**
   * 런타임 상태를 순수 SettingsViewModel(DTO)로 변환
   */
  toViewModel(): SettingsViewModel {
    const isFullscreen =
      typeof document !== 'undefined' && !!document.fullscreenElement;

    return {
      isOpen: this._isOpen,
      isClosing: this._isClosing,
      alpha: this.alpha,
      scale: this.scale,
      cameraEnabled: this._cameraEnabled,
      renderVideoEnabled: this._renderVideoEnabled,
      skeletonEnabled: this._skeletonEnabled,
      soundEnabled: this._soundEnabled,
      locomotionModeLabel: this._locomotionModeLabel,
      fontScale: this._fontScale,
      fontScaleLabel: this.fontScaleLabel,
      highContrast: this._highContrast,
      stickmanScale: this._stickmanScale,
      stickmanScaleLabel: this.stickmanScaleLabel,
      isFullscreen,
    };
  }

  saveAccessibility(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dg_a11y_fontScale', String(this._fontScale));
        localStorage.setItem('dg_a11y_highContrast', String(this._highContrast));
        localStorage.setItem('dg_stickman_scale', String(this._stickmanScale));
        localStorage.setItem('dg_render_webcam', String(this._renderVideoEnabled));
      }
    } catch {
      // localStorage 불가 환경 무시
    }
  }

  loadAccessibility(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedScale = localStorage.getItem('dg_a11y_fontScale');
        if (savedScale !== null) {
          const parsed = parseFloat(savedScale);
          if (parsed === 1.0 || parsed === 1.5 || parsed === 2.0) {
            this._fontScale = parsed;
            UI_ACCESSIBILITY.fontScale = parsed;
            UIText.setFontScale(parsed);
          }
        }

        const savedContrast = localStorage.getItem('dg_a11y_highContrast');
        if (savedContrast !== null) {
          if (savedContrast === 'true' || savedContrast === 'false') {
            const parsedContrast = savedContrast === 'true';
            this._highContrast = parsedContrast;
            UI_ACCESSIBILITY.highContrast = parsedContrast;
            UIText.setHighContrast(parsedContrast);
          }
        }

        const savedStickmanScale = localStorage.getItem('dg_stickman_scale');
        if (savedStickmanScale !== null) {
          const parsedStickman = parseFloat(savedStickmanScale);
          if (parsedStickman > 0) {
            this._stickmanScale = parsedStickman;
            STICKMAN_CONFIG.scale = parsedStickman;
          }
        }

        const savedWebcam = localStorage.getItem('dg_render_webcam');
        if (savedWebcam !== null) {
          this._renderVideoEnabled = savedWebcam !== 'false';
        }
      }
    } catch {
      // localStorage 불가 환경 무시
    }
  }

  open(): void {
    this._isOpen = true;
    this._isClosing = false;
    this._animProgress = 0;
    this._animTimer = 0;
  }

  close(): void {
    if (!this._isOpen || this._isClosing) return;
    this._isClosing = true;
    this._animProgress = 0;
    this._animTimer = 0;
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

  /**
   * 모달 내 특정 버튼의 절대 좌표 및 크기 계산 (SettingsView 위임)
   */
  getButtonLayout(
    action: SettingsButtonAction,
    w: number,
    h: number,
  ): ModalButtonSlot {
    return this._view.getButtonLayout(action, w, h, this._presentationContext);
  }

  /**
   * 모달 내 모든 버튼의 절대 좌표 및 크기 계산 (SettingsView 위임)
   */
  getButtonLayouts(
    w: number,
    h: number,
  ): Record<SettingsButtonAction, ModalButtonSlot> {
    return this._view.getButtonLayouts(w, h, this.toViewModel(), this._presentationContext);
  }

  /**
   * 특정 좌표의 설정 버튼 히트 테스트 (SettingsView 위임)
   */
  hitTestButton(
    x: number,
    y: number,
    w: number,
    h: number,
    padding = 0,
  ): SettingsButtonAction | null {
    return this._view.hitTestButton(
      x,
      y,
      w,
      h,
      this.toViewModel(),
      this._presentationContext,
      padding,
    );
  }

  /**
   * 특정 좌표의 모달 전체(버튼 및 배경 바깥) 히트 테스트 (SettingsView 위임)
   */
  hitTest(
    x: number,
    y: number,
    w: number,
    h: number,
    padding = 0,
  ): SettingsAction | null {
    return this._view.hitTest(
      x,
      y,
      w,
      h,
      this.toViewModel(),
      this._presentationContext,
      padding,
    );
  }

  /**
   * 모달 내부 또는 바깥 클릭 처리
   */
  handleClick(x: number, y: number, w: number, h: number): SettingsAction | null {
    if (!this._isOpen || this._isClosing) return null;

    const action = this.hitTest(x, y, w, h);
    if (!action) return null;

    if (action === 'fontScale') {
      this.cycleFontScale();
    } else if (action === 'stickmanScale') {
      this.cycleStickmanScale();
    } else if (action === 'highContrast') {
      this.toggleHighContrast();
    } else if (action === 'webcamVideo') {
      this.toggleRenderVideo();
    }

    return action;
  }

  /**
   * 모달 렌더링 (SettingsView 위임)
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this._isOpen) return;
    this._view.render(ctx, w, h, this.toViewModel(), this._presentationContext);
  }
}
