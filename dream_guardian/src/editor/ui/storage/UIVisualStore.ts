/**
 * UIVisualStore.ts - UI visual 전용 비동기 원자적 저장소 인터페이스 및 서비스
 *
 * Issue #464 / UI-VIS-035:
 * - 6대 전용 store (projects, backups, drafts, checkpoints, assets, releases) 연계
 * - CAS (Compare-And-Swap) generation 검증을 통한 다중 탭 충돌 방지
 * - writer별 독립 draft 관리
 * - 문서 + 바이너리 자산 단일 트랜잭션 원자적 영속화
 * - QuotaExceededError / abort 발생 시 100% 롤백 및 부분 저장 원천 차단
 * - 비정상 종료 복구 및 불변 백업 생성/복원
 */

import { validateExternalJsonLimits } from "../data/UIContracts";
import {
  UIVisualIndexedDB,
  promisifyRequest,
} from "./UIVisualIndexedDB";

export interface VisualAssetPayload {
  assetId: string;
  contentHash: string;
  durableAssetId: string;
  mimeType: string;
  byteLength: number;
  data: ArrayBuffer | Uint8Array | Blob;
  metadata: Record<string, unknown>;
}

export interface SaveCheckpointRequest {
  projectId: string;
  writerId: string;
  expectedGeneration: number;
  documentRevision: number;
  snapshot: Record<string, unknown>;
  requestId: string;
  sessionId?: string;
  assets?: VisualAssetPayload[];
}

export interface SaveOptions {
  simulateQuotaError?: boolean;
  failHead?: boolean;
}

export type SaveResult =
  | {
      status: "saved";
      saved: true;
      checkpointId: string;
      generation: number;
      revision: number;
    }
  | {
      status: "conflict";
      saved: false;
      currentGeneration: number;
      expectedGeneration: number;
      reason: string;
    }
  | {
      status: "failed";
      saved: false;
      error: string;
    }
  | {
      status: "rejected";
      saved: false;
      reason: string;
    };

export interface ProjectHeadRecord {
  projectId: string;
  headCheckpointId: string;
  generation: number;
  documentRevision: number;
  updatedAt: number;
}

export interface CheckpointRecord {
  checkpointId: string;
  projectId: string;
  requestId: string;
  sessionId?: string;
  generation: number;
  documentRevision: number;
  snapshot: Record<string, unknown>;
  assetRefs?: string[];
  createdAt: number;
}

export interface DraftRecord {
  draftKey: string;
  projectId: string;
  writerId: string;
  expectedGeneration: number;
  document: Record<string, unknown>;
  savedAt: number;
}

export interface BackupRecord {
  backupId: string;
  projectId: string;
  generation: number;
  document: Record<string, unknown>;
  createdAt: number;
  reason?: string;
}

export interface ReleaseRecord {
  releaseId: string;
  projectId: string;
  checkpointId: string;
  version: string;
  packageData: Record<string, unknown>;
  releasedAt: number;
}

export class CASConflictError extends Error {
  constructor(
    public readonly currentGeneration: number,
    public readonly expectedGeneration: number
  ) {
    super(`CAS conflict: expected generation ${expectedGeneration}, but found ${currentGeneration}`);
    this.name = "CASConflictError";
  }
}

export class UIVisualStore {
  constructor(readonly idb: UIVisualIndexedDB) {}

  async open(): Promise<void> {
    await this.idb.open();
  }

  close(): void {
    this.idb.close();
  }

