import { describe, it, expect } from 'vitest';
import {
  buildPresentationArtifact,
  buildFullProjectBackup,
  serializeBackup,
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_VERSION,
  UI_BACKUP_KIND,
  UI_BACKUP_SCHEMA_VERSION,
  PRESENTATION_PAGE_TO_EDITOR_PAGE_MAP,
  type BuildPresentationInput,
} from '../../src/editor/ui/data/UIVisualArtifactBuilder';
import {
  inspectPresentationArtifact,
  inspectBackup,
  restoreProjectFromBackup,
  publishPresentationArtifact,
  exportPresentationArtifact,
} from '../../src/editor/ui/io/UIVisualArtifactIO';
import {
  createDefaultUIPresentationDocument,
  type UIPresentationPageId,
} from '../../src/data/UIPresentation';
import {
  type UIVisualDocument,
  type UIVisualPage,
  type UIVisualPageId,
} from '../../src/editor/ui/data/UIVisualDocument';
import { RENDERER_FINGERPRINT } from '../../src/editor/ui/data/UIBaselines';
import { sha256Hex } from '../../src/editor/ui/data/UICanonicalJSON';

describe('UI-VIS-038 (#468): UI 표시 적용본 생성·재검사와 전체 백업', () => {
  // Helper to create a valid base checkpoint without protected zone encroachment
  function createSampleDocument(): UIVisualDocument {
    const presDoc = createDefaultUIPresentationDocument();
    const pages: Record<UIVisualPageId, UIVisualPage> = {} as any;

    for (const [presPageId, presPage] of Object.entries(presDoc.pages)) {
      const editorPageId = PRESENTATION_PAGE_TO_EDITOR_PAGE_MAP[presPageId as UIPresentationPageId];
      pages[editorPageId] = {
        pageId: editorPageId,
        name: editorPageId,
        elements: presPage.elements.map((el) => ({
          id: el.id,
          name: el.name,
          type: el.type,
          bounds: { ...el.bounds },
          hitBounds: el.hitBounds ? { ...el.hitBounds } : undefined,
          actionId: el.actionId,
          text: el.text,
          assetId: el.assetId,
          fontSize: el.fontSize,
          dynamicBinding: el.dynamicBinding,
        })),
      };
    }

    return {
      kind: 'dream-guardian-ui-visual-doc',
      schemaVersion: '1.0.0',
      design: { width: 1080, height: 2160 },
      pages,
    };
  }

  function createSampleAsset(id: string, content: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    const hash = sha256Hex(content);
    return {
      assetId: id,
      contentHash: hash,
      durableAssetId: `durable-${id}`,
      mimeType: 'image/png',
      byteLength: bytes.byteLength,
      data: bytes,
      metadata: { originalName: `${id}.png` },
    };
  }

  describe('1. 결정적 Hash 및 적용본 생성', () => {
    it('동일 checkpoint와 동일 자산에 대해 항상 동일한 결정적 contentHash와 artifactHash를 생성한다', () => {
      const doc = createSampleDocument();
      const asset = createSampleAsset('asset-logo', 'PNG_IMAGE_BYTES_123');

      const input: BuildPresentationInput = {
        checkpoint: {
          projectId: 'proj-deterministic',
          revision: 5,
          checkpointId: 'chk-5',
          document: doc,
          saved: true,
          isDirty: false,
        },
        assets: [asset],
      };

      const result1 = buildPresentationArtifact(input);
      const result2 = buildPresentationArtifact(input);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (!result1.ok || !result2.ok) return;

      expect(result1.artifact.kind).toBe(UI_PRESENTATION_ARTIFACT_KIND);
      expect(result1.artifact.version).toBe(UI_PRESENTATION_VERSION);
      expect(result1.artifact.contentHash).toBe(result2.artifact.contentHash);
      expect(result1.artifact.integrity.artifactHash).toBe(result2.artifact.integrity.artifactHash);
      expect(result1.artifact.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result1.artifact.integrity.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('10개 정규 페이지(홈, 서브, 옵션, pause, 시작, 러닝/문제, 답안, 위험, 보스, 결과)가 올바르게 매핑된다', () => {
      const doc = createSampleDocument();
      const res = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-10pages',
          revision: 1,
          document: doc,
          saved: true,
        },
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const expectedPresentationPages = [
        'main_home',
        'submenu',
        'options',
        'pause',
        'play_ready',
        'running_question',
        'answer_select',
        'hazard_evade',
        'boss_battle',
        'result',
      ];

      expect(Object.keys(res.artifact.pages).sort()).toEqual(expectedPresentationPages.sort());
      expect(res.artifact.resolution).toEqual({ width: 1080, height: 2160 });
      expect(res.artifact.rendererFingerprint).toBe(RENDERER_FINGERPRINT);
      expect(res.artifact.baseline).toBe('menu-v1');
    });
  });

  describe('2. 편집용 상태 완전 제외 및 게임플레이 누출 차단 (누출 0)', () => {
    it('selection, grid, history, groupId, isLocked, unsupportedReason 등 편집 전용 필드가 적용본에서 100% 제거된다', () => {
      const doc = createSampleDocument();
      // Add editor-only fields into an element and editor-only group
      const mainPage = doc.pages.menu_main;
      mainPage.groups = [{ id: 'grp_secret', name: '테스트 그룹' }];
      mainPage.elements.push({
        id: 'btn_custom_test',
        name: '커스텀 버튼',
        type: 'button',
        bounds: { x: 100, y: 1500, width: 400, height: 100 },
        hitBounds: { x: 100, y: 1500, width: 400, height: 100 },
        actionId: 'nav_play',
        groupId: 'grp_secret',
        isLocked: true,
        lockReason: '테스트 잠금',
        isSupported: true,
        unsupportedReason: '없음',
      });

      // Add editor-only metadata to document
      (doc as any).selection = { selectedIds: ['btn_custom_test'] };
      (doc as any).grid = { enabled: true, snap: 10 };
      (doc as any).history = { undoStack: [1, 2, 3] };

      const res = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-strip',
          revision: 2,
          document: doc,
          saved: true,
        },
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const artifact = res.artifact;
      expect((artifact as any).selection).toBeUndefined();
      expect((artifact as any).grid).toBeUndefined();
      expect((artifact as any).history).toBeUndefined();

      const homePage = artifact.pages.main_home;
      const strippedEl = homePage.elements.find((e) => e.id === 'btn_custom_test');
      expect(strippedEl).toBeDefined();
      expect((strippedEl as any).groupId).toBeUndefined();
      expect((strippedEl as any).isLocked).toBeUndefined();
      expect((strippedEl as any).lockReason).toBeUndefined();
      expect((strippedEl as any).isSupported).toBeUndefined();
      expect((strippedEl as any).unsupportedReason).toBeUndefined();
    });

    it('playerHp, bossHp, combo, score, bpm, questionCsv 등 게임플레이 수치가 포함된 경우 적용본 생성을 거부한다', () => {
      const doc = createSampleDocument();
      (doc as any).playerHp = 100;

      const res = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-forbidden',
          revision: 1,
          document: doc,
          saved: true,
        },
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.reason).toMatch(/GAME_DATA_INJECTION/i);
    });
  });

  describe('3. 보호 구역 침범 및 미지원 Capability 거부', () => {
    it('러닝/답안 페이지에서 피트니스 보호 구역(zone_1~11)을 침범하는 요소가 있으면 생성을 거부한다', () => {
      const doc = createSampleDocument();
      // Encroach on zone_1_running_question: { x: 43, y: 86, width: 281, height: 346 }
      doc.pages.run_question.elements.push({
        id: 'bad_overlapping_btn',
        name: '침범 요소',
        type: 'button',
        bounds: { x: 50, y: 100, width: 200, height: 100 },
        hitBounds: { x: 50, y: 100, width: 200, height: 100 },
        actionId: 'ready_start',
      });

      const res = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-encroach',
          revision: 1,
          document: doc,
          saved: true,
        },
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.reason).toMatch(/PROTECTED_ZONE_ENCROACHMENT/i);
    });

    it('미지원 renderer capability(fingerprint)를 전달하면 적용본 생성을 거부한다', () => {
      const doc = createSampleDocument();
      const res = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-cap',
          revision: 1,
          document: doc,
          saved: true,
        },
        rendererFingerprint: 'unsupported-renderer-v999',
      });

      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.reason).toMatch(/UNSUPPORTED_CAPABILITY/i);
    });
  });

  describe('4. 자산 매니페스트 및 참조 검증', () => {
    it('요소에서 참조하는 assetId가 manifest에 수집되고, 제공된 자산과 일치한다', () => {
      const doc = createSampleDocument();
      const asset = createSampleAsset('img-bg-main', 'VALID_IMAGE_DATA_555');

      doc.pages.menu_main.elements.push({
        id: 'custom_logo_img',
        name: '커스텀 로고',
        type: 'image',
        bounds: { x: 100, y: 100, width: 200, height: 80 },
        assetId: 'img-bg-main',
      });

      const res = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-asset',
          revision: 1,
          document: doc,
          saved: true,
        },
        assets: [asset],
      });

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.artifact.manifest.assetIds).toContain('img-bg-main');
      const assetEntry = res.artifact.manifest.assets?.find((a) => a.assetId === 'img-bg-main');
      expect(assetEntry).toBeDefined();
      expect(assetEntry?.contentHash).toBe(asset.contentHash);
      expect(assetEntry?.byteLength).toBe(asset.byteLength);
    });

    it('요소가 참조하는 assetId가 누락되었거나 자산 해시가 위조된 경우 거부한다', () => {
      const doc = createSampleDocument();
      doc.pages.menu_main.elements.push({
        id: 'missing_asset_img',
        name: '누락 자산',
        type: 'image',
        bounds: { x: 100, y: 100, width: 200, height: 80 },
        assetId: 'missing-asset-id',
      });

      // 1. Missing asset
      const resMissing = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-asset-missing',
          revision: 1,
          document: doc,
          saved: true,
        },
        assets: [],
      });
      expect(resMissing.ok).toBe(false);
      if (!resMissing.ok) {
        expect(resMissing.reason).toMatch(/MISSING_ASSET/i);
      }

      // 2. Tampered asset hash
      const tamperedAsset = createSampleAsset('missing-asset-id', 'REAL_DATA');
      tamperedAsset.contentHash = '0000000000000000000000000000000000000000000000000000000000000000';

      const resTampered = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-asset-tampered',
          revision: 1,
          document: doc,
          saved: true,
        },
        assets: [tamperedAsset],
      });
      expect(resTampered.ok).toBe(false);
      if (!resTampered.ok) {
        expect(resTampered.reason).toMatch(/ASSET_HASH_MISMATCH/i);
      }
    });
  });

  describe('5. Export vs Publish 구분 및 미저장 문서 게시 거부', () => {
    it('publishPresentationArtifact는 미저장(saved=false 또는 dirty=true) 문서의 게시를 엄격히 거부한다', () => {
      const doc = createSampleDocument();

      // Case 1: saved = false
      const resUnsaved = publishPresentationArtifact({
        checkpoint: {
          projectId: 'proj-unsaved',
          revision: 3,
          document: doc,
          saved: false,
          isDirty: false,
        },
      });
      expect(resUnsaved.ok).toBe(false);
      if (!resUnsaved.ok) {
        expect(resUnsaved.reason).toMatch(/UNSAVED_DOCUMENT_PUBLISH_REJECTED/i);
      }

      // Case 2: isDirty = true
      const resDirty = publishPresentationArtifact({
        checkpoint: {
          projectId: 'proj-dirty',
          revision: 3,
          document: doc,
          saved: true,
          isDirty: true,
        },
      });
      expect(resDirty.ok).toBe(false);
      if (!resDirty.ok) {
        expect(resDirty.reason).toMatch(/UNSAVED_DOCUMENT_PUBLISH_REJECTED/i);
      }

      // Case 3: 저장 완료 상태는 게시 성공
      const resSaved = publishPresentationArtifact({
        checkpoint: {
          projectId: 'proj-saved',
          revision: 3,
          document: doc,
          saved: true,
          isDirty: false,
        },
      });
      expect(resSaved.ok).toBe(true);
    });

    it('exportPresentationArtifact는 휴대용 번들 생성을 성공적으로 반환한다', () => {
      const doc = createSampleDocument();
      const res = exportPresentationArtifact({
        checkpoint: {
          projectId: 'proj-export',
          revision: 1,
          document: doc,
          saved: true,
        },
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.artifact.kind).toBe(UI_PRESENTATION_ARTIFACT_KIND);
      }
    });
  });

  describe('6. 전체 프로젝트 백업 (dream-guardian-ui-backup) 및 이미지 바이트 왕복(Round-trip)', () => {
    it('전체 백업 직렬화 및 복구 후 문서와 이미지 바이너리 bytes가 100% 왕복 일치한다', () => {
      const doc = createSampleDocument();
      const asset1 = createSampleAsset('img-1', 'BINARY_DATA_ALPHA');
      const asset2 = createSampleAsset('img-2', 'BINARY_DATA_BETA');

      // Add a group to test group restoration
      doc.pages.menu_main.groups = [
        { id: 'grp-header', name: '헤더 그룹' },
      ];

      const backupRes = buildFullProjectBackup({
        projectId: 'proj-backup-01',
        revision: 7,
        document: doc,
        assets: [asset1, asset2],
      });

      expect(backupRes.ok).toBe(true);
      if (!backupRes.ok) return;

      const backup = backupRes.backup;
      expect(backup.kind).toBe(UI_BACKUP_KIND);
      expect(backup.schemaVersion).toBe(UI_BACKUP_SCHEMA_VERSION);
      expect(backup.assets.length).toBe(2);

      // Serialize to canonical JSON string
      const jsonStr = serializeBackup(backup);
      expect(typeof jsonStr).toBe('string');

      // Deserialize and restore
      const restoreRes = restoreProjectFromBackup(jsonStr);
      expect(restoreRes.ok).toBe(true);
      if (!restoreRes.ok) return;

      // Inspect backup integrity
      const inspection = inspectBackup(backup);
      expect(inspection.ok).toBe(true);

      // Check document fidelity
      expect(restoreRes.backup.projectId).toBe('proj-backup-01');
      expect(restoreRes.document.pages.menu_main.groups).toEqual(doc.pages.menu_main.groups);
      expect(Object.keys(restoreRes.document.pages).sort()).toEqual(Object.keys(doc.pages).sort());

      // Check binary bytes exact match
      const restoredBytes1 = restoreRes.binaryAssets.get('img-1');
      const restoredBytes2 = restoreRes.binaryAssets.get('img-2');
      expect(restoredBytes1).toBeDefined();
      expect(restoredBytes2).toBeDefined();

      expect(new Uint8Array(restoredBytes1!)).toEqual(new Uint8Array(asset1.data));
      expect(new Uint8Array(restoredBytes2!)).toEqual(new Uint8Array(asset2.data));
    });

    it('백업 해시가 변조된 경우 복구를 거부한다', () => {
      const doc = createSampleDocument();
      const backupRes = buildFullProjectBackup({
        projectId: 'proj-tamper',
        revision: 1,
        document: doc,
        assets: [],
      });
      expect(backupRes.ok).toBe(true);
      if (!backupRes.ok) return;

      const tampered = JSON.parse(JSON.stringify(backupRes.backup));
      tampered.document.title = '변조된 제목';

      const restoreRes = restoreProjectFromBackup(JSON.stringify(tampered));
      expect(restoreRes.ok).toBe(false);
      if (!restoreRes.ok) {
        expect(restoreRes.reason).toMatch(/BACKUP_HASH_MISMATCH|CONTENT_HASH_MISMATCH/i);
      }
    });
  });

  describe('7. 재수입 / 재검사 (Inspection) 및 외래/레거시 파일 오인 거부', () => {
    it('정상적인 UI 적용본은 inspection 통과하고 accepted=true를 반환한다', () => {
      const doc = createSampleDocument();
      const res = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-inspect',
          revision: 1,
          document: doc,
          saved: true,
        },
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const inspection = inspectPresentationArtifact(res.artifact);
      expect(inspection.ok).toBe(true);
      expect(inspection.contentHashOk).toBe(true);
      expect(inspection.artifactHashOk).toBe(true);
      expect(inspection.capabilityOk).toBe(true);
      expect(inspection.protectedZonesOk).toBe(true);
    });

    it('contentHash 또는 artifactHash 변조 시 거부한다', () => {
      const doc = createSampleDocument();
      const res = buildPresentationArtifact({
        checkpoint: {
          projectId: 'proj-tamper-hash',
          revision: 1,
          document: doc,
          saved: true,
        },
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // Tamper content
      const tampered = JSON.parse(JSON.stringify(res.artifact));
      tampered.resolution.width = 1920; // Invalid resolution

      const insp1 = inspectPresentationArtifact(tampered);
      expect(insp1.ok).toBe(false);
      expect(insp1.contentHashOk).toBe(false);

      // Tamper artifact hash
      const tampered2 = JSON.parse(JSON.stringify(res.artifact));
      tampered2.integrity.artifactHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const insp2 = inspectPresentationArtifact(tampered2);
      expect(insp2.ok).toBe(false);
      expect(insp2.artifactHashOk).toBe(false);
    });

    it('피트니스 콘텐츠 팩(kind: dream-guardian-published-content-pack)을 UI 적용본으로 오인/채택하는 것을 완벽히 거부한다', () => {
      const fitnessPack = {
        kind: 'dream-guardian-published-content-pack',
        schemaVersion: 1,
        runtimeContractVersion: '2.0.0',
        contentHash: 'abc',
        stages: [],
      };

      const inspection = inspectPresentationArtifact(fitnessPack);
      expect(inspection.ok).toBe(false);
      expect(inspection.kindOk).toBe(false);
      expect(inspection.reason).toMatch(/FITNESS_PACK_REJECTED/i);
    });

    it('레거시 UIX 프로젝트 또는 UIX transfer 문서를 UI 적용본으로 오인/채택하는 것을 완벽히 거부한다', () => {
      // 1. UIX project
      const legacyProject = {
        kind: 'dream-guardian-ui-project',
        schemaVersion: '1.0.0',
        menu: { cards: [] },
      };
      const insp1 = inspectPresentationArtifact(legacyProject);
      expect(insp1.ok).toBe(false);
      expect(insp1.kindOk).toBe(false);
      expect(insp1.reason).toMatch(/LEGACY_TRANSFER_REJECTED/i);

      // 2. UIX transfer
      const legacyTransfer = {
        kind: 'dream-guardian-ui-transfer',
        schemaVersion: '1.0.0',
        scope: 'menu',
        content: {},
      };
      const insp2 = inspectPresentationArtifact(legacyTransfer);
      expect(insp2.ok).toBe(false);
      expect(insp2.kindOk).toBe(false);
      expect(insp2.reason).toMatch(/LEGACY_TRANSFER_REJECTED/i);
    });
  });
});
