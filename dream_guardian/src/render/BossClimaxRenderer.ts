/**
 * BossClimaxRenderer.ts - Phase B 결전(BOSS_CLIMAX) 3D 원근 충격파·군단 편대·마법 탄막·광폭화 시각화
 *
 * 1인칭 3D 원근 시점의 DreamGrid 공간에서 보스의 2대 바닥 공격(양손 쿵 파동, 한손 콩콩 적 미니언 전진),
 * 아군 미니언 군단의 V자 편대 및 마법 탄막 발사, 보스 광폭화 시각 효과를 렌더링한다.
 *
 * - 순수 프리젠테이션 격리: 게임 상태나 밸런스를 절대 직접 계산/변조하지 않으며,
 *   주어진 불변 BossClimaxRenderState 데이터를 시각적으로 표현하는 단일 책임만 수행한다.
 *
 * @see Issue #195 [RENDER-CLIMAX-001]
 * @see Issue #193 [BATTLE-BOSS-001]
 * @see Issue #194 [MINION-TROOP-001]
 * @see Issue #213 [BOSS-FEVER-001]
 */

import { HORIZON_RATIO } from '../../config/grid.config.js';
import { depthRatioFromY } from './GridProjection.js';
import { UIText } from '../utils/UIText.js';

export interface BossClimaxHazardState {
  readonly activePattern: string | null;
  readonly progress: number;
  readonly isResolved?: boolean;
  readonly isEvaded?: boolean;
}

export interface BossClimaxRenderState {
  readonly bossHp: number;
  readonly bossMaxHp: number;
  readonly isEnraged: boolean;
  readonly minionCount: number; // 0 ~ 13
  readonly guardianStage?: number;
  readonly stardust: number;
  readonly feverCombo: number;
  readonly hazard: BossClimaxHazardState | null;
  readonly barrageActive: boolean;
  readonly barrageProgress: number; // 0.0 ~ 1.0
  readonly elapsedTime: number;
  readonly vanishingX?: number;
  readonly vanishingY?: number;
}

export interface MinionPosition {
  readonly x: number;
  readonly y: number;
  readonly index: number;
}

export class BossClimaxRenderer {
  /**
   * 박자/공격 진행도(progress)에 따른 바닥 장판 전방 도달 Y 좌표 계산 (원근 가속 적용)
   */
  computeHazardFrontY(progress: number, vanishingY: number, vh: number): number {
    const floorH = Math.max(0, vh - vanishingY);
    const p = Math.max(0, Math.min(1.0, progress));
    return vanishingY + floorH * 0.92 * Math.pow(p, 1.4);
  }

  /**
   * 전경 중앙 수호신 기준 좌표
   */
  getGuardianPosition(vw: number, vh: number): { x: number; y: number } {
    return {
      x: vw * 0.5,
      y: vh * 0.84,
    };
  }

  /**
   * 아군 미니언 수량(0..13)에 따른 V자 편대 좌표 동적 계산
   * @param minionCount 아군 미니언 수 (0~13)
   * @param gx 수호신 중심 X
   * @param gy 수호신 중심 Y
   * @param vw 화면 가상 너비
   * @param vh 화면 가상 높이
   */
  computeMinionPositions(
    minionCount: number,
    gx: number,
    gy: number,
    vw: number,
    vh: number,
  ): MinionPosition[] {
    if (minionCount <= 0) return [];

    const clampedCount = Math.min(13, Math.max(0, Math.floor(minionCount)));
    const positions: MinionPosition[] = [];

    for (let i = 0; i < clampedCount; i++) {
      const pair = Math.floor(i / 2) + 1; // 1, 2, 3, 4, 5, 6, 7
      const side = i % 2 === 0 ? -1 : 1; // -1: 좌측 날개, +1: 우측 날개

      const dx = side * (pair * 54);
      const dy = pair * 16;

      const x = Math.max(60, Math.min(vw - 60, gx + dx));
      const y = Math.max(vh * 0.72, Math.min(vh * 0.91, gy + dy));

      positions.push({ x, y, index: i });
    }

    return positions;
  }

