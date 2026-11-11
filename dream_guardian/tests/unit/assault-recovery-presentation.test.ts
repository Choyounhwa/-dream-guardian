/**
 * assault-recovery-presentation.test.ts
 * [BOSS-ASSAULT-REC-14] Game 공격 표시 스냅샷 생성 복구 테스트
 *
 * @see docs/assault-runtime-recovery/REC-14.md
 * @see https://github.com/Choyounhwa/-dream-guardian/issues/599
 *
 * 완료 조건:
 * 1. 우측 정답 / 취소 / 오답잠금 -> 도착 / timeout / 회피 상태가 실제 judge 결과와 일치.
 * 2. 활성 시간 기준 throw/비행/도착 진행도 산출 및 170ms 판정 유예 구분.
 * 3. 취소된 반대 탄환을 새 miss/hit로 표현하지 않음.
 * 4. 반복 snapshot 조회와 renderer 모의 호출 후 게임 상태·명령 수가 변하지 않는 순수 읽기 보장.
 * 5. 정답 방향(correctSide, isCorrect 등)을 snapshot에 누출하지 않음 (은닉 보존).
 * 6. 깊은 불변 snapshot (Object.isFrozen) 제공.
 */

import { describe, it, expect } from 'vitest';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import type {
  AssaultEncounterDef,
  AssaultRoundPresentation,
} from '../../src/types/assault.js';

