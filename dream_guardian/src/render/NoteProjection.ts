/**
 * NoteProjection - 모션 리듬 노트 공용 원근 투영 및 어프로치 링 스케일 계산 순수 함수 모듈
 *
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§6 공용 투영 및 앵커 좌표)
 * @see Issue #477 [MRN-03]
 */

export interface ProjectFlightOptions {
  /** 시작 소실점 크기 배율 (기본값: 0.3) */
  readonly minScale?: number;
  /** 착지 판정 시점 크기 배율 (기본값: 1.2) */
  readonly maxScale?: number;
  /** 원근 가속 지수 (t^n). 기본값: 2.0 (별: 2.0, 발: 1.4, 장판: 1.5) */
  readonly easingExponent?: number;
}

export interface FlightProjectionResult {
  /** 투영된 화면 X 좌표 */
  readonly x: number;
  /** 투영된 화면 Y 좌표 */
  readonly y: number;
  /** 투영된 크기 배율 */
  readonly scale: number;
  /** 원근 비선형 보간 진행도 t (p^easingExponent) */
  readonly t: number;
  /** 클램프된 비행 선형 진행도 (0.0 ~ 1.0) */
  readonly progress: number;
}

/**
 * 시간 경과에 따른 비행 진행도 계산
 *
 * @param now 현재 경과 시간 (초)
 * @param landingTime 착지 목표 시간 (초)
 * @param leadBeats 비행 소요 박 수
 * @param spb 초당 박 시간 (seconds per beat)
 * @param previewStart 사전 출현 시작 시간 (선택값)
 * @param clamp 0~1 범위 클램프 여부 (기본값: true)
 * @returns 비행 진행도 (clamp=true 시 0.0 ~ 1.0)
 */
export function computeFlightProgress(
  now: number,
  landingTime: number,
  leadBeats: number,
  spb: number,
  previewStart?: number,
  clamp: boolean = true,
): number {
  const displayStart =
    previewStart !== undefined && Number.isFinite(previewStart)
      ? Math.max(previewStart, landingTime - leadBeats * spb)
      : landingTime - leadBeats * spb;
  const duration = landingTime - displayStart;

  if (duration <= 0) {
    return 1.0;
  }

  const raw = (now - displayStart) / duration;
  if (!clamp) {
    return raw;
  }
  return Math.max(0.0, Math.min(1.0, raw));
}

/**
 * 소실점(vx, vy)에서 목표 지점(tx, ty)까지 비행 진행도 및 원근 가속(t^easingExponent)을 적용한 좌표 및 스케일 산출
 *
 * @param vx 소실점 X 좌표
 * @param vy 소실점 Y 좌표
 * @param tx 목표 지점 X 좌표
 * @param ty 목표 지점 Y 좌표
 * @param progress 비행 진행도
 * @param options 비행 옵션 ({ minScale, maxScale, easingExponent })
 * @returns 투영 결과 ({ x, y, scale, t, progress })
 */
export function projectFlight(
  vx: number,
  vy: number,
  tx: number,
  ty: number,
  progress: number,
  options?: ProjectFlightOptions,
): FlightProjectionResult {
  const minScale = options?.minScale ?? 0.3;
  const maxScale = options?.maxScale ?? 1.2;
  const easingExponent = options?.easingExponent ?? 2.0;

  const p = Math.max(0.0, Math.min(1.0, progress));
  const t = Math.pow(p, easingExponent);
  const x = vx + (tx - vx) * t;
  const y = vy + (ty - vy) * t;
  const scale = minScale + (maxScale - minScale) * t;

  return {
    x,
    y,
    scale,
    t,
    progress: p,
  };
}

/**
 * 노트 비행 진행도에 따른 목표 피트니스 존 어프로치 링 수축 배율 계산
 * - 진행도 0.0일 때 startScale(기본 2.5) -> 1.0 안착 시 endScale(기본 1.0)
 *
 * @param progress 비행 진행도
 * @param startScale 시작 크기 배율 (기본값: 2.5)
 * @param endScale 착지 크기 배율 (기본값: 1.0)
 * @returns 수축된 어프로치 링 배율
 */
export function computeApproachScale(
  progress: number,
  startScale: number = 2.5,
  endScale: number = 1.0,
): number {
  const clamped = Math.max(0.0, Math.min(1.0, progress));
  return endScale + (startScale - endScale) * (1.0 - clamped);
}
