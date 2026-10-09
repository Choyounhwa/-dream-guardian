import { MENU_CARD_IDS } from "../data/UIContracts";
import {
  getScreenRegistry,
  getScreenElements,
  type UIElementMeta,
} from "../data/UIScreenRegistry";
import {
  type ShellState,
  announce,
  selectElementByKey,
  isInputElement,
} from "../UIEditorShell";
import type { CommitResult } from "../UIPropertyPanel";
import type {
  UIVisualDocument,
  UIVisualPageId,
} from "../data/UIVisualDocument";
import {
  type VisualEditorSession,
  createVisualSession,
  switchVisualPage,
  selectVisualElements,
  executeVisualCommand,
  undoVisual,
  redoVisual,
} from "../UIEditorState";
import type { VisualCommand } from "../UICommands";
import {
  type PropertyFormInstance,
  mountPropertyForm,
} from "./UIPropertyFormView";
import {
  type PreviewFrameInstance,
  mountPreviewFrame,
} from "./UIPreviewFrameView";
import {
  type FileActionInstance,
  type Downloader,
  type FilePicker,
  type DirtyExportChoice,
  bindFileActions,
} from "./UIFileActionView";
import {
  type ArrangementViewInstance,
  mountArrangementView,
} from "./UIArrangementView";
import {
  type VisualAssetViewInstance,
  mountVisualAssetView,
} from "./UIVisualAssetView";
import type { PreviewEnvelope } from "../UIPreviewHost";

export interface ShellInstance {
  readonly root: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly elementsPanel: HTMLElement;
  readonly previewPanel: HTMLElement;
  readonly propertiesPanel: HTMLElement;
  readonly statusPanel: HTMLElement;
  readonly propertyForm: PropertyFormInstance;
  readonly previewFrame: PreviewFrameInstance;
  readonly fileActions: FileActionInstance;
  readonly arrangementView: ArrangementViewInstance;
  readonly assetView: VisualAssetViewInstance;
  getState(): ShellState & { selectedId: (typeof MENU_CARD_IDS)[number] };
  selectElement(indexOrId: number | string): void;
  unmount(): void;
  dispose(): void;
}

export interface MountShellOptions {
  keyTarget?: EventTarget;
  initialIndex?: number;
  initialScreenId?: string;
  document?: UIVisualDocument;
  session?: VisualEditorSession | any;
  controller?: any;
  catalog?: any;
  store?: any;
  previewCache?: any;
  onCommitProperty?: (result: CommitResult) => void;
  onVisualCommit?: (command: VisualCommand) => void;
  previewDocId?: string;
  previewOrigin?: string;
  downloader?: Downloader;
  picker?: FilePicker;
  confirm?: (summary: string) => boolean;
  promptDirtyExport?: () => DirtyExportChoice;
  onStatus?: (message: string) => void;
  onDocumentChange?: (doc: any) => void;
}

const TOOLBAR_ACTION_NAMES = [
  "열기",
  "저장",
  "Undo",
  "Redo",
  "변경 비교",
  "프로젝트 백업",
  "전달 데이터 추출",
] as const;

