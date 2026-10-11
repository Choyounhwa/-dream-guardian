import { describe, it, expect } from 'vitest';
import type {
  SessionId,
  RoundId,
  PairId,
  AttackId,
  InputId,
  RulesVersion,
  ProfileId,
  AssaultGameMode,
  AssaultEncounterKind,
  AssaultAnswerSide,
  AssaultTimingProfileRef,
  AssaultEncounterDef,
  AssaultSessionPlan,
  AssaultRoundPhase,
  AssaultRoundRuntimeState,
  AssaultHitResult,
  AssaultRhythmRating,
  AssaultHitEvaluation,
  AssaultSettlementTarget,
  AssaultEffectType,
  AssaultSettlementCommand,
  AssaultPresentationDTO,
  AssaultPresentationSnapshot,
} from '../../src/types/assault.js';
import * as AssaultExports from '../../src/types/assault.js';
import type { MotionNote } from '../../src/types/motion-note.js';

describe('BOSS-ASSAULT-02: Assault Types & MotionNote Additive Compatibility Contract', () => {
  describe('Pure Type Contract Verification (No Runtime Values)', () => {
    it('assault.ts exports pure type contracts and no runtime functions, config defaults or HP values', () => {
      // Pure type contracts must have 0 runtime exports (no functions, no config constants, no runtime guards)
      const exportKeys = Object.keys(AssaultExports);
      expect(exportKeys).toEqual([]);
    });
  });

  describe('Identifier & Version Contract (DOC-14 §6.1)', () => {
    it('supports domain identifiers: sessionId, roundId, pairId, attackId, inputId, rulesVersion, profileId', () => {
      const sessionId: SessionId = 'session_test_001';
      const roundId: RoundId = 'round_test_001';
      const pairId: PairId = 'pair_test_001';
      const attackId: AttackId = 'attack_test_001';
      const inputId: InputId = 'input_test_001';
      const rulesVersion: RulesVersion = '1.0.0';
      const profileId: ProfileId = 'profile_boss_assault_v1';
      const gameMode: AssaultGameMode = 'boss_assault';
      const validKinds: AssaultEncounterKind[] = ['answer_pair', 'squat', 'jump'];
      const validSides: AssaultAnswerSide[] = ['left', 'right'];
      const validPhases: AssaultRoundPhase[] = ['idle', 'ready', 'question_reading', 'choice_window', 'strike_resolve', 'round_clear', 'round_failed'];
      const validHitResults: AssaultHitResult[] = ['hit', 'miss', 'timeout', 'evaded'];
      const validRatings: AssaultRhythmRating[] = ['Perfect', 'Good', 'Late', 'Miss'];
      const validTargets: AssaultSettlementTarget[] = ['player', 'boss'];
      const validEffectTypes: AssaultEffectType[] = ['player_damage', 'boss_stagger', 'boss_negate', 'evade_success'];

      expect(sessionId).toBe('session_test_001');
      expect(roundId).toBe('round_test_001');
      expect(pairId).toBe('pair_test_001');
      expect(attackId).toBe('attack_test_001');
      expect(inputId).toBe('input_test_001');
      expect(rulesVersion).toBe('1.0.0');
      expect(profileId).toBe('profile_boss_assault_v1');
      expect(gameMode).toBe('boss_assault');
      expect(validKinds).toHaveLength(3);
      expect(validSides).toHaveLength(2);
      expect(validPhases).toHaveLength(7);
      expect(validHitResults).toHaveLength(4);
      expect(validRatings).toHaveLength(4);
      expect(validTargets).toHaveLength(2);
      expect(validEffectTypes).toHaveLength(4);
    });

    it('supports timing profile reference structure', () => {
      const timingRef: AssaultTimingProfileRef = {
        profileId: 'tp_default',
        rulesVersion: '1.0.0',
      };
      expect(timingRef.profileId).toBe('tp_default');
      expect(timingRef.rulesVersion).toBe('1.0.0');
    });
  });

  describe('Immutable Definition & Session Plan (DOC-14 §6.5)', () => {
    it('constructs a valid AssaultEncounterDef with 0-based beats and required metadata', () => {
      const encounterDef: AssaultEncounterDef = {
        id: 'atk_pair_01',
        kind: 'answer_pair',
        startBeat: 0,
        durationBeats: 4,
        interactionProfileId: 'reach_profile_01',
        visualProfileId: 'boss_fist_left',
        answerPolicyId: 'policy_single_choice',
        pairId: 'pair_01',
      };

      expect(encounterDef.id).toBe('atk_pair_01');
      expect(encounterDef.kind).toBe('answer_pair');
      expect(encounterDef.startBeat).toBe(0);
      expect(encounterDef.durationBeats).toBe(4);
      expect(encounterDef.interactionProfileId).toBe('reach_profile_01');
      expect(encounterDef.pairId).toBe('pair_01');
    });

    it('constructs an immutable AssaultSessionPlan containing nested encounter definitions', () => {
      const encounters: readonly AssaultEncounterDef[] = [
        {
          id: 'atk_pair_01',
          kind: 'answer_pair',
          startBeat: 0,
          durationBeats: 4,
          interactionProfileId: 'ip_reach',
          visualProfileId: 'vp_punch',
          pairId: 'p_01',
        },
        {
          id: 'atk_squat_01',
          kind: 'squat',
          startBeat: 4,
          durationBeats: 4,
          interactionProfileId: 'ip_squat',
          visualProfileId: 'vp_sweep',
        },
      ];

      const plan: AssaultSessionPlan = {
        schemaVersion: '1.0.0',
        sessionId: 'session_plan_001',
        rulesVersion: '1.0.0',
        timingProfileId: 'timing_prof_01',
        balanceProfileId: 'balance_prof_01',
        encounters,
      };

      expect(plan.sessionId).toBe('session_plan_001');
      expect(plan.encounters).toHaveLength(2);
      expect(plan.encounters[0].kind).toBe('answer_pair');
      expect(plan.encounters[1].kind).toBe('squat');
    });
  });

  describe('Runtime State & Mutability Boundary (DOC-14 §6.2)', () => {
    it('distinguishes mutable runtime progress from immutable session/round IDs', () => {
      const runtimeState: AssaultRoundRuntimeState = {
        sessionId: 'session_rt_001',
        roundId: 'round_rt_001',
        phase: 'ready',
        currentEncounterIndex: 0,
        lockedChoice: null,
        negatedAttackIds: [],
        appliedResultIds: [],
      };

      expect(runtimeState.phase).toBe('ready');

      // Mutable runtime progress transition
      runtimeState.phase = 'choice_window';
      runtimeState.currentEncounterIndex = 1;
      runtimeState.lockedChoice = 'left';
      runtimeState.negatedAttackIds = ['atk_pair_01'];
      runtimeState.appliedResultIds = ['session_rt_001:atk_pair_01:boss_negate'];

      expect(runtimeState.phase).toBe('choice_window');
      expect(runtimeState.currentEncounterIndex).toBe(1);
      expect(runtimeState.lockedChoice).toBe('left');
      expect(runtimeState.negatedAttackIds).toEqual(['atk_pair_01']);
      expect(runtimeState.appliedResultIds).toEqual(['session_rt_001:atk_pair_01:boss_negate']);
    });
  });

  describe('Judgment & Evaluation Contract (DOC-14 §6.2, §6.6)', () => {
    it('constructs AssaultHitEvaluation with pure judgment rating and hit outcome', () => {
      const evaluation: AssaultHitEvaluation = {
        inputId: 'inp_101',
        sessionId: 'session_eval_01',
        roundId: 'round_eval_01',
        attackId: 'atk_eval_01',
        rating: 'Perfect',
        hitResult: 'hit',
        timestampMs: 12345.67,
      };

      expect(evaluation.rating).toBe('Perfect');
      expect(evaluation.hitResult).toBe('hit');
      expect(evaluation.timestampMs).toBe(12345.67);
    });
  });

  describe('Settlement Command Contract (DOC-14 §6.6 - No Damage Numbers)', () => {
    it('constructs AssaultSettlementCommand with target, effect intent and idempotency key', () => {
      const settlementPlayerHurt: AssaultSettlementCommand = {
        sessionId: 'session_settle_01',
        roundId: 'round_settle_01',
        attackId: 'atk_pair_02',
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'session_settle_01:atk_pair_02:player_damage',
      };

      const settlementBossNegate: AssaultSettlementCommand = {
        sessionId: 'session_settle_01',
        roundId: 'round_settle_01',
        attackId: 'atk_pair_02',
        target: 'boss',
        resultKind: 'hit',
        effectType: 'boss_negate',
        idempotencyKey: 'session_settle_01:atk_pair_02:boss_negate',
      };

      expect(settlementPlayerHurt.target).toBe('player');
      expect(settlementPlayerHurt.resultKind).toBe('miss');
      expect(settlementPlayerHurt.idempotencyKey).toBe('session_settle_01:atk_pair_02:player_damage');

      expect(settlementBossNegate.target).toBe('boss');
      expect(settlementBossNegate.resultKind).toBe('hit');
      expect(settlementBossNegate.idempotencyKey).toBe('session_settle_01:atk_pair_02:boss_negate');
    });
  });

  describe('Presentation DTO / Snapshot (DOC-14 §6.2 - Readonly, No Answer Key)', () => {
    it('constructs readonly presentation DTO without leaking answer flags or mutation', () => {
      const presentation: AssaultPresentationDTO = {
        sessionId: 'session_pres_01',
        roundId: 'round_pres_01',
        phase: 'choice_window',
        questionText: '7 × 8 = ?',
        leftChoiceText: '56',
        rightChoiceText: '48',
        bossScaleProgress: 0.35,
        comboCount: 3,
        remainingTimeSeconds: 2.4,
        warningActive: false,
      };

      // Type alias compatibility
      const snapshot: AssaultPresentationSnapshot = presentation;

      expect(snapshot.questionText).toBe('7 × 8 = ?');
      expect(snapshot.leftChoiceText).toBe('56');
      expect(snapshot.rightChoiceText).toBe('48');
      expect(snapshot.bossScaleProgress).toBe(0.35);
      expect(snapshot.comboCount).toBe(3);
    });
  });

  describe('MotionNote Additive Compatibility Contract', () => {
    it('MotionNote supports source "assault" alongside existing sources', () => {
      const assaultNote: MotionNote = {
        id: 'note_assault_01',
        patternId: 'P_ASSAULT_01',
        beat: 1,
        requirements: [{ part: 'leftHand', zoneId: 4 }],
        interaction: 'tap',
        source: 'assault',
      };

      expect(assaultNote.source).toBe('assault');
    });

    it('preserves existing MotionNote sources: star, stomp, hazard, boss, fever, undefined', () => {
      const starNote: MotionNote = {
        id: 'note_star_01',
        patternId: 'S01',
        beat: 1,
        requirements: [{ part: 'rightHand', zoneId: 5 }],
        interaction: 'tap',
        source: 'star',
      };

      const defaultNote: MotionNote = {
        id: 'note_def_01',
        patternId: 'D01',
        beat: 1,
        requirements: [{ part: 'leftFoot', zoneId: 9 }],
        interaction: 'tap',
      };

      expect(starNote.source).toBe('star');
      expect(defaultNote.source).toBeUndefined();
    });
  });

  describe('Negative Type Tests (Static Type Safety Checkers)', () => {
    it('enforces static type constraints and compile-time rejections', () => {
      function _assertStaticTypeSafety() {
        // 1. SessionId missing in AssaultSessionPlan (A16)
        // @ts-expect-error TS2322: Property 'sessionId' is missing in type
        const _invalidPlanNoSession: AssaultSessionPlan = {
          schemaVersion: '1.0.0',
          rulesVersion: '1.0.0',
          timingProfileId: 'tp_01',
          balanceProfileId: 'bp_01',
          encounters: [],
        };

        // 2. SessionId missing in AssaultRoundRuntimeState (A16)
        // @ts-expect-error TS2322: Property 'sessionId' is missing in type
        const _invalidRuntimeNoSession: AssaultRoundRuntimeState = {
          roundId: 'round_01',
          phase: 'ready',
          currentEncounterIndex: 0,
          lockedChoice: null,
          negatedAttackIds: [],
          appliedResultIds: [],
        };

        // 3. SessionId missing in AssaultSettlementCommand (A14, A16)
        // @ts-expect-error TS2322: Property 'sessionId' is missing in type
        const _invalidSettlementNoSession: AssaultSettlementCommand = {
          roundId: 'round_01',
          attackId: 'atk_01',
          target: 'player',
          resultKind: 'hit',
          effectType: 'player_damage',
          idempotencyKey: 'round_01:atk_01:player_damage',
        };

        // 4. SessionId missing in AssaultPresentationDTO (A16)
        // @ts-expect-error TS2322: Property 'sessionId' is missing in type
        const _invalidPresentationNoSession: AssaultPresentationDTO = {
          roundId: 'round_01',
          phase: 'ready',
          questionText: '1 + 1',
          leftChoiceText: '2',
          rightChoiceText: '3',
          bossScaleProgress: 0.1,
          comboCount: 0,
          remainingTimeSeconds: 5,
          warningActive: false,
        };

        // 5. Invalid encounter kind in AssaultEncounterDef
        const _invalidEncounterKind: AssaultEncounterDef = {
          id: 'atk_01',
          // @ts-expect-error TS2322: Type '"laser_beam"' is not assignable to type 'AssaultEncounterKind'
          kind: 'laser_beam',
          startBeat: 0,
          durationBeats: 4,
          interactionProfileId: 'ip_01',
          visualProfileId: 'vp_01',
        };

        // 6. Mutating readonly property on AssaultEncounterDef
        const testEncounter: AssaultEncounterDef = {
          id: 'atk_01',
          kind: 'answer_pair',
          startBeat: 0,
          durationBeats: 4,
          interactionProfileId: 'ip_01',
          visualProfileId: 'vp_01',
        };
        // @ts-expect-error TS2540: Cannot assign to 'kind' because it is a read-only property
        testEncounter.kind = 'squat';

        // 7. Mutating readonly property on AssaultSessionPlan
        const testPlan: AssaultSessionPlan = {
          schemaVersion: '1.0.0',
          sessionId: 'sess_01',
          rulesVersion: '1.0.0',
          timingProfileId: 'tp_01',
          balanceProfileId: 'bp_01',
          encounters: [],
        };
        // @ts-expect-error TS2540: Cannot assign to 'sessionId' because it is a read-only property
        testPlan.sessionId = 'sess_02';

        // 8. Mutating readonly property on AssaultPresentationDTO
        const testPresentation: AssaultPresentationDTO = {
          sessionId: 'sess_01',
          roundId: 'r_01',
          phase: 'choice_window',
          questionText: '2 + 3',
          leftChoiceText: '5',
          rightChoiceText: '6',
          bossScaleProgress: 0.2,
          comboCount: 1,
          remainingTimeSeconds: 4,
          warningActive: false,
        };
        // @ts-expect-error TS2540: Cannot assign to 'questionText' because it is a read-only property
        testPresentation.questionText = 'hacked';

        // 9. Settlement command must NOT contain damage amount (pure intent)
        const _invalidSettlementWithDamage: AssaultSettlementCommand = {
          sessionId: 'sess_01',
          roundId: 'r_01',
          attackId: 'atk_01',
          target: 'boss',
          resultKind: 'hit',
          effectType: 'boss_negate',
          idempotencyKey: 'sess_01:atk_01:boss_negate',
          // @ts-expect-error TS2353: 'damage' does not exist in type 'AssaultSettlementCommand'
          damage: 15,
        };

        // 10. MotionNote invalid source rejection
        const _invalidNoteSource: MotionNote = {
          id: 'n_invalid',
          patternId: 'p_01',
          beat: 1,
          requirements: [],
          interaction: 'tap',
          // @ts-expect-error TS2322: Type '"laser"' is not assignable to type '... | "assault" | undefined'
          source: 'laser',
        };

        return {
          _invalidPlanNoSession,
          _invalidRuntimeNoSession,
          _invalidSettlementNoSession,
          _invalidPresentationNoSession,
          _invalidEncounterKind,
          testEncounter,
          testPlan,
          testPresentation,
          _invalidSettlementWithDamage,
          _invalidNoteSource,
        };
      }

      expect(typeof _assertStaticTypeSafety).toBe('function');
    });
  });
});