  /**
   * 체크포인트 원자적 저장 (CAS 적용)
   */
  async saveCheckpoint(
    request: SaveCheckpointRequest,
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    const limits = validateExternalJsonLimits(request.snapshot);
    if (!limits.ok) {
      return { status: "rejected", saved: false, reason: limits.reason };
    }

    try {
      return await this.idb.runTransaction(
        ["projects", "checkpoints", "assets", "drafts"],
        "readwrite",
        async (tx, stores) => {
          // 1. CAS Generation 검증
          const head = await promisifyRequest<ProjectHeadRecord | undefined>(
            stores.projects.get(request.projectId)
          );
          const currentGeneration = head?.generation ?? 0;

          if (currentGeneration !== request.expectedGeneration) {
            throw new CASConflictError(currentGeneration, request.expectedGeneration);
          }

          // 인위적 QuotaExceeded 테스트 옵션 지원
          if (options.simulateQuotaError) {
            throw new DOMException("Quota exceeded", "QuotaExceededError");
          }

          const nextGeneration = currentGeneration + 1;
          const checkpointId = `cp-${request.requestId}`;
          const assetIds: string[] = [];

          // 2. 바이너리 자산 저장
          if (request.assets && request.assets.length > 0) {
            for (const asset of request.assets) {
              assetIds.push(asset.assetId);
              let bufferData: ArrayBuffer | Uint8Array | Blob = asset.data;
              if (asset.data instanceof Uint8Array) {
                const copy = new Uint8Array(asset.data.byteLength);
                copy.set(asset.data);
                bufferData = copy.buffer;
              }
              await promisifyRequest(
                stores.assets.put(
                  {
                    assetId: asset.assetId,
                    contentHash: asset.contentHash,
                    durableAssetId: asset.durableAssetId,
                    mimeType: asset.mimeType,
                    byteLength: asset.byteLength,
                    data: bufferData,
                    metadata: structuredClone(asset.metadata),
                    createdAt: Date.now(),
                  },
                  asset.assetId
                )
              );
            }
          }

          // 3. 체크포인트 레코드 저장
          const checkpointRecord: CheckpointRecord = {
            checkpointId,
            projectId: request.projectId,
            requestId: request.requestId,
            sessionId: request.sessionId,
            generation: nextGeneration,
            documentRevision: request.documentRevision,
            snapshot: structuredClone(request.snapshot),
            assetRefs: assetIds,
            createdAt: Date.now(),
          };
          await promisifyRequest(stores.checkpoints.put(checkpointRecord, checkpointId));

          if (options.failHead) {
            tx.abort();
            throw new Error("failHead triggered");
          }

          // 4. 프로젝트 Head 갱신
          const nextHead: ProjectHeadRecord = {
            projectId: request.projectId,
            headCheckpointId: checkpointId,
            generation: nextGeneration,
            documentRevision: request.documentRevision,
            updatedAt: Date.now(),
          };
          await promisifyRequest(stores.projects.put(nextHead, request.projectId));

          // 5. 작성자 임시 draft 제거
          const draftKey = `${request.projectId}:${request.writerId}`;
          await promisifyRequest(stores.drafts.delete(draftKey));

          return {
            status: "saved",
            saved: true,
            checkpointId,
            generation: nextGeneration,
            revision: request.documentRevision,
          };
        }
      );
    } catch (err: any) {
      if (err instanceof CASConflictError) {
        return {
          status: "conflict",
          saved: false,
          currentGeneration: err.currentGeneration,
          expectedGeneration: err.expectedGeneration,
          reason: err.message,
        };
      }
      return {
        status: "failed",
        saved: false,
        error: err?.message ?? String(err),
      };
    }
  }

  /**
   * writer별 격리 Draft 저장
   */
  async saveDraft(request: {
    projectId: string;
    writerId: string;
    expectedGeneration: number;
    document: Record<string, unknown>;
  }): Promise<{ saved: boolean; draftKey: string }> {
    const draftKey = `${request.projectId}:${request.writerId}`;
    const draft: DraftRecord = {
      draftKey,
      projectId: request.projectId,
      writerId: request.writerId,
      expectedGeneration: request.expectedGeneration,
      document: structuredClone(request.document),
      savedAt: Date.now(),
    };

    await this.idb.put("drafts", draftKey, draft);
    return { saved: true, draftKey };
  }

  async loadDraft(projectId: string, writerId: string): Promise<DraftRecord | null> {
    const draftKey = `${projectId}:${writerId}`;
    const draft = await this.idb.get<DraftRecord>("drafts", draftKey);
    return draft ?? null;
  }

  async listDrafts(projectId: string): Promise<DraftRecord[]> {
    const drafts = await this.idb.getAll<DraftRecord>("drafts");
    return drafts.filter((d) => d.projectId === projectId);
  }

  async getProjectHead(projectId: string): Promise<ProjectHeadRecord | null> {
    const head = await this.idb.get<ProjectHeadRecord>("projects", projectId);
    return head ?? null;
  }

  async getCheckpoint(checkpointId: string): Promise<CheckpointRecord | null> {
    const cp = await this.idb.get<CheckpointRecord>("checkpoints", checkpointId);
    return cp ?? null;
  }

  async getAsset(assetId: string): Promise<VisualAssetPayload | null> {
    const asset = await this.idb.get<VisualAssetPayload>("assets", assetId);
    return asset ?? null;
  }

