import { describe, expect, it, vi } from 'vitest';
import {
  HazardZoneRenderer,
  HAZARD_ZONE_SLOT_IDS,
  PROTECTED_HAZARD_ZONE_SLOT_IDS,
  DEFAULT_HAZARD_FIXTURE,
  JUMP_HAZARD_WARNING_FIXTURE,
  JUMP_HAZARD_ACTIVE_FIXTURE,
  JUMP_HAZARD_SAFE_FIXTURE,
  JUMP_HAZARD_HIT_FIXTURE,
  LEFT_STEP_HAZARD_FIXTURE,
  RIGHT_STEP_HAZARD_FIXTURE,
  BALANCE_LEFT_HAZARD_FIXTURE,
  BALANCE_RIGHT_HAZARD_FIXTURE,
  type HazardBounds,
  type HazardPresentationContext,
  type HazardSlotOverride,
  type HazardFixtureDTO,
  type HazardRenderState,
} from '../../src/render/HazardZoneRenderer.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

function createMockCtx(): CanvasRenderingContext2D & {
  calls: { method: string; args: unknown[] }[];
  fillStyles: string[];
  strokeStyles: string[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  let _fillStyle = '';
  let _strokeStyle = '';

  const mock = {
    calls,
    fillStyles,
    strokeStyles,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
    ellipse: vi.fn((...args: unknown[]) => calls.push({ method: 'ellipse', args })),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] }),
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] }),
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] }),
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] }),
    ),
    fillText: vi.fn((text: string, x: number, y: number, maxWidth?: number) =>
      calls.push({ method: 'fillText', args: [text, x, y, maxWidth] }),
    ),
    strokeText: vi.fn((text: string, x: number, y: number, maxWidth?: number) =>
      calls.push({ method: 'strokeText', args: [text, x, y, maxWidth] }),
    ),
    measureText: vi.fn((text: string) => ({ width: text.length * 16 })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    setLineDash: vi.fn((dash: number[]) => calls.push({ method: 'setLineDash', args: [dash] })),
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
    shadowColor: '',
    shadowBlur: 0,
  };

  Object.defineProperty(mock, 'fillStyle', {
    get: () => _fillStyle,
    set: (v: string) => {
      _fillStyle = v;
      fillStyles.push(v);
    },
  });

  Object.defineProperty(mock, 'strokeStyle', {
    get: () => _strokeStyle,
    set: (v: string) => {
      _strokeStyle = v;
      strokeStyles.push(v);
    },
  });

  return mock as unknown as CanvasRenderingContext2D & {
    calls: { method: string; args: unknown[] }[];
    fillStyles: string[];
    strokeStyles: string[];
  };
}

const W = 1080;
const H = 2160;

