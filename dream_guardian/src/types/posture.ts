/**
 * posture.ts - 자세 선택 시스템 신규 데이터 타입 정의
 *
 * RC-1 (부위<->존 고정 인덱스 페어링 한계) 및 RC-5 (진행도 2슬롯 한계) 극복:
 * - 다중 부위-다중 존 집합 덮기(Set Coverage)를 지원하는 AnswerPosture
 * - 존별/부위별 독립 진행도 추적을 위한 PostureProgress
 * - 국민체조/피트니스 패턴(360종) 파싱 데이터 타입 FitnessPatternRecord
 * - 캘리브레이션 변위 검증을 위한 PartGate
 *
 * @see Issue #122 (DATA-001) / Issue #123 (POSE-001)
 */

import type { CursorType } from '../../config/cursor.config.js';
import type { ChoiceRecipe } from '../input/RecipeGenerator.js';

/**
 * 자세 판정 대상 4대 핵심 신체 부위
 * (D-3 결정: shoulder 폐기, head로 일원화)
 */
export type BodyPart = 'leftHand' | 'rightHand' | 'head' | 'hip';

/**
 * 피트니스 패턴 분류 접두사
 * - S: Single (단일 부위, 60종)
 * - D: Double (2개 부위 협응, 100종)
 * - T: Triple (3개 부위 협응, 100종)
 * - Q: Quad (전신 4개 부위 협응, 100종)
 */
export type PatternType = 'S' | 'D' | 'T' | 'Q';

/**
 * 피트니스 패턴 원본(fitness pattern.csv) 파싱 레코드
 */
export interface FitnessPatternRecord {
  /** 패턴 식별자 (예: S001, D001, T001, Q001) */
  id: string;
  /** 패턴 유형 (S, D, T, Q) */
  patternType: PatternType;
  /** 동작 명칭 / 설명 */
  name: string;
  /** 왼손 요구 존 ID (1~11, 미사용 시 null) */
  leftHand: number | null;
  /** 오른손 요구 존 ID (1~11, 미사용 시 null) */
  rightHand: number | null;
  /** 머리 요구 존 ID (1~11, 미사용 시 null) */
  head: number | null;
  /** 골반 요구 존 ID (1~11, 미사용 시 null) */
  hip: number | null;
  /** 활성 판정 부위 수 (1~4) */
  partCount: number;
  /** 활성 요구 부위 목록 */
  parts: BodyPart[];
  /** 활성 요구 존 ID 목록 (부위 순서대로) */
  zoneIds: number[];
  /** 중복 제거된 고유 존 ID 목록 */
  distinctZoneIds: number[];
  /** 부위별 존 매핑 */
  partZoneMap: Partial<Record<BodyPart, number>>;
}

/**
 * 캘리브레이션 baseline 대비 신체 변위 제약 조건
 * (RC-3 해결: 단순 직립 시 존 자동 충족 방지)
 */
export interface PartGate {
  part: BodyPart;
  axis: 'x' | 'y';
  /** 최소 변위 또는 임계값 (정규화 단위) */
  min?: number;
  /** 최대 변위 (정규화 단위) */
  max?: number;
  /** 상대 변위 임계값 (예: deltaY >= 0.08) */
  threshold?: number;
}

/**
 * 답안 선택지 1개가 요구하는 자세 (AnswerPosture)
 */
export interface AnswerPosture {
  /** 선택지 인덱스 (0: 좌측, 1: 우측) */
  choiceIndex: 0 | 1;
  /** 요구 신체 부위 (1~4개) */
  parts: BodyPart[];
  /** 목표 피트니스 존 ID (1~11) */
  zoneIds: number[];
  /**
   * 바인딩 모드:
   * - 'any': 집합 덮기(Set Coverage) 기반, 부위-존 순서 무관
   * - 'ordered': 1:1 고정 인덱스 페어링 (목 좌우 굽힘 등 방향성 엄격 판정)
   */
  binding: 'any' | 'ordered';
  /** 캘리브레이션 변위 게이트 (선택) */
  gates?: PartGate[];
  /** 참조 패턴 ID (예: 'S001', 'D015' 등) */
  patternId: string;
}

/**
 * 프레임별 자세 판정 및 충전 진행도 상태
 * (RC-5 해결: 존별/부위별 독립 피드백 지원)
 */
export interface PostureProgress {
  choiceIndex: 0 | 1;
  /** 충전 진행도 (0.0 ~ 1.0) */
  progress: number;
  /** 현재 프레임에서 모든 요구 조건 충족 여부 */
  met: boolean;
  /** 부위별 현재 위치 상태 */
  partStates: {
    part: BodyPart;
    zoneId: number | null;
    inside: boolean;
  }[];
  /** 존별 부위 덮임(Covered) 여부 맵 */
  zoneCovered: Record<number, boolean>;
}

/**
 * 문제 출제 1회에 대한 양측 자세 계획
 */
export interface QuestionPosturePlan {
  tier: number;
  activeZoneIds: number[];
  postures: [AnswerPosture, AnswerPosture];
}

/**
 * 기존 ChoiceRecipe -> 신규 AnswerPosture 변환 어댑터
 */
export function recipeToAnswerPosture(recipe: ChoiceRecipe, patternId = 'LEGACY'): AnswerPosture {
  const parts: BodyPart[] = [];
  for (const c of recipe.requiredCursors) {
    if (c === 'shoulder') {
      parts.push('head'); // shoulder 레거시는 head로 매핑
    } else {
      parts.push(c as BodyPart);
    }
  }

  return {
    choiceIndex: (recipe.choiceIndex === 0 ? 0 : 1),
    parts,
    zoneIds: [...recipe.targetZoneIds],
    binding: 'any',
    patternId,
  };
}

/**
 * 신규 AnswerPosture -> 기존 ChoiceRecipe 호환 변환 어댑터
 */
export function postureToChoiceRecipe(posture: AnswerPosture): ChoiceRecipe {
  return {
    choiceIndex: posture.choiceIndex,
    requiredCursors: posture.parts.map((p) => p as CursorType),
    targetZoneIds: [...posture.zoneIds],
  };
}
