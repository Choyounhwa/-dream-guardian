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
import { UIText } from '../utils/UIText.js';
import type { UIPresentationDocument, UIPresentationPageId } from '../data/UIPresentation.js';
import type { HazardSlotOverride } from '../render/HazardZoneRenderer.js';

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

export interface FeedbackBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  width: number;
  height: number;
  isProtected?: boolean;
}

export interface FeedbackSlotOverride {
  text?: string;
  color?: string;
  textColor?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  glowColor?: string;
  fontSize?: number;
  fontFamily?: string;
  visible?: boolean;
  opacity?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface FeedbackPresentationContext {
  presentationDocument?: UIPresentationDocument;
  pageId?: UIPresentationPageId | string;
  hintBanner?: FeedbackSlotOverride;
  reasonHint?: FeedbackSlotOverride;
  adaptiveBadge?: FeedbackSlotOverride;
  glowEffect?: FeedbackSlotOverride;
  hazardWarning?: HazardSlotOverride;
  hazardStyle?: HazardSlotOverride;
  timingGuide?: HazardSlotOverride;
  safeZoneHighlight?: HazardSlotOverride;
}

export const FEEDBACK_SLOT_IDS = [
  'hintBanner',
  'reasonHint',
  'adaptiveBadge',
  'glowEffect',
] as const;

export const PROTECTED_FEEDBACK_SLOT_IDS = [
  'judgment_threshold',
  'score_evaluation',
  'gate_physics',
  'reserved_answer_band',
] as const;

export interface FeedbackFixtureDTO {
  score?: number;
  glowIntensity?: number;
  reasonKey?: FeedbackReasonKey | null;
  message?: string | null;
  isVisible?: boolean;
  adaptiveRelaxed?: boolean;
  activeZoneId?: 4 | 5 | null;
  presentationContext?: FeedbackPresentationContext;
}

export const DEFAULT_FEEDBACK_FIXTURE: FeedbackFixtureDTO = Object.freeze({
  score: 0.5,
  glowIntensity: 0.7,
  reasonKey: 'extension',
  message: '팔을 더 쭉 뻗어주세요!',
  isVisible: true,
  adaptiveRelaxed: false,
});

export const ADAPTIVE_RELAXED_FEEDBACK_FIXTURE: FeedbackFixtureDTO = Object.freeze({
  score: 0.6,
  glowIntensity: 0.85,
  reasonKey: 'extension',
  message: '자세를 유지하세요!',
  isVisible: true,
  adaptiveRelaxed: true,
});

export const WRONG_ANSWER_FEEDBACK_FIXTURE: FeedbackFixtureDTO = Object.freeze({
  score: 0.2,
  glowIntensity: 0.1,
  reasonKey: 'visibility',
  message: '답안 영역 안으로 손을 뻗으세요!',
  isVisible: true,
  adaptiveRelaxed: false,
});

/**
 * 힌트 메시지 레이아웃 경계 영역 (예약 밴드 침범 방지)
 * @param w 캔버스 너비
 * @param h 캔버스 높이
 */
export function getJudgmentHintBounds(
  w: number,
  h: number,
): FeedbackBounds {
  const scaleX = w / 1080;
  const scaleY = h / 2160;
  const width = 600 * scaleX;
  const height = 80 * scaleY;
  const x = (w - width) / 2;
  // y = 1280 * scaleY (정규화 y ~ 0.5926, 답안 버튼 밴드 하단 0.56 아래 안전 배치)
  const y = 1280 * scaleY;
  return { x, y, width, height, w: width, h: height, isProtected: true };
}

export class JudgmentFeedback {
  private readonly _config: JudgmentFeedbackConfig;
  private readonly _confirmThreshold: number;
  private _presentationContext?: FeedbackPresentationContext;

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
    presentationContext?: FeedbackPresentationContext,
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
    if (presentationContext) {
      this._presentationContext = presentationContext;
    }
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

  getPresentationContext(): FeedbackPresentationContext | undefined {
    return this._presentationContext;
  }

  setPresentationContext(context?: FeedbackPresentationContext): void {
    this._presentationContext = context;
  }

  clearPresentationContext(): void {
    this._presentationContext = undefined;
  }

  getHintBounds(w: number, h: number): FeedbackBounds {
    return getJudgmentHintBounds(w, h);
  }

  isSlotLocked(slotId: string): boolean {
    return (
      (PROTECTED_FEEDBACK_SLOT_IDS as readonly string[]).includes(slotId as any) ||
      slotId.startsWith('judgment_') ||
      slotId.startsWith('gate_')
    );
  }

  getSlotLockReason(slotId: string): string | null {
    if (this.isSlotLocked(slotId)) {
      return `[보호 영역] '${slotId}'는 게임플레이 판정 및 신체 인식 물리 엔진의 무결성을 위해 편집이 잠겨 있습니다.`;
    }
    return null;
  }

  validatePresentationContext(ctx: FeedbackPresentationContext): string[] {
    const issues: string[] = [];
    for (const key of Object.keys(ctx)) {
      if (this.isSlotLocked(key)) {
        issues.push(`보호된 슬롯 '${key}'는 수정할 수 없습니다.`);
      }
    }
    if (ctx.hintBanner) {
      if (
        ctx.hintBanner.x !== undefined ||
        ctx.hintBanner.y !== undefined ||
        ctx.hintBanner.w !== undefined ||
        ctx.hintBanner.h !== undefined
      ) {
        issues.push('hintBanner의 레이아웃 좌표(x, y, w, h)는 예약 밴드 보호를 위해 변경할 수 없습니다.');
      }
    }
    if (ctx.adaptiveBadge) {
      if (
        ctx.adaptiveBadge.x !== undefined ||
        ctx.adaptiveBadge.y !== undefined ||
        ctx.adaptiveBadge.w !== undefined ||
        ctx.adaptiveBadge.h !== undefined
      ) {
        issues.push('adaptiveBadge의 레이아웃 좌표(x, y, w, h)는 예약 밴드 보호를 위해 변경할 수 없습니다.');
      }
    }
    return issues;
  }

