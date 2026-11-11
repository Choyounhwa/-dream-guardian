/**
/**
 * AssaultPlanCompiler.ts - 보스 접근전(Boss Assault) 불변 실행 시간표 순수 컴파일러
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.5, 6.6, A17)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-06 / Issue #508)
 *
 * 절대 규칙:
 * 1. Game 순수 컴파일 단일 책임: 검증된 공격 패턴, 선택 BPM, 프로필 버전, 주입 시드를 받아
 *    활성 초(seconds) 단위의 불변 실행 시간표(AssaultCompiledPlan)를 생성한다.
 * 2. 0-based 박자 -> 활성 seconds 변환:
 *    - seconds = (beat * 60) / bpm
 *    - startBeat=0 -> seconds=0
 *    - 1-based Timeline 변환은 #516(BOSS-ASSAULT-14)에만 둔다.
 * 3. 순수 컴파일 보장:
 *    - Math.random / Date.now / performance.now 호출 일체 배제 (주입 시드/결정론적 로직만 사용).
 *    - 전역 config 동적 재읽기 배제 (컴파일 시점에 고정).
 *    - 타이머(setTimeout/setInterval/rAF), HP/자원 변경, effects 실행 일체 배제.
 * 4. 불변성(Immutability):
 *    - deepFreeze를 적용하여 원본 데이터와 완전히 격리된 Readonly 계획 객체를 반환한다.
 *    - 컴파일 후 외부 config나 원본 패턴이 변경되어도 결과는 불변이다.
 * 5. 검증 거부:
 *    - validateAssaultPlan 실패 또는 비정상 입력 시 컴파일을 거부하고 AssaultCompileError를 발생시킨다.
 */

import type {
  AttackId,
  AssaultEncounterKind,
  AssaultEncounterDef,
  ProfileId,
  PairId,
} from '../../types/assault.js';
import type { AssaultApproachPattern } from '../../data/assault/approachPatterns.js';
import {
  validateAssaultPlan,
  type AssaultValidationError,
} from './AssaultPlanValidator.js';
import { deepFreeze } from '../../utils/deepFreeze.js';
import { DEFAULT_ASSAULT_BPM } from '../../../config/assault.config.js';

/** 기본 표준 컴파일 BPM (config/assault.config.ts 단일 SSOT 재내보내기) */
export { DEFAULT_ASSAULT_BPM };

/**
 * 컴파일 옵션 인터페이스
 */
export interface AssaultCompileOptions {
  /** 라운드 진행 BPM (양의 유한수, 기본값 120) */
  readonly bpm?: number;
  /** 주입 시드 (결정적 재현성 보장) */
  readonly seed?: string | number;
  /** 질문 식별자 또는 질문 참조 객체 */
  readonly questionRef?: string | { readonly id: string; readonly [key: string]: unknown };
  /** 타이밍/규칙 계약 버전 */
  readonly rulesVersion?: string;
  /** 세션 식별자 (생략 시 패턴 기반 결정적 ID 생성) */
  readonly sessionId?: string;
  /** 라운드 식별자 */
  readonly roundId?: string;
  /** 최소 복귀 간격 박자 검증 기준 */
  readonly minRecoveryBeats?: number;
  /** 사전 유효성 검증 수행 여부 (기본값 true) */
  readonly validate?: boolean;
  /** 답안 체공/선택 박자 오버라이드 (미지정 시 패턴 정의값 유지) */
  readonly answerBeats?: number;
}

/**
 * 확장 조우 입력 인터페이스 (선택적 하위 창 박자 포함)
 */
export interface AssaultEncounterInput extends AssaultEncounterDef {
  readonly windowStartBeat?: number;
  readonly windowEndBeat?: number;
  readonly arrivalBeat?: number;
  readonly recoveryBeat?: number;
}

/**
 * 컴파일된 단일 조우/공격 불변 실행 단위 (Compiled Encounter)
 *
 * 0-based 박자 및 활성 초(seconds) 경계 타임스탬프를 모두 포함한다.
 */
export interface AssaultCompiledEncounter {
  /** 조우 고유 식별자 */
  readonly id: AttackId;
  /** 조우 종류 (answer_pair, squat, jump) */
  readonly kind: AssaultEncounterKind;
  /** 패턴 내 논리적 순서 인덱스 (0-based) */
  readonly index: number;

  /** 조우 시작 박자 (0-based) */
  readonly startBeat: number;
  /** 조우 총 지속 박자 */
  readonly durationBeats: number;

