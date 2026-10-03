/**
 * QuestionRenderer - 인게임 수학 문제 및 2개 답안 버튼 렌더러
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - main.ts에 인라인되어 있던 문제 수식 및 답안 선택 버튼 렌더링 코드 분리
 * - QuestionRenderer와 BeatHUDRenderer 간 중복되던 renderMath 블록 공통 헬퍼로 통합
 */

import type { GeneratedQuestion } from '../question/QuestionEvaluator.js';
import { renderMath } from './MathRenderer.js';
import { getAnswerButtonLayouts } from '../../config/zone.config.js';
import type { QuestionRecipePlan } from '../input/RecipeGenerator.js';
import { ShapeRenderer, deriveShapeFromQuestion } from './ShapeRenderer.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';

export interface QuestionRenderState {
  question: GeneratedQuestion | null;
  questionVisible: boolean;
  selectedChoiceIndex?: number | null;
  answerPlan?: QuestionRecipePlan | null;
  /** Issue #322: 문제 출제 첫 2박 원근 접근 진행도 (0.0: 소실점 ~ 1.0: 정면 안착) */
  questionApproachProgress?: number;
  /** Issue #279: 답안 원근 접근 진행도 (0.0: 소실점 ~ 1.0: 정면 안착) */
  answerApproachProgress?: number;
  /** 원근 접근 소실점 좌표 (기본 중앙 상단 / 보스 위치) */
  vanishingX?: number;
  vanishingY?: number;
  /** 러닝 페이즈 6박 이후 답안 프리뷰 시 헤더 중복 방지 플래그 */
  buttonsOnly?: boolean;
  /** Issue #322: 러닝 페이즈(1~5박) 등 답안 버튼 숨김 및 수식 목판 헤더만 렌더링 */
  headerOnly?: boolean;
  /** 8박 종료 후 2박 선택 창에서만 true. 6~8박 프리뷰는 false(비활성) */
  answerSelectable?: boolean;
  /** Issue #285 (UI-ANSWER-002): 각 보기 버튼의 0.0 ~ 1.0 충전 진행도 */
  choiceProgress?: [number, number];
  /** Issue #285 (UI-ANSWER-002): 현재 조준/타겟팅된 보기 버튼 인덱스 0 또는 1 */
  activeHoverIndex?: number | null;
  /** Issue #311: #309 AnswerTimeSnapshot과 호환되는 읽기 전용 표시 입력 */
  answerTime?: AnswerTimeDisplay | null;
  /** 프리뷰/비활성/분기 후 경로가 true를 넘기기 전까지 시간 라벨을 숨긴다 */
  showAnswerTime?: boolean;
}

export interface AnswerTimeDisplay {
  phase: 'primary' | 'extension' | 'closed';
  primaryBeats: number;
  extensionBeats: number;
  maxBeats: number;
  elapsedBeats: number;
  remainingBeats: number;
  inputOpen: boolean;
}

export interface QuestionHeaderMathOptions {
  hasShape?: boolean;
  maxHeight?: number;
  maxWidth?: number;
  minFontSize?: number;
}

/**
 * 상단 문제 수식 텍스트 렌더링 공통 헬퍼
 * @param ctx 캔버스 2D 컨텍스트
 * @param questionText 문제 수식 텍스트
 * @param cx 수평 중앙 좌표
 * @param qY 기준 Y 좌표
 * @param scaleX 가상 X 스케일 비율
 * @param isRunningPhase 러닝 페이즈 여부 (러닝 페이즈는 110px 기본, 문제 풀이 페이즈는 132px 기본)
 * @param options 너비/높이/폰트 제약 옵션
 */
