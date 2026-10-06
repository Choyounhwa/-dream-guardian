/**
 * PublishedContentStore.ts - 피트니스 에디터 불변 게시본·적용 예약·이전 정상본 저장소
 *
 * Issue #386 / EDITOR-RELEASE-STORE:
 * - 검증된 contentHash 기준 컴파일된 게시본(PublishedContentPack)의 불변 저장
 * - activationHeads를 단일 트랜잭션으로 원자적 갱신
 * - 저장 요청 시 sourceRevision과 현재 head revision 비교, 불일치 시 즉시 중단 (RevisionConflictError)
 * - 동일 contentHash의 재저장은 멱등(Idempotent)하게 처리
 * - 팩 쓰기 실패 시 activationHeads 및 이전 정상본(previousHealthyHash) 보존
 * - 이전 게시본 선택을 통한 롤백(rollback) 적용 예약(scheduled/staged) 지원
 * - 저장된 게시본은 deepFreeze 불변 객체로 제공하여 직접 수정 차단
 * - 잘못된 hash, 규칙 미준수, 필수 필드 누락 시 저장 거부 (validatePublishedContentPack 연동)
 * - 활성(active), 이전정상(previousHealthy), 복구(recovery) 참조 팩 보호 (정리/삭제 방지)
 * - 게임 상태를 저장하지 않고 provider용 읽기 API 제공
 */

import {
  type PublishedContentPack,
  validatePublishedContentPack,
} from '../data/PublishedContentPack.js';
import {
  EditorContentDatabase,
  type IEditorTransaction,
} from './EditorContentDatabase.js';
import {
  type ProjectHead,
  RevisionConflictError,
} from './EditorProjectStore.js';

export { RevisionConflictError };

/**
 * 유효하지 않은 게시본 에러
 */
export class InvalidPublishedPackError extends Error {
  readonly diagnostics: string[];

  constructor(message: string, diagnostics: string[] = []) {
    super(message);
    this.name = 'InvalidPublishedPackError';
    this.diagnostics = diagnostics;
  }
}

/**
 * 활성/복구 참조로 보호된 팩 삭제 시도 시 에러
 */
export class ProtectedPackError extends Error {
  readonly contentHash: string;

  constructor(contentHash: string, reason: string) {
    super(`ProtectedPackError: [${contentHash}] ${reason}`);
    this.name = 'ProtectedPackError';
    this.contentHash = contentHash;
  }
}

/**
 * 불변 게시본 저장 레코드 (publishedPacks)
 */
export interface PublishedPackRecord {
  contentHash: string;
  sourceProjectId: string;
  sourceRevision: number;
  publishedAt: string;
  pack: PublishedContentPack;
}

/**
 * 프로젝트별 활성화 헤드 레코드 (activationHeads)
 */
export interface ActivationHeadRecord {
  projectId: string;
  activeContentHash: string;
  previousHealthyHash: string | null;
  stagedRollbackHash?: string | null;
  updatedAt: string;
  sourceRevision: number;
}

/**
 * 게시 옵션
 */
export interface PublishOptions {
  expectedSourceRevision?: number;
  activateNow?: boolean;
}

/**
 * 게시 결과 DTO
 */
export interface PublishResult {
  success: boolean;
  contentHash: string;
  isIdempotent: boolean;
  activationHead?: ActivationHeadRecord;
}

/**
 * 롤백 결과 DTO
 */
export interface RollbackResult {
  success: boolean;
  activeContentHash?: string;
  previousHealthyHash?: string | null;
  scheduledHash?: string | null;
}

/**
 * 팩 정리 결과 DTO
 */
export interface PruneResult {
  deletedCount: number;
  deletedHashes: string[];
}

/**
 * 게시본 요약 정보
 */
export interface PublishedPackSummary {
  contentHash: string;
  sourceProjectId: string;
  sourceRevision: number;
  publishedAt: string;
  title: string;
}

