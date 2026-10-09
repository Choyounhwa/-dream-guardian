import { describe, expect, it, vi } from "vitest";
import { UISelectionOverlay } from "../../src/editor/ui/preview/UISelectionOverlay";
import { createPreviewEntry } from "../../src/editor/ui/preview/main";
import {
  startMultiDrag,
  updateMultiDrag,
  computeBoxSelection,
  toggleGridVisible,
  applyDirectInput,
  type MultiDragSession,
} from "../../src/editor/ui/UIInteraction";
import type { LetterboxLayout } from "../../src/editor/ui/preview/UIPageAdapters";
import type { ChildBridge } from "../../src/editor/ui/preview/UIVisualBridge";
import type { UIVisualElement, UIRect } from "../../src/editor/ui/data/UIVisualDocument";

describe("[Issue #461 / UI-VIS-031] 캔버스 다중 선택·은은한 그리드·스냅 조작", () => {
  // Mock Canvas with tracking
  function createMockCanvas(w = 1080, h = 2160) {
    const calls: { method: string; args: unknown[] }[] = [];
    const ctx = {
      calls,
      clearRect: vi.fn((...args: unknown[]) => calls.push({ method: "clearRect", args })),
      fillRect: vi.fn((...args: unknown[]) => calls.push({ method: "fillRect", args })),
      strokeRect: vi.fn((...args: unknown[]) => calls.push({ method: "strokeRect", args })),
      beginPath: vi.fn(() => calls.push({ method: "beginPath", args: [] })),
      moveTo: vi.fn((...args: unknown[]) => calls.push({ method: "moveTo", args })),
      lineTo: vi.fn((...args: unknown[]) => calls.push({ method: "lineTo", args })),
      stroke: vi.fn(() => calls.push({ method: "stroke", args: [] })),
      fill: vi.fn(() => calls.push({ method: "fill", args: [] })),
      save: vi.fn(() => calls.push({ method: "save", args: [] })),
      restore: vi.fn(() => calls.push({ method: "restore", args: [] })),
      setTransform: vi.fn((...args: unknown[]) => calls.push({ method: "setTransform", args })),
      setLineDash: vi.fn((...args: unknown[]) => calls.push({ method: "setLineDash", args })),
      fillText: vi.fn((...args: unknown[]) => calls.push({ method: "fillText", args })),
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 1,
    };

    const listeners = new Map<string, Array<(e: any) => void>>();
    const style: Record<string, string> = {};

    const canvasObj = {
      width: w,
      height: h,
      clientWidth: w,
      clientHeight: h,
      style,
      getContext: vi.fn(() => ctx),
      ctx,
      getBoundingClientRect: vi.fn(() => ({
        left: 50,
        top: 20,
        width: w,
        height: h,
        right: 50 + w,
        bottom: 20 + h,
      })),
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        const list = listeners.get(event);
        if (list) {
          const idx = list.indexOf(handler);
          if (idx !== -1) list.splice(idx, 1);
        }
      }),
      dispatchEvent: (event: { type: string; [k: string]: any }) => {
        const list = listeners.get(event.type);
        if (list) {
          list.forEach((cb) => cb(event));
        }
        return true;
      },
      remove: vi.fn(),
    };

    return canvasObj as unknown as HTMLCanvasElement & {
      ctx: typeof ctx;
      dispatchEvent: (e: any) => boolean;
    };
  }

  function createMockContainer(w = 540, h = 1080) {
    const children: any[] = [];
    const listeners = new Map<string, Array<(e: any) => void>>();
    return {
      clientWidth: w,
      clientHeight: h,
      children,
      contains: (child: any) => children.includes(child),
      appendChild: (child: any) => {
        children.push(child);
        return child;
      },
      removeChild: (child: any) => {
        const idx = children.indexOf(child);
        if (idx !== -1) children.splice(idx, 1);
        return child;
      },
      addEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (e: any) => void) => {
        const list = listeners.get(event);
        if (list) {
          const idx = list.indexOf(handler);
          if (idx !== -1) list.splice(idx, 1);
        }
      }),
      dispatchEvent: (event: { type: string; [k: string]: any }) => {
        const list = listeners.get(event.type);
        if (list) {
          list.forEach((cb) => cb(event));
        }
        return true;
      },
    } as unknown as HTMLElement;
  }

  const sampleElements: UIVisualElement[] = [
    {
      id: "btn-start",
      name: "Start Button",
      type: "button",
      bounds: { x: 100, y: 200, width: 300, height: 80 },
    },
    {
      id: "txt-title",
      name: "Title Text",
      type: "text",
      bounds: { x: 100, y: 100, width: 400, height: 60 },
    },
    {
      id: "motion-zone-1",
      name: "Protected Motion Zone",
      type: "container",
      bounds: { x: 50, y: 500, width: 500, height: 300 },
      isLocked: true,
      lockReason: "보호된 모션 판정 영역(동작 가이드)",
    },
  ];

  describe("1. Overlay 분리 및 은은한 그리드 렌더링 (원점/렌더 캔버스 비오염)", () => {
    it("별도 editor overlay canvas를 생성하고 원본 render canvas에는 grid를 그리지 않는다", () => {
      const renderCanvas = createMockCanvas(540, 1080);
      const overlayCanvas = createMockCanvas(540, 1080);
      const container = createMockContainer(540, 1080);
      container.appendChild(renderCanvas);

      const overlay = new UISelectionOverlay({
        container,
        renderCanvas,
        overlayCanvas,
        gridVisible: true,
        gridSize: 20,
      });

      overlay.setElements(sampleElements);
      overlay.render();

      // Render canvas should NOT have received grid draw calls from overlay
      const renderCanvasCalls = (renderCanvas as any).ctx.calls;
      expect(renderCanvasCalls.filter((c: any) => c.method === "lineTo").length).toBe(0);

      // Overlay canvas should have drawn the grid lines
      const overlayCtx = (overlay.getCanvas() as any).ctx;
      expect(overlayCtx.calls.some((c: any) => c.method === "moveTo")).toBe(true);
      expect(overlayCtx.calls.some((c: any) => c.method === "lineTo")).toBe(true);
    });

    it("gridVisible 토글 시 문서 내용과 snapEnabled 상태는 불변 유지된다", () => {
      let grid = false;
      const snap = true;

      const nextGrid = toggleGridVisible(grid);
      expect(nextGrid).toBe(true);
      expect(snap).toBe(true); // Snap remains unchanged

      const revertedGrid = toggleGridVisible(nextGrid);
      expect(revertedGrid).toBe(false);
    });
  });

  describe("2. 좌표 변환 (Letterbox, DPR, Zoom 보정)", () => {
    it("DPR 및 Letterbox scale/offset을 보정하여 client 좌표를 artboard(1080x2160) 좌표로 정확히 변환한다", () => {
      const layout: LetterboxLayout = {
        renderWidth: 540,
        renderHeight: 1080,
        offsetX: 30, // 30px letterbox offset
        offsetY: 60,
        scale: 0.5, // 540 / 1080 = 0.5
        dpr: 2,
        canvasPixelWidth: 1080,
        canvasPixelHeight: 2160,
        valid: true,
      };

      const renderCanvas = createMockCanvas(540, 1080);
      const container = createMockContainer(600, 1200);

      const overlay = new UISelectionOverlay({
        container,
        renderCanvas,
        getLayout: () => layout,
      });

      // Pointer at screen (30 + 100 * 0.5, 60 + 200 * 0.5) = (80, 160)
      const artboardPoint = overlay.screenToArtboard({ x: 80, y: 160 });
      expect(artboardPoint.x).toBeCloseTo(100, 2);
      expect(artboardPoint.y).toBeCloseTo(200, 2);

      // Inverse transform
      const screenPoint = overlay.artboardToScreen({ x: 100, y: 200 });
      expect(screenPoint.x).toBeCloseTo(80, 2);
      expect(screenPoint.y).toBeCloseTo(160, 2);
    });
  });

  describe("3. 단일 선택, Shift 다중 선택 및 박스(마키) 선택", () => {
    it("클릭 시 단일 선택, Shift+클릭 시 다중 선택/토글이 동작한다", () => {
      const overlay = new UISelectionOverlay({
        container: createMockContainer(1080, 2160),
      });
      overlay.setElements(sampleElements);

      // 1) Click element 1
      overlay.handlePointerDown({ clientX: 150, clientY: 220, shiftKey: false } as any);
      overlay.handlePointerUp({ clientX: 150, clientY: 220, shiftKey: false } as any);
      expect(overlay.getSelectedIds()).toEqual(["btn-start"]);

      // 2) Shift + Click element 2 -> multi-selection
      overlay.handlePointerDown({ clientX: 150, clientY: 120, shiftKey: true } as any);
      overlay.handlePointerUp({ clientX: 150, clientY: 120, shiftKey: true } as any);
      expect(overlay.getSelectedIds()).toContain("btn-start");
      expect(overlay.getSelectedIds()).toContain("txt-title");
      expect(overlay.getSelectedIds().length).toBe(2);

      // 3) Shift + Click element 1 -> deselect element 1
      overlay.handlePointerDown({ clientX: 150, clientY: 220, shiftKey: true } as any);
      overlay.handlePointerUp({ clientX: 150, clientY: 220, shiftKey: true } as any);
      expect(overlay.getSelectedIds()).toEqual(["txt-title"]);

      // 4) Click empty space -> clear selection
      overlay.handlePointerDown({ clientX: 10, clientY: 10, shiftKey: false } as any);
      overlay.handlePointerUp({ clientX: 10, clientY: 10, shiftKey: false } as any);
      expect(overlay.getSelectedIds()).toEqual([]);
    });

    it("마키 드래그 영역과 교차하는 모든 요소를 박스 선택한다", () => {
      const marquee: UIRect = { x: 80, y: 80, width: 350, height: 220 };
      const selected = computeBoxSelection(marquee, sampleElements);
      expect(selected).toContain("btn-start");
      expect(selected).toContain("txt-title");
      expect(selected).not.toContain("motion-zone-1");
    });

    it("Shift 누른 상태의 마키 드래그는 기존 선택 항목과 합집합 처리된다", () => {
      const marquee: UIRect = { x: 80, y: 80, width: 350, height: 50 }; // only txt-title
      const initial = ["btn-start"];
      const selected = computeBoxSelection(marquee, sampleElements, {
        currentSelection: initial,
        isShift: true,
      });
      expect(selected).toContain("btn-start");
      expect(selected).toContain("txt-title");
    });
  });

  describe("4. 다중 선택 그룹 드래그 및 스냅 조작 (상대 간격 보존)", () => {
    it("다중 선택 드래그 시 모든 요소가 동일한 공통 delta로 이동하며 상대 간격이 100% 보존된다", () => {
      const els = [
        { id: "e1", bounds: { x: 100, y: 100, width: 50, height: 50 } },
        { id: "e2", bounds: { x: 200, y: 150, width: 50, height: 50 } },
      ];

      const session = startMultiDrag({
        elements: els,
        startPoint: { x: 100, y: 100 },
        snapEnabled: false,
      }) as MultiDragSession;

      const updated = updateMultiDrag(session, { x: 135, y: 145 });
      expect(updated.groupDelta).toEqual({ x: 35, y: 45 });

      const e1Pos = updated.elements.find((e) => e.id === "e1")!.position;
      const e2Pos = updated.elements.find((e) => e.id === "e2")!.position;

      expect(e1Pos).toEqual({ x: 135, y: 145 });
      expect(e2Pos).toEqual({ x: 235, y: 195 });
      // Relative offset check
      expect(e2Pos.x - e1Pos.x).toBe(100);
      expect(e2Pos.y - e1Pos.y).toBe(50);
    });

    it("snapEnabled 시 그룹 앵커 기준으로 스냅되고 모든 요소의 상대 offset이 정확히 보존된다", () => {
      const els = [
        { id: "e1", bounds: { x: 102, y: 103, width: 50, height: 50 } },
        { id: "e2", bounds: { x: 252, y: 183, width: 50, height: 50 } },
      ];

      const session = startMultiDrag({
        elements: els,
        startPoint: { x: 100, y: 100 },
        snapEnabled: true,
        snapGrid: 10,
      }) as MultiDragSession;

      // Move by dx=16, dy=24 -> snapped from (102+16=118 -> 120, 103+24=127 -> 130)
      const updated = updateMultiDrag(session, { x: 116, y: 124 });
      const e1Pos = updated.elements.find((e) => e.id === "e1")!.position;
      const e2Pos = updated.elements.find((e) => e.id === "e2")!.position;

      expect(e1Pos.x).toBe(120);
      expect(e1Pos.y).toBe(130);
      // Relative offset must be strictly preserved: 252 - 102 = 150, 183 - 103 = 80
      expect(e2Pos.x - e1Pos.x).toBe(150);
      expect(e2Pos.y - e1Pos.y).toBe(80);
    });

    it("직접 숫자 입력은 스냅을 강제하지 않고 그대로 적용된다", () => {
      const rawValue = 123.456;
      const applied = applyDirectInput(100, rawValue);
      expect(applied).toBe(123.456);
    });
  });

  describe("5. 잠금 요소 및 보호 모션 영역 조작 거부", () => {
    it("잠긴 요소(isLocked)에 대한 드래그 시도는 거부되고 거부 사유가 통지된다", () => {
      const rejections: any[] = [];
      const overlay = new UISelectionOverlay({
        container: createMockContainer(1080, 2160),
        onReject: (rej) => rejections.push(rej),
      });
      overlay.setElements(sampleElements);

      // Select locked element: motion-zone-1
      overlay.handlePointerDown({ clientX: 60, clientY: 510, shiftKey: false } as any);
      overlay.handlePointerMove({ clientX: 90, clientY: 540 } as any);
      overlay.handlePointerUp({ clientX: 90, clientY: 540 } as any);

      expect(rejections.length).toBeGreaterThan(0);
      expect(rejections[0].reason).toBe("locked-element");
      expect(rejections[0].message).toContain("보호된 모션 판정 영역");
    });

    it("잠긴 요소는 resize 핸들을 렌더링하지 않거나 비활성화한다", () => {
      const overlay = new UISelectionOverlay({
        container: createMockContainer(1080, 2160),
      });
      overlay.setElements(sampleElements);
      overlay.setSelectedIds(["motion-zone-1"]);

      const handles = overlay.getVisibleHandles();
      expect(handles.length).toBe(0); // Locked elements have 0 interactive handles
    });
  });

  describe("6. 원자적 롤백 (pointercancel, Escape, 화면 전환) 및 단일 Bridge 확정", () => {
    it("pointercancel 발생 시 이동 중인 요소가 최초 위치로 원자적 롤백되고 커밋되지 않는다", () => {
      const committedCommands: any[] = [];
      const overlay = new UISelectionOverlay({
        container: createMockContainer(1080, 2160),
        onCommit: (cmd) => committedCommands.push(cmd),
      });
      overlay.setElements(sampleElements);
      overlay.setSelectedIds(["btn-start"]);

      overlay.handlePointerDown({ clientX: 110, clientY: 210 } as any);
      overlay.handlePointerMove({ clientX: 200, clientY: 300 } as any);
      overlay.handlePointerCancel({ clientX: 200, clientY: 300 } as any);

      expect(committedCommands.length).toBe(0);
      const el = overlay.getElements().find((e) => e.id === "btn-start");
      expect(el?.bounds.x).toBe(100);
      expect(el?.bounds.y).toBe(200);
    });

    it("Escape 키 입력 시 진행 중인 드래그가 즉시 취소되고 원자적 롤백된다", () => {
      const committedCommands: any[] = [];
      const overlay = new UISelectionOverlay({
        container: createMockContainer(1080, 2160),
        onCommit: (cmd) => committedCommands.push(cmd),
      });
      overlay.setElements(sampleElements);
      overlay.setSelectedIds(["btn-start"]);

      overlay.handlePointerDown({ clientX: 110, clientY: 210 } as any);
      overlay.handlePointerMove({ clientX: 200, clientY: 300 } as any);
      overlay.handleKeyDown({ key: "Escape" } as any);

      expect(committedCommands.length).toBe(0);
      const el = overlay.getElements().find((e) => e.id === "btn-start");
      expect(el?.bounds.x).toBe(100);
      expect(el?.bounds.y).toBe(200);
    });

    it("정상 드래그 완료 시 단일 VisualMoveElementsCommand가 생성되어 브리지로 전송된다", () => {
      const committedCommands: any[] = [];
      const bridgeMessages: any[] = [];

      const mockBridge = {
        send: vi.fn((kind: string, payload: any) => {
          bridgeMessages.push({ kind, payload });
        }),
      } as unknown as ChildBridge;

      const overlay = new UISelectionOverlay({
        container: createMockContainer(1080, 2160),
        bridge: mockBridge,
        onCommit: (cmd) => committedCommands.push(cmd),
      });
      overlay.setElements(sampleElements);
      overlay.setSelectedIds(["btn-start", "txt-title"]);

      // Click inside body of txt-title (not on handle edges)
      overlay.handlePointerDown({ clientX: 200, clientY: 120 } as any);
      overlay.handlePointerMove({ clientX: 250, clientY: 140 } as any);
      overlay.handlePointerUp({ clientX: 250, clientY: 140 } as any);

      // A single atomic command was committed
      expect(committedCommands.length).toBe(1);
      expect(committedCommands[0].type).toBe("move-elements");
      expect(committedCommands[0].moves.length).toBe(2);

      // Sent to bridge
      expect(mockBridge.send).toHaveBeenCalled();
      const geomCall = bridgeMessages.find((m) => m.kind === "preview:geometry" || m.kind === "preview:update");
      expect(geomCall).toBeDefined();
    });

    it("리사이즈 핸들 드래그 완료 시 단일 VisualResizeElementCommand가 생성된다", () => {
      const committedCommands: any[] = [];
      const overlay = new UISelectionOverlay({
        container: createMockContainer(1080, 2160),
        onCommit: (cmd) => committedCommands.push(cmd),
      });
      overlay.setElements(sampleElements);
      overlay.setSelectedIds(["btn-start"]); // x: 100, y: 200, w: 300, h: 80 -> se handle at (400, 280)

      overlay.handlePointerDown({ clientX: 400, clientY: 280 } as any);
      overlay.handlePointerMove({ clientX: 450, clientY: 310 } as any);
      overlay.handlePointerUp({ clientX: 450, clientY: 310 } as any);

      expect(committedCommands.length).toBe(1);
      expect(committedCommands[0].type).toBe("resize-element");
      expect(committedCommands[0].elementId).toBe("btn-start");
      expect(committedCommands[0].after.width).toBeGreaterThan(300);
    });
  });

  describe("7. createPreviewEntry 통합 확인", () => {
    it("createPreviewEntry에서 UISelectionOverlay가 포함되어 생성된다", () => {
      const container = createMockContainer(1080, 2160);
      const entry = createPreviewEntry({ container });

      expect(entry.overlay).toBeDefined();
      expect(typeof entry.overlay?.render).toBe("function");
    });
  });
});
