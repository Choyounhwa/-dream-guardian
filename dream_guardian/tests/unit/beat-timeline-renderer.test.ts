import { describe, it, expect, beforeEach } from 'vitest';
import { BeatTimelineRenderer } from '../../src/editor/BeatTimelineRenderer.js';
import { PhaseSequenceEditor } from '../../src/editor/PhaseSequenceEditor.js';

describe('BeatTimelineRenderer - 비트 타임라인 트랙 렌더러 및 스크러버 (Phase 3)', () => {
  let renderer: BeatTimelineRenderer;
  let sequenceEditor: PhaseSequenceEditor;

  beforeEach(() => {
    renderer = new BeatTimelineRenderer();
    sequenceEditor = new PhaseSequenceEditor();
  });

  describe('1. 비트 좌표 계산 및 스냅(Snap) 기능', () => {
    it('픽셀 좌표(px)를 타임라인 비트 위치로 정확히 변환한다', () => {
      const trackWidth = 800;
      const totalBeats = 8;

      // 400px = 중간 지점 = 4.0비트 (비트 범위 0~8 또는 1~8)
      const beat = renderer.beatFromPixel(400, trackWidth, totalBeats);
      expect(beat).toBeCloseTo(4.0, 1);

      // 0px = 0.0비트
      expect(renderer.beatFromPixel(0, trackWidth, totalBeats)).toBeCloseTo(0.0, 1);
      // 800px = 8.0비트
      expect(renderer.beatFromPixel(800, trackWidth, totalBeats)).toBeCloseTo(8.0, 1);
    });

    it('snapBeat()가 0.5비트 및 1.0비트 단위로 스냅한다', () => {
      expect(renderer.snapBeat(1.23, 0.5)).toBe(1.0);
      expect(renderer.snapBeat(1.28, 0.5)).toBe(1.5);
      expect(renderer.snapBeat(1.85, 1.0)).toBe(2.0);
    });

    it('hitTestNote()가 특정 비트 위치에 위치한 노트를 정확히 검출한다', () => {
      const notes = sequenceEditor.getNotesForPhase('RUN_QUESTION'); // 1..8 beat notes
      // 비트 2.2는 NOTE_Q_2(startBeat: 2, duration: 1 -> 2.0 ~ 3.0)에 속함
      const hit = renderer.hitTestNote(2.2, notes);
      expect(hit).not.toBeNull();
      expect(hit?.id).toBe('NOTE_Q_2');

      // 비트 9.0은 범위 밖 (존재하지 않음)
      const miss = renderer.hitTestNote(9.0, notes);
      expect(miss).toBeNull();
    });
  });

  describe('2. 타임라인 HTML 마크업 렌더링', () => {
    it('눈금자 및 트랙 내에 노트 블록들을 올바른 위치(%)로 렌더링한다', () => {
      const notes = sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const html = renderer.renderTimelineTracksHTML('STAR_COLLECT', notes, 3.5, 8, 'NOTE_S_1');

      expect(html).toContain('timeline-lane');
      expect(html).toContain('note-block');
      expect(html).toContain('NOTE_S_1');
      expect(html).toContain('selected'); // 선택된 노트 스타일
      expect(html).toContain('playhead-cursor');
    });

    it('키노트 타임라인이 4개 레인(모션, 왼손, 오른손, 골반/발)으로 분리 렌더링된다', () => {
      const notes = sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const html = renderer.renderTimelineTracksHTML('STAR_COLLECT', notes, 2.0, 8, null);

      // 4개 레인 태그 확인
      expect(html).toContain('lane-motion');
      expect(html).toContain('lane-lh');
      expect(html).toContain('lane-rh');
      expect(html).toContain('lane-hipfoot');

      // 라벨 확인
      expect(html).toContain('모션');
      expect(html).toContain('왼손');
      expect(html).toContain('오른손');
      expect(html).toContain('골반');
    });

    it('각 부위별 노트(왼손, 오른손, 골반)가 해당 레인에 겹침 없이 분리 배치된다', () => {
      const notes = sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const html = renderer.renderTimelineTracksHTML('STAR_COLLECT', notes, 2.0, 8, null);

      // lane-lh 레인 안에 왼손 노트가 포함되어 있는지 검증
      const lhLaneMatch = html.match(/class="[^"]*lane-lh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/);
      expect(lhLaneMatch?.[0]).toContain('왼손');

      // lane-rh 레인 안에 우측 스카이포인트 찌르기 노트가 포함되어 있는지 검증
      const rhLaneMatch = html.match(/class="[^"]*lane-rh[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/);
      expect(rhLaneMatch?.[0]).toContain('스카이포인트');

      // lane-hipfoot 레인 안에 골반/스쿼트 노트가 포함되어 있는지 검증
      const hipLaneMatch = html.match(/class="[^"]*lane-hipfoot[^"]*"[\s\S]*?(?=class="[^"]*timeline-lane|$)/);
      expect(hipLaneMatch?.[0]).toMatch(/골반|스쿼트|딥|힙/);
    });
  });
});
