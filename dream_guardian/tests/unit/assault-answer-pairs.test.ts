import { describe, it, expect } from 'vitest';
import {
  createAssaultAnswerPairs,
  AssaultAnswerPairError,
  type CreateAnswerPairsOptions,
  type AssaultAnswerPair,
  type AssaultChoiceItem,
} from '../../src/question/AssaultAnswerPairFactory.js';
import type { GeneratedQuestion } from '../../src/types/index.js';

describe('[BOSS-ASSAULT-07 / #509] 숫자형 반복 보기 쌍 공급 어댑터 (AssaultAnswerPairFactory)', () => {
  describe('1. 단일 문제 1회 공급 및 다중 pair 구조 검증 (A11)', () => {
    it('단일 정답 12와 3쌍 요청 시 정확히 3개의 pair를 생성해야 한다', () => {
      const options: CreateAnswerPairsOptions = {
        correctAnswer: 12,
        pairCount: 3,
        seed: 42,
        roundId: 'round-01',
      };

      const pairs: readonly AssaultAnswerPair[] = createAssaultAnswerPairs(options);
      expect(pairs).toHaveLength(3);

      pairs.forEach((pair: AssaultAnswerPair, index: number) => {
        expect(pair.pairId).toBe(`round-01-pair-${index + 1}`);
        expect(pair.left).toBeDefined();
        expect(pair.right).toBeDefined();
        expect(pair.choices).toHaveLength(2);
        expect(pair.choices[0]).toBe(pair.left);
        expect(pair.choices[1]).toBe(pair.right);

        // 각 pair마다 정답은 정확히 1개
        const correctCount = [pair.left.isCorrect, pair.right.isCorrect].filter(Boolean).length;
        expect(correctCount).toBe(1);

        // correctSide와 일치
        if (pair.correctSide === 'left') {
          expect(pair.left.isCorrect).toBe(true);
          expect(pair.left.value).toBe(12);
          expect(pair.right.isCorrect).toBe(false);
          expect(pair.right.value).not.toBe(12);
        } else {
          expect(pair.right.isCorrect).toBe(true);
          expect(pair.right.value).toBe(12);
          expect(pair.left.isCorrect).toBe(false);
          expect(pair.left.value).not.toBe(12);
        }
      });
    });

    it('roundId 미제공 시 기본 pairId 패턴을 생성해야 한다', () => {
      const pairs = createAssaultAnswerPairs({
        correctAnswer: 7,
        pairCount: 2,
        seed: 100,
      });

      expect(pairs[0].pairId).toBe('pair-1');
      expect(pairs[1].pairId).toBe('pair-2');
    });

    it('questionId 제공 시 questionId 기반 pairId를 생성해야 한다', () => {
      const pairs = createAssaultAnswerPairs({
        correctAnswer: 7,
        pairCount: 2,
        seed: 100,
        questionId: 'q-99',
      });

      expect(pairs[0].pairId).toBe('q-99-pair-1');
      expect(pairs[1].pairId).toBe('q-99-pair-2');
    });

    it('각 pair마다 서로 다른 오답을 배치해야 한다 (오답 후보 풀 고갈 방지)', () => {
      const pairs = createAssaultAnswerPairs({
        correctAnswer: 15,
        pairCount: 3,
        seed: 777,
      });

      const wrongValues = pairs.map((p) => (p.correctSide === 'left' ? p.right.value : p.left.value));
      const uniqueWrong = new Set(wrongValues);
      expect(uniqueWrong.size).toBe(3);
    });
  });

  describe('2. 수치적 동치 오답 배제 및 DEC-A5 오답 생성 규칙 검증', () => {
    it('정답이 1일 때 1과 수치적으로 동치인 오답(1.0, 1 등)을 일체 생성하지 않아야 한다', () => {
      const pairs = createAssaultAnswerPairs({
        correctAnswer: 1,
        pairCount: 4,
        seed: 1234,
      });

      pairs.forEach((pair) => {
        const wrongChoice: AssaultChoiceItem = pair.correctSide === 'left' ? pair.right : pair.left;
        expect(Number(wrongChoice.value)).not.toBe(1);
        expect(Math.abs(Number(wrongChoice.value) - 1)).toBeGreaterThan(1e-9);
        expect(wrongChoice.text).not.toBe('1');
        expect(wrongChoice.text).not.toBe('1.0');
      });
    });

    it('정답 12에 대해 DEC-A5 규칙(±1, ±2, ±10, 자릿수 치환 등) 기반의 타당한 정수 오답이 생성되어야 한다', () => {
      const pairs = createAssaultAnswerPairs({
        correctAnswer: 12,
        pairCount: 3,
        seed: 9999,
      });

      pairs.forEach((pair) => {
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;
        expect(Number.isFinite(wrongChoice.value)).toBe(true);
        expect(wrongChoice.value).not.toBe(12);
        // 양수 정답의 경우 오답도 음수가 되지 않아야 함
        expect(wrongChoice.value).toBeGreaterThanOrEqual(0);
      });
    });

    it('정답이 0인 경우에도 유효한 0 초과 오답을 정상 생성해야 한다', () => {
      const pairs = createAssaultAnswerPairs({
        correctAnswer: 0,
        pairCount: 3,
        seed: 55,
      });

      pairs.forEach((pair) => {
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;
        expect(wrongChoice.value).toBeGreaterThan(0);
        expect(wrongChoice.value).not.toBe(0);
      });
    });

    it('소수 정답(예: 2.5)에 대해서도 유효하고 distinct한 소수/정수 오답을 생성해야 한다', () => {
      const pairs = createAssaultAnswerPairs({
        correctAnswer: 2.5,
        pairCount: 3,
        seed: 88,
      });

      pairs.forEach((pair) => {
        const wrongChoice = pair.correctSide === 'left' ? pair.right : pair.left;
        expect(Math.abs(wrongChoice.value - 2.5)).toBeGreaterThan(1e-9);
      });
    });
  });

  describe('3. 결정론적 PRNG 재현성 및 정답 위치 편향 검증', () => {
    it('동일한 seed와 옵션을 전달하면 100% 동일한 결과가 반환되어야 한다', () => {
      const options: CreateAnswerPairsOptions = {
        correctAnswer: 24,
        pairCount: 5,
        seed: 314159,
        roundId: 'round-pi',
      };

      const pairs1 = createAssaultAnswerPairs(options);
      const pairs2 = createAssaultAnswerPairs(options);

      expect(pairs1).toEqual(pairs2);
    });

    it('서로 다른 seed를 전달하면 결과(배치 또는 오답)가 달라져야 한다', () => {
      const pairs1 = createAssaultAnswerPairs({
        correctAnswer: 24,
        pairCount: 3,
        seed: 111,
      });
      const pairs2 = createAssaultAnswerPairs({
        correctAnswer: 24,
        pairCount: 3,
        seed: 222,
      });

      expect(JSON.stringify(pairs1)).not.toBe(JSON.stringify(pairs2));
    });

    it('정답 위치가 단순 강제 좌우 교대(L-R-L-R)가 아니어야 한다 (시드 기반 독립 배치)', () => {
      // 강제 좌우 교대인 경우 항상 index % 2에 종속되므로 연속 같은 방향(L-L 또는 R-R)이 불가능함.
      // 여러 시드 중 연속으로 같은 방향이 나오는 시드가 존재하는지 확인
      let foundConsecutiveSameSide = false;

      for (let s = 1; s <= 20; s++) {
        const pairs = createAssaultAnswerPairs({
          correctAnswer: 10,
          pairCount: 4,
          seed: s,
        });

        for (let i = 0; i < pairs.length - 1; i++) {
          if (pairs[i].correctSide === pairs[i + 1].correctSide) {
            foundConsecutiveSameSide = true;
            break;
          }
        }
        if (foundConsecutiveSameSide) break;
      }

      expect(foundConsecutiveSameSide).toBe(true);
    });
  });

  describe('4. 입력 정규화 및 question 객체 지원', () => {
    it('문자열 형태의 숫자("12", "012", "-5")를 올바르게 파싱해야 한다', () => {
      const pairs1 = createAssaultAnswerPairs({
        correctAnswer: '12',
        pairCount: 2,
        seed: 10,
      });
      expect(pairs1[0].choices.find((c) => c.isCorrect)?.value).toBe(12);

      const pairs2 = createAssaultAnswerPairs({
        correctAnswer: '012',
        pairCount: 2,
        seed: 10,
      });
      expect(pairs2[0].choices.find((c) => c.isCorrect)?.value).toBe(12);

      const pairs3 = createAssaultAnswerPairs({
        correctAnswer: '-5',
        pairCount: 2,
        seed: 10,
      });
      expect(pairs3[0].choices.find((c) => c.isCorrect)?.value).toBe(-5);
    });

    it('question 객체({ correctAnswer })를 전달했을 때 정상 처리되어야 한다', () => {
      const mockQuestion: Partial<GeneratedQuestion> = {
        questionText: '7 + 8 = ?',
        correctAnswer: 15,
        wrongAnswer: 14,
      };

      const pairs = createAssaultAnswerPairs({
        question: mockQuestion as GeneratedQuestion,
        pairCount: 2,
        seed: 42,
      });

      expect(pairs).toHaveLength(2);
      expect(pairs[0].choices.find((c) => c.isCorrect)?.value).toBe(15);
    });
  });

  describe('5. 비정상 입력 및 수식형 보기 명시적 거부 검증', () => {
    it('NaN 또는 Infinity 입력 시 AssaultAnswerPairError를 던져야 한다', () => {
      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: NaN,
          pairCount: 2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: Infinity,
          pairCount: 2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 'NaN',
          pairCount: 2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);
    });

    it('미지원 수식형 문자열("2 + 3", "x = 4", "1/2") 입력 시 명시적 에러를 던져야 한다', () => {
      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: '2 + 3',
          pairCount: 2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: '1/2',
          pairCount: 2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 'formula',
          pairCount: 2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);
    });

    it('빈 문자열 또는 공백 입력 시 에러를 던져야 한다', () => {
      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: '',
          pairCount: 2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: '   ',
          pairCount: 2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);
    });

    it('pairCount가 0 이하이거나 정수가 아닐 때 에러를 던져야 한다', () => {
      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 10,
          pairCount: 0,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 10,
          pairCount: -2,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 10,
          pairCount: 2.5,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 10,
          pairCount: NaN,
          seed: 1,
        }),
      ).toThrow(AssaultAnswerPairError);
    });

    it('seed가 유한 정수가 아닐 때 에러를 던져야 한다', () => {
      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 10,
          pairCount: 2,
          seed: NaN,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 10,
          pairCount: 2,
          seed: Infinity,
        }),
      ).toThrow(AssaultAnswerPairError);

      expect(() =>
        createAssaultAnswerPairs({
          correctAnswer: 10,
          pairCount: 2,
          seed: 1.5,
        }),
      ).toThrow(AssaultAnswerPairError);
    });

    it('options가 객체가 아니거나 정답이 누락된 경우 에러를 던져야 한다', () => {
      expect(() => createAssaultAnswerPairs(null as any)).toThrow(AssaultAnswerPairError);
      expect(() => createAssaultAnswerPairs(undefined as any)).toThrow(AssaultAnswerPairError);
      expect(() => createAssaultAnswerPairs({ pairCount: 2, seed: 1 } as any)).toThrow(
        AssaultAnswerPairError,
      );
    });
  });

  describe('6. 불변성(deepFreeze) 및 원본 보존 검증', () => {
    it('반환된 보기 쌍 배열 및 모든 내부 객체(pair, left, right, choices)가 동결(frozen)되어 있어야 한다', () => {
      const pairs = createAssaultAnswerPairs({
        correctAnswer: 20,
        pairCount: 2,
        seed: 123,
      });

      expect(Object.isFrozen(pairs)).toBe(true);

      pairs.forEach((pair) => {
        expect(Object.isFrozen(pair)).toBe(true);
        expect(Object.isFrozen(pair.left)).toBe(true);
        expect(Object.isFrozen(pair.right)).toBe(true);
        expect(Object.isFrozen(pair.choices)).toBe(true);

        // 수정 시도 시 TypeError 발생
        expect(() => {
          (pair as any).correctSide = 'left';
        }).toThrow();
        expect(() => {
          (pair.left as any).value = 999;
        }).toThrow();
      });
    });

    it('전달된 입력 question 객체가 변형되지 않아야 한다 (Zero Side-Effects)', () => {
      const originalQuestion = Object.freeze({
        questionText: '9 × 3 = ?',
        correctAnswer: 27,
        wrongAnswer: 28,
      });

      const pairs = createAssaultAnswerPairs({
        question: originalQuestion as any,
        pairCount: 3,
        seed: 777,
      });

      expect(pairs).toHaveLength(3);
      expect(originalQuestion.correctAnswer).toBe(27);
    });
  });
});
