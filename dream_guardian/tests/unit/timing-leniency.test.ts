import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMING_LENIENCY_CONFIG,
  type TimingLeniencyConfig,
} from '../../config/judgment.config.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { judgeStarTiming } from '../../src/input/StarCollectionInput.js';
import { AnswerSelector } from '../../src/input/AnswerSelector.js';
import { DEFAULT_STAR_TIMING_WINDOWS } from '../../config/beat-motion.config.js';

describe('Timing Leniency Layer - Issue #251 [INPUT-TOLERANCE-003]', () => {
  describe('1. 장판 회피 선행 입력 버퍼 (Pre-input Buffer)', () => {
    it('창 열리기 0.15s 전 입력이 버퍼에 저장되고 창 개시 시점에 성공으로 소비된다', () => {
      const controller = new PhaseAHazardController({
        pattern: ['jump'],
        warningDuration: 2.6,
        inputWindowEnd: 3.4,
        judgmentTime: 3.5,
      });
      controller.start('jump');

      // 2.45s 시점 (창 개시 2.60s 기준 0.15s 전)
      controller.update(2.45);
      controller.recordAction('jump');

      // 창 개시 전에는 아직 회피 잠금되지 않음 (버퍼 대기)
      expect(controller.isEvaded).toBe(false);

      // 2.60s로 진행하여 창 개시
      controller.update(0.15); // elapsed = 2.60s
      expect(controller.isEvaded).toBe(true);

      // 3.5s 판정 시 데미지 0
      controller.update(0.90);
      expect(controller.isResolved).toBe(true);
    });

    it('창 열리기 0.30s 전(버퍼 윈도 0.20s 초과) 입력은 버려진다', () => {
      const controller = new PhaseAHazardController({
        pattern: ['jump'],
        warningDuration: 2.6,
        inputWindowEnd: 3.4,
        judgmentTime: 3.5,
      });
      controller.start('jump');

      // 2.30s 시점 (창 개시 2.60s 기준 0.30s 전, 버퍼 0.20s 초과)
      controller.update(2.30);
      controller.recordAction('jump');

      // 2.60s로 진행
      controller.update(0.30);
      expect(controller.isEvaded).toBe(false);

      // 3.5s 판정 시 피격
      controller.update(0.90);
      expect(controller.isResolved).toBe(true);
      expect(controller.isEvaded).toBe(false);
    });

    it('버퍼 소비는 1회만 발생하고 동일 입력이 중복 판정되지 않는다', () => {
      const controller = new PhaseAHazardController({
        pattern: ['jump'],
        warningDuration: 2.6,
        inputWindowEnd: 3.4,
        judgmentTime: 3.5,
      });
      controller.start('jump');

      controller.update(2.45);
      controller.recordAction('jump');

      // 2.60s 창 개시 시점에 소비 완료
      controller.update(0.15);
      expect(controller.isEvaded).toBe(true);

      // 정산 후 새 라운드 시작 시 이전 버퍼 잔류 0 확인
      controller.stop();
      controller.start('jump');
      controller.update(2.70); // 창 내부이지만 새 라운드이므로 이전 입력 영향 없어야 함
      expect(controller.isEvaded).toBe(false);
    });
  });

  describe('2. 별가루 수집 후행 유예 (Coyote Time)', () => {
    it('창 종료 후 0.10s 시점 별 입력이 Good→Late로 강등되어 인정된다', () => {
      const windows = DEFAULT_STAR_TIMING_WINDOWS; // perfect 0.12, good 0.25, late 0.40
      const landingTime = 1.0;

      // Late 창(0.40s) 종료 후 0.10s (time = 1.50s, diff = 0.50s)
      // postGraceWindow = 0.15s 이내이므로 Miss 대신 Late로 인정
      const rating = judgeStarTiming(1.50, landingTime, windows, DEFAULT_TIMING_LENIENCY_CONFIG);
      expect(rating).toBe('Late');
    });

    it('창 종료 후 0.20s(유예 0.15s 초과) 입력은 Miss다', () => {
      const windows = DEFAULT_STAR_TIMING_WINDOWS;
      const landingTime = 1.0;

      // Late 창(0.40s) 종료 후 0.20s (time = 1.60s, diff = 0.60s)
      const rating = judgeStarTiming(1.60, landingTime, windows, DEFAULT_TIMING_LENIENCY_CONFIG);
      expect(rating).toBe('Miss');
    });
  });

  describe('3. 장판 회피 후행 유예 (Coyote Time)', () => {
    it('장판 inputWindowEnd 3.4 직후 0.10s 회피가 viaGrace: true로 성공 처리되고 데미지 0이다', () => {
      let resolvedResult: any = null;
      const controller = new PhaseAHazardController(
        {
          pattern: ['jump'],
          warningDuration: 2.6,
          inputWindowEnd: 3.4,
          judgmentTime: 3.5,
          damagePerMiss: 25,
        },
        (res) => {
          resolvedResult = res;
        }
      );
      controller.start('jump');

      // inputWindowEnd(3.40s) 직후 0.05s인 3.45s에 회피 입력 (postGrace 0.15s 이내)
      controller.update(3.45);
      controller.recordAction('jump');

      expect(controller.isEvaded).toBe(true);
      expect(controller.viaGrace).toBe(true);

      // 3.50s 판정 정산
      controller.update(0.05);
      expect(controller.isResolved).toBe(true);
      expect(resolvedResult).not.toBeNull();
      expect(resolvedResult.evaded).toBe(true);
      expect(resolvedResult.damage).toBe(0);
      expect(resolvedResult.viaGrace).toBe(true);
    });

    it('장판 정산이 유예 인정 케이스에서도 1회만 실행된다', () => {
      let resolveCount = 0;
      const controller = new PhaseAHazardController(
        {
          pattern: ['jump'],
          warningDuration: 2.6,
          inputWindowEnd: 3.4,
          judgmentTime: 3.5,
        },
        () => {
          resolveCount++;
        }
      );
      controller.start('jump');
      controller.update(3.45);
      controller.recordAction('jump');

      // 판정 시간 경과
      controller.update(0.10);
      controller.update(0.10);
      controller.update(0.10);

      expect(resolveCount).toBe(1);
    });
  });

  describe('4. 답안 체류 진행도 홀드 (Decay Hold) 및 추적 유실 동결', () => {
    function createLandmarks(pos: { x: number; y: number; visibility?: number }) {
      const lms = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
      lms[15] = { x: pos.x, y: pos.y, visibility: pos.visibility ?? 0.9 };
      return lms;
    }

    it('존 이탈 후 0.10s 내 재진입 시 진행도가 감쇠 없이 이어진다', () => {
      const selector = new AnswerSelector();
      selector.startQuestion(1);

      // 1) Zone 4 진입하여 진행도 누적 (진행도 쌓기: 0.20s로 약 0.42 누적)
      const inZone4Lm = createLandmarks({ x: 0.17, y: 0.32, visibility: 0.9 }); // Zone 4 중심
      selector.updateFromPose(inZone4Lm as any, undefined, 0.20);
      const progressBeforeExit = selector.choiceProgress[0];
      expect(progressBeforeExit).toBeGreaterThan(0.2);

      // 2) Zone 4 이탈 (어느 존에도 없음) 0.10s 동안 유지 (decayHoldTime 0.15s 이내)
      const outsideLm = createLandmarks({ x: 0.50, y: 0.50, visibility: 0.9 });
      selector.updateFromPose(outsideLm as any, undefined, 0.10);

      // 홀드 타임 중이므로 감쇠 없이 진행도가 유지되어야 함
      expect(selector.choiceProgress[0]).toBeCloseTo(progressBeforeExit, 3);

      // 3) 다시 Zone 4 재진입하여 누적 (0.10s 추가 -> 약 0.63으로 증가)
      selector.updateFromPose(inZone4Lm as any, undefined, 0.10);
      expect(selector.choiceProgress[0]).toBeGreaterThan(progressBeforeExit);
    });

    it('존 이탈 0.20s 경과 후에는 정상 감쇠한다', () => {
      const selector = new AnswerSelector();
      selector.startQuestion(1);

      // 1) Zone 4 진입
      const inZone4Lm = createLandmarks({ x: 0.17, y: 0.32, visibility: 0.9 });
      selector.updateFromPose(inZone4Lm as any, undefined, 0.20);
      const progressBeforeExit = selector.choiceProgress[0];

      // 2) Zone 4 이탈 후 0.25s 경과 (decayHoldTime 0.15s 초과 -> 0.10s 동안 감쇠)
      const outsideLm = createLandmarks({ x: 0.50, y: 0.50, visibility: 0.9 });
      selector.updateFromPose(outsideLm as any, undefined, 0.25);

      // 홀드 시간이 지났으므로 진행도가 감쇠되어야 함
      expect(selector.choiceProgress[0]).toBeLessThan(progressBeforeExit);
    });

    it('추적 유실 상태 0.5s 동안 진행도가 감소하지 않는다', () => {
      const selector = new AnswerSelector();
      selector.startQuestion(1);

      // 1) Zone 4 진입하여 진행도 누적
      const inZone4Lm = createLandmarks({ x: 0.17, y: 0.32, visibility: 0.9 });
      selector.updateFromPose(inZone4Lm as any, undefined, 0.20);
      const progressBeforeLoss = selector.choiceProgress[0];
      expect(progressBeforeLoss).toBeGreaterThan(0.2);

      // 2) 카메라 랜드마크 유실 (visibility < 0.5) 0.5초 경과
      const lostLm = createLandmarks({ x: 0.17, y: 0.32, visibility: 0.1 });
      selector.updateFromPose(lostLm as any, undefined, 0.50);

      // 추적 유실 동결로 인해 진행도가 감소하지 않음
      expect(selector.choiceProgress[0]).toBe(progressBeforeLoss);
    });
  });

  describe('5. Config 플래그 개별 On/Off 하위 호환', () => {
    it('config 플래그 off 시 기존 동작과 완전히 동일하다', () => {
      const disabledConfig: TimingLeniencyConfig = {
        preBufferWindow: 0.20,
        postGraceWindow: 0.15,
        decayHoldTime: 0.15,
        enablePreBuffer: false,
        enablePostGrace: false,
        enableDecayHold: false,
        enableTrackingLossFreeze: false,
      };

      // 별 판정: postGrace 비활성화 시 lateWindow + 0.10s는 Miss
      const rating = judgeStarTiming(1.50, 1.0, DEFAULT_STAR_TIMING_WINDOWS, disabledConfig);
      expect(rating).toBe('Miss');
    });
  });
});
