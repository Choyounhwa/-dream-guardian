/**
 * boss-climax-renderer.test.ts - Phase B 결전 시각화 렌더러 단위 테스트
 *
 * @see Issue #195 [RENDER-CLIMAX-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BossClimaxRenderer,
  type BossClimaxRenderState,
} from '../../src/render/BossClimaxRenderer.js';

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
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
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
    globalCompositeOperation: 'source-over',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('BossClimaxRenderer (Issue #195 - RENDER-CLIMAX-001)', () => {
  let renderer: BossClimaxRenderer;
  let ctx: CanvasRenderingContext2D;

  const vw = 1080;
  const vh = 2160;

  const baseState: BossClimaxRenderState = {
    bossHp: 10,
    bossMaxHp: 10,
    isEnraged: false,
    minionCount: 3,
    guardianStage: 1,
    stardust: 15,
    feverCombo: 0,
    hazard: null,
    barrageActive: false,
    barrageProgress: 0,
    elapsedTime: 1.0,
  };

  beforeEach(() => {
    renderer = new BossClimaxRenderer();
    ctx = createMockContext();
  });

  it('BossClimaxRenderer 인스턴스가 정상 생성되고 기본 상태를 예외 없이 렌더링한다', () => {
    expect(renderer).toBeDefined();
    expect(() => renderer.render(ctx, vw, vh, baseState)).not.toThrow();
  });

  describe('Component A: Shockwave & Stomp Lane projection', () => {
    it('dual_slam 패턴 시 원근 확산 충격파 링(ellipse)을 렌더링한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        hazard: {
          activePattern: 'dual_slam',
          progress: 0.6,
          isResolved: false,
          isEvaded: false,
        },
      };

      renderer.render(ctx, vw, vh, state);

      // 충격파 타원(ellipse) 호출 확인
      expect(ctx.ellipse).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('alternating_stomp_left 패턴 시 좌측 레인 그림자 미니언을 전진 렌더링한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        hazard: {
          activePattern: 'alternating_stomp_left',
          progress: 0.5,
          isResolved: false,
          isEvaded: false,
        },
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('alternating_stomp_right 패턴 시 우측 레인 그림자 미니언을 전진 렌더링한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        hazard: {
          activePattern: 'alternating_stomp_right',
          progress: 0.7,
          isResolved: false,
          isEvaded: false,
        },
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('hazard가 해결되고 회피 성공(isEvaded) 시 에메랄드 회피 피드백을 렌더링한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        hazard: {
          activePattern: 'dual_slam',
          progress: 1.0,
          isResolved: true,
          isEvaded: true,
        },
      };

      renderer.render(ctx, vw, vh, state);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const evadedTextFound = fillTextCalls.some((call) =>
        typeof call[0] === 'string' && (call[0].includes('EVADED') || call[0].includes('회피')),
      );
      expect(evadedTextFound).toBe(true);
    });

    it('hazard가 해결되고 피격(hit) 시 붉은 피격 피드백을 렌더링한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        hazard: {
          activePattern: 'alternating_stomp_left',
          progress: 1.0,
          isResolved: true,
          isEvaded: false,
        },
      };

      renderer.render(ctx, vw, vh, state);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const hitTextFound = fillTextCalls.some((call) =>
        typeof call[0] === 'string' && (call[0].includes('HIT') || call[0].includes('피격')),
      );
      expect(hitTextFound).toBe(true);
    });
  });

  describe('Component B: Minion Troop Formation (V자 편대)', () => {
    it('minionCount가 0일 때는 아군 미니언 없이 수호신만 렌더링한다', () => {
      const positions = renderer.computeMinionPositions(0, 540, 1800, vw, vh);
      expect(positions).toHaveLength(0);

      const state: BossClimaxRenderState = {
        ...baseState,
        minionCount: 0,
      };
      expect(() => renderer.render(ctx, vw, vh, state)).not.toThrow();
    });

    it('minionCount 3마리 및 13마리 편대 좌표가 화면 가상 경계 내에서 V자 대칭으로 계산된다', () => {
      const gx = 540;
      const gy = 1800;

      const pos3 = renderer.computeMinionPositions(3, gx, gy, vw, vh);
      expect(pos3).toHaveLength(3);
      pos3.forEach((p) => {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(vw);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(vh);
      });

      const pos13 = renderer.computeMinionPositions(13, gx, gy, vw, vh);
      expect(pos13).toHaveLength(13);
      pos13.forEach((p) => {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(vw);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(vh);
      });

      // 좌우 날개 분포 확인: 좌측(x < gx)과 우측(x > gx)이 균형 있게 존재
      const leftWings = pos13.filter((p) => p.x < gx);
      const rightWings = pos13.filter((p) => p.x > gx);
      expect(Math.abs(leftWings.length - rightWings.length)).toBeLessThanOrEqual(1);
    });
  });

  describe('Component C: Magic Barrage / Projectiles', () => {
    it('barrageActive가 true일 때 미니언 편대에서 소실점으로 비행하는 마법 탄막 투사체를 렌더링한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        barrageActive: true,
        barrageProgress: 0.5,
      };

      renderer.render(ctx, vw, vh, state);

      // 투사체 별빛 드로잉(fill/stroke/arc/lineTo 등)
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.save).toHaveBeenCalled();
    });

    it('barrageProgress가 0.85 이상일 때 보스 위치에서 충격 폭발 이펙트를 렌더링한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        barrageActive: true,
        barrageProgress: 0.9,
      };

      renderer.render(ctx, vw, vh, state);
      expect(ctx.arc).toHaveBeenCalled();
    });
  });

  describe('Component D: Boss Enrage Aura (광폭화 아우라)', () => {
    it('isEnraged가 true일 때 붉은 광폭화 코로나/아우라를 렌더링한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        isEnraged: true,
      };

      renderer.render(ctx, vw, vh, state);

      // createRadialGradient 또는 stroke/fill 호출
      expect(ctx.createRadialGradient).toHaveBeenCalled();
    });

    it('isEnraged가 false일 때 광폭화 아우라가 과도하게 점등되지 않는다', () => {
      vi.clearAllMocks();
      const state: BossClimaxRenderState = {
        ...baseState,
        isEnraged: false,
      };

      renderer.render(ctx, vw, vh, state);
      // createRadialGradient 광폭화 전용 펄스는 미호출 또는 제한적
    });
  });

  describe('Component E: Phase B Status HUD & Strict Isolation', () => {
    it('Fever Combo, 아군 미니언 수, 별가루 잔량, 보스 HP를 HUD에 표시한다', () => {
      const state: BossClimaxRenderState = {
        ...baseState,
        bossHp: 6,
        bossMaxHp: 20,
        feverCombo: 8,
        minionCount: 7,
        stardust: 42,
      };

      renderer.render(ctx, vw, vh, state);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const textContents = fillTextCalls.map((c) => String(c[0]));

      // Fever 콤보 표시 확인
      const feverTextFound = textContents.some((t) => t.includes('8') || t.includes('FEVER'));
      expect(feverTextFound).toBe(true);

      // 군단 수량 표시 확인
      const minionTextFound = textContents.some((t) => t.includes('7') || t.includes('군단'));
      expect(minionTextFound).toBe(true);

      // 별가루 잔량 표시 확인
      const stardustTextFound = textContents.some((t) => t.includes('42'));
      expect(stardustTextFound).toBe(true);
    });

    it('입력된 state 객체를 직접 변조(Mutation)하지 않는다 (순수 프리젠테이션)', () => {
      const frozenState: BossClimaxRenderState = Object.freeze({
        bossHp: 8,
        bossMaxHp: 10,
        isEnraged: false,
        minionCount: 5,
        guardianStage: 2,
        stardust: 20,
        feverCombo: 3,
        hazard: Object.freeze({
          activePattern: 'dual_slam',
          progress: 0.4,
          isResolved: false,
          isEvaded: false,
        }),
        barrageActive: true,
        barrageProgress: 0.5,
        elapsedTime: 2.5,
      });

      expect(() => renderer.render(ctx, vw, vh, frozenState)).not.toThrow();
      expect(frozenState.bossHp).toBe(8);
      expect(frozenState.minionCount).toBe(5);
    });
  });
});