  static fromPresentationDocument(
    doc: UIPresentationDocument,
    pageId: UIPresentationPageId | string = 'answer_select',
  ): FeedbackPresentationContext {
    const page = doc.pages[pageId as UIPresentationPageId];
    let hintBanner: FeedbackSlotOverride | undefined;
    let adaptiveBadge: FeedbackSlotOverride | undefined;

    if (page?.elements) {
      for (const el of page.elements) {
        if (el.id === 'feedback_banner' || el.id === 'judgment_hint' || el.id === 'hint_banner') {
          hintBanner = {
            text: el.text,
            fontSize: el.fontSize,
            color: '#FFE082',
          };
        } else if (el.id === 'adaptive_badge' || el.id === 'relaxed_badge') {
          adaptiveBadge = {
            text: el.text,
            fontSize: el.fontSize,
            color: '#4DFFAA',
          };
        }
      }
    }

    return {
      presentationDocument: doc,
      pageId,
      hintBanner,
      adaptiveBadge,
    };
  }

  renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fixture: FeedbackFixtureDTO,
  ): void {
    const prevContext = this._presentationContext;
    if (fixture.presentationContext) {
      this._presentationContext = fixture.presentationContext;
    }
    try {
      const state: JudgmentFeedbackState = {
        glowIntensity: fixture.glowIntensity ?? 0.5,
        reasonKey: fixture.reasonKey ?? null,
        message: fixture.message ?? null,
        isVisible: fixture.isVisible ?? Boolean(fixture.message),
        adaptiveRelaxed: fixture.adaptiveRelaxed ?? false,
        activeZoneId: fixture.activeZoneId ?? null,
      };
      this.render(ctx, w, h, state);
    } finally {
      this._presentationContext = prevContext;
    }
  }

  static renderFixture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fixture: FeedbackFixtureDTO,
  ): void {
    const feedback = new JudgmentFeedback();
    feedback.renderFixture(ctx, w, h, fixture);
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
    contextOverride?: FeedbackPresentationContext,
  ): void {
    if (!this._config.enableFeedback) return;
    if (!state.isVisible && state.glowIntensity <= 0 && !state.adaptiveRelaxed) return;

    const presentation = contextOverride ?? this._presentationContext;
    const bannerOverride = presentation?.hintBanner;
    const badgeOverride = presentation?.adaptiveBadge;

    const scaleX = w / 1080;
    const scaleY = h / 2160;
    const bounds = getJudgmentHintBounds(w, h);

    ctx.save();

    // 1. 힌트 메시지 필(Pill) 배너 렌더링
    if (state.isVisible && state.message && bannerOverride?.visible !== false) {
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const pillW = Math.min(bounds.width, Math.max(320 * scaleX, state.message.length * 36 * scaleX + 60 * scaleX));
      const pillH = 56 * scaleY;
      const pillX = cx - pillW / 2;
      const pillY = cy - pillH / 2;

      // 은은한 네온 반투명 배경
      ctx.fillStyle = bannerOverride?.fillColor ?? 'rgba(18, 24, 46, 0.85)';
      ctx.strokeStyle = bannerOverride?.borderColor ?? (bannerOverride?.color ? bannerOverride.color : 'rgba(255, 203, 77, 0.6)');
      ctx.lineWidth = (bannerOverride?.borderWidth ?? 3) * scaleX;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(pillX, pillY, pillW, pillH, 16 * scaleX);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      // 텍스트 렌더링
      const baseFontSize = bannerOverride?.fontSize ?? 22;
      ctx.font = UIText.getFont('label', scaleX, 'bold', bannerOverride?.fontFamily ?? 'sans-serif', baseFontSize);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bannerOverride?.textColor ?? (bannerOverride?.color ? bannerOverride.color : '#FFE082');
      ctx.shadowColor = bannerOverride?.glowColor ?? 'rgba(255, 224, 130, 0.8)';
      ctx.shadowBlur = 10 * scaleX;
      const displayText = bannerOverride?.text ?? state.message;
      ctx.fillText(displayText, cx, cy);
      ctx.shadowBlur = 0;
    }

    // 2. 적응형 완화(adaptiveRelaxed) 활성화 시 은은한 인디케이터 (최소 26px 하한선)
    if (state.adaptiveRelaxed && badgeOverride?.visible !== false) {
      const cx = bounds.x + bounds.width / 2;
      const badgeY = bounds.y + bounds.height + 14 * scaleY;

      const badgeFontSize = badgeOverride?.fontSize ?? 26;
      ctx.font = UIText.getFont('caption', scaleX, 'bold', badgeOverride?.fontFamily ?? 'sans-serif', badgeFontSize);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = badgeOverride?.textColor ?? badgeOverride?.color ?? 'rgba(77, 255, 170, 0.75)';
      ctx.shadowColor = badgeOverride?.glowColor ?? 'rgba(77, 255, 170, 0.5)';
      ctx.shadowBlur = 8 * scaleX;
      const badgeText = badgeOverride?.text ?? '✦ 관용 완화 활성';
      ctx.fillText(badgeText, cx, badgeY);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
