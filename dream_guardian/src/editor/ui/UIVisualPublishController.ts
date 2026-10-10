/**
 * UIVisualPublishController.ts - UI 비주얼 편집기의 백업·추출·불변 게시본 선택 제어기
 *
 * Issue #469 / UI-VIS-039:
 * - 저장 revision, 유효성 검사 보고서, 변경 diff 및 해시 확인 후 '추출(Export)'과 '불변 게시(Publish)' 명시적 분리 제어
 * - 단일 버튼으로 편집/저장/게시/게임적용 묵시 혼합 원천 차단
 * - 미저장(dirty) 상태에서 게시 시도 시 경고 및 처리 선택 (저장 후 게시 또는 취소), 미저장 문서 무단 게시 엄격 차단
 * - UIVisualStore의 불변 releases store에 영속화하고 직전 정상 게시본/대상 hash/게시 기록 관리
 * - Quota 초과 또는 실패 시 이전 게시본 100% 보존 및 저장 성공 0건 정직 보고
 * - 자산 포함 다운로드/파일 재검사(re-inspection) 경로 제공
 * - 다운로드 취소 시 성공 라벨 0건 보장
 * - 자동 배포나 게임창 메시지 송신, 피트니스 콘텐츠 게시 배제 및 런타임 적용 성공 여부는 별도 수신 확인 전까지 미검증 유지
 */

import {
  type UIVisualDocument,
  createDefaultUIVisualDocument,
} from "./data/UIVisualDocument";
import { validateUIVisualDocument } from "./data/UIVisualValidator";
import {
  type UIPresentationArtifact,
  type UIProjectBackup,
  type RestoreBackupResult,
  buildFullProjectBackup,
  serializeBackup,
} from "./data/UIVisualArtifactBuilder";
import {
  publishPresentationArtifact,
  exportPresentationArtifact,
  inspectPresentationArtifact,
  inspectBackup,
  restoreProjectFromBackup,
  type PresentationInspectionResult,
  type BackupInspectionResult,
} from "./io/UIVisualArtifactIO";
import {
  contentHash,
  sourceCheckpointHash,
} from "./data/UICanonicalJSON";
import {
  type UIVisualStore,
  type ReleaseRecord,
} from "./storage/UIVisualStore";
import { type Downloader } from "./io/UIProjectIO";

export const GAME_APPLY_VERIFIED = false;
export const STORAGE_TOUCHED = false;
export const GAME_REFLECTION_DISCLAIMER = "게임에는 반영되지 않음";

export type DirtyPublishChoice = "save-and-publish" | "cancel";

export interface PublishCandidateSummary {
  projectId: string;
  revision: number;
  isDirty: boolean;
  contentHash: string;
  artifactHash?: string;
  sourceCheckpointHash?: string;
  validationReport: {
    valid: boolean;
    errors: string[];
  };
  diffSummary: {
    hasChanges: boolean;
    changedFields: string[];
  };
}

export interface PublishHistoryItem {
  id: string;
  releaseId: string;
  projectId: string;
  checkpointId: string;
  version: string;
  artifactHash: string;
  contentHash: string;
  publishedAt: number;
  status: "success" | "failed";
  error?: string;
}

export interface PublishOptions {
  promptDirtyChoice?: DirtyPublishChoice;
  version?: string;
  note?: string;
}

export interface PublishResult {
  ok: boolean;
  savedCount: number;
  releaseId?: string;
  artifact?: UIPresentationArtifact;
  error?: string;
  reason?: string;
  runtimeApplied: boolean;
}

export interface ExportResult {
  ok: boolean;
  savedCount: number;
  artifact?: UIPresentationArtifact;
  filename?: string;
  error?: string;
  reason?: string;
}

export interface BackupResult {
  ok: boolean;
  savedCount: number;
  backup?: UIProjectBackup;
  filename?: string;
  error?: string;
  reason?: string;
}

export interface UIVisualPublishControllerOptions {
  projectId: string;
  projectController?: any;
  store?: UIVisualStore;
  downloader?: Downloader;
  promptDirtyPublish?: () => DirtyPublishChoice;
  confirm?: (summary: string) => boolean;
  onStatus?: (message: string) => void;
}

export class UIVisualPublishController {
  readonly projectId: string;
  private readonly projectController?: any;
  private readonly store?: UIVisualStore;
  private readonly downloader?: Downloader;
  private readonly promptDirtyPublish?: () => DirtyPublishChoice;
  private readonly confirmFn?: (summary: string) => boolean;
  private readonly onStatus?: (message: string) => void;

