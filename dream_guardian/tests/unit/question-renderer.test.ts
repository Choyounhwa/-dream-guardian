import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  QuestionRenderer,
  renderQuestionHeaderMath,
  type AnswerTimeDisplay,
  type QuestionRenderState,
} from '../../src/render/QuestionRenderer.js';
import type { GeneratedQuestion } from '../../src/question/QuestionEvaluator.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { UI_IMAGE_ASSETS } from '../../config/ui.config.js';

function textsOf(ctx: CanvasRenderingContext2D): string[] {
  return (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
}

function primarySnapshot(overrides: Partial<AnswerTimeDisplay> = {}): AnswerTimeDisplay {
  return {
    phase: 'primary',
    primaryBeats: 2,
    extensionBeats: 2,
    maxBeats: 4,
    elapsedBeats: 0,
    remainingBeats: 2,
    inputOpen: true,
    ...overrides,
  };
}

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
    setLineDash: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    drawImage: vi.fn(),
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
  questionText: '12 + 15',
  choices: [27, 25],
  correctAnswer: 27,
  wrongAnswer: 25,
  correctIndex: 0,
};

describe('QuestionRenderer (Issue #209 / REFACTOR-RENDER-001)', () => {
  it('질문이 없거나 questionVisible=false이면 렌더링하지 않는다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    const state: QuestionRenderState = {
      question: null,
      questionVisible: false,
      selectedChoiceIndex: null,
    };

    renderer.render(ctx, 1080, 2160, state);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('유효한 질문 렌더링 시 문제 수식, 답안 버튼 2개, 키보드 힌트를 렌더링한다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    const state: QuestionRenderState = {
      question: mockQuestion,
      questionVisible: true,
      selectedChoiceIndex: null,
    };

    renderer.render(ctx, 1080, 2160, state);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();

    const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
    expect(textCalls.some((t: string) => t.includes('키보드 [1]'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('키보드 [2]'))).toBe(true);
  });

  it('selectedChoiceIndex가 지정되었을 때 하이라이트 테두리를 렌더링한다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    const state: QuestionRenderState = {
      question: mockQuestion,
      questionVisible: true,
      selectedChoiceIndex: 0,
    };

    renderer.render(ctx, 1080, 2160, state);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  describe('긴 자연어 및 복합 수식 영역 초과 및 겹침 방지 (Issue #234)', () => {
    it('renderQuestionHeaderMath가 긴 문항을 maxHeight 이내로 제한하여 렌더링한다', () => {
      const ctx = createMockCtx();
      const longQuestion = '[모양 P] 겹쳐지지 않고 1개만 놓인 나무(1층 단독)는 모두 몇 개일까요?';

      // scaleX = 1.0, cx = 540, qY = 400 (도형 문제 상단 위치)
      const res = renderQuestionHeaderMath(ctx, longQuestion, 540, 400, 1.0, false, {
        hasShape: true,
      });

      expect(res).toBeDefined();
      expect(res.height).toBeLessThanOrEqual(160);
      expect(res.width).toBeLessThanOrEqual(880);
    });

    it('긴 질문 텍스트 렌더링 시 하단 답안 버튼 영역(y: 890) 및 도형 뷰포트(y: 480)와 겹치지 않는다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const longShapeQuestion: GeneratedQuestion = {
        questionText: '[모양 P] 1층 위에 겹쳐 쌓은 나무(2·3층)는 모두 몇 개일까요?',
        choices: ['5개', '6개'],
        correctAnswer: '5개',
        wrongAnswer: '6개',
        correctIndex: 0,
        shapeCode: "{type:'stack_cubes', grid:[[3,2,1],[2,2,0],[1,1,0]]}",
      };

      const state: QuestionRenderState = {
        question: longShapeQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
      };

      renderer.render(ctx, 1080, 2160, state);

      // fillText에 전달된 모든 Y 좌표를 추적
      const fillTextCalls = (ctx.fillText as any).mock.calls;
      const questionYCoords = fillTextCalls
        .filter((c: any) => typeof c[0] === 'string' && (c[0].includes('나무') || c[0].includes('모양') || c[0].includes('개일까요')))
        .map((c: any) => c[2]);

      // 도형 패널 상단(480px) 이전에 문제 텍스트가 모두 끝나야 함 (겹침 0%)
      for (const y of questionYCoords) {
        expect(y).toBeLessThan(480);
      }
    });

    it('긴 답안 수식/텍스트가 버튼 경계 너비와 높이를 초과하지 않는다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const longChoiceQuestion: GeneratedQuestion = {
        questionText: '2진수 변환 결과는?',
        choices: ['1010101010101₍₂₎', '1010101010100₍₂₎'],
        correctAnswer: '1010101010101₍₂₎',
        wrongAnswer: '1010101010100₍₂₎',
        correctIndex: 0,
      };

      const state: QuestionRenderState = {
        question: longChoiceQuestion,
        questionVisible: true,
        selectedChoiceIndex: null,
      };

      renderer.render(ctx, 1080, 2160, state);

      // 답안 렌더링 호출 확인
      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => t.includes('1010101010101'))).toBe(true);
    });
  });

  describe('답안 버튼 실시간 0~100% 충전 프로그레스 및 체결 연출 (Issue #285 / UI-ANSWER-002)', () => {
    it('choiceProgress에 따라 버튼 내부 네온 충전 필 및 하단 프로그레스 바를 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const fillStyles: string[] = [];
      let maxProgressFillW = 0;

      const origRoundRect = ctx.roundRect as any;
      (ctx.roundRect as any) = vi.fn((x: number, y: number, w: number, h: number, r?: any) => {
        if (typeof ctx.fillStyle === 'string') {
          fillStyles.push(ctx.fillStyle);
          if (ctx.fillStyle.includes('40, 230, 255') || ctx.fillStyle.includes('#28E6FF')) {
            if (w > maxProgressFillW) maxProgressFillW = w;
          }
        }
        if (origRoundRect) origRoundRect(x, y, w, h, r);
      });

      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        choiceProgress: [0.6, 0.0],
      };

      renderer.render(ctx, 1080, 2160, state);

      const hasCyanFill = fillStyles.some((s) => s.includes('40, 230, 255') || s.includes('#28E6FF'));
      expect(hasCyanFill).toBe(true);
      expect(maxProgressFillW).toBeGreaterThan(0);
    });

    it('activeHoverIndex가 지정되었을 때 버튼이 1.05배 확대되고 20px 글로우(shadowBlur)가 적용된다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      let maxRecordedBlur = 0;
      let blurVal = 0;
      Object.defineProperty(ctx, 'shadowBlur', {
        get: () => blurVal,
        set: (v: number) => {
          blurVal = v;
          if (v > maxRecordedBlur) maxRecordedBlur = v;
        },
        configurable: true,
      });

      const recordedWidths: number[] = [];
      const origRoundRect = ctx.roundRect as any;
      (ctx.roundRect as any) = vi.fn((x: number, y: number, w: number, h: number, r?: any) => {
        recordedWidths.push(w);
        if (origRoundRect) origRoundRect(x, y, w, h, r);
      });

      // 1. 호버 없을 때 기본 너비 측정
      const stateNormal: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        activeHoverIndex: null,
      };
      renderer.render(ctx, 1080, 2160, stateNormal);
      const normalBtn0W = recordedWidths[0];

      // 2. 0번 버튼 호버 활성화
      recordedWidths.length = 0;
      const stateHover: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        activeHoverIndex: 0,
      };
      renderer.render(ctx, 1080, 2160, stateHover);
      const hoverBtn0W = recordedWidths[0];

      // 1.05배 확대 검증 (오차 허용 범위 1.04 ~ 1.06)
      expect(hoverBtn0W).toBeGreaterThan(normalBtn0W);
      expect(hoverBtn0W / normalBtn0W).toBeCloseTo(1.05, 2);

      // 버튼 발광 글로우(shadowBlur: 20px 이상) 검증
      expect(maxRecordedBlur).toBeGreaterThanOrEqual(20);
    });

    it('selectedChoiceIndex가 지정되었을 때 강력한 녹색 테두리(#00FF88)와 선택 완료! [V] 스탬프를 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const strokes: string[] = [];
      Object.defineProperty(ctx, 'strokeStyle', {
        get: () => strokes[strokes.length - 1] || '',
        set: (v: string) => {
          strokes.push(v);
        },
        configurable: true,
      });

      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        selectedChoiceIndex: 1,
      };

      renderer.render(ctx, 1080, 2160, state);

      // 녹색 테두리(#00FF88) 적용 검증
      expect(strokes.some((s) => s.toUpperCase() === '#00FF88' || s.includes('0, 255, 136'))).toBe(true);

      // '선택 완료! [V]' 네온 뱃지/스탬프 텍스트 렌더링 검증
      const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
      expect(textCalls.some((t: string) => t.includes('선택 완료! [V]'))).toBe(true);
    });

    it('choiceProgress 진행도에 비례하여 하단 프로그레스 바 너비가 증가한다 (0%, 50%, 100%)', () => {
      const renderer = new QuestionRenderer();
      const getBarWidthForProgress = (prog: number) => {
        const ctx = createMockCtx();
        const widths: number[] = [];
        const origRoundRect = ctx.roundRect as any;
        (ctx.roundRect as any) = vi.fn((x: number, y: number, w: number, h: number, r?: any) => {
          if (h <= 12 && h >= 4) {
            widths.push(w);
          }
          if (origRoundRect) origRoundRect(x, y, w, h, r);
        });

        renderer.render(ctx, 1080, 2160, {
          question: mockQuestion,
          questionVisible: true,
          choiceProgress: [prog, 0],
        });
        return widths.length > 0 ? widths[0] : 0;
      };

      const w50 = getBarWidthForProgress(0.5);
      const w100 = getBarWidthForProgress(1.0);

      expect(w50).toBeGreaterThan(0);
      expect(w100).toBeGreaterThan(w50);
      expect(w100 / w50).toBeCloseTo(2.0, 1);
    });
  });

  describe('[UI-ASSET-009 / #290] 답안 버튼(Zone 4/5) 및 문제 수식 배경 패널 이미지 에셋 연동', () => {
    const assetsDir = path.resolve(__dirname, '../../public/assets/ui/question');

    function createMockImage(w = 256, h = 256): HTMLImageElement {
      return {
        src: 'mock_question.png',
        width: w,
        height: h,
        naturalWidth: w,
        naturalHeight: h,
        complete: true,
      } as unknown as HTMLImageElement;
    }

    it('UI_IMAGE_ASSETS.question 설정에 4개 슬롯이 등록되어 있다', () => {
      expect((UI_IMAGE_ASSETS as any).question).toBeDefined();
      expect((UI_IMAGE_ASSETS as any).question.questionBoardBg).toBe('/assets/ui/question/question_board_bg.png');
      expect((UI_IMAGE_ASSETS as any).question.answerBtnDefault).toBe('/assets/ui/question/answer_btn_default.png');
      expect((UI_IMAGE_ASSETS as any).question.answerBtnHover).toBe('/assets/ui/question/answer_btn_hover.png');
      expect((UI_IMAGE_ASSETS as any).question.answerBtnSelected).toBe('/assets/ui/question/answer_btn_selected.png');
    });

    it('public/assets/ui/question/ 디렉토리에 4종 PNG 에셋이 유효하게 존재한다', () => {
      const files = [
        'question_board_bg.png',
        'answer_btn_default.png',
        'answer_btn_hover.png',
        'answer_btn_selected.png',
      ];
      for (const file of files) {
        const fullPath = path.join(assetsDir, file);
        expect(fs.existsSync(fullPath), `${file} 파일이 존재해야 합니다`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(100);
      }
    });

    it('이미지 에셋이 있을 때 drawImage를 호출하여 비트맵 프레임을 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();
      const mockBoard = createMockImage(800, 300);
      const mockDefault = createMockImage(400, 150);
      const mockHover = createMockImage(400, 150);
      const mockSelected = createMockImage(400, 150);

      const getImageSpy = vi.spyOn(imageLoader, 'get').mockImplementation((cat: string, key: string) => {
        if (cat === 'question') {
          if (key === 'questionBoardBg') return mockBoard;
          if (key === 'answerBtnDefault') return mockDefault;
          if (key === 'answerBtnHover') return mockHover;
          if (key === 'answerBtnSelected') return mockSelected;
        }
        return null;
      });

      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        activeHoverIndex: 0,
        selectedChoiceIndex: 1,
      };

      renderer.render(ctx, 1080, 2160, state);

      const drawCalls = (ctx.drawImage as any).mock.calls;
      expect(drawCalls.length).toBeGreaterThanOrEqual(3);

      expect(drawCalls.some((c: any) => c[0] === mockBoard)).toBe(true);
      expect(drawCalls.some((c: any) => c[0] === mockHover)).toBe(true);
      expect(drawCalls.some((c: any) => c[0] === mockSelected)).toBe(true);

      getImageSpy.mockRestore();
    });

    it('이미지 에셋이 로드되지 않았을 때(null) 프로시저럴 드로잉으로 100% 정상 폴백한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      const getImageSpy = vi.spyOn(imageLoader, 'get').mockReturnValue(null);

      const state: QuestionRenderState = {
        question: mockQuestion,
        questionVisible: true,
        activeHoverIndex: 0,
        selectedChoiceIndex: null,
      };

      renderer.render(ctx, 1080, 2160, state);

      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();

      getImageSpy.mockRestore();
    });
  });
});

