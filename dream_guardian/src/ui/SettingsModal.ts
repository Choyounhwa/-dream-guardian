/**
 * SettingsModal - 게임 설정 팝업 모달 드로어 (Issue #141 / UI-BAR-001)
 *
 * 화면 중앙 오버레이 팝업 모달
 * 항목:
 * - 📷 카메라 ON/OFF
 * - ⛶ 전체화면 전환
 * - 🦴 스켈레톤 미러 표시 ON/OFF
 * - 🔊 사운드 ON/OFF
 * - ✕ 닫기 버튼 및 배경 터치 닫기
 */

import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';
import { UI_LAYOUT, UI_ACCESSIBILITY } from '../../config/ui.config.js';
import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';

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

export interface ModalButtonSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class SettingsModal {
  private _isOpen = false;
  private _isClosing = false;
  private _animProgress = 0;
  private _animTimer = 0;
  private readonly OPEN_DURATION = 0.25;
  private readonly CLOSE_DURATION = 0.20;

  private _cameraEnabled = true;
  private _skeletonEnabled = true;
  private _soundEnabled = true;
  private _locomotionModeLabel = '제자리 달리기';
  private _fontScale = UI_ACCESSIBILITY.fontScale ?? 1.0;
  private _highContrast = UI_ACCESSIBILITY.highContrast ?? false;
  private _stickmanScale = STICKMAN_CONFIG.scale ?? 1.0;
  public onStickmanScaleChange?: (scale: number) => void;

  // 모달 다이얼로그 가상 기준 (UI_LAYOUT.settings.modal 연동)
  private readonly MODAL_VIRTUAL = UI_LAYOUT.settings.modal;

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

  saveAccessibility(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dg_a11y_fontScale', String(this._fontScale));
        localStorage.setItem('dg_a11y_highContrast', String(this._highContrast));
        localStorage.setItem('dg_stickman_scale', String(this._stickmanScale));
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
   * 모달 내 특정 버튼의 절대 좌표 및 크기 계산 (UI_LAYOUT.settings 연동)
   */
  getButtonLayout(
    action: SettingsButtonAction,
    w: number,
    h: number,
  ): ModalButtonSlot {
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    if (action === 'close') {
      const slot = UI_LAYOUT.settings.closeBtn;
      return {
        x: slot.x * scaleX,
        y: slot.y * scaleY,
        w: slot.w * scaleX,
        h: slot.h * scaleY,
      };
    }

    const btnSlot = (UI_LAYOUT.settings.buttons as Record<string, ModalButtonSlot | undefined>)?.[action];
    if (btnSlot) {
      return {
        x: btnSlot.x * scaleX,
        y: btnSlot.y * scaleY,
        w: btnSlot.w * scaleX,
        h: btnSlot.h * scaleY,
      };
    }

    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;

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

    return {
      x: mx + 60 * scaleX,
      y: my + offsetY * scaleY,
      w: mw - 120 * scaleX,
      h: 110 * scaleY,
    };
  }

  /**
   * 모달 내부 또는 바깥 클릭 처리
   */
  handleClick(x: number, y: number, w: number, h: number): SettingsAction | null {
    if (!this._isOpen || this._isClosing) return null;

    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;
    const mh = Math.max(this.MODAL_VIRTUAL.h, 1200) * scaleY;

    // 1. 모달 다이얼로그 바깥 클릭 시 backdrop-close
    if (x < mx || x > mx + mw || y < my || y > my + mh) {
      return 'backdrop-close';
    }

    // 2. 내부 버튼 히트 체크
    const actions: SettingsButtonAction[] = [
      'close',
      'camera',
      'fullscreen',
      'skeleton',
      'sound',
      'locomotion',
      'fontScale',
      'highContrast',
      'stickmanScale',
    ];

    for (const act of actions) {
      const btn = this.getButtonLayout(act, w, h);
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        if (act === 'fontScale') {
          this.cycleFontScale();
        } else if (act === 'stickmanScale') {
          this.cycleStickmanScale();
        } else if (act === 'highContrast') {
          this.toggleHighContrast();
        }
        return act;
      }
    }

    return null;
  }

  /**
   * 모달 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this._isOpen) return;

    const scaleX = w / 1080;
    const scaleY = h / 2160;

    const animAlpha = this.alpha;
    const animScale = this.scale;

    ctx.save();

    // 1. 전체 화면 딤 오버레이 (0 -> 0.75 보간)
    const dimAlpha = (0.75 * animAlpha).toFixed(3);
    ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // 2. 모달 카드 배경 및 콘텐츠 (스케일 및 알파 보간)
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;
    const mh = Math.max(this.MODAL_VIRTUAL.h, 1200) * scaleY;
    const radius = 28 * scaleX;

    const cx = mx + mw / 2;
    const cy = my + mh / 2;

    ctx.save();
    ctx.translate?.(cx, cy);
    ctx.scale?.(animScale, animScale);
    ctx.translate?.(-cx, -cy);
    ctx.globalAlpha = animAlpha;

    const dialogBgImg = imageLoader.get('settings', 'modalBg') ?? imageLoader.get('settings', 'dialogBg');
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
    const closeBtn = this.getButtonLayout('close', w, h);
    const closeIconImg = imageLoader.get('modal', 'btnCloseX') ?? imageLoader.get('settings', 'closeIcon');
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
      this.getButtonLayout('camera', w, h),
      '📷 카메라',
      this._cameraEnabled ? 'ON' : 'OFF',
      this._cameraEnabled,
      'iconCamera',
    );

    // 전체화면 버튼
    const isFull = typeof document !== 'undefined' && Boolean(document.fullscreenElement);
    renderOptionBtn(
      this.getButtonLayout('fullscreen', w, h),
      '⛶ 전체화면',
      isFull ? 'ON' : 'OFF',
      isFull,
      'iconFullscreen',
    );

    // 스켈레톤 본(웹캠 선/점) 표시 버튼 (Issue #280)
    renderOptionBtn(
      this.getButtonLayout('skeleton', w, h),
      '🦴 스켈레톤 본',
      this._skeletonEnabled ? 'ON' : 'OFF',
      this._skeletonEnabled,
      'iconSkeleton',
    );

    // 사운드 버튼
    renderOptionBtn(
      this.getButtonLayout('sound', w, h),
      '🔊 사운드 효과음',
      this._soundEnabled ? 'ON' : 'OFF',
      this._soundEnabled,
      'iconSound',
    );

    // 운동 방식 선택 버튼
    renderOptionBtn(
      this.getButtonLayout('locomotion', w, h),
      '🏃 운동 방식',
      `${this._locomotionModeLabel} ⚙`,
      true
    );

    // 글씨 크기 버튼
    renderOptionBtn(
      this.getButtonLayout('fontScale', w, h),
      '🔤 글씨 크기',
      this.fontScaleLabel,
      this._fontScale > 1.0
    );

    // 고대비 모드 버튼
    renderOptionBtn(
      this.getButtonLayout('highContrast', w, h),
      '👁 고대비 모드',
      this._highContrast ? 'ON' : 'OFF',
      this._highContrast,
    );

    // 졸라맨 크기 버튼 (Issue #420)
    renderOptionBtn(
      this.getButtonLayout('stickmanScale', w, h),
      '🧍 졸라맨 크기',
      this.stickmanScaleLabel,
      this._stickmanScale > 1.0,
      'iconSkeleton',
    );

    ctx.restore(); // 카드 transform 복원
    ctx.restore(); // 최상단 save 복원
  }
}
