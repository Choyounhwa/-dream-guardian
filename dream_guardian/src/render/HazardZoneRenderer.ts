/**
 * HazardZoneRenderer - 3D 원근 그리드 바닥 보스 장판 렌더러
 *
 * Issue #228 (RENDER-HAZARD-001):
 * - 화면 중앙 고정 평면 타원을 소실점에서 전경으로 밀려오는 3D 원근 바닥 장판으로 개편
 * - PhaseAHazardController의 5종 회피 패턴별 차별화된 3D 레인 시각 효과 제공
 *   1. jump: 소실점에서 전경까지 전 레인을 덮으며 확산하는 붉은 충격파 파동 링 (#FF865E)
 *   2. left_step: 좌측 레인(Zone 9 방향)을 타고 소실점에서 전경으로 밀려오는 위험 네온 띠 (#28E6FF)
 *   3. right_step: 우측 레인(Zone 11 방향)을 타고 소실점에서 전경으로 밀려오는 위험 네온 띠 (#FFCB4D)
 *   4. balance_left / balance_right: 외발 지탱 구역 점등 및 반대편 위험 레인 가시 펄스 (#C889FF)
 */

import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';
import { depthRatioFromY, laneToScreenX } from './GridProjection.js';
import { MotionNoteRenderer } from './MotionNoteRenderer.js';
import { createDefaultPainterRegistry } from './note-painters/NotePainters.js';
import {
  DEFAULT_NOTE_PROFILES,
  HAZARD_FLOOR_PROFILE,
} from '../../config/motion-note-profile.config.js';
import { hazardPatternToRenderItem } from '../game/adapters/hazardAdapter.js';

export interface HazardBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface HazardSlotOverride {
  text?: string;
  color?: string;
  textColor?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  glowColor?: string;
  fontSize?: number;
  visible?: boolean;
  opacity?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface HazardPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  hazardWarning?: HazardSlotOverride;
  hazardStyle?: HazardSlotOverride;
  timingGuide?: HazardSlotOverride;
  safeZoneHighlight?: HazardSlotOverride;
}

export const HAZARD_ZONE_SLOT_IDS = [
  'hazardWarning',
  'hazardStyle',
  'timingGuide',
  'safeZoneHighlight',
] as const;

export const PROTECTED_HAZARD_ZONE_SLOT_IDS = [
  'hazard_geometry',
  'timing_ring_physics',
  'lane_evasion_zones',
  'projection_matrix',
] as const;

export interface HazardFixtureDTO {
  pattern: PhaseAHazardPattern;
  beatProgress: number; // 0.0 ~ 1.0
  status?: 'warning' | 'active' | 'safe' | 'hit';
  isResolved?: boolean;
  isEvaded?: boolean;
  vanishingPoint?: { x: number; y: number };
  presentationContext?: HazardPresentationContext;
  warningText?: string;
  guideText?: string;
}

export const DEFAULT_HAZARD_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'jump',
  beatProgress: 0.5,
  status: 'warning',
});

export const JUMP_HAZARD_WARNING_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'jump',
  beatProgress: 0.6,
  status: 'warning',
});

export const JUMP_HAZARD_ACTIVE_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'jump',
  beatProgress: 0.95,
  status: 'active',
});

export const JUMP_HAZARD_SAFE_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'jump',
  beatProgress: 1.0,
  status: 'safe',
  isResolved: true,
  isEvaded: true,
});

export const JUMP_HAZARD_HIT_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'jump',
  beatProgress: 1.0,
  status: 'hit',
  isResolved: true,
  isEvaded: false,
});

export const LEFT_STEP_HAZARD_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'left_step',
  beatProgress: 0.85,
  status: 'active',
});

export const RIGHT_STEP_HAZARD_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'right_step',
  beatProgress: 0.85,
  status: 'active',
});

export const BALANCE_LEFT_HAZARD_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'balance_left',
  beatProgress: 0.85,
  status: 'active',
});

export const BALANCE_RIGHT_HAZARD_FIXTURE: HazardFixtureDTO = Object.freeze({
  pattern: 'balance_right',
  beatProgress: 0.85,
  status: 'active',
});

export interface HazardRenderState {
  activePattern: PhaseAHazardPattern | null;
  beatProgress: number; // 0.0 ~ 1.0
  vanishingX: number;
  vanishingY: number;
  isResolved?: boolean;
  isEvaded?: boolean;
}

