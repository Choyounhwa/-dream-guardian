/**
 * QuestionRenderer - 인게임 수학 문제 및 2개 답안 버튼 렌더러
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - main.ts에 인라인되어 있던 문제 수식 및 답안 선택 버튼 렌더링 코드 분리
 * - QuestionRenderer와 BeatHUDRenderer 간 중복되던 renderMath 블록 공통 헬퍼로 통합
 */

import type { GeneratedQuestion } from '../question/QuestionEvaluator.js';
import { renderMath } from './MathRenderer.js';
import { PartIconRenderer } from './PartIconRenderer.js';
import { getAnswerButtonLayouts } from '../../config/zone.config.js';
import type { QuestionRecipePlan } from '../input/RecipeGenerator.js';

export interface QuestionRenderState {
  question: GeneratedQuestion | null;
  questionVisible: boolean;
  selectedChoiceIndex?: number | null;
  answerPlan?: QuestionRecipePlan | null;
}

/**
 * 상단 문제 수식 텍스트 렌더링 공통 헬퍼
 * @param ctx 캔버스 2D 컨텍스트
 * @param questionText 문제 수식 텍스트
 * @param cx 수평 중앙 좌표
 * @param qY 기준 Y 좌표
 * @param scaleX 가상 X 스케일 비율
 * @param isRunningPhase 러닝 페이즈 여부 (러닝 페이즈는 110px 기본, 문제 풀이 페이즈는 132px 기본)
 */
export function renderQuestionHeaderMath(
  ctx: CanvasRenderingContext2D,
  questionText: string,
  cx: number,
  qY: number,
  scaleX: number,
  isRunningPhase: boolean = false,
): void {
  const qLen = questionText.length;
  const baseSize = isRunningPhase ? 110 : 132;
  const minSize = isRunningPhase ? 76 : 84;

  let qFontSize = baseSize * scaleX;
  if (qLen > 10) {
    qFontSize = Math.max(minSize * scaleX, (baseSize - (qLen - 10) * 2.8) * scaleX);
  }

  ctx.shadowColor = 'rgba(40, 230, 255, 0.5)';
  ctx.shadowBlur = 16 * scaleX;
  renderMath(ctx, questionText, cx, qY, {
    fontSize: qFontSize,
    color: '#ffffff',
    align: 'center',
    maxWidth: 880 * scaleX,
    placeholderColor: '#28E6FF',
    placeholderBgColor: 'rgba(40, 230, 255, 0.18)',
    fractionLineColor: '#ffffff',
  });
  ctx.shadowBlur = 0;
}

export class QuestionRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: QuestionRenderState,
  ): void {
    if (!state.question || !state.questionVisible) return;

    const scaleX = w / 1080;
    const scaleY = h / 2160;

    ctx.save();

    // 1. 문제영역 가상 레이아웃 영역 (Y 기준 좌표계 유지)
    const boxY = 320 * scaleY;
    const cx = w / 2;
    const qY = boxY + 220 * scaleY;

    // 2. 문제 수식 텍스트 (Issue #167: 1.5배 대형화 132px 및 maxWidth 자동 줄바꿈)
    renderQuestionHeaderMath(ctx, state.question.questionText, cx, qY, scaleX, false);

    // 3. 답안 버튼 2개 횡배치 (Issue #164: 4, 5번 피트니스 존 하단 수직/X축 중심 정렬)
    const buttonLayouts = getAnswerButtonLayouts(w, h);
    const plan = state.answerPlan;

    for (let i = 0; i < 2; i++) {
      const btn = buttonLayouts[i];
      const bx = btn.x;
      const btnY = btn.y;
      const btnW = btn.width;
      const btnH = btn.height;
      const recipe = plan?.choices[i];

      // Issue #148 & #163: 방사형 색상 분할 버튼 렌더링 (외곽선 두께 8px로 2배 상향)
      PartIconRenderer.drawRadialAnswerButton(ctx, recipe, bx, btnY, btnW, btnH, 20 * scaleX, 8 * scaleX);

      // Issue #200: 답안 선택 즉시 선택 하이라이트 테두리 점등
      if (state.selectedChoiceIndex === i) {
        ctx.save();
        ctx.strokeStyle = '#4DFFAA';
        ctx.lineWidth = 10 * scaleX;
        ctx.shadowColor = '#4DFFAA';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx - 3, btnY - 3, btnW + 6, btnH + 6, 22 * scaleX);
        } else {
          ctx.strokeRect(bx - 3, btnY - 3, btnW + 6, btnH + 6);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 수식 폰트: bold 96px (긴 수식은 최소 60px까지 자동 축소)
      const choiceStr = String(state.question.choices[i]);
      const choiceLen = choiceStr.length;
      const choiceFontSize = choiceLen > 6 ? Math.max(60 * scaleX, (96 - (choiceLen - 6) * 6) * scaleX) : 96 * scaleX;

      renderMath(ctx, choiceStr, bx + btnW / 2, btnY + btnH / 2 - 20 * scaleY, {
        fontSize: choiceFontSize,
        color: '#FFCB4D',
        align: 'center',
        fractionLineColor: '#FFCB4D',
        placeholderColor: '#FFCB4D',
      });

      // 요구 부위 아이콘 렌더링
      if (recipe) {
        const iconSize = 28 * scaleX;
        PartIconRenderer.drawRequirementGroup(ctx, recipe, bx + btnW / 2, btnY + btnH - 36 * scaleY, iconSize);
      }

      // 키보드 힌트
      ctx.font = `bold ${Math.round(22 * scaleX)}px sans-serif`;
      ctx.fillStyle = '#AAAAAA';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`키보드 [${i + 1}]`, bx + btnW / 2, btnY + btnH + 34 * scaleY);
    }

    ctx.restore();
  }
}
