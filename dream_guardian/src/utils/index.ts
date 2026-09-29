import type { NormalizedLandmark } from '../types/index.js';

/**
 * 가상 해상도 픽셀 좌표계 랜드마크를 정규화 좌표계(0~1)로 비파괴 변환
 * x / virtualWidth, y / virtualHeight (z, visibility 원형 보존)
 */
export function toNormalizedLandmarks(
  landmarks: readonly NormalizedLandmark[] | null | undefined,
  virtualWidth: number,
  virtualHeight: number,
): NormalizedLandmark[] | null {
  if (!landmarks || landmarks.length === 0 || virtualWidth <= 0 || virtualHeight <= 0) {
    return null;
  }

  return landmarks.map((lm) => ({
    x: lm.x / virtualWidth,
    y: lm.y / virtualHeight,
    z: lm.z,
    visibility: lm.visibility,
  }));
}