export class HazardZoneRenderer {
  public readonly motionNoteRenderer: MotionNoteRenderer;
  private _presentationContext?: HazardPresentationContext;

  constructor(
    motionNoteRenderer?: MotionNoteRenderer,
    presentationContext?: HazardPresentationContext,
  ) {
    this.motionNoteRenderer =
      motionNoteRenderer ?? this._createMotionNoteRenderer();
    if (presentationContext) {
      this._presentationContext = presentationContext;
    }
  }

  /**
   * HazardZoneRenderer용 기본 MotionNoteRenderer 인스턴스 생성
   */
  private _createMotionNoteRenderer(): MotionNoteRenderer {
    const registry = createDefaultPainterRegistry();
    registry.registerBody('hazardSkull', {
      draw(ctx, x, y, radius, style) {
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
        // A11Y-001: 접근성 최소 폰트 하한선 24px 보장
        const fontSize = Math.max(24, Math.round(safeRadius * 0.85));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(style.symbol ?? '⚠', x, y);
        ctx.restore();
      },
    });

    return new MotionNoteRenderer({
      registry,
      profiles: {
        ...DEFAULT_NOTE_PROFILES,
        hazard_floor: HAZARD_FLOOR_PROFILE,
      },
    });
  }
  /**
   * 박자 진행도(beatProgress)에 따른 장판 전방 도달 Y 좌표 계산
   * @param beatProgress 0.0(소실점) ~ 1.0(전경 발밑)
   * @param vanishingY 소실점 Y 좌표
   * @param vh 화면 가상 높이
   */
  computeHazardFrontY(beatProgress: number, vanishingY: number, vh: number): number {
    const floorH = Math.max(0, vh - vanishingY);
    const p = Math.max(0, Math.min(1.0, beatProgress));
    // 원근 가속(p^1.5)을 적용하여 소실점에서 전경(화면 92% 높이)까지 자연스럽게 도달
    return vanishingY + floorH * 0.92 * Math.pow(p, 1.5);
  }

  /**
   * 박자 진행도(beatProgress: 0.0 ~ 1.0)에 동기화되어 전경 위험 발판 지점으로 수축하는 배율 계산
   * - 진행도 0.0일 때 발판 반경의 2.5배 -> 1.0 도달 시 정확히 1.0배로 수축 (Issue #286)
   */
  computeTimingRingScale(progress: number): number {
    const p = Math.max(0, Math.min(1.0, progress));
    return 2.5 - 1.5 * p;
  }

  setPresentationContext(context?: HazardPresentationContext): void {
    this._presentationContext = context;
  }

