/**
 * phase-a-hazard-render.test.ts - Phase A 위험 회피 3D 장판 및 판정 시각 동기화 통합 테스트
 *
 * @see Issue #228 [RENDER-HAZARD-001]
 * @see Issue #236 [BUG-HAZARD-LIFECYCLE-001]
 * @see Issue #232 [BUG-PHASE-PRESENTATION-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { HazardZoneRenderer } from '../../src/render/HazardZoneRenderer.js';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';

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
    measureText: vi.fn().mockReturnValue({ width: 80 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
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

describe('Phase A Hazard Evade Render Integration (Issue #228 - RENDER-HAZARD-001)', () => {
  let controller: PhaseAHazardController;
  let renderer: HazardZoneRenderer;
  let adapter: PhasePresentationAdapter;
  let ctx: CanvasRenderingContext2D;

  const vw = 1080;
  const vh = 2160;
  const vx = 540;
  const vy = vh * 0.24; // 518.4

  beforeEach(() => {
    renderer = new HazardZoneRenderer();
    adapter = new PhasePresentationAdapter(renderer);
    controller = new PhaseAHazardController({
      totalDuration: 4.0,
      judgmentTime: 3.5,
      damagePerMiss: 25,
    });
    ctx = createMockContext();
  });

  describe('1. 비활성/null 드로잉 0 및 페이즈 격리 검증', () => {
    it('컨트롤러 비활성 상태일 때 캔버스에 어떤 장판도 드로잉하지 않는다', () => {
      adapter.renderHazardEvade(ctx, vw, vh, {
        activePattern: controller.activePattern,
        beatProgress: controller.beatProgress,
        vanishingX: vx,
        vanishingY: vy,
        isEvaded: controller.isEvaded,
        isResolved: controller.isResolved,
      });

      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.ellipse).not.toHaveBeenCalled();
    });

    it('RUN_QUESTION 및 STAR_COLLECT 상태에서는 canRenderHazardEvade가 false이다', () => {
      expect(adapter.canRenderHazardEvade('RUN_QUESTION')).toBe(false);
      expect(adapter.canRenderHazardEvade('STAR_COLLECT')).toBe(false);
      expect(adapter.canRenderHazardEvade('ANSWER_SELECT')).toBe(false);
      expect(adapter.canRenderHazardEvade('HAZARD_EVADE')).toBe(true);
    });
  });

  describe('2. 접근 단계(0~3.5s) 전경 단조 전진 및 지시 일치 검증', () => {
    it('left_step 접근 중 좌측 레인 띠(#28E6FF)와 왼발 피하기 지시가 정확히 표출된다', () => {
      controller.start({ pattern: 'left_step' });
      controller.update(1.75); // 50% 진행

      expect(controller.beatProgress).toBeCloseTo(0.5, 2);

      adapter.renderHazardEvade(ctx, vw, vh, {
        activePattern: controller.activePattern,
        beatProgress: controller.beatProgress,
        vanishingX: vx,
        vanishingY: vy,
        isEvaded: controller.isEvaded,
        isResolved: controller.isResolved,
      });

      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.strokeStyle).toContain('40, 230, 255'); // #28E6FF

      const textCalls = vi.mocked(ctx.fillText).mock.calls.map((c) => String(c[0]));
      expect(textCalls.some((txt) => txt.includes('왼발 피하기'))).toBe(true);
    });

    it('jump 접근 중 전 레인 충격파(#FF865E)와 양발 피하기 지시가 정확히 표출된다', () => {
      controller.start({ pattern: 'jump' });
      controller.update(1.75);

      adapter.renderHazardEvade(ctx, vw, vh, {
        activePattern: controller.activePattern,
        beatProgress: controller.beatProgress,
        vanishingX: vx,
        vanishingY: vy,
        isEvaded: controller.isEvaded,
        isResolved: controller.isResolved,
      });

      expect(ctx.ellipse).toHaveBeenCalled();
      expect(ctx.strokeStyle).toContain('255, 134, 94'); // #FF865E

      const textCalls = vi.mocked(ctx.fillText).mock.calls.map((c) => String(c[0]));
      expect(textCalls.some((txt) => txt.includes('양발 피하기'))).toBe(true);
    });
  });

  describe('3. 판정 순간(3.5s) 회피 성공 vs 실패 임팩트 및 결과 식별 검증', () => {
    it('올바른 회피 동작 수행 시 회피 성공(DODGED) 피드백과 안전 소멸 연출을 표출한다', () => {
      controller.start({ pattern: 'left_step' });
      controller.recordAction('left_step'); // 올바른 회피 동작

      controller.update(3.5); // 판정 시점 도달
      expect(controller.isResolved).toBe(true);
      expect(controller.isEvaded).toBe(true);

      adapter.renderHazardEvade(ctx, vw, vh, {
        activePattern: controller.activePattern,
        beatProgress: controller.beatProgress,
        vanishingX: vx,
        vanishingY: vy,
        isEvaded: controller.isEvaded,
        isResolved: controller.isResolved,
      });

      const textCalls = vi.mocked(ctx.fillText).mock.calls.map((c) => String(c[0]));
      expect(textCalls.some((txt) => txt.includes('회피 성공') || txt.includes('DODGED'))).toBe(true);
      expect(textCalls.some((txt) => txt.includes('왼발'))).toBe(true);
    });

    it('미회피 시 회피 실패(HIT / -25 HP) 피드백과 위험 임팩트(#FF4444)를 표출한다', () => {
      controller.start({ pattern: 'right_step' });
      // 동작 미수행

      controller.update(3.5); // 판정 시점 도달
      expect(controller.isResolved).toBe(true);
      expect(controller.isEvaded).toBe(false);

      adapter.renderHazardEvade(ctx, vw, vh, {
        activePattern: controller.activePattern,
        beatProgress: controller.beatProgress,
        vanishingX: vx,
        vanishingY: vy,
        isEvaded: controller.isEvaded,
        isResolved: controller.isResolved,
      });

      const textCalls = vi.mocked(ctx.fillText).mock.calls.map((c) => String(c[0]));
      expect(textCalls.some((txt) => txt.includes('회피 실패') || txt.includes('HIT'))).toBe(true);
      expect(textCalls.some((txt) => txt.includes('25'))).toBe(true);
    });
  });
});
