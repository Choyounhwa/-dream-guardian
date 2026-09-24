/**
 * AnswerSelectionRenderer - 10개 피트니스 존 및 4색 신체 커서 캔버스 렌더러
 *
 * Issue #104:
 * - 활성 피트니스 존 네온 테두리, 라벨 및 요구 커서 인디케이터 시각화
 * - 4색 신체 커서(시안 왼손, 노랑 오른손, 보라 머리, 주황 골반) 및 체류 진행도(Dwell Arc) 표시
 *
 * Issue #116:
 * - Cover 뷰포트 프로젝션 좌표계와 1:1 동기화 (pos.x * w, pos.y * h = JointRenderer 관절 좌표와 0px 오차 일치)
 */

import type { FitnessZone } from '../../config/zone.config.js';
import type { CursorType } from '../../config/cursor.config.js';
import { CURSOR_COLORS, CURSOR_DIMENSIONS } from '../../config/cursor.config.js';
import type { CursorPosition } from '../input/CursorTracker.js';
import type { MagicCircleRenderer } from './MagicCircleRenderer.js';

export interface RenderZoneInfo {
  zone: FitnessZone;
  isActive: boolean;
  requiredCursors?: CursorType[];
}

/** 존별 진행도 입력 타입 (튜플, Map, Record 지원, Issue #129) */
export type ZoneProgressInput =
  | [number, number]
  | Map<number, number>
  | Record<number, number>;

export class AnswerSelectionRenderer {
  private _pulseTimer = 0;
  private _magicCircle: MagicCircleRenderer | null = null;