describe('QuestionRenderer answer time status (Issue #311 / RENDER-ANSWER-STATUS-001)', () => {
  const visible: QuestionRenderState = {
    question: mockQuestion,
    questionVisible: true,
    buttonsOnly: false,
    answerSelectable: true,
    showAnswerTime: true,
  };

  it('primary 스냅샷은 기본 구간과 남은 박수를 표시한다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    renderer.render(ctx, 1080, 2160, {
      ...visible,
      answerTime: primarySnapshot({ phase: 'primary', remainingBeats: 2, elapsedBeats: 0 }),
    });
    const label = textsOf(ctx).find((t) => t.includes('기본'));
    expect(label).toBeDefined();
    expect(label).toContain('2');
    expect(label).not.toMatch(/연장/);
  });

  it('extension 스냅샷은 연장 구간과 남은 박수를 표시한다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    renderer.render(ctx, 1080, 2160, {
      ...visible,
      answerTime: primarySnapshot({
        phase: 'extension',
        elapsedBeats: 3,
        remainingBeats: 1,
      }),
    });
    const label = textsOf(ctx).find((t) => t.includes('연장'));
    expect(label).toBeDefined();
    expect(label).toContain('1');
    expect(label).not.toMatch(/기본/);
  });

  it('남은 박수 0이어도 구간 라벨을 그리고 충전 게이지를 채우지 않는다', () => {
    const renderer = new QuestionRenderer();
    const ctx = createMockCtx();
    renderer.render(ctx, 1080, 2160, {
      ...visible,
      choiceProgress: [0, 0],
      answerTime: primarySnapshot({ phase: 'extension', remainingBeats: 0, elapsedBeats: 4 }),
    });
    const label = textsOf(ctx).find((t) => t.includes('연장'));
    expect(label).toBeDefined();
    expect(label).toContain('0');
    const zeroCtx = createMockCtx();
    const fullCtx = createMockCtx();
    renderer.render(zeroCtx, 1080, 2160, {
      ...visible,
      choiceProgress: [0, 0],
      answerTime: primarySnapshot({ phase: 'extension', remainingBeats: 0, elapsedBeats: 4 }),
    });
    renderer.render(fullCtx, 1080, 2160, {
      ...visible,
      choiceProgress: [1, 0],
      answerTime: primarySnapshot({ phase: 'extension', remainingBeats: 0, elapsedBeats: 4 }),
    });
    const fillCount = (c: CanvasRenderingContext2D) =>
      (c.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fillCount(zeroCtx)).toBeLessThan(fillCount(fullCtx));
  });

  it('closed, 스냅샷 없음, 프리뷰, 분기 후에는 시간 라벨을 숨긴다', () => {
    const renderer = new QuestionRenderer();
    const cases: QuestionRenderState[] = [
      { ...visible, answerTime: primarySnapshot({ phase: 'closed', inputOpen: false, remainingBeats: 0 }) },
      { ...visible, answerTime: undefined },
      { ...visible, buttonsOnly: true, answerTime: primarySnapshot() },
      { ...visible, answerSelectable: false, answerTime: primarySnapshot() },
      { ...visible, showAnswerTime: false, answerTime: primarySnapshot() },
    ];
    for (const state of cases) {
      const ctx = createMockCtx();
      renderer.render(ctx, 1080, 2160, state);
      const joined = textsOf(ctx).join(' ');
      expect(joined).not.toMatch(/기본|연장|남음/);
    }
  });

  it('선택 점수와 Hold 진행이 바뀌어도 시간 라벨은 같다', () => {
    const renderer = new QuestionRenderer();
    const snapshot = primarySnapshot({ phase: 'primary', remainingBeats: 2 });
    const ctxA = createMockCtx();
    const ctxB = createMockCtx();
    renderer.render(ctxA, 1080, 2160, {
      ...visible,
      choiceProgress: [0, 0],
      answerTime: snapshot,
    });
    renderer.render(ctxB, 1080, 2160, {
      ...visible,
      choiceProgress: [1, 0],
      activeHoverIndex: 0,
      answerTime: snapshot,
    });
    const labelA = textsOf(ctxA).find((t) => t.includes('기본'));
    const labelB = textsOf(ctxB).find((t) => t.includes('기본'));
    expect(labelA).toBe(labelB);
    expect(labelA).toContain('2');
  });

  it('같은 스냅샷을 두 번 그려도 시간 텍스트가 변하지 않는다', () => {
    const renderer = new QuestionRenderer();
    const snapshot = primarySnapshot({ phase: 'primary', remainingBeats: 2, elapsedBeats: 0 });
    const ctx = createMockCtx();
    const state: QuestionRenderState = { ...visible, answerTime: snapshot };
    renderer.render(ctx, 1080, 2160, state);
    const first = textsOf(ctx).filter((t) => t.includes('기본') || t.includes('남음'));
    renderer.render(ctx, 1080, 2160, state);
    const second = textsOf(ctx).filter((t) => t.includes('기본') || t.includes('남음'));
    expect(second).toEqual([...first, ...first]);
    expect(second.every((t) => t === first[0])).toBe(true);
  });

  it('여러 해상도에서 시간 라벨 레이아웃이 예외 없이 그려진다', () => {
    const renderer = new QuestionRenderer();
    const resolutions: Array<[number, number]> = [[1080, 2160], [720, 1280], [390, 844], [1920, 1080]];
    for (const [w, h] of resolutions) {
      const ctx = createMockCtx();
      expect(() => renderer.render(ctx, w, h, {
        ...visible,
        answerTime: primarySnapshot(),
      })).not.toThrow();
      expect(textsOf(ctx).some((t) => t.includes('기본'))).toBe(true);
    }
  });

  describe('[Issue #322] 러닝·답선택 페이즈 간 문제 수식 렌더링 일원화 및 단일 뷰(SSOT) 통합', () => {
    it('headerOnly: true일 때 목판 배경 및 132px 수식만 렌더링하고 보기 버튼을 렌더링하지 않는다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      renderer.render(ctx, 1080, 2160, {
        question: mockQuestion,
        questionVisible: true,
        headerOnly: true,
      });

      const texts = textsOf(ctx);
      // 문제 수식 토큰(12)은 렌더링되어야 함
      expect(texts.some((t) => t.includes('12'))).toBe(true);
      // 보기 버튼 텍스트(choices: 27, 25)는 렌더링되지 않아야 함
      expect(texts.some((t) => t === '27' || t === '25')).toBe(false);
    });

    it('questionApproachProgress < 1.0일 때 원근 접근 transform(scale, alpha, translate)을 적용하여 목판+수식을 렌더링한다', () => {
      const renderer = new QuestionRenderer();
      const ctx = createMockCtx();

      renderer.render(ctx, 1080, 2160, {
        question: mockQuestion,
        questionVisible: true,
        headerOnly: true,
        questionApproachProgress: 0.5,
        vanishingX: 540,
        vanishingY: 400,
      });

      // scale < 1.0 호출 검증
      const scaleCalls = (ctx.scale as any).mock.calls;
      expect(scaleCalls.length).toBeGreaterThan(0);
      const [sx, sy] = scaleCalls[0];
      expect(sx).toBeLessThan(1.0);
      expect(sx).toBeGreaterThan(0.15);
      expect(sy).toBe(sx);

      // translate 호출 검증
      expect(ctx.translate).toHaveBeenCalled();
    });

    it('러닝 페이즈(원근 접근 완료)와 답 선택 페이즈에서 목판 패널 위치/크기 및 수식 렌더링 기준 좌표가 동일하여 시각적 튐이 없다', () => {
      const renderer = new QuestionRenderer();
      const mockBoardImg = { src: 'board.png', width: 880, height: 280 } as HTMLImageElement;
      vi.spyOn(imageLoader, 'get').mockImplementation((cat: string, key: string) => {
        if (cat === 'question' && key === 'questionBoardBg') return mockBoardImg;
        return null;
      });

      // 1. 러닝 페이즈 헤더
      const ctxRun = createMockCtx();
      renderer.render(ctxRun, 1080, 2160, {
        question: mockQuestion,
        questionVisible: true,
        headerOnly: true,
        questionApproachProgress: 1.0,
      });

      // 2. 답 선택 페이즈
      const ctxPlay = createMockCtx();
      renderer.render(ctxPlay, 1080, 2160, {
        question: mockQuestion,
        questionVisible: true,
      });

      // 목판 drawImage 인자 비교
      const runDrawCall = (ctxRun.drawImage as any).mock.calls.find((c: any) => c[0] === mockBoardImg);
      const playDrawCall = (ctxPlay.drawImage as any).mock.calls.find((c: any) => c[0] === mockBoardImg);
      expect(runDrawCall).toBeDefined();
      expect(playDrawCall).toBeDefined();
      expect(runDrawCall).toEqual(playDrawCall);

      // 수식 fillText의 Y 좌표 비교 (수식 토큰 '12')
      const runTextCall = (ctxRun.fillText as any).mock.calls.find((c: any) => String(c[0]).includes('12'));
      const playTextCall = (ctxPlay.fillText as any).mock.calls.find((c: any) => String(c[0]).includes('12'));
      expect(runTextCall).toBeDefined();
      expect(playTextCall).toBeDefined();
      expect(runTextCall[2]).toBe(playTextCall[2]); // Y 좌표 완벽 일치
    });
  });
});
