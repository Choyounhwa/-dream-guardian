/**
 * AssaultReadingCalculator.ts - 보스 접근전(Boss Assault) 문제 읽기 시간 산출 유틸리티
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §8.1, A03, DEC-B3)
 * @see docs/assault-runtime-recovery/REC-00.md (#588)
 */

import {
  DEFAULT_ASSAULT_CONFIG,
  type AssaultTimingAndBalanceConfig,
} from '../../../config/assault.config.js';
import type {
  AssaultRoundConfig,
  AssaultRoundQuestionData,
} from './AssaultRoundController.js';

export function resolveReadingMinSeconds(
  question: AssaultRoundQuestionData,
  config: Partial<AssaultTimingAndBalanceConfig>,
): number {
  const readingMin = config.readingMinSeconds ?? DEFAULT_ASSAULT_CONFIG.readingMinSeconds;
  if (typeof readingMin === 'number') {
    return readingMin;
  }
  let opType = question.type;
  if (!opType && question.text) {
    if (question.text.includes('+')) opType = 'addition';
    else if (question.text.includes('-')) opType = 'subtraction';
    else if (question.text.includes('*') || question.text.includes('×')) opType = 'multiplication';
    else if (question.text.includes('/') || question.text.includes('÷')) opType = 'division';
  }
  const key = (opType ?? 'default') as keyof typeof readingMin;
  return readingMin[key] ?? readingMin.default ?? 3.5;
}

/**
 * REC-00 / #588 승인 읽기 시간 산출 조합식:
 * 8박 기본 시간, 유형별 하한, 문항 minReadSeconds, 글자수 추정 TTS(상한 ttsMaxSeconds)의 누적 가산(Additive).
 * 중복 가산 방지 및 최소 8박(minRoundBeats) 보장.
 */
export function calculateReadingDurationSeconds(
  question: AssaultRoundQuestionData,
  config: AssaultRoundConfig,
  secondsPerBeat: number,
): number {
  const minRoundBeats = config.minRoundBeats ?? DEFAULT_ASSAULT_CONFIG.minRoundBeats ?? 8;
  const baseBeatsTime = minRoundBeats * secondsPerBeat;

  // 1. 유형 하한
  const typeMinSeconds = resolveReadingMinSeconds(question, config);

  // 2. 글자 수 기반 추정 TTS 시간 (상한 ttsMaxSeconds 클램프)
  const charRateMs = config.readingCharRateMs ?? DEFAULT_ASSAULT_CONFIG.readingCharRateMs ?? 150;
  const ttsMaxSeconds = config.ttsMaxSeconds ?? DEFAULT_ASSAULT_CONFIG.ttsMaxSeconds ?? 3.0;
  const charCount = (question.text || '').trim().length;
  const estimatedTtsSeconds = Math.min((charCount * charRateMs) / 1000, ttsMaxSeconds);

  // 3. 문항 자체 minReadSeconds가 지정되어 있다면 이를 누적 기준(base)으로 삼고,
  // 지정되지 않은 경우(예: 단순 문자열 전달 등) 유형 하한을 사용하되 8박 기준과의 중복 가산 방지
  let requiredSeconds: number;
  if (typeof question.minReadSeconds === 'number') {
    requiredSeconds = Math.max(baseBeatsTime, question.minReadSeconds + estimatedTtsSeconds);
  } else {
    // 단순 문자열 또는 기본 유형인 경우 8박 시간과 유형 하한 중 큰 값 사용
    requiredSeconds = Math.max(baseBeatsTime, typeMinSeconds);
  }

  // 4. 다음 박자 경계(Beat Boundary)로 올림 정렬
  const targetBeats = Math.max(minRoundBeats, Math.ceil(requiredSeconds / secondsPerBeat));
  return targetBeats * secondsPerBeat;
}
