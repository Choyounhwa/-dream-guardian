/**
 * PhasePresentationAdapter.ts - 페이즈별 화면 표시 및 렌더 허용 제어 어댑터
 *
 * Issue #232 (BUG-PHASE-PRESENTATION-001):
 * - GameState 기반 상태별 렌더 허용표(Render Allow Matrix) 적용
 * - 러닝 HUD, 답안 버튼(QuestionRenderer), 별모으기(StarNoteRenderer), 회피 화면의 상태별 명확한 분리
 * - 답 선택 즉시 시각 피드백과 지연 정산의 분리
 * - questionVisible 등 UI 플래그에 의존하지 않는 안전한 입력/렌더 판정 제공
 */

import type { GameState } from '../types/index.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import { HazardZoneRenderer } from '../render/HazardZoneRenderer.js';
import {
  JudgmentFeedback,
  type JudgmentFeedbackInput,
  type FeedbackReasonKey,
} from './JudgmentFeedback.js';
import type { ArmReachAnswerState } from '../input/ArmReachAnswerSelector.js';
import { UIText } from '../utils/UIText.js';

export interface HazardEvadePresentationState {
  activePattern: PhaseAHazardPattern | null;
  beatProgress: number; // 0.0 ~ 1.0
  vanishingX: number;
  vanishingY: number;
  isEvaded?: boolean;
  isResolved?: boolean;
  performedAction?: PhaseAHazardPattern | null;
  isActionDetected?: boolean;
  isCurrentlySafe?: boolean;
}

export interface AnswerSelectFeedbackState {
  glowIntensity: number;
  hintMessage: string | null;
  reasonKey: FeedbackReasonKey | null;
  isVisible: boolean;
  adaptiveRelaxed: boolean;
  activeZoneId?: 4 | 5 | null;
}

export class PhasePresentationAdapter {
  private readonly _hazardZoneRenderer: HazardZoneRenderer;
  private readonly _judgmentFeedback: JudgmentFeedback;

  constructor(
    hazardZoneRenderer?: HazardZoneRenderer,
    judgmentFeedback?: JudgmentFeedback,
  ) {
    this._hazardZoneRenderer = hazardZoneRenderer ?? new HazardZoneRenderer();
    this._judgmentFeedback = judgmentFeedback ?? new JudgmentFeedback();
  }

  get hazardZoneRenderer(): HazardZoneRenderer {
    return this._hazardZoneRenderer;
  }

  get judgmentFeedback(): JudgmentFeedback {
    return this._judgmentFeedback;
  }

  /**
   * ANSWER_SELECT 상태에서 판정 실패 사유 힌트 및 부분 진행도 글로우 상태 산출
   */
  getAnswerSelectFeedback(
    state: GameState,
    input?: JudgmentFeedbackInput | ArmReachAnswerState | null,
    dt = 0,
  ): AnswerSelectFeedbackState {
    if (state !== 'ANSWER_SELECT' || !input) {
      return {
        glowIntensity: 0,
        hintMessage: null,
        reasonKey: null,
        isVisible: false,
        adaptiveRelaxed: false,
        activeZoneId: null,
      };
    }

    const isArmState = 'leftHand' in input && 'rightHand' in input;
    const adaptiveRelaxed = (input as { adaptiveRelaxed?: boolean }).adaptiveRelaxed ?? false;
    const feedbackState = isArmState
      ? this._judgmentFeedback.updateFromAnswerState(input as ArmReachAnswerState, dt, adaptiveRelaxed)
      : this._judgmentFeedback.update(input as JudgmentFeedbackInput, dt);

    return {
      glowIntensity: feedbackState.glowIntensity,
      hintMessage: feedbackState.message,
      reasonKey: feedbackState.reasonKey,
      isVisible: feedbackState.isVisible,
      adaptiveRelaxed: feedbackState.adaptiveRelaxed,
      activeZoneId: feedbackState.activeZoneId,
    };
  }

  /**
   * ANSWER_SELECT 피드백 캔버스 렌더링
   */
  renderAnswerFeedback(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    state: AnswerSelectFeedbackState,
  ): void {
    this._judgmentFeedback.render(ctx, vw, vh, {
      glowIntensity: state.glowIntensity,
      reasonKey: state.reasonKey,
      message: state.hintMessage,
      isVisible: state.isVisible,
      adaptiveRelaxed: state.adaptiveRelaxed,
      activeZoneId: state.activeZoneId,
    });
  }

