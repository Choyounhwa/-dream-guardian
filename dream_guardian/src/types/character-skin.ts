/**
 * CharacterSkin - 부위별 PNG 스킨 데이터 스키마
 *
 * Issue #685 / FEAT-SKIN-001:
 * - SD/동물 의인화 캐릭터 부위별 PNG 파츠 메타데이터 정의
 * - 본 바인딩, 피벗, zOrder, 오프셋 설정
 */

export interface SkinPartDef {
  /** 대상 본 ID (예: 'torso', 'head', 'leftUpperArm') */
  boneId: string;
  /** 파츠 이미지 파일명 또는 경로 (예: 'torso.png') */
  file: string;
  /** 피벗 X 비율 (0.0 ~ 1.0, 기본값 0.5: 중심) */
  pivotX?: number;
  /** 피벗 Y 비율 (0.0 ~ 1.0, 기본값 0.5: 중심) */
  pivotY?: number;
  /** 추가 오프셋 (픽셀 단위) */
  offsetX?: number;
  offsetY?: number;
  /** 렌더링 너비 오버라이드 (기본: 이미지 원본 크기) */
  width?: number;
  /** 렌더링 높이 오버라이드 */
  height?: number;
  /** 앞뒤 렌더링 순서 (z-order, 작을수록 먼저 그림) */
  zOrder?: number;
  /** 거울 모드 시 좌우 반전 렌더링 여부 */
  flipOnMirror?: boolean;
}

export interface CharacterSkin {
  /** 스킨 고유 식별자 */
  id: string;
  /** 표시용 스킨 이름 */
  name: string;
  /** 에셋 기본 디렉터리 경로 (예: 'assets/characters/guardian/') */
  basePath?: string;
  /** 부위별 파츠 목록 */
  parts: readonly SkinPartDef[];
}