  /** 마법진 렌더러 주입 (선택적, Issue #143) */
  setMagicCircle(renderer: MagicCircleRenderer): void {
    this._magicCircle = renderer;
  }

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
    choiceProgress: ZoneProgressInput = [0, 0],
  ): void {
    ctx.save();

    // 1. 활성 피트니스 존 테두리 및 충전 렌더링 (존별 독립 진행도)
    this._renderZones(ctx, w, h, activeZones, choiceProgress);

    // 2. 4색 신체 커서 및 체류 아크 렌더링 (커서별 위치한 존의 진행도 독립 반영)
    this._renderCursors(ctx, w, h, cursors, activeZones, choiceProgress);

    ctx.restore();
  }

  /**
   * 존 ID 또는 인덱스에 매핑된 진행도 조회 (Issue #129 / i % 2 오매핑 해소)
   */
  private _getZoneProgress(
    zoneId: number,
    index: number,
    progressInput: ZoneProgressInput,
  ): number {
    if (progressInput instanceof Map) {
      return progressInput.get(zoneId) ?? 0;
    }
    if (Array.isArray(progressInput)) {
      if (progressInput.length === 2) {
        // 공용 활성 존: 좌/우 답안 진행도 중 최대 진행도 반영 (Issue #150)
        return Math.max(progressInput[0] ?? 0, progressInput[1] ?? 0);
      }
      return progressInput[index] ?? 0;
    }
    if (typeof progressInput === 'object' && progressInput !== null) {
      return (progressInput as Record<number, number>)[zoneId] ?? 0;
    }
    return 0;
  }

  private _renderZones(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    activeZones: readonly FitnessZone[],
    choiceProgress: ZoneProgressInput,
  ): void {
    for (let i = 0; i < activeZones.length; i++) {
      const zone = activeZones[i];
      const zx = zone.x * w;
      const zy = zone.y * h;
      const zw = zone.width * w;
      const zh = zone.height * h;
      // Issue #129: i % 2 오매핑 수정 -> 존별 독립 진행도 매핑
      const progress = this._getZoneProgress(zone.id, i, choiceProgress);

      const cx = zx + zw / 2;
      const cy = zy + zh / 2;
      const size = Math.max(zw, zh) * 1.35;

      // Issue #143: 3중 회전 마법진 렌더링
      if (this._magicCircle?.isReady) {
        this._magicCircle.renderAtZone(ctx, cx, cy, size);
        if (progress > 0) {
          ctx.save();
          ctx.strokeStyle = '#4DFFAA';
          ctx.lineWidth = 6 * (w / 1080);
          ctx.shadowColor = '#4DFFAA';
          ctx.shadowBlur = 18 * (w / 1080);
          ctx.beginPath();
          ctx.arc(cx, cy, (size / 2) * 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // Fallback (테스트 또는 이미지 미로드 시)
        ctx.fillStyle = 'rgba(40, 230, 255, 0.08)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(zx, zy, zw, zh, 16);
        } else {
          ctx.rect(zx, zy, zw, zh);
        }
        ctx.fill();

        // 충전 진행 시 채움 바 (Issue #129 검증 호환)
        if (progress > 0) {
          ctx.fillStyle = `rgba(77, 255, 170, ${0.15 + progress * 0.25})`;
          ctx.fillRect(zx, zy + zh * (1 - progress), zw, zh * progress);
        }

        ctx.strokeStyle = progress > 0 ? '#4DFFAA' : 'rgba(40, 230, 255, 0.5)';
        ctx.lineWidth = progress > 0 ? 3 : 1.5;
        ctx.strokeRect(zx, zy, zw, zh);
      }
    }
  }

  private _renderCursors(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cursors: ReadonlyMap<CursorType, CursorPosition>,
    activeZones: readonly FitnessZone[],
    progressInput: ZoneProgressInput,
  ): void {
    for (const [type, pos] of cursors) {
      const cx = pos.x * w;
      const cy = pos.y * h;
      const color = CURSOR_COLORS[type];

      // Issue #129: 커서별 독립 진행도 (커서가 위치한 활성 존의 진행도 매핑)
      let cursorProgress = 0;
      for (let zi = 0; zi < activeZones.length; zi++) {
        const z = activeZones[zi];
        if (
          pos.x >= z.x &&
          pos.x <= z.x + z.width &&
          pos.y >= z.y &&
          pos.y <= z.y + z.height
        ) {
          cursorProgress = Math.max(cursorProgress, this._getZoneProgress(z.id, zi, progressInput));
        }
      }
      if (activeZones.length === 0 && Array.isArray(progressInput)) {
        cursorProgress = Math.max(progressInput[0] ?? 0, progressInput[1] ?? 0);
      }

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      if (type === 'leftHand' || type === 'rightHand') {
        // 손 커서: 네온 링 외곽선 전용 (Issue #117: 채움색 없음 / Outline Only & 동적 크기)
        const radius = pos.size?.radius ?? CURSOR_DIMENSIONS.hand.defaultRadius;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // 펄스 링
        const pulseR = radius + 6 + Math.sin(this._pulseTimer) * 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        // 라벨
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(10, Math.round(radius * 0.65))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(type === 'leftHand' ? 'L' : 'R', cx, cy);
      } else if (type === 'head') {
        // 머리/얼굴: 라운드 타원 외곽선 전용 (Issue #117: 채움색 없음 / Outline Only & 동적 크기)
        const rx = pos.size?.radiusX ?? CURSOR_DIMENSIONS.head.defaultRadiusX;
        const ry = pos.size?.radiusY ?? CURSOR_DIMENSIONS.head.defaultRadiusY;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(10, Math.round(rx * 0.5))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HEAD', cx, cy);
      } else if (type === 'hip') {
        // 골반: 납작한 라운드 마름모 외곽선 전용 (Issue #145: Flattened Rounded Rhombus & 다리 시작점 1.5배)
        const hw = pos.size?.halfWidth ?? CURSOR_DIMENSIONS.hip.defaultHalfWidth;
        const hh = pos.size?.halfHeight ?? pos.size?.topOffset ?? Math.round(hw * CURSOR_DIMENSIONS.hip.aspectRatio);
        const radius = Math.min(12, Math.round(hh * 0.35));

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (typeof ctx.arcTo === 'function') {
          // Left-to-Top 중간에서 시작하여 Top, Right, Bottom, Left 4개 꼭짓점을 라운딩하며 연결
          const midLeftTopX = (cx - hw + cx) / 2;
          const midLeftTopY = (cy + cy - hh) / 2;
          ctx.moveTo(midLeftTopX, midLeftTopY);
          ctx.arcTo(cx, cy - hh, cx + hw, cy, radius);
          ctx.arcTo(cx + hw, cy, cx, cy + hh, radius);
          ctx.arcTo(cx, cy + hh, cx - hw, cy, radius);
          ctx.arcTo(cx - hw, cy, cx, cy - hh, radius);
          ctx.closePath();
        } else {
          ctx.moveTo(cx, cy - hh);
          ctx.lineTo(cx + hw, cy);
          ctx.lineTo(cx, cy + hh);
          ctx.lineTo(cx - hw, cy);
          ctx.closePath();
        }
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.max(9, Math.round(hw * 0.28))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HIP', cx, cy);
      }

      // 체류 충전 아크 (해당 커서가 위치한 존의 독립 진행도가 있을 때만 외곽에 표시)
      if (cursorProgress > 0) {
        let baseR: number = CURSOR_DIMENSIONS.hand.defaultRadius;
        if (pos.size?.radius) baseR = pos.size.radius;
        else if (pos.size?.radiusX) baseR = Math.max(pos.size.radiusX, pos.size.radiusY ?? CURSOR_DIMENSIONS.head.defaultRadiusY);
        else if (pos.size?.halfWidth) baseR = pos.size.halfWidth;

        const arcR = baseR + CURSOR_DIMENSIONS.dwellArc.arcOffset;
        ctx.strokeStyle = '#4DFFAA';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cursorProgress);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
}
