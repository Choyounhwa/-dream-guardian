import { describe, it, expect, vi } from 'vitest';
import { EditorCanvasRenderer } from '../../src/editor/EditorCanvasRenderer.js';
import { DEFAULT_CAT_CHOREO_PATTERNS } from '../../src/data/danceRoutineData.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    clearRect: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('EditorCanvasRenderer - 11개 피트니스 존 및 포즈 시각화 (Phase 1/2)', () => {
  it('캔버스에 11개 피트니스 존과 신체 부위 배치를 정상 렌더링한다', () => {
    const mockCtx = createMockCtx();
    const mockCanvas = {
      getContext: vi.fn(() => mockCtx),
      width: 800,
      height: 600,
    } as unknown as HTMLCanvasElement;

    const renderer = new EditorCanvasRenderer(mockCanvas);
    const pattern = DEFAULT_CAT_CHOREO_PATTERNS[0]; // CAT_LOW_BOUNCE

    expect(() => {
      renderer.render(pattern);
    }).not.toThrow();

    // 11개 존과 배경 렌더링 확인
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('특정 좌표(x, y)에 위치한 피트니스 존 ID를 반환하는 hitTestZone을 제공한다', () => {
    const mockCtx = createMockCtx();
    const mockCanvas = {
      getContext: vi.fn(() => mockCtx),
      width: 800,
      height: 600,
    } as unknown as HTMLCanvasElement;

    const renderer = new EditorCanvasRenderer(mockCanvas);

    // Zone 1: x: 0.04 * 800 = 32, y: 0.04 * 600 = 24, w: 0.26 * 800 = 208, h: 0.16 * 600 = 96
    const zoneId = renderer.hitTestZone(50, 40);
    expect(zoneId).toBe(1);

    // 화면 정중앙 (예약 밴드 영역 - 존 없음)
    const emptyZone = renderer.hitTestZone(400, 300);
    expect(emptyZone).toBeNull();
  });

  it('activeTool(예: head) 지정 시 허용 존 강조 및 미리보기를 렌더링한다', () => {
    const mockCtx = createMockCtx();
    const mockCanvas = {
      getContext: vi.fn(() => mockCtx),
      width: 800,
      height: 600,
    } as unknown as HTMLCanvasElement;

    const renderer = new EditorCanvasRenderer(mockCanvas);
    const pattern = DEFAULT_CAT_CHOREO_PATTERNS[0];

    expect(() => {
      renderer.render(pattern, {
        hoveredZoneId: 4,
        activeTool: 'head',
      });
    }).not.toThrow();

    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it('Cross-Body 위반이 있을 때 경고 시각화(경고선 및 뱃지)를 렌더링한다', () => {
    const mockCtx = createMockCtx();
    const mockCanvas = {
      getContext: vi.fn(() => mockCtx),
      width: 800,
      height: 600,
    } as unknown as HTMLCanvasElement;

    const renderer = new EditorCanvasRenderer(mockCanvas);
    const invalidPattern = {
      ...DEFAULT_CAT_CHOREO_PATTERNS[0],
      leftHand: 1,
      hip: 10,
    };

    expect(() => {
      renderer.render(invalidPattern, {
        validation: {
          valid: false,
          violations: [
            {
              type: 'CROSS_BODY_VIOLATION',
              part: 'leftHand',
              zoneId: 1,
              message: 'Cross-Body 위반',
            },
          ],
          crossBodyViolationLines: [
            {
              handPart: 'leftHand',
              handZone: 1,
              hipZone: 10,
            },
          ],
        },
      });
    }).not.toThrow();

    // 경고 텍스트 렌더링 호출 확인
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('simulatedFrame(실시간 안무 프레임) 전달 시 스켈레톤 마네킹 및 활성 존 펄스를 렌더링한다', () => {
    const mockCtx = createMockCtx();
    const mockCanvas = {
      getContext: vi.fn(() => mockCtx),
      width: 800,
      height: 600,
    } as unknown as HTMLCanvasElement;

    const renderer = new EditorCanvasRenderer(mockCanvas);
    const pattern = DEFAULT_CAT_CHOREO_PATTERNS[0];

    const simulatedFrame = {
      phase: 'RUN_QUESTION' as const,
      currentBeat: 2.0,
      activePattern: pattern,
      activeNote: null,
      motionType: 'low_bounce' as const,
      bounceOffset: 0.35,
      targetZones: [6, 8, 10],
      jointPositions: {
        head: { x: 0.5, y: 0.25 },
        hip: { x: 0.5, y: 0.7 },
        leftHand: { x: 0.17, y: 0.66 },
        rightHand: { x: 0.83, y: 0.66 },
        leftFoot: { x: 0.17, y: 0.86 },
        rightFoot: { x: 0.83, y: 0.86 },
      },
      isDip: true,
    };

    expect(() => {
      renderer.render(pattern, {
        simulatedFrame,
        showSkeleton: true,
      });
    }).not.toThrow();

    // arc(관절 원), lineTo(뼈대), fillText(dip 라벨 등) 호출 검증
    expect(mockCtx.arc).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });
});
