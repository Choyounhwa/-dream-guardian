/**
 * AnswerSelectionRenderer - 10개 피트니스 존 및 4색 신체 커서 캔버스 렌더러
 *
 * Issue #104:
 * - 활성 피트니스 존 네온 테두리, 라벨 및 요구 커서 인디케이터 시각화
 * - 4색 신체 커서(시안 왼손, 노랑 오른손, 보라 머리, 주황 골반) 및 체류 진행도(Dwell Arc) 표시
 */

import type { FitnessZone, CursorType } from '../input/AnswerSelector.js';
import { CURSOR_COLORS } from '../input/AnswerSelector.js';
import type { CursorPosition } from '../input/CursorTracker.js';

export interface RenderZoneInfo {
  zone: FitnessZone;
  isActive: boolean;
  requiredCursors?: CursorType[];
}

export class AnswerSelectionRenderer {
  private _pulseTimer = 0;

  update(dt: number): void {
    this._pulseTimer = (this._pulseTimer + dt * 3) % (Math.PI * 2);
  }

  /**
   * 피트니스 존 및 커서 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    activeZones: readonly FitnessZone[],
    cursors: ReadonlyMap<CursorType, CursorPosition>,
    choiceProgress: [number, number] = [0, 0],
  ): void {
    ctx.save();

    // 1. 활성 피트니스 존 테두리 및 충전 렌더링
    this._renderZones(ctx, w, h, activeZones, choiceProgress);

    // 2. 4색 신체 커서 및 체류 아크 렌더링
    this._renderCursors(ctx, w, h, cursors, Math.max(choiceProgress[0], choiceProgress[1]));

    ctx.restore();
  }

  private _renderZones(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    activeZones: readonly FitnessZone[],
    choiceProgress: [number, number],
  ): void {
    for (let i = 0; i < activeZones.length; i++) {
      const zone = activeZones[i];
      const zx = zone.x * w;
      const zy = zone.y * h;
      const zw = zone.width * w;
      const zh = zone.height * h;
      const progress = choiceProgress[i % 2] ?? 0;

      // 존 배경 (은은한 글로우)
      ctx.fillStyle = 'rgba(40, 230, 255, 0.06)';
      ctx.beginPath();
      ctx.rect(zx, zy, zw, zh);
      ctx.fill();

      // 충전 진행 시 채움 바
      if (progress > 0) {
        ctx.fillStyle = `rgba(77, 255, 170, ${0.15 + progress * 0.25})`;
        ctx.fillRect(zx, zy + zh * (1 - progress), zw, zh * progress);
      }

      // 네온 점선 테두리
      ctx.strokeStyle = progress > 0 ? '#4DFFAA' : 'rgba(40, 230, 255, 0.45)';
      ctx.lineWidth = progress > 0 ? 3 : 1.5;
      ctx.strokeRect(zx, zy, zw, zh);

      // 존 라벨
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = `bold ${Math.max(12, Math.min(16, w * 0.015))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(zone.label, zx + zw / 2, zy + 6);
    }
  }

  private _renderCursors(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cursors: ReadonlyMap<CursorType, CursorPosition>,
    maxProgress: number,
  ): void {
    for (const [type, pos] of cursors) {
      const cx = pos.x * w;
      const cy = pos.y * h;
      const color = CURSOR_COLORS[type];

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      if (type === 'leftHand' || type === 'rightHand') {
        // 손 커서: 원 + 펄스 링
        const radius = 18;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // 펄스 링
        const pulseR = radius + 6 + Math.sin(this._pulseTimer) * 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        // 라벨
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(type === 'leftHand' ? 'L' : 'R', cx, cy);
      } else if (type === 'head') {
        // 머리/얼굴: 라운드 타원
        ctx.strokeStyle = color;
        ctx.fillStyle = 'rgba(200, 137, 255, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 22, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HEAD', cx, cy);
      } else if (type === 'hip') {
        // 골반: 라운드 역삼각형
        ctx.fillStyle = 'rgba(255, 134, 94, 0.4)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 24, cy - 14);
        ctx.lineTo(cx + 24, cy - 14);
        ctx.lineTo(cx, cy + 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HIP', cx, cy - 2);
      }

      // 체류 충전 아크 (진행도가 있을 때)
      if (maxProgress > 0) {
        ctx.strokeStyle = '#4DFFAA';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * maxProgress);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
