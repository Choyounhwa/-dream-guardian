/**
 * PostureGuideRenderer - 목표 자세 실루엣 가이드 오버레이 렌더러
 *
 * Issue #159 (Card #89): [FEAT-GUIDE-001]
 * - 문제 출제 시 플레이어에게 목표 자세를 직관적으로 안내하는 반투명 스틱맨 인체 실루엣 렌더링
 * - 목표 피트니스 존 네온 하이라이트(부위 색상 글로우 및 중앙 부위 벡터 아이콘) 시각화
 * - 커서 진입 및 체류 진행도에 따른 능동적 반응형 하이라이트 전환
 * - 60fps 경량 캔버스 연산
 */

import { CURSOR_COLORS, type CursorType } from '../../config/cursor.config.js';
import type { FitnessZone } from '../../config/zone.config.js';
import type { AnswerPosture, BodyPart } from '../types/posture.js';
import { recipeToAnswerPosture } from '../types/posture.js';
import { PartIconRenderer } from './PartIconRenderer.js';
import type { QuestionRecipePlan } from '../input/RecipeGenerator.js';
import type { CursorPosition } from '../input/CursorTracker.js';

export interface SilhouettePosition {
  x: number;
  y: number;
}

export class PostureGuideRenderer {
  private _pulseTimer = 0;
  private _customPositions: SilhouettePosition[] | null = null;
  private _hintTimer = 0;
  private _hintDuration = 5.0;

  /** 피트니스 존 사각 박스 화면 드로잉 활성화 여부 (Issue #173: 기본값 false - 가상 영역화) */
  public renderZoneBoxes = false;

  /**
   * 프레임별 펄스 타이머 갱신 (60fps 기준)
   */
  update(dt: number): void {
    this._pulseTimer = (this._pulseTimer + dt * 3) % (Math.PI * 2);
    if (this._hintTimer > 0) {
      this._hintTimer = Math.max(0, this._hintTimer - dt);
    }
  }

  /**
   * 스테이지 첫 문제 유도 화살표 힌트 시작 (Issue #160 / FEAT-GUIDE-002)
   * @param duration 노출 지속 시간 (초, 기본값 5.0)
   */
  startFirstQuestionHint(duration = 5.0): void {
    this._hintDuration = duration;
    this._hintTimer = duration;
  }

  /**
   * 유도 화살표 힌트 초기화
   */
  resetHint(): void {
    this._hintTimer = 0;
  }

  /** 유도 화살표 힌트 활성 여부 */
  get isHintActive(): boolean {
    return this._hintTimer > 0;
  }

  /** 전체 힌트 지속 시간 (초) */
  get hintDuration(): number {
    return this._hintDuration;
  }

  /** 남은 힌트 시간 (초) */
  get hintTimer(): number {
    return Math.max(0, this._hintTimer);
  }

  /**
   * 선택지 실루엣 기준 좌표 커스텀 설정
   */
  setSilhouettePositions(positions: SilhouettePosition[] | null): void {
    this._customPositions = positions ? [...positions] : null;
  }

  /**
   * QuestionRecipePlan 객체 기반 렌더링 헬퍼
   */
  renderFromPlan(
    ctx: CanvasRenderingContext2D,
    virtualWidth: number,
    virtualHeight: number,
    plan: QuestionRecipePlan,
    choiceProgress: [number, number] = [0, 0],
    activeChoiceIndex: number | null = null,
    cursors?: ReadonlyMap<CursorType, CursorPosition>,
    isFirstQuestion?: boolean,
  ): void {
    if (!plan || !plan.choices) return;
    const postures: AnswerPosture[] = plan.choices.map((c) => recipeToAnswerPosture(c));
    this.render(
      ctx,
      virtualWidth,
      virtualHeight,
      postures,
      plan.activeZones,
      choiceProgress,
      activeChoiceIndex,
      cursors,
      isFirstQuestion,
    );
  }

