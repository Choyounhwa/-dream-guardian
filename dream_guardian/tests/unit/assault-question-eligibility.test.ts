import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_ASSAULT_QUESTION_CONFIG,
  type AssaultQuestionConfig,
} from '../../config/assault-question.config.js';
import {
  checkQuestionEligibility,
  calculateMinReadSeconds,
  filterEligibleQuestions,
  type QuestionCandidate,
} from '../../src/question/AssaultQuestionEligibility.js';
import { parseCSV } from '../../src/question/CSVLoader.js';

describe('[BOSS-ASSAULT-39 / #542] 접근전 문항 적격성 필터 및 읽기 시간 분류', () => {
  describe('1. 기본 설정 (DEFAULT_ASSAULT_QUESTION_CONFIG) 불변성 및 규칙표 검증', () => {
    it('DEFAULT_ASSAULT_QUESTION_CONFIG가 동결(Object.isFrozen)되어 있어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_QUESTION_CONFIG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_QUESTION_CONFIG.allowedLevels)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_QUESTION_CONFIG.readingLengthThresholds)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_QUESTION_CONFIG.levelAdditionalSeconds)).toBe(true);
    });

    it('기본 설정값이 DEC-A6, DEC-C1, DEC-C9 규격과 일치해야 한다', () => {
      expect(DEFAULT_ASSAULT_QUESTION_CONFIG.maxLabelChars).toBe(6);
      expect(DEFAULT_ASSAULT_QUESTION_CONFIG.baseReadingSeconds).toBe(4.0);
      expect(DEFAULT_ASSAULT_QUESTION_CONFIG.disallowShapeCode).toBe(true);
      expect(DEFAULT_ASSAULT_QUESTION_CONFIG.allowedLevels).toContain(1);
      expect(DEFAULT_ASSAULT_QUESTION_CONFIG.allowedLevels).toContain(2);
    });
  });

  describe('2. 읽기 시간 하한 산출 (calculateMinReadSeconds) 및 경계값 검증 (DEC-C1)', () => {
    it('기본 조건에서 baseReadingSeconds (4.0초)를 산출해야 한다', () => {
      const readSeconds = calculateMinReadSeconds('1 + 2 = ?', 1);
      expect(readSeconds).toBe(4.0);
    });

    it('텍스트 길이 임계치 초과 시 가산 규칙의 경계값(직전, 동일, 초과)을 정확히 산출해야 한다', () => {
      // 임계치 thresholdChars: 10 (+1.0초) 기준
      const text9 = '123456789'; // 길이 9: 직전 (가산 0초)
      const text10 = '1234567890'; // 길이 10: 동일 (가산 0초, 초과 아님)
      const text11 = '12345678901'; // 길이 11: 초과 (+1.0초 가산)

      expect(calculateMinReadSeconds(text9, 1)).toBe(4.0);
      expect(calculateMinReadSeconds(text10, 1)).toBe(4.0);
      expect(calculateMinReadSeconds(text11, 1)).toBe(5.0);
    });

    it('2차 임계치(길이 20) 초과 시 추가 가산되어야 한다', () => {
      const text20 = '12345678901234567890'; // 길이 20: 1차 초과만 해당 (+1.0초)
      const text21 = '123456789012345678901'; // 길이 21: 2차 초과 해당 (+2.0초)

      expect(calculateMinReadSeconds(text20, 1)).toBe(5.0);
      expect(calculateMinReadSeconds(text21, 1)).toBe(6.0);
    });

    it('레벨별 추가 초 가산이 정상 적용되어야 한다', () => {
      // Level 1: +0.0s, Level 2: +0.5s, Level 3: +1.0s, Level 4: +1.5s
      const shortText = '3 + 4';
      expect(calculateMinReadSeconds(shortText, 1)).toBe(4.0);
      expect(calculateMinReadSeconds(shortText, 2)).toBe(4.5);
      expect(calculateMinReadSeconds(shortText, 3)).toBe(5.0);
      expect(calculateMinReadSeconds(shortText, 4)).toBe(5.5);
    });

    it('텍스트 길이 초과 가산과 레벨 가산이 합산되어야 한다', () => {
      const longText = '12345678901'; // 11글자 (+1.0s)
      // Level 2 (+0.5s) -> 4.0 + 1.0 + 0.5 = 5.5s
      expect(calculateMinReadSeconds(longText, 2)).toBe(5.5);
    });

    it('빈 텍스트나 undefined 텍스트 전달 시 기본 4.0초를 반환해야 한다', () => {
      expect(calculateMinReadSeconds('', 1)).toBe(4.0);
      expect(calculateMinReadSeconds(undefined as unknown as string, 1)).toBe(4.0);
    });
  });

  describe('3. 단일 문항 적격성 판정 (checkQuestionEligibility) - 부적격 사유 분류', () => {
    it('Ch.1~2 (또는 allowedLevels) 허용 범위 밖의 레벨은 out_of_chapter_range로 제외해야 한다', () => {
      const qLevel5: QuestionCandidate = {
        level: 5,
        questionText: '2² = ?',
        correctAnswer: 4,
      };
      const result = checkQuestionEligibility(qLevel5);
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toBe('out_of_chapter_range');
      }

      const qLevel9: QuestionCandidate = {
        level: 9,
        questionText: 'x + 3 = 7',
        correctAnswer: 4,
      };
      expect(checkQuestionEligibility(qLevel9)).toEqual(
        expect.objectContaining({ eligible: false, reason: 'out_of_chapter_range' })
      );

      // 커스텀 allowedLevels [1, 2] 적용 시 Level 3 제외 검증
      const customConfig: AssaultQuestionConfig = {
        ...DEFAULT_ASSAULT_QUESTION_CONFIG,
        allowedLevels: [1, 2],
      };
      const qLevel3: QuestionCandidate = {
        level: 3,
        questionText: '3 + 3 = ?',
        correctAnswer: 6,
      };
      expect(checkQuestionEligibility(qLevel3, customConfig)).toEqual(
        expect.objectContaining({ eligible: false, reason: 'out_of_chapter_range' })
      );
    });

    it('shapeCode가 존재하는 문항은 shape_code_present로 제외해야 한다 (DEC-A6)', () => {
      const qWithShape: QuestionCandidate = {
        level: 1,
        questionText: '도형의 변의 수는?',
        correctAnswer: 4,
        shapeCode: "{type:'rect', w:'', h:''}",
      };
      const result = checkQuestionEligibility(qWithShape);
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toBe('shape_code_present');
      }
    });

    it('비교 기호 정답(\'>\', \'<\', \'=\', \'≤\', \'≥\', \'≠\')은 comparison_symbol로 제외해야 한다', () => {
      const symbols = ['>', '<', '=', '≤', '≥', '≠'];
      for (const sym of symbols) {
        const q: QuestionCandidate = {
          level: 1,
          questionText: `3 [ ? ] 5`,
          correctAnswer: sym,
        };
        const result = checkQuestionEligibility(q);
        expect(result.eligible).toBe(false);
        if (!result.eligible) {
          expect(result.reason).toBe('comparison_symbol');
        }
      }
    });

    it('allowSimpleFraction: false 주입 시 분수 문자열 정답(\'1/2\', \'3/4\')은 fraction_answer로 제외해야 한다', () => {
      const customConfig: AssaultQuestionConfig = {
        ...DEFAULT_ASSAULT_QUESTION_CONFIG,
        allowSimpleFraction: false,
      };
      const fractions = ['1/2', '3/4', '5/10', ' -2/3 '];
      for (const frac of fractions) {
        const q: QuestionCandidate = {
          level: 1,
          questionText: `어느 것이 더 클까?`,
          correctAnswer: frac,
        };
        const result = checkQuestionEligibility(q, customConfig);
        expect(result.eligible).toBe(false);
        if (!result.eligible) {
          expect(result.reason).toBe('fraction_answer');
        }
      }
    });

    it('allowSimpleFraction: true 기본값에서 단순 분수("1/2", "5/14", "10/24")는 적격이어야 한다 [FEAT-ASSAULT-FRAC-002]', () => {
      const validFractions = ['1/2', '5/14', '10/24'];
      for (const frac of validFractions) {
        const q: QuestionCandidate = {
          level: 3,
          questionText: '분수 문제',
          correctAnswer: frac,
        };
        const result = checkQuestionEligibility(q);
        expect(result.eligible).toBe(true);
      }
    });

    it('비정상 분수(" -2/3 ", "1/0", "1과 1/2") 및 7자 이상 분수는 제외되어야 한다 [FEAT-ASSAULT-FRAC-002]', () => {
      const invalidFractions: [string, string][] = [
        [' -2/3 ', 'fraction_answer'],
        ['1/0', 'fraction_answer'],
        ['1과 1/2', 'fraction_answer'],
        ['100/200', 'label_length_exceeded'],
      ];
      for (const [frac, expectedReason] of invalidFractions) {
        const q: QuestionCandidate = {
          level: 3,
          questionText: '분수 문제',
          correctAnswer: frac,
        };
        const result = checkQuestionEligibility(q);
        expect(result.eligible).toBe(false);
        if (!result.eligible) {
          expect(result.reason).toBe(expectedReason);
        }
      }
    });

    it('유한 숫자가 아닌 정답(NaN, Infinity, 한글/영문 문자열)은 non_numeric_answer로 제외해야 한다', () => {
      const nonNumerics = [NaN, Infinity, -Infinity, '직사각형', 'abc', '', '  '];
      for (const ans of nonNumerics) {
        const q: QuestionCandidate = {
          level: 1,
          questionText: `문제`,
          correctAnswer: ans as any,
        };
        const result = checkQuestionEligibility(q);
        expect(result.eligible).toBe(false);
        if (!result.eligible) {
          expect(result.reason).toBe('non_numeric_answer');
        }
      }
    });

    it('라벨 최대 길이(기본 6자, DEC-C9)를 초과하는 정답은 label_length_exceeded로 제외해야 한다', () => {
      const qValid6: QuestionCandidate = {
        level: 1,
        questionText: '123456 = ?',
        correctAnswer: 123456, // 6글자 -> 통과
      };
      expect(checkQuestionEligibility(qValid6).eligible).toBe(true);

      const qOver7: QuestionCandidate = {
        level: 1,
        questionText: '1234567 = ?',
        correctAnswer: 1234567, // 7글자 -> 초과
      };
      const result7 = checkQuestionEligibility(qOver7);
      expect(result7.eligible).toBe(false);
      if (!result7.eligible) {
        expect(result7.reason).toBe('label_length_exceeded');
      }

      const qDecimalOver: QuestionCandidate = {
        level: 1,
        questionText: '소수',
        correctAnswer: '12.3456', // 7글자 -> 초과
      };
      expect(checkQuestionEligibility(qDecimalOver)).toEqual(
        expect.objectContaining({ eligible: false, reason: 'label_length_exceeded' })
      );
    });

    it('유효한 정수 및 소수 정답 문항은 통과하고 minReadSeconds를 포함해야 한다', () => {
      const validIntQ: QuestionCandidate = {
        level: 1,
        questionText: '3 + 5 = ?',
        correctAnswer: 8,
      };
      const res1 = checkQuestionEligibility(validIntQ);
      expect(res1.eligible).toBe(true);
      if (res1.eligible) {
        expect(res1.minReadSeconds).toBe(4.0);
      }

      const validDecimalQ: QuestionCandidate = {
        level: 2,
        questionText: '1.2+0.3', // 7글자 (<= 10글자: 가산 없음)
        correctAnswer: 1.5,
      };
      const res2 = checkQuestionEligibility(validDecimalQ);
      expect(res2.eligible).toBe(true);
      if (res2.eligible) {
        expect(res2.minReadSeconds).toBe(4.5); // level 2: 4.0 + 0.0 + 0.5 = 4.5
      }
    });
  });

  describe('4. 실제 questions.csv 레코드 적격성 분류 실측 검증 (A29)', () => {
    const csvPath = path.resolve(__dirname, '../../public/questions.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const allRecords = parseCSV(csvContent);

    it('전체 685문항 원본 CSV가 로드되어야 한다', () => {
      expect(allRecords.length).toBe(685);
    });

    it('L1 비교 기호 문항은 comparison_symbol로 제외되어야 한다', () => {
      const l1Compare = allRecords.find((r) => r.level === 1 && r.subLevelTitle.includes('크기비교'));
      expect(l1Compare).toBeDefined();
      const result = checkQuestionEligibility(l1Compare!);
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toBe('comparison_symbol');
      }
    });

    it('L3 단순 분수 문항은 기본 설정(allowSimpleFraction: true)에서 적격이어야 한다 [FEAT-ASSAULT-FRAC-002]', () => {
      const l3Fraction = allRecords.find((r) => r.level === 3 && r.answerEval.includes('/') && !r.answerEval.includes('>') && !r.shapeCode);
      expect(l3Fraction).toBeDefined();
      const result = checkQuestionEligibility(l3Fraction!);
      expect(result.eligible).toBe(true);
    });

    it('allowSimpleFraction: false 적용 시 L3 분수 문항은 fraction_answer로 제외되어야 한다', () => {
      const customConfig: AssaultQuestionConfig = {
        ...DEFAULT_ASSAULT_QUESTION_CONFIG,
        allowSimpleFraction: false,
      };
      const l3Fraction = allRecords.find((r) => r.level === 3 && r.answerEval.includes('/'));
      expect(l3Fraction).toBeDefined();
      const result = checkQuestionEligibility(l3Fraction!, customConfig);
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toBe('fraction_answer');
      }
    });

    it('Ch.3 및 4-3 단순 분수 허용 후 적격 문항 수가 정상 증가해야 한다 [FEAT-ASSAULT-FRAC-002]', () => {
      const countEligible = (level: number, subLevel: number) => {
        return allRecords.filter(
          (r) => r.level === level && r.subLevel === subLevel && checkQuestionEligibility(r).eligible
        ).length;
      };

      expect(countEligible(3, 1)).toBeGreaterThanOrEqual(10);
      expect(countEligible(3, 2)).toBeGreaterThanOrEqual(10);
      expect(countEligible(3, 3)).toBeGreaterThanOrEqual(9);
      expect(countEligible(3, 4)).toBeGreaterThanOrEqual(12);
      expect(countEligible(3, 5)).toBeGreaterThanOrEqual(10);
      expect(countEligible(4, 3)).toBeGreaterThanOrEqual(12);
    });

    it('L7 도형 문항은 shape_code_present로 제외되어야 한다', () => {
      const l7Shape = allRecords.find((r) => r.level === 7 && r.shapeCode.length > 0);
      expect(l7Shape).toBeDefined();
      const result = checkQuestionEligibility(l7Shape!);
      expect(result.eligible).toBe(false);
      if (!result.eligible) {
        expect(result.reason).toBe('shape_code_present');
      }
    });

    it('L1 정상 숫자 덧셈 문항은 적격(eligible: true)으로 판정되어야 한다', () => {
      const l1Normal = allRecords.find(
        (r) => r.level === 1 && r.subLevel === 1 && r.questionTemplate.includes('+')
      );
      expect(l1Normal).toBeDefined();
      const result = checkQuestionEligibility(l1Normal!);
      expect(result.eligible).toBe(true);
      if (result.eligible) {
        expect(result.minReadSeconds).toBeGreaterThanOrEqual(4.0);
      }
    });
  });

  describe('5. 문항 풀 배치 필터링 (filterEligibleQuestions)', () => {
    it('적격 및 부적격 문항이 혼합된 풀을 올바르게 분리해야 한다', () => {
      const pool: QuestionCandidate[] = [
        { level: 1, questionText: '1 + 1 = ?', correctAnswer: 2 },
        { level: 1, questionText: '비교', correctAnswer: '>' },
        { level: 1, questionText: '비단순 분수', correctAnswer: '-2/3' },
        { level: 2, questionText: '2 * 3 = ?', correctAnswer: 6 },
        { level: 5, questionText: '2^3 = ?', correctAnswer: 8 },
      ];

      const result = filterEligibleQuestions(pool);
      expect(result.eligibleCount).toBe(2);
      expect(result.eligibleQuestions).toHaveLength(2);
      expect(result.rejectedQuestions).toHaveLength(3);
      expect(result.error).toBeUndefined();

      expect(result.eligibleQuestions[0].correctAnswer).toBe(2);
      expect(result.eligibleQuestions[0].minReadSeconds).toBe(4.0);
      expect(result.eligibleQuestions[1].correctAnswer).toBe(6);
      expect(result.eligibleQuestions[1].minReadSeconds).toBe(4.5);
    });

    it('적격 문항이 0개인 풀 입력 시 명시적 오류({ eligibleCount: 0, error: "no_eligible_questions" })를 반환해야 한다', () => {
      const allBadPool: QuestionCandidate[] = [
        { level: 1, questionText: '비교 1', correctAnswer: '>' },
        { level: 1, questionText: '비교 2', correctAnswer: '<' },
        { level: 7, questionText: '도형', correctAnswer: 4, shapeCode: '{type:rect}' },
      ];

      const result = filterEligibleQuestions(allBadPool);
      expect(result.eligibleCount).toBe(0);
      expect(result.eligibleQuestions).toEqual([]);
      expect(result.rejectedQuestions).toHaveLength(3);
      expect(result.error).toBe('no_eligible_questions');
    });

    it('빈 배열 입력 시 no_eligible_questions 오류를 반환해야 한다', () => {
      const result = filterEligibleQuestions([]);
      expect(result.eligibleCount).toBe(0);
      expect(result.eligibleQuestions).toEqual([]);
      expect(result.rejectedQuestions).toEqual([]);
      expect(result.error).toBe('no_eligible_questions');
    });
  });

  describe('6. 불변성(Immutability) 및 순수 함수(Math.random 미사용) 검증', () => {
    it('입력 데이터가 deepFreeze된 상태에서도 변형 없이 순수하게 동작해야 한다', () => {
      const immutablePool: readonly QuestionCandidate[] = Object.freeze([
        Object.freeze({ level: 1, questionText: '1+1', correctAnswer: 2 }),
        Object.freeze({ level: 1, questionText: '비단순 분수', correctAnswer: '-2/3' }),
      ]);

      const result = filterEligibleQuestions(immutablePool);
      expect(result.eligibleCount).toBe(1);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.eligibleQuestions)).toBe(true);
      expect(Object.isFrozen(result.rejectedQuestions)).toBe(true);
    });

    it('적격성 판정 및 읽기 시간 산출 중 Math.random을 일체 호출하지 않아야 한다', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      try {
        const pool: QuestionCandidate[] = [
          { level: 1, questionText: '2 + 3 = ?', correctAnswer: 5 },
          { level: 1, questionText: '3 > 2', correctAnswer: '>' },
          { level: 2, questionText: '123456789012345', correctAnswer: 10 },
        ];

        calculateMinReadSeconds('테스트 텍스트', 1);
        checkQuestionEligibility(pool[0]);
        filterEligibleQuestions(pool);

        expect(randomSpy).not.toHaveBeenCalled();
      } finally {
        randomSpy.mockRestore();
      }
    });
  });
});
