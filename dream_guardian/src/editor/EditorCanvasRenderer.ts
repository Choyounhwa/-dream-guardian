/**
 * EditorCanvasRenderer.ts - 11개 피트니스 존 및 신체 포즈 실시간 캔버스 렌더러
 */

import { DEFAULT_FITNESS_ZONES, type FitnessZone } from '../../config/zone.config.js';
import type { CatChoreoPattern } from '../data/danceRoutineData.js';

export const PART_COLORS = {
  leftHand: '#28E6FF',
  rightHand: '#FFCB4D',
  head: '#C889FF',
  hip: '#FF865E',
  foot: '#10B981',
} as const;

export class EditorCanvasRenderer {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not supported');
    }
    this._ctx = ctx;
  }

  get width(): number {
    return this._canvas.width;
  }

  get height(): number {
    return this._canvas.height;
  }

  /**
   * 캔버스에 11개 피트니스 존과 신체 부위 포즈 렌더링
   */
  render(pattern: CatChoreoPattern | null, hoveredZoneId?: number | null): void {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    // 1. 배경 클리어 및 배경 그리드 렌더링
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0c16';
    ctx.fillRect(0, 0, w, h);

    // 은은한 그리드 라인
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 중앙 신체 가이드 라인
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.restore();

    // 2. 11개 피트니스 존 렌더링
    for (const zone of DEFAULT_FITNESS_ZONES) {
      this.renderZone(ctx, zone, w, h, pattern, hoveredZoneId === zone.id);
    }

    // 3. 신체 스켈레톤 연결선 (시각적 포즈 안내)
    if (pattern) {
      this.renderBodyGuideLines(ctx, pattern, w, h);
    }
  }

  /**
   * 단일 피트니스 존 사각형 및 라벨/부위 표시
   */
  private renderZone(
    ctx: CanvasRenderingContext2D,
    zone: FitnessZone,
    canvasW: number,
    canvasH: number,
    pattern: CatChoreoPattern | null,
    isHovered: boolean
  ): void {
    const zx = zone.x * canvasW;
    const zy = zone.y * canvasH;
    const zw = zone.width * canvasW;
    const zh = zone.height * canvasH;

    // 현재 존에 할당된 신체 부위 탐색
    const assignedParts: Array<{ label: string; color: string }> = [];

    if (pattern) {
      if (pattern.leftHand === zone.id) {
        assignedParts.push({ label: '왼손 (LH)', color: PART_COLORS.leftHand });
      }
      if (pattern.rightHand === zone.id) {
        assignedParts.push({ label: '오른손 (RH)', color: PART_COLORS.rightHand });
      }
      if (pattern.head === zone.id) {
        assignedParts.push({ label: '머리 (HD)', color: PART_COLORS.head });
      }
      if (pattern.hip === zone.id) {
        assignedParts.push({ label: '골반 (HP)', color: PART_COLORS.hip });
      }
      if (pattern.footZones?.includes(zone.id)) {
        assignedParts.push({ label: '발 (FT)', color: PART_COLORS.foot });
      }
    }

    const hasAssignment = assignedParts.length > 0;

    ctx.save();

    // 배경 채우기
    if (hasAssignment) {
      const primaryColor = assignedParts[0].color;
      ctx.fillStyle = primaryColor.replace(')', ', 0.15)').replace('rgb', 'rgba').replace('#', '');
      // hex to rgba fallback
      ctx.fillStyle = isHovered ? 'rgba(40, 230, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)';
    } else if (isHovered) {
      ctx.fillStyle = 'rgba(40, 230, 255, 0.12)';
    } else {
      ctx.fillStyle = 'rgba(22, 26, 42, 0.7)';
    }

    ctx.fillRect(zx, zy, zw, zh);

    // 테두리 스트로크
    if (hasAssignment) {
      ctx.strokeStyle = assignedParts[0].color;
      ctx.lineWidth = isHovered ? 3 : 2;
    } else if (isHovered) {
      ctx.strokeStyle = '#28E6FF';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
    }

    ctx.strokeRect(zx, zy, zw, zh);

    // 존 번호 및 기본 라벨 (좌상단)
    ctx.fillStyle = hasAssignment ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Zone ${zone.id} (${zone.label})`, zx + 8, zy + 8);

    // 할당된 부위 배지들 (중앙/하단)
    if (assignedParts.length > 0) {
      let badgeY = zy + 28;
      for (const part of assignedParts) {
        ctx.fillStyle = part.color;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`● ${part.label}`, zx + 8, badgeY);
        badgeY += 18;
      }
    }

    ctx.restore();
  }

  /**
   * 신체 부위 간 연결 안내선
   */
  private renderBodyGuideLines(
    ctx: CanvasRenderingContext2D,
    pattern: CatChoreoPattern,
    canvasW: number,
    canvasH: number
  ): void {
    const getZoneCenter = (zoneId: number | null): { x: number; y: number } | null => {
      if (zoneId === null) return null;
      const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId);
      if (!zone) return null;
      return {
        x: (zone.x + zone.width / 2) * canvasW,
        y: (zone.y + zone.height / 2) * canvasH,
      };
    };

    const headCenter = getZoneCenter(pattern.head);
    const hipCenter = getZoneCenter(pattern.hip);
    const lhCenter = getZoneCenter(pattern.leftHand);
    const rhCenter = getZoneCenter(pattern.rightHand);

    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    // 머리 -> 골반
    if (headCenter && hipCenter) {
      ctx.strokeStyle = 'rgba(200, 137, 255, 0.5)';
      ctx.beginPath();
      ctx.moveTo(headCenter.x, headCenter.y);
      ctx.lineTo(hipCenter.x, hipCenter.y);
      ctx.stroke();
    }

    // 골반 -> 왼손
    if (hipCenter && lhCenter) {
      ctx.strokeStyle = 'rgba(40, 230, 255, 0.5)';
      ctx.beginPath();
      ctx.moveTo(hipCenter.x, hipCenter.y);
      ctx.lineTo(lhCenter.x, lhCenter.y);
      ctx.stroke();
    }

    // 골반 -> 오른손
    if (hipCenter && rhCenter) {
      ctx.strokeStyle = 'rgba(255, 203, 77, 0.5)';
      ctx.beginPath();
      ctx.moveTo(hipCenter.x, hipCenter.y);
      ctx.lineTo(rhCenter.x, rhCenter.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 캔버스 좌표(px)가 어느 피트니스 존에 속하는지 판정
   */
  hitTestZone(canvasX: number, canvasY: number): number | null {
    const normX = canvasX / this._canvas.width;
    const normY = canvasY / this._canvas.height;

    for (const zone of DEFAULT_FITNESS_ZONES) {
      if (
        normX >= zone.x &&
        normX <= zone.x + zone.width &&
        normY >= zone.y &&
        normY <= zone.y + zone.height
      ) {
        return zone.id;
      }
    }
    return null;
  }
}
