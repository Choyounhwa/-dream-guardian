/**
 * AssaultTutorialController.ts - 보스 접근전(Boss Assault) 3단계 튜토리얼 순수 진행 컨트롤러
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §15.3-C8)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-45 / Issue #548)
 *
 * 절대 규칙:
 * 1. Game 진행 단일 책임:
 *    - 3단계 생명주기 관리: punch_practice (1/3) -> squat_practice (2/3) -> slow_round (3/3) -> completed.
 *    - 각 단계 성공 조건 충족 시 다음 단계로 자동 전이.
 * 2. 순수 진행 컨트롤러:
 *    - HP 변경 0회, 자원 호출 0회, localStorage/스토리지 접근 0회.
 *    - legacy 튜토리얼 키(dream_guardian_tutorial_done) 일체 오염/수정 금지.
 * 3. 불변 DTO 스냅샷 제공:
 *    - getSnapshot()은 동결된(Object.freeze) 읽기 전용 상태를 반환한다.
 */

import type { AssaultAnswerSide } from '../../types/assault.js';
import type { AssaultApproachPattern } from '../../data/assault/approachPatterns.js';
import {
  TUTORIAL_PUNCH_PATTERN,
  TUTORIAL_SQUAT_PATTERN,
  TUTORIAL_SLOW_ROUND_PATTERN,
} from '../../data/assault/tutorialPatterns.js';

/** 튜토리얼 단계 식별자 */
export type AssaultTutorialStepId =
  | 'punch_practice'
  | 'squat_practice'
  | 'slow_round'
  | 'completed';

/** 튜토리얼 단계별 진행 통계 */
export interface AssaultTutorialStepProgress {
  readonly punchesDone: number;
  readonly punchesRequired: number;
  readonly squatsDone: number;
  readonly squatsRequired: number;
  readonly roundCompleted: boolean;
}

/** 튜토리얼 읽기 전용 스냅샷 DTO */
export interface AssaultTutorialSnapshot {
  readonly currentStep: AssaultTutorialStepId;
  readonly stepIndex: number; // 0, 1, 2, or 3 (completed)
  readonly totalSteps: number; // 항상 3
  readonly guideMessage: string;
  readonly isCompleted: boolean;
  readonly stepSuccess: boolean;
  readonly progressRatio: number; // 0.0 ~ 1.0
  readonly stepProgress: AssaultTutorialStepProgress;
  readonly activePattern: AssaultApproachPattern | null;
}

/** 튜토리얼 컨트롤러 초기화 옵션 */
export interface AssaultTutorialOptions {
  readonly requiredPunches?: number;
  readonly requiredSquats?: number;
  readonly initialStep?: AssaultTutorialStepId;
  readonly guideMessages?: Partial<Record<AssaultTutorialStepId, string>>;
}

/** 기본 단계별 가이드 메시지 */
const DEFAULT_GUIDE_MESSAGES: Readonly<Record<AssaultTutorialStepId, string>> = Object.freeze({
  punch_practice: '화면의 답안 방향을 향해 힘차게 펀치를 뻗어보세요! (피해 없음)',
  squat_practice: '보스의 공격을 스쿼트나 양팔 가드로 회피해보세요! (피해 없음)',
  slow_round: '느린 템포 실전 모의 라운드입니다. 펀치와 회피를 교대로 수행해보세요!',
  completed: '튜토리얼 완료! 이제 본격적인 보스 접근전에 도전해보세요.',
});

/** 총 튜토리얼 단계 수 */
const TOTAL_TUTORIAL_STEPS = 3;

export class AssaultTutorialController {
  private _currentStep: AssaultTutorialStepId;
  private readonly _requiredPunches: number;
  private readonly _requiredSquats: number;
  private readonly _guideMessages: Record<AssaultTutorialStepId, string>;

  private _punchesDone = 0;
  private _squatsDone = 0;
  private _roundCompleted = false;

  constructor(options?: AssaultTutorialOptions) {
    this._requiredPunches = options?.requiredPunches ?? 2;
    this._requiredSquats = options?.requiredSquats ?? 2;
    this._currentStep = options?.initialStep ?? 'punch_practice';

    this._guideMessages = {
      ...DEFAULT_GUIDE_MESSAGES,
      ...(options?.guideMessages ?? {}),
    };
  }

  /**
   * 1단계: 펀치 타격 입력 처리
   */
  public handlePunch(input?: {
    side?: AssaultAnswerSide;
    hitSuccess?: boolean;
    rating?: string;
  }): AssaultTutorialSnapshot {
    if (this._currentStep !== 'punch_practice') {
      return this.getSnapshot();
    }

    const isSuccess = input?.hitSuccess !== false;
    if (isSuccess) {
      this._punchesDone += 1;
      if (this._punchesDone >= this._requiredPunches) {
        this._currentStep = 'squat_practice';
      }
    }

    return this.getSnapshot();
  }

