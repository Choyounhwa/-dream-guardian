/**
 * 순차 별 안무의 단일 비트 목표.
 * 한 StarTarget은 정확히 하나의 신체 커서와 하나의 피트니스 존만 요구한다.
 */
import type { CursorType } from '../../config/cursor.config.js';
import type { BodyPart } from './posture.js';

export interface StarTarget {
  /** 원본 fitness pattern.csv 레코드 ID */
  patternId: string;
  /** 별을 수집해야 하는 커서 */
  part: BodyPart;
  /** 목표 피트니스 존 ID (1~11) */
  zoneId: number;
  /** 시퀀스 안의 1부터 시작하는 비트 인덱스 */
  beatIndex: number;
  /** 커서 타입 별칭 (part와 호환) */
  cursorType?: CursorType;
  /** 비트 착지 목표 시각 (초) */
  landingTime?: number;
}
