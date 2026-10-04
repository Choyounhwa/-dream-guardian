import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  RENDERER_FINGERPRINT,
  clonePresetForEdit,
} from "../data/UIBaselines";
import { KINDS, SCHEMA_VERSION } from "../data/UIContracts";
import { buildTransfer } from "../data/UITransferBuilder";
import {
  type Downloader,
  type FilePicker,
  type ReplacePort,
  runBackup,
  runOpen,
} from "../io/UIProjectIO";

export { type Downloader, type FilePicker, type ReplacePort };

export const GAME_APPLY_VERIFIED = false;
export const STORAGE_TOUCHED = false;
export const GAME_REFLECTION_DISCLAIMER = "게임에는 반영되지 않음";

export type DirtyExportChoice = "save-and-export" | "saved-only" | "cancel";

export interface FileActionOptions {
  controller?: any;
  downloader?: Downloader;
  picker?: FilePicker;
  confirm?: (summary: string) => boolean;
  promptDirtyExport?: () => DirtyExportChoice;
  baseline?: Record<string, unknown>;
  onStatus?: (message: string) => void;
}

export interface FileActionInstance {
  readonly root: HTMLElement;
  triggerAction(
    actionName: "저장" | "프로젝트 백업" | "전달 데이터 추출" | "열기"
  ): Promise<void>;
  unmount(): void;
  dispose(): void;
}

function ensureValidProjectSnapshot(doc: any): any {
  if (!doc || typeof doc !== "object") return doc;
  const copy = { ...doc };
  delete copy.projectId;
  if (!copy.kind) copy.kind = KINDS.project;
  if (!copy.schemaVersion) copy.schemaVersion = SCHEMA_VERSION;
  if (!copy.baseline) {
    copy.baseline = {
      id: BASELINE_REGISTRY.id,
      version: BASELINE_REGISTRY.version,
      presetHash: BASELINE_REGISTRY.presetHash,
      approvedImageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    };
  }
  return copy;
}

function findButton(root: HTMLElement, actionName: string): HTMLElement | null {
  const byAttr = root.querySelector(`[data-action="${actionName}"]`);
  if (byAttr) return byAttr as HTMLElement;
  const allBtns = root.querySelectorAll("button");
  for (let i = 0; i < allBtns.length; i++) {
    const btn = allBtns[i];
    if (btn.textContent && btn.textContent.trim() === actionName) {
      return btn as HTMLElement;
    }
  }
  return null;
}

async function handleSave(options?: FileActionOptions): Promise<void> {
  const ctrl = options?.controller;
  let checkpointId = "checkpoint";
  if (ctrl && typeof ctrl.save === "function") {
    const flight = ctrl.save();
    if (typeof ctrl.completeSave === "function") {
      const outcome = ctrl.completeSave(flight?.actionId ?? "act-save");
      checkpointId =
        outcome?.checkpointId ??
        (flight?.actionId ? `cp-${flight.actionId}` : "checkpoint");
    }
  }
  const msg = `저장 완료: checkpoint ${checkpointId} · ${GAME_REFLECTION_DISCLAIMER}`;
  options?.onStatus?.(msg);
}

