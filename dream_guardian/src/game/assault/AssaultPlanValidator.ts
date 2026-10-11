/**
 * AssaultPlanValidator.ts - 공격 데이터 사전 유효성 검증 순수 함수기
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §6.5)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-05 / Issue #507)
 *
 * 절대 규칙:
 * 1. Game 레이어 순수 검증 단일 책임: 입력 데이터의 스키마, 수치, 박자 경계, 중첩, 프로필을 검증한다.
 * 2. 런타임 진행, 상태 변경, 피해 정산, 시각 효과 실행, 자동 보정, 레거시 폴백 일체 배제.
 * 3. 원본 데이터 불변 보장.
 * 4. 검증 실패 시 명확한 경로(path), 코드(code), 원인 메시지(message)를 포함한 오류 목록 반환.
 */

import type {
  AssaultEncounterKind,
} from '../../types/assault.js';
import type { AssaultApproachPattern } from '../../data/assault/approachPatterns.js';

export type AssaultValidationErrorCode =
  | 'INVALID_OBJECT'
  | 'MISSING_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_SCHEMA_VERSION'
  | 'INVALID_PATTERN_ID'
  | 'INVALID_TOTAL_BEATS'
  | 'MIN_TOTAL_BEATS_VIOLATION'
  | 'UNKNOWN_PROFILE'
  | 'INVALID_ENCOUNTERS_LIST'
  | 'DUPLICATE_ATTACK_ID'
  | 'INVALID_KIND'
  | 'INVALID_START_BEAT'
  | 'INVALID_DURATION_BEATS'
  | 'SLOT_EXCEEDED'
  | 'ORDER_INVERSION'
  | 'ENCOUNTER_OVERLAP'
  | 'INSUFFICIENT_RECOVERY_GAP'
  | 'INVALID_WINDOW_TIMING';

export interface AssaultValidationError {
  readonly path: string;
  readonly code: AssaultValidationErrorCode | string;
  readonly message: string;
}

export interface AssaultValidationSuccess<T = AssaultApproachPattern> {
  readonly valid: true;
  readonly data: T;
  readonly errors?: undefined;
}

export interface AssaultValidationFailure {
  readonly valid: false;
  readonly data?: undefined;
  readonly errors: readonly AssaultValidationError[];
}

export type AssaultValidationResult<T = AssaultApproachPattern> =
  | AssaultValidationSuccess<T>
  | AssaultValidationFailure;

export interface AssaultPlanValidationOptions {
  /** 허용 스키마 버전 목록 (지정하지 않을 시 기본값: ['1.0.0']) */
  readonly allowedSchemaVersions?: readonly string[];
  /** 최소 총 박자 수 (기본값: 8, A03) */
  readonly minTotalBeats?: number;
  /** 허용 타이밍 프로필 목록 (옵션) */
  readonly allowedTimingProfiles?: readonly string[];
  /** 허용 밸런스 프로필 목록 (옵션) */
  readonly allowedBalanceProfiles?: readonly string[];
  /** 허용 인터랙션 프로필 목록 (옵션) */
  readonly allowedInteractionProfiles?: readonly string[];
  /** 허용 비주얼 프로필 목록 (옵션) */
  readonly allowedVisualProfiles?: readonly string[];
  /** 조우 간 필수 최소 복귀 간격 박자 (기본값: 0) */
  readonly minRecoveryBeats?: number;
}

const APPROVED_KINDS: readonly AssaultEncounterKind[] = ['answer_pair', 'squat', 'jump'];

/**
 * 보스 접근전 공격 데이터 사전 유효성 검증 순수 함수
 *
 * @param input 검증 대상 unknown 데이터
 * @param options 선택적 검증 프로필/임계치 옵션
 * @returns 성공 시 { valid: true, data }, 실패 시 { valid: false, errors }
 */
