import { describe, it, expect, vi } from 'vitest';
import {
  EffectManager,
  GlowEffect,
  PulseEffect,
  ExpandEffect,
  FadeEffect,
  BurstEffect,
  RadialEffect,
  TrailEffect,
} from '../../src/effects/index.js';

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

describe('Effect System - 7 Visual Effects', () => {
  const ctx = createMockCtx();

  it('GlowEffect가 정상 초기화, 업데이트, 렌더링 후 비활성화된다', () => {
    const glow = new GlowEffect();
    glow.init({ x: 100, y: 100, radius: 40, duration: 0.2 });
    expect(glow.active).toBe(true);

    glow.render(ctx);
    expect(ctx.arc).toHaveBeenCalled();

    glow.update(0.1);
    expect(glow.active).toBe(true);

    glow.update(0.15); // 총 0.25초 경과 (duration 0.2초 초과)
    expect(glow.active).toBe(false);
  });

  it('PulseEffect가 반경을 확장하며 정상 종료된다', () => {
    const pulse = new PulseEffect();
    pulse.init({ x: 200, y: 200, startRadius: 10, maxRadius: 50, duration: 0.3 });
    expect(pulse.active).toBe(true);

    pulse.render(ctx);
    pulse.update(0.35);
    expect(pulse.active).toBe(false);
  });

  it('ExpandEffect가 채움(filled) 및 외곽선 모드를 모두 지원한다', () => {
    const expandOutline = new ExpandEffect();
    expandOutline.init({ x: 50, y: 50, filled: false, duration: 0.2 });
    expandOutline.render(ctx);

    const expandFilled = new ExpandEffect();
    expandFilled.init({ x: 50, y: 50, filled: true, duration: 0.2 });
    expandFilled.render(ctx);

    expandFilled.update(0.25);
    expect(expandFilled.active).toBe(false);
  });

  it('FadeEffect가 Y축으로 부유하며 텍스트를 렌더링한다', () => {
    const fade = new FadeEffect();
    fade.init({ x: 300, y: 300, text: '+25 MANA', vy: -50, duration: 0.4 });
    expect(fade.currentY).toBe(300);

    fade.update(0.1);
    expect(fade.currentY).toBe(295);

    fade.render(ctx);
    expect(ctx.fillText).toHaveBeenCalledWith('+25 MANA', 300, 295);

    fade.update(0.35);
    expect(fade.active).toBe(false);
  });

  it('BurstEffect가 파티클 물리 업데이트를 수행하고 GC 없이 재사용된다', () => {
    const burst = new BurstEffect();
    burst.init({ x: 100, y: 100, count: 20, duration: 0.3 });
    expect(burst.active).toBe(true);

    burst.update(0.1);
    burst.render(ctx);

    burst.update(0.25);
    expect(burst.active).toBe(false);
  });

  it('RadialEffect가 회전하며 광선을 그린다', () => {
    const radial = new RadialEffect();
    radial.init({ x: 150, y: 150, rayCount: 8, rotationSpeed: 2.0, duration: 0.3 });
    expect(radial.active).toBe(true);

    radial.update(0.1);
    expect(radial.rotation).toBeCloseTo(0.2);

    radial.render(ctx);
    radial.update(0.25);
    expect(radial.active).toBe(false);
  });

  it('TrailEffect가 포인트 이동 궤적을 기록하고 감쇠 소멸한다', () => {
    const trail = new TrailEffect();
    trail.init({ x: 50, y: 50, duration: 0.5 });
    trail.addPoint(60, 60);
    trail.addPoint(70, 70);

    trail.render(ctx);
    trail.update(0.6);
    expect(trail.active).toBe(false);
  });
});

describe('EffectManager - Object Pooling & Lifecycle', () => {
  const ctx = createMockCtx();

  it('사전 생성(prewarm) 시 각 풀에 인스턴스가 할당된다', () => {
    const manager = new EffectManager(5);
    expect(manager.getPoolSize('glow')).toBe(5);
    expect(manager.getPoolSize('burst')).toBe(5);
    expect(manager.poolCount).toBe(35); // 7종 * 5
    expect(manager.activeCount).toBe(0);
  });

  it('이펙트 생성 시 풀에서 인스턴스를 가져오고 activeCount가 증가한다', () => {
    const manager = new EffectManager(2);
    expect(manager.getPoolSize('pulse')).toBe(2);

    manager.playPulse({ x: 100, y: 100, duration: 0.5 });
    expect(manager.getPoolSize('pulse')).toBe(1);
    expect(manager.activeCount).toBe(1);
  });

  it('수명이 다한 이펙트는 update() 시 풀로 자동 반환된다', () => {
    const manager = new EffectManager(2);
    manager.playGlow({ x: 50, y: 50, duration: 0.2 });

    expect(manager.activeCount).toBe(1);
    expect(manager.getPoolSize('glow')).toBe(1);

    // 0.1초 경과 (아직 생존)
    manager.update(0.1);
    expect(manager.activeCount).toBe(1);

    // 0.15초 추가 경과 (총 0.25초, 만료)
    manager.update(0.15);
    expect(manager.activeCount).toBe(0);
    expect(manager.getPoolSize('glow')).toBe(2); // 다시 2개로 반환됨!
  });

  it('playPreset이 정의된 게임플레이 연출들을 정상 생성한다', () => {
    const manager = new EffectManager(10);

    manager.playPreset('correct', 100, 100);
    expect(manager.activeCount).toBe(3); // pulse + burst + fade

    manager.playPreset('wrong', 200, 200);
    expect(manager.activeCount).toBe(6); // 3 + (expand + burst + fade)

    manager.playPreset('cast', 300, 300);
    expect(manager.activeCount).toBe(10); // 6 + (radial + expand + burst + fade)

    manager.playPreset('shield', 400, 400);
    expect(manager.activeCount).toBe(13); // 10 + (glow + pulse + fade)

    manager.playPreset('combo', 500, 500);
    expect(manager.activeCount).toBe(15); // 13 + (pulse + burst)

    // 렌더링 호출 확인
    manager.render(ctx);

    // 모두 clear
    manager.clear();
    expect(manager.activeCount).toBe(0);
  });

  it('수백 개의 이펙트가 연속 생성 및 소멸되어도 안전하게 동작한다', () => {
    const manager = new EffectManager(20);

    // 300개 이펙트 스폰
    for (let i = 0; i < 300; i++) {
      manager.playBurst({ x: i, y: i, duration: 0.1 });
    }
    expect(manager.activeCount).toBe(300);

    // 0.15초 후 전체 소멸 및 풀 회수
    manager.update(0.15);
    expect(manager.activeCount).toBe(0);
    expect(manager.getPoolSize('burst')).toBe(300);
  });
});
