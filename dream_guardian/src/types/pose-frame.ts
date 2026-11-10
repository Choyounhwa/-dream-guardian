/**
 * PoseFrame - 캐릭터 비의존 관절 각도 및 포즈 프레임 인터페이스
 *
 * Issue #682 / REFACTOR-SKEL-001:
 * - SD/동물 의인화 캐릭터 스킨 확장(캐릭터 리그 로드맵)의 기본 데이터 구조
 * - 본 길이(Limb length)와 렌더 스타일에 독립적인 순수 포즈 상태
 */

export type BoneId =
  | 'torso'
  | 'head'
  | 'leftUpperArm'
  | 'leftForearm'
  | 'rightUpperArm'
  | 'rightForearm'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'rightUpperLeg'
  | 'rightLowerLeg';

export type BoneAngles = Record<BoneId, number>;

export interface PoseFrame {
  /** 골반 중심 가로 위치 (0.0 ~ 1.0 화면 정규화 비율) */
  rootX: number;
  /** 수직 변위 오프셋 (verticalOffset) */
  rootY: number;
  /** 몸통 기울기 각도 (라디안) */
  torsoTilt: number;
  /** 본별 회전 각도 맵 */
  boneAngles: BoneAngles;
  /** 아바타 스케일 배율 */
  scale: number;
  /** 포즈 신뢰도 (0.0 ~ 1.0) */
  confidence: number;
  /** 유효 포즈 감지 여부 */
  hasPose: boolean;
  /** 기준 골반 Y 좌표 (적응형 베이스라인) */
  baselineHipY: number;
  /** 스쿼트/점프 수직 변위 오프셋 (rootY와 동일값) */
  verticalOffset: number;
  /** 화면 가로 앵커 비율 (rootX와 동일값) */
  anchorXRatio: number;
  /** 팔별 각도 신뢰도 0~1 (Issue #725). 미제공 시 소비자는 1로 간주 */
  armConfidence?: Readonly<{ left: number; right: number }>;
}
