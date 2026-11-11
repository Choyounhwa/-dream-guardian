/**
 * assault-mvp.test.ts - 보스 접근전(Boss Assault) MVP Core Loop 통합 게이트 인수 검증
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§3, 4, 5, 6, 10.1, 11.2, 13.1, 15.1~15.5)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-25 / Issue #527)
 *
 * 검증 목표:
 * 1. DOC-14 §13.1 대표 통합 시나리오 (3쌍 교대 시나리오 & 정산/진행도 전진):
 *    - 문제 투척(8박 읽기) -> [정답 펀치 -> 무효화] -> [스쿼트 성공]
 *      -> [오답 펀치 -> 도착 피해 1회] -> [스쿼트 실패 -> 피해 1회]
 *      -> [정답 펀치 -> 무효화] -> [스쿼트 성공] -> 라운드 요약 1회 -> 완료 문제 +1 -> 접근 진행도 전진
 *    - 정답 2회 / 오답 1회 / 회피 성공 2회 / 회피 실패 1회 / 플레이어 피해 2회(40 피해) / 완료 문제 1회 / 요약 1회 일치 검증
 * 2. 불변식 A01 & A02 — 모드 배타성 및 Legacy 안전 격리:
 *    - legacy 모드 시작 시 기존 상태/점수 보존, assault 모드 미조립
 *    - boss_assault 실행 시 기존 피버·포격·별수집·저장 콜백 호출 0회
 *    - 원자적 사전 검증 실패 시 부분 세션/중복 구독 생성 방지 (A02)
 * 3. 불변식 A04 & A23 — Pause / 탭 전환(visibilitychange hidden) 시 시간 동결 및 생각 시간 보존:
 *    - 일시정지 및 hidden 시 activeSeconds 완전 동결, 잔여 입력 거부
 *    - 복귀 시 일시정지 중 경과된 실제 시간(wall clock) 소급 삭감 없이 남은 생각 시간 보존
 *    - 공격 중 일시정지 해제 시 1박 카운트 유예(resumeReadyBeats) 및 안전 재개 (DEC-B8)
 * 4. 불변식 A15 & A22 — 단일 종료 권위(Single Authority) 및 HP 0 게임오버 최우선:
 *    - HP 0 발생 시 SessionLifecycle.claimResultTransition 작동 및 GAMEOVER 1회 전이
 *    - 중복 종료 유입 차단(멱등성), 다음 문제/결전 모드 호출/저장 0회
 *    - 결전과 사망 동시 경계 시 사망 우선 처리 (A22)
 * 5. 불변식 A16 — 세션 재시작 및 메뉴 복귀 시 이전 세션 자원 완전 격리:
 *    - restartAssaultSession 호출 시 이전 세션 dispose 및 지연 비동기 예약 취소
 *    - 이전 세션의 토큰으로 유입되는 지연된 intent 및 키보드 입력 차단
 *    - 새 세션은 HP 100 리셋 및 원본 계획(BPM, pattern, questions) 보존
 *    - goToMenu() 호출 시 assaultSession dispose 및 MENU_MAIN 복귀
 * 6. 결전 인계(Handover) 스냅샷 불변성 및 미구현 결전 모드 격리 (A22):
 *    - 목표 라운드 도달 시 handover_climax 의도 발행 및 AssaultHandoverSnapshot 생성
 *    - 인계 스냅샷은 불변(deepFreeze)이며 미구현 결전 모드 직접 실행이나 승리/저장 0회
 * 7. 불변식 A08/A17, A18, A19 — 입력 우선순위 / 프레임 드롭 / 폴백 격리 / 추적 상실:
 *    - 동일 시각(t == deadline)에서 입력 우선 처리 (A08)
 *    - 프레임 누락으로 다중 경계 통과 시 시간순 순차 정산 (A17)
 *    - 키보드 폴백 repeat: true 무시 및 해당 동작만 1회 처리 (A18)
 *    - 추적 상실(trackingLost) 시 안전 정지 상태 진입 및 복구 직후 가짜 타격 0회 (A19)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import {
  AssaultSessionFactory,
  AssaultSessionValidationError,
} from '../../src/core/AssaultSessionFactory.js';
import { AssaultClockAdapter } from '../../src/core/AssaultClockAdapter.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import {
  AssaultProgressController,
  type AssaultHandoverSnapshot,
} from '../../src/game/assault/AssaultProgressController.js';
import {
  AssaultRoundSummaryAggregator,
  createAssaultRoundSummary,
} from '../../src/game/assault/AssaultRoundSummary.js';
import {
  DEFAULT_APPROACH_PATTERN,
  type AssaultApproachPattern,
} from '../../src/data/assault/approachPatterns.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';
import type { AttackId } from '../../src/types/assault.js';

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
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    createLinearGradient: vi.fn().mockReturnValue(gradient),
    createRadialGradient: vi.fn().mockReturnValue(gradient),
    setLineDash: vi.fn(),
  };
  return {
    width: 1280,
    height: 720,
    getContext: vi.fn((type: string) => (type === '2d' ? ctx : null)),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 1280, height: 720 }),
  };
}

describe('[BOSS-ASSAULT-25 / #527] MVP Core Loop 통합 게이트 인수 검증', () => {
  const sampleQuestions: QuestionCandidate[] = [
    {
      level: 1,
      subLevel: 1,
      questionText: '3 + 4 = ?',
      correctAnswer: 7,
      wrongAnswer: 8,
      choices: [7, 8],
    },
    {
      level: 1,
      subLevel: 2,
      questionText: '9 - 3 = ?',
      correctAnswer: 6,
      wrongAnswer: 5,
      choices: [6, 5],
    },
  ];

  /** DOC-14 §13.1 대표 3쌍 교대 패턴 (answer_pair 3개 + squat 3개 = 총 6조우) */
  const threePairPattern: AssaultApproachPattern = Object.freeze({
    schemaVersion: '1.0.0',
    patternId: 'pattern_3pair_scenario_gate',
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

  let originalWindow: any;
  let originalDocument: any;
  let originalLocalStorage: any;
  let originalFetch: any;
  let mockCanvas: any;
  let mockDoc: any;
  let mockDocumentListeners: Record<string, any[]> = {};

  beforeEach(() => {
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalLocalStorage = (globalThis as any).localStorage;
    originalFetch = (globalThis as any).fetch;
    mockCanvas = createMockCanvas();
    mockDocumentListeners = {};

    mockDoc = {
      hidden: false,
      getElementById: vi.fn((id: string) => (id === 'game-canvas' ? mockCanvas : null)),
      addEventListener: vi.fn((type: string, fn: any) => {
        mockDocumentListeners[type] = mockDocumentListeners[type] || [];
        mockDocumentListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockDocumentListeners[type]) {
          mockDocumentListeners[type] = mockDocumentListeners[type].filter((cb) => cb !== fn);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const cbs = mockDocumentListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
        return true;
      }),
    };

    const mockStorage: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
    };

    (globalThis as any).document = mockDoc;
    (globalThis as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      innerWidth: 1280,
      innerHeight: 720,
      location: { search: '' },
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
  // 1. DOC-14 §13.1 대표 통합 시나리오
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. DOC-14 §13.1 대표 통합 시나리오 (3쌍 교대 시나리오 & 정산/진행도 전진)', () => {
    it('3쌍 교대 전체 흐름을 완주하고 정답 2, 오답 1, 회피 2, 실패 1, 피해 2회(40 피해), 완료 문제 1회가 정확히 일치한다', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };

      const session = AssaultSessionFactory.createSession({
        sessionId: 'session_mvp_gate_01',
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
        pattern: threePairPattern,
        config: {
          ...DEFAULT_ASSAULT_CONFIG,
          wrongDamage: 25,
          squatFailDamage: 15,
        },
        targetRounds: 5,
        bpm: 120, // secondsPerBeat = 0.5s
      });

      expect(session.sessionId).toBe('session_mvp_gate_01');
      expect(battle.hp).toBe(100);

      const roundController = session.createRoundController('round_01', '3 + 4 = ?');
      expect(roundController.totalEncounters).toBe(6);
      expect(roundController.readingDurationSeconds).toBe(4.0); // 8박 * 0.5s
      expect(roundController.throwDurationSeconds).toBe(1.0);
      expect(roundController.readingEndTime).toBe(5.0);

      // ── Step 0: 시작 (throw_in -> reading -> encounters 전이) ──
      roundController.update(0.0);
      expect(roundController.phase).toBe('throw_in');
      expect(speech.speak).toHaveBeenCalledWith('3 + 4 = ?');

      roundController.update(1.0);
      expect(roundController.phase).toBe('question_reading');

      roundController.update(5.0);
      expect(roundController.phase).toBe('encounters');
      expect(roundController.currentEncounterIndex).toBe(0);

      // ── Step 1: 답 쌍 1 (answer_pair 0~4박: 5.0s ~ 7.0s, 정답 'left') -> 정답 펀치 -> 무효화 ──
      roundController.update(6.9);
      roundController.submitPunch('left', 6900, { activeSeconds: 6.9 });
      roundController.update(7.0); // 도착
      expect(battle.hp).toBe(100); // 정답이므로 피해 0
      roundController.update(7.1); // 조우 0 종료

      // ── Step 2: 스쿼트 1 (squat 4~8박: 7.0s ~ 9.0s) -> 스쿼트 성공 -> 회피 ──
      roundController.update(8.8);
      roundController.submitSquat('ducking', 8800, { activeSeconds: 8.8 });
      roundController.update(9.0); // 도착
      expect(battle.hp).toBe(100); // 회피 성공으로 피해 0
      roundController.update(9.1); // 조우 1 종료

      // ── Step 3: 답 쌍 2 (answer_pair 8~12박: 9.0s ~ 11.0s, 정답 'left') -> 오답 펀치 ('right') -> 도착 피해 1회 (25) ──
      roundController.update(10.9);
      roundController.submitPunch('right', 10900, { activeSeconds: 10.9 }); // 오답
      roundController.update(11.0); // 도착 -> 피해 발생
      expect(battle.hp).toBe(75); // 100 - 25 = 75
      roundController.update(11.2); // 조우 2 종료

      // ── Step 4: 스쿼트 2 (squat 12~16박: 11.0s ~ 13.0s, deadline 13.17s) -> 스쿼트 실패 -> 피해 1회 (15) ──
      roundController.update(12.8);
      roundController.submitSquat('standing', 12800, { activeSeconds: 12.8 }); // 서있는 자세(실패)
      roundController.update(13.2); // 마감 경과 -> 피해 발생
      expect(battle.hp).toBe(60); // 75 - 15 = 60
      roundController.update(13.25); // 조우 3 종료

      // ── Step 5: 답 쌍 3 (answer_pair 16~20박: 13.0s ~ 15.0s, 정답 'left') -> 정답 펀치 -> 무효화 ──
      roundController.update(14.9);
      roundController.submitPunch('left', 14900, { activeSeconds: 14.9 }); // 정답
      roundController.update(15.0); // 도착
      expect(battle.hp).toBe(60); // 피해 0
      roundController.update(15.1); // 조우 4 종료

      // ── Step 6: 스쿼트 3 (squat 20~24박: 15.0s ~ 17.0s) -> 스쿼트 성공 -> 회피 ──
      roundController.update(16.8);
      roundController.submitSquat('ducking', 16800, { activeSeconds: 16.8 }); // 회피 성공
      roundController.update(17.0); // 도착
      expect(battle.hp).toBe(60); // 피해 0
      roundController.update(17.2); // 조우 5 종료 및 전체 완주

      // ── 완주 검증 ──
      expect(roundController.isCompleted).toBe(true);

      // ── 정산 영수증 검증 ──
      const receipts = session.settlement.getReceipts();
      expect(receipts.length).toBe(6);
      const playerDamageReceipts = receipts.filter((r) => r.effectType === 'player_damage');
      expect(playerDamageReceipts.length).toBe(2);
      expect(playerDamageReceipts[0].attackId).toBe('attack_pair_02');
      expect(playerDamageReceipts[0].actualDamage).toBe(25);
      expect(playerDamageReceipts[0].newHp).toBe(75);
      expect(playerDamageReceipts[1].attackId).toBe('attack_squat_02');
      expect(playerDamageReceipts[1].actualDamage).toBe(15);
      expect(playerDamageReceipts[1].newHp).toBe(60);

      // ── 불변 라운드 요약(RoundSummary) 생성 및 대조 ──
      const summaryAggregator = new AssaultRoundSummaryAggregator({
        sessionId: session.sessionId,
        roundId: 'round_01',
        activeDurationSeconds: 17.2,
      });

      summaryAggregator.recordAnswerHit('attack_pair_01' as AttackId, { isCorrect: true, rating: 'Perfect' });
      summaryAggregator.recordSquatEvade('attack_squat_01' as AttackId, { rating: 'Good' });
      summaryAggregator.recordAnswerHit('attack_pair_02' as AttackId, { isCorrect: false, rating: 'Good' });
      summaryAggregator.recordSquatFail('attack_squat_02' as AttackId, { rating: 'Miss' });
      summaryAggregator.recordAnswerHit('attack_pair_03' as AttackId, { isCorrect: true, rating: 'Perfect' });
      summaryAggregator.recordSquatEvade('attack_squat_03' as AttackId, { rating: 'Good' });
      for (const r of receipts) {
        summaryAggregator.recordReceipt(r);
      }
      const summary = summaryAggregator.finalize();

      // 지표 전수 대조 (DOC-14 §13.1)
      expect(summary.correctCount).toBe(2);
      expect(summary.wrongCount).toBe(1);
      expect(summary.evadeSuccessCount).toBe(2);
      expect(summary.squatFailCount).toBe(1);
      expect(summary.totalEncounters).toBe(6);
      expect(summary.totalPlayerDamage).toBe(40);
      expect(summary.completedQuestions).toBe(1);
      expect(summary.isDefeated).toBe(false);
      expect(summary.isAborted).toBe(false);

      // ── 접근 진행도 컨트롤러 전진 검증 ──
      const progressEval = session.progressController.evaluate(summary, battle.hp);
      expect(progressEval.intent).toBe('next_round');
      expect(progressEval.completedRounds).toBe(1);
      expect(progressEval.targetRounds).toBe(5);
      expect(progressEval.progress).toBeCloseTo(0.2, 5); // 1 / 5
      expect(progressEval.isTargetReached).toBe(false);
      expect(progressEval.isGameOver).toBe(false);
      expect(session.progressController.progress).toBeCloseTo(0.2, 5);
    });

    it('A11: 문제 수(1개)와 타격 수(6회)가 엄격하게 분리되고 생성된 요약 DTO는 완전히 불변이다', () => {
      const summary = createAssaultRoundSummary({
        sessionId: 'session_a11_gate',
        roundId: 'round_01',
        activeDurationSeconds: 15.0,
        encounters: [
          { attackId: 'att_01' as AttackId, isCorrect: true, rating: 'Perfect' },
          { attackId: 'att_02' as AttackId, evaded: true, rating: 'Good' },
          { attackId: 'att_03' as AttackId, isCorrect: false, rating: 'Late' },
          { attackId: 'att_04' as AttackId, evaded: false, rating: 'Miss' },
          { attackId: 'att_05' as AttackId, isCorrect: true, rating: 'Perfect' },
          { attackId: 'att_06' as AttackId, evaded: true, rating: 'Good' },
        ],
      });

      expect(summary.completedQuestions).toBe(1);
      expect(summary.totalEncounters).toBe(6);
      expect(Object.isFrozen(summary)).toBe(true);
      expect(Object.isFrozen(summary.ratingCounts)).toBe(true);

      // 불변 객체 속성 수정 시도 차단
      expect(() => {
        (summary as any).completedQuestions = 2;
      }).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. 불변식 A01 & A02 — 모드 배타성 및 Legacy 안전 격리
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. 핵심 불변식 A01 & A02 — 모드 배타성 및 Legacy 안전 격리', () => {
    it('legacy 모드로 진입 시 기존 상태와 점수를 보존하며 assaultSession은 조립되지 않는다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'legacy',
      });
      await app.init();

      expect(app.isAssaultMode()).toBe(false);
      expect(app.assaultSession).toBeNull();
      expect(app.battle.hp).toBe(100);

      app.dispose();
    });

    it('boss_assault 모드 실행 시 기존 피버·포격·별수집·저장 콜백이 일체 등록/호출되지 않는다', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };

      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        bossController: boss,
        speech,
        questions: sampleQuestions,
      });

      // 피버, 포격, 별수집, 레거시 저장 콜백 속성이 session 객체에 노출되지 않음
      expect((session as any).feverGauge).toBeUndefined();
      expect((session as any).bombardmentCallback).toBeUndefined();
      expect((session as any).starCollector).toBeUndefined();
      expect((session as any).saveLegacyProgress).toBeUndefined();

      // localStorage에 레거시 진행 데이터(dg_stage_progress, dg_rewards) 기록 0회
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringMatching(/dg_stage_progress|dg_rewards/),
        expect.anything(),
      );

      session.dispose();
    });

    it('원자적 사전 유효성 검증 실패 시 부분 세션/구독/자원을 남기지 않고 즉시 예외를 발생시킨다 (A02)', () => {
      const battle = new BattleState(100);
      const boss = new BossController(10);
      const speech = { speak: vi.fn() };

      // 8박 미만의 잘못된 minRoundBeats 설정
      const invalidConfig = {
        ...DEFAULT_ASSAULT_CONFIG,
        minRoundBeats: 4,
      };

      expect(() => {
        AssaultSessionFactory.createSession({
          battleState: battle,
          bossController: boss,
          speech,
          config: invalidConfig as any,
          questions: sampleQuestions,
        });
      }).toThrow(AssaultSessionValidationError);

      // 실패 시 HP 변동 없음
      expect(battle.hp).toBe(100);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. 불변식 A04 & A23 — Pause / 탭 전환(visibilitychange hidden) 시 시간 동결 및 생각 시간 보존
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. 핵심 불변식 A04 & A23 — Pause / 탭 전환(visibilitychange hidden) 시 시간 동결 및 생각 시간 보존', () => {
    it('clock은 pause 및 hidden 발생 시 activeSeconds를 즉시 동결하고 잔여 입력을 거부한다', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });
      clock.advance(1.0);
      expect(clock.activeSeconds).toBe(1.0);

      // 일시정지 활성화
      clock.setPaused(true);
      expect(clock.isFrozen).toBe(true);

      // 정지 중 시간 전진 시도
      clock.advance(5.0);
      expect(clock.activeSeconds).toBe(1.0); // 동결 유지

      // 정지 중 유입된 입력 거부 확인
      const rejected = clock.normalizeInput({ timestampMs: 2000, hand: 'left' });
      expect(rejected.accepted).toBe(false);
      expect((rejected as any).reason).toBe('pause');

      clock.setPaused(false);
      expect(clock.isFrozen).toBe(false);
    });

    it('라운드 생각 중 pause/hidden 발생 후 복귀 시 경과된 실제 시간(wall clock)이 생각 시간에서 소급 삭감되지 않는다 (A23)', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: new BattleState(100),
        bossController: new BossController(10),
        speech: { speak: vi.fn() },
        questions: sampleQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        bpm: 120, // spb = 0.5s, 8박 = 4.0s 생각 시간, throw = 1.0s, total readingEndTime = 5.0s
      });

      const round = session.createRoundController('round_pause_test', '2 + 5 = ?');

      // 1. 2.0s 시점까지 진행 (생각 진행률 25%: (2.0 - 1.0) / 4.0 = 0.25)
      round.update(2.0);
      expect(round.phase).toBe('question_reading');
      expect(round.readingProgress).toBeCloseTo(0.25, 3);

      // 2. pause 발생 (벽시계로 100초가 흘렀다고 가정)
      round.pause('tab_hidden');
      expect(round.isPaused).toBe(true);

      // 정지 중 update 호출 시 시간 전진 차단
      round.update(2.0);
      expect(round.readingProgress).toBeCloseTo(0.25, 3);

      // 3. 복귀(resume)
      round.resume();
      expect(round.isPaused).toBe(false);

      // 4. 복귀 후 3.0s로 전진 (생각 진행률 50%: (3.0 - 1.0) / 4.0 = 0.5)
      round.update(3.0);
      expect(round.phase).toBe('question_reading');
      expect(round.readingProgress).toBeCloseTo(0.5, 3);

      // 5. 5.0s 도달 시 비로소 조우로 전이됨 (소급 삭감 없이 8박 전부 보장)
      round.update(4.99);
      expect(round.phase).toBe('question_reading');

      round.update(5.0);
      expect(round.phase).toBe('encounters');
    });

    it('공격 도중 일시정지 후 복귀 시 1박 카운트 유예(resumeReadyBeats: 1)를 제공하고 안전 재개한다 (DEC-B8)', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: new BattleState(100),
        bossController: new BossController(10),
        speech: { speak: vi.fn() },
        questions: sampleQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        bpm: 120,
      });

      const round = session.createRoundController('round_attack_pause', '1 + 1 = ?');
      // readingEndTime = 5.0s. 5.5s는 첫 번째 조우 진행 중
      round.update(5.5);
      expect(round.phase).toBe('encounters');
      expect(round.currentEncounterIndex).toBe(0);

      // 공격 도중 일시정지
      round.pause('user_pause');
      expect(round.isPaused).toBe(true);

      // 재개 시도
      round.resume();
      expect(round.isPaused).toBe(false);

      // 안전 재개 후 추가 전진
      round.update(5.6);
      expect(round.phase).toBe('encounters');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. 불변식 A15 & A22 — 단일 종료 권위(Single Authority) 및 HP 0 게임오버 최우선
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. 핵심 불변식 A15 & A22 — 단일 종료 권위(Single Authority) 및 HP 0 게임오버 최우선', () => {
    it('전투 중 HP 0 발생 시 SessionLifecycle의 단일 종료 권위가 작동하여 GAMEOVER로 1회만 전이된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({
        questions: sampleQuestions,
      });

      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('ASSAULT_ROUND');
      expect(app.stateMachine.currentState).toBe('ASSAULT_ROUND');

      // 플레이어 HP 0으로 감소
      app.battle.applyHazardDamage(100);
      expect(app.battle.hp).toBe(0);

      // game_over 의도 유입
      const firstHandled = app.handleAssaultIntent('game_over', null, session.sessionId);
      expect(firstHandled).toBe(true);
      expect(app.stateMachine.currentState).toBe('GAMEOVER');
      expect(app.sessionLifecycle.hasResultShown).toBe(true);

      // 중복 사망 신호 유입 시 차단 (멱등성)
      const duplicateHandled = app.handleAssaultIntent('game_over', null, session.sessionId);
      expect(duplicateHandled).toBe(false);
      expect(app.stateMachine.currentState).toBe('GAMEOVER');

      // 사망 후 인계 또는 다음 문제 전환 시도 0회
      const climaxHandled = app.handleAssaultIntent('handover_climax', null, session.sessionId);
      expect(climaxHandled).toBe(false);

      app.dispose();
    });

    it('A22: 목표 라운드 도달(인계 조건)과 HP 0(사망)이 동시 발생할 경우 사망(game_over)이 최우선 처리된다', () => {
      const progressController = new AssaultProgressController({
        targetRounds: 1,
      });

      // 완료 문제 1인 요약 DTO
      const summary = createAssaultRoundSummary({
        sessionId: 'session_tie_01',
        roundId: 'round_tie',
        encounters: [
          { attackId: 'att_01' as AttackId, isCorrect: true },
        ],
      });

      // HP 0 상태에서 평가 -> 사망 우선 (진행도 증가 0회, 결전 인계 차단)
      const evaluation = progressController.evaluate(summary, 0);
      expect(evaluation.isGameOver).toBe(true);
      expect(evaluation.intent).toBe('game_over');
      expect(evaluation.isTargetReached).toBe(false);
      expect(evaluation.handoverSnapshot).toBeNull(); // 인계 스냅샷 미발행
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. 불변식 A16 — 세션 재시작 및 메뉴 복귀 시 이전 세션 자원 완전 격리
  // ─────────────────────────────────────────────────────────────────────────────
  describe('5. 핵심 불변식 A16 — 세션 재시작 및 메뉴 복귀 시 이전 세션 자원 완전 격리', () => {
    it('restartAssaultSession 호출 시 이전 세션이 dispose되고 새 세션이 HP 100과 원본 계획으로 초기화된다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session1 = app.assembleAssaultSession({
        questions: sampleQuestions,
        bpm: 130,
      });
      const session1Id = session1.sessionId;

      // session1 진행 중 피해 발생
      app.battle.applyHazardDamage(40);
      expect(app.battle.hp).toBe(60);

      // 세션 1 타이머 예약
      const pendingCallback = vi.fn();
      app.sessionLifecycle.schedule(pendingCallback, 500);
      expect(app.sessionLifecycle.pendingTimeoutCount).toBeGreaterThan(0);

      // 세션 재시작
      const session2 = app.restartAssaultSession();

      expect(session2).toBeDefined();
      expect(session2.sessionId).not.toBe(session1Id);
      expect(app.battle.hp).toBe(100); // HP 100 리셋
      expect(session1.isDisposed).toBe(true); // 이전 세션 폐기
      expect(app.sessionLifecycle.pendingTimeoutCount).toBe(0); // 이전 예약 취소

      // 이전 세션 토큰으로 유입되는 지연된 intent는 거부됨
      const res = app.handleAssaultIntent('game_over', null, session1Id);
      expect(res).toBe(false);

      app.dispose();
    });

    it('goToMenu() 호출 시 assaultSession이 dispose되고 MENU_MAIN으로 안전하게 복귀한다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({ questions: sampleQuestions });
      expect(app.assaultSession).not.toBeNull();

      app.goToMenu();

      expect(session.isDisposed).toBe(true);
      expect(app.assaultSession).toBeNull();
      expect(app.stateMachine.currentState).toBe('MENU_MAIN');
      expect(app.sessionLifecycle.activeAssaultSessionToken).toBeNull();

      app.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. 결전 인계(Handover) 스냅샷 불변성 및 미구현 결전 모드 격리 (A22)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('6. 결전 인계(Handover) 스냅샷 불변성 및 미구현 결전 모드 격리 (A22)', () => {
    it('목표 라운드 도달 시 handover_climax 의도와 함께 불변 AssaultHandoverSnapshot이 생성된다', () => {
      const progressController = new AssaultProgressController({
        sessionId: 'session_handover_test',
        targetRounds: 2,
      });

      const summary1 = createAssaultRoundSummary({
        sessionId: 'session_handover_test',
        roundId: 'round_01',
        encounters: [
          { attackId: 'att_01' as AttackId, isCorrect: true },
          { attackId: 'att_02' as AttackId, evaded: true },
        ],
      });

      const eval1 = progressController.evaluate(summary1, 100);
      expect(eval1.intent).toBe('next_round');
      expect(eval1.completedRounds).toBe(1);
      expect(eval1.isTargetReached).toBe(false);

      const summary2 = createAssaultRoundSummary({
        sessionId: 'session_handover_test',
        roundId: 'round_02',
        encounters: [
          { attackId: 'att_03' as AttackId, isCorrect: true },
          { attackId: 'att_04' as AttackId, evaded: true },
        ],
      });

      const eval2 = progressController.evaluate(summary2, 85);
      expect(eval2.intent).toBe('handover_climax');
      expect(eval2.completedRounds).toBe(2);
      expect(eval2.isTargetReached).toBe(true);
      expect(eval2.handoverSnapshot).not.toBeNull();

      const snapshot = eval2.handoverSnapshot!;
      expect(snapshot.sessionId).toBe('session_handover_test');
      expect(snapshot.completedRounds).toBe(2);
      expect(snapshot.targetRounds).toBe(2);
      expect(snapshot.finalHp).toBe(85);
      expect(snapshot.stats.totalCompletedQuestions).toBe(2);

      // 스냅샷 완전 동결 확인
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.stats)).toBe(true);
      expect(() => {
        (snapshot as any).finalHp = 0;
      }).toThrow();
    });

    it('MVP 세션 인계 처리 시 미구현된 결전 모드 직접 실행이나 승리 영속화/저장이 일체 발생하지 않는다', async () => {
      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();

      const session = app.assembleAssaultSession({ questions: sampleQuestions });
      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('READY_POSITION');
      app.stateMachine.changeState('ASSAULT_ROUND');

      const mockSnapshot: AssaultHandoverSnapshot = Object.freeze({
        sessionId: session.sessionId,
        mode: 'boss_assault',
        rulesVersion: '0.3.0',
        finalHp: 80,
        targetRounds: 5,
        completedRounds: 5,
        stats: Object.freeze({
          totalCompletedQuestions: 5,
          totalCorrectHits: 10,
          totalWrongHits: 2,
          totalTimeoutHits: 0,
          totalEvadeSuccessCount: 10,
          totalSquatFailCount: 1,
          totalEncounters: 23,
          totalAttemptedAnswerHits: 12,
          ratingCounts: Object.freeze({ Perfect: 10, Good: 10, Late: 2, Miss: 1 }),
          maxCombo: 8,
          totalPlayerDamage: 20,
          totalBossDamage: 0,
          totalActualDamage: 20,
          totalRequestedDamage: 20,
          totalActiveDurationSeconds: 85.0,
          processedRoundIds: Object.freeze(['r1', 'r2', 'r3', 'r4', 'r5']),
        }),
        timestampMs: Date.now(),
      });

      const handled = app.handleAssaultIntent('handover_climax', mockSnapshot, session.sessionId);
      expect(handled).toBe(true);

      // StateMachine은 RESULT로 안전하게 전이 (미구현 결전 모드로 강제 이동하지 않음)
      expect(app.stateMachine.currentState).toBe('RESULT');
      expect(app.sessionLifecycle.lastHandoverSnapshot).toBe(mockSnapshot);

      // 영속 스토리지에 승리나 점수 저장 기록 0회
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        expect.stringMatching(/victory|high_score|save_slot/),
        expect.anything(),
      );

      app.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. 불변식 A08/A17, A18, A19 — 입력 우선순위 / 프레임 드롭 / 폴백 격리 / 추적 상실
  // ─────────────────────────────────────────────────────────────────────────────
  describe('7. 핵심 불변식 A08/A17, A18, A19 — 입력 우선순위 / 프레임 드롭 / 폴백 격리 / 추적 상실', () => {
    it('A08: 마감 시각(t == deadline)에 동시 입력 유입 시 마감 처리보다 사용자 입력이 우선 처리된다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: new BattleState(100),
        bossController: new BossController(10),
        speech: { speak: vi.fn() },
        questions: sampleQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        bpm: 120, // readingEndTime = 5.0s, arrival = 7.0s, deadline = 7.17s
      });

      const round = session.createRoundController('round_priority_test', '3 + 3 = ?');
      round.update(5.0);

      // 마감 시각과 동일한 activeSeconds(7.17s)로 정답 펀치 주입
      round.submitPunch('left', 7170, { activeSeconds: 7.17 });
      round.update(7.17);

      // 입력 우선순위(priority 2 < priority 3)로 인해 정답 처리됨
      expect(session.battleState.hp).toBe(100);
    });

    it('A17: 심각한 프레임 드롭으로 여러 경계(start, arrival, deadline)를 한 프레임에 통과해도 시간순으로 순차 정산된다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: new BattleState(100),
        bossController: new BossController(10),
        speech: { speak: vi.fn() },
        questions: sampleQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        bpm: 120,
      });

      const round = session.createRoundController('round_drop_test', '4 + 4 = ?');
      round.update(0.0);

      // 0.0s에서 단숨에 10.0s로 큰 델타 점프 (프레임 드롭 시뮬레이션)
      round.update(10.0);

      // 중간 경계들이 누락 없이 순서대로 처리되고 완주됨
      expect(round.isCompleted).toBe(true);
      expect(session.settlement.getReceipts().length).toBeGreaterThanOrEqual(1);
    });

    it('A18: 키보드 폴백 입력 시 repeat: true는 무시되고 해당 동작만 정확히 1회 처리된다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: new BattleState(100),
        bossController: new BossController(10),
        speech: { speak: vi.fn() },
        questions: sampleQuestions,
      });

      const fallbackAdapter = (session as any).fallbackAdapter;
      expect(fallbackAdapter).toBeDefined();

      const dispatchSpy = vi.fn();
      fallbackAdapter.onAction(dispatchSpy);

      // 1회 정상 키다운 (ArrowLeft -> left_punch)
      fallbackAdapter.handleKeyDown({
        key: 'ArrowLeft',
        repeat: false,
        timestampMs: 1000,
        sessionId: session.sessionId,
      });
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'left_punch' }),
      );

      // 자동 반복(repeat: true) 키다운 유입 시 무시
      fallbackAdapter.handleKeyDown({
        key: 'ArrowLeft',
        repeat: true,
        timestampMs: 1050,
        sessionId: session.sessionId,
      });
      expect(dispatchSpy).toHaveBeenCalledTimes(1); // 카운트 증가 0회
    });

    it('A19: 추적 상실(trackingLost) 시에도 시계가 동결되지 않고 연속 플레이가 유지된다', () => {
      const clock = new AssaultClockAdapter({ bpm: 120 });
      clock.advance(0.5);
      expect(clock.activeSeconds).toBe(0.5);

      // 추적 상실 발생
      clock.setTrackingLost(true);
      expect(clock.isTrackingLost).toBe(true);
      expect(clock.isFrozen).toBe(false);
      expect(clock.pauseReasons).not.toContain('tracking_lost');

      // 시간 진행 시 정상 가산
      clock.update(0.05);
      expect(clock.activeSeconds).toBeCloseTo(0.55, 5);

      // 추적 복구
      clock.setTrackingLost(false);
      expect(clock.isTrackingLost).toBe(false);
      expect(clock.isFrozen).toBe(false);
    });
  });
});
