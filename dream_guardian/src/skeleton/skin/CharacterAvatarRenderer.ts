/**
 * CharacterAvatarRenderer - 부위별 PNG 캐릭터 스킨 및 아바타 렌더러
 *
 * Issue #685 / FEAT-SKIN-001:
 * - IAvatarRenderer 공통 인터페이스 구현
 * - PoseFrame × CharacterRig × RigSolver 순운동학(FK) 기반 부위별 PNG 파츠 렌더링
 * - zOrder 레이어 정렬 및 pivot/offset 변환
 * - 이미지 미로딩/누락 시 스틱맨 캡슐 안전 폴백(Fallback)
 * - 정렬 정책 A안(분리 표시): 4색 커서는 아바타가 그리지 않고 최상단 HUD 레이어에서 원본 랜드마크 유지
 */

import type { NormalizedLandmark } from '../../types/index.js';
import type { IAvatarRenderer } from '../IAvatarRenderer.js';
import type { CharacterRig } from '../../types/character-rig.js';
import type { CharacterSkin, SkinPartDef } from '../../types/character-skin.js';
import type { PoseFrame } from '../../types/pose-frame.js';
import { PoseAngleSolver } from '../pose/PoseAngleSolver.js';
import { RigSolver, type BoneTransform } from '../rig/RigSolver.js';
import { SecondaryMotion } from '../rig/SecondaryMotion.js';
import { skinPartLoader, SkinPartLoader } from './SkinPartLoader.js';
import { STICKMAN_CONFIG, type StickmanConfig } from '../../../config/skeleton.config.js';

export interface CharacterAvatarRenderOptions {
  alpha?: number;
  showGroundShadow?: boolean;
  showGroundRing?: boolean;
  scale?: number;
  alwaysRender?: boolean;
}

export class CharacterAvatarRenderer implements IAvatarRenderer {
  private _rig: CharacterRig;
  private _skin?: CharacterSkin;
  private _config: StickmanConfig;
  private _customScale?: number;
  private _hasValidPose = false;
  private _currentAnchorXRatio: number;
  private _animTimer = 0;
  private _lastPoseFrame?: PoseFrame;
  private _boneTransforms: BoneTransform[] = [];
  private _partLoader: SkinPartLoader;
  private _secondaryMotion = new SecondaryMotion();

  constructor(
    rig: CharacterRig,
    skin?: CharacterSkin,
    config: StickmanConfig = STICKMAN_CONFIG,
    loader: SkinPartLoader = skinPartLoader
  ) {
    this._rig = rig;
    this._skin = skin;
    this._config = config;
    this._partLoader = loader;
    this._currentAnchorXRatio = config.anchorXRatio ?? 0.5;
  }

  get scale(): number {
    return this._customScale ?? this._config.scale ?? 1.5;
  }

  set scale(val: number) {
    this._customScale = Math.max(0.1, val);
  }

  setScale(val: number): void {
    this.scale = val;
  }

  get hasPose(): boolean {
    return this._hasValidPose;
  }

  get currentAnchorXRatio(): number {
    return this._currentAnchorXRatio;
  }

  get boneTransforms(): readonly BoneTransform[] {
    return this._boneTransforms;
  }

  get lastPoseFrame(): Readonly<PoseFrame> | undefined {
    return this._lastPoseFrame;
  }

  /** 리그 또는 스킨 교체 */
  setRig(rig: CharacterRig): void {
    this._rig = rig;
  }

  setSkin(skin?: CharacterSkin): void {
    this._skin = skin;
  }

  /** 상태 초기화 */
  reset(): void {
    this._hasValidPose = false;
    this._animTimer = 0;
    this._lastPoseFrame = undefined;
    this._boneTransforms = [];
    this._secondaryMotion.reset();
    this._currentAnchorXRatio = this._config.anchorXRatio ?? 0.5;
  }

  /** 포즈 미인식 시 대기/러닝 폴백 업데이트 */
  updateFallback(dt: number, isRunning = false): void {
    this._animTimer += dt;
    this._hasValidPose = false;

    // 포즈 미인식 시 기본 프레임 계산
    const frame = PoseAngleSolver.solve(null, this._lastPoseFrame, this._config, {
      isRunning,
      animTimer: this._animTimer,
      dt,
    });
    this._lastPoseFrame = frame;
    this._currentAnchorXRatio = frame.rootX;

    const parentAngles: Record<string, number> = {};
    for (const b of this._rig.bones) {
      if (b.driver === 'pose' && b.poseSource && frame.boneAngles[b.poseSource] !== undefined) {
        parentAngles[b.id] = frame.boneAngles[b.poseSource];
      }
    }
    const physicsAngles = this._secondaryMotion.update(dt, this._rig, parentAngles);

    this._boneTransforms = RigSolver.solve(frame, this._rig, {
      scale: this.scale,
      anchorYRatio: this._config.anchorYRatio,
      physicsAngles,
    });
  }

