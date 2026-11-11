import { describe, it, expect } from 'vitest';
import { assembleQuestionPair } from '../../src/core/bootstrap/AssaultImpactWireHelper.js';
import { AssaultLoopRoundAssembler } from '../../src/core/AssaultLoopRoundAssembler.js';
import { DEFAULT_ASSAULT_LOOP_CONFIG } from '../../config/assault-loop.config.js';
import { defaultNumericRepeatSource } from '../../src/core/AssaultSessionFactory.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

describe('[FEAT-ASSAULT-FRAC-003] Assault 후보 조립 시 CSV 오답 분수 보기쌍 우선 오답 전달', () => {
  it('1. assembleQuestionPair: 문자열 오답("4/14")이 wrongAnswer에 그대로 보존되어야 한다', () => {
    const generated = {
      questionText: '5/14 와 4/14 중 큰 수는?',
      choices: ['5/14', '4/14'] as [string, string],
      correctAnswer: '5/14',
      correctIndex: 0,
      wrongAnswer: '4/14',
    };

    const rec = {
      id: 'q-frac-1',
      level: 3,
      subLevel: 1,
      levelTitle: '분수',
      subLevelTitle: '비교 1',
      questionTemplate: '{A}/{C} 와 {B}/{C} 중 큰 수는?',
      answerEval: "A>B? A+'/'+C : B+'/'+C",
    };

    const candidate: QuestionCandidate = assembleQuestionPair(generated, rec);
    expect(candidate.wrongAnswer).toBe('4/14');
    expect(candidate.correctAnswer).toBe('5/14');
  });

  it('2. assembleQuestionPair: 숫자형 오답(11)도 wrongAnswer에 정상 보존되어야 한다', () => {
    const generated = {
      questionText: '5 + 7 = ?',
      choices: [12, 11] as [number, number],
      correctAnswer: 12,
      correctIndex: 0,
    };

    const rec = {
      id: 'q-num-1',
      level: 1,
      subLevel: 1,
    };

    const candidate: QuestionCandidate = assembleQuestionPair(generated, rec);
    expect(candidate.wrongAnswer).toBe(11);
    expect(candidate.correctAnswer).toBe(12);
  });

  it('3. AssaultLoopRoundAssembler: 분수 문항 조립 시 4개 보기쌍의 오답이 모두 CSV 오답("4/14")과 일치해야 한다', () => {
    const assembler = new AssaultLoopRoundAssembler({
      loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      baseSeed: 42,
      bpm: 120,
      roundSource: defaultNumericRepeatSource,
    } as any);

    const question: QuestionCandidate = {
      id: 'q-frac-round',
      level: 3,
      subLevel: 1,
      questionText: '5/14 와 4/14 중 큰 수는?',
      correctAnswer: '5/14',
      wrongAnswer: '4/14',
    };

    assembler.createRoundController('round_01' as any, question as any);
    const loopPlan = assembler.getCurrentLoopPlan();
    expect(loopPlan).not.toBeNull();

    const answerEncounters = loopPlan!.encounters.filter((e) => e.kind === 'answer_pair');
    expect(answerEncounters).toHaveLength(4);

    answerEncounters.forEach((enc: any) => {
      const pair = enc.pair;
      expect(pair).toBeDefined();

      const correctChoice = pair.choices.find((c: any) => c.isCorrect);
      const wrongChoice = pair.choices.find((c: any) => !c.isCorrect);

      expect(correctChoice.text).toBe('5/14');
      expect(wrongChoice.text).toBe('4/14');
    });
  });

  it('4. AssaultLoopRoundAssembler: 정수/소수 문항에서는 preferredWrong이 있어도 기존 결정론적 출력을 유지해야 한다 (회귀 0건)', () => {
    const assembler = new AssaultLoopRoundAssembler({
      loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      baseSeed: 42,
      bpm: 120,
      roundSource: defaultNumericRepeatSource,
    } as any);

    const question: QuestionCandidate = {
      id: 'q-int-round',
      level: 1,
      subLevel: 1,
      questionText: '7 + 5 = ?',
      correctAnswer: 12,
      wrongAnswer: 10,
    };

    assembler.createRoundController('round_01' as any, question as any);
    const loopPlan = assembler.getCurrentLoopPlan();
    expect(loopPlan).not.toBeNull();

    const answerEncounters = loopPlan!.encounters.filter((e) => e.kind === 'answer_pair');
    expect(answerEncounters).toHaveLength(4);

    // 4개 쌍의 오답이 서로 다른 다양한 오답으로 생성됨 (정수 경로는 preferredWrong 무시)
    const wrongValues = answerEncounters.map((enc: any) => {
      return enc.pair.choices.find((c: any) => !c.isCorrect).value;
    });

    // 4개의 오답이 고정 하나가 아니라 다양하게 생성됨
    const uniqueWrongValues = new Set(wrongValues);
    expect(uniqueWrongValues.size).toBeGreaterThan(1);
  });
});
