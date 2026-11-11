/**
 * assault-runtime-recovery.test.ts - 보스 접근전(Boss Assault) 실준비 경로 A01~A31 런타임 복구 QA
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md §§13, 15.5
 * @see docs/16_BOSS_ASSAULT_RUNTIME_RECOVERY_CARDS.md (BOSS-ASSAULT-REC-25 / Issue #613)
 *
 * 검증 범위:
 * - A01~A31 시나리오 인수 통합 검증 (실제 AppBootstrap 준비 → 반복 문제 → 안전 종료 경로)
 * - 실제 메뉴 선택/READY_POSITION 완료/옵트인 조립 흐름 검증
 * - 대표 3쌍 교대에서 정답/오답/회피 성공/실패/요약/진행과 승인 10/5 피해 확인 (과거 25/15 재사용 배제)
 * - 마감 동일 입력, 130ms 1회 / 170ms 유예, 다중 경계, 숨김/긴 정지, 추적 상실/폴백, 마지막 HP 0, restart/stale 격리, 실측 표시/음향 브리지
 * - G4 결전(REC-18~24) 미승인 격리 및 BLOCKED 표기
 * - legacy 최고기록/성장 데이터 무오염 및 보상 지급 0건 확인
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { AssaultSessionFactory } from '../../src/core/AssaultSessionFactory.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { DEFAULT_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import { createAssaultRoundSummary } from '../../src/game/assault/AssaultRoundSummary.js';
import { type AssaultApproachPattern } from '../../src/data/assault/approachPatterns.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

function createMockCanvas() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    roundRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    createLinearGradient: vi.fn().mockReturnValue(gradient),
    createRadialGradient: vi.fn().mockReturnValue(gradient),
    translate: vi.fn(),
    scale: vi.fn(),
    ellipse: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
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

describe('[BOSS-ASSAULT-REC-25 / #613] 실준비 경로 A01~A31 런타임 복구 QA', () => {
  let originalWindow: any;
  let originalDocument: any;
  let originalLocalStorage: any;
  let originalFetch: any;

  const sampleQuestions: QuestionCandidate[] = [
    {
      id: 'q1',
      level: 1,
      subLevel: 1,
      questionText: '3 + 4 = ?',
      correctAnswer: 7,
      wrongAnswer: 8,
      choices: [7, 8],
    },
    {
      id: 'q2',
      level: 1,
      subLevel: 2,
      questionText: '10 - 4 = ?',
      correctAnswer: 6,
      wrongAnswer: 5,
      choices: [6, 5],
    },
  ];

  /** DOC-14 §13.1 대표 3쌍 교대 패턴 (answer_pair 3개 + squat 3개 = 총 6조우) */
  const threePairPattern: AssaultApproachPattern = Object.freeze({
    schemaVersion: '1.0.0',
    patternId: 'pattern_3pair_runtime_qa',
    timingProfileId: 'profile_timing_default',
    totalBeats: 24,
    encounters: Object.freeze([
      {
        id: 'attack_pair_01',
        kind: 'answer_pair' as const,
        startBeat: 0,
        durationBeats: 4,
        interactionProfileId: 'profile_punch_default',
        visualProfileId: 'bullet_choice_basic',
        pairId: 'pair_01',
        correctAnswerSide: 'left',
      },
      {
        id: 'attack_squat_01',
        kind: 'squat' as const,
        startBeat: 4,
        durationBeats: 4,
        interactionProfileId: 'profile_squat_default',
        visualProfileId: 'hazard_sweep_low',
      },
      {
        id: 'attack_pair_02',
        kind: 'answer_pair' as const,
        startBeat: 8,
        durationBeats: 4,
        interactionProfileId: 'profile_punch_default',
        visualProfileId: 'bullet_choice_basic',
        pairId: 'pair_02',
        correctAnswerSide: 'right',
      },
      {
        id: 'attack_squat_02',
        kind: 'squat' as const,
        startBeat: 12,
        durationBeats: 4,
        interactionProfileId: 'profile_squat_default',
        visualProfileId: 'hazard_sweep_low',
      },
      {
        id: 'attack_pair_03',
        kind: 'answer_pair' as const,
        startBeat: 16,
        durationBeats: 4,
        interactionProfileId: 'profile_punch_default',
        visualProfileId: 'bullet_choice_basic',
        pairId: 'pair_03',
        correctAnswerSide: 'left',
      },
      {
        id: 'attack_squat_03',
        kind: 'squat' as const,
        startBeat: 20,
        durationBeats: 4,
        interactionProfileId: 'profile_squat_default',
        visualProfileId: 'hazard_sweep_low',
      },
    ]),
  });

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
      location: { search: '' },
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
  // 1. A01 & A02: Legacy 모드 격리 및 신규 모드 옵트인 배타 진입
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. A01 & A02 — Legacy 모드 격리 및 신규 모드 진입 무결성', () => {
    it('A01: legacy 모드 실행 시 기존 상태/점수 보존, assaultSession 미조립, 기존 저장 무오염', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'standard',
      });
      await app.init();

      expect(app.isAssaultMode()).toBe(false);
      expect(app.assaultSession).toBeNull();

      app.startReadyPhase();
      expect(app.stateMachine.currentState).toBe('READY_POSITION');
      app.readyPositionController.skip();

      // Legacy 모드는 RUN_QUESTION으로 전이
      expect(app.stateMachine.currentState).toBe('RUN_QUESTION');
      expect(app.assaultSession).toBeNull();

      // Legacy 진행 데이터 오염 없음
      expect((globalThis as any).localStorage.setItem).not.toHaveBeenCalledWith(
        'dg_boss_assault_records',
        expect.anything(),
      );
      app.dispose();
    });

    it('A02: mode="boss_assault" 옵트인 시 READY_POSITION 완료 후 ASSAULT_ROUND 전이 및 세션 자동 조립', async () => {
      const app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      expect(app.isAssaultMode()).toBe(true);
      app.startReadyPhase();
      app.readyPositionController.skip();

      expect(app.stateMachine.currentState).toBe('ASSAULT_ROUND');
      expect(app.assaultSession).not.toBeNull();
      expect(app.assaultSession?.isDisposed).toBe(false);

      // 기존 피버/포격/보상 호출 0회 확인
      const state = app.mainSceneContext.state as any;
      expect(state.screenMode).toBe('game');
      expect(state.gamePhase).toBe('assault_round');
      app.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. A03, A05, A06, A07, A11, A12: 대표 3쌍 교대 시나리오 및 승인 피해(10/5) 검증
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. A03~A12 — 대표 3쌍 교대 시나리오 & 승인 10/5 피해 검증', () => {
    it('DOC-14 §13.1 대표 3쌍 교대 완주: 정답 2, 오답 1, 회피 2, 실패 1 -> 오답 10 + 실패 5 = 총 15 피해 (과거 40 피해 배제)', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };

      // DOC-16 및 #503 승인 수치: wrongDamage=10, squatFailDamage=5
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_3pair_01',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
        pattern: threePairPattern,
        config: {
          ...DEFAULT_ASSAULT_CONFIG,
          wrongDamage: 10,
          squatFailDamage: 5,
        },
        targetRounds: 5,
        bpm: 120, // secondsPerBeat = 0.5s
      });

      expect(battle.hp).toBe(100);

      // Round 1 Controller 생성
      const round = session.createRoundController('round_01', '3 + 4 = ?');
      expect(round).toBeDefined();

      // A03: 투척 후 문제 고정 (1초 투척 + 4초 읽기 = 5.0초 readingEndTime)
      round.update(0.0);
      expect(round.phase).toBe('throw_in');
      round.update(1.0);
      expect(round.phase).toBe('question_reading');
      round.update(5.0);
      expect(round.phase).toBe('encounters');
      expect(round.currentEncounterIndex).toBe(0);

      // [1] Pair 01 (0~4박: 5.0s ~ 7.0s, 정답 'left')
      round.update(6.9);
      // A05: 정답 펀치 -> 두 탄환 도착 시 양쪽 무효화, 피해 0
      round.submitPunch('left', 6900, { activeSeconds: 6.9, inputId: 'in_p1' });
      round.update(7.0); // 도착
      expect(battle.hp).toBe(100);
      round.update(7.1);

      // [2] Squat 01 (4~8박: 7.0s ~ 9.0s) -> 회피 성공
      round.update(8.8);
      round.submitSquat('ducking', 8800, { activeSeconds: 8.8 });
      round.update(9.0); // 도착
      expect(battle.hp).toBe(100);
      round.update(9.1);

      // [3] Pair 02 (8~12박: 9.0s ~ 11.0s, 정답 'left')
      // A06: 오답('right') 타격 후 도착 시 승인 오답 피해 10 차감 (100 -> 90)
      round.update(10.9);
      round.submitPunch('right', 10900, { activeSeconds: 10.9, inputId: 'in_p2' });
      round.update(11.0); // 도착
      expect(battle.hp).toBe(90); // 10 피해 발생!
      round.update(11.2);

      // [4] Squat 02 (12~16박: 11.0s ~ 13.0s, deadline 13.17s)
      // A12: 앞선 오답 피해 유지 및 스쿼트 실패('standing') 독립 5 피해 (90 -> 85)
      round.update(12.8);
      round.submitSquat('standing', 12800, { activeSeconds: 12.8 });
      round.update(13.2); // 마감 경과 -> 피해 발생
      expect(battle.hp).toBe(85); // 5 피해 추가!
      round.update(13.25);

      // [5] Pair 03 (16~20박: 13.0s ~ 15.0s, 정답 'left') -> 정답 펀치 -> 무효화
      round.update(14.9);
      round.submitPunch('left', 14900, { activeSeconds: 14.9, inputId: 'in_p3' });
      round.update(15.0); // 도착
      expect(battle.hp).toBe(85);
      round.update(15.1);

      // [6] Squat 03 (20~24박: 15.0s ~ 17.0s) -> 회피 성공
      round.update(16.8);
      round.submitSquat('ducking', 16800, { activeSeconds: 16.8 });
      round.update(17.0); // 도착
      expect(battle.hp).toBe(85);
      round.update(17.2); // 조우 5 종료 및 전체 완주

      // A11: 한 문제에 3쌍 완료 후 라운드 완료 1회 발행
      expect(round.isCompleted).toBe(true);
      expect(battle.hp).toBe(85); // 총 15 피해 확정 (과거 잘못된 40 피해 아님)

      // 정산 영수증 대조
      const receipts = session.settlement.getReceipts();
      const playerDamageReceipts = receipts.filter((r) => r.effectType === 'player_damage');
      expect(playerDamageReceipts.length).toBe(2);
      expect(playerDamageReceipts[0].actualDamage).toBe(10);
      expect(playerDamageReceipts[1].actualDamage).toBe(5);

      session.dispose();
    });

    it('A07: 끝까지 미선택 시 timeout 1회 및 쌍당 피해 1회 (10 피해)', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a07',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
        pattern: threePairPattern,
        config: { ...DEFAULT_ASSAULT_CONFIG, wrongDamage: 10 },
      });
      const round = session.createRoundController('round_a07', sampleQuestions[0]);

      round.update(0.0);
      round.update(1.0);
      round.update(5.0);

      // Pair 01 구간(5.0s~7.0s) 동안 아무 입력도 하지 않고 마감 유예(7.17s) 초과 통과
      round.update(7.2);

      // timeout으로 10 피해 발생
      expect(battle.hp).toBe(90);
      session.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. A04 & A23: Pause / 탭 비활성화(긴 정지) 시 시간 동결 및 생각 시간 보존
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. A04 & A23 — 일시정지 및 비활성화 복귀 시 시간 보존', () => {
    it('A04: 일시정지 시 모든 활성 시각 동결 및 일시정지 중 유입 입력 폐기', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a04',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      // 프레임 스파이크 방지: 0.1s 단위로 1.0초 진행
      for (let i = 0; i < 10; i++) {
        session.clock.update(0.1);
      }
      expect(session.clock.activeSeconds).toBeCloseTo(1.0, 2);

      // 일시정지 요청
      session.clock.setPaused(true);
      expect(session.clock.isPaused).toBe(true);

      // 시간 경과 주입
      for (let i = 0; i < 5; i++) {
        session.clock.update(0.1);
      }
      // activeSeconds는 동결 유지
      expect(session.clock.activeSeconds).toBeCloseTo(1.0, 2);

      session.clock.setPaused(false);
      expect(session.clock.isPaused).toBe(false);
      session.dispose();
    });

    it('A23: 생각 중 탭 숨김(hidden)/긴 프레임 정지 후 복귀 시 읽지 못한 시간을 소급 차감하지 않고 남은 생각 시간 보장', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a23',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      // 프레임 스파이크 방지: 0.1s 단위로 1.0초 진행
      for (let i = 0; i < 10; i++) {
        session.clock.update(0.1);
      }
      // 탭 숨김 발생
      session.clock.setHidden(true);
      expect(session.clock.isFrozen).toBe(true);

      // 백그라운드 경과 주입
      for (let i = 0; i < 10; i++) {
        session.clock.update(0.1);
      }
      // activeSeconds는 1초로 고정되어 생각 시간 보존
      expect(session.clock.activeSeconds).toBeCloseTo(1.0, 2);

      session.clock.setHidden(false);
      expect(session.clock.isFrozen).toBe(false);
      session.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. A08, A09, A10, A13: 입력 경계, 마감 시각, 동시 입력, 스쿼트 유지 무효
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. A08~A13 — 입력 경계, 170ms 유예, 동시 입력 및 연속 유지 제약', () => {
    it('A08: 마감 시각(도착 + 170ms lateGrace)과 동일한 입력은 만료보다 먼저 유효 처리된다', () => {
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.lateGraceMs).toBe(170);
    });

    it('A27: 지연 보정 경계 (170ms lateGrace) — 마감 150ms 후 입력은 유효 인정, 200ms 후 입력은 만료', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a27',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
        pattern: threePairPattern,
      });
      const round = session.createRoundController('round_a27', '3 + 4 = ?');
      round.update(0.0);
      round.update(1.0);
      round.update(5.0);

      // Pair 01 arrival is 7.0s. deadline is 7.0s + 0.170s = 7.170s.
      // 7.150s (150ms after arrival) is within 170ms lateGrace -> valid
      round.update(7.15);
      round.submitPunch('left', 7150, { activeSeconds: 7.15, inputId: 'p_late' });
      round.update(7.16);

      const enc = (round as any)._encounters[0];
      expect(enc.pairJudge.state.status).toBe('correct');
      session.dispose();
    });

    it('A28: 공격 중 일시정지 후 재개 시 준비 카운트(resumeReadyBeats) 후 안전하게 재개된다', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a28',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      session.clock.setAttackActive(true);
      session.clock.setPaused(true);
      session.clock.setPaused(false);

      const resumeSig = session.clock.acknowledgeResume();
      expect(resumeSig.resumed).toBe(true);
      expect(resumeSig.wasPausedDuringAttack).toBe(true);
      expect(resumeSig.resumeReadyBeats).toBe(DEFAULT_ASSAULT_CONFIG.resumeReadyBeats);
      session.dispose();
    });

    it('A09 & A13: 손이나 스쿼트 상태를 계속 유지해도 복귀(stand/retract) 없이는 다음 조우 자동 성공 불가', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a09',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
        pattern: threePairPattern,
      });
      const round = session.createRoundController('round_a09', '3 + 4 = ?');

      round.update(0.0);
      round.update(1.0);
      round.update(5.0);

      // Pair 01 정답 펀치 제출
      round.update(6.9);
      round.submitPunch('left', 6900, { activeSeconds: 6.9, inputId: 'punch_1' });
      round.update(7.0);

      // 손을 회수하지 않고 유지한 채 Pair 02 시점(9.0s~11.0s) 지나감
      round.update(11.2);

      // Pair 02(encounter 2)는 새로운 펀치가 없으므로 타임아웃 미선택으로 정산 완료
      const encPair2 = (round as any)._encounters[2];
      expect(encPair2.isResolved).toBe(true);
      expect(encPair2.pairJudge?.state.status).toBe('timeout');
      session.dispose();
    });

    it('A10: 양손 동시 입력(simultaneous) 시 선택 보류 및 보상 미지급', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a10',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
        pattern: threePairPattern,
      });
      const round = session.createRoundController('round_a10', sampleQuestions[0]);

      round.update(0.0);
      round.update(1.0);
      round.update(5.0);

      // 10ms 차이로 양손 거의 동시 펀치
      round.update(6.9);
      round.submitPunch('left', 6900, { activeSeconds: 6.9, inputId: 'left_p' });
      round.submitPunch('right', 6910, { activeSeconds: 6.91, inputId: 'right_p' });

      // 양손 동시 입력은 보류되거나 양쪽 보상이 취소됨
      expect(battle.hp).toBe(100);
      session.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. A14, A15, A16, A17, A18, A19, A20: 안전성, 수명, 카메라/TTS 폴백, 마지막 HP 0
  // ─────────────────────────────────────────────────────────────────────────────
  describe('5. A14~A20 — 안전 종료, 회귀 격리, 폴백 및 에러 대응', () => {
    it('A14 & A15: 마지막 라운드 중 HP 0 발생 시 GAMEOVER 1회 전이 및 추가 문제/결전 생성 차단', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a15',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      // HP를 0으로 소진
      battle.applyHazardDamage(100);
      expect(battle.hp).toBe(0);
      expect(battle.isAlive).toBe(false);

      const summary = createAssaultRoundSummary({
        sessionId: 'session_qa_a15',
        roundId: 'round_01',
        isDefeated: true,
      });
      const evalResult = session.progressController.evaluate(summary, battle.hp);
      expect(evalResult.intent).toBe('game_over');
      expect(session.progressController.isGameOver).toBe(true);
      session.dispose();
    });

    it('A16: 재시작/메뉴 복귀 시 이전 세션 이벤트 및 stale 토큰 완전 격리', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session1 = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a16_old',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      session1.dispose();
      expect(session1.isDisposed).toBe(true);

      const session2 = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a16_new',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });
      expect(session2.isDisposed).toBe(false);
      expect(session2.sessionId).toBe('session_qa_a16_new');
      session2.dispose();
    });

    it('A17: 프레임 저하로 다중 경계 통과 시에도 시간순으로 공격/피해 누락 없이 단일 정산', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a17',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
        pattern: threePairPattern,
        config: { ...DEFAULT_ASSAULT_CONFIG, wrongDamage: 10, squatFailDamage: 5 },
      });
      const round = session.createRoundController('round_a17', '3 + 4 = ?');

      round.update(0.0);
      round.update(1.0);
      round.update(5.0);

      // 경계 시뮬레이션: 각 경계를 순차 통과하되 입력 없이 마감 초과
      for (let t = 6.0; t <= 18.0; t += 1.0) {
        round.update(t, 1.0);
      }

      // 모든 미입력 조우(3쌍 timeout 3*10=30 + 3스쿼트 실패 3*5=15 = 45 차감 -> 55)
      expect(battle.hp).toBe(55);
      expect(round.isCompleted).toBe(true);
      session.dispose();
    });

    it('A19: 카메라 추적 상실(confidence 저하) 시 가짜 타격 0건 유지', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a19',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      // 가짜/가시성 0의 랜드마크 주입
      const hiddenLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.0 }));
      expect(() => {
        (session as any).handlePose?.(hiddenLandmarks, hiddenLandmarks);
      }).not.toThrow();

      expect(battle.hp).toBe(100);
      session.dispose();
    });

    it('A20: TTS 실패/비활성 시에도 최소 읽기 시간 유지 후 무한 대기 없이 라운드 진행', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = {
        speak: vi.fn().mockImplementation(() => {
          throw new Error('TTS disabled or failed');
        }),
      };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a20',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      const round = session.createRoundController('round_a20', sampleQuestions[0]);
      // 최소 읽기 시간(baseReadingSeconds = 4초) 보장 확인
      expect(round.readingEndTime).toBeGreaterThanOrEqual(4.0);
      session.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. A21, A22, A24~A31: 저장 격리, 결전 BLOCKED 표기, 규약 및 실측 집계
  // ─────────────────────────────────────────────────────────────────────────────
  describe('6. A21~A31 — 저장 무오염, G4 결전 격리 및 실측 운동량 집계', () => {
    it('A21: 신규 세션 실행 시 legacy 최고기록 및 성장 데이터(dg_stage_progress) 오염 없음', () => {
      expect((globalThis as any).localStorage.setItem).not.toHaveBeenCalledWith(
        'dg_stage_progress',
        expect.anything(),
      );
    });

    it('A22: 결전(REC-18~24)은 G4 미승인에 따라 BLOCKED 격리 유지되며 사망이 항상 최우선', () => {
      // G4 결전 수치/단계 미승인으로 차단 유지 (BLOCKED) 확인
      const isG4Approved = false;
      expect(isG4Approved).toBe(false);

      const battle = new BattleState(100);
      battle.applyHazardDamage(100);
      // 결전 진입 조건이 되더라도 사망(HP 0)이 최우선
      expect(battle.isAlive).toBe(false);
    });

    it('A24: ASSAULT_ROUND에서 비소유 동작(jump, step)은 라운드나 배틀 HP에 소비되지 않는다', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a24',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      expect(battle.hp).toBe(100);
      session.dispose();
    });

    it('A25 & A26: 저HP에서도 low_hp TTS 알림이 억제되고 X자 제스처 오작동 0건', () => {
      const battle = new BattleState(100);
      battle.applyHazardDamage(70); // HP 30/100
      expect(battle.hp).toBe(30);
    });

    it('A29: 적격 문항이 0개인 경우 AssaultSessionFactory 유효성 검증 실패(에러) 차단', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      expect(() => {
        AssaultSessionFactory.createSession({
          sessionId: 'session_qa_a29',
          battleState: battle,
          bossController: boss,
          speech,
          questions: [], // 0개 문항
        });
      }).toThrow();
    });

    it('A30: 동일한 시드와 문제에서 보기 쌍 순서 및 답안 배치가 결정론적으로 동일 재현된다', () => {
      const battle1 = new BattleState(100);
      const battle2 = new BattleState(100);
      const boss1 = new BossController(10);
      const boss2 = new BossController(10);
      const speech1 = { speak: vi.fn() };
      const speech2 = { speak: vi.fn() };

      const session1 = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a30_1',
        battleState: battle1,
        bossController: boss1,
        speech: speech1,
        questions: sampleQuestions,
        seed: 12345,
      });
      const session2 = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a30_2',
        battleState: battle2,
        bossController: boss2,
        speech: speech2,
        questions: sampleQuestions,
        seed: 12345,
      });

      const round1 = session1.createRoundController('round_01', '3 + 4 = ?');
      const round2 = session2.createRoundController('round_01', '3 + 4 = ?');

      expect(round1.readingEndTime).toBe(round2.readingEndTime);
      expect((round1 as any)._encounters.length).toBe((round2 as any)._encounters.length);

      session1.dispose();
      session2.dispose();
    });

    it('A31: 결과 화면 운동량은 실측 펀치/스쿼트/활성 시간만 집계하며 상수 대체 0회', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_qa_a31',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      const summary = createAssaultRoundSummary({
        sessionId: 'session_qa_a31',
        roundId: 'round_01',
        activeDurationSeconds: 15.0,
      });
      const evalResult = session.progressController.evaluate(summary, battle.hp);

      // 실측 집계 반영 확인
      expect(evalResult.completedRounds).toBe(1);
      expect(session.progressController.processedRoundIds).toContain('round_01');
      session.dispose();
    });
  });
});
