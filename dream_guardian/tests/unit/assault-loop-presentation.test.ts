/**
 * assault-loop-presentation.test.ts
 * ASSAULT-LOOP-13 / GitHub Issue #706
 *
 * 루프 현재구간·남은박·기회수 읽기 전용 스냅샷 TDD 단위 테스트
 *
 * 검증 항목:
 * 1. run → answer → rest → squat → 마지막 rest의 구간/잔여박/기회가 루프 타임라인 계획과 정확히 일치
 * 2. run/rest 구간: pair / hazard / attackId 활성 0 (undefined), 미래 공격 노출 0, 정답 누출 0
 * 3. answer 구간: 현재 활성 answer_pair만 노출, 정답 선택 가능 (isSelectable: true, canSelectAnswer: true)
 * 4. early 선택 시: 조기 punch 잠금 후 isSelectable === false로 전환
 * 5. squat 구간: 해당 squat hazard만 노출, pair는 undefined, dodge 하위 구간에서만 isDodgeable === true
 * 6. 마지막 휴식: 4번째 기회 이후 final rest 표시, restNotice 안내
 * 7. pause / resume: 일시정지 상태에서도 실측 스냅샷 일치
 * 8. 레거시(loopPlan 미주입): presentation.loop === undefined 보존, 기존 스냅샷 100% 동등
 * 9. deepFreeze 불변성: 스냅샷 및 loop 하위 객체 수정 불가
 */

import { describe, it, expect } from 'vitest';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import { buildAssaultLoopPlan } from '../../src/game/assault/AssaultLoopPlanBuilder.js';
import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  type AssaultLoopConfig,
} from '../../config/assault-loop.config.js';
import type { SessionId, RoundId } from '../../src/types/assault.js';

const SQUAT_ENABLED_LOOP_CONFIG: AssaultLoopConfig = {
  ...DEFAULT_ASSAULT_LOOP_CONFIG,
  minSquatsPerRound: 1,
  maxSquatsPerRound: 2,
};

