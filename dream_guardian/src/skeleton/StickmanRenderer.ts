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
import type { IAvatarRenderer } from './IAvatarRenderer.js';
import type {
  StickmanConfig,
  StickmanLimbLengths,
  StickmanCapsuleWidth,
} from '../../config/skeleton.config.js';
import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';
import type { BoneAngles, PoseFrame } from '../types/pose-frame.js';
import { PoseAngleSolver, getDefaultBoneAngles } from './pose/PoseAngleSolver.js';

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

export type StickmanAngles = BoneAngles;

export interface StickmanUpdateOptions {
  mirror?: boolean;
  virtualWidth?: number;
  virtualHeight?: number;
  breathScale?: number;
  isRunning?: boolean;
}

export interface StickmanRenderOptions {
  alpha?: number;
  showGroundRing?: boolean;
  showGroundShadow?: boolean;
  showCore?: boolean;
  showVisor?: boolean;
  scale?: number;
  alwaysRender?: boolean;
}

export class StickmanRenderer implements IAvatarRenderer {
  private _config: StickmanConfig;
  private _customScale?: number;
  private _angles: StickmanAngles;
  private _hasValidPose = false;
  private _breathScale = 1.0;
  private _animTimer = 0;
  private _verticalOffset = 0;
  private _baselineHipY = 0.60;
  private _initialized = false;
  private _currentAnchorXRatio: number;
  private _lastPoseFrame?: PoseFrame;
  public isMirrored = true;

  constructor(config: StickmanConfig = STICKMAN_CONFIG) {
    this._config = config;
    this._angles = this._getDefaultAngles();
    this._currentAnchorXRatio = this._config.anchorXRatio;
  }

  get currentAnchorXRatio(): number {
    return this._currentAnchorXRatio;
  }

  get scale(): number {
    return this._customScale ?? this._config.scale ?? 1.0;
  }

  set scale(val: number) {
    this._customScale = Math.max(0.1, val);
    this._config.scale = this._customScale;
  }

  setScale(val: number): void {
    this.scale = val;
  }

  private _getDefaultAngles(): StickmanAngles {
    return getDefaultBoneAngles();
  }

  /** 현재 보간된 관절 회전 각도 조회 */
  getSmoothedAngles(): Readonly<StickmanAngles> {
    return { ...this._angles };
  }

  get hasPose(): boolean {
    return this._hasValidPose;
  }

  /** 가장 최근 계산된 PoseFrame 조회 */
  get lastPoseFrame(): Readonly<PoseFrame> | undefined {
    return this._lastPoseFrame;
  }

  /** 상태 초기화 */
  reset(): void {
    this._angles = this._getDefaultAngles();
    this._hasValidPose = false;
    this._breathScale = 1.0;
    this._animTimer = 0;
    this._verticalOffset = 0;
    this._initialized = false;
    this._currentAnchorXRatio = this._config.anchorXRatio;
    this._lastPoseFrame = undefined;
  }

  /** 포즈 미인식 시 대기/러닝 폴백 애니메이션 업데이트 */
  updateFallback(dt: number, isRunning = false): void {
    this._animTimer += dt;
    this._breathScale = 1.0 + Math.sin(this._animTimer * 3.5) * 0.05;
    const def = this._getDefaultAngles();
    if (isRunning) {
      const runCycle = Math.sin(this._animTimer * 8.0);
      def.leftUpperArm += runCycle * 0.4;
      def.rightUpperArm -= runCycle * 0.4;
      def.leftUpperLeg += runCycle * 0.5;
      def.rightUpperLeg -= runCycle * 0.5;
      // Issue #721: 러닝 폴백 시 종아리가 굳지 않고 허벅지와 연동 스윙
      def.leftLowerLeg += (runCycle > 0 ? runCycle * 0.45 : runCycle * 0.5);
      def.rightLowerLeg -= (runCycle < 0 ? -runCycle * 0.45 : -runCycle * 0.5);
      this._verticalOffset = Math.abs(Math.sin(this._animTimer * 8.0)) * -0.015;
    } else {
      this._verticalOffset = Math.sin(this._animTimer * 2.0) * 0.005;
    }
    this._angles = def;

    // 포즈 미인식 시 기본 anchorXRatio로 서서히 복귀
    const smoothing = this._config.horizontalSmoothing ?? 0.2;
    this._currentAnchorXRatio +=
      (this._config.anchorXRatio - this._currentAnchorXRatio) * (smoothing * 0.5);
  }

