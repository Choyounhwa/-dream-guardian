import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  UIVisualProjectController,
  type TimeScheduler,
} from "../../src/editor/ui/UIVisualProjectController";
import {
  createDefaultUIVisualDocument,
} from "../../src/editor/ui/data/UIVisualDocument";
import {
  setVisualElementProp,
} from "../../src/editor/ui/UIEditorState";
import {
  createInMemoryIDBFactory,
  UIVisualIndexedDB,
} from "../../src/editor/ui/storage/UIVisualIndexedDB";
import {
  UIVisualStore,
} from "../../src/editor/ui/storage/UIVisualStore";

/**
 * 모의 가상 시간 스케줄러 (정밀 제어 가능)
 */
class MockScheduler implements TimeScheduler {
  private currentTime = 1000;
  private timerIdSeq = 0;
  private timers = new Map<number, { due: number; fn: () => void }>();

  now(): number {
    return this.currentTime;
  }

  setTimeout(fn: () => void, ms: number): number {
    const id = ++this.timerIdSeq;
    this.timers.set(id, { due: this.currentTime + ms, fn });
    return id;
  }

  clearTimeout(id: number): void {
    this.timers.delete(id);
  }

  advanceBy(ms: number): void {
    this.currentTime += ms;
    const dueTimers = Array.from(this.timers.entries())
      .filter(([_, t]) => t.due <= this.currentTime)
      .sort((a, b) => a[1].due - b[1].due);

    for (const [id, t] of dueTimers) {
      if (this.timers.has(id)) {
        this.timers.delete(id);
        t.fn();
      }
    }
  }

  hasPending(): boolean {
    return this.timers.size > 0;
  }
}

