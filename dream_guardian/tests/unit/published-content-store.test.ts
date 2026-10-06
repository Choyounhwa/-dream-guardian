import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
} from '../../src/data/EditorProject.js';
import { DEFAULT_RULESET_ID } from '../../src/data/ContentCapabilities.js';
import { compileEditorProject } from '../../src/data/ContentCompiler.js';
import {
  type PublishedContentPack,
} from '../../src/data/PublishedContentPack.js';
import {
  EditorContentDatabase,
  MemoryIndexedDBAdapter,
} from '../../src/storage/EditorContentDatabase.js';
import {
  PublishedContentStore,
  RevisionConflictError,
  InvalidPublishedPackError,
  ProtectedPackError,
} from '../../src/storage/PublishedContentStore.js';

function createTestProject(projectId: string = 'proj_publish_test_01', revision: number = 1, bpm: number = 120): EditorProject {
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId,
    revision,
    rulesetId: DEFAULT_RULESET_ID,
    metadata: {
      title: `Fitness Groove (rev ${revision})`,
      description: 'Ch1 test routine',
      author: 'Tester',
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T01:00:00.000Z',
    },
    previewTempo: {
      bpm,
      beatsPerBar: 4,
    },
    patterns: [
      {
        id: 'pat_tap',
        name: 'Tap',
        target: { leftHand: 1, rightHand: null, head: null, hip: null },
      },
    ],
    sequences: [
      {
        id: 'seq_stars',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          {
            id: 'evt_1',
            kind: 'starNote',
            landingTick: 960,
            target: { type: 'cursor', part: 'leftHand', zoneId: 1 },
            sourcePatternId: 'pat_tap',
          },
        ],
      },
    ],
    bindings: [
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseA',
        sequenceId: 'seq_stars',
      },
    ],
  };
}

function createTestPack(projectId: string = 'proj_publish_test_01', revision: number = 1, bpm: number = 120): PublishedContentPack {
  const proj = createTestProject(projectId, revision, bpm);
  const res = compileEditorProject(proj);
  if (!res.success || !res.pack) {
    throw new Error(`Failed to compile test project: ${JSON.stringify(res.diagnostics)}`);
  }
  return res.pack;
}