export function renderQuestionHeaderMath(
  ctx: CanvasRenderingContext2D,
  questionText: string,
  cx: number,
  qY: number,
  scaleX: number,
  _isRunningPhase: boolean = false,
  options?: QuestionHeaderMathOptions,
): { width: number; height: number } {
  const qLen = questionText.length;
  // Issue #322: 러닝·답선택 페이즈 간 132px 대형 폰트 일원화 (SSOT)
  const baseSize = 132;
  const minSize = options?.minFontSize ?? (options?.hasShape ? 44 : 64);

  let qFontSize = baseSize * scaleX;
  if (qLen > 10) {
    qFontSize = Math.max(minSize * scaleX, (baseSize - (qLen - 10) * 2.8) * scaleX);
  }

  const defaultMaxHeight = options?.hasShape ? 150 * scaleX : 340 * scaleX;
  const maxHeight = options?.maxHeight ?? defaultMaxHeight;
  const maxWidth = options?.maxWidth ?? 880 * scaleX;

  ctx.shadowColor = 'rgba(40, 230, 255, 0.5)';
  ctx.shadowBlur = 16 * scaleX;
  const result = renderMath(ctx, questionText, cx, qY, {
    fontSize: qFontSize,
    color: '#ffffff',
    align: 'center',
    maxWidth,
    maxHeight,
    minFontSize: minSize * scaleX,
    placeholderColor: '#28E6FF',
    placeholderBgColor: 'rgba(40, 230, 255, 0.18)',
    fractionLineColor: '#ffffff',
  });
  ctx.shadowBlur = 0;
  return result;
}

export class QuestionRenderer {
  private _shapeRenderer = new ShapeRenderer();

