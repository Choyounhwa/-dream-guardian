/**
 * ResultRenderer - 결과 화면, 칼로리 계산, 별 등급
 *
 * Issue #143 (Card #75 / UI-INGAME-001):
 * - 마젠타 결과 카드 패널 (880x1580px, 네온 마젠타 외곽선)
 * - 타이틀 bold 100px (승리/패배), 챕터명 42px, 별점 54px
 * - 8개 운동 통계 1:1 매칭 74px 라인 x 44px 대형 폰트 리포트
 *
 * @see Issue #23 (GitHub #88), Issue #135, Issue #143
 */

import { CALORIE_RATES, LOCOMOTION_CALORIE_RATES } from '../../config/posture.config.js';
import type { LocomotionMode } from '../motion/LocomotionDetector.js';
import type { BeatRhythmStats } from '../types/result.js';
import { getBossName } from '../data/bossData.js';
import { UIText } from '../utils/UIText.js';
import { imageLoader } from '../utils/UIImageLoader.js';

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
  /** 스트레칭/자세 유지 시간 (초, Issue #135) */
  dwellTime?: number;
  /** 선택된 운동 모드 (Issue #155 / FEAT-GAME-002) */
  locomotionMode?: LocomotionMode;
  /** BEAT MOTION 리듬 통계 (Issue #206 / #184) */
  rhythmStats?: BeatRhythmStats;
}