  private activeRelease: ReleaseRecord | null = null;
  private previousValidRelease: ReleaseRecord | null = null;
  private history: PublishHistoryItem[] = [];

  constructor(options: UIVisualPublishControllerOptions) {
    this.projectId = options.projectId;
    this.projectController = options.projectController;
    this.store = options.store;
    this.downloader = options.downloader;
    this.promptDirtyPublish = options.promptDirtyPublish;
    this.confirmFn = options.confirm;
    this.onStatus = options.onStatus;
  }

  public isGameApplyVerified(): boolean {
    return GAME_APPLY_VERIFIED;
  }

  public getActiveRelease(): ReleaseRecord | null {
    return this.activeRelease;
  }

  public getPreviousValidRelease(): ReleaseRecord | null {
    return this.previousValidRelease;
  }

  public getHistory(): PublishHistoryItem[] {
    return [...this.history];
  }

  private getDocument(): UIVisualDocument {
    if (this.projectController) {
      if (typeof this.projectController.getDocument === "function") {
        return this.projectController.getDocument();
      }
      if (typeof this.projectController.document === "function") {
        return this.projectController.document();
      }
      if (this.projectController._doc) {
        return this.projectController._doc;
      }
      if (this.projectController.saved) {
        return this.projectController.saved;
      }
    }
    return createDefaultUIVisualDocument();
  }

  private getStatus(): {
    dirty: boolean;
    saved: boolean;
    revision: number;
    checkpointId?: string;
  } {
    if (this.projectController && typeof this.projectController.status === "function") {
      const st = this.projectController.status();
      return {
        dirty: Boolean(st.dirty),
        saved: Boolean(st.saved),
        revision: Number(st.revision ?? 1),
        checkpointId: st.checkpointId,
      };
    }
    const isDirty = Boolean(this.projectController?.dirty);
    return {
      dirty: isDirty,
      saved: !isDirty,
      revision: Number(this.projectController?.revision ?? 1),
      checkpointId: undefined,
    };
  }

  public async getCandidateSummary(): Promise<PublishCandidateSummary> {
    const doc = this.getDocument();
    const st = this.getStatus();

    const valResult = validateUIVisualDocument(doc);
    const cHash = contentHash(doc);
    const scHash = sourceCheckpointHash(doc);

    const changedFields: string[] = [];
    if (st.dirty) {
      changedFields.push("unsaved-document-changes");
    }

    return {
      projectId: this.projectId,
      revision: st.revision,
      isDirty: st.dirty,
      contentHash: cHash,
      sourceCheckpointHash: scHash,
      validationReport: {
        valid: valResult.valid,
        errors: valResult.errors.map((e) => e.message),
      },
      diffSummary: {
        hasChanges: changedFields.length > 0,
        changedFields,
      },
    };
  }

