/**
 * assault-loop-presentation-extraction.test.ts
 * [ASSAULT-LOOP-03 / Issue #696] 996줄 라운드 컨트롤러의 표시 조립만 제한 추출 테스트
 *
 * @see docs/assault-loop/LOOP-03.md
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14)
 * @see https://github.com/Choyounhwa/-dream-guardian/issues/696
 */

import { describe, it, expect } from 'vitest';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import {
  AssaultRoundPresentationBuilder,
  buildAssaultRoundPresentation,
  type AssaultRoundPresentationContext,
  type AssaultPresentationEncounterContext,
} from '../../src/game/assault/AssaultRoundPresentationBuilder.js';
import type {
  AssaultEncounterDef,
  AttackId,
  PairId,
  SessionId,
  RoundId,
} from '../../src/types/assault.js';

describe('[ASSAULT-LOOP-03] AssaultRoundPresentationBuilder - 표시 조립 순수 추출 검증', () => {
  const dummyQuestion = {
    id: 'q_test_01',
    text: '9 × 6 = ?',
    minReadSeconds: 1.0,
  };

  const sampleAnswerPairDef: AssaultEncounterDef = {
    id: 'atk_pair_01' as AttackId,
    kind: 'answer_pair',
    startBeat: 0,
    durationBeats: 4,
    interactionProfileId: 'profile_punch' as any,
    visualProfileId: 'profile_pair' as any,
    pairId: 'pair_01' as PairId,
  };

  const sampleSquatDef: AssaultEncounterDef = {
    id: 'atk_squat_01' as AttackId,
    kind: 'squat',
    startBeat: 4,
    durationBeats: 4,
    interactionProfileId: 'profile_squat' as any,
    visualProfileId: 'profile_squat_hazard' as any,
  };

  const sampleJumpDef: AssaultEncounterDef = {
    id: 'atk_jump_01' as AttackId,
    kind: 'jump',
    startBeat: 8,
    durationBeats: 4,
    interactionProfileId: 'profile_jump' as any,
    visualProfileId: 'profile_jump_hazard' as any,
  };

  const dummyPairsMap = {
    pair_01: {
      pairId: 'pair_01',
      left: { text: '54', value: 54 },
      right: { text: '56', value: 56 },
      correctSide: 'left', // 정답 플래그 (스냅샷 노출 금지)
      pairPromptText: '더 큰 수를 고르지 말고 곱셈 결과를 선택하세요',
      challengeFamily: 'multiplication_table',
    },
  };

  // ─── 1. throw_in 단계 표시 검증 ───
  it('throw_in 단계에서 던지기 진행도와 잔여 시간이 올바르게 조립되어야 한다', () => {
    const context: AssaultRoundPresentationContext = {
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'throw_in',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 0.5,
      readingProgress: 0.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    };

    const snapshot = AssaultRoundPresentationBuilder.build(context);

    expect(snapshot.sessionId).toBe('session_01');
    expect(snapshot.roundId).toBe('round_01');
    expect(snapshot.phase).toBe('throw_in');
    expect(snapshot.questionText).toBe('9 × 6 = ?');
    expect(snapshot.throwProgress).toBeCloseTo(0.5, 3);
    expect(snapshot.remainingSeconds).toBeCloseTo(0.5, 3);
    expect(snapshot.readingProgress).toBe(0.0);
    expect(snapshot.isPaused).toBe(false);
  });

  // ─── 2. question_reading 단계 표시 검증 ───
  it('question_reading 단계에서 읽기 진행도와 readingEndTime 기준 잔여 시간이 조립되어야 한다', () => {
    const context: AssaultRoundPresentationContext = {
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'question_reading',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 1.5,
      readingProgress: 0.33,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    };

    const snapshot = AssaultRoundPresentationBuilder.build(context);

    expect(snapshot.phase).toBe('question_reading');
    expect(snapshot.readingProgress).toBe(0.33);
    expect(snapshot.remainingSeconds).toBeCloseTo(1.0, 3);
    expect(snapshot.throwProgress).toBe(1.0);
  });

  // ─── 3. answer_pair 조우 상태별 검증 (pending / flying / wrong_locked / wrong_hit / negated / cancelled / timeout) ───
  it('answer_pair 조우의 pending, flying, wrong_locked, wrong_hit 상태가 올바르게 조립되어야 한다', () => {
    const encContext: AssaultPresentationEncounterContext = {
      def: sampleAnswerPairDef,
      index: 0,
      startSeconds: 2.5,
      arrivalSeconds: 4.5,
      deadlineSeconds: 4.67,
      pairJudge: {
        state: {
          status: 'pending',
          lockedChoice: null,
          resolvedTimestampMs: null,
        },
      },
    };

    // 1) 조우 시작 전 (t = 2.0s) -> pending
    const snapEarly = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: encContext,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 2.0,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapEarly.pair?.status).toBe('pending');
    expect(snapEarly.pair?.throwProgress).toBe(0.0);
    expect(snapEarly.pair?.leftText).toBe('54');
    expect(snapEarly.pair?.rightText).toBe('56');
    expect(snapEarly.pair?.pairPromptText).toBe('더 큰 수를 고르지 말고 곱셈 결과를 선택하세요');
    expect(snapEarly.pair?.challengeFamily).toBe('multiplication_table');

    // 2) 비행 중 (t = 3.5s) -> flying
    const snapFlying = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: encContext,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 3.5,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapFlying.pair?.status).toBe('flying');
    expect(snapFlying.pair?.throwProgress).toBeCloseTo(0.5, 2);

    // 3) 오답 잠금 (t = 3.8s, arrival 4.5s 이전) -> wrong_locked
    const encWrongLocked: AssaultPresentationEncounterContext = {
      ...encContext,
      pairJudge: {
        state: {
          status: 'wrong_locked',
          lockedChoice: 'right',
          resolvedTimestampMs: 3800,
        },
      },
    };
    const snapWrongLocked = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: encWrongLocked,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 3.8,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapWrongLocked.pair?.status).toBe('wrong_locked');
    expect(snapWrongLocked.pair?.lockedSide).toBe('right');
    expect(snapWrongLocked.lockedSide).toBe('right');
    expect(snapWrongLocked.pair?.lockedAtSeconds).toBe(3.8);

    // 4) 도착 시점 이후 오답 피격 (t = 4.55s) -> wrong_hit
    const snapWrongHit = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: encWrongLocked,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 4.55,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapWrongHit.pair?.status).toBe('wrong_hit');
  });

  it('answer_pair 조우의 correct(negated), cancelled, timeout 상태가 올바르게 조립되어야 한다', () => {
    const encContext: AssaultPresentationEncounterContext = {
      def: sampleAnswerPairDef,
      index: 0,
      startSeconds: 2.5,
      arrivalSeconds: 4.5,
      deadlineSeconds: 4.67,
    };

    // 정답 판정 -> negated
    const snapCorrect = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: {
        ...encContext,
        pairJudge: {
          state: {
            status: 'correct',
            lockedChoice: 'left',
            resolvedTimestampMs: 3200,
          },
        },
      },
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 3.2,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapCorrect.pair?.status).toBe('negated');
    expect(snapCorrect.pair?.lockedSide).toBe('left');

    // 타임아웃 -> timeout
    const snapTimeout = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: {
        ...encContext,
        pairJudge: {
          state: {
            status: 'timeout',
            lockedChoice: null,
            resolvedTimestampMs: 4670,
          },
        },
      },
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 4.7,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapTimeout.pair?.status).toBe('timeout');

    // 취소 -> cancelled
    const snapCancelled = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: {
        ...encContext,
        pairJudge: {
          state: {
            status: 'cancelled',
            lockedChoice: null,
            resolvedTimestampMs: null,
          },
        },
      },
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 4.7,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapCancelled.pair?.status).toBe('cancelled');
  });

  // ─── 4. hazard (squat / jump) 조우 상태별 검증 ───
  it('스쿼트 및 점프 hazard 조우의 telegraph, active, evaded, hit 상태가 올바르게 조립되어야 한다', () => {
    const squatEnc: AssaultPresentationEncounterContext = {
      def: sampleSquatDef,
      index: 1,
      startSeconds: 5.0,
      arrivalSeconds: 7.0,
      deadlineSeconds: 7.17,
      endFired: false,
      squatJudge: {
        state: {
          status: 'pending',
        },
      },
    };

    // 1) 예고 단계 (t = 4.8s < startSeconds 5.0s) -> telegraph
    const snapTelegraph = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      currentEncounter: squatEnc,
      currentEncounterIndex: 1,
      totalEncounters: 2,
      activeSeconds: 4.8,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapTelegraph.hazard).toBeDefined();
    expect(snapTelegraph.hazard?.kind).toBe('squat');
    expect(snapTelegraph.hazard?.status).toBe('telegraph');
    expect(snapTelegraph.hazard?.promptText).toBe('스쿼트로 숙여서 회피하세요!');
    expect(snapTelegraph.hazard?.active).toBe(true);

    // 2) 활성 단계 (t = 6.0s) -> active
    const snapActive = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      currentEncounter: squatEnc,
      currentEncounterIndex: 1,
      totalEncounters: 2,
      activeSeconds: 6.0,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapActive.hazard?.status).toBe('active');
    expect(snapActive.hazard?.progress).toBeCloseTo(0.5, 2);

    // 3) 회피 성공 -> evaded
    const snapEvaded = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      currentEncounter: {
        ...squatEnc,
        squatJudge: {
          state: {
            status: 'evaded',
          },
        },
      },
      currentEncounterIndex: 1,
      totalEncounters: 2,
      activeSeconds: 6.5,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapEvaded.hazard?.status).toBe('evaded');

    // 4) 회피 실패 -> hit
    const snapHit = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      currentEncounter: {
        ...squatEnc,
        squatJudge: {
          state: {
            status: 'miss',
          },
        },
      },
      currentEncounterIndex: 1,
      totalEncounters: 2,
      activeSeconds: 7.1,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapHit.hazard?.status).toBe('hit');

    // 5) 점프 조우 prompt 검증
    const snapJump = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      currentEncounter: {
        def: sampleJumpDef,
        index: 2,
        startSeconds: 8.0,
        arrivalSeconds: 10.0,
        deadlineSeconds: 10.17,
      },
      currentEncounterIndex: 2,
      totalEncounters: 3,
      activeSeconds: 8.5,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });
    expect(snapJump.hazard?.kind).toBe('jump');
    expect(snapJump.hazard?.promptText).toBe('점프로 장애물을 뛰어넘으세요!');
  });

  // ─── 5. 라운드 실패(round_failed) 및 중단 상태 조립 ───
  it('round_failed 상태에서 pair 및 hazard가 올바르게 cancelled 처리되어야 한다', () => {
    const encPair: AssaultPresentationEncounterContext = {
      def: sampleAnswerPairDef,
      index: 0,
      startSeconds: 2.5,
      arrivalSeconds: 4.5,
      deadlineSeconds: 4.67,
      pairJudge: {
        state: {
          status: 'pending',
        },
      },
    };

    const snapFailed = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'round_failed',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: encPair,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 3.0,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });

    expect(snapFailed.phase).toBe('round_failed');
    expect(snapFailed.pair?.status).toBe('cancelled');
  });

  // ─── 6. DOC-14 정답 플래그 비노출 계약 검증 ───
  it('스냅샷 DTO 최상위 및 pair 하위에 정답 관련 플래그(correctSide, isCorrect 등)가 노출되지 않아야 한다', () => {
    const encPair: AssaultPresentationEncounterContext = {
      def: sampleAnswerPairDef,
      index: 0,
      startSeconds: 2.5,
      arrivalSeconds: 4.5,
      deadlineSeconds: 4.67,
    };

    const snapshot = buildAssaultRoundPresentation({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: encPair,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 3.0,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });

    expect((snapshot as any).correctSide).toBeUndefined();
    expect((snapshot as any).correctAnswerSide).toBeUndefined();
    expect((snapshot as any).isCorrect).toBeUndefined();
    expect((snapshot.pair as any)?.correctSide).toBeUndefined();
    expect((snapshot.pair as any)?.correctAnswerSide).toBeUndefined();
    expect((snapshot.pair as any)?.isCorrect).toBeUndefined();
  });

  // ─── 7. 불변성(deepFreeze) 검증 ───
  it('생성된 스냅샷 및 중첩 객체(pair, hazard)는 완전히 동결(Object.isFrozen)되어야 한다', () => {
    const encPair: AssaultPresentationEncounterContext = {
      def: sampleAnswerPairDef,
      index: 0,
      startSeconds: 2.5,
      arrivalSeconds: 4.5,
      deadlineSeconds: 4.67,
    };

    const snapshot = AssaultRoundPresentationBuilder.build({
      sessionId: 'session_01' as SessionId,
      roundId: 'round_01' as RoundId,
      phase: 'encounters',
      question: dummyQuestion,
      optionsPairs: dummyPairsMap,
      currentEncounter: encPair,
      currentEncounterIndex: 0,
      totalEncounters: 1,
      activeSeconds: 3.0,
      readingProgress: 1.0,
      isPaused: false,
      throwDurationSeconds: 1.0,
      readingEndTime: 2.5,
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.pair)).toBe(true);

    expect(() => {
      (snapshot as any).phase = 'round_failed';
    }).toThrow();
  });

  // ─── 8. 컨트롤러 위임 통합 검증 (추출 전후 동작 100% 동일성) ───
  it('AssaultRoundController.getPresentationSnapshot()이 추출된 빌더를 통해 정상 동작해야 한다', () => {
    const controller = new AssaultRoundController({
      sessionId: 'session_ctrl_01' as SessionId,
      roundId: 'round_ctrl_01' as RoundId,
      question: dummyQuestion,
      plan: {
        encounters: [sampleAnswerPairDef, sampleSquatDef],
      },
      bpm: 120,
      pairs: dummyPairsMap,
    } as any);

    // 초기 throw_in 스냅샷
    const snap1 = controller.getPresentationSnapshot();
    expect(snap1.phase).toBe('throw_in');
    expect(snap1.sessionId).toBe('session_ctrl_01');
    expect(Object.isFrozen(snap1)).toBe(true);

    // question_reading 진입
    controller.update(2.0);
    const snap2 = controller.getPresentationSnapshot();
    expect(snap2.phase).toBe('question_reading');
    expect(snap2.readingProgress).toBeGreaterThan(0);

    // encounters 진입 (t = 5.0s)
    controller.update(5.0);
    const snap3 = controller.getPresentationSnapshot();
    expect(snap3.phase).toBe('encounters');
    expect(snap3.pair).toBeDefined();
    expect(snap3.pair?.leftText).toBe('54');
    expect(snap3.pair?.rightText).toBe('56');
    expect(snap3.pair?.status).toBe('flying');

    // 펀치 입력 및 negated 전이 (arrival 7.0s 100ms 전, EarlyMiss 170ms 유효창 내)
    controller.submitPunch('left', 6900, { activeSeconds: 6.9 });
    const snap4 = controller.getPresentationSnapshot();
    expect(snap4.pair?.status).toBe('negated');
    expect(snap4.pair?.lockedSide).toBe('left');
  });
});
