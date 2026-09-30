import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../../src/core/GameEngine.js';
import type { GameLoopCallbacks } from '../../src/core/GameEngine.js';

/**
 * GameEngine 단위 테스트
 * - 시간 누적 및 루프 생명주기 검증
 * - 일시정지/재개 시 시간 왜곡 없음 검증
 * - 스파이크 방지 델타 캡 검증
 */

/** rAF 시뮬레이터 헬퍼 */
function createMockRAF() {
  let nextId = 1;
  let callback: FrameRequestCallback | null = null;

  return {
    requestFrame: (cb: FrameRequestCallback): number => {
      callback = cb;
      return nextId++;
    },
    cancelFrame: (_id: number) => {
      callback = null;
    },
    /** 타임스탬프를 지정하여 프레임 1회 진행 */
    tick: (timestamp: number) => {
      if (callback) {
        const cb = callback;
        callback = null; // 콜백이 내부에서 다시 requestFrame을 호출함
        cb(timestamp);
      }
    },
  };
}

describe('GameEngine', () => {
  it('start() 후 running=true, stop() 후 running=false', () => {
    const raf = createMockRAF();
    const callbacks: GameLoopCallbacks = { update: vi.fn(), render: vi.fn() };
    const engine = new GameEngine(callbacks, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    expect(engine.running).toBe(false);
    engine.start();
    expect(engine.running).toBe(true);
    engine.stop();
    expect(engine.running).toBe(false);
  });

  it('첫 프레임은 기준점 설정만 하고 update를 호출하지 않는다', () => {
    const raf = createMockRAF();
    const update = vi.fn();
    const render = vi.fn();
    const engine = new GameEngine({ update, render }, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0); // 첫 프레임: 기준점 설정

    expect(update).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it('두 번째 프레임부터 update(dt)와 render()가 호출된다', () => {
    const raf = createMockRAF();
    const update = vi.fn();
    const render = vi.fn();
    const engine = new GameEngine({ update, render }, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0);     // 첫 프레임 (기준점)
    raf.tick(16.67); // 두 번째 프레임 (~60fps)

    expect(update).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);

    // dt는 약 0.01667초여야 함
    const dt = update.mock.calls[0][0] as number;
    expect(dt).toBeCloseTo(0.01667, 3);
  });

  it('elapsedTime이 프레임마다 정확히 누적된다', () => {
    const raf = createMockRAF();
    const callbacks: GameLoopCallbacks = { update: vi.fn(), render: vi.fn() };
    const engine = new GameEngine(callbacks, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0);
    raf.tick(100);  // dt = 0.1s
    raf.tick(200);  // dt = 0.1s
    raf.tick(300);  // dt = 0.1s

    expect(engine.elapsedTime).toBeCloseTo(0.3, 5);
    expect(engine.frameCount).toBe(3);
  });

  it('스파이크 방지: 200ms 이상의 델타는 200ms로 캡된다', () => {
    const raf = createMockRAF();
    const update = vi.fn();
    const engine = new GameEngine({ update, render: vi.fn() }, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0);
    raf.tick(1000); // 1초 스파이크 → 200ms로 캡

    const dt = update.mock.calls[0][0] as number;
    expect(dt).toBe(0.2); // MAX_DELTA_MS / 1000
  });

  it('pause() 시 update는 호출되지 않고 render만 호출된다', () => {
    const raf = createMockRAF();
    const update = vi.fn();
    const render = vi.fn();
    const engine = new GameEngine({ update, render }, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0);
    raf.tick(100);

    expect(update).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);

    engine.pause();
    expect(engine.paused).toBe(true);

    raf.tick(200);

    // pause 후에는 update 추가 호출 없음, render만 추가
    expect(update).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('resume() 후 시간 점프 없이 정상 재개된다', () => {
    const raf = createMockRAF();
    const update = vi.fn();
    const engine = new GameEngine({ update, render: vi.fn() }, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0);
    raf.tick(100);    // dt=0.1

    engine.pause();
    raf.tick(5000);   // 5초간 정지 상태

    engine.resume();
    raf.tick(5100);   // resume 직후 첫 프레임: 기준점 리셋
    raf.tick(5200);   // 실제 첫 프레임: dt=0.1

    // 두 번째 호출의 dt가 0.1이어야 함 (5초 점프 아님)
    const lastDt = update.mock.calls[update.mock.calls.length - 1][0] as number;
    expect(lastDt).toBeCloseTo(0.1, 5);

    // 총 누적 시간: 0.1 + 0.1 = 0.2 (5초 정지 시간은 미포함)
    expect(engine.elapsedTime).toBeCloseTo(0.2, 5);
  });

  it('pauseGame() 중에는 update()가 계속 호출되지만 elapsedTime은 누적되지 않는다', () => {
    const raf = createMockRAF();
    const update = vi.fn();
    const engine = new GameEngine({ update, render: vi.fn() }, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0);
    raf.tick(100); // dt=0.1
    expect(engine.elapsedTime).toBeCloseTo(0.1, 5);

    engine.pauseGame();
    expect(engine.isGamePaused).toBe(true);

    raf.tick(200); // dt=0.1, update는 호출되나 elapsedTime은 누적되지 않음
    expect(update).toHaveBeenCalledTimes(2);
    expect(engine.elapsedTime).toBeCloseTo(0.1, 5);

    raf.tick(2100); // 1.9초 경과
    expect(engine.elapsedTime).toBeCloseTo(0.1, 5);

    engine.resumeGame();
    expect(engine.isGamePaused).toBe(false);

    raf.tick(2200); // resume 직후 첫 틱
    raf.tick(2300); // dt=0.1
    expect(engine.elapsedTime).toBeCloseTo(0.2, 5);
  });

  it('stop() 후에는 프레임이 더 이상 진행되지 않는다', () => {
    const raf = createMockRAF();
    const update = vi.fn();
    const engine = new GameEngine({ update, render: vi.fn() }, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0);
    raf.tick(100);
    engine.stop();
    raf.tick(200); // stop 후 tick은 무시됨

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('reset()은 누적 시간과 프레임을 초기화한다', () => {
    const raf = createMockRAF();
    const callbacks: GameLoopCallbacks = { update: vi.fn(), render: vi.fn() };
    const engine = new GameEngine(callbacks, {
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    raf.tick(0);
    raf.tick(100);
    raf.tick(200);

    expect(engine.elapsedTime).toBeGreaterThan(0);
    expect(engine.frameCount).toBeGreaterThan(0);

    engine.reset();
    expect(engine.elapsedTime).toBe(0);
    expect(engine.frameCount).toBe(0);
  });

  it('중복 start() 호출은 무시된다', () => {
    const raf = createMockRAF();
    const requestSpy = vi.fn(raf.requestFrame);
    const callbacks: GameLoopCallbacks = { update: vi.fn(), render: vi.fn() };
    const engine = new GameEngine(callbacks, {
      requestFrame: requestSpy,
      cancelFrame: raf.cancelFrame,
    });

    engine.start();
    const callCount = requestSpy.mock.calls.length;
    engine.start(); // 중복 호출
    expect(requestSpy.mock.calls.length).toBe(callCount); // 추가 호출 없음
  });
});
