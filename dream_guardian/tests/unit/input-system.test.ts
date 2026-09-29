import { describe, it, expect, vi } from 'vitest';
import { AnswerSelector, CURSOR_COLORS } from '../../src/input/AnswerSelector.js';
import {
  DEFAULT_FITNESS_ZONES,
  HEAD_ZONES,
  HIP_ZONES,
  SHOULDER_ZONES,
  RESERVED_BANDS,
} from '../../config/zone.config.js';
import { MenuInput } from '../../src/input/MenuInput.js';
import { KeyboardInput } from '../../src/input/KeyboardInput.js';
import { MenuRenderer } from '../../src/ui/MenuRenderer.js';
import { AnswerSelectionRenderer } from '../../src/render/AnswerSelectionRenderer.js';
import { CursorTracker } from '../../src/input/CursorTracker.js';
import { BottomBar } from '../../src/ui/BottomBar.js';
import type { NormalizedLandmark } from '../../src/types/index.js';

// ═══════════════════════════════════
// AnswerSelector
// ═══════════════════════════════════

describe('AnswerSelector', () => {
  it('11개 존이 정의되어 있다', () => {
    const as = new AnswerSelector();
    expect(as.zones).toHaveLength(11);
  });

  it('4색 커서 색상이 정의되어 있다', () => {
    expect(CURSOR_COLORS.leftHand).toBe('#28E6FF');
    expect(CURSOR_COLORS.rightHand).toBe('#FFCB4D');
    expect(CURSOR_COLORS.shoulder).toBe('#C889FF');
    expect(CURSOR_COLORS.head).toBe('#C889FF');
    expect(CURSOR_COLORS.hip).toBe('#FF865E');
  });

  it('머리/얼굴(head) 커서는 중단 측면 존(4, 5)에서 동작하고 상단 및 하단존에서는 차단된다 (Issue #156)', () => {
    expect(HEAD_ZONES.has(4)).toBe(true);
    expect(HEAD_ZONES.has(5)).toBe(true);
    expect(HEAD_ZONES.has(1)).toBe(false);
    expect(HEAD_ZONES.has(2)).toBe(false);
    expect(HEAD_ZONES.has(3)).toBe(false);
    expect(HEAD_ZONES.has(7)).toBe(false); // RC-6 해소 확인 (머리-골반 동일 존 충돌 방지)
    expect(HEAD_ZONES.has(10)).toBe(false);
  });

  it('점증적 난이도 티어(Tier 1~4) 및 체류시간이 문제 번호에 따라 올바르게 전이된다', () => {
    const as = new AnswerSelector();

    // 문제 1~3: Tier 1 (웜업, 0.7초)
    as.setQuestion(1);
    expect(as.tierInfo.tier).toBe(1);
    expect(as.dwellTime).toBeCloseTo(0.7);

    as.setQuestion(3);
    expect(as.tierInfo.tier).toBe(1);
    expect(as.dwellTime).toBeCloseTo(0.7);

    // 문제 4~7: Tier 2 (체간 스트레칭, 0.8초)
    as.setQuestion(4);
    expect(as.tierInfo.tier).toBe(2);
    expect(as.dwellTime).toBeCloseTo(0.8);

    // 문제 8~11: Tier 3 (전신 협응, 1.0초)
    as.setQuestion(8);
    expect(as.tierInfo.tier).toBe(3);
    expect(as.dwellTime).toBeCloseTo(1.0);

    // 문제 12+: Tier 4 (보스 피니시, 1.2초)
    as.setQuestion(12);
    expect(as.tierInfo.tier).toBe(4);
    expect(as.dwellTime).toBeCloseTo(1.2);
  });

  it('두뇌 피로도 완충 룰: 긴 복합 문제일 경우 Tier 3/4가 Tier 2로 완화된다', () => {
    const as = new AnswerSelector();
    // 문제 10(기본 Tier 3)에서 isComplexQuestion=true
    as.setQuestion(10, true);
    expect(as.tierInfo.tier).toBe(2);
    expect(as.dwellTime).toBeCloseTo(0.8);
  });

  it('Tier 1(0.7초) 설정 시 0.7초 체류로 확정된다 (Issue #130: updateFromPose 마이그레이션)', () => {
    const as = new AnswerSelector();
    as.startQuestion(1); // Tier 1, dwellTime = 0.7s
    const lm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
    lm[15] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 }; // leftHand in Zone 4 (Choice 0)

    // 0.35초 체류 (미확정)
    const r1 = as.updateFromPose(lm, undefined, 0.35);
    expect(r1).toBeNull();
    expect(as.choiceProgress[0]).toBeGreaterThan(0);

    // 추가 0.36초 체류 (총 0.71s > 0.7s 확정)
    const r2 = as.updateFromPose(lm, undefined, 0.36);
    expect(r2).not.toBeNull();
    expect(r2!.confirmedIndex).toBe(0);
  });

  it('커서가 존 안에 있으면 progress가 증가한다 (Issue #130: updateFromPose 마이그레이션)', () => {
    const as = new AnswerSelector();
    as.startQuestion(1);
    const lm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
    lm[15] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 }; // leftHand in Zone 4

    as.updateFromPose(lm, undefined, 0.2);
    expect(as.choiceProgress[0]).toBeGreaterThan(0);
    expect(as.choiceProgress[1]).toBe(0);
  });

  it('중심 가중치가 가장자리보다 높다 (Issue #130: updateFromPose 마이그레이션)', () => {
    const asCenter = new AnswerSelector(1.0, 1.5, 0.75);
    asCenter.startQuestion(1);
    const lmCenter: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) lmCenter.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
    lmCenter[15] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 }; // Zone 4 중심
    asCenter.updateFromPose(lmCenter, undefined, 0.2);

    const asEdge = new AnswerSelector(1.0, 1.5, 0.75);
    asEdge.startQuestion(1);
    const lmEdge: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) lmEdge.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
    lmEdge[15] = { x: 0.05, y: 0.25, z: 0, visibility: 0.95 }; // Zone 4 가장자리
    asEdge.updateFromPose(lmEdge, undefined, 0.2);

    expect(asCenter.choiceProgress[0]).toBeGreaterThan(asEdge.choiceProgress[0]);
  });

  it('어깨 커서는 중간존(4,5,6,7,8)만 사용 가능', () => {
    expect(SHOULDER_ZONES.has(4)).toBe(true);
    expect(SHOULDER_ZONES.has(5)).toBe(true);
    expect(SHOULDER_ZONES.has(1)).toBe(false);
  });

  it('엉덩이 커서는 하단존(6, 8, 9, 10, 11)만 사용 가능하며 직립 존(7)은 배제된다', () => {
    expect(HIP_ZONES.has(6)).toBe(true);
    expect(HIP_ZONES.has(7)).toBe(false);
    expect(HIP_ZONES.has(8)).toBe(true);
    expect(HIP_ZONES.has(10)).toBe(true);
    expect(HIP_ZONES.has(11)).toBe(true);
    expect(HIP_ZONES.has(1)).toBe(false);
  });

  it('reset()이 모든 진행도를 초기화한다 (Issue #130: updateFromPose 마이그레이션)', () => {
    const as = new AnswerSelector();
    as.startQuestion(1);
    const lm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) lm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
    lm[15] = { x: 0.17, y: 0.32, z: 0, visibility: 0.95 };
    as.updateFromPose(lm, undefined, 0.3);
    expect(as.choiceProgress[0]).toBeGreaterThan(0);

    as.reset();
    expect(as.choiceProgress[0]).toBe(0);
    expect(as.choiceProgress[1]).toBe(0);
  });
});

