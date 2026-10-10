import { describe, it, expect } from 'vitest';
import {
  UIPresentationLoadService,
  type UIPresentationArtifact,
  DEFAULT_RENDERER_CAPABILITY,
  sha256BytesHex,
} from '../../src/core/UIPresentationLoadService';
import {
  createDefaultUIPresentationDocument,
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_VERSION,
  UI_DESIGN_CANVAS,
} from '../../src/data/UIPresentation';
import { computeContentHash } from '../../src/data/ContentCanonical';
import { ContentLoadService } from '../../src/core/ContentLoadService';

// Helper to construct a valid, verified test artifact
function createValidTestArtifact(overrides?: Partial<UIPresentationArtifact>): UIPresentationArtifact {
  const baseDoc = createDefaultUIPresentationDocument();
  const manifest = overrides?.manifest ?? { assetIds: [] };
  const pages = overrides?.pages ?? baseDoc.pages;
  const resolution = overrides?.resolution ?? {
    width: UI_DESIGN_CANVAS.width,
    height: UI_DESIGN_CANVAS.height,
  };

  const contentToHash = {
    manifest,
    pages,
    resolution,
  };
  const calculatedContentHash = computeContentHash(contentToHash);

  const envelope = {
    kind: UI_PRESENTATION_ARTIFACT_KIND,
    version: UI_PRESENTATION_VERSION,
    resolution,
    baseline: 'ui-baseline-v1',
    rendererFingerprint: DEFAULT_RENDERER_CAPABILITY,
    sourceProjectId: 'test-project',
    sourceRevision: 1,
    sourceCheckpointId: 'cp-001',
    sourceCheckpointHash: 'chk-001',
    pages,
    manifest,
    contentHash: calculatedContentHash,
    ...overrides,
  };

  // Recompute contentHash if overridden
  const finalContentHash = overrides?.contentHash ?? calculatedContentHash;
  envelope.contentHash = finalContentHash;

  const calculatedArtifactHash = computeContentHash(envelope);
  const finalArtifactHash = overrides?.integrity?.artifactHash ?? calculatedArtifactHash;

  return {
    ...envelope,
    integrity: {
      artifactHash: finalArtifactHash,
      algorithm: 'sha256',
    },
  };
}

