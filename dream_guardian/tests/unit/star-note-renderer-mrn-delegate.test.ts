/**
 * star-note-renderer-mrn-delegate.test.ts - StarNoteRenderer의 MotionNoteRenderer 위임 파사드 단위 테스트
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§9 MRN-07)
 * @see Issue #481 [MRN-07]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StarNoteRenderer } from '../../src/render/StarNoteRenderer.js';
import { MotionNoteRenderer } from '../../src/render/MotionNoteRenderer.js';
import type { ActiveStarTarget } from '../../src/input/StarCollectionInput.js';
import type { StarTarget } from '../../src/types/star.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';

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
    drawImage: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 20 }),
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

describe('StarNoteRenderer MRN Delegation (Issue #481 - MRN-07)', () => {
  let ctx: CanvasRenderingContext2D;
  const vw = 1280;
  const vh = 720;
  const vx = 640;
  const vy = 200;

  beforeEach(() => {
    ctx = createMockContext();
  });

  describe('1. MotionNoteRenderer 인스턴스 보유 및 주입 검증', () => {
    it('StarNoteRenderer는 기본적으로 MotionNoteRenderer 인스턴스를 내부에 보유한다', () => {
      const renderer = new StarNoteRenderer();
      expect(renderer.motionNoteRenderer).toBeDefined();
      expect(renderer.motionNoteRenderer).toBeInstanceOf(MotionNoteRenderer);
    });

    it('생성자 옵션 motionNoteRenderer로 외부 MotionNoteRenderer 인스턴스를 주입받을 수 있다', () => {
      const customMNR = new MotionNoteRenderer();
      const renderer = new StarNoteRenderer({
        motionNoteRenderer: customMNR,
      });
      expect(renderer.motionNoteRenderer).toBe(customMNR);
    });
  });

  describe('2. 활성 타겟 변환 및 MotionNoteRenderer 위임 렌더링 검증', () => {
    it('render() 호출 시 활성 타겟을 MotionNoteRenderItem으로 변환하여 motionNoteRenderer.render를 호출한다', () => {
      const renderer = new StarNoteRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      const target: ActiveStarTarget = {
        patternId: 'p_star_1',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 4.0,
      };

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8, // 4.0 - 0.2s (진행도 0.6)
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(spy).toHaveBeenCalled();
      const calledItems = spy.mock.calls[0][1];
      expect(calledItems).toBeDefined();
      expect(calledItems.length).toBe(1);

      const item = calledItems[0];
      expect(item.requirements[0].part).toBe('leftHand');
      expect(item.requirements[0].zoneId).toBe(1);
      expect(item.progress).toBeCloseTo(0.6, 2);
      expect(item.profileId).toBe('star_hand');
    });

    it('수집 완료(resolved=true 또는 isCollected=true)된 노트는 위임 렌더링 목록에 포함되지 않는다', () => {
      const renderer = new StarNoteRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      const target = {
        patternId: 'p_done',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 4.0,
        resolved: true,
      } as unknown as ActiveStarTarget;

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('골반(hip) 및 발 타겟은 profileId가 star_foot으로 매핑된다', () => {
      const renderer = new StarNoteRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      const target: ActiveStarTarget = {
        patternId: 'p_hip',
        part: 'hip',
        zoneId: 10,
        beatIndex: 2,
        landingTime: 4.0,
      };

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(spy).toHaveBeenCalled();
      const item = spy.mock.calls[0][1][0];
      expect(item.requirements[0].part).toBe('hip');
      expect(item.profileId).toBe('star_foot');
    });

    it('여러 타겟이 전달되었을 때 landingTime 순으로 정렬되어 위임 전달된다', () => {
      const renderer = new StarNoteRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      const t1: ActiveStarTarget = { patternId: 'p1', part: 'leftHand', zoneId: 1, beatIndex: 1, landingTime: 10.5 };
      const t2: ActiveStarTarget = { patternId: 'p2', part: 'rightHand', zoneId: 2, beatIndex: 2, landingTime: 11.0 };
      const t3: ActiveStarTarget = { patternId: 'p3', part: 'head', zoneId: 4, beatIndex: 3, landingTime: 11.5 };

      renderer.render(ctx, vw, vh, {
        targets: [t3, t1, t2], // 무작위 순서
        elapsedTime: 10.2,
        vanishingX: vx,
        vanishingY: vy,
        beatPreview: {
          startTime: 8.0,
          secondsPerBeat: 0.5,
          leadBeats: 4,
        },
      });

      expect(spy).toHaveBeenCalled();
      // landingTime이 빠른 순서(10.5 -> 11.0 -> 11.5)로 정렬되어 위임되었는지 확인
      const allRenderedItems = spy.mock.calls.flatMap((call: any) => call[1]);
      expect(allRenderedItems.length).toBe(3);
      expect(allRenderedItems[0].requirements[0].part).toBe('leftHand');
      expect(allRenderedItems[1].requirements[0].part).toBe('rightHand');
      expect(allRenderedItems[2].requirements[0].part).toBe('head');
    });
  });

  describe('3. 별모으기 및 피버 상태의 동일 렌더링 호출(ctx 드로잉) 검증', () => {
    it('별모으기 타겟 비행 시 MotionNoteRenderer를 통해 링, 바디, 심볼 드로잉이 수행된다', () => {
      const renderer = new StarNoteRenderer();

      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 4.0,
      };

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith('★', expect.any(Number), expect.any(Number));
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('피버(보스 결전 다중 노트) 상태에서도 모든 활성 노트가 드로잉된다', () => {
      const renderer = new StarNoteRenderer();

      const t1: StarTarget = { patternId: 'fever_1', part: 'leftHand', zoneId: 4, beatIndex: 1, landingTime: 5.0 };
      const t2: StarTarget = { patternId: 'fever_2', part: 'rightHand', zoneId: 5, beatIndex: 1, landingTime: 5.0 };

      renderer.render(ctx, vw, vh, {
        targets: [t1, t2],
        elapsedTime: 4.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalled();
    });

    it('비트맵 이미지(renderMode: image) 등록 시 ImageBodyPainter를 통해 drawImage가 호출된다', () => {
      const renderer = new StarNoteRenderer({
        visualConfig: { renderMode: 'image' },
      });
      const mockImg = { width: 64, height: 64, naturalWidth: 64, complete: true };
      renderer.setImage('leftHand', mockImg);

      const target: ActiveStarTarget = {
        patternId: 'p_img',
        part: 'leftHand',
        zoneId: 1,
        beatIndex: 1,
        landingTime: 4.0,
      };

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.drawImage).toHaveBeenCalledWith(
        mockImg,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('4. 기존 공개 메서드 100% 하위 호환성 검증', () => {
    let renderer: StarNoteRenderer;

    beforeEach(() => {
      renderer = new StarNoteRenderer();
    });

    it('getActiveTargets()는 state에서 미해결/유효 타겟만 정상 추출한다', () => {
      const active1 = { patternId: 'p1', part: 'leftHand', zoneId: 1, beatIndex: 1, landingTime: 4.0 } as unknown as ActiveStarTarget;
      const resolved = { patternId: 'p2', part: 'rightHand', zoneId: 2, beatIndex: 2, landingTime: 4.0, resolved: true } as unknown as ActiveStarTarget;
      const collected = { patternId: 'p3', part: 'head', zoneId: 3, beatIndex: 3, landingTime: 4.0, isCollected: true } as unknown as ActiveStarTarget;

      const result = renderer.getActiveTargets({
        targets: [active1, resolved, collected],
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(result).toEqual([active1]);
    });

    it('renderTargets()는 targets 배열을 받아 render()와 동등하게 위임 실행한다', () => {
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');
      const target: ActiveStarTarget = { patternId: 'p1', part: 'leftHand', zoneId: 1, beatIndex: 1, landingTime: 4.0 };

      renderer.renderTargets(ctx, vw, vh, [target], {
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(spy).toHaveBeenCalled();
    });

    it('computeNotePosition() 및 computeApproachScale()이 정상 동작한다', () => {
      const target: ActiveStarTarget = { patternId: 'p1', part: 'leftHand', zoneId: 1, beatIndex: 1, landingTime: 4.0 };
      const pos = renderer.computeNotePosition(target, 3.8, vx, vy, vw, vh, DEFAULT_FITNESS_ZONES);
      expect(pos.inFlight).toBe(true);
      expect(pos.scale).toBeGreaterThan(0.3);

      const scaleStart = renderer.computeApproachScale(0.0);
      const scaleEnd = renderer.computeApproachScale(1.0);
      expect(scaleStart).toBe(2.5);
      expect(scaleEnd).toBe(1.0);
    });

    it('options 및 getVisualConfig() 설정 조회가 정상 동작한다', () => {
      expect(renderer.options).toBeDefined();
      expect(renderer.options.travelDuration).toBe(0.5);
      expect(renderer.getVisualConfig()).toBeDefined();
      expect(renderer.getVisualConfig().baseRadius).toBe(28);
    });

    it('setImage() 및 getImage() 이미지 등록/조회가 정상 동작한다', () => {
      const mockImg = { id: 'star_test_img' };
      renderer.setImage('star_test', mockImg);
      expect(renderer.getImage('star_test')).toBe(mockImg);
    });
  });
});
