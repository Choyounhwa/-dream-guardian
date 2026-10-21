import { describe, it, expect, beforeEach } from 'vitest';
import { ContentPackValidator } from '../../src/core/content/ContentPackValidator.js';
import { ContentCacheManager } from '../../src/core/content/ContentCacheManager.js';
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
import {
  STATIC_MANIFEST_VERSION,
  type StaticContentManifest,
} from '../../src/core/ContentLoadService.js';

const VALID_RULESET_HASH = computeContentHash(V2_PUBLISHABLE_CAPABILITY_PROFILE);

function createValidPack(stageId: string = 'ch1', bpm: number = 120): PublishedContentPack {
  const pack: PublishedContentPack = {
    kind: PUBLISHED_PACK_KIND,
    schemaVersion: PUBLISHED_SCHEMA_VERSION,
    runtimeContractVersion: '2.0.0',
    rulesetId: DEFAULT_RULESET_ID,
    rulesetHash: VALID_RULESET_HASH,
    compilerVersion: '1.0.0',
    sourceProjectId: 'proj_validator_test',
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
          hazards: [],
          feverNotes: [],
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

function createValidManifest(pack: PublishedContentPack): StaticContentManifest {
  return {
    manifestVersion: STATIC_MANIFEST_VERSION,
    contentHash: pack.contentHash,
    rulesetId: pack.rulesetId,
    rulesetHash: pack.rulesetHash,
    runtimeContractVersion: pack.runtimeContractVersion,
    packPath: 'packs/test.json',
    stages: Object.keys(pack.stages),
  };
}

describe('ContentPackValidator', () => {
  let validator: ContentPackValidator;

  beforeEach(() => {
    validator = new ContentPackValidator();
  });

  describe('1. 스키마 무결성 검증 (Schema Validation)', () => {
    it('null 또는 원시 타입 입력 시 invalid-input-type 반환', () => {
      const resNull = validator.validatePackContent(null);
      expect(resNull.valid).toBe(false);
      if (!resNull.valid) {
        expect(resNull.reason).toBe('invalid-input-type');
      }

      const resString = validator.validatePackContent('not-an-object');
      expect(resString.valid).toBe(false);
      if (!resString.valid) {
        expect(resString.reason).toBe('invalid-input-type');
      }
    });

    it('에디터 저작 초안(dream-guardian-authoring-project) 전달 시 거부', () => {
      const res = validator.validatePackContent({
        kind: 'dream-guardian-authoring-project',
        schemaVersion: '2.0.0',
      });
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.reason).toBe('rejected-authoring-project');
      }
    });

    it('UIX 전송 파일 및 프로젝트 전달 시 거부', () => {
      const res1 = validator.validatePackContent({
        kind: 'dream-guardian-ui-project',
      });
      expect(res1.valid).toBe(false);
      if (!res1.valid) {
        expect(res1.reason).toBe('rejected-uix-content');
      }

      const res2 = validator.validatePackContent({
        kind: 'dream-guardian-ui-transfer',
      });
      expect(res2.valid).toBe(false);
      if (!res2.valid) {
        expect(res2.reason).toBe('rejected-uix-content');
      }
    });

    it('레거시 V1 포맷 전달 시 거부', () => {
      const res = validator.validatePackContent({
        version: '1.0.0',
        patterns: [],
        sequences: {},
      });
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.reason).toBe('rejected-legacy-v1');
      }
    });

    it('필수 필드 누락 시 missing-required-fields 반환', () => {
      const incomplete = {
        kind: PUBLISHED_PACK_KIND,
        schemaVersion: PUBLISHED_SCHEMA_VERSION,
        // missing rulesetId, contentHash, stages, etc.
      };
      const res = validator.validatePackContent(incomplete);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.reason).toBe('missing-required-fields');
      }
    });

    it('정상 팩 검증 통과 및 deepFreeze 불변 객체 반환', () => {
      const validPack = createValidPack();
      const res = validator.validatePackContent(validPack);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.pack.contentHash).toBe(validPack.contentHash);
        expect(Object.isFrozen(res.pack)).toBe(true);
      }
    });
  });

  describe('2. 룰셋 호환성 검증 (Ruleset Compatibility)', () => {
    it('지원되지 않는 runtimeContractVersion 거부', () => {
      const pack = createValidPack();
      (pack as any).runtimeContractVersion = '99.0.0';
      pack.contentHash = computePublishedPackHash(pack);

      const res = validator.validatePackContent(pack);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.reason).toBe('unsupported-runtime-version');
      }
    });

    it('지원되지 않는 rulesetId 거부', () => {
      const pack = createValidPack();
      (pack as any).rulesetId = 'unknown-ruleset-xyz';
      pack.contentHash = computePublishedPackHash(pack);

      const res = validator.validatePackContent(pack);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.reason).toBe('unsupported-ruleset');
      }
    });

    it('변조된 rulesetHash 거부', () => {
      const pack = createValidPack();
      (pack as any).rulesetHash = '0000000000000000000000000000000000000000000000000000000000000000';
      pack.contentHash = computePublishedPackHash(pack);

      const res = validator.validatePackContent(pack);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.reason).toBe('unsupported-ruleset-hash');
      }
    });
  });

  describe('3. 해시 다이제스트 무결성 검증 (Hash Digest Validation)', () => {
    it('contentHash가 실제 내용과 불일치(변조)할 경우 tampered-content-hash 반환', () => {
      const pack = createValidPack();
      pack.contentHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const res = validator.validatePackContent(pack);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.reason).toBe('tampered-content-hash');
      }
    });

    it('validatePackHash() 헬퍼가 변조 여부를 boolean으로 정확히 반환', () => {
      const pack = createValidPack();
      expect(validator.validatePackHash(pack)).toBe(true);

      pack.stages.ch1!.tempo!.bpm = 999; // mutate without updating hash
      expect(validator.validatePackHash(pack)).toBe(false);
    });
  });

  describe('4. 정적 매니페스트 및 매니페스트-팩 정합성 검증', () => {
    it('유효한 매니페스트 검증 통과', () => {
      const pack = createValidPack();
      const manifest = createValidManifest(pack);
      const res = validator.validateManifest(manifest);
      expect(res.valid).toBe(true);
    });

    it('매니페스트 contentHash 길이가 64자 hex가 아니면 invalid-manifest-hash 반환', () => {
      const pack = createValidPack();
      const manifest = createValidManifest(pack);
      manifest.contentHash = 'short-hash';

      const res = validator.validateManifest(manifest);
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.reason).toBe('invalid-manifest-hash');
      }
    });

    it('매니페스트와 팩의 contentHash 불일치 시 hash-mismatch 반환', () => {
      const pack = createValidPack('ch1');
      const otherPack = createValidPack('ch2');
      const manifest = createValidManifest(pack);

      const match = validator.validatePackAgainstManifest(otherPack, manifest);
      expect(match.valid).toBe(false);
      if (!match.valid) {
        expect(match.reason).toBe('hash-mismatch');
      }
    });

    it('매니페스트에 선언된 stage가 팩에 누락된 경우 incomplete-pack 반환', () => {
      const pack = createValidPack('ch1');
      const manifest = createValidManifest(pack);
      manifest.stages = ['ch1', 'ch2_missing'];

      const match = validator.validatePackAgainstManifest(pack, manifest);
      expect(match.valid).toBe(false);
      if (!match.valid) {
        expect(match.reason).toBe('incomplete-pack');
      }
    });
  });

  describe('5. URL Origin 보안 검증', () => {
    it('상대 경로는 동일 origin으로 유효 판정', () => {
      expect(validator.validateUrlOrigin('/content/manifest.json')).toEqual({ valid: true });
    });

    it('위험 프로토콜(javascript, data)은 차단', () => {
      expect(validator.validateUrlOrigin('javascript:alert(1)').valid).toBe(false);
      expect(validator.validateUrlOrigin('data:application/json;base64,...').valid).toBe(false);
    });

    it('cross-origin URL은 allowedOrigin과 불일치 시 차단', () => {
      const res = validator.validateUrlOrigin('http://attacker.com/pack.json', 'http://localhost:3000');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Cross-origin');
    });
  });
});

