import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  type LetterboxLayout,
  computeLetterboxLayout,
} from "./UIPageAdapters";
import type { ChildBridge } from "./UIVisualBridge";
import type { UIRect, UIVisualElement } from "../data/UIVisualDocument";
import type {
  VisualMoveElementsCommand,
  VisualResizeElementCommand,
  VisualMoveElementItem,
} from "../UICommands";
import {
  startMultiDrag,
  updateMultiDrag,
  commitMultiDrag,
  cancelMultiDrag,
  computeBoxSelection,
  SNAP_PX,
  type MultiDragSession,
  type Point,
} from "../UIInteraction";

export interface OverlayHitResult {
  hitType: "handle" | "element" | "empty";
  elementId?: string;
  handleType?: ResizeHandleType;
}

export type ResizeHandleType = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface ResizeHandleInfo {
  type: ResizeHandleType;
  bounds: UIRect;
  elementId: string;
}

export interface UISelectionOverlayOptions {
  container: HTMLElement;
  renderCanvas?: HTMLCanvasElement;
  overlayCanvas?: HTMLCanvasElement;
  bridge?: ChildBridge;
  getLayout?: () => LetterboxLayout | undefined;
  gridVisible?: boolean;
  snapEnabled?: boolean;
  gridSize?: number;
  initialElements?: UIVisualElement[];
  initialSelectedIds?: string[];
  pageId?: string;
  onSelectionChange?: (selectedIds: string[]) => void;
  onCommit?: (command: VisualMoveElementsCommand | VisualResizeElementCommand) => void;
  onReject?: (rejection: { reason: string; message: string; elementId?: string }) => void;
  window?: Window;
}

const HANDLE_SIZE = 8;
const MIN_RESIZE_SIZE = 10;

let commandCounter = 0;
function nextCommandId(prefix: string): string {
  commandCounter += 1;
  return `${prefix}-${Date.now()}-${commandCounter}`;
}

function isElementProtected(el: UIVisualElement): boolean {
  return !!(el.isLocked || (el as { isProtected?: boolean }).isProtected);
}

export class UISelectionOverlay {
  private container: HTMLElement;
  private renderCanvas?: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private bridge?: ChildBridge;
  private customGetLayout?: () => LetterboxLayout | undefined;

  private gridVisible: boolean;
  private snapEnabled: boolean;
  private gridSize: number;
  private pageId: string;

  private elements: UIVisualElement[] = [];
  private selectedIds: string[] = [];

  // Drag states
  private multiDragSession: MultiDragSession | null = null;
  private isMarquee = false;
  private marqueeStart: Point | null = null;
  private marqueeCurrent: Point | null = null;

  // Resize states
  private isResize = false;
  private resizeHandle: ResizeHandleType | null = null;
  private resizeElementId: string | null = null;
  private resizeInitialBounds: UIRect | null = null;
  private resizeStartPoint: Point | null = null;

  // Initial bounds map for atomic rollback
  private initialElementBounds: Map<string, UIRect> = new Map();

  private onSelectionChange?: (selectedIds: string[]) => void;
  private onCommit?: (command: VisualMoveElementsCommand | VisualResizeElementCommand) => void;
  private onReject?: (rejection: { reason: string; message: string; elementId?: string }) => void;

  private disposed = false;
  private boundOnPointerDown: (e: any) => void;
  private boundOnPointerMove: (e: any) => void;
  private boundOnPointerUp: (e: any) => void;
  private boundOnPointerCancel: (e: any) => void;
  private boundOnKeyDown: (e: any) => void;