describe('PublishedContentStore - 불변 게시본·적용 예약·이전 정상본 저장 (#386)', () => {
  let adapter: MemoryIndexedDBAdapter;
  let db: EditorContentDatabase;
  let store: PublishedContentStore;

  beforeEach(async () => {
    adapter = new MemoryIndexedDBAdapter();
    await adapter.open();
    db = new EditorContentDatabase(adapter);
    store = new PublishedContentStore(db);
  });

  describe('1. 불변 저장 및 contentHash 키 검증', () => {
    it('검증된 contentHash 기준으로 팩을 저장하고 activationHeads를 갱신한다', async () => {
      const pack = createTestPack('proj_01', 1, 120);
      const res = await store.publish(pack);

      expect(res.success).toBe(true);
      expect(res.contentHash).toBe(pack.contentHash);
      expect(res.isIdempotent).toBe(false);

      // publishedPacks 스토어에서 contentHash 키로 조회 가능
      const fetched = await store.getPublishedPack(pack.contentHash);
      expect(fetched).not.toBeNull();
      expect(fetched?.contentHash).toBe(pack.contentHash);
      expect(fetched?.sourceProjectId).toBe('proj_01');

      // activationHeads 갱신 확인
      const head = await store.getActivationHead('proj_01');
      expect(head).not.toBeNull();
      expect(head?.activeContentHash).toBe(pack.contentHash);
      expect(head?.previousHealthyHash).toBeNull();
      expect(head?.sourceRevision).toBe(1);

      // getActivePack 조회 확인
      const activePack = await store.getActivePack('proj_01');
      expect(activePack?.contentHash).toBe(pack.contentHash);
    });

    it('hasPublishedPack을 통해 존재 여부를 확인한다', async () => {
      const pack = createTestPack('proj_01', 1, 120);
      expect(await store.hasPublishedPack(pack.contentHash)).toBe(false);
      await store.publish(pack);
      expect(await store.hasPublishedPack(pack.contentHash)).toBe(true);
    });
  });

  describe('2. sourceRevision 불일치 시 게시 거부 (RevisionConflictError)', () => {
    it('DB 내 projectHeads의 revision과 일치하지 않으면 저장을 즉시 중단한다', async () => {
      // projectHeads에 최신 revision 3 설정
      await adapter.transaction(['projectHeads'], 'readwrite', async (tx) => {
        await tx.put('projectHeads', 'proj_01', {
          projectId: 'proj_01',
          revision: 3,
          snapshotId: 'snap_03',
          title: 'Latest Draft',
          updatedAt: '2026-10-05T00:00:00.000Z',
        });
      });

      // 오래된 초안(rev 1)으로 게시 시도
      const stalePack = createTestPack('proj_01', 1, 120);

      await expect(store.publish(stalePack)).rejects.toThrow(RevisionConflictError);

      // 게시본 및 activationHead가 기록되지 않아야 함
      expect(await store.getPublishedPack(stalePack.contentHash)).toBeNull();
      expect(await store.getActivationHead('proj_01')).toBeNull();
    });

    it('expectedSourceRevision 옵션과 일치하지 않으면 거부한다', async () => {
      const pack = createTestPack('proj_01', 2, 120);

      await expect(
        store.publish(pack, { expectedSourceRevision: 1 })
      ).rejects.toThrow(RevisionConflictError);
    });

    it('projectHeads의 revision과 일치하는 최신 초안은 정상 게시된다', async () => {
      await adapter.transaction(['projectHeads'], 'readwrite', async (tx) => {
        await tx.put('projectHeads', 'proj_01', {
          projectId: 'proj_01',
          revision: 2,
          snapshotId: 'snap_02',
          title: 'Current Draft',
          updatedAt: '2026-10-05T00:00:00.000Z',
        });
      });

      const validPack = createTestPack('proj_01', 2, 120);
      const res = await store.publish(validPack);
      expect(res.success).toBe(true);
      expect(res.contentHash).toBe(validPack.contentHash);
    });
  });

  describe('3. 동일 contentHash 재저장 멱등(Idempotent)성', () => {
    it('동일 contentHash의 재저장은 에러 없이 멱등하게 성공하며 isIdempotent를 반환한다', async () => {
      const pack = createTestPack('proj_01', 1, 120);

      const firstRes = await store.publish(pack);
      expect(firstRes.success).toBe(true);
      expect(firstRes.isIdempotent).toBe(false);

      const secondRes = await store.publish(pack);
      expect(secondRes.success).toBe(true);
      expect(secondRes.isIdempotent).toBe(true);
      expect(secondRes.contentHash).toBe(pack.contentHash);

      // activationHeads 상태 유지
      const head = await store.getActivationHead('proj_01');
      expect(head?.activeContentHash).toBe(pack.contentHash);
      expect(head?.previousHealthyHash).toBeNull();
    });
  });

  describe('4. 트랜잭션 실패 시 activationHeads 및 이전 정상본 보존', () => {
    it('두 번째 게시 중 저장소 오류 발생 시 기존 activationHeads 및 정상본이 완전 보존된다', async () => {
      // 1. 첫 번째 정상 게시 (Pack A)
      const packA = createTestPack('proj_01', 1, 120);
      await store.publish(packA);

      const headA = await store.getActivationHead('proj_01');
      expect(headA?.activeContentHash).toBe(packA.contentHash);

      // 2. 오류 시뮬레이션 설정 (다음 트랜잭션 실패)
      adapter.simulateNextError(new Error('QuotaExceededError: simulated disk full'));

      // 3. 두 번째 게시 시도 (Pack B, bpm 125)
      const packB = createTestPack('proj_01', 2, 125);
      await expect(store.publish(packB)).rejects.toThrow('QuotaExceededError');

      // 4. activationHeads 및 publishedPacks 상태 확인: Pack A가 여전히 active, Pack B는 없음
      const headAfterError = await store.getActivationHead('proj_01');
      expect(headAfterError?.activeContentHash).toBe(packA.contentHash);
      expect(headAfterError?.previousHealthyHash).toBeNull();

      expect(await store.hasPublishedPack(packB.contentHash)).toBe(false);
      expect(await store.hasPublishedPack(packA.contentHash)).toBe(true);
    });
  });

  describe('5. 이전 정상본 추적 및 이전 게시본 롤백 예약 (rollback to previousHealthyHash)', () => {
    it('새로운 팩 게시 시 이전 정상본(previousHealthyHash)이 자동으로 기록된다', async () => {
      const packA = createTestPack('proj_01', 1, 120);
      await store.publish(packA);

      const packB = createTestPack('proj_01', 2, 125);
      await store.publish(packB);

      const head = await store.getActivationHead('proj_01');
      expect(head?.activeContentHash).toBe(packB.contentHash);
      expect(head?.previousHealthyHash).toBe(packA.contentHash);
    });

    it('이전 정상본으로 롤백 적용 예약(scheduleRollback)이 가능하다', async () => {
      const packA = createTestPack('proj_01', 1, 120);
      await store.publish(packA);
      const packB = createTestPack('proj_01', 2, 125);
      await store.publish(packB);

      // previousHealthyHash로 롤백 예약
      const rollbackRes = await store.scheduleRollback('proj_01');
      expect(rollbackRes.success).toBe(true);
      expect(rollbackRes.scheduledHash).toBe(packA.contentHash);

      // activationHead에 stagedRollbackHash가 설정되지만 현재 activeContentHash는 packB 유지
      const head = await store.getActivationHead('proj_01');
      expect(head?.activeContentHash).toBe(packB.contentHash);
      expect(head?.stagedRollbackHash).toBe(packA.contentHash);

      // 예약된 롤백 적용
      const activateRes = await store.activateRollback('proj_01');
      expect(activateRes.success).toBe(true);
      expect(activateRes.activeContentHash).toBe(packA.contentHash);

      const activeHead = await store.getActivationHead('proj_01');
      expect(activeHead?.activeContentHash).toBe(packA.contentHash);
      expect(activeHead?.previousHealthyHash).toBe(packB.contentHash);
      expect(activeHead?.stagedRollbackHash).toBeNull();
    });

    it('특정 이전 게시본 hash를 지정하여 롤백을 즉시 실행(immediate)할 수 있다', async () => {
      const packA = createTestPack('proj_01', 1, 120);
      await store.publish(packA);
      const packB = createTestPack('proj_01', 2, 125);
      await store.publish(packB);

      const res = await store.rollback('proj_01', packA.contentHash, { immediate: true });
      expect(res.success).toBe(true);
      expect(res.activeContentHash).toBe(packA.contentHash);

      const head = await store.getActivationHead('proj_01');
      expect(head?.activeContentHash).toBe(packA.contentHash);
      expect(head?.previousHealthyHash).toBe(packB.contentHash);
    });

    it('존재하지 않는 팩 hash로 롤백 요청 시 실패한다', async () => {
      const packA = createTestPack('proj_01', 1, 120);
      await store.publish(packA);

      await expect(
        store.rollback('proj_01', 'non_existent_hash_1234567890abcdef', { immediate: true })
      ).rejects.toThrow();
    });
  });

  describe('6. 게시본 직접 수정 불가 (Immutability & Object.freeze)', () => {
    it('반환된 팩 객체는 동결(freeze)되어 프로퍼티 직접 수정이 불가하다', async () => {
      const pack = createTestPack('proj_01', 1, 120);
      await store.publish(pack);

      const fetched = await store.getPublishedPack(pack.contentHash);
      expect(fetched).not.toBeNull();

      // 객체 수정 시도 시 TypeError 발생 (strict mode / Object.freeze)
      expect(() => {
        (fetched as any).metadata.title = 'Mutated Title';
      }).toThrow();

      // 재조회 시에도 원본 값 보존
      const reFetched = await store.getPublishedPack(pack.contentHash);
      expect(reFetched?.metadata.title).not.toBe('Mutated Title');
    });
  });

  describe('7. 잘못된 hash, 규칙 미준수, 필수 필드 누락 시 저장 거부', () => {
    it('contentHash가 변조되었거나 불일치하는 경우 저장을 거부한다', async () => {
      const pack = createTestPack('proj_01', 1, 120);
      const tampered = {
        ...pack,
        contentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      await expect(store.publish(tampered)).rejects.toThrow(InvalidPublishedPackError);
    });

    it('kind가 올바르지 않은 경우 저장을 거부한다', async () => {
      const pack = createTestPack('proj_01', 1, 120);
      const invalid = {
        ...pack,
        kind: 'invalid-kind' as any,
      };

      await expect(store.publish(invalid)).rejects.toThrow(InvalidPublishedPackError);
    });

    it('stages가 비어있거나 필수 필드가 누락된 경우 저장을 거부한다', async () => {
      const pack = createTestPack('proj_01', 1, 120);
      const invalid = {
        ...pack,
        stages: [] as any,
      };

      await expect(store.publish(invalid)).rejects.toThrow(InvalidPublishedPackError);
    });
  });

  describe('8. 활성(active) 및 복구(recovery) 참조 팩 삭제/정리 방지', () => {
    it('활성 참조(activeContentHash) 중인 팩은 삭제할 수 없다', async () => {
      const pack = createTestPack('proj_01', 1, 120);
      await store.publish(pack);

      await expect(store.deletePublishedPack(pack.contentHash)).rejects.toThrow(ProtectedPackError);
      expect(await store.hasPublishedPack(pack.contentHash)).toBe(true);
    });

    it('이전 정상본(previousHealthyHash)으로 참조 중인 팩은 삭제할 수 없다', async () => {
      const packA = createTestPack('proj_01', 1, 120);
      await store.publish(packA);
      const packB = createTestPack('proj_01', 2, 125);
      await store.publish(packB);

      // packA는 현재 previousHealthyHash로 보호됨
      await expect(store.deletePublishedPack(packA.contentHash)).rejects.toThrow(ProtectedPackError);
      expect(await store.hasPublishedPack(packA.contentHash)).toBe(true);
    });

    it('복구 버퍼(recoveryBuffers)에서 참조 중인 팩은 정리 대상에서 제외된다', async () => {
      // packA, packB, packC 게시
      const packA = createTestPack('proj_01', 1, 120);
      await store.publish(packA);
      const packB = createTestPack('proj_01', 2, 125);
      await store.publish(packB);
      const packC = createTestPack('proj_01', 3, 140);
      await store.publish(packC);

      // packC is active, packB is previousHealthy.
      // packA is now unreferenced by activationHeads, BUT let's reference packA in recoveryBuffers
      await adapter.transaction(['recoveryBuffers'], 'readwrite', async (tx) => {
        await tx.put('recoveryBuffers', 'recovery_buf_01', {
          bufferId: 'recovery_buf_01',
          projectId: 'proj_01',
          reason: 'backup_check',
          createdAt: new Date().toISOString(),
          raw: { referencedHash: packA.contentHash },
        });
      });

      // 정리(prune) 실행
      const pruneRes = await store.pruneUnreferencedPacks();
      // packA, packB, packC 모두 보호되어 아무것도 삭제되지 않아야 함
      expect(pruneRes.deletedCount).toBe(0);
      expect(await store.hasPublishedPack(packA.contentHash)).toBe(true);
    });

    it('참조되지 않는 고아(orphaned) 팩만 pruneUnreferencedPacks에 의해 정리된다', async () => {
      // 1. 프로젝트 1에 A, B, C 순차 게시 (C: active, B: previousHealthy, A: unreferenced)
      const packA = createTestPack('proj_01', 1, 120);
      await store.publish(packA);
      const packB = createTestPack('proj_01', 2, 125);
      await store.publish(packB);
      const packC = createTestPack('proj_01', 3, 140);
      await store.publish(packC);

      // packA는 이제 활성/이전정상/복구 어디에도 참조되지 않음
      const pruneRes = await store.pruneUnreferencedPacks();
      expect(pruneRes.deletedCount).toBe(1);
      expect(pruneRes.deletedHashes).toContain(packA.contentHash);

      // packA는 삭제됨, packB와 packC는 유지됨
      expect(await store.hasPublishedPack(packA.contentHash)).toBe(false);
      expect(await store.hasPublishedPack(packB.contentHash)).toBe(true);
      expect(await store.hasPublishedPack(packC.contentHash)).toBe(true);
    });
  });
});
