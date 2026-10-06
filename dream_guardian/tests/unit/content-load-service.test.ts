import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ContentLoadService,
  type IPublishedContentStore,
} from '../../src/core/ContentLoadService.js';
import {
  type PublishedContentPack,
  PUBLISHED_PACK_KIND,
  PUBLISHED_SCHEMA_VERSION,
  computePublishedPackHash,
} from '../../src/data/PublishedContentPack.js';
import { computeContentHash } from '../../src/data/ContentCanonical.js';
import {
  DEFAULT_RULESET_ID,
  V2_PUBLISHABLE_CAPABILITY_PROFILE,
} from '../../src/data/ContentCapabilities.js';
import { AUTHORING_PROJECT_KIND } from '../../src/data/EditorProject.js';

const VALID_RULESET_HASH = computeContentHash(V2_PUBLISHABLE_CAPABILITY_PROFILE);

function createValidPublishedPack(stageId: string = 'ch1', bpm: number = 120): PublishedContentPack {
  const pack: PublishedContentPack = {
    kind: PUBLISHED_PACK_KIND,
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    runtimeContractVersion: '2.0.0',
    rulesetId: DEFAULT_RULESET_ID,
    rulesetHash: VALID_RULESET_HASH,
    compilerVersion: '1.0.0',
    sourceProjectId: 'proj_test_01',
    sourceRevision: 1,
    contentHash: '',
    stages: {
      [stageId]: {
        stageId,
        tempo: { bpm, beatsPerBar: 4 },
        phaseA: {
          starNotes: [
            {
              id: 'star_0',
              slotIndex: 0,
              landingTick: 960,
              landingBeat: 2,
              target: { type: 'cursor', part: 'leftHand', zoneId: 4, instrument: 'hand' },
            },
          ],
          hazard: {
            id: 'hz_a_1',
            hazardType: 'jump',
            requiredAction: 'jump',
          },
          motionGuide: [],
        },
        phaseB: {
          feverNotes: [
            {
              id: 'fever_0',
              landingTick: 960,
              target: { type: 'cursor', part: 'leftHand', zoneId: 4, instrument: 'hand' },
            },
          ],
          hazards: [],
          motionGuide: [],
        },
      },
    },
    metadata: {
      title: 'Valid Published Pack',
      compiledAt: '2026-10-06T00:00:00.000Z',
    },
  };

  pack.contentHash = computePublishedPackHash(pack);
  return pack;
}

function createFallbackPack(): PublishedContentPack {
  return createValidPublishedPack('fallback_ch1', 110);
}

