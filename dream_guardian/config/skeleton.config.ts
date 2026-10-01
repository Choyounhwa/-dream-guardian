/**
 * skeleton.config.ts - 메카 졸라맨(Mecha Stickman) 모션 아바타 및 스켈레톤 설정 (Issue #203 / FEAT-SKEL-005)
 *
 * 개발 규칙 6절 (데이터와 코드 분리) 준수:
 * - 화면 중앙 2/3 높이 앵커 비율 (X: 0.5, Y: 0.68)
 * - 황금 비례 고정 길이 순운동학(Fixed-Length FK) 파라미터
 * - 네온 캡슐 두께, 관절 볼 크기, 색상 테마
 */

export interface StickmanLimbLengths {
  torso: number;        // 골반 -> 가슴/어깨 중심 거리 (~155px)
  shoulderWidth: number;// 좌우 어깨 간격 (~105px)
  hipWidth: number;     // 좌우 골반 간격 (~75px)
  upperArm: number;     // 상완 (어깨 -> 팔꿈치, ~100px)
  forearm: number;      // 전완 (팔꿈치 -> 손목, ~90px)
  upperLeg: number;     // 대퇴/허벅지 (골반 -> 무릎, ~120px)
  lowerLeg: number;     // 하퇴/종아리 (무릎 -> 발목, ~120px)
  headRadius: number;   // 머리 헬멧 반경 (~32px)
  neckLength: number;   // 목 길이 (~22px)
}

export interface StickmanCapsuleWidth {
  torso: number;        // 몸통 두께
  limb: number;         // 사지 캡슐 두께
  limbNeon: number;     // 사지 내부 네온/하이라이트 악센트 선 두께
  jointBall: number;    // 관절 볼 반경
  visorHeight: number;  // 바이저 슬릿 높이
}

export interface StickmanColors {
  body: string;         // 메카/점토 캡슐 베이스 컬러 (순백색 점토 #F8FAFC)
  bodyBorder: string;   // 캡슐 외곽선/음영 테두리 컬러 (#CBD5E1)
  bodyHighlight?: string; // 점토 상단 앰비언트 하이라이트 (#FFFFFF)
  bodyShade?: string;     // 점토 하단 음영 (#E2E8F0)
  core: string;         // 가슴 마력 코어/엠블럼 컬러
  coreGlow: string;     // 마력 코어/엠블럼 발광 컬러
  visor: string;        // 헬멧 바이저 슬릿 (보라 #C889FF)
  leftLimb: string;     // 왼손/왼발 네온 라인 (시안 #28E6FF)
  rightLimb: string;    // 오른손/오른발 네온 라인 (노랑 #FFCB4D)
  hipJoint: string;     // 골반 관절 (주황 #FF865E)
  shoulderJoint: string;// 어깨 관절 (보라 #C889FF)
  groundRing: string;   // 지면 접지 마법진 링 컬러
  groundShadow?: string;// 지면 부드러운 타원형 앰비언트 접지 그림자 컬러
}

export interface StickmanConfig {
  anchorXRatio: number; // 화면 가로 앵커 비율 (0.5 = 중앙)
  anchorYRatio: number; // 화면 세로 앵커 비율 (0.68 = 화면 중앙 2/3 높이)
  scale: number;        // 기본 스케일
  angleSmoothing: number; // 회전각 스무딩 보간 계수 (0~1)
  squatSensitivity: number; // 스쿼트 시 Y 변위 가중치
  jumpSensitivity: number;  // 점프 시 Y 변위 가중치
  limbLengths: StickmanLimbLengths;
  capsuleWidth: StickmanCapsuleWidth;
  colors: StickmanColors;
}

export const STICKMAN_CONFIG: StickmanConfig = {
  anchorXRatio: 0.5,
  anchorYRatio: 0.68,
  scale: 1.0,
  angleSmoothing: 0.35,
  squatSensitivity: 350,
  jumpSensitivity: 350,
  limbLengths: {
    torso: 155,
    shoulderWidth: 105,
    hipWidth: 75,
    upperArm: 100,
    forearm: 90,
    upperLeg: 120,
    lowerLeg: 120,
    headRadius: 34,
    neckLength: 22,
  },
  capsuleWidth: {
    torso: 42,
    limb: 26,
    limbNeon: 6,
    jointBall: 13,
    visorHeight: 6,
  },
  colors: {
    body: '#F8FAFC',
    bodyBorder: '#CBD5E1',
    bodyHighlight: '#FFFFFF',
    bodyShade: '#E2E8F0',
    core: '#E2E8F0',
    coreGlow: 'rgba(203, 213, 225, 0.4)',
    visor: '#C889FF',
    leftLimb: '#28E6FF',
    rightLimb: '#FFCB4D',
    hipJoint: '#FF865E',
    shoulderJoint: '#C889FF',
    groundRing: '#28E6FF',
    groundShadow: 'rgba(0, 0, 0, 0.28)',
  },
};