  /** 발사/스폰 시작 박자 (= startBeat) */
  readonly launchBeat: number;
  /** 입력 유효창 시작 박자 (기본값: startBeat) */
  readonly windowStartBeat: number;
  /** 입력 유효창 마감 박자 (기본값: startBeat + durationBeats) */
  readonly windowEndBeat: number;
  /** 목표 이상 도달/임팩트 박자 (기본값: windowEndBeat) */
  readonly impactBeat: number;
  /** impactBeat 별칭 (도착 박자) */
  readonly arrivalBeat: number;
  /** 복귀/후속 준비 마감 박자 (기본값: startBeat + durationBeats) */
  readonly retractDeadlineBeat: number;
  /** retractDeadlineBeat 별칭 (회복 박자) */
  readonly recoveryBeat: number;

  /** 발사/스폰 시작 시각 (초, 0-based active seconds) */
  readonly launchSeconds: number;
  /** launchSeconds 별칭 */
  readonly startSeconds: number;
  /** 입력 유효창 시작 시각 (초) */
  readonly windowStartSeconds: number;
  /** 입력 유효창 마감 시각 (초) */
  readonly windowEndSeconds: number;
  /** 목표 이상 도달/임팩트 시각 (초) */
  readonly impactSeconds: number;
  /** impactSeconds 별칭 */
  readonly arrivalSeconds: number;
  /** 복귀/후속 준비 마감 시각 (초) */
  readonly retractDeadlineSeconds: number;
  /** retractDeadlineSeconds 별칭 */
  readonly recoverySeconds: number;
  /** 조우 총 지속 시간 (초) */
  readonly durationSeconds: number;

  /** 직전 조우 종료 시점과의 복귀 간격 박자 (첫 조우는 0) */
  readonly gapFromPreviousBeats: number;
  /** 직전 조우 종료 시점과의 복귀 간격 시간 (초, 첫 조우는 0) */
  readonly gapFromPreviousSeconds: number;

  /** 인터랙션 프로필 식별자 */
  readonly interactionProfileId: ProfileId;
  /** 비주얼 프로필 식별자 */
  readonly visualProfileId: ProfileId;
  /** 답안 선택 정책 식별자 (선택 사항) */
  readonly answerPolicyId?: string;
  /** 보기 쌍 식별자 (선택 사항) */
  readonly pairId?: PairId;
}

/**
 * 불변 컴파일 실행 계획 (Assault Compiled Plan)
 */
export interface AssaultCompiledPlan {
  /** 스키마 버전 */
  readonly schemaVersion: string;
  /** 공격 패턴 식별자 */
  readonly patternId: string;
  /** 세션 식별자 */
  readonly sessionId: string;
  /** 라운드 식별자 */
  readonly roundId?: string;
  /** 규칙 계약 버전 */
  readonly rulesVersion: string;
  /** 타이밍 프로필 식별자 */
  readonly timingProfileId: ProfileId;
  /** 밸런스 프로필 식별자 */
  readonly balanceProfileId?: ProfileId;
  /** 컴파일 적용 BPM */
  readonly bpm: number;
  /** 1박당 지속 시간 (초, secondsPerBeat = 60 / bpm) */
  readonly secondsPerBeat: number;
  /** 패턴 총 박자 수 */
  readonly totalBeats: number;
  /** 패턴 총 활성 지속 시간 (초, totalDurationSeconds = (totalBeats * 60) / bpm) */
  readonly totalDurationSeconds: number;
  /** 주입 시드 */
  readonly seed?: string | number;
  /** 질문 참조 */
  readonly questionRef?: string | { readonly id: string; readonly [key: string]: unknown };
  /** 컴파일된 조우 목록 (순서 보존) */
  readonly encounters: readonly AssaultCompiledEncounter[];
}

/**
 * 컴파일 실패 오류 클래스
 */
export class AssaultCompileError extends Error {
  readonly errors: readonly AssaultValidationError[];

  constructor(message: string, errors: readonly AssaultValidationError[] = []) {
    super(message);
    this.name = 'AssaultCompileError';
    this.errors = Object.freeze([...errors]);
  }
}

/**
 * 안전 컴파일 결과 인터페이스
 */
export type AssaultCompileResult =
  | { readonly success: true; readonly plan: Readonly<AssaultCompiledPlan>; readonly errors?: undefined }
  | { readonly success: false; readonly errors: readonly AssaultValidationError[]; readonly error: AssaultCompileError; readonly plan?: undefined };

/**
 * 순수 박자 -> 초 변환 함수
 *
 * seconds = (beat * 60) / bpm
 */
