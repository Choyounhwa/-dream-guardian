/**
 * assault-question.config.ts - 보스 접근전(Boss Assault) 문항 적격성 및 읽기 시간 규칙 설정
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§5.1, 15.1-A6, 15.3-C1, C9)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-39 / Issue #542)
 *
 * 절대 규칙:
 * 1. 순수 설정 데이터만 정의한다.
 * 2. Deep freeze를 통해 불변성을 보장한다.
 * 3. Math.random 일체 사용 금지.
 */

export interface ReadingLengthThreshold {
  readonly thresholdChars: number;
  readonly additionalSeconds: number;
}

export interface AssaultQuestionConfig {
  /** 허용 레벨 목록 (기본: Ch.1~2 = [1, 2, 3, 4], DEC-A6) */
  readonly allowedLevels: readonly number[];
  /** 보기 라벨 최대 글자 수 상한 (DEC-C9: 6자 이내) */
  readonly maxLabelChars: number;
  /** 기본 읽기 시간 (초, DEC-C1: 4.0초) */
  readonly baseReadingSeconds: number;
  /** 텍스트 길이 임계치 초과 가산 초 규칙표 (DEC-C1) */
  readonly readingLengthThresholds: readonly ReadingLengthThreshold[];
  /** 레벨별 가산 초 규칙표 (DEC-C1) */
  readonly levelAdditionalSeconds: Readonly<Record<number, number>>;
  /** shapeCode 불허 여부 (기본: true, DEC-A6) */
  readonly disallowShapeCode: boolean;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

export const DEFAULT_ASSAULT_QUESTION_CONFIG: Readonly<AssaultQuestionConfig> = deepFreeze({
  allowedLevels: [1, 2, 3, 4],
  maxLabelChars: 6,
  baseReadingSeconds: 4.0,
  readingLengthThresholds: [
    { thresholdChars: 10, additionalSeconds: 1.0 },
    { thresholdChars: 20, additionalSeconds: 1.0 },
  ],
  levelAdditionalSeconds: {
    1: 0.0,
    2: 0.5,
    3: 1.0,
    4: 1.5,
  },
  disallowShapeCode: true,
});
