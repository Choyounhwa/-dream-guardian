/**
 * AnswerSelector - 10존 피트니스 레이아웃 및 4색 신체 커서 답안 선택
 *
 * 4색 커서: 왼손(시안), 오른손(노랑), 머리/얼굴(보라), 엉덩이/골반(주황)
 * (어깨 커서는 카메라 안정성을 위해 머리/얼굴 head로 개편, 호환 유지)
 *
 * 스테이지 진행도 기반 점증적 난이도 곡선 (Tier 1 ~ Tier 4):
 * - Tier 1 (문제 1~3 / 웜업): 단일 손, 0.7초 체류
 * - Tier 2 (문제 4~7 / 체간 스트레칭): 머리 기울이기 또는 양손, 0.8초 체류
 * - Tier 3 (문제 8~11 / 전신 협응): 손+골반 또는 머리+골반 (미니 스쿼트), 1.0초 체류
 * - Tier 4 (문제 12+ / 보스 피니시): 양손 만세 포즈, 1.2초 체류
 *
 * @see Issue #18 (GitHub #83), Issue #104, Issue #105 (GitHub #105)
 */

import { DEFAULT_CONFIG } from '../core/Config.js';

/** 피트니스 존 정의 */
export interface FitnessZone {
  id: number;
  label: string;
  /** 정규화 좌표 (0~1) */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 커서 종류 */
export type CursorType = 'leftHand' | 'rightHand' | 'head' | 'shoulder' | 'hip';

/** 커서 색상 매핑 */
export const CURSOR_COLORS: Record<CursorType, string> = {
  leftHand: '#28E6FF',
  rightHand: '#FFCB4D',
  head: '#C889FF',      // 머리/얼굴 (보라)
  shoulder: '#C889FF',  // 어깨 (호환성 유지)
  hip: '#FF865E',       // 골반/엉덩이 (주황)
};

/** 10존 레이아웃 (정규화 좌표) */
export const FITNESS_ZONES: FitnessZone[] = [
  { id: 1,  label: '좌상', x: 0.05, y: 0.05, width: 0.28, height: 0.25 },
  { id: 2,  label: '상단', x: 0.36, y: 0.05, width: 0.28, height: 0.25 },
  { id: 3,  label: '우상', x: 0.67, y: 0.05, width: 0.28, height: 0.25 },
  { id: 4,  label: '좌',   x: 0.05, y: 0.33, width: 0.28, height: 0.25 },
  { id: 5,  label: '우',   x: 0.67, y: 0.33, width: 0.28, height: 0.25 },
  { id: 6,  label: '좌하', x: 0.05, y: 0.55, width: 0.28, height: 0.20 },
  { id: 7,  label: '중하', x: 0.36, y: 0.55, width: 0.28, height: 0.20 },
  { id: 8,  label: '우하', x: 0.67, y: 0.55, width: 0.28, height: 0.20 },
  { id: 9,  label: '좌저', x: 0.05, y: 0.78, width: 0.28, height: 0.20 },
  { id: 10, label: '하단', x: 0.36, y: 0.78, width: 0.28, height: 0.20 },
];

/** 머리/얼굴 커서 사용 가능 존 (상단 및 측면 존 1, 2, 3, 4, 5, 7) */
export const HEAD_ZONES = new Set([1, 2, 3, 4, 5, 7]);
/** 어깨 커서 사용 가능 존 (중간존 4, 5, 6, 7, 8 - 호환) */
export const SHOULDER_ZONES = new Set([4, 5, 6, 7, 8]);
/** 엉덩이/골반 커서 사용 가능 존 (하단존 6~10) */
export const HIP_ZONES = new Set([6, 7, 8, 9, 10]);

export interface SelectionResult {
  zoneId: number;
  cursorType: CursorType;
  progress: number; // 0~1
  confirmed: boolean;
}

export interface TierInfo {
  tier: 1 | 2 | 3 | 4;
  dwellTime: number; // 0.7, 0.8, 1.0, 1.2
  name: string;
  allowedCursors: CursorType[];
}

/**
 * 문제 번호 기반 점증적 난이도 티어 계산
 * @param questionNumber 1부터 시작하는 문제 번호 (1-based)
 * @param isComplexQuestion 긴 문항이나 고난도 연산 시 인지 부하 완화 여부
 */
export function getTierInfo(questionNumber: number, isComplexQuestion = false): TierInfo {
  let tier: 1 | 2 | 3 | 4 = 1;
  let dwellTime = 0.7;
  let name = 'warmup';
  let allowedCursors: CursorType[] = ['leftHand', 'rightHand'];

  if (questionNumber >= 12) {
    tier = 4;
    dwellTime = 1.2;
    name = 'finish';
    allowedCursors = ['leftHand', 'rightHand'];
  } else if (questionNumber >= 8) {
    tier = 3;
    dwellTime = 1.0;
    name = 'fullbody';
    allowedCursors = ['leftHand', 'rightHand', 'head', 'hip'];
  } else if (questionNumber >= 4) {
    tier = 2;
    dwellTime = 0.8;
    name = 'trunk';
    allowedCursors = ['leftHand', 'rightHand', 'head'];
  } else {
    tier = 1;
    dwellTime = 0.7;
    name = 'warmup';
    allowedCursors = ['leftHand', 'rightHand'];
  }

  // 두뇌 피로도 완충 룰: 인지 난이도가 높으면 Tier 1~2로 자동 완화
  if (isComplexQuestion && tier > 2) {
    tier = 2;
    dwellTime = 0.8;
    name = 'trunk';
    allowedCursors = ['leftHand', 'rightHand', 'head'];
  }

  return { tier, dwellTime, name, allowedCursors };
}

export class AnswerSelector {
  private _dwellTime: number;
  private _centerWeight: number;
  private _edgeWeight: number;
  private _currentQuestionNumber = 1;
  private _isComplexQuestion = false;
  private _currentTierInfo: TierInfo;
  private _progress = new Map<string, number>(); // "zoneId-cursorType" → progress

