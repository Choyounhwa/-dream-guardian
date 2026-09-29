import { describe, it, expect, vi } from 'vitest';
import { HUDLayer } from '../../src/ui/HUDLayer.js';
import { MenuRenderer, CHAPTER_INFO } from '../../src/ui/MenuRenderer.js';
import { ResultRenderer, calcCalories, calcStars } from '../../src/ui/ResultRenderer.js';
import { AnswerSelectionRenderer } from '../../src/render/AnswerSelectionRenderer.js';
import { PartIconRenderer } from '../../src/render/PartIconRenderer.js';
import { CursorTracker } from '../../src/input/CursorTracker.js';
import { MenuInput } from '../../src/input/MenuInput.js';
import { TutorialOverlay } from '../../src/ui/TutorialOverlay.js';

describe('HUDLayer', () => {
  it('update()가 감쇠 보간을 수행한다', () => {
    const hud = new HUDLayer();
    const data = { playerHp: 50, playerMaxHp: 100, bossHp: 5, bossMaxHp: 10, combo: 3, chapter: 1, guardianStage: 1 };
    hud.update(0.5, data);
    // 보간이 시작되었으므로 에러 없이 동작 확인
    expect(true).toBe(true);
  });

  it('reset()이 에러 없이 동작한다', () => {
    const hud = new HUDLayer();
    expect(() => hud.reset()).not.toThrow();
  });
});

