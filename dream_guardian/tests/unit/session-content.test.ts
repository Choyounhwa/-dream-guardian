import { describe, it, expect, beforeEach } from 'vitest';
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
import { ContentProvider } from '../../src/game/ContentProvider.js';
import {
  type SessionRoleBinding,
  type SessionPhaseRole,
} from '../../src/game/SessionContent.js';

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
            {
              id: 'star_1',
              slotIndex: 1,
              landingTick: 1440,
              landingBeat: 3,
              target: { type: 'cursor', part: 'rightHand', zoneId: 5, instrument: 'hand' },
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
          hazards: [
            {
              id: 'hz_b_1',
              attackType: 'dual_slam',
              requiredAction: 'jump',
              warningDurationSeconds: 1.5,
              activeDurationSeconds: 0.5,
              damage: 15,
            },
          ],
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

describe('Issue #388: SessionContent & ContentProvider', () => {
  let provider: ContentProvider;

  beforeEach(() => {
    provider = new ContentProvider();
  });

  describe('1. 완전한 Stage Bundle 스냅샷 고정 및 세션 불변성 (Deep Immutability)', () => {
    it('유효한 PublishedContentPack을 SessionStageBundle로 해석하고 모든 구조를 deepFreeze로 고정한다', () => {
      const pack = createValidPublishedPack('ch1', 120);
      const session = provider.resolveSessionStage({ pack, stageId: 'ch1', seed: 12345 });

      expect(session).toBeDefined();
      expect(session.stageId).toBe('ch1');
      expect(session.bpm).toBe(120);
      expect(session.secondsPerBeat).toBeCloseTo(0.5);
      expect(session.isFallback).toBe(false);
      expect(session.sourcePackHash).toBe(pack.contentHash);

      // Deep Freeze 검증
      expect(Object.isFrozen(session)).toBe(true);
      expect(Object.isFrozen(session.phaseA)).toBe(true);
      expect(Object.isFrozen(session.phaseA.starNotes)).toBe(true);
      expect(Object.isFrozen(session.phaseA.starNotes[0])).toBe(true);
      expect(Object.isFrozen(session.phaseB)).toBe(true);
      expect(Object.isFrozen(session.phaseB.feverNotes)).toBe(true);
      expect(Object.isFrozen(session.phaseB.hazards)).toBe(true);
    });

    it('세션 생성 후 원본 pack 객체가 변경되거나 외부에서 조작되어도 이미 생성된 세션 스냅샷은 전혀 영향받지 않는다', () => {
      const pack = createValidPublishedPack('ch1', 120);
      const session = provider.resolveSessionStage({ pack, stageId: 'ch1', seed: 42 });

      // 원본 pack을 사후 변조 시도
      (pack.stages.ch1.tempo as any).bpm = 999;
      pack.stages.ch1.phaseA!.starNotes!.push({
        id: 'star_injected',
        slotIndex: 99,
        landingTick: 9999,
        landingBeat: 99,
        target: { type: 'cursor', zoneId: 1 },
      });

      // 세션 스냅샷은 불변 유지
      expect(session.bpm).toBe(120);
      expect(session.phaseA.starNotes.length).toBe(2);
      expect(session.phaseA.starNotes.some((n) => n.id === 'star_injected')).toBe(false);
    });

    it('세션 스냅샷의 속성을 직접 수정하려 하면 엄격 모드에서 에러가 발생하거나 불변이 유지된다', () => {
      const pack = createValidPublishedPack('ch1', 120);
      const session = provider.resolveSessionStage({ pack, stageId: 'ch1' });

      expect(() => {
        (session as any).bpm = 150;
      }).toThrow();

      expect(() => {
        (session.phaseA.starNotes as any).push({ id: 'illegal' });
      }).toThrow();

      expect(() => {
        (session.phaseA.hazard as any).hazardType = 'balance';
      }).toThrow();

      expect(() => {
        (session.phaseB.hazards as any)[0].damage = 999;
      }).toThrow();
    });

    it('10문제(Phase A)와 Phase B 동안 동일한 contentHash, rulesetId, rulesetHash, bpm이 고정 유지된다', () => {
      const pack = createValidPublishedPack('ch1', 125);
      const session = provider.resolveSessionStage({ pack, stageId: 'ch1', seed: 100 });

      expect(session.contentHash).toBe(pack.contentHash);
      expect(session.rulesetId).toBe(DEFAULT_RULESET_ID);
      expect(session.rulesetHash).toBe(pack.rulesetHash);
      expect(session.bpm).toBe(125);
    });
  });

  describe('2. 불완전하거나 손상된 bundle 거부 및 whole-pack fallback', () => {
    it('contentHash가 변조된 손상 팩은 전체 거부하고 fallbackPack으로 whole-pack fallback한다', () => {
      const validFallback = createValidPublishedPack('ch1', 115);
      const tamperedPack = createValidPublishedPack('ch1', 120);
      tamperedPack.contentHash = 'tampered_invalid_hash_value';

      const session = provider.resolveSessionStage({
        pack: tamperedPack,
        fallbackPack: validFallback,
        stageId: 'ch1',
      });

      expect(session.isFallback).toBe(true);
      expect(session.sourcePackHash).toBe(validFallback.contentHash);
      expect(session.bpm).toBe(115);
      expect(session.fallbackReason).toContain('checksum');
    });

    it('요청한 stageId가 팩에 누락된 경우 부분 조합 없이 whole-pack fallback한다', () => {
      const pack = createValidPublishedPack('ch1', 120);
      const session = provider.resolveSessionStage({
        pack,
        stageId: 'ch2', // ch2는 pack에 없음
      });

      expect(session.isFallback).toBe(true);
      expect(session.isBuiltin).toBe(true);
      expect(session.stageId).toBe('ch2');
      expect(session.fallbackReason).toContain('missing stage');
    });

    it('phaseA는 있으나 phaseB가 누락된 불완전 팩은 CSV나 다른 소스로 누더기 조합하지 않고 whole-pack 거부한다', () => {
      const incompletePack = createValidPublishedPack('ch1', 120);
      delete (incompletePack.stages.ch1 as any).phaseB; // phaseB 제거
      incompletePack.contentHash = computePublishedPackHash(incompletePack);

      const session = provider.resolveSessionStage({
        pack: incompletePack,
        stageId: 'ch1',
      });

      expect(session.isFallback).toBe(true);
      expect(session.isBuiltin).toBe(true);
      expect(session.fallbackReason).toContain('incomplete');
      // 내장 기본 프로필로 온전히 대체됨 (누더기 조합 방지)
      expect(session.phaseA.starNotes.length).toBeGreaterThan(0);
      expect(session.phaseB.feverNotes.length).toBeGreaterThan(0);
    });

    it('stage에 선언된 builtinProfile이 존재하지 않는 알 수 없는 프로필이면 whole-pack 거부한다', () => {
      const invalidProfilePack = createValidPublishedPack('ch1', 120);
      invalidProfilePack.stages.ch1.builtinProfile = 'non-existent-profile-xyz';
      invalidProfilePack.contentHash = computePublishedPackHash(invalidProfilePack);

      const session = provider.resolveSessionStage({
        pack: invalidProfilePack,
        stageId: 'ch1',
      });

      expect(session.isFallback).toBe(true);
      expect(session.isBuiltin).toBe(true);
      expect(session.fallbackReason).toContain('unknown builtin profile');
    });

    it('pack과 fallbackPack이 모두 없거나 유효하지 않으면 시스템 내장 default 프로필로 완전하게 구성된다', () => {
      const session = provider.resolveSessionStage({
        pack: null,
        fallbackPack: null,
        stageId: 'ch1',
      });

      expect(session.isFallback).toBe(true);
      expect(session.isBuiltin).toBe(true);
      expect(session.stageId).toBe('ch1');
      expect(session.bpm).toBe(120);
      expect(session.phaseA.starNotes.length).toBe(7);
      expect(session.phaseB.hazards.length).toBeGreaterThan(0);
    });
  });

  describe('3. Phase B 별/장판 역할별 binding 충돌 없는 해석 및 중복/모순 거부', () => {
    it('Phase B의 STAR_COLLECT와 BOSS_HAZARD 역할 바인딩은 충돌 없이 공존 해석된다', () => {
      const bindings: SessionRoleBinding[] = [
        {
          chapterId: 'ch1',
          subLevelId: 'all',
          phase: 'phaseB',
          role: 'STAR_COLLECT',
          targetId: 'seq_fever_stars',
        },
        {
          chapterId: 'ch1',
          subLevelId: 'all',
          phase: 'phaseB',
          role: 'BOSS_HAZARD',
          targetId: 'seq_boss_hazards',
        },
      ];

      const interpretation = provider.interpretBindings(bindings);
      expect(interpretation.valid).toBe(true);
      expect(interpretation.bindings.length).toBe(2);
      expect(interpretation.errors).toHaveLength(0);
    });

    it('동일한 (chapter, sublevel, phase, role)에 복수의 대상이 바인딩되는 중복 충돌을 엄격히 거부한다', () => {
      const conflictingBindings: SessionRoleBinding[] = [
        {
          chapterId: 'ch1',
          subLevelId: 'all',
          phase: 'phaseB',
          role: 'STAR_COLLECT',
          targetId: 'seq_fever_1',
        },
        {
          chapterId: 'ch1',
          subLevelId: 'all',
          phase: 'phaseB',
          role: 'STAR_COLLECT', // 중복 충돌!
          targetId: 'seq_fever_2',
        },
      ];

      const interpretation = provider.interpretBindings(conflictingBindings);
      expect(interpretation.valid).toBe(false);
      expect(interpretation.errors.length).toBeGreaterThan(0);
      expect(interpretation.errors[0]).toContain('Duplicate binding');
    });

    it('역할과 시퀀스 종류가 모순되는 바인딩(예: hazard 시퀀스를 STAR_COLLECT로 지정)을 거부한다', () => {
      const contradictoryBindings = [
        {
          chapterId: 'ch1',
          subLevelId: 'all',
          phase: 'phaseB',
          role: 'STAR_COLLECT' as SessionPhaseRole,
          targetId: 'hazard_seq_01',
          sequenceKind: 'hazard', // 모순!
        },
      ];

      const interpretation = provider.interpretBindings(contradictoryBindings as any);
      expect(interpretation.valid).toBe(false);
      expect(interpretation.errors[0]).toContain('Contradictory binding');
    });
  });

  describe('4. round / loop 별 실행 ID 분리 및 결정성', () => {
    it('동일한 seed, stageId, contentHash에 대해 100% 결정적인 executionId를 생성한다', () => {
      const pack = createValidPublishedPack('ch1', 120);
      const session1 = provider.resolveSessionStage({ pack, stageId: 'ch1', seed: 777 });
      const session2 = provider.resolveSessionStage({ pack, stageId: 'ch1', seed: 777 });

      expect(session1.executionId).toBe(session2.executionId);

      const sessionDiffSeed = provider.resolveSessionStage({ pack, stageId: 'ch1', seed: 888 });
      expect(session1.executionId).not.toBe(sessionDiffSeed.executionId);
    });

    it('10개의 Phase A 문제 라운드별 실행 ID가 상호 독립적으로 분리된다', () => {
      const session = provider.resolveSessionStage({ stageId: 'ch1', seed: 42 });

      const roundIds = new Set<string>();
      for (let r = 1; r <= 10; r++) {
        const roundId = session.getRoundExecutionId(r);
        expect(roundIds.has(roundId)).toBe(false);
        roundIds.add(roundId);
        expect(roundId).toContain(`_r${r}`);
      }
      expect(roundIds.size).toBe(10);
    });

    it('라운드 내 노트 실행 ID(slotIndex)가 라운드 간 충돌 없이 고유하게 생성된다', () => {
      const session = provider.resolveSessionStage({ stageId: 'ch1', seed: 42 });

      const r1Note0 = session.getRoundNoteExecutionId(1, 0);
      const r2Note0 = session.getRoundNoteExecutionId(2, 0);

      expect(r1Note0).not.toBe(r2Note0);
      expect(r1Note0).toContain('_r1_');
      expect(r2Note0).toContain('_r2_');
    });

    it('Phase B 루프 인덱스별 실행 ID 및 루프 내 노트/장판 실행 ID가 상호 독립적으로 분리된다', () => {
      const session = provider.resolveSessionStage({ stageId: 'ch1', seed: 42 });

      const loop0Id = session.getPhaseBLoopExecutionId(0);
      const loop1Id = session.getPhaseBLoopExecutionId(1);
      expect(loop0Id).not.toBe(loop1Id);

      const loop0Note = session.getPhaseBNoteExecutionId(0, 3);
      const loop1Note = session.getPhaseBNoteExecutionId(1, 3);
      expect(loop0Note).not.toBe(loop1Note);

      const loop0Hazard = session.getPhaseBHazardExecutionId(0, 1);
      expect(loop0Hazard).not.toBe(loop0Note);
      expect(loop0Hazard).toContain('_loop0_h1');
    });
  });

  describe('5. 명시적 Builtin Profile 및 레이어 격리 검증', () => {
    it('팩의 스테이지가 명시적 builtinProfile을 지정한 경우 버전 검증 후 한 번에 스냅샷한다', () => {
      const pack = createValidPublishedPack('ch1', 120);
      pack.stages.ch1 = {
        stageId: 'ch1',
        builtinProfile: 'ch1-default-v2',
        tempo: { bpm: 120, beatsPerBar: 4 },
      };
      pack.contentHash = computePublishedPackHash(pack);

      const session = provider.resolveSessionStage({ pack, stageId: 'ch1', seed: 55 });
      expect(session.isBuiltin).toBe(true);
      expect(session.isFallback).toBe(false);
      expect(session.builtinProfileId).toBe('ch1-default-v2');
      expect(session.phaseA.starNotes.length).toBe(7);
      expect(session.phaseB.hazards.length).toBeGreaterThan(0);
    });

    it('src/game 모듈은 src/editor 모듈을 절대 import하지 않는다 (아키텍처 규칙 검증)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const contentProviderCode = fs.readFileSync(
        path.resolve(__dirname, '../../src/game/ContentProvider.ts'),
        'utf-8',
      );
      const sessionContentCode = fs.readFileSync(
        path.resolve(__dirname, '../../src/game/SessionContent.ts'),
        'utf-8',
      );

      expect(contentProviderCode).not.toMatch(/from\s+['"].*\/editor\//);
      expect(sessionContentCode).not.toMatch(/from\s+['"].*\/editor\//);
    });
  });
});
