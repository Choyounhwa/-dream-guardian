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

import {
  CursorTracker,
  type PalmPositions,
  type ViewportProjectFn,
  type CursorUpdateOptions,
} from './CursorTracker.js';
import { RecipeGenerator, type QuestionRecipePlan } from './RecipeGenerator.js';
import type { NormalizedLandmark } from '../types/index.js';

import {
  type FitnessZone,
  DEFAULT_FITNESS_ZONES,
  FITNESS_ZONES,
  HEAD_ZONES,
  SHOULDER_ZONES,
  HIP_ZONES,
  LEFT_HAND_ZONES,
  RIGHT_HAND_ZONES,
} from '../../config/zone.config.js';

import {
  type CursorType,
  CURSOR_COLORS,
} from '../../config/cursor.config.js';

import {
  type TierConfig,
  TIER_CONFIGS,
  POSTURE_TIER_BOUNDARIES,
  POSTURE_TIMING_CONFIG,
} from '../../config/posture.config.js';
import { matchPosture } from './PostureMatcher.js';
import { recipeToAnswerPosture } from '../types/posture.js';
import { PartGateEvaluator } from './PartGateEvaluator.js';
import type { CalibrationBaseline } from '../motion/CalibrationHelper.js';

// 하위 호환성을 위한 Re-export (Issue #120 / CFG-001)
export type { FitnessZone, CursorType };
export {
  DEFAULT_FITNESS_ZONES,
  FITNESS_ZONES,
  HEAD_ZONES,
  SHOULDER_ZONES,
  HIP_ZONES,
  LEFT_HAND_ZONES,
  RIGHT_HAND_ZONES,
  CURSOR_COLORS,
};
export type TierInfo = TierConfig;

export interface SelectionResult {
  zoneId: number;
  cursorType: CursorType;
  progress: number; // 0~1
  confirmed: boolean;
}

/**
 * 문제 번호 기반 점증적 난이도 티어 계산 (Issue #120: posture.config 외부화)
 * @param questionNumber 1부터 시작하는 문제 번호 (1-based)
 * @param isComplexQuestion 긴 문항이나 고난도 연산 시 인지 부하 완화 여부
 */
export function getTierInfo(questionNumber: number, isComplexQuestion = false): TierInfo {
  let tier: 1 | 2 | 3 | 4 = 1;

  if (questionNumber >= POSTURE_TIER_BOUNDARIES.tier4.minQuestion) {
    tier = 4;
  } else if (questionNumber >= POSTURE_TIER_BOUNDARIES.tier3.minQuestion) {
    tier = 3;
  } else if (questionNumber >= POSTURE_TIER_BOUNDARIES.tier2.minQuestion) {
    tier = 2;
  } else {
    tier = 1;
  }

  // 두뇌 피로도 완충 룰: 인지 난이도가 높으면 Tier 1~2로 자동 완화
  if (isComplexQuestion && tier > 2) {
    tier = 2;
  }

  const config = TIER_CONFIGS[tier];
  return {
    tier: config.tier,
    dwellTime: config.dwellTime,
    name: config.name,
    allowedCursors: [...config.allowedCursors],
  };
}

export class AnswerSelector {
  private _dwellTime: number;
  private _centerWeight: number;
  private _edgeWeight: number;
  private _currentQuestionNumber = 1;
  private _isComplexQuestion = false;
  private _currentTierInfo: TierInfo;
  private _cursorTracker = new CursorTracker();
  private _recipeGenerator = new RecipeGenerator();
  private _gateEvaluator = new PartGateEvaluator();
  private _currentPlan: QuestionRecipePlan | null = null;
  private _choiceProgress: [number, number] = [0, 0];
  private _virtualWidth = 1080;
  private _virtualHeight = 2160;
  private _projectFn?: ViewportProjectFn;

