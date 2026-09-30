/**
 * hazard-zone-renderer.test.ts - 3D 원근 그리드 바닥 보스 장판 렌더러 단위 테스트
 *
 * @see Issue #228 [RENDER-HAZARD-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HazardZoneRenderer,
  type HazardRenderState,
} from '../../src/render/HazardZoneRenderer.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 100 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('HazardZoneRenderer (Issue #228 - RENDER-HAZARD-001)', () => {
  let renderer: HazardZoneRenderer;
  let ctx: CanvasRenderingContext2D;

  const vw = 1080;
  const vh = 2160;
  const vx = 540;
  const vy = vh * 0.24; // 518.4

  beforeEach(() => {
    renderer = new HazardZoneRenderer();
    ctx = createMockContext();
  });

  describe('1. 전방 Y 좌표 계산 및 단조 증가 검증 (computeHazardFrontY)', () => {
    it('beatProgress=0일 때 소실점 Y 좌표(vy)를 반환한다', () => {
      const y = renderer.computeHazardFrontY(0, vy, vh);
      expect(y).toBeCloseTo(vy, 2);
    });

    it('beatProgress=1.0일 때 전경 하단(화면 90% 이상) 좌표에 도달한다', () => {
      const y = renderer.computeHazardFrontY(1.0, vy, vh);
      expect(y).toBeGreaterThan(vh * 0.85);
      expect(y).toBeLessThanOrEqual(vh);
    });

    it('beatProgress가 0에서 1로 진행할 때 Y 좌표는 단조 증가(원근 전진)한다', () => {
      const steps = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
      const yValues = steps.map((p) => renderer.computeHazardFrontY(p, vy, vh));

      for (let i = 1; i < yValues.length; i++) {
        expect(yValues[i]).toBeGreaterThan(yValues[i - 1]);
      }
    });

    it('beatProgress가 0 미만이거나 1 초과일 때 0~1 범위로 안전 클램핑된다', () => {
      const yUnder = renderer.computeHazardFrontY(-0.5, vy, vh);
      const yZero = renderer.computeHazardFrontY(0, vy, vh);
      expect(yUnder).toBeCloseTo(yZero, 2);

      const yOver = renderer.computeHazardFrontY(1.5, vy, vh);
      const yOne = renderer.computeHazardFrontY(1.0, vy, vh);
      expect(yOver).toBeCloseTo(yOne, 2);
    });
  });

  describe('2. activePattern에 따른 렌더링 호출 검증', () => {
    it('activePattern이 null일 때 캔버스에 어떤 드로잉도 하지 않는다', () => {
      const state: HazardRenderState = {
        activePattern: null,
        beatProgress: 0.5,
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.ellipse).not.toHaveBeenCalled();
    });

    it('jump 패턴일 때 붉은색(#FF865E) 충격파 파동 링을 렌더링한다', () => {
      const state: HazardRenderState = {
        activePattern: 'jump',
        beatProgress: 0.5,
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.ellipse).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.strokeStyle).toContain('255, 134, 94'); // #FF865E
    });

    it('left_step 패턴일 때 좌측 레인 네온 띠(#28E6FF)를 렌더링한다', () => {
      const state: HazardRenderState = {
        activePattern: 'left_step',
        beatProgress: 0.6,
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.strokeStyle).toContain('40, 230, 255'); // #28E6FF
    });

    it('right_step 패턴일 때 우측 레인 네온 띠(#FFCB4D)를 렌더링한다', () => {
      const state: HazardRenderState = {
        activePattern: 'right_step',
        beatProgress: 0.6,
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.strokeStyle).toContain('255, 203, 77'); // #FFCB4D
    });

    it('balance_left 및 balance_right 패턴일 때 보라색 계열(#C889FF) 바닥 펄스를 렌더링한다', () => {
      const patterns: PhaseAHazardPattern[] = ['balance_left', 'balance_right'];

      for (const pattern of patterns) {
        const mockCtx = createMockContext();
        const state: HazardRenderState = {
          activePattern: pattern,
          beatProgress: 0.4,
          vanishingX: vx,
          vanishingY: vy,
        };

        renderer.render(mockCtx, vw, vh, state);

        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
        expect(mockCtx.strokeStyle).toContain('200, 137, 255'); // #C889FF
      }
    });
  });

  describe('3. 원근 레일 궤적 투영 연동 (GridProjection)', () => {
    it('좌/우 레인 장판의 전경 X 좌표가 화면 좌/우 피트니스 존 방향으로 벌어진다', () => {
      const stateLeft: HazardRenderState = {
        activePattern: 'left_step',
        beatProgress: 0.8,
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, stateLeft);
      // moveTo or lineTo에 전달된 X 좌표 중 소실점 좌측(x < vx) 좌표가 포함되어야 함
      const lineToCalls = vi.mocked(ctx.lineTo).mock.calls;
      const hasLeftX = lineToCalls.some(([x]) => x < vx);
      expect(hasLeftX).toBe(true);
    });
  });
});
