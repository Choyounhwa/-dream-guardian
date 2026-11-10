/**
 * RigSolver - PoseFrame × CharacterRig 순운동학(Forward Kinematics) 엔진
 *
 * Issue #684 / FEAT-RIG-002:
 * - PoseFrame의 본별 각도와 CharacterRig의 본 길이/계층/오프셋을 결합하여 월드 본 트랜스폼 계산
 * - 가변 본 길이(SD/동물형) 및 관절 회전 각도 제한(min/maxAngle) 클램프
 * - rootAnchor ('hip' | 'feet') 접지 처리
 * - 비포즈(physics, clip) 드라이버 본의 restAngle 보존
 */

import type { CharacterRig, BoneDef } from '../../types/character-rig.js';
import type { PoseFrame } from '../../types/pose-frame.js';

export interface BoneTransform {
  /** 본 고유 식별자 */
  id: string;
  /** 본 시작점 X 좌표 (월드 픽셀) */
  x: number;
  /** 본 시작점 Y 좌표 (월드 픽셀) */
  y: number;
  /** 본 절대 회전 각도 (라디안) */
  rotation: number;
  /** 본 스케일 적용된 길이 (픽셀) */
  length: number;
  /** 본 끝점 X 좌표 (월드 픽셀) */
  endX: number;
  /** 본 끝점 Y 좌표 (월드 픽셀) */
  endY: number;
}

export interface RigSolveOptions {
  virtualWidth?: number;
  virtualHeight?: number;
  anchorYRatio?: number;
  scale?: number;
  groundBaseY?: number;
  physicsAngles?: Record<string, number>;
}

export class RigSolver {
  /**
   * PoseFrame과 CharacterRig를 결합하여 전체 본의 2D FK 트랜스폼을 산출합니다.
   */
  public static solve(
    frame: PoseFrame,
    rig: CharacterRig,
    options?: RigSolveOptions
  ): BoneTransform[] {
    const vw = options?.virtualWidth ?? 1080;
    const vh = options?.virtualHeight ?? 1080;
    const anchorY = options?.anchorYRatio ?? 0.72;
    const scale = options?.scale ?? frame.scale ?? 1.5;

    // 1. 루트 골반 앵커 기본 좌표 계산
    const rootX = vw * frame.rootX;
    const rootY = vh * anchorY + frame.rootY;

    const boneMap = new Map<string, BoneDef>();
    for (const b of rig.bones) {
      boneMap.set(b.id, b);
    }

    const transformMap = new Map<string, BoneTransform>();
    const solvedTransforms: BoneTransform[] = [];

    // 재귀적으로 부모부터 순운동학(FK) 계산
    const computeBoneTransform = (bone: BoneDef): BoneTransform => {
      const cached = transformMap.get(bone.id);
      if (cached) return cached;

      let startX: number;
      let startY: number;

      if (!bone.parent) {
        // 루트 본
        startX = rootX;
        startY = rootY;
      } else {
        const parentBone = boneMap.get(bone.parent);
        if (!parentBone) {
          startX = rootX;
          startY = rootY;
        } else {
          const parentTransform = computeBoneTransform(parentBone);
          const parentAngle = parentTransform.rotation;
          // 부모 본 방향 탄젠트(T) 및 직교 노멀(N) 벡터
          const tx = Math.cos(parentAngle);
          const ty = Math.sin(parentAngle);
          const nx = -Math.sin(parentAngle);
          const ny = Math.cos(parentAngle);

          const refX = bone.attachPoint === 'start' ? parentTransform.x : parentTransform.endX;
          const refY = bone.attachPoint === 'start' ? parentTransform.y : parentTransform.endY;

          const offsetX = (bone.attachOffset?.x ?? 0) * scale;
          const offsetY = (bone.attachOffset?.y ?? 0) * scale;

          startX = refX + tx * offsetX + nx * offsetY;
          startY = refY + ty * offsetX + ny * offsetY;
        }
      }

      // 회전각 결정 및 각도 제한(min/maxAngle) 클램프
      let rotation: number;
      if (bone.driver === 'pose' && bone.poseSource && frame.boneAngles[bone.poseSource] !== undefined) {
        rotation = frame.boneAngles[bone.poseSource];
      } else if (bone.driver === 'physics' && options?.physicsAngles && options.physicsAngles[bone.id] !== undefined) {
        rotation = options.physicsAngles[bone.id];
      } else {
        rotation = bone.restAngle;
      }

      if (bone.minAngle !== undefined && rotation < bone.minAngle) {
        rotation = bone.minAngle;
      }
      if (bone.maxAngle !== undefined && rotation > bone.maxAngle) {
        rotation = bone.maxAngle;
      }

      const length = bone.length * scale;
      const endX = startX + Math.cos(rotation) * length;
      const endY = startY + Math.sin(rotation) * length;

      const transform: BoneTransform = {
        id: bone.id,
        x: startX,
        y: startY,
        rotation,
        length,
        endX,
        endY,
      };

      transformMap.set(bone.id, transform);
      solvedTransforms.push(transform);
      return transform;
    };

    // 모든 본 계산
    for (const bone of rig.bones) {
      computeBoneTransform(bone);
    }

    // 2. rootAnchor가 'feet'일 때 최하단 발 지면 접지 보정 (SD 캐릭터 접지)
    if (rig.rootAnchor === 'feet') {
      let lowestY = -Infinity;
      for (const t of solvedTransforms) {
        if (t.endY > lowestY) lowestY = t.endY;
        if (t.y > lowestY) lowestY = t.y;
      }

      const defaultGroundBaseY = options?.groundBaseY ?? (vh * anchorY + 240 * scale);
      const targetGround = defaultGroundBaseY + frame.rootY;
      const deltaY = targetGround - lowestY;

      for (const t of solvedTransforms) {
        t.y += deltaY;
        t.endY += deltaY;
      }
    }

    return solvedTransforms;
  }

  /**
   * BoneTransform 배열을 ID 키 기반의 Record 맵으로 변환합니다.
   */
  public static toMap(transforms: readonly BoneTransform[]): Record<string, BoneTransform> {
    const map: Record<string, BoneTransform> = {};
    for (const t of transforms) {
      map[t.id] = t;
    }
    return map;
  }
}
