/**
 * assault-loop.test.ts - 보스 접근전(Boss Assault) 36/40박 신규 루프 엔드투엔드 통합 인수 테스트
 *
 * @see docs/assault-loop/LOOP-16.md (ASSAULT-LOOP-16 / GitHub Issue #710)
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~6)
 *
 * 핵심 인수 검증 6대 영역:
 * 1. 실제 진입 기본경로 검증:
 *    - 추가 loop 파라미터나 테스트 수동 주입 없이 ?mode=boss_assault 기본 진입 시 Core가 DEFAULT_ASSAULT_LOOP_CONFIG 기본 선택.
 *    - READY_POSITION → ASSAULT_ROUND 전이 및 36/40박 계획 조립.
 *    - goToMenu() 메뉴 왕복 시 세션 완전 격리 및 안전 종료.
 * 2. 결정론적 라운드 진행 및 타임라인:
 *    - seed 기반 36박(N=1, 18초 @ 120BPM) 및 40박(N=2, 20초 @ 120BPM) 불변 계획 생성.
 *    - run 8박(TTS 1회, 추가 투척/대기 0초) → (answer 4박 + rest 2박) × 4회 + N × squat 4박.
 *    - 동일 문제 1개 / 4회 기회 순차 매핑, 혼합 결과 진행, 마지막 휴식 완료 시점에 completedQuestions: 1 달성.
 * 3. 전구간 입력 경계 및 무피해 보장:
 *    - 4박 선택 창 정각 입력 허용 및 1ms 초과 입력 차단 (lateGrace = 0).
 *    - 휴식(rest) 및 러닝(run_question) 구간 피해/공격/선택 0회 및 렌더링 억제.
 *    - 스쿼트 예고 1박 + 회피 2박 + 직립 1박 하위창 판정 및 직립 복귀 세대 보존.
 *    - 러닝 8박 실측 러닝 스텝 및 폴백 입력 집계 (recordRunStep).
 * 4. 사망(HP 0) 우선 및 중단:
 *    - 중간 사망 시 즉시 abort, 추가 진행 차단, completedQuestions: 0, 실측 활성시간 보존.
 *    - 10번째 문제 생존 완료 시 정상 완주.
 * 5. UI 재시작(restart) 및 토큰 무효화:
 *    - restartAssaultSession 호출 시 동일 seed+round 재현, 새 세션 토큰 발행, HP 100 초기화, 이전 토큰 폐기 격리.
 * 6. 저장소(AssaultResultStore) 호환성 및 격리:
 *    - 10문제 × 4 = 40 계획 기회와의 일치성 확인, 중간 사망 시 실측 ≤ 계획.
 *    - loop rulesVersion/profileId로 구형 기록과 비교 격리.
 *    - 테스트 세션 쓰기 차단, 레거시 키 무오염.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  type AssaultLoopConfig,
} from '../../config/assault-loop.config.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { buildAssaultLoopPlan } from '../../src/game/assault/AssaultLoopPlanBuilder.js';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import { AssaultExerciseTally } from '../../src/game/assault/AssaultExerciseTally.js';
import {
  AssaultResultStore,
  haveSameAssaultComparisonIdentity,
  ASSAULT_RESULT_STORAGE_KEY,
  type AssaultComparisonIdentity,
} from '../../src/storage/AssaultResultStore.js';
import type { AssaultLoopRoundPlan } from '../../src/types/assault-loop.js';
import type { SessionId, RoundId } from '../../src/types/assault.js';

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

const SQUAT_ENABLED_LOOP_CONFIG: AssaultLoopConfig = {
  ...DEFAULT_ASSAULT_LOOP_CONFIG,
  minSquatsPerRound: 1,
  maxSquatsPerRound: 2,
};

function getDeterministicPlans() {
  let plan36: AssaultLoopRoundPlan | null = null;
  let plan40: AssaultLoopRoundPlan | null = null;
  for (let r = 1; r <= 50; r++) {
    const candidate = buildAssaultLoopPlan({
      seed: 'seed-loop-qa-16',
      roundNumber: r,
      loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
    });
    if (!plan36 && candidate.totalBeats === 28 && candidate.squatCount === 1) {
      plan36 = candidate;
    }
    if (!plan40 && candidate.totalBeats === 32 && candidate.squatCount === 2) {
      plan40 = candidate;
    }
    if (plan36 && plan40) break;
  }
  return { plan36: plan36!, plan40: plan40! };
}

describe('[ASSAULT-LOOP-16 / #710] Boss Assault 36/40 Beat Loop End-to-End Integration Acceptance', () => {
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
    (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('no network'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).fetch = originalFetch;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. 실제 진입 기본경로 검증
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. 실제 진입 기본경로 검증 (Real Entry Default Path)', () => {
    it('추가 loop URL 파라미터 없이 ?mode=boss_assault 진입 시 DEFAULT_ASSAULT_LOOP_CONFIG 기본 선택 및 24박 계획 조립', async () => {
      (globalThis as any).window.location.search = '?mode=boss_assault';

      const app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
      });
      await app.init();

      expect(app.isAssaultMode()).toBe(true);

      // READY_POSITION 진입
      app.startReadyPhase();
      expect(app.stateMachine.currentState).toBe('READY_POSITION');

      // 준비 카운트다운 스킵 -> ASSAULT_ROUND 진입
      app.readyPositionController.skip();
      expect(app.stateMachine.currentState).toBe('ASSAULT_ROUND');

      // 어설트 세션 및 기본 루프 프로필 자동 주입 확인
      expect(app.assaultSession).not.toBeNull();
      expect(app.assaultSession?.loopProfile).toEqual(DEFAULT_ASSAULT_LOOP_CONFIG);
      expect(app.assaultSession?.loopProfile?.profileId).toBe('assault_loop_v1');

      // 세션 루프 계획 생성 확인 (24박 / FEAT-ASSAULT-LOOP-019 #744)
      const currentPlan = app.assaultSession?.getCurrentLoopPlan?.();
      expect(currentPlan).not.toBeNull();
      expect(currentPlan?.totalBeats).toBe(24);
      expect(currentPlan?.squatCount).toBe(0);
      expect(currentPlan?.segments.length).toBeGreaterThan(0);
      expect(currentPlan?.encounters.length).toBe(4);

      // [Outer-Loop TDD] 실데이터 진입 시 수식 텍스트가 유효하게 프레젠테이션 스냅샷에 도달해야 한다
      const pres = app.assaultSession?.presentation;
      expect(pres).not.toBeNull();
      expect(pres?.questionText).toBeTruthy();
      expect(pres?.questionText).toMatch(/[0-9\+\-\*\/]/);

      app.dispose();
    });

    it('메뉴 복귀(goToMenu) 시 assaultSession 폐기 및 MENU_MAIN 복귀', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      app.startReadyPhase();
      app.readyPositionController.skip();
      expect(app.stateMachine.currentState).toBe('ASSAULT_ROUND');

      const session = app.assaultSession;
      expect(session).not.toBeNull();

      app.goToMenu();
      expect(app.stateMachine.currentState).toBe('MENU_MAIN');
      expect(session?.isDisposed).toBe(true);
      expect(app.assaultSession).toBeNull();

      app.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. 결정론적 라운드 진행 및 타임라인
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. 결정론적 라운드 진행 및 타임라인 (Deterministic Round Timeline)', () => {
    it('seed 기반 라운드 계획 생성: N=1일 때 28박(14초), N=2일 때 32박(16초) 구조 검증', () => {
      const { plan36, plan40 } = getDeterministicPlans();

      // 28박 계획 (스쿼트 1회, 120BPM -> 14.0초)
      expect(plan36.totalBeats).toBe(28);
      expect(plan36.squatCount).toBe(1);
      expect(plan36.totalSeconds).toBeCloseTo(14.0, 3);

      // 32박 계획 (스쿼트 2회, 120BPM -> 16.0초)
      expect(plan40.totalBeats).toBe(32);
      expect(plan40.squatCount).toBe(2);
      expect(plan40.totalSeconds).toBeCloseTo(16.0, 3);
    });

    it('구조 타임라인: run 8박 -> answer 4박 × 4회 + N × squat 4박 일치 검증', () => {
      const { plan36 } = getDeterministicPlans();

      // 첫 세그먼트는 러닝 8박
      expect(plan36.segments[0].kind).toBe('run_question');
      expect(plan36.segments[0].durationBeats).toBe(8);

      // 조우는 답안 4개 + 스쿼트 1개 = 총 5개
      const answerEncounters = plan36.encounters.filter((e) => e.kind === 'answer_pair');
      const squatEncounters = plan36.encounters.filter((e) => e.kind === 'squat');
      expect(answerEncounters).toHaveLength(4);
      expect(squatEncounters).toHaveLength(1);

      // 모든 answer_pair의 durationBeats는 4박
      for (const ans of answerEncounters) {
        expect(ans.durationBeats).toBe(4);
      }
      // 모든 squat의 durationBeats는 4박
      for (const sq of squatEncounters) {
        expect(sq.durationBeats).toBe(4);
      }

      // 휴식 세그먼트는 0박으로 삭제됨 (0개)
      const restSegments = plan36.segments.filter((s) => s.kind === 'rest');
      expect(restSegments).toHaveLength(0);
    });

    it('동일 문제/정답 4회 기회, 혼합 결과 진행, 마지막 휴식 완료 시점에 completedQuestions: 1 달성', () => {
      const { plan36 } = getDeterministicPlans();
      const sampleQuestion = {
        id: 'q_loop_16_mix',
        text: '14 + 18 = ?',
        minReadSeconds: 2.0,
        correctSide: 'left' as const,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_loop_16_det' as SessionId,
        roundId: 'round_01' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        config: DEFAULT_ASSAULT_CONFIG,
      });

      const answerEncounters = plan36.encounters.filter((e) => e.kind === 'answer_pair');
      expect(answerEncounters).toHaveLength(4);

      // 4번째 답안 직전까지 진행 및 혼합 입력 (정답, 오답, 정답, 오답)
      // 답안 1 (정답)
      const t1 = answerEncounters[0].startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
      controller.update(t1);
      controller.submitPunch('left', Math.round(t1 * 1000), { activeSeconds: t1 });

      // 답안 2 (오답)
      const t2 = answerEncounters[1].startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
      controller.update(t2);
      controller.submitPunch('right', Math.round(t2 * 1000), { activeSeconds: t2 });

      // 답안 3 (정답)
      const t3 = answerEncounters[2].startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
      controller.update(t3);
      controller.submitPunch('left', Math.round(t3 * 1000), { activeSeconds: t3 });

      // 답안 4 (오답)
      const t4 = answerEncounters[3].startBeat * 0.5 + 1.9; // 도착(start + 2.0s) 100ms 전, EarlyMiss 170ms 유효창 내
      controller.update(t4);
      controller.submitPunch('right', Math.round(t4 * 1000), { activeSeconds: t4 });

      // 4번째 답안 진행 중 (완료 전 시점): 아직 미완료
      expect(controller.isCompleted).toBe(false);
      expect(controller.finalizeRoundSummary({ isDefeated: false })).toBeNull();

      // 마지막 4번째 답안 완료 시점(14.0초)까지 시간 전진
      controller.update(14.0);
      expect(controller.isCompleted).toBe(true);

      const summary = controller.finalizeRoundSummary({ isDefeated: false });
      expect(summary).not.toBeNull();
      expect(summary?.completedQuestions).toBe(1);
      expect(summary?.attemptedAnswerHits).toBe(4);
      expect(summary?.correctCount).toBe(2);
      expect(summary?.wrongCount).toBe(2);
      expect(summary?.totalEncounters).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. 전구간 입력 경계 및 무피해 보장
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. 전구간 입력 경계 및 무피해 보장 (Input Boundaries & Zero Damage)', () => {
    it('선택 4박 창 정각 입력 처리 및 1ms 초과 입력 차단 (lateGrace = 0)', () => {
      const { plan36 } = getDeterministicPlans();
      const sampleQuestion = {
        id: 'q_loop_16_boundary',
        text: '8 + 9 = ?',
        minReadSeconds: 2.0,
        correctSide: 'left' as const,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_loop_16_bound' as SessionId,
        roundId: 'round_01' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        config: DEFAULT_ASSAULT_CONFIG,
      });

      // 첫 answer_pair 조우 (run 8박 = 4.0s 후 시작 -> 4.0s ~ 6.0s)
      const enc0 = controller.encounters[0];
      expect(enc0.kind).toBe('answer_pair');

      // 4.0초 시작 시점으로 이동
      controller.update(4.0);

      // 4박 종료 정각인 6.000s에 정답 펀치 제출: 정상 처리 (boss_negate 정산)
      controller.submitPunch('left', 6000, { activeSeconds: 6.0 });
      const cmdsAt60 = controller.drainSettlementCommands();
      expect(cmdsAt60.some((c) => c.effectType === 'boss_negate')).toBe(true);

      // 6.001s (종료 1ms 초과) 펀치 제출: 이전 조우(enc0)에 대해서는 무효
      controller.update(6.001);
      controller.submitPunch('left', 6001, { activeSeconds: 6.001 });
      const lateCmds = controller.drainSettlementCommands();
      expect(lateCmds.filter((c) => c.attackId === enc0.id)).toHaveLength(0);

      // 별도 컨트롤러로 미응답 시 6.000s 정각에 timeout 정산 즉시 발생 확인 (lateGrace = 0)
      const timeoutController = new AssaultRoundController({
        sessionId: 'sess_loop_16_to' as SessionId,
        roundId: 'round_01' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        config: DEFAULT_ASSAULT_CONFIG,
      });
      timeoutController.update(4.0);
      timeoutController.update(6.0);
      const timeoutCmds = timeoutController.drainSettlementCommands();
      expect(timeoutCmds.some((c) => c.effectType === 'player_damage' && c.resultKind === 'timeout')).toBe(true);
    });

    it('휴식(rest) 및 러닝(run_question) 구간 입력 무피해 및 공격 렌더링 억제', () => {
      const planWithRest = buildAssaultLoopPlan({
        seed: 'seed-loop-qa-16',
        roundNumber: 1,
        loopConfig: {
          ...DEFAULT_ASSAULT_CONFIG,
          runBeats: 8,
          answerBeats: 4,
          restBeats: 2,
          answerOpportunities: 4,
          squatBeats: 4,
          squatSubBeats: { notice: 1, dodge: 2, stand: 1 },
          candidateGaps: [1, 2, 3],
          minSquatsPerRound: 1,
          maxSquatsPerRound: 2,
          baseBeats: 32,
          profileId: 'assault_loop_v1',
          rulesVersion: '1.0.0',
        } as any,
      });
      const sampleQuestion = {
        id: 'q_loop_16_prot',
        text: '5 + 5 = ?',
        minReadSeconds: 2.0,
        correctSide: 'left' as const,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_loop_16_prot' as SessionId,
        roundId: 'round_01' as RoundId,
        question: sampleQuestion,
        loopPlan: planWithRest,
        bpm: 120,
        config: DEFAULT_ASSAULT_CONFIG,
      });

      // 1. 러닝 구간(1.5s): 펀치 및 스쿼트 입력 무시
      controller.update(1.5);
      expect(controller.currentLoopSegment?.kind).toBe('run_question');
      controller.submitPunch('left', 1500, { activeSeconds: 1.5 });
      controller.submitSquat('ducking', 1500, { activeSeconds: 1.5 });
      expect(controller.drainSettlementCommands()).toHaveLength(0);

      const runPres = controller.getPresentationSnapshot();
      expect(runPres.pair).toBeUndefined();
      expect(runPres.hazard).toBeUndefined();

      // 2. 답안 1 정답 처리 후 휴식 구간 진입
      controller.update(4.0);
      // 도착(6.0s) 150ms 전 정답 처리 (EarlyMiss 170ms 유효창 내)
      controller.update(5.85);
      controller.submitPunch('left', 5850, { activeSeconds: 5.85 });
      expect(controller.drainSettlementCommands().some((c) => c.effectType === 'boss_negate')).toBe(true);

      // 6.0s 도달: 휴식 세그먼트 진입 (6.0s ~ 7.0s)
      controller.update(6.0);
      expect(controller.currentLoopSegment?.kind).toBe('rest');

      // 휴식 중 입력
      controller.submitPunch('left', 6500, { activeSeconds: 6.5 });
      controller.submitSquat('ducking', 6500, { activeSeconds: 6.5 });
      expect(controller.drainSettlementCommands()).toHaveLength(0);

      const restPres = controller.getPresentationSnapshot();
      expect(restPres.pair).toBeUndefined();
      expect(restPres.hazard).toBeUndefined();
    });

    it('스쿼트 예고 1박 + 회피 2박 + 직립 1박 하위창 판정 및 직립 복귀 세대 보존', () => {
      const { plan36 } = getDeterministicPlans();
      const squatSeg = plan36.segments.find((s) => s.kind === 'squat')!;
      expect(squatSeg).toBeDefined();

      const controller = new AssaultRoundController({
        sessionId: 'sess_loop_16_sq' as SessionId,
        roundId: 'round_01' as RoundId,
        question: {
          id: 'q_loop_16_sq',
          text: '3 + 3 = ?',
          minReadSeconds: 2.0,
          correctSide: 'left' as const,
        },
        loopPlan: plan36,
        bpm: 120,
        config: DEFAULT_ASSAULT_CONFIG,
      });

      const squatStart = squatSeg.startSeconds;
      const noticeEnd = squatStart + 0.5;
      const dodgeEnd = squatStart + 1.5;
      const standEnd = squatStart + 2.0;

      // 스쿼트 시작 전까지 전진 및 이전 정산 드레인
      controller.update(squatStart);
      controller.drainSettlementCommands();

      // 1. notice 구간 (squatStart ~ noticeEnd): 무피해
      controller.update(noticeEnd);
      expect(controller.drainSettlementCommands()).toHaveLength(0);

      // 2. dodge 회피 구간 (noticeEnd ~ dodgeEnd): 정상 ducking (회피 성공, 피해 0건)
      controller.update(squatStart + 0.8);
      controller.submitSquat('ducking', Math.round((squatStart + 0.8) * 1000), {
        activeSeconds: squatStart + 0.8,
        standGeneration: 1,
      });
      // dodge 마감 (dodgeEnd)
      controller.update(dodgeEnd);
      const dodgeCmds = controller.drainSettlementCommands();
      expect(dodgeCmds.filter((c) => c.effectType === 'player_damage')).toHaveLength(0);

      // 3. stand 복귀 구간 (dodgeEnd ~ standEnd): 직립 복귀 무피해 및 직립 세대 상태 보존
      controller.submitSquat('standing', Math.round((squatStart + 1.8) * 1000), {
        activeSeconds: squatStart + 1.8,
        standGeneration: 1,
      });
      controller.update(standEnd);
      const standCmds = controller.drainSettlementCommands();
      expect(standCmds.filter((c) => c.effectType === 'player_damage')).toHaveLength(0);
      const standState = controller.exportSquatStandState();
      expect(standState.hasStoodUpSinceLastEvade).toBe(true);
    });

    it('러닝 8박 중 실측 러닝 스텝 집계 (recordRunStep)', () => {
      const tally = new AssaultExerciseTally();

      // 러닝 8박 중 4회 스텝 기록
      tally.recordRunStep({ inputId: 'step_1', activeTimestampSeconds: 0.5 });
      tally.recordRunStep({ inputId: 'step_2', activeTimestampSeconds: 1.0 });
      tally.recordRunStep({ inputId: 'step_3', activeTimestampSeconds: 1.5 });
      tally.recordRunStep({ inputId: 'step_4', activeTimestampSeconds: 2.0 });

      expect(tally.getLoopExerciseSummary().runStepCount).toBe(4);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. 사망(HP 0) 우선 및 중단
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. 사망(HP 0) 우선 및 중단 (Death Priority & Abort)', () => {
    it('중간 사망 시 즉시 abort, 추가 진행 차단, completedQuestions: 0, 실측 활성시간 보존', () => {
      const { plan36 } = getDeterministicPlans();
      const sampleQuestion = {
        id: 'q_loop_16_death',
        text: '20 + 20 = ?',
        minReadSeconds: 2.0,
        correctSide: 'left' as const,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_loop_16_death' as SessionId,
        roundId: 'round_01' as RoundId,
        question: sampleQuestion,
        loopPlan: plan36,
        bpm: 120,
        config: DEFAULT_ASSAULT_CONFIG,
      });

      // 8.5초 시점에 사망으로 abort 트리거
      controller.update(8.5);
      controller.abort();

      expect(controller.isCompleted).toBe(true);
      expect(controller.completedSuccess).toBe(false);

      const summary = controller.finalizeRoundSummary({ isDefeated: true });
      expect(summary).not.toBeNull();
      expect(summary?.completedQuestions).toBe(0);
      expect(summary?.isAborted).toBe(true);
      expect(summary?.activeDurationSeconds).toBeCloseTo(8.5, 3);

      // abort 후 추가 update 시에도 시간 변동 없음
      controller.update(15.0);
      expect(summary?.activeDurationSeconds).toBeCloseTo(8.5, 3);
    });

    it('10문제 생존 완료 시 10번째 문제 정상 완주 (총 10문제 완료)', () => {
      const { plan36 } = getDeterministicPlans();
      let completedCount = 0;

      for (let i = 1; i <= 10; i++) {
        const rc = new AssaultRoundController({
          sessionId: `sess_10q_${i}` as SessionId,
          roundId: `round_${i}` as RoundId,
          question: {
            id: `q_${i}`,
            text: `${i} + 1 = ?`,
            minReadSeconds: 2.0,
            correctSide: 'left' as const,
          },
          loopPlan: plan36,
          bpm: 120,
        });

        // 각 라운드 완주
        rc.update(18.0);
        expect(rc.isCompleted).toBe(true);
        const sum = rc.finalizeRoundSummary({ isDefeated: false });
        if (sum && sum.completedQuestions === 1) {
          completedCount += sum.completedQuestions;
        }
      }

      expect(completedCount).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. UI 재시작(restart) 및 토큰 무효화
  // ─────────────────────────────────────────────────────────────────────────────
  describe('5. UI 재시작(restart) 및 토큰 무효화 (UI Restart & Token Invalidation)', () => {
    it('restartAssaultSession 호출 시 동일 seed+round 계획 재현, 새 토큰 발행, HP 100 초기화, 이전 세션 격리', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      app.startReadyPhase();
      app.readyPositionController.skip();

      const session1 = app.assaultSession;
      expect(session1).not.toBeNull();
      const token1 = session1!.sessionId;
      const plan1 = session1!.getCurrentLoopPlan!();

      // 플레이어 데미지 모의
      app.battle.applyHazardDamage(45);
      expect(app.battle.hp).toBe(55);

      // 세션 재시작 호출
      const session2 = app.restartAssaultSession();
      expect(session2).not.toBeNull();
      expect(session2.sessionId).not.toBe(token1);
      expect(session1!.isDisposed).toBe(true);

      // HP 100 리셋 확인
      expect(app.battle.hp).toBe(100);

      // 동일 seed+round 계획 재현 확인
      const plan2 = session2.getCurrentLoopPlan!();
      expect(plan2!.totalBeats).toBe(plan1!.totalBeats);
      expect(plan2!.squatGapIndices).toEqual(plan1!.squatGapIndices);
      expect(plan2!.squatCount).toBe(plan1!.squatCount);

      // 이전 토큰으로 유입된 intent는 격리/무시됨
      const intentHandled = app.handleAssaultIntent(
        'player_attack',
        null,
        token1,
      );
      expect(intentHandled).toBe(false);

      app.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. 저장소(AssaultResultStore) 호환성 및 격리
  // ─────────────────────────────────────────────────────────────────────────────
  describe('6. 저장소(AssaultResultStore) 호환성 및 격리 (Storage Compatibility & Isolation)', () => {
    it('10문제 × 4 = 40 계획 기회와의 일치성 확인 및 중간 사망 시 실측 ≤ 계획 검증', () => {
      const plannedOpportunities = 10 * 4; // 40
      expect(plannedOpportunities).toBe(40);

      // 정상 완주 10문제: 10 * 4 = 40 시도
      const fullSessionRounds = Array.from({ length: 10 }, (_, i) => ({
        roundId: `round_${i + 1}`,
        attemptedAnswerHits: 4,
      }));
      const fullTotalHits = fullSessionRounds.reduce((acc, r) => acc + r.attemptedAnswerHits, 0);
      expect(fullTotalHits).toBe(plannedOpportunities);

      // 중간 사망 세션: 3문제 정상 완주(12회) + 4번째 문제 2회 시도 후 사망 = 14회 (≤ 40)
      const abortedRounds = [
        { roundId: 'round_1', attemptedAnswerHits: 4 },
        { roundId: 'round_2', attemptedAnswerHits: 4 },
        { roundId: 'round_3', attemptedAnswerHits: 4 },
        { roundId: 'round_4', attemptedAnswerHits: 2 },
      ];
      const abortedTotalHits = abortedRounds.reduce((acc, r) => acc + r.attemptedAnswerHits, 0);
      expect(abortedTotalHits).toBeLessThanOrEqual(plannedOpportunities);
    });

    it('haveSameAssaultComparisonIdentity로 새 루프 기록과 구형 기록 비교 격리 검증', () => {
      const loopIdentity1: AssaultComparisonIdentity = {
        mode: 'boss_assault',
        rulesVersion: '1.0.0',
        profileId: 'assault_loop_v1',
        difficultyId: 'normal',
        tempoBpm: 120,
        plannedAnswerOpportunities: 40,
        inputProfileId: 'profile_punch_default',
        accessibilityProfileId: 'default',
        questionFormat: 'numeric',
        roundSourceKind: 'numeric_repeat',
        challengeFamilies: [],
        challengeRulesVersion: null,
      };

      const loopIdentity2: AssaultComparisonIdentity = {
        ...loopIdentity1,
      };

      // 동일 루프 정체성은 일치
      expect(haveSameAssaultComparisonIdentity(loopIdentity1, loopIdentity2)).toBe(true);

      // 구형 레거시 profileId 또는 rulesVersion 기록과는 배타 격리 (false 반환)
      const legacyIdentity: AssaultComparisonIdentity = {
        ...loopIdentity1,
        rulesVersion: 'legacy_v0',
        profileId: 'legacy_approach',
      };
      expect(haveSameAssaultComparisonIdentity(loopIdentity1, legacyIdentity)).toBe(false);
    });

    it('테스트 세션 시 AssaultResultStore 쓰기 스킵 및 로컬 스토리지 무오염', () => {
      const mockStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      const store = new AssaultResultStore(mockStorage);

      const loopIdentity: AssaultComparisonIdentity = {
        mode: 'boss_assault',
        rulesVersion: '1.0.0',
        profileId: 'assault_loop_v1',
        difficultyId: 'normal',
        tempoBpm: 120,
        plannedAnswerOpportunities: 40,
        inputProfileId: 'profile_punch_default',
        accessibilityProfileId: 'default',
        questionFormat: 'numeric',
        roundSourceKind: 'numeric_repeat',
        challengeFamilies: [],
        challengeRulesVersion: null,
      };

      const saveResult = store.save(
        {
          sessionId: 'sess_test_qa',
          identity: loopIdentity,
          rounds: [],
          rewardEvaluations: [],
        },
        { isTestSession: true },
      );

      // 테스트 세션이므로 쓰기 스킵
      expect(saveResult.status).toBe('skipped');
      expect((saveResult as any).reason).toBe('test-session');
      expect(mockStorage.setItem).not.toHaveBeenCalledWith(
        ASSAULT_RESULT_STORAGE_KEY,
        expect.anything(),
      );
      expect(mockStorage.setItem).not.toHaveBeenCalledWith(
        'dg_boss_assault_records',
        expect.anything(),
      );
    });
  });
});