describe('ASSAULT-LOOP-13: AssaultRoundPresentation 루프 읽기 전용 스냅샷', () => {
  const sampleQuestion = {
    id: 'q_loop_pres_01',
    text: '12 + 15 = ?',
    correctAnswer: '27',
    wrongAnswer: '25',
    leftChoiceText: '27',
    rightChoiceText: '25',
    correctSide: 'left' as const,
  };

  // 1개 스쿼트 포함 확정 계획 (커스텀 설정 주입으로 스쿼트 스냅샷 기능 검증 보존)
  const plan36 = buildAssaultLoopPlan({
    seed: 'pres-test-seed-1',
    roundNumber: 1,
    loopConfig: SQUAT_ENABLED_LOOP_CONFIG,
  });

  it('1. options.loopPlan 주입 시 getPresentationSnapshot에 loop 필드가 합성되어야 한다 (Red 검증)', () => {
    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_pres_01' as SessionId,
      roundId: 'round_loop_pres_01' as RoundId,
      question: sampleQuestion,
      plan: plan36,
      loopPlan: plan36,
      bpm: 120,
    });

    const snapshot = controller.getPresentationSnapshot();
    expect(snapshot.loop).toBeDefined();
    expect(snapshot.loop?.totalOpportunities).toBe(4);
    expect(snapshot.loop?.currentSegmentKind).toBe('run_question');
  });

  it('2. run_question 구간 (0..4.0s): pair/hazard/attackId는 undefined여야 하며 미래 공격이 노출되지 않아야 한다', () => {
    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_pres_02' as SessionId,
      roundId: 'round_loop_pres_02' as RoundId,
      question: sampleQuestion,
      plan: plan36,
      loopPlan: plan36,
      bpm: 120,
    });

    controller.update(1.0); // 1.0s = 2박 경과 (총 8박 중)
    const snapshot = controller.getPresentationSnapshot();

    // 미래 공격/조우 노출 0
    expect(snapshot.pair).toBeUndefined();
    expect(snapshot.hazard).toBeUndefined();
    expect(snapshot.pairId).toBeUndefined();
    expect(snapshot.attackId).toBeUndefined();
    expect(snapshot.leftChoiceText).toBeUndefined();
    expect(snapshot.rightChoiceText).toBeUndefined();
    expect(snapshot.lockedSide).toBeUndefined();
    expect(snapshot.throwProgress).toBe(0);

    // 정답 누출 0
    expect((snapshot as unknown as Record<string, unknown>).correctSide).toBeUndefined();
    expect((snapshot as unknown as Record<string, unknown>).correctAnswerSide).toBeUndefined();

    // loop 스냅샷 상태
    const loop = snapshot.loop!;
    expect(loop.currentSegmentKind).toBe('run_question');
    expect(loop.currentSegmentIndex).toBe(0);
    expect(loop.currentSegment?.kind).toBe('run_question');
    expect(loop.currentSegment?.durationBeats).toBe(8);
    expect(loop.segmentElapsedBeats).toBeCloseTo(2, 2);
    expect(loop.segmentRemainingBeats).toBeCloseTo(6, 2);
    expect(loop.segmentElapsedSeconds).toBeCloseTo(1.0, 2);
    expect(loop.segmentRemainingSeconds).toBeCloseTo(3.0, 2);
    expect(loop.opportunityIndex).toBe(1);
    expect(loop.allowedAction).toBe('run');
    expect(loop.isSelectable).toBe(false);
    expect(loop.canSelectAnswer).toBe(false);
    expect(loop.isDodgeable).toBe(false);
    expect(loop.isResting).toBe(false);
    expect(loop.isSquatActive).toBe(false);
  });

  it('3. answer 구간 (4.0..6.0s): 현재 활성 answer_pair만 노출되고 선택 가능해야 한다', () => {
    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_pres_03' as SessionId,
      roundId: 'round_loop_pres_03' as RoundId,
      question: sampleQuestion,
      plan: plan36,
      loopPlan: plan36,
      bpm: 120,
    });

    controller.update(5.0); // answer 구간 중반 (1박 경과, 2초 중 1.0초 경과)
    const snapshot = controller.getPresentationSnapshot();

    expect(snapshot.pair).toBeDefined();
    expect(snapshot.pair?.status).toBe('flying');
    expect(snapshot.hazard).toBeUndefined();
    expect(snapshot.pairId).toBeDefined();
    expect(snapshot.attackId).toBeDefined();

    // loop 스냅샷 상태
    const loop = snapshot.loop!;
    expect(loop.currentSegmentKind).toBe('answer');
    expect(loop.currentSegment?.kind).toBe('answer');
    expect(loop.currentSegment?.durationBeats).toBe(4);
    expect(loop.opportunityIndex).toBe(1);
    expect(loop.allowedAction).toBe('punch');
    expect(loop.isSelectable).toBe(true);
    expect(loop.canSelectAnswer).toBe(true);
    expect(loop.isDodgeable).toBe(false);
    expect(loop.isResting).toBe(false);
    expect(loop.isSquatActive).toBe(false);
  });

  it('4. early 선택 시: answer 구간 내에서 조기 펀치 잠금 후 isSelectable은 false가 되어야 한다', () => {
    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_pres_04' as SessionId,
      roundId: 'round_loop_pres_04' as RoundId,
      question: sampleQuestion,
      plan: plan36,
      loopPlan: plan36,
      bpm: 120,
    });

    controller.update(4.5); // answer 구간 진입 직후
    let snapshot = controller.getPresentationSnapshot();
    expect(snapshot.loop?.isSelectable).toBe(true);

    // 유저 조기 펀치 입력 (좌측 정답 선택) — answer 구간 종료(도착 6.0s) 전, EarlyMiss 170ms 유효창 내(5.9s)
    controller.submitPunch('left', 5900, { activeSeconds: 5.9 });
    controller.update(5.9);

    snapshot = controller.getPresentationSnapshot();
    expect(snapshot.loop?.isSelectable).toBe(false);
    expect(snapshot.loop?.canSelectAnswer).toBe(false);
    expect(snapshot.lockedSide).toBe('left');
  });

  it('5. rest 구간 (restBeats > 0 루프): pair/hazard/attackId 활성 0, restNotice 제공, isResting true', () => {
    const planWithRest = buildAssaultLoopPlan({
      seed: 'pres-test-seed-1',
      roundNumber: 1,
      loopConfig: {
        ...DEFAULT_ASSAULT_LOOP_CONFIG,
        restBeats: 2,
        baseBeats: 32,
      },
    });

    const restSeg = planWithRest.segments.find((s) => s.kind === 'rest' && s.opportunityIndex === 4)!;
    expect(restSeg).toBeDefined();

    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_pres_05' as SessionId,
      roundId: 'round_loop_pres_05' as RoundId,
      question: sampleQuestion,
      plan: planWithRest,
      loopPlan: planWithRest,
      bpm: 120,
    });

    controller.update(restSeg.startSeconds + 0.5);
    const snapshot = controller.getPresentationSnapshot();

    expect(snapshot.pair).toBeUndefined();
    expect(snapshot.hazard).toBeUndefined();
    expect(snapshot.pairId).toBeUndefined();
    expect(snapshot.attackId).toBeUndefined();

    const loop = snapshot.loop!;
    expect(loop.currentSegmentKind).toBe('rest');
    expect(loop.opportunityIndex).toBe(4);
    expect(loop.allowedAction).toBe('rest');
    expect(loop.isSelectable).toBe(false);
    expect(loop.canSelectAnswer).toBe(false);
    expect(loop.isResting).toBe(true);
    expect(loop.isSquatActive).toBe(false);
    expect(loop.restNotice).toBeDefined();
    expect(String(loop.restNotice)).toContain('호흡');
  });

  it('6. squat 구간 및 하위 창: 해당 squat hazard만 노출되고 dodge 창에서만 isDodgeable === true', () => {
    // plan36에서 squat 세그먼트 찾기
    const squatSeg = plan36.segments.find((s) => s.kind === 'squat');
    expect(squatSeg).toBeDefined();
    const squatStart = squatSeg!.startSeconds;

    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_pres_06' as SessionId,
      roundId: 'round_loop_pres_06' as RoundId,
      question: sampleQuestion,
      plan: plan36,
      loopPlan: plan36,
      bpm: 120,
    });

    // (A) notice 창 (1박 = 0.5s)
    controller.update(squatStart + 0.2);
    let snapshot = controller.getPresentationSnapshot();
    expect(snapshot.pair).toBeUndefined();
    expect(snapshot.hazard).toBeDefined();
    expect(snapshot.hazard?.kind).toBe('squat');
    expect(snapshot.loop?.currentSegmentKind).toBe('squat');
    expect(snapshot.loop?.currentSquatSubSegment).toBe('notice');
    expect(snapshot.loop?.allowedAction).toBe('squat');
    expect(snapshot.loop?.isDodgeable).toBe(false);
    expect(snapshot.loop?.isSquatActive).toBe(true);

    // (B) dodge 창 (2박 = 1.0s, start + 0.5s ~ start + 1.5s)
    controller.update(squatStart + 0.8);
    snapshot = controller.getPresentationSnapshot();
    expect(snapshot.hazard).toBeDefined();
    expect(snapshot.loop?.currentSquatSubSegment).toBe('dodge');
    expect(snapshot.loop?.isDodgeable).toBe(true);

    // (C) stand 창 (1박 = 0.5s, start + 1.5s ~ start + 2.0s)
    controller.update(squatStart + 1.7);
    snapshot = controller.getPresentationSnapshot();
    expect(snapshot.loop?.currentSquatSubSegment).toBe('stand');
    expect(snapshot.loop?.isDodgeable).toBe(false);
  });

  it('7. 마지막 구간 (기회 4 완료 시): final answer 세그먼트와 opportunityIndex 4를 정확히 반영해야 한다', () => {
    const lastSeg = plan36.segments[plan36.segments.length - 1];
    expect(lastSeg.kind).toBe('answer');
    expect(lastSeg.opportunityIndex).toBe(4);

    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_pres_07' as SessionId,
      roundId: 'round_loop_pres_07' as RoundId,
      question: sampleQuestion,
      plan: plan36,
      loopPlan: plan36,
      bpm: 120,
    });

    controller.update(lastSeg.startSeconds + 0.2);
    const snapshot = controller.getPresentationSnapshot();

    expect(snapshot.pair).toBeDefined();
    expect(snapshot.hazard).toBeUndefined();
    expect(snapshot.loop?.currentSegmentKind).toBe('answer');
    expect(snapshot.loop?.opportunityIndex).toBe(4);
    expect(snapshot.loop?.isSelectable).toBe(true);
  });

  it('8. 일시정지(isPaused) 상태에서도 loop 스냅샷은 실측 수치를 정상 유지해야 한다', () => {
    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_pres_08' as SessionId,
      roundId: 'round_loop_pres_08' as RoundId,
      question: sampleQuestion,
      plan: plan36,
      loopPlan: plan36,
      bpm: 120,
    });

    controller.update(5.0);
    controller.pause();

    const snapshot = controller.getPresentationSnapshot();
    expect(snapshot.isPaused).toBe(true);
    expect(snapshot.loop?.currentSegmentKind).toBe('answer');
    expect(snapshot.loop?.opportunityIndex).toBe(1);
    expect(snapshot.loop?.allowedAction).toBe('punch');
  });

  it('9. loopPlan 미주입(레거시 호출) 시 loop 필드가 생략(undefined)되고 기존 스냅샷과 100% 동등해야 한다', () => {
    const controller = new AssaultRoundController({
      sessionId: 'sess_legacy_pres' as SessionId,
      roundId: 'round_legacy_pres' as RoundId,
      question: sampleQuestion,
      bpm: 120,
    });

    const snapshot = controller.getPresentationSnapshot();
    expect(snapshot.loop).toBeUndefined();
    expect(snapshot.sessionId).toBe('sess_legacy_pres');
    expect(snapshot.roundId).toBe('round_legacy_pres');
    expect(snapshot.questionText).toBe('12 + 15 = ?');
  });

  it('10. deepFreeze: 반환된 presentation 및 loop 객체는 불변 동결되어야 한다', () => {
    const controller = new AssaultRoundController({
      sessionId: 'sess_loop_freeze' as SessionId,
      roundId: 'round_loop_freeze' as RoundId,
      question: sampleQuestion,
      plan: plan36,
      loopPlan: plan36,
      bpm: 120,
    });

    const snapshot = controller.getPresentationSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.loop)).toBe(true);
    if (snapshot.loop?.currentSegment) {
      expect(Object.isFrozen(snapshot.loop.currentSegment)).toBe(true);
    }

    // 수정 시도시 에러 또는 변경 불가
    expect(() => {
      (snapshot as unknown as Record<string, unknown>).phase = 'round_failed';
    }).toThrow();
    expect(() => {
      (snapshot.loop as unknown as Record<string, unknown>).totalOpportunities = 999;
    }).toThrow();
  });
});