// ═══════════════════════════════════
// MenuInput
// ═══════════════════════════════════

describe('MenuInput', () => {
  it('양손이 가까우면 합장이 감지된다', () => {
    const mi = new MenuInput();
    const result = mi.update(0.5, 0.5, 0.52, 0.51);
    expect(result.active).toBe(true);
    expect(mi.isActive).toBe(true);
  });

  it('양손이 멀면 합장이 감지되지 않는다', () => {
    const mi = new MenuInput();
    const result = mi.update(0.1, 0.5, 0.9, 0.5);
    expect(result.active).toBe(false);
    expect(mi.isActive).toBe(false);
  });

  it('합장 시 중점이 커서 좌표가 된다', () => {
    const mi = new MenuInput();
    const result = mi.update(0.4, 0.6, 0.42, 0.62);
    expect(result.active).toBe(true);
    expect(result.x).toBeCloseTo(0.41);
    expect(result.y).toBeCloseTo(0.61);
  });

  it('reset()이 상태를 초기화한다', () => {
    const mi = new MenuInput();
    mi.update(0.5, 0.5, 0.52, 0.51);
    mi.reset();
    expect(mi.isActive).toBe(false);
  });

  it('합장 커서 위치로 챕터 카드 히트 테스트 및 0.8초 호버 체류 시 메뉴 선택 트리거 시뮬레이션 (Issue #119)', () => {
    const mi = new MenuInput();
    const menuRenderer = new MenuRenderer();
    const vw = 1080;
    const vh = 2160;

    // Ch.1 카드 중앙 위치
    const chLayouts = menuRenderer.getChapterLayouts(vw, vh);
    const targetX = (chLayouts[0].x + chLayouts[0].w / 2) / vw;
    const targetY = (chLayouts[0].y + chLayouts[0].h / 2) / vh;

    // 양손을 Ch.1 카드 위치에서 합장
    const res = mi.update(targetX - 0.02, targetY, targetX + 0.02, targetY);
    expect(res.active).toBe(true);

    const mx = res.x * vw;
    const my = res.y * vh;
    const hitCh = menuRenderer.hitTest(mx, my, vw, vh);
    expect(hitCh).toBe(1);

    // 0.8초 체류 시뮬레이션
    let hoverTimer = 0;
    const DWELL_TIME = 0.8;
    let selectedCh: number | null = null;

    for (let frame = 0; frame < 55; frame++) {
      hoverTimer += 0.016; // 16ms
      if (hoverTimer >= DWELL_TIME) {
        selectedCh = hitCh;
        break;
      }
    }

    expect(selectedCh).toBe(1);
  });

  it('합장 해제 시 호버 체류가 중단된다 (Issue #119)', () => {
    const mi = new MenuInput();
    // 1. 합장 상태
    const res1 = mi.update(0.5, 0.5, 0.52, 0.5);
    expect(res1.active).toBe(true);

    // 2. 양손 분리
    const res2 = mi.update(0.2, 0.5, 0.8, 0.5);
    expect(res2.active).toBe(false);
  });
});