describe("[#466 UI-VIS-036] 자동저장·복구·프로젝트 교체 상태 모델", () => {
  let factory: IDBFactory;
  let dbHelper: UIVisualIndexedDB;
  let store: UIVisualStore;
  let scheduler: MockScheduler;

  beforeEach(async () => {
    factory = createInMemoryIDBFactory();
    dbHelper = new UIVisualIndexedDB({ factory });
    store = new UIVisualStore(dbHelper);
    await store.open();
    scheduler = new MockScheduler();
  });

  afterEach(() => {
    store.close();
  });

  describe("1. 불변 Visual Session 초기 상태 및 스케줄러 주입 모델", () => {
    it("초기 상태는 saved=true, dirty=false, saving=false, revision=0, generation=0 상태여야 한다", () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-001",
        writerId: "writer-alpha",
        initialDocument: doc,
        scheduler,
      });

      const status = controller.status();
      expect(status.saved).toBe(true);
      expect(status.dirty).toBe(false);
      expect(status.saving).toBe(false);
      expect(status.revision).toBe(0);
      expect(status.generation).toBe(0);
      expect(status.conflict).toBe(false);
      expect(controller.getProjectId()).toBe("proj-vis-001");
      expect(controller.getDocument()).toEqual(doc);
    });

    it("편집 명령 적용 시 revision이 증가하고 dirty=true, saved=false로 전이된다", () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-001",
        writerId: "writer-alpha",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => {
        return setVisualElementProp(prev, "card-story", "name", "스토리 모드 (수정)", "menu_main");
      });

      const status = controller.status();
      expect(status.revision).toBe(1);
      expect(status.dirty).toBe(true);
      expect(status.saved).toBe(false);
      expect(status.label).toBe("dirty");
    });
  });

  describe("2. 명시 저장 Checkpoint와 800ms Debounce Draft 분리", () => {
    it("편집 후 800ms 경과 전에는 draft가 저장되지 않고, 800ms 도달 시 draft가 자동저장된다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-auto",
        writerId: "writer-auto",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => {
        return setVisualElementProp(prev, "card-story", "name", "자동저장 테스트", "menu_main");
      });

      // 799ms 경과: 아직 autosave 호출 전
      scheduler.advanceBy(799);
      let draft = await store.loadDraft("proj-vis-auto", "writer-auto");
      expect(draft).toBeNull();

      // 추가 1ms 경과 (합계 800ms): draft가 저장됨
      scheduler.advanceBy(1);
      // Wait for async task inside scheduled timer
      await new Promise((r) => setTimeout(r, 10));

      draft = await store.loadDraft("proj-vis-auto", "writer-auto");
      expect(draft).not.toBeNull();
      expect(draft?.writerId).toBe("writer-auto");
      expect(draft?.document).toBeDefined();

      // Draft는 임시 보관일 뿐, 명시 체크포인트가 아니므로 status().saved는 여전히 false여야 함
      expect(controller.status().saved).toBe(false);
      expect(controller.status().draftSaved).toBe(true);
    });

    it("연속 편집 시 이전 800ms 타이머가 리셋(debounce)된다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-debounce",
        writerId: "writer-deb",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => ({ ...prev, revision: prev.revision + 1, dirty: true }));
      scheduler.advanceBy(500);

      // 500ms 시점에 다시 편집 -> debounce 타이머 리셋
      controller.edit((prev) => ({ ...prev, revision: prev.revision + 1, dirty: true }));
      scheduler.advanceBy(500); // 이전 기준 1000ms이지만 두 번째 편집 기준 500ms

      let draft = await store.loadDraft("proj-vis-debounce", "writer-deb");
      expect(draft).toBeNull();

      // 추가 300ms 경과 (두 번째 편집 기준 800ms 도달)
      scheduler.advanceBy(300);
      await new Promise((r) => setTimeout(r, 10));

      draft = await store.loadDraft("proj-vis-debounce", "writer-deb");
      expect(draft).not.toBeNull();
    });

    it("flushAutosave 호출 시 800ms를 대기하지 않고 즉시 draft를 저장한다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-flush",
        writerId: "writer-flush",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => ({ ...prev, revision: prev.revision + 1, dirty: true }));
      const flushed = await controller.flushAutosave();

      expect(flushed).toBe(true);
      const draft = await store.loadDraft("proj-vis-flush", "writer-flush");
      expect(draft).not.toBeNull();
    });
  });

  describe("3. 지연 저장 중 재편집 시 saved=false 유지 및 commit 완료 전 성공 금지", () => {
    it("체크포인트 저장이 진행 중(in-flight)일 때는 saved=false 및 saving=true 상태여야 한다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-commit-check",
        writerId: "writer-1",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));

      // save() 호출 시 in-flight 비동기 상태 시작
      const flight = controller.save();
      expect(flight.status).toBe("in-flight");
      expect(flight.actionId).toBeDefined();

      // commit 완료 전: saved 플래그는 절대 true가 될 수 없음
      expect(controller.status().saved).toBe(false);
      expect(controller.status().saving).toBe(true);
      expect(controller.status().label).toBe("saving");

      // 완료 처리
      const result = await controller.completeSave(flight.actionId);
      expect(result.status).toBe("saved");
      expect(controller.status().saved).toBe(true);
      expect(controller.status().saving).toBe(false);
    });

    it("저장 캡처 revision 이후 비동기 지연 도중 재편집이 발생하면 save 완료 후에도 saved=false 및 dirty=true가 유지된다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-interleaved",
        writerId: "writer-inter",
        initialDocument: doc,
        scheduler,
      });

      // Rev 1 편집
      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));

      // Rev 1 저장 시작 (캡처)
      const flight = controller.save();

      // 저장 처리 진행 중에 사용자가 Rev 2 편집을 추가로 단행함!
      controller.edit((prev) => ({
        ...prev,
        revision: 2,
        dirty: true,
        present: {
          ...prev.present,
          description: "새로운 동시 편집 내용",
        },
      }));

      expect(controller.status().revision).toBe(2);
      expect(controller.status().dirty).toBe(true);

      // 이제 지연되었던 Rev 1 저장이 완료됨
      const saveResult = await controller.completeSave(flight.actionId);
      expect(saveResult.status).toBe("saved");
      expect(saveResult.applied).toBe(false); // Rev 1 캡처본은 구버전이므로 최신 상태로 덮어씌워지지 않음

      // 핵심 검증: 재편집이 일어났으므로 절대 saved=true로 전환되면 안 됨!
      const finalStatus = controller.status();
      expect(finalStatus.saved).toBe(false);
      expect(finalStatus.dirty).toBe(true);
      expect(finalStatus.label).toBe("dirty");
    });

    it("이전 세션(stale session)의 지연 응답은 무시(차단)된다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-stale",
        writerId: "writer-stale",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));
      const flight = controller.save();

      // 세션이 교체되거나 리셋됨 (예: discard 또는 프로젝트 교체)
      controller.discard();

      // 이전 세션의 지연 저장이 뒤늦게 도착함
      const result = await controller.completeSave(flight.actionId);
      expect(result.status).toBe("ignored-stale");
      expect(result.applied).toBe(false);
    });
  });

  describe("4. 2탭 CAS Conflict 감지 및 Reconcile (retry / clone / discard)", () => {
    it("다른 탭/작성자에 의해 generation이 변경된 경우 CAS conflict를 감지하고 conflict 상태로 전환된다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-conflict",
        writerId: "writer-tab-1",
        initialDocument: doc,
        scheduler,
      });

      // 탭 2에서 먼저 체크포인트를 저장하여 generation을 1로 증가시킴
      await store.saveCheckpoint({
        projectId: "proj-vis-conflict",
        writerId: "writer-tab-2",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { other: "tab2-data" },
        requestId: "req-tab-2",
      });

      // 탭 1 컨트롤러가 expectedGeneration 0으로 저장을 시도함
      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));
      const saveResult = await controller.saveCheckpoint();

      expect(saveResult.status).toBe("conflict");
      const status = controller.status();
      expect(status.conflict).toBe(true);
      expect(status.saved).toBe(false);
      expect(status.label).toBe("conflict");
      expect(controller.getConflictDetails()?.currentGeneration).toBe(1);
      expect(controller.getConflictDetails()?.expectedGeneration).toBe(0);
    });

    it("충돌 후 reconcile('retry') 선택 시 최신 generation을 조회하여 재시도 성공한다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-retry",
        writerId: "writer-tab-1",
        initialDocument: doc,
        scheduler,
      });

      // 타 탭에 의해 generation 1로 변경
      await store.saveCheckpoint({
        projectId: "proj-vis-retry",
        writerId: "writer-tab-2",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { text: "from tab 2" },
        requestId: "req-t2",
      });

      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));
      await controller.saveCheckpoint();
      expect(controller.status().conflict).toBe(true);

      // Reconcile: retry
      const reconcileResult = await controller.reconcileConflict("retry");
      expect(reconcileResult.success).toBe(true);
      expect(controller.status().conflict).toBe(false);
      expect(controller.status().saved).toBe(true);
      expect(controller.getGeneration()).toBe(2);
    });

    it("충돌 후 reconcile('clone') 선택 시 새로운 프로젝트 ID로 분기하여 안전하게 저장한다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-fork-src",
        writerId: "writer-tab-1",
        initialDocument: doc,
        scheduler,
      });

      await store.saveCheckpoint({
        projectId: "proj-vis-fork-src",
        writerId: "writer-tab-2",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: { data: "tab2" },
        requestId: "req-t2-fork",
      });

      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));
      await controller.saveCheckpoint();

      const cloneRes = await controller.reconcileConflict("clone", "proj-vis-forked-branch");
      expect(cloneRes.success).toBe(true);
      expect(controller.getProjectId()).toBe("proj-vis-forked-branch");
      expect(controller.status().conflict).toBe(false);
      expect(controller.status().saved).toBe(true);

      // 새 프로젝트의 head가 generation 1로 저장되었는지 확인
      const head = await store.getProjectHead("proj-vis-forked-branch");
      expect(head?.generation).toBe(1);
    });
  });

  describe("5. Dispose 시 flush 실패 정직 보고 및 미저장 보고", () => {
    it("미저장 상태에서 dispose() 호출 시 flush 실패 또는 미저장 상태를 정직하게 반환한다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-dispose",
        writerId: "writer-disp",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));

      // flush=false로 종료
      const disposeReport = await controller.dispose({ flush: false });
      expect(disposeReport.flushed).toBe(false);
      expect(disposeReport.dirty).toBe(true);
      expect(controller.isDisposed()).toBe(true);

      // dispose 후에는 추가 편집이나 저장이 거부됨
      expect(() => {
        controller.edit((prev) => prev);
      }).toThrow(/disposed/i);
    });

    it("flush=true로 dispose 시 저장소 오류가 발생하면 실패를 정직하게 보고한다", async () => {
      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-dispose-fail",
        writerId: "writer-dfail",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));

      // store의 saveDraft를 강제로 에러 발생시키도록 목킹
      vi.spyOn(store, "saveDraft").mockRejectedValueOnce(new Error("IDB transaction aborted"));

      const disposeReport = await controller.dispose({ flush: true });
      expect(disposeReport.flushed).toBe(false);
      expect(disposeReport.dirty).toBe(true);
      expect(disposeReport.error).toMatch(/aborted/);
    });
  });

  describe("6. Migration 실패 시 원본 Byte 동일 보존, 자산 누락 교체 거부, 복구 Undo 정책", () => {
    it("마이그레이션 실패 시 원본 raw 문자열/바이트가 온전히 보존되고 현재 문서는 변경되지 않는다", async () => {
      const originalDoc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-mig-fail",
        writerId: "writer-mig",
        initialDocument: originalDoc,
        scheduler,
      });

      // 손상된 레거시 JSON 문자열 (미지원/파손 형식)
      const corruptedRaw = JSON.stringify({
        kind: "dream-guardian-ui-project",
        schemaVersion: "999.0.0", // 지원하지 않는 미래 버전
        design: { invalid: true },
      });

      const swapResult = await controller.openProject(corruptedRaw);
      expect(swapResult.ok).toBe(false);
      if (!swapResult.ok) {
        expect(swapResult.originalRaw).toBe(corruptedRaw);
        expect(swapResult.reason).toBeDefined();
      }

      // 현재 문서 및 세션은 100% 보존됨
      expect(controller.getDocument()).toEqual(originalDoc);
      expect(controller.status().revision).toBe(0);
      expect(controller.status().dirty).toBe(false);
    });

    it("교체 대상 문서에 필수/승인되지 않은 자산이 누락된 경우 교체를 원자적으로 거부한다", async () => {
      const originalDoc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-asset-missing",
        writerId: "writer-asset",
        initialDocument: originalDoc,
        scheduler,
      });

      // 누락된 비승인 자산을 참조하는 후보 문서
      const candidateWithMissingAsset = createDefaultUIVisualDocument();
      candidateWithMissingAsset.pages.menu_main.elements.push({
        id: "btn-unapproved-icon",
        name: "Missing Icon",
        type: "image",
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        assetId: "non-existent-unapproved-asset-999",
      });

      const openResult = await controller.openProject(candidateWithMissingAsset);
      expect(openResult.ok).toBe(false);
      if (!openResult.ok) {
        expect(openResult.reason).toMatch(/asset/i);
        expect(openResult.missingAssets).toContain("non-existent-unapproved-asset-999");
      }

      // 현재 문서는 전혀 훼손되지 않음
      expect(controller.getDocument()).toEqual(originalDoc);
    });

    it("정상 프로젝트 교체 시 history 경계가 리셋되고 세션 ID가 갱신된다", async () => {
      const originalDoc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-vis-swap-ok",
        writerId: "writer-swap",
        initialDocument: originalDoc,
        scheduler,
      });

      const oldSessionId = controller.getSessionId();

      // 편집하여 undo 스택 축적
      controller.edit((prev) => {
        return setVisualElementProp(prev, "card-story", "name", "수정된 카드명", "menu_main");
      });
      expect(controller.getSession().undo.length).toBeGreaterThan(0);

      // 새 문서로 원자 교체
      const newValidDoc = createDefaultUIVisualDocument();
      newValidDoc.pages.menu_main.name = "새 프로젝트 메인 메뉴";

      const swapResult = await controller.openProject(newValidDoc, { projectId: "proj-vis-new-target" });
      expect(swapResult.ok).toBe(true);
      expect(controller.getProjectId()).toBe("proj-vis-new-target");
      expect(controller.getDocument().pages.menu_main.name).toBe("새 프로젝트 메인 메뉴");

      // History 경계 리셋: undo/redo 스택 0개
      const newSession = controller.getSession();
      expect(newSession.undo).toHaveLength(0);
      expect(newSession.redo).toHaveLength(0);
      expect(newSession.historyCount).toBe(0);

      // 세션 ID가 갱신되어 이전 세션의 지연 작업이 차단됨
      expect(controller.getSessionId()).not.toBe(oldSessionId);
      expect(controller.status().dirty).toBe(false);
      expect(controller.status().saved).toBe(true);
    });

    it("Crash 복구 시 Undo 정책: 복구된 시점이 새로운 기준점이 되며 pre-crash로는 Undo가 차단된다", async () => {
      const baseDoc = createDefaultUIVisualDocument();
      // 사전에 writer의 draft를 저장소에 저장 (crash 상황 모사)
      const crashedDoc = createDefaultUIVisualDocument();
      crashedDoc.pages.menu_main.name = "비정상 종료 직전 자동저장된 복구 문서";

      await store.saveDraft({
        projectId: "proj-crash-rec",
        writerId: "writer-rec",
        expectedGeneration: 0,
        document: crashedDoc as unknown as Record<string, unknown>,
      });

      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-crash-rec",
        writerId: "writer-rec",
        initialDocument: baseDoc,
        scheduler,
      });

      const recResult = await controller.recoverFromDraft();
      expect(recResult.recovered).toBe(true);
      expect(controller.getDocument().pages.menu_main.name).toBe("비정상 종료 직전 자동저장된 복구 문서");

      // 복구 Undo 정책 검증: 복구된 문서가 새 baseline이 되며 undo 스택은 비어있어야 함
      const session = controller.getSession();
      expect(session.undo).toHaveLength(0);
      expect(session.redo).toHaveLength(0);
    });
  });

  describe("7. Gameplay Storage 완벽 격리 검증", () => {
    it("어떠한 저장·복구·교체 동작도 gameplay 저장소(localStorage/게임 DB)에 접근하지 않는다", async () => {
      const originalLocalStorage = globalThis.localStorage;
      const accessedKeys: string[] = [];

      // Mock localStorage tracking
      const mockStorage = {
        getItem: vi.fn((key: string) => {
          accessedKeys.push(key);
          return null;
        }),
        setItem: vi.fn((key: string) => {
          accessedKeys.push(key);
        }),
        removeItem: vi.fn((key: string) => {
          accessedKeys.push(key);
        }),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      };

      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        configurable: true,
        writable: true,
      });

      const doc = createDefaultUIVisualDocument();
      const controller = new UIVisualProjectController({
        store,
        projectId: "proj-isolation-check",
        writerId: "writer-iso",
        initialDocument: doc,
        scheduler,
      });

      controller.edit((prev) => ({ ...prev, revision: 1, dirty: true }));
      await controller.saveCheckpoint();
      await controller.flushAutosave();
      await controller.openProject(createDefaultUIVisualDocument());
      await controller.dispose({ flush: false });

      // gameplay 저장소 키(dg_*, player, score 등)에 대한 호출이 0건이어야 함
      const gameplayKeys = accessedKeys.filter(
        (k) => k.startsWith("dg_") || k.includes("player") || k.includes("score") || k.includes("save")
      );
      expect(gameplayKeys).toHaveLength(0);

      // 복구
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
    });
  });
});