describe('[UI-VIS-017 / Issue #447] 위험 장판 렌더러 보호 표시 경계', () => {
  describe('1. HazardZoneRenderer 선택적 표시 컨텍스트 및 bounds 조회', () => {
    it('기본 상태에서 각 회피 패턴의 장판 bounds를 정상 계산하고 보호 플래그를 가진다', () => {
      const renderer = new HazardZoneRenderer();
      expect(renderer.getPresentationContext()).toBeUndefined();

      const jumpBounds: HazardBounds = renderer.getHazardZoneBounds('jump', W, H);
      expect(jumpBounds.w).toBeGreaterThan(0);
      expect(jumpBounds.h).toBeGreaterThan(0);
      expect(jumpBounds.x).toBeCloseTo(W / 2 - jumpBounds.w / 2, 0);
      expect(jumpBounds.isProtected).toBe(true);

      const leftBounds: HazardBounds = renderer.getHazardZoneBounds('left_step', W, H);
      expect(leftBounds.w).toBeGreaterThan(0);
      expect(leftBounds.h).toBeGreaterThan(0);
      expect(leftBounds.x).toBeLessThan(W / 2);
      expect(leftBounds.isProtected).toBe(true);

      const rightBounds: HazardBounds = renderer.getHazardZoneBounds('right_step', W, H);
      expect(rightBounds.w).toBeGreaterThan(0);
      expect(rightBounds.h).toBeGreaterThan(0);
      expect(rightBounds.x).toBeGreaterThan(W / 2);
      expect(rightBounds.isProtected).toBe(true);

      const balLeftBounds: HazardBounds = renderer.getHazardZoneBounds('balance_left', W, H);
      expect(balLeftBounds.isProtected).toBe(true);
      const balRightBounds: HazardBounds = renderer.getHazardZoneBounds('balance_right', W, H);
      expect(balRightBounds.isProtected).toBe(true);
    });

    it('경고 라벨 bounds 및 타이밍 원 bounds, 안전 구역 bounds를 계산한다', () => {
      const renderer = new HazardZoneRenderer();

      const labelBounds = renderer.getWarningLabelBounds('jump', W, H);
      expect(labelBounds.w).toBeGreaterThan(0);
      expect(labelBounds.h).toBeGreaterThan(0);
      expect(labelBounds.isProtected).toBe(false);

      const ringBounds0 = renderer.getTimingRingBounds('jump', 0.0, W, H);
      const ringBounds1 = renderer.getTimingRingBounds('jump', 1.0, W, H);
      expect(ringBounds0.w).toBeGreaterThan(ringBounds1.w);
      expect(ringBounds0.isProtected).toBe(true);
      expect(ringBounds1.isProtected).toBe(true);

      const safeBounds = renderer.getSafeZoneBounds('left_step', W, H);
      expect(safeBounds.w).toBeGreaterThan(0);
      expect(safeBounds.h).toBeGreaterThan(0);
      expect(safeBounds.isProtected).toBe(true);
    });

    it('setPresentationContext, getPresentationContext, clearPresentationContext 라이프사이클이 정확히 동작한다', () => {
      const renderer = new HazardZoneRenderer();
      const warningOverride: HazardSlotOverride = {
        text: '긴급 대피 훈련!',
        color: '#FF0055',
      };
      const customContext: HazardPresentationContext = {
        hazardWarning: warningOverride,
        hazardStyle: {
          borderColor: '#FF1133',
        },
      };

      renderer.setPresentationContext(customContext);
      expect(renderer.getPresentationContext()).toEqual(customContext);

      renderer.clearPresentationContext();
      expect(renderer.getPresentationContext()).toBeUndefined();
    });

    it('fromPresentationDocument를 통해 hazard_evade 페이지 및 hazard_warning 요소를 매핑한다', () => {
      expect(HAZARD_ZONE_SLOT_IDS).toContain('hazardWarning');
      expect(PROTECTED_HAZARD_ZONE_SLOT_IDS).toContain('hazard_geometry');
      expect(PROTECTED_HAZARD_ZONE_SLOT_IDS).toContain('timing_ring_physics');
      expect(PROTECTED_HAZARD_ZONE_SLOT_IDS).toContain('lane_evasion_zones');
      expect(PROTECTED_HAZARD_ZONE_SLOT_IDS).toContain('projection_matrix');

      const doc = createDefaultUIPresentationDocument();
      const context = HazardZoneRenderer.fromPresentationDocument(doc);

      expect(context.presentationDocument).toBe(doc);
      expect(context.pageId).toBe('hazard_evade');
      expect(context.hazardWarning).toBeDefined();
      expect(context.hazardWarning?.text).toContain('위험');
    });
  });

  describe('2. 보호된 장판 물리 좌표 및 판정 무결성 보존 (Protected Gameplay Guard)', () => {
    it('외부 컨텍스트에서 장판 물리 좌표를 변조하려 해도 안전 기본 기하로 고정된다', () => {
      const intruderCtx: HazardPresentationContext = {
        hazardWarning: {
          x: 10,
          y: 50,
          w: 100,
          h: 20,
        },
        hazardStyle: {
          x: 50,
          y: 50,
        },
      };

      const renderer = new HazardZoneRenderer();
      renderer.setPresentationContext(intruderCtx);

      const jumpBounds = renderer.getHazardZoneBounds('jump', W, H);
      expect(jumpBounds.x).not.toBe(10);
      expect(jumpBounds.y).not.toBe(50);
      expect(jumpBounds.x).toBeCloseTo(W / 2 - jumpBounds.w / 2, 0);

      const ringBounds = renderer.getTimingRingBounds('jump', 0.5, W, H);
      expect(ringBounds.x).not.toBe(50);
      expect(ringBounds.y).not.toBe(50);
    });

    it('isSlotLocked 및 getSlotLockReason이 보호 영역에 대해 명확한 잠금 사유를 반환한다', () => {
      const renderer = new HazardZoneRenderer();

      expect(renderer.isSlotLocked('hazard_geometry')).toBe(true);
      expect(renderer.isSlotLocked('timing_ring_physics')).toBe(true);
      expect(renderer.isSlotLocked('lane_evasion_zones')).toBe(true);
      expect(renderer.isSlotLocked('projection_matrix')).toBe(true);
      expect(renderer.isSlotLocked('hazardWarning')).toBe(false);
      expect(renderer.isSlotLocked('hazardStyle')).toBe(false);

      const reason = renderer.getSlotLockReason('hazard_geometry');
      expect(reason).toContain('장판 물리 좌표');
      expect(renderer.getSlotLockReason('hazardWarning')).toBeNull();
    });

    it('validatePresentationContext가 물리 좌표 왜곡 시도를 감지하여 경고 이슈를 보고한다', () => {
      const renderer = new HazardZoneRenderer();
      const illegalContext: HazardPresentationContext = {
        hazardWarning: {
          x: 200,
          y: 200,
        },
      };

      const result = renderer.validatePresentationContext(illegalContext);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('물리적 좌표');

      const safeContext: HazardPresentationContext = {
        hazardWarning: {
          text: '새로운 경고 문구',
          color: '#FFAA00',
        },
      };
      const safeResult = renderer.validatePresentationContext(safeContext);
      expect(safeResult.valid).toBe(true);
      expect(safeResult.issues).toEqual([]);
    });

    it('warning/active/safe/hit 상태는 순수 읽기 전용 draw state(HazardRenderState)로 유지되며 UI에서 판정을 계산하지 않는다', () => {
      const renderer = new HazardZoneRenderer();
      const ctx = createMockCtx();

      const readonlyState: HazardRenderState = {
        activePattern: 'jump',
        beatProgress: 0.9,
        vanishingX: 540,
        vanishingY: 518.4,
        isResolved: false,
        isEvaded: false,
      };

      // 렌더링 호출이 상태를 변조하거나 데미지/회피를 판정하지 않음
      renderer.render(ctx, W, H, readonlyState);
      expect(readonlyState.isResolved).toBe(false);
      expect(readonlyState.isEvaded).toBe(false);
      expect(readonlyState.beatProgress).toBe(0.9);
    });
  });

  describe('3. 결정론적 Fixture DTO 렌더 진입점 (renderFixture)', () => {
    it('다양한 회피 패턴 및 상태의 fixture를 부작용 없이 렌더링한다', () => {
      const renderer = new HazardZoneRenderer();

      const fixtures: HazardFixtureDTO[] = [
        DEFAULT_HAZARD_FIXTURE,
        JUMP_HAZARD_WARNING_FIXTURE,
        JUMP_HAZARD_ACTIVE_FIXTURE,
        JUMP_HAZARD_SAFE_FIXTURE,
        JUMP_HAZARD_HIT_FIXTURE,
        LEFT_STEP_HAZARD_FIXTURE,
        RIGHT_STEP_HAZARD_FIXTURE,
        BALANCE_LEFT_HAZARD_FIXTURE,
        BALANCE_RIGHT_HAZARD_FIXTURE,
      ];

      for (const fixture of fixtures) {
        const ctx = createMockCtx();
        expect(() => {
          renderer.renderFixture(ctx, W, H, fixture);
        }).not.toThrow();

        expect(ctx.calls.some((c) => c.method === 'save')).toBe(true);
        expect(ctx.calls.some((c) => c.method === 'restore')).toBe(true);
      }
    });

    it('JUMP_HAZARD_SAFE_FIXTURE와 JUMP_HAZARD_HIT_FIXTURE가 성공/실패 시각 피드백을 구분하여 렌더링한다', () => {
      const renderer = new HazardZoneRenderer();

      const ctxSafe = createMockCtx();
      renderer.renderFixture(ctxSafe, W, H, JUMP_HAZARD_SAFE_FIXTURE);
      // safe: 녹색 계열 (rgba(0, 255, 128) 또는 #39FF14 또는 rgb(77, 255, 170) 등)
      expect(
        ctxSafe.strokeStyles.some((s) => s.includes('0, 255, 128') || s.includes('39FF14') || s.includes('77, 255, 170')) ||
        ctxSafe.fillStyles.some((s) => s.includes('0, 255, 128') || s.includes('39FF14') || s.includes('77, 255, 170')),
      ).toBe(true);

      const ctxHit = createMockCtx();
      renderer.renderFixture(ctxHit, W, H, JUMP_HAZARD_HIT_FIXTURE);
      // hit: 붉은색 계열 (#FF1E3C 또는 255, 30, 60 등)
      expect(
        ctxHit.strokeStyles.some((s) => s.includes('FF1E3C') || s.includes('255, 30, 60') || s.includes('255, 68, 68')) ||
        ctxHit.fillStyles.some((s) => s.includes('FF1E3C') || s.includes('255, 30, 60') || s.includes('255, 68, 68')),
      ).toBe(true);
    });

    it('정적 메서드 HazardZoneRenderer.renderFixture가 인스턴스를 즉석 생성하여 렌더링한다', () => {
      const ctx = createMockCtx();
      HazardZoneRenderer.renderFixture(ctx, W, H, DEFAULT_HAZARD_FIXTURE);

      expect(ctx.calls.some((c) => c.method === 'save')).toBe(true);
      expect(ctx.calls.some((c) => c.method === 'restore')).toBe(true);
    });
  });

  describe('4. 안전한 시각 스타일 소비 및 기존 렌더러 호환성', () => {
    it('context의 타이밍 가이드 문구 및 경고 라벨이 안전하게 반영된다', () => {
      const renderer = new HazardZoneRenderer();
      const ctx = createMockCtx();

      renderer.setPresentationContext({
        timingGuide: {
          text: '커스텀 점프 타이밍!',
          color: '#00E5FF',
        },
        hazardWarning: {
          text: '주의: 거대 충격파!',
        },
      });

      renderer.renderFixture(ctx, W, H, JUMP_HAZARD_ACTIVE_FIXTURE);

      const textCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(textCalls.some((c) => String(c.args[0]).includes('커스텀 점프 타이밍!'))).toBe(true);
      expect(textCalls.some((c) => String(c.args[0]).includes('주의: 거대 충격파!'))).toBe(true);
    });

    it('컨텍스트가 없을 때 기본 렌더러는 기존 시각 요소(ellipse, stroke 등)를 변경 없이 유지한다', () => {
      const renderer = new HazardZoneRenderer();
      const ctx = createMockCtx();

      const state: HazardRenderState = {
        activePattern: 'jump',
        beatProgress: 0.5,
        vanishingX: 540,
        vanishingY: 518.4,
      };

      renderer.render(ctx, W, H, state);

      expect(ctx.calls.some((c) => c.method === 'ellipse')).toBe(true);
      expect(ctx.calls.some((c) => c.method === 'stroke')).toBe(true);
    });
  });
});