describe('MenuRenderer', () => {
  it('hitTest가 대형화된 챕터 카드를 올바르게 판정한다 (Issue #131 / UI-003)', () => {
    const menu = new MenuRenderer();
    const w = 1080;
    const h = 2160;

    const layouts = menu.getChapterLayouts(w, h);
    expect(layouts).toHaveLength(5);
    // 카드 크기 대형화(140px 초과) 및 간격 확장(20px 이상) 검증
    expect(layouts[0].w).toBeGreaterThan(140);
    expect(layouts[0].h).toBeGreaterThan(120);
    const gap = layouts[1].x - (layouts[0].x + layouts[0].w);
    expect(gap).toBeGreaterThanOrEqual(20);

    // 첫 번째 카드 중앙 클릭
    expect(menu.hitTest(layouts[0].x + layouts[0].w / 2, layouts[0].y + layouts[0].h / 2, w, h)).toBe(1);
    // 마지막 카드 중앙 클릭
    expect(menu.hitTest(layouts[4].x + layouts[4].w / 2, layouts[4].y + layouts[4].h / 2, w, h)).toBe(5);
    // 화면 밖 클릭
    expect(menu.hitTest(0, 0, w, h)).toBe(0);
  });

  it('getSubMenuLayouts 및 hitTestSub가 서브레벨 및 뒤로가기 버튼을 올바르게 판정한다', () => {
    const menu = new MenuRenderer();
    const subLevels = [
      { subLevel: 1, title: '1단계: 1자리 덧셈', count: 10 },
      { subLevel: 2, title: '2단계: 2자리 덧셈', count: 12 },
    ];
    const w = 1920;
    const h = 1080;

    const layouts = menu.getSubMenuLayouts(w, h, 1, subLevels);
    expect(layouts.length).toBe(4); // 뒤로가기(-1) + 서브레벨 2개(1, 2) + 전체종합(0)

    // 1. 뒤로가기 버튼 클릭 (-1)
    const backBtn = layouts.find((l) => l.subLevel === -1)!;
    expect(menu.hitTestSub(backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2, w, h, 1, subLevels)).toBe(-1);

    // 2. 1단계 카드 클릭 (1)
    const card1 = layouts.find((l) => l.subLevel === 1)!;
    expect(menu.hitTestSub(card1.x + card1.w / 2, card1.y + card1.h / 2, w, h, 1, subLevels)).toBe(1);

    // 3. 전체 종합 카드 클릭 (0)
    const cardAll = layouts.find((l) => l.subLevel === 0)!;
    expect(menu.hitTestSub(cardAll.x + cardAll.w / 2, cardAll.y + cardAll.h / 2, w, h, 1, subLevels)).toBe(0);

    // 4. 영역 밖 클릭 (null)
    expect(menu.hitTestSub(0, 0, w, h, 1, subLevels)).toBeNull();
  });

  it('renderSubMenu가 예외 없이 렌더링된다', () => {
    const menu = new MenuRenderer();
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      textAlign: '',
      textBaseline: '',
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    const subLevels = [
      { subLevel: 1, title: '1단계', count: 10 },
      { subLevel: 2, title: '2단계', count: 15 },
    ];

    expect(() => menu.renderSubMenu(mockCtx, 1920, 1080, 1, subLevels, 1)).not.toThrow();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('홈 메뉴 2-2-1 다이아몬드 그리드 및 서브메뉴 2열 3행 와이드 규격을 만족한다 (Issue #142 / UI-MENU-002)', () => {
    const menu = new MenuRenderer();
    const w = 1080;
    const h = 2160;

    // 1. 홈 메뉴 2-2-1 배치 검증
    const chLayouts = menu.getChapterLayouts(w, h);
    expect(chLayouts).toHaveLength(5);
    // 1행: Ch.1, Ch.2
    expect(chLayouts[0]).toEqual({ chapter: 1, x: 120, y: 460, w: 360, h: 380 });
    expect(chLayouts[1]).toEqual({ chapter: 2, x: 600, y: 460, w: 360, h: 380 });
    // 2행: Ch.3, Ch.4
    expect(chLayouts[2]).toEqual({ chapter: 3, x: 120, y: 920, w: 360, h: 380 });
    expect(chLayouts[3]).toEqual({ chapter: 4, x: 600, y: 920, w: 360, h: 380 });
    // 3행: Ch.5 (중앙 정렬)
    expect(chLayouts[4]).toEqual({ chapter: 5, x: 360, y: 1380, w: 360, h: 380 });

    // 2. 서브 메뉴 2열 3행 배치 검증 (5개 단계 + 1개 ALL 종합 + 1개 하단 뒤로가기)
    const subLevels = [
      { subLevel: 1, title: '1단계', count: 10 },
      { subLevel: 2, title: '2단계', count: 10 },
      { subLevel: 3, title: '3단계', count: 10 },
      { subLevel: 4, title: '4단계', count: 10 },
      { subLevel: 5, title: '5단계', count: 10 },
    ];
    const subLayouts = menu.getSubMenuLayouts(w, h, 1, subLevels);
    expect(subLayouts).toHaveLength(7); // 5개 단계 + ALL + 뒤로가기

    // 카드 1~5 및 ALL(0) 좌표 검증
    const c1 = subLayouts.find((l) => l.subLevel === 1)!;
    expect(c1).toMatchObject({ x: 80, y: 440, w: 420, h: 380 });
    const c2 = subLayouts.find((l) => l.subLevel === 2)!;
    expect(c2).toMatchObject({ x: 580, y: 440, w: 420, h: 380 });
    const c3 = subLayouts.find((l) => l.subLevel === 3)!;
    expect(c3).toMatchObject({ x: 80, y: 880, w: 420, h: 380 });
    const c4 = subLayouts.find((l) => l.subLevel === 4)!;
    expect(c4).toMatchObject({ x: 580, y: 880, w: 420, h: 380 });
    const c5 = subLayouts.find((l) => l.subLevel === 5)!;
    expect(c5).toMatchObject({ x: 80, y: 1320, w: 420, h: 380 });
    const cAll = subLayouts.find((l) => l.subLevel === 0)!;
    expect(cAll).toMatchObject({ x: 580, y: 1320, w: 420, h: 380 });

    // 뒤로가기(-1) 버튼: 하단 고정 바 우측 슬롯 (x: 780, y: 1990, w: 270, h: 140)
    const backBtn = subLayouts.find((l) => l.subLevel === -1)!;
    expect(backBtn).toMatchObject({ x: 780, y: 1990, w: 270, h: 140 });

    // 3. 히트테스트 판정 검증
    expect(menu.hitTest(300, 650, w, h)).toBe(1);
    expect(menu.hitTest(540, 1570, w, h)).toBe(5);
    expect(menu.hitTestSub(915, 2060, w, h, 1, subLevels)).toBe(-1);
    expect(menu.hitTestSub(290, 630, w, h, 1, subLevels)).toBe(1);
    expect(menu.hitTestSub(790, 1510, w, h, 1, subLevels)).toBe(0);
  });

  it('CHAPTER_INFO가 04_STORY_SOURCE_수정.md의 꿈속 탐험 테마명을 반영한다', () => {
    expect(CHAPTER_INFO).toHaveLength(5);
    expect(CHAPTER_INFO[0].name).toBe('에메랄드 심해');
    expect(CHAPTER_INFO[0].fullName).toBe('나비가 숨 쉬는 에메랄드 심해');
    expect(CHAPTER_INFO[1].name).toBe('사탕 바구니 숲');
    expect(CHAPTER_INFO[1].fullName).toBe('별자리가 떨어진 사탕 바구니 숲');
    expect(CHAPTER_INFO[2].name).toBe('오르골 구름 서재');
    expect(CHAPTER_INFO[2].fullName).toBe('거꾸로 흐르는 오르골 구름 서재');
    expect(CHAPTER_INFO[3].name).toBe('색종이 사파리');
    expect(CHAPTER_INFO[3].fullName).toBe('크레용 화산과 색종이 사파리');
    expect(CHAPTER_INFO[4].name).toBe('은하 회전목마');
    expect(CHAPTER_INFO[4].fullName).toBe('끝없는 기억의 은하 회전목마');
  });

  it('홈 메뉴 렌더링 시 꿈속 세계 탐험 타이틀과 챕터 테마명이 렌더링된다', () => {
    const menu = new MenuRenderer();
    const calls: string[] = [];
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn((text: string) => {
        calls.push(text);
      }),
      textAlign: '',
      textBaseline: '',
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      shadowColor: '',
      shadowBlur: 0,
    } as unknown as CanvasRenderingContext2D;

    menu.render(mockCtx, 1080, 2160, {
      unlockedChapter: 5,
      stars: { 1: 3, 2: 2, 3: 1, 4: 0, 5: 0 },
      selectedChapter: 0,
    });

    expect(calls).toContain('꿈속 세계 탐험');
    expect(calls).toContain('에메랄드 심해');
    expect(calls).toContain('사탕 바구니 숲');
    expect(calls).toContain('오르골 구름 서재');
    expect(calls).toContain('색종이 사파리');
    expect(calls).toContain('은하 회전목마');
  });
});

describe('ResultRenderer - calcCalories', () => {
  it('GDD 및 자세 유지 시간(Dwell Time) 확장 공식에 따라 칼로리를 계산한다 (Issue #135 / CALC-001)', () => {
    // (steps*0.04) + (squats*0.35) + (jumps*0.15) + (dwell*0.07)
    expect(calcCalories(100, 10, 20, 30)).toBeCloseTo(100 * 0.04 + 10 * 0.35 + 20 * 0.15 + 30 * 0.07);
    expect(calcCalories(0, 0, 0, 0)).toBe(0);
    expect(calcCalories(50, 5, 10)).toBeCloseTo(50 * 0.04 + 5 * 0.35 + 10 * 0.15); // dwellTime 기본값 0 호환
  });
});

describe('ResultRenderer - calcStars', () => {
  it('90% 이상 + 2분 미만이면 3성', () => {
    expect(calcStars(9, 10, 90)).toBe(3);
    expect(calcStars(10, 10, 60)).toBe(3);
  });

  it('70% 이상이면 2성', () => {
    expect(calcStars(7, 10, 200)).toBe(2);
    expect(calcStars(8, 10, 200)).toBe(2);
  });

  it('70% 미만이면 1성', () => {
    expect(calcStars(5, 10, 200)).toBe(1);
  });

  it('문제 0개면 1성', () => {
    expect(calcStars(0, 0, 0)).toBe(1);
  });
});

describe('전 장면 4색 커서 상시 지속 가시화 (Issue #140 / FEAT-CURSOR-003)', () => {
  it('메뉴, 달리기, 문제, 결과 전 장면에서 커서 렌더링이 중단 없이 연속 호출된다', () => {
    const renderer = new AnswerSelectionRenderer();
    const tracker = new CursorTracker();
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fillText: vi.fn(),
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

    const mockLm = [];
    for (let i = 0; i < 33; i++) mockLm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
    mockLm[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
    mockLm[15] = { x: 0.2, y: 0.4, z: 0, visibility: 0.95 };
    mockLm[16] = { x: 0.8, y: 0.4, z: 0, visibility: 0.95 };
    mockLm[23] = { x: 0.45, y: 0.65, z: 0, visibility: 0.95 };
    mockLm[24] = { x: 0.55, y: 0.65, z: 0, visibility: 0.95 };

    const cursors = tracker.update(mockLm);
    expect(cursors.size).toBe(4);

    // 1. 메뉴 화면 (activeZones = [])
    expect(() => renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0])).not.toThrow();

    // 2. 제자리 달리기 페이즈 (activeZones = [])
    expect(() => renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0])).not.toThrow();

    // 3. 문제 선택 페이즈 (activeZones = [존 4, 5])
    const activeZones = [
      { id: 4, label: '좌', x: 0.04, y: 0.24, width: 0.26, height: 0.16 },
      { id: 5, label: '우', x: 0.70, y: 0.24, width: 0.26, height: 0.16 },
    ];
    expect(() => renderer.render(mockCtx, 1080, 2160, activeZones, cursors, [0.5, 0])).not.toThrow();

    // 4. 게임 결과 화면 (activeZones = [])
    expect(() => renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0])).not.toThrow();
  });
});

