import { describe, expect, it, vi } from 'vitest';
import {
  ResultRenderer,
  DEFAULT_RESULT_FIXTURE_DATA,
  type ResultData,
  type ResultPresentationContext,
  type ResultRendererFixtureDTO,
} from '../../src/ui/ResultRenderer.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

function createMockCtx(): CanvasRenderingContext2D {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] })
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] })
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] })
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] })
    ),
    clearRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'clearRect', args: [x, y, w, h] })
    ),
    fillText: vi.fn((text: string, x: number, y: number, maxW?: number) =>
      calls.push({ method: 'fillText', args: [text, x, y, maxW] })
    ),
    strokeText: vi.fn((text: string, x: number, y: number, maxW?: number) =>
      calls.push({ method: 'strokeText', args: [text, x, y, maxW] })
    ),
    drawImage: vi.fn((...args: unknown[]) => calls.push({ method: 'drawImage', args })),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((x: number, y: number) => calls.push({ method: 'scale', args: [x, y] })),
    rotate: vi.fn((angle: number) => calls.push({ method: 'rotate', args: [angle] })),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('[Issue #443 / UI-VIS-013] 결과 화면 표시 context와 통계 분리', () => {
  const W = 1080;
  const H = 2160;

  describe('1. 선택적 표시 컨텍스트(ResultPresentationContext) 주입 및 bounds 조회', () => {
    it('기본 상태에서 getPanelBounds는 UI_LAYOUT.result.panel과 일치한다', () => {
      const renderer = new ResultRenderer();
      const bounds = renderer.getPanelBounds(W, H);

      expect(bounds.x).toBe(UI_LAYOUT.result.panel.x);
      expect(bounds.y).toBe(UI_LAYOUT.result.panel.y);
      expect(bounds.w).toBe(UI_LAYOUT.result.panel.w);
      expect(bounds.h).toBe(UI_LAYOUT.result.panel.h);

      // getPanelLayout과의 호환성
      expect(renderer.getPanelLayout(W, H)).toEqual(bounds);
    });

    it('각 영역별 bounds 조회 메서드가 기본 해상도에서 올바른 위치를 반환한다', () => {
      const renderer = new ResultRenderer();
      const titleBounds = renderer.getTitleBounds(W, H);
      const chapterBounds = renderer.getChapterTitleBounds(W, H);
      const gradeBounds = renderer.getGradeBounds(W, H);
      const rankStampBounds = renderer.getRankStampBounds(W, H);
      const statsBounds = renderer.getStatsBounds(W, H);
      const statLine0 = renderer.getStatLineBounds(0, W, H);
      const bottomPrompt = renderer.getBottomPromptBounds(W, H);

      expect(titleBounds.w).toBe(600);
      expect(titleBounds.h).toBe(160);
      expect(chapterBounds.w).toBeGreaterThan(0);
      expect(gradeBounds.w).toBe(54 * 3);
      expect(rankStampBounds.w).toBe(180);
      expect(rankStampBounds.h).toBe(180);
      expect(statsBounds.w).toBe(UI_LAYOUT.result.panel.w - 120);
      expect(statLine0.y).toBe(statsBounds.y);
      expect(bottomPrompt.y).toBeGreaterThan(statsBounds.y + statsBounds.h);
    });

    it('setPresentationContext로 패널 및 하위 영역의 bounds 오버라이드가 반영된다', () => {
      const renderer = new ResultRenderer();
      const customContext: ResultPresentationContext = {
        panel: { x: 50, y: 150, w: 980, h: 1800 },
        title: { x: 200, y: 220, w: 680, h: 140 },
        grade: { x: 300, y: 400, w: 480, h: 80 },
        rankStamp: { x: 750, y: 200, w: 200, h: 200 },
        stats: { x: 120, y: 550, w: 840, h: 700, lineHeight: 85, fontSize: 48 },
        bottomPrompt: { x: 100, y: 1850, w: 880, h: 60, text: '[ 화면을 터치하세요 ]' },
      };

      renderer.setPresentationContext(customContext);
      expect(renderer.getPresentationContext()).toEqual(customContext);

      const panelBounds = renderer.getPanelBounds(W, H);
      expect(panelBounds).toEqual({ x: 50, y: 150, w: 980, h: 1800 });

      const titleBounds = renderer.getTitleBounds(W, H);
      expect(titleBounds).toEqual({ x: 200, y: 220, w: 680, h: 140 });

      const gradeBounds = renderer.getGradeBounds(W, H);
      expect(gradeBounds).toEqual({ x: 300, y: 400, w: 480, h: 80 });

      const rankBounds = renderer.getRankStampBounds(W, H);
      expect(rankBounds).toEqual({ x: 750, y: 200, w: 200, h: 200 });

      const statsBounds = renderer.getStatsBounds(W, H);
      expect(statsBounds).toEqual({ x: 120, y: 550, w: 840, h: 700 });

      const statLine1 = renderer.getStatLineBounds(1, W, H);
      expect(statLine1.y).toBe(550 + 85);

      const promptBounds = renderer.getBottomPromptBounds(W, H);
      expect(promptBounds).toEqual({ x: 100, y: 1850, w: 880, h: 60 });
    });

    it('clearPresentationContext 호출 시 기본 bounds로 복원된다', () => {
      const renderer = new ResultRenderer({
        panel: { x: 20, y: 30, w: 500, h: 600 },
      });
      expect(renderer.getPanelBounds(W, H).x).toBe(20);

      renderer.clearPresentationContext();
      expect(renderer.getPresentationContext()).toBeUndefined();
      expect(renderer.getPanelBounds(W, H).x).toBe(UI_LAYOUT.result.panel.x);
    });

    it('ResultRenderer.fromPresentationDocument로 UIPresentationDocument의 result 페이지 정보를 파싱한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const parsedContext = ResultRenderer.fromPresentationDocument(doc, 'result');

      expect(parsedContext.presentationDocument).toBe(doc);
      expect(parsedContext.pageId).toBe('result');
      expect(parsedContext.title).toBeDefined();
      expect(parsedContext.title?.text).toBe('스테이지 완료!');
    });
  });

  describe('2. 통계/보상/저장 계산과 순수 렌더의 분리', () => {
    it('ResultData는 순수 읽기 전용으로 유지되며 render 호출 후 원본이 수정되지 않는다', () => {
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();

      const immutableData: ResultData = Object.freeze({
        victory: true,
        chapter: 1,
        correctCount: 10,
        totalQuestions: 10,
        maxCombo: 10,
        steps: 300,
        squats: 20,
        jumps: 10,
        elapsedTime: 80,
        dwellTime: 15,
        locomotionMode: 'run',
      });

      // freeze된 객체 전달 시 속성 추가나 수정 시도가 있다면 에러 발생
      expect(() => {
        renderer.render(ctx, W, H, immutableData);
      }).not.toThrow();

      // 원본 데이터가 여전히 동일함을 보장
      expect(immutableData.correctCount).toBe(10);
      expect(immutableData.steps).toBe(300);
    });

    it('렌더링 중 외부 저장소(localStorage, sessionStorage)나 전역 저장을 호출하지 않는다', () => {
      let storageCalled = false;
      if (typeof globalThis.localStorage !== 'undefined') {
        vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
          storageCalled = true;
        });
      }
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();

      renderer.render(ctx, W, H, {
        victory: true,
        chapter: 1,
        correctCount: 10,
        totalQuestions: 10,
        maxCombo: 10,
        steps: 250,
        squats: 15,
        jumps: 8,
        elapsedTime: 75,
      });

      expect(storageCalled).toBe(false);
    });

    it('사전 계산된 통계(calories, stars, rank)가 제공되면 렌더러가 이를 직접 사용하여 렌더링한다', () => {
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();

      const customPrecomputedData: ResultData = {
        victory: true,
        chapter: 2,
        correctCount: 2,
        totalQuestions: 10,
        maxCombo: 1,
        steps: 50,
        squats: 2,
        jumps: 1,
        elapsedTime: 300,
        // 기존 계산식 기준으로는 C / 1성 / 10kcal 미만이지만, 외부에서 명시 전달된 통계
        calories: 999,
        stars: 3,
        rank: 'S',
      };

      renderer.render(ctx, W, H, customPrecomputedData);

      const textCalls = (ctx.fillText as any).mock.calls.map((call: unknown[]) => call[0]);
      // S 랭크 스탬프 텍스트 확인
      expect(textCalls).toContain('S');
      // 999 kcal 텍스트 확인
      expect(textCalls.some((t: string) => typeof t === 'string' && t.includes('999') && t.includes('kcal'))).toBe(true);
      // 3성 별점 텍스트 확인 (★★★)
      expect(textCalls.some((t: string) => typeof t === 'string' && t.includes('★★★'))).toBe(true);
    });

    it('승리 및 패배, 다양한 랭크(S, A, B, C) fixture에서 안정적으로 렌더링된다', () => {
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();

      const ranks = ['S', 'A', 'B', 'C'] as const;
      for (const rank of ranks) {
        expect(() => {
          renderer.render(ctx, W, H, {
            ...DEFAULT_RESULT_FIXTURE_DATA,
            victory: rank !== 'C',
            rank,
          });
        }).not.toThrow();
      }
    });

    it('극단적인 긴 챕터명/보스명 및 0값 fixture에서도 오류 없이 동일 진입점으로 렌더링된다', () => {
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();

      // 0값 fixture
      const zeroData: ResultData = {
        victory: false,
        chapter: 99,
        correctCount: 0,
        totalQuestions: 0,
        maxCombo: 0,
        steps: 0,
        squats: 0,
        jumps: 0,
        elapsedTime: 0,
      };

      expect(() => {
        renderer.render(ctx, W, H, zeroData);
      }).not.toThrow();

      const textCalls = (ctx.fillText as any).mock.calls.map((call: unknown[]) => call[0]);
      // 0% 표시 정상 (NaN 방지)
      expect(textCalls.some((t: string) => typeof t === 'string' && t.includes('0%'))).toBe(true);
      expect(textCalls.some((t: string) => typeof t === 'string' && t.includes('NaN'))).toBe(false);

      // 긴 텍스트 오버라이드
      renderer.setPresentationContext({
        chapterTitle: { text: 'Ch.999 전설의 심연 속 절대 악마의 거대한 수호 보스 드림 나이트메어 익스트림' },
      });

      expect(() => {
        renderer.render(ctx, W, H, zeroData);
      }).not.toThrow();
    });
  });

  describe('3. 결정적 Fixture DTO 렌더 진입점 (renderFixture)', () => {
    it('인스턴스 renderFixture 호출 시 지정된 DTO 값으로 렌더되고 완료 후 인스턴스 상태가 복원된다', () => {
      const renderer = new ResultRenderer();
      renderer.resetAnimation(0.2); // animTime = 0.2
      const initialAnim = renderer.animTime;

      const ctx = createMockCtx();
      const dto: ResultRendererFixtureDTO = {
        animTime: 10.0,
        presentationContext: {
          panel: { x: 80, y: 160, w: 900, h: 1600 },
        },
        resultData: {
          victory: false,
          chapter: 3,
        },
      };

      renderer.renderFixture(ctx, W, H, dto);

      // 호출 완료 후 인스턴스의 animTime은 원래 값(0.2)으로 복원되어야 함
      expect(renderer.animTime).toBe(initialAnim);
      // context도 원래 상태(undefined)로 복원되어야 함
      expect(renderer.getPresentationContext()).toBeUndefined();
    });

    it('정적 ResultRenderer.renderFixture로 인스턴스 생성 없이 직접 렌더링 가능하다', () => {
      const ctx = createMockCtx();
      expect(() => {
        ResultRenderer.renderFixture(ctx, W, H, {
          resultData: { victory: true, chapter: 1 },
        });
      }).not.toThrow();

      expect((ctx as any).calls.length).toBeGreaterThan(0);
    });
  });

  describe('4. 기존 애니메이션과 입력 계약 보존', () => {
    it('애니메이션 타이밍 상수 및 페이드 알파/오프셋 계산 로직이 온전하게 유지된다', () => {
      const renderer = new ResultRenderer();

      expect(renderer.slideDuration).toBe(0.5);
      expect(renderer.statStaggerDelay).toBe(0.08);
      expect(renderer.statFadeDuration).toBe(0.15);

      renderer.resetAnimation(0);
      expect(renderer.isPanelSettled).toBe(false);
      expect(renderer.getSlideOffsetY(H)).toBeGreaterThan(0);
      expect(renderer.getStatLineAlpha(0)).toBe(0);

      renderer.resetAnimation(10.0);
      expect(renderer.isPanelSettled).toBe(true);
      expect(renderer.getSlideOffsetY(H)).toBe(0);
      expect(renderer.getStatLineAlpha(0)).toBe(1);
    });

    it('하단 문구 및 제스처 계약을 유지하며 렌더러 내부에 가짜 confirm 액션 핸들러를 임의 등록하지 않는다', () => {
      const renderer = new ResultRenderer();
      const ctx = createMockCtx();

      renderer.render(ctx, W, H, DEFAULT_RESULT_FIXTURE_DATA);

      const textCalls = (ctx.fillText as any).mock.calls.map((call: unknown[]) => call[0]);
      expect(textCalls).toContain('양손을 모으거나 하단 [메뉴로] 버튼을 클릭하세요');

      // ResultRenderer는 순수 뷰 렌더러이며 action dispatcher나 임의 click 핸들러를 갖지 않음
      expect((renderer as any).handleClick).toBeUndefined();
      expect((renderer as any).dispatchAction).toBeUndefined();
    });
  });
});