describe('ContentLoadService - Issue #389 [CONTENT-LOAD]', () => {
  let service: ContentLoadService;

  beforeEach(() => {
    service = new ContentLoadService({
      allowedOrigin: 'http://localhost:3000',
    });
  });

  describe('1. 정상 로컬 게시본 로드 및 무결성/해시 검증', () => {
    it('유효한 PublishedContentPack 객체를 정상 로드하고 generation과 success 상태를 반환해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const result = await service.loadPack(validPack);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.generation).toBe(1);
        expect(result.pack.contentHash).toBe(validPack.contentHash);
        expect(service.currentPack).toBeDefined();
        expect(service.currentPack?.contentHash).toBe(validPack.contentHash);
      }
    });

    it('불변성(deepFreeze)이 적용되어 반환된 팩 수정을 시도하면 에러가 발생해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const result = await service.loadPack(validPack);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(() => {
          (result.pack as any).rulesetId = 'tampered';
        }).toThrow();
      }
    });

    it('IPublishedContentStore를 통해 hash로 정상 로드해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const mockStore: IPublishedContentStore = {
        getPublishedPack: vi.fn().mockResolvedValue(validPack),
      };

      const result = await service.loadByHash(validPack.contentHash, { store: mockStore });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.generation).toBe(1);
        expect(result.pack.contentHash).toBe(validPack.contentHash);
        expect(mockStore.getPublishedPack).toHaveBeenCalledWith(validPack.contentHash);
      }
    });

    it('IPublishedContentStore를 통해 projectId의 activePack을 정상 로드해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const mockStore: IPublishedContentStore = {
        getPublishedPack: vi.fn(),
        getActivePack: vi.fn().mockResolvedValue(validPack),
      };

      const result = await service.loadByProjectId('proj_test_01', { store: mockStore });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.pack.contentHash).toBe(validPack.contentHash);
        expect(mockStore.getActivePack).toHaveBeenCalledWith('proj_test_01');
      }
    });

    it('동일 origin의 URL fetch를 통해 정상 로드해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validPack,
      });

      const result = await service.loadFromUrl('/api/packs/ch1.json', { fetchFn: mockFetch as any });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.pack.contentHash).toBe(validPack.contentHash);
      }
    });
  });

  describe('2. 변조된 팩 또는 지원하지 않는 ruleset 버전 거부 및 fallback 반환', () => {
    it('contentHash가 실제 내용과 불일치(변조)할 경우 fallback을 반환해야 한다', async () => {
      const tamperedPack = createValidPublishedPack();
      tamperedPack.sourceRevision = 999; // payload 변조 (contentHash는 재계산 안함)

      const fallback = createFallbackPack();
      const result = await service.loadPack(tamperedPack, { fallbackPack: fallback });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('tampered-content-hash');
        expect(result.diagnostic).toContain('Tampered content');
        expect(result.fallbackPack?.contentHash).toBe(fallback.contentHash);
        expect(result.generation).toBe(1);
      }
    });

    it('지원하지 않는 rulesetId인 경우 fallback을 반환해야 한다', async () => {
      const badPack = createValidPublishedPack();
      (badPack as any).rulesetId = 'unknown-ruleset-v999';
      badPack.contentHash = computePublishedPackHash(badPack);

      const result = await service.loadPack(badPack);

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('unsupported-ruleset');
        expect(result.diagnostic).toContain('ruleset');
      }
    });

    it('지원하지 않는 rulesetHash인 경우 fallback을 반환해야 한다', async () => {
      const badPack = createValidPublishedPack();
      badPack.rulesetHash = '0'.repeat(64);
      badPack.contentHash = computePublishedPackHash(badPack);

      const result = await service.loadPack(badPack);

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('unsupported-ruleset-hash');
        expect(result.diagnostic).toContain('Ruleset hash mismatch');
      }
    });

    it('필수 페이즈(phaseA/phaseB)가 누락된 불완전 팩은 fallback을 반환해야 한다', async () => {
      const incompletePack = createValidPublishedPack();
      incompletePack.stages.ch1.phaseA = undefined;
      incompletePack.contentHash = computePublishedPackHash(incompletePack);

      const result = await service.loadPack(incompletePack);

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('incomplete-pack');
      }
    });
  });

  describe('3. 편집 원본 초안(EditorProject) 또는 UIX 파일, 레거시 V1 키 수신 차단', () => {
    it('에디터 작성 초안(dream-guardian-authoring-project) 전달 시 거부해야 한다', async () => {
      const authoringDraft = {
        kind: AUTHORING_PROJECT_KIND,
        schemaVersion: 2,
        projectId: 'draft_01',
      };

      const result = await service.loadPack(authoringDraft);

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('rejected-authoring-project');
        expect(result.diagnostic).toContain('draft');
      }
    });

    it('UIX 프로젝트 파일(dream-guardian-ui-project) 전달 시 거부해야 한다', async () => {
      const uixProject = {
        kind: 'dream-guardian-ui-project',
        schemaVersion: '1.0.0',
        design: {},
      };

      const result = await service.loadPack(uixProject);

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('rejected-uix-content');
      }
    });

    it('UIX 전송 파일(dream-guardian-ui-transfer) 전달 시 거부해야 한다', async () => {
      const uixTransfer = {
        kind: 'dream-guardian-ui-transfer',
        sourceId: 'transfer_01',
      };

      const result = await service.loadPack(uixTransfer);

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('rejected-uix-content');
      }
    });

    it('레거시 V1 형식({ version: "1.0.0", patterns, sequences }) 전달 시 거부해야 한다', async () => {
      const legacyV1 = {
        version: '1.0.0',
        patterns: [],
        bpm: 120,
        sequences: { RUN_QUESTION: [] },
      };

      const result = await service.loadPack(legacyV1);

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('rejected-legacy-v1');
      }
    });

    it('레거시 LocalStorage 키 문자열이나 알 수 없는 kind 전달 시 거부해야 한다', async () => {
      const result1 = await service.loadPack('fitness_dance_routine_editor_data');
      expect(result1.status).toBe('fallback');

      const result2 = await service.loadPack({ kind: 'random-kind' });
      expect(result2.status).toBe('fallback');
      if (result2.status === 'fallback') {
        expect(result2.reason).toBe('invalid-pack-kind');
      }
    });
  });

  describe('4. 잘못된 origin / 외부 포트 / 원격 업로드 요청 차단', () => {
    it('다른 호스트/도메인의 cross-origin URL 요청 시 거부해야 한다', async () => {
      const mockFetch = vi.fn();
      const result = await service.loadFromUrl('https://malicious-external-site.com/pack.json', {
        fetchFn: mockFetch as any,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('cross-origin-forbidden');
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('다른 포트(예: 8080 vs allowed 3000)의 URL 요청 시 거부해야 한다', async () => {
      const mockFetch = vi.fn();
      const result = await service.loadFromUrl('http://localhost:8080/pack.json', {
        fetchFn: mockFetch as any,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('cross-origin-forbidden');
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('javascript: 또는 data: 등 비정상 프로토콜 URL 요청 시 거부해야 한다', async () => {
      const mockFetch = vi.fn();
      const result = await service.loadFromUrl('javascript:alert(1)', {
        fetchFn: mockFetch as any,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('cross-origin-forbidden');
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('5. 요청 취소(AbortController) 및 비동기 응답 역전(Out-of-order response) 폐기', () => {
    it('외부 signal이 abort되면 cancelled 상태를 반환해야 한다', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await service.loadPack(createValidPublishedPack(), {
        signal: controller.signal,
      });

      expect(result.status).toBe('cancelled');
      if (result.status === 'cancelled') {
        expect(result.generation).toBe(1);
      }
    });

    it('cancelCurrentRequest() 호출 시 진행 중인 요청이 취소되어야 한다', async () => {
      const mockStore: IPublishedContentStore = {
        getPublishedPack: vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(createValidPublishedPack()), 100)),
        ),
      };

      const loadPromise = service.loadByHash('hash_delay', { store: mockStore });
      service.cancelCurrentRequest('User cancelled');

      const result = await loadPromise;
      expect(result.status).toBe('cancelled');
    });

    it('이전 비동기 요청보다 새로운 요청이 먼저/나중에 완료되더라도 이전 응답은 폐기(Out-of-order 방지)되어야 한다', async () => {
      const slowPack = createValidPublishedPack('slow_stage');
      const fastPack = createValidPublishedPack('fast_stage');

      const mockStoreSlow: IPublishedContentStore = {
        getPublishedPack: vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(slowPack), 50)),
        ),
      };
      const mockStoreFast: IPublishedContentStore = {
        getPublishedPack: vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(fastPack), 5)),
        ),
      };

      // Request 1: slow (generation 1)
      const promise1 = service.loadByHash(slowPack.contentHash, { store: mockStoreSlow });
      // Request 2: fast (generation 2)
      const promise2 = service.loadByHash(fastPack.contentHash, { store: mockStoreFast });

      const result2 = await promise2;
      const result1 = await promise1;

      // Fast request (generation 2) should succeed
      expect(result2.status).toBe('success');
      if (result2.status === 'success') {
        expect(result2.generation).toBe(2);
        expect(result2.pack.stages.fast_stage).toBeDefined();
      }

      // Slow request (generation 1) was superseded by generation 2 and must be cancelled/discarded
      expect(result1.status).toBe('cancelled');
      if (result1.status === 'cancelled') {
        expect(result1.generation).toBe(1);
      }

      // The service's currentPack must be the latest (fastPack), NOT overwritten by slowPack
      expect(service.currentPack?.stages.fast_stage).toBeDefined();
      expect(service.currentPack?.stages.slow_stage).toBeUndefined();
    });
  });

  describe('6. DB/스토리지 로드 에러 시 진단 정보와 함께 fallback 반환', () => {
    it('스토어에서 팩을 찾을 수 없는 경우(null 반환) fallback을 반환해야 한다', async () => {
      const mockStore: IPublishedContentStore = {
        getPublishedPack: vi.fn().mockResolvedValue(null),
      };

      const result = await service.loadByHash('non_existent_hash', { store: mockStore });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('pack-not-found');
        expect(result.diagnostic).toContain('non_existent_hash');
      }
    });

    it('스토어가 예외를 던질 경우 fallback 및 진단 정보를 반환해야 한다', async () => {
      const mockStore: IPublishedContentStore = {
        getPublishedPack: vi.fn().mockRejectedValue(new Error('IndexedDB TransactionInactiveError')),
      };

      const result = await service.loadByHash('err_hash', { store: mockStore });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('store-error');
        expect(result.diagnostic).toContain('TransactionInactiveError');
      }
    });

    it('URL fetch가 404를 반환할 경우 fallback을 반환해야 한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await service.loadFromUrl('/api/packs/missing.json', { fetchFn: mockFetch as any });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('fetch-failed');
        expect(result.diagnostic).toContain('404');
      }
    });
  });
});