  constructor(options: UISelectionOverlayOptions) {
    this.container = options.container;
    this.renderCanvas = options.renderCanvas;
    this.bridge = options.bridge;
    this.customGetLayout = options.getLayout;
    this.gridVisible = options.gridVisible ?? false;
    this.snapEnabled = options.snapEnabled ?? true;
    this.gridSize = options.gridSize ?? SNAP_PX;
    this.pageId = options.pageId ?? "menu_main";

    this.onSelectionChange = options.onSelectionChange;
    this.onCommit = options.onCommit;
    this.onReject = options.onReject;

    if (options.initialElements) {
      this.elements = options.initialElements.map((el) => ({
        ...el,
        bounds: { ...el.bounds },
      }));
    }
    if (options.initialSelectedIds) {
      this.selectedIds = [...options.initialSelectedIds];
    }

    const win = options.window ?? (typeof window !== "undefined" ? window : undefined);
    const doc = win?.document ?? (typeof document !== "undefined" ? document : undefined);

    if (options.overlayCanvas) {
      this.overlayCanvas = options.overlayCanvas;
    } else if (doc && typeof doc.createElement === "function") {
      this.overlayCanvas = doc.createElement("canvas");
    } else {
      const calls: { method: string; args: unknown[] }[] = [];
      const dummyCtx = {
        calls,
        clearRect: (...args: any[]) => calls.push({ method: "clearRect", args }),
        fillRect: (...args: any[]) => calls.push({ method: "fillRect", args }),
        strokeRect: (...args: any[]) => calls.push({ method: "strokeRect", args }),
        beginPath: () => calls.push({ method: "beginPath", args: [] }),
        moveTo: (...args: any[]) => calls.push({ method: "moveTo", args }),
        lineTo: (...args: any[]) => calls.push({ method: "lineTo", args }),
        stroke: () => calls.push({ method: "stroke", args: [] }),
        fill: () => calls.push({ method: "fill", args: [] }),
        save: () => calls.push({ method: "save", args: [] }),
        restore: () => calls.push({ method: "restore", args: [] }),
        setTransform: (...args: any[]) => calls.push({ method: "setTransform", args }),
        setLineDash: (...args: any[]) => calls.push({ method: "setLineDash", args }),
        fillText: (...args: any[]) => calls.push({ method: "fillText", args }),
        strokeStyle: "",
        fillStyle: "",
        lineWidth: 1,
      };
      const dummyStyle: Record<string, string> = {};
      this.overlayCanvas = {
        clientWidth: this.container.clientWidth || 1080,
        clientHeight: this.container.clientHeight || 2160,
        width: 1080,
        height: 2160,
        style: dummyStyle,
        getContext: () => dummyCtx,
        ctx: dummyCtx,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      } as unknown as HTMLCanvasElement;
    }

    this.overlayCanvas.className = "ui-selection-overlay";
    this.overlayCanvas.style.position = "absolute";
    this.overlayCanvas.style.pointerEvents = "auto";
    this.overlayCanvas.style.zIndex = "10";

    if (this.container && !this.container.contains?.(this.overlayCanvas)) {
      this.container.appendChild(this.overlayCanvas);
    }

    this.ctx = this.overlayCanvas.getContext?.("2d") ?? null;

    // Bridge message listener
    if (this.bridge) {
      const bridgeAny = this.bridge as any;
      const originalOnMessage = bridgeAny._onMessage;
      bridgeAny._onMessage = (envelope: any) => {
        originalOnMessage?.(envelope);
        if (this.disposed) return;
        if (envelope.kind === "preview:snapshot") {
          if (envelope.payload && Array.isArray((envelope.payload as any).elements)) {
            this.setElements((envelope.payload as any).elements);
          }
        } else if (envelope.kind === "preview:selection") {
          const selected =
            envelope.payload?.selectedElementIds ??
            (envelope.payload?.elementId ? [envelope.payload.elementId] : []);
          this.setSelectedIds(selected);
        }
      };
    }

    this.boundOnPointerDown = (e: any) => this.handlePointerDown(e);
    this.boundOnPointerMove = (e: any) => this.handlePointerMove(e);
    this.boundOnPointerUp = (e: any) => this.handlePointerUp(e);
    this.boundOnPointerCancel = (e: any) => this.handlePointerCancel(e);
    this.boundOnKeyDown = (e: any) => this.handleKeyDown(e);

    this.overlayCanvas.addEventListener?.("pointerdown", this.boundOnPointerDown);
    this.overlayCanvas.addEventListener?.("pointermove", this.boundOnPointerMove);
    this.overlayCanvas.addEventListener?.("pointerup", this.boundOnPointerUp);
    this.overlayCanvas.addEventListener?.("pointercancel", this.boundOnPointerCancel);
    win?.addEventListener?.("keydown", this.boundOnKeyDown);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.overlayCanvas;
  }

