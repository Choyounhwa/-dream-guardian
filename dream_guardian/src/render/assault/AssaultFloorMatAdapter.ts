/**
 * AssaultFloorMatAdapter.ts - 보스 접근전(Boss Assault) 전용 분리형 바닥 판정선 어댑터
 *
 * [ASSAULT-FX-001] (Issue #690)
 * - RunningMatRenderer를 캡슐화하여 어설트 모드 원근 뷰포트에 맞춘 바닥 판정선을 렌더링.
 * - config/assault-visual.config.ts의 enableFloorMat 플래그에 따라 손쉬운 On/Off 및 격리 지원.
 * - enableFloorMat이 false일 때 0ms/0드로우로 즉시 바이패스.
 * - 추후 바닥 판정선을 완전 제거할 때도 이 파일과 호출부 1줄만 삭제하여 무영향 격리 보장.
 */

import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../../config/assault-visual.config.js';
import { RunningMatRenderer, type RunningMatRenderOptions } from '../RunningMatRenderer.js';

export interface AssaultFloorMatAdapterOptions {
  /** 외부에서 주입 가능한 RunningMatRenderer 인스턴스 */
  runningMatRenderer?: RunningMatRenderer;
  /** 바닥 판정선 렌더링 활성화 여부 (미지정 시 DEFAULT_ASSAULT_VISUAL_CONFIG.enableFloorMat 사용) */
  enableFloorMat?: boolean;
}

export interface AssaultFloorMatRenderOptions {
  /** 원근 소실점 좌표 */
  vanishingPoint: { x: number; y: number };
  /** 경과 시간 (초) */
  elapsedTime?: number;
  /** 메트로놈 비트 진행도 (0.0 ~ 1.0) */
  beatProgress?: number;
  /** 프레임 단위 델타 타임 (초) */
  deltaTime?: number;
  /** 호출 시점 오버라이드 가능한 RunningMatRenderer */
  runningMatRenderer?: RunningMatRenderer | null;
  /** 호출 시점 오버라이드 가능한 활성화 여부 */
  enableFloorMat?: boolean;
}

export class AssaultFloorMatAdapter {
  private readonly _defaultRenderer: RunningMatRenderer;
  private readonly _enableFloorMat: boolean;

  constructor(options?: AssaultFloorMatAdapterOptions) {
    this._defaultRenderer = options?.runningMatRenderer ?? new RunningMatRenderer();
    this._enableFloorMat = options?.enableFloorMat ?? DEFAULT_ASSAULT_VISUAL_CONFIG.enableFloorMat;
  }

  /**
   * 바닥 판정선 활성화 여부 확인
   */
  public get isEnabled(): boolean {
    return this._enableFloorMat;
  }

  /**
   * 어설트 모드 바닥 판정선 렌더링
   * @returns 렌더링 수행 여부 (true: 정상 렌더링, false: 비활성화 또는 크기 오류로 바이패스)
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: AssaultFloorMatRenderOptions
  ): boolean {
    const isEnabled = options.enableFloorMat ?? this._enableFloorMat;
    if (!isEnabled) {
      return false;
    }

    if (!ctx || typeof ctx.beginPath !== 'function') {
      return false;
    }

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return false;
    }

    const renderer = options.runningMatRenderer ?? this._defaultRenderer;

    const renderOptions: RunningMatRenderOptions = {
      vanishingPoint: options.vanishingPoint,
      elapsedTime: options.elapsedTime,
      beatProgress: options.beatProgress,
      deltaTime: options.deltaTime,
    };

    // 어설트 모드에서는 동작 큐가 없는 앰비언트 모드(view = null)로 판정선 및 원근 그리드만 렌더링
    renderer.render(ctx, null, width, height, renderOptions);
    return true;
  }
}