  /**
   * 매 프레임 Pose 랜드마크 기반 회전 각도 추출 및 스무딩
   */
  update(
    dt: number,
    landmarks?: readonly NormalizedLandmark[] | null,
    breathScale: number | StickmanUpdateOptions = 1.0,
    options?: StickmanUpdateOptions,
  ): void {
    let actualBreath = 1.0;
    let actualOptions = options;
    if (typeof breathScale === 'number') {
      actualBreath = breathScale;
    } else if (breathScale && typeof breathScale === 'object') {
      actualBreath = breathScale.breathScale ?? 1.0;
      actualOptions = { ...breathScale, ...options };
    }

    this._animTimer += dt;
    this._breathScale = actualBreath;

    const prevFrame: PoseFrame | undefined = this._initialized
      ? {
          rootX: this._currentAnchorXRatio,
          rootY: this._verticalOffset,
          torsoTilt: this._angles.torso,
          boneAngles: this._angles,
          scale: this.scale,
          confidence: this._hasValidPose ? 1.0 : 0.0,
          hasPose: this._hasValidPose,
          baselineHipY: this._baselineHipY,
          verticalOffset: this._verticalOffset,
          anchorXRatio: this._currentAnchorXRatio,
        }
      : undefined;

    const frame = PoseAngleSolver.solve(landmarks, prevFrame, this._config, {
      mirror: actualOptions?.mirror,
      isMirroredMode: this.isMirrored,
      virtualWidth: actualOptions?.virtualWidth,
      virtualHeight: actualOptions?.virtualHeight,
      dt,
      isRunning: actualOptions?.isRunning,
      animTimer: this._animTimer,
    });

    this._hasValidPose = frame.hasPose;
    this._currentAnchorXRatio = frame.rootX;

    if (!frame.hasPose) {
      return;
    }

    this._initialized = true;
    this._baselineHipY = frame.baselineHipY;
    this._verticalOffset = frame.verticalOffset;
    this._angles = frame.boneAngles;
    this._lastPoseFrame = frame;
  }