export function mountShell(
  container: HTMLElement,
  options?: MountShellOptions
): ShellInstance {
  let session: VisualEditorSession | any = options?.session;
  let currentDoc: UIVisualDocument | undefined =
    session?.present ?? options?.document ?? options?.controller?.document?.();

  let currentScreenId: string =
    session?.activePageId ??
    options?.initialScreenId ??
    "menu_main";

  if (!session && currentDoc && "pages" in currentDoc) {
    session = createVisualSession(currentDoc, currentScreenId as UIVisualPageId);
  }

  let state: ShellState = {
    selectedIndex: options?.initialIndex ?? 0,
    status: [`초기화: ${MENU_CARD_IDS[options?.initialIndex ?? 0]}`],
  };

  let assetView: VisualAssetViewInstance;

  const doc = container.ownerDocument ?? (globalThis as any).document;
  const shellRoot = doc.createElement("div");
  shellRoot.className = "ui-editor-shell";

  // 1. Toolbar
  const toolbar = doc.createElement("header");
  toolbar.className = "editor-toolbar";
  toolbar.setAttribute("data-panel", "toolbar");
  toolbar.setAttribute("role", "toolbar");

  const metaBox = doc.createElement("div");
  metaBox.className = "toolbar-meta";

  function updateToolbarMeta(): void {
    const rev = session?.revision ?? 0;
    const dirty = session?.dirty ?? false;
    metaBox.textContent = `Dream Guardian UI Editor · rev ${rev} · ${dirty ? "수정됨" : "최신 초안"}`;
  }
  updateToolbarMeta();
  toolbar.appendChild(metaBox);

  const actionsGroup = doc.createElement("div");
  actionsGroup.className = "toolbar-actions";
  for (const name of TOOLBAR_ACTION_NAMES) {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.textContent = name;
    btn.setAttribute("data-action", name);
    actionsGroup.appendChild(btn);
  }
  toolbar.appendChild(actionsGroup);
  shellRoot.appendChild(toolbar);

  // Status Bar elements created early for logging and binding
  const statusPanel = doc.createElement("footer");
  statusPanel.className = "editor-status";
  statusPanel.setAttribute("data-panel", "status");
  statusPanel.setAttribute("role", "status");
  statusPanel.setAttribute("aria-live", "polite");

  const statusText = doc.createElement("span");
  statusText.className = "status-message";
  statusText.textContent = state.status[0] ?? "";
  statusPanel.appendChild(statusText);

  // Undo / Redo / 변경 비교 toolbar listeners using single revision / command pipeline
  const undoBtn = toolbar.querySelector('button[data-action="Undo"]');
  const redoBtn = toolbar.querySelector('button[data-action="Redo"]');
  const diffBtn = toolbar.querySelector('button[data-action="변경 비교"]');

  diffBtn?.addEventListener("click", () => {
    const isDirty = (session?.dirty ?? options?.controller?.status?.()?.dirty) ?? false;
    const msg = `변경 비교: ${isDirty ? "미저장 편집본 존재 (수정됨)" : "베이스라인과 일치"} · 게임에는 반영되지 않음`;
    state = announce(state, msg);
    statusText.textContent = msg;
    statusPanel.textContent = msg;
  });

  undoBtn?.addEventListener("click", () => {
    if (session && session.present?.pages && typeof undoVisual === "function" && session.undo.length > 0) {
      session = undoVisual(session);
      currentDoc = session.present;
      if (currentDoc) {
        propertyForm.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
        assetView?.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
        assetView?.setSession?.(session);
      }
      arrangementView.setSession(session);
      updateToolbarMeta();
      state = announce(state, `실행 취소(Undo) 완료 · rev ${session.revision}`);
      statusText.textContent = `실행 취소(Undo) 완료`;
      statusPanel.textContent = `실행 취소(Undo) 완료`;
      options?.onDocumentChange?.(currentDoc);
      previewFrame.updateDocument(currentScreenId);
    } else if (options?.controller && typeof options.controller.undo === "function") {
      options.controller.undo();
      state = announce(state, `실행 취소(Undo) 완료`);
      statusText.textContent = `실행 취소(Undo) 완료`;
      statusPanel.textContent = `실행 취소(Undo) 완료`;
    } else {
      state = announce(state, `취소할 작업 내역이 없습니다.`);
      statusText.textContent = `취소할 작업 내역이 없습니다.`;
      statusPanel.textContent = `취소할 작업 내역이 없습니다.`;
    }
  });

  redoBtn?.addEventListener("click", () => {
    if (session && session.present?.pages && typeof redoVisual === "function" && session.redo.length > 0) {
      session = redoVisual(session);
      currentDoc = session.present;
      if (currentDoc) {
        propertyForm.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
        assetView?.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
        assetView?.setSession?.(session);
      }
      arrangementView.setSession(session);
      updateToolbarMeta();
      state = announce(state, `다시 실행(Redo) 완료 · rev ${session.revision}`);
      statusText.textContent = `다시 실행(Redo) 완료`;
      statusPanel.textContent = `다시 실행(Redo) 완료`;
      options?.onDocumentChange?.(currentDoc);
      previewFrame.updateDocument(currentScreenId);
    } else if (options?.controller && typeof options.controller.redo === "function") {
      options.controller.redo();
      state = announce(state, `다시 실행(Redo) 완료`);
      statusText.textContent = `다시 실행(Redo) 완료`;
      statusPanel.textContent = `다시 실행(Redo) 완료`;
    } else {
      state = announce(state, `다시 실행할 내역이 없습니다.`);
      statusText.textContent = `다시 실행할 내역이 없습니다.`;
      statusPanel.textContent = `다시 실행할 내역이 없습니다.`;
    }
  });

  // Bind file actions
  const fileActions = bindFileActions(toolbar, {
    controller: options?.controller,
    downloader: options?.downloader,
    picker: options?.picker,
    confirm: options?.confirm,
    promptDirtyExport: options?.promptDirtyExport,
    onStatus: (msg) => {
      state = announce(state, msg);
      options?.onStatus?.(msg);
      statusText.textContent = msg;
      statusPanel.textContent = msg;
    },
  });

  // 2. Layout Body
  const layoutBody = doc.createElement("main");
  layoutBody.className = "editor-layout-body editor-layout-3col";

  // 2-1. Elements Panel
  const elementsPanel = doc.createElement("section");
  elementsPanel.className = "panel-elements";
  elementsPanel.setAttribute("data-panel", "elements");

  const elementsTitle = doc.createElement("h2");
  elementsTitle.textContent = "화면 / 요소 목록";
  elementsPanel.appendChild(elementsTitle);

  // Screen Selector (10 screens)
  const screenRegistry = getScreenRegistry();
  const screenSelector = doc.createElement("select");
  screenSelector.className = "screen-selector";
  screenSelector.setAttribute("data-view", "screen-selector");
  screenSelector.setAttribute("data-action", "switch-screen");
  screenSelector.setAttribute("aria-label", "편집할 화면 및 페이즈 선택");

  function getElementsForScreen(screenId: string): readonly UIElementMeta[] {
    if (currentDoc && currentDoc.pages && currentDoc.pages[screenId as UIVisualPageId]) {
      const page = currentDoc.pages[screenId as UIVisualPageId];
      if (page.elements && page.elements.length > 0) {
        return page.elements.map((el) => ({
          id: el.id,
          label: el.name || el.id,
          defaultRect: el.bounds,
        }));
      }
    }
    return getScreenElements(screenId);
  }

  let currentElements: readonly UIElementMeta[] = getElementsForScreen(currentScreenId);

  for (const screen of screenRegistry) {
    const opt = doc.createElement("option");
    opt.value = screen.id;
    opt.textContent = screen.label;
    if (screen.id === currentScreenId) {
      opt.selected = true;
      opt.setAttribute("selected", "selected");
    }
    screenSelector.appendChild(opt);
  }
  elementsPanel.appendChild(screenSelector);

  const elementsList = doc.createElement("ul");
  elementsList.className = "elements-card-list";
  let itemElements: HTMLElement[] = [];

  function renderElementItems(): void {
    while (elementsList.children && elementsList.children.length > 0) {
      elementsList.removeChild(elementsList.children[0]);
    }
    itemElements = [];
    currentElements = getElementsForScreen(currentScreenId);
    currentElements.forEach((meta, index) => {
      const item = doc.createElement("li");
      item.className = "element-card-item";
      item.setAttribute("data-element-id", meta.id);
      item.tabIndex = 0;
      item.textContent = `${meta.label} (${meta.id})`;
      item.addEventListener("click", () => {
        selectElement(index);
      });
      elementsList.appendChild(item);
      itemElements.push(item);
    });
    selectElement(0);
  }

  screenSelector.addEventListener("change", (e: any) => {
    const newScreen = e?.target?.value ?? screenSelector.value;
    if (newScreen && newScreen !== currentScreenId) {
      propertyForm.cancelDraft?.();
      currentScreenId = newScreen;
      if (session && session.present?.pages && typeof switchVisualPage === "function") {
        session = switchVisualPage(session, currentScreenId as UIVisualPageId);
      }
      previewFrame.updateDocument(currentScreenId);
      currentElements = getElementsForScreen(currentScreenId);
      renderElementItems();
      arrangementView?.updateDocument?.(currentDoc, currentScreenId as UIVisualPageId);
      arrangementView?.setSelection?.(currentElements[0] ? [currentElements[0].id] : []);
      assetView?.updateDocument?.(currentDoc, currentScreenId as UIVisualPageId);
      assetView?.setSelectedElement?.(currentElements[0]?.id ?? null, currentScreenId as UIVisualPageId, currentDoc);
      const screenLabel = screenRegistry.find((s) => s.id === currentScreenId)?.label ?? currentScreenId;
      const firstElem = currentElements[0]?.id ?? "";
      const msg = `[화면 전환: ${screenLabel}] 선택: ${firstElem} · 게임에는 반영되지 않음`;
      state = announce(state, msg);
    }
  });

  elementsPanel.appendChild(elementsList);
  layoutBody.appendChild(elementsPanel);

  // 2-2. Preview Panel
  const previewPanel = doc.createElement("section");
  previewPanel.className = "panel-preview";
  previewPanel.setAttribute("data-panel", "preview");

  const previewTitle = doc.createElement("h2");
  previewTitle.textContent = "UI 미리보기";
  previewPanel.appendChild(previewTitle);

  const previewFrame = mountPreviewFrame(previewPanel, {
    docId: options?.previewDocId ?? currentScreenId,
    pageId: currentScreenId,
    origin: options?.previewOrigin,
    onStatus: (msg) => {
      state = announce(state, msg);
      options?.onStatus?.(msg);
      statusText.textContent = msg;
      statusPanel.textContent = msg;
    },
  });

  // Intercept preview messages for bidirectional selection synchronization
  const originalHandlePreviewMessage = previewFrame.handlePreviewMessage.bind(previewFrame);
  previewFrame.handlePreviewMessage = (message: PreviewEnvelope) => {
    const decision = originalHandlePreviewMessage(message);
    if (message.kind === "preview:selection") {
      const payload: any = message.payload;
      const targetId =
        payload?.elementId ??
        (Array.isArray(payload?.selectedIds) ? payload.selectedIds[0] : undefined);
      if (typeof targetId === "string") {
        selectElement(targetId);
      }
    }
    return decision;
  };

  layoutBody.appendChild(previewPanel);

  // 2-3. Properties Panel
  const propertiesPanel = doc.createElement("section");
  propertiesPanel.className = "panel-properties";
  propertiesPanel.setAttribute("data-panel", "properties");

  const propertiesTitle = doc.createElement("h2");
  propertiesTitle.textContent = "요소 속성";
  propertiesPanel.appendChild(propertiesTitle);

  const initialId = currentElements[state.selectedIndex]?.id ?? MENU_CARD_IDS[state.selectedIndex];
  const propertyForm = mountPropertyForm(propertiesPanel, {
    initialId,
    document: currentDoc,
    activePageId: currentScreenId as UIVisualPageId,
    onVisualCommit: (visualCmd) => {
      if (session && session.present?.pages && typeof executeVisualCommand === "function") {
        session = executeVisualCommand(session, visualCmd);
        currentDoc = session.present;
      }
      if (currentDoc) {
        assetView?.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
      }
      updateToolbarMeta();
      previewFrame.updateDocument(currentScreenId);
      options?.onDocumentChange?.(currentDoc);
      options?.onVisualCommit?.(visualCmd);
    },
    onCommit: (result) => {
      if (result.command) {
        state = announce(
          state,
          `속성 변경: ${result.command.target}.${result.command.field} = ${result.command.value}`
        );
        if (options?.controller && typeof options.controller.edit === "function") {
          options.controller.edit(currentDoc);
        }
      }
      options?.onCommitProperty?.(result);
    },
  });

  assetView = mountVisualAssetView(propertiesPanel, {
    session,
    document: currentDoc,
    activePageId: currentScreenId as UIVisualPageId,
    selectedElementId: initialId,
    catalog: options?.catalog,
    store: options?.store,
    previewCache: options?.previewCache,
    onVisualCommit: (visualCmd) => {
      if (session && session.present?.pages && typeof executeVisualCommand === "function") {
        session = executeVisualCommand(session, visualCmd);
        currentDoc = session.present;
      }
      if (currentDoc) {
        propertyForm.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
      }
      updateToolbarMeta();
      previewFrame.updateDocument(currentScreenId);
      options?.onDocumentChange?.(currentDoc);
      options?.onVisualCommit?.(visualCmd);
    },
  });

  layoutBody.appendChild(propertiesPanel);

  shellRoot.appendChild(layoutBody);

  // Mount Arrangement Toolbar/View
  const initialSelectedId =
    currentElements[state.selectedIndex]?.id ?? MENU_CARD_IDS[state.selectedIndex];
  const arrangementView = mountArrangementView(toolbar, {
    document: currentDoc,
    session,
    activePageId: currentScreenId as UIVisualPageId,
    selectedIds: initialSelectedId ? [initialSelectedId] : [],
    keyObjectId: initialSelectedId,
    onSessionChange: (nextSession) => {
      session = nextSession;
      currentDoc = nextSession.present;
      updateToolbarMeta();
      previewFrame.updateDocument(currentScreenId);
      propertyForm.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
      assetView?.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
      options?.onDocumentChange?.(currentDoc);
    },
    onAlign: (_result, cmd) => {
      state = announce(state, `정렬 완료 · rev ${session?.revision ?? 0}`);
      options?.onVisualCommit?.(cmd);
      options?.onDocumentChange?.(currentDoc);
      previewFrame.updateDocument(currentScreenId);
      updateToolbarMeta();
    },
    onStatus: (msg) => {
      state = announce(state, msg);
      options?.onStatus?.(msg);
      statusText.textContent = msg;
      statusPanel.textContent = msg;
    },
  });

  // 3. Status Bar
  shellRoot.appendChild(statusPanel);
  container.appendChild(shellRoot);

  function syncDOMSelection(): void {
    itemElements.forEach((el, index) => {
      const isSelected = index === state.selectedIndex;
      el.setAttribute("data-selected", isSelected ? "true" : "false");
      el.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (isSelected) {
        if (!el.className.includes("selected")) {
          el.className = `${el.className} selected is-selected active`.trim();
        }
      } else {
        el.className = el.className.replace(/\b(selected|is-selected|active)\b/g, "").trim();
      }
    });
    const currentMeta = currentElements[state.selectedIndex] ?? currentElements[0];
    const currentId = currentMeta ? currentMeta.id : MENU_CARD_IDS[state.selectedIndex];
    assetView?.setSelectedElement(currentId, currentScreenId as UIVisualPageId, currentDoc);
    const activeMsg = `[선택: ${currentId}] 검증 완료 · 게임에는 반영되지 않음 · 샌드박스 미보장 (IFRAME_IS_SECURITY_SANDBOX=false)`;
    statusText.textContent = activeMsg;
    statusPanel.textContent = activeMsg;
  }

  function selectElement(indexOrId: number | string): void {
    currentElements = getElementsForScreen(currentScreenId);
    let nextIndex = 0;
    if (typeof indexOrId === "number") {
      const len = currentElements.length || 1;
      nextIndex = ((indexOrId % len) + len) % len;
    } else {
      nextIndex = currentElements.findIndex((m) => m.id === indexOrId);
      if (nextIndex === -1) nextIndex = 0;
    }
    const currentMeta = currentElements[nextIndex] ?? currentElements[0];
    const currentId = currentMeta ? currentMeta.id : MENU_CARD_IDS[nextIndex];
    state = {
      selectedIndex: nextIndex,
      status: [...state.status, `선택: ${currentId}`],
    };
    if (session && session.present?.pages && typeof selectVisualElements === "function") {
      session = selectVisualElements(session, [currentId]);
    }
    propertyForm.setSelectedId(currentId, currentScreenId as UIVisualPageId, currentDoc);
    arrangementView.setSelection([currentId], currentId);
    arrangementView.updateDocument(currentDoc, currentScreenId as UIVisualPageId);
    assetView?.setSelectedElement(currentId, currentScreenId as UIVisualPageId, currentDoc);
    syncDOMSelection();
  }

  // Initial element items rendering and selection
  renderElementItems();

  const keyTarget: any =
    options?.keyTarget ??
    (typeof (globalThis as any).window !== "undefined"
      ? (globalThis as any).window
      : container);

  const onKeyDown = (event: any) => {
    // Prevent shortcut conflicts while focusing inputs/textareas
    if (isInputElement(event?.target)) {
      return;
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event?.key)) {
      if (typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      const result = selectElementByKey(state, event.key);
      state = {
        selectedIndex: result.selectedIndex,
        status: result.status,
      };
      selectElement(state.selectedIndex);
    }
  };

  if (keyTarget && typeof keyTarget.addEventListener === "function") {
    keyTarget.addEventListener("keydown", onKeyDown);
  }

  syncDOMSelection();

  const unmount = () => {
    assetView?.dispose();
    arrangementView.unmount();
    fileActions.unmount();
    previewFrame.unmount();
    propertyForm.unmount();
    if (keyTarget && typeof keyTarget.removeEventListener === "function") {
      keyTarget.removeEventListener("keydown", onKeyDown);
    }
    if (shellRoot.parentNode) {
      shellRoot.parentNode.removeChild(shellRoot);
    } else if (typeof shellRoot.remove === "function") {
      shellRoot.remove();
    }
  };

  return {
    root: shellRoot,
    toolbar,
    elementsPanel,
    previewPanel,
    propertiesPanel,
    statusPanel,
    propertyForm,
    previewFrame,
    fileActions,
    arrangementView,
    assetView,
    getState: () => ({
      selectedIndex: state.selectedIndex,
      status: state.status.slice(),
      selectedId: (currentElements[state.selectedIndex]?.id ??
        MENU_CARD_IDS[state.selectedIndex]) as any,
    }),
    selectElement,
    unmount,
    dispose: unmount,
  };
}
