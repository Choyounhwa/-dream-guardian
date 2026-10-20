/**
 * audio-context-factory.test.ts - Web AudioContext 팩토리 및 사운드 합성기 공통 로직 단위 테스트
 *
 * @see Issue #630 [REFACTOR-DRY-003]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAudioContext,
  getOrCreateAudioContext,
  createDistortionCurve,
  resetSharedAudioContext,
} from '../../src/audio/AudioContextFactory.js';

describe('AudioContextFactory - AudioContext 생성 및 관리', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    resetSharedAudioContext();
  });

  afterEach(() => {
    // window 복원
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      delete (globalThis as Record<string, unknown>).window;
    }
    vi.restoreAllMocks();
  });

  describe('createAudioContext', () => {
    it('SSR/headless 등 window 또는 AudioContext가 없는 환경에서는 null을 반환한다', () => {
      delete (globalThis as Record<string, unknown>).window;
      expect(createAudioContext()).toBeNull();
    });

    it('window.AudioContext가 제공될 때 새로운 AudioContext 인스턴스를 생성하여 반환한다', () => {
      const MockAudioContext = vi.fn().mockImplementation(() => ({
        state: 'running',
        close: vi.fn(),
      }));

      globalThis.window = {
        AudioContext: MockAudioContext,
      } as unknown as Window & typeof globalThis;

      const ctx1 = createAudioContext();
      const ctx2 = createAudioContext();

      expect(ctx1).not.toBeNull();
      expect(ctx2).not.toBeNull();
      expect(ctx1).not.toBe(ctx2); // 매 호출마다 새 인스턴스 생성
      expect(MockAudioContext).toHaveBeenCalledTimes(2);
    });

    it('window.AudioContext가 없고 webkitAudioContext가 존재할 경우 이를 사용하여 생성한다', () => {
      const MockWebkitAudioContext = vi.fn().mockImplementation(() => ({
        state: 'running',
      }));

      globalThis.window = {
        webkitAudioContext: MockWebkitAudioContext,
      } as unknown as Window & typeof globalThis;

      const ctx = createAudioContext();
      expect(ctx).not.toBeNull();
      expect(MockWebkitAudioContext).toHaveBeenCalledTimes(1);
    });

    it('AudioContext 생성자에서 에러가 발생할 경우 throw하지 않고 null을 반환한다', () => {
      const ThrowingAudioContext = vi.fn().mockImplementation(() => {
        throw new Error('AudioContext blocked by autoplay policy');
      });

      globalThis.window = {
        AudioContext: ThrowingAudioContext,
      } as unknown as Window & typeof globalThis;

      expect(() => createAudioContext()).not.toThrow();
      expect(createAudioContext()).toBeNull();
    });
  });

  describe('getOrCreateAudioContext', () => {
    it('AudioContext가 지원되지 않는 환경에서는 null을 반환한다', () => {
      delete (globalThis as Record<string, unknown>).window;
      expect(getOrCreateAudioContext()).toBeNull();
    });

    it('동일한 컨텍스트 인스턴스를 재사용(싱글톤/캐싱)하여 반환한다', () => {
      const MockAudioContext = vi.fn().mockImplementation(() => ({
        state: 'running',
      }));

      globalThis.window = {
        AudioContext: MockAudioContext,
      } as unknown as Window & typeof globalThis;

      const ctx1 = getOrCreateAudioContext();
      const ctx2 = getOrCreateAudioContext();

      expect(ctx1).not.toBeNull();
      expect(ctx1).toBe(ctx2);
      expect(MockAudioContext).toHaveBeenCalledTimes(1);
    });

    it('기존 캐시된 컨텍스트가 closed 상태인 경우 새로운 컨텍스트를 재생성한다', () => {
      let instanceCount = 0;
      const MockAudioContext = vi.fn().mockImplementation(() => {
        instanceCount++;
        return {
          id: instanceCount,
          state: instanceCount === 1 ? 'closed' : 'running',
        };
      });

      globalThis.window = {
        AudioContext: MockAudioContext,
      } as unknown as Window & typeof globalThis;

      const ctx1 = getOrCreateAudioContext();
      expect(ctx1).not.toBeNull();
      // ctx1.state is 'closed', so subsequent call should create a new one
      const ctx2 = getOrCreateAudioContext();
      expect(ctx2).not.toBe(ctx1);
      expect(MockAudioContext).toHaveBeenCalledTimes(2);
    });
  });
});

describe('createDistortionCurve - 웨이브셰이퍼 디스토션 커브 생성', () => {
  it('기본 샘플 수(256) 크기의 Float32Array를 반환한다', () => {
    const curve = createDistortionCurve(28);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(256);
  });

  it('사용자 지정 nSamples 크기의 Float32Array를 생성할 수 있다', () => {
    const curve512 = createDistortionCurve(20, 512);
    expect(curve512.length).toBe(512);

    const curve64 = createDistortionCurve(10, 64);
    expect(curve64.length).toBe(64);
  });

  it('중심점(midpoint)에서 출력값은 0이며, 대칭(anti-symmetric) 특성을 만족한다', () => {
    const nSamples = 256;
    const curve = createDistortionCurve(28, nSamples);
    const mid = nSamples / 2; // 128

    // 중심점 x=0 일 때 값은 0
    expect(curve[mid]).toBeCloseTo(0, 5);

    // 원점 대칭 검증: f(-x) === -f(x)
    for (let delta = 1; delta < mid; delta++) {
      const posVal = curve[mid + delta];
      const negVal = curve[mid - delta];
      expect(posVal).toBeCloseTo(-negVal, 5);
    }
  });

  it('amount가 0일 때 선형(Linear)에 가까운 정규화 곡선을 생성한다', () => {
    const nSamples = 256;
    const curve = createDistortionCurve(0, nSamples);
    const mid = nSamples / 2;

    expect(curve[mid]).toBeCloseTo(0, 5);
    // amount = 0일 때 (3 * x * 20 * (pi/180)) / pi = x / 3
    const delta = 64; // x = 0.5
    expect(curve[mid + delta]).toBeCloseTo(0.5 / 3, 4);
    expect(curve[mid - delta]).toBeCloseTo(-0.5 / 3, 4);
  });

  it('amount가 음수로 주어지더라도 0 이상으로 안전하게 클램핑되어 계산된다', () => {
    const curveNegative = createDistortionCurve(-10, 256);
    const curveZero = createDistortionCurve(0, 256);

    expect(curveNegative[128]).toBe(curveZero[128]);
    expect(curveNegative[192]).toBeCloseTo(curveZero[192], 5);
  });
});
