import { bootEditor } from "./UIEditorShell";
import { mountShell, type ShellInstance, type MountShellOptions } from "./view/UIShellView";
import type { Downloader, FilePicker } from "./io/UIProjectIO";
import { UIProjectController } from "./UIProjectController";
import { UIProjectStore } from "./storage/UIProjectStore";
import {
  STORE_NAMES,
  UIProjectDatabase,
  type DatabasePort,
  type PortStoreName,
  type PortTransaction,
  type TransactionOutcome,
} from "./storage/UIProjectDatabase";
import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  RENDERER_FINGERPRINT,
  clonePresetForEdit,
} from "./data/UIBaselines";
import { KINDS, SCHEMA_VERSION } from "./data/UIContracts";
import {
  UIVisualIndexedDB,
} from "./storage/UIVisualIndexedDB";
import { UIVisualStore } from "./storage/UIVisualStore";
import {
  UIVisualProjectController,
  type TimeScheduler,
  defaultTimeScheduler,
} from "./UIVisualProjectController";
import {
  createDefaultUIVisualDocument,
  type UIVisualDocument,
} from "./data/UIVisualDocument";

class InMemoryDatabasePort implements DatabasePort {
  readonly name = "dream-guardian-ui-editor";
  readonly stores = [...STORE_NAMES];
  private readonly tables = new Map<PortStoreName, Map<string, Record<string, unknown>>>();

  constructor() {
    for (const store of STORE_NAMES) {
      this.tables.set(store, new Map());
    }
  }

  open(): void {}

  transaction(): PortTransaction {
    const writes: Array<{ store: PortStoreName; key: string; value: Record<string, unknown> | null }> = [];
    return {
      get: <T>(store: PortStoreName, key: string): T | null => {
        const val = this.tables.get(store)?.get(key);
        return val ? (structuredClone(val) as T) : null;
      },
      put: (store: PortStoreName, key: string, value: Record<string, unknown>): void => {
        writes.push({ store, key, value: structuredClone(value) });
      },
      delete: (store: PortStoreName, key: string): void => {
        writes.push({ store, key, value: null });
      },
      abort: (): void => {
        writes.length = 0;
      },
      finish: (): TransactionOutcome => {
        for (const w of writes) {
          if (w.value === null) this.tables.get(w.store)?.delete(w.key);
          else this.tables.get(w.store)?.set(w.key, w.value);
        }
        return "committed";
      },
    } as any;
  }

  finish(tx: PortTransaction): TransactionOutcome {
    const candidate = tx as any;
    if (candidate.finish) return candidate.finish();
    return "committed";
  }
}

export function createDefaultProjectDoc(projectId = "proj-1"): Record<string, unknown> {
  const preset = clonePresetForEdit(BASELINE_REGISTRY.id);
  return {
    kind: KINDS.project,
    schemaVersion: SCHEMA_VERSION,
    projectId,
    design: { width: preset.design.width, height: preset.design.height },
    menu: {
      cards: preset.cards.map((card) => ({ id: card.id, x: card.x, y: card.y })),
      width: preset.width,
      height: preset.height,
      workoutButton: { ...preset.workoutButton },
    },
    baseline: {
      id: BASELINE_REGISTRY.id,
      version: BASELINE_REGISTRY.version,
      presetHash: BASELINE_REGISTRY.presetHash,
      approvedImageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    },
  };
}

export function createDefaultController(projectId = "proj-1"): UIProjectController {
  const db = new UIProjectDatabase(new InMemoryDatabasePort());
  const store = new UIProjectStore(db);
  const ctrl = new UIProjectController({
    store,
    writerId: "browser-writer",
    projectId,
    now: () => Date.now(),
  });
  ctrl.edit(createDefaultProjectDoc(projectId));
  return ctrl;
}

export function createBrowserDownloader(): Downloader {
  return {
    download: (name: string, text: string): string => {
      if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
        return name;
      }
      try {
        const blob = new Blob([text], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        console.warn("[Downloader] Download fallback error:", e);
      }
      return name;
    },
  };
}

