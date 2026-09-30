/**
 * star-note-renderer.test.ts - 그리드 레일 궤적 기반 별가루 악기 노트 렌더러 단위 테스트
 *
 * @see Issue #192 [RENDER-KEYNOTE-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StarNoteRenderer,
  type StarNoteRenderState,
} from '../../src/render/StarNoteRenderer.js';
import type { ActiveStarTarget } from '../../src/input/StarCollectionInput.js';
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

describe('StarNoteRenderer (Issue #192 - RENDER-KEYNOTE-001)', () => {
  let renderer: StarNoteRenderer;
  let ctx: CanvasRenderingContext2D;

  const vw = 1080;
  const vh = 2160;
  const vx = 540;
  const vy = vh * 0.24; // 518.4

  beforeEach(() => {
    renderer = new StarNoteRenderer();
    ctx = createMockContext();
  });

  describe('1. 노트 실시간 비행 좌표 및 타이밍 계산 (computeNotePosition)', () => {
    const landingTime = 4.0;
    const target: ActiveStarTarget = {
      patternId: 'p1',
      part: 'leftHand',
      zoneId: 4, // 좌측 중단 존
      beatIndex: 1,
      landingTime,
    };

    const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
    const zone4CenterX = (zone4.x + zone4.width * 0.5) * vw;
    const zone4CenterY = (zone4.y + zone4.height * 0.5) * vh;

    it('비행 시작 시점(elapsedTime = landingTime - 0.5s)일 때 소실점 위치에 위치한다', () => {
      const pos = renderer.computeNotePosition(target, landingTime - 0.5, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(true);
      expect(pos.progress).toBeCloseTo(0, 4);
      expect(pos.x).toBeCloseTo(vx, 2);
      expect(pos.y).toBeCloseTo(vy, 2);
      expect(pos.scale).toBeCloseTo(0.3, 2);
    });

    it('elapsedTime == landingTime일 때 노트 중심이 목표 존 중심과 1px 이내로 일치한다', () => {
      const pos = renderer.computeNotePosition(target, landingTime, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(true);
      expect(pos.progress).toBeCloseTo(1.0, 4);
      expect(Math.abs(pos.x - zone4CenterX)).toBeLessThan(1.0);
      expect(Math.abs(pos.y - zone4CenterY)).toBeLessThan(1.0);
      expect(pos.scale).toBeCloseTo(1.2, 2);
    });

    it('비행 시간 이전(elapsedTime < landingTime - 0.5s)일 때 inFlight=false를 반환한다', () => {
      const pos = renderer.computeNotePosition(target, landingTime - 1.0, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(false);
      expect(pos.progress).toBeLessThan(0);
    });

    it('Late 판정 윈도우 내부(landingTime <= elapsedTime <= landingTime + 0.40s)일 때 inFlight=true를 유지한다 (Issue #192)', () => {
      // 0.35s 경과는 0.40s lateWindow 이내이므로 노트가 계속 표시되어야 함
      const pos = renderer.computeNotePosition(target, landingTime + 0.35, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(true);
      expect(pos.scale).toBeCloseTo(1.2, 2);
      expect(Math.abs(pos.x - zone4CenterX)).toBeLessThan(1.0);
      expect(Math.abs(pos.y - zone4CenterY)).toBeLessThan(1.0);
    });

    it('Late 판정 만료 이후(elapsedTime > landingTime + 0.40s)일 때 inFlight=false를 반환한다 (Issue #192)', () => {
      const pos = renderer.computeNotePosition(target, landingTime + 0.45, vx, vy, vw, vh);
      expect(pos.inFlight).toBe(false);
    });

    it('수집 완료(resolved=true 또는 isCollected=true)된 노트는 inFlight=false를 반환한다 (Issue #192)', () => {
      const resolvedTarget = { ...target, resolved: true };
      const posResolved = renderer.computeNotePosition(resolvedTarget as any, landingTime, vx, vy, vw, vh);
      expect(posResolved.inFlight).toBe(false);

      const collectedTarget = { ...target, isCollected: true };
      const posCollected = renderer.computeNotePosition(collectedTarget as any, landingTime, vx, vy, vw, vh);
      expect(posCollected.inFlight).toBe(false);
    });
  });

  describe('2. 타겟 부재, 수집 완료 및 비행 외 상태의 렌더링 무동작 검증', () => {
    it('target이 null일 때 캔버스에 어떤 드로잉도 하지 않는다', () => {
      const state: StarNoteRenderState = {
        target: null,
        elapsedTime: 4.0,
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.fillText).not.toHaveBeenCalled();
      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it('수집 완료(resolved=true 또는 isCollected=true)된 단일 타겟은 캔버스에 어떤 드로잉도 하지 않는다 (Issue #192)', () => {
      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
        resolved: true,
      } as any;

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 4.0,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it('targets 목록 중 이미 resolved된 노트는 제외하고 미해결 노트만 렌더링한다 (Issue #192)', () => {
      const noteResolved: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
        resolved: true,
      } as any;

      const noteActive: ActiveStarTarget = {
        patternId: 'p2',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 2,
        landingTime: 4.5,
        resolved: false,
      } as any;

      renderer.render(ctx, vw, vh, {
        targets: [noteResolved, noteActive],
        elapsedTime: 4.3, // noteActive(4.5s)는 비행 중 (4.0 ~ 4.5)
        vanishingX: vx,
        vanishingY: vy,
      });

      // noteActive(rightHand, #FFCB4D)만 렌더링되어야 함
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.strokeStyle).toContain('FFCB4D');
      expect(ctx.strokeStyle).not.toContain('28E6FF'); // leftHand는 안 그려짐
    });

    it('비행 시간 이전(아직 출현 전)일 때 어떤 드로잉도 하지 않는다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 1,
        landingTime: 4.0,
      };
      const state: StarNoteRenderState = {
        target,
        elapsedTime: 2.0, // 2초 전 (travelDuration 0.5s 이전)
        vanishingX: vx,
        vanishingY: vy,
      };

      renderer.render(ctx, vw, vh, state);

      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
    });
  });

  describe('3. 신체 부위별 4색 테두리 및 비주얼 렌더링', () => {
    it('왼손(leftHand) 타겟일 때 시안(#28E6FF) 색상으로 렌더링된다', () => {
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
      expect(ctx.strokeStyle).toContain('28E6FF');
      expect(ctx.fillText).toHaveBeenCalledWith('★', expect.any(Number), expect.any(Number));
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('오른손(rightHand) 타겟일 때 노랑(#FFCB4D) 색상으로 렌더링된다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p2',
        part: 'rightHand',
        zoneId: 3,
        beatIndex: 2,
        landingTime: 4.0,
      };
      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.strokeStyle).toContain('FFCB4D');
    });

    it('머리(head) 타겟일 때 보라(#C889FF) 색상으로 렌더링된다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p3',
        part: 'head',
        zoneId: 2,
        beatIndex: 3,
        landingTime: 4.0,
      };
      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.strokeStyle).toContain('C889FF');
    });

    it('골반(hip) 타겟일 때 주황(#FF865E) 색상으로 렌더링된다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p4',
        part: 'hip',
        zoneId: 10,
        beatIndex: 4,
        landingTime: 4.0,
      };
      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.8,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.strokeStyle).toContain('FF865E');
    });
  });

  describe('4. 안착 직전(±0.12s Perfect 판정 윈도우) 목표 존 테두리 펄스 링 연출', () => {
    it('안착 0.05s 전(Perfect 윈도우 내)에 목표 존 테두리 펄스 링이 그려진다', () => {
      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime: 4.0,
      };

      renderer.render(ctx, vw, vh, {
        target,
        elapsedTime: 3.95, // 0.05s 전 -> Perfect 윈도우(0.12s) 내부
        vanishingX: vx,
        vanishingY: vy,
      });

      // 목표 존에 펄스 링 또는 하이라이트가 발생해야 함 (roundRect, strokeRect, 또는 arc/ellipse)
      const strokeCalls = vi.mocked(ctx.stroke).mock.calls.length;
      expect(strokeCalls).toBeGreaterThanOrEqual(2); // 노트 테두리 + 목표 존 펄스 링
    });
  });
});
