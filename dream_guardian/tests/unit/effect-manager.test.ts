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
    scale: vi.fn(),
    rotate: vi.fn(),
    strokeText: vi.fn(),
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

  describe('리듬 판정 플로팅 텍스트 (Issue #284 - VFX-JUDGMENT-001)', () => {
    it('playJudgmentText("PERFECT")가 올바른 수명(0.6s), 골드 색상(#FFCB4D), 콤보를 갖는 텍스트를 생성한다', () => {
      manager.playJudgmentText(200, 300, 'PERFECT', 5);
      expect(manager.activeJudgmentTexts.length).toBe(1);

      const jt = manager.activeJudgmentTexts[0];
      expect(jt.rating).toBe('PERFECT');
      expect(jt.color).toBe('#FFCB4D');
      expect(jt.duration).toBeCloseTo(0.6, 2);
      expect(jt.combo).toBe(5);
      expect(jt.x).toBe(200);
      expect(jt.y).toBe(300);
      expect(jt.active).toBe(true);

      // 시작 시점에는 1.3 스케일 바운스
      expect(jt.scale).toBeCloseTo(1.3, 2);

      // 0.3s 경과 시: 위로 20px 이상 부유, active 유지, 스케일 1.0 수렴
      manager.update(0.3);
      expect(jt.active).toBe(true);
      expect(jt.currentY).toBeLessThan(300);
      expect(jt.scale).toBeCloseTo(1.0, 1);

      // 0.35s 추가 경과(총 0.65s > 0.6s): 만료 및 제거
      manager.update(0.35);
      expect(manager.activeJudgmentTexts.length).toBe(0);
    });

    it('GOOD, EARLY, LATE, MISS 판정별 색상 및 지속시간이 올바르게 적용된다', () => {
      manager.playJudgmentText(100, 100, 'GOOD');
      expect(manager.activeJudgmentTexts[0].color).toBe('#28E6FF');
      expect(manager.activeJudgmentTexts[0].duration).toBeCloseTo(0.5, 2);
      manager.clear();

      manager.playJudgmentText(100, 100, 'EARLY');
      expect(manager.activeJudgmentTexts[0].color).toBe('#FF8844');
      expect(manager.activeJudgmentTexts[0].duration).toBeCloseTo(0.5, 2);
      manager.clear();

      manager.playJudgmentText(100, 100, 'LATE');
      expect(manager.activeJudgmentTexts[0].color).toBe('#FF8844');
      expect(manager.activeJudgmentTexts[0].duration).toBeCloseTo(0.5, 2);
      manager.clear();

      manager.playJudgmentText(100, 100, 'MISS');
      const missJt = manager.activeJudgmentTexts[0];
      expect(missJt.color).toBe('#FF4444');
      expect(missJt.duration).toBeCloseTo(0.45, 2);
      expect(missJt.shake).toBe(true);

      // MISS는 아래로 처짐
      manager.update(0.2);
      expect(missJt.currentY).toBeGreaterThan(100);
    });

    it('PERFECT 판정은 파티클 버스트를 격발하지만, MISS 판정은 파티클을 발생시키지 않는다', () => {
      const burstSpy = vi.spyOn(manager.particleEmitter, 'burst');

      manager.playJudgmentText(150, 250, 'PERFECT', 1);
      expect(burstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 150,
          y: 250,
          count: 10,
          colors: expect.arrayContaining(['#FFCB4D', '#FFFFFF']),
        }),
      );

      burstSpy.mockClear();

      manager.playJudgmentText(150, 250, 'MISS');
      expect(burstSpy).not.toHaveBeenCalled();
    });

    it('소문자 혼합("Perfect", "Good", "Late", "Miss") 입력 시에도 대문자로 정상 정규화된다', () => {
      manager.playJudgmentText(100, 100, 'Perfect' as any);
      expect(manager.activeJudgmentTexts[0].rating).toBe('PERFECT');
      expect(manager.activeJudgmentTexts[0].color).toBe('#FFCB4D');
      manager.clear();

      manager.playJudgmentText(100, 100, 'Miss' as any);
      expect(manager.activeJudgmentTexts[0].rating).toBe('MISS');
      expect(manager.activeJudgmentTexts[0].color).toBe('#FF4444');
      manager.clear();
    });

    it('combo >= 2일 때 combo 텍스트가 함께 렌더링되고, combo < 2일 때는 렌더링되지 않는다', () => {
      const mockCtx = createMockCtx();

      // combo 3 -> 렌더링 시 "3 COMBO!" 포함
      manager.playJudgmentText(150, 200, 'PERFECT', 3);
      manager.render(mockCtx);
      const textCallsCombo3 = vi.mocked(mockCtx.fillText).mock.calls.map((c) => c[0]);
      expect(textCallsCombo3).toContain('PERFECT');
      expect(textCallsCombo3.some((t) => typeof t === 'string' && t.includes('3 COMBO!'))).toBe(true);
      manager.clear();

      // combo 1 -> 콤보 텍스트 없음
      vi.mocked(mockCtx.fillText).mockClear();
      manager.playJudgmentText(150, 200, 'PERFECT', 1);
      manager.render(mockCtx);
      const textCallsCombo1 = vi.mocked(mockCtx.fillText).mock.calls.map((c) => c[0]);
      expect(textCallsCombo1).toContain('PERFECT');
      expect(textCallsCombo1.some((t) => typeof t === 'string' && t.includes('COMBO'))).toBe(false);
      manager.clear();
    });

    it('clear() 호출 시 activeJudgmentTexts가 비워진다', () => {
      manager.playJudgmentText(100, 100, 'PERFECT');
      manager.playJudgmentText(200, 200, 'GOOD');
      expect(manager.activeJudgmentTexts.length).toBe(2);

      manager.clear();
      expect(manager.activeJudgmentTexts.length).toBe(0);
    });
  });
});
