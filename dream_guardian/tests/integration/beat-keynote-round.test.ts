/**
 * beat-keynote-round.test.ts - 8박 런 후 2박 팔 답안 선택 및 정답/오답 즉시 분기 엔진 통합 테스트
 *
 * @see Issue #210 [BEAT-KEYNOTE-ENGINE-001]
 * @see Issue #224 [INPUT-ARM-ANSWER-001]
 * @see Issue #225 [BATTLE-ANSWER-PENALTY-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

function createMockPose(options: {
  leftWrist?: { x: number; y: number; visibility?: number };
  rightWrist?: { x: number; y: number; visibility?: number };
  leftShoulder?: { x: number; y: number; visibility?: number };
  rightShoulder?: { x: number; y: number; visibility?: number };
  leftHip?: { x: number; y: number; visibility?: number };
  rightHip?: { x: number; y: number; visibility?: number };
  nose?: { x: number; y: number; visibility?: number };
}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = {
    x: options.leftShoulder?.x ?? 0.40,
    y: options.leftShoulder?.y ?? 0.35,
    z: 0,
    visibility: options.leftShoulder?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = {
    x: options.rightShoulder?.x ?? 0.60,
    y: options.rightShoulder?.y ?? 0.35,
    z: 0,
    visibility: options.rightShoulder?.visibility ?? 0.9,
  };

  landmarks[POSE_LANDMARKS.LEFT_WRIST] = {
    x: options.leftWrist?.x ?? 0.40,
    y: options.leftWrist?.y ?? 0.60,
    z: 0,
    visibility: options.leftWrist?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = {
    x: options.rightWrist?.x ?? 0.60,
    y: options.rightWrist?.y ?? 0.60,
    z: 0,
    visibility: options.rightWrist?.visibility ?? 0.9,
  };

  landmarks[POSE_LANDMARKS.LEFT_HIP] = {
    x: options.leftHip?.x ?? 0.45,
    y: options.leftHip?.y ?? 0.65,
    z: 0,
    visibility: options.leftHip?.visibility ?? 0.9,
  };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = {
    x: options.rightHip?.x ?? 0.55,
    y: options.rightHip?.y ?? 0.65,
    z: 0,
    visibility: options.rightHip?.visibility ?? 0.9,
  };

  landmarks[POSE_LANDMARKS.NOSE] = {
    x: options.nose?.x ?? 0.50,
    y: options.nose?.y ?? 0.20,
    z: 0,
    visibility: options.nose?.visibility ?? 0.9,
  };

  return landmarks;
}

const ZONE_4_CENTER = { x: 0.17, y: 0.32 };
const ZONE_5_CENTER = { x: 0.83, y: 0.32 };

describe('BeatKeynoteRound Integration (Issue #210 - BEAT-KEYNOTE-ENGINE-001)', () => {
  let coordinator: BeatRunCoordinator;
  let questionBank: QuestionBank;
  let battle: BattleState;
  let boss: BossController;
  let resolver: BeatRoundResolver;
  let armSelector: ArmReachAnswerSelector;
  let phaseHistory: string[];
  let onAnswerConfirmedSpy: ReturnType<typeof vi.fn>;
  let onAnswerSelectedSpy: ReturnType<typeof vi.fn>;

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
    boss = new BossController(1);
    resolver = new BeatRoundResolver({ battle, boss });
    armSelector = new ArmReachAnswerSelector({ isMirrored: false });
    phaseHistory = [];

    onAnswerConfirmedSpy = vi.fn((_idx, _correct, status) => {
      resolver.resolveRound(status);
    });

    onAnswerSelectedSpy = vi.fn();

    coordinator = new BeatRunCoordinator({
      questionBank,
      battle,
      armReachAnswerSelector: armSelector,
      onPhaseChange: (p) => phaseHistory.push(p),
      onAnswerConfirmed: onAnswerConfirmedSpy,
      onAnswerSelected: onAnswerSelectedSpy,
    });
  });

  describe('1. 8번째 운동 직후 ANSWER_SELECT 진입 및 2박 제약', () => {
    it('8번째 운동(recordStep) 직후 ANSWER_SELECT 페이즈로 즉시 진입하고 isAnswerOpen이 true가 된다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 7; i++) {
        coordinator.recordStep('run');
        expect(coordinator.phase).toBe('RUN_QUESTION');
        expect(coordinator.isAnswerOpen).toBe(false);
      }

      coordinator.recordStep('run'); // 8번째 스텝!
      expect(coordinator.completedExerciseBeats).toBe(8);
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);
    });

    it('답안 입력 창은 최대 2박(1.0초) 동안만 열리며, 2박 초과 시 timeout 처리되어 HAZARD_EVADE로 자동 분기한다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      // 0.8초 경과 (아직 열려 있음)
      coordinator.update(0.8);
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      // 추가 0.25초 경과 (총 1.05초 > 1.0초 2박 만료)
      coordinator.update(0.25);
      expect(coordinator.isAnswerOpen).toBe(false);
      expect(coordinator.phase).toBe('HAZARD_EVADE');
    });
  });

  describe('2. ArmReachAnswerSelector 한 팔 Zone 4/5 즉시 선택 및 정답/오답 즉시 분기', () => {
    it('한 손이 Zone 4에 있으면 0번이 즉시 선택되고 정답일 경우 STAR_COLLECT로 즉시 분기한다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');

      const correctIndex = coordinator.currentQuestion!.correctIndex;
      // Zone 4는 0번 선택
      const poseZone4 = createMockPose({ leftWrist: ZONE_4_CENTER });

      coordinator.update(0.016, poseZone4);

      expect(coordinator.selectedChoiceIndex).toBe(0);
      expect(coordinator.isAnswerOpen).toBe(false);
      expect(onAnswerSelectedSpy).toHaveBeenCalledWith(0);

      if (correctIndex === 0) {
        expect(coordinator.phase).toBe('STAR_COLLECT');
      } else {
        expect(coordinator.phase).toBe('HAZARD_EVADE');
      }
    });

    it('한 손이 Zone 5에 정지해 둔 상태(정적 입력)에서도 첫 프레임에 1번이 즉시 선택된다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');

      const poseZone5 = createMockPose({ rightWrist: ZONE_5_CENTER });
      coordinator.update(0.016, poseZone5);

      expect(coordinator.selectedChoiceIndex).toBe(1);
      expect(coordinator.isAnswerOpen).toBe(false);
      expect(onAnswerSelectedSpy).toHaveBeenCalledWith(1);
    });

    it('양팔이 동시에 Zone 4와 5에 걸치면 미선택 상태를 유지한다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');

      const bothArmsPose = createMockPose({
        leftWrist: ZONE_4_CENTER,
        rightWrist: ZONE_5_CENTER,
      });

      coordinator.update(0.016, bothArmsPose);

      expect(coordinator.selectedChoiceIndex).toBeNull();
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.phase).toBe('ANSWER_SELECT');
    });
  });

  describe('3. 즉각 분기 및 4초 대기 제거 / 루틴 종료 시 단 1회 정산', () => {
    it('정답 선택 즉시 STAR_COLLECT로 전이되며, 7박 경과 후 ROUND_RESOLVE에서 단 1회 정산된다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');

      const correctIdx = coordinator.currentQuestion!.correctIndex;
      coordinator.confirmAnswerByFallback(correctIdx);

      // 선택 즉시 STAR_COLLECT로 분기
      expect(coordinator.phase).toBe('STAR_COLLECT');
      expect(onAnswerConfirmedSpy).not.toHaveBeenCalled(); // 아직 루틴 미완료

      // 7박(3.5s) 경과 시 ROUND_RESOLVE 호출
      coordinator.update(3.5);

      expect(coordinator.phase).toBe('ROUND_RESOLVE');
      expect(onAnswerConfirmedSpy).toHaveBeenCalledTimes(1);
      expect(onAnswerConfirmedSpy).toHaveBeenCalledWith(correctIdx, true, 'correct');
      expect(coordinator.roundResolveCount).toBe(1);

      // 전투 자원 확인: 마나 +25, 콤보 1, 보스 피해 1
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
      expect(boss.hp).toBe(9);
    });

    it('오답 선택 즉시 HAZARD_EVADE로 전이되며, 플레이어 HP는 감소하지 않고 ROUND_RESOLVE에서 1회 정산된다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');

      const wrongIdx = coordinator.currentQuestion!.correctIndex === 0 ? 1 : 0;
      coordinator.confirmAnswerByFallback(wrongIdx);

      // 선택 즉시 HAZARD_EVADE로 분기
      expect(coordinator.phase).toBe('HAZARD_EVADE');
      expect(onAnswerConfirmedSpy).not.toHaveBeenCalled();

      // 7박(3.5s) 경과 시 ROUND_RESOLVE
      coordinator.update(3.5);

      expect(coordinator.phase).toBe('ROUND_RESOLVE');
      expect(onAnswerConfirmedSpy).toHaveBeenCalledTimes(1);
      expect(onAnswerConfirmedSpy).toHaveBeenCalledWith(wrongIdx, false, 'wrong');

      // Issue #225: 오답 자체로 HP 차감 없음, 콤보만 리셋
      expect(battle.hp).toBe(100);
      expect(battle.combo).toBe(0);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(1);
    });

    it('타임아웃(미응답) 시 즉시 HAZARD_EVADE로 전이되고, HP 차감 없이 timeoutCount에 정상 집계된다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');

      // 2박(1.0s) 미응답 경과
      coordinator.update(1.0);

      expect(coordinator.phase).toBe('HAZARD_EVADE');
      expect(coordinator.selectedChoiceIndex).toBeNull();

      // 7박(3.5s) 경과 시 ROUND_RESOLVE
      coordinator.update(3.5);

      expect(coordinator.phase).toBe('ROUND_RESOLVE');
      expect(onAnswerConfirmedSpy).toHaveBeenCalledWith(-1, false, 'timeout');
      expect(battle.hp).toBe(100);
      expect(resolver.rhythmStats.timeoutCount).toBe(1);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(0);
    });
  });
});
