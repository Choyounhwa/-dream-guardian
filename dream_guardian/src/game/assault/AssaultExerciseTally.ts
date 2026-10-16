/**
 * AssaultExerciseTally.ts - 보스 접근전(Boss Assault) 실측 운동량 순수 집계기
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§11.2, 15.3-C5, A31)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-43 / Issue #546)
 *
 * 절대 규칙:
 * 1. 실측 운동 횟수 집계:
 *    - 펀치(#511): 좌/우 펀치 횟수(leftPunchCount, rightPunchCount, totalPunchCount) 분리 집계.
 *    - 스쿼트(#512): 유효 스쿼트 횟수(squatCount).
 *    - 저충격 대체 동작(#547): 양팔 가드 등 대체 동작 횟수(guardCount / alternativeCount).
 *    - 입력 식별자(inputId) 기준으로 중복 카운트 원천 방지 (멱등성).
 * 2. 활성 시간 누적 (#510):
 *    - #510 활성 시각축만 반영 (activeDurationSeconds).
 *    - 일시정지(pause) 및 추적 손실 구간은 운동 시간에 일체 산입하지 않음 (wall time / Date.now 금지).
 * 3. 칼로리(kcal) 상태 처리 (DEC-C5):
 *    - 펀치 동작에 대한 공인 칼로리 환산 계수가 미승인된 상태이므로, 칼로리 필드는 임의의 0으로 채우지 않고
 *      kcalSupported: false, estimatedKcal: null로 미지원 상태를 정직하게 명시.
 *    - 기존 승인 공식이 존재하는 스쿼트(0.35 kcal/회)는 partialSquatKcal로 부분 보고.
 * 4. 아키텍처 제약 (순수 도메인):
 *    - 반환 객체는 deepFreeze된 불변 DTO.
 *    - 외부 상태 변경 0회, HP 변경 0회, DOM/타이머/rAF 등록 0회.
 */

import type { InputId } from '../../types/assault.js';

// ─── 1. 상수 정의 ───

/** GDD 공인 스쿼트 1회당 소모 칼로리 (0.35 kcal) */
export const SQUAT_KCAL_PER_REP = 0.35;

/** DEC-C5 칼로리 미지원 사유 안내 문구 */
export const DEC_C5_UNSUPPORTED_REASON =
  'DEC-C5: Punch calorie conversion factor pending approval. Overall assault kcal is unsupported.';

// ─── 2. 타입 및 인터페이스 계약 ───

/** 펀치 입력 기록 */
export interface AssaultPunchRecord {
  readonly inputId: InputId;
  readonly hand: 'left' | 'right';
  readonly isValid?: boolean;
  readonly timestampMs?: number;
  readonly activeTimestampSeconds?: number;
}

/** 스쿼트 입력 기록 */
export interface AssaultSquatRecord {
  readonly inputId: InputId;
  readonly isValid?: boolean;
  readonly isDucking?: boolean;
  readonly posture?: string;
  readonly invalidReason?: string;
  readonly timestampMs?: number;
  readonly activeTimestampSeconds?: number;
}

/** 저충격 대체 동작(양팔 가드 등) 입력 기록 */
export interface AssaultAlternativeRecord {
  readonly inputId: InputId;
  readonly kind?: 'guard' | 'dual_arm_guard' | string;
  readonly isValid?: boolean;
  readonly isGuarding?: boolean;
  readonly timestampMs?: number;
  readonly activeTimestampSeconds?: number;
}

/** 칼로리 세부 보고 정보 */
export interface AssaultKcalDetails {
  readonly supported: boolean;
  readonly reason: string;
  readonly partialSquatKcal: number;
}

/** 불변 실측 운동량 요약 DTO */
export interface AssaultExerciseSummary {
  readonly leftPunchCount: number;
  readonly rightPunchCount: number;
  readonly totalPunchCount: number;
  readonly squatCount: number;
  readonly guardCount: number;
  readonly alternativeCount: number;
  readonly activeDurationSeconds: number;
  readonly kcalSupported: false;
  readonly estimatedKcal: null;
  readonly partialSquatKcal: number;
  readonly kcalDetails: AssaultKcalDetails;
  readonly processedInputIds: readonly InputId[];
}

/** 결과 화면 호환 레거시 패치 DTO (하드코딩 상수 squats: 0, elapsedTime: 60 대체용) */
export interface AssaultLegacyResultPatch {
  readonly squats: number;
  readonly elapsedTime: number;
  readonly totalPunches: number;
  readonly leftPunches: number;
  readonly rightPunches: number;
  readonly guards: number;
  readonly calories: null;
}

/** 집계기 생성 옵션 */
export interface AssaultExerciseTallyOptions {
  readonly initialActiveDurationSeconds?: number;
}

// ─── 3. 헬퍼 함수 ───

