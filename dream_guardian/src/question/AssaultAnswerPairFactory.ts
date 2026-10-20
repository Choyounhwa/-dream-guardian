/**
 * AssaultAnswerPairFactory - 숫자형 반복 보기 쌍 공급 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §6.1~6.6, DEC-A5, A11)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-07 / Issue #509)
 *
 * 책임 레이어: Question
 * 1. 한 문제에 정답이 유일한 여러 보기 쌍을 순수 함수로 공급한다.
 * 2. 수치적 동치 오답(예: 1과 1.0, 012와 12) 및 정답과 동일한 값의 오답 생성을 원천 차단한다.
 * 3. 주입 시드(Mulberry32 PRNG) 기반으로 정답 위치(left/right) 및 오답을 결정론적으로 재현한다.
 * 4. 강제 좌우 교대(L-R-L-R) 없이 편향 없는 독립 배치를 보장한다.
 * 5. 반환 결과는 deepFreeze로 불변성을 보장한다.
 * 6. 미지원 수식/비유한 값·유효 오답 공급 실패는 명시적 에러(AssaultAnswerPairError)로 거부한다.
 * 7. runtime 상태, HP 조작, 시각 효과, TTS 직접 요청 일체 배제.
 */

import type { AssaultAnswerSide } from '../types/assault.js';
import type { GeneratedQuestion } from '../types/index.js';
import { deepFreeze } from '../utils/deepFreeze.js';

// ─── 1. 에러 클래스 ───

export class AssaultAnswerPairError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AssaultAnswerPairError';
    this.code = code;
  }
}

// ─── 2. 인터페이스 계약 ───

/** 단일 보기 선택지 항목 */
export interface AssaultChoiceItem {
  readonly value: number;
  readonly text: string;
  readonly isCorrect: boolean;
}

/** 단일 좌우 보기 쌍 */
export interface AssaultAnswerPair {
  readonly pairId: string;
  readonly left: AssaultChoiceItem;
  readonly right: AssaultChoiceItem;
  readonly correctSide: AssaultAnswerSide;
  readonly choices: readonly [AssaultChoiceItem, AssaultChoiceItem];
}

/** 보기 쌍 생성 옵션 */
export interface CreateAnswerPairsOptions {
  /** 숫자 정답 (유한한 숫자 또는 숫자로 파싱 가능한 문자열) */
  readonly correctAnswer?: number | string;
  /** QuestionBank/QuestionEvaluator에서 생성된 문제 객체 (선택) */
  readonly question?: Partial<GeneratedQuestion> | { readonly correctAnswer: number | string; readonly [key: string]: unknown };
  /** 생성할 보기 쌍의 개수 (1 이상의 유한 정수) */
  readonly pairCount: number;
  /** 의사난수 시드 (유한 정수) */
  readonly seed: number;
  /** 라운드 식별자 (선택) */
  readonly roundId?: string;
  /** 문제 식별자 (선택) */
  readonly questionId?: string;
}

// ─── 3. 내부 유틸리티 및 PRNG ───

/** 결정론적 32비트 PRNG (Mulberry32) */
function createMulberry32(seed: number): () => number {
  let s = Math.trunc(seed) >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 소수점 자릿수 계산 */
function getDecimalPlaces(n: number): number {
  const str = Math.abs(n).toString();
  const dotIndex = str.indexOf('.');
  return dotIndex >= 0 ? str.length - dotIndex - 1 : 0;
}

/** 인접 자릿수 교환(Transposition) 후보 생성 */
function getDigitTranspositions(n: number): number[] {
  const isPositive = n >= 0;
  const absN = Math.abs(n);
  const s = absN.toString();
  if (s.length < 2) return [];

  const results: number[] = [];
  const chars = s.split('');
  for (let i = 0; i < chars.length - 1; i++) {
    if (chars[i] !== chars[i + 1]) {
      const swapped = [...chars];
      const temp = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = temp;
      const val = Number(swapped.join(''));
      results.push(isPositive ? val : -val);
    }
  }
  return results;
}

/** 입력 정답의 엄격한 숫자 파싱 (수식형/비유한값/공백 명시 거부) */
function parseNumericAnswer(val: unknown): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new AssaultAnswerPairError(`Invalid numeric answer: non-finite number ${val}`);
    }
    return val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') {
      throw new AssaultAnswerPairError('Invalid numeric answer: empty string');
    }
    // 단일 숫자 리터럴 형식만 허용 (수식 표현식 "2 + 3", "1/2" 등 일체 거부)
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) {
      throw new AssaultAnswerPairError(`Invalid numeric answer: unsupported format or formula "${val}"`);
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new AssaultAnswerPairError(`Invalid numeric answer: non-finite parsed value from "${val}"`);
    }
    return parsed;
  }
  throw new AssaultAnswerPairError(`Invalid numeric answer: unsupported type ${typeof val}`);
}