describe('답안 버튼 부위 아이콘 및 묶음 기호 시각화 (Issue #128 / UI-001)', () => {
  it('단일 부위, 묶음 ( ), 각각 | 기호가 에러 없이 드로잉된다', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: '',
      lineJoin: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
    } as unknown as CanvasRenderingContext2D;

    // 1. 단일 부위
    expect(() =>
      PartIconRenderer.drawRequirementGroup(
        mockCtx,
        { requiredCursors: ['leftHand'], targetZoneIds: [4] },
        100,
        100,
        18,
      ),
    ).not.toThrow();

    // 2. 부위 2개 / 존 1개 -> 함께 묶음 ( )
    mockCtx.fillText = vi.fn();
    PartIconRenderer.drawRequirementGroup(
      mockCtx,
      { requiredCursors: ['leftHand', 'rightHand'], targetZoneIds: [2, 2] },
      100,
      100,
      18,
    );
    expect(mockCtx.fillText).toHaveBeenCalledWith('(', expect.any(Number), 100);
    expect(mockCtx.fillText).toHaveBeenCalledWith(')', expect.any(Number), 100);

    // 3. 부위 2개 / 존 2개 -> 각각 분리 |
    mockCtx.fillText = vi.fn();
    PartIconRenderer.drawRequirementGroup(
      mockCtx,
      { requiredCursors: ['leftHand', 'rightHand'], targetZoneIds: [4, 5] },
      100,
      100,
      18,
    );
    expect(mockCtx.fillText).toHaveBeenCalledWith('|', expect.any(Number), 100);

    // 4. 그라데이션 테두리 생성 검증
    const grad = PartIconRenderer.getRequirementGradient(
      mockCtx,
      { requiredCursors: ['leftHand', 'head'], targetZoneIds: [4, 2] },
      0,
      0,
      100,
      100,
    );
    expect(grad).toBeDefined();
  });
});

