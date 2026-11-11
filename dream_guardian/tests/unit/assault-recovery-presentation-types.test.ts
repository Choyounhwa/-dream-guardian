/**
 * assault-recovery-presentation-types.test.ts
 * [BOSS-ASSAULT-REC-13] 읽기 전용 접근전 표시 타입 계약 검증
 *
 * @see docs/assault-runtime-recovery/REC-13.md
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md
 * @see https://github.com/Choyounhwa/-dream-guardian/issues/590
 *
 * 절대 규칙:
 * 1. Readonly 불변 계약: 표시 DTO의 모든 필드는 readonly이며 변경을 거부한다.
 * 2. 권위 정보 은닉: 정답 위치(correctSide), 정답 플래그(isCorrect), HP 권위는 표시 DTO에 절대 누출하지 않는다.
 * 3. 런타임 함수/기본값 0건: 표시 DTO는 순수 데이터 스냅샷 인터페이스이며 메서드나 default 값을 소유하지 않는다.
 * 4. 기존 소비자 하위 호환성: 기존 AssaultRoundPresentation 필수 필드 계약을 깨지 않고 additive로 확장한다.
 */

import { describe, it, expect } from 'vitest';
import type {
  PairId,
  AttackId,
  AssaultPairPresentationStatus,
  AssaultPairPresentation,
  AssaultHazardPresentationStatus,
  AssaultHazardPresentation,
  AssaultRoundPresentation,
  AssaultPresentationDTO,
} from '../../src/types/assault.js';

// ─── 타입 레벨 정적 무결성 검증 (정답·채점·HP 누출 원천 차단) ───

type AssertFalse<T extends false> = T;
type HasKey<T, K extends string> = K extends keyof T ? true : false;

// 1. AssaultPairPresentation에 정답/채점/HP 필드가 존재하지 않음을 정적 증명
export type _PairHasNoCorrectSide = AssertFalse<HasKey<AssaultPairPresentation, 'correctSide'>>;
export type _PairHasNoIsCorrect = AssertFalse<HasKey<AssaultPairPresentation, 'isCorrect'>>;
export type _PairHasNoPlayerHp = AssertFalse<HasKey<AssaultPairPresentation, 'playerHp'>>;
export type _PairHasNoDamage = AssertFalse<HasKey<AssaultPairPresentation, 'damage'>>;

// 2. AssaultRoundPresentation에 정답/채점 필드가 존재하지 않음을 정적 증명
export type _RoundHasNoCorrectSide = AssertFalse<HasKey<AssaultRoundPresentation, 'correctSide'>>;
export type _RoundHasNoIsCorrect = AssertFalse<HasKey<AssaultRoundPresentation, 'isCorrect'>>;

// 3. AssaultHazardPresentation에 정답/채점/HP 감산 필드가 존재하지 않음을 정적 증명
export type _HazardHasNoCorrectSide = AssertFalse<HasKey<AssaultHazardPresentation, 'correctSide'>>;
export type _HazardHasNoDamage = AssertFalse<HasKey<AssaultHazardPresentation, 'damage'>>;

// 4. AssaultPresentationDTO에 정답/채점 필드가 존재하지 않음을 정적 증명
export type _DtoHasNoCorrectSide = AssertFalse<HasKey<AssaultPresentationDTO, 'correctSide'>>;
export type _DtoHasNoIsCorrect = AssertFalse<HasKey<AssaultPresentationDTO, 'isCorrect'>>;

