import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
  type AssaultVisualConfig,
} from '../../config/assault-visual.config.js';
import {
  AssaultPairPainter,
  type AssaultPairRenderSnapshot,
} from '../../src/render/AssaultPairPainter.js';
import { projectFlight } from '../../src/render/NoteProjection.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    canvas: { width: 1280, height: 720 },
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 60 }),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '#ffffff',
    strokeStyle: '#ffffff',
    lineWidth: 1,
    globalAlpha: 1.0,
    shadowColor: 'transparent',
    shadowBlur: 0,
    font: '16px sans-serif',
    textAlign: 'center',
    textBaseline: 'middle',
  } as unknown as CanvasRenderingContext2D;
}

describe('[ASSAULT-TRAIL-001] 원형 답안 줌인 비행 원근 속도감 Trail (고스트 잔상) 효과 (Issue #713)', () => {
  let painter: AssaultPairPainter;
  let ctx: CanvasRenderingContext2D;
  const viewport = { width: 1280, height: 720 };

  beforeEach(() => {
    painter = new AssaultPairPainter(DEFAULT_ASSAULT_VISUAL_CONFIG);
    ctx = createMockContext();
  });

  describe('1. 설정 검증 (assault-visual.config.ts)', () => {
    it('DEFAULT_ASSAULT_VISUAL_CONFIG에 ghostTrail 설정이 정의되어 있어야 한다', () => {
      const ghostTrail = (DEFAULT_ASSAULT_VISUAL_CONFIG as any).ghostTrail;
      expect(ghostTrail).toBeDefined();
      expect(ghostTrail.enabled).toBe(true);
      expect(ghostTrail.stepOffsets).toEqual([0.035, 0.070, 0.105]);
      expect(ghostTrail.alphas).toEqual([0.28, 0.20, 0.12]);
    });

    it('ghostTrail 설정은 불변(freeze) 상태여야 한다', () => {
      const ghostTrail = (DEFAULT_ASSAULT_VISUAL_CONFIG as any).ghostTrail;
      expect(Object.isFrozen(ghostTrail)).toBe(true);
    });
  });

  describe('2. _renderApproachTrail 메서드 및 비행 중 잔상 렌더링 검증', () => {
    it('AssaultPairPainter에 _renderApproachTrail 메서드가 구현되어 있어야 한다', () => {
      expect(typeof (painter as any)._renderApproachTrail).toBe('function');
    });

    it('비행 중(progress = 0.5)일 때 3단계 고스트 위치에 시안/보라 펄스 링이 렌더링되어야 한다', () => {
      const snapshot: AssaultPairRenderSnapshot = {
        leftText: '3',
        rightText: '7',
        progress: 0.5,
        status: 'inFlight',
      };

      painter.render(ctx, snapshot, viewport);

      // _renderApproachTrail에 의해 arc 및 stroke가 호출됨
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();

      // progress = 0.5에서 3단계(0.465, 0.430, 0.395)의 좌/우 고스트 링 좌표 확인
      const anchors = painter.getAnchors(viewport);
      const expectedProgresses = [0.5 - 0.035, 0.5 - 0.070, 0.5 - 0.105];

      for (const p of expectedProgresses) {
        const flightLeft = projectFlight(
          anchors.leftLaunch.x,
          anchors.leftLaunch.y,
          anchors.leftTarget.x,
          anchors.leftTarget.y,
          p,
          { minScale: 0.45, maxScale: 1.0, easingExponent: 2.0 },
        );
        const flightRight = projectFlight(
          anchors.rightLaunch.x,
          anchors.rightLaunch.y,
          anchors.rightTarget.x,
          anchors.rightTarget.y,
          p,
          { minScale: 0.45, maxScale: 1.0, easingExponent: 2.0 },
        );

        // 해당 좌표로 arc가 호출되었는지 검증
        const arcCalls = (ctx.arc as any).mock.calls;
        const leftArcFound = arcCalls.some(
          (call: number[]) => Math.abs(call[0] - flightLeft.x) < 0.1 && Math.abs(call[1] - flightLeft.y) < 0.1,
        );
        const rightArcFound = arcCalls.some(
          (call: number[]) => Math.abs(call[0] - flightRight.x) < 0.1 && Math.abs(call[1] - flightRight.y) < 0.1,
        );

        expect(leftArcFound).toBe(true);
        expect(rightArcFound).toBe(true);
      }
    });

    it('_renderApproachTrail 직접 호출 시 거리 비례 감쇠 투명도(0.28, 0.20, 0.12)가 적용되어야 한다', () => {
      const anchors = painter.getAnchors(viewport);
      const alphaHistory: number[] = [];

      // ctx.save 시점 또는 globalAlpha 변경 감지
      Object.defineProperty(ctx, 'globalAlpha', {
        set(val: number) {
          alphaHistory.push(val);
        },
        get() {
          return 1.0;
        },
        configurable: true,
      });

      (painter as any)._renderApproachTrail(
        ctx,
        anchors,
        100,
        100,
        0.5,
        'inFlight',
        DEFAULT_ASSAULT_VISUAL_CONFIG.colors,
        DEFAULT_ASSAULT_VISUAL_CONFIG,
      );

      // 감쇠 투명도 0.28, 0.20, 0.12가 포함되어야 함
      expect(alphaHistory).toContain(0.28);
      expect(alphaHistory).toContain(0.20);
      expect(alphaHistory).toContain(0.12);
    });
  });

  describe('3. 제로 오버헤드 (Zero Overhead) 및 경계 조건 검증', () => {
    it('착지 완료(progress >= 1.0) 시 트레일 연산 및 드로잉이 수행되지 않아야 한다', () => {
      const anchors = painter.getAnchors(viewport);
      const strokeCallsBefore = (ctx.stroke as any).mock.calls.length;
      const arcCallsBefore = (ctx.arc as any).mock.calls.length;

      (painter as any)._renderApproachTrail(
        ctx,
        anchors,
        100,
        100,
        1.0,
        'inFlight',
        DEFAULT_ASSAULT_VISUAL_CONFIG.colors,
        DEFAULT_ASSAULT_VISUAL_CONFIG,
      );

      expect((ctx.stroke as any).mock.calls.length).toBe(strokeCallsBefore);
      expect((ctx.arc as any).mock.calls.length).toBe(arcCallsBefore);
    });

    it('대기 중(progress <= 0) 시 트레일 연산 및 드로잉이 수행되지 않아야 한다', () => {
      const anchors = painter.getAnchors(viewport);
      const strokeCallsBefore = (ctx.stroke as any).mock.calls.length;
      const arcCallsBefore = (ctx.arc as any).mock.calls.length;

      (painter as any)._renderApproachTrail(
        ctx,
        anchors,
        100,
        100,
        0.0,
        'pending',
        DEFAULT_ASSAULT_VISUAL_CONFIG.colors,
        DEFAULT_ASSAULT_VISUAL_CONFIG,
      );

      expect((ctx.stroke as any).mock.calls.length).toBe(strokeCallsBefore);
      expect((ctx.arc as any).mock.calls.length).toBe(arcCallsBefore);
    });

    it('비행 상태가 아닐 때(negated, disarmed, cancelled) 트레일 연산 및 드로잉이 수행되지 않아야 한다', () => {
      const anchors = painter.getAnchors(viewport);
      const nonFlightStatuses = ['negated', 'disarmed', 'cancelled'] as const;

      for (const status of nonFlightStatuses) {
        (ctx.stroke as any).mockClear();
        (ctx.arc as any).mockClear();

        (painter as any)._renderApproachTrail(
          ctx,
          anchors,
          100,
          100,
          0.5,
          status,
          DEFAULT_ASSAULT_VISUAL_CONFIG.colors,
          DEFAULT_ASSAULT_VISUAL_CONFIG,
        );

        expect((ctx.stroke as any).mock.calls.length).toBe(0);
        expect((ctx.arc as any).mock.calls.length).toBe(0);
      }
    });

    it('ghostTrail.enabled가 false로 설정된 경우 트레일이 그려지지 않아야 한다', () => {
      const disabledConfig: AssaultVisualConfig = {
        ...DEFAULT_ASSAULT_VISUAL_CONFIG,
        ghostTrail: {
          enabled: false,
          stepOffsets: [0.035, 0.070, 0.105],
          alphas: [0.28, 0.20, 0.12],
        },
      };

      const anchors = painter.getAnchors(viewport);
      (ctx.stroke as any).mockClear();
      (ctx.arc as any).mockClear();

      (painter as any)._renderApproachTrail(
        ctx,
        anchors,
        100,
        100,
        0.5,
        'inFlight',
        disabledConfig.colors,
        disabledConfig,
      );

      expect((ctx.stroke as any).mock.calls.length).toBe(0);
      expect((ctx.arc as any).mock.calls.length).toBe(0);
    });

    it('초기 비행(progress = 0.05)에서는 progress - offset > 0 인 유효 잔상만 그려져야 한다', () => {
      const anchors = painter.getAnchors(viewport);
      (ctx.arc as any).mockClear();

      // progress = 0.05:
      // 0.05 - 0.035 = 0.015 > 0 -> 1단계 (좌/우 2개)
      // 0.05 - 0.070 = -0.02 <= 0 -> 스킵
      // 0.05 - 0.105 = -0.055 <= 0 -> 스킵
      (painter as any)._renderApproachTrail(
        ctx,
        anchors,
        100,
        100,
        0.05,
        'inFlight',
        DEFAULT_ASSAULT_VISUAL_CONFIG.colors,
        DEFAULT_ASSAULT_VISUAL_CONFIG,
      );

      expect((ctx.arc as any).mock.calls.length).toBe(2);
    });
  });
});
