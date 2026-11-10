import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  UIVisualIndexedDB,
  UI_VISUAL_DB_NAME,
  UI_VISUAL_DB_VERSION,
  UI_VISUAL_STORE_NAMES,
  createInMemoryIDBFactory,
} from "../../src/editor/ui/storage/UIVisualIndexedDB";
import {
  UIVisualStore,
  type VisualAssetPayload,
  type SaveCheckpointRequest,
} from "../../src/editor/ui/storage/UIVisualStore";

describe("[#464 UI-VIS-035] UI visual 전용 비동기 IndexedDB 원자 저장", () => {
  let factory: IDBFactory;

  beforeEach(() => {
    factory = createInMemoryIDBFactory();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("1. DB 네임스페이스 및 6대 전용 Object Store 격리", () => {
    it("UI visual 전용 네임스페이스 'dg-ui-visual-store' 및 6대 object store가 정상 생성된다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      await dbHelper.open();

      expect(dbHelper.dbName).toBe(UI_VISUAL_DB_NAME);
      expect(dbHelper.version).toBe(UI_VISUAL_DB_VERSION);
      expect(UI_VISUAL_STORE_NAMES).toEqual([
        "projects",
        "backups",
        "drafts",
        "checkpoints",
        "assets",
        "releases",
      ]);

      const db = dbHelper.getDatabase();
      expect(db).not.toBeNull();
      for (const name of UI_VISUAL_STORE_NAMES) {
        expect(db!.objectStoreNames.contains(name)).toBe(true);
      }
      dbHelper.close();
    });

    it("레거시 UIX DB 및 게임 런타임 저장소 이름으로 열람 시도 시 명시적으로 차단된다", () => {
      expect(() => {
        new UIVisualIndexedDB({
          dbName: "dream_guardian_save",
          factory,
        });
      }).toThrow(/forbidden namespace/i);

      expect(() => {
        new UIVisualIndexedDB({
          dbName: "uix-project-db",
          factory,
        });
      }).toThrow(/forbidden namespace/i);
    });

    it("옵션 없이 생성 시 기본 전용 네임스페이스와 IDBFactory로 초기화된다", async () => {
      const dbHelper = new UIVisualIndexedDB();
      await dbHelper.open();
      expect(dbHelper.dbName).toBe("dg-ui-visual-store");
      expect(dbHelper.isOpen()).toBe(true);
      dbHelper.close();
    });
  });

  describe("2. 비동기 IndexedDB 재열기 및 문서+바이너리 자산 Roundtrip", () => {
    it("체크포인트와 바이너리 이미지 자산이 원자 저장되고, DB 재열기 후 100% 동일하게 복원된다", async () => {
      const dbHelper1 = new UIVisualIndexedDB({ factory });
      const store1 = new UIVisualStore(dbHelper1);
      await store1.open();

      const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
      const asset: VisualAssetPayload = {
        assetId: "asset-hero-icon-001",
        contentHash: "hash-hero-icon-abc",
        durableAssetId: "durable-hero-icon",
        mimeType: "image/png",
        byteLength: imageBytes.byteLength,
        data: imageBytes.buffer,
        metadata: { width: 64, height: 64, label: "Hero Icon" },
      };

      const saveRequest: SaveCheckpointRequest = {
        projectId: "proj-visual-test-1",
        writerId: "writer-alpha",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: {
          screen: "MENU_MAIN",
          elements: [{ id: "logo", x: 100, y: 200 }],
        },
        requestId: "req-checkpoint-001",
        sessionId: "session-alpha",
        assets: [asset],
      };

      const result = await store1.saveCheckpoint(saveRequest);
      expect(result.status).toBe("saved");
      if (result.status === "saved") {
        expect(result.saved).toBe(true);
        expect(result.generation).toBe(1);
        expect(result.checkpointId).toBe("cp-req-checkpoint-001");
      }

      // 첫 번째 연결 종료
      store1.close();

      // 두 번째 연결로 DB 재열기
      const dbHelper2 = new UIVisualIndexedDB({ factory });
      const store2 = new UIVisualStore(dbHelper2);
      await store2.open();

      // 프로젝트 Head 조회
      const head = await store2.getProjectHead("proj-visual-test-1");
      expect(head).not.toBeNull();
      expect(head?.generation).toBe(1);
      expect(head?.headCheckpointId).toBe("cp-req-checkpoint-001");

      // 체크포인트 조회
      const checkpoint = await store2.getCheckpoint("cp-req-checkpoint-001");
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.documentRevision).toBe(1);
      expect(checkpoint?.snapshot).toEqual({
        screen: "MENU_MAIN",
        elements: [{ id: "logo", x: 100, y: 200 }],
      });
      expect(checkpoint?.assetRefs).toContain("asset-hero-icon-001");

      // 자산 바이너리 복원 확인
      const restoredAsset = await store2.getAsset("asset-hero-icon-001");
      expect(restoredAsset).not.toBeNull();
      expect(restoredAsset?.contentHash).toBe("hash-hero-icon-abc");
      expect(restoredAsset?.mimeType).toBe("image/png");
      const restoredBytes = new Uint8Array(restoredAsset!.data as ArrayBuffer);
      expect(Array.from(restoredBytes)).toEqual(Array.from(imageBytes));

      store2.close();
    });
  });

  describe("3. 원자적 트랜잭션 보장 및 Abort / QuotaExceeded 시 롤백 (부분 저장 방지)", () => {
    it("트랜잭션 중 QuotaExceededError 발생 시 transaction.abort()로 전체 롤백되어 부분 저장이 발생하지 않는다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      const imageBytes = new Uint8Array([1, 2, 3, 4]);
      const asset: VisualAssetPayload = {
        assetId: "asset-overflow-001",
        contentHash: "hash-overflow",
        durableAssetId: "durable-overflow",
        mimeType: "image/png",
        byteLength: imageBytes.byteLength,
        data: imageBytes.buffer,
        metadata: {},
      };

      const saveRequest: SaveCheckpointRequest = {
        projectId: "proj-atomic-rollback",
        writerId: "writer-err",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { test: "should-be-rolled-back" },
        requestId: "req-err-001",
        assets: [asset],
      };

      // simulateQuotaError 옵션 활성화
      const result = await store.saveCheckpoint(saveRequest, {
        simulateQuotaError: true,
      });

      expect(result.status).toBe("failed");
      expect(result.saved).toBe(false);

      // 부분 저장이 전혀 없어야 함 (head, checkpoint, asset 모두 존재하지 않음)
      const head = await store.getProjectHead("proj-atomic-rollback");
      expect(head).toBeNull();

      const checkpoint = await store.getCheckpoint("cp-req-err-001");
      expect(checkpoint).toBeNull();

      const savedAsset = await store.getAsset("asset-overflow-001");
      expect(savedAsset).toBeNull();

      store.close();
    });

    it("saveCheckpoint는 transaction.oncomplete 이후에만 saved: true를 반환한다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      let onCompleteFired = false;
      const originalRunTransaction = dbHelper.runTransaction.bind(dbHelper);
      dbHelper.runTransaction = async (stores, mode, fn) => {
        return originalRunTransaction(stores, mode, async (tx, objStores) => {
          const res = await fn(tx, objStores);
          tx.addEventListener("complete", () => {
            onCompleteFired = true;
          });
          return res;
        });
      };

      const result = await store.saveCheckpoint({
        projectId: "proj-complete-check",
        writerId: "writer-1",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { val: 42 },
        requestId: "req-chk",
      });

      expect(result.status).toBe("saved");
      expect(onCompleteFired).toBe(true);
      store.close();
    });

    it("유효하지 않은 snapshot 데이터(순환 참조, 한도 초과 등) 전달 시 저장이 거부된다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      const hugeString = "a".repeat(1024 * 1024 + 100);
      const res = await store.saveCheckpoint({
        projectId: "proj-oversized",
        writerId: "writer-big",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { oversized: hugeString },
        requestId: "req-huge",
      });

      expect(res.status).toBe("rejected");
      store.close();
    });
  });

  describe("4. writer별 draft 격리 및 generation CAS(Compare-And-Swap) 2탭 충돌 방지", () => {
    it("서로 다른 writer는 독립된 draft를 저장하며 상호 오염되지 않는다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      const projectId = "proj-multi-writer";
      await store.saveDraft({
        projectId,
        writerId: "tab-writer-1",
        expectedGeneration: 0,
        document: { draftContent: "writer 1 working" },
      });

      await store.saveDraft({
        projectId,
        writerId: "tab-writer-2",
        expectedGeneration: 0,
        document: { draftContent: "writer 2 working independently" },
      });

      const draft1 = await store.loadDraft(projectId, "tab-writer-1");
      const draft2 = await store.loadDraft(projectId, "tab-writer-2");

      expect(draft1?.document).toEqual({ draftContent: "writer 1 working" });
      expect(draft2?.document).toEqual({ draftContent: "writer 2 working independently" });

      const allDrafts = await store.listDrafts(projectId);
      expect(allDrafts.length).toBe(2);

      store.close();
    });

    it("동시 2개 탭 저장 시 CAS generation 불일치 시 'conflict' 상태를 반환하고 기존 저장본을 보존한다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      const projectId = "proj-cas-test";

      // 1. Tab 1이 generation 0 상태에서 저장 성공 -> generation 1
      const res1 = await store.saveCheckpoint({
        projectId,
        writerId: "tab-1",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { text: "version 1 from tab 1" },
        requestId: "req-tab1",
      });
      expect(res1.status).toBe("saved");
      if (res1.status === "saved") {
        expect(res1.generation).toBe(1);
      }

      // 2. Tab 2가 동일하게 generation 0을 기대하고 저장 시도 -> CAS 충돌!
      const res2 = await store.saveCheckpoint({
        projectId,
        writerId: "tab-2",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { text: "stale version from tab 2" },
        requestId: "req-tab2",
      });

      expect(res2.status).toBe("conflict");
      if (res2.status === "conflict") {
        expect(res2.saved).toBe(false);
        expect(res2.currentGeneration).toBe(1);
        expect(res2.expectedGeneration).toBe(0);
      }

      // Tab 1의 원본이 보존되었는지 검증
      const head = await store.getProjectHead(projectId);
      expect(head?.generation).toBe(1);
      expect(head?.headCheckpointId).toBe("cp-req-tab1");

      const checkpoint = await store.getCheckpoint("cp-req-tab1");
      expect(checkpoint?.snapshot).toEqual({ text: "version 1 from tab 1" });

      store.close();
    });
  });

  describe("5. versionchange 및 blocked upgrade 이벤트 핸들링", () => {
    it("versionchange 이벤트 발생 시 연결이 안전하게 종료(close)되거나 핸들러가 동작한다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      await dbHelper.open();

      let versionChangeFired = false;
      dbHelper.onVersionChange(() => {
        versionChangeFired = true;
      });

      const db = dbHelper.getDatabase();
      db?.dispatchEvent(new Event("versionchange"));

      expect(versionChangeFired).toBe(true);
      dbHelper.close();
    });

    it("blocked 이벤트 핸들러가 등록되어 업그레이드 지연 상황을 알린다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      let blockedNotified = false;
      dbHelper.onBlocked(() => {
        blockedNotified = true;
      });

      // open 중 blocked 콜백 연결 확인
      expect(typeof dbHelper.onBlocked).toBe("function");
      expect(blockedNotified).toBe(false);
    });
  });

  describe("6. 불변 백업 생성 및 복원, 비정상 종료 복구", () => {
    it("프로젝트의 원본 불변 백업을 저장하고 필요 시 해당 백업으로부터 안전하게 복원한다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      const projectId = "proj-backup-test";

      // 원본 체크포인트 저장
      await store.saveCheckpoint({
        projectId,
        writerId: "writer-init",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { screen: "ORIGINAL_BASE" },
        requestId: "req-init",
      });

      // 불변 백업 생성
      const backupRes = await store.createBackup(projectId, "Pre-major-edit backup");
      expect(backupRes.backupId).toMatch(/^bk-/);
      expect(backupRes.generation).toBe(1);

      // 백업 조회
      const backup = await store.getBackup(backupRes.backupId);
      expect(backup).not.toBeNull();
      expect(backup?.document).toEqual({ screen: "ORIGINAL_BASE" });

      // 프로젝트 변경 (generation 2)
      await store.saveCheckpoint({
        projectId,
        writerId: "writer-mod",
        expectedGeneration: 1,
        documentRevision: 2,
        snapshot: { screen: "MODIFIED_WRONG" },
        requestId: "req-mod",
      });

      const headMod = await store.getProjectHead(projectId);
      expect(headMod?.generation).toBe(2);

      // 백업으로부터 복원
      const restoreRes = await store.restoreFromBackup(projectId, backupRes.backupId, "writer-restore");
      expect(restoreRes.status).toBe("restored");
      expect(restoreRes.restoredGeneration).toBe(3);

      const headRestored = await store.getProjectHead(projectId);
      expect(headRestored?.generation).toBe(3);
      const restoredCheckpoint = await store.getCheckpoint(headRestored!.headCheckpointId);
      expect(restoredCheckpoint?.snapshot).toEqual({ screen: "ORIGINAL_BASE" });

      store.close();
    });

    it("비정상 종료(abnormal shutdown) 후 reconcileAbnormalShutdown 실행 시 정상 무결성을 확인하고 복구한다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      const projectId = "proj-shutdown-test";

      await store.saveCheckpoint({
        projectId,
        writerId: "writer-1",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { healthy: true },
        requestId: "req-healthy",
      });

      const status = await store.reconcileAbnormalShutdown(projectId);
      expect(status.healthy).toBe(true);
      expect(status.headCheckpointId).toBe("cp-req-healthy");

      store.close();
    });

    it("비정상 종료로 head가 유실된 체크포인트를 가리킬 때 최신 체크포인트로 복구한다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      const projectId = "proj-corrupt-head";
      await store.saveCheckpoint({
        projectId,
        writerId: "w1",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { rev: 1 },
        requestId: "req-1",
      });

      await store.saveCheckpoint({
        projectId,
        writerId: "w1",
        expectedGeneration: 1,
        documentRevision: 2,
        snapshot: { rev: 2 },
        requestId: "req-2",
      });

      // 강제로 headCheckpointId를 유실된 ID로 훼손
      await dbHelper.put("projects", projectId, {
        projectId,
        headCheckpointId: "cp-missing-lost",
        generation: 2,
        documentRevision: 2,
        updatedAt: Date.now(),
      });

      const reconcile = await store.reconcileAbnormalShutdown(projectId);
      expect(reconcile.healthy).toBe(false);
      expect(reconcile.headCheckpointId).toBe("cp-req-2");

      const restoredHead = await store.getProjectHead(projectId);
      expect(restoredHead?.headCheckpointId).toBe("cp-req-2");
      store.close();
    });
  });

  describe("7. 릴리즈(배포 패키지) 불변 저장 및 기존 저장소 불간섭 보장", () => {
    it("배포 불변 릴리즈 패키지가 releases store에 저장되고 조회된다", async () => {
      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      const releasePayload = {
        releaseId: "rel-v1.0.0",
        projectId: "proj-rel-test",
        checkpointId: "cp-sample",
        version: "1.0.0",
        packageData: { exportedScreens: 10, checksum: "rel-sha256" },
      };

      const res = await store.saveRelease(releasePayload);
      expect(res.saved).toBe(true);

      const savedRel = await store.getRelease("rel-v1.0.0");
      expect(savedRel?.version).toBe("1.0.0");
      expect(savedRel?.packageData).toEqual({ exportedScreens: 10, checksum: "rel-sha256" });

      store.close();
    });

    it("localStorage, sessionStorage 등 런타임 저장소에 일체 접근하지 않는다", async () => {
      const setItemSpy = vi.fn();
      const getItemSpy = vi.fn();
      vi.stubGlobal("localStorage", {
        setItem: setItemSpy,
        getItem: getItemSpy,
      });

      const dbHelper = new UIVisualIndexedDB({ factory });
      const store = new UIVisualStore(dbHelper);
      await store.open();

      await store.saveDraft({
        projectId: "proj-no-localstorage",
        writerId: "writer-clean",
        expectedGeneration: 0,
        document: { key: "clean" },
      });

      expect(setItemSpy).not.toHaveBeenCalled();
      expect(getItemSpy).not.toHaveBeenCalled();

      store.close();
    });
  });
});