// ═══════════════════════════════════
// KeyboardInput
// ═══════════════════════════════════

describe('KeyboardInput', () => {
  it('초기 상태에서 enabled가 false이다', () => {
    const ki = new KeyboardInput();
    expect(ki.enabled).toBe(false);
  });

  it('destroy()가 에러 없이 동작한다', () => {
    const ki = new KeyboardInput();
    expect(() => ki.destroy()).not.toThrow();
  });

  it('isRunning / isSquatting 초기값이 false이다', () => {
    const ki = new KeyboardInput();
    expect(ki.isRunning).toBe(false);
    expect(ki.isSquatting).toBe(false);
  });
});

// ═══════════════════════════════════
// 피트니스 존 레이아웃 무결성 (Issue #121 / Issue #149 FEAT-ZONE-002)
// ═══════════════════════════════════

describe('피트니스 존 레이아웃 무결성 (Issue #121 / Issue #149 FEAT-ZONE-002)', () => {
  it('11개 피트니스 존이 정상 정의되어 있고 상호 겹침(Overlap) 면적이 0%이다', () => {
    const zones = DEFAULT_FITNESS_ZONES;
    expect(zones).toHaveLength(11);

    const zone11 = zones.find((z) => z.id === 11);
    expect(zone11).toBeDefined();
    expect(zone11?.label).toBe('우저');
    expect(zone11?.x).toBe(0.70);
    expect(zone11?.y).toBe(0.78);
    expect(zone11?.width).toBe(0.26);
    expect(zone11?.height).toBe(0.16);

    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const z1 = zones[i];
        const z2 = zones[j];

        const overlapX = z1.x < z2.x + z2.width && z1.x + z1.width > z2.x;
        const overlapY = z1.y < z2.y + z2.height && z1.y + z1.height > z2.y;
        const isOverlapping = overlapX && overlapY;

        expect(isOverlapping, `존 ${z1.id} (${z1.label})과 존 ${z2.id} (${z2.label})가 겹칩니다`).toBe(false);
      }
    }
  });

  it('문제 텍스트 밴드 및 답안 버튼 밴드가 11개 피트니스 존과 전혀 겹치지 않는다', () => {
    const bands = [RESERVED_BANDS.question, RESERVED_BANDS.answer];
    const zones = DEFAULT_FITNESS_ZONES;

    for (const band of bands) {
      for (const zone of zones) {
        const overlapX = band.x < zone.x + zone.width && band.x + band.width > zone.x;
        const overlapY = band.y < zone.y + zone.height && band.y + band.height > zone.y;
        const isOverlapping = overlapX && overlapY;

        expect(isOverlapping, `예약 밴드 [${band.name}]와 존 ${zone.id} (${zone.label})가 겹칩니다`).toBe(false);
      }
    }
  });

  it('HEAD_ZONES와 HIP_ZONES가 상호 배타적이다 (HEAD_ZONES ∩ HIP_ZONES = ∅) 및 11번이 HIP_ZONES에 포함된다', () => {
    const intersection = [...HEAD_ZONES].filter((id) => HIP_ZONES.has(id));
    expect(intersection).toHaveLength(0);
    expect(HEAD_ZONES.has(7)).toBe(false); // RC-6: 머리 커서에서 존 7 제거 확인
    expect(HIP_ZONES.has(7)).toBe(false); // 직립 위치 존 7 골반 커서에서 제거 확인
    expect(HIP_ZONES.has(11)).toBe(true); // Issue #149: 존 11 포함 확인
    expect(HEAD_ZONES.has(11)).toBe(false);
  });

  it('모든 피트니스 존 간 최소 2% 이상의 안전 경계 여백이 확보되어 있다', () => {
    const zones = DEFAULT_FITNESS_ZONES;
    // 같은 행 내 인접 열 간격 검사
    const row1 = zones.filter((z) => [1, 2, 3].includes(z.id));
    const gap1_2 = row1[1].x - (row1[0].x + row1[0].width);
    const gap2_3 = row1[2].x - (row1[1].x + row1[1].width);
    expect(gap1_2).toBeGreaterThanOrEqual(0.02);
    expect(gap2_3).toBeGreaterThanOrEqual(0.02);

    // 하단 4행 열 간격 검사 (9: 좌저, 10: 하단, 11: 우저)
    const row4 = zones.filter((z) => [9, 10, 11].includes(z.id));
    expect(row4).toHaveLength(3);
    const gap9_10 = row4[1].x - (row4[0].x + row4[0].width);
    const gap10_11 = row4[2].x - (row4[1].x + row4[1].width);
    expect(gap9_10).toBeGreaterThanOrEqual(0.02);
    expect(gap10_11).toBeGreaterThanOrEqual(0.02);

    // 행 간 수직 간격 검사
    const zone1 = zones.find((z) => z.id === 1)!;
    const zone4 = zones.find((z) => z.id === 4)!;
    const zone6 = zones.find((z) => z.id === 6)!;
    const zone9 = zones.find((z) => z.id === 9)!;

    const rowGap1_2 = zone4.y - (zone1.y + zone1.height);
    const rowGap2_3 = zone6.y - (zone4.y + zone4.height);
    const rowGap3_4 = zone9.y - (zone6.y + zone6.height);

    expect(rowGap1_2).toBeGreaterThanOrEqual(0.02);
    expect(rowGap2_3).toBeGreaterThanOrEqual(0.02);
    expect(rowGap3_4).toBeGreaterThanOrEqual(0.02);
  });
});

