import { describe, it, expect, beforeEach } from 'vitest';
import { type EditorProject } from '../../src/data/EditorProject.js';
import { createEmptyEditorProject } from '../../src/data/ProjectValidator.js';
import {
  EditorContentDatabase,
  MemoryIndexedDBAdapter,
  EDITOR_STORE_NAMES,
} from '../../src/storage/EditorContentDatabase.js';
import {
  EditorProjectStore,
  RevisionConflictError,
  type SaveResult,
} from '../../src/storage/EditorProjectStore.js';

function createTestProject(projectId: string = 'proj_test_fitness_01', revision: number = 1): EditorProject {
  const base = createEmptyEditorProject({ projectId, title: 'Fitness Groove Alpha' });
  return {
    ...base,
    projectId,
    revision,
    metadata: {
      ...base.metadata,
      title: 'Fitness Groove Alpha',
      updatedAt: '2026-10-05T00:00:00.000Z',
    },
  };
}

describe('EditorContentDatabase - 격리 저장소 어댑터 및 트랜잭션 원자성 (#379)', () => {
  let adapter: MemoryIndexedDBAdapter;

  beforeEach(() => {
    adapter = new MemoryIndexedDBAdapter();
  });

  it('피트니스 에디터 전용 5개 store가 모두 정의되고 초기화된다', async () => {
    await adapter.open();
    expect(adapter.isAvailable).toBe(true);
    expect(EDITOR_STORE_NAMES).toEqual([
      'projectHeads',
      'projectSnapshots',
      'recoveryBuffers',
      'publishedPacks',
      'activationHeads',
    ]);
  });

  it('단일 트랜잭션 내 다중 쓰기(put)가 원자적으로 커밋된다', async () => {
    await adapter.open();

    await adapter.transaction(['projectHeads', 'projectSnapshots'], 'readwrite', async (tx) => {
      await tx.put('projectHeads', 'proj_01', { projectId: 'proj_01', revision: 1 });
      await tx.put('projectSnapshots', 'proj_01:rev_1', { snapshotId: 'proj_01:rev_1', revision: 1 });
    });

    const head = await adapter.transaction(['projectHeads'], 'readonly', async (tx) => {
      return await tx.get('projectHeads', 'proj_01');
    });
    expect(head).toEqual({ projectId: 'proj_01', revision: 1 });

    const snapshot = await adapter.transaction(['projectSnapshots'], 'readonly', async (tx) => {
      return await tx.get('projectSnapshots', 'proj_01:rev_1');
    });
    expect(snapshot).toEqual({ snapshotId: 'proj_01:rev_1', revision: 1 });
  });

  it('트랜잭션 abort() 호출 시 중간 변경사항이 모두 롤백되고 부분 쓰기가 남지 않는다', async () => {
    await adapter.open();

    // 초기 상태 쓰기
    await adapter.transaction(['projectHeads'], 'readwrite', async (tx) => {
      await tx.put('projectHeads', 'proj_01', { projectId: 'proj_01', revision: 1 });
    });

    // abort되는 트랜잭션
    await expect(
      adapter.transaction(['projectHeads', 'projectSnapshots'], 'readwrite', async (tx) => {
        await tx.put('projectHeads', 'proj_01', { projectId: 'proj_01', revision: 2 });
        await tx.put('projectSnapshots', 'proj_01:rev_2', { snapshotId: 'proj_01:rev_2', revision: 2 });
        tx.abort();
      })
    ).rejects.toThrow();

    // 롤백 확인: revision 1이 온전히 보존되고, snapshot rev_2는 존재하지 않음
    const head = await adapter.transaction(['projectHeads'], 'readonly', async (tx) => {
      return await tx.get<{ projectId: string; revision: number }>('projectHeads', 'proj_01');
    });
    expect(head?.revision).toBe(1);

    const snapshot = await adapter.transaction(['projectSnapshots'], 'readonly', async (tx) => {
      return await tx.get('projectSnapshots', 'proj_01:rev_2');
    });
    expect(snapshot).toBeUndefined();
  });

  it('트랜잭션 콜백 내부에서 예외 발생 시 모든 상태가 롤백된다', async () => {
    await adapter.open();

    await expect(
      adapter.transaction(['recoveryBuffers'], 'readwrite', async (tx) => {
        await tx.put('recoveryBuffers', 'buf_01', { bufferId: 'buf_01', data: 'partial' });
        throw new Error('Simulated Quota / Disk Failure');
      })
    ).rejects.toThrow('Simulated Quota / Disk Failure');

    const buf = await adapter.transaction(['recoveryBuffers'], 'readonly', async (tx) => {
      return await tx.get('recoveryBuffers', 'buf_01');
    });
    expect(buf).toBeUndefined();
  });
});

