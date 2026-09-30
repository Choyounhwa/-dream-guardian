/**
 * HazardZoneRenderer - 3D 원근 그리드 바닥 보스 장판 렌더러
 *
 * Issue #228 (RENDER-HAZARD-001):
 * - 화면 중앙 고정 평면 타원을 소실점에서 전경으로 밀려오는 3D 원근 바닥 장판으로 개편
 * - PhaseAHazardController의 5종 회피 패턴별 차별화된 3D 레인 시각 효과 제공
 *   1. jump: 소실점에서 전경까지 전 레인을 덮으며 확산하는 붉은 충격파 파동 링 (#FF865E)
 *   2. left_step: 좌측 레인(Zone 9 방향)을 타고 소실점에서 전경으로 밀려오는 위험 네온 띠 (#28E6FF)
 *   3. right_step: 우측 레인(Zone 11 방향)을 타고 소실점에서 전경으로 밀려오는 위험 네온 띠 (#FFCB4D)
 *   4. balance_left / balance_right: 외발 지탱 구역 점등 및 반대편 위험 레인 가시 펄스 (#C889FF)
 */

import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';
import { depthRatioFromY, laneToScreenX } from './GridProjection.js';

export interface HazardRenderState {
  activePattern: PhaseAHazardPattern | null;
  beatProgress: number; // 0.0 ~ 1.0
  vanishingX: number;
  vanishingY: number;
}

export class HazardZoneRenderer {
  /**
   * 박자 진행도(beatProgress)에 따른 장판 전방 도달 Y 좌표 계산
   * @param beatProgress 0.0(소실점) ~ 1.0(전경 발밑)
   * @param vanishingY 소실점 Y 좌표
   * @param vh 화면 가상 높이
   */
  computeHazardFrontY(beatProgress: number, vanishingY: number, vh: number): number {
    const floorH = Math.max(0, vh - vanishingY);
    const p = Math.max(0, Math.min(1.0, beatProgress));
    // 원근 가속(p^1.5)을 적용하여 소실점에서 전경(화면 92% 높이)까지 자연스럽게 도달
    return vanishingY + floorH * 0.92 * Math.pow(p, 1.5);
  }

