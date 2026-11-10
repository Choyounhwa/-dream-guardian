/**
 * BossClimaxEffectRenderer.ts - Phase B 결전 해저드/쇼크웨이브/탄막/광폭화 시각 효과 전담 렌더러
 *
 * BossClimaxRenderer에서 바닥 해저드(양손 쿵 충격파, 한손 콩콩 그림자 미니언),
 * 아군 미니언 편대/수호신 비주얼, 마법 탄막 투사체, 보스 광폭화 아우라 등의
 * 특수 시각 효과 렌더링 책임을 분리 격리한다.
 *
 * - 순수 프리젠테이션 격리: 게임 상태나 밸런스를 절대 직접 계산/변조하지 않으며,
 *   주어진 상태 데이터를 시각적으로 표현하는 단일 책임만 수행한다.
 *
 * @see Issue #621 [REFACTOR-RENDER-003]
 * @see Issue #195 [RENDER-CLIMAX-001]
 * @see Issue #485 [MRN-11]
 */

import { depthRatioFromY } from '../GridProjection.js';
import { UIText } from '../../utils/UIText.js';
import { imageLoader } from '../../utils/UIImageLoader.js';
import { MotionNoteRenderer } from '../MotionNoteRenderer.js';
import { createDefaultPainterRegistry } from '../note-painters/NotePainters.js';
import { DEFAULT_NOTE_PROFILES } from '../../../config/motion-note-profile.config.js';
import { bossHazardToRenderItem } from '../../game/adapters/bossHazardAdapter.js';
import { UI_LAYOUT } from '../../../config/ui.config.js';
import type {
  BossClimaxHazardState,
  MinionPosition,
} from '../BossClimaxRenderer.js';

function clampTextScale(scale: number | undefined, fallback: number = 1.0): number {
  const val = typeof scale === 'number' && !Number.isNaN(scale) ? scale : fallback;
  return Math.max(0.5, Math.min(3.0, val));
}

export class BossClimaxEffectRenderer {
  public readonly motionNoteRenderer: MotionNoteRenderer;
  private _localSprites: Map<string, CanvasImageSource>;

  constructor(
    motionNoteRenderer?: MotionNoteRenderer,
    localSprites?: Map<string, CanvasImageSource>,
  ) {
    this.motionNoteRenderer =
      motionNoteRenderer ?? this._createMotionNoteRenderer();
    this._localSprites = localSprites ?? new Map();
  }

  private _createMotionNoteRenderer(): MotionNoteRenderer {
    return new MotionNoteRenderer({
      profiles: DEFAULT_NOTE_PROFILES,
      registry: createDefaultPainterRegistry(),
    });
  }

