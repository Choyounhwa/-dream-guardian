/**
 * NotePainters.ts - 모션 리듬 노트 모듈식 렌더링 Painter 인터페이스 및 구현체
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§7.2 Painter 인터페이스, §8 레이어별 책임)
 * @see Issue #479 [MRN-05]
 */

import type { MotionNoteRenderItem } from '../../types/motion-note.js';
import type {
  NoteRingProfile,
  NoteBodyProfile,
  NoteTrailProfile,
  NoteOverlayProfile,
} from '../../../config/motion-note-profile.config.js';

export type { NoteOverlayProfile };
import type { NoteAnchor } from '../NoteAnchorResolver.js';
import { CURSOR_COLORS } from '../../../config/cursor.config.js';
import { RUNNING_MAT_CONFIG } from '../../../config/running-mat.config.js';

// ============================================================================
// 1. 색상 매핑 헬퍼
// ============================================================================

/**
 * 신체 부위 및 발 레인별 대표 색상 매핑 순수 함수
 * - 손/머리/골반: 4색 신체 커서 색상 (#28E6FF, #FFCB4D, #C889FF, #FF865E)
 * - 발 3대 레인: 하단 매트 레인 색상 (#00E5FF, #FFD166, #FF8800)
 */
export function resolvePartColor(
  part: string | undefined,
  defaultColor: string = '#FFFFFF',
): string {
  if (!part) return defaultColor;

  switch (part) {
    case 'leftHand':
      return CURSOR_COLORS.leftHand ?? '#28E6FF';
    case 'rightHand':
      return CURSOR_COLORS.rightHand ?? '#FFCB4D';
    case 'head':
      return CURSOR_COLORS.head ?? '#C889FF';
    case 'shoulder':
      return CURSOR_COLORS.shoulder ?? '#C889FF';
    case 'hip':
      return CURSOR_COLORS.hip ?? '#FF865E';
    case 'foot':
      return CURSOR_COLORS.hip ?? '#FF865E';
    case 'leftFoot':
      return RUNNING_MAT_CONFIG.stompNoteLeftColor ?? '#00E5FF';
    case 'centerFoot':
      return RUNNING_MAT_CONFIG.stompNoteCenterColor ?? '#FFD166';
    case 'rightFoot':
      return RUNNING_MAT_CONFIG.stompNoteRightColor ?? '#FF8800';
    case 'bothFeet':
      return RUNNING_MAT_CONFIG.stompNoteCenterColor ?? '#FFD166';
    case 'fullBody':
      return '#FF4444';
    default:
      return defaultColor;
  }
}

/**
 * 발 레인 식별 문자 반환 ('L' | 'C' | 'R')
 */
export function resolveLaneLetter(part: string | undefined): string {
  switch (part) {
    case 'leftFoot':
      return 'L';
    case 'rightFoot':
      return 'R';
    case 'centerFoot':
      return 'C';
    case 'bothFeet':
      return 'J';
    case 'fullBody':
      return 'ALL';
    default:
      return 'C';
  }
}

// ============================================================================
// 2. Painter 인터페이스 (§7.2)
// ============================================================================

export interface RingPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    anchor: NoteAnchor,
    scale: number,
    style: NoteRingProfile,
    t: number,
    item?: MotionNoteRenderItem,
  ): void;
}

export interface BodyPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    style: NoteBodyProfile,
    item: MotionNoteRenderItem,
    anchor?: NoteAnchor,
  ): void;
}

export interface TrailPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    style: NoteTrailProfile,
    scale: number,
    item?: MotionNoteRenderItem,
  ): void;
}

export interface OverlayPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    anchor: NoteAnchor,
    item: MotionNoteRenderItem,
    params?: Record<string, number | string>,
  ): void;
}

// ============================================================================
// 3. Ring Painter 구현체들
// ============================================================================

/**
 * 원형 어프로치 링 렌더러 (circle)
 */
export class CircleRingPainter implements RingPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    anchor: NoteAnchor,
    scale: number,
    style: NoteRingProfile,
    _t: number,
    item?: MotionNoteRenderItem,
  ): void {
    const ringRadius = Math.max(1, anchor.radius * scale);
    const part = item?.requirements?.[0]?.part;
    const ringColor = style.color === 'byPart' ? resolvePartColor(part) : style.color;

    ctx.save();
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = Math.max(1, style.strokeWidth);
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = Math.max(0, style.glowBlur);
    ctx.globalAlpha = Math.max(0, Math.min(1, style.alpha));
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 사각형 어프로치 링 렌더러 (rect)
 */
export class RectRingPainter implements RingPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    anchor: NoteAnchor,
    scale: number,
    style: NoteRingProfile,
    _t: number,
    item?: MotionNoteRenderItem,
  ): void {
    const size = Math.max(2, anchor.radius * 2 * scale);
    const half = size * 0.5;
    const part = item?.requirements?.[0]?.part;
    const ringColor = style.color === 'byPart' ? resolvePartColor(part) : style.color;

    ctx.save();
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = Math.max(1, style.strokeWidth);
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = Math.max(0, style.glowBlur);
    ctx.globalAlpha = Math.max(0, Math.min(1, style.alpha));
    ctx.strokeRect(anchor.x - half, anchor.y - half, size, size);
    ctx.restore();
  }
}

