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
import { StarCollectionInput } from '../../src/input/StarCollectionInput.js';
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
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }
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
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }
      coordinator.update(1.0);

      // 아무것도 선택하지 않고 4.0초 경과
      coordinator.update(4.0);

      expect(onConfirmedSpy).toHaveBeenCalledTimes(1);
      expect(onConfirmedSpy).toHaveBeenCalledWith(-1, false, 'timeout');

      // Issue #225: timeout 처리 검증 - 직접 피해 0 (HP 100 유지), timeoutCount 1, wrongAnswerCount 0
      expect(battle.hp).toBe(100);
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
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }
      coordinator.update(1.0);

      const wrongIdx = coordinator.currentQuestion!.correctIndex === 0 ? 1 : 0;
      coordinator.confirmAnswerByFallback(wrongIdx);
      coordinator.update(4.0);

      expect(onConfirmedSpy).toHaveBeenCalledWith(wrongIdx, false, 'wrong');
      // Issue #225: 오답 직접 피해 0 (HP 100 유지), wrongAnswerCount 1, timeoutCount 0
      expect(battle.hp).toBe(100);
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

    it('가상 페달(Zone 9, 10, 11) 입력이 정상적으로 FootKeynoteEvent를 생성한다', () => {
      const ev9 = footInput.fromVirtualPedal(9, 1.5);
      expect(ev9).toEqual(expect.objectContaining({
        foot: 'leftFoot',
        zoneId: 9,
        source: 'virtual',
        timestamp: 1.5,
      }));

      const ev10 = footInput.fromVirtualPedal(10, 1.6);
      expect(ev10).toEqual(expect.objectContaining({
        foot: 'centerFoot',
        zoneId: 10,
        source: 'virtual',
        timestamp: 1.6,
      }));

      const ev11 = footInput.fromVirtualPedal(11, 1.7);
      expect(ev11).toEqual(expect.objectContaining({
        foot: 'rightFoot',
        zoneId: 11,
        source: 'virtual',
        timestamp: 1.7,
      }));
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

  describe('4. StarCollectionInput과 BeatRoundResolver 연동 (2~8박 키노트 판정)', () => {
    it('별 수집 판정 결과(Perfect/Good/Late/Miss)가 BeatRoundResolver에 기록되며 전투 자원에 영향이 없다', () => {
      const starInput = new StarCollectionInput();
      starInput.setTarget({
        patternId: 'S001',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 2,
        landingTime: 2.0,
      });

      // Perfect 판정 (정규화 좌표)
      const result = starInput.evaluateCursor('leftHand', { x: 0.17, y: 0.32 }, 2.05);
      expect(result).not.toBeNull();
      expect(result!.rating).toBe('Perfect');
      expect(result!.hasBattlePenalty).toBe(false);

      resolver.recordStarRating(result!.rating);
      expect(resolver.rhythmStats.perfectHits).toBe(1);
      expect(resolver.rhythmStats.beatStarsCollected).toBe(1);

      // 전투 자원(HP, 마나, 보스 HP) 불변 검증
      expect(battle.hp).toBe(100);
      expect(battle.mana).toBe(0);
      expect(boss.hp).toBe(10);
    });
  });
});
