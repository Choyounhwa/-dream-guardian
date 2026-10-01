/**
 * JoinedHandsCursorRenderer - 양손 모으기(합장) 커서 렌더러
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - main.ts에 인라인되어 있던 합장 커서 렌더링 코드를 독립 렌더 모듈로 추출
 */

import { JOINED_HANDS_CURSOR } from '../../config/cursor.config.js';

export interface DrawJoinedHandsCursorOptions {
  label: string;
  progress?: number;
}

export function drawJoinedHandsCursor(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  cursorX: number,
  cursorY: number,
  label: string,
  progress: number = 0,
): void {
  const mx = cursorX * vw;
  const my = cursorY * vh;
  const cfg = JOINED_HANDS_CURSOR;

  ctx.save();
  ctx.shadowColor = '#FFCB4D';
  ctx.shadowBlur = cfg.shadowBlur;

  // 외곽 합장 네온 링 (시인성 강화 펄스, Issue #201: 반경 100px, 펄스 12px, 선 두께 8px)
  const pulse = Math.sin(Date.now() / cfg.pulseSpeed) * cfg.pulseAmplitude;
  ctx.strokeStyle = '#FFCB4D';
  ctx.lineWidth = cfg.lineWidth;
  ctx.beginPath();
  ctx.arc(mx, my, cfg.ringRadius + pulse, 0, Math.PI * 2);
  ctx.stroke();

  // 텍스트 라벨 (Issue #201: 40px bold 대형 텍스트)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${cfg.fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, mx, my);

  // 0.8초 호버 체류 프로그레스 아크 (Issue #201: 반경 145px, 두께 16px, 발광 블러 24px)
  if (progress > 0) {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    ctx.strokeStyle = '#4DFFAA';
    ctx.lineWidth = cfg.progressLineWidth;
    ctx.shadowColor = '#4DFFAA';
    ctx.shadowBlur = cfg.progressBlur;
    ctx.beginPath();
    ctx.arc(mx, my, cfg.progressRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clampedProgress);
    ctx.stroke();
  }
  ctx.restore();
}
