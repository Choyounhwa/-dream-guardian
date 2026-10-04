import { describe, it, expect } from 'vitest';
import {
  BEGINNER_PHASE_A_STAR_NOTES,
  BEGINNER_PHASE_A_PATTERN_ID,
} from '../../src/data/beginnerRhythmRoutine.js';
import {
  getRunningMatPattern,
  RUN_CUES,
  HIP_BOUNCE_CUES,
  HIP_SWAY_CUES,
  ARM_CROSS_CUES,
} from '../../src/data/runningMatPatterns.js';

describe('RHYTHM-INTRO-001: 입문 플레이 데이터 정의', () => {
  describe('1. 초급 손 전용 7노트 별 데이터 (beginnerRhythmRoutine)', () => {
    it('BEGINNER_PHASE_A_STAR_NOTES는 정확히 7개의 노트를 가져야 한다', () => {
      expect(BEGINNER_PHASE_A_STAR_NOTES).toBeDefined();
      expect(BEGINNER_PHASE_A_STAR_NOTES.length).toBe(7);
    });

    it('각 노트는 2~8박에 순차적으로 배치되어야 한다', () => {
      const beats = BEGINNER_PHASE_A_STAR_NOTES.map((n) => n.beat);
      expect(beats).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    it('모든 노트는 hand 악기이고 지정된 patternId를 가져야 한다', () => {
      expect(BEGINNER_PHASE_A_PATTERN_ID).toBe('beginner-phase-a-alternating-hands');
      for (const note of BEGINNER_PHASE_A_STAR_NOTES) {
        expect(note.instrument).toBe('hand');
        expect(note.patternId).toBe(BEGINNER_PHASE_A_PATTERN_ID);
      }
    });

    it('왼손(Zone 4)과 오른손(Zone 5)이 번갈아 배치되어야 한다', () => {
      const expected = [
        { part: 'leftHand', zoneId: 4, beat: 2 },
        { part: 'rightHand', zoneId: 5, beat: 3 },
        { part: 'leftHand', zoneId: 4, beat: 4 },
        { part: 'rightHand', zoneId: 5, beat: 5 },
        { part: 'leftHand', zoneId: 4, beat: 6 },
        { part: 'rightHand', zoneId: 5, beat: 7 },
        { part: 'leftHand', zoneId: 4, beat: 8 },
      ];

      expected.forEach((exp, idx) => {
        const note = BEGINNER_PHASE_A_STAR_NOTES[idx];
        expect(note.part).toBe(exp.part);
        expect(note.zoneId).toBe(exp.zoneId);
        expect(note.beat).toBe(exp.beat);
      });
    });

    it('발, 머리, 골반 노트가 없어야 한다', () => {
      for (const note of BEGINNER_PHASE_A_STAR_NOTES) {
        expect(['leftHand', 'rightHand']).toContain(note.part);
        expect(note.instrument).toBe('hand');
        expect([4, 5]).toContain(note.zoneId);
      }
    });

    it('배열 및 각 원소는 불변(frozen)이어야 한다', () => {
      expect(Object.isFrozen(BEGINNER_PHASE_A_STAR_NOTES)).toBe(true);
      for (const note of BEGINNER_PHASE_A_STAR_NOTES) {
        expect(Object.isFrozen(note)).toBe(true);
      }
    });
  });

  describe('2. 러닝 매트 무릎 교대 큐 데이터 (runningMatPatterns)', () => {
    it('RUN_CUES에 KNEE_LEFT와 KNEE_RIGHT가 정의되어 있고 슬롯과 텍스트가 정확해야 한다', () => {
      const kneeLeft = RUN_CUES.KNEE_LEFT;
      const kneeRight = RUN_CUES.KNEE_RIGHT;

      expect(kneeLeft).toBeDefined();
      expect(kneeLeft.id).toBe('knee_left');
      expect(kneeLeft.leftFootSlot).toBe('lift');
      expect(kneeLeft.rightFootSlot).toBe('home');
      expect(kneeLeft.actionText).toBe('왼무릎 들고 복귀');
      expect(kneeLeft.cueText).toBe('왼무릎 들고 복귀');
      expect(kneeLeft.isPrepare).toBe(false);

      expect(kneeRight).toBeDefined();
      expect(kneeRight.id).toBe('knee_right');
      expect(kneeRight.leftFootSlot).toBe('home');
      expect(kneeRight.rightFootSlot).toBe('lift');
      expect(kneeRight.actionText).toBe('오른무릎 들고 복귀');
      expect(kneeRight.cueText).toBe('오른무릎 들고 복귀');
      expect(kneeRight.isPrepare).toBe(false);
    });

    it('8박, 12박, 16박 run exerciseCues의 길이는 각각 6, 10, 14이고 무릎이 교대되며 마지막은 knee_right여야 한다', () => {
      const p8 = getRunningMatPattern('run', 8);
      const p12 = getRunningMatPattern('run', 12);
      const p16 = getRunningMatPattern('run', 16);

      expect(p8.exerciseCues.length).toBe(6);
      expect(p12.exerciseCues.length).toBe(10);
      expect(p16.exerciseCues.length).toBe(14);

      // 8박 패턴 교대 및 마지막 검증
      expect(p8.exerciseCues.map((c) => c.id)).toEqual([
        'knee_left',
        'knee_right',
        'knee_left',
        'knee_right',
        'knee_left',
        'knee_right',
      ]);
      expect(p8.exerciseCues[5].id).toBe('knee_right');

      // 12박 패턴 교대 및 마지막 검증
      for (let i = 0; i < 10; i++) {
        expect(p12.exerciseCues[i].id).toBe(i % 2 === 0 ? 'knee_left' : 'knee_right');
      }
      expect(p12.exerciseCues[9].id).toBe('knee_right');

      // 16박 패턴 교대 및 마지막 검증
      for (let i = 0; i < 14; i++) {
        expect(p16.exerciseCues[i].id).toBe(i % 2 === 0 ? 'knee_left' : 'knee_right');
      }
      expect(p16.exerciseCues[13].id).toBe('knee_right');
    });

    it('extensionCues는 knee_left -> knee_right로 교대 반복되도록 구성되어야 한다', () => {
      const pattern = getRunningMatPattern('run', 8);
      expect(pattern.extensionCues.length).toBeGreaterThanOrEqual(2);
      expect(pattern.extensionCues[0].id).toBe('knee_left');
      expect(pattern.extensionCues[1].id).toBe('knee_right');
    });

    it('prepareCues는 2개를 유지하되 run 전용 문구는 기본 자세를 포함해야 한다', () => {
      const pattern = getRunningMatPattern('run', 8);
      expect(pattern.prepareCues.length).toBe(2);
      expect(pattern.prepareCues[0].isPrepare).toBe(true);
      expect(pattern.prepareCues[0].actionText).toContain('기본 자세');
      expect(pattern.prepareCues[1].isPrepare).toBe(true);
      expect(pattern.prepareCues[1].id).toBe('ready_answer');
    });

    it('비run 모드(hip_bounce, hip_sway, arm_cross) 데이터는 기존 값/순서/문구가 보존되어야 한다', () => {
      const bounce = getRunningMatPattern('hip_bounce', 8);
      expect(bounce.exerciseCues.length).toBe(6);
      expect(bounce.exerciseCues[0].id).toBe(HIP_BOUNCE_CUES.BOUNCE_DOWN.id);
      expect(bounce.exerciseCues[1].id).toBe(HIP_BOUNCE_CUES.BOUNCE_UP.id);

      const sway = getRunningMatPattern('hip_sway', 8);
      expect(sway.exerciseCues.length).toBe(6);
      expect(sway.exerciseCues[0].id).toBe(HIP_SWAY_CUES.SWAY_LEFT.id);
      expect(sway.exerciseCues[1].id).toBe(HIP_SWAY_CUES.SWAY_RIGHT.id);

      const arm = getRunningMatPattern('arm_cross', 8);
      expect(arm.exerciseCues.length).toBe(6);
      expect(arm.exerciseCues[0].id).toBe(ARM_CROSS_CUES.ARM_CROSS_LEFT.id);
      expect(arm.exerciseCues[1].id).toBe(ARM_CROSS_CUES.ARM_CROSS_RIGHT.id);
    });
  });
});