describe('EditorProjectStore - 원자적 초안 저장, 직렬화, 충돌 복구 (#379)', () => {
  let db: EditorContentDatabase;
  let adapter: MemoryIndexedDBAdapter;
  let store: EditorProjectStore;

  beforeEach(async () => {
    adapter = new MemoryIndexedDBAdapter();
    db = new EditorContentDatabase(adapter);
    await db.open();
    store = new EditorProjectStore(db);
  });

  describe('1. 기본 프로젝트 저장 및 조회 (Roundtrip)', () => {
    it('유효한 프로젝트를 저장하면 snapshot과 head가 원자적으로 기록된다', async () => {
      const project = createTestProject('proj_alpha', 1);
      const result: SaveResult = await store.saveProject(project);

      expect(result.success).toBe(true);
      expect(result.revision).toBe(1);
      expect(result.head?.revision).toBe(1);
      expect(result.head?.snapshotId).toBeDefined();

      const loaded = await store.loadProject('proj_alpha');
      expect(loaded).not.toBeNull();
      expect(loaded?.projectId).toBe('proj_alpha');
      expect(loaded?.revision).toBe(1);
      expect(loaded?.metadata.title).toBe('Fitness Groove Alpha');
    });

    it('연속 저장 시 revision이 순차 증가하고 이전 snapshot들이 보존된다', async () => {
      const p1 = createTestProject('proj_alpha', 1);
      await store.saveProject(p1);

      const p2 = { ...p1, metadata: { ...p1.metadata, title: 'Fitness Groove Alpha Rev 2' } };
      const r2 = await store.saveProject(p2, { expectedRevision: 1 });
      expect(r2.success).toBe(true);
      expect(r2.revision).toBe(2);

      const snapshots = await store.listSnapshots('proj_alpha');
      expect(snapshots.length).toBe(2);
      expect(snapshots.map((s) => s.revision)).toEqual([2, 1]);

      const snapRev1 = await store.getSnapshot(snapshots[1].snapshotId);
      expect(snapRev1?.metadata.title).toBe('Fitness Groove Alpha');

      const snapRev2 = await store.getSnapshot(snapshots[0].snapshotId);
      expect(snapRev2?.metadata.title).toBe('Fitness Groove Alpha Rev 2');
    });

    it('유효하지 않은 프로젝트 구조는 검증 실패로 저장이 거부된다', async () => {
      const invalidProject = {
        kind: 'invalid-kind',
        projectId: 'proj_invalid',
      } as unknown as EditorProject;

      const result = await store.saveProject(invalidProject);
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');

      const head = await store.getHead('proj_invalid');
      expect(head).toBeNull();
    });
  });

  describe('2. Revision 충돌 및 직렬화 보호 (탭 경쟁 방지)', () => {
    it('expectedRevision이 현재 head와 불일치하면 저장이 거부되고 충돌을 보고한다', async () => {
      const p1 = createTestProject('proj_conflict', 1);
      await store.saveProject(p1);

      // 현재 head는 revision 1. 클라이언트가 expectedRevision: 99 전달
      const result = await store.saveProject(
        { ...p1, metadata: { ...p1.metadata, title: 'Outdated Edit' } },
        { expectedRevision: 99 }
      );

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.error).toContain('Revision conflict');

      // 기존 head는 그대로 유지
      const head = await store.getHead('proj_conflict');
      expect(head?.revision).toBe(1);
    });

    it('throwOnConflict 옵션 지정 시 RevisionConflictError가 throw된다', async () => {
      const p1 = createTestProject('proj_conflict_throw', 1);
      await store.saveProject(p1);

      await expect(
        store.saveProject(p1, { expectedRevision: 0, throwOnConflict: true })
      ).rejects.toThrow(RevisionConflictError);
    });

    it('동일 revision에서 출발한 두 동시 저장 시도 중 하나만 성공한다 (두 탭 시나리오)', async () => {
      const initial = createTestProject('proj_race', 1);
      await store.saveProject(initial);

      // 탭 A와 탭 B가 모두 revision 1 상태에서 각각 편집하여 동시 저장 시도
      const tabAEdit = { ...initial, metadata: { ...initial.metadata, title: 'Tab A Title' } };
      const tabBEdit = { ...initial, metadata: { ...initial.metadata, title: 'Tab B Title' } };

      const [resA, resB] = await Promise.all([
        store.saveProject(tabAEdit, { expectedRevision: 1 }),
        store.saveProject(tabBEdit, { expectedRevision: 1 }),
      ]);

      const successCount = [resA, resB].filter((r) => r.success).length;
      const conflictCount = [resA, resB].filter((r) => r.conflict).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);

      // 최종 head는 성공한 탭의 revision 2
      const head = await store.getHead('proj_race');
      expect(head?.revision).toBe(2);
    });

    it('늦은 autosave가 최신 revision을 덮어쓸 수 없다', async () => {
      const p = createTestProject('proj_late', 1);
      await store.saveProject(p); // rev 1

      const p2 = { ...p, metadata: { ...p.metadata, title: 'Manual Save Rev 2' } };
      await store.saveProject(p2, { expectedRevision: 1 }); // rev 2

      // 과거 시점(rev 1)의 지연된 autosave가 도착함
      const lateAutosave = { ...p, revision: 1, metadata: { ...p.metadata, title: 'Old Autosave' } };
      const lateResult = await store.saveProject(lateAutosave);

      expect(lateResult.success).toBe(false);
      expect(lateResult.conflict).toBe(true);

      // Head는 2로 유지되고 덮어쓰기 되지 않음
      const current = await store.loadProject('proj_late');
      expect(current?.revision).toBe(2);
      expect(current?.metadata.title).toBe('Manual Save Rev 2');
    });
  });

  describe('3. 오류 시 복구 버퍼 (Recovery Buffer) 및 원자성 보존', () => {
    it('충돌 또는 오류 발생 시 복구 버퍼 저장을 요청하면 recoveryBuffers에 안전히 기록된다', async () => {
      const p1 = createTestProject('proj_recover', 1);
      await store.saveProject(p1);

      const conflictEdit = { ...p1, metadata: { ...p1.metadata, title: 'Unsaved Precious Work' } };
      const result = await store.saveProject(conflictEdit, {
        expectedRevision: 99,
        saveRecoveryOnError: true,
      });

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.recoveryBufferId).toBeDefined();

      const recovered = await store.getRecoveryBuffer(result.recoveryBufferId!);
      expect(recovered).toBeDefined();
      expect((recovered as EditorProject).metadata.title).toBe('Unsaved Precious Work');
    });

    it('독립적인 saveRecoveryBuffer / getRecoveryBuffer API가 정상 작동한다', async () => {
      const rawDraft = { unparsedText: 'draft choreography data', timestamp: 123456 };
      const bufId = await store.saveRecoveryBuffer('proj_draft', rawDraft, 'crash_dump');

      expect(bufId).toBeDefined();
      const loaded = await store.getRecoveryBuffer(bufId);
      expect(loaded).toEqual(rawDraft);

      const records = await store.listRecoveryBuffers('proj_draft');
      expect(records.length).toBe(1);
      expect(records[0].reason).toBe('crash_dump');
    });

    it('용량 부족(QuotaExceeded) 또는 트랜잭션 abort 시 이전 head가 완전 보존되며 성공 오표시가 없다', async () => {
      const p1 = createTestProject('proj_quota', 1);
      await store.saveProject(p1);

      // 스토리지 어댑터에서 인위적 에러 주입
      adapter.simulateNextError(new Error('QuotaExceededError: storage full'));

      const p2 = { ...p1, metadata: { ...p1.metadata, title: 'Failed Save Rev 2' } };
      const failResult = await store.saveProject(p2, { expectedRevision: 1 });

      expect(failResult.success).toBe(false);
      expect(failResult.error).toContain('QuotaExceededError');

      // 이전 정상 head(rev 1)가 조금도 손상되지 않고 유지됨
      const head = await store.getHead('proj_quota');
      expect(head?.revision).toBe(1);

      const loaded = await store.loadProject('proj_quota');
      expect(loaded?.metadata.title).toBe('Fitness Groove Alpha');
    });
  });

  describe('4. 백업 내보내기 API 및 스토리지 네임스페이스 격리', () => {
    it('exportProjectBackup을 통해 전체 스냅샷과 복구 버퍼를 포함한 백업 객체를 추출할 수 있다', async () => {
      const p1 = createTestProject('proj_backup', 1);
      await store.saveProject(p1);

      const p2 = { ...p1, metadata: { ...p1.metadata, title: 'Backup Rev 2' } };
      await store.saveProject(p2, { expectedRevision: 1 });

      await store.saveRecoveryBuffer('proj_backup', { temp: 'buffer' }, 'manual_dump');

      const backup = await store.exportProjectBackup('proj_backup');
      expect(backup).not.toBeNull();
      expect(backup?.project.projectId).toBe('proj_backup');
      expect(backup?.head.revision).toBe(2);
      expect(backup?.snapshots.length).toBe(2);
      expect(backup?.recoveryBuffers.length).toBe(1);
    });

    it('존재하지 않는 프로젝트 조회 시 null을 반환한다', async () => {
      expect(await store.loadProject('non_existent')).toBeNull();
      expect(await store.getHead('non_existent')).toBeNull();
      expect(await store.listSnapshots('non_existent')).toEqual([]);
      expect(await store.exportProjectBackup('non_existent')).toBeNull();
    });

    it('두 개 탭 인스턴스(두 개의 Store 객체가 동일 DB 공유)에서 revision 충돌이 완벽히 방어된다', async () => {
      const tab1Store = new EditorProjectStore(db);
      const tab2Store = new EditorProjectStore(db);

      const base = createTestProject('proj_multi_tab', 1);
      const resInit = await tab1Store.saveProject(base);
      expect(resInit.success).toBe(true);

      // 탭 1과 탭 2가 모두 rev 1을 읽은 상태
      const pTab1 = { ...base, metadata: { ...base.metadata, title: 'Tab 1 Work' } };
      const pTab2 = { ...base, metadata: { ...base.metadata, title: 'Tab 2 Work' } };

      const resTab1 = await tab1Store.saveProject(pTab1, { expectedRevision: 1 });
      expect(resTab1.success).toBe(true);
      expect(resTab1.revision).toBe(2);

      // 탭 2는 여전히 expectedRevision: 1로 저장 시도 -> 반드시 충돌 및 실패
      const resTab2 = await tab2Store.saveProject(pTab2, {
        expectedRevision: 1,
        saveRecoveryOnError: true,
      });
      expect(resTab2.success).toBe(false);
      expect(resTab2.conflict).toBe(true);
      expect(resTab2.recoveryBufferId).toBeDefined();

      // DB Head는 탭 1의 rev 2로 보존
      const finalHead = await tab2Store.getHead('proj_multi_tab');
      expect(finalHead?.revision).toBe(2);
      expect(finalHead?.title).toBe('Tab 1 Work');
    });

    it('publishedPacks와 activationHeads 스토어가 동일 DB 내에서 정상 격리 운영된다', async () => {
      await db.transaction(['publishedPacks', 'activationHeads'], 'readwrite', async (tx) => {
        await tx.put('publishedPacks', 'hash_abc123', {
          contentHash: 'hash_abc123',
          projectId: 'proj_pub',
          rulesetId: 'ruleset_standard_v1',
        });
        await tx.put('activationHeads', 'slot_chapter_1', {
          targetKey: 'slot_chapter_1',
          contentHash: 'hash_abc123',
          activatedAt: '2026-10-05T00:00:00.000Z',
        });
      });

      const pack = await db.transaction(['publishedPacks'], 'readonly', async (tx) => {
        return await tx.get<{ contentHash: string }>('publishedPacks', 'hash_abc123');
      });
      expect(pack?.contentHash).toBe('hash_abc123');

      const act = await db.transaction(['activationHeads'], 'readonly', async (tx) => {
        return await tx.get<{ targetKey: string }>('activationHeads', 'slot_chapter_1');
      });
      expect(act?.targetKey).toBe('slot_chapter_1');
    });
  });
});