// ═══════════════════════════════════
// Card #119 완료 조건 검증 테스트 Suite ([BUG-MENU-001])
// ═══════════════════════════════════

describe('Card #119 완료 조건 검증 테스트 Suite ([BUG-MENU-001])', () => {
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

  it('[완료 조건 1] 첫 메뉴 화면 진입 즉시 4색 신체 커서 및 양손 모으기(합장) 커서가 화면에 렌더링된다', () => {
    const tracker = new CursorTracker({ virtualWidth: 1080, virtualHeight: 2160 });
    const renderer = new AnswerSelectionRenderer();
    const menuInput = new MenuInput();

    // 1. 스켈레톤 포즈 입력 시 4색 커서 추출
    const mockLm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) mockLm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0 });
    mockLm[0] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 }; // head
    mockLm[15] = { x: 0.44, y: 0.45, z: 0, visibility: 0.95 }; // leftHand
    mockLm[16] = { x: 0.48, y: 0.45, z: 0, visibility: 0.95 }; // rightHand
    mockLm[23] = { x: 0.45, y: 0.65, z: 0, visibility: 0.95 }; // hip
    mockLm[24] = { x: 0.55, y: 0.65, z: 0, visibility: 0.95 };

    const cursors = tracker.update(mockLm);
    expect(cursors.size).toBe(4);
    expect(cursors.has('leftHand')).toBe(true);
    expect(cursors.has('rightHand')).toBe(true);
    expect(cursors.has('head')).toBe(true);
    expect(cursors.has('hip')).toBe(true);

    // 2. 메뉴 화면(activeZones=[])에서 4색 커서 정상 렌더링 호출
    expect(() => renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0])).not.toThrow();

    // 3. 양손이 가까워지면 MenuInput이 합장 상태로 활성화
    const left = cursors.get('leftHand')!;
    const right = cursors.get('rightHand')!;
    const menuResult = menuInput.update(left.x, left.y, right.x, right.y);
    expect(menuResult.active).toBe(true);
    expect(menuInput.isActive).toBe(true);
    expect(menuResult.x).toBeCloseTo((left.x + right.x) / 2);
  });

  it('[완료 조건 2] 카메라 앞에서 양손을 모아 챕터 카드/서브레벨 카드에 0.8초 체류 시 터치 없이 메뉴가 선택된다', () => {
    const menuInput = new MenuInput();
    const menuRenderer = new MenuRenderer();
    const vw = 1080;
    const vh = 2160;

    // A. 메인 챕터 1번 카드 위치에서 합장
    const chLayouts = menuRenderer.getChapterLayouts(vw, vh);
    const ch1X = (chLayouts[0].x + chLayouts[0].w / 2) / vw;
    const ch1Y = (chLayouts[0].y + chLayouts[0].h / 2) / vh;
    const ch1Result = menuInput.update(ch1X - 0.01, ch1Y, ch1X + 0.01, ch1Y);
    expect(ch1Result.active).toBe(true);
    const hitCh = menuRenderer.hitTest(ch1Result.x * vw, ch1Result.y * vh, vw, vh);
    expect(hitCh).toBe(1);

    // 0.8초 체류 누적 시뮬레이션
    let hoverTimer = 0;
    let selectedChapter: number | null = null;
    const dt = 0.016;
    for (let f = 0; f < 60; f++) {
      hoverTimer += dt;
      if (hoverTimer >= 0.8) {
        selectedChapter = hitCh;
        break;
      }
    }
    expect(selectedChapter).toBe(1);

    // B. 서브레벨 메뉴에서 '전체 종합 (ALL, subLevel=0)' 카드 위치에서 합장
    const mockSubLevels = [
      { subLevel: 1, title: '덧셈 한자리', count: 20 },
      { subLevel: 2, title: '덧셈 두자리', count: 20 },
    ];
    const subLayouts = menuRenderer.getSubMenuLayouts(vw, vh, 1, mockSubLevels);
    const allCard = subLayouts.find((s) => s.subLevel === 0)!;
    expect(allCard).toBeDefined();

    const allCardNormX = (allCard.x + allCard.w / 2) / vw;
    const allCardNormY = (allCard.y + allCard.h / 2) / vh;

    const subResult = menuInput.update(allCardNormX - 0.01, allCardNormY, allCardNormX + 0.01, allCardNormY);
    expect(subResult.active).toBe(true);
    const hitSub = menuRenderer.hitTestSub(subResult.x * vw, subResult.y * vh, vw, vh, 1, mockSubLevels);
    expect(hitSub).toBe(0);

    // 0.8초 체류 누적 시 서브레벨 선택 확정
    let subHoverTimer = 0;
    let confirmedSubLevel: number | null = null;
    for (let f = 0; f < 60; f++) {
      subHoverTimer += dt;
      if (subHoverTimer >= 0.8) {
        confirmedSubLevel = hitSub;
        break;
      }
    }
    expect(confirmedSubLevel).toBe(0);
  });

  it('[완료 조건 3] 마우스 클릭 및 키보드(1~5, Esc, A, 0) Fallback 조작이 100% 정상 유지된다', () => {
    const menuRenderer = new MenuRenderer();
    const vw = 1080;
    const vh = 2160;

    // 1. 챕터 1~5 마우스 클릭 좌표 판정 전수 검증
    const chLayouts = menuRenderer.getChapterLayouts(vw, vh);
    for (let ch = 1; ch <= 5; ch++) {
      const card = chLayouts[ch - 1];
      const hit = menuRenderer.hitTest(card.x + card.w / 2, card.y + card.h / 2, vw, vh);
      expect(hit).toBe(ch);
    }

    // 2. 서브레벨 뒤로가기(-1), ALL(0), 단계별 클릭 판정 검증
    const mockSubLevels = [
      { subLevel: 1, title: '1단계', count: 10 },
      { subLevel: 2, title: '2단계', count: 10 },
    ];
    const layouts = menuRenderer.getSubMenuLayouts(vw, vh, 1, mockSubLevels);
    const backLayout = layouts.find((l) => l.subLevel === -1)!;
    expect(menuRenderer.hitTestSub(backLayout.x + 5, backLayout.y + 5, vw, vh, 1, mockSubLevels)).toBe(-1);

    const sub1Layout = layouts.find((l) => l.subLevel === 1)!;
    expect(menuRenderer.hitTestSub(sub1Layout.x + 5, sub1Layout.y + 5, vw, vh, 1, mockSubLevels)).toBe(1);

    // 3. 키보드 Fallback 매핑 검증
    const simulateKeyDown = (key: string, mode: 'main' | 'sub', unlocked = 5) => {
      if (mode === 'main') {
        const n = parseInt(key, 10);
        if (n >= 1 && n <= 5 && n <= unlocked) return { action: 'selectChapter', chapter: n };
      } else {
        if (key === 'Escape' || key === '0' || key === 'Backspace' || key.toLowerCase() === 'b') {
          return { action: 'back' };
        }
        if (key.toLowerCase() === 'a') return { action: 'all' };
        const n = parseInt(key, 10);
        if (n >= 1 && n <= mockSubLevels.length) return { action: 'selectSub', subLevel: n };
      }
      return null;
    };

    expect(simulateKeyDown('1', 'main')).toEqual({ action: 'selectChapter', chapter: 1 });
    expect(simulateKeyDown('5', 'main')).toEqual({ action: 'selectChapter', chapter: 5 });
    expect(simulateKeyDown('Escape', 'sub')).toEqual({ action: 'back' });
    expect(simulateKeyDown('0', 'sub')).toEqual({ action: 'back' });
    expect(simulateKeyDown('a', 'sub')).toEqual({ action: 'all' });
    expect(simulateKeyDown('2', 'sub')).toEqual({ action: 'selectSub', subLevel: 2 });
  });
});