  get shapeRenderer(): ShapeRenderer {
    return this._shapeRenderer;
  }

  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: QuestionRenderState,
  ): void {
    if (!state.question || !state.questionVisible) return;

    const scaleX = w / 1080;
    const scaleY = h / 2160;

    const shape = deriveShapeFromQuestion(state.question.questionText, state.question.shapeCode);

    ctx.save();

    // 1 & 2. 문제영역 가상 레이아웃 및 수식/도형 (buttonsOnly가 아닐 때만 렌더)
    if (!state.buttonsOnly) {
      const boxY = 320 * scaleY;
      const cx = w / 2;
      // 도형 존재 시 문제 텍스트를 상단으로 정렬하여 중앙 3D 뷰포트 영역(480~820px)과 겹침 0% 보장
      const qY = shape ? boxY + 70 * scaleY : boxY + 220 * scaleY;

      const qProgress = state.questionApproachProgress !== undefined
        ? Math.max(0, Math.min(1.0, state.questionApproachProgress))
        : 1.0;

      ctx.save();

      // Issue #322: 러닝 페이즈 첫 2박 동안 소실점(보스)에서 목표 정면으로 원근 접근 연출
      if (qProgress < 1.0) {
        const vx = state.vanishingX ?? cx;
        const vy = state.vanishingY ?? (h * 0.24);
        const headerCenterY = shape ? boxY + 70 * scaleY : boxY + 140 * scaleY;

        const eased = 1.0 - Math.pow(1.0 - qProgress, 2.0);
        const curX = vx + (cx - vx) * eased;
        const curY = vy + (headerCenterY - vy) * eased;
        const scale = 0.15 + (1.0 - 0.15) * eased;
        const alpha = 0.10 + (1.0 - 0.10) * eased;

        ctx.globalAlpha = Math.max(0, Math.min(1.0, ctx.globalAlpha * alpha));
        ctx.translate(curX, curY);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -headerCenterY);
      }

      // 1. 문제 수식 배경 패널 (Issue #290 / UI-ASSET-009)
      const boardBgImg = imageLoader.get('question', 'questionBoardBg');
      if (boardBgImg) {
        const boardW = (shape ? 760 : 880) * scaleX;
        const boardH = (shape ? 200 : 280) * scaleY;
        const boardX = cx - boardW / 2;
        const boardY = shape ? boxY - 30 * scaleY : boxY;
        ctx.drawImage(boardBgImg, boardX, boardY, boardW, boardH);
      }

      // 2. 문제 수식 텍스트 (Issue #167 & #234: 긴 자연어/복합 수식 높이 및 너비 안전 수용)
      renderQuestionHeaderMath(ctx, state.question.questionText, cx, qY, scaleX, false, {
        hasShape: Boolean(shape),
        maxHeight: shape ? 140 * scaleY : 320 * scaleY,
      });

      // 2-1. 도형(쌓기나무 3D / 전개도 / 회전) 시각화 렌더링 (텍스트와 버튼 사이 중앙 비간섭 영역)
      if (shape) {
        const panelW = 480 * scaleX;
        const panelH = 340 * scaleY;
        const panelCy = 650 * scaleY;
        this._shapeRenderer.renderShape(ctx, shape, cx, panelCy, panelW, panelH);
      }

      ctx.restore();
    }

    // 3. 답안 버튼 2개 횡배치 (Issue #164, #233 & #279: Zone 4/5 깔끔한 2버튼 레이아웃 및 소실점 원근 접근)
    if (!state.headerOnly) {
      const buttonLayouts = getAnswerButtonLayouts(w, h);
    const progress = state.answerApproachProgress !== undefined
      ? Math.max(0, Math.min(1.0, state.answerApproachProgress))
      : 1.0;
    const vx = state.vanishingX ?? (w / 2);
    const vy = state.vanishingY ?? (h * 0.24);

    const isApproaching = progress < 1.0;
    const eased = isApproaching ? 1.0 - Math.pow(1.0 - progress, 2) : 1.0;
    const minScale = 0.20;
    const minAlpha = 0.20;
    const scale = isApproaching ? minScale + (1.0 - minScale) * eased : 1.0;
    const alpha = isApproaching ? minAlpha + (1.0 - minAlpha) * eased : 1.0;
    const selectable = state.answerSelectable !== false;

    for (let i = 0; i < 2; i++) {
      const btn = buttonLayouts[i];
      const targetCenterX = btn.x + btn.width / 2;
      const targetCenterY = btn.y + btn.height / 2;

      // 소실점에서 목표 위치로 부채꼴 외곽 궤적 보간
      const curCenterX = isApproaching ? vx + (targetCenterX - vx) * eased : targetCenterX;
      const curCenterY = isApproaching ? vy + (targetCenterY - vy) * eased : targetCenterY;

      // Issue #285 (UI-ANSWER-002): 조준 시 미세 확대 (Magnet Hover State: 1.05x)
      const isHovered = state.activeHoverIndex === i;
      const hoverScale = isHovered ? 1.05 : 1.0;
      const effectiveScale = scale * hoverScale;

      const curW = btn.width * effectiveScale;
      const curH = btn.height * effectiveScale;
      const bx = curCenterX - curW / 2;
      const btnY = curCenterY - curH / 2;

      ctx.save();
      ctx.globalAlpha *= selectable ? alpha : alpha * 0.42;

      // Issue #285 (UI-ANSWER-002): 호버 시 글로우 효과 (shadowBlur 20px)
      if (isHovered) {
        ctx.shadowColor = i === 0 ? 'rgba(40, 230, 255, 0.8)' : 'rgba(255, 203, 77, 0.8)';
        ctx.shadowBlur = 20 * scaleX * scale;
      }

      // Issue #290 (UI-ASSET-009): 사전 렌더링된 버튼 프레임 비트맵 이미지 에셋 연동
      const isSelected = state.selectedChoiceIndex === i;
      const assetKey = isHovered ? 'answerBtnHover' : (isSelected ? 'answerBtnSelected' : 'answerBtnDefault');
      const btnImg = imageLoader.get('question', assetKey) ?? imageLoader.get('question', 'answerBtnDefault');

      if (btnImg) {
        ctx.drawImage(btnImg, bx, btnY, curW, curH);
      } else {
        // 모던 반투명 네온 버튼 배경 (프로시저럴 폴백)
        ctx.fillStyle = 'rgba(16, 24, 48, 0.88)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, curW, curH, 20 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, curW, curH);
        }
        ctx.fill();
      }

      // Issue #285 (UI-ANSWER-002): 실시간 0~100% 충전 프로그레스 바 및 부드러운 네온 내부 채우기 (Fill)
      const rawProgress = state.selectedChoiceIndex === i ? 1.0 : (state.choiceProgress ? state.choiceProgress[i] : 0);
      const choiceProgress = Math.max(0, Math.min(1.0, rawProgress ?? 0));

      if (choiceProgress > 0) {
        ctx.save();
        // 1) 내부 네온 충전 필 (진행도 비례 너비)
        ctx.fillStyle = i === 0
          ? `rgba(40, 230, 255, ${0.12 + choiceProgress * 0.13})`
          : `rgba(255, 203, 77, ${0.12 + choiceProgress * 0.13})`;
        ctx.beginPath();
        const fillW = curW * choiceProgress;
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, fillW, curH, 18 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, fillW, curH);
        }
        ctx.fill();

        // 2) 버튼 하단 네온 프로그레스 바
        const barH = Math.max(4, 8 * scaleY * effectiveScale);
        const barY = btnY + curH - barH - 6 * scaleY * effectiveScale;
        const barPad = 8 * scaleX * effectiveScale;
        const barMaxW = curW - barPad * 2;
        const barW = Math.max(0, barMaxW * choiceProgress);

        ctx.fillStyle = i === 0 ? '#28E6FF' : '#FFCB4D';
        ctx.shadowColor = i === 0 ? '#28E6FF' : '#FFCB4D';
        ctx.shadowBlur = 12 * effectiveScale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx + barPad, barY, barW, barH, barH / 2);
        } else {
          ctx.rect(bx + barPad, barY, barW, barH);
        }
        ctx.fill();

        // 3) 네온 프로그레스 테두리 (진행도 비례 발광 강화)
        ctx.strokeStyle = i === 0 ? '#28E6FF' : '#FFCB4D';
        ctx.lineWidth = (6 + choiceProgress * 2) * scaleX * effectiveScale;
        ctx.shadowColor = i === 0 ? '#28E6FF' : '#FFCB4D';
        ctx.shadowBlur = (10 + choiceProgress * 10) * effectiveScale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, curW, curH, 20 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, curW, curH);
        }
        ctx.stroke();

        ctx.restore();
      } else if (!selectable) {
        ctx.strokeStyle = 'rgba(140, 150, 170, 0.55)';
        ctx.lineWidth = 4 * scaleX * effectiveScale;
        ctx.setLineDash([10 * scaleX, 8 * scaleX]);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, curW, curH, 20 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, curW, curH);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (!btnImg) {
        // 기본 네온 테두리 (진행도 없을 때 & 비트맵 미로드 프로시저럴 폴백)
        ctx.strokeStyle = i === 0 ? 'rgba(40, 230, 255, 0.7)' : 'rgba(255, 203, 77, 0.7)';
        ctx.lineWidth = 6 * scaleX * effectiveScale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, btnY, curW, curH, 20 * scaleX * effectiveScale);
        } else {
          ctx.rect(bx, btnY, curW, curH);
        }
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Issue #200 & #285 (UI-ANSWER-002): 확정 즉시 체결 및 판정 스탬프 (Confirm Stamp)
      if (state.selectedChoiceIndex === i) {
        ctx.save();
        // 강력한 녹색 테두리 (#00FF88)
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 10 * scaleX * effectiveScale;
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 24 * scale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(
            bx - 3 * scale,
            btnY - 3 * scale,
            curW + 6 * scale,
            curH + 6 * scale,
            22 * scaleX * effectiveScale,
          );
        } else {
          ctx.strokeRect(bx - 3 * scale, btnY - 3 * scale, curW + 6 * scale, curH + 6 * scale);
        }
        ctx.stroke();

        // 버튼 중앙 '선택 완료! [V]' 네온 뱃지/스탬프
        const badgeText = '선택 완료! [V]';
        ctx.font = UIText.getFont('badge', scaleX * effectiveScale, 'bold');
        const textMetrics = ctx.measureText ? ctx.measureText(badgeText) : { width: 100 };
        const badgeW = (textMetrics.width || 100) + 24 * scaleX * effectiveScale;
        const badgeH = 34 * scaleY * effectiveScale;
        const badgeX = curCenterX - badgeW / 2;
        const badgeY = curCenterY - badgeH / 2;

        ctx.fillStyle = 'rgba(16, 40, 24, 0.95)';
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 2 * scaleX * effectiveScale;
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 14 * scale;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10 * scaleX * effectiveScale);
        } else {
          ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00FF88';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, curCenterX, badgeY + badgeH / 2);
        ctx.restore();
      }

      // 수식 폰트: bold 96px (긴 수식은 최소 32px까지 자동 축소, 버튼 경계 내 안전 수용)
      const choiceStr = String(state.question.choices[i]);
      const choiceLen = choiceStr.length;
      const baseChoiceFontSize = choiceLen > 6 ? Math.max(50 * scaleX, (96 - (choiceLen - 6) * 5) * scaleX) : 96 * scaleX;
      const choiceFontSize = baseChoiceFontSize * effectiveScale;
      const choiceTargetY = state.selectedChoiceIndex === i
        ? curCenterY - 48 * scaleY * effectiveScale
        : curCenterY;

      renderMath(ctx, choiceStr, curCenterX, choiceTargetY, {
        fontSize: choiceFontSize,
        color: selectable ? '#FFCB4D' : '#8A93A8',
        align: 'center',
        maxWidth: Math.max(20, (btn.width - 32 * scaleX) * effectiveScale),
        maxHeight: Math.max(20, (btn.height - 32 * scaleY) * effectiveScale),
        minFontSize: Math.round(32 * scaleX * effectiveScale),
        fractionLineColor: '#FFCB4D',
        placeholderColor: '#FFCB4D',
      });

      if (!selectable) {
        ctx.save();
        ctx.font = UIText.getFont('badge', scaleX * scale, 'bold');
        ctx.fillStyle = '#9AA3B5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('대기', curCenterX, btnY + curH + 28 * scaleY * scale);
        ctx.restore();
      }

      // 키보드 힌트 (선택 가능 구간에서만 표시)
      if (selectable && progress >= 0.7) {
        const badgeAlpha = isApproaching ? Math.min(1.0, (progress - 0.7) / 0.3) : 1.0;
        ctx.save();
        ctx.globalAlpha *= badgeAlpha;
        ctx.font = UIText.getFont('badge', scaleX * scale, 'bold');
        ctx.fillStyle = '#CCCCCC';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`키보드 [${i + 1}]`, curCenterX, btnY + curH + 34 * scaleY * scale);
        ctx.restore();
      }

      ctx.restore();
    }

    this.renderAnswerTimeStatus(ctx, w, h, scaleX, scaleY, state);
    }

    ctx.restore();
  }

  private renderAnswerTimeStatus(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    scaleX: number,
    scaleY: number,
    state: QuestionRenderState,
  ): void {
    const snap = state.answerTime;
    const visible = state.showAnswerTime === true
      && !state.buttonsOnly
      && state.answerSelectable !== false
      && snap != null
      && snap.inputOpen
      && (snap.phase === 'primary' || snap.phase === 'extension');
    if (!visible || !snap) return;

    const phaseLabel = snap.phase === 'primary' ? '기본' : '연장';
    const label = `${phaseLabel} ${snap.remainingBeats}박 남음`;
    const y = 860 * scaleY;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = UIText.getFont('caption', scaleX, 'bold');
    ctx.fillStyle = snap.phase === 'primary' ? '#28E6FF' : '#FFCB4D';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, Math.min(y, h * 0.4));
    ctx.restore();
  }
}