  /**
   * Phase B 결전 화면 전체 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    state: Readonly<BossClimaxRenderState>,
  ): void {
    const scaleX = vw / 1080;
    const vx = state.vanishingX ?? vw * 0.5;
    const vy = state.vanishingY ?? vh * HORIZON_RATIO;
    const floorH = Math.max(1, vh - vy);
    const time = state.elapsedTime;

    ctx.save();

    // 1. 보스 광폭화 아우라 (보스 주변 붉은 코로나/화염)
    if (state.isEnraged) {
      this._renderBossEnrageAura(ctx, vx, vy, time);
    }

    // 2. 보스 바닥 패턴 공격 (충격파 / 교대 짓밟기)
    if (state.hazard && state.hazard.activePattern) {
      this._renderHazard(ctx, vw, vh, vx, vy, floorH, state.hazard, time, scaleX);
    }

    // 3. 아군 미니언 군단 V자 편대 & 중앙 수호신
    const guardianPos = this.getGuardianPosition(vw, vh);
    const minionPositions = this.computeMinionPositions(
      state.minionCount,
      guardianPos.x,
      guardianPos.y,
      vw,
      vh,
    );

    this._renderGuardianAndMinions(
      ctx,
      guardianPos.x,
      guardianPos.y,
      minionPositions,
      state.guardianStage ?? 1,
      time,
      scaleX,
    );

    // 4. 아군 군단 마법 탄막 (별빛 투사체 발사)
    if (state.barrageActive) {
      this._renderMagicBarrage(
        ctx,
        guardianPos.x,
        guardianPos.y,
        minionPositions,
        vx,
        vy,
        state.barrageProgress,
        time,
      );
    }

    // 5. Phase B 전용 상태 HUD
    this._renderStatusHUD(ctx, vw, vh, state, time, scaleX);

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────
  // 내부 서브 렌더러
  // ─────────────────────────────────────────────────────────

  /**
   * 1. 보스 광폭화 아우라 (30% 이하 시 붉은 코로나 펄스)
   */
  private _renderBossEnrageAura(
    ctx: CanvasRenderingContext2D,
    vx: number,
    vy: number,
    time: number,
  ): void {
    ctx.save();

    const pulse = 1.0 + Math.sin(time * 8) * 0.12 + Math.cos(time * 14) * 0.04;
    const baseRadius = 120 * pulse;

    // 붉은 방사형 글로우
    const grad = ctx.createRadialGradient(vx, vy, baseRadius * 0.2, vx, vy, baseRadius * 2.2);
    grad.addColorStop(0, 'rgba(255, 30, 60, 0.45)');
    grad.addColorStop(0.5, 'rgba(255, 10, 30, 0.25)');
    grad.addColorStop(1, 'rgba(180, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(vx, vy, baseRadius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 회전하는 붉은 코로나 광선 스파이크 (12개)
    ctx.save();
    ctx.translate(vx, vy);
    ctx.rotate(time * 0.6);
    ctx.strokeStyle = 'rgba(255, 60, 80, 0.6)';
    ctx.lineWidth = 3;

    const spikes = 12;
    for (let i = 0; i < spikes; i++) {
      const angle = (i * 2 * Math.PI) / spikes;
      const spikeLen = baseRadius * (1.2 + 0.3 * Math.sin(time * 10 + i * 2));
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (baseRadius * 0.6), Math.sin(angle) * (baseRadius * 0.6));
      ctx.lineTo(Math.cos(angle) * spikeLen, Math.sin(angle) * spikeLen);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  /**
   * 2. 보스 바닥 패턴 공격 렌더링 (충격파 / 적 미니언 전진 / 해결 피드백)
   */
  private _renderHazard(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    vx: number,
    vy: number,
    floorH: number,
    hazard: BossClimaxHazardState,
    time: number,
    scaleX: number = vw / 1080,
  ): void {
    const p = Math.max(0, Math.min(1.0, hazard.progress));
    const frontY = this.computeHazardFrontY(p, vy, vh);
    const depthRatio = depthRatioFromY(frontY, vy, floorH);

    ctx.save();

    if (hazard.activePattern === 'dual_slam') {
      this._renderDualSlamShockwave(ctx, vw, vx, frontY, depthRatio, p, time, scaleX);
    } else if (
      hazard.activePattern === 'alternating_stomp_left' ||
      hazard.activePattern === 'alternating_stomp_right'
    ) {
      const isLeft = hazard.activePattern === 'alternating_stomp_left';
      this._renderStompShadowMinion(ctx, vw, vh, vx, vy, isLeft, p, depthRatio, time, scaleX);
    }

    // 해결(Resolved) 시 회피 성공 / 피격 피드백 텍스트
    if (hazard.isResolved) {
      this._renderResolvedFeedback(ctx, vx, frontY, hazard.isEvaded === true, scaleX);
    }

    ctx.restore();
  }

  /**
   * 양손 쿵 (dual_slam) 충격파 파동 링
   */
  private _renderDualSlamShockwave(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vx: number,
    frontY: number,
    depthRatio: number,
    p: number,
    time: number,
    scaleX: number = vw / 1080,
  ): void {
    const rx = vw * (0.18 + 0.46 * depthRatio);
    const ry = rx * 0.26; // 3D 바닥 평면 투영 타원비

    ctx.save();
    // 메인 충격파 링
    ctx.strokeStyle = 'rgba(255, 40, 70, 0.85)';
    ctx.lineWidth = 6 + 6 * depthRatio;
    ctx.shadowColor = 'rgba(255, 30, 60, 0.9)';
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.ellipse(vx, frontY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 장판 내부 반투명 붉은 채움
    ctx.fillStyle = `rgba(255, 30, 60, ${0.2 * (1 - p * 0.3)})`;
    ctx.beginPath();
    ctx.ellipse(vx, frontY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // 잔여 내부 보조 파동 링
    if (p > 0.2) {
      const innerRx = rx * 0.75;
      const innerRy = innerRx * 0.26;
      ctx.strokeStyle = 'rgba(255, 120, 140, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(vx, frontY, innerRx, innerRy, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 점프 안내 가이드 (미해결 시)
    const alertAlpha = 0.7 + 0.3 * Math.sin(time * 12);
    ctx.fillStyle = `rgba(255, 230, 100, ${alertAlpha})`;
    ctx.font = UIText.getFont('body', scaleX, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬆️ JUMP! 양발을 뛰어 충격파 회피!', vx, frontY - ry - 28);

    ctx.restore();
  }

  /**
   * 한손 콩콩 (alternating_stomp_left / right) 그림자 미니언 전진
   */
  private _renderStompShadowMinion(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    vx: number,
    vy: number,
    isLeft: boolean,
    p: number,
    depthRatio: number,
    time: number,
    scaleX: number = vw / 1080,
  ): void {
    const laneOffset = isLeft ? -vw * 0.26 : vw * 0.26;
    const targetX = vx + laneOffset;
    const targetY = vh * 0.88;

    // 레일 궤적을 따른 원근 진행 좌표
    const mx = vx + (targetX - vx) * Math.pow(p, 1.4);
    const my = vy + (targetY - vy) * Math.pow(p, 1.4);
    const scale = 0.4 + 1.0 * depthRatio;

    ctx.save();

    // 1. 위험 레인 경고선
    ctx.strokeStyle = isLeft ? 'rgba(40, 230, 255, 0.35)' : 'rgba(255, 200, 50, 0.35)';
    ctx.lineWidth = 4 + 4 * depthRatio;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. 그림자 미니언 본체
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(scale, scale);

    // 그림자 아우라
    const auraRad = 32 + Math.sin(time * 10) * 4;
    const auraGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, auraRad);
    auraGrad.addColorStop(0, 'rgba(120, 20, 140, 0.7)');
    auraGrad.addColorStop(1, 'rgba(40, 0, 60, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRad, 0, Math.PI * 2);
    ctx.fill();

    // 어두운 바디
    ctx.fillStyle = '#1A0B2E';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // 뿔/가시
    ctx.beginPath();
    ctx.moveTo(-16, -14);
    ctx.lineTo(-24, -30);
    ctx.lineTo(-6, -18);
    ctx.moveTo(16, -14);
    ctx.lineTo(24, -30);
    ctx.lineTo(6, -18);
    ctx.fillStyle = '#2A0E40';
    ctx.fill();

    // 빛나는 붉은 눈
    ctx.fillStyle = '#FF2266';
    ctx.shadowColor = '#FF2266';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(-8, -4, 4, 0, Math.PI * 2);
    ctx.arc(8, -4, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 3. 발 짓밟기 격퇴 유도 안내 문구
    const stepLabel = isLeft ? '🦶 왼발 짓밟기! (Zone 9)' : '🦶 오른발 짓밟기! (Zone 11)';
    ctx.fillStyle = '#FFF066';
    ctx.font = UIText.getFont('body', scaleX, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stepLabel, mx, my - 50 * scale);

    ctx.restore();
  }

  /**
   * 회피 성공 / 피격 피드백
   */
  private _renderResolvedFeedback(
    ctx: CanvasRenderingContext2D,
    vx: number,
    frontY: number,
    isEvaded: boolean,
    scaleX: number = 1.0,
  ): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isEvaded) {
      ctx.fillStyle = '#00FF88';
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
      ctx.lineWidth = 4;
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.shadowColor = '#00FF88';
      ctx.shadowBlur = 16;
      ctx.strokeText('✨ EVADED! (회피 성공) ✨', vx, frontY - 40);
      ctx.fillText('✨ EVADED! (회피 성공) ✨', vx, frontY - 40);
    } else {
      ctx.fillStyle = '#FF2244';
      ctx.strokeStyle = 'rgba(255, 34, 68, 0.8)';
      ctx.lineWidth = 4;
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.shadowColor = '#FF2244';
      ctx.shadowBlur = 16;
      ctx.strokeText('💥 HIT! -15 HP (피격) 💥', vx, frontY - 40);
      ctx.fillText('💥 HIT! -15 HP (피격) 💥', vx, frontY - 40);
    }

    ctx.restore();
  }

  /**
   * 3. 아군 미니언 군단 V자 편대 & 중앙 수호신 렌더링
   */
  private _renderGuardianAndMinions(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    minions: MinionPosition[],
    stage: number,
    time: number,
    scaleX: number = 1.0,
  ): void {
    // A. 미니언들 렌더링
    for (const m of minions) {
      ctx.save();
      const bobY = Math.sin(time * 3.5 + m.index * 0.8) * 6;
      const mx = m.x;
      const my = m.y + bobY;

      // 미니언 후광
      const haloGrad = ctx.createRadialGradient(mx, my, 4, mx, my, 22);
      haloGrad.addColorStop(0, 'rgba(40, 230, 255, 0.6)');
      haloGrad.addColorStop(1, 'rgba(40, 230, 255, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(mx, my, 22, 0, Math.PI * 2);
      ctx.fill();

      // 미니언 별빛 구체
      ctx.fillStyle = '#28E6FF';
      ctx.beginPath();
      ctx.arc(mx, my, 12, 0, Math.PI * 2);
      ctx.fill();

      // 날개 모양 장식
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(mx - 10, my - 6, 8, 4, -0.4, 0, Math.PI * 2);
      ctx.ellipse(mx + 10, my - 6, 8, 4, 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // B. 전경 중앙 수호신 렌더링
    ctx.save();
    const gBobY = Math.sin(time * 2.8) * 8;
    const cx = gx;
    const cy = gy + gBobY;

    // 수호신 외곽 발광
    const gRadius = 24 + stage * 3;
    const gGrad = ctx.createRadialGradient(cx, cy, gRadius * 0.2, cx, cy, gRadius * 2.2);
    gGrad.addColorStop(0, 'rgba(255, 220, 100, 0.7)');
    gGrad.addColorStop(0.5, 'rgba(40, 230, 255, 0.4)');
    gGrad.addColorStop(1, 'rgba(40, 230, 255, 0)');
    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, gRadius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 수호신 본체 코어
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#FFCB4D';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, gRadius, 0, Math.PI * 2);
    ctx.fill();

    // 수호신 날개 (Stage에 따라 확대)
    ctx.fillStyle = 'rgba(255, 203, 77, 0.85)';
    const wingSpan = 20 + stage * 8;
    ctx.beginPath();
    ctx.ellipse(cx - wingSpan, cy - 8, wingSpan * 0.8, 10 + stage * 2, -0.3, 0, Math.PI * 2);
    ctx.ellipse(cx + wingSpan, cy - 8, wingSpan * 0.8, 10 + stage * 2, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 수호신 명칭 라벨
    ctx.fillStyle = '#FFCB4D';
    ctx.font = UIText.getFont('badge', scaleX, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 8;
    ctx.fillText('🌟 꼬마 수호신', cx, cy + gRadius + 10);

    ctx.restore();
  }

  /**
   * 4. 아군 군단 마법 탄막 (미니언 및 수호신에서 소실점 보스를 향해 발사되는 마법 투사체)
   */
  private _renderMagicBarrage(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    minions: MinionPosition[],
    vx: number,
    vy: number,
    progress: number,
    _time: number,
  ): void {
    const p = Math.max(0, Math.min(1.0, progress));

    ctx.save();

    // 발사 원점 목록: 수호신 + 아군 미니언들
    const origins = [{ x: gx, y: gy }, ...minions];

    for (let i = 0; i < origins.length; i++) {
      const orig = origins[i];
      // 약간의 곡률 및 개별 오프셋
      const lateralSpread = Math.sin(p * Math.PI) * ((i % 2 === 0 ? 1 : -1) * (20 + (i % 3) * 15));
      const px = orig.x + (vx - orig.x) * p + lateralSpread;
      const py = orig.y + (vy - orig.y) * p;
      const pScale = Math.max(0.3, 1.2 - 0.7 * p);

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(pScale, pScale);

      // 별빛 투사체 드로잉
      ctx.fillStyle = i % 2 === 0 ? '#28E6FF' : '#FFCB4D';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 12;

      // 4각 별빛 모양
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(5, -5);
      ctx.lineTo(18, 0);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 18);
      ctx.lineTo(-5, 5);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-5, -5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 소실점 타격 순간(0.85 이상) 충격 폭발 플래시
    if (p >= 0.85) {
      const impactRatio = (p - 0.85) / 0.15;
      const impactRad = 50 + impactRatio * 90;

      ctx.save();
      ctx.strokeStyle = `rgba(255, 230, 80, ${1.0 - impactRatio})`;
      ctx.lineWidth = 8;
      ctx.shadowColor = '#FFCB4D';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(vx, vy, impactRad, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1.0 - impactRatio)})`;
      ctx.beginPath();
      ctx.arc(vx, vy, impactRad * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 사각형 또는 둥근 사각형 경로 생성 헬퍼 (모든 Canvas 구현체 호환)
   */
  private _drawRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r = 0,
  ): void {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else if (typeof ctx.rect === 'function') {
      ctx.rect(x, y, w, h);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    }
  }

  /**
   * 5. Phase B 전용 상태 HUD (상단 보스 HP & 피버 콤보, 하단 군단/별가루)
   */
  private _renderStatusHUD(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    state: Readonly<BossClimaxRenderState>,
    time: number,
    scaleX: number = vw / 1080,
  ): void {
    ctx.save();

    // A. 상단 중앙: 보스 HP 바
    const barW = 460;
    const barH = 22;
    const barX = (vw - barW) / 2;
    const barY = 96;

    // HP 게이지 배경
    ctx.fillStyle = 'rgba(10, 15, 30, 0.75)';
    ctx.strokeStyle = state.isEnraged ? '#FF2244' : '#28E6FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    this._drawRectPath(ctx, barX, barY, barW, barH, 6);
    ctx.fill();
    ctx.stroke();

    // HP 게이지 채움
    const hpRatio = Math.max(0, Math.min(1.0, state.bossHp / Math.max(1, state.bossMaxHp)));
    const fillW = Math.max(0, (barW - 4) * hpRatio);
    ctx.fillStyle = state.isEnraged ? '#FF2244' : '#FF865E';
    if (fillW > 0) {
      ctx.beginPath();
      this._drawRectPath(ctx, barX + 2, barY + 2, fillW, barH - 4, 4);
      ctx.fill();
    }

    // HP 수치 텍스트
    ctx.fillStyle = '#FFFFFF';
    ctx.font = UIText.getFont('caption', scaleX, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(`BOSS HP ${state.bossHp} / ${state.bossMaxHp}`, vw / 2, barY + barH / 2);

    // 광폭화 배지
    if (state.isEnraged) {
      const enrageAlpha = 0.8 + 0.2 * Math.sin(time * 10);
      ctx.fillStyle = `rgba(255, 34, 68, ${enrageAlpha})`;
      ctx.font = UIText.getFont('badge', scaleX, 'bold');
      ctx.fillText('⚠️ 광폭화 (ENRAGED) ⚠️', vw / 2, barY - 18);
    }

    // B. 상단 좌측: 피버 콤보 카운터
    if (state.feverCombo > 0) {
      ctx.save();
      const comboPulse = 1.0 + Math.sin(time * 8) * 0.05;
      ctx.translate(140, 100);
      ctx.scale(comboPulse, comboPulse);

      ctx.fillStyle = '#FFCB4D';
      ctx.strokeStyle = '#FF865E';
      ctx.lineWidth = 2;
      ctx.font = UIText.getFont('body', scaleX, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#FF865E';
      ctx.shadowBlur = 12;

      ctx.strokeText(`🔥 FEVER x${state.feverCombo}`, 0, 0);
      ctx.fillText(`🔥 FEVER x${state.feverCombo}`, 0, 0);
      ctx.restore();
    }

    // C. 하단: 아군 군단 & 별가루 상태 배지 (중앙 레일 미침범, 좌우 분리)
    // 좌측: 아군 군단 수량 배지
    ctx.fillStyle = 'rgba(20, 30, 50, 0.8)';
    ctx.strokeStyle = '#28E6FF';
    ctx.lineWidth = 2;
    const badgeW = 200;
    const badgeH = 50;
    const badgeY = vh * 0.77;

    ctx.beginPath();
    this._drawRectPath(ctx, 40, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#28E6FF';
    ctx.font = UIText.getFont('badge', scaleX, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`👥 군단: ${state.minionCount} / 13`, 40 + badgeW / 2, badgeY + badgeH / 2);

    // 우측: 별가루 잔량 배지
    ctx.fillStyle = 'rgba(20, 30, 50, 0.8)';
    ctx.strokeStyle = '#FFCB4D';
    ctx.beginPath();
    this._drawRectPath(ctx, vw - 40 - badgeW, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFCB4D';
    ctx.font = UIText.getFont('badge', scaleX, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`★ 별가루: ${state.stardust}`, vw - 40 - badgeW / 2, badgeY + badgeH / 2);

    ctx.restore();
  }
}
