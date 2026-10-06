/**
 * tests/integration/content-manifest-load.test.ts
 *
 * [Issue #403 / CONTENT-DEPLOY]
 * 정적 manifest 적용본 수신·검증 및 기본 콘텐츠 복귀 통합 테스트
 *
 * 검증 매트릭스:
 * 1. 정상 static manifest 및 팩 수신, 전체 검증 및 스냅샷 생성 검증
 * 2. 404 Not Found 및 네트워크 오류 시 whole-pack fallback (builtin 모드 복귀) 검증
 * 3. 손상된 JSON 및 부분 배포 (Partial Deployment) 감지 시 whole-pack fallback 검증
 * 4. Hash 변조/불일치 및 Stale Cache (캐시 불일치) 감지 시 거부 및 fallback 검증
 * 5. 로컬 테스트 오버라이드는 test 모드에서만 동작하는 격리 검증
 * 6. AppBootstrap 정적 manifest 수신 연동 및 기본 모드 안전 복귀 검증
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ContentLoadService,
  STATIC_MANIFEST_VERSION,
  type StaticContentManifest,
} from '../../src/core/ContentLoadService.js';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
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

const VALID_RULESET_HASH = computeContentHash(V2_PUBLISHABLE_CAPABILITY_PROFILE);

function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    roundRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  return {
    getContext: vi.fn(() => ctx),
    width: 1280,
    height: 720,
    clientWidth: 1280,
    clientHeight: 720,
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 1280, height: 720 })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

function createValidPublishedPack(stageId: string = 'ch1', bpm: number = 120): PublishedContentPack {
  const pack: PublishedContentPack = {
    kind: PUBLISHED_PACK_KIND,
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    runtimeContractVersion: '2.0.0',
    rulesetId: DEFAULT_RULESET_ID,
    rulesetHash: VALID_RULESET_HASH,
    compilerVersion: '1.0.0',
    sourceProjectId: 'proj_deploy_test',
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
      title: 'Valid Static Deployment Pack',
      compiledAt: '2026-10-06T00:00:00.000Z',
    },
  };

  pack.contentHash = computePublishedPackHash(pack);
  return pack;
}

function createValidManifest(pack: PublishedContentPack, packPath?: string): StaticContentManifest {
  return {
    kind: 'dream-guardian-static-manifest',
    manifestVersion: STATIC_MANIFEST_VERSION,
    contentHash: pack.contentHash,
    rulesetId: pack.rulesetId,
    rulesetHash: pack.rulesetHash,
    runtimeContractVersion: pack.runtimeContractVersion,
    packPath: packPath ?? 'content/ch1-pack.json',
    stages: Object.keys(pack.stages),
    metadata: {
      title: 'Production Content Release',
      deployedAt: '2026-10-06T12:00:00.000Z',
      version: '1.0.0',
    },
  };
}

describe('Issue #403 / CONTENT-DEPLOY - 정적 manifest 수신·검증 및 기본 콘텐츠 복귀', () => {
  let service: ContentLoadService;

  beforeEach(() => {
    service = new ContentLoadService({
      allowedOrigin: 'http://localhost:3000',
    });
  });

  describe('1. 정상 static manifest 및 팩 수신, 전체 검증 및 스냅샷 생성', () => {
    it('manifest와 packPath를 통해 정상적으로 수신하고 불변 스냅샷을 생성해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const validManifest = createValidManifest(validPack, 'content/ch1-pack.json');

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url === 'http://localhost:3000/content/manifest.json') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(validManifest),
          });
        }
        if (url === 'http://localhost:3000/content/ch1-pack.json') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(validPack),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.generation).toBe(1);
        expect(result.pack.contentHash).toBe(validPack.contentHash);
        expect(service.currentPack).toBeDefined();
        expect(service.currentPack?.contentHash).toBe(validPack.contentHash);

        // 불변 스냅샷(deepFreeze) 검증
        expect(() => {
          (result.pack as any).rulesetId = 'tampered';
        }).toThrow();
      }
    });

    it('manifest에 inline pack이 포함된 경우 추가 fetch 없이 바로 검증 후 수신해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const validManifest = createValidManifest(validPack);
      validManifest.pack = validPack;
      delete (validManifest as any).packPath;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(validManifest),
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.pack.contentHash).toBe(validPack.contentHash);
      }
    });
  });

  describe('2. 404 Not Found 및 네트워크 오류 시 whole-pack fallback', () => {
    it('manifest URL이 404 Not Found이면 fallback을 반환하고 기본 builtin 모드로 복귀해야 한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('manifest-not-found');
        expect(result.fallbackPack).toBeUndefined();
      }
    });

    it('fetch 중 네트워크 에러 발생 시 fallback을 반환해야 한다', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection failed'));

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('fetch-failed');
        expect(result.diagnostic).toContain('Network connection failed');
      }
    });

    it('오프라인/에러 발생 시 이전 정상본(previousHealthyPack)이 있으면 해당 팩으로 whole-pack fallback해야 한다', async () => {
      const healthyPack = createValidPublishedPack('ch1', 128);
      const healthyManifest = createValidManifest(healthyPack);
      healthyManifest.pack = healthyPack;

      // 1회차 성공 로드 -> previousHealthyPack 등록
      const successFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(healthyManifest),
      });
      const firstResult = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: successFetch as unknown as typeof fetch,
      });
      expect(firstResult.status).toBe('success');

      // 2회차 요청에서 404 발생
      const failFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      const secondResult = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: failFetch as unknown as typeof fetch,
      });

      expect(secondResult.status).toBe('fallback');
      if (secondResult.status === 'fallback') {
        expect(secondResult.fallbackPack).toBeDefined();
        expect(secondResult.fallbackPack?.contentHash).toBe(healthyPack.contentHash);
      }
    });
  });

  describe('3. 손상된 JSON 및 부분 배포(Partial Deployment) 감지 시 whole-pack fallback', () => {
    it('manifest JSON이 파싱 불가능한 손상된 데이터면 fallback을 반환해야 한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('corrupted-json');
      }
    });

    it('manifest는 정상이나 packPath 리소스가 404인 부분 배포 결함 시 fallback을 반환해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const validManifest = createValidManifest(validPack, 'content/missing-pack.json');

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('manifest.json')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(validManifest),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('partial-deployment');
      }
    });

    it('manifest에 명시된 stages 중 일부가 pack에 누락된 경우 부분 배포로 거부해야 한다', async () => {
      const validPack = createValidPublishedPack('ch1');
      const manifestWithExtraStages = createValidManifest(validPack);
      manifestWithExtraStages.pack = validPack;
      // pack에는 ch1만 있으나 manifest는 ch1, ch2 요구
      manifestWithExtraStages.stages = ['ch1', 'ch2'];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(manifestWithExtraStages),
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('incomplete-pack');
        expect(result.diagnostic).toContain('ch2');
      }
    });
  });

  describe('4. Hash 변조/불일치 및 Stale Cache 감지 시 거부 및 fallback', () => {
    it('manifest의 contentHash와 pack의 contentHash가 불일치(stale cache)하면 거부해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const staleManifest = createValidManifest(validPack);
      // CDN/브라우저 캐시 불일치 시뮬레이션: manifest는 구버전 hash 유지
      staleManifest.contentHash = 'a'.repeat(64);
      staleManifest.pack = validPack;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(staleManifest),
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('stale-cache');
      }
    });

    it('pack 내부 페이로드 해시 변조 시 거부해야 한다', async () => {
      const tamperedPack = createValidPublishedPack();
      const ch1Stage = tamperedPack.stages.ch1;
      if (ch1Stage && ch1Stage.tempo) {
        ch1Stage.tempo.bpm = 999; // 변조 (contentHash는 재계산하지 않음)
      }
      const manifest = createValidManifest(tamperedPack);
      manifest.pack = tamperedPack;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(manifest),
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(['tampered-pack', 'tampered-content-hash']).toContain(result.reason);
      }
    });

    it('manifestVersion이 지원 버전을 벗어나면 거부해야 한다', async () => {
      const validPack = createValidPublishedPack();
      const invalidManifest = createValidManifest(validPack);
      (invalidManifest as any).manifestVersion = 99;
      invalidManifest.pack = validPack;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidManifest),
      });

      const result = await service.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('unsupported-manifest-version');
      }
    });
  });

  describe('5. 로컬 테스트 오버라이드 격리 검증 (명시적 test mode 전용)', () => {
    it('isTestMode가 활성화되지 않은 일반 운영 상태에서 로컬 팩 오버라이드 요청 시 차단되어야 한다', async () => {
      const validPack = createValidPublishedPack();
      const mockStore = {
        getPublishedPack: vi.fn().mockResolvedValue(validPack),
      };

      const result = await service.loadLocalTestOverride(validPack.contentHash, {
        store: mockStore,
        isTestMode: false,
      });

      expect(result.status).toBe('fallback');
      if (result.status === 'fallback') {
        expect(result.reason).toBe('test-override-forbidden');
        expect(result.diagnostic).toContain('test mode');
      }
    });

    it('isTestMode가 명시적으로 활성화된 경우 로컬 팩 오버라이드가 허용되어야 한다', async () => {
      const validPack = createValidPublishedPack();
      const mockStore = {
        getPublishedPack: vi.fn().mockResolvedValue(validPack),
      };

      const result = await service.loadLocalTestOverride(validPack.contentHash, {
        store: mockStore,
        isTestMode: true,
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.pack.contentHash).toBe(validPack.contentHash);
      }
    });
  });

  describe('6. AppBootstrap 연동 검증', () => {
    it('AppBootstrap에서 정적 manifest를 성공적으로 수신하면 activePublishedPack으로 등록된다', async () => {
      const validPack = createValidPublishedPack();
      const manifest = createValidManifest(validPack);
      manifest.pack = validPack;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(manifest),
      });

      const canvas = createMockCanvas();
      const app = new AppBootstrap({ canvas });

      const loadSuccess = await app.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(loadSuccess).toBe(true);
      expect(app.activePublishedPack).toBeDefined();
      expect(app.activePublishedPack?.contentHash).toBe(validPack.contentHash);
    });

    it('정적 manifest 로드 실패 시 activePublishedPack은 null로 유지되고 안전하게 builtin 모드로 동작한다', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const canvas = createMockCanvas();
      const app = new AppBootstrap({ canvas });

      const loadSuccess = await app.loadStaticManifest('http://localhost:3000/content/manifest.json', {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(loadSuccess).toBe(false);
      expect(app.activePublishedPack).toBeNull();
    });

    it('일반 세션에서 app.loadLocalTestOverride 호출 시 차단되어야 한다', async () => {
      const validPack = createValidPublishedPack();
      const mockStore = {
        getPublishedPack: vi.fn().mockResolvedValue(validPack),
      };

      const canvas = createMockCanvas();
      const app = new AppBootstrap({ canvas });

      const success = await app.loadLocalTestOverride(validPack.contentHash, {
        store: mockStore,
        isTestMode: false,
      });

      expect(success).toBe(false);
      expect(app.activePublishedPack).toBeNull();
    });
  });
});
