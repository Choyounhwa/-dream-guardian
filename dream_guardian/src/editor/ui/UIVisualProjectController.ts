/**
 * UIVisualProjectController.ts - UI visual 전용 자동저장·복구·프로젝트 교체 상태 모델
 *
 * Issue #466 / UI-VIS-036:
 * - 불변 visual session을 소비하는 비동기 컨트롤러
 * - 명시 저장 checkpoint와 800ms debounce draft(자동저장) 분리
 * - Scheduler(타이머/시계) 주입 지원 (모의/실제 타이머 정밀 제어)
 * - 저장 캡처 revision 이후 편집 발생 시 dirty=true / saved=false 유지
 * - Stale session 및 이전 revision 지연 응답 무시 (경합 차단)
 * - CAS generation mismatch 감지 시 2탭 conflict 상태 전환 및 retry/clone/discard 조정
 * - Commit 완료 전에는 절대로 saved=true 플래그 전환 금지
 * - 열기/복구/변환 후보 검증 및 원자 교체 (실패 시 원본 byte 동일 보존)
 * - 필수/승인 자산 누락 시 교체 거부
 * - 프로젝트 교체/복구 시 Undo history 경계 리셋
 * - Gameplay storage(런타임 플레이 데이터/스코어 등) 절대 접근 차단
 */

import {
  type UIVisualDocument,
  type UIVisualPageId,
  UI_VISUAL_PAGE_IDS,
  createDefaultUIVisualDocument,
} from "./data/UIVisualDocument";
import {
  type VisualEditorSession,
  createVisualSession,
  loadVisualDocument,
  resetVisualSession,
  executeVisualCommand,
} from "./UIEditorState";
import {
  cloneVisualDocument,
  isVisualDocEqual,
  type VisualCommand,
} from "./UICommands";
import { validateUIVisualDocument } from "./data/UIVisualValidator";
import { validateExternalJsonLimits } from "./data/UIContracts";
import { migrateToUIVisualDocument } from "./io/UIVisualMigration";
import { lookupApprovedResource, UIResourceCatalog } from "./data/UIResourceCatalog";
import type {
  UIVisualStore,
  SaveCheckpointRequest,
  SaveResult,
} from "./storage/UIVisualStore";

export const AUTOSAVE_DELAY_MS = 800;

export interface TimeScheduler {
  setTimeout(fn: () => void, ms: number): any;
  clearTimeout(id: any): void;
  now(): number;
}

export const defaultTimeScheduler: TimeScheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
  now: () => Date.now(),
};

export interface VisualProjectStatus {
  saved: boolean;
  dirty: boolean;
  saving: boolean;
  autosaving: boolean;
  draftSaved: boolean;
  conflict: boolean;
  label: string;
  revision: number;
  generation: number;
  activePageId: UIVisualPageId;
}

export interface Flight {
  status: "in-flight";
  actionId: string;
}

export interface VisualSaveResult {
  status: "saved" | "conflict" | "failed" | "rejected" | "ignored-stale";
  saved: boolean;
  checkpointId?: string;
  generation?: number;
  currentGeneration?: number;
  expectedGeneration?: number;
  revision?: number;
  applied: boolean;
  dirtyPending?: boolean;
  reason?: string;
  error?: string;
}

export interface InFlightAction {
  id: string;
  sessionId: string;
  expectedGeneration: number;
  capturedRevision: number;
  capturedSnapshot: UIVisualDocument;
  cancelled: boolean;
  createdAt: number;
}

export interface ReconcileResult {
  success: boolean;
  status: string;
  newGeneration?: number;
  projectId?: string;
  error?: string;
}

export interface OpenProjectResult {
  ok: boolean;
  reason?: string;
  errors?: any[];
  originalRaw?: string;
  missingAssets?: string[];
}

export interface RecoverResult {
  recovered: boolean;
  reason?: string;
  source?: "draft" | "backup";
}

export interface DisposeReport {
  flushed: boolean;
  dirty: boolean;
  error?: string;
}

export interface UIVisualProjectControllerOptions {
  store: UIVisualStore;
  projectId?: string;
  writerId?: string;
  initialDocument?: UIVisualDocument;
  initialSession?: VisualEditorSession;
  initialGeneration?: number;
  scheduler?: TimeScheduler;
  assetCatalog?: UIResourceCatalog;
  assetValidator?: (assetId: string) => Promise<boolean> | boolean;
}