export interface ResultPanelLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 칼로리 계산 (자세 유지 시간 및 운동 모드별 METs 반영 확장, Issue #135 / #155) */
export function calcCalories(
  steps: number,
  squats: number,
  jumps: number,
  dwellTime = 0,
  mode: LocomotionMode = 'run',
): number {
  const stepRate = LOCOMOTION_CALORIE_RATES[mode] ?? CALORIE_RATES.step;
  return (
    steps * stepRate +
    squats * CALORIE_RATES.squat +
    jumps * CALORIE_RATES.jump +
    dwellTime * CALORIE_RATES.dwellPerSecond
  );
}

/** 운동 모드별 통계 텍스트 라인 포맷팅 (Issue #155 / FEAT-GAME-002) */
export function getLocomotionStatLine(mode: LocomotionMode = 'run', steps: number): string {
  switch (mode) {
    case 'hip_bounce':
      return `🦘 골반 바운스: ${steps}회`;
    case 'hip_sway':
      return `💃 골반 스웨이: ${steps}회`;
    case 'arm_cross':
      return `🚗 양손 교차: ${steps}회`;
    case 'run':
    default:
      return `🏃 달린 걸음: ${steps}보 (제자리 달리기)`;
  }
}

/** 별 등급 (1~3) 산출 */
export function calcStars(correctCount: number, totalQuestions: number, elapsedTime: number): number {
  if (totalQuestions === 0) return 1;
  const accuracy = correctCount / totalQuestions;
  if (accuracy >= 0.9 && elapsedTime < 120) return 3;
  if (accuracy >= 0.7) return 2;
  return 1;
}

export class ResultRenderer {
  /**
   * 마젠타 결과 카드 패널 레이아웃 (1080x2160 기준 x: 100, y: 240, w: 880, h: 1580)
   */
  getPanelLayout(w: number, h: number): ResultPanelLayout {
    const scaleX = w / 1080;
    const scaleY = h / 2160;
    return {
      x: 100 * scaleX,
      y: 240 * scaleY,
      w: 880 * scaleX,
      h: 1580 * scaleY,
    };
  }

  /**
   * 통계 1줄 높이 (2160 기준 74px)
   */
  getStatLineHeight(h: number): number {
    return Math.round(74 * (h / 2160));
  }

  /**
   * 통계 폰트 크기 (1080 기준 44px)
   */
  getStatFontSize(w: number): number {
    return UIText.getFontSize('subheading', w / 1080);
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, data: ResultData): void {
    const scaleX = w / 1080;
    const scaleY = h / 2160;

    ctx.save();

    // 1. 전체 화면 딤 오버레이
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, w, h);

    // 2. 마젠타 결과 카드 패널 (x: 100, y: 240, w: 880, h: 1580)
    const panel = this.getPanelLayout(w, h);
    const panelImg = imageLoader.get('result', 'panelBg');
    if (panelImg) {
      ctx.drawImage(panelImg, panel.x, panel.y, panel.w, panel.h);
    } else {
      ctx.fillStyle = 'rgba(20, 10, 30, 0.95)';
      ctx.strokeStyle = '#FF28D8';
      ctx.lineWidth = 3.5 * scaleX;
      ctx.shadowColor = '#FF28D8';
      ctx.shadowBlur = 18 * scaleX;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(panel.x, panel.y, panel.w, panel.h, 28 * scaleX);
      } else {
        ctx.rect(panel.x, panel.y, panel.w, panel.h);
      }
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 3. 타이틀 영역: bold 100px ("승리!" / "패배...")
    const titleY = panel.y + 110 * scaleY;
    const badgeImg = data.victory
      ? imageLoader.get('result', 'victoryBadge')
      : imageLoader.get('result', 'defeatBadge');
    if (badgeImg) {
      const bw = 240 * scaleX;
      const bh = 80 * scaleY;
      ctx.drawImage(badgeImg, (w - bw) / 2, titleY - bh / 2, bw, bh);
    } else {
      ctx.font = UIText.getFont('hero', scaleX, 'bold');
      ctx.fillStyle = data.victory ? '#4DFFAA' : '#FF4444';
      ctx.shadowColor = data.victory ? '#4DFFAA' : '#FF4444';
      ctx.shadowBlur = 20 * scaleX;
      ctx.fillText(data.victory ? '승리!' : '패배...', w / 2, titleY);
      ctx.shadowBlur = 0;
    }

    // 챕터명: bold 42px
    ctx.font = UIText.getFont('body', scaleX, 'bold');
    ctx.fillStyle = '#FFCB4D';
    ctx.fillText(`Ch.${data.chapter} ${getBossName(data.chapter)}`, w / 2, titleY + 90 * scaleY);

    // 별 등급 (승리 시): bold 54px
    if (data.victory) {
      const stars = calcStars(data.correctCount, data.totalQuestions, data.elapsedTime);
      const starFilledImg = imageLoader.get('result', 'starFilled');
      const starEmptyImg = imageLoader.get('result', 'starEmpty');
      if (starFilledImg && starEmptyImg) {
        const starSize = 54 * scaleX;
        const startX = w / 2 - (3 * starSize) / 2;
        const starY = titleY + 165 * scaleY - starSize / 2;
        for (let s = 0; s < 3; s++) {
          const sImg = s < stars ? starFilledImg : starEmptyImg;
          ctx.drawImage(sImg, startX + s * starSize, starY, starSize, starSize);
        }
      } else {
        ctx.font = UIText.getFont('heading', scaleX, 'bold');
        ctx.fillStyle = '#FFCB4D';
        ctx.shadowColor = '#FFCB4D';
        ctx.shadowBlur = 14 * scaleX;
        ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), w / 2, titleY + 165 * scaleY);
        ctx.shadowBlur = 0;
      }
    }

    // 4. 8개 운동 통계 리포트 (74px 라인 x bold 44px 1:1 매칭)
    const statStartY = panel.y + (data.victory ? 470 : 380) * scaleY;
    const lineH = this.getStatLineHeight(h);

    ctx.font = UIText.getFont('subheading', scaleX, 'bold');
    ctx.fillStyle = '#FFFFFF';

    const accuracy = data.totalQuestions > 0
      ? Math.round((data.correctCount / data.totalQuestions) * 100)
      : 0;
    const dwell = data.dwellTime ?? 0;
    const calories = calcCalories(data.steps, data.squats, data.jumps, dwell, data.locomotionMode);
    const timeStr = `${Math.floor(data.elapsedTime / 60)}분 ${String(Math.floor(data.elapsedTime % 60)).padStart(2, '0')}초`;
    const stepLine = getLocomotionStatLine(data.locomotionMode, data.steps);

    const lines = [
      `🎯 정답률: ${data.correctCount} / ${data.totalQuestions} (${accuracy}%)`,
      `🔥 최대 콤보: ${data.maxCombo} COMBO`,
      `⏱️ 플레이 시간: ${timeStr}`,
      stepLine,
      `🏋️ 스쿼트: ${data.squats}회`,
      `🦘 점프: ${data.jumps}회`,
      `🧘 자세 유지: ${dwell.toFixed(1)}초`,
      `⚡ 소모 칼로리: ${calories.toFixed(1)} kcal`,
    ];

    if (data.rhythmStats) {
      lines.push(
        `⭐ 리듬 별: ${data.rhythmStats.beatStarsCollected}개 (타임아웃 ${data.rhythmStats.timeoutCount}회)`,
      );
    }

    for (let i = 0; i < lines.length; i++) {
      const ly = statStartY + i * lineH;
      // 은은한 구분선 배경 바
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)';
      ctx.fillRect(panel.x + 40 * scaleX, ly - lineH / 2 + 6 * scaleY, panel.w - 80 * scaleX, lineH - 12 * scaleY);

      ctx.fillStyle = i >= 7 ? '#FFCB4D' : '#EAEAEA';
      ctx.fillText(lines[i], w / 2, ly);
    }

    // 5. 하단 안내문
    ctx.font = UIText.getFont('label', scaleX, 'normal');
    ctx.fillStyle = '#888888';
    ctx.fillText('양손을 모으거나 하단 [메뉴로] 버튼을 클릭하세요', w / 2, panel.y + panel.h - 50 * scaleY);

    ctx.restore();
  }
}
