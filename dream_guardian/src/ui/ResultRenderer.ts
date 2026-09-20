/**
 * ResultRenderer - 결과 화면, 칼로리 계산, 별 등급
 *
 * 클리어/실패 피드백 + 운동 통계 리포트
 * 칼로리: (steps*0.04) + (squats*0.35) + (jumps*0.15)
 *
 * @see Issue #23 (GitHub #88)
 */

export interface ResultData {
  victory: boolean;
  chapter: number;
  correctCount: number;
  totalQuestions: number;
  maxCombo: number;
  steps: number;
  squats: number;
  jumps: number;
  elapsedTime: number;
}

/** 칼로리 계산 */
export function calcCalories(steps: number, squats: number, jumps: number): number {
  return steps * 0.04 + squats * 0.35 + jumps * 0.15;
}

/** 별 등급 (1~3) 산출 */
export function calcStars(correctCount: number, totalQuestions: number, elapsedTime: number): number {
  if (totalQuestions === 0) return 1;
  const accuracy = correctCount / totalQuestions;
  if (accuracy >= 0.9 && elapsedTime < 120) return 3;
  if (accuracy >= 0.7) return 2;
  return 1;
}

const BOSS_NAMES = ['', '포겟', '후다닥', '뒤죽박죽', '에라', '나이트메어'];

export class ResultRenderer {
  render(ctx: CanvasRenderingContext2D, w: number, h: number, data: ResultData): void {
    // 배경 오버레이
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 타이틀
    const titleY = h * 0.2;
    ctx.font = `bold ${Math.min(56, w * 0.05)}px sans-serif`;
    ctx.fillStyle = data.victory ? '#4DFFAA' : '#FF4444';
    ctx.fillText(data.victory ? '승리!' : '패배...', w / 2, titleY);

    // 챕터 정보
    ctx.font = `${Math.min(20, w * 0.018)}px sans-serif`;
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Ch.${data.chapter} ${BOSS_NAMES[data.chapter] ?? ''}`, w / 2, titleY + 50);

    // 별 등급
    if (data.victory) {
      const stars = calcStars(data.correctCount, data.totalQuestions, data.elapsedTime);
      ctx.font = `${Math.min(40, w * 0.035)}px sans-serif`;
      ctx.fillStyle = '#FFCB4D';
      ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), w / 2, h * 0.35);
    }

    // 통계
    const statY = h * 0.45;
    const lineH = Math.min(30, h * 0.035);
    ctx.font = `${Math.min(16, w * 0.014)}px sans-serif`;
    ctx.fillStyle = '#ccc';

    const accuracy = data.totalQuestions > 0
      ? Math.round(data.correctCount / data.totalQuestions * 100)
      : 0;
    const calories = calcCalories(data.steps, data.squats, data.jumps);
    const timeStr = `${Math.floor(data.elapsedTime / 60)}:${String(Math.floor(data.elapsedTime % 60)).padStart(2, '0')}`;

    const lines = [
      `정답: ${data.correctCount} / ${data.totalQuestions} (${accuracy}%)`,
      `최대 콤보: ${data.maxCombo}`,
      `시간: ${timeStr}`,
      `걸음: ${data.steps}`,
      `스쿼트: ${data.squats}`,
      `점프: ${data.jumps}`,
      `칼로리: ${calories.toFixed(1)} kcal`,
    ];

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], w / 2, statY + i * lineH);
    }

    // 안내
    ctx.font = `${Math.min(14, w * 0.012)}px sans-serif`;
    ctx.fillStyle = '#666';
    ctx.fillText('ESC 또는 클릭으로 메뉴 복귀', w / 2, h * 0.88);
  }
}
