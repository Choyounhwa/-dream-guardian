/**
 * boss-climax-effect-renderer.test.ts
 *
 * Phase B 결전 특수 시각 효과 렌더러(BossClimaxEffectRenderer) 단위 테스트
 * - 보스 광폭화 아우라, 바닥 공격 해저드, 상공 비행 장판, 충격파/그림자 미니언,
 *   피드백 텍스트, 아군 미니언/수호신 비주얼, 마법 탄막 투사체 분리 격리 검증.
 *
 * @see Issue #621 [REFACTOR-RENDER-003]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BossClimaxEffectRenderer,
} from '../../src/render/climax/BossClimaxEffectRenderer.js';
import type {
  BossClimaxHazardState,
  MinionPosition,
} from '../../src/render/BossClimaxRenderer.js';
import { MotionNoteRenderer } from '../../src/render/MotionNoteRenderer.js';

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
    drawImage: vi.fn(),
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

describe('BossClimaxEffectRenderer (Issue #621 - REFACTOR-RENDER-003)', () => {
  let effectRenderer: BossClimaxEffectRenderer;
  let ctx: CanvasRenderingContext2D;

  const vw = 1080;
  const vh = 2160;
  const vx = 540;
  const vy = 540;
  const floorH = vh - vy;

  beforeEach(() => {
    effectRenderer = new BossClimaxEffectRenderer();
    ctx = createMockContext();
  });

  describe('1. 인스턴스 초기화 및 스프라이트 캐시 관리', () => {
    it('기본 인스턴스가 정상 생성되고 기본 MotionNoteRenderer를 보유한다', () => {
      expect(effectRenderer).toBeDefined();
      expect(effectRenderer.motionNoteRenderer).toBeInstanceOf(MotionNoteRenderer);
    });

    it('주입받은 커스텀 MotionNoteRenderer 및 로컬 스프라이트 맵을 정상 참조한다', () => {
      const customMRN = new MotionNoteRenderer();
      const localMap = new Map<string, CanvasImageSource>();
      const customRenderer = new BossClimaxEffectRenderer(customMRN, localMap);

      expect(customRenderer.motionNoteRenderer).toBe(customMRN);
    });

    it('registerLocalSprite가 안전한 키만 캐시하고 clearLocalSprites로 초기화된다', () => {
      const dummyCanvas = {} as CanvasImageSource;
      expect(effectRenderer.registerLocalSprite('stage1_idle', dummyCanvas)).toBe(true);
      expect(effectRenderer.registerLocalSprite('invalid/key/name', dummyCanvas)).toBe(false);

      effectRenderer.clearLocalSprites();
    });
  });

  describe('2. 광폭화 아우라 (renderBossEnrageAura)', () => {
    it('보스 주변 붉은 방사형 글로우 및 회전 코로나 광선 스파이크를 렌더링한다', () => {
      effectRenderer.renderBossEnrageAura(ctx, vx, vy, 1.5);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.createRadialGradient).toHaveBeenCalledWith(
        vx,
        vy,
        expect.any(Number),
        vx,
        vy,
        expect.any(Number),
      );
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.rotate).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });

  describe('3. 바닥 해저드 및 상공 비행 장판 렌더링 (renderHazard & renderFlyingHazard)', () => {
    it('dual_slam 패턴 시 renderDualSlamShockwave를 통해 충격파 타원을 렌더링한다', () => {
      const hazard: BossClimaxHazardState = {
        activePattern: 'dual_slam',
        progress: 0.6,
        isResolved: false,
        isEvaded: false,
      };

      effectRenderer.renderHazard(ctx, vw, vh, vx, vy, floorH, hazard, 1.0);

      expect(ctx.ellipse).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('JUMP'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('alternating_stomp_left 패턴 시 좌측 레인 그림자 미니언을 렌더링한다', () => {
      const hazard: BossClimaxHazardState = {
        activePattern: 'alternating_stomp_left',
        progress: 0.5,
        isResolved: false,
        isEvaded: false,
      };

      effectRenderer.renderHazard(ctx, vw, vh, vx, vy, floorH, hazard, 1.0);

      expect(ctx.setLineDash).toHaveBeenCalledWith([12, 10]);
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('왼발 짓밟기'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('alternating_stomp_right 패턴 시 우측 레인 그림자 미니언을 렌더링한다', () => {
      const hazard: BossClimaxHazardState = {
        activePattern: 'alternating_stomp_right',
        progress: 0.5,
        isResolved: false,
        isEvaded: false,
      };

      effectRenderer.renderHazard(ctx, vw, vh, vx, vy, floorH, hazard, 1.0);

      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('오른발 짓밟기'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('미해결 상태의 장판인 경우 renderFlyingHazard를 호출하여 MotionNoteRenderer에 위임한다', () => {
      const spyFlying = vi.spyOn(effectRenderer.motionNoteRenderer, 'render');
      const hazard: BossClimaxHazardState = {
        activePattern: 'dual_slam',
        progress: 0.4,
        isResolved: false,
      };

      effectRenderer.renderHazard(ctx, vw, vh, vx, vy, floorH, hazard, 1.0);

      expect(spyFlying).toHaveBeenCalled();
    });

    it('activePattern이 null이면 renderFlyingHazard가 아무것도 렌더링하지 않는다', () => {
      const spyFlying = vi.spyOn(effectRenderer.motionNoteRenderer, 'render');
      const hazard: BossClimaxHazardState = {
        activePattern: null,
        progress: 0.0,
      };

      effectRenderer.renderFlyingHazard(ctx, vw, vh, vx, vy, hazard);
      expect(spyFlying).not.toHaveBeenCalled();
    });
  });

  describe('4. 해결 피드백 텍스트 (renderResolvedFeedback)', () => {
    it('회피 성공(isEvaded = true) 시 EVADED 성공 문구를 초록색으로 렌더링한다', () => {
      effectRenderer.renderResolvedFeedback(ctx, vx, 1500, true);

      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('EVADED'),
        vx,
        expect.any(Number),
      );
      expect(ctx.fillStyle).toBe('#00FF88');
    });

    it('피격(isEvaded = false) 시 HIT 피격 문구를 붉은색으로 렌더링한다', () => {
      effectRenderer.renderResolvedFeedback(ctx, vx, 1500, false);

      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('HIT!'),
        vx,
        expect.any(Number),
      );
      expect(ctx.fillStyle).toBe('#FF2244');
    });
  });

  describe('5. 아군 미니언 군단 및 수호신 렌더링 (renderGuardianAndMinions)', () => {
    it('미니언 위치 배열에 따라 각 미니언의 후광, 별빛 구체, 날개를 렌더링한다', () => {
      const minions: MinionPosition[] = [
        { x: 400, y: 1600, index: 0 },
        { x: 680, y: 1600, index: 1 },
      ];

      effectRenderer.renderGuardianAndMinions(
        ctx,
        vx,
        1800,
        minions,
        1,
        1.0,
      );

      // 미니언 2개 + 수호신 1개에 대해 복수 arc 호출
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.ellipse).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('꼬마 수호신'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('등록된 로컬 스프라이트가 존재할 경우 스프라이트 이미지를 그린다', () => {
      const mockImage = {
        width: 100,
        height: 100,
      } as unknown as CanvasImageSource;

      effectRenderer.registerLocalSprite('stage2_idle', mockImage);
      effectRenderer.renderGuardianAndMinions(
        ctx,
        vx,
        1800,
        [],
        2,
        1.0,
      );

      expect(ctx.drawImage).toHaveBeenCalledWith(
        mockImage,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('6. 아군 마법 탄막 투사체 렌더링 (renderMagicBarrage)', () => {
    it('진행도에 따라 수호신 및 미니언에서 소실점을 향하는 별빛 투사체를 렌더링한다', () => {
      const minions: MinionPosition[] = [
        { x: 450, y: 1600, index: 0 },
        { x: 630, y: 1600, index: 1 },
      ];

      effectRenderer.renderMagicBarrage(
        ctx,
        vx,
        1800,
        minions,
        vx,
        vy,
        0.5,
        1.0,
      );

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('progress가 0.85 이상일 때 소실점 주변 충격 폭발 플래시를 렌더링한다', () => {
      effectRenderer.renderMagicBarrage(
        ctx,
        vx,
        1800,
        [],
        vx,
        vy,
        0.9,
        1.0,
      );

      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });
  });

  describe('7. 기하 헬퍼 함수 (computeHazardFrontY)', () => {
    it('진행도 0일 때 소실점 Y 좌표를 반환한다', () => {
      const frontY = effectRenderer.computeHazardFrontY(0, vy, vh);
      expect(frontY).toBeCloseTo(vy, 1);
    });

    it('진행도가 증가함에 따라 원근 가속(pow 1.4)이 반영되어 Y가 증가한다', () => {
      const y1 = effectRenderer.computeHazardFrontY(0.3, vy, vh);
      const y2 = effectRenderer.computeHazardFrontY(0.7, vy, vh);
      const y3 = effectRenderer.computeHazardFrontY(1.0, vy, vh);

      expect(y1).toBeGreaterThan(vy);
      expect(y2).toBeGreaterThan(y1);
      expect(y3).toBeGreaterThan(y2);
      expect(y3).toBeLessThanOrEqual(vh);
    });
  });
});
