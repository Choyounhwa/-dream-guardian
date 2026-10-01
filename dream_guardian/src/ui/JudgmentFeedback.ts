/**
 * JudgmentFeedback.ts - 부분 진행도 시각화 및 판정 실패 사유 피드백 매니저
 *
 * Issue #255 [INPUT-TOLERANCE-007]:
 * - ArmReachAnswerSelector의 연속 점수(score) 및 세부 게이트 점수를 시각 피드백으로 전달
 * - confirmThreshold(0.70) 대비 부분 진행도 글로우 강도(0..1) 연속 계산
 * - 미확정 실패 시 최저 게이트("조금 더 뻗으세요", "카메라 안으로" 등) 또는 양팔 경합("한 팔만") 매핑
 * - hintMinInterval(0.6s) 기반 메시지 홀딩으로 깜빡임 방지
 * - hintMinScore(0.30) 미만 완전 미시도 상태 힌트 표시 억제
 * - 006 적응형 완화(adaptiveRelaxed) 활성화 상태 은은한 표식 전달
 * - 문제 텍스트 및 답안 버튼 전용 예약 밴드(RESERVED_BANDS) 겹침 0% 보장
 */

import {
  DEFAULT_JUDGMENT_FEEDBACK_CONFIG,
  DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
  type JudgmentFeedbackConfig,
  type JudgmentFeedbackMessages,
  type ArmReachGateScores,
} from '../../config/judgment.config.js';
import type { ArmReachAnswerState } from '../input/ArmReachAnswerSelector.js';

export type FeedbackReasonKey = keyof JudgmentFeedbackMessages;

export interface JudgmentFeedbackInput {
  score: number;
  gates?: Partial<ArmReachGateScores> | null;
  isMutualExclusionBlocked?: boolean;
  isConfirmed?: boolean;
  adaptiveRelaxed?: boolean;
  activeZoneId?: 4 | 5 | null;
}

export interface JudgmentFeedbackState {
  glowIntensity: number;
  reasonKey: FeedbackReasonKey | null;
  message: string | null;
  isVisible: boolean;
  adaptiveRelaxed: boolean;
  activeZoneId?: 4 | 5 | null;
}

/**
 * 힌트 메시지 레이아웃 경계 영역 (예약 밴드 침범 방지)
 * @param w 캔버스 너비
 * @param h 캔버스 높이
 */
export function getJudgmentHintBounds(
  w: number,
  h: number,
): { x: number; y: number; width: number; height: number } {
  const scaleX = w / 1080;
  const scaleY = h / 2160;
  const width = 600 * scaleX;
  const height = 80 * scaleY;
  const x = (w - width) / 2;
  // y = 1280 * scaleY (정규화 y ~ 0.5926, 답안 버튼 밴드 하단 0.56 아래 안전 배치)
  const y = 1280 * scaleY;
  return { x, y, width, height };
}

export class JudgmentFeedback {
  private readonly _config: JudgmentFeedbackConfig;
  private readonly _confirmThreshold: number;

  private _currentKey: FeedbackReasonKey | null = null;
  private _timeSinceLastSwitch = 0;
  private _lastState: JudgmentFeedbackState = {
    glowIntensity: 0,
    reasonKey: null,
    message: null,
    isVisible: false,
    adaptiveRelaxed: false,
  };

  constructor(
    config?: Partial<JudgmentFeedbackConfig>,
    confirmThreshold = DEFAULT_ARM_REACH_JUDGMENT_CONFIG.confirmThreshold,
  ) {
    this._config = {
      ...DEFAULT_JUDGMENT_FEEDBACK_CONFIG,
      ...config,
      feedbackMessages: {
        ...DEFAULT_JUDGMENT_FEEDBACK_CONFIG.feedbackMessages,
        ...config?.feedbackMessages,
      },
    };
    this._confirmThreshold = confirmThreshold;
  }

  get config(): JudgmentFeedbackConfig {
    return this._config;
  }

  get confirmThreshold(): number {
    return this._confirmThreshold;
  }

  get lastState(): JudgmentFeedbackState {
    return this._lastState;
  }

  /**
   * 0..1 범위의 연속 글로우 강도 계산
   * score 0에서 0.0, confirmThreshold 도달 시 1.0으로 단조 증가
   */
  computeGlowIntensity(score: number): number {
    if (!this._config.enableFeedback) return 0;
    if (this._confirmThreshold <= 0) return 0;

    const clamped = Math.max(0, Math.min(score, this._confirmThreshold));
    return clamped / this._confirmThreshold;
  }

  /**
   * 상태 리셋 (새 라운드/문제 진입 시 호출)
   */
  reset(): void {
    this._currentKey = null;
    this._timeSinceLastSwitch = 0;
    this._lastState = {
      glowIntensity: 0,
      reasonKey: null,
      message: null,
      isVisible: false,
      adaptiveRelaxed: false,
    };
  }

