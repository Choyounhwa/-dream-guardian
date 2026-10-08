/**
 * IAvatarRenderer - 캐릭터 아바타 렌더러 공통 인터페이스
 *
 * Issue #491 / AVATAR-04:
 * - 앙상블 졸라맨(StickmanRenderer), 2D 스프라이트 캐릭터, 3D 모델 렌더러 등
 *   다양한 캐릭터 표현체로 무결하게 교체/확장할 수 있도록 공통 규격 추상화.
 * - 게임 루프 및 씬 디렉터(SceneDirector), 부트스트랩(AppBootstrap)은
 *   구체 클래스가 아닌 IAvatarRenderer 인터페이스에 의존하여 결합도를 낮춤.
 */

import type { NormalizedLandmark } from '../types/index.js';

export interface IAvatarRenderer {
  /** 아바타 스케일 배율 */
  scale: number;

  /** 유효 포즈 랜드마크 인식 상태 여부 */
  readonly hasPose: boolean;

  /** 화면 가로 기준 현재 앵커 위치 비율 (0.0 ~ 1.0, 중앙 = 0.5) */
  readonly currentAnchorXRatio: number;

  /** 아바타 크기 배율 설정 */
  setScale(val: number): void;

  /**
   * 포즈 랜드마크 기반 프레임별 상태 갱신
   * @param dt 델타 타임 (초)
   * @param poseLandmarks 정규화된 33개 Pose 랜드마크 배열 (미인식 시 null/undefined)
   * @param options 렌더러별 추가 옵션 (호흡 스케일, 미러링 등)
   */
  update(
    dt: number,
    poseLandmarks?: readonly NormalizedLandmark[] | null,
    options?: any,
  ): void;

  /**
   * 포즈 미인식 또는 Fallback 시 대기/달리기 애니메이션 갱신
   * @param dt 델타 타임 (초)
   * @param isRunning 러닝 모드 여부
   */
  updateFallback(dt: number, isRunning?: boolean): void;

  /**
   * 캔버스 2D 컨텍스트 아바타 렌더링
   * @param ctx 캔버스 2D 렌더링 컨텍스트
   * @param vw 뷰포트 가상 너비 (기본 1920)
   * @param vh 뷰포트 가상 높이 (기본 1080)
   * @param options 렌더러별 렌더 옵션 (투명도, 그림자/마법진 등)
   */
  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    options?: any,
  ): void;

  /** 상태 초기화 */
  reset(): void;
}
