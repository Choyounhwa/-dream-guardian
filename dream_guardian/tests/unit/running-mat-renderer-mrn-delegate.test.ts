/**
 * running-mat-renderer-mrn-delegate.test.ts - RunningMatRenderer 발 스텝 위임 및 원형 링 단위 테스트
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§9 MRN-08, §9.1 BUG #473 해소, §8 레이어별 책임)
 * @see Issue #482 [MRN-08]
 * @see Issue #473 [BUG-NOTE-CIRCLE-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunningMatRenderer } from '../../src/render/RunningMatRenderer.js';
import { MotionNoteRenderer } from '../../src/render/MotionNoteRenderer.js';
import { CircleRingPainter } from '../../src/render/note-painters/NotePainters.js';
import type { RunningMatViewModel } from '../../src/render/RunningMatPresenter.js';
import {
  DEFAULT_STRIKE_LINE_Y_RATIO,
  RUNNING_MAT_CONFIG,
} from '../../config/running-mat.config.js';
import { DEFAULT_LANE_OFFSET } from '../../src/render/NoteAnchorResolver.js';

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
    measureText: vi.fn().mockReturnValue({ width: 60 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    setLineDash: vi.fn(),
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

function createBaseViewModel(overrides: Partial<RunningMatViewModel> = {}): RunningMatViewModel {
  return {
    visible: true,
    paused: false,
    currentCue: {
      beatIndex: 0,
      actionId: 'left_out',
      actionText: '왼발 벌리기',
      directionText: '왼쪽',
      cueText: '왼발 바깥으로!',
      arrowDirection: 'left',
      leftFootSlot: 'out',
      rightFootSlot: 'home',
      isPrepare: false,
    },
    nextCue: null,
    nextRingRatio: 0,
    actionText: '왼발 벌리기',
    directionText: '왼쪽',
    cueText: '왼발 바깥으로!',
    arrowDirection: 'left',
    elapsedBeats: 0,
    acceptedExerciseCount: 0,
    requiredExerciseCount: 4,
    isShortage: false,
    isPreparing: false,
    upcomingCues: [],
    ...overrides,
  };
}

describe('[Issue #482 / MRN-08] RunningMatRenderer 발 스텝 MotionNoteRenderer 위임 및 원형 링 적용 검증', () => {
  let ctx: CanvasRenderingContext2D;
  const width = 1280;
  const height = 720;
  const vx = 640;
  const vy = height * 0.38;

  beforeEach(() => {
    ctx = createMockContext();
  });

  describe('1. MotionNoteRenderer 인스턴스 보유 및 의존성 주입 지원', () => {
    it('RunningMatRenderer 생성 시 motionNoteRenderer 인스턴스가 기본 초기화된다', () => {
      const renderer = new RunningMatRenderer();
      expect(renderer.motionNoteRenderer).toBeDefined();
      expect(renderer.motionNoteRenderer).toBeInstanceOf(MotionNoteRenderer);
    });

    it('생성자를 통해 외부 MotionNoteRenderer 인스턴스를 주입받을 수 있다', () => {
      const customMRN = new MotionNoteRenderer();
      const renderer = new RunningMatRenderer(RUNNING_MAT_CONFIG, customMRN);
      expect(renderer.motionNoteRenderer).toBe(customMRN);
    });
  });

  describe('2. 비행 스톰프 노트(_renderFlyingStompNotes)의 MotionNoteRenderer 위임 렌더링 검증', () => {
    it('upcomingCues 큐 목록이 있을 때 MotionNoteRenderer.render로 위임 호출된다', () => {
      const renderer = new RunningMatRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      const view = createBaseViewModel({
        upcomingCues: [
          {
            targetBeat: 2,
            remainingBeats: 0.5,
            progress: 0.5,
            phase: 'lift',
            cue: {
              id: 'cue_left_1',
              actionText: '왼무릎 들기',
              directionText: '왼쪽',
              cueText: '왼무릎 들고 복귀',
              arrowDirection: 'up',
              leftFootSlot: 'lift',
              rightFootSlot: 'home',
            },
          },
        ],
      });

      renderer.render(ctx, view, width, height, { vanishingPoint: { x: vx, y: vy } });

      expect(spy).toHaveBeenCalledTimes(1);
      const callArgs = spy.mock.calls[0];
      expect(callArgs[0]).toBeDefined();

      const items = callArgs[1];
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('cue_left_1');
      expect(items[0].profileId).toBe('stomp_foot');
      expect(items[0].interaction).toBe('tap');
      expect(items[0].progress).toBeCloseTo(0.5, 2);
      expect(items[0].requirements[0].part).toBe('leftFoot');
      expect(items[0].requirements[0].zoneId).toBe(9);

      // viewport & vanishingPoint 전달 검증
      expect(callArgs[2]).toEqual({ width, height });
      expect(callArgs[3]).toEqual({ x: vx, y: vy });

      // floorLayout 전달 검증
      expect(callArgs[5]).toBeDefined();
      expect(callArgs[5]?.strikeLineYRatio).toBe(renderer['config'].strikeLineYRatio ?? DEFAULT_STRIKE_LINE_Y_RATIO);
      expect(callArgs[5]?.laneOffset).toBe(DEFAULT_LANE_OFFSET);
    });

    it('upcomingCues가 비어있고 nextCue만 있을 때 fallback으로 nextCue가 위임 변환되어 렌더링된다', () => {
      const renderer = new RunningMatRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      const view = createBaseViewModel({
        upcomingCues: [],
        nextCue: {
          beatIndex: 3,
          actionId: 'knee_right',
          actionText: '오른무릎 들기',
          directionText: '오른쪽',
          cueText: '오른무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'home',
          rightFootSlot: 'lift',
          isPrepare: false,
        },
        nextRingRatio: 0.2, // remainingBeats = 0.2 -> progress = 0.8
      });

      renderer.render(ctx, view, width, height);

      expect(spy).toHaveBeenCalledTimes(1);
      const items = spy.mock.calls[0][1];
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('knee_right');
      expect(items[0].profileId).toBe('stomp_foot');
      expect(items[0].progress).toBeCloseTo(0.8, 2);
      expect(items[0].requirements[0].part).toBe('rightFoot');
      expect(items[0].requirements[0].zoneId).toBe(11);
    });

    it('큐의 방향(좌/중앙/우)에 따라 PartRequirement가 정확히 매핑된다', () => {
      const renderer = new RunningMatRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      const view = createBaseViewModel({
        upcomingCues: [
          {
            targetBeat: 1,
            remainingBeats: 0.8,
            progress: 0.2,
            phase: 'lift',
            cue: {
              id: 'left_step',
              actionText: '왼발 스텝',
              directionText: '왼쪽',
              cueText: '왼발 쿵',
              arrowDirection: 'left',
              leftFootSlot: 'out',
              rightFootSlot: 'home',
            },
          },
          {
            targetBeat: 2,
            remainingBeats: 0.5,
            progress: 0.5,
            phase: 'lift',
            cue: {
              id: 'center_stomp',
              actionText: '제자리 스탬프',
              directionText: '가운데',
              cueText: '중앙 쿵',
              arrowDirection: 'down',
              leftFootSlot: 'home',
              rightFootSlot: 'home',
            },
          },
          {
            targetBeat: 3,
            remainingBeats: 0.2,
            progress: 0.8,
            phase: 'lift',
            cue: {
              id: 'right_step',
              actionText: '오른발 스텝',
              directionText: '오른쪽',
              cueText: '오른발 쿵',
              arrowDirection: 'right',
              leftFootSlot: 'home',
              rightFootSlot: 'out',
            },
          },
        ],
      });

      renderer.render(ctx, view, width, height);

      expect(spy).toHaveBeenCalledTimes(1);
      const items = spy.mock.calls[0][1];
      expect(items.length).toBe(3);

      expect(items[0].requirements[0].part).toBe('leftFoot');
      expect(items[0].requirements[0].zoneId).toBe(9);

      expect(items[1].requirements[0].part).toBe('centerFoot');
      expect(items[1].requirements[0].zoneId).toBe(10);

      expect(items[2].requirements[0].part).toBe('rightFoot');
      expect(items[2].requirements[0].zoneId).toBe(11);
    });

    it('view가 null이거나 큐가 전혀 없으면 MotionNoteRenderer.render가 호출되지 않는다', () => {
      const renderer = new RunningMatRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      renderer.render(ctx, null, width, height);
      expect(spy).not.toHaveBeenCalled();

      const emptyView = createBaseViewModel({ upcomingCues: [], nextCue: null });
      renderer.render(ctx, emptyView, width, height);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('3. #473 결함 해소: 발 스텝 비행 시 원형 어프로치 링(Circle Ring) 동시 렌더링 검증', () => {
    it('발 스텝 노트 비행 시 원형 어프로치 링(Circle Ring)이 목표 판정선 앵커에 그려진다', () => {
      const renderer = new RunningMatRenderer();

      const view = createBaseViewModel({
        nextCue: {
          beatIndex: 1,
          actionId: 'knee_left',
          actionText: '왼무릎 들기',
          directionText: '왼쪽',
          cueText: '왼무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'lift',
          rightFootSlot: 'home',
          isPrepare: false,
        },
        nextRingRatio: 0.4, // progress = 0.6
      });

      renderer.render(ctx, view, width, height);

      // CircleRingPainter 및 OrbBodyPainter에 의해 ctx.arc()가 호출됨
      const arcCalls = vi.mocked(ctx.arc).mock.calls;
      expect(arcCalls.length).toBeGreaterThanOrEqual(2);

      // 목표 앵커 판정선 Y 좌표(height * strikeLineYRatio)
      const expectedY = height * (renderer['config'].strikeLineYRatio ?? DEFAULT_STRIKE_LINE_Y_RATIO);

      // 어프로치 링: 판정선 Y 좌표에서 수축 링 호가 그려졌는지 확인 (#473 기능 해소 핵심 증빙)
      const hasAnchorRingArc = arcCalls.some(
        (c) => Math.abs(c[1] - expectedY) < 1.0 && c[2] > 0
      );
      expect(hasAnchorRingArc).toBe(true);
    });

    it('진행도에 따라 원형 어프로치 링이 startScale(2.2)에서 endScale(1.0) 방향으로 수축한다', () => {
      const renderer = new RunningMatRenderer();
      const drawSpy = vi.spyOn(CircleRingPainter.prototype, 'draw');

      // 출발 시점 (progress = 0.0)
      const viewStart = createBaseViewModel({
        nextCue: {
          beatIndex: 1,
          actionId: 'knee_left',
          actionText: '왼무릎 들기',
          directionText: '왼쪽',
          cueText: '왼무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'lift',
          rightFootSlot: 'home',
          isPrepare: false,
        },
        nextRingRatio: 1.0, // progress = 0.0
      });
      renderer.render(ctx, viewStart, width, height);

      expect(drawSpy).toHaveBeenCalled();
      const scaleStart = drawSpy.mock.calls[0][2];
      expect(scaleStart).toBeCloseTo(2.2, 1);

      // 착지 직전 시점 (progress = 1.0)
      const ctxEnd = createMockContext();
      const viewEnd = createBaseViewModel({
        nextCue: {
          beatIndex: 1,
          actionId: 'knee_left',
          actionText: '왼무릎 들기',
          directionText: '왼쪽',
          cueText: '왼무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'lift',
          rightFootSlot: 'home',
          isPrepare: false,
        },
        nextRingRatio: 0.0, // progress = 1.0
      });
      renderer.render(ctxEnd, viewEnd, width, height);

      const scaleEnd = drawSpy.mock.calls[1][2];
      expect(scaleEnd).toBeCloseTo(1.0, 1);

      // startScale > endScale 수축 검증 (2.2배 -> 1.0배)
      expect(scaleStart).toBeGreaterThan(scaleEnd);
      expect(scaleStart / scaleEnd).toBeCloseTo(2.2, 1);
    });

    it('발 레인별로 링과 바디의 네온 색상(좌: #00E5FF, 우: #FF8800)이 적용된다', () => {
      const renderer = new RunningMatRenderer();
      const drawSpy = vi.spyOn(CircleRingPainter.prototype, 'draw');

      // 좌측 큐: leftFoot -> #00E5FF
      const viewLeft = createBaseViewModel({
        nextCue: {
          beatIndex: 1,
          actionId: 'knee_left',
          actionText: '왼무릎 들기',
          directionText: '왼쪽',
          cueText: '왼무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'lift',
          rightFootSlot: 'home',
          isPrepare: false,
        },
        nextRingRatio: 0.5,
      });
      renderer.render(ctx, viewLeft, width, height);

      expect(drawSpy).toHaveBeenCalled();
      expect(drawSpy.mock.calls[0][3].color).toBe('#00E5FF');

      // 우측 큐: rightFoot -> #FF8800
      const ctxRight = createMockContext();
      const viewRight = createBaseViewModel({
        nextCue: {
          beatIndex: 1,
          actionId: 'knee_right',
          actionText: '오른무릎 들기',
          directionText: '오른쪽',
          cueText: '오른무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'home',
          rightFootSlot: 'lift',
          isPrepare: false,
        },
        nextRingRatio: 0.5,
      });
      renderer.render(ctxRight, viewRight, width, height);

      expect(drawSpy.mock.calls[1][3].color).toBe('#FF8800');
    });
  });

  describe('4. 바닥 무대(격자, 판정선, 레인 앵커) 및 기존 공개 API 100% 보존 검증', () => {
    it('triggerMotionHit 및 hitFlashIntensity 상태가 정상 작동한다', () => {
      const renderer = new RunningMatRenderer();
      expect(renderer.hitFlashIntensity).toBe(0);

      renderer.triggerMotionHit();
      expect(renderer.hitFlashIntensity).toBeGreaterThan(0.8);
    });

    it('바닥 무대의 판정선, 발자국 슬롯, 방향 가이드, 상태 헤더가 모두 온전히 렌더링된다', () => {
      const renderer = new RunningMatRenderer();
      const view = createBaseViewModel({
        actionText: '왼발 벌리기',
      });

      renderer.render(ctx, view, width, height);

      // 격자 및 베이스 사각형/선 렌더링 확인
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();

      // 헤더 및 안내 텍스트 렌더링 확인
      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const texts = fillTextCalls.map((c) => String(c[0]));
      expect(texts.some((t) => t.includes('왼발 벌리기'))).toBe(true);
      expect(texts.some((t) => t.includes('인정:'))).toBe(true);
    });

    it('view가 null인 앰비언트 모드에서도 판정선은 정상 렌더링되고 비행 노트는 생략된다', () => {
      const renderer = new RunningMatRenderer();
      const spy = vi.spyOn(renderer.motionNoteRenderer, 'render');

      renderer.render(ctx, null, width, height);

      // 판정선 렌더링 검증
      expect(ctx.shadowBlur).toBeGreaterThanOrEqual(20);
      expect(ctx.shadowColor).toBe('#FF6600');
      // 비행 노트 렌더러 미호출 검증
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
