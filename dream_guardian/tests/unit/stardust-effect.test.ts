import { describe, it, expect, vi } from 'vitest';
import {
  StardustIconRenderer,
  drawStardustIcon,
  drawStardustCounter,
} from '../../src/render/StardustIconRenderer.js';
import { StardustEffect } from '../../src/effects/StardustEffect.js';
import { StardustManager } from '../../src/effects/StardustManager.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    roundRect: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    lineCap: '',
    lineJoin: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('Stardust Procedural Resources - StardustIconRenderer', () => {
  it('drawStardustIcon이 4각 반짝임 별가루 아이콘을 정상 렌더링한다', () => {
    const ctx = createMockCtx();
    drawStardustIcon(ctx, 100, 100, 32);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.translate).toHaveBeenCalledWith(100, 100);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('drawStardustIcon이 8각 모드 및 커스텀 색상/회전을 지원한다', () => {
    const ctx = createMockCtx();
    drawStardustIcon(ctx, 200, 150, 48, {
      points: 8,
      color: '#28E6FF',
      innerColor: '#28E6FF',
      glowColor: '#28E6FF',
      rotation: Math.PI / 4,
      glowBlur: 15,
    });

    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
    expect(ctx.fillStyle).toBe('#28E6FF');
    expect(ctx.shadowColor).toBe('#28E6FF');
  });

  it('drawStardustCounter가 별가루 수량 뱃지와 텍스트를 함께 렌더링한다', () => {
    const ctx = createMockCtx();
    drawStardustCounter(ctx, 50, 50, 1250, {
      fontSize: 20,
      textColor: '#FFCB4D',
    });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('1,250', expect.any(Number), expect.any(Number));
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('StardustIconRenderer 클래스 인스턴스 메서드로도 동일하게 호출 가능하다', () => {
    const ctx = createMockCtx();
    const renderer = new StardustIconRenderer();
    renderer.drawIcon(ctx, 80, 80, 24);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

describe('Stardust Procedural Resources - StardustEffect', () => {
  it('StardustEffect가 burst 모드로 초기화되고 파티클을 확산시킨다', () => {
    const ctx = createMockCtx();
    const effect = new StardustEffect();

    expect(effect.type).toBe('stardust');
    expect(effect.active).toBe(false);

    effect.init({
      mode: 'burst',
      x: 300,
      y: 400,
      count: 25,
      duration: 0.8,
      speedMin: 50,
      speedMax: 150,
    });

    expect(effect.active).toBe(true);
    expect(effect.duration).toBe(0.8);
    expect(effect.particleCount).toBe(25);

    // 렌더링 검증
    effect.render(ctx);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();

    // 0.4초 업데이트
    effect.update(0.4);
    expect(effect.active).toBe(true);

    // duration 초과 업데이트 -> 비활성화
    effect.update(0.5);
    expect(effect.active).toBe(false);
  });

  it('StardustEffect가 stream 모드로 목표 좌표(targetX, targetY)를 향해 비행한다', () => {
    const effect = new StardustEffect();
    effect.init({
      mode: 'stream',
      x: 100,
      y: 500,
      targetX: 500,
      targetY: 100,
      count: 15,
      duration: 1.0,
    });

    expect(effect.active).toBe(true);
    const initialParticles = effect.getParticles();
    const startX = initialParticles[0].x;
    const startY = initialParticles[0].y;

    // 반쯤 진행
    effect.update(0.5);
    const midParticles = effect.getParticles();
    expect(midParticles[0].x).toBeGreaterThan(startX);
    expect(midParticles[0].y).toBeLessThan(startY);

    // 완료
    effect.update(0.6);
    expect(effect.active).toBe(false);
  });

  it('StardustEffect가 reset() 호출 시 파티클 상태를 안전하게 초기화한다', () => {
    const effect = new StardustEffect();
    effect.init({
      mode: 'burst',
      x: 100,
      y: 100,
      count: 10,
    });
    expect(effect.active).toBe(true);

    effect.reset();
    expect(effect.active).toBe(false);
    expect(effect.elapsed).toBe(0);
    expect(effect.particleCount).toBe(0);
  });
});

describe('Stardust Procedural Resources - StardustManager Integration', () => {
  it('StardustManager가 stardust 풀을 사전 생성(prewarm)하고 관리한다', () => {
    const manager = new StardustManager(10);
    expect(manager.getPoolSize()).toBe(10);

    const effect = manager.playStardust({
      mode: 'burst',
      x: 200,
      y: 200,
      count: 20,
      duration: 0.5,
    });

    expect(effect).toBeInstanceOf(StardustEffect);
    expect(manager.getPoolSize()).toBe(9);
    expect(manager.activeCount).toBe(1);

    // 시간 경과로 풀 복귀
    manager.update(0.6);
    expect(manager.activeCount).toBe(0);
    expect(manager.getPoolSize()).toBe(10);
  });

  it('StardustManager.playBurst 및 playStream 편의 메서드가 정상 동작한다', () => {
    const ctx = createMockCtx();
    const manager = new StardustManager(5);

    const burst = manager.playBurst(400, 300, { count: 12 });
    expect(burst.active).toBe(true);

    const stream = manager.playStream(100, 200, 500, 100, { count: 8 });
    expect(stream.active).toBe(true);

    expect(manager.activeCount).toBe(2);

    manager.render(ctx);
    expect(ctx.save).toHaveBeenCalled();

    manager.clear();
    expect(manager.activeCount).toBe(0);
    expect(manager.getPoolSize()).toBe(5);
  });
});
