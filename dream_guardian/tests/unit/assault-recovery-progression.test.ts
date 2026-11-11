/**
 * assault-recovery-progression.test.ts
 *
 * [BOSS-ASSAULT-REC-12 / #607] 반복 라운드·진행 의도 Core 연결 복구 단위 테스트
 *
 * 검증 목표:
 * 1. 다중 라운드 연속 진행 및 고유 ID / 원점 / 진행도 일치:
 *    - 실제 준비 경로(AssaultSessionFactory.createSession)로 2라운드 이상 실행.
 *    - 각 라운드마다 고유 roundId, round-scoped attackId, round-scoped pairId, roundOriginSeconds가 발급된다.
 *    - 원본 compiledPlan은 불변 유지된다.
 * 2. 동일 콘텐츠 ID 재사용 시 라운드 멱등키 분리:
 *    - 동일한 question ID/내용의 문제를 연속 라운드에 사용해도 attackId/idempotencyKey가 분리되어
 *      정산(settlement)에서 stale/중복으로 거부되지 않고 정상 정산된다.
 * 3. damage -> death -> summary -> progress 순서 및 completedQuestions/hitCount 분리:
 *    - 정산 영수증 -> 사망 체크 -> 라운드 요약 확정 -> 진행 판정 순으로 단 1회 실행된다.
 *    - 미완료(aborted) 시 진행도 증가 0건, intent: 'none'.
 * 4. 최종 라운드 HP 0 즉시 패배 vs 생존 시 실측 인계 스냅샷:
 *    - 목표 라운드 도달 시점이라도 HP 0이면 game_over 1회 발행, snapshot 0건.
 *    - 생존하여 목표 도달 시 handover_climax 1회 발행 및 실측 인계 스냅샷 보관, 추가 라운드 생성 0건.
 *    - finale 기본 false 유지 (G4 미승인 시 자동 활성화 금지).
 * 5. 중복 콜백 및 stale 완료 차단:
 *    - 동일 라운드 중복 완료 콜백이나 stale 요약이 다음 round를 전진시키지 않는다.
 * 6. 자세 상태 보존 (손회수/직립복귀 강제 reset 방지):
 *    - 직립 복귀 전 세대 상태(initialSquatStandState)가 다음 라운드로 보존된다.
 */

import { describe, it, expect, vi } from 'vitest';
import { AssaultSessionFactory } from '../../src/core/AssaultSessionFactory.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';

function createMockBattleState(initialHp = 100) {
  let hp = initialHp;
  return {
    get hp() {
      return hp;
    },
    set hp(val: number) {
      hp = val;
    },
    maxHp: 100,
    takeDamage: vi.fn((dmg: number) => {
      hp = Math.max(0, hp - dmg);
    }),
    applyHazardDamage: vi.fn((dmg: number) => {
      hp = Math.max(0, hp - dmg);
    }),
  };
}

function createMockSpeech() {
  return {
    speak: vi.fn(),
    status: 'idle',
    cancel: vi.fn(),
  };
}

const mockQuestions: readonly QuestionCandidate[] = [
  {
    id: 'q_round_1',
    type: 'addition',
    operands: [2, 3],
    text: '2 + 3 = ?',
    answer: 5,
    correctAnswer: 5,
    level: 1,
  },
  {
    id: 'q_round_2',
    type: 'multiplication',
    operands: [3, 4],
    text: '3 * 4 = ?',
    answer: 12,
    correctAnswer: 12,
    level: 1,
  },
  {
    id: 'q_round_3',
    type: 'subtraction',
    operands: [10, 4],
    text: '10 - 4 = ?',
    answer: 6,
    correctAnswer: 6,
    level: 1,
  },
];

