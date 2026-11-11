/**
 * AssaultLoopEntryOptions.ts - boss_assault UI 기본 루프 선택 및 진입 옵션 단일 해석기
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 * @see docs/assault-loop/LOOP-12.md (ASSAULT-LOOP-12 / Issue #705)
 *
 * 핵심 역할:
 * 1. UI 첫 시작(READY_POSITION) 및 restart 시 URL이나 호출자의 추가 loopProfile 지정 없이도
 *    DEFAULT_ASSAULT_LOOP_CONFIG를 기본 loopProfile로 주입한다.
 * 2. 명시적 pattern만 제공된 경우(레거시/직접 패턴 테스트)는 pattern 경로를 그대로 보존한다.
 * 3. pattern과 loopProfile 동시 지정, unknown loop profile, source=challenge 등은 원자적으로 오류를 발생시킨다.
 * 4. deepFreeze를 적용하여 반환 옵션의 불변성을 보장한다.
 */

import { DEFAULT_ASSAULT_LOOP_CONFIG } from '../../../config/assault-loop.config.js';
import {
  AssaultSessionValidationError,
  type AssaultSessionOptions,
} from '../AssaultSessionFactory.js';
import type { AssaultLoopProfile } from '../../types/assault-loop.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

/**
 * 런타임 상태 및 서비스 키 목록 (deepFreeze 재귀 동결 예외 대상)
 */
const RUNTIME_SERVICE_KEYS: readonly string[] = [
  'battleState',
  'bossController',
  'speech',
  'sfxPlayer',
  'jumpAdapter',
];

/**
 * AssaultLoopProfile 구조적 유효성 검증
 */
export function isValidLoopProfile(profile: unknown): profile is AssaultLoopProfile {
  if (!profile || typeof profile !== 'object') return false;
  const p = profile as Record<string, unknown>;
  return (
    typeof p.profileId === 'string' &&
    p.profileId.trim().length > 0 &&
    typeof p.rulesVersion === 'string' &&
    typeof p.defaultBpm === 'number' &&
    typeof p.baseBeats === 'number' &&
    p.baseBeats > 0 &&
    typeof p.squatBeats === 'number' &&
    p.squatBeats > 0 &&
    typeof p.runBeats === 'number' &&
    p.runBeats > 0 &&
    typeof p.answerBeats === 'number' &&
    p.answerBeats > 0 &&
    typeof p.restBeats === 'number' &&
    p.restBeats >= 0 &&
    typeof p.answerOpportunities === 'number' &&
    p.answerOpportunities > 0 &&
    typeof p.squatSubBeats === 'object' &&
    p.squatSubBeats !== null &&
    Array.isArray(p.candidateGaps)
  );
}

/**
 * boss_assault 진입 옵션을 해석하여 기본 루프 프로필과 불변 설정을 반환한다.
 *
 * @param options 호출자 전달 옵션 (선택적)
 * @returns deepFreeze 동결된 완전한 어설트 세션 진입 옵션
 */
export function resolveAssaultEntryOptions(
  options?: Partial<AssaultSessionOptions>,
  isAssaultUI: boolean = true,
): Readonly<Partial<AssaultSessionOptions>> {
  const rawLoop = (options as any)?.loop;
  const rawLoopProfile = options?.loopProfile;
  const hasPattern = options?.pattern !== undefined;
  const hasExplicitLoop = rawLoop !== undefined || rawLoopProfile !== undefined;

  // 1. 충돌 검증: pattern과 loopProfile을 동시에 지정할 수 없음
  if (hasPattern && hasExplicitLoop) {
    throw new AssaultSessionValidationError('Cannot specify both pattern and loopProfile', [
      'conflicting_pattern_and_loop_profile',
    ]);
  }

  let resolvedLoopProfile: AssaultLoopProfile | undefined;

  // 2. 명시적 loop 또는 loopProfile 해석
  if (hasExplicitLoop) {
    const candidate = rawLoopProfile ?? rawLoop;
    if (typeof candidate === 'string') {
      if (
        candidate === DEFAULT_ASSAULT_LOOP_CONFIG.profileId ||
        candidate === 'default' ||
        candidate === 'standard'
      ) {
        resolvedLoopProfile = DEFAULT_ASSAULT_LOOP_CONFIG;
      } else {
        throw new AssaultSessionValidationError(`Unknown loop profile: ${candidate}`, [
          'unknown_loop_profile',
        ]);
      }
    } else if (isValidLoopProfile(candidate)) {
      resolvedLoopProfile = candidate;
    } else {
      throw new AssaultSessionValidationError('Invalid loop profile object', [
        'invalid_loop_profile',
      ]);
    }
  } else if (!hasPattern && isAssaultUI) {
    // 3. pattern과 loopProfile 모두 미지정 시: boss_assault UI 기본 루프 주입 (비boss legacy 제외)
    resolvedLoopProfile = DEFAULT_ASSAULT_LOOP_CONFIG;
  }

  // 4. 루프 모드에서 challenge roundSource 거부
  if (resolvedLoopProfile !== undefined && options?.roundSource?.kind === 'challenge') {
    throw new AssaultSessionValidationError('Challenge round source is not supported in loop mode', [
      'unsupported_challenge_source',
    ]);
  }

  // 5. 결과 객체 조합
  const result: Partial<AssaultSessionOptions> = {
    ...options,
  };

  if (resolvedLoopProfile !== undefined) {
    (result as any).loopProfile = resolvedLoopProfile;
    if (result.seed === undefined) {
      (result as any).seed = 12345;
    }
    if (result.bpm === undefined) {
      (result as any).bpm = resolvedLoopProfile.defaultBpm;
    }
  }

  // 6. 런타임 서비스 인스턴스를 보호하며 deepFreeze 적용
  const seen = new WeakSet<object>();
  for (const key of RUNTIME_SERVICE_KEYS) {
    const service = (options as any)?.[key];
    if (service && typeof service === 'object') {
      seen.add(service);
    }
  }

  return deepFreeze(result, seen);
}
