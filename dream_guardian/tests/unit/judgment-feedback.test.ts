/**
 * judgment-feedback.test.ts
 *
 * [INPUT-TOLERANCE-007 / Issue #255] 부분 진행도 시각화 및 판정 실패 사유 피드백 단위 테스트
 *
 * 10가지 Red 시나리오:
 * 1. score 0.35 / 0.70 입력 시 글로우 강도가 단조 증가하며 서로 다른 값을 낸다.
 * 2. score 0에서 기본 강도(0.0), confirmThreshold(0.70)에서 최대 강도(1.0)가 된다.
 * 3. 뻗음 비율이 최저 게이트일 때 "조금 더 뻗으세요" 키('extension')가 선택된다.
 * 4. 양팔 우세비 미달 시 "한 팔만" 키('dominance')가 선택된다.
 * 5. 가시성이 최저 게이트일 때 "카메라 안으로" 키('visibility')가 선택된다.
 * 6. score 0.20(hintMinScore 미만)에서는 힌트가 표시되지 않는다.
 * 7. 0.6s 이내 게이트 순위가 바뀌어도 메시지가 교체되지 않는다(깜빡임 방지).
 * 8. 판정 결과(확정 여부)가 피드백 유무와 무관하게 동일하다.
 * 9. config 플래그 off 시 기존 렌더와 완전히 동일하다 (강도 0, 힌트 미표시).
 * 10. 힌트 표시가 예약 밴드 영역(문제 텍스트/답안 버튼)을 침범하지 않는다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  JudgmentFeedback,
  getJudgmentHintBounds,
} from '../../src/ui/JudgmentFeedback.js';
import {
  DEFAULT_JUDGMENT_FEEDBACK_CONFIG,
  DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
} from '../../config/judgment.config.js';
import { RESERVED_BANDS } from '../../config/zone.config.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';

describe('JudgmentFeedback - [INPUT-TOLERANCE-007 / #255]', () => {
  let feedback: JudgmentFeedback;

  beforeEach(() => {
    feedback = new JudgmentFeedback();
  });

  describe('시나리오 1 & 2: 글로우 강도 연속 계산 및 단조 증가', () => {
    it('1. score 0.35 / 0.70 입력 시 글로우 강도가 단조 증가하며 서로 다른 값을 낸다', () => {
      const intensityLow = feedback.computeGlowIntensity(0.35);
      const intensityHigh = feedback.computeGlowIntensity(0.70);

      expect(intensityLow).toBeGreaterThan(0);
      expect(intensityHigh).toBeGreaterThan(intensityLow);
      expect(intensityLow).toBeCloseTo(0.5, 2);
      expect(intensityHigh).toBe(1.0);
    });

    it('2. score 0에서 기본 강도, confirmThreshold에서 최대 강도가 된다', () => {
      const intensityZero = feedback.computeGlowIntensity(0);
      const intensityMax = feedback.computeGlowIntensity(DEFAULT_ARM_REACH_JUDGMENT_CONFIG.confirmThreshold);

      expect(intensityZero).toBe(0.0);
      expect(intensityMax).toBe(1.0);

      // confirmThreshold를 초과해도 1.0으로 클램프
      expect(feedback.computeGlowIntensity(0.85)).toBe(1.0);
      expect(feedback.computeGlowIntensity(-0.1)).toBe(0.0);
    });
  });

  describe('시나리오 3, 4, 5: 실패 사유 게이트 매핑', () => {
    it('3. 뻗음 비율이 최저 게이트일 때 "조금 더 뻗으세요" 키가 선택된다', () => {
      const state = feedback.update({
        score: 0.50,
        gates: {
          armExtension: 0.20,
          visibility: 0.80,
          velocity: 0.75,
          zonePenetration: 0.85,
        },
      });

      expect(state.reasonKey).toBe('extension');
      expect(state.message).toBe(DEFAULT_JUDGMENT_FEEDBACK_CONFIG.feedbackMessages.extension);
      expect(state.message).toBe('조금 더 뻗으세요');
      expect(state.isVisible).toBe(true);
    });

    it('4. 양팔 우세비 미달 시 "한 팔만" 키가 선택된다', () => {
      const state = feedback.update({
        score: 0.65,
        isMutualExclusionBlocked: true,
        gates: {
          armExtension: 0.90,
          visibility: 0.90,
          velocity: 0.80,
          zonePenetration: 0.90,
        },
      });

      expect(state.reasonKey).toBe('dominance');
      expect(state.message).toBe(DEFAULT_JUDGMENT_FEEDBACK_CONFIG.feedbackMessages.dominance);
      expect(state.message).toBe('한 팔만');
      expect(state.isVisible).toBe(true);
    });

    it('5. 가시성이 최저 게이트일 때 "카메라 안으로" 키가 선택된다', () => {
      const state = feedback.update({
        score: 0.45,
        gates: {
          armExtension: 0.70,
          visibility: 0.15,
          velocity: 0.60,
          zonePenetration: 0.80,
        },
      });

      expect(state.reasonKey).toBe('visibility');
      expect(state.message).toBe(DEFAULT_JUDGMENT_FEEDBACK_CONFIG.feedbackMessages.visibility);
      expect(state.message).toBe('카메라 안으로');
      expect(state.isVisible).toBe(true);
    });

    it('보조: 속도 최저 시 "조금 더 크게", 침투 깊이 최저 시 "존 안쪽으로"가 선택된다', () => {
      const velState = feedback.update({
        score: 0.45,
        gates: {
          armExtension: 0.80,
          visibility: 0.90,
          velocity: 0.10,
          zonePenetration: 0.80,
        },
      });
      expect(velState.reasonKey).toBe('velocity');
      expect(velState.message).toBe('조금 더 크게');

      feedback.reset();

      const penState = feedback.update({
        score: 0.45,
        gates: {
          armExtension: 0.80,
          visibility: 0.90,
          velocity: 0.80,
          zonePenetration: 0.05,
        },
      });
      expect(penState.reasonKey).toBe('penetration');
      expect(penState.message).toBe('존 안쪽으로');
    });
  });

  describe('시나리오 6: 미시도 상태 힌트 표시 억제', () => {
    it('6. score 0.20(hintMinScore 미만)에서는 힌트가 표시되지 않는다', () => {
      const state = feedback.update({
        score: 0.20,
        gates: {
          armExtension: 0.10,
          visibility: 0.10,
          velocity: 0.10,
          zonePenetration: 0.10,
        },
      });

      expect(state.reasonKey).toBeNull();
      expect(state.message).toBeNull();
      expect(state.isVisible).toBe(false);
      // 글로우 강도는 0.20 / 0.70 으로 연속 계산됨
      expect(state.glowIntensity).toBeCloseTo(0.20 / 0.70, 2);
    });
  });

  describe('시나리오 7: 메시지 깜빡임 방지 (0.6s 홀딩)', () => {
    it('7. 0.6s 이내 게이트 순위가 바뀌어도 메시지가 교체되지 않는다(깜빡임 방지)', () => {
      // t = 0: extension 최저
      const first = feedback.update(
        {
          score: 0.50,
          gates: {
            armExtension: 0.10,
            visibility: 0.80,
            velocity: 0.80,
            zonePenetration: 0.80,
          },
        },
        0,
      );
      expect(first.reasonKey).toBe('extension');
      expect(first.message).toBe('조금 더 뻗으세요');

      // t = 0.3s 경과: visibility가 더 낮아짐
      const second = feedback.update(
        {
          score: 0.50,
          gates: {
            armExtension: 0.70,
            visibility: 0.05,
            velocity: 0.80,
            zonePenetration: 0.80,
          },
        },
        0.3,
      );
      // 0.3s < 0.6s 이므로 메시지 교체되지 않고 유지
      expect(second.reasonKey).toBe('extension');
      expect(second.message).toBe('조금 더 뻗으세요');

      // t = 0.35s 추가 경과 (누적 0.65s >= 0.6s): 이제 교체 허용
      const third = feedback.update(
        {
          score: 0.50,
          gates: {
            armExtension: 0.70,
            visibility: 0.05,
            velocity: 0.80,
            zonePenetration: 0.80,
          },
        },
        0.35,
      );
      expect(third.reasonKey).toBe('visibility');
      expect(third.message).toBe('카메라 안으로');
    });
  });

  describe('시나리오 8: 판정 결과 불변성', () => {
    it('8. 판정 결과(확정 여부)가 피드백 유무와 무관하게 동일하다', () => {
      const selectorA = new ArmReachAnswerSelector();
      const selectorB = new ArmReachAnswerSelector();

      // selectorB의 상태를 피드백에 전달
      const stateB = selectorB.state;
      const feedbackResult = feedback.updateFromAnswerState(stateB, 0);

      // selector의 판정 상태는 변경되지 않아야 함
      expect(selectorA.isConfirmed).toBe(false);
      expect(selectorB.isConfirmed).toBe(false);
      expect(selectorA.confirmedAnswerIndex).toBe(selectorB.confirmedAnswerIndex);
      expect(selectorA.confirmedZoneId).toBe(selectorB.confirmedZoneId);

      // 피드백 객체는 읽기 전용 상태만 생산
      expect(feedbackResult.glowIntensity).toBe(0);
      expect(feedbackResult.isVisible).toBe(false);
    });
  });

  describe('시나리오 9: config 플래그 off 시 렌더 영향 0', () => {
    it('9. config 플래그 off 시 기존 렌더와 완전히 동일하다', () => {
      const disabledFeedback = new JudgmentFeedback({ enableFeedback: false });

      const intensity = disabledFeedback.computeGlowIntensity(0.60);
      expect(intensity).toBe(0);

      const state = disabledFeedback.update({
        score: 0.60,
        gates: {
          armExtension: 0.10,
          visibility: 0.80,
          velocity: 0.80,
          zonePenetration: 0.80,
        },
      });

      expect(state.glowIntensity).toBe(0);
      expect(state.reasonKey).toBeNull();
      expect(state.message).toBeNull();
      expect(state.isVisible).toBe(false);
    });
  });

  describe('시나리오 10: 예약 밴드 영역 침범 금지', () => {
    it('10. 힌트 표시가 예약 밴드 영역(문제 텍스트/답안 버튼)을 침범하지 않는다', () => {
      const w = 1080;
      const h = 2160;

      const bounds = getJudgmentHintBounds(w, h);

      // 정규화 좌표 변환
      const normHint = {
        x: bounds.x / w,
        y: bounds.y / h,
        width: bounds.width / w,
        height: bounds.height / h,
      };

      const qBand = RESERVED_BANDS.question;
      const aBand = RESERVED_BANDS.answer;

      // AABB 충돌 검사 헬퍼
      const isOverlapping = (
        r1: { x: number; y: number; width: number; height: number },
        r2: { x: number; y: number; width: number; height: number },
      ) => {
        return (
          r1.x < r2.x + r2.width &&
          r1.x + r1.width > r2.x &&
          r1.y < r2.y + r2.height &&
          r1.y + r1.height > r2.y
        );
      };

      const overlapQuestion = isOverlapping(normHint, qBand);
      const overlapAnswer = isOverlapping(normHint, aBand);

      expect(overlapQuestion, '문제 텍스트 밴드와 힌트가 겹칩니다').toBe(false);
      expect(overlapAnswer, '답안 버튼 밴드와 힌트가 겹칩니다').toBe(false);

      // Y축이 답안 버튼 밴드(하단 0.56) 아래에 위치함을 검증
      expect(normHint.y).toBeGreaterThanOrEqual(aBand.y + aBand.height);
    });
  });

  describe('PhasePresentationAdapter 연동 검증', () => {
    it('ANSWER_SELECT 페이즈에서만 힌트 및 피드백 상태가 활성화된다', () => {
      const adapter = new PhasePresentationAdapter(undefined, feedback);

      // RUN_QUESTION 상태: 힌트 비활성
      const runFeedback = adapter.getAnswerSelectFeedback('RUN_QUESTION', {
        score: 0.50,
        gates: { armExtension: 0.10, visibility: 0.80, velocity: 0.80, zonePenetration: 0.80 },
      });
      expect(runFeedback.isVisible).toBe(false);
      expect(runFeedback.glowIntensity).toBe(0);

      // ANSWER_SELECT 상태: 정상 활성화
      const answerFeedback = adapter.getAnswerSelectFeedback('ANSWER_SELECT', {
        score: 0.50,
        gates: { armExtension: 0.10, visibility: 0.80, velocity: 0.80, zonePenetration: 0.80 },
      });
      expect(answerFeedback.isVisible).toBe(true);
      expect(answerFeedback.hintMessage).toBe('조금 더 뻗으세요');
      expect(answerFeedback.glowIntensity).toBeGreaterThan(0);
    });

    it('적응형 완화(adaptiveRelaxed) 플래그가 피드백 상태로 정상 전달된다', () => {
      const adapter = new PhasePresentationAdapter(undefined, feedback);

      const relaxedFeedback = adapter.getAnswerSelectFeedback('ANSWER_SELECT', {
        score: 0.50,
        adaptiveRelaxed: true,
        gates: { armExtension: 0.10, visibility: 0.80, velocity: 0.80, zonePenetration: 0.80 },
      });
      expect(relaxedFeedback.adaptiveRelaxed).toBe(true);
    });
  });
});
