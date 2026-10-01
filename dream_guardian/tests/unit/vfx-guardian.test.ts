/**
 * vfx-guardian.test.ts
 * [VFX-003 / #275] 수호신 스펠 캐스트 이펙트 (마나 100 도달/스펠 시전/보스 피격)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EffectManager,
  wireGuardianVFX,
} from '../../src/effects/EffectManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { GUARDIAN_EFFECT_CONFIG } from '../../config/effect.config.js';

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

describe('VFX-003: 수호신 스펠 캐스트 이펙트 (마나 100 도달 / 스펠 시전 / 보스 피격)', () => {
  let manager: EffectManager;

  beforeEach(() => {
    manager = new EffectManager(10);
    manager.setViewport(1280, 720);
  });

  describe('1. 설정 검증 (config/effect.config.ts)', () => {
    it('GUARDIAN_EFFECT_CONFIG에 manaFull, castSequence, bossHit 설정이 올바르게 정의되어 있다', () => {
      expect(GUARDIAN_EFFECT_CONFIG).toBeDefined();

      // 마나 100 도달 연출 설정
      expect(GUARDIAN_EFFECT_CONFIG.manaFull).toBeDefined();
      expect(GUARDIAN_EFFECT_CONFIG.manaFull.duration).toBeCloseTo(0.5, 1);
      expect(GUARDIAN_EFFECT_CONFIG.manaFull.pulseColor).toBe('#C889FF');
      expect(GUARDIAN_EFFECT_CONFIG.manaFull.colors).toEqual(
        expect.arrayContaining(['#C889FF', '#FF4DF0', '#28E6FF'])
      );
      expect(GUARDIAN_EFFECT_CONFIG.manaFull.gravity).toBeLessThan(0); // 화면 상단으로 솟구침

      // 수호신 스펠 3단계 시퀀스 설정 (총 1.1초)
      expect(GUARDIAN_EFFECT_CONFIG.castSequence).toBeDefined();
      expect(GUARDIAN_EFFECT_CONFIG.castSequence.totalDuration).toBeCloseTo(1.1, 1);
      expect(GUARDIAN_EFFECT_CONFIG.castSequence.convergenceDuration).toBeCloseTo(0.3, 1);
      expect(GUARDIAN_EFFECT_CONFIG.castSequence.projectileDuration).toBeCloseTo(0.5, 1);
      expect(GUARDIAN_EFFECT_CONFIG.castSequence.explosionDuration).toBeCloseTo(0.3, 1);
      expect(GUARDIAN_EFFECT_CONFIG.castSequence.convergenceColors).toEqual(
        expect.arrayContaining(['#C889FF', '#28E6FF'])
      );
      expect(GUARDIAN_EFFECT_CONFIG.castSequence.explosionColors).toEqual(
        expect.arrayContaining(['#FF00CC', '#28E6FF'])
      );

      // 보스 피격 설정 (일반 및 광폭화 진홍 스파크)
      expect(GUARDIAN_EFFECT_CONFIG.bossHit).toBeDefined();
      expect(GUARDIAN_EFFECT_CONFIG.bossHit.normal.colors).toEqual(
        expect.arrayContaining(['#FFAA00', '#FF3300'])
      );
      expect(GUARDIAN_EFFECT_CONFIG.bossHit.enraged.colors).toEqual(
        expect.arrayContaining(['#FF0055', '#FF1133'])
      );
      expect(GUARDIAN_EFFECT_CONFIG.bossHit.enraged.count).toBeGreaterThan(
        GUARDIAN_EFFECT_CONFIG.bossHit.normal.count
      );
      expect(GUARDIAN_EFFECT_CONFIG.bossHit.enraged.speedMax).toBeGreaterThan(
        GUARDIAN_EFFECT_CONFIG.bossHit.normal.speedMax
      );
    });
  });

  describe('2. 마나 100 도달 이펙트 검증 (playManaFullEffect)', () => {
    it('마나 바 위치에서 보라빛(#C889FF) 펄스 파동 및 솟구치는 빛줄기 파티클이 방출된다 (0.5초)', () => {
      const manaX = 640;
      const manaY = 680;

      manager.playManaFullEffect(manaX, manaY);

      // 1) 펄스 이펙트 생성 확인
      const activePulse = (manager as any)._active.find((e: any) => e.type === 'pulse');
      expect(activePulse).toBeDefined();
      expect(activePulse.color).toBe('#C889FF');
      expect(activePulse.duration).toBeCloseTo(0.5, 1);

      // 2) 솟구치는 파티클 방출 확인
      const activeCount = manager.particleEmitter.activeCount;
      expect(activeCount).toBeGreaterThanOrEqual(20);
      expect(activeCount).toBeLessThanOrEqual(40);

      const particles = (manager.particleEmitter as any).activeParticles;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#C889FF')).toBe(true);

      // 상향 이동 검증: 중력이 음수이거나 vy가 음수(상향)
      const hasUpwardMotion = particles.some((p: any) => p.gravity < 0 || p.vy < 0);
      expect(hasUpwardMotion).toBe(true);

      const maxLifes = particles.map((p: any) => p.maxLife);
      const avgLife = maxLifes.reduce((a: number, b: number) => a + b, 0) / maxLifes.length;
      expect(avgLife).toBeCloseTo(0.5, 1);
    });
  });

  describe('3. 수호신 스펠 캐스트 3단계 연쇄 시퀀스 검증 (playGuardianCastSequence)', () => {
    const gx = 640;
    const gy = 600;
    const bx = 640;
    const by = 180;

    it('시퀀스 생성 시 activeCastSequences에 등록되며 총 지속시간은 1.1초이다', () => {
      manager.playGuardianCastSequence(gx, gy, bx, by);

      expect(manager.activeCastSequences.length).toBe(1);
      const seq = manager.activeCastSequences[0];
      expect(seq.guardianX).toBe(gx);
      expect(seq.guardianY).toBe(gy);
      expect(seq.bossX).toBe(bx);
      expect(seq.bossY).toBe(by);
      expect(seq.totalDuration).toBeCloseTo(1.1, 1);
      expect(seq.active).toBe(true);
      expect(seq.phase).toBe('convergence');
    });

    it('1단계 수렴 (0 ~ 0.3초): 수호신 위치로 에너지 입자가 수렴한다', () => {
      manager.playGuardianCastSequence(gx, gy, bx, by);
      const seq = manager.activeCastSequences[0];

      // dt = 0.15초 진행
      manager.update(0.15);
      expect(seq.elapsed).toBeCloseTo(0.15, 2);
      expect(seq.phase).toBe('convergence');
      expect(seq.explosionTriggered).toBe(false);

      // 수렴 파티클 방출 확인
      expect(manager.particleEmitter.activeCount).toBeGreaterThan(0);
    });

    it('2단계 발사/투사 (0.3 ~ 0.8초): 수호신 -> 보스 좌표로 고속 마법 구체가 선형 보간 이동한다', () => {
      manager.playGuardianCastSequence(gx, gy, bx, by);
      const seq = manager.activeCastSequences[0];

      // 0.3초 시점으로 전진 -> 투사체 페이즈 진입
      manager.update(0.35);
      expect(seq.phase).toBe('projectile');
      expect(seq.projectileProgress).toBeGreaterThan(0);
      expect(seq.projectileProgress).toBeLessThan(1);

      // 0.55초 시점 (투사체 0.5초 구간 중 정중앙 50% 지점: 0.3 + 0.25 = 0.55)
      manager.update(0.2); // 누적 0.55초
      expect(seq.elapsed).toBeCloseTo(0.55, 2);
      expect(seq.projectileProgress).toBeCloseTo(0.5, 1);

      // 좌표 보간 검증: gx, gy와 bx, by의 중간 좌표 (50%)
      const expectedX = gx + (bx - gx) * 0.5;
      const expectedY = gy + (by - gy) * 0.5;
      expect(seq.currentProjectileX).toBeCloseTo(expectedX, 1);
      expect(seq.currentProjectileY).toBeCloseTo(expectedY, 1);
      expect(seq.explosionTriggered).toBe(false);
    });

    it('3단계 폭발 (0.8 ~ 1.1초): 보스 위치에서 마젠타/시안 마법 폭발 충격파가 발동된다', () => {
      manager.playGuardianCastSequence(gx, gy, bx, by);
      const seq = manager.activeCastSequences[0];

      // 0.85초 시점으로 전진 -> 폭발 페이즈 진입 및 충격파 발생
      manager.update(0.85);
      expect(seq.phase).toBe('explosion');
      expect(seq.explosionTriggered).toBe(true);

      // 보스 위치 폭발 파티클 및 확장 충격파 검증
      const activeExpand = (manager as any)._active.find((e: any) => e.type === 'expand');
      expect(activeExpand).toBeDefined();
      expect(activeExpand.x).toBe(bx);
      expect(activeExpand.y).toBe(by);

      const particles = (manager.particleEmitter as any).activeParticles;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#FF00CC' || c === '#28E6FF')).toBe(true);
    });

    it('1.1초 초과 시 시퀀스가 완료 처리되어 activeCastSequences에서 제거된다', () => {
      manager.playGuardianCastSequence(gx, gy, bx, by);
      expect(manager.activeCastSequences.length).toBe(1);

      // 1.15초 경과
      manager.update(1.15);
      expect(manager.activeCastSequences.length).toBe(0);
    });

    it('렌더링 호출 시 캔버스 컨텍스트에 투사체 및 에너지가 정상 렌더링된다', () => {
      const mockCtx = createMockCtx();
      manager.playGuardianCastSequence(gx, gy, bx, by);

      // 1) 수렴 렌더링
      manager.update(0.1);
      manager.render(mockCtx);
      expect(mockCtx.arc).toHaveBeenCalled();

      // 2) 투사체 렌더링
      manager.update(0.3); // 0.4s
      manager.render(mockCtx);
      expect(mockCtx.arc).toHaveBeenCalled();
    });
  });

  describe('4. 보스 피격 충격 이펙트 검증 (playBossHitImpact)', () => {
    const bx = 640;
    const by = 200;

    it('일반 피격 시 주황/적색 충격 불꽃 파티클이 방출된다', () => {
      manager.playBossHitImpact(bx, by, false);

      const count = manager.particleEmitter.activeCount;
      expect(count).toBeGreaterThanOrEqual(20);
      expect(count).toBeLessThanOrEqual(35);

      const particles = (manager.particleEmitter as any).activeParticles;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#FFAA00' || c === '#FF3300')).toBe(true);

      const shapes = particles.map((p: any) => p.shape);
      expect(shapes.some((s: string) => s === 'spark')).toBe(true);
    });

    it('광폭화 피격 시 진홍(#FF0055/#FF1133) 스파크가 강화되어 더 많은 개수와 속도로 방출된다', () => {
      manager.playBossHitImpact(bx, by, true);

      const count = manager.particleEmitter.activeCount;
      expect(count).toBeGreaterThanOrEqual(35);

      const particles = (manager.particleEmitter as any).activeParticles;
      const colors = particles.map((p: any) => p.color);
      expect(colors.some((c: string) => c === '#FF0055' || c === '#FF1133')).toBe(true);

      const speeds = particles.map((p: any) => Math.hypot(p.vx, p.vy));
      const maxSpeed = Math.max(...speeds);
      expect(maxSpeed).toBeGreaterThan(300);
    });
  });

  describe('5. EventBus 연동 검증 (wireGuardianVFX)', () => {
    let eventBus: EventBus;
    let unsubscribe: () => void;

    beforeEach(() => {
      eventBus = new EventBus();
      unsubscribe = wireGuardianVFX(eventBus, manager, {
        getManaCoordinates: () => ({ x: 640, y: 700 }),
        getGuardianCoordinates: () => ({ x: 640, y: 580 }),
        getBossCoordinates: () => ({ x: 640, y: 180 }),
        getIsEnraged: () => false,
      });
    });

    it('mana:full 수신 시 playManaFullEffect가 실행된다', () => {
      const spy = vi.spyOn(manager, 'playManaFullEffect');
      eventBus.emit('mana:full', { mana: 100 });
      expect(spy).toHaveBeenCalledWith(640, 700);
    });

    it('guardian:cast 수신 시 playGuardianCastSequence가 올바른 좌표로 실행된다', () => {
      const spy = vi.spyOn(manager, 'playGuardianCastSequence');
      eventBus.emit('guardian:cast', { damage: 4 });
      expect(spy).toHaveBeenCalledWith(640, 580, 640, 180);
    });

    it('boss:hit 수신 시 playBossHitImpact가 올바른 좌표와 광폭화 여부로 실행된다', () => {
      const spy = vi.spyOn(manager, 'playBossHitImpact');
      eventBus.emit('boss:hit', { bossHp: 6 });
      expect(spy).toHaveBeenCalledWith(640, 180, false);
    });

    it('unsubscribe 호출 후 이벤트가 수신되어도 이펙트가 실행되지 않는다', () => {
      unsubscribe();
      const spy = vi.spyOn(manager, 'playManaFullEffect');
      eventBus.emit('mana:full', { mana: 100 });
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
