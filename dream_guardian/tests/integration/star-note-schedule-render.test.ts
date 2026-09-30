/**
 * star-note-schedule-render.test.ts - 실제 별 스케줄 기반 레일 비행·판정창·페이즈 표시 통합 테스트
 *
 * @see Issue #192 [RENDER-KEYNOTE-001]
 * @see Issue #235 [BUG-STAR-SCHEDULE-001]
 * @see Issue #232 [BUG-PHASE-PRESENTATION-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { StarNoteRenderer } from '../../src/render/StarNoteRenderer.js';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import type { FootKeynoteEvent } from '../../src/types/keynote.js';

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

describe('StarNote Schedule-to-Render Integration (Issue #192 - RENDER-KEYNOTE-001)', () => {
  let scheduler: StarNoteScheduler;
  let renderer: StarNoteRenderer;
  let adapter: PhasePresentationAdapter;
  let ctx: CanvasRenderingContext2D;

  const vw = 1080;
  const vh = 2160;
  const vx = 540;
  const vy = vh * 0.24; // 518.4
  const startTime = 10.0;

  beforeEach(() => {
    scheduler = new StarNoteScheduler({ secondsPerBeat: 0.5 });
    renderer = new StarNoteRenderer();
    adapter = new PhasePresentationAdapter();
    ctx = createMockContext();
  });

  describe('1. 7개 실제 스케줄 기반 레일 비행 및 원근 좌표 검증', () => {
    it('startTime에 1번째 노트(landingTime=10.5)가 소실점(progress=0, scale=0.3)에서 비행을 시작한다', () => {
      scheduler.start(startTime, { roundId: 1 });
      const notes = scheduler.activeNotes;
      expect(notes).toHaveLength(7);

      const note0 = notes[0];
      const pos0 = renderer.computeNotePosition(note0, startTime, vx, vy, vw, vh);

      expect(pos0.inFlight).toBe(true);
      expect(pos0.progress).toBeCloseTo(0, 4);
      expect(pos0.x).toBeCloseTo(vx, 2);
      expect(pos0.y).toBeCloseTo(vy, 2);
      expect(pos0.scale).toBeCloseTo(0.3, 2);

      // 나머지 6개 노트는 아직 비행 시작 전 (inFlight=false)
      for (let i = 1; i < 7; i++) {
        const pos = renderer.computeNotePosition(notes[i], startTime, vx, vy, vw, vh);
        expect(pos.inFlight).toBe(false);
      }
    });

    it('landingTime(10.5s)에 1번째 노트가 목표 존(Zone 10) 중심과 1px 이내 오차로 안착한다', () => {
      scheduler.start(startTime, { roundId: 1 });
      const note0 = scheduler.notes[0];
      const zone10 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 10)!;
      const zx = (zone10.x + zone10.width * 0.5) * vw;
      const zy = (zone10.y + zone10.height * 0.5) * vh;

      const pos0 = renderer.computeNotePosition(note0, 10.5, vx, vy, vw, vh);
      expect(pos0.inFlight).toBe(true);
      expect(pos0.progress).toBeCloseTo(1.0, 4);
      expect(Math.abs(pos0.x - zx)).toBeLessThan(1.0);
      expect(Math.abs(pos0.y - zy)).toBeLessThan(1.0);
      expect(pos0.scale).toBeCloseTo(1.2, 2);
    });
  });

  describe('2. 수집 완료 시 즉시 렌더링 제거 (수집완료 상태 반영)', () => {
    it('노트 수집 성공 시 다음 렌더링 프레임에서 해당 노트는 즉시 제거된다', () => {
      scheduler.start(startTime, { roundId: 1 });

      // t = 10.5s: 1번째 노트(foot, zone 10) 안착 시점
      renderer.render(ctx, vw, vh, {
        target: scheduler.currentTarget,
        targets: scheduler.activeNotes,
        elapsedTime: 10.5,
        vanishingX: vx,
        vanishingY: vy,
      });

      expect(ctx.stroke).toHaveBeenCalled();
      vi.clearAllMocks();

      // 발 입력으로 1번째 노트 수집
      const footEvent: FootKeynoteEvent = {
        foot: 'leftFoot',
        zoneId: 10,
        source: 'virtual',
        timestamp: 10.5,
        confidence: 0.95,
      };
      scheduler.fromFoot(footEvent, 10.5);

      expect(scheduler.notes[0].resolved).toBe(true);

      // 수집 직후 프레임: 1번째 노트는 더 이상 렌더링되지 않음
      const pos0 = renderer.computeNotePosition(scheduler.notes[0], 10.51, vx, vy, vw, vh);
      expect(pos0.inFlight).toBe(false);

      renderer.render(ctx, vw, vh, {
        target: scheduler.currentTarget,
        targets: scheduler.activeNotes,
        elapsedTime: 10.51,
        vanishingX: vx,
        vanishingY: vy,
      });

      // 1번째 노트(orange #FF865E)는 안 그려지고 2번째 노트(leftHand #28E6FF)만 비행 중
      expect(ctx.strokeStyle).toContain('28E6FF');
      expect(ctx.strokeStyle).not.toContain('FF865E');
    });
  });

  describe('3. Late 판정창(0.40s) 일치 및 마지막 노트(7번) 표시 검증', () => {
    it('미입력 시에도 landingTime + 0.40s까지 노트가 목표 존에 계속 표시된다', () => {
      scheduler.start(startTime, { roundId: 1 });
      const note0 = scheduler.notes[0]; // landingTime = 10.5

      // 10.80s: landingTime + 0.30s (0.40s lateWindow 이내)
      const posLate = renderer.computeNotePosition(note0, 10.80, vx, vy, vw, vh);
      expect(posLate.inFlight).toBe(true);
      expect(posLate.scale).toBeCloseTo(1.2, 2);

      // 10.95s: landingTime + 0.45s (0.40s lateWindow 만료 후)
      const posExpired = renderer.computeNotePosition(note0, 10.95, vx, vy, vw, vh);
      expect(posExpired.inFlight).toBe(false);
    });

    it('7번째 마지막 노트(landingTime=13.5s)가 13.90s까지 유지 표시되고 14.00s에 정산 준비 완료된다', () => {
      scheduler.start(startTime, { roundId: 1 });
      const note6 = scheduler.notes[6]; // landingTime = 13.5
      expect(note6.landingTime).toBeCloseTo(13.5, 4);

      // 13.80s: 착지 0.3s 경과 후에도 Late 판정창 내부이므로 렌더링 유지
      const posLastLate = renderer.computeNotePosition(note6, 13.80, vx, vy, vw, vh);
      expect(posLastLate.inFlight).toBe(true);

      // 13.91s: 만료
      const posLastExpired = renderer.computeNotePosition(note6, 13.91, vx, vy, vw, vh);
      expect(posLastExpired.inFlight).toBe(false);

      // 14.00s에 scheduler 완료 상태 검증
      scheduler.update(14.00);
      expect(scheduler.isComplete).toBe(true);
    });
  });

  describe('4. 화면 가림(Occlusion 0%) 및 일시정지(Pause) 동기화 검증', () => {
    it('STAR_COLLECT 페이즈에서는 별 렌더만 활성화되고 문제 수식 및 러닝 HUD는 완전히 비활성화된다', () => {
      const state = 'STAR_COLLECT';
      expect(adapter.canRenderStarCollect(state)).toBe(true);
      expect(adapter.canRenderQuestion(state)).toBe(false);
      expect(adapter.canRenderRunningHUD(state)).toBe(false);
      expect(adapter.canRenderHazardEvade(state)).toBe(false);
    });

    it('일시정지(pause) 상태에서 elapsedTime이 정지되면 별 노트의 좌표와 크기가 정확히 고정된다', () => {
      scheduler.start(startTime, { roundId: 1 });
      const pausedTime = 10.25;

      const posFrame1 = renderer.computeNotePosition(scheduler.notes[0], pausedTime, vx, vy, vw, vh);
      const posFrame2 = renderer.computeNotePosition(scheduler.notes[0], pausedTime, vx, vy, vw, vh);

      expect(posFrame1.x).toBe(posFrame2.x);
      expect(posFrame1.y).toBe(posFrame2.y);
      expect(posFrame1.scale).toBe(posFrame2.scale);
      expect(posFrame1.inFlight).toBe(true);
    });
  });
});
