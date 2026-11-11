import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyEditorChangeScope } from "../uix-017-change-scope";
import {
  HASHES_ARE_NOT_SIGNATURES,
  KINDS,
  LIMITS,
  SCHEMA_VERSION,
  SCOPED_SNAPSHOT_SEMANTICS,
  SOURCE_COMPARISON_NOT_PERFORMED,
} from "../../src/editor/ui/data/UIContracts";
import {
  artifactHash,
  contentHash,
  rejectDuplicateKeys,
  sourceCheckpointHash,
} from "../../src/editor/ui/data/UICanonicalJSON";
import {
  APPROVED_IMAGE_HASH,
  BASELINE_REGISTRY,
  RENDERER_FINGERPRINT,
  clonePresetForEdit,
} from "../../src/editor/ui/data/UIBaselines";
import {
  GAME_APPLY_VERIFIED as BUILDER_GAME_APPLY_VERIFIED,
  buildTransfer,
} from "../../src/editor/ui/data/UITransferBuilder";
import {
  OUT_OF_SCOPE_MEANS_RESTORE,
} from "../../src/editor/ui/data/UIValidator";
import {
  GAME_APPLY_VERIFIED as INSPECTOR_GAME_APPLY_VERIFIED,
  inspectTransfer,
} from "../../src/editor/ui/io/UITransferInspector";
import {
  backupDocument,
  openProjectFile,
} from "../../src/editor/ui/io/UIProjectIO";
import {
  GAME_APPLY_VERIFIED as STATE_GAME_APPLY_VERIFIED,
  STORAGE_TOUCHED as STATE_STORAGE_TOUCHED,
  beginDrag,
  cancelDrag,
  commitDrag,
  createSession,
  redo,
  undo,
  type MenuDoc,
} from "../../src/editor/ui/UIEditorState";
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
} from "../../src/editor/ui/UIInteraction";
import {
  STORE_NAMES,
  UIProjectDatabase,
  type DatabasePort,
  type PortStoreName,
  type PortTransaction,
  type TransactionOutcome,
} from "../../src/editor/ui/storage/UIProjectDatabase";
import {
  UIProjectStore,
  type SaveCheckpointRequest,
} from "../../src/editor/ui/storage/UIProjectStore";

const rootDir = resolve(__dirname, "../..");
const workspaceRoot = resolve(rootDir, "..");

type Row = Record<string, unknown>;

class MockDatabasePort implements DatabasePort {
  readonly name = "dream-guardian-ui-editor";
  readonly stores = [...STORE_NAMES];
  private readonly tables = new Map<PortStoreName, Map<string, Row>>();
  nextOutcome: "commit" | "abort" | "quota" = "commit";

  constructor() {
    for (const store of STORE_NAMES) {
      this.tables.set(store, new Map());
    }
  }

  open(): void {
    const forbidden = ["activation", "gameSession", "deploy", "save", "accessibility", "choreography"];
    for (const name of forbidden) {
      if ((this.stores as readonly string[]).includes(name)) {
        throw new Error(`forbidden store: ${name}`);
      }
    }
  }

  transaction(): PortTransaction {
    return new MockTransaction(this, this.nextOutcome);
  }

  finish(tx: PortTransaction): TransactionOutcome {
    return (tx as unknown as MockTransaction).finish();
  }

  read<T>(store: PortStoreName, key: string): T | null {
    const row = this.tables.get(store)?.get(key);
    return row ? (structuredClone(row) as T) : null;
  }

  apply(store: PortStoreName, key: string, value: Row | null): void {
    const table = this.tables.get(store);
    if (!table) throw new Error("missing store");
    if (value === null) table.delete(key);
    else table.set(key, structuredClone(value));
  }

  values(store: PortStoreName): Row[] {
    const table = this.tables.get(store);
    return table ? Array.from(table.values()).map((v) => structuredClone(v)) : [];
  }
}

class MockTransaction implements PortTransaction {
  private writes: Array<{ store: PortStoreName; key: string; value: Row | null }> = [];
  aborted = false;

