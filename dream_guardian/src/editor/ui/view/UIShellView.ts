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
} from "../UIEditorShell";
import type { CommitResult } from "../UIPropertyPanel";
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
  getState(): ShellState & { selectedId: (typeof MENU_CARD_IDS)[number] };
  selectElement(indexOrId: number | (typeof MENU_CARD_IDS)[number]): void;
  unmount(): void;
  dispose(): void;
}

export interface MountShellOptions {
  keyTarget?: EventTarget;
  initialIndex?: number;
  onCommitProperty?: (result: CommitResult) => void;
  previewDocId?: string;
  previewOrigin?: string;
  controller?: any;
  downloader?: Downloader;
  picker?: FilePicker;
  confirm?: (summary: string) => boolean;
  promptDirtyExport?: () => DirtyExportChoice;
  onStatus?: (message: string) => void;
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
  let state: ShellState = {
    selectedIndex: options?.initialIndex ?? 0,
    status: [`초기화: ${MENU_CARD_IDS[options?.initialIndex ?? 0]}`],
  };

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
  metaBox.textContent = "Dream Guardian UI Editor · rev 0 · 최신 초안";
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

  const statusText = doc.createElement("span");
  statusText.className = "status-message";
  statusPanel.appendChild(statusText);

  // 1-1. File Actions Binding
  const fileActions = bindFileActions(toolbar, {
    controller: options?.controller,
    downloader: options?.downloader,
    picker: options?.picker,
    confirm: options?.confirm,
    promptDirtyExport: options?.promptDirtyExport,
    onStatus: (msg) => {
      state = announce(state, msg);
      statusText.textContent = msg;
      statusPanel.textContent = msg;
      options?.onStatus?.(msg);
    },
  });

  // 1-2. Undo / Redo / 변경 비교 Toolbar Actions Binding
  const historyStack: any[] = [];
  const futureStack: any[] = [];

  const undoBtn = toolbar.querySelector?.('[data-action="Undo"]');
  const redoBtn = toolbar.querySelector?.('[data-action="Redo"]');
  const diffBtn = toolbar.querySelector?.('[data-action="변경 비교"]');

  const onUndoClick = () => {
    if (historyStack.length === 0) {
      const msg = "실행 취소할 이전 변경이 없습니다 · 게임에는 반영되지 않음";
      state = announce(state, msg);
      statusText.textContent = msg;
      statusPanel.textContent = msg;
      return;
    }
    const currentDoc = options?.controller?.document?.();
    if (currentDoc) {
      futureStack.push(structuredClone(currentDoc));
    }
    const prevDoc = historyStack.pop();
    if (prevDoc && options?.controller && typeof options.controller.edit === "function") {
      options.controller.edit(prevDoc);
    }
    const msg = "실행 취소(Undo) 완료 · 게임에는 반영되지 않음";
    state = announce(state, msg);
    statusText.textContent = msg;
    statusPanel.textContent = msg;
  };

  const onRedoClick = () => {
    if (futureStack.length === 0) {
      const msg = "다시 실행할 다음 변경이 없습니다 · 게임에는 반영되지 않음";
      state = announce(state, msg);
      statusText.textContent = msg;
      statusPanel.textContent = msg;
      return;
    }
    const currentDoc = options?.controller?.document?.();
    if (currentDoc) {
      historyStack.push(structuredClone(currentDoc));
    }
    const nextDoc = futureStack.pop();
    if (nextDoc && options?.controller && typeof options.controller.edit === "function") {
      options.controller.edit(nextDoc);
    }
    const msg = "다시 실행(Redo) 완료 · 게임에는 반영되지 않음";
    state = announce(state, msg);
    statusText.textContent = msg;
    statusPanel.textContent = msg;
  };

  const onDiffClick = () => {
    const isDirty = options?.controller?.status?.()?.dirty ?? false;
    const msg = `변경 비교: ${isDirty ? "미저장 편집본 존재 (수정됨)" : "베이스라인과 일치"} · 게임에는 반영되지 않음`;
    state = announce(state, msg);
    statusText.textContent = msg;
    statusPanel.textContent = msg;
  };

  if (undoBtn && typeof undoBtn.addEventListener === "function") {
    undoBtn.addEventListener("click", onUndoClick);
  }
  if (redoBtn && typeof redoBtn.addEventListener === "function") {
    redoBtn.addEventListener("click", onRedoClick);
  }
  if (diffBtn && typeof diffBtn.addEventListener === "function") {
    diffBtn.addEventListener("click", onDiffClick);
  }

  // 2. 3-Panel Layout Body
  const layoutBody = doc.createElement("div");
  layoutBody.className = "editor-layout-3col";

  // 2-1. Elements Panel
  const elementsPanel = doc.createElement("section");
  elementsPanel.className = "panel-elements";
  elementsPanel.setAttribute("data-panel", "elements");

  const elementsTitle = doc.createElement("h2");
  elementsTitle.textContent = "화면 / 요소 목록";
  elementsPanel.appendChild(elementsTitle);

  // 2-1-A. Screen Selector (10 Screens / Phases)
  const screenRegistry = getScreenRegistry();
  let currentScreenId = "menu_main";
  let currentElements: readonly UIElementMeta[] = getScreenElements(currentScreenId);

