import { describe, expect, it, vi } from 'vitest';
import {
  MenuRenderer,
  type MenuState,
  type MenuPresentationContext,
} from '../../src/ui/MenuRenderer.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

function createMockCtx(): CanvasRenderingContext2D {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn(),
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
    fillText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'fillText', args: [text, x, y] })
    ),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    drawImage: vi.fn((img: any, ...args: number[]) =>
      calls.push({ method: 'drawImage', args: [img, ...args] })
    ),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

function createMockImage(src = 'mock.png'): HTMLImageElement {
  return {
    src,
    width: 200,
    height: 200,
    naturalWidth: 200,
    naturalHeight: 200,
    complete: true,
  } as unknown as HTMLImageElement;
}

describe('[Issue #439 / UI-VIS-009] 메인·서브메뉴 공용 표시와 입력 레이아웃', () => {
  const W = 1080;
  const H = 2160;

  const sampleState: MenuState = {
    unlockedChapter: 2,
    stars: { 1: 3, 2: 1 },
    selectedChapter: 1,
    locomotionLabel: '제자리 달리기',
    locomotionIcon: '🏃',
  };

  const sampleSubLevels = [
    { subLevel: 1, title: '1단계 덧셈 기초', count: 10 },
    { subLevel: 2, title: '2단계 뺄셈 기초', count: 10 },
    { subLevel: 3, title: '3단계 혼합 연산', count: 10 },
  ];

  it('1. 기본 인스턴스는 UI_LAYOUT 기준선과 5챕터/서브메뉴 의미를 100% 동일하게 유지한다', () => {
    const renderer = new MenuRenderer();
    expect(renderer.getPresentationContext()).toBeUndefined();

    // 5챕터 카드 레이아웃 검증
    const chapterLayouts = renderer.getChapterLayouts(W, H);
    expect(chapterLayouts).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      const expected = UI_LAYOUT.menu.chapterCards[i];
      expect(chapterLayouts[i].chapter).toBe(expected.chapter);
      expect(chapterLayouts[i].x).toBe(expected.x);
      expect(chapterLayouts[i].y).toBe(expected.y);
      expect(chapterLayouts[i].w).toBe(UI_LAYOUT.menu.cardWidth);
      expect(chapterLayouts[i].h).toBe(UI_LAYOUT.menu.cardHeight);
    }

    // 운동 버튼 레이아웃 검증
    const lBtn = renderer.getLocomotionButtonLayout(W, H);
    expect(lBtn).toEqual(UI_LAYOUT.menu.locomotionBtn);

    // 서브메뉴 레이아웃 검증 (뒤로가기 + 3개 서브레벨 + 전체 = 총 5개)
    const subLayouts = renderer.getSubMenuLayouts(W, H, sampleSubLevels);
    const backLayout = subLayouts.find((s) => s.subLevel === -1)!;
    expect(backLayout).toBeDefined();
    expect(backLayout.x).toBe(UI_LAYOUT.subMenu.backBtn.x);
    expect(backLayout.y).toBe(UI_LAYOUT.subMenu.backBtn.y);

    // 기본 히트테스트 동작
    expect(renderer.hitTest(120 + 20, 460 + 20, W, H)).toBe(1);
    expect(renderer.hitTestLocomotion(UI_LAYOUT.menu.locomotionBtn.x + 10, UI_LAYOUT.menu.locomotionBtn.y + 10, W, H)).toBe(true);
    expect(renderer.hitTestSub(UI_LAYOUT.subMenu.backBtn.x + 10, UI_LAYOUT.subMenu.backBtn.y + 10, W, H, sampleSubLevels)).toBe(-1);
  });

  it('2. Presentation Context 주입 시 챕터 카드 및 운동 버튼 위치/크기가 오버라이드되고 hitTest와 렌더가 일원화된다', () => {
    const customContext: MenuPresentationContext = {
      chapterCards: {
        2: {
          x: 650,
          y: 520,
          w: 390,
          h: 410,
          title: '신비의 별자리 숲',
          subtitle: '신규 곱셈 챌린지',
        },
      },
      locomotionBtn: {
        x: 200,
        y: 400,
        w: 680,
        h: 70,
        label: '트레드밀 런',
      },
    };

    const renderer = new MenuRenderer(customContext);
    expect(renderer.getPresentationContext()).toEqual(customContext);

    // getChapterLayouts 검증
    const layouts = renderer.getChapterLayouts(W, H);
    const ch2 = layouts.find((l) => l.chapter === 2)!;
    expect(ch2.x).toBe(650);
    expect(ch2.y).toBe(520);
    expect(ch2.w).toBe(390);
    expect(ch2.h).toBe(410);

    // Ch.1은 기본값 유지
    const ch1 = layouts.find((l) => l.chapter === 1)!;
    expect(ch1.x).toBe(UI_LAYOUT.menu.chapterCards[0].x);
    expect(ch1.y).toBe(UI_LAYOUT.menu.chapterCards[0].y);

    // hitTest 검증: 오버라이드된 새 위치는 성공, 이전 위치는 실패 (오클릭 0)
    // 새 위치
    expect(renderer.hitTest(650 + 20, 520 + 20, W, H)).toBe(2);
    // 이전 기본 위치: UI_LAYOUT.menu.chapterCards[1].x = 600, y = 460
    // 이전 좌표 (600, 460)은 새 범위 (650~1040, 520~930) 밖이므로 히트 안 됨
    expect(renderer.hitTest(610, 470, W, H)).toBe(0);

    // 운동 버튼 hitTestLocomotion 검증: 새 위치 성공, 이전 위치 실패
    expect(renderer.hitTestLocomotion(200 + 10, 400 + 10, W, H)).toBe(true);
    // 이전 위치 (290, 375, w: 500, h: 56) -> (290, 380)은 y < 400 이므로 실패
    expect(renderer.hitTestLocomotion(290, 380, W, H)).toBe(false);

    // render 호출 시 새 좌표로 그려지는지 확인
    const ctx = createMockCtx();
    renderer.render(ctx, W, H, sampleState);
    const roundRectCalls = (ctx as any).calls.filter((c: any) => c.method === 'roundRect');
    const matchedCh2Call = roundRectCalls.find(
      (c: any) => c.args[0] === 650 && c.args[1] === 520 && c.args[2] === 390 && c.args[3] === 410
    );
    expect(matchedCh2Call).toBeDefined();
  });

  it('3. 서브메뉴 뒤로가기 버튼 및 그리드/슬롯 오버라이드 시 hitTestSub와 일원화되고 이전 위치 오클릭 0건을 보장한다', () => {
    const customContext: MenuPresentationContext = {
      subMenuBackBtn: {
        x: 100,
        y: 1900,
        w: 300,
        h: 120,
        label: '돌아가기',
      },
      subCards: {
        1: {
          x: 100,
          y: 500,
          w: 400,
          h: 350,
          label: '오버라이드 1단계',
        },
      },
    };

    const renderer = new MenuRenderer(customContext);
    const subLayouts = renderer.getSubMenuLayouts(W, H, sampleSubLevels);

    // 뒤로가기(-1) 오버라이드 확인
    const backLayout = subLayouts.find((s) => s.subLevel === -1)!;
    expect(backLayout.x).toBe(100);
    expect(backLayout.y).toBe(1900);
    expect(backLayout.w).toBe(300);
    expect(backLayout.h).toBe(120);

    // 1단계(1) 오버라이드 확인
    const sub1Layout = subLayouts.find((s) => s.subLevel === 1)!;
    expect(sub1Layout.x).toBe(100);
    expect(sub1Layout.y).toBe(500);
    expect(sub1Layout.w).toBe(400);
    expect(sub1Layout.h).toBe(350);

    // hitTestSub: 새 위치 성공
    expect(renderer.hitTestSub(100 + 20, 1900 + 20, W, H, sampleSubLevels)).toBe(-1);
    expect(renderer.hitTestSub(100 + 20, 500 + 20, W, H, sampleSubLevels)).toBe(1);

    // 이전 기본 뒤로가기 위치 (780, 1990)는 오클릭 0건
    expect(renderer.hitTestSub(780 + 20, 1990 + 20, W, H, sampleSubLevels)).not.toBe(-1);
  });

  it('4. 두 개의 독립 MenuRenderer 인스턴스 간 컨텍스트 누출이 0건이어야 한다 (격리성 검증)', () => {
    const contextA: MenuPresentationContext = {
      chapterCards: {
        1: { x: 50, y: 50, w: 200, h: 200 },
      },
    };

    const rendererA = new MenuRenderer(contextA);
    const rendererB = new MenuRenderer(); // default

    const layoutsA = rendererA.getChapterLayouts(W, H);
    const layoutsB = rendererB.getChapterLayouts(W, H);

    // rendererA는 오버라이드 값
    expect(layoutsA[0].x).toBe(50);
    expect(layoutsA[0].y).toBe(50);
    expect(layoutsA[0].w).toBe(200);
    expect(layoutsA[0].h).toBe(200);

    // rendererB는 기본 config 값
    expect(layoutsB[0].x).toBe(UI_LAYOUT.menu.chapterCards[0].x);
    expect(layoutsB[0].y).toBe(UI_LAYOUT.menu.chapterCards[0].y);
    expect(layoutsB[0].w).toBe(UI_LAYOUT.menu.cardWidth);
    expect(layoutsB[0].h).toBe(UI_LAYOUT.menu.cardHeight);

    // 전역 UI_LAYOUT 변형 없음을 확인
    expect(UI_LAYOUT.menu.chapterCards[0].x).toBe(120);
    expect(UI_LAYOUT.menu.chapterCards[0].y).toBe(460);
  });

  it('5. 불변(frozen) Presentation Context 주입을 완벽히 수용하며 객체를 임의로 변형하지 않는다', () => {
    const frozenContext: MenuPresentationContext = Object.freeze({
      title: Object.freeze({
        text: '모험의 서재',
        color: '#FFD700',
      }),
      chapterCards: Object.freeze({
        3: Object.freeze({
          locked: true,
          lockReason: '사전 챕터 2 완료 필요',
        }),
      }),
    });

    const renderer = new MenuRenderer(frozenContext);
    expect(() => renderer.getChapterLayouts(W, H)).not.toThrow();
    expect(() => renderer.render(createMockCtx(), W, H, sampleState)).not.toThrow();

    const ch3 = renderer.getChapterLayouts(W, H).find((l) => l.chapter === 3)!;
    expect(ch3.locked).toBe(true);
    expect(ch3.lockReason).toBe('사전 챕터 2 완료 필요');
  });

  it('6. 잠금 사유(lockReason) 및 커스텀 텍스트/에셋 오버라이드가 렌더 시 정상 반영된다', () => {
    const mockCustomImage = createMockImage('custom-card.png');
    const customContext: MenuPresentationContext = {
      title: {
        text: '커스텀 모험 타이틀',
        color: '#123456',
      },
      chapterCards: {
        1: {
          title: '오버라이드 챕터 1',
          subtitle: '특별 연산 훈련',
          color: '#AABBCC',
          image: mockCustomImage,
        },
        4: {
          locked: true,
          lockReason: '승인 대기 중 슬롯',
        },
      },
    };

    const renderer = new MenuRenderer(customContext);
    const ctx = createMockCtx();
    renderer.render(ctx, W, H, sampleState);

    const fillTextCalls = (ctx as any).calls.filter((c: any) => c.method === 'fillText');
    const textValues = fillTextCalls.map((c: any) => c.args[0]);

    // 타이틀 텍스트 반영
    expect(textValues).toContain('커스텀 모험 타이틀');
    // 챕터 1 오버라이드 텍스트 반영
    expect(textValues).toContain('오버라이드 챕터 1');
    expect(textValues).toContain('특별 연산 훈련');
    // 챕터 4 잠금 사유 반영
    expect(textValues).toContain('승인 대기 중 슬롯');

    // 이미지 반영
    const drawImageCalls = (ctx as any).calls.filter((c: any) => c.method === 'drawImage');
    const hasCustomImage = drawImageCalls.some((c: any) => c.args[0] === mockCustomImage);
    expect(hasCustomImage).toBe(true);
  });

  it('7. UIPresentationDocument 구조를 context에 전달했을 때 레이아웃이 자동 해석된다', () => {
    const doc = createDefaultUIPresentationDocument();
    doc.pages.main_home.elements.push({
      id: 'btn_ch1',
      name: '챕터 1',
      type: 'button',
      bounds: { x: 220, y: 480, width: 340, height: 360 },
      actionId: 'select_chapter_1',
    });

    const renderer = new MenuRenderer({ presentationDocument: doc });
    const layouts = renderer.getChapterLayouts(W, H);
    const ch1 = layouts.find((l) => l.chapter === 1)!;

    expect(ch1.x).toBe(220);
    expect(ch1.y).toBe(480);
    expect(ch1.w).toBe(340);
    expect(ch1.h).toBe(360);
  });

  it('8. setPresentationContext 및 clearPresentationContext로 동적 전환이 정상 작동한다', () => {
    const renderer = new MenuRenderer();
    expect(renderer.getChapterLayouts(W, H)[0].x).toBe(120);

    renderer.setPresentationContext({
      chapterCards: {
        1: { x: 300, y: 300, w: 250, h: 250 },
      },
    });
    expect(renderer.getChapterLayouts(W, H)[0].x).toBe(300);

    renderer.clearPresentationContext();
    expect(renderer.getChapterLayouts(W, H)[0].x).toBe(120);
  });
});
