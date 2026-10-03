import { describe, it, expect, vi } from 'vitest';
import { AnswerSelectionRenderer } from '../../src/render/AnswerSelectionRenderer.js';
import { CURSOR_VISIBILITY, type CursorType } from '../../config/cursor.config.js';
import type { CursorPosition } from '../../src/input/CursorTracker.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    lineJoin: 'miter',
  } as unknown as CanvasRenderingContext2D;
}

describe('[FEAT-CURSOR-006] 커서 가시성 설정 및 머리·골반 커서 렌더링 필터링', () => {
  it('1. config/cursor.config.ts에 CURSOR_VISIBILITY가 정의되어 있고 head와 hip이 false이다', () => {
    expect(CURSOR_VISIBILITY).toBeDefined();
    expect(CURSOR_VISIBILITY.leftHand).toBe(true);
    expect(CURSOR_VISIBILITY.rightHand).toBe(true);
    expect(CURSOR_VISIBILITY.head).toBe(false);
    expect(CURSOR_VISIBILITY.hip).toBe(false);
    expect(CURSOR_VISIBILITY.shoulder).toBe(false);
  });

  it('2. AnswerSelectionRenderer.render() 실행 시 head와 hip 커서는 캔버스에 렌더링되지 않는다', () => {
    const renderer = new AnswerSelectionRenderer();
    const mockCtx = createMockCtx();

    const cursors = new Map<CursorType, CursorPosition>([
      ['leftHand', { type: 'leftHand', source: 'pose', x: 0.3, y: 0.5, confidence: 1, size: { radius: 60 } }],
      ['rightHand', { type: 'rightHand', source: 'pose', x: 0.7, y: 0.5, confidence: 1, size: { radius: 60 } }],
      ['head', { type: 'head', source: 'pose', x: 0.5, y: 0.2, confidence: 1, size: { radiusX: 55, radiusY: 70 } }],
      ['hip', { type: 'hip', source: 'pose', x: 0.5, y: 0.65, confidence: 1, size: { halfWidth: 90, halfHeight: 54 } }],
    ]);

    renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0]);

    // 왼손, 오른손 커서 라벨 'L', 'R'은 렌더링되어야 함
    expect(mockCtx.fillText).toHaveBeenCalledWith('L', expect.any(Number), expect.any(Number));
    expect(mockCtx.fillText).toHaveBeenCalledWith('R', expect.any(Number), expect.any(Number));

    // 머리 라벨 'HEAD' 및 골반 라벨 'HIP'은 렌더링되지 않아야 함
    expect(mockCtx.fillText).not.toHaveBeenCalledWith('HEAD', expect.any(Number), expect.any(Number));
    expect(mockCtx.fillText).not.toHaveBeenCalledWith('HIP', expect.any(Number), expect.any(Number));

    // 머리 타원(ellipse) 호출되지 않아야 함
    expect(mockCtx.ellipse).not.toHaveBeenCalled();
  });

  it('3. 커서 맵에 head와 hip만 주어졌을 경우 arc나 ellipse 드로잉이 일체 발생하지 않는다', () => {
    const renderer = new AnswerSelectionRenderer();
    const mockCtx = createMockCtx();

    const cursors = new Map<CursorType, CursorPosition>([
      ['head', { type: 'head', source: 'pose', x: 0.5, y: 0.2, confidence: 1 }],
      ['hip', { type: 'hip', source: 'pose', x: 0.5, y: 0.65, confidence: 1 }],
    ]);

    renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0]);

    expect(mockCtx.arc).not.toHaveBeenCalled();
    expect(mockCtx.ellipse).not.toHaveBeenCalled();
    expect(mockCtx.fillText).not.toHaveBeenCalled();
  });
});
