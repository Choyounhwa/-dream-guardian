/**
 * QuestionFixtures.ts - 퀴즈 렌더러 테스트 및 DTO 픽스처 정의
 *
 * QuestionRenderer.ts 1,000줄 가드레일 준수를 위해 픽스처 DTO 분리
 */

import type { QuestionFixtureDTO } from './QuestionRenderer.js';

export const DEFAULT_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '12 + 15 = [ ? ]',
  choices: ['27', '25'] as [string, string],
  answer: '27',
  shapeCode: null,
  level: 1,
  chapter: 1,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});

export const LONG_FORMULA_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '124 × 7 - 28 ÷ 4 + 50 = [ ? ]',
  choices: ['840', '820'] as [string, string],
  answer: '840',
  shapeCode: null,
  level: 4,
  chapter: 2,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});

export const FRACTION_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '3/4 + 2/4 = [ ? ]',
  choices: ['5/4', '6/4'] as [string, string],
  answer: '5/4',
  shapeCode: null,
  level: 3,
  chapter: 3,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});

export const GEOMETRY_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '[모양 A] 위에서 본 모양으로 알맞은 것은?',
  choices: ['2개', '3개'] as [string, string],
  answer: '2개',
  shapeCode: "{type:'stack_cubes',grid:[[2,1],[1,0]],view:'top',shapeName:'모양 A'}",
  level: 9,
  chapter: 4,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});

export const DECIMAL_QUESTION_FIXTURE: QuestionFixtureDTO = Object.freeze({
  questionText: '0.25 + 0.50 = [ ? ]',
  choices: ['0.75', '0.70'] as [string, string],
  answer: '0.75',
  shapeCode: null,
  level: 2,
  chapter: 2,
  selectedChoiceIndex: null,
  activeHoverIndex: null,
  choiceProgress: [0, 0] as [number, number],
  questionApproachProgress: 1.0,
  answerApproachProgress: 1.0,
  answerSelectable: true,
  buttonsOnly: false,
  headerOnly: false,
});