  /**
   * 카메라 프레임 정렬 및 3초 카운트다운(READY_POSITION) 렌더링 허용 여부 (Issue #202)
   */
  canRenderReadyPosition(state: GameState): boolean {
    return state === 'READY_POSITION';
  }

  /**
   * 러닝 HUD (운동 박자 카운트, 문제 원근 접근 등) 렌더링 허용 여부
   */
  canRenderRunningHUD(state: GameState): boolean {
    return state === 'RUN_QUESTION' || (state as string) === 'REST_READY';
  }

  /**
   * 상단 문제 수식 및 2개 답안 버튼 렌더링 허용 여부 (ANSWER_SELECT 상태에서만 허용, allowPreview 지정 시 RUN_QUESTION 프리뷰 허용)
   */
  canRenderQuestion(
    state: GameState,
    options?: { allowPreview?: boolean; approachProgress?: number },
  ): boolean {
    if (state === 'ANSWER_SELECT') return true;
    if (options?.allowPreview && state === 'RUN_QUESTION' && (options.approachProgress ?? 0) > 0) {
      return true;
    }
    return false;
  }

  /**
   * 러닝 페이즈 6박 이후 답안 원근 접근 프리뷰 렌더링 허용 여부 (Issue #279)
   */
  canRenderAnswerPreview(state: GameState, approachProgress = 0): boolean {
    return state === 'RUN_QUESTION' && approachProgress > 0;
  }

  /**
   * 별모으기 노트 렌더링 허용 여부 (STAR_COLLECT, KEYNOTE_PERFORMANCE 및 Phase B 결전 BOSS_CLIMAX 허용)
   */
  canRenderStarCollect(state: GameState): boolean {
    return (
      state === 'STAR_COLLECT' ||
      (state as string) === 'KEYNOTE_PERFORMANCE' ||
      state === 'BOSS_CLIMAX'
    );
  }

  /**
   * 위험 회피 전용 화면 렌더링 허용 여부 (HAZARD_EVADE 상태에서 허용)
   */
  canRenderHazardEvade(state: GameState): boolean {
    return state === 'HAZARD_EVADE';
  }

  /**
   * 목표 자세 실루엣 가이드 오버레이 렌더링 허용 여부
   */
  canRenderPostureGuide(state: GameState): boolean {
    return state === 'ANSWER_SELECT';
  }

  /**
   * 답안 선택 입력(마우스 클릭 / 터치 / 키보드 1, 2) 허용 여부
   */
  isAnswerInputAllowed(state: GameState, isAnswerLocked: boolean, isWindowOpen = true): boolean {
    return state === 'ANSWER_SELECT' && !isAnswerLocked && isWindowOpen;
  }

