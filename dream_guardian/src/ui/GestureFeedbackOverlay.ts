/**
 * GestureFeedbackOverlay - X자 제스처 피드백 패널 오버레이
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - main.ts에 인라인되어 있던 X자 제스처 진행 게이지 및 안내 패널 렌더링 분리
 */

import { UIText } from '../utils/UIText.js';

export interface GestureFeedbackState {
  isCrossing: boolean;
  inCooldown: boolean;
  isPaused: boolean;
  progress: number;
  screenMode: string;
  menuMode?: string;
}

export class GestureFeedbackOverlay {
  /**
   * X자 제스처 감지 상태에 따른 상단 비주얼 피드백 렌더링
   */
  render(ctx: CanvasRenderingContext2D, vw: number, vh: number, state: GestureFeedbackState): void {
    if (!state.isCrossing || state.inCooldown || state.isPaused) {
      return;
    }

    ctx.save();
    const cx = vw * 0.5;
    const cy = vh * 0.22;
    const prog = Math.max(0, Math.min(1, state.progress));

    // 1. 패널 배경 박스
    ctx.fillStyle = 'rgba(10, 14, 26, 0.88)';
    ctx.strokeStyle = '#FF865E';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#FF865E';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(cx - 180, cy - 40, 360, 80, 24);
    } else {
      ctx.rect(cx - 180, cy - 40, 360, 80);
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. 패널 라벨 텍스트
    const scaleX = vw ? vw / 1080 : 1.0;
    ctx.font = UIText.getFont('label', scaleX, 'bold');
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = state.screenMode === 'menu' && state.menuMode === 'sub'
      ? '✕ 홈으로 나가기...'
      : '⏸ 일시정지...';
    ctx.fillText(label, cx, cy - 6);

    // 3. 진행도 게이지 바
    const barW = 300 * prog;
    ctx.fillStyle = '#4DFFAA';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(cx - 150, cy + 22, barW, 8, 4);
    } else {
      ctx.rect(cx - 150, cy + 22, barW, 8);
    }
    ctx.fill();

    ctx.restore();
  }
}