/** 깊은 동결 불변화 함수 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && (typeof val === 'object' || typeof val === 'function') && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj as Readonly<T>;
}

// ─── 4. 실측 운동량 순수 집계 클래스 ───

export class AssaultExerciseTally {
  private _leftPunchCount = 0;
  private _rightPunchCount = 0;
  private _squatCount = 0;
  private _guardCount = 0;
  private _activeDurationSeconds = 0;

  private readonly _processedInputIds = new Set<InputId>();

  constructor(options: AssaultExerciseTallyOptions = {}) {
    if (options.initialActiveDurationSeconds !== undefined) {
      this._activeDurationSeconds = Math.max(0, options.initialActiveDurationSeconds);
    }
  }

  /**
   * 펀치(#511) 기록 집계
   *
   * @param record 펀치 입력 정보
   * @returns 신규 집계 성공 여부 (중복 inputId이거나 유효하지 않으면 false)
   */
  public recordPunch(record: AssaultPunchRecord): boolean {
    if (!record || !record.inputId) {
      return false;
    }
    if (this._processedInputIds.has(record.inputId)) {
      return false;
    }
    if (record.isValid === false) {
      return false;
    }
    if (record.hand !== 'left' && record.hand !== 'right') {
      return false;
    }

    this._processedInputIds.add(record.inputId);
    if (record.hand === 'left') {
      this._leftPunchCount++;
    } else {
      this._rightPunchCount++;
    }
    return true;
  }

  /**
   * 스쿼트(#512) 기록 집계
   *
   * @param record 스쿼트 입력 정보
   * @returns 신규 집계 성공 여부 (중복 inputId이거나 유효하지 않으면 false)
   */
  public recordSquat(record: AssaultSquatRecord): boolean {
    if (!record || !record.inputId) {
      return false;
    }
    if (this._processedInputIds.has(record.inputId)) {
      return false;
    }
    if (record.isValid === false) {
      return false;
    }

    this._processedInputIds.add(record.inputId);
    this._squatCount++;
    return true;
  }

  /**
   * 저충격 대체 동작(양팔 가드 등 #547) 기록 집계
   *
   * @param record 대체 동작 입력 정보
   * @returns 신규 집계 성공 여부
   */
  public recordGuard(record: AssaultAlternativeRecord): boolean {
    if (!record || !record.inputId) {
      return false;
    }
    if (this._processedInputIds.has(record.inputId)) {
      return false;
    }
    if (record.isValid === false) {
      return false;
    }

    this._processedInputIds.add(record.inputId);
    this._guardCount++;
    return true;
  }

  /**
   * 대체 동작 집계 (recordGuard의 포괄적 별칭)
   */
  public recordAlternative(record: AssaultAlternativeRecord): boolean {
    return this.recordGuard(record);
  }

  /**
   * #510 활성 시각축 기반 절대 활성 시간 설정
   *
   * @param seconds 활성 초 (음수는 0으로 클램핑)
   */
  public setActiveDuration(seconds: number): void {
    this._activeDurationSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  }

  /**
   * #510 활성 시각축 기반 활성 시간 델타 가산
   *
   * @param deltaSeconds 가산할 활성 초 (음수는 무시)
   */
  public addActiveDuration(deltaSeconds: number): void {
    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
      this._activeDurationSeconds += deltaSeconds;
    }
  }

  /**
   * AssaultClockAdapter 호환 객체 또는 초 단위 활성 시계 동기화
   *
   * @param clock activeSeconds 프로퍼티를 가진 시계 어댑터 또는 숫자 초
   */
  public syncWithClock(clock: { readonly activeSeconds: number } | number): void {
    if (typeof clock === 'number') {
      this.setActiveDuration(clock);
    } else if (clock && typeof clock.activeSeconds === 'number') {
      this.setActiveDuration(clock.activeSeconds);
    }
  }

  /**
   * 전체 실측 운동량 요약 스냅샷 반환 (deepFreeze 불변 DTO)
   */
  public getSummary(): Readonly<AssaultExerciseSummary> {
    const totalPunchCount = this._leftPunchCount + this._rightPunchCount;
    const partialSquatKcal = Math.round(this._squatCount * SQUAT_KCAL_PER_REP * 1000) / 1000;

    const data: AssaultExerciseSummary = {
      leftPunchCount: this._leftPunchCount,
      rightPunchCount: this._rightPunchCount,
      totalPunchCount,
      squatCount: this._squatCount,
      guardCount: this._guardCount,
      alternativeCount: this._guardCount,
      activeDurationSeconds: this._activeDurationSeconds,
      kcalSupported: false,
      estimatedKcal: null,
      partialSquatKcal,
      kcalDetails: {
        supported: false,
        reason: DEC_C5_UNSUPPORTED_REASON,
        partialSquatKcal,
      },
      processedInputIds: Array.from(this._processedInputIds),
    };

    return deepFreeze(data);
  }

  /**
   * getSummary의 불변 스냅샷 별칭
   */
  public snapshot(): Readonly<AssaultExerciseSummary> {
    return this.getSummary();
  }

  /**
   * 결과 화면(ResultRenderer / AppBootstrap) 호환용 레거시 패치 객체 반환
   *
   * 기존 하드코딩 상수(squats: 0, elapsedTime: 60)를 대체하는 실측 데이터 매핑.
   */
  public toLegacyResultPatch(): Readonly<AssaultLegacyResultPatch> {
    const summary = this.getSummary();
    const patch: AssaultLegacyResultPatch = {
      squats: summary.squatCount,
      elapsedTime: summary.activeDurationSeconds,
      totalPunches: summary.totalPunchCount,
      leftPunches: summary.leftPunchCount,
      rightPunches: summary.rightPunchCount,
      guards: summary.guardCount,
      calories: null,
    };
    return deepFreeze(patch);
  }

  /**
   * 집계 상태 초기화
   */
  public reset(): void {
    this._leftPunchCount = 0;
    this._rightPunchCount = 0;
    this._squatCount = 0;
    this._guardCount = 0;
    this._activeDurationSeconds = 0;
    this._processedInputIds.clear();
  }
}
