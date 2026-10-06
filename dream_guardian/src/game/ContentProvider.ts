/**
 * ContentProvider.ts - 게임 런타임 적용본 단일 공급자 및 스테이지 세션 바인딩 해석기
 *
 * Issue #388 / CONTENT-SESSION:
 * - 책임 레이어: Game (src/game/)
 * - editor 모듈 절대 import 금지 (src/data/ 등 공용 타입만 참조)
 * - 검증된 적용본(PublishedContentPack)과 명시적 builtin profile을 완전한 SessionStageBundle로 해석
 * - 잘못된 팩은 전체 거부하고 이전정상본 또는 내장 모드로 whole-pack fallback (누더기 조합 엄격 금지)
 * - Phase B 별(STAR_COLLECT) / 장판(BOSS_HAZARD) 역할별 binding을 충돌 없이 해석
 * - 깊은 불변 스냅샷으로 게임 세션 진행 중 외부에서 팩이 게시되거나 롤백되어도 이미 시작된 세션 데이터에 영향 없음 보장
 */

import {
  DEFAULT_RULESET_ID,
  V2_PUBLISHABLE_CAPABILITY_PROFILE,
} from '../data/ContentCapabilities.js';
import { computeContentHash } from '../data/ContentCanonical.js';
import {
  type CompiledStageBundle,
  type PublishedContentPack,
  validatePublishedContentPack,
} from '../data/PublishedContentPack.js';
import {
  type SessionPhaseRole,
  type SessionRoleBinding,
  type SessionStageBundle,
  createSessionStageSnapshot,
} from './SessionContent.js';

const DEFAULT_RULESET_HASH = computeContentHash(V2_PUBLISHABLE_CAPABILITY_PROFILE);

export interface ResolveSessionStageOptions {
  stageId: string;
  pack?: PublishedContentPack | null;
  fallbackPack?: PublishedContentPack | null;
  builtinProfile?: string | null;
  seed?: number;
}

export interface SessionRoleBindingResult {
  valid: boolean;
  bindings: SessionRoleBinding[];
  errors: string[];
}

/**
 * 기본 챕터별 표준 내장 프로필 번들 생성 헬퍼
 */
function createDefaultBuiltinBundle(stageId: string, bpm: number): CompiledStageBundle {
  return {
    stageId,
    builtinProfile: `${stageId}-default-v2`,
    tempo: {
      bpm,
      beatsPerBar: 4,
    },
    phaseA: {
      starNotes: [
        {
          id: `${stageId}_star_0`,
          slotIndex: 0,
          landingTick: 960,
          landingBeat: 2,
          target: { type: 'cursor', part: 'leftHand', zoneId: 4, instrument: 'hand' },
        },
        {
          id: `${stageId}_star_1`,
          slotIndex: 1,
          landingTick: 1440,
          landingBeat: 3,
          target: { type: 'cursor', part: 'rightHand', zoneId: 5, instrument: 'hand' },
        },
        {
          id: `${stageId}_star_2`,
          slotIndex: 2,
          landingTick: 1920,
          landingBeat: 4,
          target: { type: 'cursor', part: 'leftHand', zoneId: 4, instrument: 'hand' },
        },
        {
          id: `${stageId}_star_3`,
          slotIndex: 3,
          landingTick: 2400,
          landingBeat: 5,
          target: { type: 'cursor', part: 'rightHand', zoneId: 5, instrument: 'hand' },
        },
        {
          id: `${stageId}_star_4`,
          slotIndex: 4,
          landingTick: 2880,
          landingBeat: 6,
          target: { type: 'cursor', part: 'leftHand', zoneId: 4, instrument: 'hand' },
        },
        {
          id: `${stageId}_star_5`,
          slotIndex: 5,
          landingTick: 3360,
          landingBeat: 7,
          target: { type: 'cursor', part: 'rightHand', zoneId: 5, instrument: 'hand' },
        },
        {
          id: `${stageId}_star_6`,
          slotIndex: 6,
          landingTick: 3840,
          landingBeat: 8,
          target: { type: 'cursor', part: 'leftHand', zoneId: 4, instrument: 'hand' },
        },
      ],
      hazard: {
        id: `${stageId}_hz_a`,
        hazardType: 'jump',
        requiredAction: 'jump',
      },
      motionGuide: [],
    },
    phaseB: {
      feverNotes: [
        {
          id: `${stageId}_fever_0`,
          landingTick: 960,
          target: { type: 'cursor', part: 'leftHand', zoneId: 4, instrument: 'hand' },
        },
        {
          id: `${stageId}_fever_1`,
          landingTick: 1440,
          target: { type: 'cursor', part: 'rightHand', zoneId: 5, instrument: 'hand' },
        },
        {
          id: `${stageId}_fever_2`,
          landingTick: 1920,
          target: { type: 'cursor', part: 'leftHand', zoneId: 4, instrument: 'hand' },
        },
        {
          id: `${stageId}_fever_3`,
          landingTick: 2400,
          target: { type: 'cursor', part: 'rightHand', zoneId: 5, instrument: 'hand' },
        },
      ],
      hazards: [
        {
          id: `${stageId}_hz_b_slam`,
          attackType: 'dual_slam',
          requiredAction: 'jump',
          warningDurationSeconds: 1.5,
          activeDurationSeconds: 0.5,
          damage: 15,
        },
        {
          id: `${stageId}_hz_b_stomp_l`,
          attackType: 'alternating_stomp_left',
          requiredAction: 'left_step',
          warningDurationSeconds: 1.5,
          activeDurationSeconds: 0.5,
          damage: 15,
        },
        {
          id: `${stageId}_hz_b_stomp_r`,
          attackType: 'alternating_stomp_right',
          requiredAction: 'right_step',
          warningDurationSeconds: 1.5,
          activeDurationSeconds: 0.5,
          damage: 15,
        },
      ],
      motionGuide: [],
    },
  };
}

