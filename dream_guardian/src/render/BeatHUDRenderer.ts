/**
 * BeatHUDRenderer - 8박 러닝 페이즈 및 보스 장판/운동 카운트 HUD 렌더러
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - main.ts에 인라인되어 있던 renderRunningPhase()를 독립 렌더러 모듈로 분리
 * - 하드코딩 매직넘버(5, 44px, 색상 등)를 BEAT_HUD_CONFIG로 외부화
 * - #192 KeynoteRenderer와의 렌더링 영역 및 책임 경계 명확화
 */

import type { GeneratedQuestion } from '../question/QuestionEvaluator.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import { BEAT_HUD_CONFIG } from '../../config/locomotion.config.js';
import { renderQuestionHeaderMath } from './QuestionRenderer.js';
import { QuestionApproachRenderer } from './QuestionApproachRenderer.js';
import { HazardZoneRenderer } from './HazardZoneRenderer.js';

export interface BeatHUDRendererOptions {
  showBeatDots?: boolean;
}

export interface BeatHUDState {
  question?: GeneratedQuestion | null;
  totalSteps?: number;
  completedExerciseBeats?: number;
  locomotionMode?: LocomotionMode;
  activeHazardPattern?: PhaseAHazardPattern | null;
  hazardBeatProgress?: number;
  /** Issue #212: 첫 2박 원근 접근 진행도 (0~1) */
  questionApproachProgress?: number;
  /** 원근 접근 소실점 좌표 */
  vanishingX?: number;
  vanishingY?: number;
}

export class BeatHUDRenderer {
  private _showBeatDots: boolean;
  private readonly _approachRenderer: QuestionApproachRenderer;
  private readonly _hazardRenderer: HazardZoneRenderer;

  constructor(options?: BeatHUDRendererOptions) {
    this._showBeatDots = options?.showBeatDots ?? false;
    this._approachRenderer = new QuestionApproachRenderer();
    this._hazardRenderer = new HazardZoneRenderer();
  }

  get showBeatDots(): boolean {
    return this._showBeatDots;
  }

  set showBeatDots(value: boolean) {
    this._showBeatDots = value;
  }

  get hazardRenderer(): HazardZoneRenderer {
    return this._hazardRenderer;
  }

  render(ctx: CanvasRenderingContext2D, vw: number, vh: number, state: BeatHUDState): void {
    const cx = vw / 2;
    const cy = vh * 0.52;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const scaleX = vw / 1080;
    const scaleY = vh / 2160;

    const vx = state.vanishingX ?? cx;
    const vy = state.vanishingY ?? vh * 0.24;

    // 1. 문제 수식 헤더 표시 (Issue #212: 첫 2박 원근 접근 연출 연동)
    if (state.question) {
      const qY = 320 * scaleY + 160 * scaleY;
      const progress = state.questionApproachProgress ?? 1.0;

      if (progress < 1.0) {
        this._approachRenderer.render(
          ctx,
          state.question.questionText,
          cx,
          qY,
          scaleX,
          {
            progress,
            vanishingX: vx,
            vanishingY: vy,
          },
          true,
        );
      } else {
        renderQuestionHeaderMath(ctx, state.question.questionText, cx, qY, scaleX, true);
      }
    }

    // 2. Phase A 보스 장판 박자 안내
    const hazard = state.activeHazardPattern;
    const hazardGuide: Record<PhaseAHazardPattern, { title: string; subtitle: string; color: string }> = {
      left_step: { title: '왼발 피하기!', subtitle: '왼발을 들어 장판을 피하세요', color: '#28E6FF' },
      right_step: { title: '오른발 피하기!', subtitle: '오른발을 들어 장판을 피하세요', color: '#FFCB4D' },
      jump: { title: '양발 피하기!', subtitle: '점프해서 바닥 충격파를 넘으세요', color: '#FF865E' },
      balance_left: { title: '왼발로 균형!', subtitle: '오른발을 들고 한발로 버티세요', color: '#C889FF' },
      balance_right: { title: '오른발로 균형!', subtitle: '왼발을 들고 한발로 버티세요', color: '#C889FF' },
    };
    const guide = hazard ? hazardGuide[hazard] : {
      title: '장판 루틴 완료!',
      subtitle: '다음 지시를 기다리세요',
      color: '#4DFFAA',
    };

    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = guide.color;
    ctx.shadowColor = guide.color;
    ctx.shadowBlur = 24;
    ctx.fillText(guide.title, cx, cy - 60);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = BEAT_HUD_CONFIG.TEXT_COLOR_SUBTITLE;
    ctx.fillText(guide.subtitle, cx, cy - 5);

    // 3. 3D 원근 그리드 바닥 보스 장판 렌더링 (Issue #228 - RENDER-HAZARD-001)
    if (hazard) {
      this._hazardRenderer.render(ctx, vw, vh, {
        activePattern: hazard,
        beatProgress: state.hazardBeatProgress ?? 0,
        vanishingX: vx,
        vanishingY: vy,
      });
    }

    const dotY = cy + 260 * scaleY;

    // 3.5 8박 원형 인디케이터 (옵션 활성화 시)
    if (this._showBeatDots) {
      const completedBeats = state.completedExerciseBeats ?? 0;
      const dotRadius = BEAT_HUD_CONFIG.DOT_RADIUS * scaleX;
      const dotGap = BEAT_HUD_CONFIG.DOT_GAP * scaleX;
      const startX = cx - (7 * dotGap) / 2;
      const indicatorY = cy + BEAT_HUD_CONFIG.DOT_OFFSET_Y;

      for (let i = 0; i < BEAT_HUD_CONFIG.TOTAL_BEATS; i++) {
        const bx = startX + i * dotGap;
        ctx.beginPath();
        ctx.arc(bx, indicatorY, dotRadius, 0, Math.PI * 2);
        if (i < completedBeats) {
          const color = i >= BEAT_HUD_CONFIG.COLOR_SPLIT_BEAT ? BEAT_HUD_CONFIG.COLOR_LATE : BEAT_HUD_CONFIG.COLOR_EARLY;
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = `bold ${Math.round(16 * scaleX)}px sans-serif`;
        ctx.fillStyle = i < completedBeats ? '#000000' : 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`${i + 1}`, bx, indicatorY);
      }
    }

    // 4. 걸음/운동 수 표시
    const mode = state.locomotionMode ?? 'run';
    const countUnit = mode === 'run' ? '보' : '회';
    const totalSteps = state.totalSteps ?? 0;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = BEAT_HUD_CONFIG.STEP_COUNT_COLOR;
    ctx.fillText(`${countUnit === '보' ? '걸음' : '운동'}: ${totalSteps}${countUnit}`, cx, dotY + 60);

    ctx.restore();
  }
}
