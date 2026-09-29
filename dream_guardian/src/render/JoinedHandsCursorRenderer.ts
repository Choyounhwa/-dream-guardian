/**
 * JoinedHandsCursorRenderer - 양손 모으기(합장) 커서 렌더러
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - main.ts에 인라인되어 있던 합장 커서 렌더링 코드를 독립 렌더 모듈로 추출
 */

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

  ctx.save();
  ctx.shadowColor = '#FFCB4D';
  ctx.shadowBlur = 15;

  // 외곽 합장 네온 링 (시인성 강화 펄스)
  const pulse = Math.sin(Date.now() / 150) * 4;
  ctx.strokeStyle = '#FFCB4D';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(mx, my, 34 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  // 텍스트 라벨
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, mx, my);

  // 0.8초 호버 체류 프로그레스 아크
  if (progress > 0) {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    ctx.strokeStyle = '#4DFFAA';
    ctx.lineWidth = 7;
    ctx.shadowColor = '#4DFFAA';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(mx, my, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clampedProgress);
    ctx.stroke();
  }
  ctx.restore();
}