  constructor(
    dwellTime = DEFAULT_CONFIG.input.dwellTime,
    centerWeight = DEFAULT_CONFIG.input.centerWeight,
    edgeWeight = DEFAULT_CONFIG.input.edgeWeight,
  ) {
    this._dwellTime = dwellTime;
    this._centerWeight = centerWeight;
    this._edgeWeight = edgeWeight;
    this._currentTierInfo = getTierInfo(1);
  }

  /** 전체 존 목록 */
  get zones(): readonly FitnessZone[] {
    return FITNESS_ZONES;
  }

  /** 현재 체류 시간 설정값 */
  get dwellTime(): number {
    return this._dwellTime;
  }

  /** 현재 난이도 티어 정보 */
  get tierInfo(): TierInfo {
    return this._currentTierInfo;
  }

  /** 현재 충전 진행도 조회 */
  getProgress(zoneId: number, cursorType: CursorType): number {
    return this._progress.get(`${zoneId}-${cursorType}`) ?? 0;
  }

  /**
   * 스테이지 내 문제 번호 설정 (점증적 난이도 곡선 적용)
   * @param questionNumber 1-based 문제 번호
   * @param isComplexQuestion 인지 부하 완화 필요 여부
   */
  setQuestion(questionNumber: number, isComplexQuestion = false): void {
    this._currentQuestionNumber = Math.max(1, questionNumber);
    this._isComplexQuestion = isComplexQuestion;
    this._currentTierInfo = getTierInfo(this._currentQuestionNumber, this._isComplexQuestion);
    this._dwellTime = this._currentTierInfo.dwellTime;
  }

  /**
   * 매 프레임 호출: 커서 위치로 존 체류 판정
   * @param cursorType 커서 종류
   * @param nx 정규화 X (0~1)
   * @param ny 정규화 Y (0~1)
   * @param dt 델타타임
   * @returns 확정된 존이 있으면 결과, 없으면 null
   */
  update(cursorType: CursorType, nx: number, ny: number, dt: number): SelectionResult | null {
    let bestZone: FitnessZone | null = null;
    let bestWeight = 0;

    for (const zone of FITNESS_ZONES) {
      // 신체 부위별 허용 존 제한
      if (cursorType === 'head' && !HEAD_ZONES.has(zone.id)) continue;
      if (cursorType === 'shoulder' && !SHOULDER_ZONES.has(zone.id)) continue;
      if (cursorType === 'hip' && !HIP_ZONES.has(zone.id)) continue;

      if (
        nx >= zone.x &&
        nx <= zone.x + zone.width &&
        ny >= zone.y &&
        ny <= zone.y + zone.height
      ) {
        // 중심 거리 기반 가중치 (중심 1.5배, 외곽 0.75배)
        const cx = zone.x + zone.width / 2;
        const cy = zone.y + zone.height / 2;
        const dx = Math.abs(nx - cx) / (zone.width / 2);
        const dy = Math.abs(ny - cy) / (zone.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const weight = dist < 0.5 ? this._centerWeight : this._edgeWeight;

        if (weight > bestWeight) {
          bestWeight = weight;
          bestZone = zone;
        }
      }
    }

    // 해당 존이 없으면 모든 진행도 감쇠
    if (!bestZone) {
      for (const [key, val] of this._progress) {
        if (key.endsWith(`-${cursorType}`)) {
          const newVal = Math.max(0, val - dt * 2);
          if (newVal <= 0) this._progress.delete(key);
          else this._progress.set(key, newVal);
        }
      }
      return null;
    }

    const key = `${bestZone.id}-${cursorType}`;
    const current = this._progress.get(key) ?? 0;
    const increment = (dt / this._dwellTime) * bestWeight;
    const newProgress = Math.min(1, current + increment);
    this._progress.set(key, newProgress);

    // 다른 존의 같은 커서 진행도 감쇠
    for (const [k, val] of this._progress) {
      if (k !== key && k.endsWith(`-${cursorType}`)) {
        const decayed = Math.max(0, val - dt * 2);
        if (decayed <= 0) this._progress.delete(k);
        else this._progress.set(k, decayed);
      }
    }

    const confirmed = newProgress >= 1;
    if (confirmed) {
      this._progress.delete(key);
    }

    return {
      zoneId: bestZone.id,
      cursorType,
      progress: newProgress,
      confirmed,
    };
  }

  /** 모든 진행도 초기화 */
  reset(): void {
    this._progress.clear();
  }
}
