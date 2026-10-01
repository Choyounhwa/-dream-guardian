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

export type SettingsAction = 'close' | 'camera' | 'fullscreen' | 'skeleton' | 'sound' | 'locomotion' | 'backdrop-close';

export interface ModalButtonSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class SettingsModal {
  private _isOpen = false;
  private _cameraEnabled = true;
  private _skeletonEnabled = true;
  private _soundEnabled = true;
  private _locomotionModeLabel = '제자리 달리기';

  // 모달 다이얼로그 가상 기준 (1080x2160 기준 w: 800, h: 1080, 중앙)
  private readonly MODAL_VIRTUAL = {
    x: 140,
    y: 480,
    w: 800,
    h: 1080,
  };

  get isOpen(): boolean {
    return this._isOpen;
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

  open(): void {
    this._isOpen = true;
  }

  close(): void {
    this._isOpen = false;
  }

  toggle(): void {
    this._isOpen = !this._isOpen;
  }

  /**
   * 모달 내 특정 버튼의 절대 좌표 및 크기 계산
   */
  getButtonLayout(
    action: 'close' | 'camera' | 'fullscreen' | 'skeleton' | 'sound' | 'locomotion',
    w: number,
    h: number,
  ): ModalButtonSlot {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;

    switch (action) {
      case 'close':
        // 상단 우측 닫기 버튼 (60x60)
        return {
          x: mx + mw - 90 * scaleX,
          y: my + 30 * scaleY,
          w: 60 * scaleX,
          h: 60 * scaleY,
        };
      case 'camera':
        return {
          x: mx + 60 * scaleX,
          y: my + 140 * scaleY,
          w: mw - 120 * scaleX,
          h: 110 * scaleY,
        };
      case 'fullscreen':
        return {
          x: mx + 60 * scaleX,
          y: my + 270 * scaleY,
          w: mw - 120 * scaleX,
          h: 110 * scaleY,
        };
      case 'skeleton':
        return {
          x: mx + 60 * scaleX,
          y: my + 400 * scaleY,
          w: mw - 120 * scaleX,
          h: 110 * scaleY,
        };
      case 'sound':
        return {
          x: mx + 60 * scaleX,
          y: my + 530 * scaleY,
          w: mw - 120 * scaleX,
          h: 110 * scaleY,
        };
      case 'locomotion':
        return {
          x: mx + 60 * scaleX,
          y: my + 660 * scaleY,
          w: mw - 120 * scaleX,
          h: 110 * scaleY,
        };
    }
  }

  /**
   * 모달 내부 또는 바깥 클릭 처리
   */
  handleClick(x: number, y: number, w: number, h: number): SettingsAction | null {
    if (!this._isOpen) return null;

    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;
    const mh = this.MODAL_VIRTUAL.h * scaleY;

    // 1. 모달 다이얼로그 바깥 클릭 시 backdrop-close
    if (x < mx || x > mx + mw || y < my || y > my + mh) {
      return 'backdrop-close';
    }

    // 2. 내부 버튼 히트 체크
    const actions: Array<'close' | 'camera' | 'fullscreen' | 'skeleton' | 'sound' | 'locomotion'> = [
      'close',
      'camera',
      'fullscreen',
      'skeleton',
      'sound',
      'locomotion',
    ];

    for (const act of actions) {
      const btn = this.getButtonLayout(act, w, h);
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
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

    ctx.save();

    // 1. 전체 화면 딤 오버레이
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, w, h);

    // 2. 모달 카드 배경
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;
    const mh = this.MODAL_VIRTUAL.h * scaleY;
    const radius = 28 * scaleX;

    const dialogBgImg = imageLoader.get('settings', 'dialogBg');
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
    const closeIconImg = imageLoader.get('settings', 'closeIcon');
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
      isActive: boolean
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

      // 옵션 명
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, btn.x + 36 * scaleX, btn.y + btn.h / 2);

      // 상태 태그
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.fillStyle = isActive ? '#28E6FF' : '#888888';
      ctx.textAlign = 'right';
      ctx.fillText(statusText, btn.x + btn.w - 36 * scaleX, btn.y + btn.h / 2);
    };

    // 카메라 버튼
    renderOptionBtn(
      this.getButtonLayout('camera', w, h),
      '📷 카메라',
      this._cameraEnabled ? 'ON' : 'OFF',
      this._cameraEnabled
    );

    // 전체화면 버튼
    const isFull = typeof document !== 'undefined' && Boolean(document.fullscreenElement);
    renderOptionBtn(
      this.getButtonLayout('fullscreen', w, h),
      '⛶ 전체화면',
      isFull ? 'ON' : 'OFF',
      isFull
    );

    // 스켈레톤 미러 표시 버튼
    renderOptionBtn(
      this.getButtonLayout('skeleton', w, h),
      '🦴 스켈레톤 표시',
      this._skeletonEnabled ? 'ON' : 'OFF',
      this._skeletonEnabled
    );

    // 사운드 버튼
    renderOptionBtn(
      this.getButtonLayout('sound', w, h),
      '🔊 사운드 효과음',
      this._soundEnabled ? 'ON' : 'OFF',
      this._soundEnabled
    );

    // 운동 방식 선택 버튼
    renderOptionBtn(
      this.getButtonLayout('locomotion', w, h),
      '🏃 운동 방식',
      `${this._locomotionModeLabel} ⚙`,
      true
    );

    ctx.restore();
  }
}