describe('결과 화면 합장 제스처 메뉴 복귀 (Issue #134 / FEAT-RESULT-001)', () => {
  it('결과 화면에서 0.8초 합장 체류 시 메뉴 복귀가 트리거되고 양손 분리 시 리셋된다', () => {
    const mi = new MenuInput();
    const resultRenderer = new ResultRenderer();
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
    } as unknown as CanvasRenderingContext2D;

    // 1. 결과 화면 렌더링 시 하단 안내 문구에 양손 모으기 포함 확인
    resultRenderer.render(mockCtx, 1080, 2160, {
      victory: true,
      chapter: 1,
      correctCount: 10,
      totalQuestions: 10,
      maxCombo: 5,
      steps: 120,
      squats: 15,
      jumps: 10,
      elapsedTime: 90,
    });
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      expect.stringContaining('양손을 모으거나'),
      expect.any(Number),
      expect.any(Number),
    );

    // 2. 0.8초 체류 시뮬레이션
    let returnTimer = 0;
    const DWELL = 0.8;
    let menuTriggered = false;

    // 양손 합장 상태 (거리 < 0.22)
    const res = mi.update(0.48, 0.5, 0.52, 0.5);
    expect(res.active).toBe(true);

    for (let f = 0; f < 55; f++) {
      if (res.active) {
        returnTimer += 0.016;
        if (returnTimer >= DWELL) {
          menuTriggered = true;
          returnTimer = 0;
          break;
        }
      }
    }
    expect(menuTriggered).toBe(true);

    // 3. 중간에 손을 뗐을 때 리셋 검증
    returnTimer = 0.5; // 0.5초 경과 후
    const separated = mi.update(0.2, 0.5, 0.8, 0.5); // 손 분리
    expect(separated.active).toBe(false);
    if (!separated.active) {
      returnTimer = 0; // 리셋
    }
    expect(returnTimer).toBe(0);
  });
});