  /**
   * 로컬 스프라이트 등록 (검증된 ID만 별도 context에 캐시, 전역 imageLoader 불변)
   */
  registerLocalSprite(key: string, image: CanvasImageSource): boolean {
    if (!key || typeof key !== 'string') return false;
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) return false;
    this._localSprites.set(key, image);
    return true;
  }

  clearLocalSprites(): void {
    this._localSprites.clear();
  }

  /**
   * 박자/공격 진행도(progress)에 따른 바닥 장판 전방 도달 Y 좌표 계산 (원근 가속 적용)
   */
  computeHazardFrontY(progress: number, vanishingY: number, vh: number): number {
    const floorH = Math.max(0, vh - vanishingY);
    const p = Math.max(0, Math.min(1.0, progress));
    return vanishingY + floorH * 0.92 * Math.pow(p, 1.4);
  }

  /**
   * 1. 보스 광폭화 아우라 (30% 이하 시 붉은 코로나 펄스)
   */
  renderBossEnrageAura(
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
  renderHazard(
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
      this.renderDualSlamShockwave(ctx, vw, vx, frontY, depthRatio, p, time, scaleX, vh);
    } else if (
      hazard.activePattern === 'alternating_stomp_left' ||
      hazard.activePattern === 'alternating_stomp_right'
    ) {
      const isLeft = hazard.activePattern === 'alternating_stomp_left';
      this.renderStompShadowMinion(ctx, vw, vh, vx, vy, isLeft, p, depthRatio, time, scaleX);
    }

    // 해결(Resolved) 시 회피 성공 / 피격 피드백 텍스트
    if (hazard.isResolved) {
      this.renderResolvedFeedback(ctx, vx, frontY, hazard.isEvaded === true, scaleX, vh);
    }

    // MRN-11: 상공 비행 장판/충격파 투사체 MotionNoteRenderer 위임
    if (!hazard.isResolved) {
      this.renderFlyingHazard(ctx, vw, vh, vx, vy, hazard);
    }

    ctx.restore();
  }

  /**
   * 상공 비행 장판/충격파 투사체 렌더링 위임 (MotionNoteRenderer: boss_slam 프로필)
   */
  renderFlyingHazard(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    vx: number,
    vy: number,
    hazard: BossClimaxHazardState,
  ): void {
    if (!hazard.activePattern) return;
    const renderItem = bossHazardToRenderItem(
      hazard.activePattern,
      hazard.progress,
      {
        isResolved: hazard.isResolved,
        isEvaded: hazard.isEvaded,
      },
    );
    if (!renderItem) return;
    this.motionNoteRenderer.render(
      ctx,
      [renderItem],
      { width: vw, height: vh },
      { x: vx, y: vy },
    );
  }

  /**
   * 양손 쿵 (dual_slam) 충격파 파동 링
   */
  renderDualSlamShockwave(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vx: number,
    frontY: number,
    depthRatio: number,
    p: number,
    time: number,
    scaleX: number = vw / 1080,
    vh: number = 2160,
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
    const jumpLayout = UI_LAYOUT.bossClimax?.jumpGuide;
    const jumpScale = clampTextScale(jumpLayout?.textScale ?? UI_LAYOUT.bossClimax?.textScale, 1.0);
    ctx.font = UIText.getFont('body', scaleX * jumpScale, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const jumpOffsetY = (jumpLayout?.offsetY ?? 28) * (vh / 2160);
    ctx.fillText('⬆️ JUMP! 양발을 뛰어 충격파 회피!', vx, frontY - ry - jumpOffsetY);

    ctx.restore();
  }

  /**
   * 한손 콩콩 (alternating_stomp_left / right) 그림자 미니언 전진
   */
  renderStompShadowMinion(
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
    const stepLayout = UI_LAYOUT.bossClimax?.stepGuide;
    const scaleY = vh / 2160;
    const laneOffset = isLeft ? -vw * 0.26 : vw * 0.26;
    const targetX = vx + laneOffset;
    const defaultTargetY = vh * 0.88;
    const targetY = stepLayout?.targetY !== undefined ? stepLayout.targetY * scaleY : defaultTargetY;

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
    const stepScale = clampTextScale(stepLayout?.textScale ?? UI_LAYOUT.bossClimax?.textScale, 1.0);
    ctx.font = UIText.getFont('body', scaleX * stepScale, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const stepOffsetY = (stepLayout?.offsetY ?? 50) * scale;
    ctx.fillText(stepLabel, mx, my - stepOffsetY);

    ctx.restore();
  }

  /**
   * 회피 성공 / 피격 피드백
   */
  renderResolvedFeedback(
    ctx: CanvasRenderingContext2D,
    vx: number,
    frontY: number,
    isEvaded: boolean,
    scaleX: number = 1.0,
    vh: number = 2160,
  ): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const feedbackLayout = UI_LAYOUT.bossClimax?.feedback;
    const feedbackScale = clampTextScale(
      feedbackLayout?.textScale ?? UI_LAYOUT.bossClimax?.textScale,
      1.0,
    );
    const feedbackFont = UIText.getFont('body', scaleX * feedbackScale, 'bold');
    const feedbackOffsetY = (feedbackLayout?.offsetY ?? 40) * (vh / 2160);

    if (isEvaded) {
      ctx.fillStyle = '#00FF88';
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
      ctx.lineWidth = 4;
      ctx.font = feedbackFont;
      ctx.shadowColor = '#00FF88';
      ctx.shadowBlur = 16;
      ctx.strokeText('✨ EVADED! (회피 성공) ✨', vx, frontY - feedbackOffsetY);
      ctx.fillText('✨ EVADED! (회피 성공) ✨', vx, frontY - feedbackOffsetY);
    } else {
      ctx.fillStyle = '#FF2244';
      ctx.strokeStyle = 'rgba(255, 34, 68, 0.8)';
      ctx.lineWidth = 4;
      ctx.font = feedbackFont;
      ctx.shadowColor = '#FF2244';
      ctx.shadowBlur = 16;
      ctx.strokeText('💥 HIT! -15 HP (피격) 💥', vx, frontY - feedbackOffsetY);
      ctx.fillText('💥 HIT! -15 HP (피격) 💥', vx, frontY - feedbackOffsetY);
    }

    ctx.restore();
  }

  /**
   * 3. 아군 미니언 군단 V자 편대 & 중앙 수호신 렌더링
   */
  renderGuardianAndMinions(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    minions: MinionPosition[],
    stage: number,
    time: number,
    scaleX: number = 1.0,
    barrageActive = false,
    isShieldActive = false,
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

    // [UI-ASSET-006 / #271] 수호신 캐릭터 스프라이트 이미지 분기 또는 프로시저럴 드로잉 폴백
    const safeStage = Math.max(1, Math.min(4, Math.floor(stage)));
    let spriteKey = `stage${safeStage}_idle`;

    if (barrageActive) {
      if (safeStage === 4 && (this._localSprites.get('stage4_ultimate') || imageLoader.get('guardian', 'stage4_ultimate'))) {
        spriteKey = 'stage4_ultimate';
      } else {
        spriteKey = `stage${safeStage}_cast`;
      }
    } else if (isShieldActive) {
      spriteKey = `stage${safeStage}_shield`;
    }

    const img = this._localSprites.get(spriteKey) ?? imageLoader.get('guardian', spriteKey);

    if (img) {
      const imgW = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || 1;
      const imgH = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || 1;
      const aspect = imgW / imgH;

      const baseSize = (70 + safeStage * 25) * scaleX;
      let dw = baseSize;
      let dh = baseSize;
      if (aspect >= 1) {
        dh = dw / aspect;
      } else {
        dw = dh * aspect;
      }

      const dx = cx - dw / 2;
      const dy = cy - dh / 2;

      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
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
      const guardianLayout = UI_LAYOUT.bossClimax?.guardian;
      const guardianScale = clampTextScale(
        guardianLayout?.textScale ?? UI_LAYOUT.bossClimax?.textScale,
        1.0,
      );
      ctx.font = UIText.getFont('badge', scaleX * guardianScale, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowBlur = 8;
      ctx.fillText('🌟 꼬마 수호신', cx, cy + gRadius + 10);
    }

    ctx.restore();
  }

  /**
   * 4. 아군 군단 마법 탄막 (미니언 및 수호신에서 소실점 보스를 향해 발사되는 마법 투사체)
   */
  renderMagicBarrage(
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
}