  constructor(
    private readonly port: MockDatabasePort,
    private readonly outcome: "commit" | "abort" | "quota" = "commit",
  ) {}

  get<T>(store: PortStoreName, key: string): T | null {
    for (let i = this.writes.length - 1; i >= 0; i--) {
      if (this.writes[i].store === store && this.writes[i].key === key) {
        const val = this.writes[i].value;
        return val ? (structuredClone(val) as T) : null;
      }
    }
    return this.port.read<T>(store, key);
  }

  put(store: PortStoreName, key: string, value: Record<string, unknown>): void {
    this.writes.push({ store, key, value });
  }

  delete(store: PortStoreName, key: string): void {
    this.writes.push({ store, key, value: null });
  }

  abort(): void {
    this.aborted = true;
  }

  finish(): "committed" | "aborted" | "unknown" {
    if (this.outcome === "quota") {
      this.aborted = true;
      throw new Error("QuotaExceededError: mock quota exceeded");
    }
    if (this.outcome === "abort") {
      this.aborted = true;
      return "aborted";
    }
    for (const write of this.writes) {
      this.port.apply(write.store, write.key, write.value);
    }
    return "committed";
  }
}

function createCheckpointFixture(cardX = 90) {
  const preset = clonePresetForEdit(BASELINE_REGISTRY.id);
  preset.cards[0].x = cardX;
  return {
    kind: KINDS.project,
    schemaVersion: SCHEMA_VERSION,
    design: { width: preset.design.width, height: preset.design.height },
    menu: {
      cards: preset.cards.map((card) => ({ id: card.id, x: card.x, y: card.y })),
      width: preset.width,
      height: preset.height,
      workoutButton: { ...preset.workoutButton },
    },
    baseline: {
      id: BASELINE_REGISTRY.id,
      version: BASELINE_REGISTRY.version,
      presetHash: BASELINE_REGISTRY.presetHash,
      approvedImageHash: APPROVED_IMAGE_HASH,
      rendererFingerprint: RENDERER_FINGERPRINT,
    },
  };
}

