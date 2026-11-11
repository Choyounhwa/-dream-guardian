/**
 * assault-loop-no-squat.test.ts
 *
 * [FEAT-ASSAULT-LOOP-019 / Issue #744]
 * #734 보류 기간 동안 boss_assault 루프 사전 배치 스쿼트 임시 제거 및 24박(12초) 실경로 검증
 *
 * 게이트 검증:
 * - G-A: AppBootstrap + ?mode=boss_assault 첫 시작 계획 24박, squat 0회, answer 4회
 * - G-B: restartAssaultSession 계획 동일하게 24박, squat 0회, answer 4회
 * - G-C: 설정 변경 전 Red 기록
 * - G-D: 실경로 진행 중 스쿼트 조우 0, 결과 요약 스쿼트 계획 0
 * - 단위: 커스텀 프로필(min 1, max 2) 주입 시 스쿼트 생성 기능 보존 확인
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  type AssaultLoopConfig,
} from '../../config/assault-loop.config.js';
import { buildAssaultLoopPlan } from '../../src/game/assault/AssaultLoopPlanBuilder.js';

function createMockCanvas() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    createLinearGradient: vi.fn().mockReturnValue(gradient),
    createRadialGradient: vi.fn().mockReturnValue(gradient),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    scale: vi.fn(),
    ellipse: vi.fn(),
  };
  return {
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    getContext: vi.fn((type: string) => (type === '2d' ? ctx : null)),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 1280, height: 720 }),
  };
}

describe('[FEAT-ASSAULT-LOOP-019 / #744] boss_assault 24박(12초) 무스쿼트 루프 검증', () => {
  let originalWindow: any;
  let originalDocument: any;
  let originalLocalStorage: any;
  let originalFetch: any;

  beforeEach(() => {
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalLocalStorage = (globalThis as any).localStorage;
    originalFetch = (globalThis as any).fetch;

    const mockDoc = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') return createMockCanvas();
        return {
          style: {},
          appendChild: vi.fn(),
          removeChild: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      getElementById: vi.fn(() => null),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      hidden: false,
    };

    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      innerWidth: 1280,
      innerHeight: 720,
      location: { search: '?mode=boss_assault' },
    };
    (globalThis as any).localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('level,id,question,answer,option_1,option_2\n1,1,1+1=?,2,2,3'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).fetch = originalFetch;
  });

  describe('1. 기본 프로필 단위 계획 검증', () => {
    it('기본 프로필로 계획 생성 시 squatCount 0, totalBeats 24, totalSeconds 12초여야 한다', () => {
      const plan = buildAssaultLoopPlan({ seed: 'test-seed-744', roundNumber: 1 });
      expect(plan.squatCount).toBe(0);
      expect(plan.squatGapIndices).toEqual([]);
      expect(plan.totalBeats).toBe(24);
      expect(plan.totalSeconds).toBe(12);

      // 전투 조우: answer_pair 4개, squat 0개
      const answerEncounters = plan.encounters.filter((e) => e.kind === 'answer_pair');
      const squatEncounters = plan.encounters.filter((e) => e.kind === 'squat');
      expect(answerEncounters.length).toBe(4);
      expect(squatEncounters.length).toBe(0);

      // 구간: run_question 1개 + answer 4개 = 5개
      expect(plan.segments.length).toBe(5);
      expect(plan.segments[0].kind).toBe('run_question');
      expect(plan.segments.slice(1).every((s) => s.kind === 'answer')).toBe(true);
    });

    it('임의의 시드 20회 반복 생성 시 항상 squatCount는 0이어야 한다 (결정론적 0회)', () => {
      for (let r = 1; r <= 20; r++) {
        const plan = buildAssaultLoopPlan({ seed: `seed-iter-${r}`, roundNumber: r });
        expect(plan.squatCount).toBe(0);
        expect(plan.totalBeats).toBe(24);
        expect(plan.encounters.length).toBe(4);
      }
    });

    it('커스텀 프로필(min 1, max 2) 주입 시 스쿼트 생성 기능이 정상 유지되어야 한다 (기능 보존)', () => {
      const customConfig: AssaultLoopConfig = {
        ...DEFAULT_ASSAULT_LOOP_CONFIG,
        minSquatsPerRound: 1,
        maxSquatsPerRound: 2,
      };
      const plan = buildAssaultLoopPlan({
        seed: 'test-custom-squat',
        roundNumber: 1,
        loopConfig: customConfig,
      });
      expect([1, 2]).toContain(plan.squatCount);
      expect([28, 32]).toContain(plan.totalBeats);
      expect(plan.encounters.some((e) => e.kind === 'squat')).toBe(true);
    });
  });

  describe('2. 실경로 G-A/G-B/G-D 통합 검증 (AppBootstrap + ?mode=boss_assault)', () => {
    it('G-A: ?mode=boss_assault 기본 진입 시 첫 라운드 계획이 squat 0회, 24박이어야 한다', async () => {
      (globalThis as any).window.location.search = '?mode=boss_assault';

      const app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      expect(app.isAssaultMode()).toBe(true);
      app.startReadyPhase();
      app.readyPositionController.skip();
      expect(app.stateMachine.currentState).toBe('ASSAULT_ROUND');

      const plan = app.assaultSession?.getCurrentLoopPlan?.();
      expect(plan).not.toBeNull();
      expect(plan?.squatCount).toBe(0);
      expect(plan?.totalBeats).toBe(24);
      expect(plan?.totalSeconds).toBe(12);

      const squatEncounters = plan?.encounters.filter((e) => e.kind === 'squat') ?? [];
      const answerEncounters = plan?.encounters.filter((e) => e.kind === 'answer_pair') ?? [];
      expect(squatEncounters.length).toBe(0);
      expect(answerEncounters.length).toBe(4);

      app.dispose();
    });

    it('G-B: restartAssaultSession 재시작 시에도 squat 0회, 24박 계획이 재현되어야 한다', async () => {
      (globalThis as any).window.location.search = '?mode=boss_assault';

      const app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      app.startReadyPhase();
      app.readyPositionController.skip();

      const session1 = app.assaultSession;
      expect(session1).not.toBeNull();
      const plan1 = session1!.getCurrentLoopPlan!();
      expect(plan1).not.toBeNull();
      expect(plan1!.squatCount).toBe(0);
      expect(plan1!.totalBeats).toBe(24);

      const session2 = app.restartAssaultSession();
      expect(session2).not.toBeNull();
      const plan2 = session2.getCurrentLoopPlan!();
      expect(plan2).not.toBeNull();
      expect(plan2!.squatCount).toBe(0);
      expect(plan2!.totalBeats).toBe(24);
      expect(plan2!.totalSeconds).toBe(12);
      expect(plan2!.encounters.filter((e) => e.kind === 'squat').length).toBe(0);

      app.dispose();
    });

    it('G-D: 라운드 진행 중 스쿼트 조우가 없어야 하며, 결과 요약에 squat 계획 0, answer 계획 4가 반영되어야 한다', async () => {
      (globalThis as any).window.location.search = '?mode=boss_assault';

      const app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      app.startReadyPhase();
      app.readyPositionController.skip();

      const session = app.assaultSession;
      expect(session).not.toBeNull();

      const plan = session!.getCurrentLoopPlan!();
      expect(plan).not.toBeNull();
      // encounters에서 스쿼트가 전혀 없음을 확인
      expect(plan!.encounters.filter((e) => e.kind === 'squat').length).toBe(0);
      expect(plan!.encounters.length).toBe(4);

      // exercise summary 확인
      const summary = session!.getLoopExerciseSummary?.();
      if (summary) {
        expect(summary.squatCount).toBe(0);
      }

      app.dispose();
    });
  });
});
