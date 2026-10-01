/**
 * vfx-answer.test.ts
 * [VFX-002 / #274] 정답/오답 판정 이펙트 연결 (별 버스트/적색 플래시/콤보 화염)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EffectManager, wireAnswerVFX } from '../../src/effects/EffectManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { ANSWER_EFFECT_CONFIG } from '../../config/effect.config.js';

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

describe('VFX-002: 정답/오답/타임아웃 판정 이펙트 및 파티클 연출', () => {
  let manager: EffectManager;

  beforeEach(() => {
    manager = new EffectManager(10);
    manager.setViewport(1280, 720);
  });

  describe('1. 설정 검증 (config/effect.config.ts)', () => {
    it('ANSWER_EFFECT_CONFIG에 correct, combo, wrong, timeout 설정이 존재한다', () => {
      expect(ANSWER_EFFECT_CONFIG).toBeDefined();
      expect(ANSWER_EFFECT_CONFIG.correct).toBeDefined();
      expect(ANSWER_EFFECT_CONFIG.correct.baseCount).toBeGreaterThanOrEqual(30);
      expect(ANSWER_EFFECT_CONFIG.correct.baseCount).toBeLessThanOrEqual(50);
      expect(ANSWER_EFFECT_CONFIG.correct.duration).toBeCloseTo(0.8, 1);
      expect(ANSWER_EFFECT_CONFIG.correct.colors).toEqual(
        expect.arrayContaining(['#4DFFAA', '#28E6FF'])
      );

      expect(ANSWER_EFFECT_CONFIG.combo5).toBeDefined();
      expect(ANSWER_EFFECT_CONFIG.combo5.colors).toEqual(
        expect.arrayContaining(['#FFCB4D'])
      );

      expect(ANSWER_EFFECT_CONFIG.wrong).toBeDefined();
      expect(ANSWER_EFFECT_CONFIG.wrong.flashColor).toBe('#FF4444');
      expect(ANSWER_EFFECT_CONFIG.wrong.flashDuration).toBeCloseTo(0.3, 1);

      expect(ANSWER_EFFECT_CONFIG.timeout).toBeDefined();
      expect(ANSWER_EFFECT_CONFIG.timeout.colors).toEqual(
        expect.arrayContaining(['#888888'])
      );
      expect(ANSWER_EFFECT_CONFIG.timeout.duration).toBeCloseTo(0.5, 1);
    });
  });

  describe('2. 정답 (correct) 판정 이펙트 검증', () => {
    it('기본 정답 시 에메랄드(#4DFFAA) 및 시안(#28E6FF) 별/스파크 파티클 30~50개가 방사형으로 방출된다', () => {
      manager.playAnswerEffect('correct', 640, 360, 0);

      const activeCount = manager.particleEmitter.activeCount;
      expect(activeCount).toBeGreaterThanOrEqual(30);
      expect(activeCount).toBeLessThanOrEqual(50);

      const particles = (manager.particleEmitter as any).activeParticles ?? (manager.particleEmitter as any)._active;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#4DFFAA')).toBe(true);
      expect(colors.some((c: string) => c === '#28E6FF')).toBe(true);

      const shapes = particles.map((p: any) => p.shape);
      expect(shapes.some((s: string) => s === 'star' || s === 'spark')).toBe(true);

      const maxLifes = particles.map((p: any) => p.maxLife);
      const avgLife = maxLifes.reduce((a: number, b: number) => a + b, 0) / maxLifes.length;
      expect(avgLife).toBeGreaterThanOrEqual(0.6);
      expect(avgLife).toBeLessThanOrEqual(0.9);
    });

    it('콤보 >= 5 시 골드(#FFCB4D) 화염/스파크 파티클이 추가로 방출된다', () => {
      manager.playAnswerEffect('correct', 640, 360, 5);

      const countCombo5 = manager.particleEmitter.activeCount;
      // 기본 35개 + 골드 화염 약 20개 = 약 55개
      expect(countCombo5).toBeGreaterThan(45);

      const particles = (manager.particleEmitter as any).activeParticles ?? (manager.particleEmitter as any)._active;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#FFCB4D')).toBe(true);
    });

    it('콤보 >= 10 시 파티클 수가 2배로 확장되고 크기가 1.5배 스케일업된다', () => {
      manager.playAnswerEffect('correct', 640, 360, 10);

      const countCombo10 = manager.particleEmitter.activeCount;
      // 기본 70개(2배) + 골드 화염 약 30개 = 약 100개
      expect(countCombo10).toBeGreaterThanOrEqual(80);

      const particles = (manager.particleEmitter as any).activeParticles ?? (manager.particleEmitter as any)._active;
      const sizes = particles.map((p: any) => p.startSize);
      const maxSize = Math.max(...sizes);
      // 기본 maxSize(8) * 1.5 = 12
      expect(maxSize).toBeGreaterThanOrEqual(10);
    });
  });

  describe('3. 오답 (wrong) 판정 이펙트 검증', () => {
    it('오답 시 0.3초 적색(#FF4444) 플래시 오버레이 및 적색 비네팅 파티클이 생성된다', () => {
      expect(manager.isFlashActive).toBe(false);

      manager.playAnswerEffect('wrong', 640, 360);

      expect(manager.isFlashActive).toBe(true);
      expect(manager.flashColor).toBe('#FF4444');
      expect(manager.flashTimer).toBeCloseTo(0.3, 1);
      expect(manager.flashAlpha).toBeGreaterThan(0);

      expect(manager.particleEmitter.activeCount).toBeGreaterThan(0);
      const particles = (manager.particleEmitter as any).activeParticles ?? (manager.particleEmitter as any)._active;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#FF4444')).toBe(true);
    });

    it('플래시 오버레이는 0.3초 경과 시 페이드아웃되어 종료된다', () => {
      manager.playAnswerEffect('wrong', 640, 360);
      expect(manager.isFlashActive).toBe(true);

      // 0.15초 후 여전히 활성 및 알파 감소
      manager.update(0.15);
      expect(manager.isFlashActive).toBe(true);
      expect(manager.flashTimer).toBeCloseTo(0.15, 1);

      // 0.16초 추가 경과 (총 0.31초) -> 플래시 비활성화
      manager.update(0.16);
      expect(manager.isFlashActive).toBe(false);
      expect(manager.flashAlpha).toBe(0);
    });

    it('플래시 오버레이 활성 시 render(ctx)에서 적색 전체 화면 채우기가 실행된다', () => {
      const mockCtx = createMockCtx();
      manager.playAnswerEffect('wrong', 640, 360);

      manager.render(mockCtx, 1280, 720);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('4. 타임아웃 (timeout) 판정 이펙트 검증', () => {
    it('타임아웃 시 회색(#888888) 안개/스모크 파티클이 약 0.5초 수명으로 확산된다', () => {
      manager.playAnswerEffect('timeout', 640, 360);

      expect(manager.particleEmitter.activeCount).toBeGreaterThan(0);

      const particles = (manager.particleEmitter as any).activeParticles ?? (manager.particleEmitter as any)._active;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#888888')).toBe(true);

      const maxLifes = particles.map((p: any) => p.maxLife);
      const avgLife = maxLifes.reduce((a: number, b: number) => a + b, 0) / maxLifes.length;
      expect(avgLife).toBeGreaterThanOrEqual(0.35);
      expect(avgLife).toBeLessThanOrEqual(0.6);

      // 0.6초 후 만료 회수
      manager.update(0.6);
      expect(manager.particleEmitter.activeCount).toBe(0);
    });
  });

  describe('5. EventBus 연동 시뮬레이션 검증', () => {
    it('EventBus의 answer:correct 이벤트 수신 시 정답 이펙트가 정상 트리거된다', () => {
      const bus = new EventBus();
      wireAnswerVFX(bus, manager, {
        getCoordinates: () => ({ x: 500, y: 300 }),
      });

      bus.emit('answer:correct', { mana: 25, combo: 6 });

      expect(manager.particleEmitter.activeCount).toBeGreaterThan(45);
      const particles = (manager.particleEmitter as any).activeParticles ?? (manager.particleEmitter as any)._active;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#FFCB4D')).toBe(true);
    });

    it('EventBus의 answer:wrong 이벤트 수신 시 오답 플래시가 정상 트리거된다', () => {
      const bus = new EventBus();
      wireAnswerVFX(bus, manager);

      bus.emit('answer:wrong', { hp: 75 });

      expect(manager.isFlashActive).toBe(true);
      expect(manager.flashColor).toBe('#FF4444');
    });

    it('EventBus의 answer:timeout 이벤트 수신 시 안개 파티클이 정상 트리거된다', () => {
      const bus = new EventBus();
      wireAnswerVFX(bus, manager);

      (bus as any).emit('answer:timeout');

      expect(manager.particleEmitter.activeCount).toBeGreaterThan(0);
      const particles = (manager.particleEmitter as any).activeParticles ?? (manager.particleEmitter as any)._active;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#888888')).toBe(true);
    });
  });
});