describe("UIX-017 MVP 종단 인수·게임 비변경 검증", () => {
  describe("1. 실제 편집 → Undo/Redo/취소 전 흐름 완주", () => {
    it("기본 프리셋(1080×2160)에서 메뉴 카드 이동, dirty 감지, Undo 및 Redo가 일관되게 동작해야 한다", () => {
      const preset = clonePresetForEdit(BASELINE_REGISTRY.id);
      expect(preset.design.width).toBe(DESIGN_WIDTH);
      expect(preset.design.height).toBe(DESIGN_HEIGHT);
      expect(preset.cards.length).toBe(5);

      const baselineMenu: MenuDoc = {
        cards: preset.cards.map((c) => ({ id: c.id, x: c.x, y: c.y })),
        width: preset.width,
        height: preset.height,
      };

      // 세션 초기화
      let session = createSession("session-uix-017", baselineMenu);
      expect(session.dirty).toBe(false);
      expect(session.revision).toBe(0);
      expect(session.undo.length).toBe(0);

      // 카드 0을 x: 90 -> x: 150 드래그 시작 및 커밋
      session = beginDrag(session, session.present.cards[0].id, { x: 150, y: session.present.cards[0].y });
      expect(session.draft).not.toBeNull();
      session = commitDrag(session);

      expect(session.present.cards[0].x).toBe(150);
      expect(session.dirty).toBe(true);
      expect(session.revision).toBe(1);
      expect(session.undo.length).toBe(1);

      // Undo 수행: baseline 상태로 복원되고 dirty는 false가 되어야 함
      session = undo(session);
      expect(session.present.cards[0].x).toBe(preset.cards[0].x);
      expect(session.dirty).toBe(false);
      expect(session.redo.length).toBe(1);

      // Redo 수행: 다시 x: 150으로 반영되고 dirty는 true가 되어야 함
      session = redo(session);
      expect(session.present.cards[0].x).toBe(150);
      expect(session.dirty).toBe(true);

      // 드래그 취소(cancelDrag): draft는 null로 초기화되고 present는 그대로 유지
      session = beginDrag(session, session.present.cards[0].id, { x: 999, y: 999 });
      expect(session.draft).not.toBeNull();
      session = cancelDrag(session);
      expect(session.draft).toBeNull();
      expect(session.present.cards[0].x).toBe(150);
    });
  });

  describe("2. 초안 저장 → Checkpoint 명시적 저장 → 비정상 중단 후 초안 복구", () => {
    it("초안 자동저장 및 명시적 체크포인트 커밋이 올바른 세대(Generation)로 관리되어야 한다", () => {
      const port = new MockDatabasePort();
      port.open();
      const db = new UIProjectDatabase(port);
      const store = new UIProjectStore(db);

      const checkpointDoc = createCheckpointFixture(130);

      // Draft 저장
      store.saveDraft({
        projectId: "project-017",
        writerId: "writer-tab-1",
        expectedGeneration: 0,
        document: checkpointDoc,
      });

      // Draft 복구: generation이 일치하므로 ok 반환
      const recovered = store.recoverDraft({
        projectId: "project-017",
        writerId: "writer-tab-1",
        currentGeneration: 0,
      });
      expect(recovered.status).toBe("ok");
      expect(recovered.rewrittenExpectedGeneration).toBe(false);

      // 명시적 Checkpoint 저장
      const saveReq: SaveCheckpointRequest = {
        projectId: "project-017",
        writerId: "writer-tab-1",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: checkpointDoc,
        requestId: "req-chk-1",
        sessionId: "sess-chk-1",
      };
      const result = store.saveCheckpoint(saveReq);
      expect(result.status).toBe("saved");
      if (result.status === "saved") {
        expect(result.checkpointId).toBeDefined();
      }

      // Checkpoint 저장 후 프로젝트의 head generation은 1로 전진함
      const head = port.read<{ generation: number }>("projects", "project-017");
      expect(head?.generation).toBe(1);
    });
  });

  describe("3. 2중 백업 생성 및 프로젝트 파일 열기(Open / Migration)", () => {
    it("backupDocument는 유효 문서와 베이스라인을 안전하게 내보내고 입력 버퍼 오염을 배제해야 한다", () => {
      const lastValid = createCheckpointFixture(140);
      const baseline = createCheckpointFixture(90);

      const backup = backupDocument({
        lastValid,
        baseline,
        saveAvailable: true,
        inputBuffers: { card0X: "invalid-buffer-text" },
      });

      expect(backup.ok).toBe(true);
      expect(backup.files.length).toBe(2);
      expect(backup.files.map((f) => f.role)).toContain("last-valid");
      expect(backup.files.map((f) => f.role)).toContain("baseline");

      // 생성된 JSON이 온전한지 검증
      for (const file of backup.files) {
        const parsed = JSON.parse(file.text);
        expect(parsed.kind).toBe(KINDS.project);
        expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
      }
    });

    it("openProjectFile은 사용자 확인을 받고 기존 프로젝트 ID와 충돌 시 clone- 접두사를 부여해야 한다", () => {
      const validDoc = createCheckpointFixture(110);
      const rawText = JSON.stringify({ ...validDoc, projectId: "project-open-test" });

      // 사용자 확인 거부 시
      const declined = openProjectFile(rawText, {
        currentProjectId: "project-open-test",
        confirm: () => false,
      });
      expect(declined.ok).toBe(false);
      if (!declined.ok) {
        expect(declined.reason).toBe("confirm declined");
      }

      // 사용자 확인 승인 시 (동일 ID이므로 clone- 생성)
      const acceptedClone = openProjectFile(rawText, {
        currentProjectId: "project-open-test",
        confirm: () => true,
      });
      expect(acceptedClone.ok).toBe(true);
      if (acceptedClone.ok) {
        expect(acceptedClone.cloned).toBe(true);
        expect(acceptedClone.projectId).toBe("clone-project-open-test");
      }

      // 손상된 JSON 파싱 시 안전하게 거부
      const malformed = openProjectFile("{ bad json", {
        currentProjectId: "project-open-test",
        confirm: () => true,
      });
      expect(malformed.ok).toBe(false);
    });
  });

  describe("4. 스코프 스냅샷 추출 (UITransferExport) 및 정규 해시 무결성", () => {
    it("buildTransfer로 생성된 전달 JSON은 3대 해시(contentHash, artifactHash, sourceCheckpointHash)가 정확히 일치해야 한다", () => {
      const checkpoint = createCheckpointFixture(125);
      const result = buildTransfer({
        checkpoint,
        scope: "menu",
        sourceId: "project-017",
        exportId: "export-017-001",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const transfer = result.transfer as {
        kind: string;
        schemaVersion: string;
        scope: string;
        content: Record<string, unknown>;
        contentHash: string;
        sourceCheckpointHash: string;
        integrity: {
          artifactHash: string;
        };
        omissionMeansRestore: boolean;
      };

      expect(transfer.kind).toBe(KINDS.transfer);
      expect(transfer.schemaVersion).toBe(SCHEMA_VERSION);
      expect(transfer.scope).toBe("menu");
      expect(transfer.omissionMeansRestore).toBe(OUT_OF_SCOPE_MEANS_RESTORE);

      // 해시 3종 정규 검증
      expect(contentHash(transfer.content)).toBe(transfer.contentHash);
      expect(artifactHash(transfer)).toBe(transfer.integrity.artifactHash);
      expect(sourceCheckpointHash(checkpoint)).toBe(transfer.sourceCheckpointHash);
    });
  });

  describe("5. 단일 전달 파일 재검사(UITransferInspector) 및 원본 부재 처리", () => {
    it("원본 체크포인트가 있으면 sourceComparison: 'match'이고 DB 수정이 발생하지 않아야 한다", () => {
      const checkpoint = createCheckpointFixture(135);
      const built = buildTransfer({
        checkpoint,
        scope: "menu",
        sourceId: "project-017",
        exportId: "export-chk-1",
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      let dbWrites = 0;
      const spyDatabase = {
        put() { dbWrites += 1; },
        delete() { dbWrites += 1; },
      };

      const inspection = inspectTransfer({
        file: built.transfer,
        originalCheckpoint: checkpoint,
        database: spyDatabase,
      });

      expect(inspection.contentHashOk).toBe(true);
      expect(inspection.artifactHashOk).toBe(true);
      expect(inspection.validationRecomputed).toBe(true);
      expect(inspection.sourceComparison).toBe("match");
      expect(inspection.projectMutated).toBe(false);
      expect(inspection.checkpointCreated).toBe(false);
      expect(inspection.gameApplyVerified).toBe(false);
      expect(inspection.hashesAreSignatures).toBe(false);
      expect(dbWrites).toBe(0);
    });

    it("원본 체크포인트가 없어도 '원본 대조 미실시'로 구분되며 부당하게 파일 손상으로 판정되지 않아야 한다", () => {
      const checkpoint = createCheckpointFixture(135);
      const built = buildTransfer({
        checkpoint,
        scope: "menu",
        sourceId: "project-017",
        exportId: "export-chk-2",
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const inspection = inspectTransfer({
        file: built.transfer,
        // 원본 체크포인트 미제공
      });

      expect(inspection.contentHashOk).toBe(true);
      expect(inspection.artifactHashOk).toBe(true);
      expect(inspection.validationRecomputed).toBe(true);
      expect(inspection.sourceComparison).toBe(SOURCE_COMPARISON_NOT_PERFORMED);
      expect(inspection.fileCorruptBecauseOriginalMissing).toBe(false);
    });

    it("규격에 맞는 와이어 전달 객체는 inspector에서 3종 해시 및 검증이 통과되어야 한다", () => {
      const checkpoint = createCheckpointFixture(90);
      const wire: Record<string, unknown> = {
        kind: KINDS.transfer,
        schemaVersion: SCHEMA_VERSION,
        design: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT },
        scope: "menu",
        content: checkpoint.menu,
        baseline: checkpoint.baseline,
        contentHash: contentHash(checkpoint.menu),
        sourceCheckpointHash: sourceCheckpointHash(checkpoint),
        sourceComparison: "match",
      };
      wire.integrity = { artifactHash: artifactHash(wire) };

      const inspection = inspectTransfer({
        file: wire,
        originalCheckpoint: checkpoint,
      });

      expect(inspection.contentHashOk).toBe(true);
      expect(inspection.artifactHashOk).toBe(true);
      expect(inspection.sourceComparison).toBe("match");
      expect(inspection.gameApplyVerified).toBe(false);
    });
  });

  describe("6. 다중 탭 동시성 충돌 (Revision Conflict) 차단", () => {
    it("다른 탭이 먼저 체크포인트를 저장하여 generation이 증가한 경우 덮어쓰기가 방지되어야 한다", () => {
      const port = new MockDatabasePort();
      port.open();
      const db = new UIProjectDatabase(port);
      const store = new UIProjectStore(db);

      const checkpointDoc = createCheckpointFixture(100);

      // 탭 1이 세대 0 -> 1 저장 성공
      const resTab1 = store.saveCheckpoint({
        projectId: "multi-tab-project",
        writerId: "writer-tab-1",
        expectedGeneration: 0,
        documentRevision: 1,
        snapshot: checkpointDoc,
        requestId: "req-t1",
        sessionId: "sess-t1",
      });
      expect(resTab1.status).toBe("saved");

      // 탭 2가 여전히 이전 세대 0을 기대하며 저장을 시도할 경우 충돌(conflict) 반환
      const resTab2 = store.saveCheckpoint({
        projectId: "multi-tab-project",
        writerId: "writer-tab-2",
        expectedGeneration: 0, // 이미 1로 전진했으므로 불일치
        documentRevision: 1,
        snapshot: checkpointDoc,
        requestId: "req-t2",
        sessionId: "sess-t2",
      });
      expect(resTab2.status).toBe("conflict");
    });
  });

  describe("7. 저장소 Quota 초과 시 안전 롤백 및 데이터 유실 방어", () => {
    it("QuotaExceededError 발생 시 트랜잭션이 중단되고 불완전 데이터가 커밋되지 않아야 한다", () => {
      const port = new MockDatabasePort();
      port.open();
      port.nextOutcome = "quota"; // 쿼터 초과 모의
      const db = new UIProjectDatabase(port);
      const store = new UIProjectStore(db);

      expect(() => {
        store.saveCheckpoint({
          projectId: "quota-project",
          writerId: "writer-q",
          expectedGeneration: 0,
          documentRevision: 1,
          snapshot: createCheckpointFixture(90),
          requestId: "req-quota",
          sessionId: "sess-quota",
        });
      }).toThrow("QuotaExceededError");

      // projects 테이블에 어떠한 불완전 헤드도 커밋되지 않아야 함
      expect(port.read("projects", "quota-project")).toBeNull();
    });
  });

  describe("8. 변조 파일 및 유해 페이로드 방어 (Tampered File Detection)", () => {
    it("내용이 변조된 경우 contentHash 불일치로 거부되어야 한다", () => {
      const checkpoint = createCheckpointFixture(90);
      const built = buildTransfer({
        checkpoint,
        scope: "menu",
        sourceId: "project-017",
        exportId: "export-tamper",
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const tampered = structuredClone(built.transfer) as {
        content: { cards: Array<{ x: number }> };
      };
      // 해시는 그대로 둔 채 내용 좌표를 몰래 9999로 변경
      tampered.content.cards[0].x = 9999;

      const inspection = inspectTransfer({ file: tampered });
      expect(inspection.contentHashOk).toBe(false);
      expect(inspection.accepted).toBe(false);
    });

    it("유효하지 않은 레이아웃에 대해 false pass를 주장하는 경우 inspector가 탐지해야 한다", () => {
      const checkpoint = createCheckpointFixture(90);
      const built = buildTransfer({
        checkpoint,
        scope: "menu",
        sourceId: "project-017",
        exportId: "export-false-pass",
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const falsePassTransfer = structuredClone(built.transfer) as Record<string, unknown>;
      // 악의적인 통과 주장 플래그 주입
      falsePassTransfer.validation = { passed: true, status: "pass" };
      (falsePassTransfer.content as Record<string, unknown>).cards = []; // 필수 5개 카드 결손

      const inspection = inspectTransfer({ file: falsePassTransfer });
      expect(inspection.falsePassRejected).toBe(true);
      expect(inspection.accepted).toBe(false);
    });

    it("JSON 중복 키 감지 시 rejectDuplicateKeys가 실패를 반환해야 한다", () => {
      const duplicateKeyJson = '{"kind":"dream-guardian-ui-transfer","kind":"duplicate"}';
      const scanResult = rejectDuplicateKeys(duplicateKeyJson);
      expect(scanResult.ok).toBe(false);

      expect(LIMITS.maxBytes).toBe(1048576); // 1 MiB
      expect(LIMITS.maxDepth).toBe(16);
    });
  });

  describe("9. r18 / r20 분리 및 범위 밖(Out-of-Scope) 요소 기본값 복원/미포함 규약", () => {
    it("전달 파일은 스코프 범위(menu) 내부 값만 포함하며 범위 밖은 삭제나 기본값 복원이 아닌 미포함 규약을 준수해야 한다", () => {
      expect(OUT_OF_SCOPE_MEANS_RESTORE).toBe(false);
      expect(SCOPED_SNAPSHOT_SEMANTICS).toContain("범위 밖 키 미포함은 삭제나 기본값 복원이 아니다");

      const checkpoint = createCheckpointFixture(110);
      const built = buildTransfer({
        checkpoint,
        scope: "menu",
        sourceId: "project-017",
        exportId: "export-scope-check",
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const transfer = built.transfer as { content: Record<string, unknown>; scope: string };
      expect(transfer.scope).toBe("menu");
      expect(transfer.content.cards).toBeDefined();

      // 게임 플레이 상태, 전투 설정, 보스 데이터 등 범위 밖 속성은 전달 파일에 일절 포함되지 않음
      expect(transfer.content.gameplay).toBeUndefined();
      expect(transfer.content.battle).toBeUndefined();
      expect(transfer.content.boss).toBeUndefined();
    });
  });

  describe("10. 게임 비변경(Non-Interference) 및 0 침범 무결성 검증", () => {
    it("게임 런타임 저장소(세이브/설정/접근성/안무) 전용 키 접근이 0건이어야 한다", () => {
      const forbiddenStores = ["activation", "gameSession", "deploy", "save", "accessibility", "choreography"];
      const allowedStores = [...STORE_NAMES];

      for (const forbidden of forbiddenStores) {
        expect(allowedStores).not.toContain(forbidden);
      }

      // UIProjectDatabase는 오직 에디터 전용 저장소만 허용
      expect(allowedStores).toEqual([
        "projects",
        "drafts",
        "checkpoints",
        "contents",
        "exports",
        "downloadEvents",
        "viewStates",
      ]);
    });

    it("에디터 내 런타임 상수 및 계약이 게임 비침범 정책을 명시해야 한다", () => {
      expect(BUILDER_GAME_APPLY_VERIFIED).toBe(false);
      expect(INSPECTOR_GAME_APPLY_VERIFIED).toBe(false);
      expect(STATE_GAME_APPLY_VERIFIED).toBe(false);
      expect(STATE_STORAGE_TOUCHED).toBe(false);
      expect(HASHES_ARE_NOT_SIGNATURES).toBe(true);
      expect(SOURCE_COMPARISON_NOT_PERFORMED).toBe("원본 대조 미실시");
    });

    it("출처 확인된 UIX-006/008/011 개별 커밋은 게임 핵심 소스·config를 침범하지 않아야 한다 (원 #341 전체 diff 증명 아님)", () => {
      // #644: 현재 worktree가 아니라 고정된 개별 에디터 변경 증거를 검사한다.
      // 원 UIX-017 QA SHA 부재와 증명 한계는 helper에 기록한다.
      expect(verifyEditorChangeScope(workspaceRoot).length).toBeGreaterThan(0);
    });
  });
});