export class ContentProvider {
  private readonly builtinProfiles: Map<string, CompiledStageBundle> = new Map();

  constructor() {
    this.initDefaultBuiltinProfiles();
  }

  private initDefaultBuiltinProfiles(): void {
    const chapters: Array<{ stageId: string; bpm: number }> = [
      { stageId: 'ch1', bpm: 120 },
      { stageId: 'ch2', bpm: 135 },
      { stageId: 'ch3', bpm: 125 },
      { stageId: 'ch4', bpm: 115 },
      { stageId: 'ch5', bpm: 140 },
    ];

    for (const { stageId, bpm } of chapters) {
      const bundle = createDefaultBuiltinBundle(stageId, bpm);
      this.builtinProfiles.set(`${stageId}-default-v2`, bundle);
      this.builtinProfiles.set(`${stageId}-challenge-v2`, bundle);
    }
  }

  /**
   * 내장 프로필 등록
   */
  registerBuiltinProfile(profileId: string, bundle: CompiledStageBundle): void {
    this.builtinProfiles.set(profileId, bundle);
  }

  /**
   * 내장 프로필 조회
   */
  getBuiltinProfile(profileId: string): CompiledStageBundle | null {
    return this.builtinProfiles.get(profileId) ?? null;
  }

  /**
   * 등록된 모든 내장 프로필 ID 목록 조회
   */
  listBuiltinProfiles(): string[] {
    return Array.from(this.builtinProfiles.keys());
  }

