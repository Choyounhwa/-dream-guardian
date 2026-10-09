/**
 * UIArrangementView.ts - 6방향 정렬·기준 선택·묶음 이동 도구 (Issue #462 / UI-VIS-032)
 *
 * 개발 규칙 준수:
 * 1. 6방향(left, hcenter, right, top, vcenter, bottom) toolbar 및 3기준(selection, artboard, key-object) 컨트롤 제공.
 * 2. 18가지 조합 (6방향 × 3기준) UI → UIArrangement 모델 인자 바인딩.
 * 3. key-object 기준 선택 시 기준이 되는 키 객체를 UI 상에 명시적으로 강조하고 식별 설명 제공.
 * 4. 개별 정렬(Individual Align)과 묶음 전체(Group / En-bloc Align)를 버튼/모드로 명확히 분리하고 상대 offset 100% 보존.
 * 5. 잠긴 요소(isLocked) 선택 시 원자적 거부(0건 변경) 및 lockReason 통지.
 * 6. UIArrangement.ts 정렬 수학을 단일 진실(SSOT)로 재사용.
 */

import type {
  UIVisualDocument,
  UIVisualElement,
  UIVisualPageId,
  UIRect,
} from "../data/UIVisualDocument";
import {
  type AlignDirection,
  type AlignReference,
  type ArrangementElement,
  type ArrangementResult,
  computeIndividualAlign,
  computeGroupAlign,
  DEFAULT_ARTBOARD_BOUNDS,
} from "../UIArrangement";
import {
  type VisualEditorSession,
  executeVisualCommand,
} from "../UIEditorState";
import type { VisualAlignElementsCommand } from "../UICommands";

export type AlignMode = "individual" | "group";

export interface ArrangementViewState {
  reference: AlignReference;
  mode: AlignMode;
  selectedIds: string[];
  keyObjectId: string | null;
  activePageId: UIVisualPageId;
}

export interface ArrangementViewOptions {
  document?: UIVisualDocument;
  session?: VisualEditorSession;
  activePageId?: UIVisualPageId;
  selectedIds?: string[];
  keyObjectId?: string | null;
  reference?: AlignReference;
  mode?: AlignMode;
  onAlign?: (
    result: ArrangementResult<ArrangementElement>,
    command: VisualAlignElementsCommand
  ) => void;
  onReject?: (rejection: {
    reason: string;
    message: string;
    violatedElementId?: string;
  }) => void;
  onStatus?: (message: string) => void;
  onSessionChange?: (nextSession: VisualEditorSession) => void;
}

export interface ArrangementViewInstance {
  readonly root: HTMLElement;
  setSelection(ids: string[], keyObjectId?: string): void;
  setKeyObject(id: string | null): void;
  setReference(ref: AlignReference): void;
  setMode(mode: AlignMode): void;
  updateDocument(doc: UIVisualDocument | undefined, pageId?: UIVisualPageId): void;
  setSession(session: VisualEditorSession): void;
  align(
    direction: AlignDirection,
    reference?: AlignReference,
    mode?: AlignMode
  ): ArrangementResult<ArrangementElement>;
  getState(): ArrangementViewState;
  unmount(): void;
  dispose(): void;
}

const ALIGN_DIRECTIONS: readonly {
  id: AlignDirection;
  label: string;
  icon: string;
}[] = [
  { id: "left", label: "좌측", icon: "⇥" },
  { id: "hcenter", label: "가로중앙", icon: "⇥⇤" },
  { id: "right", label: "우측", icon: "⇤" },
  { id: "top", label: "상단", icon: "⤒" },
  { id: "vcenter", label: "세로중앙", icon: "⤒⤓" },
  { id: "bottom", label: "하단", icon: "⤓" },
];

const REFERENCES: readonly { id: AlignReference; label: string }[] = [
  { id: "selection", label: "선택 영역" },
  { id: "artboard", label: "아트보드" },
  { id: "key-object", label: "키 객체" },
];

const MODE_DESCRIPTIONS: Record<AlignMode, string> = {
  individual: "개별 정렬: 선택된 각 요소를 독립적으로 기준선에 정렬합니다.",
  group: "묶음 전체 정렬: 요소들 사이의 상대 간격을 100% 보존하며 한 덩어리로 정렬합니다.",
};

