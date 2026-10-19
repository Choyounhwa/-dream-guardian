/**
 * assault-recovery-question-wiring.test.ts
 *
 * [BOSS-ASSAULT-REC-02 / #592] 문항 정규화와 원자적 진입 복구 단위 테스트
 *
 * 검증 목표:
 * 1. Factory.createRoundController()에서 questionText가 {id, text}로 정규화되어 text가 undefined가 되지 않는다.
 * 2. AppBootstrap이 REC-01 getPoolSnapshot()을 통해 선택된 문항을 읽고, 템플릿을 정확히 1회 생성한다.
 * 3. 하드코딩된 예제 문제 대체(가짜 3문제)가 제거되어, 적격 문항 0개 시 원자적으로 오류를 발생시킨다.
 * 4. 적격 문항 0개 시 startAssaultPhase()가 ASSAULT_ROUND로 전이되지 않고 상태를 보존한다.
 * 5. 원본 식별자, 정답, choices, 레벨/서브레벨 등 메타데이터가 보존된다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSessionFactory, AssaultSessionValidationError } from '../../src/core/AssaultSessionFactory.js';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import type { QuestionRecord } from '../../src/types/index.js';
import * as QuestionEvaluatorModule from '../../src/question/QuestionEvaluator.js';

function createMockCanvas() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    roundRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    rect: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    translate: vi.fn(),
    scale: vi.fn(),
    ellipse: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
  };
  return {
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

describe('[BOSS-ASSAULT-REC-02 / #592] Question Normalization and Atomic Entry', () => {
  describe('1. Factory.createRoundController() 문항 정규화', () => {
    const mockBattleState = {
      hp: 100,
      maxHp: 100,
      applyHazardDamage: vi.fn(),
    };

    it('questionText 프로퍼티를 가진 QuestionCandidate를 전달했을 때 question.text가 올바르게 설정되어야 한다 (undefined 방지)', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattleState as any,
        questions: [
          {
            id: 'q_test_101',
            level: 1,
            subLevel: 1,
            questionText: '7 + 8 = ?',
            correctAnswer: 15,
            wrongAnswer: 16,
            choices: [15, 16],
          },
        ],
        speech: { speak: vi.fn(), cancel: vi.fn() },
      });

      const candidate = session.eligibleQuestions[0];
      expect(candidate).toBeDefined();
      expect(candidate.questionText).toBe('7 + 8 = ?');

      // RoundController 생성
      const roundController = session.createRoundController('round_01', candidate as any);

      // question.text가 undefined가 아니어야 함!
      expect(roundController.question).toBeDefined();
      expect(roundController.question.text).toBe('7 + 8 = ?');
      expect(roundController.question.id).toBe('q_test_101');
      expect((roundController.question as any).correctAnswer).toBe(15);
    });

    it('문자열 또는 text 프로퍼티를 가진 기존 형식도 하위 호환되어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattleState as any,
        questions: [
          {
            level: 1,
            subLevel: 1,
            questionText: '1 + 1 = ?',
            correctAnswer: 2,
            choices: [2, 3],
          },
        ],
        speech: { speak: vi.fn(), cancel: vi.fn() },
      });

      // 문자열 직접 전달
      const rc1 = session.createRoundController('round_01', '5 + 5 = ?');
      expect(rc1.question.text).toBe('5 + 5 = ?');
      expect(rc1.question.id).toBe('q_round_01');

      // { id, text } 직접 전달
      const rc2 = session.createRoundController('round_02', { id: 'custom_id', text: '9 - 4 = ?' });
      expect(rc2.question.text).toBe('9 - 4 = ?');
      expect(rc2.question.id).toBe('custom_id');
    });
  });

  describe('2. AppBootstrap 문항 공급 및 1회 생성 보장', () => {
    let app: AppBootstrap;

    beforeEach(async () => {
      app = new AppBootstrap({
        canvas: createMockCanvas() as any,
        autoStartCamera: false,
        preloadAssets: false,
        mode: 'boss_assault',
      });
      await app.init();
    });

    it('assembleAssaultSession()은 getPoolSnapshot()을 사용하고 템플릿을 문항당 정확히 1회만 생성해야 한다', () => {
      const mockRecords: (QuestionRecord & { id?: string })[] = [
        {
          id: 'tpl_1',
          level: 1,
          subLevel: 1,
          levelTitle: '덧셈',
          subLevelTitle: '한자리',
          questionTemplate: '{A} + {B} = ?',
          answerEval: 'A+B',
          wrongEval: 'A+B+1',
          varA: 'rand(1,5)',
          varB: 'rand(1,5)',
          varC: '0',
          varD: '0',
          shapeCode: '',
        },
      ];

      app.questionBank.loadRecords(mockRecords);
      app.questionBank.setLevel(1, 1);

      const generateSpy = vi.spyOn(QuestionEvaluatorModule, 'generateQuestion');

      const session = app.assembleAssaultSession();
      expect(session).toBeDefined();
      expect(session.eligibleQuestions.length).toBe(1);
      expect(session.eligibleQuestions[0].id).toBe('tpl_1');
      expect(session.eligibleQuestions[0].questionText).toContain('+');

      // 생성 횟수 1회
      expect(generateSpy).toHaveBeenCalledTimes(1);
      generateSpy.mockRestore();
    });

    it('하드코딩된 예제 문제 대체가 제거되어야 하며, 적격 문항 0개 시 오류가 발생해야 한다', () => {
      // 도형 문제만 있는 풀 (도형 문제는 적격성 필터에서 제외됨)
      const shapeOnlyRecords: QuestionRecord[] = [
        {
          level: 1,
          subLevel: 1,
          levelTitle: '도형',
          subLevelTitle: '도형 인식',
          questionTemplate: '도형 {A}',
          answerEval: '1',
          wrongEval: '2',
          varA: '1',
          varB: '0',
          varC: '0',
          varD: '0',
          shapeCode: 'TRIANGLE_SHAPE',
        },
      ];

      app.questionBank.loadRecords(shapeOnlyRecords);
      app.questionBank.setLevel(1, 1);

      // 하드코딩 예제로 채우지 않고, 반드시 AssaultSessionValidationError를 발생시켜야 함
      expect(() => {
        app.assembleAssaultSession();
      }).toThrowError(AssaultSessionValidationError);
    });

    it('적격 문항이 0개일 때 startAssaultPhase()는 ASSAULT_ROUND로 전이되지 않아야 한다', () => {
      const shapeOnlyRecords: QuestionRecord[] = [
        {
          level: 1,
          subLevel: 1,
          levelTitle: '도형',
          subLevelTitle: '도형',
          questionTemplate: '도형 {A}',
          answerEval: '1',
          wrongEval: '2',
          varA: '1',
          varB: '0',
          varC: '0',
          varD: '0',
          shapeCode: 'SQUARE_SHAPE',
        },
      ];

      app.questionBank.loadRecords(shapeOnlyRecords);
      app.questionBank.setLevel(1, 1);

      app.startReadyPhase();
      expect(app.stateMachine.currentState).toBe('READY_POSITION');

      // skip -> startAssaultPhase 호출
      app.readyPositionController.skip();

      // 적격 문제가 없으므로 ASSAULT_ROUND로 전이되지 않고 READY_POSITION(또는 안전 상태) 유지
      expect(app.stateMachine.currentState).not.toBe('ASSAULT_ROUND');
    });
  });
});