  /**
   * 원시 판정 입력으로부터 최저 게이트/상호배제 사유 키 도출
   */
  private _determineRawKey(input: JudgmentFeedbackInput): FeedbackReasonKey | null {
    if (input.isMutualExclusionBlocked) {
      return 'dominance';
    }

    if (!input.gates) {
      return null;
    }

    const gates = input.gates;
    const candidates: Array<{ key: FeedbackReasonKey; score: number }> = [
      { key: 'extension', score: gates.armExtension ?? Number.POSITIVE_INFINITY },
      { key: 'visibility', score: gates.visibility ?? Number.POSITIVE_INFINITY },
      { key: 'velocity', score: gates.velocity ?? Number.POSITIVE_INFINITY },
      { key: 'penetration', score: gates.zonePenetration ?? Number.POSITIVE_INFINITY },
    ];

    let lowest = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].score < lowest.score) {
        lowest = candidates[i];
      }
    }

    if (!Number.isFinite(lowest.score)) {
      return null;
    }

    return lowest.key;
  }

  /**
   * 프레임 갱신 및 힌트 홀딩/글로우 산출
   */
  update(input: JudgmentFeedbackInput, dt = 0): JudgmentFeedbackState {
    const glowIntensity = this.computeGlowIntensity(input.score);
    const adaptiveRelaxed = input.adaptiveRelaxed ?? false;
    const activeZoneId = input.activeZoneId ?? null;

    if (!this._config.enableFeedback) {
      this.reset();
      this._lastState = {
        glowIntensity: 0,
        reasonKey: null,
        message: null,
        isVisible: false,
        adaptiveRelaxed: false,
        activeZoneId: null,
      };
      return this._lastState;
    }

    // 답안 확정되었거나 점수가 임계치 이상이면 실패 힌트 미표시
    if (input.isConfirmed || input.score >= this._confirmThreshold) {
      this.reset();
      this._lastState = {
        glowIntensity,
        reasonKey: null,
        message: null,
        isVisible: false,
        adaptiveRelaxed,
        activeZoneId,
      };
      return this._lastState;
    }

    // 점수가 최소 힌트 점수 미만인 완전 미시도 상태에서는 힌트 억제
    if (input.score < this._config.hintMinScore) {
      this.reset();
      this._lastState = {
        glowIntensity,
        reasonKey: null,
        message: null,
        isVisible: false,
        adaptiveRelaxed,
        activeZoneId,
      };
      return this._lastState;
    }

    const rawKey = this._determineRawKey(input);
    if (!rawKey) {
      this.reset();
      this._lastState = {
        glowIntensity,
        reasonKey: null,
        message: null,
        isVisible: false,
        adaptiveRelaxed,
        activeZoneId,
      };
      return this._lastState;
    }

    // 메시지 깜빡임 방지 (hintMinInterval 홀딩 로직)
    this._timeSinceLastSwitch += dt;

    if (this._currentKey === null) {
      this._currentKey = rawKey;
      this._timeSinceLastSwitch = 0;
    } else if (this._currentKey !== rawKey) {
      if (this._timeSinceLastSwitch >= this._config.hintMinInterval) {
        this._currentKey = rawKey;
        this._timeSinceLastSwitch = 0;
      }
    }

    const message = this._currentKey
      ? this._config.feedbackMessages[this._currentKey]
      : null;

    this._lastState = {
      glowIntensity,
      reasonKey: this._currentKey,
      message,
      isVisible: message !== null,
      adaptiveRelaxed,
      activeZoneId,
    };

    return this._lastState;
  }

  /**
   * ArmReachAnswerState로부터 직접 피드백 산출 헬퍼
   */
  updateFromAnswerState(
    state: ArmReachAnswerState,
    dt = 0,
    adaptiveRelaxed = false,
  ): JudgmentFeedbackState {
    const leftScore = state.leftHand.score ?? 0;
    const rightScore = state.rightHand.score ?? 0;
    const bestHand = leftScore >= rightScore ? state.leftHand : state.rightHand;

    const input: JudgmentFeedbackInput = {
      score: bestHand.score ?? 0,
      gates: bestHand.gates,
      isMutualExclusionBlocked: state.isMutualExclusionBlocked,
      isConfirmed: state.isConfirmed,
      adaptiveRelaxed,
      activeZoneId: state.activeZoneId,
    };

    return this.update(input, dt);
  }

  /**
   * 힌트 메시지 및 부분 진행도 시각 피드백 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: JudgmentFeedbackState = this._lastState,
  ): void {
    if (!this._config.enableFeedback) return;
    if (!state.isVisible && state.glowIntensity <= 0 && !state.adaptiveRelaxed) return;

    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const bounds = getJudgmentHintBounds(w, h);

    ctx.save();

    // 1. 힌트 메시지 필(Pill) 배너 렌더링
    if (state.isVisible && state.message) {
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const pillW = Math.min(bounds.width, Math.max(320 * scaleX, state.message.length * 36 * scaleX + 60 * scaleX));
      const pillH = 56 * scaleY;
      const pillX = cx - pillW / 2;
      const pillY = cy - pillH / 2;

      // 은은한 네온 반투명 배경
      ctx.fillStyle = 'rgba(18, 24, 46, 0.85)';
      ctx.strokeStyle = 'rgba(255, 203, 77, 0.6)';
      ctx.lineWidth = 3 * scaleX;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pillX, pillY, pillW, pillH, 16 * scaleX);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      // 텍스트 렌더링
      ctx.font = `bold ${Math.round(26 * scaleX)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFE082';
      ctx.shadowColor = 'rgba(255, 224, 130, 0.8)';
      ctx.shadowBlur = 10 * scaleX;
      ctx.fillText(state.message, cx, cy);
      ctx.shadowBlur = 0;
    }

    // 2. 적응형 완화(adaptiveRelaxed) 활성화 시 은은한 인디케이터
    if (state.adaptiveRelaxed) {
      const cx = bounds.x + bounds.width / 2;
      const badgeY = bounds.y + bounds.height + 14 * scaleY;

      ctx.font = `bold ${Math.round(18 * scaleX)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(77, 255, 170, 0.75)';
      ctx.shadowColor = 'rgba(77, 255, 170, 0.5)';
      ctx.shadowBlur = 8 * scaleX;
      ctx.fillText('✦ 관용 완화 활성', cx, badgeY);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