describe('[BOSS-ASSAULT-REC-14] AssaultRoundController.getPresentationSnapshot() 공격 표시 복구', () => {
  const sampleQuestion = {
    id: 'q_rec14_01',
    text: '7 × 8 = ?',
    minReadSeconds: 1.0,
  };

  const sampleAnswerPairEnc: AssaultEncounterDef = {
    id: 'atk_pair_01' as any,
    kind: 'answer_pair',
    startBeat: 0,
    durationBeats: 4,
    interactionProfileId: 'profile_punch' as any,
    visualProfileId: 'profile_pair' as any,
    pairId: 'pair_01' as any,
  };

  const sampleSquatEnc: AssaultEncounterDef = {
    id: 'atk_squat_01' as any,
    kind: 'squat',
    startBeat: 6,
    durationBeats: 4,
    interactionProfileId: 'profile_squat' as any,
    visualProfileId: 'profile_squat_hazard' as any,
  };

  const pairsMap = {
    pair_01: {
      pairId: 'pair_01',
      left: { text: '54', value: 54 },
      right: { text: '56', value: 56 },
      correctSide: 'right' as const,
      choices: [
        { text: '54', value: 54 },
        { text: '56', value: 56 },
      ],
      promptText: '올바른 곱셈 결과를 고르세요',
      challengeFamily: 'multiplication_tables',
    },
  };

  function createController(options?: Partial<ConstructorParameters<typeof AssaultRoundController>[0]>) {
    return new AssaultRoundController({
      sessionId: 'sess_rec14',
      roundId: 'round_rec14',
      question: sampleQuestion,
      plan: {
        encounters: [sampleAnswerPairEnc, sampleSquatEnc],
      },
      bpm: 120, // 1 beat = 0.5s. durationBeats 4 = 2.0s
      throwDurationSeconds: 1.0,
      pairs: pairsMap,
      ...options,
    } as any);
  }

  // ─── 1. 우측 정답 타격 시 presentation 상태 전이 및 정보 은닉 검증 ───

  it('우측 정답 타격 시 pair.status는 negated(무효화)가 되고 correctSide는 누출되지 않아야 한다', () => {
    const controller = createController({
      plan: { encounters: [sampleAnswerPairEnc] },
    });

    // 1) 시작 시점 (throw_in/reading)
    controller.update(0.5);
    const snapThrow = controller.getPresentationSnapshot();
    expect(snapThrow.phase).toBe('throw_in');
    expect(snapThrow.throwProgress).toBeCloseTo(0.5, 2);

    // 2) question_reading 완료 후 조우 시작 (readingDuration: 4.0s -> t=5.0s부터 encounters)
    controller.update(5.0);
    const snapStart = controller.getPresentationSnapshot();
    expect(snapStart.phase).toBe('encounters');
    expect(snapStart.pair).toBeDefined();
    expect(snapStart.pair?.pairId).toBe('pair_01');
    expect(snapStart.pair?.attackId).toBe('atk_pair_01');
    expect(snapStart.pair?.leftText).toBe('54');
    expect(snapStart.pair?.rightText).toBe('56');
    expect(snapStart.pair?.status).toBe('flying');
    expect(snapStart.pair?.throwProgress).toBeCloseTo(0.0, 1);
    expect(snapStart.pair?.lockedSide).toBeNull();

    // 상위 presentation 호환 필드 검증
    expect(snapStart.leftChoiceText).toBe('54');
    expect(snapStart.rightChoiceText).toBe('56');
    expect(snapStart.pairId).toBe('pair_01');
    expect(snapStart.attackId).toBe('atk_pair_01');

    // 3) 비행 중간 진행 (t = 6.0s: start=5.0, arrival=7.0 -> progress = 0.5)
    controller.update(6.0);
    const snapMid = controller.getPresentationSnapshot();
    expect(snapMid.pair?.throwProgress).toBeCloseTo(0.5, 2);
    expect(snapMid.pair?.status).toBe('flying');

    // 4) 우측(정답) 펀치 입력 주입 (t = 6.9s, 도착 7.0s 100ms 전 — EarlyMiss 170ms 유효창 내)
    controller.submitPunch('right', 6900, { activeSeconds: 6.9 });

    const snapAfterHit = controller.getPresentationSnapshot();
    expect(snapAfterHit.pair?.status).toBe('negated');
    expect(snapAfterHit.pair?.lockedSide).toBe('right');
    expect(snapAfterHit.lockedSide).toBe('right');

    // 5) 정보 은닉 검증: correctSide, correctAnswerSide, isCorrect가 노출되지 않음
    expect((snapAfterHit as any).correctSide).toBeUndefined();
    expect((snapAfterHit as any).correctAnswerSide).toBeUndefined();
    expect((snapAfterHit as any).isCorrect).toBeUndefined();
    expect((snapAfterHit.pair as any).correctSide).toBeUndefined();
    expect((snapAfterHit.pair as any).isCorrect).toBeUndefined();

    // 6) 취소된 반대 탄환이 새 miss/hit로 표현되지 않고 pair 전체가 negated 상태 유지
    controller.update(7.5);
    const snapAfterArrival = controller.getPresentationSnapshot();
    expect(snapAfterArrival.pair?.status).toBe('negated');
  });

  // ─── 2. 오답 선택 잠금(wrong_locked) -> 비행 완료 도착(wrong_hit) 전이 검증 ───

  it('오답 선택 시 arrival 이전에는 wrong_locked, arrival 이후에는 wrong_hit로 상태가 전이되어야 한다', () => {
    const controller = createController();
    controller.update(5.0); // 조우 시작 (start=5.0, arrival=7.0, deadline=7.17)

    // 좌측(오답: 54) 펀치 입력 주입 (t = 6.85s, 도착 7.0s 150ms 전 — EarlyMiss 170ms 유효창 내)
    controller.submitPunch('left', 6850, { activeSeconds: 6.85 });

    const snapLocked = controller.getPresentationSnapshot();
    expect(snapLocked.pair?.status).toBe('wrong_locked');
    expect(snapLocked.pair?.lockedSide).toBe('left');
    expect(snapLocked.pair?.throwProgress).toBeCloseTo(0.925, 2); // (6.85 - 5.0) / 2.0

    // 도착 직전 (t = 6.9s) -> 여전히 wrong_locked
    controller.update(6.9);
    const snapBeforeArrival = controller.getPresentationSnapshot();
    expect(snapBeforeArrival.pair?.status).toBe('wrong_locked');

    // 도착 시점 (t = 7.0s) -> wrong_hit 전이 확인
    controller.update(7.0);
    const snapAtArrival = controller.getPresentationSnapshot();
    expect(snapAtArrival.pair?.status).toBe('wrong_hit');
    expect(snapAtArrival.pair?.throwProgress).toBe(1.0);
  });

  // ─── 3. 판정 유예(170ms) 구분 및 미입력 시 timeout 전이 검증 ───

  it('arrival 도달 후 170ms 유예 기간 동안은 flying을 유지하다가 deadline 이후 timeout으로 전이되어야 한다', () => {
    const controller = createController({
      plan: { encounters: [sampleAnswerPairEnc] },
    });
    controller.update(5.0); // start=5.0, arrival=7.0, deadline=7.17

    // arrival 도달 시 (t = 7.0s): throwProgress=1.0이지만 아직 유예창 내부이므로 timeout이 아님
    controller.update(7.0);
    const snapArrival = controller.getPresentationSnapshot();
    expect(snapArrival.pair?.throwProgress).toBe(1.0);
    expect(snapArrival.pair?.status).toBe('flying');

    // 유예창 내부 (t = 7.1s < 7.17s)
    controller.update(7.1);
    const snapGrace = controller.getPresentationSnapshot();
    expect(snapGrace.pair?.status).toBe('flying');

    // deadline 초과 (t = 7.2s > 7.17s) -> timeout 전이
    controller.update(7.2);
    const snapTimeout = controller.getPresentationSnapshot();
    expect(snapTimeout.pair?.status).toBe('timeout');
    expect(snapTimeout.pair?.throwProgress).toBe(1.0);
  });

  // ─── 4. 라운드 중단(abort) 시 cancelled 상태 보장 검증 ───

  it('컨트롤러 abort() 호출 시 활성 pair의 status가 cancelled로 표기되어야 한다', () => {
    const controller = createController();
    controller.update(5.5);

    expect(controller.getPresentationSnapshot().pair?.status).toBe('flying');

    controller.abort('user_quit');
    const snapAborted = controller.getPresentationSnapshot();
    expect(snapAborted.phase).toBe('round_failed');
    expect(snapAborted.pair?.status).toBe('cancelled');
  });

  // ─── 5. 하향 회피(Squat/Hazard) 조우의 telegraph -> active -> evaded/hit 상태 전이 검증 ───

  it('스쿼트 조우에서 예고(telegraph) -> 활성(active) -> 회피(evaded) 상태가 실제 judge와 일치해야 한다', () => {
    const controller = createController();

    // 1번 answer_pair 완료 후 2번 squat 조우로 진입 (sampleSquatEnc: startBeat 6 = 3.0s delay after start)
    // answer_pair: start 5.0, arrival 7.0, end ~7.17. squat start 8.0s (5.0 + 3.0s), arrival 10.0s
    // 우선 answer_pair를 정답으로 해결
    controller.update(5.0);
    controller.submitPunch('right', 5200, { activeSeconds: 5.2 });
    controller.update(7.5); // pair end 통과 -> encounterIndex = 1

    // squat 조우 시작 전 (예고 단계: telegraph)
    controller.update(7.8);
    const snapTelegraph = controller.getPresentationSnapshot();
    expect(snapTelegraph.hazard).toBeDefined();
    expect(snapTelegraph.hazard?.attackId).toBe('atk_squat_01');
    expect(snapTelegraph.hazard?.kind).toBe('squat');

    // squat 조우 활성화 시점 (t = 8.5s)
    controller.update(8.5);
    const snapActive = controller.getPresentationSnapshot();
    expect(snapActive.hazard?.status).toBe('active');
    expect(snapActive.hazard?.progress).toBeGreaterThan(0.0);

    // 스쿼트 숙이기 입력 (ducking)
    controller.submitSquat('ducking', 9000, {
      activeSeconds: 9.0,
      standGeneration: 1,
    });

    const snapEvaded = controller.getPresentationSnapshot();
    expect(snapEvaded.hazard?.status).toBe('evaded');
  });

  // ─── 6. 반복 snapshot 조회 시 순수 읽기 및 불변성(Object.freeze) 검증 ───

  it('getPresentationSnapshot을 반복 조회해도 내부 상태나 정산 명령 큐가 변경되지 않아야 한다 (순수 함수)', () => {
    const controller = createController();
    controller.update(5.5);

    const initialCommandsCount = controller.settlementCommands.length;

    // 10회 연속 조회
    const snapshots: AssaultRoundPresentation[] = [];
    for (let i = 0; i < 10; i++) {
      snapshots.push(controller.getPresentationSnapshot());
    }

    // 정산 명령 큐나 게임 진행 시간/인덱스가 변경되지 않아야 함
    expect(controller.settlementCommands.length).toBe(initialCommandsCount);

    // 모든 스냅샷의 데이터가 일관되어야 함
    for (const snap of snapshots) {
      expect(snap.activeSeconds).toBe(5.5);
      expect(snap.pair?.throwProgress).toBeCloseTo(0.25, 2);
      expect(snap.pair?.status).toBe('flying');
      expect(Object.isFrozen(snap)).toBe(true);
      if (snap.pair) {
        expect(Object.isFrozen(snap.pair)).toBe(true);
      }
    }
  });
});
