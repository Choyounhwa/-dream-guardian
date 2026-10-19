/**
 * assault-recovery-reading.test.ts
 *
 * [BOSS-ASSAULT-REC-05 / #594] 읽기 시간 입력·소비 계약 복구 단위 테스트
 *
 * 검증 목표:
 * 1. question.minReadSeconds와 상한 있는 추정 TTS 시간이 실제 생각 구간(readingDurationSeconds)에 누적 반영된다.
 * 2. readable 이후 최소 8개의 완전 활성박(minRoundBeats)을 보장하고, 필요시간 이상인 다음 박자 경계(Beat Boundary)에 올림 정렬된다.
 * 3. throwDurationSeconds는 읽기 시간에 포함되지 않고 온전히 분리된다 (readingEndTime = throwDuration + readingDuration).
 * 4. TTS는 최초 update 시 단 1회 비대기(Non-waiting)로 요청되며, 낭독 실패/지연/비활성에도 정해진 시간에 유한하게 진행된다.
 * 5. pause 및 활성시간 동결 시 읽기 시간이 소급 완료되지 않는다.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AssaultRoundController,
  type AssaultRoundQuestionData,
} from '../../src/game/assault/AssaultRoundController.js';
import {
  compileAssaultPlan,
  type AssaultCompiledPlan,
} from '../../src/game/assault/AssaultPlanCompiler.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';

describe('[BOSS-ASSAULT-REC-05 / #594] Reading Time Input & Consumption Contract', () => {
  const dummyPlan: AssaultCompiledPlan = compileAssaultPlan(DEFAULT_APPROACH_PATTERN, { bpm: 120 });

  describe('1. minReadSeconds 및 추정 TTS 시간 누적 반영', () => {
    it('question.minReadSeconds와 추정 TTS 시간이 readingDurationSeconds에 반영되어야 한다', () => {
      // 120 BPM -> 1박 = 0.5초. 8박 = 4.0초.
      // question text 20글자 -> 추정 TTS = min(20 * 0.15 = 3.0s, 3.0s) = 3.0초
      // minReadSeconds = 5.0초
      // totalRequired = 5.0 + 3.0 = 8.0초
      // beatsNeeded = ceil(8.0 / 0.5) = 16박 -> 8.0초
      const question: AssaultRoundQuestionData = {
        id: 'q_long_1',
        text: '12345678901234567890', // 20자
        minReadSeconds: 5.0,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: dummyPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // 기존 로직은 minReadSeconds와 TTS를 무시하여 기본 4.0초(8박)만 산출했음
      // 복구된 로직은 8.0초(16박)를 산출해야 함
      expect(controller.readingDurationSeconds).toBe(8.0);
      expect(controller.readingEndTime).toBe(9.0); // throwDuration(1.0) + readingDuration(8.0)
    });

    it('TTS 추정 시간은 ttsMaxSeconds(기본 3.0초)로 상한 클램프되어야 한다', () => {
      // 100글자 -> 100 * 0.15 = 15.0초 -> 클램프 상한 3.0초
      // minReadSeconds = 4.0초
      // totalRequired = 4.0 + 3.0 = 7.0초
      // 120 BPM (0.5s/beat) -> 7.0 / 0.5 = 14박 -> 7.0초
      const question: AssaultRoundQuestionData = {
        id: 'q_huge',
        text: 'A'.repeat(100),
        minReadSeconds: 4.0,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: dummyPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      expect(controller.readingDurationSeconds).toBe(7.0);
    });
  });

  describe('2. 최소 8박(minRoundBeats) 보장 및 박자 경계(Beat Boundary) 올림 정렬', () => {
    it('요구 시간이 8박 미만이더라도 최소 8개의 완전 활성박을 보장해야 한다', () => {
      // 120 BPM -> 1박 = 0.5초. 8박 = 4.0초
      // 짧은 문항: minReadSeconds = 2.0s, TTS = 0.5s -> totalRequired = 2.5s (5박)
      // 최소 8박 보장에 의해 readingDurationSeconds = 4.0초(8박)여야 함
      const question: AssaultRoundQuestionData = {
        id: 'q_short',
        text: '1 + 2 = ?',
        minReadSeconds: 2.0,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: dummyPlan,
        bpm: 120,
        config: {
          minRoundBeats: 8,
          readingCharRateMs: 50, // 작은 TTS 가산
        } as any,
        throwDurationSeconds: 1.0,
      });

      expect(controller.readingDurationSeconds).toBe(4.0);
      expect(controller.readingDurationSeconds / (60 / 120)).toBe(8); // 정확히 8박
    });

    it('요구 시간이 박자 사이에 걸치면 다음 박자 경계로 올림(Math.ceil) 정렬되어야 한다', () => {
      // 100 BPM -> 1박 = 0.6초. 8박 = 4.8초
      // totalRequired = 5.0초
      // 5.0 / 0.6 = 8.333... 박 -> 올림 정렬 9박 -> 9 * 0.6 = 5.4초
      const question: AssaultRoundQuestionData = {
        id: 'q_fractional',
        text: '3 * 4 = ?',
        minReadSeconds: 5.0,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: dummyPlan,
        bpm: 100,
        config: {
          readingCharRateMs: 0, // TTS 0초로 고정하여 minReadSeconds만 테스트
        } as any,
        throwDurationSeconds: 0.5,
      });

      expect(controller.readingDurationSeconds).toBeCloseTo(5.4, 2);
      expect(controller.readingEndTime).toBeCloseTo(5.9, 2); // 0.5 + 5.4
    });
  });

  describe('3. 투척 시간(throwDurationSeconds) 제외 및 타임라인 경계', () => {
    it('throwDurationSeconds는 읽기 생각 시간에 포함되지 않아야 한다', () => {
      const question: AssaultRoundQuestionData = {
        id: 'q_throw',
        text: '5 + 5 = ?',
        minReadSeconds: 4.0,
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: dummyPlan,
        bpm: 120,
        throwDurationSeconds: 2.0, // 긴 투척 시간
      });

      // readingDuration은 순수 읽기 시간이므로 throwDuration과 독립적이어야 함
      expect(controller.throwDurationSeconds).toBe(2.0);
      expect(controller.readingEndTime).toBe(2.0 + controller.readingDurationSeconds);
    });

    it('투척 구간 동안에는 readingProgress가 0이어야 하고 투척 완료 시점에 readable이 발행되어야 한다', () => {
      const question: AssaultRoundQuestionData = {
        id: 'q_throw_prog',
        text: '5 + 5 = ?',
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: dummyPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // t = 0.5초: 투척 중
      controller.update(0.5);
      expect(controller.phase).toBe('throw_in');
      expect(controller.readingProgress).toBe(0.0);

      // t = 1.0초: 투척 완료 직후 readable
      controller.update(1.0);
      expect(controller.phase).toBe('question_reading');
      expect(controller.readingProgress).toBe(0.0);

      // t = 1.0초 + 절반 진행
      const halfReading = 1.0 + controller.readingDurationSeconds / 2;
      controller.update(halfReading);
      expect(controller.readingProgress).toBeCloseTo(0.5, 2);
    });
  });

  describe('4. TTS 비대기(Non-waiting) 1회 요청', () => {
    it('TTS는 최초 update 시 정확히 1회만 호출되어야 하며 대기 없이 시간이 진행되어야 한다', () => {
      const onTtsSpeak = vi.fn();
      const question: AssaultRoundQuestionData = {
        id: 'q_tts',
        text: '7 - 2 = ?',
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: dummyPlan,
        bpm: 120,
        onTtsSpeak,
      });

      // 여러 번 업데이트
      controller.update(0.1);
      controller.update(0.2);
      controller.update(0.5);

      // 정확히 1회만 호출
      expect(onTtsSpeak).toHaveBeenCalledTimes(1);
      expect(onTtsSpeak).toHaveBeenCalledWith('7 - 2 = ?');
    });
  });

  describe('5. 일시정지 중 시간 동결 및 소급 완료 방지', () => {
    it('pause() 상태에서는 update가 호출되어도 readingProgress가 멈추고 조기 완료되지 않아야 한다', () => {
      const question: AssaultRoundQuestionData = {
        id: 'q_pause',
        text: '4 + 4 = ?',
      };

      const controller = new AssaultRoundController({
        sessionId: 'sess_1',
        roundId: 'round_1',
        question,
        plan: dummyPlan,
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      controller.update(1.0); // readable 진입
      controller.update(2.0); // 1초 경과
      const progressBeforePause = controller.readingProgress;
      expect(progressBeforePause).toBeGreaterThan(0);

      // 일시정지
      controller.pause('user_pause');
      expect(controller.isPaused).toBe(true);

      // 일시정지 중 시간 전진 시도
      controller.update(5.0);
      expect(controller.readingProgress).toBe(progressBeforePause); // 진행률 불변
      expect(controller.phase).toBe('question_reading'); // 조기 완료되지 않음

      // 재개 후 시간 진행
      controller.resume();
      expect(controller.isPaused).toBe(false);
    });
  });
});
