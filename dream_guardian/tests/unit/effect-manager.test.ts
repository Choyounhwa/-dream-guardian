import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EffectManager } from '../../src/effects/EffectManager.js';
import { PARTICLE_PRESETS } from '../../config/effect.config.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
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

describe('EffectManager & Particle Integration Tests (VFX-001 / #273)', () => {
  let manager: EffectManager;

  beforeEach(() => {
    manager = new EffectManager(10);
  });

  it('기존 7종 시각 효과 풀과 ParticleEmitter가 함께 초기화된다', () => {
    expect(manager.poolCount).toBe(70); // 7종 * 10
    expect(manager.activeCount).toBe(0);
    expect(manager.particleEmitter).toBeDefined();
    expect(manager.particleEmitter.poolCount).toBe(500);
  });

  it('config/effect.config.ts에 5개 필수 프리셋이 올바르게 정의되어 있다', () => {
    expect(PARTICLE_PRESETS.correctBurst).toBeDefined();
    expect(PARTICLE_PRESETS.correctBurst.count).toBe(30);
    expect(PARTICLE_PRESETS.correctBurst.colors).toEqual(
      expect.arrayContaining(['#4DFFAA', '#28E6FF'])
    );

    expect(PARTICLE_PRESETS.wrongFlash).toBeDefined();
    expect(PARTICLE_PRESETS.wrongFlash.count).toBe(20);
    expect(PARTICLE_PRESETS.wrongFlash.colors).toEqual(
      expect.arrayContaining(['#FF4444'])
    );

    expect(PARTICLE_PRESETS.bossHit).toBeDefined();
    expect(PARTICLE_PRESETS.bossHit.count).toBe(25);

    expect(PARTICLE_PRESETS.manaFull).toBeDefined();
    expect(PARTICLE_PRESETS.manaFull.count).toBe(30);

    expect(PARTICLE_PRESETS.victoryCelebration).toBeDefined();
    expect(PARTICLE_PRESETS.victoryCelebration.count).toBeGreaterThanOrEqual(100);
    expect(PARTICLE_PRESETS.victoryCelebration.colors?.length).toBeGreaterThanOrEqual(5);
  });

  it('playPresetEffect()가 프리셋 설정에 맞춰 파티클을 방출한다', () => {
    manager.playPresetEffect('correctBurst', 150, 250);
    expect(manager.particleEmitter.activeCount).toBe(30);

    manager.playPresetEffect('bossHit', 300, 300);
    expect(manager.particleEmitter.activeCount).toBe(55); // 30 + 25
  });

  it('playEffect() 또는 play(presetName, x, y)로도 파티클 프리셋을 재생할 수 있다', () => {
    manager.playEffect('wrongFlash', 100, 100);
    expect(manager.particleEmitter.activeCount).toBe(20);

    manager.play('manaFull', 200, 200);
    expect(manager.particleEmitter.activeCount).toBe(50); // 20 + 30
  });

  it('기존 play(type, options) 호출이 정상 하위 호환된다', () => {
    const glow = manager.play('glow', { x: 50, y: 50, radius: 20 });
    expect(glow).toBeDefined();
    expect(glow.type).toBe('glow');
    expect(manager.activeCount).toBe(1);
  });

  it('manager.update(dt)가 기본 이펙트와 파티클을 동시에 업데이트한다', () => {
    manager.playGlow({ x: 50, y: 50, duration: 0.2 });
    manager.playPresetEffect('correctBurst', 100, 100, { duration: 0.2 });

    expect(manager.activeCount).toBe(1); // visual effect 1
    expect(manager.particleEmitter.activeCount).toBe(30); // particles 30

    // 0.1초 경과
    manager.update(0.1);
    expect(manager.activeCount).toBe(1);
    expect(manager.particleEmitter.activeCount).toBe(30);

    // 0.15초 추가 경과 (총 0.25초) -> 모두 수명 만료 후 회수
    manager.update(0.15);
    expect(manager.activeCount).toBe(0);
    expect(manager.particleEmitter.activeCount).toBe(0);
  });

  it('manager.render(ctx)가 기본 이펙트와 파티클을 모두 렌더링한다', () => {
    const mockCtx = createMockCtx();
    manager.playPreset('correct', 100, 100);
    manager.playPresetEffect('correctBurst', 100, 100);

    manager.render(mockCtx);
    expect(mockCtx.save).toHaveBeenCalled();
  });

  it('manager.clear()가 기본 이펙트와 파티클을 모두 초기화한다', () => {
    manager.playPreset('correct', 100, 100);
    manager.playPresetEffect('victoryCelebration', 500, 300);

    expect(manager.particleEmitter.activeCount).toBeGreaterThanOrEqual(100);
    manager.clear();

    expect(manager.activeCount).toBe(0);
    expect(manager.particleEmitter.activeCount).toBe(0);
  });
});