  /** 프레임별 포즈 랜드마크 기반 아바타 갱신 */
  update(
    dt: number,
    poseLandmarks?: readonly NormalizedLandmark[] | null,
    options?: any
  ): void {
    this._animTimer += dt;

    const frame = PoseAngleSolver.solve(
      poseLandmarks,
      this._lastPoseFrame,
      this._config,
      {
        mirror: options?.mirror,
        virtualWidth: options?.virtualWidth,
        virtualHeight: options?.virtualHeight,
        isRunning: options?.isRunning,
        animTimer: this._animTimer,
        dt,
      }
    );

    this._hasValidPose = frame.hasPose;
    this._currentAnchorXRatio = frame.rootX;
    this._lastPoseFrame = frame;

    const parentAngles: Record<string, number> = {};
    for (const b of this._rig.bones) {
      if (b.driver === 'pose' && b.poseSource && frame.boneAngles[b.poseSource] !== undefined) {
        parentAngles[b.id] = frame.boneAngles[b.poseSource];
      }
    }
    const physicsAngles = this._secondaryMotion.update(dt, this._rig, parentAngles);

    this._boneTransforms = RigSolver.solve(frame, this._rig, {
      virtualWidth: options?.virtualWidth,
      virtualHeight: options?.virtualHeight,
      anchorYRatio: this._config.anchorYRatio,
      scale: options?.scale ?? this.scale,
      physicsAngles,
    });
  }

  /** 캔버스 렌더링 */
  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    options?: CharacterAvatarRenderOptions
  ): void {
    if (!this._hasValidPose && !options?.alwaysRender) return;
    if (this._boneTransforms.length === 0) return;

    const currentScale = options?.scale ?? this.scale;
    const alpha = options?.alpha ?? 1.0;
    const transformMap = RigSolver.toMap(this._boneTransforms);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1.0, ctx.globalAlpha * alpha));

    // 1. 발밑 접지 그림자 (Ground Decoupling)
    const showGroundShadow = options?.showGroundShadow ?? true;
    if (showGroundShadow) {
      this._renderGroundShadow(ctx, vw, vh, currentScale);
    }

    // 2. 부위별 PNG 파츠 또는 캡슐 폴백 렌더링
    if (this._skin && this._skin.parts && this._skin.parts.length > 0) {
      this._renderSkinParts(ctx, transformMap, currentScale);
    } else {
      this._renderFallbackBones(ctx, this._boneTransforms, currentScale);
    }

    ctx.restore();
  }

  /** 스킨 파츠를 zOrder 순서대로 렌더링 */
  private _renderSkinParts(
    ctx: CanvasRenderingContext2D,
    transformMap: Record<string, BoneTransform>,
    scale: number
  ): void {
    if (!this._skin) return;

    // zOrder 오름차순 정렬
    const sortedParts = [...this._skin.parts].sort(
      (a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0)
    );

    for (const part of sortedParts) {
      const transform = transformMap[part.boneId];
      if (!transform) continue;

      const img = this._partLoader.getImage(this._skin.id, part.file);

      if (img) {
        this._renderImagePart(ctx, transform, part, img, scale);
      } else {
        // 이미지 미로딩 시 해당 본만 캡슐 폴백
        this._renderCapsuleBone(ctx, transform, scale);
      }
    }
  }

  /** 단일 PNG 파츠 이미지 회전/피벗 렌더링 */
  private _renderImagePart(
    ctx: CanvasRenderingContext2D,
    transform: BoneTransform,
    part: SkinPartDef,
    img: HTMLImageElement,
    scale: number
  ): void {
    const w = (part.width ?? img.width ?? transform.length) * scale;
    const h = (part.height ?? img.height ?? transform.length) * scale;
    const px = part.pivotX ?? 0.5;
    const py = part.pivotY ?? 0.5;
    const ox = (part.offsetX ?? 0) * scale;
    const oy = (part.offsetY ?? 0) * scale;

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.rotate(transform.rotation);

    // 피벗 기준 그리기 좌표 (dx, dy)
    const dx = -w * px + ox;
    const dy = -h * py + oy;

    ctx.drawImage(img, dx, dy, w, h);
    ctx.restore();
  }

  /** 스킨 부재 시 전체 본 캡슐 폴백 */
  private _renderFallbackBones(
    ctx: CanvasRenderingContext2D,
    transforms: readonly BoneTransform[],
    scale: number
  ): void {
    for (const t of transforms) {
      this._renderCapsuleBone(ctx, t, scale);
    }
  }

  /** 단일 본 캡슐 렌더링 */
  private _renderCapsuleBone(
    ctx: CanvasRenderingContext2D,
    transform: BoneTransform,
    scale: number
  ): void {
    if (transform.length <= 1) return;

    ctx.save();
    ctx.strokeStyle = this._config.colors.body ?? '#F8FAFC';
    ctx.lineWidth = Math.max(6 * scale, 12 * scale);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(transform.x, transform.y);
    ctx.lineTo(transform.endX, transform.endY);
    ctx.stroke();

    ctx.restore();
  }

  /** 발밑 접지 그림자 렌더링 */
  private _renderGroundShadow(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    scale: number
  ): void {
    const frame = this._lastPoseFrame;
    const airHeight = frame && frame.verticalOffset < 0 ? -frame.verticalOffset : 0;

    let lowestY = -Infinity;
    for (const t of this._boneTransforms) {
      if (t.endY > lowestY) lowestY = t.endY;
      if (t.y > lowestY) lowestY = t.y;
    }
    if (lowestY === -Infinity) {
      lowestY = vh * (this._config.anchorYRatio ?? 0.72) + 240 * scale;
    }

    const groundY = lowestY + 12 * scale + airHeight;
    const centerX = vw * this._currentAnchorXRatio;
    const shadowDecay = Math.max(0.35, 1.0 - airHeight / (260 * scale));
    const radiusX = 110 * scale * shadowDecay;
    const radiusY = 24 * scale * shadowDecay;

    ctx.save();
    ctx.fillStyle = this._config.colors.groundShadow || 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(centerX, groundY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