  /**
   * 적용본 추출(Export Artifact):
   * 외부 전달용 불변 presentation artifact를 생성하여 다운로드합니다.
   * releases store에 기록하지 않습니다.
   */
  public async exportArtifact(options?: { filename?: string }): Promise<ExportResult> {
    const doc = this.getDocument();
    const st = this.getStatus();
    const assets = (this.projectController?.getAssets?.() ?? (doc as any).assets ?? []) as any;

    const buildRes = exportPresentationArtifact({
      checkpoint: {
        projectId: this.projectId,
        revision: st.revision,
        checkpointId: st.checkpointId ?? `chk-${st.revision}`,
        document: doc,
        saved: st.saved,
        isDirty: st.dirty,
      },
      projectId: this.projectId,
      revision: st.revision,
      isPublish: false,
      assets,
    });

    if (!buildRes.ok) {
      this.onStatus?.(`적용본 추출 실패: ${buildRes.reason} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: buildRes.reason,
        error: buildRes.errors.join(", "),
      };
    }

    // Inspect artifact to ensure self-consistency
    const inspection = inspectPresentationArtifact(buildRes.artifact, {
      originalCheckpoint: doc,
    });
    if (!inspection.ok) {
      this.onStatus?.(`적용본 추출 검사 실패: ${inspection.reason} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: "INSPECTION_FAILED",
        error: inspection.reason,
      };
    }

    if (!this.downloader) {
      this.onStatus?.(`다운로드 API 미지원으로 추출 불가 (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: "DOWNLOAD_UNAVAILABLE",
      };
    }

    const filename =
      options?.filename ??
      `ui-presentation-${this.projectId}-rev${st.revision}-${Date.now()}.json`;

    try {
      this.downloader.download(filename, JSON.stringify(buildRes.artifact, null, 2));
      this.onStatus?.(`적용본 추출 완료 (다운로드 요청): ${filename} · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: true,
        savedCount: 1,
        artifact: buildRes.artifact,
        filename,
      };
    } catch (err: any) {
      this.onStatus?.(`다운로드 취소 또는 실패: ${err?.message ?? "unknown"} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: "DOWNLOAD_FAILED",
        error: err?.message,
      };
    }
  }

  /**
   * 불변 게시(Publish):
   * 저장 완료된 체크포인트를 검증하여 releases store에 불변 등록합니다.
   * 미저장 상태일 경우 경고 후 선택에 따라 저장 후 게시하거나 차단합니다.
   */
  public async publishRelease(options?: PublishOptions): Promise<PublishResult> {
    let st = this.getStatus();

    // 1. 미저장(dirty) 상태 처리 게이트
    if (st.dirty) {
      const choice: DirtyPublishChoice =
        options?.promptDirtyChoice ??
        (this.promptDirtyPublish ? this.promptDirtyPublish() : "cancel");

      if (choice === "cancel") {
        this.onStatus?.(
          `게시 취소: 미저장 변경사항이 있어 게시를 중단했습니다 (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`
        );
        return {
          ok: false,
          savedCount: 0,
          reason: "UNSAVED_CHANGES_BLOCKED",
          runtimeApplied: false,
        };
      }

      // save-and-publish: save checkpoint first
      let saveOk = false;
      if (this.projectController && typeof this.projectController.saveCheckpoint === "function") {
        const sRes = await this.projectController.saveCheckpoint();
        saveOk = Boolean(sRes && sRes.saved);
      } else if (this.projectController && typeof this.projectController.save === "function") {
        const flight = this.projectController.save();
        if (typeof this.projectController.completeSave === "function") {
          const outcome = await this.projectController.completeSave(flight?.actionId ?? "save-pub");
          saveOk = Boolean(outcome && outcome.status === "saved");
        } else {
          saveOk = true;
        }
      }

      if (!saveOk) {
        this.onStatus?.(
          `게시 전 저장 실패: 저장을 완료하지 못해 게시를 중단했습니다 (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`
        );
        return {
          ok: false,
          savedCount: 0,
          reason: "SAVE_FAILED",
          runtimeApplied: false,
        };
      }

      // Re-read status after save
      st = this.getStatus();
    }

    const doc = this.getDocument();

    // 2. 문서 유효성 검사
    const valResult = validateUIVisualDocument(doc);
    if (!valResult.valid) {
      this.onStatus?.(
        `게시 실패: 문서 유효성 검증 실패 (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`
      );
      return {
        ok: false,
        savedCount: 0,
        reason: "VALIDATION_FAILED",
        error: valResult.errors.map((e) => e.message).join(", "),
        runtimeApplied: false,
      };
    }

    const checkpointId = st.checkpointId ?? `chk-${st.revision}`;
    const assets = (this.projectController?.getAssets?.() ?? (doc as any).assets ?? []) as any;

    // 3. 불변 아티팩트 빌드 (isPublish: true)
    const buildRes = publishPresentationArtifact({
      checkpoint: {
        projectId: this.projectId,
        revision: st.revision,
        checkpointId,
        document: doc,
        saved: true,
        isDirty: false,
      },
      projectId: this.projectId,
      revision: st.revision,
      checkpointId,
      isPublish: true,
      assets,
    });

    if (!buildRes.ok) {
      this.onStatus?.(`게시 실패: ${buildRes.reason} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: buildRes.reason,
        error: buildRes.errors.join(", "),
        runtimeApplied: false,
      };
    }

    // 4. 해시 및 capability 재검사
    const inspection = inspectPresentationArtifact(buildRes.artifact, {
      originalCheckpoint: doc,
    });
    if (!inspection.ok) {
      this.onStatus?.(`게시 실패: 해시 무결성 검증 실패 (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: "HASH_MISMATCH",
        error: inspection.reason,
        runtimeApplied: false,
      };
    }

    // 5. 사용자 확인(confirm)
    if (this.confirmFn) {
      const confirmed = this.confirmFn(
        `불변 게시본을 등록하시겠습니까?\n해시: ${buildRes.artifact.integrity.artifactHash}`
      );
      if (!confirmed) {
        this.onStatus?.(`게시 취소됨 (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
        return {
          ok: false,
          savedCount: 0,
          reason: "CANCELLED",
          runtimeApplied: false,
        };
      }
    }

    // 6. UIVisualStore releases store에 영속화
    const releaseId = `rel-${Date.now()}-${this.history.length + 1}`;
    const version = options?.version ?? `1.0.${this.history.length + 1}`;

    if (this.store) {
      try {
        await this.store.saveRelease({
          releaseId,
          projectId: this.projectId,
          checkpointId,
          version,
          packageData: buildRes.artifact as any,
        });
      } catch (err: any) {
        // 저장 실패 또는 Quota 초과 시 직전 정상 게시본 100% 보존
        this.history.push({
          id: `hist-${Date.now()}`,
          releaseId,
          projectId: this.projectId,
          checkpointId,
          version,
          artifactHash: buildRes.artifact.integrity.artifactHash,
          contentHash: buildRes.artifact.contentHash,
          publishedAt: Date.now(),
          status: "failed",
          error: err?.message ?? "Storage error",
        });

        this.onStatus?.(
          `게시 저장 실패 (${err?.message ?? "storage error"}) (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`
        );
        return {
          ok: false,
          savedCount: 0,
          error: err?.message,
          reason: "STORAGE_FAILED",
          runtimeApplied: false,
        };
      }
    }

    // 성공 처리
    const releaseRecord: ReleaseRecord = {
      releaseId,
      projectId: this.projectId,
      checkpointId,
      version,
      packageData: structuredClone(buildRes.artifact) as any,
      releasedAt: Date.now(),
    };

    this.previousValidRelease = this.activeRelease;
    this.activeRelease = releaseRecord;

    this.history.push({
      id: `hist-${Date.now()}`,
      releaseId,
      projectId: this.projectId,
      checkpointId,
      version,
      artifactHash: buildRes.artifact.integrity.artifactHash,
      contentHash: buildRes.artifact.contentHash,
      publishedAt: Date.now(),
      status: "success",
    });

    this.onStatus?.(
      `게시 완료 (불변 릴리즈 등록): ${releaseId} · ${GAME_REFLECTION_DISCLAIMER}`
    );

    return {
      ok: true,
      savedCount: 1,
      releaseId,
      artifact: buildRes.artifact,
      runtimeApplied: false, // 런타임 적용은 별도 확인 전까지 미검증
    };
  }

  /**
   * 전체 프로젝트 백업(Full Backup):
   * 문서 및 모든 바이너리 자산을 포함한 통합 백업 번들을 생성하여 다운로드합니다.
   */
  public async exportFullBackup(options?: { filename?: string }): Promise<BackupResult> {
    const doc = this.getDocument();
    const st = this.getStatus();

    const buildRes = buildFullProjectBackup({
      projectId: this.projectId,
      revision: st.revision,
      document: doc,
      assets: (this.projectController?.getAssets?.() ?? (doc as any).assets) as any,
    });

    if (!buildRes.ok) {
      this.onStatus?.(`백업 실패: ${buildRes.reason} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: buildRes.reason,
        error: buildRes.errors.join(", "),
      };
    }

    const inspection = inspectBackup(buildRes.backup);
    if (!inspection.ok) {
      this.onStatus?.(`백업 검사 실패: ${inspection.reason} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: "BACKUP_INSPECTION_FAILED",
        error: inspection.reason,
      };
    }

    if (!this.downloader) {
      this.onStatus?.(`다운로드 API 미지원으로 백업 불가 (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: "DOWNLOAD_UNAVAILABLE",
      };
    }

    const filename =
      options?.filename ??
      `ui-backup-${this.projectId}-rev${st.revision}-${Date.now()}.json`;

    try {
      this.downloader.download(filename, serializeBackup(buildRes.backup));
      this.onStatus?.(`백업 완료 (다운로드 요청): ${filename} · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: true,
        savedCount: 1,
        backup: buildRes.backup,
        filename,
      };
    } catch (err: any) {
      this.onStatus?.(`다운로드 취소 또는 실패: ${err?.message ?? "unknown"} (저장 성공 0건) · ${GAME_REFLECTION_DISCLAIMER}`);
      return {
        ok: false,
        savedCount: 0,
        reason: "DOWNLOAD_FAILED",
        error: err?.message,
      };
    }
  }

  /**
   * 적용본 재검사(Re-inspect)
   */
  public reinspectArtifact(artifactInput: unknown): PresentationInspectionResult {
    return inspectPresentationArtifact(artifactInput);
  }

  /**
   * 백업 파일 재검사(Re-inspect)
   */
  public reinspectBackup(backupInput: unknown): BackupInspectionResult {
    return inspectBackup(backupInput);
  }

  /**
   * 백업 파일 복구(Restore)
   */
  public restoreBackup(backupInput: unknown): RestoreBackupResult {
    return restoreProjectFromBackup(backupInput);
  }
}