/** DEC-A5 규칙 기반 오답 후보군 생성 */
function generateWrongCandidates(correct: number, requiredCount: number): number[] {
  const candidates: number[] = [];
  const isInteger = Number.isInteger(correct);

  if (isInteger) {
    // DEC-A5 명시 기본 오프셋: ±1, ±2, ±10
    const baseOffsets = [1, -1, 2, -2, 10, -10];
    for (const off of baseOffsets) {
      candidates.push(correct + off);
    }

    // 자릿수 치환/전위 (Transposition, 예: 12 -> 21)
    const transposed = getDigitTranspositions(correct);
    candidates.push(...transposed);

    // 1의 자리 10의 보수 및 자릿수 변형 (correct >= 0인 경우)
    if (correct >= 0) {
      const unit = correct % 10;
      const compUnit = (10 - unit) % 10;
      const tens = Math.floor(correct / 10) * 10;
      const compVal = tens + compUnit;
      if (compVal !== correct) candidates.push(compVal);
      const flipVal = tens + ((unit + 5) % 10);
      if (flipVal !== correct) candidates.push(flipVal);
    }

    // 추가 정수 오프셋
    const moreOffsets = [3, -3, 4, -4, 5, -5, 9, -9, 11, -11, 20, -20, 6, -6, 7, -7, 8, -8, 12, -12, 15, -15, 30, -30];
    for (const off of moreOffsets) {
      candidates.push(correct + off);
    }

    // 후보군 동적 확장
    let k = 13;
    while (candidates.length < requiredCount * 5 && k <= 100) {
      candidates.push(correct + k);
      candidates.push(correct - k);
      k++;
    }
  } else {
    // 소수 정답 처리
    const decPlaces = getDecimalPlaces(correct);
    const step = Math.pow(10, -decPlaces);
    const offsets = [
      step, -step,
      2 * step, -2 * step,
      10 * step, -10 * step,
      5 * step, -5 * step,
      1, -1,
      2, -2,
    ];
    for (const off of offsets) {
      candidates.push(Number((correct + off).toFixed(decPlaces + 1)));
    }

    let k = 3;
    while (candidates.length < requiredCount * 5 && k <= 50) {
      candidates.push(Number((correct + k * step).toFixed(decPlaces + 1)));
      candidates.push(Number((correct - k * step).toFixed(decPlaces + 1)));
      k++;
    }
  }

  // 필터링 및 고유값 수집 (수치적 동치 오답 배제)
  const seen = new Set<number>();
  const validCandidates: number[] = [];

  for (const cand of candidates) {
    if (!Number.isFinite(cand)) continue;
    // 수치적 동치(1과 1.0, 012와 12) 및 정답과 동일값 원천 배제
    if (Math.abs(cand - correct) < 1e-9) continue;
    // 비음수 정답일 경우 오답도 음수를 배제
    if (correct >= 0 && cand < 0) continue;
    if (seen.has(cand)) continue;

    seen.add(cand);
    validCandidates.push(cand);
  }

  if (validCandidates.length < requiredCount) {
    throw new AssaultAnswerPairError(
      `Failed to generate sufficient valid unique wrong answer candidates (needed: ${requiredCount}, generated: ${validCandidates.length})`
    );
  }

  return validCandidates;
}

// ─── 4. 공개 순수 팩토리 함수 ───

/**
 * 단일 문제에 대한 결정론적 숫자형 반복 보기 쌍을 생성한다.
 *
 * @param options 생성 옵션
 * @returns 딥 프리즈된 불변 보기 쌍 목록
 * @throws {AssaultAnswerPairError} 부적합한 파라미터나 비유한값, 오답 생성 실패 시
 */
export function createAssaultAnswerPairs(options: CreateAnswerPairsOptions): readonly AssaultAnswerPair[] {
  if (!options || typeof options !== 'object') {
    throw new AssaultAnswerPairError('options must be a valid object');
  }

  // 1. pairCount 검증
  if (typeof options.pairCount !== 'number' || !Number.isInteger(options.pairCount) || options.pairCount < 1) {
    throw new AssaultAnswerPairError(
      `Invalid pairCount: "${options.pairCount}". pairCount must be a positive integer.`
    );
  }

  // 2. seed 검증
  if (typeof options.seed !== 'number' || !Number.isInteger(options.seed)) {
    throw new AssaultAnswerPairError(
      `Invalid seed: "${options.seed}". seed must be an integer.`
    );
  }

  // 3. 정답 추출 및 유효성 검증
  let rawCorrect: unknown;
  if (options.correctAnswer !== undefined) {
    rawCorrect = options.correctAnswer;
  } else if (options.question && options.question.correctAnswer !== undefined) {
    rawCorrect = options.question.correctAnswer;
  } else {
    throw new AssaultAnswerPairError('Missing correctAnswer in options or question');
  }

  const parsedCorrect = parseNumericAnswer(rawCorrect);

  // 4. 결정론적 PRNG 초기화
  const rng = createMulberry32(options.seed);

  // 5. DEC-A5 기반 오답 후보군 풀 확보
  const candidatePool = generateWrongCandidates(parsedCorrect, options.pairCount);

  // 6. 각 pair 생성
  const pairs: AssaultAnswerPair[] = [];
  const remainingCandidates = [...candidatePool];

  for (let i = 0; i < options.pairCount; i++) {
    // 오답 후보 무작위(시드 기반) 추출
    const pickIdx = Math.floor(rng() * remainingCandidates.length);
    const wrongValue = remainingCandidates.splice(pickIdx, 1)[0];

    // 좌우 배치 결정 (편향 없는 시드 기반, 강제 좌우 교대 배제)
    const isLeftCorrect = rng() < 0.5;
    const correctSide: AssaultAnswerSide = isLeftCorrect ? 'left' : 'right';

    const correctChoice: AssaultChoiceItem = {
      value: parsedCorrect,
      text: String(parsedCorrect),
      isCorrect: true,
    };

    const wrongChoice: AssaultChoiceItem = {
      value: wrongValue,
      text: String(wrongValue),
      isCorrect: false,
    };

    const left = isLeftCorrect ? correctChoice : wrongChoice;
    const right = isLeftCorrect ? wrongChoice : correctChoice;

    const pairId = options.roundId
      ? `${options.roundId}-pair-${i + 1}`
      : options.questionId
        ? `${options.questionId}-pair-${i + 1}`
        : `pair-${i + 1}`;

    const pair: AssaultAnswerPair = {
      pairId,
      left,
      right,
      correctSide,
      choices: [left, right],
    };

    pairs.push(pair);
  }

  // 7. deepFreeze 적용 및 반환
  return deepFreeze(pairs);
}