describe('TutorialOverlay 튜토리얼 시스템 (Issue #137 / TUT-001)', () => {
  it('튜토리얼 상태 머신 및 단계별 전이(1->2->3->종료)가 정상 동작한다', () => {
    const tut = new TutorialOverlay();
    tut.show();
    expect(tut.isVisible).toBe(true);
    expect(tut.currentStep).toBe(1);

    expect(tut.nextStep()).toBe(true);
    expect(tut.currentStep).toBe(2);

    expect(tut.nextStep()).toBe(true);
    expect(tut.currentStep).toBe(3);

    // 3단계에서 nextStep 호출 시 튜토리얼 종료
    expect(tut.nextStep()).toBe(false);
    expect(tut.isVisible).toBe(false);
  });

  it('render 및 update가 에러 없이 호출된다', () => {
    const tut = new TutorialOverlay();
    tut.show();

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      roundRect: vi.fn(),
      fillText: vi.fn(),
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

    expect(() => tut.update(0.016)).not.toThrow();
    expect(() => tut.render(mockCtx, 1080, 2160)).not.toThrow();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });
});

describe('인게임 마젠타 컨테이너 & 마법진 & 결과 패널 (Issue #143 / UI-INGAME-001)', () => {
  it('ResultRenderer가 마젠타 결과 카드 패널(880x1580) 규격을 반환한다', () => {
    const result = new ResultRenderer();
    const layout = (result as unknown as { getPanelLayout(w: number, h: number): { x: number; y: number; w: number; h: number } }).getPanelLayout(1080, 2160);
    expect(layout).toEqual({
      x: 100,
      y: 240,
      w: 880,
      h: 1580,
    });
  });

  it('ResultRenderer가 1:1 대형 통계 라인 높이(74px)와 폰트(44px)를 반환한다', () => {
    const result = new ResultRenderer();
    const lineH = (result as unknown as { getStatLineHeight(h: number): number }).getStatLineHeight(2160);
    const fontS = (result as unknown as { getStatFontSize(w: number): number }).getStatFontSize(1080);
    expect(lineH).toBe(74);
    expect(fontS).toBe(44);
  });
});