  /**
   * 원본 불변 백업 생성
   */
  async createBackup(
    projectId: string,
    reason?: string
  ): Promise<{ backupId: string; generation: number }> {
    const head = await this.getProjectHead(projectId);
    if (!head) {
      throw new Error(`Project '${projectId}' does not exist for backup`);
    }

    const checkpoint = await this.getCheckpoint(head.headCheckpointId);
    if (!checkpoint) {
      throw new Error(`Head checkpoint '${head.headCheckpointId}' not found for project '${projectId}'`);
    }

    const backupId = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const backup: BackupRecord = {
      backupId,
      projectId,
      generation: head.generation,
      document: structuredClone(checkpoint.snapshot),
      createdAt: Date.now(),
      reason,
    };

    await this.idb.put("backups", backupId, backup);
    return { backupId, generation: head.generation };
  }

  async getBackup(backupId: string): Promise<BackupRecord | null> {
    const bk = await this.idb.get<BackupRecord>("backups", backupId);
    return bk ?? null;
  }

  /**
   * 백업으로부터 안전한 원자적 복원
   */
  async restoreFromBackup(
    projectId: string,
    backupId: string,
    _writerId: string
  ): Promise<{ status: "restored"; restoredGeneration: number }> {
    return this.idb.runTransaction(
      ["projects", "checkpoints", "backups"],
      "readwrite",
      async (_, stores) => {
        const backup = await promisifyRequest<BackupRecord | undefined>(
          stores.backups.get(backupId)
        );
        if (!backup || backup.projectId !== projectId) {
          throw new Error(`Backup '${backupId}' not found for project '${projectId}'`);
        }

        const head = await promisifyRequest<ProjectHeadRecord | undefined>(
          stores.projects.get(projectId)
        );
        const currentGen = head?.generation ?? 0;
        const restoredGen = currentGen + 1;
        const newCheckpointId = `cp-restore-${Date.now()}`;

        const newCheckpoint: CheckpointRecord = {
          checkpointId: newCheckpointId,
          projectId,
          requestId: `restore-${backupId}`,
          generation: restoredGen,
          documentRevision: (head?.documentRevision ?? 0) + 1,
          snapshot: structuredClone(backup.document),
          createdAt: Date.now(),
        };
        await promisifyRequest(stores.checkpoints.put(newCheckpoint, newCheckpointId));

        const newHead: ProjectHeadRecord = {
          projectId,
          headCheckpointId: newCheckpointId,
          generation: restoredGen,
          documentRevision: newCheckpoint.documentRevision,
          updatedAt: Date.now(),
        };
        await promisifyRequest(stores.projects.put(newHead, projectId));

        return { status: "restored", restoredGeneration: restoredGen };
      }
    );
  }

  /**
   * 비정상 종료 후 무결성 점검 및 복구
   */
  async reconcileAbnormalShutdown(
    projectId: string
  ): Promise<{ healthy: boolean; headCheckpointId?: string; generation?: number }> {
    const head = await this.getProjectHead(projectId);
    if (!head) {
      return { healthy: true };
    }

    const checkpoint = await this.getCheckpoint(head.headCheckpointId);
    if (checkpoint) {
      return {
        healthy: true,
        headCheckpointId: head.headCheckpointId,
        generation: head.generation,
      };
    }

    // 헤드가 가리키는 체크포인트가 없을 경우 복구 시도
    const allCheckpoints = await this.idb.getAll<CheckpointRecord>("checkpoints");
    const projectCheckpoints = allCheckpoints
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.generation - a.generation);

    if (projectCheckpoints.length > 0) {
      const latest = projectCheckpoints[0];
      const recoveredHead: ProjectHeadRecord = {
        projectId,
        headCheckpointId: latest.checkpointId,
        generation: latest.generation,
        documentRevision: latest.documentRevision,
        updatedAt: Date.now(),
      };
      await this.idb.put("projects", projectId, recoveredHead);
      return {
        healthy: false,
        headCheckpointId: latest.checkpointId,
        generation: latest.generation,
      };
    }

    return { healthy: false };
  }

  /**
   * 릴리즈(배포 패키지) 불변 저장
   */
  async saveRelease(payload: {
    releaseId: string;
    projectId: string;
    checkpointId: string;
    version: string;
    packageData: Record<string, unknown>;
  }): Promise<{ saved: boolean }> {
    const releaseRecord: ReleaseRecord = {
      releaseId: payload.releaseId,
      projectId: payload.projectId,
      checkpointId: payload.checkpointId,
      version: payload.version,
      packageData: structuredClone(payload.packageData),
      releasedAt: Date.now(),
    };

    await this.idb.put("releases", payload.releaseId, releaseRecord);
    return { saved: true };
  }

  async getRelease(releaseId: string): Promise<ReleaseRecord | null> {
    const rel = await this.idb.get<ReleaseRecord>("releases", releaseId);
    return rel ?? null;
  }
}