async function handleBackup(options?: FileActionOptions): Promise<void> {
  if (!options?.downloader) {
    const msg = `다운로드 API 미지원으로 백업 추출 불가 (원본 데이터 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`;
    options?.onStatus?.(msg);
    return;
  }
  const ctrl: ReplacePort = {
    projectId: () =>
      typeof options.controller?.projectId === "function"
        ? options.controller.projectId()
        : "proj-backup",
    document: () =>
      typeof options.controller?.document === "function"
        ? options.controller.document()
        : (options.controller?._doc ?? {}),
    requestReplace: (inc) => options.controller?.requestReplace?.(inc),
    confirmReplace: (c) =>
      options.controller?.confirmReplace?.(c) ?? { applied: true },
  };

  const baseline =
    options.baseline ??
    (clonePresetForEdit(BASELINE_REGISTRY.id) as Record<string, unknown>);

  try {
    const backupRes = runBackup({
      controller: ctrl,
      downloader: options.downloader,
      baseline,
      saveAvailable:
        typeof options.controller?.status === "function"
          ? options.controller.status().saved
          : true,
      onStatus: (st) => {
        options.onStatus?.(`백업 완료 (${st}) · ${GAME_REFLECTION_DISCLAIMER}`);
      },
    });
    if (!backupRes.ok) {
      options.onStatus?.(
        `다운로드 API 미지원으로 백업 추출 불가 (원본 데이터 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
      );
    }
  } catch {
    options.onStatus?.(
      `다운로드 API 미지원으로 백업 추출 불가 (원본 데이터 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
    );
  }
}

async function handleExport(options?: FileActionOptions): Promise<void> {
  const ctrl = options?.controller;
  const isDirty =
    typeof ctrl?.status === "function"
      ? ctrl.status().dirty === true
      : ctrl?.dirty === true || ctrl?.label === "dirty";

  let targetDoc: any;
  if (isDirty) {
    const choice: DirtyExportChoice = options?.promptDirtyExport
      ? options.promptDirtyExport()
      : "save-and-export";

    if (choice === "cancel") {
      options?.onStatus?.(
        `전달 데이터 추출 취소: 원본 편집 상태 보존됨 · ${GAME_REFLECTION_DISCLAIMER}`
      );
      return;
    } else if (choice === "saved-only") {
      targetDoc =
        ctrl?.saved ??
        (typeof ctrl?.document === "function" ? ctrl.document() : ctrl?._doc);
    } else {
      // save-and-export
      if (ctrl && typeof ctrl.save === "function") {
        const flight = ctrl.save();
        if (typeof ctrl.completeSave === "function") {
          ctrl.completeSave(flight?.actionId ?? "act-export");
        }
      }
      targetDoc =
        typeof ctrl?.document === "function" ? ctrl.document() : ctrl?._doc;
    }
  } else {
    targetDoc =
      typeof ctrl?.document === "function"
        ? ctrl.document()
        : (ctrl?._doc ?? {});
  }

  const exportId = `export-${Date.now()}`;
  const sourceId =
    typeof ctrl?.projectId === "function" ? ctrl.projectId() : "proj-export";

  const result = buildTransfer({
    checkpoint: ensureValidProjectSnapshot(targetDoc),
    scope: "menu",
    sourceId,
    exportId,
  });

  if (!result.ok) {
    options?.onStatus?.(
      `전달 데이터 추출 실패: ${result.reason} (원본 데이터 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
    );
    return;
  }

  if (!options?.downloader) {
    options?.onStatus?.(
      `다운로드 API 미지원으로 전달 데이터 추출 불가 (원본 데이터 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
    );
    return;
  }

  const fileName = `transfer-${exportId}.json`;
  try {
    options.downloader.download(
      fileName,
      JSON.stringify(result.transfer, null, 2)
    );
    options?.onStatus?.(
      `전달 데이터 추출 완료: ${fileName} · ${GAME_REFLECTION_DISCLAIMER}`
    );
  } catch {
    options?.onStatus?.(
      `다운로드 API 미지원으로 전달 데이터 추출 불가 (원본 데이터 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
    );
  }
}

async function handleOpen(options?: FileActionOptions): Promise<void> {
  if (!options?.picker) {
    options?.onStatus?.(
      `파일 선택 API 미지원으로 프로젝트를 열 수 없습니다 (현재 프로젝트 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
    );
    return;
  }

  const ctrl: ReplacePort = {
    projectId: () =>
      typeof options.controller?.projectId === "function"
        ? options.controller.projectId()
        : "proj-open",
    document: () =>
      typeof options.controller?.document === "function"
        ? options.controller.document()
        : (options.controller?._doc ?? {}),
    requestReplace: (inc) => options.controller?.requestReplace?.(inc),
    confirmReplace: (c) =>
      options.controller?.confirmReplace?.(c) ?? { applied: true },
  };

  try {
    const res = await runOpen({
      picker: options.picker,
      controller: ctrl,
      confirm: options.confirm ?? (() => true),
      onStatus: (msg) => {
        options?.onStatus?.(`${msg} · ${GAME_REFLECTION_DISCLAIMER}`);
      },
    });
    if (!res.ok) {
      options?.onStatus?.(
        `열기 취소/실패: ${res.reason ?? "error"} (현재 프로젝트 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
      );
    }
  } catch (err: any) {
    options?.onStatus?.(
      `error ${err?.message ?? "unknown"} · ${GAME_REFLECTION_DISCLAIMER}`
    );
  }
}

export function bindFileActions(
  toolbar: HTMLElement,
  options?: FileActionOptions
): FileActionInstance {
  const listeners: {
    element: HTMLElement;
    type: string;
    handler: (e: any) => void;
  }[] = [];

  const actions: Record<string, () => Promise<void>> = {
    "저장": () => handleSave(options),
    "프로젝트 백업": () => handleBackup(options),
    "전달 데이터 추출": () => handleExport(options),
    "열기": () => handleOpen(options),
  };

  for (const [actionName, fn] of Object.entries(actions)) {
    const btn = findButton(toolbar, actionName);
    if (btn) {
      const handler = (e: any) => {
        if (e && typeof e.preventDefault === "function") {
          e.preventDefault();
        }
        void fn();
      };
      btn.addEventListener("click", handler);
      listeners.push({ element: btn, type: "click", handler });
    }
  }

  const triggerAction = async (
    actionName: "저장" | "프로젝트 백업" | "전달 데이터 추출" | "열기"
  ): Promise<void> => {
    const fn = actions[actionName];
    if (fn) {
      await fn();
    }
  };

  const unmount = () => {
    for (const { element, type, handler } of listeners) {
      element.removeEventListener(type, handler);
    }
    listeners.length = 0;
  };

  return {
    root: toolbar,
    triggerAction,
    unmount,
    dispose: unmount,
  };
}
