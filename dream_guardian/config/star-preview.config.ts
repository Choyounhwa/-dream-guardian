/**
 * star-preview.config.ts - 박자 기반 별 노트 사전 예고 설정 (Issue #407 - RHYTHM-INTRO-003)
 */

export interface StarPreviewConfig {
  /** 사전 예고 박자 수 (기본값: 2박) */
  leadBeats: number;
  /** 1박당 최소 시간 (초, 기본값: 0.05s). 이보다 작거나 NaN/무한대이면 비정상으로 간주하여 fallback */
  minSecondsPerBeat: number;
}

export const DEFAULT_STAR_PREVIEW_CONFIG: Readonly<StarPreviewConfig> = {
  leadBeats: 2,
  minSecondsPerBeat: 0.05,
};

export interface StarBeatPreviewOptions {
  /** 분기 또는 시퀀스 시작 시각 (초) */
  startTime: number;
  /** 1박당 소요 시간 (초, 60 / BPM) */
  secondsPerBeat: number;
  /** 사전 예고 박자 수 (미지정 시 DEFAULT_STAR_PREVIEW_CONFIG.leadBeats 사용) */
  leadBeats?: number;
}
