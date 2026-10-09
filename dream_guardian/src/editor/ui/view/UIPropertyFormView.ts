import { MENU_CARD_IDS } from "../data/UIContracts";
import { MENU_SHARED_SIZE_FIELDS } from "../data/UIProperties";
import { BASELINE_REGISTRY, type MenuPreset } from "../data/UIBaselines";
import type {
  UIVisualDocument,
  UIVisualElement,
  UIVisualPageId,
} from "../data/UIVisualDocument";
import type { VisualCommand } from "../UICommands";
import {
  type CommitResult,
  type FieldName,
  type PanelCommand,
  type PropertyPanel,
  commit,
  createPropertyPanel,
  setBuffer,
} from "../UIPropertyPanel";

export type VisualFormField =
  | "name"
  | "x"
  | "y"
  | "width"
  | "height"
  | "text"
  | "fontSize"
  | "assetId";

export interface PropertyFormOptions {
  panel?: PropertyPanel;
  initialId?: string;
  document?: UIVisualDocument;
  activePageId?: UIVisualPageId;
  onCommit?: (result: CommitResult) => void;
  onVisualCommit?: (command: VisualCommand) => void;
  onChange?: (panel: PropertyPanel) => void;
}

export interface PropertyFormInstance {
  readonly root: HTMLElement;
  getPanel(): PropertyPanel;
  setSelectedId(id: string, pageId?: UIVisualPageId, doc?: UIVisualDocument): void;
  updateDocument(doc: UIVisualDocument, activePageId?: UIVisualPageId): void;
  cancelDraft(): void;
  unmount(): void;
  dispose(): void;
}

const ALL_FIELDS: readonly VisualFormField[] = [
  "name",
  "x",
  "y",
  "width",
  "height",
  "text",
  "fontSize",
  "assetId",
] as const;

const NUMERIC_FIELDS = new Set<VisualFormField>(["x", "y", "width", "height", "fontSize"]);
const BOUND_FIELDS = new Set<string>(["x", "y", "width", "height"]);

const FIELD_LABELS: Record<VisualFormField, string> = {
  name: "이름",
  x: "X 좌표",
  y: "Y 좌표",
  width: "너비",
  height: "높이",
  text: "정적 문구",
  fontSize: "글자 크기",
  assetId: "이미지 참조",
};

const SHARED_FIELDS = new Set<string>(MENU_SHARED_SIZE_FIELDS);

function applyCommandToCurrent(current: MenuPreset, command: PanelCommand): void {
  if (command.target === "workout-button") {
    current.workoutButton[command.field] = command.value;
  } else if (command.field === "width" || command.field === "height") {
    current[command.field] = command.value;
  } else {
    const card = current.cards.find((c) => c.id === command.target);
    if (card && (command.field === "x" || command.field === "y")) {
      card[command.field] = command.value;
    }
  }
}