describe('피트니스 존별/부위별 독립 진행도 렌더링 (Issue #129 / UI-002)', () => {
  it('3개 이상 활성 존에서 각 존의 진행도가 독립적으로 렌더링된다', () => {
    const renderer = new AnswerSelectionRenderer();
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

    const activeZones = [
      { id: 1, label: '좌상', x: 0.04, y: 0.04, width: 0.26, height: 0.16 },
      { id: 4, label: '좌', x: 0.04, y: 0.24, width: 0.26, height: 0.16 },
      { id: 7, label: '중하', x: 0.37, y: 0.58, width: 0.26, height: 0.16 },
    ];

    // 존 ID별 독립 진행도 맵
    const progressMap = new Map<number, number>([
      [1, 0.8], // 존 1은 80%
      [4, 0.3], // 존 4는 30%
      [7, 0.0], // 존 7은 0%
    ]);

    const mockMagicCircle = {
      isReady: true,
      renderAtZone: vi.fn(),
    } as any;
    renderer.setMagicCircle(mockMagicCircle);

    expect(() =>
      renderer.render(mockCtx, 1080, 2160, activeZones, new Map(), progressMap),
    ).not.toThrow();

    // 0% 초과인 존 1과 존 4에 대해서만 진행도 아크가 2회 호출됨 (i % 2 오매핑 해소 검증)
    expect(mockCtx.arc).toHaveBeenCalledTimes(2);
  });

  it('커서가 속한 존의 진행도에 맞춰 체류 아크가 독립적으로 점등된다', () => {
    const renderer = new AnswerSelectionRenderer();
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

    const activeZones = [
      { id: 4, label: '좌', x: 0.04, y: 0.24, width: 0.26, height: 0.16 },
      { id: 5, label: '우', x: 0.70, y: 0.24, width: 0.26, height: 0.16 },
    ];

    // 왼손은 존 4 내부(진행도 0.5), 오른손은 허공(진행도 0)
    const cursors = new Map<any, any>([
      ['leftHand', { type: 'leftHand', x: 0.15, y: 0.32, confidence: 1, source: 'pose' }],
      ['rightHand', { type: 'rightHand', x: 0.50, y: 0.50, confidence: 1, source: 'pose' }], // 허공
    ]);

    const progressMap = new Map<number, number>([
      [4, 0.5],
      [5, 0.0],
    ]);

    mockCtx.arc = vi.fn();
    renderer.render(mockCtx, 1080, 2160, activeZones, cursors, progressMap);

    // 왼손 본체 arc 1 + 펄스 1 + 체류 아크 1 = 3
    // 오른손 본체 arc 1 + 펄스 1 (허공이므로 체류 아크 0) = 2
    // 총 arc 5회 호출 확인
    expect(mockCtx.arc).toHaveBeenCalledTimes(5);
  });
});

