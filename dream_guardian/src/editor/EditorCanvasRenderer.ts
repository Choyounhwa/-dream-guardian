/**
 * EditorCanvasRenderer.ts - 11개 피트니스 존 및 신체 포즈 실시간 캔버스 렌더러
 */

import { DEFAULT_FITNESS_ZONES, type FitnessZone } from '../../config/zone.config.js';
import type { CatChoreoPattern } from '../data/danceRoutineData.js';
import {
  CURSOR_RULES,
  type DetailedPoseValidationResult,
} from './PoseConstraintValidator.js';
import type { BodyCursorPart } from './PoseConstraintValidator.js';
import type { ActiveEditTool } from './EditorState.js';
import type { SimulatedPoseFrame } from './ChoreoPoseSimulator.js';

export const PART_COLORS = {
  leftHand: '#28E6FF',
  rightHand: '#FFCB4D',
  head: '#C889FF',
  hip: '#FF865E',
  foot: '#10B981',
} as const;

export interface DragState {
  part: BodyCursorPart | 'foot';
  x: number;
  y: number;
}

export interface CanvasRenderOptions {
  hoveredZoneId?: number | null;
  activeTool?: ActiveEditTool;
  validation?: DetailedPoseValidationResult;
  simulatedFrame?: SimulatedPoseFrame;
  showSkeleton?: boolean;
  dragState?: DragState | null;
}

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
  render(
    pattern: CatChoreoPattern | null,
    optionsOrHoveredZoneId?: CanvasRenderOptions | number | null
  ): void {
    const options: CanvasRenderOptions =
      typeof optionsOrHoveredZoneId === 'number' || optionsOrHoveredZoneId === null
        ? { hoveredZoneId: optionsOrHoveredZoneId }
        : optionsOrHoveredZoneId ?? {};

    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;
    const hoveredZoneId = options.hoveredZoneId ?? null;
    const activeTool = options.activeTool ?? 'inspect';
    const validation = options.validation;
    const simulatedFrame = options.simulatedFrame;
    const showSkeleton = options.showSkeleton ?? true;

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

    // 2. 활성 도구의 허용 존 계산
    let allowedZonesForTool: number[] | null = null;
    if (activeTool !== 'inspect') {
      if (activeTool === 'foot') {
        allowedZonesForTool = [9, 10, 11];
      } else {
        allowedZonesForTool = CURSOR_RULES[activeTool]?.allowedZones ?? [];
      }
    }

    // 3. 11개 피트니스 존 렌더링
    for (const zone of DEFAULT_FITNESS_ZONES) {
      const isAllowed = allowedZonesForTool ? allowedZonesForTool.includes(zone.id) : true;
      this.renderZone(
        ctx,
        zone,
        w,
        h,
        simulatedFrame?.activePattern ?? pattern,
        hoveredZoneId === zone.id,
        activeTool,
        isAllowed
      );
    }

    // 4. 실시간 활성 존 펄스 렌더링 (타깃 존 하이라이트)
    if (simulatedFrame && simulatedFrame.targetZones.length > 0) {
      this.renderActiveZonePulse(
        ctx,
        simulatedFrame.targetZones,
        w,
        h,
        simulatedFrame.isDip,
        simulatedFrame.activeNote
      );
    }

    // 5. 신체 스켈레톤 마네킹 또는 가이드라인 렌더링
    if (simulatedFrame && showSkeleton) {
      this.renderSkeletonMannequin(ctx, simulatedFrame, w, h);
      this.renderSimulationInfoOverlay(ctx, simulatedFrame, w, h);
    } else if (pattern) {
      this.renderBodyGuideLines(ctx, pattern, w, h);
    }

    // 6. Cross-Body 물리 제약 위반 경고선 및 배지 렌더링
    if (validation && !validation.valid) {
      this.renderValidationWarnings(ctx, validation, w, h);
    }

    // 7. 커서 드래그 앤 드롭 중인 경우 드래그 프리뷰 렌더링
    if (options.dragState) {
      this.renderDragPreview(ctx, options.dragState, hoveredZoneId, w, h);
    }

    // 8. 상단 활성 도구 인디케이터 배지
    this.renderActiveToolBadge(ctx, activeTool, w);
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
    isHovered: boolean,
    activeTool: ActiveEditTool,
    isAllowedForTool: boolean
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

    // 툴 선택 중 비허용 존인 경우 살짝 어둡게 처리
    if (activeTool !== 'inspect' && !isAllowedForTool) {
      ctx.globalAlpha = 0.35;
    }

    // 배경 채우기
    if (isHovered && isAllowedForTool) {
      ctx.fillStyle = 'rgba(40, 230, 255, 0.2)';
    } else if (hasAssignment) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    } else if (activeTool !== 'inspect' && isAllowedForTool) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    } else {
      ctx.fillStyle = 'rgba(22, 26, 42, 0.7)';
    }

    ctx.fillRect(zx, zy, zw, zh);

    // 테두리 스트로크
    if (hasAssignment) {
      ctx.strokeStyle = assignedParts[0].color;
      ctx.lineWidth = isHovered ? 3 : 2;
    } else if (isHovered && isAllowedForTool) {
      ctx.strokeStyle = '#28E6FF';
      ctx.lineWidth = 2;
    } else if (activeTool !== 'inspect' && isAllowedForTool) {
      // 허용된 존에 은은한 하이라이트
      ctx.strokeStyle = 'rgba(40, 230, 255, 0.5)';
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
    }

    ctx.strokeRect(zx, zy, zw, zh);

    // 존 번호 및 기본 라벨 (좌상단)
    ctx.fillStyle = hasAssignment ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Zone ${zone.id} (${zone.label})`, zx + 8, zy + 8);

    // 할당된 부위 배지들
    if (assignedParts.length > 0) {
      let badgeY = zy + 28;
      for (const part of assignedParts) {
        ctx.fillStyle = part.color;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`● ${part.label}`, zx + 8, badgeY);
        badgeY += 18;
      }
    }

    // 마우스 호버 시 활성 도구의 고스트 미리보기
    if (isHovered && activeTool !== 'inspect' && isAllowedForTool) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'italic 11px sans-serif';
      ctx.fillText(`클릭하여 [${this.getToolLabel(activeTool)}] 할당/해제`, zx + 8, zy + zh - 18);
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
      ctx.strokeStyle = 'rgba(200, 137, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(headCenter.x, headCenter.y);
      ctx.lineTo(hipCenter.x, hipCenter.y);
      ctx.stroke();
    }

    // 골반 -> 왼손
    if (hipCenter && lhCenter) {
      ctx.strokeStyle = 'rgba(40, 230, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(hipCenter.x, hipCenter.y);
      ctx.lineTo(lhCenter.x, lhCenter.y);
      ctx.stroke();
    }

    // 골반 -> 오른손
    if (hipCenter && rhCenter) {
      ctx.strokeStyle = 'rgba(255, 203, 77, 0.6)';
      ctx.beginPath();
      ctx.moveTo(hipCenter.x, hipCenter.y);
      ctx.lineTo(rhCenter.x, rhCenter.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 실시간 활성 존 펄스 렌더링 (비트 타깃 존 하이라이트)
   */
  private renderActiveZonePulse(
    ctx: CanvasRenderingContext2D,
    targetZones: number[],
    canvasW: number,
    canvasH: number,
    isDip: boolean,
    activeNote?: any
  ): void {
    ctx.save();
    for (const zoneId of targetZones) {
      const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId);
      if (!zone) continue;

      const zx = zone.x * canvasW;
      const zy = zone.y * canvasH;
      const zw = zone.width * canvasW;
      const zh = zone.height * canvasH;

      // 외곽 펄스 글로우
      ctx.strokeStyle = isDip ? '#FF865E' : '#FFCB4D';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = isDip ? '#FF865E' : '#FFCB4D';
      ctx.shadowBlur = 15;
      ctx.strokeRect(zx - 2, zy - 2, zw + 4, zh + 4);

      // 내부 은은한 채움
      ctx.fillStyle = isDip ? 'rgba(255, 134, 94, 0.2)' : 'rgba(255, 203, 77, 0.15)';
      ctx.fillRect(zx, zy, zw, zh);

      // 타깃 존 라벨
      ctx.fillStyle = isDip ? '#FF865E' : '#FFCB4D';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('TARGET ★', zx + zw - 8, zy + 8);

      // 활성 키노트 액션 라벨 (중앙 하단)
      if (activeNote && activeNote.label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`★ ${activeNote.label}`, zx + zw / 2, zy + zh - 6);
      }
    }
    ctx.restore();
  }

  /**
   * 실시간 포즈 스켈레톤 마네킹 렌더링
   */
  private renderSkeletonMannequin(
    ctx: CanvasRenderingContext2D,
    frame: SimulatedPoseFrame,
    canvasW: number,
    canvasH: number
  ): void {
    const jp = frame.jointPositions;
    const toPx = (pt: { x: number; y: number }) => ({
      x: pt.x * canvasW,
      y: pt.y * canvasH,
    });

    const headPx = toPx(jp.head);
    const hipPx = toPx(jp.hip);
    const lhPx = toPx(jp.leftHand);
    const rhPx = toPx(jp.rightHand);
    const lfPx = toPx(jp.leftFoot);
    const rfPx = toPx(jp.rightFoot);

    // 목/어깨 중심점
    const neckPx = {
      x: (headPx.x + hipPx.x) / 2,
      y: headPx.y + (hipPx.y - headPx.y) * 0.28,
    };

    ctx.save();

    // 1. 뼈대 연결선 (Bones)
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 척추: 머리 -> 목 -> 골반
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(headPx.x, headPx.y);
    ctx.lineTo(neckPx.x, neckPx.y);
    ctx.lineTo(hipPx.x, hipPx.y);
    ctx.stroke();

    // 왼팔: 목 -> 왼손
    ctx.strokeStyle = 'rgba(40, 230, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(neckPx.x, neckPx.y);
    ctx.lineTo(lhPx.x, lhPx.y);
    ctx.stroke();

    // 오른팔: 목 -> 오른손
    ctx.strokeStyle = 'rgba(255, 203, 77, 0.8)';
    ctx.beginPath();
    ctx.moveTo(neckPx.x, neckPx.y);
    ctx.lineTo(rhPx.x, rhPx.y);
    ctx.stroke();

    // 왼다리: 골반 -> 왼발
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
    ctx.beginPath();
    ctx.moveTo(hipPx.x, hipPx.y);
    ctx.lineTo(lfPx.x, lfPx.y);
    ctx.stroke();

    // 오른다리: 골반 -> 오른발
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
    ctx.beginPath();
    ctx.moveTo(hipPx.x, hipPx.y);
    ctx.lineTo(rfPx.x, rfPx.y);
    ctx.stroke();

    // 2. 관절 마커 (Joints)
    // 2.1 머리 (Cat Silhouette Head)
    ctx.fillStyle = PART_COLORS.head;
    ctx.shadowColor = PART_COLORS.head;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(headPx.x, headPx.y, 16, 0, Math.PI * 2);
    ctx.fill();

    // 고양이 귀 모양 (Cat Ears)
    ctx.fillStyle = '#E4BFFF';
    ctx.beginPath();
    ctx.moveTo(headPx.x - 14, headPx.y - 8);
    ctx.lineTo(headPx.x - 20, headPx.y - 24);
    ctx.lineTo(headPx.x - 4, headPx.y - 14);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(headPx.x + 14, headPx.y - 8);
    ctx.lineTo(headPx.x + 20, headPx.y - 24);
    ctx.lineTo(headPx.x + 4, headPx.y - 14);
    ctx.closePath();
    ctx.fill();

    // 2.2 골반 다이아몬드 (Hip Diamond)
    ctx.fillStyle = PART_COLORS.hip;
    ctx.shadowColor = PART_COLORS.hip;
    ctx.shadowBlur = 12;
    const dSize = 14;
    ctx.beginPath();
    ctx.moveTo(hipPx.x, hipPx.y - dSize);
    ctx.lineTo(hipPx.x + dSize, hipPx.y);
    ctx.lineTo(hipPx.x, hipPx.y + dSize);
    ctx.lineTo(hipPx.x - dSize, hipPx.y);
    ctx.closePath();
    ctx.fill();

    // 2.3 왼손 / 오른손
    ctx.fillStyle = PART_COLORS.leftHand;
    ctx.shadowColor = PART_COLORS.leftHand;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(lhPx.x, lhPx.y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PART_COLORS.rightHand;
    ctx.shadowColor = PART_COLORS.rightHand;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(rhPx.x, rhPx.y, 12, 0, Math.PI * 2);
    ctx.fill();

    // 2.4 발 (Feet)
    ctx.fillStyle = PART_COLORS.foot;
    ctx.shadowColor = PART_COLORS.foot;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(lfPx.x, lfPx.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rfPx.x, rfPx.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 실시간 안무 액션/바운스 상태 오버레이 (Bottom Center)
   */
  private renderSimulationInfoOverlay(
    ctx: CanvasRenderingContext2D,
    frame: SimulatedPoseFrame,
    canvasW: number,
    canvasH: number
  ): void {
    ctx.save();
    const actionLabel = frame.isDip ? '🔻 DOWNSQUAT DIP' : '🔺 REBOUND & BOUNCE';
    const patternName = frame.activePattern.name;
    const noteLabel = frame.activeNote ? `[${frame.activeNote.label}]` : '';

    const text = `${patternName}  |  ${actionLabel} ${noteLabel}`;
    ctx.font = 'bold 12px sans-serif';
    const textW = ctx.measureText ? ctx.measureText(text).width : 200;
    const pad = 12;
    const boxW = textW + pad * 2;
    const boxH = 26;
    const boxX = (canvasW - boxW) / 2;
    const boxY = canvasH - boxH - 12;

    ctx.fillStyle = 'rgba(10, 12, 22, 0.85)';
    ctx.strokeStyle = frame.isDip ? '#FF865E' : '#28E6FF';
    ctx.lineWidth = 1.5;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = frame.isDip ? '#FF865E' : '#28E6FF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvasW / 2, boxY + boxH / 2);

    ctx.restore();
  }

  /**
   * 물리 제약 위반 경고 시각화 (Cross-Body 경고선 및 상단 경고 팝업)
   */
  private renderValidationWarnings(
    ctx: CanvasRenderingContext2D,
    validation: DetailedPoseValidationResult,
    canvasW: number,
    canvasH: number
  ): void {
    const getZoneCenter = (zoneId: number): { x: number; y: number } | null => {
      const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId);
      if (!zone) return null;
      return {
        x: (zone.x + zone.width / 2) * canvasW,
        y: (zone.y + zone.height / 2) * canvasH,
      };
    };

    ctx.save();

    // 1. Cross-Body 위반 연결선 (강렬한 빨간 점선)
    for (const line of validation.crossBodyViolationLines) {
      const handPos = getZoneCenter(line.handZone);
      const hipPos = getZoneCenter(line.hipZone);
      if (handPos && hipPos) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(handPos.x, handPos.y);
        ctx.lineTo(hipPos.x, hipPos.y);
        ctx.stroke();

        // 중앙 경고 텍스트
        const midX = (handPos.x + hipPos.x) / 2;
        const midY = (handPos.y + hipPos.y) / 2;
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠ CROSS-BODY 위반', midX, midY - 10);
      }
    }

    // 2. 상단 경고 바
    const firstViolation = validation.violations[0];
    if (firstViolation) {
      const barH = 26;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fillRect(0, 0, canvasW, barH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚠️ ${firstViolation.message}`, canvasW / 2, barH / 2);
    }

    ctx.restore();
  }

  /**
   * 상단 우측 현재 활성 도구 인디케이터 배지
   */
  private renderActiveToolBadge(
    ctx: CanvasRenderingContext2D,
    activeTool: ActiveEditTool,
    canvasW: number
  ): void {
    ctx.save();
    const label = `현재 도구: [${this.getToolLabel(activeTool)}]`;
    ctx.font = 'bold 12px sans-serif';
    const textW = ctx.measureText ? ctx.measureText(label).width : 120;
    const badgeW = textW + 20;
    const badgeH = 24;
    const x = canvasW - badgeW - 12;
    const y = 8;

    ctx.fillStyle = 'rgba(20, 24, 38, 0.85)';
    ctx.strokeStyle = this.getToolColor(activeTool);
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, badgeW, badgeH);
    ctx.strokeRect(x, y, badgeW, badgeH);

    ctx.fillStyle = this.getToolColor(activeTool);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + badgeW / 2, y + badgeH / 2);
    ctx.restore();
  }

  private getToolLabel(tool: ActiveEditTool): string {
    switch (tool) {
      case 'leftHand':
        return '왼손 (#28E6FF)';
      case 'rightHand':
        return '오른손 (#FFCB4D)';
      case 'head':
        return '머리 (#C889FF)';
      case 'hip':
        return '골반 (#FF865E)';
      case 'foot':
        return '발 디딤 (#10B981)';
      case 'inspect':
      default:
        return '선택/조회 (Inspect)';
    }
  }

  private getToolColor(tool: ActiveEditTool): string {
    switch (tool) {
      case 'leftHand':
        return PART_COLORS.leftHand;
      case 'rightHand':
        return PART_COLORS.rightHand;
      case 'head':
        return PART_COLORS.head;
      case 'hip':
        return PART_COLORS.hip;
      case 'foot':
        return PART_COLORS.foot;
      case 'inspect':
      default:
        return '#8e9bb5';
    }
  }

  /**
   * 커서 드래그 앤 드롭 이동 중 시각 피드백 렌더링
   */
  private renderDragPreview(
    ctx: CanvasRenderingContext2D,
    drag: DragState,
    hoveredZoneId: number | null,
    canvasW: number,
    canvasH: number
  ): void {
    const color = this.getToolColor(drag.part);
    ctx.save();

    // 테더 연결선 (몸체 중심 -> 드래그 커서)
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(canvasW / 2, canvasH * 0.55);
    ctx.lineTo(drag.x, drag.y);
    ctx.stroke();

    // 드래그 중인 커서 원형 핸들
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(drag.x, drag.y, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 커서 명칭 라벨
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const label = `${this.getToolLabel(drag.part)} ${hoveredZoneId ? `➔ Zone ${hoveredZoneId}` : ''}`;
    ctx.fillText(label, drag.x, drag.y - 24);

    ctx.restore();
  }

  /**
   * 캔버스 좌표(px)가 특정 신체 커서(머리, 왼손, 오른손, 골반, 발) 근처인지 판정
   */
  hitTestCursor(
    canvasX: number,
    canvasY: number,
    pattern?: CatChoreoPattern | null,
    simulatedFrame?: SimulatedPoseFrame | null
  ): BodyCursorPart | 'foot' | null {
    const w = this._canvas.width;
    const h = this._canvas.height;
    const hitRadius = 35; // 클릭 판정 반경

    const getZoneCenterPx = (zoneId: number | null | undefined): { x: number; y: number } | null => {
      if (zoneId === null || zoneId === undefined) return null;
      const z = DEFAULT_FITNESS_ZONES.find((zone) => zone.id === zoneId);
      if (!z) return null;
      return {
        x: (z.x + z.width / 2) * w,
        y: (z.y + z.height / 2) * h,
      };
    };

    let headPt = { x: 0.5 * w, y: 0.2 * h };
    let hipPt = { x: 0.5 * w, y: 0.65 * h };
    let lhPt = { x: 0.35 * w, y: 0.5 * h };
    let rhPt = { x: 0.65 * w, y: 0.5 * h };
    let lfPt = { x: 0.38 * w, y: 0.86 * h };
    let rfPt = { x: 0.62 * w, y: 0.86 * h };

    if (simulatedFrame) {
      headPt = { x: simulatedFrame.jointPositions.head.x * w, y: simulatedFrame.jointPositions.head.y * h };
      hipPt = { x: simulatedFrame.jointPositions.hip.x * w, y: simulatedFrame.jointPositions.hip.y * h };
      lhPt = { x: simulatedFrame.jointPositions.leftHand.x * w, y: simulatedFrame.jointPositions.leftHand.y * h };
      rhPt = { x: simulatedFrame.jointPositions.rightHand.x * w, y: simulatedFrame.jointPositions.rightHand.y * h };
      lfPt = { x: simulatedFrame.jointPositions.leftFoot.x * w, y: simulatedFrame.jointPositions.leftFoot.y * h };
      rfPt = { x: simulatedFrame.jointPositions.rightFoot.x * w, y: simulatedFrame.jointPositions.rightFoot.y * h };
    } else if (pattern) {
      headPt = getZoneCenterPx(pattern.head) ?? headPt;
      hipPt = getZoneCenterPx(pattern.hip) ?? hipPt;
      lhPt = getZoneCenterPx(pattern.leftHand) ?? lhPt;
      rhPt = getZoneCenterPx(pattern.rightHand) ?? rhPt;
      if (pattern.footZones && pattern.footZones.length > 0) {
        if (pattern.footZones.includes(9)) lfPt = getZoneCenterPx(9) ?? lfPt;
        if (pattern.footZones.includes(11)) rfPt = getZoneCenterPx(11) ?? rfPt;
        if (pattern.footZones.includes(10)) {
          const z10 = getZoneCenterPx(10);
          if (z10) {
            lfPt = { x: z10.x - 0.06 * w, y: z10.y };
            rfPt = { x: z10.x + 0.06 * w, y: z10.y };
          }
        }
      }
    }

    const dist = (p: { x: number; y: number }) => Math.hypot(canvasX - p.x, canvasY - p.y);

    // 판정 우선순위: 손 -> 머리 -> 골반 -> 발 (패턴에 존이 실제 할당되어 있거나 시뮬레이션 프레임이 있는 경우만)
    if (simulatedFrame) {
      if (dist(lhPt) <= hitRadius) return 'leftHand';
      if (dist(rhPt) <= hitRadius) return 'rightHand';
      if (dist(headPt) <= hitRadius) return 'head';
      if (dist(hipPt) <= hitRadius) return 'hip';
      if (dist(lfPt) <= hitRadius || dist(rfPt) <= hitRadius) return 'foot';
    } else if (pattern) {
      if (pattern.leftHand !== null && pattern.leftHand !== undefined) {
        const pt = getZoneCenterPx(pattern.leftHand);
        if (pt && dist(pt) <= hitRadius) return 'leftHand';
      }
      if (pattern.rightHand !== null && pattern.rightHand !== undefined) {
        const pt = getZoneCenterPx(pattern.rightHand);
        if (pt && dist(pt) <= hitRadius) return 'rightHand';
      }
      if (pattern.head !== null && pattern.head !== undefined) {
        const pt = getZoneCenterPx(pattern.head);
        if (pt && dist(pt) <= hitRadius) return 'head';
      }
      if (pattern.hip !== null && pattern.hip !== undefined) {
        const pt = getZoneCenterPx(pattern.hip);
        if (pt && dist(pt) <= hitRadius) return 'hip';
      }
      if (pattern.footZones && pattern.footZones.length > 0) {
        for (const fz of pattern.footZones) {
          const pt = getZoneCenterPx(fz);
          if (pt && dist(pt) <= hitRadius) return 'foot';
        }
      }
    }

    return null;
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