  public getRenderCanvas(): HTMLCanvasElement | undefined {
    return this.renderCanvas;
  }

  public getElements(): UIVisualElement[] {
    return this.elements;
  }

  public setElements(elements: UIVisualElement[]): void {
    this.elements = elements.map((el) => ({
      ...el,
      bounds: { ...el.bounds },
    }));
    this.render();
  }

  public getSelectedIds(): string[] {
    return [...this.selectedIds];
  }

  public setSelectedIds(ids: string[]): void {
    this.selectedIds = [...ids];
    this.render();
  }

  public isGridVisible(): boolean {
    return this.gridVisible;
  }

  public setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    this.render();
  }

  public isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  public setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  public getGridSize(): number {
    return this.gridSize;
  }

  public setGridSize(size: number): void {
    this.gridSize = size;
    this.render();
  }

  public getLayout(): LetterboxLayout {
    if (this.customGetLayout) {
      const custom = this.customGetLayout();
      if (custom) return custom;
    }
    const cw = this.container.clientWidth || 540;
    const ch = this.container.clientHeight || 1080;
    return computeLetterboxLayout(cw, ch, 1);
  }

  public screenToArtboard(screenPoint: Point): Point {
    const layout = this.getLayout();
    if (!layout || !layout.valid) {
      return { x: screenPoint.x, y: screenPoint.y };
    }
    const scale = layout.scale || 1;
    const offsetX = layout.offsetX || 0;
    const offsetY = layout.offsetY || 0;
    return {
      x: (screenPoint.x - offsetX) / scale,
      y: (screenPoint.y - offsetY) / scale,
    };
  }

  public artboardToScreen(artboardPoint: Point): Point {
    const layout = this.getLayout();
    if (!layout || !layout.valid) {
      return { x: artboardPoint.x, y: artboardPoint.y };
    }
    const scale = layout.scale || 1;
    const offsetX = layout.offsetX || 0;
    const offsetY = layout.offsetY || 0;
    return {
      x: offsetX + artboardPoint.x * scale,
      y: offsetY + artboardPoint.y * scale,
    };
  }

  public getPointFromEvent(e: { clientX?: number; clientY?: number; x?: number; y?: number }): Point {
    const rawX = e.clientX ?? e.x ?? 0;
    const rawY = e.clientY ?? e.y ?? 0;
    return this.screenToArtboard({ x: rawX, y: rawY });
  }

  public getVisibleHandles(): ResizeHandleInfo[] {
    const handles: ResizeHandleInfo[] = [];
    for (const id of this.selectedIds) {
      const el = this.elements.find((e) => e.id === id);
      if (!el) continue;
      // Locked elements do NOT have resize handles
      if (isElementProtected(el)) continue;

      const b = el.bounds;
      const hw = HANDLE_SIZE;
      const hh = HANDLE_SIZE;

      handles.push(
        { type: "nw", bounds: { x: b.x - hw / 2, y: b.y - hh / 2, width: hw, height: hh }, elementId: el.id },
        { type: "n", bounds: { x: b.x + b.width / 2 - hw / 2, y: b.y - hh / 2, width: hw, height: hh }, elementId: el.id },
        { type: "ne", bounds: { x: b.x + b.width - hw / 2, y: b.y - hh / 2, width: hw, height: hh }, elementId: el.id },
        { type: "e", bounds: { x: b.x + b.width - hw / 2, y: b.y + b.height / 2 - hh / 2, width: hw, height: hh }, elementId: el.id },
        { type: "se", bounds: { x: b.x + b.width - hw / 2, y: b.y + b.height - hh / 2, width: hw, height: hh }, elementId: el.id },
        { type: "s", bounds: { x: b.x + b.width / 2 - hw / 2, y: b.y + b.height - hh / 2, width: hw, height: hh }, elementId: el.id },
        { type: "sw", bounds: { x: b.x - hw / 2, y: b.y + b.height - hh / 2, width: hw, height: hh }, elementId: el.id },
        { type: "w", bounds: { x: b.x - hw / 2, y: b.y + b.height / 2 - hh / 2, width: hw, height: hh }, elementId: el.id }
      );
    }
    return handles;
  }

  public hitTest(point: Point): OverlayHitResult {
    // 1. Check resize handles of selected elements
    const handles = this.getVisibleHandles();
    for (let i = handles.length - 1; i >= 0; i--) {
      const h = handles[i];
      if (
        point.x >= h.bounds.x &&
        point.x <= h.bounds.x + h.bounds.width &&
        point.y >= h.bounds.y &&
        point.y <= h.bounds.y + h.bounds.height
      ) {
        return { hitType: "handle", elementId: h.elementId, handleType: h.type };
      }
    }

    // 2. Check elements in reverse z-order
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      const b = el.bounds;
      if (
        point.x >= b.x &&
        point.x <= b.x + b.width &&
        point.y >= b.y &&
        point.y <= b.y + b.height
      ) {
        return { hitType: "element", elementId: el.id };
      }
    }

    return { hitType: "empty" };
  }

  public handlePointerDown(e: any): void {
    if (this.disposed) return;
    const pt = this.getPointFromEvent(e);
    const hit = this.hitTest(pt);

    // Snapshot current element positions for atomic rollback
    this.initialElementBounds.clear();
    this.elements.forEach((el) => {
      this.initialElementBounds.set(el.id, { ...el.bounds });
    });

    if (hit.hitType === "handle" && hit.elementId && hit.handleType) {
      const el = this.elements.find((item) => item.id === hit.elementId);
      if (el && isElementProtected(el)) {
        this.onReject?.({
          reason: "locked-element",
          message: el.lockReason ?? `Cannot modify locked element "${el.id}"`,
          elementId: el.id,
        });
        return;
      }
      this.isResize = true;
      this.resizeHandle = hit.handleType;
      this.resizeElementId = hit.elementId;
      this.resizeInitialBounds = el ? { ...el.bounds } : null;
      this.resizeStartPoint = { ...pt };
      return;
    }

    if (hit.hitType === "element" && hit.elementId) {
      const isShift = !!e.shiftKey;

      if (isShift) {
        if (this.selectedIds.includes(hit.elementId)) {
          this.selectedIds = this.selectedIds.filter((id) => id !== hit.elementId);
        } else {
          this.selectedIds.push(hit.elementId);
        }
      } else {
        if (!this.selectedIds.includes(hit.elementId)) {
          this.selectedIds = [hit.elementId];
        }
      }

      this.onSelectionChange?.([...this.selectedIds]);
      this.bridge?.send("preview:selection", { selectedElementIds: [...this.selectedIds] });

      const selectedElements = this.elements.filter((item) =>
        this.selectedIds.includes(item.id)
      );

      // Check if any selected element is locked
      const locked = selectedElements.find((item) => isElementProtected(item));
      if (locked) {
        this.onReject?.({
          reason: "locked-element",
          message: locked.lockReason ?? `Cannot modify locked element "${locked.id}"`,
          elementId: locked.id,
        });
        this.render();
        return;
      }

      const dragResult = startMultiDrag({
        elements: selectedElements,
        startPoint: pt,
        snapEnabled: this.snapEnabled,
        snapGrid: this.gridSize,
      });

      if ("active" in dragResult) {
        this.multiDragSession = dragResult;
      }

      this.render();
      return;
    }

    // Empty area click
    if (!e.shiftKey) {
      this.selectedIds = [];
      this.onSelectionChange?.([]);
      this.bridge?.send("preview:selection", { selectedElementIds: [] });
    }

    this.isMarquee = true;
    this.marqueeStart = { ...pt };
    this.marqueeCurrent = { ...pt };
    this.render();
  }

  public handlePointerMove(e: any): void {
    if (this.disposed) return;
    const pt = this.getPointFromEvent(e);

    if (this.isResize && this.resizeElementId && this.resizeInitialBounds && this.resizeStartPoint) {
      const el = this.elements.find((item) => item.id === this.resizeElementId);
      if (el) {
        const dx = pt.x - this.resizeStartPoint.x;
        const dy = pt.y - this.resizeStartPoint.y;
        let nb = { ...this.resizeInitialBounds };

        switch (this.resizeHandle) {
          case "se":
            nb.width = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.width + dx);
            nb.height = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.height + dy);
            break;
          case "e":
            nb.width = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.width + dx);
            break;
          case "s":
            nb.height = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.height + dy);
            break;
          case "nw":
            nb.x = this.resizeInitialBounds.x + dx;
            nb.y = this.resizeInitialBounds.y + dy;
            nb.width = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.width - dx);
            nb.height = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.height - dy);
            break;
          case "sw":
            nb.x = this.resizeInitialBounds.x + dx;
            nb.width = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.width - dx);
            nb.height = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.height + dy);
            break;
          case "ne":
            nb.y = this.resizeInitialBounds.y + dy;
            nb.width = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.width + dx);
            nb.height = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.height - dy);
            break;
          case "n":
            nb.y = this.resizeInitialBounds.y + dy;
            nb.height = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.height - dy);
            break;
          case "w":
            nb.x = this.resizeInitialBounds.x + dx;
            nb.width = Math.max(MIN_RESIZE_SIZE, this.resizeInitialBounds.width - dx);
            break;
        }

        if (this.snapEnabled) {
          nb.x = Math.round(nb.x / this.gridSize) * this.gridSize;
          nb.y = Math.round(nb.y / this.gridSize) * this.gridSize;
          nb.width = Math.round(nb.width / this.gridSize) * this.gridSize;
          nb.height = Math.round(nb.height / this.gridSize) * this.gridSize;
        }

        el.bounds = nb;
        this.render();
      }
      return;
    }

    if (this.multiDragSession && this.multiDragSession.active) {
      const updated = updateMultiDrag(this.multiDragSession, pt);
      for (const item of updated.elements) {
        const el = this.elements.find((e) => e.id === item.id);
        if (el) {
          el.bounds = { ...item.bounds };
        }
      }
      this.render();
      return;
    }

    if (this.isMarquee && this.marqueeStart) {
      this.marqueeCurrent = { ...pt };
      this.render();
      return;
    }
  }

  public handlePointerUp(e: any): void {
    if (this.disposed) return;

    if (this.isResize && this.resizeElementId && this.resizeInitialBounds) {
      const el = this.elements.find((item) => item.id === this.resizeElementId);
      if (el) {
        const changed =
          el.bounds.x !== this.resizeInitialBounds.x ||
          el.bounds.y !== this.resizeInitialBounds.y ||
          el.bounds.width !== this.resizeInitialBounds.width ||
          el.bounds.height !== this.resizeInitialBounds.height;

        if (changed) {
          const command: VisualResizeElementCommand = {
            id: nextCommandId("cmd-resize"),
            type: "resize-element",
            pageId: this.pageId as any,
            elementId: this.resizeElementId,
            before: { ...this.resizeInitialBounds },
            after: { ...el.bounds },
          };
          this.onCommit?.(command);
          this.bridge?.send("preview:geometry", { command });
          this.bridge?.send("preview:update", { command });
        }
      }
      this.isResize = false;
      this.resizeHandle = null;
      this.resizeElementId = null;
      this.resizeInitialBounds = null;
      this.resizeStartPoint = null;
      this.render();
      return;
    }

    if (this.multiDragSession && this.multiDragSession.active) {
      const committed = commitMultiDrag(this.multiDragSession);
      const moves: VisualMoveElementItem[] = [];

      for (const item of committed.elements) {
        const initB = this.initialElementBounds.get(item.id);
        if (initB && (initB.x !== item.bounds.x || initB.y !== item.bounds.y)) {
          moves.push({
            elementId: item.id,
            before: { ...initB },
            after: { ...item.bounds },
          });
        }
      }

      if (moves.length > 0) {
        const command: VisualMoveElementsCommand = {
          id: nextCommandId("cmd-move"),
          type: "move-elements",
          pageId: this.pageId as any,
          moves,
        };
        this.onCommit?.(command);
        this.bridge?.send("preview:geometry", { command });
        this.bridge?.send("preview:update", { command });
      }

      this.multiDragSession = null;
      this.render();
      return;
    }

    if (this.isMarquee && this.marqueeStart && this.marqueeCurrent) {
      const mx = Math.min(this.marqueeStart.x, this.marqueeCurrent.x);
      const my = Math.min(this.marqueeStart.y, this.marqueeCurrent.y);
      const mw = Math.abs(this.marqueeCurrent.x - this.marqueeStart.x);
      const mh = Math.abs(this.marqueeCurrent.y - this.marqueeStart.y);

      const marqueeRect: UIRect = { x: mx, y: my, width: mw, height: mh };
      const selected = computeBoxSelection(marqueeRect, this.elements, {
        currentSelection: this.selectedIds,
        isShift: !!e.shiftKey,
      });

      this.selectedIds = selected;
      this.onSelectionChange?.([...this.selectedIds]);
      this.bridge?.send("preview:selection", { selectedElementIds: [...this.selectedIds] });

      this.isMarquee = false;
      this.marqueeStart = null;
      this.marqueeCurrent = null;
      this.render();
      return;
    }
  }

  public handlePointerCancel(_e: any): void {
    this.rollback();
  }

  public handleKeyDown(e: any): void {
    if (e.key === "Escape") {
      this.rollback();
    }
  }

  public rollback(): void {
    if (this.disposed) return;
    if (this.multiDragSession) {
      cancelMultiDrag(this.multiDragSession, "pointercancel");
      this.multiDragSession = null;
    }
    // Revert bounds from initialElementBounds
    this.initialElementBounds.forEach((initB, id) => {
      const el = this.elements.find((e) => e.id === id);
      if (el) {
        el.bounds = { ...initB };
      }
    });

    this.isResize = false;
    this.resizeHandle = null;
    this.resizeElementId = null;
    this.resizeInitialBounds = null;
    this.resizeStartPoint = null;

    this.isMarquee = false;
    this.marqueeStart = null;
    this.marqueeCurrent = null;

    this.render();
  }

  public render(): void {
    if (this.disposed) return;
    const layout = this.getLayout();
    const ctx = this.ctx ?? this.overlayCanvas.getContext?.("2d");
    if (!ctx) return;

    if (layout.valid && this.overlayCanvas) {
      this.overlayCanvas.style.position = "absolute";
      this.overlayCanvas.style.left = `${layout.offsetX}px`;
      this.overlayCanvas.style.top = `${layout.offsetY}px`;
      this.overlayCanvas.style.width = `${layout.renderWidth}px`;
      this.overlayCanvas.style.height = `${layout.renderHeight}px`;
      this.overlayCanvas.width = layout.canvasPixelWidth;
      this.overlayCanvas.height = layout.canvasPixelHeight;
    }

    ctx.save();
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(layout.dpr * layout.scale, 0, 0, layout.dpr * layout.scale, 0, 0);
    }

    // 1. Draw subtle grid
    if (this.gridVisible) {
      ctx.save();
      ctx.strokeStyle = "rgba(40, 230, 255, 0.12)";
      ctx.lineWidth = 1 / (layout.scale || 1);
      ctx.beginPath();

      for (let x = 0; x <= ARTBOARD_WIDTH; x += this.gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ARTBOARD_HEIGHT);
      }
      for (let y = 0; y <= ARTBOARD_HEIGHT; y += this.gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(ARTBOARD_WIDTH, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw selection outlines & handles
    for (const id of this.selectedIds) {
      const el = this.elements.find((e) => e.id === id);
      if (!el) continue;
      const b = el.bounds;

      ctx.save();
      if (isElementProtected(el)) {
        ctx.strokeStyle = "rgba(235, 87, 87, 0.85)";
        ctx.lineWidth = 2 / (layout.scale || 1);
        if (typeof ctx.setLineDash === "function") {
          ctx.setLineDash([6 / layout.scale, 4 / layout.scale]);
        }
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        ctx.fillStyle = "rgba(235, 87, 87, 0.9)";
        ctx.fillText("🔒 잠김", b.x + 4, b.y + 16);
      } else {
        ctx.strokeStyle = "rgba(40, 230, 255, 0.95)";
        ctx.lineWidth = 2 / (layout.scale || 1);
        ctx.strokeRect(b.x, b.y, b.width, b.height);

        // Draw handles
        const handles = this.getVisibleHandles().filter((h) => h.elementId === el.id);
        for (const h of handles) {
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "rgba(40, 230, 255, 1.0)";
          ctx.lineWidth = 1.5 / (layout.scale || 1);
          ctx.fillRect(h.bounds.x, h.bounds.y, h.bounds.width, h.bounds.height);
          ctx.strokeRect(h.bounds.x, h.bounds.y, h.bounds.width, h.bounds.height);
        }
      }
      ctx.restore();
    }

    // 3. Draw Marquee drag rectangle
    if (this.isMarquee && this.marqueeStart && this.marqueeCurrent) {
      const mx = Math.min(this.marqueeStart.x, this.marqueeCurrent.x);
      const my = Math.min(this.marqueeStart.y, this.marqueeCurrent.y);
      const mw = Math.abs(this.marqueeCurrent.x - this.marqueeStart.x);
      const mh = Math.abs(this.marqueeCurrent.y - this.marqueeStart.y);

      ctx.save();
      ctx.fillStyle = "rgba(40, 230, 255, 0.12)";
      ctx.strokeStyle = "rgba(40, 230, 255, 0.85)";
      ctx.lineWidth = 1.5 / (layout.scale || 1);
      if (typeof ctx.setLineDash === "function") {
        ctx.setLineDash([4 / layout.scale, 4 / layout.scale]);
      }
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeRect(mx, my, mw, mh);
      ctx.restore();
    }

    ctx.restore();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rollback();

    this.overlayCanvas.removeEventListener?.("pointerdown", this.boundOnPointerDown);
    this.overlayCanvas.removeEventListener?.("pointermove", this.boundOnPointerMove);
    this.overlayCanvas.removeEventListener?.("pointerup", this.boundOnPointerUp);
    this.overlayCanvas.removeEventListener?.("pointercancel", this.boundOnPointerCancel);

    if (typeof (this.overlayCanvas as any).remove === "function") {
      (this.overlayCanvas as any).remove();
    } else if (this.container && typeof this.container.removeChild === "function") {
      try {
        this.container.removeChild(this.overlayCanvas);
      } catch {
        // ignore
      }
    }
  }
}