  /**
   * HAZARD_EVADE 전용 회피 안내 및 3D 바닥 장판 렌더링
   */
  renderHazardEvade(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    state: HazardEvadePresentationState,
  ): void {
    if (!state.activePattern) return;

    const hazard = state.activePattern;
    const hazardGuide: Record<PhaseAHazardPattern, { title: string; subtitle: string; color: string; actionName: string }> = {
      left_step: { title: '왼발 피하기!', subtitle: '왼발을 들어 장판을 피하세요', color: '#28E6FF', actionName: '왼발' },
      right_step: { title: '오른발 피하기!', subtitle: '오른발을 들어 장판을 피하세요', color: '#FFCB4D', actionName: '오른발' },
      jump: { title: '양발 피하기!', subtitle: '점프해서 바닥 충격파를 넘으세요', color: '#FF865E', actionName: '양발/점프' },
      balance_left: { title: '왼발로 균형!', subtitle: '오른발을 들고 한발로 버티세요', color: '#C889FF', actionName: '왼발 균형' },
      balance_right: { title: '오른발로 균형!', subtitle: '왼발을 들고 한발로 버티세요', color: '#C889FF', actionName: '오른발 균형' },
    };

    let title = hazard ? hazardGuide[hazard].title : '위험 회피 중!';
    let subtitle = hazard ? hazardGuide[hazard].subtitle : '바닥 장판을 피하세요';
    let color = hazard ? hazardGuide[hazard].color : '#FF4444';

    if (state.isResolved) {
      const actionName = hazard ? hazardGuide[hazard].actionName : '';
      if (state.isEvaded) {
        title = '회피 성공! (DODGED)';
        subtitle = `[${actionName}] 공격을 완벽하게 피했습니다!`;
        color = '#4DFFAA';
      } else {
        title = '회피 실패! (HIT)';
        subtitle = `[${actionName}] 장판에 피격되었습니다 (-25 HP)`;
        color = '#FF4444';
      }
    }

    const cx = vw * 0.5;
    const cy = vh * 0.38;
    const scaleX = vw / 1080;

    // Issue #286: 실시간 회피 상태 인디케이터 (Live Action Indicator Badge)
    if (!state.isResolved) {
      const isSafe = Boolean(
        state.isCurrentlySafe ||
        state.isActionDetected ||
        state.isEvaded ||
        (state.performedAction && state.performedAction === state.activePattern)
      );

      ctx.save();
      const badgeX = cx;
      const badgeY = cy - 120 * scaleX;
      const badgeW = Math.min(vw * 0.88, 480 * scaleX);
      const badgeH = 46 * scaleX;
      const badgeColor = isSafe ? '#4DFFAA' : '#FF4444';

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = badgeColor;
      ctx.lineWidth = 2.5 * scaleX;
      ctx.shadowColor = badgeColor;
      ctx.shadowBlur = 18 * scaleX;

      if (typeof (ctx as any).roundRect === 'function') {
        ctx.beginPath?.();
        (ctx as any).roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 20 * scaleX);
        ctx.fill?.();
        ctx.stroke?.();
      } else if (typeof ctx.fillRect === 'function') {
        ctx.fillRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH);
        if (typeof ctx.strokeRect === 'function') {
          ctx.strokeRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH);
        }
      }

      ctx.font = UIText.getFont('badge', scaleX, 'bold');
      ctx.fillStyle = badgeColor;
      ctx.shadowBlur = 10 * scaleX;
      const badgeText = isSafe ? '🛡️ [안전] 회피 자세 유지 중!' : '⚠️ [위험] 장판이 다가옵니다!';
      ctx.fillText(badgeText, badgeX, badgeY);
      ctx.restore();
    }

    // Issue #286: 대형 성패 판정 팝업 (DODGE / HIT Impact Banner)
    if (state.isResolved) {
      ctx.save();
      if (state.isEvaded) {
        // 회피 성공: 대형 DODGE! 텍스트 + 시안/에메랄드 방패 충격파
        ctx.fillStyle = '#4DFFAA';
        ctx.shadowColor = 'rgba(77, 255, 170, 0.95)';
        ctx.shadowBlur = 32 * scaleX;
        ctx.font = UIText.getFont('title', scaleX, 'bold');
        ctx.fillText('DODGE!', cx, cy - 120 * scaleX);

        if (typeof ctx.ellipse === 'function') {
          // 시안/에메랄드 방패 충격파 타원
          ctx.strokeStyle = '#4DFFAA';
          ctx.lineWidth = 6 * scaleX;
          ctx.beginPath?.();
          ctx.ellipse(cx, cy - 100 * scaleX, vw * 0.32, 60 * scaleX, 0, 0, Math.PI * 2);
          ctx.stroke?.();

          ctx.strokeStyle = '#28E6FF';
          ctx.lineWidth = 3 * scaleX;
          ctx.shadowColor = 'rgba(40, 230, 255, 0.9)';
          ctx.beginPath?.();
          ctx.ellipse(cx, cy - 100 * scaleX, vw * 0.40, 80 * scaleX, 0, 0, Math.PI * 2);
          ctx.stroke?.();
        }
      } else {
        // 피격 실패: 화면 붉은 플래시 + 대형 HIT! (-25 HP) 텍스트
        if (typeof ctx.fillRect === 'function') {
          ctx.fillStyle = 'rgba(255, 68, 68, 0.28)';
          ctx.fillRect(0, 0, vw, vh);
        }

        ctx.fillStyle = '#FF4444';
        ctx.shadowColor = 'rgba(255, 68, 68, 0.95)';
        ctx.shadowBlur = 32 * scaleX;
        ctx.font = UIText.getFont('title', scaleX, 'bold');
        ctx.fillText('HIT! (-25 HP)', cx, cy - 120 * scaleX);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = UIText.getFont('subheading', scaleX, 'bold');
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillText(title, cx, cy - 60);
    ctx.shadowBlur = 0;

    ctx.font = UIText.getFont('body', scaleX, 'bold');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(subtitle, cx, cy - 5);

    if (hazard) {
      this._hazardZoneRenderer.render(ctx, vw, vh, {
        activePattern: hazard,
        beatProgress: state.beatProgress,
        vanishingX: state.vanishingX,
        vanishingY: state.vanishingY,
        isResolved: state.isResolved,
        isEvaded: state.isEvaded,
      });
    }

    ctx.restore();
  }
}