  /**
   * Phase B 별/장판 역할별 바인딩 해석 및 충돌/중복 검증
   */
  interpretBindings(
    bindings: readonly (SessionRoleBinding & { sequenceKind?: string })[],
  ): SessionRoleBindingResult {
    const errors: string[] = [];
    const resolved: SessionRoleBinding[] = [];
    const seenCompoundKeys = new Set<string>();

    for (const b of bindings) {
      let normalizedRole: SessionPhaseRole | null = null;
      const roleStr = String(b.role ?? '').trim();
      if (roleStr === 'STAR_COLLECT' || roleStr === 'starNotes' || roleStr === 'feverNotes') {
        normalizedRole = 'STAR_COLLECT';
      } else if (roleStr === 'BOSS_HAZARD' || roleStr === 'hazard') {
        normalizedRole = 'BOSS_HAZARD';
      } else if (roleStr === 'MOTION_GUIDE' || roleStr === 'motionGuide') {
        normalizedRole = 'MOTION_GUIDE';
      } else if (b.phase === 'phaseA') {
        normalizedRole = 'STAR_COLLECT';
      } else {
        normalizedRole = 'BOSS_HAZARD';
      }

      // Check contradiction between role and sequenceKind
      if (b.sequenceKind) {
        if (
          (b.sequenceKind === 'hazard' && normalizedRole === 'STAR_COLLECT') ||
          ((b.sequenceKind === 'starNotes' || b.sequenceKind === 'feverNotes') &&
            normalizedRole === 'BOSS_HAZARD')
        ) {
          errors.push(
            `Contradictory binding: role "${normalizedRole}" conflicts with sequence kind "${b.sequenceKind}"`,
          );
        }
      }

      // Compound key: chapterId + sublevel + phase + normalizedRole
      const subLevel = b.subLevelId ?? 'all';
      const compoundKey = `${b.chapterId}::${subLevel}::${b.phase}::${normalizedRole}`;
      if (seenCompoundKeys.has(compoundKey)) {
        errors.push(`Duplicate binding for compound key "${compoundKey}"`);
      } else {
        seenCompoundKeys.add(compoundKey);
      }

      resolved.push({
        chapterId: b.chapterId,
        subLevelId: subLevel,
        phase: b.phase,
        role: normalizedRole,
        targetId: b.targetId,
      });
    }

    return {
      valid: errors.length === 0,
      bindings: resolved,
      errors,
    };
  }

  /**
   * 지정된 스테이지의 불변 SessionStageBundle 스냅샷을 해석 및 생성합니다.
   * 잘못된 선택 팩은 전체 거부하고 fallbackPack 또는 내장 모드로 whole-pack fallback합니다.
   */
  resolveSessionStage(options: ResolveSessionStageOptions): SessionStageBundle {
    const { stageId, pack, seed = 42 } = options;

    // 1. 주 팩 검증
    if (pack) {
      const packValidation = validatePublishedContentPack(pack);
      if (!packValidation.valid) {
        return this.fallbackOrBuiltin(
          options,
          `Pack checksum / verification failed: ${packValidation.errors.map((e) => e.message).join(', ')}`,
        );
      }

      const stageBundle = pack.stages?.[stageId];
      if (!stageBundle) {
        return this.fallbackOrBuiltin(options, `Pack missing stage: ${stageId}`);
      }

      // 내장 프로필 참조 스테이지인 경우
      if (stageBundle.builtinProfile) {
        const builtin = this.getBuiltinProfile(stageBundle.builtinProfile);
        if (!builtin) {
          return this.fallbackOrBuiltin(
            options,
            `Stage references unknown builtin profile: ${stageBundle.builtinProfile}`,
          );
        }
        return createSessionStageSnapshot({
          stageId,
          sourcePackHash: pack.contentHash,
          rulesetId: pack.rulesetId,
          rulesetHash: pack.rulesetHash,
          runtimeContractVersion: pack.runtimeContractVersion,
          bpm: stageBundle.tempo?.bpm ?? builtin.tempo?.bpm ?? 120,
          beatsPerBar: stageBundle.tempo?.beatsPerBar ?? builtin.tempo?.beatsPerBar ?? 4,
          isBuiltin: true,
          isFallback: false,
          builtinProfileId: stageBundle.builtinProfile,
          seed,
          phaseA: builtin.phaseA ?? { starNotes: [] },
          phaseB: builtin.phaseB ?? {},
        });
      }

      // 직접 컴파일된 스테이지의 완전성 검증 (Phase A & Phase B 모두 필수)
      const hasPhaseA =
        stageBundle.phaseA !== undefined &&
        Array.isArray(stageBundle.phaseA.starNotes) &&
        stageBundle.phaseA.starNotes.length > 0;
      const hasPhaseB =
        stageBundle.phaseB !== undefined &&
        ((Array.isArray(stageBundle.phaseB.feverNotes) &&
          stageBundle.phaseB.feverNotes.length > 0) ||
          (Array.isArray(stageBundle.phaseB.hazards) && stageBundle.phaseB.hazards.length > 0));

      if (!hasPhaseA || !hasPhaseB) {
        return this.fallbackOrBuiltin(
          options,
          `Stage bundle incomplete: missing phaseA or phaseB for stage ${stageId}`,
        );
      }

      // 유효한 컴파일 스테이지 번들
      return createSessionStageSnapshot({
        stageId,
        sourcePackHash: pack.contentHash,
        rulesetId: pack.rulesetId,
        rulesetHash: pack.rulesetHash,
        runtimeContractVersion: pack.runtimeContractVersion,
        bpm: stageBundle.tempo?.bpm ?? 120,
        beatsPerBar: stageBundle.tempo?.beatsPerBar ?? 4,
        isBuiltin: false,
        isFallback: false,
        seed,
        phaseA: stageBundle.phaseA,
        phaseB: stageBundle.phaseB,
      });
    }

    // 팩이 제공되지 않은 경우
    return this.fallbackOrBuiltin(options, 'No pack provided, fallback to builtin');
  }