export function validateAssaultPlan(
  input: unknown,
  options?: AssaultPlanValidationOptions,
): AssaultValidationResult<AssaultApproachPattern> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      errors: [
        {
          path: '',
          code: 'INVALID_OBJECT',
          message: 'Input must be a non-null object',
        },
      ],
    };
  }

  const errors: AssaultValidationError[] = [];
  const raw = input as Record<string, unknown>;

  // 1. schemaVersion
  if (typeof raw.schemaVersion !== 'string' || raw.schemaVersion.trim() === '') {
    errors.push({
      path: 'schemaVersion',
      code: 'MISSING_FIELD',
      message: 'schemaVersion must be a non-empty string',
    });
  } else if (
    options?.allowedSchemaVersions &&
    !options.allowedSchemaVersions.includes(raw.schemaVersion)
  ) {
    errors.push({
      path: 'schemaVersion',
      code: 'INVALID_SCHEMA_VERSION',
      message: `schemaVersion "${raw.schemaVersion}" is not in allowedSchemaVersions: [${options.allowedSchemaVersions.join(', ')}]`,
    });
  }

  // 2. patternId
  if (typeof raw.patternId !== 'string' || raw.patternId.trim() === '') {
    errors.push({
      path: 'patternId',
      code: 'INVALID_PATTERN_ID',
      message: 'patternId must be a non-empty string',
    });
  }

  // 3. timingProfileId
  if (typeof raw.timingProfileId !== 'string' || raw.timingProfileId.trim() === '') {
    errors.push({
      path: 'timingProfileId',
      code: 'MISSING_FIELD',
      message: 'timingProfileId must be a non-empty string',
    });
  } else if (
    options?.allowedTimingProfiles &&
    !options.allowedTimingProfiles.includes(raw.timingProfileId)
  ) {
    errors.push({
      path: 'timingProfileId',
      code: 'UNKNOWN_PROFILE',
      message: `timingProfileId "${raw.timingProfileId}" is not in allowedTimingProfiles`,
    });
  }

  // 4. balanceProfileId (옵션)
  if (raw.balanceProfileId !== undefined) {
    if (typeof raw.balanceProfileId !== 'string' || raw.balanceProfileId.trim() === '') {
      errors.push({
        path: 'balanceProfileId',
        code: 'INVALID_TYPE',
        message: 'balanceProfileId must be a non-empty string if provided',
      });
    } else if (
      options?.allowedBalanceProfiles &&
      !options.allowedBalanceProfiles.includes(raw.balanceProfileId)
    ) {
      errors.push({
        path: 'balanceProfileId',
        code: 'UNKNOWN_PROFILE',
        message: `balanceProfileId "${raw.balanceProfileId}" is not in allowedBalanceProfiles`,
      });
    }
  }

  // 5. totalBeats
  const minTotalBeats = options?.minTotalBeats ?? 8;
  let parsedTotalBeats: number | undefined;

  if (
    typeof raw.totalBeats !== 'number' ||
    !Number.isFinite(raw.totalBeats) ||
    raw.totalBeats <= 0
  ) {
    errors.push({
      path: 'totalBeats',
      code: 'INVALID_TOTAL_BEATS',
      message: 'totalBeats must be a positive finite number',
    });
  } else if (raw.totalBeats < minTotalBeats) {
    errors.push({
      path: 'totalBeats',
      code: 'MIN_TOTAL_BEATS_VIOLATION',
      message: `totalBeats (${raw.totalBeats}) must be at least minTotalBeats (${minTotalBeats})`,
    });
  } else {
    parsedTotalBeats = raw.totalBeats;
  }

  // 6. encounters
  if (!Array.isArray(raw.encounters) || raw.encounters.length === 0) {
    errors.push({
      path: 'encounters',
      code: 'INVALID_ENCOUNTERS_LIST',
      message: 'encounters must be a non-empty array',
    });
  } else {
    const seenAttackIds = new Set<string>();
    const minRecoveryBeats = options?.minRecoveryBeats ?? 0;

    let prevStartBeat: number | null = null;
    let prevEndBeat: number | null = null;

    for (let i = 0; i < raw.encounters.length; i++) {
      const enc = raw.encounters[i];
      const pathPrefix = `encounters[${i}]`;

      if (!enc || typeof enc !== 'object' || Array.isArray(enc)) {
        errors.push({
          path: pathPrefix,
          code: 'INVALID_OBJECT',
          message: `${pathPrefix} must be a non-null object`,
        });
        continue;
      }

      const encObj = enc as Record<string, unknown>;

      // 6.1 id
      if (typeof encObj.id !== 'string' || encObj.id.trim() === '') {
        errors.push({
          path: `${pathPrefix}.id`,
          code: 'MISSING_FIELD',
          message: `${pathPrefix}.id must be a non-empty string`,
        });
      } else {
        if (seenAttackIds.has(encObj.id)) {
          errors.push({
            path: `${pathPrefix}.id`,
            code: 'DUPLICATE_ATTACK_ID',
            message: `Duplicate attack id "${encObj.id}" found at ${pathPrefix}.id`,
          });
        }
        seenAttackIds.add(encObj.id);
      }

      // 6.2 kind
      if (
        typeof encObj.kind !== 'string' ||
        !APPROVED_KINDS.includes(encObj.kind as AssaultEncounterKind)
      ) {
        errors.push({
          path: `${pathPrefix}.kind`,
          code: 'INVALID_KIND',
          message: `${pathPrefix}.kind "${encObj.kind}" is not a valid kind (${APPROVED_KINDS.join(', ')})`,
        });
      }

      // 6.3 startBeat
      let validStartBeat: number | null = null;
      if (
        typeof encObj.startBeat !== 'number' ||
        !Number.isFinite(encObj.startBeat) ||
        encObj.startBeat < 0
      ) {
        errors.push({
          path: `${pathPrefix}.startBeat`,
          code: 'INVALID_START_BEAT',
          message: `${pathPrefix}.startBeat must be a finite number >= 0`,
        });
      } else {
        validStartBeat = encObj.startBeat;
      }

      // 6.4 durationBeats
      let validDurationBeats: number | null = null;
      if (
        typeof encObj.durationBeats !== 'number' ||
        !Number.isFinite(encObj.durationBeats) ||
        encObj.durationBeats <= 0
      ) {
        errors.push({
          path: `${pathPrefix}.durationBeats`,
          code: 'INVALID_DURATION_BEATS',
          message: `${pathPrefix}.durationBeats must be a finite number > 0`,
        });
      } else {
        validDurationBeats = encObj.durationBeats;
      }

      // 6.5 interactionProfileId
      if (
        typeof encObj.interactionProfileId !== 'string' ||
        encObj.interactionProfileId.trim() === ''
      ) {
        errors.push({
          path: `${pathPrefix}.interactionProfileId`,
          code: 'MISSING_FIELD',
          message: `${pathPrefix}.interactionProfileId must be a non-empty string`,
        });
      } else if (
        options?.allowedInteractionProfiles &&
        !options.allowedInteractionProfiles.includes(encObj.interactionProfileId)
      ) {
        errors.push({
          path: `${pathPrefix}.interactionProfileId`,
          code: 'UNKNOWN_PROFILE',
          message: `${pathPrefix}.interactionProfileId "${encObj.interactionProfileId}" is not in allowedInteractionProfiles`,
        });
      }

      // 6.6 visualProfileId
      if (
        typeof encObj.visualProfileId !== 'string' ||
        encObj.visualProfileId.trim() === ''
      ) {
        errors.push({
          path: `${pathPrefix}.visualProfileId`,
          code: 'MISSING_FIELD',
          message: `${pathPrefix}.visualProfileId must be a non-empty string`,
        });
      } else if (
        options?.allowedVisualProfiles &&
        !options.allowedVisualProfiles.includes(encObj.visualProfileId)
      ) {
        errors.push({
          path: `${pathPrefix}.visualProfileId`,
          code: 'UNKNOWN_PROFILE',
          message: `${pathPrefix}.visualProfileId "${encObj.visualProfileId}" is not in allowedVisualProfiles`,
        });
      }

      // 6.7 경계, 순서 및 중첩 검사
      if (validStartBeat !== null && validDurationBeats !== null) {
        const currentEndBeat = validStartBeat + validDurationBeats;

        // 슬롯 초과 검사
        if (parsedTotalBeats !== undefined && currentEndBeat > parsedTotalBeats) {
          errors.push({
            path: pathPrefix,
            code: 'SLOT_EXCEEDED',
            message: `${pathPrefix} end beat (${currentEndBeat}) exceeds totalBeats (${parsedTotalBeats})`,
          });
        }

        // 이전 조우와의 시퀀스 무결성 검사
        if (prevStartBeat !== null && prevEndBeat !== null) {
          if (validStartBeat < prevStartBeat) {
            errors.push({
              path: `${pathPrefix}.startBeat`,
              code: 'ORDER_INVERSION',
              message: `${pathPrefix}.startBeat (${validStartBeat}) is earlier than previous startBeat (${prevStartBeat})`,
            });
          } else if (validStartBeat < prevEndBeat) {
            errors.push({
              path: pathPrefix,
              code: 'ENCOUNTER_OVERLAP',
              message: `${pathPrefix} startBeat (${validStartBeat}) overlaps with previous encounter endBeat (${prevEndBeat})`,
            });
          } else if (
            minRecoveryBeats > 0 &&
            validStartBeat < prevEndBeat + minRecoveryBeats
          ) {
            errors.push({
              path: pathPrefix,
              code: 'INSUFFICIENT_RECOVERY_GAP',
              message: `${pathPrefix} gap (${validStartBeat - prevEndBeat}) is less than required minRecoveryBeats (${minRecoveryBeats})`,
            });
          }
        }

        prevStartBeat = validStartBeat;
        prevEndBeat = currentEndBeat;

        // 6.8 하위 창(Window Timing) 유효성 검사
        const ws =
          typeof encObj.windowStartBeat === 'number' &&
          Number.isFinite(encObj.windowStartBeat)
            ? encObj.windowStartBeat
            : null;
        const we =
          typeof encObj.windowEndBeat === 'number' &&
          Number.isFinite(encObj.windowEndBeat)
            ? encObj.windowEndBeat
            : null;
        const arr =
          typeof encObj.arrivalBeat === 'number' &&
          Number.isFinite(encObj.arrivalBeat)
            ? encObj.arrivalBeat
            : null;
        const rec =
          typeof encObj.recoveryBeat === 'number' &&
          Number.isFinite(encObj.recoveryBeat)
            ? encObj.recoveryBeat
            : null;

        if (ws !== null && ws < validStartBeat) {
          errors.push({
            path: `${pathPrefix}.windowStartBeat`,
            code: 'INVALID_WINDOW_TIMING',
            message: `${pathPrefix}.windowStartBeat (${ws}) cannot be before startBeat (${validStartBeat})`,
          });
        }
        if (ws !== null && we !== null && ws > we) {
          errors.push({
            path: `${pathPrefix}.windowEndBeat`,
            code: 'INVALID_WINDOW_TIMING',
            message: `${pathPrefix}.windowEndBeat (${we}) cannot be before windowStartBeat (${ws})`,
          });
        }
        if (we !== null && arr !== null && we > arr) {
          errors.push({
            path: `${pathPrefix}.arrivalBeat`,
            code: 'INVALID_WINDOW_TIMING',
            message: `${pathPrefix}.arrivalBeat (${arr}) cannot be before windowEndBeat (${we})`,
          });
        }
        if (arr !== null && rec !== null && arr > rec) {
          errors.push({
            path: `${pathPrefix}.recoveryBeat`,
            code: 'INVALID_WINDOW_TIMING',
            message: `${pathPrefix}.recoveryBeat (${rec}) cannot be before arrivalBeat (${arr})`,
          });
        }
        if (rec !== null && rec > currentEndBeat) {
          errors.push({
            path: `${pathPrefix}.recoveryBeat`,
            code: 'INVALID_WINDOW_TIMING',
            message: `${pathPrefix}.recoveryBeat (${rec}) exceeds encounter end beat (${currentEndBeat})`,
          });
        }
        if (we !== null && we > currentEndBeat) {
          errors.push({
            path: `${pathPrefix}.windowEndBeat`,
            code: 'INVALID_WINDOW_TIMING',
            message: `${pathPrefix}.windowEndBeat (${we}) exceeds encounter end beat (${currentEndBeat})`,
          });
        }
        if (arr !== null && arr > currentEndBeat) {
          errors.push({
            path: `${pathPrefix}.arrivalBeat`,
            code: 'INVALID_WINDOW_TIMING',
            message: `${pathPrefix}.arrivalBeat (${arr}) exceeds encounter end beat (${currentEndBeat})`,
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    data: input as AssaultApproachPattern,
  };
}

/**
 * AssaultApproachPattern 순수 타입 가드
 */
export function isAssaultApproachPattern(
  input: unknown,
  options?: AssaultPlanValidationOptions,
): input is AssaultApproachPattern {
  return validateAssaultPlan(input, options).valid;
}