  /**
   * 고정 비례 순운동학(Fixed-Length FK)을 적용하여 2D 관절 픽셀 좌표 계산
   */
  calculateFKPositions(vw: number, vh: number, customScale?: number): StickmanJointPositions {
    const cfg = this._config;
    const currentScale = customScale ?? this.scale;
    const rawLengths = cfg.limbLengths;
    const lengths: StickmanLimbLengths = {
      torso: rawLengths.torso * currentScale,
      shoulderWidth: rawLengths.shoulderWidth * currentScale,
      hipWidth: rawLengths.hipWidth * currentScale,
      upperArm: rawLengths.upperArm * currentScale,
      forearm: rawLengths.forearm * currentScale,
      upperLeg: rawLengths.upperLeg * currentScale,
      lowerLeg: rawLengths.lowerLeg * currentScale,
      headRadius: rawLengths.headRadius * currentScale,
      neckLength: rawLengths.neckLength * currentScale,
    };
    const angles = this._angles;

    // 1. 화면 중앙 2/3 높이 앵커 (골반 중심, 가로 앵커는 유저 위치와 실시간 동기화)
    const px = vw * this._currentAnchorXRatio;
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
    // 거울 모드 화면 기준: 화면 좌측 = 유저 왼손/왼어깨(시안), 화면 우측 = 유저 오른손/오른어깨(노랑)
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
   * 화이트 클레이 졸라맨(White Clay Stickman) 캔버스 렌더링
   */
  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    options?: StickmanRenderOptions,
  ): void {
    if (!this._hasValidPose && !options?.alwaysRender) return;

    const cfg = this._config;
    const colors = cfg.colors;
    const currentScale = options?.scale ?? this.scale;
    const rawCapsule = cfg.capsuleWidth;
    const capsule: StickmanCapsuleWidth = {
      torso: rawCapsule.torso * currentScale,
      limb: rawCapsule.limb * currentScale,
      limbNeon: rawCapsule.limbNeon * currentScale,
      jointBall: rawCapsule.jointBall * currentScale,
      visorHeight: rawCapsule.visorHeight * currentScale,
    };
    const alpha = options?.alpha ?? 1.0;
    const showGroundShadow = options?.showGroundShadow ?? true;
    const showGroundRing = options?.showGroundRing ?? true;
    const showCore = options?.showCore ?? true;
    const showVisor = options?.showVisor ?? false;

    const fk = this.calculateFKPositions(vw, vh, currentScale);

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. 발밑 부드러운 타원형 앰비언트 접지 그림자 (Soft Drop Shadow)
    if (showGroundShadow) {
      this._renderGroundShadow(ctx, fk.pelvis.x, fk.leftAnkle, fk.rightAnkle, currentScale);
    }

    // 2. 발밑 드림 접지 링 (마법진) 렌더링
    if (showGroundRing) {
      this._renderGroundRing(ctx, fk.pelvis.x, fk.leftAnkle, fk.rightAnkle, currentScale);
    }

    // 3. 다리 (대퇴 & 하퇴 라운드 점토 캡슐)
    this._renderCapsuleLimb(ctx, fk.leftHip, fk.leftKnee, capsule.limb, colors.leftLimb, currentScale);
    this._renderCapsuleLimb(ctx, fk.leftKnee, fk.leftAnkle, capsule.limb, colors.leftLimb, currentScale);
    this._renderCapsuleLimb(ctx, fk.rightHip, fk.rightKnee, capsule.limb, colors.rightLimb, currentScale);
    this._renderCapsuleLimb(ctx, fk.rightKnee, fk.rightAnkle, capsule.limb, colors.rightLimb, currentScale);

    // 4. 몸통 (골반 -> 목 점토 캡슐)
    this._renderTorso(ctx, fk.pelvis, fk.neck, fk.chest, showCore, capsule.torso, currentScale);

    // 5. 팔 (상완 & 전완 라운드 점토 캡슐)
    this._renderCapsuleLimb(ctx, fk.leftShoulder, fk.leftElbow, capsule.limb, colors.leftLimb, currentScale);
    this._renderCapsuleLimb(ctx, fk.leftElbow, fk.leftWrist, capsule.limb, colors.leftLimb, currentScale);
    this._renderCapsuleLimb(ctx, fk.rightShoulder, fk.rightElbow, capsule.limb, colors.rightLimb, currentScale);
    this._renderCapsuleLimb(ctx, fk.rightElbow, fk.rightWrist, capsule.limb, colors.rightLimb, currentScale);

    // 6. 관절 볼 (4색 신체 커서 색상 체계: 어깨 보라, 골반 주황, 왼손 시안, 오른손 노랑)
    this._renderJointBalls(ctx, fk, capsule.jointBall);

    // 7. 순백색 미니멀 구체 점토 머리
    this._renderHead(ctx, fk.head, showVisor, currentScale);

    ctx.restore();
  }

  /** 사지 라운드 캡슐 렌더링 (도톰한 순백색 점토 바디 + 부드러운 입체 하이라이트) */
  private _renderCapsuleLimb(
    ctx: CanvasRenderingContext2D,
    from: StickmanPoint2D,
    to: StickmanPoint2D,
    width: number,
    _accentColor: string,
    scale = 1.0,
  ): void {
    const cfg = this._config;

    ctx.save();
    ctx.lineCap = 'round';

    // 1. 외곽 앰비언트 음영 테두리 (#CBD5E1)
    ctx.lineWidth = width + 2 * scale;
    ctx.strokeStyle = cfg.colors.bodyBorder;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // 2. 순백색 점토 바디 메인 캡슐 (#F8FAFC)
    ctx.lineWidth = width;
    ctx.strokeStyle = cfg.colors.body;
    ctx.stroke();

    // 3. 점토 입체감 부드러운 내부 림라이트/하이라이트 (#FFFFFF 앰비언트)
    ctx.lineWidth = Math.max(4 * scale, cfg.capsuleWidth.limbNeon * scale);
    ctx.strokeStyle = cfg.colors.bodyHighlight ?? 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    ctx.restore();
  }