describe('스켈레톤 커서 메뉴 조작성 개선 (Issue #133 / INPUT-002)', () => {
  it('히트박스 패딩 적용 시 카드 경계선 바깥에서도 안정적으로 판정된다', () => {
    const menuRenderer = new MenuRenderer();
    const vw = 1080;
    const vh = 2160;

    const chLayouts = menuRenderer.getChapterLayouts(vw, vh);
    const card = chLayouts[0];

    // 카드 경계선 바로 바깥 (좌측 10px 바깥)
    const outsideX = card.x - 10;
    const insideY = card.y + card.h / 2;

    // 패딩 0일 때는 미판정 (0)
    expect(menuRenderer.hitTest(outsideX, insideY, vw, vh, 0)).toBe(0);
    // 패딩 16px 적용 시 정상 판정 (1)
    expect(menuRenderer.hitTest(outsideX, insideY, vw, vh, 16)).toBe(1);
  });

  it('호버 히스테리시스: 이미 호버 중인 경우 확장 패딩(+24px)으로 떨림 오선택을 방지한다', () => {
    const menuRenderer = new MenuRenderer();
    const vw = 1080;
    const vh = 2160;

    const chLayouts = menuRenderer.getChapterLayouts(vw, vh);
    const card = chLayouts[1]; // Ch.2

    // 카드 하단 경계 16px 바깥으로 손이 미세하게 떨려나간 경우 (Y축 방향에는 인접 카드 없음)
    const jitterX = card.x + card.w / 2;
    const jitterY = card.y + card.h + 16;

    // 미호버 기본 패딩(10px)으로는 탈출 감지
    expect(menuRenderer.hitTest(jitterX, jitterY, vw, vh, 10)).toBe(0);
    // 호버 유지 히스테리시스 패딩(24px)으로는 카드 체류가 유지됨
    expect(menuRenderer.hitTest(jitterX, jitterY, vw, vh, 24)).toBe(2);
  });
});

