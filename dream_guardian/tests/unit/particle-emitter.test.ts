import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Particle, type ParticleOptions } from '../../src/effects/Particle.js';
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
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('Particle Unit Tests', () => {
  let particle: Particle;

  beforeEach(() => {
    particle = new Particle();
  });

  it('초기 상태는 비활성화(active: false)이다', () => {
    expect(particle.active).toBe(false);
    expect(particle.life).toBe(0);
    expect(particle.maxLife).toBe(1);
  });

  it('init() 호출 시 설정값들이 정상 초기화되고 active가 true가 된다', () => {
    const opts: ParticleOptions = {
      x: 100,
      y: 200,
      vx: 50,
      vy: -50,
      size: 8,
      startSize: 8,
      endSize: 2,
      color: '#4DFFAA',
      alpha: 1,
      startAlpha: 1,
      endAlpha: 0,
      rotation: 0.5,
      vRot: 1.0,
      gravity: 98,
      drag: 0.95,
      maxLife: 1.0,
      shape: 'star',
    };

    particle.init(opts);
    expect(particle.active).toBe(true);
    expect(particle.x).toBe(100);
    expect(particle.y).toBe(200);
    expect(particle.vx).toBe(50);
    expect(particle.vy).toBe(-50);
    expect(particle.size).toBe(8);
    expect(particle.color).toBe('#4DFFAA');
    expect(particle.rotation).toBe(0.5);
    expect(particle.vRot).toBe(1.0);
    expect(particle.shape).toBe('star');
    expect(particle.maxLife).toBe(1.0);
    expect(particle.life).toBe(0);
  });

  it('update(dt) 호출 시 이동, 회전, 크기/알파 감쇠가 적용되고 생존 시 true를 반환한다', () => {
    particle.init({
      x: 100,
      y: 100,
      vx: 100,
      vy: 0,
      size: 10,
      startSize: 10,
      endSize: 0,
      startAlpha: 1,
      endAlpha: 0,
      vRot: 2,
      maxLife: 1.0,
    });

    const isAlive = particle.update(0.5);
    expect(isAlive).toBe(true);
    expect(particle.active).toBe(true);
    expect(particle.life).toBe(0.5);
    expect(particle.x).toBeGreaterThan(100);
    expect(particle.rotation).toBeCloseTo(1.0);
    expect(particle.alpha).toBeCloseTo(0.5);
    expect(particle.size).toBeCloseTo(5);
  });

  it('수명(maxLife)에 도달하면 update(dt)가 false를 반환하고 active가 false가 된다', () => {
    particle.init({
      x: 50,
      y: 50,
      maxLife: 0.4,
    });

    const aliveMid = particle.update(0.2);
    expect(aliveMid).toBe(true);
    expect(particle.active).toBe(true);

    const aliveEnd = particle.update(0.25);
    expect(aliveEnd).toBe(false);
    expect(particle.active).toBe(false);
  });

  it('render(ctx)가 다양한 도형(circle, rect, star, spark)을 지원하며 canvas에 그린다', () => {
    const mockCtx = createMockCtx();

    // Circle
    particle.init({ x: 10, y: 10, size: 5, shape: 'circle' });
    particle.render(mockCtx);
    expect(mockCtx.arc).toHaveBeenCalled();

    // Rect (confetti)
    particle.init({ x: 20, y: 20, size: 6, shape: 'rect' });
    particle.render(mockCtx);
    expect(mockCtx.fillRect).toHaveBeenCalled();

    // Star
    particle.init({ x: 30, y: 30, size: 4, shape: 'star' });
    particle.render(mockCtx);
    expect(mockCtx.lineTo).toHaveBeenCalled();

    // Spark
    particle.init({ x: 40, y: 40, size: 4, shape: 'spark' });
    particle.render(mockCtx);
    expect(mockCtx.lineTo).toHaveBeenCalled();
  });

  it('비활성화 상태이거나 알파가 0 이하이면 render(ctx)를 건너뛴다', () => {
    const mockCtx = createMockCtx();
    particle.reset();
    particle.render(mockCtx);
    expect(mockCtx.save).not.toHaveBeenCalled();

    particle.init({ x: 0, y: 0, alpha: 0, startAlpha: 0, endAlpha: 0 });
    particle.render(mockCtx);
    expect(mockCtx.save).not.toHaveBeenCalled();
  });

  it('reset() 호출 시 모든 상태가 기본값으로 복원된다', () => {
    particle.init({ x: 100, y: 200, vx: 50, vy: -50, size: 10, maxLife: 2 });
    particle.reset();
    expect(particle.active).toBe(false);
    expect(particle.x).toBe(0);
    expect(particle.y).toBe(0);
    expect(particle.vx).toBe(0);
    expect(particle.vy).toBe(0);
    expect(particle.life).toBe(0);
  });
});

