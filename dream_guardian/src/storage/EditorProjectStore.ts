/**
 * EditorProjectStore.ts - 피트니스 에디터 전용 원자적 프로젝트 초안 저장소
 *
 * Issue #379 / EDITOR-STORE:
 * - 프로젝트별 저장 직렬화(enqueue) 및 트랜잭션 기반 원자적 snapshot & head 갱신
 * - expectedRevision 원자적 검사 및 늦은 autosave 덮어쓰기 방지 (RevisionConflictError)
 * - 두 탭 동일 revision 경쟁 시 단 하나만 성공, 충돌 시 복구 버퍼(recoveryBuffers) 보존
 * - Quota/Abort 실패 시 이전 정상 head 100% 보존 및 성공 오표시 차단
 * - V2 EditorProject 유효성 검증(validateEditorProject) 연동
 * - UIX DB 및 플레이어 세이브 스토리지 무접근
 */

import { type EditorProject } from '../data/EditorProject.js';
import { validateEditorProject } from '../data/ProjectValidator.js';
import {
  EditorContentDatabase,
  type IEditorTransaction,
} from './EditorContentDatabase.js';

/**
 * 프로젝트 Head 메타데이터 레코드 (projectHeads)
 */
export interface ProjectHead {
  projectId: string;
  revision: number;
  snapshotId: string;
  title: string;
  updatedAt: string;
}

/**
 * 불변 프로젝트 스냅샷 레코드 (projectSnapshots)
 */
export interface ProjectSnapshotRecord {
  snapshotId: string;
  projectId: string;
  revision: number;
  createdAt: string;
  title: string;
  project: EditorProject;
}

/**
 * 스냅샷 목록용 경량 메타데이터
 */
export interface ProjectSnapshotMeta {
  snapshotId: string;
  projectId: string;
  revision: number;
  createdAt: string;
  title: string;
}

/**
 * 입력 복구 버퍼 레코드 (recoveryBuffers)
 */
export interface RecoveryBufferRecord {
  bufferId: string;
  projectId: string;
  reason: string;
  createdAt: string;
  raw: unknown;
}

/**
 * 프로젝트 백업 전체 내보내기 객체
 */
export interface ProjectBackupExport {
  project: EditorProject;
  head: ProjectHead;
  snapshots: ProjectSnapshotRecord[];
  recoveryBuffers: RecoveryBufferRecord[];
  exportedAt: string;
}

/**
 * 저장 옵션
 */
export interface SaveProjectOptions {
  expectedRevision?: number;
  saveRecoveryOnError?: boolean;
  saveRecoveryOnConflict?: boolean;
  createRecoveryOnError?: boolean;
  throwOnConflict?: boolean;
}

/**
 * 저장 결과 DTO
 */
export interface SaveResult {
  success: boolean;
  revision?: number;
  snapshotId?: string;
  head?: ProjectHead;
  conflict?: boolean;
  error?: string;
  errorType?: 'validation' | 'conflict' | 'storage_abort' | 'quota';
  recoveryBufferId?: string;
  validationErrors?: string[];
}

/**
 * Revision 충돌 에러
 */
export class RevisionConflictError extends Error {
  readonly projectId: string;
  readonly expectedRevision: number;
  readonly currentRevision: number;

  constructor(projectId: string, expectedRevision: number, currentRevision: number) {
    super(
      `Revision conflict on project "${projectId}": expected revision ${expectedRevision}, but found current revision ${currentRevision}.`
    );
    this.name = 'RevisionConflictError';
    this.projectId = projectId;
    this.expectedRevision = expectedRevision;
    this.currentRevision = currentRevision;
  }
}

/**
 * 피트니스 에디터 프로젝트 저장소
 */
export class EditorProjectStore {
  private readonly db: EditorContentDatabase;
  private readonly saveQueues: Map<string, Promise<unknown>> = new Map();

  constructor(db: EditorContentDatabase) {
    this.db = db;
  }

  /**
   * 프로젝트별 직렬화 큐 (동일 프로젝트 동시 쓰기 경쟁 방지)
   */
  private async enqueueTask<T>(projectId: string, task: () => Promise<T>): Promise<T> {
    const prev = this.saveQueues.get(projectId) ?? Promise.resolve();
    let resolveCurrent: () => void;
    const currentPromise = new Promise<void>((res) => {
      resolveCurrent = res;
    });

    this.saveQueues.set(
      projectId,
      prev.then(() => currentPromise).catch(() => currentPromise)
    );

    try {
      await prev;
      return await task();
    } finally {
      resolveCurrent!();
      if (this.saveQueues.get(projectId) === currentPromise) {
        this.saveQueues.delete(projectId);
      }
    }
  }