  private fallbackOrBuiltin(
    options: ResolveSessionStageOptions,
    reason: string,
  ): SessionStageBundle {
    const { stageId, fallbackPack, seed = 42 } = options;

    if (fallbackPack) {
      const fallbackVal = validatePublishedContentPack(fallbackPack);
      if (fallbackVal.valid) {
        const stageBundle = fallbackPack.stages?.[stageId];
        if (stageBundle) {
          const hasPhaseA =
            stageBundle.phaseA !== undefined &&
            Array.isArray(stageBundle.phaseA.starNotes) &&
            stageBundle.phaseA.starNotes.length > 0;
          const hasPhaseB =
            stageBundle.phaseB !== undefined &&
            ((Array.isArray(stageBundle.phaseB.feverNotes) &&
              stageBundle.phaseB.feverNotes.length > 0) ||
              (Array.isArray(stageBundle.phaseB.hazards) &&
                stageBundle.phaseB.hazards.length > 0));

          if (hasPhaseA && hasPhaseB) {
            return createSessionStageSnapshot({
              stageId,
              sourcePackHash: fallbackPack.contentHash,
              rulesetId: fallbackPack.rulesetId,
              rulesetHash: fallbackPack.rulesetHash,
              runtimeContractVersion: fallbackPack.runtimeContractVersion,
              bpm: stageBundle.tempo?.bpm ?? 120,
              beatsPerBar: stageBundle.tempo?.beatsPerBar ?? 4,
              isBuiltin: false,
              isFallback: true,
              fallbackReason: reason,
              seed,
              phaseA: stageBundle.phaseA,
              phaseB: stageBundle.phaseB,
            });
          }
        }
      }
    }

    // fallbackPack도 없거나 유효하지 않은 경우: 내장 기본 프로필로 전체 대체
    const profileId = `${stageId}-default-v2`;
    let builtin = this.getBuiltinProfile(profileId);
    if (!builtin) {
      builtin = this.getBuiltinProfile('ch1-default-v2');
    }
    if (!builtin) {
      throw new Error(`Fatal: No builtin profile available for stage ${stageId}`);
    }

    return createSessionStageSnapshot({
      stageId,
      sourcePackHash: `builtin_${stageId}_default`,
      rulesetId: DEFAULT_RULESET_ID,
      rulesetHash: DEFAULT_RULESET_HASH,
      runtimeContractVersion: '2.0.0',
      bpm: builtin.tempo?.bpm ?? 120,
      beatsPerBar: builtin.tempo?.beatsPerBar ?? 4,
      isBuiltin: true,
      isFallback: true,
      fallbackReason: reason,
      builtinProfileId: profileId,
      seed,
      phaseA: builtin.phaseA ?? { starNotes: [] },
      phaseB: builtin.phaseB ?? {},
    });
  }
}
