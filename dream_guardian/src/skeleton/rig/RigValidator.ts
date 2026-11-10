/**
 * RigValidator - CharacterRig 스키마 및 계층 무결성 검증기
 *
 * Issue #683 / FEAT-RIG-001:
 * - 부모 존재 검증 (고아 본 방지)
 * - 순환 참조(Cycle) 검증
 * - 단일 루트 본(Root Bone) 검증
 * - 각도 회전 제한 범위(minAngle <= maxAngle) 유효성 검증
 * - driver: 'pose' 본의 PoseFrame BoneId 매핑 무결성 검증
 */

import type { CharacterRig, BoneDef } from '../../types/character-rig.js';
import type { BoneId } from '../../types/pose-frame.js';

export interface RigValidationResult {
  isValid: boolean;
  errors: string[];
}

const VALID_POSE_SOURCES: ReadonlySet<BoneId> = new Set<BoneId>([
  'torso',
  'head',
  'leftUpperArm',
  'leftForearm',
  'rightUpperArm',
  'rightForearm',
  'leftUpperLeg',
  'leftLowerLeg',
  'rightUpperLeg',
  'rightLowerLeg',
]);

export class RigValidator {
  /**
   * CharacterRig의 데이터 무결성 및 트리 계층 구조를 검증합니다.
   */
  public static validate(rig: CharacterRig): RigValidationResult {
    const errors: string[] = [];

    if (!rig.id) {
      errors.push('리그 id가 비어 있습니다.');
    }
    if (!rig.bones || rig.bones.length === 0) {
      errors.push('리그에 본(bones) 정의가 존재하지 않습니다.');
      return { isValid: false, errors };
    }

    const boneMap = new Map<string, BoneDef>();
    const rootBones: BoneDef[] = [];

    // 1. 본 ID 중복 및 기본 필드 검증
    for (const bone of rig.bones) {
      if (!bone.id) {
        errors.push('본 id가 유효하지 않습니다.');
        continue;
      }
      if (boneMap.has(bone.id)) {
        errors.push(`중복된 본 ID가 존재합니다: "${bone.id}"`);
      } else {
        boneMap.set(bone.id, bone);
      }

      if (bone.parent === undefined) {
        rootBones.push(bone);
      }

      // 각도 범위 검증 (minAngle <= maxAngle)
      if (
        bone.minAngle !== undefined &&
        bone.maxAngle !== undefined &&
        bone.minAngle > bone.maxAngle
      ) {
        errors.push(
          `본 "${bone.id}"의 각도 범위가 잘못되었습니다 (minAngle: ${bone.minAngle} > maxAngle: ${bone.maxAngle})`
        );
      }

      // driver 검증
      if (bone.driver === 'pose') {
        if (!bone.poseSource || !VALID_POSE_SOURCES.has(bone.poseSource)) {
          errors.push(
            `본 "${bone.id}"의 driver가 'pose'이지만 유효한 poseSource가 지정되지 않았습니다 (지정값: "${bone.poseSource}")`
          );
        }
      }
    }

    // 2. 단일 루트 검증
    if (rootBones.length === 0) {
      errors.push('루트 본(parent가 없는 본)이 존재하지 않습니다.');
    } else if (rootBones.length > 1) {
      const rootIds = rootBones.map((b) => b.id).join(', ');
      errors.push(`루트 본은 1개여야 하지만 ${rootBones.length}개가 존재합니다: [${rootIds}]`);
    }

    // 3. 부모 존재 검증 (고아 본 방지)
    for (const bone of rig.bones) {
      if (bone.parent !== undefined) {
        if (!boneMap.has(bone.parent)) {
          errors.push(
            `본 "${bone.id}"의 부모 본 "${bone.parent}"(orphan)이 리그에 존재하지 않습니다.`
          );
        }
      }
    }

    // 4. 순환 참조(Cycle) 검증
    for (const bone of rig.bones) {
      const visited = new Set<string>();
      let current: BoneDef | undefined = bone;

      while (current && current.parent !== undefined) {
        if (visited.has(current.id)) {
          errors.push(
            `본 계층 구조에 순환 참조(cycle)가 감지되었습니다: "${current.id}"`
          );
          break;
        }
        visited.add(current.id);
        current = boneMap.get(current.parent);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