  /** 몸통 점토 캡슐 및 부드러운 가슴 엠블럼 */
  private _renderTorso(
    ctx: CanvasRenderingContext2D,
    pelvis: StickmanPoint2D,
    neck: StickmanPoint2D,
    chest: StickmanPoint2D,
    showCore: boolean,
    width: number,
    scale = 1.0,
  ): void {
    const cfg = this._config;

    ctx.save();
    ctx.lineCap = 'round';

    // 1. 몸통 외곽 앰비언트 음영 테두리 (#CBD5E1)
    ctx.lineWidth = width + 3 * scale;
    ctx.strokeStyle = cfg.colors.bodyBorder;
    ctx.beginPath();
    ctx.moveTo(pelvis.x, pelvis.y);
    ctx.lineTo(neck.x, neck.y);
    ctx.stroke();

    // 2. 순백색 점토 바디 (#F8FAFC)
    ctx.lineWidth = width;
    ctx.strokeStyle = cfg.colors.body;
    ctx.stroke();

    // 3. 점토 중앙 입체감 하이라이트
    ctx.lineWidth = Math.max(6 * scale, width * 0.35);
    ctx.strokeStyle = cfg.colors.bodyHighlight ?? 'rgba(255, 255, 255, 0.8)';
    ctx.stroke();

    // 4. 가슴 점토 엠블럼 (호흡 펄스 연동 미니멀 파스텔 원형 엠블럼)
    if (showCore) {
      const coreScale = this._breathScale * scale;
      const coreR = 8 * coreScale;

      ctx.save();
      ctx.shadowColor = cfg.colors.coreGlow;
      ctx.shadowBlur = 8;

      // 은은한 파스텔 점토 엠블럼 베이스
      ctx.fillStyle = cfg.colors.bodyShade ?? '#E2E8F0';
      ctx.beginPath();
      ctx.arc(chest.x, chest.y, coreR, 0, Math.PI * 2);
      ctx.fill();

      // 내부 소프트 화이트 하이라이트
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(chest.x - coreR * 0.25, chest.y - coreR * 0.25, coreR * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  /** 관절 볼 렌더링 (4색 신체 커서 색상 체계 계승) */
  private _renderJointBalls(ctx: CanvasRenderingContext2D, fk: StickmanJointPositions, radius: number): void {
    const c = this._config.colors;
    const r = radius;

    const drawBall = (pt: StickmanPoint2D, color: string, rad = r, hasNeonGlow = false) => {
      ctx.save();
      if (hasNeonGlow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 4;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
      ctx.fill();

      // 점토 볼 상단 부드러운 하이라이트
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(pt.x - rad * 0.25, pt.y - rad * 0.25, rad * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    // 어깨 (보라 #C889FF)
    drawBall(fk.leftShoulder, c.shoulderJoint, r * 1.05);
    drawBall(fk.rightShoulder, c.shoulderJoint, r * 1.05);

    // 골반 (주황 #FF865E)
    drawBall(fk.leftHip, c.hipJoint, r * 1.05);
    drawBall(fk.rightHip, c.hipJoint, r * 1.05);
    drawBall(fk.pelvis, c.hipJoint, r * 0.95);

    // 왼팔/왼다리 (시안 #28E6FF)
    drawBall(fk.leftElbow, c.leftLimb, r * 0.95);
    drawBall(fk.leftWrist, c.leftLimb, r * 1.2, true); // 왼손 네온 커서 발광
    drawBall(fk.leftKnee, c.leftLimb, r * 0.95);
    drawBall(fk.leftAnkle, c.leftLimb, r * 0.95);

    // 오른팔/오른다리 (노랑 #FFCB4D)
    drawBall(fk.rightElbow, c.rightLimb, r * 0.95);
    drawBall(fk.rightWrist, c.rightLimb, r * 1.2, true); // 오른손 네온 커서 발광
    drawBall(fk.rightKnee, c.rightLimb, r * 0.95);
    drawBall(fk.rightAnkle, c.rightLimb, r * 0.95);
  }

  /** 순백색 미니멀 구체 점토 머리 (클레이 헤드) */
  private _renderHead(
    ctx: CanvasRenderingContext2D,
    head: StickmanPoint2D,
    showVisor: boolean,
    scale = 1.0,
  ): void {
    const cfg = this._config;
    const r = cfg.limbLengths.headRadius * scale;

    ctx.save();

    // 1. 머리 외곽 앰비언트 음영 테두리 (#CBD5E1)
    ctx.fillStyle = cfg.colors.body;
    ctx.strokeStyle = cfg.colors.bodyBorder;
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. 매끄럽고 둥근 순백색 점토 구체 앰비언트 3D 하이라이트
    const hlX = head.x - r * 0.28;
    const hlY = head.y - r * 0.28;
    const gradient = ctx.createRadialGradient(hlX, hlY, r * 0.05, head.x, head.y, r);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.55, 'rgba(248, 250, 252, 0.7)');
    gradient.addColorStop(1, 'rgba(203, 213, 225, 0.35)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(head.x, head.y, r - 1 * scale, 0, Math.PI * 2);
    ctx.fill();

    // 3. 바이저 슬릿 (showVisor가 true일 때만 하위호환용으로 렌더링)
    if (showVisor) {
      const visorW = r * 1.4;
      const visorH = cfg.capsuleWidth.visorHeight * scale;
      const visorX = head.x - visorW / 2;
      const visorY = head.y - visorH / 2;

      ctx.shadowColor = cfg.colors.visor;
      ctx.shadowBlur = 12 * scale;
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

  /** 발밑 부드러운 타원형 앰비언트 접지 그림자 (Soft Drop Shadow) */
  private _renderGroundShadow(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    leftAnkle: StickmanPoint2D,
    rightAnkle: StickmanPoint2D,
    scale = 1.0,
  ): void {
    // Issue #678: 점프 상승(verticalOffset < 0) 시 지면 그림자 디커플링 (지면에 잔류)
    const airHeight = this._verticalOffset < 0 ? -this._verticalOffset : 0;
    const groundY = Math.max(leftAnkle.y, rightAnkle.y) + 12 * scale + airHeight;

    // 체공 높이에 비례하여 그림자 크기 축소 및 페이드아웃
    const shadowDecay = Math.max(0.35, 1.0 - airHeight / (260 * scale));
    const shadowAlpha = Math.max(0.20, 1.0 - airHeight / (320 * scale));
    const radiusX = 110 * scale * shadowDecay;
    const radiusY = 24 * scale * shadowDecay;

    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * shadowAlpha;
    const shadowColor = this._config.colors.groundShadow || 'rgba(0, 0, 0, 0.28)';

    const gradient = ctx.createRadialGradient(
      centerX,
      groundY,
      radiusX * 0.1,
      centerX,
      groundY,
      radiusX,
    );
    gradient.addColorStop(0, shadowColor);
    gradient.addColorStop(0.65, shadowColor);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(centerX, groundY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 발밑 드림 접지 링 (지면 일체감 마법진) */
  private _renderGroundRing(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    leftAnkle: StickmanPoint2D,
    rightAnkle: StickmanPoint2D,
    scale = 1.0,
  ): void {
    // Issue #678: 점프 상승(verticalOffset < 0) 시 마법진 링 디커플링 (지면에 잔류)
    const airHeight = this._verticalOffset < 0 ? -this._verticalOffset : 0;
    const groundY = Math.max(leftAnkle.y, rightAnkle.y) + 12 * scale + airHeight;
    const ringDecay = Math.max(0.40, 1.0 - airHeight / (300 * scale));
    const ringAlpha = Math.max(0.25, 1.0 - airHeight / (350 * scale));
    const radiusX = 110 * scale * ringDecay;
    const radiusY = 32 * scale * ringDecay;

    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * ringAlpha;
    ctx.shadowColor = this._config.colors.groundRing;
    ctx.shadowBlur = 10 * scale;
    ctx.strokeStyle = this._config.colors.groundRing;
    ctx.lineWidth = 2.5 * scale;

    // 회전 펄스 효과
    const pulse = (Math.sin(this._animTimer * 2.5) * 4) * scale;
    ctx.beginPath();
    ctx.ellipse(centerX, groundY, radiusX + pulse, radiusY + pulse * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 보조 링
    ctx.lineWidth = 1.2 * scale;
    ctx.globalAlpha = ctx.globalAlpha * 0.5;
    ctx.beginPath();
    ctx.ellipse(centerX, groundY, (radiusX + pulse) * 0.7, (radiusY + pulse * 0.3) * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