export function beatToSeconds(beat: number, bpm: number): number {
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    throw new AssaultCompileError(`Invalid BPM: "${bpm}". BPM must be a positive finite number.`);
  }
  if (typeof beat !== 'number' || !Number.isFinite(beat)) {
    throw new AssaultCompileError(`Invalid beat: "${beat}". Beat must be a finite number.`);
  }
  if (beat === 0) {
    return 0;
  }
  return (beat * 60) / bpm;
}

/**
 * 순수 초 -> 박자 역변환 함수
 *
 * beat = (seconds * bpm) / 60
 */
export function secondsToBeat(seconds: number, bpm: number): number {
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    throw new AssaultCompileError(`Invalid BPM: "${bpm}". BPM must be a positive finite number.`);
  }
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    throw new AssaultCompileError(`Invalid seconds: "${seconds}". Seconds must be a finite number.`);
  }
  if (seconds === 0) {
    return 0;
  }
  return (seconds * bpm) / 60;
}

/**
 * 공격 패턴 불변 실행 시간표 순수 컴파일러
 *
 * @param pattern 대상 공격 패턴 (검증 전 객체 또는 AssaultApproachPattern)
 * @param options 컴파일 옵션 (BPM, 시드, 질문 참조 등)
 * @returns 딥 프리즈된 Readonly<AssaultCompiledPlan>
 * @throws {AssaultCompileError} 검증 실패 또는 부적합한 입력 시
 */
