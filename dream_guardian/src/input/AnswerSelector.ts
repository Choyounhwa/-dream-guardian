/**
 * AnswerSelector - 10존 피트니스 레이아웃 및 4색 신체 커서 답안 선택
 *
 * 4색 커서: 왼손(시안), 오른손(노랑), 어깨(보라), 엉덩이(주황)
 * 10개 피트니스 존에 1초 연속 체류 시 선택 확정
 * 중심 가중치 1.5배, 가장자리 0.75배
 *
 * @see Issue #18 (GitHub #83)
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
export type CursorType = 'leftHand' | 'rightHand' | 'shoulder' | 'hip';

/** 커서 색상 매핑 */
export const CURSOR_COLORS: Record<CursorType, string> = {
  leftHand: '#28E6FF',
  rightHand: '#FFCB4D',
  shoulder: '#C889FF',
  hip: '#FF865E',
};

/** 10존 레이아웃 (정규화 좌표) */
const ZONES: FitnessZone[] = [
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

/** 어깨 커서 사용 가능 존 (중간존 4,5,6,7,8) */
const SHOULDER_ZONES = new Set([4, 5, 6, 7, 8]);
/** 엉덩이 커서 사용 가능 존 (하단존 6~10) */
const HIP_ZONES = new Set([6, 7, 8, 9, 10]);

export interface SelectionResult {
  zoneId: number;
  cursorType: CursorType;
  progress: number; // 0~1
  confirmed: boolean;
}

export class AnswerSelector {
  private _dwellTime: number;
  private _centerWeight: number;
  private _edgeWeight: number;
  private _progress = new Map<string, number>(); // "zoneId-cursorType" → progress

  constructor(
    dwellTime = DEFAULT_CONFIG.input.dwellTime,
    centerWeight = DEFAULT_CONFIG.input.centerWeight,
    edgeWeight = DEFAULT_CONFIG.input.edgeWeight,
  ) {
    this._dwellTime = dwellTime;
    this._centerWeight = centerWeight;
    this._edgeWeight = edgeWeight;
  }

  /** 전체 존 목록 */
  get zones(): readonly FitnessZone[] {
    return ZONES;
  }

  /** 현재 충전 진행도 조회 */
  getProgress(zoneId: number, cursorType: CursorType): number {
    return this._progress.get(`${zoneId}-${cursorType}`) ?? 0;
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

    for (const zone of ZONES) {
      // 커서 제한
      if (cursorType === 'shoulder' && !SHOULDER_ZONES.has(zone.id)) continue;
      if (cursorType === 'hip' && !HIP_ZONES.has(zone.id)) continue;

      if (nx >= zone.x && nx <= zone.x + zone.width &&
          ny >= zone.y && ny <= zone.y + zone.height) {

        // 중심 거리 기반 가중치
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