function normalizeCmdAlignment(
  dir: AlignDirection
): "left" | "right" | "top" | "bottom" | "center-h" | "center-v" {
  switch (dir) {
    case "hcenter":
    case "center-h":
      return "center-h";
    case "vcenter":
    case "center-v":
      return "center-v";
    case "left":
    case "right":
    case "top":
    case "bottom":
      return dir;
  }
}

export function mountArrangementView(
  container: HTMLElement,
  options?: ArrangementViewOptions
): ArrangementViewInstance {
  const doc = container.ownerDocument || document;

  let currentDoc: UIVisualDocument | undefined = options?.document;
  let currentSession: VisualEditorSession | undefined = options?.session;
  let activePageId: UIVisualPageId =
    options?.activePageId ?? currentSession?.activePageId ?? "menu_main";
  let selectedIds: string[] = options?.selectedIds ? [...options.selectedIds] : [];
  let keyObjectId: string | null = options?.keyObjectId ?? null;
  let currentRef: AlignReference = options?.reference ?? "selection";
  let currentMode: AlignMode = options?.mode ?? "group";

  // Root Toolbar Container
  const root = doc.createElement("section");
  root.className = "arrangement-view-panel";
  root.setAttribute("data-panel", "arrangement");
  root.setAttribute("aria-label", "요소 정렬 및 배치 도구");

  // 1. Controls Row (Reference + Mode)
  const controlsRow = doc.createElement("div");
  controlsRow.className = "arrangement-controls-row";

  // Reference Select
  const refLabel = doc.createElement("label");
  refLabel.textContent = "기준:";
  refLabel.className = "control-label";

  const refSelect = doc.createElement("select");
  refSelect.className = "ref-selector";
  refSelect.setAttribute("data-control", "align-reference");
  refSelect.setAttribute("aria-label", "정렬 기준 선택");

  REFERENCES.forEach((r) => {
    const opt = doc.createElement("option");
    opt.value = r.id;
    opt.textContent = r.label;
    opt.setAttribute("data-ref", r.id);
    if (r.id === currentRef) opt.setAttribute("selected", "true");
    refSelect.appendChild(opt);
  });

  refSelect.addEventListener("change", (e: any) => {
    const nextRef = (e.target?.value || refSelect.value) as AlignReference;
    setReference(nextRef);
  });

  controlsRow.appendChild(refLabel);
  controlsRow.appendChild(refSelect);

  // Mode Select
  const modeLabel = doc.createElement("label");
  modeLabel.textContent = "모드:";
  modeLabel.className = "control-label";

  const modeSelect = doc.createElement("select");
  modeSelect.className = "mode-selector";
  modeSelect.setAttribute("data-control", "align-mode");
  modeSelect.setAttribute("aria-label", "정렬 모드 선택 (개별 / 묶음)");

  const optIndividual = doc.createElement("option");
  optIndividual.value = "individual";
  optIndividual.textContent = "개별 정렬";
  optIndividual.setAttribute("data-mode", "individual");
  if (currentMode === "individual") optIndividual.setAttribute("selected", "true");

  const optGroup = doc.createElement("option");
  optGroup.value = "group";
  optGroup.textContent = "묶음 전체 정렬";
  optGroup.setAttribute("data-mode", "group");
  if (currentMode === "group") optGroup.setAttribute("selected", "true");

  modeSelect.appendChild(optIndividual);
  modeSelect.appendChild(optGroup);

  modeSelect.addEventListener("change", (e: any) => {
    const nextMode = (e.target?.value || modeSelect.value) as AlignMode;
    setMode(nextMode);
  });

  controlsRow.appendChild(modeLabel);
  controlsRow.appendChild(modeSelect);
  root.appendChild(controlsRow);

  // 2. Alignment Buttons Toolbar
  const btnToolbar = doc.createElement("div");
  btnToolbar.className = "arrangement-toolbar-buttons";
  btnToolbar.setAttribute("role", "toolbar");
  btnToolbar.setAttribute("aria-label", "6방향 정렬 도구 모음");

  ALIGN_DIRECTIONS.forEach((dir) => {
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = `btn-align btn-align-${dir.id}`;
    btn.setAttribute("data-align", dir.id);
    btn.setAttribute("data-action", `align-${dir.id}`);
    btn.title = `${dir.label} 정렬 (${dir.id})`;
    btn.textContent = `${dir.icon} ${dir.label}`;

    btn.addEventListener("click", () => {
      align(dir.id);
    });

    btnToolbar.appendChild(btn);
  });

  root.appendChild(btnToolbar);

  // 3. Key Object Indicator & Picker
  const keyIndicator = doc.createElement("div");
  keyIndicator.className = "key-object-indicator";
  keyIndicator.setAttribute("data-role", "key-object-indicator");
  root.appendChild(keyIndicator);

  // 4. Mode Description
  const modeDescription = doc.createElement("div");
  modeDescription.className = "mode-description";
  modeDescription.setAttribute("data-role", "mode-description");
  root.appendChild(modeDescription);

  // 5. Lock Notice Alert
  const lockNotice = doc.createElement("div");
  lockNotice.className = "lock-notice alert-warning";
  lockNotice.setAttribute("data-role", "lock-notice");
  if (lockNotice.style) {
    lockNotice.style.display = "none";
  }
  root.appendChild(lockNotice);

  container.appendChild(root);

  function getEffectiveElements(): UIVisualElement[] {
    const docToRead = currentSession ? currentSession.present : currentDoc;
    if (
      !docToRead ||
      typeof docToRead !== "object" ||
      !("pages" in docToRead) ||
      !docToRead.pages
    ) {
      return [];
    }
    const page = docToRead.pages[activePageId];
    if (!page || !Array.isArray(page.elements)) return [];

    if (selectedIds.length === 0) {
      if (currentSession && currentSession.selectedElementIds && currentSession.selectedElementIds.length > 0) {
        selectedIds = [...currentSession.selectedElementIds];
      }
    }

    return selectedIds
      .map((id) => page.elements.find((e) => e.id === id))
      .filter((e): e is UIVisualElement => e !== undefined);
  }

  function updateKeyIndicatorDOM(): void {
    const elements = getEffectiveElements();
    const activeKey = keyObjectId ? elements.find((e) => e.id === keyObjectId) : elements[0];
    const keyId = activeKey ? activeKey.id : keyObjectId ?? "";

    keyIndicator.setAttribute("data-key-object-id", keyId);

    if (currentRef === "key-object") {
      keyIndicator.className = "key-object-indicator active is-key-active";
      if (activeKey) {
        keyIndicator.textContent = `기준(Key 객체): ${activeKey.name || activeKey.id} (ID: ${activeKey.id}) — 이 요소를 축으로 정렬`;
      } else {
        keyIndicator.textContent = `기준(Key 객체): 미지정 (선택된 요소 중 키 객체를 지정하십시오)`;
      }
    } else {
      keyIndicator.className = "key-object-indicator inactive";
      if (activeKey) {
        keyIndicator.textContent = `기준(Key): ${activeKey.name || activeKey.id}`;
      } else {
        keyIndicator.textContent = `기준: ${currentRef === "artboard" ? "아트보드 캔버스 전체" : "선택 요소 바운딩 박스"}`;
      }
    }
  }

  function updateModeDOM(): void {
    modeDescription.textContent = MODE_DESCRIPTIONS[currentMode];
    modeSelect.value = currentMode;
  }

  function setReference(ref: AlignReference): void {
    currentRef = ref;
    refSelect.value = ref;
    updateKeyIndicatorDOM();
  }

  function setMode(mode: AlignMode): void {
    currentMode = mode;
    updateModeDOM();
  }

  function setSelection(ids: string[], newKeyObjectId?: string): void {
    selectedIds = [...ids];
    if (newKeyObjectId !== undefined) {
      keyObjectId = newKeyObjectId;
    } else if (keyObjectId && !selectedIds.includes(keyObjectId)) {
      keyObjectId = selectedIds.length > 0 ? selectedIds[0] : null;
    }
    updateKeyIndicatorDOM();
  }

  function setKeyObject(id: string | null): void {
    keyObjectId = id;
    updateKeyIndicatorDOM();
  }

  function updateDocument(docToSet: UIVisualDocument | undefined, pageId?: UIVisualPageId): void {
    currentDoc = docToSet;
    if (pageId) {
      activePageId = pageId;
    }
    updateKeyIndicatorDOM();
  }

  function setSession(session: VisualEditorSession): void {
    currentSession = session;
    currentDoc = session.present;
    activePageId = session.activePageId;
    if (session.selectedElementIds.length > 0) {
      selectedIds = [...session.selectedElementIds];
    }
    updateKeyIndicatorDOM();
  }

  function align(
    direction: AlignDirection,
    reference?: AlignReference,
    mode?: AlignMode
  ): ArrangementResult<ArrangementElement> {
    const effectiveRef = reference ?? currentRef;
    const effectiveMode = mode ?? currentMode;
    const elements = getEffectiveElements();

    let effectiveKeyId = keyObjectId;
    if (effectiveRef === "key-object" && !effectiveKeyId && elements.length > 0) {
      effectiveKeyId = elements[0].id;
    }

    const arrangementElements: ArrangementElement[] = elements.map((e) => ({
      id: e.id,
      name: e.name,
      bounds: { ...e.bounds },
      isLocked: e.isLocked,
      lockReason: e.lockReason,
    }));

    // Call pure alignment functions from UIArrangement.ts
    const alignOptions = {
      direction,
      reference: effectiveRef,
      keyObjectId: effectiveKeyId ?? undefined,
      artboardBounds: DEFAULT_ARTBOARD_BOUNDS,
    };

    const result =
      effectiveMode === "group"
        ? computeGroupAlign(arrangementElements, alignOptions)
        : computeIndividualAlign(arrangementElements, alignOptions);

    if (!result.ok) {
      // Atomic rejection
      const violatedEl = result.violatedElementId
        ? elements.find((e) => e.id === result.violatedElementId)
        : undefined;
      const displayMsg =
        violatedEl?.lockReason
          ? `잠긴 요소("${violatedEl.name || violatedEl.id}") 변경 거부: ${violatedEl.lockReason}`
          : result.message;

      if (lockNotice.style) {
        lockNotice.style.display = "block";
      }
      lockNotice.textContent = `[정렬 거부: ${result.reason}] ${displayMsg}`;

      options?.onReject?.({
        reason: result.reason,
        message: displayMsg,
        violatedElementId: result.violatedElementId,
      });
      options?.onStatus?.(displayMsg);
      return {
        ...result,
        message: displayMsg,
      };
    }

    // Success: clear lock notice
    if (lockNotice.style) {
      lockNotice.style.display = "none";
    }
    lockNotice.textContent = "";

    const origBoundsMap = new Map<string, UIRect>();
    elements.forEach((e) => {
      origBoundsMap.set(e.id, { ...e.bounds });
    });

    const moves = result.elements.map((el) => ({
      elementId: el.id,
      before: origBoundsMap.get(el.id)!,
      after: { ...el.bounds },
    }));

    const cmd: VisualAlignElementsCommand = {
      id: `align-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "align-elements",
      pageId: activePageId,
      alignment: normalizeCmdAlignment(direction),
      moves,
    };

    if (currentSession) {
      const nextSession = executeVisualCommand(currentSession, cmd);
      currentSession = nextSession;
      currentDoc = nextSession.present;
      options?.onSessionChange?.(nextSession);
    }

    options?.onAlign?.(result, cmd);
    options?.onStatus?.(`정렬 완료: ${direction} (${effectiveRef})`);

    return result;
  }

  // Initial render sync
  updateKeyIndicatorDOM();
  updateModeDOM();

  return {
    root,
    setSelection,
    setKeyObject,
    setReference,
    setMode,
    updateDocument,
    setSession,
    align,
    getState: () => ({
      reference: currentRef,
      mode: currentMode,
      selectedIds: [...selectedIds],
      keyObjectId,
      activePageId,
    }),
    unmount: () => {
      if (root.parentNode) {
        root.parentNode.removeChild(root);
      } else if (typeof root.remove === "function") {
        root.remove();
      }
    },
    dispose: () => {
      if (root.parentNode) {
        root.parentNode.removeChild(root);
      } else if (typeof root.remove === "function") {
        root.remove();
      }
    },
  };
}
