/**
 * CharacterRig - 캐릭터 리그 데이터 스키마 및 인터페이스 정의
 *
 * Issue #683 / FEAT-RIG-001:
 * - SD/동물 의인화 캐릭터 스킨 확장(캐릭터 리그 로드맵)의 데이터 스키마
 * - 캐릭터마다 다른 본 길이, 계층 구조, 관절 각도 제한, 추가 본(꼬리·귀)을 데이터로 선언
 */

import type { BoneId } from './pose-frame.js';

export type BoneDriverType = 'pose' | 'physics' | 'clip';

export type RootAnchorType = 'hip' | 'feet';

export interface CursorAnchors {
  leftWristBone?: string;
  rightWristBone?: string;
  headBone?: string;
  pelvisBone?: string;
}

export interface CharacterProportions {
  headScale?: number;
  torsoScale?: number;
  limbScale?: number;
}

export interface BonePhysicsConfig {
  /** 각도 스프링 강도 (stiffness k, 기본 80) */
  stiffness?: number;
  /** 각도 감쇠 계수 (damping c, 기본 10) */
  damping?: number;
  /** 중력 편향 가속도 (gravity, 기본 0) */
  gravity?: number;
  /** 본 질량 (mass, 기본 1.0) */
  mass?: number;
}

export interface BoneDef {
  /** 본 고유 식별자 */
  id: string;
  /** 부모 본 식별자 (루트 본의 경우 undefined) */
  parent?: string;
  /** 본의 고정 길이 (픽셀 단위) */
  length: number;
  /** 기본 정지 상태 각도 (라디안) */
  restAngle: number;
  /** 허용 회전 최소 각도 (라디안) */
  minAngle?: number;
  /** 허용 회전 최대 각도 (라디안) */
  maxAngle?: number;
  /** 본 회전 구동 방식 ('pose': 사용자 랜드마크 각도, 'physics': 스프링 물리, 'clip': 절차/클립) */
  driver: BoneDriverType;
  /** driver가 'pose'일 때 매핑되는 PoseFrame의 BoneId */
  poseSource?: BoneId;
  /** 부모 본 부착 기준점 ('end': 부모의 끝점, 'start': 부모의 시작점, 기본값: 'end') */
  attachPoint?: 'start' | 'end';
  /** 부모 본 기준 로컬 부착 오프셋 (x: 본 방향 탄젠트 오프셋, y: 본 직교 노멀 오프셋) */
  attachOffset?: { x?: number; y?: number };
  /** driver가 'physics'일 때의 스프링 물리 설정 */
  physics?: BonePhysicsConfig;
}

export interface CharacterRig {
  /** 리그 고유 식별자 */
  id: string;
  /** 표시용 이름 */
  name: string;
  /** 루트 앵커 기준점 ('hip': 골반 기준, 'feet': 발바닥 기준) */
  rootAnchor: RootAnchorType;
  /** 전체 본 정의 목록 */
  bones: readonly BoneDef[];
  /** 신체 비율 커스터마이징 계수 */
  proportions?: CharacterProportions;
  /** 4색 커서 추적 앵커 본 매핑 */
  cursorAnchors?: CursorAnchors;
}
