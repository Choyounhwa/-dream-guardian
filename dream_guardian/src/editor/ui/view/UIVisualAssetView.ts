import {
  UIResourceCatalog,
  defaultResourceCatalog,
  type ImageAssetRecord,
} from "../data/UIResourceCatalog";
import {
  importLocalImage,
  type ImageImportInput,
  type ImageImportResult,
} from "../io/UIVisualImageImport";
import type {
  UIVisualDocument,
  UIVisualElement,
  UIVisualPageId,
} from "../data/UIVisualDocument";
import {
  type VisualEditorSession,
  executeVisualCommand,
} from "../UIEditorState";
import type { VisualCommand, VisualSetPropCommand } from "../UICommands";
import type { UIVisualStore } from "../storage/UIVisualStore";
import {
  UIAssetPreviewCache,
  createAssetPreviewCache,
} from "../preview/styles/UIAssetPreview";

export interface VisualAssetViewOptions {
  session?: VisualEditorSession;
  document?: UIVisualDocument;
  activePageId?: UIVisualPageId;
  selectedElementId?: string;
  catalog?: UIResourceCatalog;
  store?: UIVisualStore;
  previewCache?: UIAssetPreviewCache;
  onVisualCommit?: (command: VisualCommand) => void;
  onStatus?: (message: string) => void;
}

export interface VisualAssetViewInstance {
  readonly root: HTMLElement;
  setSelectedElement(id: string | null, pageId?: UIVisualPageId, doc?: UIVisualDocument): void;
  updateDocument(doc?: UIVisualDocument, pageId?: UIVisualPageId): void;
  setSession?(session: VisualEditorSession): void;
  importAssetFile(fileInput: ImageImportInput): Promise<ImageImportResult>;
  cancelImport(): void;
  refresh(): void;
  dispose(): void;
}

function formatByteSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mountVisualAssetView(
  container: HTMLElement,
  options?: VisualAssetViewOptions
): VisualAssetViewInstance {
  const doc = container.ownerDocument || (globalThis as any).document;

  let currentDoc = options?.session?.present ?? options?.document;
  let activePageId: UIVisualPageId =
    (options?.session?.activePageId ?? options?.activePageId ?? "menu_main") as UIVisualPageId;
  let currentElementId: string | null = options?.selectedElementId ?? null;
  let session = options?.session;

  const catalog = options?.catalog ?? defaultResourceCatalog;
  const store = options?.store;
  const previewCache = options?.previewCache ?? createAssetPreviewCache();

  // Root container
  const root = doc.createElement("div");
  root.className = "visual-asset-view";
  root.setAttribute("data-view", "visual-asset-view");
  root.setAttribute("data-panel", "visual-asset");

  // Title
  const title = doc.createElement("h3");
  title.className = "visual-asset-title";
  title.textContent = "이미지 에셋";
  root.appendChild(title);

  // Error Alert box
  const errorBox = doc.createElement("div");
  errorBox.className = "asset-error-message";
  errorBox.setAttribute("data-role", "error-message");
  errorBox.setAttribute("role", "alert");
  if (errorBox.style) {
    errorBox.style.display = "none";
  }
  root.appendChild(errorBox);

  // Asset Card (Thumbnail & Info)
  const assetCard = doc.createElement("div");
  assetCard.className = "asset-card";
  assetCard.setAttribute("data-role", "asset-card");

  // Thumbnail
  const thumb = doc.createElement("img");
  thumb.className = "asset-thumbnail";
  thumb.setAttribute("data-role", "thumbnail");
  thumb.setAttribute("alt", "에셋 썸네일 미리보기");
  assetCard.appendChild(thumb);

  // Info fields
  const infoContainer = doc.createElement("div");
  infoContainer.className = "asset-info-container";

  // Name
  const nameRow = doc.createElement("div");
  nameRow.className = "asset-info-row";
  const nameLabel = doc.createElement("span");
  nameLabel.className = "asset-label";
  nameLabel.textContent = "이름: ";
  const nameVal = doc.createElement("span");
  nameVal.className = "asset-name";
  nameVal.setAttribute("data-role", "asset-name");
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameVal);
  infoContainer.appendChild(nameRow);

  // ID
  const idRow = doc.createElement("div");
  idRow.className = "asset-info-row";
  const idLabel = doc.createElement("span");
  idLabel.className = "asset-label";
  idLabel.textContent = "ID: ";
  const idVal = doc.createElement("span");
  idVal.className = "asset-id";
  idVal.setAttribute("data-role", "asset-id");
  idRow.appendChild(idLabel);
  idRow.appendChild(idVal);
  infoContainer.appendChild(idRow);

  // Dimensions
  const dimRow = doc.createElement("div");
  dimRow.className = "asset-info-row";
  const dimLabel = doc.createElement("span");
  dimLabel.className = "asset-label";
  dimLabel.textContent = "해상도: ";
  const dimVal = doc.createElement("span");
  dimVal.className = "asset-dimensions";
  dimVal.setAttribute("data-role", "asset-dimensions");
  dimRow.appendChild(dimLabel);
  dimRow.appendChild(dimVal);
  infoContainer.appendChild(dimRow);

  // Size
  const sizeRow = doc.createElement("div");
  sizeRow.className = "asset-info-row";
  const sizeLabel = doc.createElement("span");
  sizeLabel.className = "asset-label";
  sizeLabel.textContent = "용량: ";
  const sizeVal = doc.createElement("span");
  sizeVal.className = "asset-size";
  sizeVal.setAttribute("data-role", "asset-size");
  sizeRow.appendChild(sizeLabel);
  sizeRow.appendChild(sizeVal);
  infoContainer.appendChild(sizeRow);

  assetCard.appendChild(infoContainer);
  root.appendChild(assetCard);

  // Action Buttons
  const actionsBar = doc.createElement("div");
  actionsBar.className = "asset-actions-bar";

  const importBtn = doc.createElement("button");
  importBtn.type = "button";
  importBtn.className = "btn-import-asset";
  importBtn.setAttribute("data-action", "import-asset");
  importBtn.textContent = "파일 가져오기";
  actionsBar.appendChild(importBtn);

  const replaceBtn = doc.createElement("button");
  replaceBtn.type = "button";
  replaceBtn.className = "btn-replace-asset";
  replaceBtn.setAttribute("data-action", "replace-asset");
  replaceBtn.textContent = "이미지 교체";
  actionsBar.appendChild(replaceBtn);

  const clearBtn = doc.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn-clear-asset";
  clearBtn.setAttribute("data-action", "clear-asset");
  clearBtn.textContent = "에셋 해제";
  actionsBar.appendChild(clearBtn);

  // Hidden file input
  const fileInput = doc.createElement("input");
  fileInput.type = "file";
  fileInput.setAttribute("data-role", "file-input");
  fileInput.setAttribute("accept", "image/png,image/jpeg,image/webp");
  if (fileInput.style) {
    fileInput.style.display = "none";
  }
  actionsBar.appendChild(fileInput);

  root.appendChild(actionsBar);

  // Catalog Section
  const catalogSection = doc.createElement("div");
  catalogSection.className = "catalog-section";
  catalogSection.setAttribute("data-role", "catalog-section");

  const catalogTitle = doc.createElement("h4");
  catalogTitle.className = "catalog-title";
  catalogTitle.textContent = "카탈로그 에셋 목록";
  catalogSection.appendChild(catalogTitle);

  const searchInput = doc.createElement("input");
  searchInput.type = "text";
  searchInput.className = "catalog-search";
  searchInput.setAttribute("data-role", "catalog-search");
  searchInput.setAttribute("placeholder", "카탈로그 검색...");
  catalogSection.appendChild(searchInput);

  const catalogList = doc.createElement("div");
  catalogList.className = "catalog-list";
  catalogList.setAttribute("data-role", "catalog-list");
  catalogSection.appendChild(catalogList);

  root.appendChild(catalogSection);
  container.appendChild(root);

  // Helper: get current visual element
  function getCurrentElement(): UIVisualElement | null {
    if (!currentDoc || !currentElementId) return null;
    const page = currentDoc.pages?.[activePageId];
    if (!page) return null;
    return page.elements.find((el) => el.id === currentElementId) ?? null;
  }

  // Helper: commit visual command
  function commitVisualCommand(cmd: VisualCommand): void {
    if (options?.onVisualCommit) {
      options.onVisualCommit(cmd);
    } else if (session && typeof executeVisualCommand === "function") {
      session = executeVisualCommand(session, cmd);
      currentDoc = session.present;
    }
  }

  // Refresh asset display
  async function refreshDisplay(): Promise<void> {
    const el = getCurrentElement();
    const assetId = el?.assetId;

    if (!el) {
      nameVal.textContent = "(요소 미선택)";
      idVal.textContent = "-";
      dimVal.textContent = "-";
      sizeVal.textContent = "-";
      thumb.src = "";
      thumb.alt = "선택된 요소 없음";
      return;
    }

    if (!assetId) {
      nameVal.textContent = "(에셋 미지정)";
      idVal.textContent = "-";
      dimVal.textContent = "-";
      sizeVal.textContent = "-";
      thumb.src = "";
      thumb.alt = "지정된 에셋 없음";
      return;
    }

    idVal.textContent = assetId;

    // Look up in catalog or approved resources
    const assetRecord = catalog.getAsset(assetId);
    if (assetRecord) {
      const name = "name" in assetRecord ? (assetRecord as ImageAssetRecord).name : assetRecord.id;
      const width = assetRecord.width ?? 0;
      const height = assetRecord.height ?? 0;
      const byteLen = "byteLength" in assetRecord ? (assetRecord as ImageAssetRecord).byteLength : undefined;

      nameVal.textContent = name;
      dimVal.textContent = width > 0 && height > 0 ? `${width} × ${height}` : "가변 / 미정";
      sizeVal.textContent = formatByteSize(byteLen);

      // Resolve URL in cache
      try {
        const url = await previewCache.resolveAssetUrl({
          id: assetRecord.id,
          bytes: "bytes" in assetRecord ? (assetRecord as ImageAssetRecord).bytes : undefined,
          mimeType: "mimeType" in assetRecord ? (assetRecord as ImageAssetRecord).mimeType : undefined,
          width: width || undefined,
          height: height || undefined,
        });
        thumb.src = url;
        thumb.alt = name;
      } catch {
        thumb.src = "";
      }
    } else {
      nameVal.textContent = assetId;
      dimVal.textContent = "-";
      sizeVal.textContent = "-";
    }
  }

  // Render catalog items
  function renderCatalog(filterText = ""): void {
    while (catalogList.children.length > 0) {
      catalogList.removeChild(catalogList.children[0]);
    }

    const query = filterText.trim().toLowerCase();
    const allAssets = catalog.listAssets();

    for (const item of allAssets) {
      const itemId = item.id;
      const itemName = "name" in item ? (item as ImageAssetRecord).name : item.id;
      if (query && !itemId.toLowerCase().includes(query) && !itemName.toLowerCase().includes(query)) {
        continue;
      }

      const itemEl = doc.createElement("div");
      itemEl.className = "catalog-item";
      itemEl.setAttribute("data-role", "catalog-item");

      const label = doc.createElement("span");
      label.className = "catalog-item-label";
      label.textContent = `${itemName} (${itemId})`;
      itemEl.appendChild(label);

      const selectBtn = doc.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "btn-select-catalog-item";
      selectBtn.setAttribute("data-action", "select-item");
      selectBtn.textContent = "선택";

      selectBtn.addEventListener("click", () => {
        applyAssetId(itemId);
      });

      itemEl.appendChild(selectBtn);
      catalogList.appendChild(itemEl);
    }
  }

  // Apply asset ID to current element
  function applyAssetId(newAssetId: string | undefined): void {
    const el = getCurrentElement();
    if (!el || !currentElementId) return;

    const previousAssetId = el.assetId;
    if (previousAssetId === newAssetId) return;

    const cmd: VisualSetPropCommand = {
      id: `cmd-asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "set-element-prop",
      pageId: activePageId,
      elementId: currentElementId,
      prop: "assetId",
      before: previousAssetId,
      after: newAssetId,
    };

    commitVisualCommand(cmd);
    void refreshDisplay();
  }

  // Import Asset File
  async function importAssetFile(fileInput: ImageImportInput): Promise<ImageImportResult> {
    const importResult = importLocalImage(fileInput, catalog);
    if (!importResult.ok) {
      errorBox.textContent = `[에셋 가져오기 실패] ${importResult.error}`;
      if (errorBox.style) {
        errorBox.style.display = "";
      }
      return importResult;
    }

    // Success: hide error box
    errorBox.textContent = "";
    if (errorBox.style) {
      errorBox.style.display = "none";
    }

    const registered = importResult.asset;

    // 1. Persist to storage port if available
    if (store && store.idb) {
      try {
        await store.idb.put("assets", registered.id, {
          assetId: registered.id,
          contentHash: registered.hash,
          durableAssetId: registered.id,
          mimeType: registered.mimeType,
          byteLength: registered.byteLength,
          data: fileInput.bytes,
          metadata: {
            name: registered.name,
            width: registered.width,
            height: registered.height,
            format: registered.format,
          },
        });
      } catch (err) {
        // storage save non-fatal in preview
      }
    }

    // 2. Resolve in preview cache
    await previewCache.resolveAssetUrl(registered);

    // 3. Apply command
    applyAssetId(registered.id);

    // 4. Re-render catalog and details
    renderCatalog(searchInput.value || "");
    await refreshDisplay();

    return importResult;
  }

  function cancelImport(): void {
    fileInput.value = "";
    errorBox.textContent = "";
    if (errorBox.style) {
      errorBox.style.display = "none";
    }
  }

  // Event Listeners
  const onSearchInput = () => {
    renderCatalog(searchInput.value || "");
  };
  searchInput.addEventListener("input", onSearchInput);

  const onImportClick = () => {
    fileInput.click();
  };
  importBtn.addEventListener("click", onImportClick);
  replaceBtn.addEventListener("click", onImportClick);

  const onClearClick = () => {
    applyAssetId(undefined);
  };
  clearBtn.addEventListener("click", onClearClick);

  const onFileInputChange = async (event: any) => {
    const files = event?.target?.files || fileInput.files;
    if (!files || files.length === 0) {
      cancelImport();
      return;
    }
    const file = files[0];
    const bytes = file.bytes || (file.arrayBuffer ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array());
    await importAssetFile({
      name: file.name || "imported-asset.png",
      bytes,
      mimeType: file.type || "image/png",
    });
  };
  fileInput.addEventListener("change", onFileInputChange);

  // Initial render
  renderCatalog();
  void refreshDisplay();

  const instance: VisualAssetViewInstance = {
    root,
    setSelectedElement(id: string | null, pageId?: UIVisualPageId, doc?: UIVisualDocument) {
      currentElementId = id;
      if (pageId) activePageId = pageId;
      if (doc) currentDoc = doc;
      errorBox.textContent = "";
      if (errorBox.style) {
        errorBox.style.display = "none";
      }
      void refreshDisplay();
    },
    updateDocument(doc?: UIVisualDocument, pageId?: UIVisualPageId) {
      if (doc) currentDoc = doc;
      if (pageId) activePageId = pageId;
      void refreshDisplay();
    },
    setSession(newSession: VisualEditorSession) {
      session = newSession;
      currentDoc = newSession.present;
      activePageId = newSession.activePageId;
      void refreshDisplay();
    },
    importAssetFile,
    cancelImport,
    refresh() {
      renderCatalog(searchInput.value || "");
      void refreshDisplay();
    },
    dispose() {
      if (typeof searchInput.removeEventListener === "function") {
        searchInput.removeEventListener("input", onSearchInput);
      }
      if (typeof importBtn.removeEventListener === "function") {
        importBtn.removeEventListener("click", onImportClick);
      }
      if (typeof replaceBtn.removeEventListener === "function") {
        replaceBtn.removeEventListener("click", onImportClick);
      }
      if (typeof clearBtn.removeEventListener === "function") {
        clearBtn.removeEventListener("click", onClearClick);
      }
      if (typeof fileInput.removeEventListener === "function") {
        fileInput.removeEventListener("change", onFileInputChange);
      }
      previewCache.dispose();
      if (root.parentNode) {
        root.parentNode.removeChild(root);
      } else if (typeof root.remove === "function") {
        root.remove();
      }
    },
  };

  return instance;
}