export function mountPropertyForm(
  container: HTMLElement,
  options?: PropertyFormOptions
): PropertyFormInstance {
  let currentDoc: UIVisualDocument | undefined = options?.document;
  let activePageId: UIVisualPageId = options?.activePageId ?? "menu_main";
  let activeSelectedId = options?.initialId ?? MENU_CARD_IDS[0];
  let isLocked = false;
  let lockReason = "";
  let lastCommittedSignature = "";
  let isSelectionSwitching = false;

  let panel: PropertyPanel =
    options?.panel ??
    createPropertyPanel({
      selectedId: activeSelectedId,
      document: currentDoc,
      activePageId,
      baseline: BASELINE_REGISTRY.preset,
      current: BASELINE_REGISTRY.preset,
    });

  const doc = container.ownerDocument ?? (globalThis as any).document;

  const formRoot = doc.createElement("form");
  formRoot.className = "ui-property-form";
  formRoot.setAttribute("data-view", "property-form");

  const submitPreventer = (event: any) => {
    if (typeof event?.preventDefault === "function") {
      event.preventDefault();
    }
  };
  formRoot.addEventListener("submit", submitPreventer);

  // Lock Notice Banner
  const lockNotice = doc.createElement("div");
  lockNotice.className = "property-lock-notice";
  lockNotice.setAttribute("data-panel", "lock-notice");
  lockNotice.setAttribute("role", "note");
  if (lockNotice.style) {
    lockNotice.style.display = "none";
  }
  formRoot.appendChild(lockNotice);

  const inputs: Partial<Record<VisualFormField, any>> = {};
  const errorSpans: Partial<Record<VisualFormField, any>> = {};
  const scopeSpans: Partial<Record<VisualFormField, any>> = {};
  const bufferValues: Partial<Record<VisualFormField, string>> = {};
  const originalValues: Partial<Record<VisualFormField, any>> = {};
  const cleanups: (() => void)[] = [];

  for (const field of ALL_FIELDS) {
    const row = doc.createElement("div");
    row.className = "property-field-row";
    row.setAttribute("data-field-row", field);

    const label = doc.createElement("label");
    label.className = "property-label";
    label.setAttribute("for", `prop-input-${field}`);
    label.textContent = FIELD_LABELS[field];
    row.appendChild(label);

    const input = doc.createElement("input");
    input.setAttribute("type", NUMERIC_FIELDS.has(field) ? "number" : "text");
    input.setAttribute("id", `prop-input-${field}`);
    input.setAttribute("name", field);
    input.className = "property-input";
    input.setAttribute("data-field", field);
    input.setAttribute("aria-label", FIELD_LABELS[field]);
    input.setAttribute("aria-describedby", `err-${field}`);
    row.appendChild(input);
    inputs[field] = input;

    const scopeSpan = doc.createElement("span");
    scopeSpan.className = "property-scope";
    scopeSpan.setAttribute("data-scope", field);
    row.appendChild(scopeSpan);
    scopeSpans[field] = scopeSpan;

    const errorSpan = doc.createElement("span");
    errorSpan.className = "property-error";
    errorSpan.setAttribute("id", `err-${field}`);
    errorSpan.setAttribute("data-error", field);
    errorSpan.setAttribute("role", "alert");
    row.appendChild(errorSpan);
    errorSpans[field] = errorSpan;

    const onInput = () => {
      handleInput(field, input.value);
    };
    const onBlur = () => {
      handleCommit("blur", field);
    };
    const onKeyDown = (event: any) => {
      // Prevent shortcut conflicts with parent shell/window while typing
      if (typeof event?.stopPropagation === "function") {
        event.stopPropagation();
      }
      if (event?.key === "Enter") {
        if (typeof event?.preventDefault === "function") {
          event.preventDefault();
        }
        handleCommit("enter", field);
      }
    };

    input.addEventListener("input", onInput);
    input.addEventListener("change", onInput);
    input.addEventListener("blur", onBlur);
    input.addEventListener("keydown", onKeyDown);

    cleanups.push(() => {
      input.removeEventListener("input", onInput);
      input.removeEventListener("change", onInput);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("keydown", onKeyDown);
    });

    formRoot.appendChild(row);
  }

  function findTargetElement(elemId: string): UIVisualElement | null {
    if (!currentDoc || !currentDoc.pages) return null;
    const page = currentDoc.pages[activePageId];
    if (!page) return null;
    const found = page.elements.find((e) => e.id === elemId);
    if (found) return found;
    // Fallback safely to first element
    return page.elements[0] ?? null;
  }

  function loadValuesForElement(targetId: string): void {
    const el = findTargetElement(targetId);
    if (el) {
      activeSelectedId = el.id;
      isLocked = Boolean(el.isLocked);
      lockReason = el.lockReason ?? "";

      originalValues.name = el.name ?? "";
      originalValues.x = el.bounds?.x ?? 0;
      originalValues.y = el.bounds?.y ?? 0;
      originalValues.width = el.bounds?.width ?? 0;
      originalValues.height = el.bounds?.height ?? 0;
      originalValues.text = el.text ?? "";
      originalValues.fontSize = el.fontSize !== undefined ? el.fontSize : "";
      originalValues.assetId = el.assetId ?? "";

      panel = createPropertyPanel({
        selectedId: el.id,
        document: currentDoc,
        activePageId,
        baseline: panel.baseline,
        current: panel.current,
      });
    } else {
      activeSelectedId = targetId;
      isLocked = false;
      lockReason = "";
      panel = createPropertyPanel({
        selectedId: targetId,
        baseline: panel.baseline,
        current: panel.current,
      });
      for (const f of ["x", "y", "width", "height"] as FieldName[]) {
        originalValues[f] = panel.originalValues[f] ?? 0;
      }
      originalValues.name = "";
      originalValues.text = "";
      originalValues.fontSize = "";
      originalValues.assetId = "";
    }

    for (const f of ALL_FIELDS) {
      bufferValues[f] = originalValues[f] !== undefined ? String(originalValues[f]) : "";
    }
    lastCommittedSignature = "";
    updateAllUI();
  }

  function renderValues(): void {
    for (const field of ALL_FIELDS) {
      const input = inputs[field];
      if (input) {
        input.value = bufferValues[field] ?? "";
        input.disabled = isLocked;
        if (isLocked) {
          input.setAttribute("aria-disabled", "true");
        } else {
          input.removeAttribute("aria-disabled");
        }
      }
    }

    if (isLocked) {
      lockNotice.textContent = `잠금 사유: ${lockReason || "수정 불가"}`;
      if (lockNotice.style) lockNotice.style.display = "";
    } else {
      lockNotice.textContent = "";
      if (lockNotice.style) lockNotice.style.display = "none";
    }
  }

  function renderErrors(): void {
    for (const field of ALL_FIELDS) {
      const errorSpan = errorSpans[field];
      const input = inputs[field];
      const isErrField = panel.error?.errorLabelId === `err-${field}`;
      if (errorSpan) {
        errorSpan.textContent = isErrField ? (panel.error?.message ?? "") : "";
      }
      if (input) {
        input.setAttribute("aria-invalid", isErrField ? "true" : "false");
      }
    }
  }

  function renderScopes(): void {
    const isMenuCard = activeSelectedId !== "workout-button";
    for (const field of ALL_FIELDS) {
      const scopeSpan = scopeSpans[field];
      if (!scopeSpan) continue;
      if (isMenuCard && SHARED_FIELDS.has(field)) {
        scopeSpan.textContent = "모든 메뉴 카드에 공통 적용";
        scopeSpan.setAttribute("data-shared", "true");
      } else {
        scopeSpan.textContent = "";
        scopeSpan.removeAttribute("data-shared");
      }
    }
  }

  function updateAllUI(): void {
    renderValues();
    renderErrors();
    renderScopes();
  }

  function handleInput(field: VisualFormField, raw: string): void {
    bufferValues[field] = raw;
    if (BOUND_FIELDS.has(field)) {
      panel = setBuffer(panel, field as FieldName, raw);
    }
    renderErrors();
    options?.onChange?.(panel);
  }

  function handleCommit(reason: "enter" | "blur", field?: VisualFormField): void {
    if (isSelectionSwitching || isLocked) return;

    const commitField: VisualFormField =
      field ??
      (ALL_FIELDS.find((f) => {
        const val = bufferValues[f];
        return val !== undefined && val !== String(originalValues[f] ?? "");
      }) || "x");

    const raw = bufferValues[commitField] ?? "";
    const orig = originalValues[commitField];

    // Same value check -> no re-commit
    if (raw === String(orig ?? "")) {
      return;
    }

    const signature = `${activeSelectedId}:${commitField}:${raw}`;
    if (lastCommittedSignature === signature) {
      return;
    }

    let parsedVal: any = raw;
    if (NUMERIC_FIELDS.has(commitField)) {
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) return;
      parsedVal = num;
    }

    lastCommittedSignature = signature;
    originalValues[commitField] = parsedVal;
    bufferValues[commitField] = String(parsedVal);

    if (currentDoc) {
      const el = findTargetElement(activeSelectedId);
      if (el) {
        let visualCmd: VisualCommand;
        if (BOUND_FIELDS.has(commitField)) {
          const beforeBounds = { ...el.bounds };
          const afterBounds = { ...el.bounds, [commitField]: parsedVal };
          visualCmd = {
            id: `cmd-resize-${Date.now()}`,
            type: "resize-element",
            pageId: activePageId,
            elementId: activeSelectedId,
            before: beforeBounds,
            after: afterBounds,
          };
        } else {
          const beforeVal = (el as any)[commitField];
          visualCmd = {
            id: `cmd-prop-${Date.now()}`,
            type: "set-element-prop",
            pageId: activePageId,
            elementId: activeSelectedId,
            prop: commitField as keyof UIVisualElement,
            before: beforeVal,
            after: parsedVal,
          };
        }

        options?.onVisualCommit?.(visualCmd);

        const legacyCmd: PanelCommand = {
          field: (BOUND_FIELDS.has(commitField) ? commitField : "x") as FieldName,
          value: typeof parsedVal === "number" ? parsedVal : 0,
          target: activeSelectedId,
          affectedIds: [activeSelectedId],
        };
        options?.onCommit?.({
          panel,
          command: legacyCmd,
          affectedIds: [activeSelectedId],
        });
      }
    } else {
      const result = commit(panel, { reason });
      panel = result.panel;
      if (result.command) {
        applyCommandToCurrent(panel.current, result.command);
        options?.onCommit?.(result);
      }
    }

    updateAllUI();
  }

  // Initial load
  loadValuesForElement(activeSelectedId);
  container.appendChild(formRoot);

  return {
    root: formRoot,
    getPanel: () => panel,
    setSelectedId: (id: string, pageId?: UIVisualPageId, doc?: UIVisualDocument) => {
      isSelectionSwitching = true;
      try {
        if (doc) currentDoc = doc;
        if (pageId) activePageId = pageId;
        loadValuesForElement(id);
      } finally {
        isSelectionSwitching = false;
      }
    },
    updateDocument: (newDoc: UIVisualDocument, newPageId?: UIVisualPageId) => {
      currentDoc = newDoc;
      if (newPageId) activePageId = newPageId;
      loadValuesForElement(activeSelectedId);
    },
    cancelDraft: () => {
      for (const f of ALL_FIELDS) {
        bufferValues[f] = originalValues[f] !== undefined ? String(originalValues[f]) : "";
      }
      renderValues();
      renderErrors();
    },
    unmount: () => {
      cleanups.forEach((c) => c());
      cleanups.length = 0;
      formRoot.removeEventListener("submit", submitPreventer);
      if (formRoot.parentNode) {
        formRoot.parentNode.removeChild(formRoot);
      } else if (typeof formRoot.remove === "function") {
        formRoot.remove();
      }
    },
    dispose: () => {
      cleanups.forEach((c) => c());
      cleanups.length = 0;
      formRoot.removeEventListener("submit", submitPreventer);
      if (formRoot.parentNode) {
        formRoot.parentNode.removeChild(formRoot);
      } else if (typeof formRoot.remove === "function") {
        formRoot.remove();
      }
    },
  };
}