  /**
   * 프로젝트 저장 (원자적 스냅샷 + Head 갱신)
   */
  async saveProject(project: EditorProject, options?: SaveProjectOptions): Promise<SaveResult> {
    const shouldSaveRecovery = Boolean(
      options?.saveRecoveryOnError ||
      options?.saveRecoveryOnConflict ||
      options?.createRecoveryOnError
    );

    // 1. V2 스키마 및 데이터 무결성 검증
    const validation = validateEditorProject(project);
    if (!validation.valid) {
      let recoveryBufferId: string | undefined;
      if (shouldSaveRecovery) {
        try {
          recoveryBufferId = await this.saveRecoveryBuffer(
            project?.projectId || 'unknown_project',
            project,
            'validation_failure'
          );
        } catch {
          // 복구 버퍼 저장 실패는 무결성 에러를 가리지 않음
        }
      }
      const errorMsg = `Project validation failed: ${validation.errors.map((e) => e.message).join('; ')}`;
      return {
        success: false,
        conflict: false,
        error: errorMsg,
        errorType: 'validation',
        validationErrors: validation.errors.map((e) => e.message),
        recoveryBufferId,
      };
    }

    // 2. 프로젝트 직렬 큐를 통한 원자적 트랜잭션 수행
    return this.enqueueTask(project.projectId, async () => {
      try {
        let nextHead: ProjectHead | undefined;
        let nextSnapshotId: string | undefined;
        let computedRevision: number = 1;

        await this.db.transaction(
          ['projectHeads', 'projectSnapshots'],
          'readwrite',
          async (tx: IEditorTransaction) => {
            const currentHead = await tx.get<ProjectHead>('projectHeads', project.projectId);
            const currentRevision = currentHead ? currentHead.revision : 0;

            // expectedRevision 원자적 검사
            if (options?.expectedRevision !== undefined) {
              if (currentRevision !== options.expectedRevision) {
                tx.abort();
                throw new RevisionConflictError(
                  project.projectId,
                  options.expectedRevision,
                  currentRevision
                );
              }
            } else {
              // 늦은 autosave가 최신 revision을 덮어쓰는 것 차단
              if (currentHead && project.revision <= currentRevision) {
                tx.abort();
                throw new RevisionConflictError(
                  project.projectId,
                  currentRevision + 1,
                  project.revision
                );
              }
            }

            // 차기 revision 계산
            if (options?.expectedRevision !== undefined) {
              computedRevision = options.expectedRevision + 1;
            } else if (currentHead) {
              computedRevision = Math.max(project.revision, currentRevision + 1);
            } else {
              computedRevision = Math.max(project.revision, 1);
            }

            const now = new Date().toISOString();
            nextSnapshotId = `${project.projectId}:rev_${computedRevision}`;

            const projectToSave: EditorProject = {
              ...structuredClone(project),
              revision: computedRevision,
              metadata: {
                ...project.metadata,
                updatedAt: now,
              },
            };

            const snapshotRecord: ProjectSnapshotRecord = {
              snapshotId: nextSnapshotId,
              projectId: project.projectId,
              revision: computedRevision,
              createdAt: now,
              title: projectToSave.metadata.title,
              project: projectToSave,
            };

            nextHead = {
              projectId: project.projectId,
              revision: computedRevision,
              snapshotId: nextSnapshotId,
              title: projectToSave.metadata.title,
              updatedAt: now,
            };

            // 원자적 단일 트랜잭션 쓰기
            await tx.put('projectSnapshots', nextSnapshotId, snapshotRecord);
            await tx.put('projectHeads', project.projectId, nextHead);
          }
        );

        return {
          success: true,
          revision: computedRevision,
          snapshotId: nextSnapshotId,
          head: nextHead,
        };
      } catch (err: unknown) {
        const isConflict =
          err instanceof RevisionConflictError ||
          (err instanceof Error && err.name === 'RevisionConflictError') ||
          (err instanceof Error && err.message.includes('Revision conflict'));

        let recoveryBufferId: string | undefined;
        if (shouldSaveRecovery) {
          try {
            recoveryBufferId = await this.saveRecoveryBuffer(
              project.projectId,
              project,
              isConflict ? 'revision_conflict' : 'save_failure'
            );
          } catch {
            // 보조 에러 무시
          }
        }

        if (isConflict && options?.throwOnConflict) {
          throw err;
        }

        const errorMessage = err instanceof Error ? err.message : String(err);
        const isQuota = errorMessage.toLowerCase().includes('quota');

        return {
          success: false,
          conflict: isConflict,
          error: errorMessage,
          errorType: isConflict ? 'conflict' : (isQuota ? 'quota' : 'storage_abort'),
          recoveryBufferId,
        };
      }
    });
  }