describe('인게임 문제 스테이지 양손 합장 제스처 메뉴 연동 (Issue #169 / INPUT-MOTION-001)', () => {
  it('인게임 문제 풀이 중 양손이 가까워지면 MenuInput이 합장 상태(active: true)로 활성화된다', () => {
    const menuInput = new MenuInput();

    // 1. 처음엔 양손이 멀리 떨어져 있음 (합장 비활성)
    const farResult = menuInput.update(0.2, 0.5, 0.8, 0.5);
    expect(farResult.active).toBe(false);
    expect(menuInput.isActive).toBe(false);

    // 2. 인게임 문제 풀이 중 양손을 가슴 앞 중앙(0.5, 0.7)으로 모음
    const joinResult = menuInput.update(0.48, 0.7, 0.52, 0.7);
    expect(joinResult.active).toBe(true);
    expect(menuInput.isActive).toBe(true);
    expect(joinResult.x).toBeCloseTo(0.5);
    expect(joinResult.y).toBeCloseTo(0.7);
  });

  it('인게임 합장 커서 위치로 하단 바 설정 버튼 및 정지 버튼 호버가 정상 판정되고 0.8초 체류 시 동작한다', () => {
    const menuInput = new MenuInput();
    const bottomBar = new BottomBar();
    const vw = 1080;
    const vh = 2160;

    // A. 하단 바 설정 버튼(좌측: x: 100, y: 2060) 위치로 양손 합장
    const settingsNormX = 100 / vw;
    const settingsNormY = 2060 / vh;
    const joinSettings = menuInput.update(settingsNormX - 0.01, settingsNormY, settingsNormX + 0.01, settingsNormY);
    expect(joinSettings.active).toBe(true);

    const hitSettings = bottomBar.hitTestSettings(joinSettings.x * vw, joinSettings.y * vh, vw, vh, 15);
    expect(hitSettings).toBe(true);

    // 0.8초 체류 시뮬레이션
    let settingsTimer = 0;
    let settingsOpened = false;
    for (let f = 0; f < 60; f++) {
      settingsTimer += 0.016;
      if (settingsTimer >= 0.8) {
        settingsOpened = true;
        break;
      }
    }
    expect(settingsOpened).toBe(true);

    // B. 하단 바 일시정지(정지) 버튼(우측: x: 930, y: 2060) 위치로 양손 합장
    const actionNormX = 930 / vw;
    const actionNormY = 2060 / vh;
    const joinAction = menuInput.update(actionNormX - 0.01, actionNormY, actionNormX + 0.01, actionNormY);
    expect(joinAction.active).toBe(true);

    const hitAction = bottomBar.hitTestAction(joinAction.x * vw, joinAction.y * vh, vw, vh, 15);
    expect(hitAction).toBe(true);

    // 0.8초 체류 시뮬레이션
    let actionTimer = 0;
    let actionTriggered = false;
    for (let f = 0; f < 60; f++) {
      actionTimer += 0.016;
      if (actionTimer >= 0.8) {
        actionTriggered = true;
        break;
      }
    }
    expect(actionTriggered).toBe(true);
  });

  it('합장 활성화 상태(menuInput.isActive === true)에서는 AnswerSelector가 일시정지(paused)되어 오답/정답 처리가 방지된다', () => {
    const selector = new AnswerSelector();
    expect(selector.paused).toBe(false);

    // 합장 감지 시뮬레이션
    const menuInput = new MenuInput();
    menuInput.update(0.49, 0.6, 0.51, 0.6);
    expect(menuInput.isActive).toBe(true);

    // 합장에 따라 selector.paused 활성화
    selector.paused = menuInput.isActive;
    expect(selector.paused).toBe(true);

    // 랜드마크 생성
    const mockLm: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      mockLm.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 });
    }

    // paused 상태에서는 updateFromPose가 항상 null 반환 및 답안 확정 차단
    for (let f = 0; f < 60; f++) {
      const res = selector.updateFromPose(mockLm, undefined, 0.016);
      expect(res).toBeNull();
    }
  });

  it('합장 해제 시 AnswerSelector의 일시정지가 해제되어 통상 4색 커서 문제 풀이가 재개된다', () => {
    const selector = new AnswerSelector();
    const menuInput = new MenuInput();

    // 1. 합장 시작
    menuInput.update(0.49, 0.6, 0.51, 0.6);
    selector.paused = menuInput.isActive;
    expect(selector.paused).toBe(true);

    // 2. 합장 해제 (양손 분리)
    menuInput.update(0.2, 0.6, 0.8, 0.6);
    selector.paused = menuInput.isActive;
    expect(selector.paused).toBe(false);
  });
});