export function createBrowserPicker(): FilePicker {
  return {
    pick: async (): Promise<{ name: string; text: string } | null> => {
      if (typeof document === "undefined") {
        return null;
      }
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.style.display = "none";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            input.remove();
            return;
          }
          try {
            const text = await file.text();
            resolve({ name: file.name, text });
          } catch {
            resolve(null);
          } finally {
            input.remove();
          }
        };
        document.body.appendChild(input);
        input.click();
      });
    },
  };
}

export type EditorApp = ReturnType<typeof bootEditor> & {
  instance: ShellInstance | null;
  controller: UIProjectController;
  downloader: Downloader;
  picker: FilePicker;
  unmount: () => void;
};

export function start(
  container?: HTMLElement | null,
  options?: MountShellOptions
): EditorApp {
  const shell = bootEditor();
  const root =
    container ??
    (typeof document !== "undefined" ? document.getElementById("app") : null);

  const controller = options?.controller ?? createDefaultController();
  const downloader = options?.downloader ?? createBrowserDownloader();
  const picker = options?.picker ?? createBrowserPicker();

  let instance: ShellInstance | null = null;
  if (root) {
    while (root.children && root.children.length > 0) {
      root.removeChild(root.children[0]);
    }
    root.dataset.panels = shell.panels.join(",");
    instance = mountShell(root, {
      controller,
      downloader,
      picker,
      ...options,
    });
  }

  return {
    ...shell,
    instance,
    controller,
    downloader,
    picker,
    unmount: () => {
      instance?.unmount();
    },
  };
}

export interface VisualEditorOptions extends MountShellOptions {
  projectId?: string;
  factory?: IDBFactory;
  dbName?: string;
  scheduler?: TimeScheduler;
  writerId?: string;
}

export type VisualEditorApp = ShellInstance & {
  controller: UIVisualProjectController;
  store: UIVisualStore;
  idb: UIVisualIndexedDB;
};

export async function initVisualEditor(
  container: HTMLElement,
  options?: VisualEditorOptions
): Promise<VisualEditorApp> {
  const projectId = options?.projectId ?? "proj-1";
  const writerId = options?.writerId ?? `writer-${Date.now()}`;
  const scheduler = options?.scheduler ?? defaultTimeScheduler;

  const idb = new UIVisualIndexedDB({
    dbName: options?.dbName,
    factory: options?.factory,
  });
  await idb.open();
  const store = new UIVisualStore(idb);

  let initialDoc: UIVisualDocument | undefined;
  let initialGeneration = 0;

  // 1. Try restore from project head
  const head = await store.getProjectHead(projectId);
  if (head) {
    const cp = await store.getCheckpoint(head.headCheckpointId);
    if (cp && cp.snapshot) {
      initialDoc = cp.snapshot as unknown as UIVisualDocument;
      initialGeneration = head.generation;
    }
  }

  // 2. Try restore from writer draft if no head
  if (!initialDoc) {
    const draft = await store.loadDraft(projectId, writerId);
    if (draft && draft.document) {
      initialDoc = draft.document as unknown as UIVisualDocument;
      initialGeneration = draft.expectedGeneration;
    }
  }

  // 3. Fallback to passed option or default 10-page document
  if (!initialDoc && options?.document) {
    initialDoc = options.document;
  }
  if (!initialDoc) {
    initialDoc = createDefaultUIVisualDocument();
  }

  const controller = new UIVisualProjectController({
    store,
    projectId,
    writerId,
    scheduler,
    initialDocument: initialDoc,
    initialGeneration,
  });

  const downloader = options?.downloader ?? createBrowserDownloader();
  const picker = options?.picker ?? createBrowserPicker();

  const shell = mountShell(container, {
    downloader,
    picker,
    ...options,
    controller,
    session: controller.getSession(),
    document: controller.getDocument(),
    store,
  });

  const origUnmount = shell.unmount.bind(shell);
  const unmount = () => {
    origUnmount();
    idb.close();
  };

  const app: VisualEditorApp = Object.assign(shell, {
    controller,
    store,
    idb,
    unmount,
    dispose: unmount,
  });

  return app;
}

if (typeof document !== "undefined") {
  const root =
    document.getElementById("app") ??
    document.getElementById("editor-root");
  if (root) {
    if (typeof indexedDB !== "undefined") {
      initVisualEditor(root).catch((err) => {
        console.error("[UI Editor] Failed to init visual editor:", err);
        start(root);
      });
    } else {
      start(root);
    }
  }
}

