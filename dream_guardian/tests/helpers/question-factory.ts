import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

/**
 * createTestQuestionCandidate - questions.csv 및 QuestionBank가 생성하는 실데이터 스키마와 동일한 테스트 문항 팩토리
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md
 */
export function createTestQuestionCandidate(
  overrides?: Partial<QuestionCandidate>,
): QuestionCandidate {
  return {
    id: 'q_test_candidate_01',
    level: 1,
    subLevel: 1,
    levelTitle: '덧뺄셈',
    subLevelTitle: '두자리',
    questionText: '14 + 18 = ?',
    correctAnswer: 32,
    wrongAnswer: 34,
    choices: [32, 34],
    shapeCode: '',
    ...overrides,
  };
}
