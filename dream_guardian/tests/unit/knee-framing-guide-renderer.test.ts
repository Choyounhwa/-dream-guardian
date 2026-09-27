import { describe, expect, it, vi } from 'vitest';
import { KneeFramingGuideRenderer } from '../../src/render/KneeFramingGuideRenderer.js';

function context() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    clearRect: vi.fn(),
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D;
}

describe('KneeFramingGuideRenderer (Issue #199 - RENDER-FRAME-GUIDE-001)', () => {
  it('renders silhouette, safe boundaries, and initial reposition guidance for unframed state', () => {
    const renderer = new KneeFramingGuideRenderer();
    const ctx = context();

    renderer.render(ctx, 1920, 1080, { status: 'unframed', issue: 'low-visibility', progress: 0, isFootKeynotePoseInputAllowed: false });

    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('한두 걸음 뒤로 가서 무릎까지 보이게 서세요', expect.any(Number), expect.any(Number));
  });

  it('renders a stability progress ring and progress text while stabilizing', () => {
    const renderer = new KneeFramingGuideRenderer();
    const ctx = context();

    renderer.render(ctx, 1920, 1080, { status: 'stabilizing', issue: null, progress: 0.5, isFootKeynotePoseInputAllowed: false });

    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('이 자세를 유지하세요...', expect.any(Number), expect.any(Number));
  });

  it('fades to a minimal non-obscuring ready indicator', () => {
    const renderer = new KneeFramingGuideRenderer();
    const ctx = context();

    renderer.update(1);
    renderer.render(ctx, 1920, 1080, { status: 'ready', issue: null, progress: 1, isFootKeynotePoseInputAllowed: true });

    expect(ctx.fillText).toHaveBeenCalledWith('무릎 프레이밍 완료', expect.any(Number), expect.any(Number));
    expect(ctx.globalAlpha).toBeLessThan(1);
  });

  it('shows an issue-specific short direction cue without rendering ankle or foot positions', () => {
    const renderer = new KneeFramingGuideRenderer();
    const ctx = context();

    renderer.render(ctx, 1920, 1080, { status: 'degraded', issue: 'body-too-large', progress: 0, isFootKeynotePoseInputAllowed: false });

    expect(ctx.fillText).toHaveBeenCalledWith('뒤로 조금 이동하세요', expect.any(Number), expect.any(Number));
    expect(ctx.arc).not.toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number), 0, Math.PI * 2);
  });

  it('keeps silhouette and safety lines proportional when the canvas resizes', () => {
    const renderer = new KneeFramingGuideRenderer();
    const small = context();
    const large = context();
    const state = { status: 'unframed' as const, issue: 'outside-safe-frame' as const, progress: 0, isFootKeynotePoseInputAllowed: false };

    renderer.render(small, 960, 540, state);
    renderer.render(large, 1920, 1080, state);

    expect(small.moveTo).toHaveBeenCalledWith(57.599999999999994, expect.any(Number));
    expect(large.moveTo).toHaveBeenCalledWith(115.19999999999999, expect.any(Number));
  });
});
