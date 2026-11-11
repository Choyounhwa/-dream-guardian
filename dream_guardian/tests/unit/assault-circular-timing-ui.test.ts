import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config.js';
import { AssaultPairPainter, type AssaultPairRenderSnapshot } from '../../src/render/AssaultPairPainter.js';

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

describe('[ASSAULT-VIS-CARD-001] 원형 펄스 테두리 답안 UI, 점진적 투명도 및 리듬 타이밍 가이드', () => {
  let ctx: CanvasRenderingContext2D;
  const viewport = { width: 1280, height: 720 };

  beforeEach(() => {
    ctx = createMockContext();
  });

  describe('1. 설정 검증 (config/assault-visual.config.ts)', () => {
    it('좌측 선택지는 시안(#28E6FF), 우측 선택지는 보라(#C889FF) 계열이어야 한다', () => {
      const colors = (DEFAULT_ASSAULT_VISUAL_CONFIG as any).colors;
      expect(colors.leftChoice.toUpperCase()).toBe('#28E6FF');
      expect(colors.rightChoice.toUpperCase()).toBe('#C889FF');
    });
  });

  describe('2. 답안 원형(Circle) UI 및 두꺼운 펄스 테두리 렌더링', () => {
    it('답안 카드 드로잉 시 네모 박스가 아닌 원형(ctx.arc)으로 그려져야 한다', () => {
      const painter = new AssaultPairPainter();
      const snapshot: AssaultPairRenderSnapshot = {
        leftText: '3',
        rightText: '8',
        progress: 1.0,
        status: 'inFlight',
      };

      painter.render(ctx, snapshot, viewport);

      // 좌/우 답안 카드 본체가 ctx.arc를 호출했는지 확인
      const anchors = painter.getAnchors(viewport);
      const arcCalls = (ctx.arc as any).mock.calls;

      // 좌측 타깃 중심 원형 카드 확인
      const leftChoiceArcs = arcCalls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.leftTarget.x) < 2 && Math.abs(call[1] - anchors.leftTarget.y) < 2,
      );
      expect(leftChoiceArcs.length).toBeGreaterThanOrEqual(1);

      // 우측 타깃 중심 원형 카드 확인
      const rightChoiceArcs = arcCalls.filter(
        (call: number[]) => Math.abs(call[0] - anchors.rightTarget.x) < 2 && Math.abs(call[1] - anchors.rightTarget.y) < 2,
      );
      expect(rightChoiceArcs.length).toBeGreaterThanOrEqual(1);
    });

    it('답안 테두리 선 두께(lineWidth)는 4.0 이상이어야 하고 네온 글로우가 적용되어야 한다', () => {
      const painter = new AssaultPairPainter();
      const snapshot: AssaultPairRenderSnapshot = {
        leftText: '3',
        rightText: '8',
        progress: 0.9,
        status: 'inFlight',
      };

      painter.render(ctx, snapshot, viewport);

      // ctx.lineWidth가 두꺼운 값(4 이상)으로 설정된 적이 있어야 함
      expect(ctx.lineWidth).toBeGreaterThanOrEqual(4.0);
    });
  });

  describe('3. 점진적 투명도(Fade-in) 출현 (10% -> 100%)', () => {
    it('progress가 0.0일 때 투명도는 0.10(10%) 부근이어야 한다', () => {
      const painter = new AssaultPairPainter();
      const alphaValues: number[] = [];

      // ctx.globalAlpha 변경 시 추적
      let currentAlpha = 1.0;
      Object.defineProperty(ctx, 'globalAlpha', {
        get: () => currentAlpha,
        set: (v: number) => {
          currentAlpha = v;
          alphaValues.push(v);
        },
      });

      painter.render(ctx, { leftText: '1', rightText: '2', progress: 0.0, status: 'inFlight' }, viewport);

      // 최소 투명도 값이 0.10(±0.05) 범위 내에 있어야 함
      const minAlpha = Math.min(...alphaValues);
      expect(minAlpha).toBeCloseTo(0.1, 1);
    });

    it('progress가 1.0(착지 시점)일 때 투명도는 1.0(100%)이어야 한다', () => {
      const painter = new AssaultPairPainter();
      const alphaValues: number[] = [];

      let currentAlpha = 1.0;
      Object.defineProperty(ctx, 'globalAlpha', {
        get: () => currentAlpha,
        set: (v: number) => {
          currentAlpha = v;
          alphaValues.push(v);
        },
      });

      painter.render(ctx, { leftText: '1', rightText: '2', progress: 1.0, status: 'inFlight' }, viewport);

      // 카드 본체 드로잉 시점의 투명도 중 1.0이 존재해야 함
      expect(alphaValues).toContain(1.0);
    });
  });

  describe('4. 판정 타이밍 가이드 (고정 기준 링 + 수축 어프로치 링 + 저스트 플래시)', () => {
    it('착지 직전(progress >= 0.88) 구간에서는 저스트 타이밍 플래시가 적용되어야 한다', () => {
      const painter = new AssaultPairPainter();
      const strokeStyles: string[] = [];

      let currentStroke = '#ffffff';
      Object.defineProperty(ctx, 'strokeStyle', {
        get: () => currentStroke,
        set: (v: string) => {
          currentStroke = v;
          strokeStyles.push(String(v).toUpperCase());
        },
      });

      painter.render(ctx, { leftText: '5', rightText: '9', progress: 0.95, status: 'inFlight' }, viewport);

      // 저스트 타이밍 플래시(백색/골드 등 강렬한 하이라이트 색상)가 strokeStyle로 적용되었는지 검증
      const hasFlash = strokeStyles.some(s => s === '#FFFFFF' || s === '#FFCB4D' || s.includes('255, 255, 255'));
      expect(hasFlash).toBe(true);
    });
  });

  describe('5. 불필요한 시각 노이즈(중앙 연결 점선) 제거 검증', () => {
    it('좌우 답안 사이를 가로지르는 중앙 점선(setLineDash([4, 4])) 드로잉이 없어야 한다', () => {
      const painter = new AssaultPairPainter();
      painter.render(ctx, { leftText: '5', rightText: '9', progress: 0.5, status: 'inFlight' }, viewport);

      const setLineDashCalls = (ctx.setLineDash as any).mock.calls;
      const hasCenterConnectionDash = setLineDashCalls.some(
        (call: number[][]) => Array.isArray(call[0]) && call[0][0] === 4 && call[0][1] === 4,
      );
      expect(hasCenterConnectionDash).toBe(false);
    });
  });
});
