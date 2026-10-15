import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssaultNoteAdapter,
  encountersToMotionNotes,
  encounterToMotionNote,
} from '../../src/game/assault/AssaultNoteAdapter.js';
import { MotionNoteTimeline } from '../../src/game/MotionNoteTimeline.js';
import type {
  AssaultEncounterDef,
  AssaultSessionPlan,
} from '../../src/types/assault.js';
import type {
  AssaultPairState,
} from '../../src/game/assault/AssaultPairJudge.js';
import type {
  AssaultSquatState,
} from '../../src/game/assault/AssaultSquatJudge.js';
import type { MotionNote, MotionNoteResult } from '../../src/types/motion-note.js';

describe('[BOSS-ASSAULT-14 / #516] MotionNote 논리 공격 생명주기 어댑터 (AssaultNoteAdapter)', () => {
  const sample3PairEncounters: readonly AssaultEncounterDef[] = Object.freeze([
    {
      id: 'attack_pair_01',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'profile_punch_default',
      visualProfileId: 'bullet_choice_basic',
      pairId: 'pair_01',
    },
    {
      id: 'attack_pair_02',
      kind: 'answer_pair',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'profile_punch_default',
      visualProfileId: 'bullet_choice_basic',
      pairId: 'pair_02',
    },
    {
      id: 'attack_pair_03',
      kind: 'answer_pair',
      startBeat: 8,
      durationBeats: 4,
      interactionProfileId: 'profile_punch_default',
      visualProfileId: 'bullet_choice_basic',
      pairId: 'pair_03',
    },
  ]);

  const sampleMixedEncounters: readonly AssaultEncounterDef[] = Object.freeze([
    {
      id: 'attack_pair_01',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'profile_punch_default',
      visualProfileId: 'bullet_choice_basic',
      pairId: 'pair_01',
    },
    {
      id: 'attack_squat_01',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 2,
      interactionProfileId: 'profile_squat_default',
      visualProfileId: 'sweeper_beam',
    },
    {
      id: 'attack_jump_01',
      kind: 'jump',
      startBeat: 7,
      durationBeats: 2,
      interactionProfileId: 'profile_jump_default',
      visualProfileId: 'shockwave_ring',
    },
  ]);

  const createMockPairState = (overrides: Partial<AssaultPairState> = {}): AssaultPairState =>
    Object.freeze({
      status: 'pending',
      lockedChoice: null,
      isLocked: false,
      isCorrect: null,
      rhythmRating: null,
      deltaMs: null,
      resolvedTimestampMs: null,
      inputId: null,
      processedInputIds: [],
      conflictCount: 0,
      lastConflictTimestampMs: null,
      isSettled: false,
      ...overrides,
    });

  const createMockSquatState = (overrides: Partial<AssaultSquatState> = {}): AssaultSquatState =>
    Object.freeze({
      status: 'pending',
      isLocked: false,
      isSettled: false,
      resultKind: null,
      effectType: null,
      deltaMs: null,
      resolvedTimestampMs: null,
      duckingStartTimeMs: null,
      duckingDurationMs: 0,
      consumedGenerations: [],
      currentStandGeneration: 0,
      hasStoodUpSinceLastEvade: true,
      lastPosture: 'standing',
      lastEvaluatedResult: null,
      ...overrides,
    });

  describe('1. 0-based -> 1-based Beat 변환 및 순수 변환 함수 (encountersToMotionNotes)', () => {
    it('AssaultEncounterDef의 startBeat(0-based)를 MotionNote의 beat(1-based, startBeat + 1)로 정확히 변환해야 한다', () => {
      const notes = encountersToMotionNotes(sample3PairEncounters);

      expect(notes).toHaveLength(3);
      // startBeat: 0 -> beat: 1
      expect(notes[0].beat).toBe(1);
      // startBeat: 4 -> beat: 5
      expect(notes[1].beat).toBe(5);
      // startBeat: 8 -> beat: 9
      expect(notes[2].beat).toBe(9);
    });

    it('모든 변환된 노트는 source가 "assault"여야 하며 id, patternId, leadBeats가 올바르게 설정되어야 한다', () => {
      const notes = encountersToMotionNotes(sample3PairEncounters);

      for (let i = 0; i < notes.length; i++) {
        const enc = sample3PairEncounters[i];
        const note = notes[i];
        expect(note.id).toBe(enc.id);
        expect(note.patternId).toBe(enc.pairId ?? enc.id);
        expect(note.source).toBe('assault');
        expect(note.leadBeats).toBe(enc.durationBeats);
        expect(note.profileId).toBe(enc.visualProfileId);
      }
    });

    it('answer_pair는 interaction="tap"이며 왼손(존 4)과 오른손(존 5) requirements를 가져야 한다', () => {
      const note = encounterToMotionNote(sample3PairEncounters[0]);

      expect(note.interaction).toBe('tap');
      expect(note.requirements).toEqual([
        { part: 'leftHand', zoneId: 4 },
        { part: 'rightHand', zoneId: 5 },
      ]);
    });

    it('squat 조우는 interaction="evade"이며 fullBody(존 10) requirement를 가져야 한다', () => {
      const note = encounterToMotionNote(sampleMixedEncounters[1]);

      expect(note.interaction).toBe('evade');
      expect(note.beat).toBe(5); // startBeat 4 + 1
      expect(note.requirements).toEqual([
        { part: 'fullBody', zoneId: 10 },
      ]);
    });

    it('jump 조우는 interaction="jump"이며 fullBody(존 10) requirement를 가져야 한다', () => {
      const note = encounterToMotionNote(sampleMixedEncounters[2]);

      expect(note.interaction).toBe('jump');
      expect(note.beat).toBe(8); // startBeat 7 + 1
      expect(note.requirements).toEqual([
        { part: 'fullBody', zoneId: 10 },
      ]);
    });
  });

  describe('2. 논리 노트 1개 매핑 및 시각 항목 분리 (A11)', () => {
    it('한 쌍의 answer_pair 조우당 정확히 1개의 논리 MotionNote만 생성해야 한다 (3쌍 라운드 = 3개 논리 노트)', () => {
      const adapter = new AssaultNoteAdapter();
      adapter.loadEncounters(sample3PairEncounters);

      expect(adapter.logicalNotes).toHaveLength(3);
      expect(adapter.timeline.runtimes).toHaveLength(3);
    });

    it('getVisualItems()는 answer_pair 조우당 좌/우 2개의 시각 표시 항목을 반환해야 한다 (3쌍 = 6개 시각 항목)', () => {
      const adapter = new AssaultNoteAdapter();
      adapter.loadEncounters(sample3PairEncounters);

      const visualItems = adapter.getVisualItems(0);
      expect(visualItems).toHaveLength(6);

      const pair0Items = visualItems.filter((v) => v.attackId === 'attack_pair_01');
      expect(pair0Items).toHaveLength(2);
      expect(pair0Items.some((v) => v.side === 'left')).toBe(true);
      expect(pair0Items.some((v) => v.side === 'right')).toBe(true);
    });

    it('단일 조우(squat, jump)는 1개의 시각 표시 항목을 반환해야 한다', () => {
      const adapter = new AssaultNoteAdapter();
      adapter.loadEncounters(sampleMixedEncounters);

      const visualItems = adapter.getVisualItems(0);
      // pair: 2 + squat: 1 + jump: 1 = 4 visual items
      expect(visualItems).toHaveLength(4);

      const squatItem = visualItems.find((v) => v.attackId === 'attack_squat_01');
      expect(squatItem).toBeDefined();
      expect(squatItem?.side).toBe('center');
      expect(squatItem?.kind).toBe('squat');
    });
  });

  describe('3. 라운드 전체 계획 1회 로드 및 reset 계약 보존', () => {
    it('loadEncounters / loadPlan 호출 시 timeline.loadNotes가 정확히 1회만 호출되어야 한다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5 });
      const loadNotesSpy = vi.spyOn(timeline, 'loadNotes');
      const resetSpy = vi.spyOn(timeline, 'reset');

      const adapter = new AssaultNoteAdapter({ timeline, spb: 0.5 });
      adapter.loadEncounters(sample3PairEncounters);

      expect(loadNotesSpy).toHaveBeenCalledTimes(1);
      expect(resetSpy).toHaveBeenCalledTimes(1); // loadNotes 내부의 reset 1회
    });

    it('각 pair 진행(시간 update 및 pair 결과 판정) 시 loadNotes / reset이 다시 호출되지 않아야 한다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5 });
      const loadNotesSpy = vi.spyOn(timeline, 'loadNotes');
      const resetSpy = vi.spyOn(timeline, 'reset');

      const adapter = new AssaultNoteAdapter({ timeline, spb: 0.5 });
      adapter.loadEncounters(sample3PairEncounters);

      loadNotesSpy.mockClear();
      resetSpy.mockClear();

      // 시간 경과 및 pair 1 해결
      adapter.update(0.5);
      const mockCorrectPairState = createMockPairState({
        status: 'correct',
        lockedChoice: 'left',
        isLocked: true,
        isCorrect: true,
        rhythmRating: 'Perfect',
        deltaMs: 10,
        isSettled: true,
      });
      adapter.applyPairResult('attack_pair_01', mockCorrectPairState);

      // 시간 경과 및 pair 2 진행
      adapter.update(2.0);

      // pair 전환 및 진행 중 loadNotes / reset 호출 0회 확인
      expect(loadNotesSpy).toHaveBeenCalledTimes(0);
      expect(resetSpy).toHaveBeenCalledTimes(0);

      // pair 2, 3 노트가 타임라인에 온전히 잔존해야 함
      expect(timeline.runtimes).toHaveLength(3);
      expect(timeline.runtimes[0].state).toBe('resolved');
      expect(timeline.runtimes[1].state).not.toBe('resolved');
      expect(timeline.runtimes[2].state).not.toBe('resolved');
    });

    it('AssaultSessionPlan 객체를 loadPlan으로 적재할 수 있어야 한다', () => {
      const sessionPlan: AssaultSessionPlan = {
        schemaVersion: '1.0.0',
        sessionId: 'session_test_plan_01',
        rulesVersion: '1.0.0',
        timingProfileId: 'timing_std',
        balanceProfileId: 'balance_std',
        encounters: sample3PairEncounters,
      };

      const adapter = new AssaultNoteAdapter({ spb: 0.5 });
      adapter.loadPlan(sessionPlan);

      expect(adapter.logicalNotes).toHaveLength(3);
      expect(adapter.isLoaded).toBe(true);
    });
  });

  describe('4. 순수 판정기 연동 (#514 AssaultPairJudge)', () => {
    let adapter: AssaultNoteAdapter;
    let ratingEvents: MotionNoteResult[] = [];

    beforeEach(() => {
      ratingEvents = [];
      adapter = new AssaultNoteAdapter({ spb: 0.5 });
      adapter.timeline.onRating((result) => {
        ratingEvents.push(result);
      });
      adapter.loadEncounters(sample3PairEncounters, { sequenceStart: 0 });
    });

    it('정답 판정(correct) 시 논리 노트가 resolved(success: true)되고 콜백이 정확히 1회 발생해야 한다', () => {
      const correctState = createMockPairState({
        status: 'correct',
        lockedChoice: 'left',
        isLocked: true,
        isCorrect: true,
        rhythmRating: 'Perfect',
        deltaMs: 12,
        isSettled: true,
      });

      const res = adapter.applyPairResult('attack_pair_01', correctState);

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.rating).toBe('Perfect');
      expect(res?.timingError).toBeCloseTo(0.012, 3);
      expect(res?.matchedParts).toEqual(['leftHand']);

      const rt = adapter.timeline.getRuntime('attack_pair_01');
      expect(rt?.state).toBe('resolved');
      expect(ratingEvents).toHaveLength(1);
    });

    it('오답 판정(wrong_locked) 시 논리 노트가 resolved(success: false, Miss)되어야 한다', () => {
      const wrongState = createMockPairState({
        status: 'wrong_locked',
        lockedChoice: 'right',
        isLocked: true,
        isCorrect: false,
        rhythmRating: 'Miss',
        deltaMs: 50,
        isSettled: true,
      });

      const res = adapter.applyPairResult('attack_pair_01', wrongState);

      expect(res).not.toBeNull();
      expect(res?.success).toBe(false);
      expect(res?.rating).toBe('Miss');
      expect(res?.matchedParts).toEqual(['rightHand']);

      const rt = adapter.timeline.getRuntime('attack_pair_01');
      expect(rt?.state).toBe('resolved');
      expect(ratingEvents).toHaveLength(1);
    });

    it('타임아웃(timeout) 시 논리 노트가 resolved(success: false, Miss)되어야 한다 (A07)', () => {
      const timeoutState = createMockPairState({
        status: 'timeout',
        lockedChoice: null,
        isLocked: false,
        isCorrect: false,
        rhythmRating: 'Miss',
        deltaMs: null,
        isSettled: true,
      });

      const res = adapter.applyPairResult('attack_pair_01', timeoutState);

      expect(res).not.toBeNull();
      expect(res?.success).toBe(false);
      expect(res?.rating).toBe('Miss');

      expect(ratingEvents).toHaveLength(1);
    });

    it('취소(cancelled) 시 형제 탄환에 대한 가짜 Miss나 추가 콜백이 발생하지 않아야 한다 (A05, A14)', () => {
      const cancelledState = createMockPairState({
        status: 'cancelled',
        lockedChoice: null,
        isLocked: true,
        isCorrect: null,
        rhythmRating: null,
        deltaMs: null,
        isSettled: true,
      });

      const res = adapter.applyPairResult('attack_pair_01', cancelledState);
      expect(res).not.toBeNull();

      const rt = adapter.timeline.getRuntime('attack_pair_01');
      expect(rt?.state).toBe('resolved');

      // 취소 후 시간이 지나도 타임라인 update에 의해 가짜 Miss가 생성되지 않아야 함
      adapter.update(10.0);
      expect(ratingEvents.filter((r) => r.noteId === 'attack_pair_01')).toHaveLength(1);
      expect(ratingEvents.filter((r) => r.noteId === 'attack_pair_01')[0].noteId).toBe('attack_pair_01');
    });

    it('이미 판정 완료된 조우에 대해 중복/지연 콜백이 유입되어도 2차 콜백이 발생하지 않아야 한다 (멱등성)', () => {
      const correctState = createMockPairState({
        status: 'correct',
        lockedChoice: 'left',
        isLocked: true,
        isCorrect: true,
        rhythmRating: 'Good',
        deltaMs: 30,
        isSettled: true,
      });

      adapter.applyPairResult('attack_pair_01', correctState);
      expect(ratingEvents).toHaveLength(1);

      // 동일 상태 재호출
      const secondRes = adapter.applyPairResult('attack_pair_01', correctState);
      expect(secondRes).toBeNull();
      expect(ratingEvents).toHaveLength(1); // 콜백 1회 유지

      // 지연 오답 유입
      const delayedWrong = createMockPairState({
        status: 'wrong_locked',
        lockedChoice: 'right',
        isLocked: true,
        isCorrect: false,
        rhythmRating: 'Miss',
        deltaMs: 150,
        isSettled: true,
      });
      const thirdRes = adapter.applyPairResult('attack_pair_01', delayedWrong);
      expect(thirdRes).toBeNull();
      expect(ratingEvents).toHaveLength(1);
    });
  });

  describe('5. 순수 판정기 연동 (#515 AssaultSquatJudge)', () => {
    let adapter: AssaultNoteAdapter;
    let ratingEvents: MotionNoteResult[] = [];

    beforeEach(() => {
      ratingEvents = [];
      adapter = new AssaultNoteAdapter({ spb: 0.5 });
      adapter.timeline.onRating((result) => {
        ratingEvents.push(result);
      });
      adapter.loadEncounters(sampleMixedEncounters, { sequenceStart: 0 });
    });

    it('스쿼트 회피 성공(evaded) 시 논리 노트가 resolved(success: true, Perfect)되어야 한다', () => {
      const squatEvadedState = createMockSquatState({
        status: 'evaded',
        resultKind: 'evaded',
        lastPosture: 'ducking',
        currentStandGeneration: 0,
        isSettled: true,
      });

      const res = adapter.applySquatResult('attack_squat_01', squatEvadedState);

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      expect(res?.rating).toBe('Perfect');
      expect(res?.matchedParts).toEqual(['fullBody']);

      const rt = adapter.timeline.getRuntime('attack_squat_01');
      expect(rt?.state).toBe('resolved');
      expect(ratingEvents).toHaveLength(1);
    });

    it('스쿼트 회피 실패(miss) 시 논리 노트가 resolved(success: false, Miss)되어야 한다', () => {
      const squatMissState = createMockSquatState({
        status: 'miss',
        resultKind: 'miss',
        lastPosture: 'standing',
        currentStandGeneration: 0,
        isSettled: true,
      });

      const res = adapter.applySquatResult('attack_squat_01', squatMissState);

      expect(res).not.toBeNull();
      expect(res?.success).toBe(false);
      expect(res?.rating).toBe('Miss');

      const rt = adapter.timeline.getRuntime('attack_squat_01');
      expect(rt?.state).toBe('resolved');
      expect(ratingEvents).toHaveLength(1);
    });
  });

  describe('6. 시각 항목(AssaultVisualItem) 상태 분리 및 형제 소멸 표현', () => {
    let adapter: AssaultNoteAdapter;

    beforeEach(() => {
      adapter = new AssaultNoteAdapter({ spb: 0.5 });
      adapter.loadEncounters(sample3PairEncounters, { sequenceStart: 0 });
    });

    it('정답 타격 시 선택된 쪽은 hit, 형제(sibling) 쪽은 cancelled로 분리 표현되어야 한다', () => {
      const correctState = createMockPairState({
        status: 'correct',
        lockedChoice: 'left',
        isLocked: true,
        isCorrect: true,
        rhythmRating: 'Perfect',
        deltaMs: 0,
        isSettled: true,
      });
      adapter.applyPairResult('attack_pair_01', correctState);

      const items = adapter.getVisualItems(0);
      const pair0Left = items.find((v) => v.attackId === 'attack_pair_01' && v.side === 'left');
      const pair0Right = items.find((v) => v.attackId === 'attack_pair_01' && v.side === 'right');

      expect(pair0Left?.status).toBe('hit');
      expect(pair0Left?.isHit).toBe(true);
      expect(pair0Left?.isCancelled).toBe(false);

      expect(pair0Right?.status).toBe('cancelled');
      expect(pair0Right?.isHit).toBe(false);
      expect(pair0Right?.isCancelled).toBe(true);
      expect(pair0Right?.isMiss).toBe(false); // 형제에 가짜 Miss 없음!
    });

    it('타임아웃 시 양쪽 모두 miss 상태로 표현되어야 한다', () => {
      const timeoutState = createMockPairState({
        status: 'timeout',
        lockedChoice: null,
        isLocked: false,
        isCorrect: false,
        rhythmRating: 'Miss',
        deltaMs: null,
        isSettled: true,
      });
      adapter.applyPairResult('attack_pair_01', timeoutState);

      const items = adapter.getVisualItems(0);
      const pair0Left = items.find((v) => v.attackId === 'attack_pair_01' && v.side === 'left');
      const pair0Right = items.find((v) => v.attackId === 'attack_pair_01' && v.side === 'right');

      expect(pair0Left?.status).toBe('miss');
      expect(pair0Right?.status).toBe('miss');
    });
  });

  describe('7. 기존 MotionNoteTimeline 및 타 판정기 회귀 방지 (star/stomp/evade/jump)', () => {
    it('star / stomp 일반 리듬 노트가 AssaultNoteAdapter와 공존하는 timeline에서 정상 작동해야 한다', () => {
      const timeline = new MotionNoteTimeline({ spb: 0.5 });
      const adapter = new AssaultNoteAdapter({ timeline, spb: 0.5 });
      expect(adapter.timeline).toBe(timeline);

      // 일반 star 노트
      const starNotes: readonly MotionNote[] = [
        {
          id: 'star_note_1',
          patternId: 'PAT_1',
          beat: 2,
          requirements: [{ part: 'leftHand', zoneId: 4 }],
          interaction: 'tap',
          source: 'star',
        },
      ];

      timeline.loadNotes(starNotes, { sequenceStart: 0 });

      // beat 2 -> landing = 0.5
      // 0.5s 시점에 왼손 존 4 입력
      const results = timeline.update(0.5, {
        cursorZones: { leftHand: 4 },
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].noteId).toBe('star_note_1');
    });

    it('어댑터 동작 중 HP 직접 변경이나 effects 호출 부작용이 없어야 한다', () => {
      const adapter = new AssaultNoteAdapter({ spb: 0.5 });
      adapter.loadEncounters(sample3PairEncounters);

      // 아무런 HP 변경 함수가 존재하지 않음을 확인
      expect((adapter as any).hp).toBeUndefined();
      expect((adapter as any).setHp).toBeUndefined();
      expect((adapter as any).applyDamage).toBeUndefined();
    });
  });
});