  constructor(
    dwellTime: number = POSTURE_TIMING_CONFIG.defaultDwellTime,
    centerWeight: number = POSTURE_TIMING_CONFIG.centerWeight,
    edgeWeight: number = POSTURE_TIMING_CONFIG.edgeWeight,
  ) {
    this._dwellTime = dwellTime;
    this._centerWeight = centerWeight;
    this._edgeWeight = edgeWeight;
    this._currentTierInfo = getTierInfo(1);
    this._currentPlan = this._recipeGenerator.generatePlan(this._currentTierInfo);
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

  /** 커서 트래커 인스턴스 */
  get cursorTracker(): CursorTracker {
    return this._cursorTracker;
  }

  /** PartGate 평가기 인스턴스 */
  get gateEvaluator(): PartGateEvaluator {
    return this._gateEvaluator;
  }

  /** 캘리브레이션 기준선 설정 (PartGate 판정 연동, Issue #126) */
  setCalibrationBaseline(baseline: CalibrationBaseline | null): void {
    this._gateEvaluator.setBaseline(baseline);
  }

  /** 현재 문제가 스테이지 첫 번째 문제인지 여부 (Issue #160) */
  get isFirstQuestion(): boolean {
    return this._currentQuestionNumber === 1;
  }

  /** 현재 문제 번호 (1-based) */
  get currentQuestionNumber(): number {
    return this._currentQuestionNumber;
  }

  get virtualWidth(): number {
    return this._virtualWidth;
  }

  get virtualHeight(): number {
    return this._virtualHeight;
  }

  get projectFn(): ViewportProjectFn | undefined {
    return this._projectFn;
  }

  /**
   * 뷰포트 해상도 및 비디오 Cover 프로젝션 함수 설정 (Issue #116)
   */
  setViewport(virtualWidth: number, virtualHeight: number, projectFn?: ViewportProjectFn): void {
    this._virtualWidth = virtualWidth;
    this._virtualHeight = virtualHeight;
    this._projectFn = projectFn;
    this._cursorTracker.setViewport(virtualWidth, virtualHeight, projectFn);
  }

  /** 현재 문제의 4색 커서 및 활성 존 레시피 계획 */
  get currentPlan(): QuestionRecipePlan | null {
    return this._currentPlan;
  }

  /** 좌/우 선택지 체류 진행도 (0~1) */
  get choiceProgress(): [number, number] {
    return [this._choiceProgress[0], this._choiceProgress[1]];
  }

  /**
   * 새 문제 시작 시 레시피 계획 및 진행도 초기화
   */
  startQuestion(questionNumber: number, isComplexQuestion = false): QuestionRecipePlan {
    this.setQuestion(questionNumber, isComplexQuestion);
    this._currentPlan = this._recipeGenerator.generatePlan(this._currentTierInfo);
    this._choiceProgress = [0, 0];
    this.reset();
    return this._currentPlan;
  }

  /**
   * 포즈 및 손 랜드마크로부터 4색 커서 기반 답안 선택 평가
   * - Deadlock Guard: 양쪽 답안 동시 충족 시 양쪽 모두 리셋
   * - 중심 가중치 (1.5배) 및 체류 시간 충족 시 확정
   * - Issue #116: options를 통해 뷰포트 프로젝션 및 가상 좌표계 동기화 지원
   */
  updateFromPose(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    palms?: PalmPositions,
    dt = 0.016,
    isMirrored = false,
    options?: CursorUpdateOptions,
  ): { confirmedIndex: number } | null {
    if (!this._currentPlan) {
      this.startQuestion(this._currentQuestionNumber, this._isComplexQuestion);
    }
    const plan = this._currentPlan!;
    const cursors = this._cursorTracker.update(landmarks, palms, isMirrored, options);

    // 각 선택지(0: 좌, 1: 우)의 요구조건 충족 여부 확인 (Issue #124: 집합 덮기 & Issue #126: PartGate)
    const checkChoiceMet = (recipeIdx: number): { met: boolean; avgWeight: number } => {
      const recipe = plan.choices[recipeIdx];
      const posture = recipeToAnswerPosture(recipe);
      const res = matchPosture(posture, cursors, FITNESS_ZONES, {
        centerWeight: this._centerWeight,
        edgeWeight: this._edgeWeight,
        gateEvaluator: (gate) => this._gateEvaluator.evaluateGate(gate, landmarks),
      });
      return { met: res.met, avgWeight: res.avgWeight };
    };

    const choice0 = checkChoiceMet(0);
    const choice1 = checkChoiceMet(1);

    // ── Deadlock Guard: 양쪽 답안 동시 충족 시 양쪽 모두 리셋 ──
    if (choice0.met && choice1.met) {
      this._choiceProgress[0] = Math.max(0, this._choiceProgress[0] - dt * POSTURE_TIMING_CONFIG.deadlockDecayMultiplier);
      this._choiceProgress[1] = Math.max(0, this._choiceProgress[1] - dt * POSTURE_TIMING_CONFIG.deadlockDecayMultiplier);
      return null;
    }

    // 0번 선택지만 충족
    if (choice0.met) {
      this._choiceProgress[0] = Math.min(1, this._choiceProgress[0] + (dt / this._dwellTime) * choice0.avgWeight);
      this._choiceProgress[1] = Math.max(0, this._choiceProgress[1] - dt * POSTURE_TIMING_CONFIG.naturalDecayMultiplier);

      if (this._choiceProgress[0] >= 1.0) {
        this._choiceProgress[0] = 0;
        return { confirmedIndex: 0 };
      }
      return null;
    }

    // 1번 선택지만 충족
    if (choice1.met) {
      this._choiceProgress[1] = Math.min(1, this._choiceProgress[1] + (dt / this._dwellTime) * choice1.avgWeight);
      this._choiceProgress[0] = Math.max(0, this._choiceProgress[0] - dt * POSTURE_TIMING_CONFIG.naturalDecayMultiplier);

      if (this._choiceProgress[1] >= 1.0) {
        this._choiceProgress[1] = 0;
        return { confirmedIndex: 1 };
      }
      return null;
    }

    // 둘 다 충족 안 됨 -> 자연 감쇠
    this._choiceProgress[0] = Math.max(0, this._choiceProgress[0] - dt * POSTURE_TIMING_CONFIG.naturalDecayMultiplier);
    this._choiceProgress[1] = Math.max(0, this._choiceProgress[1] - dt * POSTURE_TIMING_CONFIG.naturalDecayMultiplier);
    return null;
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

  /** 모든 진행도 및 커서 추적기 초기화 (Issue #130) */
  reset(): void {
    this._choiceProgress = [0, 0];
    this._cursorTracker.reset();
  }
}