// ============================================================================
// 4. Body Painter 구현체들
// ============================================================================

/**
 * 구형/네온 오브 바디 렌더러 (orb - 발 스톰프 노트 등)
 */
export class OrbBodyPainter implements BodyPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    style: NoteBodyProfile,
    item: MotionNoteRenderItem,
    _anchor?: NoteAnchor,
  ): void {
    const part = item.requirements?.[0]?.part;
    const borderColor =
      style.borderColor === 'byPart' ? resolvePartColor(part) : style.borderColor;
    const safeRadius = Math.max(1, radius);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, safeRadius, 0, Math.PI * 2);
    ctx.fillStyle = style.fillColor;
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1, 3 * (safeRadius / (style.baseRadius || 28)));
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 12;
    ctx.stroke();

    // 레인 문자 또는 심볼 렌더링
    if (style.showLaneLabel) {
      const laneLetter = resolveLaneLetter(part);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.max(10, Math.round(safeRadius * 0.85))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 4;
      ctx.fillText(laneLetter, x, y);
    } else if (style.symbol) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.max(10, Math.round(safeRadius * 0.85))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.symbol, x, y);
    }
    ctx.restore();
  }
}

/**
 * 텍스트 심볼 바디 렌더러 (symbol - '★', '♪', '⚠' 등)
 */