  /**
   * 2단계: 스쿼트/가드 회피 입력 처리
   */
  public handleSquat(input?: {
    success?: boolean;
    isGuarded?: boolean;
    posture?: string;
  }): AssaultTutorialSnapshot {
    if (this._currentStep !== 'squat_practice') {
      return this.getSnapshot();
    }

    const isSuccess = input?.success !== false;
    if (isSuccess) {
      this._squatsDone += 1;
      if (this._squatsDone >= this._requiredSquats) {
        this._currentStep = 'slow_round';
      }
    }

    return this.getSnapshot();
  }

  /**
   * 3단계: 실전 1라운드 종료 이벤트 처리
   */
  public handleRoundEvent(event?: {
    completed?: boolean;
    isDefeated?: boolean;
    aborted?: boolean;
  }): AssaultTutorialSnapshot {
    if (this._currentStep !== 'slow_round') {
      return this.getSnapshot();
    }

    const isSuccess = event?.completed !== false && !event?.isDefeated && !event?.aborted;
    if (isSuccess) {
      this._roundCompleted = true;
      this._currentStep = 'completed';
    }

    return this.getSnapshot();
  }

  /**
   * 현재 단계 건너뛰기
   */
  public skip(): AssaultTutorialSnapshot {
    switch (this._currentStep) {
      case 'punch_practice':
        this._currentStep = 'squat_practice';
        break;
      case 'squat_practice':
        this._currentStep = 'slow_round';
        break;
      case 'slow_round':
        this._roundCompleted = true;
        this._currentStep = 'completed';
        break;
      case 'completed':
        // 이미 완료 상태이면 유지
        break;
    }
    return this.getSnapshot();
  }

  /**
   * 튜토리얼 1단계부터 완전 재시작
   */
  public restart(): AssaultTutorialSnapshot {
    this._currentStep = 'punch_practice';
    this._punchesDone = 0;
    this._squatsDone = 0;
    this._roundCompleted = false;
    return this.getSnapshot();
  }

  /**
   * 현재 튜토리얼 진행 상태 스냅샷 반환 (불변 DTO)
   */
  public getSnapshot(): AssaultTutorialSnapshot {
    const stepIndex = this._getStepIndex(this._currentStep);
    const isCompleted = this._currentStep === 'completed';
    const stepSuccess = this._isCurrentStepSuccessful();
    const progressRatio = this._calculateProgressRatio(stepIndex, isCompleted);
    const activePattern = this._getActivePattern(this._currentStep);

    const stepProgress: AssaultTutorialStepProgress = Object.freeze({
      punchesDone: this._punchesDone,
      punchesRequired: this._requiredPunches,
      squatsDone: this._squatsDone,
      squatsRequired: this._requiredSquats,
      roundCompleted: this._roundCompleted,
    });

    return Object.freeze({
      currentStep: this._currentStep,
      stepIndex,
      totalSteps: TOTAL_TUTORIAL_STEPS,
      guideMessage: this._guideMessages[this._currentStep] ?? '',
      isCompleted,
      stepSuccess,
      progressRatio,
      stepProgress,
      activePattern,
    });
  }

  private _getStepIndex(step: AssaultTutorialStepId): number {
    switch (step) {
      case 'punch_practice':
        return 0;
      case 'squat_practice':
        return 1;
      case 'slow_round':
        return 2;
      case 'completed':
        return 3;
    }
  }

  private _getActivePattern(step: AssaultTutorialStepId): AssaultApproachPattern | null {
    switch (step) {
      case 'punch_practice':
        return TUTORIAL_PUNCH_PATTERN;
      case 'squat_practice':
        return TUTORIAL_SQUAT_PATTERN;
      case 'slow_round':
        return TUTORIAL_SLOW_ROUND_PATTERN;
      case 'completed':
        return null;
    }
  }

  private _isCurrentStepSuccessful(): boolean {
    switch (this._currentStep) {
      case 'punch_practice':
        return this._punchesDone >= this._requiredPunches;
      case 'squat_practice':
        return this._squatsDone >= this._requiredSquats;
      case 'slow_round':
        return this._roundCompleted;
      case 'completed':
        return true;
    }
  }

  private _calculateProgressRatio(stepIndex: number, isCompleted: boolean): number {
    if (isCompleted) {
      return 1.0;
    }

    const stepWeight = 1.0 / TOTAL_TUTORIAL_STEPS;
    let intraStepFraction = 0;

    if (stepIndex === 0) {
      intraStepFraction = Math.min(1.0, this._punchesDone / Math.max(1, this._requiredPunches));
    } else if (stepIndex === 1) {
      intraStepFraction = Math.min(1.0, this._squatsDone / Math.max(1, this._requiredSquats));
    } else if (stepIndex === 2) {
      intraStepFraction = this._roundCompleted ? 1.0 : 0.0;
    }

    const totalRatio = (stepIndex * stepWeight) + (intraStepFraction * stepWeight);
    return Math.min(1.0, Math.max(0.0, Number(totalRatio.toFixed(4))));
  }
}