describe('ContentCacheManager', () => {
  let cacheManager: ContentCacheManager;

  beforeEach(() => {
    cacheManager = new ContentCacheManager();
  });

  describe('1. 팩 저장, 조회, 존재 여부 확인', () => {
    it('팩을 저장하고 contentHash 및 sourceProjectId로 조회할 수 있어야 한다', () => {
      const pack = createValidPack('stage1');
      cacheManager.store(pack);

      expect(cacheManager.has(pack.contentHash)).toBe(true);
      expect(cacheManager.get(pack.contentHash)).toBe(pack);
      expect(cacheManager.getByProjectId(pack.sourceProjectId)).toBe(pack);
      expect(cacheManager.size).toBe(1);
    });

    it('존재하지 않는 해시 조회 시 null 반환', () => {
      expect(cacheManager.get('non_existent')).toBeNull();
      expect(cacheManager.has('non_existent')).toBe(false);
      expect(cacheManager.getByProjectId('unknown_proj')).toBeNull();
    });
  });

  describe('2. 활성 팩(currentPack) 및 이전 정상본(previousHealthyPack) 관리', () => {
    it('currentPack 설정 및 조회', () => {
      const pack = createValidPack();
      expect(cacheManager.currentPack).toBeNull();

      cacheManager.setCurrentPack(pack);
      expect(cacheManager.currentPack).toBe(pack);
    });

    it('previousHealthyPack 설정 및 fallback 우선순위 해석(resolveFallback)', () => {
      const healthyPack = createValidPack('healthy');
      const defaultFallback = createValidPack('default');
      const optionFallback = createValidPack('option');

      // 1) 아무것도 없을 때 defaultFallback
      expect(cacheManager.resolveFallback(undefined, defaultFallback)).toBe(defaultFallback);

      // 2) previousHealthyPack 등록 시 defaultFallback보다 우선
      cacheManager.setPreviousHealthyPack(healthyPack);
      expect(cacheManager.resolveFallback(undefined, defaultFallback)).toBe(healthyPack);

      // 3) 호출자 지정 optionFallback이 있으면 최우선
      expect(cacheManager.resolveFallback(optionFallback, defaultFallback)).toBe(optionFallback);
    });

    it('setLastResult(success) 호출 시 currentPack 갱신 및 캐시 자동 저장', () => {
      const pack = createValidPack();
      cacheManager.setLastResult({
        status: 'success',
        pack,
        generation: 1,
      });

      expect(cacheManager.lastResult?.status).toBe('success');
      expect(cacheManager.currentPack).toBe(pack);
      expect(cacheManager.has(pack.contentHash)).toBe(true);
    });
  });

  describe('3. 캐시 무효화 및 초기화', () => {
    it('특정 contentHash 무효화 시 캐시 및 활성 팩 제거', () => {
      const pack1 = createValidPack('p1');
      const pack2 = createValidPack('p2');
      cacheManager.store(pack1);
      cacheManager.store(pack2);
      cacheManager.setCurrentPack(pack1);
      cacheManager.setPreviousHealthyPack(pack1);

      cacheManager.invalidate(pack1.contentHash);

      expect(cacheManager.has(pack1.contentHash)).toBe(false);
      expect(cacheManager.has(pack2.contentHash)).toBe(true);
      expect(cacheManager.currentPack).toBeNull();
      expect(cacheManager.previousHealthyPack).toBeNull();
      expect(cacheManager.size).toBe(1);
    });

    it('clear() 호출 시 모든 캐시와 활성/정상본 상태 리셋', () => {
      const pack = createValidPack();
      cacheManager.store(pack);
      cacheManager.setCurrentPack(pack);
      cacheManager.setPreviousHealthyPack(pack);
      cacheManager.setLastResult({ status: 'success', pack, generation: 1 });

      cacheManager.clear();

      expect(cacheManager.size).toBe(0);
      expect(cacheManager.currentPack).toBeNull();
      expect(cacheManager.previousHealthyPack).toBeNull();
      expect(cacheManager.lastResult).toBeNull();
      expect(cacheManager.has(pack.contentHash)).toBe(false);
    });
  });
});