export class UIVisualProjectController {
  private readonly store: UIVisualStore;
  private readonly scheduler: TimeScheduler;
  private readonly writerId: string;
  private readonly assetCatalog?: UIResourceCatalog;
  private readonly assetValidator?: (assetId: string) => Promise<boolean> | boolean;

  private projectId: string;
  private session: VisualEditorSession;
  private generation: number;
  private saved: boolean = true;
  private dirty: boolean = false;
  private saving: boolean = false;
  private autosaving: boolean = false;
  private draftSaved: boolean = false;
  private conflict: boolean = false;
  private label: string = "idle";
  private conflictDetails: {
    expectedGeneration: number;
    currentGeneration: number;
    reason: string;
  } | null = null;

  private autosaveTimer: any = null;
  private sequence: number = 0;
  private isClosed: boolean = false;
  private readonly actions = new Map<string, InFlightAction>();

  constructor(options: UIVisualProjectControllerOptions) {
    this.store = options.store;
    this.scheduler = options.scheduler ?? defaultTimeScheduler;
    this.writerId = options.writerId ?? "writer-default";
    this.projectId = options.projectId ?? "proj-visual-default";
    this.generation = options.initialGeneration ?? 0;
    this.assetCatalog = options.assetCatalog;
    this.assetValidator = options.assetValidator;

    if (options.initialSession) {
      this.session = options.initialSession;
    } else {
      const doc = options.initialDocument ?? createDefaultUIVisualDocument();
      this.session = createVisualSession(doc, "menu_main", `session-${++this.sequence}`);
    }
  }

  getProjectId(): string {
    return this.projectId;
  }

  getSessionId(): string {
    return this.session.sessionId;
  }

  getDocument(): UIVisualDocument {
    return cloneVisualDocument(this.session.present);
  }

  getSession(): VisualEditorSession {
    return this.session;
  }

  getGeneration(): number {
    return this.generation;
  }

  getConflictDetails(): {
    expectedGeneration: number;
    currentGeneration: number;
    reason: string;
  } | null {
    return this.conflictDetails;
  }

  isDisposed(): boolean {
    return this.isClosed;
  }

  status(): VisualProjectStatus {
    return {
      saved: this.saved,
      dirty: this.dirty,
      saving: this.saving,
      autosaving: this.autosaving,
      draftSaved: this.draftSaved,
      conflict: this.conflict,
      label: this.label,
      revision: this.session.revision,
      generation: this.generation,
      activePageId: this.session.activePageId,
    };
  }