  /**
   * 목표 자세 실루엣 및 목표 존 네온 하이라이트 종합 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    virtualWidth: number,
    virtualHeight: number,
    postures: readonly AnswerPosture[],
    activeZones: readonly FitnessZone[],
    choiceProgress: [number, number] = [0, 0],
    activeChoiceIndex: number | null = null,
    cursors?: ReadonlyMap<CursorType, CursorPosition>,
    isFirstQuestion?: boolean,
  ): void {
    if (virtualWidth <= 0 || virtualHeight <= 0) return;

    ctx.save();

    // 1. 활성 피트니스 존 네온 하이라이트 및 중앙 아이콘 렌더링
    if (activeZones && activeZones.length > 0) {
      this._renderZoneHighlights(ctx, virtualWidth, virtualHeight, activeZones, postures, choiceProgress);
    }

    // 2. 답안별 목표 자세 스틱맨 실루엣 렌더링
    if (postures && postures.length > 0) {
      this._renderPostures(ctx, virtualWidth, virtualHeight, postures, choiceProgress, activeChoiceIndex);
    }

    // 3. Issue #160: 스테이지 첫 문제(isFirstQuestion) 유도 화살표 렌더링
    if (isFirstQuestion && this.isHintActive && cursors && cursors.size > 0 && activeZones && activeZones.length > 0) {
      this._renderArrowHints(ctx, virtualWidth, virtualHeight, activeZones, postures, cursors);
    }

    ctx.restore();
  }

  /**
   * 스테이지 첫 문제 커서 -> 목표 존 유도 화살표(Arrow Hint) 렌더링 (Issue #160)
   */
  private _renderArrowHints(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    activeZones: readonly FitnessZone[],
    postures: readonly AnswerPosture[],
    cursors: ReadonlyMap<CursorType, CursorPosition>,
  ): void {
    const fade = Math.min(1, this._hintTimer);
    const pulse = 0.8 + 0.2 * Math.sin(this._pulseTimer * 3);
    const arrowAlpha = fade * pulse;
    if (arrowAlpha <= 0.01) return;

    const renderedPairs = new Set<string>();

    for (const posture of postures) {
      for (let i = 0; i < posture.parts.length; i++) {
        const part = posture.parts[i];
        const zoneId = posture.zoneIds[i];
        if (!part || zoneId === undefined) continue;

        const pairKey = `${part}_${zoneId}`;
        if (renderedPairs.has(pairKey)) continue;

        const cursor = cursors.get(part as CursorType);
        if (!cursor) continue;

        const zone = activeZones.find((z) => z.id === zoneId);
        if (!zone) continue;

        // 커서 좌표 정규화 판정
        const normX = cursor.x > 1 ? cursor.x / vw : cursor.x;
        const normY = cursor.y > 1 ? cursor.y / vh : cursor.y;

        // 커서가 이미 목표 존 내부에 진입한 경우 화살표 생략 (즉시 소멸)
        const isInside =
          normX >= zone.x &&
          normX <= zone.x + zone.width &&
          normY >= zone.y &&
          normY <= zone.y + zone.height;

        if (isInside) continue;

        renderedPairs.add(pairKey);

        const startX = normX * vw;
        const startY = normY * vh;
        const targetX = (zone.x + zone.width / 2) * vw;
        const targetY = (zone.y + zone.height / 2) * vh;

        const dist = Math.hypot(targetX - startX, targetY - startY);
        if (dist < 40) continue;

        const angle = Math.atan2(targetY - startY, targetX - startX);
        const partColor = CURSOR_COLORS[part as CursorType] ?? '#28E6FF';

        ctx.save();
        ctx.globalAlpha = arrowAlpha;
        ctx.shadowColor = partColor;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = partColor;
        ctx.fillStyle = partColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 화살표 끝점을 존 경계 근처로 조정
        const zoneInset = Math.min(zone.width * vw, zone.height * vh) * 0.28;
        const endX = targetX - Math.cos(angle) * zoneInset;
        const endY = targetY - Math.sin(angle) * zoneInset;

        // 1. 점선 애니메이션 샤프트 드로잉
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([14, 8]);
          ctx.lineDashOffset = -this._pulseTimer * 45;
        }
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 2. 화살표 머리 드로잉 (닫힌 삼각형)
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([]);
        }
        const headLen = 22;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          endX - headLen * 0.6 * Math.cos(angle),
          endY - headLen * 0.6 * Math.sin(angle),
        );
        ctx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }
  }

  /**
   * 활성 목표 존 네온 하이라이트 테두리 및 중앙 부위 아이콘 렌더링
   */
  private _renderZoneHighlights(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    activeZones: readonly FitnessZone[],
    postures: readonly AnswerPosture[],
    choiceProgress: [number, number],
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin(this._pulseTimer);

    for (const zone of activeZones) {
      const zx = zone.x * vw;
      const zy = zone.y * vh;
      const zw = zone.width * vw;
      const zh = zone.height * vh;
      const cx = zx + zw / 2;
      const cy = zy + zh / 2;

      // 해당 존을 요구하는 부위 목록 및 최고 진행도 집계
      const targetedParts: BodyPart[] = [];
      let maxProg = 0;

      for (let pi = 0; pi < postures.length; pi++) {
        const posture = postures[pi];
        const prog = choiceProgress[pi] ?? 0;
        for (let i = 0; i < posture.zoneIds.length; i++) {
          if (posture.zoneIds[i] === zone.id) {
            const part = posture.parts[i];
            if (part && !targetedParts.includes(part)) {
              targetedParts.push(part);
            }
            if (prog > maxProg) maxProg = prog;
          }
        }
      }

      if (targetedParts.length === 0) continue;

      const isEngaged = maxProg > 0;
      const primaryPart = targetedParts[0];
      const partColor = CURSOR_COLORS[primaryPart as CursorType] ?? '#28E6FF';

      ctx.save();

      // Issue #173: 피트니스 존 사각 박스 화면 드로잉 제거 (기본값 false, 가상 영역화)
      if (this.renderZoneBoxes) {
        // 외부 네온 글로우 테두리
        ctx.shadowColor = partColor;
        ctx.shadowBlur = isEngaged ? 24 : 12 + 6 * pulse;
        ctx.strokeStyle = partColor;
        ctx.lineWidth = isEngaged ? 5 : 3.5;

        const cornerRadius = 14;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(zx, zy, zw, zh, cornerRadius);
        } else {
          ctx.rect(zx, zy, zw, zh);
        }
        ctx.stroke();

        // 내부 은은한 반투명 색상 틴트
        ctx.fillStyle = partColor;
        ctx.globalAlpha = isEngaged ? 0.22 : 0.08 + 0.04 * pulse;
        ctx.fill();
      }

      // 존 중앙 부위 벡터 아이콘 렌더링
      ctx.shadowBlur = 0;
      ctx.globalAlpha = isEngaged ? 1.0 : 0.7 + 0.2 * pulse;
      const iconSize = Math.min(zw, zh) * 0.38;

      if (targetedParts.length === 1) {
        PartIconRenderer.drawIcon(ctx, primaryPart as CursorType, cx, cy, iconSize, {
          mode: 'both',
          color: partColor,
          alpha: isEngaged ? 1.0 : 0.8,
          glow: true,
        });
      } else {
        // 복수 부위가 같은 존에 배정된 경우 가로 배치
        const spacing = iconSize * 1.1;
        const totalW = targetedParts.length * spacing;
        const startX = cx - totalW / 2 + spacing / 2;
        targetedParts.forEach((part, idx) => {
          const pColor = CURSOR_COLORS[part as CursorType] ?? '#ffffff';
          PartIconRenderer.drawIcon(ctx, part as CursorType, startX + idx * spacing, cy, iconSize * 0.8, {
            mode: 'both',
            color: pColor,
            alpha: isEngaged ? 1.0 : 0.8,
            glow: true,
          });
        });
      }

      ctx.restore();
    }
  }

  /**
   * 답안별 목표 자세 스틱맨 실루엣 렌더링
   */
  private _renderPostures(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    postures: readonly AnswerPosture[],
    choiceProgress: [number, number],
    activeChoiceIndex: number | null,
  ): void {
    const defaultPositions: SilhouettePosition[] = [
      { x: vw * 0.28, y: vh * 0.58 },
      { x: vw * 0.72, y: vh * 0.58 },
    ];

    const silhouetteH = Math.min(vw * 0.24, vh * 0.13, 240);

    for (let i = 0; i < postures.length; i++) {
      const posture = postures[i];
      const prog = choiceProgress[i] ?? 0;
      const isHighlighted = prog > 0 || activeChoiceIndex === i;

      const pos = this._customPositions && this._customPositions[i]
        ? this._customPositions[i]
        : (defaultPositions[i] ?? { x: vw * 0.5, y: vh * 0.5 });

      this._drawStickman(ctx, pos.x, pos.y, silhouetteH, posture, isHighlighted, prog, i);
    }
  }

  /**
   * 단일 자세 스틱맨 실루엣 드로잉
   */
  private _drawStickman(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    height: number,
    posture: AnswerPosture,
    isHighlighted: boolean,
    progress: number,
    choiceIndex: number,
  ): void {
    ctx.save();

    const H = height;
    const pulse = 0.5 + 0.5 * Math.sin(this._pulseTimer);
    const alpha = isHighlighted ? 0.95 : 0.40;

    ctx.globalAlpha = alpha;

    // 부위별 목표 존 매핑
    const partMap: Partial<Record<BodyPart, number>> = {};
    for (let i = 0; i < posture.parts.length; i++) {
      const part = posture.parts[i];
      const zoneId = posture.zoneIds[i];
      if (part && zoneId !== undefined) {
        partMap[part] = zoneId;
      }
    }

    // ── 관절 좌표 산출 ──
    const headZone = partMap.head;
    const hipZone = partMap.hip;
    const leftHandZone = partMap.leftHand;
    const rightHandZone = partMap.rightHand;

    // 1. 골반 / 코어 (Hip)
    let hipOffsetY = 0;
    let hipOffsetX = 0;
    if (hipZone !== undefined) {
      if ([7, 10].includes(hipZone)) {
        hipOffsetY = H * 0.12; // 스쿼트 하강
      } else if ([6, 9].includes(hipZone)) {
        hipOffsetX = -H * 0.08;
        hipOffsetY = H * 0.06;
      } else if ([8, 11].includes(hipZone)) {
        hipOffsetX = H * 0.08;
        hipOffsetY = H * 0.06;
      }
    }
    const pelvis = { x: cx + hipOffsetX, y: cy + H * 0.10 + hipOffsetY };

    // 2. 척추 및 목 (Neck)
    const neck = { x: cx + hipOffsetX * 0.4, y: cy - H * 0.22 + hipOffsetY * 0.4 };

    // 3. 머리 (Head)
    let headOffsetX = 0;
    if (headZone === 4) headOffsetX = -H * 0.09; // 좌측 기울임
    if (headZone === 5) headOffsetX = H * 0.09;  // 우측 기울임
    const head = { x: cx + headOffsetX, y: neck.y - H * 0.14 };
    const headRadius = H * 0.09;

    // 4. 어깨 (Shoulders)
    const shoulderWidth = H * 0.32;
    const leftShoulder = { x: neck.x - shoulderWidth / 2, y: neck.y + H * 0.03 };
    const rightShoulder = { x: neck.x + shoulderWidth / 2, y: neck.y + H * 0.03 };

    // 5. 골반 좌우 (Hips)
    const hipWidth = H * 0.22;
    const leftHip = { x: pelvis.x - hipWidth / 2, y: pelvis.y };
    const rightHip = { x: pelvis.x + hipWidth / 2, y: pelvis.y };

    // 6. 다리 (Legs - 스쿼트 시 무릎 굽힘)
    const isSquat = hipOffsetY > 0;
    const kneeSpread = isSquat ? H * 0.20 : H * 0.11;
    const leftKnee = { x: leftHip.x - kneeSpread * 0.5, y: pelvis.y + (isSquat ? H * 0.16 : H * 0.22) };
    const rightKnee = { x: rightHip.x + kneeSpread * 0.5, y: pelvis.y + (isSquat ? H * 0.16 : H * 0.22) };
    const leftFoot = { x: leftHip.x - H * 0.08, y: cy + H * 0.50 };
    const rightFoot = { x: rightHip.x + H * 0.08, y: cy + H * 0.50 };

    // 7. 팔 관절 계산 (Left / Right Arm)
    const leftArm = this._calculateArmJoints(leftShoulder, leftHandZone, 'left', H);
    const rightArm = this._calculateArmJoints(rightShoulder, rightHandZone, 'right', H);

    // ── 실루엣 배경 후광 (강조 시) ──
    if (isHighlighted) {
      ctx.save();
      if (typeof ctx.createRadialGradient === 'function') {
        const auraGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, H * 0.65);
        auraGrad.addColorStop(0, 'rgba(40, 230, 255, 0.22)');
        auraGrad.addColorStop(1, 'rgba(40, 230, 255, 0)');
        ctx.fillStyle = auraGrad;
      } else {
        ctx.fillStyle = 'rgba(40, 230, 255, 0.15)';
      }
      ctx.beginPath();
      ctx.arc(cx, cy, H * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── 뼈대 연결선 드로잉 ──
    ctx.lineWidth = isHighlighted ? 4.5 : 3.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isHighlighted ? 'rgba(255, 255, 255, 0.85)' : 'rgba(200, 220, 255, 0.45)';

    if (isHighlighted) {
      ctx.shadowColor = 'rgba(40, 230, 255, 0.8)';
      ctx.shadowBlur = 12 + 6 * pulse;
    }

    // 몸통 / 척추
    this._drawLine(ctx, neck, pelvis);
    // 어깨 선
    this._drawLine(ctx, leftShoulder, rightShoulder);
    // 골반 선
    this._drawLine(ctx, leftHip, rightHip);
    // 왼팔
    this._drawLine(ctx, leftShoulder, leftArm.elbow);
    this._drawLine(ctx, leftArm.elbow, leftArm.hand);
    // 오른팔
    this._drawLine(ctx, rightShoulder, rightArm.elbow);
    this._drawLine(ctx, rightArm.elbow, rightArm.hand);
    // 다리
    this._drawLine(ctx, leftHip, leftKnee);
    this._drawLine(ctx, leftKnee, leftFoot);
    this._drawLine(ctx, rightHip, rightKnee);
    this._drawLine(ctx, rightKnee, rightFoot);

    // ── 신체 관절 노드 (4색 시그니처 색상 적용) ──
    // 머리 관절
    const headColor = headZone !== undefined ? CURSOR_COLORS.head : '#ffffff';
    ctx.fillStyle = headColor;
    ctx.strokeStyle = headColor;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
    if (headZone !== undefined) {
      ctx.fill();
    } else {
      ctx.stroke();
    }

    // 골반 관절
    const hipColor = hipZone !== undefined ? CURSOR_COLORS.hip : '#ffffff';
    this._drawDiamond(ctx, pelvis.x, pelvis.y, H * 0.08, hipColor, hipZone !== undefined);

    // 왼손 관절
    const leftHandColor = leftHandZone !== undefined ? CURSOR_COLORS.leftHand : '#ffffff';
    ctx.fillStyle = leftHandColor;
    ctx.beginPath();
    ctx.arc(leftArm.hand.x, leftArm.hand.y, H * 0.045, 0, Math.PI * 2);
    ctx.fill();

    // 오른손 관절
    const rightHandColor = rightHandZone !== undefined ? CURSOR_COLORS.rightHand : '#ffffff';
    ctx.fillStyle = rightHandColor;
    ctx.beginPath();
    ctx.arc(rightArm.hand.x, rightArm.hand.y, H * 0.045, 0, Math.PI * 2);
    ctx.fill();

    // 답안 번호 배지 안내
    ctx.shadowBlur = 0;
    ctx.font = `bold ${Math.round(H * 0.11)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHighlighted ? '#4DFFAA' : '#AAAAAA';
    ctx.fillText(`답안 [${choiceIndex + 1}]`, cx, cy + H * 0.62);

    // 체류 진행도 표시 (진행도 > 0인 경우 하단 게이지 바)
    if (progress > 0 && typeof ctx.fillRect === 'function') {
      const barW = H * 0.5;
      const barH = 6;
      const barY = cy + H * 0.72;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(cx - barW / 2, barY, barW, barH);
      ctx.fillStyle = '#4DFFAA';
      ctx.fillRect(cx - barW / 2, barY, barW * Math.min(1, progress), barH);
    }

    ctx.restore();
  }

  /**
   * 팔 관절(팔꿈치, 손) 대상 존별 자연스러운 배치 계산
   */
  private _calculateArmJoints(
    shoulder: { x: number; y: number },
    zoneId: number | undefined,
    side: 'left' | 'right',
    H: number,
  ): { elbow: { x: number; y: number }; hand: { x: number; y: number } } {
    const isLeft = side === 'left';
    const sign = isLeft ? -1 : 1;

    // 미배정 시 차렷/기본 자세
    if (zoneId === undefined) {
      return {
        elbow: { x: shoulder.x + sign * H * 0.06, y: shoulder.y + H * 0.14 },
        hand: { x: shoulder.x + sign * H * 0.08, y: shoulder.y + H * 0.28 },
      };
    }

    switch (zoneId) {
      case 1: // 좌상
        return isLeft
          ? { elbow: { x: shoulder.x - H * 0.16, y: shoulder.y - H * 0.15 }, hand: { x: shoulder.x - H * 0.25, y: shoulder.y - H * 0.32 } }
          : { elbow: { x: shoulder.x - H * 0.05, y: shoulder.y - H * 0.15 }, hand: { x: shoulder.x - H * 0.18, y: shoulder.y - H * 0.30 } }; // 크로스

      case 2: // 상단 만세
        return {
          elbow: { x: shoulder.x + sign * H * 0.04, y: shoulder.y - H * 0.16 },
          hand: { x: shoulder.x + sign * H * 0.06, y: shoulder.y - H * 0.34 },
        };

      case 3: // 우상
        return !isLeft
          ? { elbow: { x: shoulder.x + H * 0.16, y: shoulder.y - H * 0.15 }, hand: { x: shoulder.x + H * 0.25, y: shoulder.y - H * 0.32 } }
          : { elbow: { x: shoulder.x + H * 0.05, y: shoulder.y - H * 0.15 }, hand: { x: shoulder.x + H * 0.18, y: shoulder.y - H * 0.30 } }; // 크로스

      case 4: // 좌
        return isLeft
          ? { elbow: { x: shoulder.x - H * 0.18, y: shoulder.y - H * 0.02 }, hand: { x: shoulder.x - H * 0.32, y: shoulder.y - H * 0.02 } }
          : { elbow: { x: shoulder.x - H * 0.08, y: shoulder.y + H * 0.02 }, hand: { x: shoulder.x - H * 0.22, y: shoulder.y + H * 0.04 } };

      case 5: // 우
        return !isLeft
          ? { elbow: { x: shoulder.x + H * 0.18, y: shoulder.y - H * 0.02 }, hand: { x: shoulder.x + H * 0.32, y: shoulder.y - H * 0.02 } }
          : { elbow: { x: shoulder.x + H * 0.08, y: shoulder.y + H * 0.02 }, hand: { x: shoulder.x + H * 0.22, y: shoulder.y + H * 0.04 } };

      case 6: // 좌하
      case 9:
        return isLeft
          ? { elbow: { x: shoulder.x - H * 0.16, y: shoulder.y + H * 0.16 }, hand: { x: shoulder.x - H * 0.26, y: shoulder.y + H * 0.32 } }
          : { elbow: { x: shoulder.x - H * 0.06, y: shoulder.y + H * 0.16 }, hand: { x: shoulder.x - H * 0.18, y: shoulder.y + H * 0.30 } };

      case 7: // 중하
      case 10:
        return {
          elbow: { x: shoulder.x + sign * H * 0.04, y: shoulder.y + H * 0.18 },
          hand: { x: shoulder.x + sign * H * 0.02, y: shoulder.y + H * 0.34 },
        };

      case 8: // 우하
      case 11:
        return !isLeft
          ? { elbow: { x: shoulder.x + H * 0.16, y: shoulder.y + H * 0.16 }, hand: { x: shoulder.x + H * 0.26, y: shoulder.y + H * 0.32 } }
          : { elbow: { x: shoulder.x + H * 0.06, y: shoulder.y + H * 0.16 }, hand: { x: shoulder.x + H * 0.18, y: shoulder.y + H * 0.30 } };

      default:
        return {
          elbow: { x: shoulder.x + sign * H * 0.06, y: shoulder.y + H * 0.14 },
          hand: { x: shoulder.x + sign * H * 0.08, y: shoulder.y + H * 0.28 },
        };
    }
  }

  private _drawLine(
    ctx: CanvasRenderingContext2D,
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ): void {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  private _drawDiamond(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    isFilled: boolean,
  ): void {
    const half = size / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x - half, y);
    ctx.closePath();

    if (isFilled) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    ctx.restore();
  }
}
