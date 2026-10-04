import { MENU_CARD_IDS } from "../data/UIContracts";
import { MENU_SHARED_SIZE_FIELDS } from "../data/UIProperties";
import { BASELINE_REGISTRY, type MenuPreset } from "../data/UIBaselines";
import {
  type CommitResult,
  type FieldName,
  type PanelCommand,
  type PropertyPanel,
  commit,
  createPropertyPanel,
  setBuffer,
} from "../UIPropertyPanel";

export interface PropertyFormOptions {
  panel?: PropertyPanel;
  initialId?: string;
  onCommit?: (result: CommitResult) => void;
  onChange?: (panel: PropertyPanel) => void;
}

export interface PropertyFormInstance {
  readonly root: HTMLElement;
  getPanel(): PropertyPanel;
  setSelectedId(id: string): void;
  unmount(): void;
  dispose(): void;
}

const FIELDS: readonly FieldName[] = ["x", "y", "width", "height"] as const;

const FIELD_LABELS: Record<FieldName, string> = {
  x: "X 좌표",
  y: "Y 좌표",
  width: "너비",
  height: "높이",
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
  let panel: PropertyPanel =
    options?.panel ??
    createPropertyPanel({
      selectedId: options?.initialId ?? MENU_CARD_IDS[0],
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

  const inputs: Partial<Record<FieldName, any>> = {};
  const errorSpans: Partial<Record<FieldName, any>> = {};
  const scopeSpans: Partial<Record<FieldName, any>> = {};
  const cleanups: (() => void)[] = [];

  for (const field of FIELDS) {
    const row = doc.createElement("div");
    row.className = "property-field-row";
    row.setAttribute("data-field-row", field);

    const label = doc.createElement("label");
    label.className = "property-label";
    label.setAttribute("for", `prop-input-${field}`);
    label.textContent = FIELD_LABELS[field];
    row.appendChild(label);

    const input = doc.createElement("input");
    input.setAttribute("type", "number");
    input.setAttribute("id", `prop-input-${field}`);
    input.setAttribute("name", field);
    input.className = "property-input";
    input.setAttribute("data-field", field);
    input.setAttribute("aria-label", FIELD_LABELS[field]);
    input.setAttribute("aria-describedby", `err-${field}`);
    input.value = panel.buffer[field] ?? "";
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
      handleCommit("blur");
    };
    const onKeyDown = (event: any) => {
      if (event?.key === "Enter") {
        if (typeof event?.preventDefault === "function") {
          event.preventDefault();
        }
        handleCommit("enter");
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

  function renderValues(): void {
    for (const field of FIELDS) {
      const input = inputs[field];
      if (input && input.value !== panel.buffer[field]) {
        input.value = panel.buffer[field] ?? "";
      }
    }
  }

  function renderErrors(): void {
    for (const field of FIELDS) {
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
    const isMenuCard = panel.selectedId !== "workout-button";
    for (const field of FIELDS) {
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

  function handleInput(field: FieldName, raw: string): void {
    panel = setBuffer(panel, field, raw);
    renderErrors();
    options?.onChange?.(panel);
  }

  function handleCommit(reason: "enter" | "blur"): void {
    const result = commit(panel, { reason });
    panel = result.panel;
    if (result.command) {
      applyCommandToCurrent(panel.current, result.command);
      options?.onCommit?.(result);
    }
    updateAllUI();
  }

  function setSelectedId(id: string): void {
    panel = createPropertyPanel({
      selectedId: id,
      baseline: panel.baseline,
      current: panel.current,
    });
    updateAllUI();
  }

  let unmounted = false;
  function unmount(): void {
    if (unmounted) return;
    unmounted = true;
    for (const cleanup of cleanups) {
      cleanup();
    }
    formRoot.removeEventListener("submit", submitPreventer);
    if (formRoot.parentNode) {
      formRoot.parentNode.removeChild(formRoot);
    }
  }

  updateAllUI();
  container.appendChild(formRoot);

  return {
    root: formRoot,
    getPanel: () => panel,
    setSelectedId,
    unmount,
    dispose: unmount,
  };
}
