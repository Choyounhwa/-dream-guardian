/**
 * beat-run-gameplay.test.ts - 실제 운동 8회 기반 문제 준비 라운드 전환 통합 테스트
 *
 * @see Issue #187 [BUG-BEAT-001]
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

describe('BeatRunCoordinator Integration - [BUG-BEAT-001]', () => {
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

  describe('2. 미동작 시 시간만으로 운동 비트가 전진하지 않는다', () => {
    beforeEach(() => {
      coordinator.startRound({ chapter: 1 });
    });

    it('장시간 정지해도 0/8 운동 비트와 RUN_QUESTION 상태를 유지한다', () => {
      const lm = createMockLandmarks(0.50);

      coordinator.update(30, lm);

      expect(coordinator.completedExerciseBeats).toBe(0);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.isAnswerOpen).toBe(false);
    });
  });

  describe('3. 실제 운동 8회와 중앙 복귀 후 답안 페이즈 전이', () => {
    beforeEach(() => {
      coordinator.startRound({ chapter: 1 });
    });

    it('운동 1회마다 정확히 1박씩 채우고 8회 완료 전에는 중앙 복귀를 시작하지 않는다', () => {
      for (let step = 1; step <= 7; step++) {
        coordinator.recordStep('run');
        expect(coordinator.completedExerciseBeats).toBe(step);
        expect(coordinator.phase).toBe('RUN_QUESTION');
        expect(coordinator.isAnswerOpen).toBe(false);
      }

      coordinator.recordStep('run');
      expect(coordinator.completedExerciseBeats).toBe(8);
      expect(coordinator.phase).toBe('REST_READY');
      expect(coordinator.centerReturnGate.isOpen).toBe(true);
      expect(coordinator.isAnswerOpen).toBe(false);
    });

    it('8회 운동 뒤 2박 준비와 중앙 복귀 잠금이 완료되면 키노트 퍼포먼스를 연다', () => {
      const lm = createMockLandmarks(0.50);

      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
      }
      expect(coordinator.phase).toBe('REST_READY');

      // 2박(1.0초) 준비 구간 중앙 체류
      for (let i = 0; i < 10; i++) {
        coordinator.update(0.1, lm);
      }

      expect(coordinator.centerReturnGate.isLocked).toBe(true);
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.phase).toBe('KEYNOTE_PERFORMANCE');

      // AnswerZoneSelector에 기준점이 성공적으로 주입됨
      const ref = coordinator.answerZoneSelector.getReference();
      expect(ref).not.toBeNull();
      expect(ref?.hipX).toBeCloseTo(0.50, 2);
    });
  });

  describe('4. 준비 구간 Fallback은 무피해로 키노트 퍼포먼스를 연다', () => {
    beforeEach(() => {
      coordinator.startRound({ chapter: 1 });
    });

    it('2박 준비 중 중앙 미복귀 시 오답/HP 차감 없이 fallback 기준점으로 전환한다', () => {
      const lmOutside = createMockLandmarks(0.20); // 중앙 외부에 체류
      const initialHp = battle.hp;

      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
      }

      // 2박 준비 구간 동안 중앙 외부 유지
      for (let i = 0; i < 10; i++) {
        coordinator.update(0.1, lmOutside);
      }

      // 오답 처리나 피해가 없어야 함
      expect(battle.hp).toBe(initialHp);
      expect(battle.wrongCount).toBe(0);
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.centerReturnGate.isTimedOut).toBe(true);
      expect(coordinator.centerReturnGate.isLocked).toBe(true);
      expect(coordinator.phase).toBe('KEYNOTE_PERFORMANCE');
      expect(coordinator.answerZoneSelector.getReference()?.isFallback).toBe(true);
    });
  });

  describe('5. 운동 기록(스텝) 반영', () => {
    it('운동 스텝은 누적 기록과 라운드 운동 비트에 함께 반영된다', () => {
      coordinator.startRound({ chapter: 1 });

      coordinator.recordStep('run');
      coordinator.recordStep('run');
      coordinator.recordStep('run');

      expect(coordinator.totalSteps).toBe(3);
      expect(coordinator.completedExerciseBeats).toBe(3);
    });
  });

  describe('6. 키보드/터치 운동 fallback도 8회 운동 계약을 따른다', () => {
    it('fallback으로 기록한 1회 운동은 답안 페이즈를 즉시 열지 않는다', () => {
      coordinator.startRound({ chapter: 1 });
      expect(coordinator.isAnswerOpen).toBe(false);

      coordinator.recordStep();

      expect(coordinator.completedExerciseBeats).toBe(1);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.isAnswerOpen).toBe(false);
    });
  });

  describe('7. 문제/키노트 페이즈 코디네이터 지속 갱신 및 답안 선택 수명주기 [BUG-BEAT-002]', () => {
    it('문제 페이즈(KEYNOTE_PERFORMANCE)에서 시간(dt)이 지속 갱신되어 답안 확정 후 8박 만료 시 단 1회 정산된다', () => {
      const confirmedSpy = vi.fn();
      const phaseSpy = vi.fn();

      coordinator = new BeatRunCoordinator({
        questionBank,
        battle,
        onAnswerConfirmed: confirmedSpy,
        onPhaseChange: phaseSpy,
      });
      coordinator.startRound({ chapter: 1 });

      // 1. 8회 운동
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');
      expect(coordinator.phase).toBe('REST_READY');

      // 2. 2박 호흡 (1.0s)
      coordinator.update(1.0);
      expect(coordinator.phase).toBe('KEYNOTE_PERFORMANCE');
      expect(coordinator.isAnswerOpen).toBe(true);

      // 3. 1박째 또는 키노트 중 답안 선택
      const correctIndex = coordinator.currentQuestion!.correctIndex;
      coordinator.confirmAnswerByFallback(correctIndex);
      expect(coordinator.selectedChoiceIndex).toBe(correctIndex);
      expect(coordinator.isAnswerOpen).toBe(false);

      // 4. 문제 페이즈(KEYNOTE_PERFORMANCE) 동안 남은 시간 갱신
      coordinator.update(4.0);

      // 5. 8박 만료 시 ROUND_RESOLVE로 전이 및 단 1회 정산 확인
      expect(coordinator.phase).toBe('ROUND_RESOLVE');
      expect(coordinator.roundResolveCount).toBe(1);
      expect(confirmedSpy).toHaveBeenCalledTimes(1);
      expect(confirmedSpy).toHaveBeenCalledWith(correctIndex, true);
      expect(battle.mana).toBe(25);
    });

    it('답안을 선택하지 않아도 KEYNOTE_PERFORMANCE 8박 만료 시 오답으로 단 1회 정산된다', () => {
      const confirmedSpy = vi.fn();
      coordinator = new BeatRunCoordinator({
        questionBank,
        battle,
        onAnswerConfirmed: confirmedSpy,
      });
      coordinator.startRound({ chapter: 1 });

      for (let i = 0; i < 8; i++) coordinator.recordStep('run');
      coordinator.update(1.0); // REST_READY 완료
      expect(coordinator.phase).toBe('KEYNOTE_PERFORMANCE');

      // 아무런 답안도 선택하지 않고 4.0초 경과
      coordinator.update(4.0);

      expect(coordinator.phase).toBe('ROUND_RESOLVE');
      expect(coordinator.roundResolveCount).toBe(1);
      expect(confirmedSpy).toHaveBeenCalledTimes(1);
      expect(confirmedSpy).toHaveBeenCalledWith(-1, false);
      expect(battle.hp).toBe(75);
    });
  });
});