/**
 * 객체 재귀 동결 헬퍼
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export class PublishedContentStore {
  private readonly db: EditorContentDatabase;
  private readonly projectQueues: Map<string, Promise<unknown>> = new Map();

  constructor(db: EditorContentDatabase) {
    this.db = db;
  }

  /**
   * 프로젝트별 직렬화 큐 (동일 프로젝트 동시 쓰기 경쟁 방지)
   */
  private async enqueueProjectTask<T>(projectId: string, task: () => Promise<T>): Promise<T> {
    const prev = this.projectQueues.get(projectId) || Promise.resolve();
    let resolveCurrent: () => void;
    const currentPromise = new Promise<void>((resolve) => {
      resolveCurrent = resolve;
    });

    this.projectQueues.set(
      projectId,
      prev.then(() => currentPromise).catch(() => currentPromise)
    );

    try {
      await prev;
      return await task();
    } finally {
      resolveCurrent!();
      if (this.projectQueues.get(projectId) === currentPromise) {
        this.projectQueues.delete(projectId);
      }
    }
  }

  /**
   * 컴파일된 콘텐츠 팩 검증 및 불변 저장, activationHeads 원자적 갱신
   */
  async publish(pack: PublishedContentPack, options?: PublishOptions): Promise<PublishResult> {
    // 1. 순수 유효성 및 무결성 검증 (validatePublishedContentPack)
    const validation = validatePublishedContentPack(pack);
    if (!validation.valid || !validation.ok) {
      const errMsgs = validation.errors.map((e) => `[${e.code}] ${e.message}`);
      throw new InvalidPublishedPackError(
        `Failed to publish content pack: ${errMsgs.join('; ')}`,
        errMsgs
      );
    }

    const projectId = pack.sourceProjectId;

    // 2. 프로젝트별 직렬 큐를 통한 원자적 저장 및 헤드 갱신
    return this.enqueueProjectTask(projectId, async () => {
      return this.db.transaction(
        ['projectHeads', 'publishedPacks', 'activationHeads'],
        'readwrite',
        async (tx) => {
          // 2.1 sourceRevision 일치 여부 확인 (오래된 초안 최신 게시 차단)
          const currentHead = await tx.get<ProjectHead>('projectHeads', projectId);
          if (currentHead && currentHead.revision !== pack.sourceRevision) {
            throw new RevisionConflictError(
              projectId,
              currentHead.revision,
              pack.sourceRevision
            );
          }

          if (
            options?.expectedSourceRevision !== undefined &&
            options.expectedSourceRevision !== pack.sourceRevision
          ) {
            throw new RevisionConflictError(
              projectId,
              options.expectedSourceRevision,
              pack.sourceRevision
            );
          }

          const existingPackRecord = await tx.get<PublishedPackRecord>(
            'publishedPacks',
            pack.contentHash
          );

          const now = new Date().toISOString();
          const isIdempotent = Boolean(existingPackRecord);

          // 2.2 publishedPacks에 없으면 불변 저장
          if (!existingPackRecord) {
            const packRecord: PublishedPackRecord = {
              contentHash: pack.contentHash,
              sourceProjectId: projectId,
              sourceRevision: pack.sourceRevision,
              publishedAt: now,
              pack: structuredClone(pack),
            };
            await tx.put('publishedPacks', pack.contentHash, packRecord);
          }

          // 2.3 activationHeads 갱신
          const activateNow = options?.activateNow ?? true;
          let currentActivation = await tx.get<ActivationHeadRecord>(
            'activationHeads',
            projectId
          );

          if (activateNow) {
            if (currentActivation) {
              const prevActive = currentActivation.activeContentHash;
              const isSameHash = prevActive === pack.contentHash;

              currentActivation = {
                ...currentActivation,
                activeContentHash: pack.contentHash,
                previousHealthyHash: isSameHash
                  ? currentActivation.previousHealthyHash
                  : prevActive,
                sourceRevision: pack.sourceRevision,
                updatedAt: now,
              };
            } else {
              currentActivation = {
                projectId,
                activeContentHash: pack.contentHash,
                previousHealthyHash: null,
                stagedRollbackHash: null,
                sourceRevision: pack.sourceRevision,
                updatedAt: now,
              };
            }

            await tx.put('activationHeads', projectId, currentActivation);
          }

          return {
            success: true,
            contentHash: pack.contentHash,
            isIdempotent,
            activationHead: currentActivation ?? undefined,
          };
        }
      );
    });
  }

  /**
   * contentHash로 불변 저장된 팩 조회 (deepFreeze 불변 반환)
   */
  async getPublishedPack(contentHash: string): Promise<PublishedContentPack | null> {
    return this.db.transaction(['publishedPacks'], 'readonly', async (tx) => {
      const record = await tx.get<PublishedPackRecord>('publishedPacks', contentHash);
      if (!record || !record.pack) {
        return null;
      }
      return deepFreeze(structuredClone(record.pack));
    });
  }

  /**
   * contentHash의 저장 여부 확인
   */
  async hasPublishedPack(contentHash: string): Promise<boolean> {
    return this.db.transaction(['publishedPacks'], 'readonly', async (tx) => {
      const record = await tx.get<PublishedPackRecord>('publishedPacks', contentHash);
      return Boolean(record);
    });
  }

  /**
   * 프로젝트 활성화 헤드 조회
   */
  async getActivationHead(projectId: string): Promise<ActivationHeadRecord | null> {
    return this.db.transaction(['activationHeads'], 'readonly', async (tx) => {
      const record = await tx.get<ActivationHeadRecord>('activationHeads', projectId);
      return record ? structuredClone(record) : null;
    });
  }

  /**
   * 현재 활성(active) 상태인 팩 조회 (Provider API)
   */
  async getActivePack(projectId: string): Promise<PublishedContentPack | null> {
    const head = await this.getActivationHead(projectId);
    if (!head || !head.activeContentHash) {
      return null;
    }
    return this.getPublishedPack(head.activeContentHash);
  }

  /**
   * 이전 정상본 또는 지정된 hash로 롤백 적용 예약 (scheduleRollback)
   */
  async scheduleRollback(projectId: string, targetHash?: string): Promise<RollbackResult> {
    return this.enqueueProjectTask(projectId, async () => {
      return this.db.transaction(
        ['publishedPacks', 'activationHeads'],
        'readwrite',
        async (tx) => {
          const head = await tx.get<ActivationHeadRecord>('activationHeads', projectId);
          if (!head) {
            throw new Error(`Activation head not found for project: ${projectId}`);
          }

          const rollbackTarget = targetHash ?? head.previousHealthyHash;
          if (!rollbackTarget) {
            throw new Error(
              `No previous healthy hash or target hash available for rollback on project: ${projectId}`
            );
          }

          const targetPack = await tx.get<PublishedPackRecord>('publishedPacks', rollbackTarget);
          if (!targetPack) {
            throw new Error(`Target rollback pack not found in publishedPacks: ${rollbackTarget}`);
          }

          head.stagedRollbackHash = rollbackTarget;
          head.updatedAt = new Date().toISOString();
          await tx.put('activationHeads', projectId, head);

          return {
            success: true,
            activeContentHash: head.activeContentHash,
            previousHealthyHash: head.previousHealthyHash,
            scheduledHash: rollbackTarget,
          };
        }
      );
    });
  }

  /**
   * 예약된 롤백(stagedRollbackHash)을 즉시 활성화
   */
  async activateRollback(projectId: string): Promise<RollbackResult> {
    return this.enqueueProjectTask(projectId, async () => {
      return this.db.transaction(
        ['publishedPacks', 'activationHeads'],
        'readwrite',
        async (tx) => {
          const head = await tx.get<ActivationHeadRecord>('activationHeads', projectId);
          if (!head || !head.stagedRollbackHash) {
            throw new Error(`No staged rollback found to activate for project: ${projectId}`);
          }

          const targetHash = head.stagedRollbackHash;
          const targetPack = await tx.get<PublishedPackRecord>('publishedPacks', targetHash);
          if (!targetPack) {
            throw new Error(`Target rollback pack not found in publishedPacks: ${targetHash}`);
          }

          const prevActive = head.activeContentHash;
          head.activeContentHash = targetHash;
          head.previousHealthyHash = prevActive;
          head.stagedRollbackHash = null;
          head.sourceRevision = targetPack.sourceRevision;
          head.updatedAt = new Date().toISOString();

          await tx.put('activationHeads', projectId, head);

          return {
            success: true,
            activeContentHash: targetHash,
            previousHealthyHash: prevActive,
          };
        }
      );
    });
  }

  /**
   * 롤백 실행 (immediate: true 시 즉시 반영, false 시 예약)
   */
  async rollback(
    projectId: string,
    targetHash?: string,
    options?: { immediate?: boolean }
  ): Promise<RollbackResult> {
    if (!options?.immediate) {
      return this.scheduleRollback(projectId, targetHash);
    }

    return this.enqueueProjectTask(projectId, async () => {
      return this.db.transaction(
        ['publishedPacks', 'activationHeads'],
        'readwrite',
        async (tx) => {
          const head = await tx.get<ActivationHeadRecord>('activationHeads', projectId);
          if (!head) {
            throw new Error(`Activation head not found for project: ${projectId}`);
          }

          const rollbackTarget = targetHash ?? head.previousHealthyHash;
          if (!rollbackTarget) {
            throw new Error(
              `No previous healthy hash or target hash available for rollback on project: ${projectId}`
            );
          }

          const targetPack = await tx.get<PublishedPackRecord>('publishedPacks', rollbackTarget);
          if (!targetPack) {
            throw new Error(`Target rollback pack not found in publishedPacks: ${rollbackTarget}`);
          }

          const prevActive = head.activeContentHash;
          head.activeContentHash = rollbackTarget;
          head.previousHealthyHash = prevActive;
          head.stagedRollbackHash = null;
          head.sourceRevision = targetPack.sourceRevision;
          head.updatedAt = new Date().toISOString();

          await tx.put('activationHeads', projectId, head);

          return {
            success: true,
            activeContentHash: rollbackTarget,
            previousHealthyHash: prevActive,
          };
        }
      );
    });
  }

  /**
   * 보호 대상 참조 검사 헬퍼
   */
  private async isHashProtected(
    tx: IEditorTransaction,
    contentHash: string
  ): Promise<{ protected: boolean; reason?: string }> {
    // 1. activationHeads 검사
    const allActivations = await tx.getAll<ActivationHeadRecord>('activationHeads');
    for (const act of allActivations) {
      if (act.activeContentHash === contentHash) {
        return {
          protected: true,
          reason: `Referenced as activeContentHash by project "${act.projectId}"`,
        };
      }
      if (act.previousHealthyHash === contentHash) {
        return {
          protected: true,
          reason: `Referenced as previousHealthyHash by project "${act.projectId}"`,
        };
      }
      if (act.stagedRollbackHash === contentHash) {
        return {
          protected: true,
          reason: `Referenced as stagedRollbackHash by project "${act.projectId}"`,
        };
      }
    }

    // 2. recoveryBuffers 검사
    const allRecoveries = await tx.getAll<{ raw?: unknown }>('recoveryBuffers');
    for (const rec of allRecoveries) {
      if (rec.raw) {
        const rawStr = typeof rec.raw === 'string' ? rec.raw : JSON.stringify(rec.raw);
        if (rawStr.includes(contentHash)) {
          return {
            protected: true,
            reason: 'Referenced in recoveryBuffers',
          };
        }
      }
    }

    return { protected: false };
  }

  /**
   * 단일 게시본 삭제 (활성/복구 참조 중인 팩은 삭제 차단)
   */
  async deletePublishedPack(contentHash: string): Promise<void> {
    return this.db.transaction(
      ['publishedPacks', 'activationHeads', 'recoveryBuffers'],
      'readwrite',
      async (tx) => {
        const check = await this.isHashProtected(tx, contentHash);
        if (check.protected) {
          throw new ProtectedPackError(contentHash, check.reason || 'Referenced and protected');
        }

        await tx.delete('publishedPacks', contentHash);
      }
    );
  }

  /**
   * 고아(unreferenced) 팩 일괄 정리 (활성/이전정상/예약/복구 참조 팩 완전 보존)
   */
  async pruneUnreferencedPacks(): Promise<PruneResult> {
    return this.db.transaction(
      ['publishedPacks', 'activationHeads', 'recoveryBuffers'],
      'readwrite',
      async (tx) => {
        const allPacks = await tx.getAll<PublishedPackRecord>('publishedPacks');
        const deletedHashes: string[] = [];

        for (const record of allPacks) {
          const check = await this.isHashProtected(tx, record.contentHash);
          if (!check.protected) {
            await tx.delete('publishedPacks', record.contentHash);
            deletedHashes.push(record.contentHash);
          }
        }

        return {
          deletedCount: deletedHashes.length,
          deletedHashes,
        };
      }
    );
  }

  /**
   * 저장된 게시본 전체 목록 요약 조회
   */
  async listPublishedPacks(): Promise<PublishedPackSummary[]> {
    return this.db.transaction(['publishedPacks'], 'readonly', async (tx) => {
      const records = await tx.getAll<PublishedPackRecord>('publishedPacks');
      return records.map((r) => ({
        contentHash: r.contentHash,
        sourceProjectId: r.sourceProjectId,
        sourceRevision: r.sourceRevision,
        publishedAt: r.publishedAt,
        title: r.pack?.metadata?.title || 'Untitled',
      }));
    });
  }
}