describe('ParticleEmitter Unit Tests', () => {
  let emitter: ParticleEmitter;

  beforeEach(() => {
    emitter = new ParticleEmitter({ maxParticles: 500 });
  });

  it('기본 풀 크기는 500개이며 초기 activeCount는 0이다', () => {
    expect(emitter.maxParticles).toBe(500);
    expect(emitter.activeCount).toBe(0);
    expect(emitter.poolCount).toBe(500);
    expect(emitter.isFinished).toBe(true);
  });

  it('burst() 호출 시 지정된 개수의 파티클을 풀에서 꺼내어 활성화한다', () => {
    emitter.burst({
      x: 200,
      y: 300,
      count: 30,
      colors: ['#4DFFAA', '#28E6FF'],
      speedMin: 100,
      speedMax: 200,
      duration: 0.6,
    });

    expect(emitter.activeCount).toBe(30);
    expect(emitter.poolCount).toBe(470);
    expect(emitter.isFinished).toBe(false);
  });

  it('burst()가 최대 파티클 한도(500개)를 초과하지 않도록 보호한다', () => {
    emitter.burst({ x: 0, y: 0, count: 600 });
    expect(emitter.activeCount).toBe(500);
    expect(emitter.poolCount).toBe(0);

    // 풀이 고갈된 상태에서 추가 burst 요청 시 에러 없이 한도 유지
    emitter.burst({ x: 0, y: 0, count: 50 });
    expect(emitter.activeCount).toBe(500);
  });

  it('stream() 호출 시 지속적으로 파티클을 방출한다', () => {
    emitter.stream({
      x: 100,
      y: 100,
      rate: 20, // 초당 20개
      duration: 0.5, // 0.5초 동안 방출 (약 10개)
      speedMin: 50,
      speedMax: 100,
    });

    expect(emitter.isFinished).toBe(false);

    // 0.25초 업데이트 -> 약 5개 방출
    emitter.update(0.25);
    expect(emitter.activeCount).toBeGreaterThanOrEqual(4);
    expect(emitter.activeCount).toBeLessThanOrEqual(6);

    // 추가 0.3초 업데이트 -> 스트림 종료(0.5초 경과)
    emitter.update(0.3);
    expect(emitter.activeCount).toBeGreaterThanOrEqual(8);
  });

  it('update(dt) 시 수명이 만료된 파티클은 풀로 반환된다 (GC 압력 0)', () => {
    emitter.burst({
      x: 100,
      y: 100,
      count: 20,
      duration: 0.3,
    });

    expect(emitter.activeCount).toBe(20);
    expect(emitter.poolCount).toBe(480);

    // 0.1초 경과: 여전히 생존
    emitter.update(0.1);
    expect(emitter.activeCount).toBe(20);
    expect(emitter.poolCount).toBe(480);

    // 0.25초 추가 경과 (총 0.35초, duration 0.3초 초과): 전원 사망 및 풀 반환
    emitter.update(0.25);
    expect(emitter.activeCount).toBe(0);
    expect(emitter.poolCount).toBe(500);
    expect(emitter.isFinished).toBe(true);
  });

  it('render(ctx)가 활성 파티클 전체를 렌더링한다', () => {
    const mockCtx = createMockCtx();
    emitter.burst({ x: 50, y: 50, count: 10, duration: 0.5 });

    emitter.render(mockCtx);
    expect(mockCtx.save).toHaveBeenCalledTimes(10);
    expect(mockCtx.restore).toHaveBeenCalledTimes(10);
  });

  it('clear() 호출 시 모든 활성 파티클 및 스트림이 즉시 초기화되고 풀로 회수된다', () => {
    emitter.burst({ x: 10, y: 10, count: 50 });
    emitter.stream({ x: 20, y: 20, rate: 30, duration: 2.0 });

    expect(emitter.activeCount).toBe(50);
    emitter.clear();
    expect(emitter.activeCount).toBe(0);
    expect(emitter.poolCount).toBe(500);
    expect(emitter.isFinished).toBe(true);
  });
});