export class SymbolBodyPainter implements BodyPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    style: NoteBodyProfile,
    item: MotionNoteRenderItem,
    _anchor?: NoteAnchor,
  ): void {
    const part = item.requirements?.[0]?.part;
    const borderColor =
      style.borderColor === 'byPart' ? resolvePartColor(part) : style.borderColor;
    const safeRadius = Math.max(1, radius);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, safeRadius, 0, Math.PI * 2);
    ctx.fillStyle = style.fillColor;
    ctx.fill();

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1, 3 * (safeRadius / (style.baseRadius || 28)));
    ctx.shadowColor = borderColor;
    ctx.shadowBlur = 12;
    ctx.stroke();

    if (style.symbol) {
      ctx.fillStyle = borderColor;
      ctx.font = `bold ${Math.max(10, Math.round(safeRadius * 0.9))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 6;
      ctx.fillText(style.symbol, x, y);
    }
    ctx.restore();
  }
}

/**
 * 이미지 바디 렌더러 (image - 이미지 미제공/미로드 시 symbol 폴백)
 */
export class ImageBodyPainter implements BodyPainter {
  private readonly _imageProvider?: (key: string, item: MotionNoteRenderItem) => HTMLImageElement | null;
  private readonly _symbolFallback = new SymbolBodyPainter();

  constructor(imageProvider?: (key: string, item: MotionNoteRenderItem) => HTMLImageElement | null) {
    this._imageProvider = imageProvider;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    style: NoteBodyProfile,
    item: MotionNoteRenderItem,
    anchor?: NoteAnchor,
  ): void {
    const key = style.imageKey ?? item.requirements?.[0]?.part ?? 'default';
    const img = this._imageProvider ? this._imageProvider(key, item) : null;

    if (img && (img.complete !== false && img.naturalWidth !== 0)) {
      const safeRadius = Math.max(1, radius);
      const iconSize = safeRadius * 1.8;
      ctx.save();
      ctx.drawImage(img, x - iconSize * 0.5, y - iconSize * 0.5, iconSize, iconSize);
      ctx.restore();
      return;
    }

    // 폴백: SymbolBodyPainter 위임
    this._symbolFallback.draw(ctx, x, y, radius, style, item, anchor);
  }
}

/**
 * 위험 바닥/강타 해저드 스컬 렌더러 (hazardSkull)
 */
export class HazardSkullBodyPainter implements BodyPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    style: NoteBodyProfile,
    _item: MotionNoteRenderItem,
  ): void {
    const safeRadius = Math.max(1, radius);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, safeRadius, 0, Math.PI * 2);
    ctx.fillStyle = style.fillColor;
    ctx.fill();

    ctx.strokeStyle = style.borderColor === 'byPart' ? '#FF1E3C' : style.borderColor;
    ctx.lineWidth = Math.max(1.5, 4 * (safeRadius / (style.baseRadius || 36)));
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 14;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(10, Math.round(safeRadius * 0.85))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.symbol ?? '⚠', x, y);
    ctx.restore();
  }
}

/**
 * 수호신 방패 렌더러 (shield)
 */
export class ShieldBodyPainter implements BodyPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    style: NoteBodyProfile,
    _item: MotionNoteRenderItem,
  ): void {
    const safeRadius = Math.max(1, radius);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, safeRadius, 0, Math.PI * 2);
    ctx.fillStyle = style.fillColor;
    ctx.fill();

    ctx.strokeStyle = style.borderColor === 'byPart' ? '#28E6FF' : style.borderColor;
    ctx.lineWidth = Math.max(1.5, 3.5 * (safeRadius / (style.baseRadius || 30)));
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.max(10, Math.round(safeRadius * 0.8))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.symbol ?? '🛡', x, y);
    ctx.restore();
  }
}

// ============================================================================
// 5. Trail Painter 구현체들
// ============================================================================

/**
 * 직선 광선 빔 트레일 렌더러 (beam)
 */
export class BeamTrailPainter implements TrailPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    style: NoteTrailProfile,
    scale: number,
    item?: MotionNoteRenderItem,
  ): void {
    const part = item?.requirements?.[0]?.part;
    const color = resolvePartColor(part);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 4 * scale);
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = Math.max(0, Math.min(1, style.alpha));
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 그라디언트 페이드 트레일 렌더러 (gradient)
 */
export class GradientTrailPainter implements TrailPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    style: NoteTrailProfile,
    scale: number,
    item?: MotionNoteRenderItem,
  ): void {
    const part = item?.requirements?.[0]?.part;
    const color = resolvePartColor(part);

    ctx.save();
    const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, color);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1, 4 * scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, style.alpha));
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 트레일 없음 렌더러 (none)
 */
export class NoneTrailPainter implements TrailPainter {
  draw(
    _ctx?: CanvasRenderingContext2D,
    _from?: { x: number; y: number },
    _to?: { x: number; y: number },
    _style?: NoteTrailProfile,
    _scale?: number,
    _item?: MotionNoteRenderItem,
  ): void {
    // 아무것도 그리지 않음
  }
}

// ============================================================================
// 6. Overlay Painter 구현체
// ============================================================================

export class DefaultOverlayPainter implements OverlayPainter {
  draw(
    ctx: CanvasRenderingContext2D,
    anchor: NoteAnchor,
    item: MotionNoteRenderItem,
    params?: Record<string, number | string>,
  ): void {
    const intensity = typeof params?.pulseIntensity === 'number' ? params.pulseIntensity : 1.0;
    const part = item.requirements?.[0]?.part;
    const color = resolvePartColor(part);

    ctx.save();
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, anchor.radius * intensity, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================================
// 7. Painter 레지스트리 (Registry)
// ============================================================================

export class NotePainterRegistry {
  private readonly _ringPainters = new Map<string, RingPainter>();
  private readonly _bodyPainters = new Map<string, BodyPainter>();
  private readonly _trailPainters = new Map<string, TrailPainter>();
  private readonly _overlayPainters = new Map<string, OverlayPainter>();

  registerRing(key: string, painter: RingPainter): void {
    this._ringPainters.set(key, painter);
  }

  getRing(key: string): RingPainter | undefined {
    return this._ringPainters.get(key);
  }

  registerBody(key: string, painter: BodyPainter): void {
    this._bodyPainters.set(key, painter);
  }

  getBody(key: string): BodyPainter | undefined {
    return this._bodyPainters.get(key);
  }

  registerTrail(key: string, painter: TrailPainter): void {
    this._trailPainters.set(key, painter);
  }

  getTrail(key: string): TrailPainter | undefined {
    return this._trailPainters.get(key);
  }

  registerOverlay(key: string, painter: OverlayPainter): void {
    this._overlayPainters.set(key, painter);
  }

  getOverlay(key: string): OverlayPainter | undefined {
    return this._overlayPainters.get(key);
  }
}

/**
 * 기본 표준 Painter들이 모두 등록된 레지스트리 인스턴스를 생성
 */
export function createDefaultPainterRegistry(): NotePainterRegistry {
  const registry = new NotePainterRegistry();

  // Ring
  const circleRing = new CircleRingPainter();
  const rectRing = new RectRingPainter();
  registry.registerRing('circle', circleRing);
  registry.registerRing('rect', rectRing);

  // Body
  const orbBody = new OrbBodyPainter();
  const symbolBody = new SymbolBodyPainter();
  const imageBody = new ImageBodyPainter();
  const hazardBody = new HazardSkullBodyPainter();
  const shieldBody = new ShieldBodyPainter();

  registry.registerBody('orb', orbBody);
  registry.registerBody('symbol', symbolBody);
  registry.registerBody('image', imageBody);
  registry.registerBody('hazardSkull', hazardBody);
  registry.registerBody('shield', shieldBody);

  // 하위 호환 및 별칭 등록 (star, stomp)
  registry.registerBody('star', imageBody);
  registry.registerBody('stomp', orbBody);

  // Trail
  const beamTrail = new BeamTrailPainter();
  const gradientTrail = new GradientTrailPainter();
  const noneTrail = new NoneTrailPainter();

  registry.registerTrail('beam', beamTrail);
  registry.registerTrail('gradient', gradientTrail);
  registry.registerTrail('none', noneTrail);
  registry.registerTrail('stream', beamTrail);

  // Overlay
  const defaultOverlay = new DefaultOverlayPainter();
  registry.registerOverlay('default', defaultOverlay);
  registry.registerOverlay('pulse', defaultOverlay);

  return registry;
}
