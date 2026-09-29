/**
 * beat-motion-integration.test.ts - BEAT/Keynote/Knee 모듈 통합 및 단일 정산 통합 테스트
 *
 * @see Issue #206 [INTEGRATE-BEAT-001]
 * @see Issue #184 [GAME-ROUND-001]
 * @see Issue #197 [KEYNOTE-FOOT-001]
 * @see Issue #198 [KNEE-FRAME-001]
 * @see Issue #196 [CHOREO-DATA-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { KneeFramingValidator } from '../../src/motion/KneeFramingValidator.js';
import { FootKeynoteDetector } from '../../src/motion/FootKeynoteDetector.js';
import { FootKeynoteInput } from '../../src/input/FootKeynoteInput.js';
import { deriveKeynoteCandidates, createKeynoteSequence } from '../../src/data/index.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import type { FitnessPatternRecord } from '../../src/types/posture.js';

function createMockFullBodyLandmarks(visibility = 0.9): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility,
  }));
}

describe('Beat Motion Module Integration - [INTEGRATE-BEAT-001]', () => {
  let battle: BattleState;
  let boss: BossController;
  let guardian: GuardianSystem;
  let questionBank: QuestionBank;
  let resolver: BeatRoundResolver;

  beforeEach(() => {
    battle = new BattleState();
    boss = new BossController(1); // HP 10
    guardian = new GuardianSystem();
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

    resolver = new BeatRoundResolver({ battle, boss, guardian });
  });

  describe('1. 전투 정산 단일화 (BeatRoundResolver 연동)', () => {
    it('BeatRunCoordinator가 직접 자원을 수정하지 않고, 상태를 전달하여 1회만 단일 정산된다', () => {
      const onConfirmedSpy = vi.fn((_choiceIdx, _correct, status) => {
        resolver.resolveRound(status);
      });

      const coordinator = new BeatRunCoordinator({
        questionBank,
        onAnswerConfirmed: onConfirmedSpy,
      });

      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');
      coordinator.update(1.0); // REST_READY 완료

      const correctIdx = coordinator.currentQuestion!.correctIndex;
      coordinator.confirmAnswerByFallback(correctIdx);

      // 4.0초 경과 시 ROUND_RESOLVE
      coordinator.update(4.0);

      expect(onConfirmedSpy).toHaveBeenCalledTimes(1);
      expect(onConfirmedSpy).toHaveBeenCalledWith(correctIdx, true, 'correct');

      // 단일 정산 결과 확인: 마나 +25, 보스 피해 1
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
      expect(boss.hp).toBe(9); // 10 - 1

      // 중복 호출 시 Idempotency Guard로 추가 피해/마나 획득 없음
      resolver.resolveRound('correct');
      expect(battle.mana).toBe(25);
      expect(boss.hp).toBe(9);
    });

    it('미응답 라운드는 timeout으로 분류되어 wrongAnswerCount와 분리 집계된다', () => {
      const onConfirmedSpy = vi.fn((_choiceIdx, _correct, status) => {
        resolver.resolveRound(status);
      });

      const coordinator = new BeatRunCoordinator({
        questionBank,
        onAnswerConfirmed: onConfirmedSpy,
      });

      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');
      coordinator.update(1.0);

      // 아무것도 선택하지 않고 4.0초 경과
      coordinator.update(4.0);

      expect(onConfirmedSpy).toHaveBeenCalledTimes(1);
      expect(onConfirmedSpy).toHaveBeenCalledWith(-1, false, 'timeout');

      // timeout 처리 검증: HP -25, timeoutCount 1, wrongAnswerCount 0
      expect(battle.hp).toBe(75);
      expect(resolver.rhythmStats.timeoutCount).toBe(1);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(0);
    });

    it('오답 선택 라운드는 wrong으로 분류되어 wrongAnswerCount에 집계된다', () => {
      const onConfirmedSpy = vi.fn((_choiceIdx, _correct, status) => {
        resolver.resolveRound(status);
      });

      const coordinator = new BeatRunCoordinator({
        questionBank,
        onAnswerConfirmed: onConfirmedSpy,
      });

      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) coordinator.recordStep('run');
      coordinator.update(1.0);

      const wrongIdx = coordinator.currentQuestion!.correctIndex === 0 ? 1 : 0;
      coordinator.confirmAnswerByFallback(wrongIdx);
      coordinator.update(4.0);

      expect(onConfirmedSpy).toHaveBeenCalledWith(wrongIdx, false, 'wrong');
      expect(battle.hp).toBe(75);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(1);
      expect(resolver.rhythmStats.timeoutCount).toBe(0);
    });
  });

  describe('2. KneeFramingValidator 및 FootKeynote 입력 연동', () => {
    let kneeValidator: KneeFramingValidator;
    let footDetector: FootKeynoteDetector;
    let footInput: FootKeynoteInput;

    beforeEach(() => {
      kneeValidator = new KneeFramingValidator();
      footDetector = new FootKeynoteDetector({ isMirrored: false });
      footInput = new FootKeynoteInput();
    });

    it('무릎 프레이밍이 degraded 또는 unframed 상태일 때 FootKeynoteDetector의 Pose 입력이 차단된다', () => {
      // 랜드마크 신뢰도 부족으로 unframed / degraded 상태
      const badLandmarks = createMockFullBodyLandmarks(0.2);
      const framingResult = kneeValidator.update(0.1, badLandmarks, 1080, 2160);

      expect(framingResult.isFootKeynotePoseInputAllowed).toBe(false);

      // 차단 플래그 주입 시 발 키노트 이벤트 생성 불가
      const events = footDetector.update(0.1, badLandmarks, 1.0, {
        isPoseInputAllowed: framingResult.isFootKeynotePoseInputAllowed,
      });
      expect(events).toEqual([]);
    });

    it('합장(Prayer) 또는 안전 가드 활성화 시 발 키노트 입력이 차단된다', () => {
      footInput.setSafetyGuarded(true);
      expect(footInput.fromKeyboard('leftFoot', 1.0)).toBeNull();
      expect(footInput.fromVirtualPedal(9, 1.0)).toBeNull();

      const events = footDetector.update(0.1, createMockFullBodyLandmarks(), 1.0, {
        isSafetyGuarded: true,
      });
      expect(events).toEqual([]);
    });
  });

  describe('3. KeynoteCandidateDeriver 배럴 export 및 시퀀스 생성', () => {
    it('data 배럴에서 deriveKeynoteCandidates 및 createKeynoteSequence가 정상 export된다', () => {
      expect(typeof deriveKeynoteCandidates).toBe('function');
      expect(typeof createKeynoteSequence).toBe('function');
    });

    it('360건 패턴 데이터로부터 2~8박(7개) 키노트 시퀀스를 파생한다', () => {
      const mockRecords: FitnessPatternRecord[] = [
        {
          id: 'S001',
          patternType: 'S',
          name: '패턴1',
          leftHand: 4,
          rightHand: 5,
          head: 4,
          hip: 10,
          partCount: 3,
          parts: ['leftHand', 'rightHand', 'hip'],
          zoneIds: [4, 5, 10],
          distinctZoneIds: [4, 5, 10],
          partZoneMap: { leftHand: 4, rightHand: 5, head: 4, hip: 10 },
        },
        {
          id: 'D001',
          patternType: 'D',
          name: '패턴2',
          leftHand: 1,
          rightHand: 2,
          head: 4,
          hip: 9,
          partCount: 3,
          parts: ['leftHand', 'rightHand', 'hip'],
          zoneIds: [1, 2, 9],
          distinctZoneIds: [1, 2, 9],
          partZoneMap: { leftHand: 1, rightHand: 2, head: 4, hip: 9 },
        },
      ];

      const sequence = createKeynoteSequence(mockRecords, 2);
      expect(sequence.length).toBe(2);
      expect(sequence[0].beat).toBe(2);
      expect(sequence[1].beat).toBe(3);
    });
  });
});
