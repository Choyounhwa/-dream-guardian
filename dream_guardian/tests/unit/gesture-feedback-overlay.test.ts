import { describe, it, expect, vi } from 'vitest';
import {
  GestureFeedbackOverlay,
} from '../../src/ui/GestureFeedbackOverlay.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
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
  } as unknown as CanvasRenderingContext2D;
}

describe('GestureFeedbackOverlay (Issue #209 / REFACTOR-RENDER-001)', () => {
  it('isCrossing이 false이거나 inCooldown이 true, 또는 isPaused일 때는 렌더링하지 않는다', () => {
    const overlay = new GestureFeedbackOverlay();
    const ctx = createMockCtx();

    overlay.render(ctx, 1080, 2160, {
      isCrossing: false,
      inCooldown: false,
      isPaused: false,
      progress: 0.5,
      screenMode: 'game',
      menuMode: 'main',
    });
    expect(ctx.save).not.toHaveBeenCalled();

    overlay.render(ctx, 1080, 2160, {
      isCrossing: true,
      inCooldown: true,
      isPaused: false,
      progress: 0.5,
      screenMode: 'game',
      menuMode: 'main',
    });
    expect(ctx.save).not.toHaveBeenCalled();

    overlay.render(ctx, 1080, 2160, {
      isCrossing: true,
      inCooldown: false,
      isPaused: true,
      progress: 0.5,
      screenMode: 'game',
      menuMode: 'main',
    });
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('isCrossing=true이고 유효한 상태일 때 일시정지 라벨과 프로그레스 바를 렌더링한다', () => {
    const overlay = new GestureFeedbackOverlay();
    const ctx = createMockCtx();

    overlay.render(ctx, 1080, 2160, {
      isCrossing: true,
      inCooldown: false,
      isPaused: false,
      progress: 0.7,
      screenMode: 'game',
      menuMode: 'main',
    });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();

    const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
    expect(textCalls.some((t: string) => t.includes('일시정지'))).toBe(true);
  });

  it('서브메뉴 상태에서는 홈으로 나가기 라벨을 렌더링한다', () => {
    const overlay = new GestureFeedbackOverlay();
    const ctx = createMockCtx();

    overlay.render(ctx, 1080, 2160, {
      isCrossing: true,
      inCooldown: false,
      isPaused: false,
      progress: 0.3,
      screenMode: 'menu',
      menuMode: 'sub',
    });

    const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
    expect(textCalls.some((t: string) => t.includes('홈으로 나가기'))).toBe(true);
  });
});