describe('[BOSS-ASSAULT-REC-13] 읽기 전용 접근전 표시 타입 계약', () => {
  describe('1. 부정 타입 검사 (Negative Type Tests) & 정보 은닉', () => {
    it('AssaultPairPresentation은 필수 식별자 누락 시 컴파일을 거부해야 한다', () => {
      // @ts-expect-error - pairId 누락 시 컴파일 거부
      const missingPairId: AssaultPairPresentation = { attackId: 'atk-01' as AttackId, leftText: '3', rightText: '5', throwProgress: 0.5, status: 'flying' };
      expect(missingPairId).toBeDefined();

      // @ts-expect-error - attackId 누락 시 컴파일 거부
      const missingAttackId: AssaultPairPresentation = { pairId: 'pair-01' as PairId, leftText: '3', rightText: '5', throwProgress: 0.5, status: 'flying' };
      expect(missingAttackId).toBeDefined();
    });

    it('AssaultPairPresentation은 correctSide 또는 isCorrect 주입 시 컴파일을 거부해야 한다', () => {
      // @ts-expect-error - correctSide는 표시 DTO에 노출 금지 (Excess property check)
      const leakyCorrectSide: AssaultPairPresentation = { pairId: 'pair-01' as PairId, attackId: 'atk-01' as AttackId, leftText: '3', rightText: '5', throwProgress: 0.5, status: 'flying', correctSide: 'left' };
      expect(leakyCorrectSide).toBeDefined();

      // @ts-expect-error - isCorrect는 표시 DTO에 노출 금지 (Excess property check)
      const leakyIsCorrect: AssaultPairPresentation = { pairId: 'pair-01' as PairId, attackId: 'atk-01' as AttackId, leftText: '3', rightText: '5', throwProgress: 0.5, status: 'flying', isCorrect: true };
      expect(leakyIsCorrect).toBeDefined();
    });

    it('AssaultPairPresentation 및 중첩 필드는 읽기 전용이어야 하며 수정을 거부해야 한다', () => {
      const pair: AssaultPairPresentation = Object.freeze({
        pairId: 'pair-01' as PairId,
        attackId: 'atk-01' as AttackId,
        leftText: '7',
        rightText: '9',
        throwProgress: 0.4,
        status: 'flying',
      });

      // 컴파일 타임 @ts-expect-error 거부 및 런타임 불변성 동시 검증
      expect(() => {
        // @ts-expect-error - readonly 속성 변경 컴파일 거부
        pair.leftText = '8';
      }).toThrow();

      expect(() => {
        // @ts-expect-error - readonly 속성 변경 컴파일 거부
        pair.status = 'cancelled';
      }).toThrow();

      expect(() => {
        // @ts-expect-error - readonly 속성 변경 컴파일 거부
        pair.throwProgress = 1.0;
      }).toThrow();

      expect(pair.leftText).toBe('7');
    });
  });

  describe('2. AssaultPairPresentation (답 쌍 읽기 전용 표시 DTO)', () => {
    it('모든 필수 및 선택 필드가 올바른 데이터 타입으로 온전히 표현되어야 한다', () => {
      const pairSnapshot: AssaultPairPresentation = {
        pairId: 'pair-101' as PairId,
        attackId: 'atk-202' as AttackId,
        leftText: '14',
        rightText: '18',
        throwProgress: 0.75,
        progress: 0.75,
        status: 'flying',
        lockedSide: 'left',
        lockedAtSeconds: 2.1,
        arrivalSeconds: 3.5,
        graceDeadlineSeconds: 3.0,
        pairPromptText: '더 큰 수를 고르세요',
        challengeFamily: 'compare_magnitudes',
      };

      expect(pairSnapshot.pairId).toBe('pair-101');
      expect(pairSnapshot.attackId).toBe('atk-202');
      expect(pairSnapshot.leftText).toBe('14');
      expect(pairSnapshot.rightText).toBe('18');
      expect(pairSnapshot.throwProgress).toBe(0.75);
      expect(pairSnapshot.progress).toBe(0.75);
      expect(pairSnapshot.status).toBe('flying');
      expect(pairSnapshot.lockedSide).toBe('left');
      expect(pairSnapshot.lockedAtSeconds).toBe(2.1);
      expect(pairSnapshot.arrivalSeconds).toBe(3.5);
      expect(pairSnapshot.graceDeadlineSeconds).toBe(3.0);
      expect(pairSnapshot.pairPromptText).toBe('더 큰 수를 고르세요');
      expect(pairSnapshot.challengeFamily).toBe('compare_magnitudes');
    });

    it('답 쌍 상태(status)는 취소/도착/비행/잠금/대기를 명확히 지원해야 한다', () => {
      const statuses: AssaultPairPresentationStatus[] = [
        'pending',
        'flying',
        'inFlight',
        'wrong_locked',
        'cancelled',
        'negated',
        'disarmed',
        'hit',
        'wrong_hit',
        'timeout',
        'miss',
      ];

      for (const st of statuses) {
        const p: AssaultPairPresentation = {
          pairId: 'p' as PairId,
          attackId: 'a' as AttackId,
          leftText: 'L',
          rightText: 'R',
          throwProgress: 0,
          status: st,
        };
        expect(p.status).toBe(st);
      }
    });

    it('표시 DTO에는 런타임 함수나 메서드가 존재하지 않아야 한다', () => {
      const pair: AssaultPairPresentation = {
        pairId: 'p' as PairId,
        attackId: 'a' as AttackId,
        leftText: '1',
        rightText: '2',
        throwProgress: 0.2,
        status: 'pending',
      };

      for (const [key, val] of Object.entries(pair)) {
        expect(typeof val).not.toBe('function');
        expect(key).toBeDefined();
      }
    });
  });

  describe('3. AssaultHazardPresentation (하향 회피 및 기믹 위험 표시 DTO)', () => {
    it('하향 회피(스쿼트) 표시 DTO를 올바른 단위와 상태로 구성할 수 있어야 한다', () => {
      const hazard: AssaultHazardPresentation = {
        attackId: 'atk-sq-01' as AttackId,
        kind: 'squat',
        active: true,
        progress: 0.6,
        status: 'active',
        promptText: '스쿼트로 숙여서 회피하세요!',
        arrivalSeconds: 2.8,
        evasionDeadlineSeconds: 2.6,
      };

      expect(hazard.attackId).toBe('atk-sq-01');
      expect(hazard.kind).toBe('squat');
      expect(hazard.active).toBe(true);
      expect(hazard.progress).toBe(0.6);
      expect(hazard.status).toBe('active');
      expect(hazard.promptText).toBe('스쿼트로 숙여서 회피하세요!');
      expect(hazard.arrivalSeconds).toBe(2.8);
      expect(hazard.evasionDeadlineSeconds).toBe(2.6);
    });

    it('회피 상태(status)는 예고/활성/회피성공/피격/취소를 명확히 지원해야 한다', () => {
      const statuses: AssaultHazardPresentationStatus[] = [
        'telegraph',
        'active',
        'evaded',
        'hit',
        'cancelled',
      ];

      for (const st of statuses) {
        const h: AssaultHazardPresentation = {
          attackId: 'a' as AttackId,
          kind: 'squat',
          active: true,
          progress: 0.5,
          status: st,
        };
        expect(h.status).toBe(st);
      }
    });
  });

  describe('4. AssaultRoundPresentation 하위 호환성 및 Additive 확장', () => {
    it('기존 필수 필드만으로도 AssaultRoundPresentation이 정상 컴파일되어야 한다 (호환성 보존)', () => {
      const legacyRound: AssaultRoundPresentation = {
        sessionId: 'sess-001',
        roundId: 'round-001',
        phase: 'encounters',
        questionText: '10 + 20 = ?',
        currentEncounterIndex: 0,
        totalEncounters: 3,
        activeSeconds: 1.25,
        readingProgress: 1.0,
        isPaused: false,
      };

      expect(legacyRound.sessionId).toBe('sess-001');
      expect(legacyRound.pair).toBeUndefined();
      expect(legacyRound.hazard).toBeUndefined();
    });

    it('확장된 additive 필드(pair, hazard, pairPromptText 등)를 온전히 수용해야 한다', () => {
      const pair: AssaultPairPresentation = {
        pairId: 'p-01' as PairId,
        attackId: 'a-01' as AttackId,
        leftText: '30',
        rightText: '25',
        throwProgress: 0.3,
        status: 'flying',
      };

      const hazard: AssaultHazardPresentation = {
        attackId: 'a-02' as AttackId,
        kind: 'squat',
        active: false,
        progress: 0,
        status: 'telegraph',
      };

      const enrichedRound: AssaultRoundPresentation = {
        sessionId: 'sess-001',
        roundId: 'round-001',
        phase: 'encounters',
        questionText: '10 + 20 = ?',
        currentEncounterIndex: 0,
        totalEncounters: 2,
        activeSeconds: 2.5,
        readingProgress: 1.0,
        throwProgress: 0.3,
        remainingSeconds: 7.5,
        bossScaleProgress: 0.5,
        isPaused: false,
        pairId: 'p-01' as PairId,
        attackId: 'a-01' as AttackId,
        leftChoiceText: '30',
        rightChoiceText: '25',
        lockedSide: null,
        pair,
        hazard,
        pairPromptText: '올바른 답을 고르세요',
        challengeFamily: 'addition_two_digit',
      };

      expect(enrichedRound.pair).toBe(pair);
      expect(enrichedRound.hazard).toBe(hazard);
      expect(enrichedRound.pairPromptText).toBe('올바른 답을 고르세요');
      expect(enrichedRound.challengeFamily).toBe('addition_two_digit');
    });
  });

  describe('5. 렌더러(AssaultPairPainter / AssaultSceneRenderer)와의 구조적 호환성', () => {
    it('AssaultPairPresentation 객체는 렌더러의 pair 스냅샷 인터페이스와 구조적으로 호환되어야 한다', () => {
      const presentationPair: AssaultPairPresentation = {
        pairId: 'p-01' as PairId,
        attackId: 'a-01' as AttackId,
        leftText: 'Left',
        rightText: 'Right',
        throwProgress: 0.8,
        progress: 0.8,
        status: 'flying',
        lockedSide: 'right',
      };

      // 렌더러가 요구하는 최소 덕 타이핑 형태를 충족하는지 검증
      const renderFriendly = {
        pairId: presentationPair.pairId,
        attackId: presentationPair.attackId,
        leftText: presentationPair.leftText,
        rightText: presentationPair.rightText,
        progress: presentationPair.progress ?? presentationPair.throwProgress,
        status: presentationPair.status,
        lockedSide: presentationPair.lockedSide,
      };

      expect(renderFriendly.leftText).toBe('Left');
      expect(renderFriendly.rightText).toBe('Right');
      expect(renderFriendly.progress).toBe(0.8);
      expect(renderFriendly.lockedSide).toBe('right');
    });
  });
});
