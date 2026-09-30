import { describe, it, expect, beforeEach } from 'vitest';
import { BeatTimelineRenderer } from '../../src/editor/BeatTimelineRenderer.js';
import { EditorState } from '../../src/editor/EditorState.js';
import { EXTENDED_CAT_CHOREO_PATTERNS } from '../../src/data/danceRoutineData.js';

describe('BeatTimelineRenderer Lane Assignment (#246 / BUG-DANCE-LANE-001)', () => {
  let renderer: BeatTimelineRenderer;
  let state: EditorState;

  beforeEach(() => {
    renderer = new BeatTimelineRenderer();
    state = new EditorState();
  });

  describe('1. 우측 패턴 적용 시 키노트 중복 표시 결함 재현 및 검증', () => {
    it('CAT_SKY_POINT_RIGHT 적용 시 NOTE_S_1, S_2, S_5, S_6을 포함한 모든 단일 부위 노트가 정확히 1회만 출력된다', () => {
      state.setSelectedPhase('STAR_COLLECT');
      state.applyPatternToSequence('CAT_SKY_POINT_RIGHT');

      const notes = state.getCurrentPhaseNotes();
      expect(notes.length).toBe(7);

      const html = renderer.renderTimelineTracksHTML('STAR_COLLECT', notes, 0, 8, null);

      // 각 노트 ID별 HTML 내 등장 횟수(data-note-id) 카운트
      for (const note of notes) {
        const regex = new RegExp(`data-note-id="${note.id}"`, 'g');
        const matches = html.match(regex);
        expect(matches).not.toBeNull();
        expect(matches?.length).toBe(1);
      }

      // 구체적 부위별 레인 배치 위치 검증
      // NOTE_S_1(hip) -> lane-hipfoot에만 존재
      const hipLaneMatch = html.match(/class="[^"]*lane-hipfoot[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/);
      expect(hipLaneMatch?.[0]).toContain('data-note-id="NOTE_S_1"');
      expect(hipLaneMatch?.[0]).toContain('data-note-id="NOTE_S_6"');

      // NOTE_S_2(leftHand) -> lane-lh에만 존재, lane-rh에는 없음
      const lhLaneMatch = html.match(/class="[^"]*lane-lh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/);
      const rhLaneMatch = html.match(/class="[^"]*lane-rh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/);

      expect(lhLaneMatch?.[0]).toContain('data-note-id="NOTE_S_2"');
      expect(lhLaneMatch?.[0]).toContain('data-note-id="NOTE_S_5"');
      expect(rhLaneMatch?.[0]).not.toContain('data-note-id="NOTE_S_2"');
      expect(rhLaneMatch?.[0]).not.toContain('data-note-id="NOTE_S_5"');
      expect(rhLaneMatch?.[0]).not.toContain('data-note-id="NOTE_S_1"');
      expect(rhLaneMatch?.[0]).not.toContain('data-note-id="NOTE_S_6"');
    });
  });

  describe('2. 이름 변경에 의한 레인 왜곡 방지 (구조화된 부위 우선)', () => {
    it('노트 라벨에 우측/좌측/양손/골반 키워드가 섞여 있어도 payload.part에 의해 고유 레인에 1회만 표시된다', () => {
      const customNote = {
        id: 'NOTE_TEST_LABEL',
        lane: 'keynote' as const,
        startBeat: 3,
        durationBeats: 1,
        label: '우측 스카이포인트 좌측 냥냥 양손 힙 골반 스쿼트 혼합 라벨',
        color: '#28E6FF',
        targetZones: [6],
        payload: { part: 'leftHand' },
      };

      const html = renderer.renderTimelineTracksHTML('STAR_COLLECT', [customNote], 0, 8, null);

      const regex = /data-note-id="NOTE_TEST_LABEL"/g;
      const matches = html.match(regex);
      expect(matches?.length).toBe(1);

      // payload.part가 leftHand이므로 오직 lane-lh에만 존재
      const lhLane = html.match(/class="[^"]*lane-lh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];
      const rhLane = html.match(/class="[^"]*lane-rh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];
      const hipLane = html.match(/class="[^"]*lane-hipfoot[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];

      expect(lhLane).toContain('data-note-id="NOTE_TEST_LABEL"');
      expect(rhLane).not.toContain('data-note-id="NOTE_TEST_LABEL"');
      expect(hipLane).not.toContain('data-note-id="NOTE_TEST_LABEL"');
    });
  });

  describe('3. 모든 기본 및 확장 안무 패턴 전수 검사', () => {
    it('EXTENDED_CAT_CHOREO_PATTERNS의 모든 패턴 시퀀스에서 모든 노트는 정확히 1개 레인에만 렌더링된다', () => {
      state.setSelectedPhase('STAR_COLLECT');

      for (const pattern of EXTENDED_CAT_CHOREO_PATTERNS) {
        state.applyPatternToSequence(pattern.id);
        const notes = state.getCurrentPhaseNotes();
        const html = renderer.renderTimelineTracksHTML('STAR_COLLECT', notes, 0, 8, null);

        for (const note of notes) {
          const regex = new RegExp(`data-note-id="${note.id}"`, 'g');
          const matches = html.match(regex);
          expect(matches).not.toBeNull();
          expect(
            matches?.length,
            `패턴 "${pattern.id}"의 노트 "${note.id}" (라벨: "${note.label}")가 ${matches?.length}회 중복 렌더링됨`
          ).toBe(1);
        }
      }
    });
  });

  describe('4. ANSWER_SELECT 및 RUN_QUESTION 레인 분리 검증', () => {
    it('ANSWER_SELECT 0번 답안은 lane-lh, 1번 답안은 lane-rh에 각각 1회만 표시된다', () => {
      state.setSelectedPhase('ANSWER_SELECT');
      const notes = state.getCurrentPhaseNotes();
      expect(notes.length).toBe(2);

      const html = renderer.renderTimelineTracksHTML('ANSWER_SELECT', notes, 0, 2, null);

      const lhLane = html.match(/class="[^"]*lane-lh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];
      const rhLane = html.match(/class="[^"]*lane-rh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];

      expect(lhLane).toContain('data-note-id="NOTE_A_0"');
      expect(lhLane).not.toContain('data-note-id="NOTE_A_1"');
      expect(rhLane).toContain('data-note-id="NOTE_A_1"');
      expect(rhLane).not.toContain('data-note-id="NOTE_A_0"');
    });

    it('RUN_QUESTION의 rebound(상승/핸즈)는 lane-lh, dip(스쿼트/하강)은 lane-hipfoot 고유 레인에 정확히 1회씩 렌더링된다', () => {
      state.setSelectedPhase('RUN_QUESTION');
      const qNotes = state.getCurrentPhaseNotes();
      const qHtml = renderer.renderTimelineTracksHTML('RUN_QUESTION', qNotes, 0, 8, null);

      const lhLane = qHtml.match(/class="[^"]*lane-lh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];
      const hipLane = qHtml.match(/class="[^"]*lane-hipfoot[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];
      const motionLane = qHtml.match(/class="[^"]*lane-motion[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];

      // 홀수 박 (rebound) -> lane-lh (Cyan 핸즈 고유 레인)
      expect(lhLane).toContain('data-note-id="NOTE_Q_1"');
      expect(lhLane).toContain('data-note-id="NOTE_Q_3"');
      expect(lhLane).toContain('data-note-id="NOTE_Q_5"');
      expect(lhLane).toContain('data-note-id="NOTE_Q_7"');

      // 짝수 박 (dip) -> lane-hipfoot (Orange 골반/스쿼트 고유 레인)
      expect(hipLane).toContain('data-note-id="NOTE_Q_2"');
      expect(hipLane).toContain('data-note-id="NOTE_Q_4"');
      expect(hipLane).toContain('data-note-id="NOTE_Q_6"');
      expect(hipLane).toContain('data-note-id="NOTE_Q_8"');

      // 고유 레인에 배치되었으므로 일반 모션 레인에는 중복되지 않음
      for (const note of qNotes) {
        expect(motionLane).not.toContain(`data-note-id="${note.id}"`);
      }
    });

    it('FEVER_PHASE_B의 전신 안무 블록은 오직 lane-motion에만 렌더링된다', () => {
      state.setSelectedPhase('FEVER_PHASE_B');
      const fNotes = state.getCurrentPhaseNotes();
      const fHtml = renderer.renderTimelineTracksHTML('FEVER_PHASE_B', fNotes, 0, 16, null);

      const motionLane = fHtml.match(/class="[^"]*lane-motion[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/)?.[0];
      const otherLanes = fHtml.replace(/class="[^"]*lane-motion[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/, '');

      for (const note of fNotes) {
        expect(motionLane).toContain(`data-note-id="${note.id}"`);
        expect(otherLanes).not.toContain(`data-note-id="${note.id}"`);
      }
    });
  });
});
