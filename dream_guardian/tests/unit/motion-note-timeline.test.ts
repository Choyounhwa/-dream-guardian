import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionNoteTimeline } from '../../src/game/MotionNoteTimeline.js';
import { TapJudge, type MotionInputSnapshot } from '../../src/game/interaction/TapJudge.js';
import type { MotionNote } from '../../src/types/motion-note.js';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';

describe('MotionNoteTimeline + TapJudge (Issue #483 / MRN-09)', () => {
  const sampleNotes: readonly MotionNote[] = [
    {
      id: 'note_1',
      patternId: 'TEST_PAT',
      beat: 2,
      requirements: [{ part: 'leftHand', zoneId: 4 }],
      interaction: 'tap',
      source: 'star',
    },
    {
      id: 'note_2',
      patternId: 'TEST_PAT',
      beat: 3,
      requirements: [
        { part: 'leftHand', zoneId: 4 },
        { part: 'rightHand', zoneId: 5 },
      ],
      interaction: 'tap',
      source: 'star',
    },
    {
      id: 'note_3_foot',
      patternId: 'TEST_PAT',
      beat: 4,
      requirements: [{ part: 'centerFoot', zoneId: 10 }],
      interaction: 'tap',
      source: 'star',
    },
  ];

  describe('1. MotionNote 정의 로드 및 런타임 생성', () => {
    it('landingTime = start + (beat-1) * spb 및 displayStart = landingTime - leadBeats * spb 공식을 정확히 따른다', () => {
      const timeline = new MotionNoteTimeline({
        spb: 0.5,
        leadBeats: 2,
      });

      timeline.loadNotes(sampleNotes, { sequenceStart: 10.0 });

      expect(timeline.runtimes).toHaveLength(3);

      // Note 1: beat 2 -> landing = 10.0 + (2-1)*0.5 = 10.5, display = 10.5 - 2*0.5 = 9.5
      const rt1 = timeline.runtimes[0];
      expect(rt1.landingTime).toBeCloseTo(10.5, 4);
      expect(rt1.displayStart).toBeCloseTo(9.5, 4);
      expect(rt1.state).toBe('pending');
      expect(rt1.note.id).toBe('note_1');

      // Note 2: beat 3 -> landing = 10.0 + (3-1)*0.5 = 11.0, display = 11.0 - 2*0.5 = 10.0
      const rt2 = timeline.runtimes[1];
      expect(rt2.landingTime).toBeCloseTo(11.0, 4);
      expect(rt2.displayStart).toBeCloseTo(10.0, 4);
      expect(rt2.state).toBe('pending');

      // Note 3: beat 4 -> landing = 10.0 + (4-1)*0.5 = 11.5, display = 11.5 - 2*0.5 = 10.5
      const rt3 = timeline.runtimes[2];
      expect(rt3.landingTime).toBeCloseTo(11.5, 4);
      expect(rt3.displayStart).toBeCloseTo(10.5, 4);
      expect(rt3.state).toBe('pending');
    });

    it('노트 정의에 leadBeats가 개별 지정되어 있으면 해당 값을 우선 적용한다', () => {
      const customNote: MotionNote = {
        id: 'custom_lead',
        patternId: 'TEST_PAT',
        beat: 2,
        requirements: [{ part: 'head', zoneId: 5 }],
        interaction: 'tap',
        leadBeats: 3,
      };

      const timeline = new MotionNoteTimeline({ spb: 0.5, leadBeats: 2 });
      timeline.loadNotes([customNote], { sequenceStart: 0.0 });

      const rt = timeline.runtimes[0];
      expect(rt.landingTime).toBeCloseTo(0.5, 4);
      // leadBeats = 3 -> displayStart = 0.5 - 3 * 0.5 = -1.0
      expect(rt.displayStart).toBeCloseTo(-1.0, 4);
    });
  });

  describe('2. TapJudge 판정 로직 및 윈도우/다중 requirement 검증', () => {
    let judge: TapJudge;

    beforeEach(() => {
      judge = new TapJudge({
        perfect: 0.12,
        good: 0.25,
        late: 0.40,
      });
    });

    it('타이밍 경계값에 따라 Perfect, Good, Late, Miss 등급을 정확히 산출한다', () => {
      const landing = 10.0;

      // Perfect: |diff| <= 0.12
      expect(judge.judgeTiming(10.0, landing)).toBe('Perfect');
      expect(judge.judgeTiming(10.12, landing)).toBe('Perfect');
      expect(judge.judgeTiming(9.88, landing)).toBe('Perfect');

      // Good: 0.12 < |diff| <= 0.25
      expect(judge.judgeTiming(10.13, landing)).toBe('Good');
      expect(judge.judgeTiming(10.25, landing)).toBe('Good');
      expect(judge.judgeTiming(9.75, landing)).toBe('Good');

      // Late: 0.25 < |diff| <= 0.40
      expect(judge.judgeTiming(10.26, landing)).toBe('Late');
      expect(judge.judgeTiming(10.40, landing)).toBe('Late');
      expect(judge.judgeTiming(9.60, landing)).toBe('Late');

      // Miss: |diff| > 0.40
      expect(judge.judgeTiming(10.41, landing)).toBe('Miss');
      expect(judge.judgeTiming(9.59, landing)).toBe('Miss');
    });

    it('다중 requirement(Double)는 모든 부위가 동시에 충족될 때만 판정 확정된다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5 });
      timeline.loadNotes([sampleNotes[1]], { sequenceStart: 10.0 });
      // note_2: landing at 11.0s, requirements: [leftHand:4, rightHand:5]
      const rt = timeline.runtimes[0];

      // 1. 왼손만 4번에 진입한 경우 -> 판정 미확정(null)
      const inputOnlyLeft: MotionInputSnapshot = {
        cursorZones: { leftHand: 4, rightHand: null },
      };
      const resPartial = judge.evaluate(rt, inputOnlyLeft, 11.0);
      expect(resPartial).toBeNull();

      // 2. 양손 모두 진입한 경우 -> Perfect 확정
      const inputBoth: MotionInputSnapshot = {
        cursorZones: { leftHand: 4, rightHand: 5 },
      };
      const resBoth = judge.evaluate(rt, inputBoth, 11.0);
      expect(resBoth).not.toBeNull();
      expect(resBoth?.rating).toBe('Perfect');
      expect(resBoth?.success).toBe(true);
      expect(resBoth?.matchedParts).toEqual(['leftHand', 'rightHand']);
    });

    it('하체/발(FloorPart) 요구 노트는 FootKeynoteEvent 입력으로 충족된다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5 });
      timeline.loadNotes([sampleNotes[2]], { sequenceStart: 10.0 });
      // note_3_foot: landing at 11.5s, requirement: centerFoot:10
      const rt = timeline.runtimes[0];

      // 손 커서만 10번에 진입한 경우 -> 불일치(null)
      const inputHand: MotionInputSnapshot = {
        cursorZones: { leftHand: 10 },
      };
      expect(judge.evaluate(rt, inputHand, 11.5)).toBeNull();

      // FootKeynoteEvent가 zoneId 10으로 발생한 경우 -> Perfect 확정
      const inputFoot: MotionInputSnapshot = {
        recentFootEvents: [
          {
            foot: 'centerFoot',
            zoneId: 10,
            source: 'knee-proxy',
            timestamp: 11.5,
            confidence: 1.0,
          },
        ],
      };
      const resFoot = judge.evaluate(rt, inputFoot, 11.5);
      expect(resFoot).not.toBeNull();
      expect(resFoot?.rating).toBe('Perfect');
      expect(resFoot?.matchedParts).toEqual(['centerFoot']);
    });

    it('판정 윈도우 초과(landingTime + 0.40s) 시 입력이 없으면 Miss로 확정된다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5 });
      timeline.loadNotes([sampleNotes[0]], { sequenceStart: 10.0 });
      // note_1: landing at 10.5s
      const rt = timeline.runtimes[0];

      const emptyInput: MotionInputSnapshot = {};
      const res = judge.evaluate(rt, emptyInput, 10.91); // 10.5 + 0.40 = 10.90 -> 10.91 is past window
      expect(res).not.toBeNull();
      expect(res?.rating).toBe('Miss');
      expect(res?.success).toBe(false);
      expect(res?.matchedParts).toEqual([]);
    });
  });

  describe('3. 시간 경과에 따른 상태 전이 (pending -> inFlight -> judging -> resolved)', () => {
    it('시간이 흐름에 따라 각 단계별 상태 전이가 정확히 일어난다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5, leadBeats: 2 });
      // note_1: landing = 10.5, displayStart = 9.5, judgingWindow: 10.10 ~ 10.90
      timeline.loadNotes([sampleNotes[0]], { sequenceStart: 10.0 });
      const rt = timeline.runtimes[0];

      // 1. now = 9.0s: displayStart(9.5s) 이전 -> pending
      timeline.update(9.0);
      expect(rt.state).toBe('pending');

      // 2. now = 9.8s: displayStart 이후, judgingWindow(10.10s) 이전 -> inFlight
      timeline.update(9.8);
      expect(rt.state).toBe('inFlight');

      // 3. now = 10.2s: judgingWindow 진입, 미입력 상태 -> judging
      timeline.update(10.2);
      expect(rt.state).toBe('judging');

      // 4. now = 10.5s: 입력 발생 -> resolved
      timeline.update(10.5, { cursorZones: { leftHand: 4 } });
      expect(rt.state).toBe('resolved');
      expect(rt.result?.rating).toBe('Perfect');

      // 5. 이후 시간 경과해도 resolved 상태 유지
      timeline.update(12.0);
      expect(rt.state).toBe('resolved');
    });

    it('미입력 시 10.90s 초과 시 자동으로 judging -> resolved (Miss)로 전이된다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5, leadBeats: 2 });
      timeline.loadNotes([sampleNotes[0]], { sequenceStart: 10.0 });
      const rt = timeline.runtimes[0];

      timeline.update(10.2);
      expect(rt.state).toBe('judging');

      timeline.update(10.91);
      expect(rt.state).toBe('resolved');
      expect(rt.result?.rating).toBe('Miss');
    });
  });

  describe('4. getRenderItems(now) 렌더링 스냅샷 제공', () => {
    it('현재 시각에 표시되어야 할 노트의 렌더링 스냅샷(RenderItem)을 올바르게 반환한다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5, leadBeats: 2 });
      timeline.loadNotes(sampleNotes, { sequenceStart: 10.0 });
      // note_1: display 9.5, landing 10.5
      // note_2: display 10.0, landing 11.0
      // note_3: display 10.5, landing 11.5

      // at 9.0s: none started display
      expect(timeline.getRenderItems(9.0)).toHaveLength(0);

      // at 9.8s: only note_1 is flying
      const items98 = timeline.getRenderItems(9.8);
      expect(items98).toHaveLength(1);
      expect(items98[0].id).toBe('note_1');
      expect(items98[0].progress).toBeGreaterThan(0);
      expect(items98[0].progress).toBeLessThan(1);
      expect(items98[0].timeToLanding).toBeCloseTo(0.7, 4);

      // at 10.2s: note_1 and note_2 are flying
      const items102 = timeline.getRenderItems(10.2);
      expect(items102).toHaveLength(2);
      expect(items102.map((i) => i.id)).toEqual(['note_1', 'note_2']);

      // note_1 hit at 10.5s -> outcome should be 'hit'
      timeline.update(10.5, { cursorZones: { leftHand: 4 } });
      const items105 = timeline.getRenderItems(10.5);
      const item1 = items105.find((i) => i.id === 'note_1');
      expect(item1?.outcome).toBe('hit');
    });
  });

  describe('5. onRating 및 onComplete 콜백 호출', () => {
    it('노트 판정 시 onRating 콜백이 발생하고, 모든 노트 완료 시 onComplete가 호출된다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5, leadBeats: 2 });
      timeline.loadNotes([sampleNotes[0]], { sequenceStart: 10.0 });
      // landing = 10.5, completeAt = 10.5 + 0.40 = 10.90

      const onRatingFn = vi.fn();
      const onCompleteFn = vi.fn();

      timeline.onRating(onRatingFn);
      timeline.onComplete(onCompleteFn);

      timeline.update(10.5, { cursorZones: { leftHand: 4 } });
      expect(onRatingFn).toHaveBeenCalledTimes(1);
      expect(onRatingFn).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: 'note_1',
          rating: 'Perfect',
          success: true,
        }),
        expect.anything(),
      );
      expect(onCompleteFn).not.toHaveBeenCalled();

      // completeAt = 10.90s 경과
      timeline.update(10.95);
      expect(onCompleteFn).toHaveBeenCalledTimes(1);
      expect(timeline.isComplete).toBe(true);
    });

    it('onRating 리스너 해제(unsub)가 올바르게 동작한다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5 });
      timeline.loadNotes(sampleNotes, { sequenceStart: 10.0 });

      const onRatingFn = vi.fn();
      const unsub = timeline.onRating(onRatingFn);

      unsub();

      timeline.update(10.5, { cursorZones: { leftHand: 4 } });
      expect(onRatingFn).not.toHaveBeenCalled();
    });
  });

  describe('6. StarNoteScheduler 호환성 검증 (내부 위임)', () => {
    it('StarNoteScheduler가 기존 생성자 및 start 호출 시 정상 초기화된다', () => {
      const scheduler = new StarNoteScheduler({ secondsPerBeat: 0.5 });
      scheduler.start(10.0, { roundId: 1 });

      expect(scheduler.notes).toHaveLength(7);
      expect(scheduler.currentTarget).not.toBeNull();
      expect(scheduler.isAllResolved).toBe(false);
      expect(scheduler.isComplete).toBe(false);
    });

    it('StarNoteScheduler를 통한 update 및 fromFoot 호출이 정상 동작한다', () => {
      const scheduler = new StarNoteScheduler({ secondsPerBeat: 0.5 });
      const results: string[] = [];
      scheduler.onRating((res) => {
        results.push(res.rating);
      });

      scheduler.start(10.0, { roundId: 1 });

      // Note 0: beat 2 (landing 10.5s, foot keynote in zone 10)
      const footRes = scheduler.fromFoot({
        foot: 'centerFoot',
        zoneId: 10,
        source: 'knee-proxy',
        timestamp: 10.5,
        confidence: 1,
      });

      expect(footRes).not.toBeNull();
      expect(footRes?.rating).toBe('Perfect');
      expect(results).toContain('Perfect');
    });
  });
});
