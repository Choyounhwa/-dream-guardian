/**
 * QuestionEvaluator - 샌드박스 안전 수식 평가기
 *
 * 화이트리스트 함수만 허용하는 안전한 수식 계산
 * 템플릿 복합 수식 및 변수 치환 ({A}, {B}, {C}, {D}, {A*B}, {repeatAdd}, {sup})
 * 문자열/숫자 정답 안전 평가 및 종속 변수(VarC, VarD) 순차 평가
 * 코드 인젝션 차단
 *
 * @see Issue #13 (GitHub #78), Issue #102 (GitHub #102)
 */

import type { QuestionRecord, GeneratedQuestion } from '../types/index.js';
export type { GeneratedQuestion } from '../types/index.js';

// ─── 화이트리스트 함수 ───

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(...args: any[]): any {
  if (Array.isArray(args[0])) return args[0][Math.floor(Math.random() * args[0].length)];
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
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= Math.min(n, 20); i++) {
    result *= i;
  }
  return result;
}

function sup(baseOrExp: number | string, exp?: number): number | string {
  if (exp !== undefined) {
    return Math.pow(Number(baseOrExp), exp);
  }
  const sups: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
  };
  return String(baseOrExp).split('').map((d) => sups[d] || d).join('');
}

function repeatMul(base: any, count: any): string {
  return Array(Math.max(1, Number(count) || 1)).fill(base).join(' × ');
}

function repeatAdd(base: any, count: any): string {
  return Array(Math.max(1, Number(count) || 1)).fill(base).join(' + ');
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

export interface SafeEvalOptions {
  forTemplate?: boolean;
}

/**
 * 수식 문자열을 안전하게 평가
 * @returns 계산 결과 숫자 또는 문자열, 실패 시 NaN
 */
export function safeEval(
  expr: string,
  vars: Record<string, any> = {},
  options?: SafeEvalOptions,
): number | string {
  if (!expr || typeof expr !== 'string') return NaN;

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
      'pow', 'sqrt', 'floor', 'round',
      `"use strict"; return (${expr});`,
    );

    const repMul = options?.forTemplate
      ? repeatMul
      : (b: number, c: number) => {
          let res = 1;
          for (let i = 0; i < c; i++) res *= b;
          return res;
        };

    const repAdd = options?.forTemplate
      ? repeatAdd
      : (b: number, c: number) => b * c;

    const result = fn(
      vars.A !== undefined ? vars.A : 0,
      vars.B !== undefined ? vars.B : 0,
      vars.C !== undefined ? vars.C : 0,
      vars.D !== undefined ? vars.D : 0,
      rand, pick, gcd, factorial, sup, repMul, repAdd, Math.abs,
      Math.pow, Math.sqrt, Math.floor, Math.round,
    );

    if (typeof result === 'number') {
      return isNaN(result) ? NaN : result;
    }
    if (typeof result === 'string') {
      return result;
    }
    if (typeof result === 'boolean') {
      return result ? 1 : 0;
    }
    return NaN;
  } catch {
    return NaN;
  }
}

/** 유효하지 않은 평가 결과 판별 */
function isInvalid(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return isNaN(val);
  if (typeof val === 'string') return val.trim().length === 0;
  return false;
}

/** 대체 오답 생성 */
function generateFallbackWrong(correctAnswer: number | string): number | string {
  if (typeof correctAnswer === 'number') {
    const delta = pick(-3, -2, 2, 3);
    return correctAnswer + (delta !== 0 ? delta : 1);
  }
  const s = String(correctAnswer);
  if (s === '>') return '<';
  if (s === '<') return '>';
  if (s === '=') return '>';
  if (s === '직사각형') return '정사각형';
  if (s === '정사각형') return '직사각형';
  const numMatch = s.match(/\d+/);
  if (numMatch) {
    const orig = parseInt(numMatch[0], 10);
    const alt = orig + (orig > 0 ? 1 : 2);
    return s.replace(numMatch[0], String(alt));
  }
  return s + ' (오답)';
}

/**
 * QuestionRecord에서 실제 문제를 생성
 */
export function generateQuestion(record: QuestionRecord): GeneratedQuestion | null {
  try {
    // 변수 순차 평가 (B는 A 참조, C는 A/B 참조, D는 A/B/C 참조 가능)
    const A = safeEval(record.varA);
    if (isInvalid(A)) return null;

    const B = safeEval(record.varB, { A });
    if (isInvalid(B)) return null;

    const C = safeEval(record.varC || '0', { A, B });
    const D = safeEval(record.varD || '0', { A, B, C });

    const vars = { A, B, C, D };

    // 문제 텍스트 복합 템플릿 치환 ({A}, {B}, {A*B}, {repeatAdd(A, B)}, {sup(B)} 등)
    const questionText = record.questionTemplate.replace(/\{([^}]+)\}/g, (match, expr) => {
      const trimmed = expr.trim();
      if (trimmed === 'A') return String(A);
      if (trimmed === 'B') return String(B);
      if (trimmed === 'C') return String(C);
      if (trimmed === 'D') return String(D);
      const evalResult = safeEval(trimmed, vars, { forTemplate: true });
      if (!isInvalid(evalResult)) {
        return String(evalResult);
      }
      return match;
    });

    // 정답/오답 계산
    const correctAnswer = safeEval(record.answerEval, vars);
    if (isInvalid(correctAnswer)) return null;

    let wrongAnswer = safeEval(record.wrongEval, vars);

    // 오답이 비정상이거나 정답과 같으면 fallback 보정
    if (isInvalid(wrongAnswer) || wrongAnswer === correctAnswer) {
      wrongAnswer = generateFallbackWrong(correctAnswer);
    }

    // 2지선다 배치 (랜덤 순서)
    const correctIndex = Math.random() < 0.5 ? 0 : 1;
    const choices: [number | string, number | string] = correctIndex === 0
      ? [correctAnswer, wrongAnswer]
      : [wrongAnswer, correctAnswer];

    return { questionText, correctAnswer, wrongAnswer, choices, correctIndex };
  } catch {
    return null;
  }
}