  getPresentationContext(): HazardPresentationContext | undefined {
    return this._presentationContext;
  }

  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'hazard_evade',
  ): HazardPresentationContext {
    const page = doc.pages[pageId as UIPresentationPageId];
    let hazardWarning: HazardSlotOverride | undefined;
    let hazardStyle: HazardSlotOverride | undefined;
    let timingGuide: HazardSlotOverride | undefined;

    if (page?.elements) {
      for (const el of page.elements) {
        if (el.id === 'hazard_warning') {
          hazardWarning = {
            text: el.text,
            fontSize: el.fontSize,
            color: '#FF1E3C',
          };
        }
      }
    }

    if (!hazardWarning) {
      hazardWarning = {
        text: '위험! 장판을 회피하세요!',
        fontSize: 40,
        color: '#FF1E3C',
      };
    }

    return {
      presentationDocument: doc,
      pageId,
      hazardWarning,
      hazardStyle,
      timingGuide,
    };
  }

  getHazardZoneBounds(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: { x: number; y: number },
  ): HazardBounds {
    const vx = vanishingPoint?.x ?? vw / 2;
    const vy = vanishingPoint?.y ?? vh * 0.24;
    const floorH = Math.max(1, vh - vy);
    const targetY = vy + floorH * 0.92;
    let targetX = vx;
    let baseRx = vw * 0.40;
    let baseRy = baseRx * 0.26;

    switch (pattern) {
      case 'jump':
        targetX = vx;
        baseRx = vw * 0.40;
        baseRy = baseRx * 0.26;
        break;
      case 'left_step':
        targetX = laneToScreenX(vx, -vw * 0.35, 1.0);
        baseRx = vw * 0.16;
        baseRy = baseRx * 0.30;
        break;
      case 'right_step':
        targetX = laneToScreenX(vx, vw * 0.35, 1.0);
        baseRx = vw * 0.16;
        baseRy = baseRx * 0.30;
        break;
      case 'balance_left':
        targetX = laneToScreenX(vx, vw * 0.35, 1.0);
        baseRx = vw * 0.18;
        baseRy = baseRx * 0.28;
        break;
      case 'balance_right':
        targetX = laneToScreenX(vx, -vw * 0.35, 1.0);
        baseRx = vw * 0.18;
        baseRy = baseRx * 0.28;
        break;
    }

    const x = targetX - baseRx;
    const y = targetY - baseRy;
    const w = baseRx * 2;
    const h = baseRy * 2;

    return {
      x,
      y,
      w,
      h,
      width: w,
      height: h,
      isProtected: true,
    };
  }

  getWarningLabelBounds(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: { x: number; y: number },
  ): HazardBounds {
    const hz = this.getHazardZoneBounds(pattern, vw, vh, vanishingPoint);
    const w = Math.min(vw * 0.8, 432 * (vw / 1080));
    const h = 80 * (vh / 2160);
    const x = hz.x + hz.w / 2 - w / 2;
    const y = Math.max(20, hz.y - h - 30);

    return {
      x,
      y,
      w,
      h,
      width: w,
      height: h,
      isProtected: false,
    };
  }

  getTimingRingBounds(
    pattern: PhaseAHazardPattern,
    progress: number,
    vw: number,
    vh: number,
    vanishingPoint?: { x: number; y: number },
  ): HazardBounds {
    const vx = vanishingPoint?.x ?? vw / 2;
    const vy = vanishingPoint?.y ?? vh * 0.24;
    const floorH = Math.max(1, vh - vy);
    const targetY = vy + floorH * 0.92;
    let targetX = vx;
    let baseRx = vw * 0.40;
    let baseRy = baseRx * 0.26;

    switch (pattern) {
      case 'jump':
        targetX = vx;
        baseRx = vw * 0.40;
        baseRy = baseRx * 0.26;
        break;
      case 'left_step':
        targetX = laneToScreenX(vx, -vw * 0.35, 1.0);
        baseRx = vw * 0.16;
        baseRy = baseRx * 0.30;
        break;
      case 'right_step':
        targetX = laneToScreenX(vx, vw * 0.35, 1.0);
        baseRx = vw * 0.16;
        baseRy = baseRx * 0.30;
        break;
      case 'balance_left':
        targetX = laneToScreenX(vx, vw * 0.35, 1.0);
        baseRx = vw * 0.18;
        baseRy = baseRx * 0.28;
        break;
      case 'balance_right':
        targetX = laneToScreenX(vx, -vw * 0.35, 1.0);
        baseRx = vw * 0.18;
        baseRy = baseRx * 0.28;
        break;
    }

    const scale = this.computeTimingRingScale(progress);
    const ringRx = baseRx * scale;
    const ringRy = baseRy * scale;
    const x = targetX - ringRx;
    const y = targetY - ringRy;
    const w = ringRx * 2;
    const h = ringRy * 2;

    return {
      x,
      y,
      w,
      h,
      width: w,
      height: h,
      isProtected: true,
    };
  }

  getSafeZoneBounds(
    pattern: PhaseAHazardPattern,
    vw: number,
    vh: number,
    vanishingPoint?: { x: number; y: number },
  ): HazardBounds {
    const vx = vanishingPoint?.x ?? vw / 2;
    const vy = vanishingPoint?.y ?? vh * 0.24;
    const floorH = Math.max(1, vh - vy);
    const targetY = vy + floorH * 0.92;

    let safeX = vx;
    let safeRx = vw * 0.16;
    let safeRy = safeRx * 0.30;

    switch (pattern) {
      case 'jump': {
        const jb = this.getHazardZoneBounds('jump', vw, vh, vanishingPoint);
        return {
          x: jb.x,
          y: Math.max(0, jb.y - jb.h * 1.5),
          w: jb.w,
          h: jb.h,
          width: jb.w,
          height: jb.h,
          isProtected: true,
        };
      }
      case 'left_step':
        safeX = laneToScreenX(vx, vw * 0.35, 1.0);
        safeRx = vw * 0.16;
        safeRy = safeRx * 0.30;
        break;
      case 'right_step':
        safeX = laneToScreenX(vx, -vw * 0.35, 1.0);
        safeRx = vw * 0.16;
        safeRy = safeRx * 0.30;
        break;
      case 'balance_left':
        safeX = laneToScreenX(vx, -vw * 0.35, 1.0);
        safeRx = vw * 0.18;
        safeRy = safeRx * 0.28;
        break;
      case 'balance_right':
        safeX = laneToScreenX(vx, vw * 0.35, 1.0);
        safeRx = vw * 0.18;
        safeRy = safeRx * 0.28;
        break;
    }

    const x = safeX - safeRx;
    const y = targetY - safeRy;
    const w = safeRx * 2;
    const h = safeRy * 2;

    return {
      x,
      y,
      w,
      h,
      width: w,
      height: h,
      isProtected: true,
    };
  }

  isSlotLocked(slotId: string): boolean {
    return (PROTECTED_HAZARD_ZONE_SLOT_IDS as readonly string[]).includes(slotId as (typeof PROTECTED_HAZARD_ZONE_SLOT_IDS)[number]);
  }

  getSlotLockReason(slotId: string): string | null {
    if ((PROTECTED_HAZARD_ZONE_SLOT_IDS as readonly string[]).includes(slotId as (typeof PROTECTED_HAZARD_ZONE_SLOT_IDS)[number])) {
      return `장판 물리 좌표 및 판정 기하(${slotId})는 게임플레이 무결성을 위해 보호됩니다.`;
    }
    return null;
  }

  validatePresentationContext(context?: HazardPresentationContext): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    if (!context) return { valid: true, issues };

    const slotsToCheck: (keyof HazardPresentationContext)[] = [
      'hazardWarning',
      'hazardStyle',
      'timingGuide',
      'safeZoneHighlight',
    ];

    for (const key of slotsToCheck) {
      const override = context[key] as HazardSlotOverride | undefined;
      if (override) {
        if (
          override.x !== undefined ||
          override.y !== undefined ||
          override.w !== undefined ||
          override.h !== undefined
        ) {
          issues.push(
            `슬롯 '${key}'에 대한 물리적 좌표(x, y, w, h) 변조는 거부됩니다. 장판 물리 기하는 보호 영역입니다.`,
          );
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  renderFixture(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    fixture: HazardFixtureDTO,
  ): void {
    const prevContext = this._presentationContext;
    if (fixture.presentationContext) {
      this._presentationContext = fixture.presentationContext;
    }

    try {
      const vx = fixture.vanishingPoint?.x ?? vw / 2;
      const vy = fixture.vanishingPoint?.y ?? vh * 0.24;

      const isResolved =
        fixture.isResolved ??
        (fixture.status === 'safe' || fixture.status === 'hit');
      const isEvaded =
        fixture.isEvaded ?? (fixture.status === 'safe');

      const state: HazardRenderState = {
        activePattern: fixture.pattern,
        beatProgress: fixture.beatProgress,
        vanishingX: vx,
        vanishingY: vy,
        isResolved,
        isEvaded,
      };

      this.render(ctx, vw, vh, state);
    } finally {
      this._presentationContext = prevContext;
    }
  }

  static renderFixture(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    fixture: HazardFixtureDTO,
  ): void {
    const renderer = new HazardZoneRenderer();
    renderer.renderFixture(ctx, vw, vh, fixture);
  }

  /**
   * 3D 원근 바닥 장판 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    state: HazardRenderState,
  ): void {
    if (!state.activePattern) return;

    const vx = state.vanishingX;
    const vy = state.vanishingY;
    const floorH = Math.max(1, vh - vy);
    const p = Math.max(0, Math.min(1.0, state.beatProgress));
    const frontY = this.computeHazardFrontY(p, vy, vh);
    const depthRatio = depthRatioFromY(frontY, vy, floorH);

    ctx.save();

    switch (state.activePattern) {
      case 'jump':
        this._renderJumpShockwave(ctx, vw, vh, vx, vy, frontY, depthRatio, p, state.isResolved, state.isEvaded);
        break;
      case 'left_step':
        this._renderStepLaneHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, 'left', state.isResolved, state.isEvaded);
        break;
      case 'right_step':
        this._renderStepLaneHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, 'right', state.isResolved, state.isEvaded);
        break;
      case 'balance_left':
        this._renderBalanceHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, 'left', state.isResolved, state.isEvaded);
        break;
      case 'balance_right':
        this._renderBalanceHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, 'right', state.isResolved, state.isEvaded);
        break;
    }

    // Issue #286: 전경 발판 수축 타이밍 서클 및 임팩트 직전 가이드 렌더링
    if (!state.isResolved) {
      this._renderTimingCircle(ctx, vw, vh, vx, vy, floorH, state.activePattern, p);
      // Issue #484 (MRN-10): 상공 비행 투사체 렌더링 MotionNoteRenderer 위임
      this.renderFlyingProjectile(ctx, vw, vh, state);
    }

    if (
      this._presentationContext?.hazardWarning?.visible !== false &&
      this._presentationContext?.hazardWarning?.text
    ) {
      this._renderWarningBanner(ctx, vw, vh, this._presentationContext.hazardWarning);
    }

    ctx.restore();
  }

  /**
   * 상공 비행 투사체 렌더링 위임 (MotionNoteRenderer: hazard_floor 프로필)
   * Issue #484 [MRN-10]
   */
  public renderFlyingProjectile(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    state: HazardRenderState,
  ): void {
    if (!state.activePattern) return;

    const originalStrokeStyle = ctx.strokeStyle;
    const originalFillStyle = ctx.fillStyle;

    const renderItem = hazardPatternToRenderItem(
      state.activePattern,
      state.beatProgress,
      {
        isResolved: state.isResolved,
        isEvaded: state.isEvaded,
      },
    );

    this.motionNoteRenderer.render(
      ctx,
      [renderItem],
      { width: vw, height: vh },
      { x: state.vanishingX, y: state.vanishingY },
    );

    if (originalStrokeStyle) {
      ctx.strokeStyle = originalStrokeStyle;
    }
    if (originalFillStyle) {
      ctx.fillStyle = originalFillStyle;
    }
  }

  /**
   * 바닥 발판 수축 타이밍 서클(Timing Circle) 및 타이밍 유도 가이드 렌더링 (Issue #286)
   */
  private _renderTimingCircle(
    ctx: CanvasRenderingContext2D,
    vw: number,
    _vh: number,
    vx: number,
    vy: number,
    floorH: number,
    pattern: PhaseAHazardPattern,
    progress: number,
  ): void {
    const targetY = vy + floorH * 0.92;
    let targetX = vx;
    let baseRx = vw * 0.40;
    let baseRy = baseRx * 0.26;
    let guideText = '지금 점프!';

    switch (pattern) {
      case 'jump':
        targetX = vx;
        baseRx = vw * 0.40;
        baseRy = baseRx * 0.26;
        guideText = '지금 점프!';
        break;
      case 'left_step':
        targetX = laneToScreenX(vx, -vw * 0.35, 1.0);
        baseRx = vw * 0.16;
        baseRy = baseRx * 0.30;
        guideText = '지금 스텝!';
        break;
      case 'right_step':
        targetX = laneToScreenX(vx, vw * 0.35, 1.0);
        baseRx = vw * 0.16;
        baseRy = baseRx * 0.30;
        guideText = '지금 스텝!';
        break;
      case 'balance_left':
        // 안전 구역: 좌측(-0.35), 위험 구역: 우측(0.35)
        targetX = laneToScreenX(vx, vw * 0.35, 1.0);
        baseRx = vw * 0.18;
        baseRy = baseRx * 0.28;
        guideText = '지금 스텝!';
        break;
      case 'balance_right':
        // 안전 구역: 우측(0.35), 위험 구역: 좌측(-0.35)
        targetX = laneToScreenX(vx, -vw * 0.35, 1.0);
        baseRx = vw * 0.18;
        baseRy = baseRx * 0.28;
        guideText = '지금 스텝!';
        break;
    }

    if (this._presentationContext?.timingGuide?.text) {
      guideText = this._presentationContext.timingGuide.text;
    }

    const scale = this.computeTimingRingScale(progress);
    const ringRx = baseRx * scale;
    const ringRy = baseRy * scale;

    const originalStrokeStyle = ctx.strokeStyle;
    ctx.save();

    // 1. 목표 전경 발판 베이스 가이드 타원
    ctx.lineWidth = 2.5;
    ctx.strokeStyle =
      this._presentationContext?.hazardStyle?.borderColor ??
      'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(targetX, targetY, baseRx, baseRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 2. 수축 타이밍 서클 (progress < 0.8: 황금빛 앰버, >= 0.8: 긴급 붉은색 펄스)
    const isUrgent = progress >= 0.8;
    ctx.lineWidth = isUrgent ? 7 : 4;
    const defaultStroke = isUrgent ? 'rgb(255, 68, 68)' : 'rgba(255, 203, 77, 0.85)';
    ctx.strokeStyle =
      this._presentationContext?.timingGuide?.color ?? defaultStroke;
    ctx.shadowColor = isUrgent ? 'rgba(255, 68, 68, 0.95)' : 'rgba(255, 203, 77, 0.6)';
    ctx.shadowBlur = isUrgent ? 26 : 14;

    ctx.beginPath();
    ctx.ellipse(targetX, targetY, ringRx, ringRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 80%~100% 구간: 직관적 타이밍 유도 가이드 텍스트
    if (isUrgent) {
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle =
        this._presentationContext?.timingGuide?.color ?? '#FF4444';
      ctx.shadowColor = 'rgba(255, 68, 68, 0.9)';
      ctx.shadowBlur = 18;
      ctx.fillText(guideText, targetX, targetY - baseRy - 28);
    }

    ctx.restore();
    if (originalStrokeStyle) {
      ctx.strokeStyle = originalStrokeStyle;
    }
  }

  private _renderWarningBanner(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    override: HazardSlotOverride,
  ): void {
    const bounds = this.getWarningLabelBounds('jump', vw, vh);
    ctx.save();
    const fontSize = override.fontSize ?? Math.round(36 * (vw / 1080));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = override.textColor ?? override.color ?? '#FF4444';
    ctx.shadowColor = override.glowColor ?? 'rgba(255, 68, 68, 0.8)';
    ctx.shadowBlur = 12;
    ctx.fillText(override.text || '', bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    ctx.restore();
  }

  /**
   * 점프 충격파 링 렌더링 (전 레인 확산 붉은 파동)
   */
  private _renderJumpShockwave(
    ctx: CanvasRenderingContext2D,
    vw: number,
    _vh: number,
    vx: number,
    _vy: number,
    frontY: number,
    depthRatio: number,
    progress: number,
    isResolved?: boolean,
    isEvaded?: boolean,
  ): void {
    const rx = vw * (0.18 + 0.44 * depthRatio);
    const ry = rx * 0.26; // 3D 바닥 평면 투영 타원비

    ctx.save();

    let strokeColor = 'rgb(255, 134, 94)'; // #FF865E
    let shadowColor = 'rgba(255, 134, 94, 0.8)';
    let fillColor = `rgba(255, 134, 94, ${0.08 + 0.14 * depthRatio})`;

    if (isResolved) {
      if (isEvaded) {
        // 회피 성공: 안전 소멸 에메랄드/시안 링 (#4DFFAA)
        strokeColor = 'rgb(77, 255, 170)';
        shadowColor = 'rgba(77, 255, 170, 0.9)';
        fillColor = 'rgba(77, 255, 170, 0.15)';
      } else {
        // 피격 실패: 강렬한 위험 붉은색 임팩트 (#FF4444)
        strokeColor = 'rgb(255, 68, 68)';
        shadowColor = 'rgba(255, 68, 68, 0.95)';
        fillColor = 'rgba(255, 68, 68, 0.28)';
      }
    }

    ctx.strokeStyle = strokeColor;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = isResolved ? 32 : 24;
    ctx.lineWidth = (8 + 6 * depthRatio) * (isResolved && !isEvaded ? 1.5 : 1.0);

    // 1. 메인 충격파 링
    ctx.beginPath();
    ctx.ellipse(vx, frontY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 2. 바닥면 내부 글로우 채우기
    ctx.fillStyle = fillColor;
    ctx.fill();

    // 3. 뒤따라오는 보조 리플 링 (펄스 효과)
    if (progress > 0.25) {
      const subRatio = Math.max(0, depthRatio - 0.2);
      const subRx = rx * 0.72;
      const subRy = ry * 0.72;
      ctx.lineWidth = 4 + 3 * subRatio;
      ctx.strokeStyle = isResolved && !isEvaded ? 'rgba(255, 68, 68, 0.7)' : 'rgba(255, 134, 94, 0.6)';
      ctx.beginPath();
      ctx.ellipse(vx, frontY - ry * 0.4, subRx, subRy, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 한 발 피하기 레인 위험 네온 띠 렌더링 (left_step / right_step)
   */
  private _renderStepLaneHazard(
    ctx: CanvasRenderingContext2D,
    vw: number,
    _vh: number,
    vx: number,
    vy: number,
    frontY: number,
    depthRatio: number,
    side: 'left' | 'right',
    isResolved?: boolean,
    isEvaded?: boolean,
  ): void {
    const isLeft = side === 'left';
    let mainColor = isLeft ? 'rgb(40, 230, 255)' : 'rgb(255, 203, 77)';
    let baseRgba = isLeft ? 'rgba(40, 230, 255, ' : 'rgba(255, 203, 77, ';

    if (isResolved) {
      if (isEvaded) {
        mainColor = 'rgb(77, 255, 170)';
        baseRgba = 'rgba(77, 255, 170, ';
      } else {
        mainColor = 'rgb(255, 68, 68)';
        baseRgba = 'rgba(255, 68, 68, ';
      }
    }

    // 레인 중심 X 오프셋 (전경 기준 화면 ±35% 위치)
    const laneOffsetSign = isLeft ? -1 : 1;
    const laneCenterOffset = laneOffsetSign * vw * 0.35;
    const laneHalfWidth = vw * 0.16;

    // 소실점 근처 시작 좌표
    const topX1 = vx + laneOffsetSign * 10;
    const topX2 = vx + laneOffsetSign * 40;
    const topY = vy;

    // 전방 진행 좌표
    const botCenterX = laneToScreenX(vx, laneCenterOffset, depthRatio);
    const botWidth = laneHalfWidth * depthRatio;
    const botX1 = botCenterX - botWidth;
    const botX2 = botCenterX + botWidth;

    ctx.save();
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = (6 + 4 * depthRatio) * (isResolved && !isEvaded ? 1.4 : 1.0);
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = isResolved ? 30 : 20;

    // 1. 위험 구역 사다리꼴 바닥면
    ctx.beginPath();
    ctx.moveTo(topX1, topY);
    ctx.lineTo(topX2, topY);
    ctx.lineTo(botX2, frontY);
    ctx.lineTo(botX1, frontY);
    ctx.closePath();

    ctx.fillStyle = `${baseRgba}${0.12 + 0.18 * depthRatio})`;
    ctx.fill();
    ctx.stroke();

    // 2. 전방 충격파 림 (위험 구역 선두 테두리 강조)
    ctx.lineWidth = (8 + 6 * depthRatio) * (isResolved && !isEvaded ? 1.5 : 1.0);
    ctx.beginPath();
    ctx.moveTo(botX1, frontY);
    ctx.lineTo(botX2, frontY);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 한발 균형 유지 구역 및 반대편 가시 펄스 렌더링 (balance_left / balance_right)
   */
  private _renderBalanceHazard(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    vx: number,
    vy: number,
    frontY: number,
    depthRatio: number,
    safeSide: 'left' | 'right',
    isResolved?: boolean,
    isEvaded?: boolean,
  ): void {
    const isSafeLeft = safeSide === 'left';
    const mainColor = isResolved
      ? isEvaded
        ? 'rgb(77, 255, 170)'
        : 'rgb(255, 68, 68)'
      : 'rgb(200, 137, 255)'; // #C889FF
    const dangerSide = isSafeLeft ? 'right' : 'left';

    // 1. 위험한 반대편 레인에 가시형 위험 띠 드로잉
    this._renderStepLaneHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, dangerSide, isResolved, isEvaded);

    // 2. 안전한 지탱 측 발밑에 보라색 균형 유지 플랫폼 링 드로잉
    const safeOffsetSign = isSafeLeft ? -1 : 1;
    const safeCenterOffset = safeOffsetSign * vw * 0.35;
    const safeCenterX = laneToScreenX(vx, safeCenterOffset, depthRatio);

    const safeRx = vw * (0.08 + 0.12 * depthRatio);
    const safeRy = safeRx * 0.28;

    ctx.save();
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 5 + 3 * depthRatio;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.ellipse(safeCenterX, frontY, safeRx, safeRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isResolved && isEvaded ? 'rgba(77, 255, 170, 0.25)' : `rgba(200, 137, 255, ${0.15 + 0.15 * depthRatio})`;
    ctx.fill();

    ctx.restore();
  }
}