  /**
   * 최신 프로젝트 로드
   */
  async loadProject(projectId: string): Promise<EditorProject | null> {
    return this.db.transaction(['projectHeads', 'projectSnapshots'], 'readonly', async (tx) => {
      const head = await tx.get<ProjectHead>('projectHeads', projectId);
      if (!head || !head.snapshotId) return null;
      const snapshot = await tx.get<ProjectSnapshotRecord>('projectSnapshots', head.snapshotId);
      return snapshot ? snapshot.project : null;
    });
  }

  /**
   * 프로젝트 Head 메타데이터 조회
   */
  async getHead(projectId: string): Promise<ProjectHead | null> {
    return this.db.transaction(['projectHeads'], 'readonly', async (tx) => {
      const head = await tx.get<ProjectHead>('projectHeads', projectId);
      return head ?? null;
    });
  }

  /**
   * 프로젝트 스냅샷 목록 조회 (최신 revision 역순 정렬)
   */
  async listSnapshots(projectId: string): Promise<ProjectSnapshotMeta[]> {
    return this.db.transaction(['projectSnapshots'], 'readonly', async (tx) => {
      const all = await tx.getAll<ProjectSnapshotRecord>('projectSnapshots');
      return all
        .filter((rec) => rec.projectId === projectId)
        .sort((a, b) => b.revision - a.revision)
        .map((rec) => ({
          snapshotId: rec.snapshotId,
          projectId: rec.projectId,
          revision: rec.revision,
          createdAt: rec.createdAt,
          title: rec.title,
        }));
    });
  }

  /**
   * 특정 스냅샷 ID에 해당하는 프로젝트 본문 조회
   */
  async getSnapshot(snapshotId: string): Promise<EditorProject | null> {
    return this.db.transaction(['projectSnapshots'], 'readonly', async (tx) => {
      const rec = await tx.get<ProjectSnapshotRecord>('projectSnapshots', snapshotId);
      return rec ? rec.project : null;
    });
  }

  /**
   * 미저장/오류 데이터 복구 버퍼 등록
   */
  async saveRecoveryBuffer(projectId: string, raw: unknown, reason: string): Promise<string> {
    const now = new Date().toISOString();
    const bufferId = `rec_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record: RecoveryBufferRecord = {
      bufferId,
      projectId,
      reason,
      createdAt: now,
      raw: structuredClone(raw),
    };
    await this.db.transaction(['recoveryBuffers'], 'readwrite', async (tx) => {
      await tx.put('recoveryBuffers', bufferId, record);
    });
    return bufferId;
  }

  /**
   * 복구 버퍼 데이터 원본 조회
   */
  async getRecoveryBuffer(bufferId: string): Promise<unknown> {
    return this.db.transaction(['recoveryBuffers'], 'readonly', async (tx) => {
      const rec = await tx.get<RecoveryBufferRecord>('recoveryBuffers', bufferId);
      return rec ? rec.raw : null;
    });
  }

  /**
   * 프로젝트별 복구 버퍼 목록 조회
   */
  async listRecoveryBuffers(projectId?: string): Promise<RecoveryBufferRecord[]> {
    return this.db.transaction(['recoveryBuffers'], 'readonly', async (tx) => {
      const all = await tx.getAll<RecoveryBufferRecord>('recoveryBuffers');
      const filtered = projectId ? all.filter((rec) => rec.projectId === projectId) : all;
      return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }

  /**
   * 파일 백업용 전체 프로젝트 내보내기 API
   */
  async exportProjectBackup(projectId: string): Promise<ProjectBackupExport | null> {
    const head = await this.getHead(projectId);
    if (!head) return null;

    const currentProject = await this.loadProject(projectId);
    if (!currentProject) return null;

    const snapshots = await this.db.transaction(['projectSnapshots'], 'readonly', async (tx) => {
      const all = await tx.getAll<ProjectSnapshotRecord>('projectSnapshots');
      return all
        .filter((s) => s.projectId === projectId)
        .sort((a, b) => b.revision - a.revision);
    });

    const recoveryBuffers = await this.listRecoveryBuffers(projectId);

    return {
      project: currentProject,
      head,
      snapshots,
      recoveryBuffers,
      exportedAt: new Date().toISOString(),
    };
  }
}
