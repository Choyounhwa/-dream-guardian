/**
 * beginnerRhythmRoutine.ts - 입문 플레이 손 전용 7노트 별 데이터 정의
 *
 * @see Issue #409 [RHYTHM-INTRO-001]
 * @see Issue #406 [RHYTHM-INTRO-TRACK]
 */

import type { Keynote } from '../types/keynote.js';

export const BEGINNER_PHASE_A_PATTERN_ID = 'beginner-phase-a-alternating-hands';

/**
 * 입문 플레이 Phase A 별 7노트 시퀀스 (불변 객체 배열)
 *
 * 구성:
 * 1. 왼손 (leftHand, Zone 4, Beat 2)
 * 2. 오른손 (rightHand, Zone 5, Beat 3)
 * 3. 왼손 (leftHand, Zone 4, Beat 4)
 * 4. 오른손 (rightHand, Zone 5, Beat 5)
 * 5. 왼손 (leftHand, Zone 4, Beat 6)
 * 6. 오른손 (rightHand, Zone 5, Beat 7)
 * 7. 왼손 (leftHand, Zone 4, Beat 8)
 */
export const BEGINNER_PHASE_A_STAR_NOTES: readonly Keynote[] = Object.freeze([
  Object.freeze({
    patternId: BEGINNER_PHASE_A_PATTERN_ID,
    part: 'leftHand',
    zoneId: 4,
    instrument: 'hand',
    beat: 2,
  }),
  Object.freeze({
    patternId: BEGINNER_PHASE_A_PATTERN_ID,
    part: 'rightHand',
    zoneId: 5,
    instrument: 'hand',
    beat: 3,
  }),
  Object.freeze({
    patternId: BEGINNER_PHASE_A_PATTERN_ID,
    part: 'leftHand',
    zoneId: 4,
    instrument: 'hand',
    beat: 4,
  }),
  Object.freeze({
    patternId: BEGINNER_PHASE_A_PATTERN_ID,
    part: 'rightHand',
    zoneId: 5,
    instrument: 'hand',
    beat: 5,
  }),
  Object.freeze({
    patternId: BEGINNER_PHASE_A_PATTERN_ID,
    part: 'leftHand',
    zoneId: 4,
    instrument: 'hand',
    beat: 6,
  }),
  Object.freeze({
    patternId: BEGINNER_PHASE_A_PATTERN_ID,
    part: 'rightHand',
    zoneId: 5,
    instrument: 'hand',
    beat: 7,
  }),
  Object.freeze({
    patternId: BEGINNER_PHASE_A_PATTERN_ID,
    part: 'leftHand',
    zoneId: 4,
    instrument: 'hand',
    beat: 8,
  }),
]);
