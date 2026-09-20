/**
 * QuestionEvaluator - 샌드박스 안전 수식 평가기
 *
 * 화이트리스트 함수만 허용하는 안전한 수식 계산
 * 템플릿 변수 치환 ({A}, {B}, {C}, {D})
 * 코드 인젝션 차단
 *
 * @see Issue #13 (GitHub #78)
 */

import type { QuestionRecord } from '../types/index.js';

// ─── 화이트리스트 함수 ───

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(...args: number[]): number {
  return args[Math.floor(Math.random() * args.length)];
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function factorial(n: number): number {
  if (n < 0) return 0;
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= Math.min(n, 20); i++) {
    result *= i;
  }
  return result;
}

function sup(base: number, exp: number): number {
  return Math.pow(base, exp);
}

function repeatMul(base: number, count: number): number {
  let result = 1;
  for (let i = 0; i < count; i++) result *= base;
  return result;
}

function repeatAdd(base: number, count: number): number {
  return base * count;
}

/** 위험 패턴 정규식 */
const DANGEROUS_PATTERNS = [
  /window/i,
  /document/i,
  /globalThis/i,
  /constructor/i,
  /prototype/i,
  /\beval\b/,
  /Function\s*\(/,
  /import\s*\(/,
  /require\s*\(/,
  /fetch\s*\(/,
  /\.__proto__/,
  /\[\s*['"]constructor['"]\s*\]/,
];

/**
 * 수식 문자열을 안전하게 평가
 * @returns 계산 결과 숫자, 실패 시 NaN
 */
export function safeEval(
  expr: string,
  vars: Record<string, number> = {},
): number {
  // 위험 패턴 차단
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(expr)) {
      console.warn(`[QuestionEvaluator] 차단된 수식: ${expr}`);
      return NaN;
    }
  }

  try {
    // 변수 치환 + 화이트리스트 함수 주입
    const fn = new Function(
      'A', 'B', 'C', 'D',
      'rand', 'pick', 'gcd', 'factorial', 'sup', 'repeatMul', 'repeatAdd', 'abs',
      `"use strict"; return (${expr});`,
    );

    const result = fn(
      vars.A ?? 0, vars.B ?? 0, vars.C ?? 0, vars.D ?? 0,
      rand, pick, gcd, factorial, sup, repeatMul, repeatAdd, Math.abs,
    );

    return typeof result === 'number' ? result : NaN;
  } catch {
    return NaN;
  }
}

/** 생성된 문제 */
export interface GeneratedQuestion {
  questionText: string;
  correctAnswer: number;
  wrongAnswer: number;
  choices: [number, number];
  correctIndex: number;
}

/**
 * QuestionRecord에서 실제 문제를 생성
 */
export function generateQuestion(record: QuestionRecord): GeneratedQuestion | null {
  try {
    // 변수 평가
    const A = safeEval(record.varA);
    const B = safeEval(record.varB);
    const C = safeEval(record.varC);
    const D = safeEval(record.varD);

    if (isNaN(A) || isNaN(B)) return null;

    const vars = { A, B, C, D };

    // 문제 텍스트 치환
    const questionText = record.questionTemplate
      .replace(/\{A\}/g, String(A))
      .replace(/\{B\}/g, String(B))
      .replace(/\{C\}/g, String(C))
      .replace(/\{D\}/g, String(D));

    // 정답/오답 계산
    const correctAnswer = safeEval(record.answerEval, vars);
    const wrongAnswer = safeEval(record.wrongEval, vars);

    if (isNaN(correctAnswer)) return null;

    // 오답이 정답과 같으면 보정
    const finalWrong = isNaN(wrongAnswer) || wrongAnswer === correctAnswer
      ? correctAnswer + (Math.random() > 0.5 ? 1 : -1)
      : wrongAnswer;

    // 2지선다 배치 (랜덤 순서)
    const correctIndex = Math.random() < 0.5 ? 0 : 1;
    const choices: [number, number] = correctIndex === 0
      ? [correctAnswer, finalWrong]
      : [finalWrong, correctAnswer];

    return { questionText, correctAnswer, wrongAnswer: finalWrong, choices, correctIndex };
  } catch {
    return null;
  }
}
