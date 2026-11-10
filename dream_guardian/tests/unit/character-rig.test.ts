import { describe, it, expect } from 'vitest';
import { RigValidator } from '../../src/skeleton/rig/RigValidator.js';
import { DEFAULT_STICKMAN_RIG } from '../../config/character-rig.config.js';
import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';
import type { CharacterRig } from '../../src/types/character-rig.js';

describe('CharacterRig 데이터 스키마 및 RigValidator 단위 테스트 (#683 / FEAT-RIG-001)', () => {
  describe('1. 기본 스틱맨 리그 (DEFAULT_STICKMAN_RIG) 및 불변성', () => {
    it('기본 스틱맨 리그가 RigValidator 검증을 성공적으로 통과한다', () => {
      const result = RigValidator.validate(DEFAULT_STICKMAN_RIG);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('기본 스틱맨 리그의 본 길이는 STICKMAN_CONFIG의 값을 정확히 참조한다 (DRY 원칙)', () => {
      const torsoBone = DEFAULT_STICKMAN_RIG.bones.find((b) => b.id === 'torso');
      const upperArmBone = DEFAULT_STICKMAN_RIG.bones.find((b) => b.id === 'leftUpperArm');
      const upperLegBone = DEFAULT_STICKMAN_RIG.bones.find((b) => b.id === 'leftUpperLeg');

      expect(torsoBone?.length).toBe(STICKMAN_CONFIG.limbLengths.torso);
      expect(upperArmBone?.length).toBe(STICKMAN_CONFIG.limbLengths.upperArm);
      expect(upperLegBone?.length).toBe(STICKMAN_CONFIG.limbLengths.upperLeg);
    });

    it('DEFAULT_STICKMAN_RIG는 deepFreeze가 적용되어 불변이다', () => {
      expect(Object.isFrozen(DEFAULT_STICKMAN_RIG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_STICKMAN_RIG.bones)).toBe(true);
      expect(Object.isFrozen(DEFAULT_STICKMAN_RIG.bones[0])).toBe(true);
    });
  });

  describe('2. RigValidator 유효성 규칙 검증', () => {
    it('루트 본이 없거나 2개 이상일 때 에러를 반환한다', () => {
      // 루트 없음 (모두 부모가 있음)
      const noRootRig: CharacterRig = {
        id: 'no-root',
        name: 'No Root',
        rootAnchor: 'hip',
        bones: [
          {
            id: 'torso',
            parent: 'pelvis',
            length: 100,
            restAngle: 0,
            driver: 'pose',
            poseSource: 'torso',
          },
        ],
      };
      const resNoRoot = RigValidator.validate(noRootRig);
      expect(resNoRoot.isValid).toBe(false);
      expect(resNoRoot.errors.some((e) => e.includes('루트'))).toBe(true);

      // 루트가 2개
      const multiRootRig: CharacterRig = {
        id: 'multi-root',
        name: 'Multi Root',
        rootAnchor: 'hip',
        bones: [
          { id: 'root1', length: 10, restAngle: 0, driver: 'pose', poseSource: 'torso' },
          { id: 'root2', length: 10, restAngle: 0, driver: 'pose', poseSource: 'torso' },
        ],
      };
      const resMulti = RigValidator.validate(multiRootRig);
      expect(resMulti.isValid).toBe(false);
      expect(resMulti.errors.some((e) => e.includes('루트'))).toBe(true);
    });

    it('존재하지 않는 부모를 가리키는 고아(Orphan) 본이 존재하면 에러를 반환한다', () => {
      const orphanRig: CharacterRig = {
        id: 'orphan-rig',
        name: 'Orphan Rig',
        rootAnchor: 'hip',
        bones: [
          { id: 'pelvis', length: 0, restAngle: 0, driver: 'pose', poseSource: 'torso' },
          { id: 'arm', parent: 'non_existent_parent', length: 50, restAngle: 0, driver: 'pose', poseSource: 'leftUpperArm' },
        ],
      };
      const res = RigValidator.validate(orphanRig);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('부모') || e.includes('orphan') || e.includes('non_existent_parent'))).toBe(true);
    });

    it('본 계층 구조에 순환 참조(Cycle)가 존재하면 에러를 반환한다', () => {
      const cycleRig: CharacterRig = {
        id: 'cycle-rig',
        name: 'Cycle Rig',
        rootAnchor: 'hip',
        bones: [
          { id: 'pelvis', length: 0, restAngle: 0, driver: 'pose', poseSource: 'torso' },
          { id: 'boneA', parent: 'boneB', length: 50, restAngle: 0, driver: 'physics' },
          { id: 'boneB', parent: 'boneA', length: 50, restAngle: 0, driver: 'physics' },
        ],
      };
      const res = RigValidator.validate(cycleRig);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('순환') || e.includes('cycle'))).toBe(true);
    });

    it('minAngle이 maxAngle보다 큰 비정상 각도 범위인 경우 에러를 반환한다', () => {
      const invalidAngleRig: CharacterRig = {
        id: 'invalid-angle',
        name: 'Invalid Angle',
        rootAnchor: 'hip',
        bones: [
          {
            id: 'pelvis',
            length: 0,
            restAngle: 0,
            minAngle: 1.5,
            maxAngle: -1.5, // min > max
            driver: 'pose',
            poseSource: 'torso',
          },
        ],
      };
      const res = RigValidator.validate(invalidAngleRig);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('각도') || e.includes('angle'))).toBe(true);
    });

    it('driver가 pose인데 유효한 poseSource(BoneId)가 지정되지 않은 경우 에러를 반환한다', () => {
      const invalidPoseSourceRig: CharacterRig = {
        id: 'invalid-pose-source',
        name: 'Invalid Pose Source',
        rootAnchor: 'hip',
        bones: [
          {
            id: 'pelvis',
            length: 0,
            restAngle: 0,
            driver: 'pose',
            poseSource: 'non_existent_bone' as any,
          },
        ],
      };
      const res = RigValidator.validate(invalidPoseSourceRig);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('poseSource'))).toBe(true);
    });

    it('동일한 본 ID가 중복 등록된 경우 에러를 반환한다', () => {
      const duplicateIdRig: CharacterRig = {
        id: 'duplicate-id',
        name: 'Duplicate ID',
        rootAnchor: 'hip',
        bones: [
          { id: 'pelvis', length: 0, restAngle: 0, driver: 'pose', poseSource: 'torso' },
          { id: 'pelvis', parent: 'pelvis', length: 10, restAngle: 0, driver: 'physics' },
        ],
      };
      const res = RigValidator.validate(duplicateIdRig);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('중복') || e.includes('duplicate'))).toBe(true);
    });
  });
});
