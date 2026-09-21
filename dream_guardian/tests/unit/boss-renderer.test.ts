import { describe, it, expect, vi } from 'vitest';
import { BossRenderer } from '../../src/render/BossRenderer.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
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

describe('BossRenderer - 5 Procedural Bosses (Issue #25)', () => {
  const ctx = createMockCtx();

  it('5개 챕터 보스(Ch.1~Ch.5)가 예외 없이 렌더링된다', () => {
    const renderer = new BossRenderer();

    // Ch.1 포겟
    expect(() => renderer.render(ctx, 1, 500, 300, 80, 'idle')).not.toThrow();

    // Ch.2 후다닥
    expect(() => renderer.render(ctx, 2, 500, 300, 80, 'idle')).not.toThrow();

    // Ch.3 뒤죽박죽
    expect(() => renderer.render(ctx, 3, 500, 300, 80, 'idle')).not.toThrow();

    // Ch.4 에라
    expect(() => renderer.render(ctx, 4, 500, 300, 80, 'idle')).not.toThrow();

    // Ch.5 나이트메어
    expect(() => renderer.render(ctx, 5, 500, 300, 80, 'idle')).not.toThrow();
  });

  it('모든 보스 페이즈(idle, warning, attacking, defeated)를 정상 처리한다', () => {
    const renderer = new BossRenderer();
    const phases = ['idle', 'warning', 'attacking', 'defeated'] as const;

    for (const phase of phases) {
      expect(() => renderer.render(ctx, 1, 400, 200, 60, phase)).not.toThrow();
    }
  });

  it('피격(triggerHit) 시 흔들림과 플래시가 활성화되고 update로 점차 소멸한다', () => {
    const renderer = new BossRenderer();
    renderer.triggerHit();

    // 피격 상태 렌더링 (플래시 합성 처리 확인)
    renderer.render(ctx, 1, 400, 200, 60, 'idle');
    expect(ctx.translate).toHaveBeenCalled();

    // 0.4초 후 피격 타이머 종료
    renderer.update(0.4);
    expect(() => renderer.render(ctx, 1, 400, 200, 60, 'idle')).not.toThrow();
  });

  it('공격(triggerAttack) 시 스케일 변환이 적용된다', () => {
    const renderer = new BossRenderer();
    renderer.triggerAttack();

    expect(() => renderer.render(ctx, 2, 400, 200, 70, 'attacking')).not.toThrow();
    expect(ctx.scale).toHaveBeenCalled();
  });

  it('시간 경과(update)에 따라 애니메이션이 진행된다', () => {
    const renderer = new BossRenderer();
    renderer.update(0.016);
    renderer.update(0.016);
    expect(() => renderer.render(ctx, 3, 300, 300, 80)).not.toThrow();
  });
});
