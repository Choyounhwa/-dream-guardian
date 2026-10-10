import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  RENDERER_FINGERPRINT,
  clonePresetForEdit,
} from "../data/UIBaselines";
import { KINDS, SCHEMA_VERSION, DESIGN_SIZE } from "../data/UIContracts";
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
  onProjectOpened?: (doc: any, session?: any) => void;
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
  const menuPreset = clonePresetForEdit(BASELINE_REGISTRY.id);
  const baseline = {
    id: BASELINE_REGISTRY.id,
    version: BASELINE_REGISTRY.version,
    presetHash: BASELINE_REGISTRY.presetHash,
    approvedImageHash: APPROVED_IMAGE_HASH,
    rendererFingerprint: RENDERER_FINGERPRINT,
  };
  return {
    kind: KINDS.project,
    schemaVersion: SCHEMA_VERSION,
    design: { width: DESIGN_SIZE.width, height: DESIGN_SIZE.height },
    menu: doc.menu ?? menuPreset,
    baseline: doc.baseline ?? baseline,
  };
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
  if (!ctrl) {
    options?.onStatus?.(`저장 대상 컨트롤러가 없습니다 · ${GAME_REFLECTION_DISCLAIMER}`);
    return;
  }

  options?.onStatus?.("저장중...");

  try {
    if (typeof ctrl.save === "function") {
      const flight = ctrl.save();
      let outcome: any = null;
      if (typeof ctrl.completeSave === "function") {
        outcome = await ctrl.completeSave(flight?.actionId ?? "act-save");
      }

      if (outcome && typeof outcome === "object") {
        if (outcome.status === "conflict") {
          options?.onStatus?.(
            `충돌: 다른 탭에서 먼저 커밋됨 (세대 ${outcome.currentGeneration} != ${outcome.expectedGeneration}) · ${GAME_REFLECTION_DISCLAIMER}`
          );
          return;
        }
        if (outcome.status === "failed" || outcome.status === "rejected") {
          options?.onStatus?.(
            `저장 실패: ${outcome.error ?? outcome.reason ?? "저장 거부"} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`
          );
          return;
        }
        if (outcome.saved === false && !outcome.dirtyPending) {
          options?.onStatus?.(
            `저장 실패: ${outcome.reason ?? "저장되지 않음"} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`
          );
          return;
        }
        if (outcome.dirtyPending) {
          options?.onStatus?.(
            `초안만: checkpoint ${outcome.checkpointId} 저장 후 추가 편집됨 · ${GAME_REFLECTION_DISCLAIMER}`
          );
          return;
        }
        const checkpointId =
          outcome.checkpointId ??
          (flight?.actionId ? `cp-${flight.actionId}` : "checkpoint");
        options?.onStatus?.(
          `저장 완료 (저장됨): checkpoint ${checkpointId} · ${GAME_REFLECTION_DISCLAIMER}`
        );
        return;
      }

      const checkpointId = flight?.actionId ? `cp-${flight.actionId}` : "checkpoint";
      options?.onStatus?.(`저장 완료 (저장됨): checkpoint ${checkpointId} · ${GAME_REFLECTION_DISCLAIMER}`);
      return;
    }
  } catch (err: any) {
    options?.onStatus?.(
      `저장 실패: ${err?.name ?? "Error"}: ${err?.message ?? "저장 오류"} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`
    );
    return;
  }

  options?.onStatus?.(`저장 완료 (저장됨): checkpoint · ${GAME_REFLECTION_DISCLAIMER}`);
}

async function handleBackup(options?: FileActionOptions): Promise<void> {
  if (!options?.downloader) {
    const msg = `다운로드 API 미지원으로 백업 추출 불가 (원본 데이터 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`;
    options?.onStatus?.(msg);
    return;
  }
  const ctrl: ReplacePort = {
    projectId: () =>
      typeof options.controller?.getProjectId === "function"
        ? options.controller.getProjectId()
        : typeof options.controller?.projectId === "function"
        ? options.controller.projectId()
        : "proj-backup",
    document: () =>
      typeof options.controller?.getDocument === "function"
        ? options.controller.getDocument()
        : typeof options.controller?.document === "function"
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
        options.onStatus?.(
          `백업 완료 (다운로드 요청) (${st}) (실제 디스크 저장 여부는 브라우저 다운로드 확인 필요) · ${GAME_REFLECTION_DISCLAIMER}`
        );
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
      `전달 데이터 추출 완료 (다운로드 요청): ${fileName} (실제 디스크 저장 여부는 브라우저 다운로드 확인 필요) · ${GAME_REFLECTION_DISCLAIMER}`
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

  const file = await options.picker.pick();
  if (!file) {
    options?.onStatus?.(
      `프로젝트 열기 취소: 원본 편집 상태 보존됨 · ${GAME_REFLECTION_DISCLAIMER}`
    );
    return;
  }

  const ctrl = options?.controller;
  const isDirty =
    typeof ctrl?.status === "function"
      ? ctrl.status().dirty === true
      : Boolean(ctrl?.dirty);

  const confirmFn =
    options.confirm ??
    ((summary: string) => {
      if (typeof window !== "undefined" && typeof window.confirm === "function") {
        return window.confirm(summary);
      }
      return true;
    });

  if (isDirty) {
    const confirmed = confirmFn(
      "저장되지 않은 변경사항이 있습니다. 프로젝트를 열면 변경사항이 사라집니다. 계속하시겠습니까?"
    );
    if (!confirmed) {
      options?.onStatus?.(
        `열기 취소: 사용자 취소 (기존 문서 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
      );
      return;
    }
  }

  if (ctrl && typeof ctrl.openProject === "function") {
    try {
      const res = await ctrl.openProject(file.text);
      if (res.ok) {
        options?.onStatus?.(
          `열기 성공: ${file.name} · ${GAME_REFLECTION_DISCLAIMER}`
        );
        options?.onProjectOpened?.(ctrl.getDocument(), ctrl.getSession());
        return;
      } else {
        options?.onStatus?.(
          `열기 실패: ${res.reason ?? "유효하지 않은 프로젝트"} (기존 문서 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
        );
        return;
      }
    } catch (err: any) {
      options?.onStatus?.(
        `열기 실패: ${err?.message ?? "파일 파싱 실패"} (기존 문서 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
      );
      return;
    }
  }

  const replacePort: ReplacePort = {
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
      picker: { pick: async () => file },
      controller: replacePort,
      confirm: confirmFn,
      onStatus: (msg) => {
        options?.onStatus?.(`${msg} · ${GAME_REFLECTION_DISCLAIMER}`);
      },
    });
    if (!res.ok) {
      options?.onStatus?.(
        `열기 취소/실패: ${res.reason ?? "error"} (현재 프로젝트 보존됨) · ${GAME_REFLECTION_DISCLAIMER}`
      );
    } else {
      options?.onProjectOpened?.(replacePort.document());
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
