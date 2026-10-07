import { describe, it, expect } from 'vitest';
import {
  deriveInstrument,
  keynoteToMotionNote,
  keynotesToMotionNotes,
  motionNoteToKeynote,
  starTargetToMotionNote,
  starTargetsToMotionNotes,
  motionNoteToStarTarget,
  toRenderItem,
  starTargetToRenderItem,
  createMotionNoteRuntime,
} from '../../src/game/adapters/starNoteAdapter.js';
import type { Keynote } from '../../src/types/keynote.js';
import type { StarTarget } from '../../src/types/star.js';
import type { ActiveStarTarget } from '../../src/input/StarCollectionInput.js';
import type { MotionNote, MotionNoteRuntime } from '../../src/types/motion-note.js';
import { BEGINNER_PHASE_A_STAR_NOTES } from '../../src/data/beginnerRhythmRoutine.js';
import { DEFAULT_FEVER_PATTERNS } from '../../src/game/BossFeverController.js';

describe('starNoteAdapter (Issue #480 [MRN-06])', () => {
  describe('1. deriveInstrument (part 기반 악기 역유도)', () => {
    it('손 및 상체 부위는 "hand"로 유도되어야 한다', () => {
      expect(deriveInstrument('leftHand')).toBe('hand');
      expect(deriveInstrument('rightHand')).toBe('hand');
      expect(deriveInstrument('head')).toBe('hand');
    });

    it('골반(hip) 및 바닥/발 부위는 "foot"으로 유도되어야 한다', () => {
      expect(deriveInstrument('hip')).toBe('foot');
      expect(deriveInstrument('leftFoot')).toBe('foot');
      expect(deriveInstrument('rightFoot')).toBe('foot');
      expect(deriveInstrument('centerFoot')).toBe('foot');
      expect(deriveInstrument('bothFeet')).toBe('foot');
      expect(deriveInstrument('fullBody')).toBe('foot');
    });
  });

  describe('2. Keynote -> MotionNote 변환', () => {
    it('기본 Keynote를 tap interaction과 star source를 가진 MotionNote로 변환해야 한다', () => {
      const keynote: Keynote = {
        patternId: 'TEST_ROUTINE_1',
        part: 'leftHand',
        zoneId: 4,
        instrument: 'hand',
        beat: 2,
      };

      const note = keynoteToMotionNote(keynote);

      expect(note.id).toBe('TEST_ROUTINE_1_b2');
      expect(note.patternId).toBe('TEST_ROUTINE_1');
      expect(note.beat).toBe(2);
      expect(note.requirements).toEqual([{ part: 'leftHand', zoneId: 4 }]);
      expect(note.interaction).toBe('tap');
      expect(note.source).toBe('star');
      expect(note.leadBeats).toBeUndefined();
    });

    it('옵션을 통해 id, source, leadBeats, profileId를 커스텀 지정할 수 있어야 한다', () => {
      const keynote: Keynote = {
        patternId: 'FEVER_1',
        part: 'hip',
        zoneId: 9,
        instrument: 'foot',
        beat: 5,
      };

      const note = keynoteToMotionNote(keynote, {
        id: 'custom_fever_note_5',
        source: 'fever',
        leadBeats: 4,
        profileId: 'stomp_foot',
      });

      expect(note.id).toBe('custom_fever_note_5');
      expect(note.source).toBe('fever');
      expect(note.leadBeats).toBe(4);
      expect(note.profileId).toBe('stomp_foot');
      expect(note.requirements).toEqual([{ part: 'hip', zoneId: 9 }]);
    });

    it('배열 변환 keynotesToMotionNotes가 올바르게 동작해야 한다', () => {
      const keynotes: readonly Keynote[] = [
        { patternId: 'PAT_1', part: 'leftHand', zoneId: 1, instrument: 'hand', beat: 1 },
        { patternId: 'PAT_1', part: 'rightHand', zoneId: 2, instrument: 'hand', beat: 2 },
      ];

      const notes = keynotesToMotionNotes(keynotes, { source: 'star' });
      expect(notes.length).toBe(2);
      expect(notes[0].beat).toBe(1);
      expect(notes[1].beat).toBe(2);
    });
  });

  describe('3. StarTarget -> MotionNote 변환', () => {
    it('StarTarget의 beatIndex를 beat로 매핑하고 단일 requirement로 변환해야 한다', () => {
      const target: StarTarget = {
        patternId: 'STAR_TARGET_PAT',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 3,
        cursorType: 'rightHand',
        landingTime: 1.5,
      };

      const note = starTargetToMotionNote(target);

      expect(note.id).toBe('STAR_TARGET_PAT_b3');
      expect(note.patternId).toBe('STAR_TARGET_PAT');
      expect(note.beat).toBe(3);
      expect(note.requirements).toEqual([{ part: 'rightHand', zoneId: 5 }]);
      expect(note.interaction).toBe('tap');
      expect(note.source).toBe('star');
    });

    it('ActiveStarTarget도 정상적으로 MotionNote로 변환할 수 있어야 한다', () => {
      const activeTarget: ActiveStarTarget = {
        patternId: 'ACTIVE_PAT',
        part: 'hip',
        zoneId: 10,
        beatIndex: 6,
        landingTime: 3.0,
      };

      const note = starTargetToMotionNote(activeTarget, { source: 'fever', leadBeats: 2 });
      expect(note.beat).toBe(6);
      expect(note.source).toBe('fever');
      expect(note.leadBeats).toBe(2);
      expect(note.requirements).toEqual([{ part: 'hip', zoneId: 10 }]);
    });

    it('배열 변환 starTargetsToMotionNotes가 올바르게 동작해야 한다', () => {
      const targets: StarTarget[] = [
        { patternId: 'P1', part: 'leftHand', zoneId: 4, beatIndex: 1 },
        { patternId: 'P1', part: 'rightHand', zoneId: 5, beatIndex: 2 },
      ];

      const notes = starTargetsToMotionNotes(targets);
      expect(notes.length).toBe(2);
      expect(notes[0].id).toBe('P1_b1');
      expect(notes[1].id).toBe('P1_b2');
    });
  });

  describe('4. 양방향 왕복 변환(Round-Trip) 손실 없음 검증', () => {
    it('Keynote -> MotionNote -> Keynote 왕복 시 원본 데이터가 완전 보존되어야 한다', () => {
      const originalKeynotes: readonly Keynote[] = [
        { patternId: 'RT_1', part: 'leftHand', zoneId: 4, instrument: 'hand', beat: 2 },
        { patternId: 'RT_2', part: 'rightHand', zoneId: 5, instrument: 'hand', beat: 3 },
        { patternId: 'RT_3', part: 'hip', zoneId: 9, instrument: 'foot', beat: 5 },
        { patternId: 'RT_4', part: 'hip', zoneId: 10, instrument: 'foot', beat: 8 },
      ];

      for (const original of originalKeynotes) {
        const motionNote = keynoteToMotionNote(original);
        const restored = motionNoteToKeynote(motionNote);

        expect(restored).toEqual(original);
      }
    });

    it('StarTarget -> MotionNote -> StarTarget 왕복 시 필드가 완전 보존되어야 한다', () => {
      const originalTarget: StarTarget = {
        patternId: 'ST_RT',
        part: 'rightHand',
        zoneId: 3,
        beatIndex: 4,
        cursorType: 'rightHand',
        landingTime: 2.0,
      };

      const motionNote = starTargetToMotionNote(originalTarget);
      const restored = motionNoteToStarTarget(motionNote, {
        landingTime: originalTarget.landingTime,
        cursorType: originalTarget.cursorType,
      });

      expect(restored).toEqual(originalTarget);
    });
  });

  describe('5. toRenderItem 및 런타임 상태 -> MotionNoteRenderItem 변환', () => {
    const sampleNote: MotionNote = {
      id: 'NOTE_RT_1',
      patternId: 'PAT_RT',
      beat: 4,
      requirements: [{ part: 'leftHand', zoneId: 4 }],
      interaction: 'tap',
      source: 'star',
      leadBeats: 4,
    };

    it('runtime 상태로부터 now, spb, leadBeats 기반 progress 및 timeToLanding을 정확히 산출해야 한다', () => {
      const spb = 0.5;
      const sequenceStart = 10.0;
      // beat=4, landingTime = 10.0 + (4 - 1) * 0.5 = 11.5s
      // leadBeats = 4, displayStart = 11.5 - 4 * 0.5 = 9.5s
      const runtime = createMotionNoteRuntime(sampleNote, {
        spb,
        sequenceStart,
        leadBeats: 4,
      });

      expect(runtime.landingTime).toBeCloseTo(11.5);
      expect(runtime.displayStart).toBeCloseTo(9.5);

      // 1. 소실점 시작 시점 (now = displayStart = 9.5)
      const atStart = toRenderItem(runtime, 9.5);
      expect(atStart.progress).toBeCloseTo(0.0);
      expect(atStart.timeToLanding).toBeCloseTo(2.0);
      expect(atStart.id).toBe('NOTE_RT_1');
      expect(atStart.interaction).toBe('tap');
      expect(atStart.profileId).toBe('star_hand');

      // 2. 비행 중간 시점 (now = 10.5)
      const atMid = toRenderItem(runtime, 10.5);
      expect(atMid.progress).toBeCloseTo(0.5);
      expect(atMid.timeToLanding).toBeCloseTo(1.0);

      // 3. 착지 판정 시점 (now = landingTime = 11.5)
      const atLanding = toRenderItem(runtime, 11.5);
      expect(atLanding.progress).toBeCloseTo(1.0);
      expect(atLanding.timeToLanding).toBeCloseTo(0.0);

      // 4. 착지 후 초과 시점 (now = 12.0) -> progress > 1, timeToLanding < 0
      const afterLanding = toRenderItem(runtime, 12.0);
      expect(afterLanding.progress).toBeCloseTo(1.25);
      expect(afterLanding.timeToLanding).toBeCloseTo(-0.5);

      // 5. 출현 전 시점 (now = 9.0) -> progress < 0
      const beforeDisplay = toRenderItem(runtime, 9.0);
      expect(beforeDisplay.progress).toBeCloseTo(-0.25);
      expect(beforeDisplay.timeToLanding).toBeCloseTo(2.5);
    });

    it('판정 결과(result) 및 holdProgress를 RenderItem의 outcome과 holdProgress로 올바르게 전달해야 한다', () => {
      const runtime: MotionNoteRuntime = {
        note: sampleNote,
        landingTime: 5.0,
        displayStart: 3.0,
        state: 'resolved',
        holdProgress: 0.75,
        result: {
          noteId: sampleNote.id,
          interaction: 'tap',
          rating: 'Perfect',
          success: true,
          timingError: 0.02,
          matchedParts: ['leftHand'],
        },
      };

      const itemHit = toRenderItem(runtime, 5.0);
      expect(itemHit.outcome).toBe('hit');
      expect(itemHit.holdProgress).toBe(0.75);

      // Miss 결과
      runtime.result = {
        noteId: sampleNote.id,
        interaction: 'tap',
        rating: 'Miss',
        success: false,
        timingError: 0.5,
        matchedParts: [],
      };
      const itemMiss = toRenderItem(runtime, 5.5);
      expect(itemMiss.outcome).toBe('miss');
    });

    it('starTargetToRenderItem 편의 함수를 통해 StarTarget에서 직접 RenderItem을 산출할 수 있어야 한다', () => {
      const target: StarTarget = {
        patternId: 'TARGET_RENDER',
        part: 'rightHand',
        zoneId: 5,
        beatIndex: 3,
        landingTime: 6.0,
      };

      const item = starTargetToRenderItem(target, {
        now: 5.0,
        spb: 0.5,
        leadBeats: 4, // duration = 2.0s, displayStart = 4.0s
      });

      expect(item.id).toBe('TARGET_RENDER_b3');
      expect(item.progress).toBeCloseTo(0.5); // (5.0 - 4.0) / 2.0 = 0.5
      expect(item.timeToLanding).toBeCloseTo(1.0); // 6.0 - 5.0 = 1.0
      expect(item.profileId).toBe('star_hand');
    });
  });

  describe('6. 실제 프로덕션 데이터 변환 무결성 검증', () => {
    it('BEGINNER_PHASE_A_STAR_NOTES (7개 노트)는 손실 없이 MotionNote로 변환되고 다시 복원되어야 한다', () => {
      expect(BEGINNER_PHASE_A_STAR_NOTES.length).toBe(7);

      const motionNotes = keynotesToMotionNotes(BEGINNER_PHASE_A_STAR_NOTES);
      expect(motionNotes.length).toBe(7);

      for (let i = 0; i < BEGINNER_PHASE_A_STAR_NOTES.length; i++) {
        const orig = BEGINNER_PHASE_A_STAR_NOTES[i];
        const converted = motionNotes[i];

        expect(converted.patternId).toBe(orig.patternId);
        expect(converted.beat).toBe(orig.beat);
        expect(converted.requirements).toEqual([{ part: orig.part, zoneId: orig.zoneId }]);
        expect(converted.interaction).toBe('tap');
        expect(converted.source).toBe('star');

        const restored = motionNoteToKeynote(converted);
        expect(restored).toEqual(orig);
      }
    });

    it('DEFAULT_FEVER_PATTERNS의 모든 패턴(손/발 혼합)은 손실 없이 변환 및 복원되어야 한다', () => {
      expect(DEFAULT_FEVER_PATTERNS.length).toBeGreaterThan(0);

      for (const feverPattern of DEFAULT_FEVER_PATTERNS) {
        expect(feverPattern.length).toBe(8);

        const motionNotes = keynotesToMotionNotes(feverPattern, { source: 'fever' });
        expect(motionNotes.length).toBe(8);

        for (let i = 0; i < feverPattern.length; i++) {
          const orig = feverPattern[i];
          const note = motionNotes[i];

          expect(note.source).toBe('fever');
          expect(note.interaction).toBe('tap');
          expect(note.beat).toBe(orig.beat);
          expect(note.requirements).toEqual([{ part: orig.part, zoneId: orig.zoneId }]);

          const restored = motionNoteToKeynote(note);
          expect(restored).toEqual(orig);
        }
      }
    });
  });
});
