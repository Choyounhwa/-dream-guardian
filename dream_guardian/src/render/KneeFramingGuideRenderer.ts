import { DEFAULT_KNEE_FRAMING_CONFIG } from '../../config/motion.config.js';
import type { KneeFramingResult } from '../motion/KneeFramingValidator.js';

export class KneeFramingGuideRenderer {
  private _time = 0;

  update(dt: number): void {
    this._time += Math.max(0, dt);
  }

  render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    framing: KneeFramingResult,
  ): void {
    if (width <= 0 || height <= 0) return;

    ctx.save();
    if (framing.status === 'ready') {
      this._renderReady(ctx, width, height);
    } else {
      this._renderFrame(ctx, width, height);
      if (framing.status === 'stabilizing') {
        this._renderStabilizing(ctx, width, height, framing.progress);
      } else {
        this._renderInstruction(ctx, width, height, framing.status, framing.issue);
      }
    }
    ctx.restore();
  }

  private _renderFrame(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const left = width * DEFAULT_KNEE_FRAMING_CONFIG.horizontalSafeMargin;
    const right = width - left;
    const top = height * DEFAULT_KNEE_FRAMING_CONFIG.topSafeMargin;
    const kneeLine = height * (1 - DEFAULT_KNEE_FRAMING_CONFIG.bottomSafeMargin);
    const centerX = width / 2;
    const silhouetteWidth = width * 0.19;

    ctx.globalAlpha = 0.48;
    ctx.strokeStyle = '#64E8FF';
    ctx.lineWidth = Math.max(2, width * 0.0025);
    ctx.setLineDash([width * 0.01, width * 0.006]);
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, kneeLine);
    ctx.moveTo(right, top);
    ctx.lineTo(right, kneeLine);
    ctx.moveTo(left, kneeLine);
    ctx.lineTo(right, kneeLine);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 0.23;
    ctx.strokeStyle = '#C889FF';
    ctx.lineWidth = Math.max(2, width * 0.003);
    ctx.beginPath();
    ctx.moveTo(centerX, top + height * 0.08);
    ctx.lineTo(centerX, height * 0.42);
    ctx.moveTo(centerX - silhouetteWidth / 2, height * 0.28);
    ctx.lineTo(centerX + silhouetteWidth / 2, height * 0.28);
    ctx.moveTo(centerX, height * 0.42);
    ctx.lineTo(centerX - silhouetteWidth * 0.32, kneeLine - height * 0.03);
    ctx.moveTo(centerX, height * 0.42);
    ctx.lineTo(centerX + silhouetteWidth * 0.32, kneeLine - height * 0.03);
    ctx.stroke();
  }

  private _renderStabilizing(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    progress: number,
  ): void {
    const centerX = width / 2;
    const centerY = height * 0.16;
    const radius = Math.max(20, width * 0.027);
    const clampedProgress = Math.max(0, Math.min(1, progress));

    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#FFCB4D';
    ctx.lineWidth = Math.max(3, width * 0.004);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clampedProgress);
    ctx.stroke();
    this._drawText(ctx, '이 자세를 유지하세요...', centerX, centerY + radius + height * 0.05, width, '#FFCB4D');
  }

  private _renderInstruction(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    status: KneeFramingResult['status'],
    issue: KneeFramingResult['issue'],
  ): void {
    const text = status === 'unframed'
      ? '한두 걸음 뒤로 가서 무릎까지 보이게 서세요'
      : this._instructionFor(issue);
    const centerX = width / 2;
    const y = height * 0.14;
    this._drawText(ctx, text, centerX, y, width, '#FF865E');

    ctx.globalAlpha = 0.75 + Math.sin(this._time * 4) * 0.15;
    ctx.strokeStyle = '#FF865E';
    ctx.lineWidth = Math.max(3, width * 0.004);
    ctx.beginPath();
    ctx.moveTo(centerX, y + height * 0.04);
    ctx.lineTo(centerX, y + height * 0.11);
    ctx.moveTo(centerX, y + height * 0.11);
    ctx.lineTo(centerX - width * 0.012, y + height * 0.087);
    ctx.moveTo(centerX, y + height * 0.11);
    ctx.lineTo(centerX + width * 0.012, y + height * 0.087);
    ctx.stroke();
  }

  private _renderReady(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.globalAlpha = 0.3;
    this._drawText(ctx, '무릎 프레이밍 완료', width * 0.5, height * 0.95, width, '#64E8FF');
  }

  private _instructionFor(issue: KneeFramingResult['issue']): string {
    if (issue === 'body-too-large') return '뒤로 조금 이동하세요';
    if (issue === 'body-too-small') return '앞으로 조금 이동하세요';
    if (issue === 'outside-safe-frame') return '중앙으로 이동하고 무릎이 보이게 조정하세요';
    return '무릎이 보이도록 조정하세요';
  }

  private _drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.max(18, width * 0.024)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }
}