export function compileAssaultPlan(
  pattern: unknown,
  options?: AssaultCompileOptions,
): Readonly<AssaultCompiledPlan> {
  // 1. 유효성 검증 (옵션에 명시적 false가 아닌 한 실행)
  const shouldValidate = options?.validate !== false;
  let validatedPattern: AssaultApproachPattern;

  if (shouldValidate) {
    const validationResult = validateAssaultPlan(pattern, {
      minRecoveryBeats: options?.minRecoveryBeats,
    });
    if (!validationResult.valid) {
      throw new AssaultCompileError(
        `Assault plan validation failed with ${validationResult.errors.length} error(s)`,
        validationResult.errors,
      );
    }
    validatedPattern = validationResult.data;
  } else {
    if (!pattern || typeof pattern !== 'object') {
      throw new AssaultCompileError('Invalid pattern: must be an object', [
        { path: 'root', code: 'INVALID_OBJECT', message: 'Pattern must be an object' },
      ]);
    }
    validatedPattern = pattern as AssaultApproachPattern;
  }

  // 2. BPM 검증 및 고정
  const bpm = options?.bpm ?? DEFAULT_ASSAULT_BPM;
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    throw new AssaultCompileError(`Invalid BPM: "${bpm}". BPM must be a positive finite number.`, [
      { path: 'options.bpm', code: 'INVALID_BPM', message: 'BPM must be a positive finite number' },
    ]);
  }

  const secondsPerBeat = 60 / bpm;
  const totalBeats = validatedPattern.totalBeats;
  const totalDurationSeconds = beatToSeconds(totalBeats, bpm);

  // 3. 조우 목록 컴파일 (0-based 박자 -> active seconds)
  let prevEndBeat = 0;
  const compiledEncounters: AssaultCompiledEncounter[] = [];

  for (let index = 0; index < validatedPattern.encounters.length; index++) {
    const enc = validatedPattern.encounters[index] as AssaultEncounterInput;

    const startBeat = enc.startBeat;
    const durationBeats =
      enc.kind === 'answer_pair' && typeof options?.answerBeats === 'number' && options.answerBeats > 0
        ? options.answerBeats
        : enc.durationBeats;
    const endBeat = startBeat + durationBeats;

    // 하위 창 박자 계산 (미지정 시 안전 기본값 적용)
    const launchBeat = startBeat;
    const windowStartBeat =
      typeof enc.windowStartBeat === 'number' && Number.isFinite(enc.windowStartBeat)
        ? enc.windowStartBeat
        : startBeat;

    const windowEndBeat =
      typeof enc.windowEndBeat === 'number' && Number.isFinite(enc.windowEndBeat)
        ? enc.windowEndBeat
        : typeof enc.arrivalBeat === 'number' && Number.isFinite(enc.arrivalBeat)
          ? enc.arrivalBeat
          : endBeat;

    const impactBeat =
      typeof enc.arrivalBeat === 'number' && Number.isFinite(enc.arrivalBeat)
        ? enc.arrivalBeat
        : typeof enc.windowEndBeat === 'number' && Number.isFinite(enc.windowEndBeat)
          ? enc.windowEndBeat
          : endBeat;

    const arrivalBeat = impactBeat;

    const retractDeadlineBeat =
      typeof enc.recoveryBeat === 'number' && Number.isFinite(enc.recoveryBeat)
        ? enc.recoveryBeat
        : endBeat;

    const recoveryBeat = retractDeadlineBeat;

    // 활성 초(seconds) 계산
    const launchSeconds = beatToSeconds(launchBeat, bpm);
    const startSeconds = launchSeconds;
    const windowStartSeconds = beatToSeconds(windowStartBeat, bpm);
    const windowEndSeconds = beatToSeconds(windowEndBeat, bpm);
    const impactSeconds = beatToSeconds(impactBeat, bpm);
    const arrivalSeconds = impactSeconds;
    const retractDeadlineSeconds = beatToSeconds(retractDeadlineBeat, bpm);
    const recoverySeconds = retractDeadlineSeconds;
    const durationSeconds = beatToSeconds(durationBeats, bpm);

    // 복귀 간격 계산 (이전 조우 종료와의 갭 보존)
    const gapFromPreviousBeats = index === 0 ? 0 : Math.max(0, startBeat - prevEndBeat);
    const gapFromPreviousSeconds = beatToSeconds(gapFromPreviousBeats, bpm);

    const compiledEnc: AssaultCompiledEncounter = {
      id: enc.id,
      kind: enc.kind,
      index,
      startBeat,
      durationBeats,
      launchBeat,
      windowStartBeat,
      windowEndBeat,
      impactBeat,
      arrivalBeat,
      retractDeadlineBeat,
      recoveryBeat,
      launchSeconds,
      startSeconds,
      windowStartSeconds,
      windowEndSeconds,
      impactSeconds,
      arrivalSeconds,
      retractDeadlineSeconds,
      recoverySeconds,
      durationSeconds,
      gapFromPreviousBeats,
      gapFromPreviousSeconds,
      interactionProfileId: enc.interactionProfileId,
      visualProfileId: enc.visualProfileId,
      ...(enc.answerPolicyId ? { answerPolicyId: enc.answerPolicyId } : {}),
      ...(enc.pairId ? { pairId: enc.pairId } : {}),
    };

    compiledEncounters.push(compiledEnc);
    prevEndBeat = endBeat;
  }

  // 4. 질문 참조 복사 (외부 변경 차단)
  let copiedQuestionRef: AssaultCompiledPlan['questionRef'] = undefined;
  if (options?.questionRef !== undefined) {
    if (typeof options.questionRef === 'object' && options.questionRef !== null) {
      copiedQuestionRef = JSON.parse(JSON.stringify(options.questionRef));
    } else {
      copiedQuestionRef = options.questionRef;
    }
  }

  // 5. 불변 실행 계획 조합
  const sessionId =
    options?.sessionId ?? `assault_session_${validatedPattern.patternId}`;

  const compiledPlan: AssaultCompiledPlan = {
    schemaVersion: validatedPattern.schemaVersion,
    patternId: validatedPattern.patternId,
    sessionId,
    ...(options?.roundId ? { roundId: options.roundId } : {}),
    rulesVersion: options?.rulesVersion ?? '1.0.0',
    timingProfileId: validatedPattern.timingProfileId,
    ...(validatedPattern.balanceProfileId
      ? { balanceProfileId: validatedPattern.balanceProfileId }
      : {}),
    bpm,
    secondsPerBeat,
    totalBeats,
    totalDurationSeconds,
    ...(options?.seed !== undefined ? { seed: options.seed } : {}),
    ...(copiedQuestionRef !== undefined ? { questionRef: copiedQuestionRef } : {}),
    encounters: compiledEncounters,
  };

  // 6. Deep Freeze 적용하여 완전히 격리된 불변 객체 반환
  return deepFreeze(compiledPlan);
}

/**
 * 안전 순수 컴파일러 (예외 대신 Result 객체 반환)
 */
export function tryCompileAssaultPlan(
  pattern: unknown,
  options?: AssaultCompileOptions,
): AssaultCompileResult {
  try {
    const plan = compileAssaultPlan(pattern, options);
    return { success: true, plan };
  } catch (err) {
    if (err instanceof AssaultCompileError) {
      return { success: false, errors: err.errors, error: err };
    }
    const fallbackError = new AssaultCompileError(
      err instanceof Error ? err.message : String(err),
      [{ path: 'root', code: 'COMPILE_ERROR', message: String(err) }],
    );
    return { success: false, errors: fallbackError.errors, error: fallbackError };
  }
}
