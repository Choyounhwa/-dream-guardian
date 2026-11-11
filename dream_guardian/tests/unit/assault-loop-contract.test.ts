/**
 * assault-loop-contract.test.ts
 *
 * [ASSAULT-LOOP-01 / Issue #694]
 * 러닝·선택·휴식 루프의 독립 타입 및 설정 계약 검증
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ASSAULT_CONFIG,
} from '../../config/assault.config.js';
import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  ASSAULT_LOOP_RUN_BEATS,
  ASSAULT_LOOP_ANSWER_BEATS,
  ASSAULT_LOOP_REST_BEATS,
  ASSAULT_LOOP_ANSWER_OPPORTUNITIES,
  ASSAULT_LOOP_SQUAT_BEATS,
  ASSAULT_LOOP_SQUAT_NOTICE_BEATS,
  ASSAULT_LOOP_SQUAT_DODGE_BEATS,
  ASSAULT_LOOP_SQUAT_STAND_BEATS,
  ASSAULT_LOOP_CANDIDATE_GAPS,
  ASSAULT_LOOP_BASE_BEATS,
  calculateLoopTotalBeats,
  calculateLoopTotalSeconds,
  type AssaultLoopConfig,
} from '../../config/assault-loop.config.js';
import type {
  AssaultLoopSegmentKind,
  AssaultLoopSquatSubSegmentKind,
  AssaultLoopProfile,
  AssaultLoopSegmentDef,
  AssaultLoopSquatSubSegmentDef,
  AssaultLoopRoundPlan,
  AssaultLoopPresentation,
  AssaultPresentationWithLoop,
} from '../../src/types/assault-loop.js';
import type { AssaultPresentationDTO } from '../../src/types/assault.js';

describe('ASSAULT-LOOP-01 Contract & Config Tests', () => {
  describe('1. SSOT 상수 및 기본 설정값 검증', () => {
    it('루프 기본 박자 상수가 요구사항과 정확히 일치해야 한다', () => {
      expect(ASSAULT_LOOP_RUN_BEATS).toBe(8);
      expect(ASSAULT_LOOP_ANSWER_BEATS).toBe(4);
      expect(ASSAULT_LOOP_REST_BEATS).toBe(0);
      expect(ASSAULT_LOOP_ANSWER_OPPORTUNITIES).toBe(4);
      expect(ASSAULT_LOOP_SQUAT_BEATS).toBe(4);
      expect(ASSAULT_LOOP_SQUAT_NOTICE_BEATS).toBe(1);
      expect(ASSAULT_LOOP_SQUAT_DODGE_BEATS).toBe(2);
      expect(ASSAULT_LOOP_SQUAT_STAND_BEATS).toBe(1);
      expect(ASSAULT_LOOP_SQUAT_NOTICE_BEATS + ASSAULT_LOOP_SQUAT_DODGE_BEATS + ASSAULT_LOOP_SQUAT_STAND_BEATS)
        .toBe(ASSAULT_LOOP_SQUAT_BEATS);
      expect(ASSAULT_LOOP_CANDIDATE_GAPS).toEqual([1, 2, 3]);
      expect(ASSAULT_LOOP_BASE_BEATS).toBe(24);
      // 8 + (4 + 0) * 4 = 24
      expect(
        ASSAULT_LOOP_RUN_BEATS +
          (ASSAULT_LOOP_ANSWER_BEATS + ASSAULT_LOOP_REST_BEATS) * ASSAULT_LOOP_ANSWER_OPPORTUNITIES,
      ).toBe(24);
    });

    it('DEFAULT_ASSAULT_LOOP_CONFIG의 필드가 SSOT 상수 및 DEFAULT_ASSAULT_CONFIG와 정합해야 한다', () => {
      const cfg: AssaultLoopConfig = DEFAULT_ASSAULT_LOOP_CONFIG;
      const profile: AssaultLoopProfile = cfg;
      expect(profile.profileId).toBe('assault_loop_v1');
      expect(cfg.rulesVersion).toBe('1.0.0');
      expect(cfg.runBeats).toBe(8);
      expect(cfg.answerBeats).toBe(4);
      expect(cfg.restBeats).toBe(0);
      expect(cfg.answerOpportunities).toBe(4);
      expect(cfg.squatBeats).toBe(4);
      expect(cfg.squatSubBeats).toEqual({
        notice: 1,
        dodge: 2,
        stand: 1,
      });
      expect(cfg.candidateGaps).toEqual([1, 2, 3]);
      // [FEAT-ASSAULT-LOOP-019 / Issue #744] #734 보류 기간 동안 임시 0회 설정 검증 (#734 재개 시 1/2로 복원 또는 동적 정책 대체)
      expect(cfg.minSquatsPerRound).toBe(0);
      expect(cfg.maxSquatsPerRound).toBe(0);
      expect(cfg.baseBeats).toBe(24);

      // DRY: DEFAULT_ASSAULT_CONFIG 참조 검증
      expect(cfg.defaultBpm).toBe(DEFAULT_ASSAULT_CONFIG.defaultBpm);
      expect(cfg.playerMaxHp).toBe(DEFAULT_ASSAULT_CONFIG.playerMaxHp);
      expect(cfg.wrongDamage).toBe(DEFAULT_ASSAULT_CONFIG.wrongDamage);
      expect(cfg.missDamage).toBe(DEFAULT_ASSAULT_CONFIG.missDamage);
      expect(cfg.squatFailDamage).toBe(DEFAULT_ASSAULT_CONFIG.squatFailDamage);
      expect(cfg.targetRounds).toBe(DEFAULT_ASSAULT_CONFIG.targetRounds);
    });
  });

  describe('2. 24 + 4N 박 및 초 단위 계산 공식 검증', () => {
    it('스쿼트 개수에 따른 총 박자(24 + 4N)를 정확히 계산해야 한다', () => {
      expect(calculateLoopTotalBeats(0)).toBe(24);
      expect(calculateLoopTotalBeats(1)).toBe(28);
      expect(calculateLoopTotalBeats(2)).toBe(32);
      expect(calculateLoopTotalBeats(3)).toBe(36);
    });

    it('120 BPM 기준 24박은 12초, 28박은 14초, 32박은 16초여야 한다', () => {
      // 24박 @ 120 BPM = (24 / 120) * 60 = 12초
      expect(calculateLoopTotalSeconds(24, 120)).toBe(12);
      // 28박 @ 120 BPM = (28 / 120) * 60 = 14초
      expect(calculateLoopTotalSeconds(28, 120)).toBe(14);
      // 32박 @ 120 BPM = (32 / 120) * 60 = 16초
      expect(calculateLoopTotalSeconds(32, 120)).toBe(16);

      // 기본 BPM(120) 생략 시에도 동일
      expect(calculateLoopTotalSeconds(24)).toBe(12);
      expect(calculateLoopTotalSeconds(28)).toBe(14);
      expect(calculateLoopTotalSeconds(32)).toBe(16);
    });

    it('다른 BPM에서도 초 단위 변환이 정확해야 한다', () => {
      // 28박 @ 60 BPM = 28초
      expect(calculateLoopTotalSeconds(28, 60)).toBe(28);
      // 32박 @ 240 BPM = 8초
      expect(calculateLoopTotalSeconds(32, 240)).toBe(8);
      // BPM <= 0 안전 가드
      expect(calculateLoopTotalSeconds(28, 0)).toBe(0);
      expect(calculateLoopTotalSeconds(28, -10)).toBe(0);
    });
  });

  describe('3. deepFreeze 불변성 검증', () => {
    it('DEFAULT_ASSAULT_LOOP_CONFIG 및 중첩 객체/배열이 완전히 동결되어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_LOOP_CONFIG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_LOOP_CONFIG.squatSubBeats)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_LOOP_CONFIG.candidateGaps)).toBe(true);

      // 런타임 속성 수정 시도 차단 검증
      expect(() => {
        (DEFAULT_ASSAULT_LOOP_CONFIG as any).runBeats = 16;
      }).toThrow();

      expect(() => {
        (DEFAULT_ASSAULT_LOOP_CONFIG.squatSubBeats as any).notice = 5;
      }).toThrow();

      expect(() => {
        (DEFAULT_ASSAULT_LOOP_CONFIG.candidateGaps as any).push(4);
      }).toThrow();
    });

    it('기존 DEFAULT_ASSAULT_CONFIG가 오염되지 않고 불변을 유지해야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_CONFIG)).toBe(true);
      expect(DEFAULT_ASSAULT_CONFIG.defaultBpm).toBe(120);
      expect(DEFAULT_ASSAULT_CONFIG.playerMaxHp).toBe(100);
      expect(DEFAULT_ASSAULT_CONFIG.wrongDamage).toBe(10);
      expect(DEFAULT_ASSAULT_CONFIG.missDamage).toBe(10);
      expect(DEFAULT_ASSAULT_CONFIG.squatFailDamage).toBe(5);
    });
  });

  describe('4. 독립 루프 타입 계약 검증', () => {
    it('AssaultLoopSegmentKind 유니온 타입 값을 올바르게 대입할 수 있어야 한다', () => {
      const kinds: AssaultLoopSegmentKind[] = ['run_question', 'answer', 'rest', 'squat'];
      expect(kinds).toHaveLength(4);
      expect(kinds).toContain('run_question');
      expect(kinds).toContain('answer');
      expect(kinds).toContain('rest');
      expect(kinds).toContain('squat');
    });

    it('AssaultLoopSquatSubSegmentKind 유니온 타입 값을 올바르게 대입할 수 있어야 한다', () => {
      const subKinds: AssaultLoopSquatSubSegmentKind[] = ['notice', 'dodge', 'stand'];
      expect(subKinds).toHaveLength(3);
      expect(subKinds).toContain('notice');
      expect(subKinds).toContain('dodge');
      expect(subKinds).toContain('stand');
    });

    it('AssaultLoopSegmentDef 구조가 박자 및 초 단위를 모두 포함해야 한다', () => {
      const subSegments: AssaultLoopSquatSubSegmentDef[] = [
        {
          kind: 'notice',
          startBeat: 14,
          durationBeats: 1,
          endBeat: 15,
          startSeconds: 7,
          durationSeconds: 0.5,
          endSeconds: 7.5,
        },
        {
          kind: 'dodge',
          startBeat: 15,
          durationBeats: 2,
          endBeat: 17,
          startSeconds: 7.5,
          durationSeconds: 1,
          endSeconds: 8.5,
        },
        {
          kind: 'stand',
          startBeat: 17,
          durationBeats: 1,
          endBeat: 18,
          startSeconds: 8.5,
          durationSeconds: 0.5,
          endSeconds: 9,
        },
      ];

      const segment: AssaultLoopSegmentDef = {
        segmentIndex: 3,
        kind: 'squat',
        startBeat: 14,
        durationBeats: 4,
        endBeat: 18,
        startSeconds: 7,
        durationSeconds: 2,
        endSeconds: 9,
        gapIndex: 1,
        squatSubSegments: subSegments,
      };

      expect(segment.kind).toBe('squat');
      expect(segment.durationBeats).toBe(4);
      expect(segment.squatSubSegments).toHaveLength(3);
      expect(segment.squatSubSegments?.[0].kind).toBe('notice');
    });

    it('AssaultLoopRoundPlan이 구간 및 불변 계획 정보를 포함해야 한다', () => {
      const plan: AssaultLoopRoundPlan = {
        roundId: 'round_01',
        profileId: 'assault_loop_v1',
        rulesVersion: '1.0.0',
        bpm: 120,
        totalBeats: 36,
        totalSeconds: 18,
        squatGapIndices: [1],
        squatCount: 1,
        segments: [],
        encounters: [],
      };

      expect(plan.totalBeats).toBe(36);
      expect(plan.totalSeconds).toBe(18);
      expect(plan.squatCount).toBe(1);
      expect(plan.squatGapIndices).toEqual([1]);
    });

    it('AssaultLoopPresentation 읽기 전용 스냅샷이 실측 루프 상태 필드를 갖추어야 한다', () => {
      const presentation: AssaultLoopPresentation = {
        currentSegmentIndex: 1,
        currentSegmentKind: 'answer',
        segmentElapsedBeats: 1.5,
        segmentRemainingBeats: 2.5,
        segmentElapsedSeconds: 0.75,
        segmentRemainingSeconds: 1.25,
        currentOpportunity: 1,
        totalOpportunities: 4,
        canSelectAnswer: true,
        isResting: false,
        isSquatActive: false,
        actionPrompt: '정답을 선택하세요',
      };

      expect(presentation.currentSegmentKind).toBe('answer');
      expect(presentation.canSelectAnswer).toBe(true);
      expect(presentation.isResting).toBe(false);
      expect(presentation.isSquatActive).toBe(false);
      expect(presentation.totalOpportunities).toBe(4);
    });

    it('AssaultPresentationDTO와 독립적으로 합성 가능해야 한다 (AssaultPresentationWithLoop)', () => {
      const basePresentation: AssaultPresentationDTO = {
        sessionId: 'session_01',
        roundId: 'round_01',
        phase: 'question_reading',
        questionText: '3 + 5 = ?',
        leftChoiceText: '8',
        rightChoiceText: '7',
        bossScaleProgress: 0.5,
        comboCount: 2,
        remainingTimeSeconds: 10,
        warningActive: false,
      };

      const loopPresentation: AssaultPresentationWithLoop = {
        ...basePresentation,
        loop: {
          currentSegmentIndex: 0,
          currentSegmentKind: 'run_question',
          segmentElapsedBeats: 2,
          segmentRemainingBeats: 6,
          segmentElapsedSeconds: 1,
          segmentRemainingSeconds: 3,
          currentOpportunity: 0,
          totalOpportunities: 4,
          canSelectAnswer: false,
          isResting: false,
          isSquatActive: false,
          actionPrompt: '문제를 읽으며 달리세요',
        },
      };

      expect(loopPresentation.sessionId).toBe('session_01');
      expect(loopPresentation.loop?.currentSegmentKind).toBe('run_question');
      expect(loopPresentation.loop?.canSelectAnswer).toBe(false);
    });
  });
});
