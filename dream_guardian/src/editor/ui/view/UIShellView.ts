import { MENU_CARD_IDS } from "../data/UIContracts";
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

export interface ShellInstance {
  readonly root: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly elementsPanel: HTMLElement;
  readonly previewPanel: HTMLElement;
  readonly propertiesPanel: HTMLElement;
  readonly statusPanel: HTMLElement;
  readonly propertyForm: PropertyFormInstance;
  readonly previewFrame: PreviewFrameInstance;
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

  const elementsList = doc.createElement("ul");
  elementsList.className = "elements-card-list";
  const itemElements: HTMLElement[] = [];

  MENU_CARD_IDS.forEach((id, index) => {
    const item = doc.createElement("li");
    item.className = "element-card-item";
    item.setAttribute("data-element-id", id);
    item.tabIndex = 0;
    item.textContent = id;
    item.addEventListener("click", () => {
      selectElement(index);
    });
    elementsList.appendChild(item);
    itemElements.push(item);
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
      }
      options?.onCommitProperty?.(result);
    },
  });
  layoutBody.appendChild(propertiesPanel);

  shellRoot.appendChild(layoutBody);

  // 3. Status Bar
  const statusPanel = doc.createElement("footer");
  statusPanel.className = "editor-status";
  statusPanel.setAttribute("data-panel", "status");

  const statusText = doc.createElement("span");
  statusText.className = "status-message";
  statusPanel.appendChild(statusText);
  shellRoot.appendChild(statusPanel);

  container.appendChild(shellRoot);

  function syncDOMSelection(): void {
    const currentId = MENU_CARD_IDS[state.selectedIndex];
    itemElements.forEach((el, idx) => {
      const isSelected = idx === state.selectedIndex;
      el.setAttribute("data-selected", isSelected ? "true" : "false");
      el.setAttribute("aria-selected", isSelected ? "true" : "false");
      if (isSelected) {
        if (!el.className.includes("selected")) {
          el.className = `${el.className} selected`.trim();
        }
      } else {
        el.className = el.className.replace(/\bselected\b/g, "").trim();
      }
    });
    const msg = `[선택: ${currentId}] 검증 완료 · 게임에는 반영되지 않음 · 샌드박스 미보장 (IFRAME_IS_SECURITY_SANDBOX=false)`;
    statusText.textContent = msg;
    statusPanel.textContent = msg;
    propertyForm.setSelectedId(currentId);
  }

  function selectElement(indexOrId: number | (typeof MENU_CARD_IDS)[number]): void {
    let nextIndex: number;
    if (typeof indexOrId === "number") {
      nextIndex = (indexOrId % MENU_CARD_IDS.length + MENU_CARD_IDS.length) % MENU_CARD_IDS.length;
    } else {
      nextIndex = MENU_CARD_IDS.indexOf(indexOrId as any);
      if (nextIndex === -1) nextIndex = 0;
    }
    state = {
      selectedIndex: nextIndex,
      status: [...state.status, `선택: ${MENU_CARD_IDS[nextIndex]}`],
    };
    syncDOMSelection();
  }

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