  /**
   * 문서 또는 세션 편집
   */
  edit(
    updater:
      | VisualEditorSession
      | ((prev: VisualEditorSession) => VisualEditorSession)
      | VisualCommand
  ): void {
    if (this.isClosed) {
      throw new Error("Cannot edit: controller has been disposed");
    }

    let nextSession: VisualEditorSession;
    if (typeof updater === "function") {
      nextSession = updater(this.session);
    } else if ("type" in updater) {
      nextSession = executeVisualCommand(this.session, updater);
    } else {
      nextSession = updater;
    }

    // revision이 명시적으로 증가하지 않은 경우 안전하게 1 증가
    if (nextSession.revision <= this.session.revision) {
      nextSession = {
        ...nextSession,
        revision: this.session.revision + 1,
      };
    }

    this.session = nextSession;
    this.dirty = true;
    this.saved = false;
    this.draftSaved = false;
    this.conflict = false;
    this.conflictDetails = null;
    this.label = "dirty";

    // 800ms debounce draft autosave 예약
    if (this.autosaveTimer !== null) {
      this.scheduler.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    this.autosaveTimer = this.scheduler.setTimeout(() => {
      void this.triggerAutosaveDraft();
    }, AUTOSAVE_DELAY_MS);
  }

  /**
   * 800ms 도달 시 실행되는 임시 draft 자동저장
   */
  async triggerAutosaveDraft(): Promise<boolean> {
    if (this.isClosed || !this.dirty) {
      return false;
    }

    this.autosaving = true;
    try {
      await this.store.saveDraft({
        projectId: this.projectId,
        writerId: this.writerId,
        expectedGeneration: this.generation,
        document: cloneVisualDocument(this.session.present) as unknown as Record<string, unknown>,
      });
      this.draftSaved = true;
      return true;
    } catch {
      return false;
    } finally {
      this.autosaving = false;
    }
  }

  /**
   * 대기 중인 autosave 타이머를 즉시 비우고 draft를 영속화
   */
  async flushAutosave(): Promise<boolean> {
    if (this.autosaveTimer !== null) {
      this.scheduler.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    return await this.triggerAutosaveDraft();
  }

  /**
   * 체크포인트 저장 시작 (In-flight Action 캡처)
   */
  save(): Flight {
    if (this.isClosed) {
      throw new Error("Cannot save: controller has been disposed");
    }

    const actionId = `act-${++this.sequence}`;
    const action: InFlightAction = {
      id: actionId,
      sessionId: this.session.sessionId,
      expectedGeneration: this.generation,
      capturedRevision: this.session.revision,
      capturedSnapshot: cloneVisualDocument(this.session.present),
      cancelled: false,
      createdAt: this.scheduler.now(),
    };

    this.actions.set(actionId, action);
    this.saving = true;
    this.saved = false; // commit 완료 전 saved 플래그 전환 금지
    this.label = "saving";

    return { status: "in-flight", actionId };
  }

  /**
   * 시작된 체크포인트 저장 비동기 완료 처리
   */
  async completeSave(actionId: string): Promise<VisualSaveResult> {
    const action = this.actions.get(actionId);
    if (!action || action.cancelled || action.sessionId !== this.session.sessionId || this.isClosed) {
      this.saving = false;
      return { status: "ignored-stale", saved: false, applied: false };
    }

    const saveRequest: SaveCheckpointRequest = {
      projectId: this.projectId,
      writerId: this.writerId,
      expectedGeneration: action.expectedGeneration,
      documentRevision: action.capturedRevision,
      snapshot: action.capturedSnapshot as unknown as Record<string, unknown>,
      requestId: `req-${action.id}`,
      sessionId: action.sessionId,
    };

    let result: SaveResult;
    try {
      result = await this.store.saveCheckpoint(saveRequest);
    } catch (err: any) {
      this.actions.delete(actionId);
      this.saving = false;
      return {
        status: "failed",
        saved: false,
        applied: false,
        error: err?.message ?? String(err),
      };
    }

    this.actions.delete(actionId);

    // 저장 완료 시점에 세션이 바뀌었거나 종료된 경우
    if (action.sessionId !== this.session.sessionId || this.isClosed) {
      this.saving = false;
      return { status: "ignored-stale", saved: false, applied: false };
    }

    if (result.status === "conflict") {
      this.conflict = true;
      this.saved = false;
      this.saving = false;
      this.label = "conflict";
      this.conflictDetails = {
        expectedGeneration: action.expectedGeneration,
        currentGeneration: result.currentGeneration,
        reason: result.reason,
      };
      return {
        status: "conflict",
        saved: false,
        applied: false,
        currentGeneration: result.currentGeneration,
        expectedGeneration: action.expectedGeneration,
        reason: result.reason,
      };
    }

    if (result.status !== "saved") {
      this.saving = false;
      return {
        status: result.status,
        saved: false,
        applied: false,
        reason: (result as any).reason,
        error: (result as any).error,
      };
    }

    // 성공적으로 커밋됨
    this.generation = result.generation;
    this.conflict = false;
    this.conflictDetails = null;

    // 지연 저장 도중 재편집이 발생했는지 검증
    const isSameRevision = this.session.revision === action.capturedRevision;
    const isDocIdentical = isVisualDocEqual(this.session.present, action.capturedSnapshot);

    if (isSameRevision && isDocIdentical) {
      this.saved = true;
      this.dirty = false;
      this.saving = false;
      this.label = "saved";
      this.session.baseline = cloneVisualDocument(action.capturedSnapshot);
      return {
        status: "saved",
        saved: true,
        applied: true,
        generation: result.generation,
        revision: action.capturedRevision,
        checkpointId: result.checkpointId,
      };
    } else {
      // 저장 진행 중에 추가 편집이 발생했으므로 saved=false 및 dirty=true 유지!
      this.saved = false;
      this.dirty = true;
      this.saving = false;
      this.label = "dirty";
      return {
        status: "saved",
        saved: false,
        applied: false,
        dirtyPending: true,
        generation: result.generation,
        checkpointId: result.checkpointId,
      };
    }
  }

  /**
   * 편의 메소드: save() 호출 후 즉시 completeSave() 대기
   */
  async saveCheckpoint(): Promise<VisualSaveResult> {
    const flight = this.save();
    return await this.completeSave(flight.actionId);
  }

  /**
   * 2탭 CAS 충돌 조정 (retry, clone, discard)
   */
  async reconcileConflict(
    strategy: "retry" | "clone" | "discard",
    newProjectId?: string
  ): Promise<ReconcileResult> {
    if (strategy === "retry") {
      const head = await this.store.getProjectHead(this.projectId);
      this.generation = head?.generation ?? 0;
      this.conflict = false;
      this.conflictDetails = null;

      const res = await this.saveCheckpoint();
      return {
        success: res.status === "saved" && res.saved,
        status: res.status,
        newGeneration: this.generation,
      };
    }

    if (strategy === "clone") {
      const targetProjectId = newProjectId ?? `${this.projectId}-clone-${++this.sequence}`;
      this.projectId = targetProjectId;
      this.generation = 0;
      this.conflict = false;
      this.conflictDetails = null;

      const res = await this.saveCheckpoint();
      return {
        success: res.status === "saved" && res.saved,
        status: res.status,
        projectId: targetProjectId,
        newGeneration: this.generation,
      };
    }

    if (strategy === "discard") {
      const head = await this.store.getProjectHead(this.projectId);
      if (head) {
        const cp = await this.store.getCheckpoint(head.headCheckpointId);
        if (cp && cp.snapshot) {
          const doc = cp.snapshot as unknown as UIVisualDocument;
          this.session = resetVisualSession(
            doc,
            this.session.activePageId,
            `session-${++this.sequence}`
          );
          this.generation = head.generation;
        }
      }
      this.dirty = false;
      this.saved = true;
      this.conflict = false;
      this.conflictDetails = null;
      this.label = "saved";
      return { success: true, status: "discarded" };
    }

    return { success: false, status: "unknown-strategy" };
  }

  /**
   * 로컬 변경 폐기 및 베이스라인으로 복귀
   */
  discard(): void {
    if (this.autosaveTimer !== null) {
      this.scheduler.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    for (const action of this.actions.values()) {
      action.cancelled = true;
    }
    this.actions.clear();

    this.session = resetVisualSession(
      this.session.baseline,
      this.session.activePageId,
      `session-${++this.sequence}`
    );
    this.dirty = false;
    this.saved = true;
    this.conflict = false;
    this.conflictDetails = null;
    this.label = "saved";
  }

  /**
   * 외부 프로젝트 열기 / 원자 교체 (검증·마이그레이션·자산 확인 포함)
   */
  async openProject(
    candidate: unknown,
    options?: { projectId?: string }
  ): Promise<OpenProjectResult> {
    if (this.isClosed) {
      return { ok: false, reason: "Controller disposed" };
    }

    const rawString =
      typeof candidate === "string"
        ? candidate
        : JSON.stringify(candidate);

    // 1. JSON 구조 및 한도 검증
    let parsed: any;
    try {
      parsed = typeof candidate === "string" ? JSON.parse(candidate) : candidate;
    } catch (e: any) {
      return { ok: false, reason: "Invalid JSON syntax", originalRaw: rawString };
    }

    const limits = validateExternalJsonLimits(parsed);
    if (!limits.ok) {
      return { ok: false, reason: limits.reason, originalRaw: rawString };
    }

    // 2. 레거시 형식 마이그레이션 확인
    let documentToValidate: UIVisualDocument;
    if (
      parsed.kind === "dream-guardian-ui-project" ||
      parsed.kind === "dream-guardian-ui-transfer" ||
      parsed.schemaVersion !== "1.0.0" ||
      !parsed.pages
    ) {
      const migrationResult = migrateToUIVisualDocument(parsed);
      if (!migrationResult.ok) {
        return {
          ok: false,
          reason: migrationResult.reason,
          errors: migrationResult.errors,
          originalRaw: rawString,
        };
      }
      documentToValidate = migrationResult.document;
    } else {
      documentToValidate = parsed as UIVisualDocument;
    }

    // 3. 10페이지 시각 문서 스키마 검증
    const schemaValidation = validateUIVisualDocument(documentToValidate);
    if (!schemaValidation.valid) {
      return {
        ok: false,
        reason: "Invalid UIVisualDocument schema",
        errors: schemaValidation.errors,
        originalRaw: rawString,
      };
    }

    // 4. 참조 자산 검증 (누락된 자산 존재 시 교체 원자적 거부)
    const missingAssets = await this.findMissingAssets(documentToValidate);
    if (missingAssets.length > 0) {
      return {
        ok: false,
        reason: "Asset missing: required assets cannot be resolved",
        missingAssets,
        originalRaw: rawString,
      };
    }

    // 5. 원자적 프로젝트 교체 실행
    if (this.autosaveTimer !== null) {
      this.scheduler.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    // 기존 세션 무효화
    for (const action of this.actions.values()) {
      action.cancelled = true;
    }
    this.actions.clear();

    const newProjectId = options?.projectId ?? this.projectId;
    this.projectId = newProjectId;
    this.session = createVisualSession(
      documentToValidate,
      "menu_main",
      `session-${++this.sequence}`
    );
    this.generation = 0;
    this.dirty = false;
    this.saved = true;
    this.conflict = false;
    this.conflictDetails = null;
    this.label = "saved";

    return { ok: true };
  }

  /**
   * 문서 내 참조된 자산 중 누락된 자산 검사
   */
  private async findMissingAssets(doc: UIVisualDocument): Promise<string[]> {
    const missing: string[] = [];
    const assetIdsToCheck = new Set<string>();

    for (const pageKey of UI_VISUAL_PAGE_IDS) {
      const page = doc.pages[pageKey];
      if (page?.elements) {
        for (const el of page.elements) {
          if (el.assetId) {
            assetIdsToCheck.add(el.assetId);
          }
        }
      }
    }

    for (const assetId of assetIdsToCheck) {
      if (this.assetValidator) {
        const valid = await this.assetValidator(assetId);
        if (!valid) {
          missing.push(assetId);
        }
        continue;
      }

      // 승인된 정적 리소스 확인
      if (lookupApprovedResource(assetId)) {
        continue;
      }

      // IndexedDB 자산 저장소 확인
      const storedAsset = await this.store.getAsset(assetId);
      if (storedAsset) {
        continue;
      }

      // 로컬 카탈로그 확인
      if (this.assetCatalog?.getAsset(assetId)) {
        continue;
      }

      missing.push(assetId);
    }

    return missing;
  }

  /**
   * 비정상 종료 / 임시 draft로부터 복구
   */
  async recoverFromDraft(projectId?: string): Promise<RecoverResult> {
    if (this.isClosed) {
      return { recovered: false, reason: "Controller disposed" };
    }

    const targetProject = projectId ?? this.projectId;
    const draft = await this.store.loadDraft(targetProject, this.writerId);
    if (!draft || !draft.document) {
      return { recovered: false, reason: "No draft found" };
    }

    const doc = draft.document as unknown as UIVisualDocument;
    // 복구 Undo 정책: 복구된 문서가 기준점이 되며 history는 0으로 리셋(경계 생성)
    this.session = loadVisualDocument(
      this.session,
      doc,
      `session-recovery-${++this.sequence}`
    );
    this.dirty = true;
    this.saved = false;
    this.draftSaved = true;
    this.label = "draft-recovered";

    return { recovered: true, source: "draft" };
  }

  /**
   * 컨트롤러 종료 및 타이머 정리, 미저장/flush 정직 보고
   */
  async dispose(options?: { flush?: boolean }): Promise<DisposeReport> {
    if (this.autosaveTimer !== null) {
      this.scheduler.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    this.isClosed = true;
    for (const action of this.actions.values()) {
      action.cancelled = true;
    }
    this.actions.clear();

    if (options?.flush && this.dirty) {
      try {
        await this.store.saveDraft({
          projectId: this.projectId,
          writerId: this.writerId,
          expectedGeneration: this.generation,
          document: cloneVisualDocument(this.session.present) as unknown as Record<string, unknown>,
        });
        return { flushed: true, dirty: false };
      } catch (err: any) {
        return {
          flushed: false,
          dirty: true,
          error: err?.message ?? String(err),
        };
      }
    }

    return { flushed: false, dirty: this.dirty };
  }
}
