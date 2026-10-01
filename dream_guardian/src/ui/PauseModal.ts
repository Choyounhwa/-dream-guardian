/**
 * PauseModal - 인게임 일시정지(Pause) 팝업 모달 (Issue #172 / UI-PAUSE-001)
 *
 * X자 제스처 또는 Esc/P 키로 인게임에서 일시정지 시 표시되는 팝업 모달.
 * 항목:
 * - ▶ 게임으로 돌아가기 (Resume)
 * - 🏠 홈으로 나가기 (Quit)
 *
 * 양손 합장 제스처(MenuInput)로 0.8초 호버 체류(Dwell) 또는 마우스/터치 클릭으로 선택.
 */

import { UIText } from '../utils/UIText.js';
import { UI_LAYOUT } from '../../config/ui.config.js';

export type PauseAction = 'resume' | 'quit' | 'backdrop';

export interface ModalButtonSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PAUSE_DWELL_TIME = 0.8;

export class PauseModal {
  private _isOpen = false;
  private _hoverAction: 'resume' | 'quit' | null = null;
  private _hoverTime = 0;

  // 1080x2160 가상 해상도 기준 모달 중앙 카드 (UI_LAYOUT.pause.modal 연동)
  private readonly MODAL_VIRTUAL = UI_LAYOUT.pause.modal;

  get isOpen(): boolean {
    return this._isOpen;
  }

  get hoverAction(): 'resume' | 'quit' | null {
    return this._hoverAction;
  }

  get hoverProgress(): number {
    return Math.min(1, Math.max(0, this._hoverTime / PAUSE_DWELL_TIME));
  }

  open(): void {
    this._isOpen = true;
    this.resetHover();
  }

  close(): void {
    this._isOpen = false;
    this.resetHover();
  }

  toggle(): void {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  resetHover(): void {
    this._hoverAction = null;
    this._hoverTime = 0;
  }

  /**
   * 버튼 레이아웃 좌표 반환 (UI_LAYOUT.pause 연동)
   */
  getButtonLayout(action: 'resume' | 'quit', w: number, h: number): ModalButtonSlot {
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    const slot = action === 'resume' ? UI_LAYOUT.pause.resumeBtn : UI_LAYOUT.pause.quitBtn;
    return {
      x: slot.x * scaleX,
      y: slot.y * scaleY,
      w: slot.w * scaleX,
      h: slot.h * scaleY,
    };
  }

  /**
   * 클릭 / 터치 히트 테스트
   */
  hitTest(x: number, y: number, w: number, h: number): PauseAction | null {
    const resumeBtn = this.getButtonLayout('resume', w, h);
    if (
      x >= resumeBtn.x &&
      x <= resumeBtn.x + resumeBtn.w &&
      y >= resumeBtn.y &&
      y <= resumeBtn.y + resumeBtn.h
    ) {
      return 'resume';
    }

    const quitBtn = this.getButtonLayout('quit', w, h);
    if (
      x >= quitBtn.x &&
      x <= quitBtn.x + quitBtn.w &&
      y >= quitBtn.y &&
      y <= quitBtn.y + quitBtn.h
    ) {
      return 'quit';
    }

    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;
    const mh = this.MODAL_VIRTUAL.h * scaleY;

    if (x < mx || x > mx + mw || y < my || y > my + mh) {
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
      this.resetHover();
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

      const progress = this.hoverProgress;
      if (this._hoverTime >= PAUSE_DWELL_TIME) {
        return { action: hit, progress: 1.0 };
      }
      return { action: null, progress };
    } else {
      this.resetHover();
      return { action: null, progress: 0 };
    }
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, w, h);

    // 2. 모달 카드 배경
    const mx = this.MODAL_VIRTUAL.x * scaleX;
    const my = this.MODAL_VIRTUAL.y * scaleY;
    const mw = this.MODAL_VIRTUAL.w * scaleX;
    const mh = this.MODAL_VIRTUAL.h * scaleY;
    const radius = 28 * scaleX;

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

    // 3. 타이틀 및 안내 문구
    ctx.font = UIText.getFont('subheading', scaleX, 'bold');
    ctx.fillStyle = '#FFCB4D';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('⏸ 일시정지 (PAUSED)', mx + mw / 2, my + 50 * scaleY);

    ctx.font = UIText.getFont('badge', scaleX, 'normal');
    ctx.fillStyle = '#C8D4E6';
    ctx.fillText('양손을 모아 합장 커서로 선택하세요', mx + mw / 2, my + 130 * scaleY);
    ctx.fillText('X자 제스처로 다시 열고 닫을 수 있습니다', mx + mw / 2, my + 175 * scaleY);

    // 4. 버튼 렌더링 헬퍼
    const renderBtn = (
      btn: ModalButtonSlot,
      action: 'resume' | 'quit',
      label: string,
      accentColor: string,
    ) => {
      const isHovered = this._hoverAction === action;
      const progress = isHovered ? this.hoverProgress : 0;

      ctx.save();
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

      // 라벨 텍스트
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.fillStyle = isHovered ? '#FFFFFF' : '#E8F0FE';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);

      ctx.restore();
    };

    const resumeBtn = this.getButtonLayout('resume', w, h);
    renderBtn(resumeBtn, 'resume', '▶  게임으로 돌아가기', '#28E6FF');

    const quitBtn = this.getButtonLayout('quit', w, h);
    renderBtn(quitBtn, 'quit', '🏠  홈으로 나가기', '#FF865E');

    ctx.restore();
  }
}
