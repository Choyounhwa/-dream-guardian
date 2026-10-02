import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatVFX } from '../../src/effects/CombatVFX.js';
import { ScreenFX } from '../../src/effects/ScreenFX.js';
import { ParticleEmitter } from '../../src/effects/ParticleEmitter.js';

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

describe('CombatVFX Submodule Tests (#299)', () => {
  let combatVFX: CombatVFX;
  let emitter: ParticleEmitter;

  beforeEach(() => {
    emitter = new ParticleEmitter({ maxParticles: 200, prewarm: true });
    combatVFX = new CombatVFX(emitter);
  });

  it('CombatVFX가 정상 생성되고 초기 활성 목록이 비어있다', () => {
    expect(combatVFX).toBeDefined();
    expect(combatVFX.activeSlashes.length).toBe(0);
    expect(combatVFX.activeCastSequences.length).toBe(0);
  });

  it('triggerSlash / playSlash 호출 시 슬래시 이펙트가 등록된다', () => {
    const slash = combatVFX.playSlash({
      x: 150,
      y: 200,
      length: 80,
      color: '#28E6FF',
      duration: 0.25,
    });

    expect(slash).toBeDefined();
    expect(slash.x).toBe(150);
    expect(slash.y).toBe(200);
    expect(slash.active).toBe(true);
    expect(combatVFX.activeSlashes.length).toBe(1);

    // triggerSlash 별칭 지원
    combatVFX.triggerSlash({ x: 300, y: 300 });
    expect(combatVFX.activeSlashes.length).toBe(2);
  });

  it('burst 호출 시 파티클 이미터를 통해 버스트 파티클을 방출한다', () => {
    const burstSpy = vi.spyOn(emitter, 'burst');
    combatVFX.burst({
      x: 200,
      y: 300,
      count: 15,
      colors: ['#FFCB4D', '#FF8844'],
    });

    expect(burstSpy).toHaveBeenCalledTimes(1);
    expect(burstSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 200,
        y: 300,
        count: 15,
      })
    );
  });

  it('playGuardianCastSequence 호출 시 3단계 가디언 스펠 시퀀스가 생성 및 등록된다', () => {
    const seq = combatVFX.playGuardianCastSequence(100, 200, 500, 600);
    expect(seq).toBeDefined();
    expect(seq.phase).toBe('convergence');
    expect(combatVFX.activeCastSequences.length).toBe(1);
    expect(combatVFX.lastGuardianCastTime).toBeGreaterThan(0);
  });

  it('update(dt) 호출 시 슬래시 및 가디언 시퀀스 수명이 갱신되고 만료 시 제거된다', () => {
    combatVFX.playSlash({ x: 100, y: 100, duration: 0.2 });
    expect(combatVFX.activeSlashes.length).toBe(1);

    combatVFX.update(0.1);
    expect(combatVFX.activeSlashes.length).toBe(1);

    combatVFX.update(0.15); // 총 0.25s > 0.2s
    expect(combatVFX.activeSlashes.length).toBe(0);
  });

  it('render(ctx) 호출 시 활성 슬래시 및 가디언 시퀀스를 렌더링한다', () => {
    const ctx = createMockCtx();
    combatVFX.playSlash({ x: 100, y: 100 });
    combatVFX.playGuardianCastSequence(100, 200, 400, 400);

    combatVFX.render(ctx);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('clear() / reset() 호출 시 모든 슬래시 및 가디언 시퀀스가 초기화된다', () => {
    combatVFX.playSlash({ x: 100, y: 100 });
    combatVFX.playGuardianCastSequence(100, 200, 400, 400);
    expect(combatVFX.activeSlashes.length).toBe(1);
    expect(combatVFX.activeCastSequences.length).toBe(1);

    combatVFX.clear();
    expect(combatVFX.activeSlashes.length).toBe(0);
    expect(combatVFX.activeCastSequences.length).toBe(0);
  });
});

describe('ScreenFX Submodule Tests (#299)', () => {
  let screenFX: ScreenFX;

  beforeEach(() => {
    screenFX = new ScreenFX();
  });

  it('ScreenFX가 정상 생성되고 초기 상태는 비활성이다', () => {
    expect(screenFX.isShakeActive).toBe(false);
    expect(screenFX.isFlashActive).toBe(false);
    expect(screenFX.isDefeatDarkenActive).toBe(false);
    expect(screenFX.shakeOffsetX).toBe(0);
    expect(screenFX.shakeOffsetY).toBe(0);
  });

  it('triggerShake 호출 시 화면 흔들림이 활성화되고 update(dt)에 따라 감쇠된다', () => {
    screenFX.triggerShake(12, 0.4);
    expect(screenFX.isShakeActive).toBe(true);
    expect(screenFX.shakeIntensity).toBe(12);
    expect(screenFX.shakeDuration).toBe(0.4);

    screenFX.update(0.1);
    expect(screenFX.isShakeActive).toBe(true);
    // 흔들림 오프셋 범위 확인 ([-12, 12])
    expect(Math.abs(screenFX.shakeOffsetX)).toBeLessThanOrEqual(12);
    expect(Math.abs(screenFX.shakeOffsetY)).toBeLessThanOrEqual(12);

    screenFX.update(0.35); // 총 0.45s > 0.4s
    expect(screenFX.isShakeActive).toBe(false);
    expect(screenFX.shakeOffsetX).toBe(0);
    expect(screenFX.shakeOffsetY).toBe(0);
  });

  it('triggerFlash 호출 시 플래시가 활성화되고 update(dt) 및 render(ctx)가 정상 동작한다', () => {
    const ctx = createMockCtx();
    screenFX.triggerFlash('#FF4444', 0.3, 0.4);

    expect(screenFX.isFlashActive).toBe(true);
    expect(screenFX.flashColor).toBe('#FF4444');
    expect(screenFX.flashAlpha).toBeGreaterThan(0);

    screenFX.render(ctx, 1280, 720);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);

    screenFX.update(0.35);
    expect(screenFX.isFlashActive).toBe(false);
    expect(screenFX.flashAlpha).toBe(0);
  });

  it('triggerFade / playDefeatDarken 호출 시 암전/비네팅 효과가 활성화된다', () => {
    const ctx = createMockCtx();
    screenFX.playDefeatDarken(1280, 720);

    expect(screenFX.isDefeatDarkenActive).toBe(true);
    expect(screenFX.defeatDarkenDuration).toBe(2.0);
    expect(screenFX.lastDefeatDarkenTime).toBeGreaterThan(0);

    screenFX.update(0.5);
    expect(screenFX.defeatDarkenAlpha).toBeGreaterThan(0);

    screenFX.render(ctx, 1280, 720);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('reset() / clear() 호출 시 모든 화면 효과가 즉시 초기화된다', () => {
    screenFX.triggerShake(10, 0.5);
    screenFX.triggerFlash('#FF0000', 0.5, 0.5);
    screenFX.playDefeatDarken(1280, 720);

    expect(screenFX.isShakeActive).toBe(true);
    expect(screenFX.isFlashActive).toBe(true);
    expect(screenFX.isDefeatDarkenActive).toBe(true);

    screenFX.reset();
    expect(screenFX.isShakeActive).toBe(false);
    expect(screenFX.isFlashActive).toBe(false);
    expect(screenFX.isDefeatDarkenActive).toBe(false);
    expect(screenFX.shakeOffsetX).toBe(0);
    expect(screenFX.shakeOffsetY).toBe(0);
  });
});
