/**
 * character-rig.config.ts - 기본 캐릭터 리그 설정
 *
 * Issue #683 / FEAT-RIG-001:
 * - 기본 메카 졸라맨(Stickman) 리그 정의
 * - STICKMAN_CONFIG의 limbLengths 값을 직접 참조하여 구성 (DRY 원칙 준수)
 * - deepFreeze 불변성 적용
 */

import { STICKMAN_CONFIG } from './skeleton.config.js';
import { deepFreeze } from '../src/utils/deepFreeze.js';
import type { CharacterRig } from '../src/types/character-rig.js';

const rawDefaultStickmanRig: CharacterRig = {
  id: 'mecha_stickman',
  name: '메카 졸라맨',
  rootAnchor: 'hip',
  bones: [
    {
      id: 'pelvis',
      length: 0,
      restAngle: -Math.PI / 2,
      driver: 'pose',
      poseSource: 'torso',
    },
    {
      id: 'torso',
      parent: 'pelvis',
      length: STICKMAN_CONFIG.limbLengths.torso,
      restAngle: -Math.PI / 2,
      driver: 'pose',
      poseSource: 'torso',
      attachPoint: 'start',
    },
    {
      id: 'neck',
      parent: 'torso',
      length: STICKMAN_CONFIG.limbLengths.neckLength,
      restAngle: -Math.PI / 2,
      driver: 'clip',
      attachPoint: 'end',
    },
    {
      id: 'head',
      parent: 'torso',
      length: STICKMAN_CONFIG.limbLengths.headRadius + STICKMAN_CONFIG.limbLengths.neckLength * 0.5,
      restAngle: -Math.PI / 2,
      driver: 'pose',
      poseSource: 'head',
      attachPoint: 'end',
    },
    {
      id: 'leftUpperArm',
      parent: 'torso',
      length: STICKMAN_CONFIG.limbLengths.upperArm,
      restAngle: Math.PI * 0.65,
      driver: 'pose',
      poseSource: 'leftUpperArm',
      attachPoint: 'end',
      attachOffset: { x: 0, y: -STICKMAN_CONFIG.limbLengths.shoulderWidth / 2 },
    },
    {
      id: 'leftForearm',
      parent: 'leftUpperArm',
      length: STICKMAN_CONFIG.limbLengths.forearm,
      restAngle: Math.PI * 0.75,
      driver: 'pose',
      poseSource: 'leftForearm',
      attachPoint: 'end',
    },
    {
      id: 'rightUpperArm',
      parent: 'torso',
      length: STICKMAN_CONFIG.limbLengths.upperArm,
      restAngle: Math.PI * 0.35,
      driver: 'pose',
      poseSource: 'rightUpperArm',
      attachPoint: 'end',
      attachOffset: { x: 0, y: STICKMAN_CONFIG.limbLengths.shoulderWidth / 2 },
    },
    {
      id: 'rightForearm',
      parent: 'rightUpperArm',
      length: STICKMAN_CONFIG.limbLengths.forearm,
      restAngle: Math.PI * 0.25,
      driver: 'pose',
      poseSource: 'rightForearm',
      attachPoint: 'end',
    },
    {
      id: 'leftUpperLeg',
      parent: 'torso',
      length: STICKMAN_CONFIG.limbLengths.upperLeg,
      restAngle: Math.PI * 0.48,
      driver: 'pose',
      poseSource: 'leftUpperLeg',
      attachPoint: 'start',
      attachOffset: { x: 0, y: -STICKMAN_CONFIG.limbLengths.hipWidth / 2 },
    },
    {
      id: 'leftLowerLeg',
      parent: 'leftUpperLeg',
      length: STICKMAN_CONFIG.limbLengths.lowerLeg,
      restAngle: Math.PI * 0.50,
      driver: 'pose',
      poseSource: 'leftLowerLeg',
      attachPoint: 'end',
    },
    {
      id: 'rightUpperLeg',
      parent: 'torso',
      length: STICKMAN_CONFIG.limbLengths.upperLeg,
      restAngle: Math.PI * 0.52,
      driver: 'pose',
      poseSource: 'rightUpperLeg',
      attachPoint: 'start',
      attachOffset: { x: 0, y: STICKMAN_CONFIG.limbLengths.hipWidth / 2 },
    },
    {
      id: 'rightLowerLeg',
      parent: 'rightUpperLeg',
      length: STICKMAN_CONFIG.limbLengths.lowerLeg,
      restAngle: Math.PI * 0.50,
      driver: 'pose',
      poseSource: 'rightLowerLeg',
      attachPoint: 'end',
    },
  ],
  proportions: {
    headScale: 1.0,
    torsoScale: 1.0,
    limbScale: 1.0,
  },
  cursorAnchors: {
    leftWristBone: 'leftForearm',
    rightWristBone: 'rightForearm',
    headBone: 'head',
    pelvisBone: 'pelvis',
  },
};

export const DEFAULT_STICKMAN_RIG: Readonly<CharacterRig> = deepFreeze(rawDefaultStickmanRig);
