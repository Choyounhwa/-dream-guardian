/**
 * beat-run-gameplay.test.ts - 자유 달리기 게이지의 8박 문제 준비 라운드 전환 통합 테스트
 *
 * @see Issue #180 [BEAT-RUN-001]
 * @see Issue #176 [BEAT-SPEC-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { BattleState } from '../../src/game/BattleState.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

/** 테스트용 랜드마크 생성 도우미 */
function createMockLandmarks(hipX = 0.50, shoulderWidth = 0.20): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: hipX - 0.05, y: 0.55, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: hipX + 0.05, y: 0.55, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: hipX - shoulderWidth / 2, y: 0.35, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: hipX + shoulderWidth / 2, y: 0.35, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.NOSE] = { x: hipX, y: 0.20, z: 0, visibility: 0.9 };

  return landmarks;
}

describe('BeatRunCoordinator Integration - [BEAT-RUN-001]', () => {
  let coordinator: BeatRunCoordinator;
  let questionBank: QuestionBank;
  let battle: BattleState;
  let mockSpeak: (text: string) => void;

  beforeEach(() => {
    questionBank = new QuestionBank();
    questionBank.loadRecords([
      {
        level: 1,
        subLevel: 1,
        levelTitle: '덧셈 기초',
        subLevelTitle: '한 자리 덧셈',
        questionTemplate: '{A} + {B} = ?',
        answerEval: 'A + B',
        wrongEval: 'A + B + 1',
        varA: '1,2,3',
        varB: '1,2,3',
        varC: '',
        varD: '',
        shapeCode: '',
      },
    ]);

    battle = new BattleState();
    mockSpeak = vi.fn();

    coordinator = new BeatRunCoordinator({
      questionBank,
      battle,
      speakFn: mockSpeak,
    });
  });

  describe('1. 문제 생성 및 비블로킹 TTS 검증', () => {
    it('run phase 시작 시 문제는 정확히 한 번만 생성된다', () => {
      coordinator.startRound({ chapter: 1 });

      expect(coordinator.questionGeneratedCount).toBe(1);
      expect(coordinator.currentQuestion).not.toBeNull();
      expect(coordinator.currentQuestion?.questionText).toContain('+');
      expect(mockSpeak).toHaveBeenCalledTimes(1);

      // 1~5박(2.5초) 경과 중에도 문제는 추가 생성되지 않음
      const lm = createMockLandmarks(0.50);
      for (let i = 0; i < 25; i++) {
        coordinator.update(0.1, lm);
      }

      expect(coordinator.questionGeneratedCount).toBe(1);
      expect(mockSpeak).toHaveBeenCalledTimes(1);
    });

    it('비블로킹 TTS가 문제 텍스트를 정확히 낭독한다', () => {
      coordinator.startRound({ chapter: 1 });
      const qText = coordinator.currentQuestion!.questionText;
      expect(mockSpeak).toHaveBeenCalledWith(qText);
    });
  });

  describe('2. 8박 이전 답안 페이즈 차단 검증', () => {
    beforeEach(() => {
      coordinator.startRound({ chapter: 1 });
    });

    it('1~5박(0.0~2.5초) 동안 답안 페이즈는 닫혀 있어야 한다', () => {
      const lm = createMockLandmarks(0.50);

      // 1박부터 5박 직전(2.4초)까지 진행
      for (let i = 0; i < 24; i++) {
        coordinator.update(0.1, lm);
        expect(coordinator.isAnswerOpen).toBe(false);
        expect(coordinator.phase).toBe('RUN_QUESTION');
      }
    });

    it('6~7박(2.5~3.5초) 중앙 복귀 중에도 답안 페이즈는 열리지 않는다', () => {
      const lm = createMockLandmarks(0.50);

      // 2.5초 시점 (6박 진입)
      coordinator.update(2.5, lm);
      expect(coordinator.phase).toBe('CENTER_RETURN');
      expect(coordinator.centerReturnGate.isOpen).toBe(true);
      expect(coordinator.isAnswerOpen).toBe(false);

      // 3.4초 시점 (7박 말)
      coordinator.update(0.9, lm);
      expect(coordinator.isAnswerOpen).toBe(false);
    });
  });

  describe('3. 8박 중앙 복귀 및 기준점 잠금 후 답안 페이즈 전이', () => {
    beforeEach(() => {
      coordinator.startRound({ chapter: 1 });
    });

    it('중앙 복귀가 안정적으로 완료되면 8박에 기준점이 잠기고 answer phase가 열린다', () => {
      const lm = createMockLandmarks(0.50);

      // 1~5박 (2.5초)
      coordinator.update(2.5, lm);
      expect(coordinator.phase).toBe('CENTER_RETURN');

      // 6~8박 (1.5초) 동안 중앙 체류 -> 총 4.0초 (8박 만료 시점)
      for (let i = 0; i < 15; i++) {
        coordinator.update(0.1, lm);
      }

      expect(coordinator.centerReturnGate.isLocked).toBe(true);
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.phase).toBe('ANSWER_OPEN');

      // AnswerZoneSelector에 기준점이 성공적으로 주입됨
      const ref = coordinator.answerZoneSelector.getReference();
      expect(ref).not.toBeNull();
      expect(ref?.hipX).toBeCloseTo(0.50, 2);
    });
  });

  describe('4. 중앙 복귀 실패/지연 시 안전 연장(Retry) 및 Fallback (무피해/무오답)', () => {
    beforeEach(() => {
      coordinator.startRound({ chapter: 1 });
    });

    it('8박 시점까지 중앙 미복귀 시 오답/HP 차감 없이 retry 연장 상태로 대기한다', () => {
      const lmOutside = createMockLandmarks(0.20); // 중앙 외부에 체류
      const initialHp = battle.hp;

      // 4.0초(8박 전체) 동안 중앙 외부 유지
      for (let i = 0; i < 40; i++) {
        coordinator.update(0.1, lmOutside);
      }

      // 오답 처리나 피해가 없어야 함
      expect(battle.hp).toBe(initialHp);
      expect(battle.wrongCount).toBe(0);
      expect(coordinator.isAnswerOpen).toBe(false);
      expect(coordinator.centerReturnGate.isRetrying).toBe(true);
    });

    it('연장 기간(최대 2박 = 1.0초) 중 복귀하면 정상 잠금 후 answer phase로 진입한다', () => {
      const lmOutside = createMockLandmarks(0.20);
      const lmCenter = createMockLandmarks(0.50);

      // 4.2초까지 이탈 (retry 진입)
      coordinator.update(4.2, lmOutside);
      expect(coordinator.centerReturnGate.isRetrying).toBe(true);

      // 연장 시간 내에 중앙으로 복귀하여 0.5초 안정 체류
      for (let i = 0; i < 10; i++) {
        coordinator.update(0.05, lmCenter);
      }

      expect(coordinator.centerReturnGate.isLocked).toBe(true);
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.phase).toBe('ANSWER_OPEN');
    });

    it('최대 연장 시간 만료 시 fallback 기준점으로 강제 잠금하여 answer phase로 안전 진입한다', () => {
      const lmOutside = createMockLandmarks(0.20);

      // 4.0초(정규 8박) + 1.1초(최대 연장 2박 초과) = 5.1초 경과
      coordinator.update(5.1, lmOutside);

      expect(coordinator.centerReturnGate.isTimedOut).toBe(true);
      expect(coordinator.centerReturnGate.isLocked).toBe(true);
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.phase).toBe('ANSWER_OPEN');
      expect(coordinator.answerZoneSelector.getReference()?.isFallback).toBe(true);
    });
  });

  describe('5. 운동 기록(스텝) 반영', () => {
    it('1~5박 이동 중 발생한 스텝이 운동 기록에 정확히 누적된다', () => {
      coordinator.startRound({ chapter: 1 });

      coordinator.recordStep('run');
      coordinator.recordStep('run');
      coordinator.recordStep('run');

      expect(coordinator.totalSteps).toBe(3);
    });
  });

  describe('6. Space/Click Fallback 전이 지원', () => {
    it('Space/클릭 fallback 트리거 시 즉시 기준점을 잠그고 answer phase로 전이된다', () => {
      coordinator.startRound({ chapter: 1 });
      expect(coordinator.isAnswerOpen).toBe(false);

      // 웹캠 미사용 환경 등에서 fallback 트리거
      coordinator.triggerFallbackAdvance();

      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.phase).toBe('ANSWER_OPEN');
      expect(coordinator.answerZoneSelector.getReference()).not.toBeNull();
    });

    it('answer phase에서 fallback 선택(0 또는 1) 시 정답 처리가 올바르게 수행된다', () => {
      coordinator.startRound({ chapter: 1 });
      coordinator.triggerFallbackAdvance();

      const correctIdx = coordinator.currentQuestion!.correctIndex;
      const initialMana = battle.mana;

      coordinator.confirmAnswerByFallback(correctIdx);

      expect(battle.mana).toBe(initialMana + 25);
      expect(battle.combo).toBe(1);
    });
  });
});