describe('UI-VIS-040 (#470): 피트니스와 분리된 UI 표시 적용본 로더', () => {
  describe('1. 레이어 경계 및 피트니스 콘텐츠 로더와의 철저한 분리', () => {
    it('피트니스 팩(dream-guardian-published-content-pack) 수신 시 명시적으로 거부하고 fallback을 반환한다', async () => {
      const service = new UIPresentationLoadService();
      const fitnessPack = {
        kind: 'dream-guardian-published-content-pack',
        manifestVersion: 2,
        projectId: 'fitness-project',
        contentHash: 'some-hash',
      };

      const result = await service.loadPresentation(fitnessPack);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('rejected-fitness-content-pack');
        expect(result.diagnostic).toContain('Fitness content pack');
        expect(result.fallbackPresentation.kind).toBe(UI_PRESENTATION_ARTIFACT_KIND);
      }
    });

    it('레거시 에디터 초안(authoring/ui-project) 및 전송 데이터(ui-transfer) 수신 시 거부한다', async () => {
      const service = new UIPresentationLoadService();

      const authoringDraft = { kind: 'dream-guardian-authoring-project', version: 1 };
      const uiProject = { kind: 'dream-guardian-ui-project', version: 1 };
      const uiTransfer = { kind: 'dream-guardian-ui-transfer', version: 1 };

      const res1 = await service.loadPresentation(authoringDraft);
      expect(res1.status).toBe('fallback');
      if (res1.status === 'fallback') {
        expect(res1.reason).toBe('rejected-legacy-project');
      }

      const res2 = await service.loadPresentation(uiProject);
      expect(res2.status).toBe('fallback');
      if (res2.status === 'fallback') {
        expect(res2.reason).toBe('rejected-editor-project');
      }

      const res3 = await service.loadPresentation(uiTransfer);
      expect(res3.status).toBe('fallback');
      if (res3.status === 'fallback') {
        expect(res3.reason).toBe('rejected-legacy-transfer');
      }
    });

    it('기존 ContentLoadService의 UIX 거부 정책에 회귀가 없어야 한다', async () => {
      const contentService = new ContentLoadService();
      const uiPresentationArtifact = createValidTestArtifact();

      const res = await contentService.loadPack(uiPresentationArtifact);
      expect(res.status).toBe('fallback');
      if (res.status === 'fallback') {
        expect(res.reason).toBe('rejected-uix-content');
      }
    });
  });

  describe('2. 무결성 및 보안 검증', () => {
    it('정상적인 UI presentation artifact는 성공적으로 로드된다', async () => {
      const service = new UIPresentationLoadService();
      const artifact = createValidTestArtifact();

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.presentation.kind).toBe(UI_PRESENTATION_ARTIFACT_KIND);
        expect(result.presentation.version).toBe(UI_PRESENTATION_VERSION);
        expect(result.contentHash).toBe(artifact.contentHash);
        expect(result.artifactHash).toBe(artifact.integrity?.artifactHash);
        expect(Object.keys(result.presentation.pages)).toHaveLength(10);
      }
    });

    it('미지원 버전인 경우 fallback으로 복귀한다', async () => {
      const service = new UIPresentationLoadService();
      const artifact = createValidTestArtifact({ version: '2.0.0' as any });

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('unsupported-version');
      }
    });

    it('미지원 renderer capability인 경우 fallback으로 복귀한다', async () => {
      const service = new UIPresentationLoadService();
      const artifact = createValidTestArtifact({ rendererFingerprint: 'custom-renderer-v9' });

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('unsupported-renderer-capability');
      }
    });

    it('contentHash가 변조된 경우 fallback으로 복귀하고 부분 적용을 방지한다', async () => {
      const service = new UIPresentationLoadService();
      const artifact = createValidTestArtifact({ contentHash: 'tampered-content-hash-1234567890' });

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('content-hash-mismatch');
        expect(result.candidateHash).toBe('tampered-content-hash-1234567890');
      }
    });

    it('artifactHash가 변조된 경우 fallback으로 복귀한다', async () => {
      const service = new UIPresentationLoadService();
      const artifact = createValidTestArtifact({
        integrity: { artifactHash: 'tampered-artifact-hash-abcdef', algorithm: 'sha256' },
      });

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('artifact-hash-mismatch');
      }
    });

    it('외부 URL(http/https) 또는 자바스크립트/스크립트 태그 포함 시 즉시 거부한다', async () => {
      const service = new UIPresentationLoadService();
      const baseDoc = createDefaultUIPresentationDocument();

      // Injected malicious element
      const maliciousPages = JSON.parse(JSON.stringify(baseDoc.pages));
      maliciousPages.main_home.elements.push({
        id: 'malicious_btn',
        name: '악성 버튼',
        type: 'button',
        bounds: { x: 50, y: 50, width: 200, height: 60 },
        text: '<script>alert(1)</script>',
      });

      const artifact = createValidTestArtifact({ pages: maliciousPages });
      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toMatch(/security-violation|contract-validation-failed/);
      }
    });

    it('11개 피트니스 보호 구역을 침범하는 요소가 있으면 거부한다', async () => {
      const service = new UIPresentationLoadService();
      const baseDoc = createDefaultUIPresentationDocument();

      // Encroaching element on fitness zone 1 of running_question
      const encroachingPages = JSON.parse(JSON.stringify(baseDoc.pages));
      encroachingPages.running_question.elements.push({
        id: 'encroaching_box',
        name: '침범 박스',
        type: 'container',
        bounds: { x: 45, y: 90, width: 200, height: 200 }, // intersects zone 1 { x: 43, y: 86, width: 281, height: 346 }
      });

      const artifact = createValidTestArtifact({ pages: encroachingPages });
      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('contract-validation-failed');
        expect(result.diagnostic).toContain('PROTECTED_ZONE_ENCROACHMENT');
      }
    });
  });

  describe('3. 자산 번들(Asset Bundle) 검증 및 승인 카탈로그', () => {
    it('참조된 자산이 제공되고 SHA-256 해시가 일치하면 정상 로드된다', async () => {
      const service = new UIPresentationLoadService();
      const baseDoc = createDefaultUIPresentationDocument();

      const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03, 0x04]);
      const imageHash = sha256BytesHex(imageBytes);

      const pagesWithAsset = JSON.parse(JSON.stringify(baseDoc.pages));
      pagesWithAsset.main_home.elements.push({
        id: 'valid_custom_img',
        name: '커스텀 이미지',
        type: 'image',
        bounds: { x: 100, y: 100, width: 120, height: 120 },
        assetId: 'asset_icon_01',
      });

      const manifest = {
        assetIds: ['asset_icon_01'],
        assets: [
          {
            assetId: 'asset_icon_01',
            contentHash: imageHash,
            mimeType: 'image/png',
            byteLength: imageBytes.byteLength,
            data: imageBytes,
          },
        ],
      };

      const artifact = createValidTestArtifact({
        pages: pagesWithAsset,
        manifest,
      });

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('success');
    });

    it('참조된 자산이 번들에 누락된 경우 fallback으로 복귀한다', async () => {
      const service = new UIPresentationLoadService();
      const baseDoc = createDefaultUIPresentationDocument();

      const pagesWithMissingAsset = JSON.parse(JSON.stringify(baseDoc.pages));
      pagesWithMissingAsset.main_home.elements.push({
        id: 'missing_asset_img',
        name: '누락 이미지',
        type: 'image',
        bounds: { x: 100, y: 100, width: 120, height: 120 },
        assetId: 'non_existent_asset_99',
      });

      const artifact = createValidTestArtifact({
        pages: pagesWithMissingAsset,
        manifest: { assetIds: ['non_existent_asset_99'] },
      });

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('missing-asset');
        expect(result.diagnostic).toContain('non_existent_asset_99');
      }
    });

    it('자산의 SHA-256 해시가 선언값과 불일치(변조)할 경우 fallback으로 복귀한다', async () => {
      const service = new UIPresentationLoadService();
      const baseDoc = createDefaultUIPresentationDocument();

      const imageBytes = new Uint8Array([1, 2, 3, 4, 5]);

      const pagesWithAsset = JSON.parse(JSON.stringify(baseDoc.pages));
      pagesWithAsset.main_home.elements.push({
        id: 'tampered_img',
        name: '변조 이미지',
        type: 'image',
        bounds: { x: 100, y: 100, width: 120, height: 120 },
        assetId: 'asset_tampered_01',
      });

      const manifest = {
        assetIds: ['asset_tampered_01'],
        assets: [
          {
            assetId: 'asset_tampered_01',
            contentHash: 'declared-hash-does-not-match',
            mimeType: 'image/png',
            byteLength: imageBytes.byteLength,
            data: imageBytes,
          },
        ],
      };

      const artifact = createValidTestArtifact({
        pages: pagesWithAsset,
        manifest,
      });

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('asset-hash-mismatch');
      }
    });

    it('승인된 정적 카탈로그(approvedCatalogAssetIds)에 등록된 자산은 별도 바이트 없이 안전하게 수용된다', async () => {
      const service = new UIPresentationLoadService();
      const baseDoc = createDefaultUIPresentationDocument();

      const pagesWithCatalogAsset = JSON.parse(JSON.stringify(baseDoc.pages));
      pagesWithCatalogAsset.main_home.elements.push({
        id: 'catalog_asset_img',
        name: '정적 카탈로그 이미지',
        type: 'image',
        bounds: { x: 100, y: 100, width: 120, height: 120 },
        assetId: 'static_catalog_icon_star',
      });

      const artifact = createValidTestArtifact({
        pages: pagesWithCatalogAsset,
        manifest: { assetIds: ['static_catalog_icon_star'] },
      });

      const result = await service.loadPresentation(artifact, {
        approvedCatalogAssetIds: ['static_catalog_icon_star'],
      });
      expect(result.status).toBe('success');
    });
  });

  describe('4. 수명 관리(Generation, AbortSignal) 및 안전 복귀(Whole-Snapshot Fallback)', () => {
    it('AbortSignal에 의해 취소된 요청은 cancelled 상태를 반환한다', async () => {
      const service = new UIPresentationLoadService();
      const controller = new AbortController();
      controller.abort('User explicitly aborted');

      const artifact = createValidTestArtifact();
      const result = await service.loadPresentation(artifact, { signal: controller.signal });

      expect(result.status).toBe('cancelled');
      if (result.status === 'cancelled') {
        expect(result.reason).toBe('aborted');
      }
    });

    it('지연(stale) 응답 또는 응답 역전(race condition) 시 최신 요청만 유지한다', async () => {
      const service = new UIPresentationLoadService();
      const artifact1 = createValidTestArtifact({ sourceRevision: 1 });
      const artifact2 = createValidTestArtifact({ sourceRevision: 2 });

      // Simulate concurrent loads where request 1 is delayed
      const p1 = service.loadPresentation(artifact1);
      const p2 = service.loadPresentation(artifact2);

      const [res1, res2] = await Promise.all([p1, p2]);

      // Request 1 was superseded
      expect(res1.status).toBe('cancelled');
      expect(res2.status).toBe('success');
      expect(service.currentPresentation).toBeDefined();
    });

    it('반환되는 presentation snapshot은 완전히 Object.freeze 되어 런타임 변형이 차단된다', async () => {
      const service = new UIPresentationLoadService();
      const artifact = createValidTestArtifact();

      const result = await service.loadPresentation(artifact);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(Object.isFrozen(result.presentation)).toBe(true);
        expect(Object.isFrozen(result.presentation.pages)).toBe(true);
        expect(Object.isFrozen(result.presentation.pages.main_home.elements)).toBe(true);

        // Attempt runtime mutation should throw in strict mode
        expect(() => {
          (result.presentation as any).resolution = { width: 999, height: 999 };
        }).toThrow();
      }
    });

    it('손상 시 부분 적용(Partial Apply)은 0건이며, 전체 10페이지 builtin 기본 UI로 즉시 복귀한다', async () => {
      const service = new UIPresentationLoadService();

      // Corrupted presentation with missing pages
      const corruptedInput = {
        kind: UI_PRESENTATION_ARTIFACT_KIND,
        version: UI_PRESENTATION_VERSION,
        resolution: { width: 1080, height: 2160 },
        pages: {
          main_home: { pageId: 'main_home', elements: [] },
          // other 9 pages missing!
        },
      };

      const result = await service.loadPresentation(corruptedInput);
      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        // Fallback MUST have all 10 pages complete
        expect(Object.keys(result.fallbackPresentation.pages)).toHaveLength(10);
        expect(Object.isFrozen(result.fallbackPresentation)).toBe(true);
      }
    });
  });
});