  const screenSelector = doc.createElement("select");
  screenSelector.className = "screen-selector";
  screenSelector.setAttribute("data-view", "screen-selector");
  screenSelector.setAttribute("aria-label", "편집할 화면 및 페이즈 선택");
  if (screenSelector.style) {
    screenSelector.style.width = "100%";
    screenSelector.style.marginBottom = "8px";
    screenSelector.style.padding = "6px 8px";
    screenSelector.style.background = "#1a2235";
    screenSelector.style.color = "#38bdf8";
    screenSelector.style.border = "1px solid #334155";
    screenSelector.style.borderRadius = "6px";
    screenSelector.style.fontSize = "12px";
    screenSelector.style.fontWeight = "bold";
  }

  for (const s of screenRegistry) {
    const opt = doc.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    if (s.id === currentScreenId) {
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
      currentScreenId = newScreen;
      currentElements = getScreenElements(currentScreenId);
      renderElementItems();
      const screenLabel = screenRegistry.find((s) => s.id === currentScreenId)?.label ?? currentScreenId;
      const firstElem = currentElements[0]?.id ?? "";
      const msg = `[화면 전환: ${screenLabel}] 선택: ${firstElem} · 게임에는 반영되지 않음`;
      state = announce(state, msg);
      statusText.textContent = msg;
      statusPanel.textContent = msg;
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
    docId: options?.previewDocId ?? "menu-main",
    origin: options?.previewOrigin,
    onStatus: (msg) => {
      state = announce(state, msg);
    },
  });
  layoutBody.appendChild(previewPanel);

  // 2-3. Properties Panel
  const propertiesPanel = doc.createElement("section");
  propertiesPanel.className = "panel-properties";
  propertiesPanel.setAttribute("data-panel", "properties");

  const propertiesTitle = doc.createElement("h2");
  propertiesTitle.textContent = "요소 속성";
  propertiesPanel.appendChild(propertiesTitle);

  const initialId = MENU_CARD_IDS[state.selectedIndex];
  const propertyForm = mountPropertyForm(propertiesPanel, {
    initialId,
    onCommit: (result) => {
      if (result.command) {
        state = announce(
          state,
          `속성 변경: ${result.command.target}.${result.command.field} = ${result.command.value}`
        );
        const currentDoc = options?.controller?.document?.();
        if (currentDoc) {
          historyStack.push(structuredClone(currentDoc));
          futureStack.length = 0;
          const updatedDoc = structuredClone(currentDoc);
          if (updatedDoc.menu) {
            const cmd = result.command;
            if (cmd.target === "workout-button") {
              if (updatedDoc.menu.workoutButton) updatedDoc.menu.workoutButton[cmd.field] = cmd.value;
            } else if (cmd.field === "width" || cmd.field === "height") {
              updatedDoc.menu[cmd.field] = cmd.value;
            } else if (Array.isArray(updatedDoc.menu.cards)) {
              const card = updatedDoc.menu.cards.find((c: any) => c.id === cmd.target);
              if (card && (cmd.field === "x" || cmd.field === "y")) {
                card[cmd.field] = cmd.value;
              }
            }
          }
          if (options?.controller && typeof options.controller.edit === "function") {
            options.controller.edit(updatedDoc);
          }
        }
      }
      options?.onCommitProperty?.(result);
    },
  });
  layoutBody.appendChild(propertiesPanel);

  shellRoot.appendChild(layoutBody);

  // 3. Status Bar
  shellRoot.appendChild(statusPanel);
  container.appendChild(shellRoot);

  function syncDOMSelection(): void {
    const currentMeta = currentElements[state.selectedIndex] ?? currentElements[0];
    const currentId = currentMeta ? currentMeta.id : MENU_CARD_IDS[state.selectedIndex];
    itemElements.forEach((el, idx) => {
      const isSelected = idx === state.selectedIndex;
      el.setAttribute("data-selected", isSelected ? "true" : "false");
      el.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (isSelected) {
        if (!el.className.includes("selected")) {
          el.className = `${el.className} selected is-selected`.trim();
        }
      } else {
        el.className = el.className.replace(/\b(selected|is-selected)\b/g, "").trim();
      }
    });
    const msg = `[선택: ${currentId}] 검증 완료 · 게임에는 반영되지 않음 · 샌드박스 미보장 (IFRAME_IS_SECURITY_SANDBOX=false)`;
    statusText.textContent = msg;
    statusPanel.textContent = msg;
    propertyForm.setSelectedId(currentId);
  }

  function selectElement(indexOrId: number | string): void {
    let nextIndex: number;
    if (typeof indexOrId === "number") {
      const len = currentElements.length || 1;
      nextIndex = (indexOrId % len + len) % len;
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
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event?.key)) {
      if (typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      const result = selectElementByKey(state, event.key);
      state = {
        selectedIndex: result.selectedIndex,
        status: result.status,
      };
      syncDOMSelection();
    }
  };

  if (keyTarget && typeof keyTarget.addEventListener === "function") {
    keyTarget.addEventListener("keydown", onKeyDown);
  }

  syncDOMSelection();

  const unmount = () => {
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
    getState() {
      return {
        selectedIndex: state.selectedIndex,
        selectedId: MENU_CARD_IDS[state.selectedIndex],
        status: state.status.slice(),
      };
    },
    selectElement,
    unmount,
    dispose: unmount,
  };
}
