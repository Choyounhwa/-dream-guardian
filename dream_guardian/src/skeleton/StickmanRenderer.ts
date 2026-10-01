/**
 * StickmanRenderer - 화면 중앙 2/3 높이 메카 졸라맨(Mecha Stickman) 실시간 모션 아바타 렌더러
 *
 * Issue #203 / FEAT-SKEL-005:
 * - 앙상한 선/점 스켈레톤 대신 도톰한 네온 캡슐과 관절 볼을 갖춘 세련된 메카 졸라맨 아바타
 * - 카메라 왜곡에 영향받지 않는 고정 비례 순운동학(Fixed-Length FK) 엔진
 * - 프레임 간 떨림 방지 각도 스무딩(Angle Damping)
 * - 화면 중앙 2/3 높이(y ≈ 0.60 ~ 0.75) 앵커 배치 및 스쿼트/점프 모션 반응
 * - 가슴 마력 코어(호흡 펄스 연동), 발광 바이저 헬멧, 발밑 접지 마법진 링
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import type { StickmanConfig } from '../../config/skeleton.config.js';
import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';

export interface StickmanPoint2D {
  x: number;
  y: number;
}

export interface StickmanJointPositions {
  pelvis: StickmanPoint2D;
  chest: StickmanPoint2D;
  neck: StickmanPoint2D;
  head: StickmanPoint2D;
  leftShoulder: StickmanPoint2D;
  rightShoulder: StickmanPoint2D;
  leftElbow: StickmanPoint2D;
  rightElbow: StickmanPoint2D;
  leftWrist: StickmanPoint2D;
  rightWrist: StickmanPoint2D;
  leftHip: StickmanPoint2D;
  rightHip: StickmanPoint2D;
  leftKnee: StickmanPoint2D;
  rightKnee: StickmanPoint2D;
  leftAnkle: StickmanPoint2D;
  rightAnkle: StickmanPoint2D;
}

export interface StickmanAngles {
  torso: number;
  head: number;
  leftUpperArm: number;
  leftForearm: number;
  rightUpperArm: number;
  rightForearm: number;
  leftUpperLeg: number;
  leftLowerLeg: number;
  rightUpperLeg: number;
  rightLowerLeg: number;
}

export interface StickmanRenderOptions {
  alpha?: number;
  showGroundRing?: boolean;
  showCore?: boolean;
  showVisor?: boolean;
  scale?: number;
}

function diffAngle(target: number, current: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export class StickmanRenderer {
  private _config: StickmanConfig;
  private _angles: StickmanAngles;
  private _hasValidPose = false;
  private _breathScale = 1.0;
  private _animTimer = 0;
  private _verticalOffset = 0;
  private _baselineHipY = 0.60;
  private _initialized = false;

  constructor(config: StickmanConfig = STICKMAN_CONFIG) {
    this._config = config;
    this._angles = this._getDefaultAngles();
  }

  private _getDefaultAngles(): StickmanAngles {
    return {
      torso: -Math.PI / 2,        // 위쪽 방향 (-90도)
      head: -Math.PI / 2,         // 위쪽 방향 (-90도)
      leftUpperArm: Math.PI * 0.65,  // 좌하단
      leftForearm: Math.PI * 0.75,
      rightUpperArm: Math.PI * 0.35, // 우하단
      rightForearm: Math.PI * 0.25,
      leftUpperLeg: Math.PI * 0.48,  // 하단
      leftLowerLeg: Math.PI * 0.50,
      rightUpperLeg: Math.PI * 0.52, // 하단
      rightLowerLeg: Math.PI * 0.50,
    };
  }

  /** 현재 보간된 관절 회전 각도 조회 */
  getSmoothedAngles(): Readonly<StickmanAngles> {
    return { ...this._angles };
  }

  get hasPose(): boolean {
    return this._hasValidPose;
  }

  /** 상태 초기화 */
  reset(): void {
    this._angles = this._getDefaultAngles();
    this._hasValidPose = false;
    this._breathScale = 1.0;
    this._animTimer = 0;
    this._verticalOffset = 0;
    this._initialized = false;
  }

  /**
   * 매 프레임 Pose 랜드마크 기반 회전 각도 추출 및 스무딩
   */
  update(dt: number, landmarks: readonly NormalizedLandmark[], breathScale = 1.0): void {
    this._animTimer += dt;
    this._breathScale = breathScale;

    if (!landmarks || landmarks.length < 25) {
      this._hasValidPose = false;
      return;
    }

    const ls = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rs = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lh = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rh = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    const minVis = 0.25;
    if (
      (ls?.visibility ?? 0) < minVis ||
      (rs?.visibility ?? 0) < minVis ||
      (lh?.visibility ?? 0) < minVis ||
      (rh?.visibility ?? 0) < minVis
    ) {
      this._hasValidPose = false;
      return;
    }

    this._hasValidPose = true;

    // 1. 기준 랜드마크
    const le = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const re = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const lw = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rw = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const lk = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rk = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const la = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const ra = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const nose = landmarks[POSE_LANDMARKS.NOSE];

    // 2. 스쿼트 / 점프 수직 변위 계산
    const currentHipY = (lh.y + rh.y) / 2;
    if (!this._initialized) {
      this._baselineHipY = currentHipY;
      this._initialized = true;
    } else {
      // 완만한 기준선 적응
      this._baselineHipY += (currentHipY - this._baselineHipY) * 0.01;
    }
    const hipDiff = currentHipY - this._baselineHipY;
    const targetOffset = hipDiff * this._config.squatSensitivity;
    this._verticalOffset += (targetOffset - this._verticalOffset) * 0.25;

    // 3. 목표 관절 각도 계산 (Math.atan2)
    const midShoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
    const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };

    const targetAngles: StickmanAngles = {
      torso: Math.atan2(midShoulder.y - midHip.y, midShoulder.x - midHip.x),
      head: nose ? Math.atan2(nose.y - midShoulder.y, nose.x - midShoulder.x) : -Math.PI / 2,
      leftUpperArm: Math.atan2(le.y - ls.y, le.x - ls.x),
      leftForearm: Math.atan2(lw.y - le.y, lw.x - le.x),
      rightUpperArm: Math.atan2(re.y - rs.y, re.x - rs.x),
      rightForearm: Math.atan2(rw.y - re.y, rw.x - re.x),
      leftUpperLeg: Math.atan2(lk.y - lh.y, lk.x - lh.x),
      leftLowerLeg: Math.atan2(la.y - lk.y, la.x - lk.x),
      rightUpperLeg: Math.atan2(rk.y - rh.y, rk.x - rh.x),
      rightLowerLeg: Math.atan2(ra.y - rk.y, ra.x - rk.x),
    };

    // 4. 각도 스무딩 (Damping)
    const factor = this._config.angleSmoothing;
    for (const key of Object.keys(targetAngles) as Array<keyof StickmanAngles>) {
      const diff = diffAngle(targetAngles[key], this._angles[key]);
      this._angles[key] += diff * factor;
    }
  }

  /**
   * 고정 비례 순운동학(Fixed-Length FK)을 적용하여 2D 관절 픽셀 좌표 계산
   */
  calculateFKPositions(vw: number, vh: number): StickmanJointPositions {
    const cfg = this._config;
    const lengths = cfg.limbLengths;
    const angles = this._angles;

    // 1. 화면 중앙 2/3 높이 앵커 (골반 중심)
    const px = vw * cfg.anchorXRatio;
    const py = vh * cfg.anchorYRatio + this._verticalOffset;
    const pelvis: StickmanPoint2D = { x: px, y: py };

    // 2. 몸통 & 목
    const torsoVec = {
      x: Math.cos(angles.torso) * lengths.torso,
      y: Math.sin(angles.torso) * lengths.torso,
    };
    const neck: StickmanPoint2D = {
      x: pelvis.x + torsoVec.x,
      y: pelvis.y + torsoVec.y,
    };
    const chest: StickmanPoint2D = {
      x: pelvis.x + torsoVec.x * 0.65,
      y: pelvis.y + torsoVec.y * 0.65,
    };

    // 3. 머리 헬멧 중심
    const headVec = {
      x: Math.cos(angles.head) * (lengths.headRadius + lengths.neckLength * 0.5),
      y: Math.sin(angles.head) * (lengths.headRadius + lengths.neckLength * 0.5),
    };
    const head: StickmanPoint2D = {
      x: neck.x + headVec.x,
      y: neck.y + headVec.y,
    };

    // 4. 어깨 (몸통 직교 방향으로 좌우 전개)
    const shoulderNormal = {
      x: -Math.sin(angles.torso),
      y: Math.cos(angles.torso),
    };
    const halfShoulder = lengths.shoulderWidth / 2;
    // 거울 반전 기준: 화면 좌측 = 유저 오른손/오른어깨, 화면 우측 = 유저 왼손/왼어깨
    const leftShoulder: StickmanPoint2D = {
      x: neck.x - shoulderNormal.x * halfShoulder,
      y: neck.y - shoulderNormal.y * halfShoulder,
    };
    const rightShoulder: StickmanPoint2D = {
      x: neck.x + shoulderNormal.x * halfShoulder,
      y: neck.y + shoulderNormal.y * halfShoulder,
    };

    // 5. 팔 (고정 비례 순운동학)
    const leftElbow: StickmanPoint2D = {
      x: leftShoulder.x + Math.cos(angles.leftUpperArm) * lengths.upperArm,
      y: leftShoulder.y + Math.sin(angles.leftUpperArm) * lengths.upperArm,
    };
    const leftWrist: StickmanPoint2D = {
      x: leftElbow.x + Math.cos(angles.leftForearm) * lengths.forearm,
      y: leftElbow.y + Math.sin(angles.leftForearm) * lengths.forearm,
    };

    const rightElbow: StickmanPoint2D = {
      x: rightShoulder.x + Math.cos(angles.rightUpperArm) * lengths.upperArm,
      y: rightShoulder.y + Math.sin(angles.rightUpperArm) * lengths.upperArm,
    };
    const rightWrist: StickmanPoint2D = {
      x: rightElbow.x + Math.cos(angles.rightForearm) * lengths.forearm,
      y: rightElbow.y + Math.sin(angles.rightForearm) * lengths.forearm,
    };

    // 6. 골반 좌우 및 다리
    const halfHip = lengths.hipWidth / 2;
    const leftHip: StickmanPoint2D = {
      x: pelvis.x - shoulderNormal.x * halfHip,
      y: pelvis.y - shoulderNormal.y * halfHip,
    };
    const rightHip: StickmanPoint2D = {
      x: pelvis.x + shoulderNormal.x * halfHip,
      y: pelvis.y + shoulderNormal.y * halfHip,
    };

    const leftKnee: StickmanPoint2D = {
      x: leftHip.x + Math.cos(angles.leftUpperLeg) * lengths.upperLeg,
      y: leftHip.y + Math.sin(angles.leftUpperLeg) * lengths.upperLeg,
    };
    const leftAnkle: StickmanPoint2D = {
      x: leftKnee.x + Math.cos(angles.leftLowerLeg) * lengths.lowerLeg,
      y: leftKnee.y + Math.sin(angles.leftLowerLeg) * lengths.lowerLeg,
    };

    const rightKnee: StickmanPoint2D = {
      x: rightHip.x + Math.cos(angles.rightUpperLeg) * lengths.upperLeg,
      y: rightHip.y + Math.sin(angles.rightUpperLeg) * lengths.upperLeg,
    };
    const rightAnkle: StickmanPoint2D = {
      x: rightKnee.x + Math.cos(angles.rightLowerLeg) * lengths.lowerLeg,
      y: rightKnee.y + Math.sin(angles.rightLowerLeg) * lengths.lowerLeg,
    };

    return {
      pelvis,
      chest,
      neck,
      head,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
    };
  }

  /**
   * 메카 졸라맨 캔버스 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    options?: StickmanRenderOptions,
  ): void {
    if (!this._hasValidPose) return;

    const cfg = this._config;
    const colors = cfg.colors;
    const capsule = cfg.capsuleWidth;
    const alpha = options?.alpha ?? 1.0;
    const showGroundRing = options?.showGroundRing ?? true;
    const showCore = options?.showCore ?? true;
    const showVisor = options?.showVisor ?? true;

    const fk = this.calculateFKPositions(vw, vh);

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. 발밑 드림 접지 링 (마법진) 렌더링
    if (showGroundRing) {
      this._renderGroundRing(ctx, fk.pelvis.x, fk.leftAnkle, fk.rightAnkle);
    }

    // 2. 다리 (대퇴 & 하퇴 라운드 캡슐)
    this._renderCapsuleLimb(ctx, fk.leftHip, fk.leftKnee, capsule.limb, colors.leftLimb);
    this._renderCapsuleLimb(ctx, fk.leftKnee, fk.leftAnkle, capsule.limb, colors.leftLimb);
    this._renderCapsuleLimb(ctx, fk.rightHip, fk.rightKnee, capsule.limb, colors.rightLimb);
    this._renderCapsuleLimb(ctx, fk.rightKnee, fk.rightAnkle, capsule.limb, colors.rightLimb);

    // 3. 몸통 (골반 -> 목 메카 역삼각 캡슐)
    this._renderTorso(ctx, fk.pelvis, fk.neck, fk.chest, showCore);

    // 4. 팔 (상완 & 전완 라운드 캡슐)
    this._renderCapsuleLimb(ctx, fk.leftShoulder, fk.leftElbow, capsule.limb, colors.leftLimb);
    this._renderCapsuleLimb(ctx, fk.leftElbow, fk.leftWrist, capsule.limb, colors.leftLimb);
    this._renderCapsuleLimb(ctx, fk.rightShoulder, fk.rightElbow, capsule.limb, colors.rightLimb);
    this._renderCapsuleLimb(ctx, fk.rightElbow, fk.rightWrist, capsule.limb, colors.rightLimb);

    // 5. 4색 발광 관절 볼 (왼손 시안, 오른손 노랑, 어깨 보라, 골반 주황)
    this._renderJointBalls(ctx, fk);

    // 6. 머리 헬멧 및 발광 네온 바이저
    this._renderHead(ctx, fk.head, showVisor);

    ctx.restore();
  }

  /** 사지 라운드 캡슐 렌더링 (다크 바디 + 네온 악센트 라인) */
  private _renderCapsuleLimb(
    ctx: CanvasRenderingContext2D,
    from: StickmanPoint2D,
    to: StickmanPoint2D,
    width: number,
    neonColor: string,
  ): void {
    const cfg = this._config;

    // 외곽 외피 캡슐 (다크 네이비)
    ctx.lineCap = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = cfg.colors.body;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // 캡슐 테두리 윤곽
    ctx.lineWidth = width + 2;
    ctx.strokeStyle = cfg.colors.bodyBorder;
    ctx.stroke();

    // 캡슐 내부 네온 발광 라인
    ctx.save();
    ctx.lineWidth = cfg.capsuleWidth.limbNeon;
    ctx.strokeStyle = neonColor;
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  /** 몸통 캡슐 및 마력 코어 */
  private _renderTorso(
    ctx: CanvasRenderingContext2D,
    pelvis: StickmanPoint2D,
    neck: StickmanPoint2D,
    chest: StickmanPoint2D,
    showCore: boolean,
  ): void {
    const cfg = this._config;
    const width = cfg.capsuleWidth.torso;

    // 몸통 외피
    ctx.lineCap = 'round';
    ctx.lineWidth = width + 3;
    ctx.strokeStyle = cfg.colors.bodyBorder;
    ctx.beginPath();
    ctx.moveTo(pelvis.x, pelvis.y);
    ctx.lineTo(neck.x, neck.y);
    ctx.stroke();

    ctx.lineWidth = width;
    ctx.strokeStyle = cfg.colors.body;
    ctx.stroke();

    // 중앙 발광 마력 코어 (호흡 펄스 연동)
    if (showCore) {
      const coreScale = this._breathScale;
      const coreR = 8 * coreScale;

      ctx.save();
      ctx.shadowColor = cfg.colors.coreGlow;
      ctx.shadowBlur = 14;

      // 외곽 마력 링
      ctx.strokeStyle = cfg.colors.core;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(chest.x, chest.y, coreR + 4, 0, Math.PI * 2);
      ctx.stroke();

      // 중심 코어 (다이아몬드)
      ctx.fillStyle = cfg.colors.core;
      ctx.beginPath();
      ctx.moveTo(chest.x, chest.y - coreR);
      ctx.lineTo(chest.x + coreR, chest.y);
      ctx.lineTo(chest.x, chest.y + coreR);
      ctx.lineTo(chest.x - coreR, chest.y);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  /** 관절 볼 렌더링 (4색 신체 커서 색상 체계 계승) */
  private _renderJointBalls(ctx: CanvasRenderingContext2D, fk: StickmanJointPositions): void {
    const cfg = this._config;
    const r = cfg.capsuleWidth.jointBall;
    const c = cfg.colors;

    const drawBall = (pt: StickmanPoint2D, color: string, radius = r) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // 어깨 (보라 #C889FF)
    drawBall(fk.leftShoulder, c.shoulderJoint, r * 1.1);
    drawBall(fk.rightShoulder, c.shoulderJoint, r * 1.1);

    // 골반 (주황 #FF865E)
    drawBall(fk.leftHip, c.hipJoint, r * 1.05);
    drawBall(fk.rightHip, c.hipJoint, r * 1.05);
    drawBall(fk.pelvis, c.hipJoint, r * 0.9);

    // 왼팔/왼다리 (시안 #28E6FF)
    drawBall(fk.leftElbow, c.leftLimb);
    drawBall(fk.leftWrist, c.leftLimb, r * 1.15);
    drawBall(fk.leftKnee, c.leftLimb);
    drawBall(fk.leftAnkle, c.leftLimb, r * 0.95);

    // 오른팔/오른다리 (노랑 #FFCB4D)
    drawBall(fk.rightElbow, c.rightLimb);
    drawBall(fk.rightWrist, c.rightLimb, r * 1.15);
    drawBall(fk.rightKnee, c.rightLimb);
    drawBall(fk.rightAnkle, c.rightLimb, r * 0.95);
  }

  /** 머리 헬멧 및 발광 바이저 슬릿 */
  private _renderHead(
    ctx: CanvasRenderingContext2D,
    head: StickmanPoint2D,
    showVisor: boolean,
  ): void {
    const cfg = this._config;
    const r = cfg.limbLengths.headRadius;

    ctx.save();

    // 1. 헬멧 외형 (라운드 캡슐형 구체)
    ctx.fillStyle = cfg.colors.body;
    ctx.strokeStyle = cfg.colors.bodyBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. 가로 발광 네온 바이저 슬릿 (보라 #C889FF)
    if (showVisor) {
      const visorW = r * 1.4;
      const visorH = cfg.capsuleWidth.visorHeight;
      const visorX = head.x - visorW / 2;
      const visorY = head.y - visorH / 2;

      ctx.shadowColor = cfg.colors.visor;
      ctx.shadowBlur = 12;
      ctx.fillStyle = cfg.colors.visor;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(visorX, visorY, visorW, visorH, visorH / 2);
      } else {
        ctx.rect(visorX, visorY, visorW, visorH);
      }
      ctx.fill();
    }

    ctx.restore();
  }

  /** 발밑 드림 접지 링 (지면 일체감 마법진) */
  private _renderGroundRing(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    leftAnkle: StickmanPoint2D,
    rightAnkle: StickmanPoint2D,
  ): void {
    const groundY = Math.max(leftAnkle.y, rightAnkle.y) + 12;
    const radiusX = 110;
    const radiusY = 32;

    ctx.save();
    ctx.shadowColor = this._config.colors.groundRing;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = this._config.colors.groundRing;
    ctx.lineWidth = 2.5;

    // 회전 펄스 효과
    const pulse = Math.sin(this._animTimer * 2.5) * 4;
    ctx.beginPath();
    ctx.ellipse(centerX, groundY, radiusX + pulse, radiusY + pulse * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 보조 링
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(centerX, groundY, (radiusX + pulse) * 0.7, (radiusY + pulse * 0.3) * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