  /**
   * 3D 원근 바닥 장판 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    state: HazardRenderState,
  ): void {
    if (!state.activePattern) return;

    const vx = state.vanishingX;
    const vy = state.vanishingY;
    const floorH = Math.max(1, vh - vy);
    const p = Math.max(0, Math.min(1.0, state.beatProgress));
    const frontY = this.computeHazardFrontY(p, vy, vh);
    const depthRatio = depthRatioFromY(frontY, vy, floorH);

    ctx.save();

    switch (state.activePattern) {
      case 'jump':
        this._renderJumpShockwave(ctx, vw, vh, vx, vy, frontY, depthRatio, p);
        break;
      case 'left_step':
        this._renderStepLaneHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, 'left');
        break;
      case 'right_step':
        this._renderStepLaneHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, 'right');
        break;
      case 'balance_left':
        this._renderBalanceHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, 'left');
        break;
      case 'balance_right':
        this._renderBalanceHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, 'right');
        break;
    }

    ctx.restore();
  }

  /**
   * 점프 충격파 링 렌더링 (전 레인 확산 붉은 파동)
   */
  private _renderJumpShockwave(
    ctx: CanvasRenderingContext2D,
    vw: number,
    _vh: number,
    vx: number,
    _vy: number,
    frontY: number,
    depthRatio: number,
    progress: number,
  ): void {
    const rx = vw * (0.18 + 0.44 * depthRatio);
    const ry = rx * 0.26; // 3D 바닥 평면 투영 타원비

    ctx.save();
    ctx.strokeStyle = 'rgb(255, 134, 94)'; // #FF865E
    ctx.shadowColor = 'rgba(255, 134, 94, 0.8)';
    ctx.shadowBlur = 24;
    ctx.lineWidth = 8 + 6 * depthRatio;

    // 1. 메인 충격파 링
    ctx.beginPath();
    ctx.ellipse(vx, frontY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 2. 바닥면 내부 글로우 채우기
    ctx.fillStyle = `rgba(255, 134, 94, ${0.08 + 0.14 * depthRatio})`;
    ctx.fill();

    // 3. 뒤따라오는 보조 리플 링 (펄스 효과)
    if (progress > 0.25) {
      const subRatio = Math.max(0, depthRatio - 0.2);
      const subRx = rx * 0.72;
      const subRy = ry * 0.72;
      ctx.lineWidth = 4 + 3 * subRatio;
      ctx.strokeStyle = 'rgba(255, 134, 94, 0.6)';
      ctx.beginPath();
      ctx.ellipse(vx, frontY - ry * 0.4, subRx, subRy, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 한 발 피하기 레인 위험 네온 띠 렌더링 (left_step / right_step)
   */
  private _renderStepLaneHazard(
    ctx: CanvasRenderingContext2D,
    vw: number,
    _vh: number,
    vx: number,
    vy: number,
    frontY: number,
    depthRatio: number,
    side: 'left' | 'right',
  ): void {
    const isLeft = side === 'left';
    const mainColor = isLeft ? 'rgb(40, 230, 255)' : 'rgb(255, 203, 77)';
    const baseRgba = isLeft ? 'rgba(40, 230, 255, ' : 'rgba(255, 203, 77, ';

    // 레인 중심 X 오프셋 (전경 기준 화면 ±35% 위치)
    const laneOffsetSign = isLeft ? -1 : 1;
    const laneCenterOffset = laneOffsetSign * vw * 0.35;
    const laneHalfWidth = vw * 0.16;

    // 소실점 근처 시작 좌표
    const topX1 = vx + laneOffsetSign * 10;
    const topX2 = vx + laneOffsetSign * 40;
    const topY = vy;

    // 전방 진행 좌표
    const botCenterX = laneToScreenX(vx, laneCenterOffset, depthRatio);
    const botWidth = laneHalfWidth * depthRatio;
    const botX1 = botCenterX - botWidth;
    const botX2 = botCenterX + botWidth;

    ctx.save();
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 6 + 4 * depthRatio;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 20;

    // 1. 위험 구역 사다리꼴 바닥면
    ctx.beginPath();
    ctx.moveTo(topX1, topY);
    ctx.lineTo(topX2, topY);
    ctx.lineTo(botX2, frontY);
    ctx.lineTo(botX1, frontY);
    ctx.closePath();

    ctx.fillStyle = `${baseRgba}${0.12 + 0.18 * depthRatio})`;
    ctx.fill();
    ctx.stroke();

    // 2. 전방 충격파 림 (위험 구역 선두 테두리 강조)
    ctx.lineWidth = 8 + 6 * depthRatio;
    ctx.beginPath();
    ctx.moveTo(botX1, frontY);
    ctx.lineTo(botX2, frontY);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 한발 균형 유지 구역 및 반대편 가시 펄스 렌더링 (balance_left / balance_right)
   */
  private _renderBalanceHazard(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    vx: number,
    vy: number,
    frontY: number,
    depthRatio: number,
    safeSide: 'left' | 'right',
  ): void {
    const isSafeLeft = safeSide === 'left';
    const mainColor = 'rgb(200, 137, 255)'; // #C889FF
    const dangerSide = isSafeLeft ? 'right' : 'left';

    // 1. 위험한 반대편 레인에 가시형 위험 띠 드로잉
    this._renderStepLaneHazard(ctx, vw, vh, vx, vy, frontY, depthRatio, dangerSide);

    // 2. 안전한 지탱 측 발밑에 보라색 균형 유지 플랫폼 링 드로잉
    const safeOffsetSign = isSafeLeft ? -1 : 1;
    const safeCenterOffset = safeOffsetSign * vw * 0.35;
    const safeCenterX = laneToScreenX(vx, safeCenterOffset, depthRatio);

    const safeRx = vw * (0.08 + 0.12 * depthRatio);
    const safeRy = safeRx * 0.28;

    ctx.save();
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 5 + 3 * depthRatio;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.ellipse(safeCenterX, frontY, safeRx, safeRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(200, 137, 255, ${0.15 + 0.15 * depthRatio})`;
    ctx.fill();

    ctx.restore();
  }
}
