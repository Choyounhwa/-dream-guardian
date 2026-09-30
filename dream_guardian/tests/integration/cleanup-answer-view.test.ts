import { describe, it, expect, vi } from 'vitest';
import { QuestionRenderer, type QuestionRenderState } from '../../src/render/QuestionRenderer.js';
import { PartIconRenderer } from '../../src/render/PartIconRenderer.js';
import { AnswerSelectionRenderer } from '../../src/render/AnswerSelectionRenderer.js';
import { MagicCircleRenderer } from '../../src/render/MagicCircleRenderer.js';
import { getAnswerButtonLayouts } from '../../config/zone.config.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { BattleState } from '../../src/game/BattleState.js';
import { MenuInput } from '../../src/input/MenuInput.js';
import type { GeneratedQuestion } from '../../src/question/QuestionEvaluator.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

const mockQuestion: GeneratedQuestion = {
  questionText: '8 + 7 = ?',
  choices: [15, 14],
  correctAnswer: 15,
  wrongAnswer: 14,
  correctIndex: 0,
};

describe('Cleanup Answer View - [CLEANUP-ANSWER-VIEW-001 / #233]', () => {
  describe('1. ANSWER_SELECT에서 구형 아이콘 및 방사형 레시피 버튼 호출 0', () => {
    it('QuestionRenderer는 PartIconRenderer.drawRadialAnswerButton과 drawRequirementGroup을 호출하지 않는다', () => {
      const drawRadialSpy = vi.spyOn(PartIconRenderer, 'drawRadialAnswerButton');
      const drawReqSpy = vi.spyOn(PartIconRenderer, 'drawRequirementGroup');

      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
      };

      renderer.render(ctx, 1080, 2160, state);

      // 구형 레시피 방사형 버튼 및 요구부위 아이콘 호출 0 검증
      expect(drawRadialSpy).not.toHaveBeenCalled();
      expect(drawReqSpy).not.toHaveBeenCalled();

      drawRadialSpy.mockRestore();
      drawReqSpy.mockRestore();
    });

    it('QuestionRenderer는 answerPlan이 없어도 정상적으로 답안 버튼 2개와 텍스트를 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
        // answerPlan 제공하지 않음
      };

      renderer.render(ctx, 1080, 2160, state);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();

      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => t.includes('15'))).toBe(true);
      expect(textCalls.some((t: string) => t.includes('14'))).toBe(true);
      expect(textCalls.some((t: string) => t.includes('키보드 [1]'))).toBe(true);
      expect(textCalls.some((t: string) => t.includes('키보드 [2]'))).toBe(true);
    });

    it('선택된 답안 인덱스(selectedChoiceIndex)에 대한 하이라이트 테두리가 점등된다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        selectedChoiceIndex: 1,
      };

      renderer.render(ctx, 1080, 2160, state);

      // 선택 하이라이트(#4DFFAA)가 적용되어 stroke가 호출됨
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('2. 프로덕션 답안 경로의 E_Pit 마법진 호출 0', () => {
    it('AnswerSelectionRenderer에 activeZones가 빈 배열로 전달되면 마법진이 호출되지 않는다', () => {
      const renderer = new AnswerSelectionRenderer();
      const magicCircle = new MagicCircleRenderer();
      const renderAtZoneSpy = vi.spyOn(magicCircle, 'renderAtZone');
      renderer.setMagicCircle(magicCircle);

      const ctx = createMockCtx();
      const cursors = new Map();

      // activeZones를 빈 배열로 렌더
      renderer.render(ctx, 1080, 2160, [], cursors);

      expect(renderAtZoneSpy).not.toHaveBeenCalled();
      renderAtZoneSpy.mockRestore();
    });
  });

  describe('3. 좌/우 버튼 레이아웃 및 1/2·터치 fallback 유지', () => {
    it('답안 버튼 레이아웃은 Zone 4(좌) 및 Zone 5(우) 영역에 정확히 2개 위치한다', () => {
      const layouts = getAnswerButtonLayouts(1080, 2160);
      expect(layouts).toHaveLength(2);

      const [btn0, btn1] = layouts;
      // 좌측 버튼은 화면 좌측 절반(x < 540)
      expect(btn0.centerX).toBeLessThan(540);
      // 우측 버튼은 화면 우측 절반(x > 540)
      expect(btn1.centerX).toBeGreaterThan(540);

      // 두 버튼은 동일한 높이와 Y 위치를 가짐
      expect(btn0.y).toBe(btn1.y);
      expect(btn0.height).toBe(btn1.height);
      expect(btn0.width).toBe(btn1.width);
    });

    it('ArmReachAnswerSelector 및 BeatRunCoordinator에서 폴백 선택이 정상 동작한다', () => {
      const questionBank = new QuestionBank();
      questionBank.loadRecords([
        {
          level: 1,
          subLevel: 1,
          levelTitle: '덧셈 기초',
          subLevelTitle: '한 자리 덧셈',
          questionTemplate: '{A} + {B} = ?',
          answerEval: 'A + B',
          wrongEval: 'A + B + 1',
          varA: '2',
          varB: '3',
          varC: '',
          varD: '',
          shapeCode: '',
        },
      ]);
      const battle = new BattleState();
      const armReach = new ArmReachAnswerSelector();
      const coordinator = new BeatRunCoordinator({
        routineMode: 'arm_reach',
        questionBank,
        battle,
        armReachAnswerSelector: armReach,
      });

      coordinator.startRound({ chapter: 1, subLevel: 1 });
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep();
        coordinator.update(0.5);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);

      // 1번(0번 인덱스) 폴백 선택
      coordinator.confirmAnswerByFallback(0);
      expect(coordinator.selectedChoiceIndex).toBe(0);
      expect(coordinator.isAnswerOpen).toBe(false);
    });
  });

  describe('4. 별 수집 커서/레일 및 메뉴 입력 회귀 0', () => {
    it('합장(MenuInput) 제스처는 독립적으로 정상 동작한다', () => {
      const menuInput = new MenuInput();
      expect(menuInput.isActive).toBe(false);

      // 양손을 중앙에 합장 위치로 배치
      menuInput.update(0.50, 0.60, 0.52, 0.60);
      expect(menuInput.isActive).toBe(true);

      menuInput.reset();
      expect(menuInput.isActive).toBe(false);
    });
  });
});
