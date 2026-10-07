import { describe, expect, it } from 'vitest';
import {
  type AlignDirection,
  type AlignReference,
  type ArrangementElement,
  type CoordinateTransform,
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  DEFAULT_ARTBOARD_BOUNDS,
  computeBoundingBox,
  rectsIntersect,
  computeIndividualAlign,
  computeGroupAlign,
  translateGroup,
  computeGroupDragSnap,
  canvasToViewport,
  viewportToCanvas,
  viewportToScreen,
  screenToViewport,
  canvasToScreen,
  screenToCanvas,
  canvasRectToScreen,
  screenRectToCanvas,
} from '../../src/editor/ui/UIArrangement';
import {
  type UIRect,
} from '../../src/editor/ui/data/UIVisualDocument';

describe('[Issue #435 / UI-VIS-005] 다중 선택 정렬·그룹 이동·스냅 수학', () => {
  // Helper to create test elements
  const createElements = (): ArrangementElement[] => [
    {
      id: 'img-hero',
      name: '히어로 이미지',
      bounds: { x: 100, y: 200, width: 200, height: 100 },
    },
    {
      id: 'txt-title',
      name: '타이틀 텍스트',
      bounds: { x: 150, y: 350, width: 100, height: 50 },
    },
  ];

  describe('0. 기본 기하학 상수 및 바운딩 박스 / 인터섹션 순수 함수', () => {
    it('아트보드 기본 해상도 상수(1080x2160)가 정확하다', () => {
      expect(ARTBOARD_WIDTH).toBe(1080);
      expect(ARTBOARD_HEIGHT).toBe(2160);
      expect(DEFAULT_ARTBOARD_BOUNDS).toEqual({ x: 0, y: 0, width: 1080, height: 2160 });
    });

    it('computeBoundingBox가 빈 목록 및 다중 요소의 전체 영역을 정확히 계산한다', () => {
      expect(computeBoundingBox([])).toBeNull();

      const bbox = computeBoundingBox(createElements());
      expect(bbox).toEqual({ x: 100, y: 200, width: 200, height: 200 });
    });

    it('rectsIntersect가 겹침 여부를 엄격하게 판정한다', () => {
      const r1: UIRect = { x: 10, y: 10, width: 50, height: 50 };
      const r2: UIRect = { x: 40, y: 40, width: 50, height: 50 };
      const r3: UIRect = { x: 70, y: 70, width: 50, height: 50 };

      expect(rectsIntersect(r1, r2)).toBe(true);
      expect(rectsIntersect(r1, r3)).toBe(false);
    });
  });

  describe('1. 6×3 정렬 행렬 (Individual Alignment: 각 요소 개별 정렬)', () => {
    // 6 directions: left, hcenter, right, top, vcenter, bottom
    // 3 references: selection, artboard, key-object
    const directions: AlignDirection[] = ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'];
    const references: AlignReference[] = ['selection', 'artboard', 'key-object'];

    it('6방향 × 3기준의 18가지 정렬 조합을 성공적으로 계산한다', () => {
      for (const dir of directions) {
        for (const ref of references) {
          const elements = createElements();
          const result = computeIndividualAlign(elements, {
            direction: dir,
            reference: ref,
            keyObjectId: ref === 'key-object' ? 'img-hero' : undefined,
            enforceCanvasBounds: false, // focus on pure alignment math
          });

          expect(result.ok, `dir=${dir}, ref=${ref} must succeed`).toBe(true);
          if (result.ok) {
            expect(result.elements).toHaveLength(2);
            expect(result.deltaMap).toBeDefined();
          }
        }
      }
    });

    describe('Selection bounds 기준 개별 정렬 기대값', () => {
      // selection bounds:
      // minX = 100, maxX = 300, width = 200
      // minY = 200, maxY = 400, height = 200
      // centerX = 200, centerY = 300
      it('left: 모든 요소의 x가 selection.minX(100)로 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'left',
          reference: 'selection',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        expect(img.bounds.x).toBe(100);
        expect(txt.bounds.x).toBe(100);
        // y 좌표는 불변
        expect(img.bounds.y).toBe(200);
        expect(txt.bounds.y).toBe(350);
      });

      it('hcenter: 각 요소의 중심이 selection.centerX(200)로 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'hcenter',
          reference: 'selection',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        // img width 200 -> center at 200 => x = 200 - 100 = 100
        expect(img.bounds.x).toBe(100);
        // txt width 100 -> center at 200 => x = 200 - 50 = 150
        expect(txt.bounds.x).toBe(150);
      });

      it('right: 각 요소의 오른쪽 끝이 selection.maxX(300)로 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'right',
          reference: 'selection',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        expect(img.bounds.x).toBe(300 - 200); // 100
        expect(txt.bounds.x).toBe(300 - 100); // 200
      });

      it('top: 모든 요소의 y가 selection.minY(200)로 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'top',
          reference: 'selection',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        expect(img.bounds.y).toBe(200);
        expect(txt.bounds.y).toBe(200);
      });

      it('vcenter: 각 요소의 중심이 selection.centerY(300)로 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'vcenter',
          reference: 'selection',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        // img height 100 -> center at 300 => y = 300 - 50 = 250
        expect(img.bounds.y).toBe(250);
        // txt height 50 -> center at 300 => y = 300 - 25 = 275
        expect(txt.bounds.y).toBe(275);
      });

      it('bottom: 각 요소의 하단이 selection.maxY(400)로 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'bottom',
          reference: 'selection',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        expect(img.bounds.y).toBe(400 - 100); // 300
        expect(txt.bounds.y).toBe(400 - 50); // 350
      });
    });

    describe('Artboard 기준 개별 정렬 기대값 (1080 × 2160)', () => {
      // artboard: width 1080, height 2160, centerX 540, centerY 1080
      it('hcenter: 각 요소의 중심이 artboard.centerX(540)로 독립 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'hcenter',
          reference: 'artboard',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        expect(img.bounds.x).toBe(540 - 200 / 2); // 440
        expect(txt.bounds.x).toBe(540 - 100 / 2); // 490
      });

      it('vcenter: 각 요소의 중심이 artboard.centerY(1080)로 독립 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'vcenter',
          reference: 'artboard',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        expect(img.bounds.y).toBe(1080 - 100 / 2); // 1030
        expect(txt.bounds.y).toBe(1080 - 50 / 2); // 1055
      });

      it('right: 각 요소의 오른쪽 끝이 artboard.width(1080)에 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'right',
          reference: 'artboard',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        expect(img.bounds.x).toBe(1080 - 200); // 880
        expect(txt.bounds.x).toBe(1080 - 100); // 980
      });

      it('bottom: 각 요소의 하단이 artboard.height(2160)에 정렬된다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'bottom',
          reference: 'artboard',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const [img, txt] = result.elements;
        expect(img.bounds.y).toBe(2160 - 100); // 2060
        expect(txt.bounds.y).toBe(2160 - 50); // 2110
      });
    });

    describe('Key-Object 기준 정렬: 기준 요소 고정(Unmoved) 보장', () => {
      it('key-object의 bounds는 100% 불변이고, 나머지 요소만 key-object 기준으로 이동한다', () => {
        const elements = createElements();
        // img-hero: bounds = { x: 100, y: 200, width: 200, height: 100 }
        // txt-title: bounds = { x: 150, y: 350, width: 100, height: 50 }
        const result = computeIndividualAlign(elements, {
          direction: 'left',
          reference: 'key-object',
          keyObjectId: 'img-hero',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const img = result.elements.find((e) => e.id === 'img-hero')!;
        const txt = result.elements.find((e) => e.id === 'txt-title')!;

        // key-object는 전혀 움직이지 않음
        expect(img.bounds).toEqual({ x: 100, y: 200, width: 200, height: 100 });
        expect(result.deltaMap['img-hero']).toEqual({ dx: 0, dy: 0 });

        // txt-title의 x가 key-object의 left(100)로 이동함
        expect(txt.bounds.x).toBe(100);
        expect(txt.bounds.y).toBe(350); // y는 불변
      });

      it('key-object right 정렬 시에도 key-object는 고정되고 상대 요소만 right edge에 맞춘다', () => {
        const result = computeIndividualAlign(createElements(), {
          direction: 'right',
          reference: 'key-object',
          keyObjectId: 'img-hero',
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const img = result.elements.find((e) => e.id === 'img-hero')!;
        const txt = result.elements.find((e) => e.id === 'txt-title')!;

        // img-hero는 고정 (maxX = 100 + 200 = 300)
        expect(img.bounds.x).toBe(100);
        // txt-title (width 100) -> x = 300 - 100 = 200
        expect(txt.bounds.x).toBe(200);
      });
    });
  });

  describe('2. 묶음 정렬(En-bloc Align) vs 개별 정렬(Individual Align) 및 상대 오프셋 보존', () => {
    it('묶음 중앙 정렬 시 그룹 내 요소들 간의 relative offset이 100% 불변으로 유지된다', () => {
      // img-hero: x=100, y=200, w=200, h=100
      // txt-title: x=120, y=350, w=80, h=50  (상대 offset dx = 120 - 100 = 20)
      const elements: ArrangementElement[] = [
        { id: 'img-hero', name: 'img', bounds: { x: 100, y: 200, width: 200, height: 100 } },
        { id: 'txt-title', name: 'txt', bounds: { x: 120, y: 350, width: 80, height: 50 } },
      ];

      const initialRelOffsetX = elements[1].bounds.x - elements[0].bounds.x; // +20
      const initialRelOffsetY = elements[1].bounds.y - elements[0].bounds.y; // +150

      // Group align to artboard hcenter
      const groupResult = computeGroupAlign(elements, {
        direction: 'hcenter',
        reference: 'artboard',
      });

      expect(groupResult.ok).toBe(true);
      if (!groupResult.ok) return;

      const [groupImg, groupTxt] = groupResult.elements;
      const afterRelOffsetX = groupTxt.bounds.x - groupImg.bounds.x;
      const afterRelOffsetY = groupTxt.bounds.y - groupImg.bounds.y;

      // 상대 오프셋 불변 증빙
      expect(afterRelOffsetX).toBe(initialRelOffsetX);
      expect(afterRelOffsetY).toBe(initialRelOffsetY);
      expect(groupResult.groupDelta).toBeDefined();
    });

    it('개별 중앙 정렬과 묶음 중앙 정렬의 결과 좌표가 명확히 다르다', () => {
      const elements: ArrangementElement[] = [
        { id: 'img-hero', name: 'img', bounds: { x: 100, y: 200, width: 200, height: 100 } },
        { id: 'txt-title', name: 'txt', bounds: { x: 120, y: 350, width: 80, height: 50 } },
      ];

      // Individual hcenter
      const indResult = computeIndividualAlign(elements, {
        direction: 'hcenter',
        reference: 'artboard',
      });
      // Group hcenter
      const grpResult = computeGroupAlign(elements, {
        direction: 'hcenter',
        reference: 'artboard',
      });

      expect(indResult.ok).toBe(true);
      expect(grpResult.ok).toBe(true);
      if (!indResult.ok || !grpResult.ok) return;

      const indTxt = indResult.elements.find((e) => e.id === 'txt-title')!;
      const grpTxt = grpResult.elements.find((e) => e.id === 'txt-title')!;

      // Individual: txt center aligns to 540 -> x = 540 - 40 = 500
      expect(indTxt.bounds.x).toBe(500);

      // Group: selection bounds minX=100, maxX=200, w=200 -> center is at 540 -> deltaX = 540 - 100 - 100 = 340
      // grpTxt.bounds.x = 120 + 340 = 460
      expect(grpTxt.bounds.x).toBe(460);

      // 개별 중앙과 묶음 중앙의 결과가 명확히 다름을 검증
      expect(indTxt.bounds.x).not.toBe(grpTxt.bounds.x);
    });

    it('소수점(fractional) 좌표를 강제 반올림하지 않고 완전하게 보존한다', () => {
      const elements: ArrangementElement[] = [
        { id: 'sub-pixel-1', name: 'e1', bounds: { x: 10.333, y: 20.666, width: 100.5, height: 50.25 } },
        { id: 'sub-pixel-2', name: 'e2', bounds: { x: 15.123, y: 80.456, width: 80.125, height: 40.875 } },
      ];

      const res = translateGroup(elements, { x: 7.111, y: 3.222 }, { snap: false, isDirectEntry: true });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.elements[0].bounds.x).toBeCloseTo(17.444, 4);
      expect(res.elements[0].bounds.y).toBeCloseTo(23.888, 4);
      expect(res.elements[1].bounds.x).toBeCloseTo(22.234, 4);
      expect(res.elements[1].bounds.y).toBeCloseTo(83.678, 4);
    });
  });

  describe('3. 그룹 이동(Group Translation) 및 드래그 스냅(Drag Snap)', () => {
    it('단일 공통 delta (dx, dy)가 그룹 내 모든 요소에 균일하게 적용된다', () => {
      const elements = createElements();
      const delta = { x: 50, y: -30 };
      const res = translateGroup(elements, delta);

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.elements[0].bounds.x).toBe(150);
      expect(res.elements[0].bounds.y).toBe(170);
      expect(res.elements[1].bounds.x).toBe(200);
      expect(res.elements[1].bounds.y).toBe(320);
      expect(res.groupDelta).toEqual(delta);
    });

    it('드래그 스냅은 그룹 anchor에 단 1회 적용되어 계산되며 개별 요소를 각각 스냅하지 않아 상대 간격이 유지된다', () => {
      // anchor at x = 13, raw delta = 8 -> target = 21 -> snap(10px) = 20 -> snappedDelta = 20 - 13 = +7
      const anchor = { x: 13, y: 25 };
      const rawDelta = { x: 8, y: 17 }; // y: 25 + 17 = 42 -> snap(10px) = 40 -> snappedDelta = 40 - 25 = +15

      const snapResult = computeGroupDragSnap(anchor, rawDelta, 10);
      expect(snapResult.snappedDelta).toEqual({ x: 7, y: 15 });
      expect(snapResult.snappedAnchor).toEqual({ x: 20, y: 40 });

      // 이 스냅된 단일 delta를 요소들에 적용 시 상대 간격 유지 검증
      const elements: ArrangementElement[] = [
        { id: 'el-1', name: 'el1', bounds: { x: 13, y: 25, width: 50, height: 50 } },
        { id: 'el-2', name: 'el2', bounds: { x: 27, y: 45, width: 50, height: 50 } }, // x offset: 14, y offset: 20
      ];

      const res = translateGroup(elements, snapResult.snappedDelta);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.elements[0].bounds.x).toBe(20);
      expect(res.elements[0].bounds.y).toBe(40);
      expect(res.elements[1].bounds.x).toBe(34);
      expect(res.elements[1].bounds.y).toBe(60);

      // 상대 거리 보존 (34 - 20 = 14)
      expect(res.elements[1].bounds.x - res.elements[0].bounds.x).toBe(14);
      expect(res.elements[1].bounds.y - res.elements[0].bounds.y).toBe(20);
    });

    it('숫자 직접 입력(direct numeric entry) 시에는 스냅이 적용되지 않고 입력값 그대로 유지된다', () => {
      const elements = createElements();
      const directDelta = { x: 13.75, y: 27.25 };
      const res = translateGroup(elements, directDelta, { isDirectEntry: true, snap: false });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.elements[0].bounds.x).toBe(113.75);
      expect(res.elements[0].bounds.y).toBe(227.25);
    });
  });

  describe('4. 유효성 검사 및 원자적 거부 (Atomic Rejection: 문서 변경 0건 보장)', () => {
    it('선택된 요소 중 잠긴 요소(isLocked: true)가 1개라도 포함되면 전체 작업이 원자적 거부된다', () => {
      const elements: ArrangementElement[] = [
        { id: 'unlocked-1', name: '정상요소', bounds: { x: 100, y: 100, width: 100, height: 100 } },
        { id: 'locked-1', name: '잠긴요소', bounds: { x: 250, y: 100, width: 100, height: 100 }, isLocked: true },
      ];

      const res = computeIndividualAlign(elements, { direction: 'left', reference: 'artboard' });
      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.reason).toBe('locked-element');
      expect(res.violatedElementId).toBe('locked-1');
      // 문서 변경 0건 검증: 원본과 완전히 동일한 bounds 반환
      expect(res.elements[0].bounds).toEqual({ x: 100, y: 100, width: 100, height: 100 });
      expect(res.elements[1].bounds).toEqual({ x: 250, y: 100, width: 100, height: 100 });
    });

    it('보호 영역(protected zone)을 침범하는 이동은 원자적 거부되며 0건 변경된다', () => {
      const protectedZones = [
        {
          id: 'zone-hud-hp',
          name: '플레이어 HP 보호구역',
          bounds: { x: 20, y: 20, width: 320, height: 50 },
        },
      ];

      const elements: ArrangementElement[] = [
        { id: 'btn-1', name: '이동버튼', bounds: { x: 500, y: 500, width: 100, height: 100 } },
      ];

      // 버튼을 HP 보호구역(x: 20, y: 20)으로 옮기는 이동 시도
      const res = translateGroup(elements, { x: -450, y: -450 }, { protectedZones });
      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.reason).toBe('protected-zone-violation');
      expect(res.violatedElementId).toBe('btn-1');
      expect(res.violatedZoneId).toBe('zone-hud-hp');
      // 원래 위치 불변 (0건 변경)
      expect(res.elements[0].bounds).toEqual({ x: 500, y: 500, width: 100, height: 100 });
    });

    it('캔버스 범위 초과(canvas bounds exceeded) 시 원자적 거부된다', () => {
      const elements: ArrangementElement[] = [
        { id: 'box-1', name: '박스', bounds: { x: 1000, y: 2000, width: 100, height: 100 } },
      ];

      // x: 1000 + 100 = 1100 > 1080 (캔버스 폭 초과)
      const res = translateGroup(elements, { x: 100, y: 0 }, { enforceCanvasBounds: true });
      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.reason).toBe('canvas-bounds-exceeded');
      expect(res.violatedElementId).toBe('box-1');
      expect(res.elements[0].bounds).toEqual({ x: 1000, y: 2000, width: 100, height: 100 });
    });

    it('빈 선택(empty selection) 시 reason="empty-selection"으로 안전하게 거부된다', () => {
      const res = computeIndividualAlign([], { direction: 'left', reference: 'artboard' });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.reason).toBe('empty-selection');
      expect(res.elements).toEqual([]);
    });

    it('key-object가 선택 목록에 없는 경우 reason="key-object-not-found"로 거부된다', () => {
      const elements = createElements();
      const res = computeIndividualAlign(elements, {
        direction: 'left',
        reference: 'key-object',
        keyObjectId: 'non-existent-id',
      });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.reason).toBe('key-object-not-found');
      expect(res.elements[0].bounds).toEqual(elements[0].bounds);
      expect(res.elements[1].bounds).toEqual(elements[1].bounds);
    });
  });

  describe('5. Zoom / Pan / DPR 좌표 변환 (Viewport ↔ Canvas ↔ Screen) 및 역변환', () => {
    const transform: CoordinateTransform = {
      zoom: 1.5, // 150%
      panX: 40,
      panY: 80,
      dpr: 2.0, // Retina display
    };

    it('Canvas ↔ Viewport 변환이 정확하며 가역적(invertible)이다', () => {
      const canvasPt = { x: 540, y: 1080 };
      const viewportPt = canvasToViewport(canvasPt, transform);

      // viewport = canvas * zoom + pan
      expect(viewportPt.x).toBe(540 * 1.5 + 40); // 850
      expect(viewportPt.y).toBe(1080 * 1.5 + 80); // 1700

      // Invert back to Canvas
      const recoveredCanvasPt = viewportToCanvas(viewportPt, transform);
      expect(recoveredCanvasPt.x).toBeCloseTo(canvasPt.x, 9);
      expect(recoveredCanvasPt.y).toBeCloseTo(canvasPt.y, 9);
    });

    it('Viewport ↔ Screen 변환이 정확하며 가역적이다', () => {
      const viewportPt = { x: 850, y: 1700 };
      const screenPt = viewportToScreen(viewportPt, transform);

      // screen = viewport * dpr
      expect(screenPt.x).toBe(850 * 2.0); // 1700
      expect(screenPt.y).toBe(1700 * 2.0); // 3400

      const recoveredViewportPt = screenToViewport(screenPt, transform);
      expect(recoveredViewportPt.x).toBeCloseTo(viewportPt.x, 9);
      expect(recoveredViewportPt.y).toBeCloseTo(viewportPt.y, 9);
    });

    it('Canvas ↔ Screen 직결 변환이 정확하며 가역적이다', () => {
      const canvasPt = { x: 200, y: 400 };
      const screenPt = canvasToScreen(canvasPt, transform);

      // screen = (canvas * zoom + pan) * dpr = (200 * 1.5 + 40) * 2 = 340 * 2 = 680
      expect(screenPt.x).toBe(680);
      expect(screenPt.y).toBe((400 * 1.5 + 80) * 2); // 680 * 2 = 1360

      const recoveredCanvasPt = screenToCanvas(screenPt, transform);
      expect(recoveredCanvasPt.x).toBeCloseTo(canvasPt.x, 9);
      expect(recoveredCanvasPt.y).toBeCloseTo(canvasPt.y, 9);
    });

    it('Rect bounds 변환 및 역변환이 정확하다', () => {
      const canvasRect: UIRect = { x: 100, y: 200, width: 300, height: 150 };
      const screenRect = canvasRectToScreen(canvasRect, transform);

      // screen w/h = canvas w/h * zoom * dpr
      expect(screenRect.width).toBe(300 * 1.5 * 2.0); // 900
      expect(screenRect.height).toBe(150 * 1.5 * 2.0); // 450

      const recoveredRect = screenRectToCanvas(screenRect, transform);
      expect(recoveredRect.x).toBeCloseTo(canvasRect.x, 9);
      expect(recoveredRect.y).toBeCloseTo(canvasRect.y, 9);
      expect(recoveredRect.width).toBeCloseTo(canvasRect.width, 9);
      expect(recoveredRect.height).toBeCloseTo(canvasRect.height, 9);
    });
  });

  describe('6. 실게임 UIVisualDocument 및 DEFAULT_PROTECTED_ZONES 연동 검증', () => {
    it('실제 DEFAULT_PROTECTED_ZONES를 준수하여 모션 인터랙션 구역 침범을 원자적으로 차단한다', async () => {
      const { DEFAULT_PROTECTED_ZONES } = await import('../../src/data/UIPresentation');

      // zone_1_running_question: { x: 43, y: 86, width: 281, height: 346 }
      const el: ArrangementElement = {
        id: 'test-btn',
        bounds: { x: 400, y: 500, width: 100, height: 100 },
      };

      // 좌상단 피트니스존 1로 침범 시도
      const res = translateGroup([el], { x: -300, y: -300 }, {
        protectedZones: DEFAULT_PROTECTED_ZONES,
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;

      expect(res.reason).toBe('protected-zone-violation');
      expect(res.violatedElementId).toBe('test-btn');
      expect(res.elements[0].bounds).toEqual({ x: 400, y: 500, width: 100, height: 100 });
    });

    it('UIInteraction의 viewTransformToCoordinateTransform이 정확한 CoordinateTransform을 생성한다', async () => {
      const { viewTransformToCoordinateTransform } = await import('../../src/editor/ui/UIInteraction');

      const view = { dpr: 2.5, zoomPercent: 125 };
      const pan = { x: 15, y: -25 };
      const ct = viewTransformToCoordinateTransform(view, pan);

      expect(ct.zoom).toBe(1.25);
      expect(ct.dpr).toBe(2.5);
      expect(ct.panX).toBe(15);
      expect(ct.panY).toBe(-25);
    });
  });
});