describe('[BOSS-ASSAULT-REC-12 / #607] Multi-round Progression & Progress Intent Core Wiring', () => {
  describe('1. 다중 라운드 연속 진행 및 고유 ID / 원점 / 진행도 일치', () => {
    it('실제 준비 경로로 2라운드 이상 실행되어 고유 roundId, attackId, pairId, 원점, 요약, 진행도가 일치해야 한다', () => {
      const battleState = createMockBattleState(100);
      const session = AssaultSessionFactory.createSession({
        battleState,
        speech: createMockSpeech(),
        questions: mockQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        targetRounds: 3,
      });

      expect(session.targetRounds).toBe(3);
      expect(session.progressController.completedRounds).toBe(0);
      expect(session.progressController.progress).toBe(0);

      // Round 1 생성
      const rc1 = session.createRoundController('round_01', mockQuestions[0]);
      expect(rc1.roundId).toBe('round_01');
      expect(session.clock.roundOriginSeconds).toBe(0);

      // Scoped encounter ID 확인: 원본 plan encounters 불변 검증 및 roundId-attackId 매핑
      expect(session.compiledPlan.encounters[0].id).toBe('attack_01_answer');
      expect(rc1.encounters[0].id).toBe('round_01-attack_01_answer');
      expect(rc1.encounters[1].id).toBe('round_01-attack_02_squat');

      // Round 1 진행 (시간 6.0초 전진하여 reading 통과 후 encounter 0 타격)
      rc1.update(1.0);
      rc1.update(6.0); // readingEndTime 통과
      rc1.submitPunch('left', 6000, { activeSeconds: 6.0 });
      rc1.update(7.1); // pair deadline 통과
      rc1.update(8.0); // squat start
      rc1.submitSquat('squatting', 8500, { activeSeconds: 8.5 });
      rc1.submitSquat('standing', 9000, { activeSeconds: 9.0 });
      rc1.update(11.5); // encounter_end

      expect(rc1.isCompleted).toBe(true);
      // round 1 완료 후 progressController 평가가 연결되었는지 확인
      expect(session.progressController.completedRounds).toBe(1);
      expect(session.progressController.progress).toBeCloseTo(1 / 3, 4);

      // Session 시간 전진 후 Round 2 시작
      session.clock.advance(15.0, 15000);

      // startNextRound 포트 호출
      const rc2 = session.startNextRound ? session.startNextRound() : null;
      expect(rc2).not.toBeNull();
      if (!rc2) return;

      expect(rc2.roundId).toBe('round_02');
      // round 2 질문은 1문항 전진(q_round_2)이어야 함
      expect(rc2.questionText).toBe('3 * 4 = ?');
      // round 2 encounters는 round_02 scoped ID (roundId-attackId)여야 함
      expect(rc2.encounters[0].id).toBe('round_02-attack_01_answer');
      expect(rc2.encounters[1].id).toBe('round_02-attack_02_squat');

      // 원점 갱신 확인 (Round 2 상대 시각은 0.0)
      expect(session.clock.roundOriginSeconds).toBeCloseTo(15.0, 5);
      expect(session.clock.toRoundRelativeSeconds()).toBeCloseTo(0.0, 5);

      session.dispose();
    });
  });

  describe('2. 동일 콘텐츠 ID 재사용 시 라운드 멱등키 분리', () => {
    it('동일한 문제 ID와 내용을 2개 라운드에 주입해도 attackId 및 idempotencyKey가 분리되어 정산이 정상 승인되어야 한다', () => {
      const battleState = createMockBattleState(100);
      const session = AssaultSessionFactory.createSession({
        battleState,
        speech: createMockSpeech(),
        questions: [mockQuestions[0]], // 1개 문항만 제공
        pattern: DEFAULT_APPROACH_PATTERN,
        targetRounds: 2,
      });

      // Round 1
      const rc1 = session.createRoundController('round_01', mockQuestions[0]);
      const enc1 = rc1.encounters[0] as any;
      const side1 = enc1.correctSide ?? 'left';
      // 도착(7.0s) 100ms 전 정답 (EarlyMiss 170ms 유효창 내)
      rc1.update(6.9);
      rc1.submitPunch(side1, 6900, { activeSeconds: 6.9 });
      rc1.update(11.5);
      expect(rc1.isCompleted).toBe(true);

      const r1Summary = rc1.getRoundSummary();
      expect(r1Summary).not.toBeNull();
      expect(r1Summary?.correctCount).toBe(1);

      // Round 2 동일 문항 주입
      session.clock.advance(12.0, 12000);
      const rc2 = session.createRoundController('round_02', mockQuestions[0]);
      expect(rc2.roundId).toBe('round_02');

      // Round 2 정답 펀치 제출
      const enc2 = rc2.encounters[0] as any;
      const side2 = enc2.correctSide ?? 'left';
      // 도착(7.0s) 100ms 전 정답 (EarlyMiss 170ms 유효창 내)
      rc2.update(6.9);
      rc2.submitPunch(side2, 6900, { activeSeconds: 6.9 });
      rc2.update(11.5);
      expect(rc2.isCompleted).toBe(true);

      const r2Summary = rc2.getRoundSummary();
      expect(r2Summary).not.toBeNull();
      // Round 2의 attackId가 round_02_...로 격리되어 settlement에서 duplicate로 거부되지 않고 정답 1회 기록
      expect(r2Summary?.correctCount).toBe(1);
      expect(session.progressController.completedRounds).toBe(2);

      session.dispose();
    });
  });

  describe('3. damage -> death -> summary -> progress 순서 및 completedQuestions/hitCount 분리', () => {
    it('미완료/중단(abort) 시에는 completedQuestions가 0이며 진행도가 증가하지 않아야 한다', () => {
      const battleState = createMockBattleState(100);
      const session = AssaultSessionFactory.createSession({
        battleState,
        speech: createMockSpeech(),
        questions: mockQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        targetRounds: 3,
      });

      const rc1 = session.createRoundController('round_01', mockQuestions[0]);
      rc1.update(2.0);
      rc1.abort('test_abort');

      expect(rc1.isCompleted).toBe(true);
      const summary = rc1.getRoundSummary();
      expect(summary?.isAborted).toBe(true);
      expect(summary?.completedQuestions).toBe(0);

      // 미완료 중단이므로 진행도 증가 0건
      expect(session.progressController.completedRounds).toBe(0);
      expect(session.progressController.progress).toBe(0);

      session.dispose();
    });
  });

  describe('4. 최종 라운드 HP 0 즉시 패배 vs 생존 시 실측 인계 스냅샷', () => {
    it('목표 라운드 도달 시점에 생존한 경우 handover_climax 발행 및 실측 스냅샷 보관, finale 기본 false 유지', () => {
      const battleState = createMockBattleState(100);
      const session = AssaultSessionFactory.createSession({
        battleState,
        speech: createMockSpeech(),
        questions: mockQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        targetRounds: 2,
      });

      // Round 1 완료
      const rc1 = session.createRoundController('round_01', mockQuestions[0]);
      rc1.update(6.0);
      rc1.submitPunch('left', 6000, { activeSeconds: 6.0 });
      rc1.update(11.5);
      expect(rc1.isCompleted).toBe(true);

      // Round 2 완료
      session.clock.advance(12.0, 12000);
      const rc2 = session.startNextRound ? session.startNextRound() : null;
      expect(rc2).not.toBeNull();
      if (!rc2) return;

      rc2.update(6.0);
      rc2.submitPunch('left', 6000, { activeSeconds: 6.0 });
      rc2.update(11.5);
      expect(rc2.isCompleted).toBe(true);

      // 목표 2라운드 도달
      expect(session.progressController.isTargetReached).toBe(true);
      expect(session.progressController.completedRounds).toBe(2);

      const handoverSnapshot = session.progressController.handoverSnapshot;
      expect(handoverSnapshot).not.toBeNull();
      expect(handoverSnapshot?.targetRounds).toBe(2);
      expect(handoverSnapshot?.completedRounds).toBe(2);
      expect(handoverSnapshot?.stats.totalCompletedQuestions).toBe(2);

      // finale 기본 false 유지
      expect(session.isFinaleActive).toBe(false);

      // 목표 도달 후 추가 라운드 생성 0건
      const rc3 = session.startNextRound ? session.startNextRound() : null;
      expect(rc3).toBeNull();

      session.dispose();
    });

    it('최종 라운드에서 HP 0 사망 발생 시 handover_climax가 아닌 game_over가 즉시 1회 판정되어야 한다', () => {
      const battleState = createMockBattleState(100);
      const session = AssaultSessionFactory.createSession({
        battleState,
        speech: createMockSpeech(),
        questions: mockQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        targetRounds: 2,
      });

      // Round 1 완료
      const rc1 = session.createRoundController('round_01', mockQuestions[0]);
      rc1.update(6.0);
      rc1.submitPunch('left', 6000, { activeSeconds: 6.0 });
      rc1.update(11.5);
      expect(rc1.isCompleted).toBe(true);
      expect(session.progressController.completedRounds).toBe(1);

      // Round 2 시작
      session.clock.advance(12.0, 12000);
      const rc2 = session.startNextRound ? session.startNextRound() : null;
      expect(rc2).not.toBeNull();
      if (!rc2) return;

      // Round 2에서 HP 0으로 사망
      battleState.hp = 0;
      rc2.update(11.5);

      expect(session.progressController.isGameOver).toBe(true);
      expect(session.progressController.handoverSnapshot).toBeNull();
      // 패배 라운드는 진행도에 추가되지 않음 (1 유지)
      expect(session.progressController.completedRounds).toBe(1);

      // 패배 후 추가 라운드 생성 0건
      const rc3 = session.startNextRound ? session.startNextRound() : null;
      expect(rc3).toBeNull();

      session.dispose();
    });
  });

  describe('5. 중복 콜백 및 stale 완료 차단', () => {
    it('동일 라운드 중복 콜백이나 stale 완료 유입이 다음 라운드를 추가 전진시키지 않아야 한다', () => {
      const battleState = createMockBattleState(100);
      const session = AssaultSessionFactory.createSession({
        battleState,
        speech: createMockSpeech(),
        questions: mockQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        targetRounds: 3,
      });

      let completeCallCount = 0;
      const rc1 = session.createRoundController('round_01', mockQuestions[0], {
        onRoundComplete: () => {
          completeCallCount++;
        },
      });

      rc1.update(6.0);
      rc1.submitPunch('left', 6000, { activeSeconds: 6.0 });
      rc1.update(11.5);

      expect(completeCallCount).toBe(1);
      expect(session.progressController.completedRounds).toBe(1);

      // 중복 update 유입
      rc1.update(12.0);
      expect(completeCallCount).toBe(1);
      expect(session.progressController.completedRounds).toBe(1);

      session.dispose();
    });
  });

  describe('6. 자세 상태 보존 (손회수/직립복귀 강제 reset 방지)', () => {
    it('직립 복귀 전 세대 상태가 startNextRound로 생성된 다음 라운드에 정상 인계되어야 한다', () => {
      const battleState = createMockBattleState(100);
      const session = AssaultSessionFactory.createSession({
        battleState,
        speech: createMockSpeech(),
        questions: mockQuestions,
        pattern: DEFAULT_APPROACH_PATTERN,
        targetRounds: 2,
      });

      const rc1 = session.createRoundController('round_01', mockQuestions[0]);
      rc1.update(6.0);
      rc1.submitPunch('left', 6000, { activeSeconds: 6.0 });
      rc1.update(8.0);
      // 스쿼트 회피 성공 후 직립 복귀하지 않음 (앉아있음)
      rc1.submitSquat('squatting', 8500, { activeSeconds: 8.5 });
      rc1.update(11.5);
      expect(rc1.isCompleted).toBe(true);

      const r1SquatState = rc1.exportSquatStandState();
      expect(r1SquatState.consumedGenerations.length).toBeGreaterThan(0);

      // Round 2 시작
      session.clock.advance(12.0, 12000);
      const rc2 = session.startNextRound ? session.startNextRound() : null;
      expect(rc2).not.toBeNull();
      if (!rc2) return;

      // rc2의 초기 squat stand state가 rc1의 상태를 인계받았는지 검증
      const r2InitialSquatState = rc2.exportSquatStandState();
      expect(r2InitialSquatState.consumedGenerations).toEqual(r1SquatState.consumedGenerations);

      session.dispose();
    });
  });
});
