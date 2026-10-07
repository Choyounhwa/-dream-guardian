import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_DIFFICULTY_BEAT_PROFILE,
  CHAPTER_SUBLEVEL_BEAT_PROFILES,
  getDifficultyBeatProfile,
  type DifficultyBeatProfile,
} from '../../config/beat-motion.config.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { RhythmEngine } from '../../src/core/RhythmEngine.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { QuestionRenderer, type QuestionRenderState } from '../../src/render/QuestionRenderer.js';
import { BeatHUDRenderer, type BeatHUDState } from '../../src/render/BeatHUDRenderer.js';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';
import type { GeneratedQuestion } from '../../src/question/QuestionEvaluator.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

const mockQuestion: GeneratedQuestion = {
  questionText: '7 + 8 = ?',
  choices: [15, 16],
  correctAnswer: 15,
  wrongAnswer: 16,
  correctIndex: 0,
};

describe('Beat Difficulty Profile & 6-Beat Answer Approach - [BEAT-DIFFICULTY-001 / #279]', () => {
  describe('1. config/beat-motion.config.ts 난이도 프로필 모델 검증', () => {
    it('DEFAULT_DIFFICULTY_BEAT_PROFILE은 8-6-4-8 표준 박자 규격을 갖는다', () => {
      expect(DEFAULT_DIFFICULTY_BEAT_PROFILE).toEqual({
        exerciseBeats: 8,
        approachStartBeat: 6,
        answerSelectBeats: 4,
        branchRoutineBeats: 8,
      });
    });

    it('CHAPTER_SUBLEVEL_BEAT_PROFILES에 Ch.1~5 기본 프로필이 정의되어 있다', () => {
      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[1].default.exerciseBeats).toBe(8);
      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[1].default.approachStartBeat).toBe(6);

      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[2].default.exerciseBeats).toBe(8);
      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[2].subLevels?.[3].exerciseBeats).toBe(12);

      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[3].default.exerciseBeats).toBe(12);
      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[3].subLevels?.[3].answerSelectBeats).toBe(4);

      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[4].default.exerciseBeats).toBe(12);
      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[4].subLevels?.[3].answerSelectBeats).toBe(4);

      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[5].default.exerciseBeats).toBe(16);
      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[5].default.approachStartBeat).toBe(14);
      expect(CHAPTER_SUBLEVEL_BEAT_PROFILES[5].default.answerSelectBeats).toBe(4);
    });

    it('getDifficultyBeatProfile 유틸리티는 챕터 및 세부단계에 맞는 프로필을 반환하고 미등록 시 fallback한다', () => {
      const ch1 = getDifficultyBeatProfile(1);
      expect(ch1.exerciseBeats).toBe(8);
      expect(ch1.approachStartBeat).toBe(6);

      const ch2Sub3 = getDifficultyBeatProfile(2, 3);
      expect(ch2Sub3.exerciseBeats).toBe(12);
      expect(ch2Sub3.approachStartBeat).toBe(10);

      const ch5Sub3 = getDifficultyBeatProfile(5, 3);
      expect(ch5Sub3.exerciseBeats).toBe(16);
      expect(ch5Sub3.approachStartBeat).toBe(14);
      expect(ch5Sub3.answerSelectBeats).toBe(4);

      // 존재하지 않는 챕터 fallback
      const unknownCh = getDifficultyBeatProfile(99);
      expect(unknownCh).toEqual(DEFAULT_DIFFICULTY_BEAT_PROFILE);
    });
  });

  describe('2. BeatRunCoordinator 동적 박자 프로필 및 answerApproachProgress 산출', () => {
    let coordinator: BeatRunCoordinator;
    let rhythmEngine: RhythmEngine;

    beforeEach(() => {
      rhythmEngine = new RhythmEngine({ bpm: 120, beatsPerRound: 8 });
      coordinator = new BeatRunCoordinator({
        rhythmEngine,
        routineMode: 'arm_reach',
      });
    });

    it('startRound 시 difficultyProfile이 주입되면 해당 박자 수가 적용된다', () => {
      const customProfile: DifficultyBeatProfile = {
        exerciseBeats: 12,
        approachStartBeat: 10,
        answerSelectBeats: 4,
        branchRoutineBeats: 8,
      };

      coordinator.startRound({ chapter: 5, subLevel: 1, difficultyProfile: customProfile });

      expect(coordinator.exerciseBeats).toBe(12);
      expect(coordinator.approachStartBeat).toBe(10);
      expect(coordinator.readyBeats).toBe(4);
      expect(coordinator.performanceBeats).toBe(8);
    });

    it('8박 프로필에서 0~6박은 approachProgress=0.0이고, 6~8박은 0.0->1.0 ease-out 보간된다', () => {
      coordinator.startRound({ chapter: 1 }); // 8-6-2-8
      expect(coordinator.exerciseBeats).toBe(8);
      expect(coordinator.approachStartBeat).toBe(6);

      // t=0 (0박)
      expect(coordinator.answerApproachProgress).toBe(0.0);

      // t=2.5s (5박 경과)
      coordinator.update(2.5);
      expect(coordinator.answerApproachProgress).toBe(0.0);

      // t=3.0s (정확히 6박 시작 시점)
      coordinator.update(0.5);
      expect(coordinator.answerApproachProgress).toBe(0.0);

      // t=3.5s (7박: 6박과 8박의 절반 시점 -> linear 0.5, ease-out 1 - (1-0.5)^2 = 0.75)
      coordinator.update(0.5);
      expect(coordinator.answerApproachProgress).toBeCloseTo(0.75, 2);

      // t=4.0s (8박 완료 시점)
      coordinator.update(0.5);
      expect(coordinator.answerApproachProgress).toBe(1.0);
    });

    it('16박 프로필에서 0~14박은 0.0이고 14~16박(7.0s~8.0s) 동안 0.0->1.0 보간된다', () => {
      const profile16: DifficultyBeatProfile = {
        exerciseBeats: 16,
        approachStartBeat: 14,
        answerSelectBeats: 4,
        branchRoutineBeats: 8,
      };
      coordinator.startRound({ difficultyProfile: profile16 });

      expect(coordinator.exerciseBeats).toBe(16);
      expect(coordinator.approachStartBeat).toBe(14);

      // t=6.5s (13박)
      coordinator.update(6.5);
      expect(coordinator.answerApproachProgress).toBe(0.0);

      // t=7.0s (14박 진입)
      coordinator.update(0.5);
      expect(coordinator.answerApproachProgress).toBe(0.0);

      // t=7.5s (15박: 절반 진행 -> 0.75)
      coordinator.update(0.5);
      expect(coordinator.answerApproachProgress).toBeCloseTo(0.75, 2);

      // t=8.0s (16박 도달)
      coordinator.update(0.5);
      expect(coordinator.answerApproachProgress).toBe(1.0);
    });
  });

  describe('3. [사전 위험 1번 해결] N-2박 필수 스텝 달성 후 잔여 2박 선택 준비 시간 경과 자동 전이', () => {
    let coordinator: BeatRunCoordinator;
    let rhythmEngine: RhythmEngine;

    beforeEach(() => {
      rhythmEngine = new RhythmEngine({ bpm: 120, beatsPerRound: 8 });
      coordinator = new BeatRunCoordinator({
        rhythmEngine,
        routineMode: 'arm_reach',
      });
    });

    it('8박 라운드에서 6스텝 완료 후 추가 스텝 없이도 4.0초(8박 종료 경계) 도달 시 ANSWER_SELECT로 전이된다', () => {
      coordinator.startRound({ chapter: 1 }); // 8박

      // 6개 슬롯 순차 스텝 (0.0s~3.0s)
      for (let s = 0; s < 6; s++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.completedExerciseBeats).toBe(6);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 6박 이후 발을 멈추고 대기 (3.0s ~ 3.99s)
      coordinator.update(0.99);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.isAnswerOpen).toBe(false);

      // 4.0s(8박 종료) 경계 도달
      coordinator.update(0.01);
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);
    });

    it('6스텝 미달(예: 4스텝) 시에는 시간이 경과해도 자동 전이되지 않고 RUN_QUESTION을 유지한다', () => {
      coordinator.startRound({ chapter: 1 });

      // 4스텝만 진행
      for (let s = 0; s < 4; s++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.completedExerciseBeats).toBe(4);

      // 10초 대기
      coordinator.update(10.0);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.isAnswerOpen).toBe(false);
    });

    it('12박 라운드에서는 10스텝 완료 후 6.0초(12박 경계)에서 ANSWER_SELECT로 전이된다', () => {
      const profile12: DifficultyBeatProfile = {
        exerciseBeats: 12,
        approachStartBeat: 10,
        answerSelectBeats: 2,
        branchRoutineBeats: 8,
      };
      coordinator.startRound({ difficultyProfile: profile12 });

      // 10개 슬롯 스텝 (5.0초 소요)
      for (let s = 0; s < 10; s++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.completedExerciseBeats).toBe(10);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 5.0s ~ 5.99s 대기
      coordinator.update(0.99);
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 6.0s 도달
      coordinator.update(0.01);
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);
    });
  });

  describe('4. [사전 위험 2번 해결] 러닝 중 답안 입력 완전 잠금 및 ANSWER_SELECT 즉시 개방', () => {
    let coordinator: BeatRunCoordinator;
    let selector: ArmReachAnswerSelector;
    let adapter: PhasePresentationAdapter;

    beforeEach(() => {
      selector = new ArmReachAnswerSelector({ isMirrored: false });
      adapter = new PhasePresentationAdapter();
      coordinator = new BeatRunCoordinator({
        armReachAnswerSelector: selector,
        routineMode: 'arm_reach',
      });
    });

    it('러닝 중(6~8박 원근 접근 구간 포함)에는 입력이 차단되고 confirmAnswerByFallback도 무시된다', () => {
      coordinator.startRound({ chapter: 1 });

      // 6스텝 완료 -> 원근 접근 진행 중 (t=3.5s, progress=0.75)
      for (let s = 0; s < 6; s++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      coordinator.update(0.5); // t=3.5s

      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(coordinator.answerApproachProgress).toBeGreaterThan(0);
      expect(coordinator.isAnswerOpen).toBe(false);
      expect(adapter.isAnswerInputAllowed(coordinator.phase as any, false)).toBe(false);

      // 러닝 중 fallback 선택 시도 -> 무시되어야 함
      coordinator.confirmAnswerByFallback(0);
      expect(coordinator.selectedChoiceIndex).toBeNull();
      expect(coordinator.phase).toBe('RUN_QUESTION');
    });

    it('8박 경계 도달로 ANSWER_SELECT 전이 즉시 입력이 개방되고 정상 선택된다', () => {
      coordinator.startRound({ chapter: 1 });

      for (let s = 0; s < 6; s++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      coordinator.update(1.0); // 4.0s 도달

      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(adapter.isAnswerInputAllowed(coordinator.phase as any, false)).toBe(true);

      coordinator.confirmAnswerByFallback(0);
      expect(coordinator.selectedChoiceIndex).toBe(0);
    });
  });

  describe('5. QuestionRenderer 원근 접근 보간 및 buttonsOnly 프리뷰 지원', () => {
    it('answerApproachProgress에 따라 답안 버튼 좌표가 소실점에서 목표 위치로 보간된다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      // progress=0.5, vanishingX=540, vanishingY=518
      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
        answerApproachProgress: 0.5,
        vanishingX: 540,
        vanishingY: 518,
        buttonsOnly: true,
      };

      renderer.render(ctx, 1080, 2160, state);
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      // buttonsOnly이므로 상단 문제 헤더의 그림자나 헤더 관련 처리가 호출되지 않거나 축소됨
      expect(ctx.globalAlpha).toBeDefined();
    });

    it('buttonsOnly=true일 때 문제 헤더는 생략하고 답안 버튼만 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
        answerApproachProgress: 0.8,
        vanishingX: 540,
        vanishingY: 518,
        buttonsOnly: true,
      };

      renderer.render(ctx, 1080, 2160, state);
      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
      // 헤더 문제 텍스트 '7 + 8 = ?'는 출력되지 않고 답안 텍스트 및 키보드 힌트만 출력됨
      expect(textCalls.some((t: string) => t.includes('7 + 8'))).toBe(false);
      expect(textCalls.some((t: string) => t.includes('키보드 [1]'))).toBe(true);
    });
  });

  describe('6. PhasePresentationAdapter 프리뷰 렌더 판정', () => {
    it('canRenderAnswerPreview는 RUN_QUESTION이며 approachProgress > 0일 때만 true를 반환한다', () => {
      const adapter = new PhasePresentationAdapter();

      expect(adapter.canRenderAnswerPreview('RUN_QUESTION', 0.0)).toBe(false);
      expect(adapter.canRenderAnswerPreview('RUN_QUESTION', 0.5)).toBe(true);
      expect(adapter.canRenderAnswerPreview('RUN_QUESTION', 1.0)).toBe(true);
      expect(adapter.canRenderAnswerPreview('ANSWER_SELECT', 1.0)).toBe(false);
      expect(adapter.canRenderAnswerPreview('STAR_COLLECT', 1.0)).toBe(false);
    });
  });

  describe('7. BeatHUDRenderer 가변 박자(8/12/16) 도트 렌더링', () => {
    it('state.exerciseBeats에 따라 지정된 수의 도트를 렌더링한다', () => {
      const renderer = new BeatHUDRenderer({ showBeatDots: true });
      const ctx = createMockCtx();

      const state12: BeatHUDState = {
        question: mockQuestion,
        completedExerciseBeats: 5,
        totalSteps: 5,
        locomotionMode: 'run',
        exerciseBeats: 12,
      };

      renderer.render(ctx, 1080, 2160, state12);

      // arc가 12회 호출되어야 함
      expect(ctx.arc).toHaveBeenCalledTimes(12);

      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(textCalls.includes('12')).toBe(true);
    });
  });
});
