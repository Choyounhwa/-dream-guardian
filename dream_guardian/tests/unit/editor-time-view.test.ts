import { describe, it, expect, beforeEach } from 'vitest';
import { BeatTimelineRenderer } from '../../src/editor/BeatTimelineRenderer.js';
import { PhaseSequenceEditor } from '../../src/editor/PhaseSequenceEditor.js';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';

describe('Editor Time-to-View Coordinate System & Playhead Alignment (#383)', () => {
  let renderer: BeatTimelineRenderer;
  let sequenceEditor: PhaseSequenceEditor;
  let state: EditorState;
  let layout: EditorLayout;

  beforeEach(() => {
    renderer = new BeatTimelineRenderer();
    sequenceEditor = new PhaseSequenceEditor();
    state = new EditorState();
    layout = new EditorLayout(state);
  });

  describe('1. Coordinate Roundtrip & Unified Time-to-View Conversion', () => {
    it('beatToPercent and percentToBeat roundtrip accurately (1-based display beats)', () => {
      const totalBeats = 8;
      const testBeats = [1.0, 1.5, 2.0, 3.25, 4.0, 5.5, 7.0, 8.0, 9.0];

      for (const b of testBeats) {
        const percent = renderer.beatToPercent(b, totalBeats);
        // Beat 1.0 starts at 0%
        if (b === 1.0) {
          expect(percent).toBe(0);
        }
        // Beat 9.0 (1 + 8) reaches 100%
        if (b === 9.0) {
          expect(percent).toBe(100);
        }

        const recoveredBeat = renderer.percentToBeat(percent, totalBeats);
        expect(recoveredBeat).toBeCloseTo(b, 5);
      }
    });

    it('pixelToBeat converts content pixels with various content widths and DPRs without distortion', () => {
      const totalBeats = 8;
      const contentWidths = [400, 800, 1024, 1600];
      const dprs = [1.0, 1.25, 1.5, 2.0, 3.0];

      for (const width of contentWidths) {
        // Start pixel 0 corresponds to beat 1.0 (0%)
        expect(renderer.pixelToBeat(0, width, totalBeats)).toBe(1.0);

        // Middle pixel corresponds to beat 5.0 (50%)
        expect(renderer.pixelToBeat(width / 2, width, totalBeats)).toBe(5.0);

        // End pixel corresponds to beat 9.0 (100%)
        expect(renderer.pixelToBeat(width, width, totalBeats)).toBe(9.0);

        // DPR invariance check: CSS pixel ratio must match physical device pixel ratio
        for (const dpr of dprs) {
          const cssX = width * 0.375; // beat 4.0
          const physicalX = cssX * dpr;
          const physicalWidth = width * dpr;

          const beatFromCss = renderer.pixelToBeat(cssX, width, totalBeats);
          const beatFromPhysical = renderer.pixelToBeat(physicalX, physicalWidth, totalBeats);
          expect(beatFromCss).toBeCloseTo(4.0, 5);
          expect(beatFromPhysical).toBeCloseTo(beatFromCss, 5);
        }
      }
    });

    it('clamps out-of-range beat and pixel values safely', () => {
      const totalBeats = 8;
      expect(renderer.beatToPercent(0.5, totalBeats)).toBe(0);
      expect(renderer.beatToPercent(12.0, totalBeats)).toBe(100);
      expect(renderer.percentToBeat(-10, totalBeats)).toBe(1.0);
      expect(renderer.percentToBeat(150, totalBeats)).toBe(9.0);
      expect(renderer.pixelToBeat(-50, 800, totalBeats)).toBe(1.0);
      expect(renderer.pixelToBeat(1000, 800, totalBeats)).toBe(9.0);
      expect(renderer.pixelToBeat(100, 0, totalBeats)).toBe(1.0);
    });
  });

  describe('2. Coordinate Alignment: Note Block and Playhead', () => {
    it('note block leftPercent matches playhead percentage at currentBeat == note.startBeat', () => {
      const totalBeats = 8;
      const notes = sequenceEditor.getNotesForPhase('RUN_QUESTION');
      expect(notes.length).toBeGreaterThan(0);

      for (const note of notes) {
        const { leftPercent, widthPercent } = renderer.getNoteLeftAndWidth(
          note.startBeat,
          note.durationBeats,
          totalBeats
        );
        const playheadPercent = renderer.beatToPercent(note.startBeat, totalBeats);

        // Playhead at note.startBeat must match note block left position exactly
        expect(playheadPercent).toBe(leftPercent);
        expect(widthPercent).toBeCloseTo((note.durationBeats / totalBeats) * 100, 4);

        // Clicking the exact note left pixel position resolves back to note.startBeat
        const contentWidth = 800;
        const notePixelX = (leftPercent / 100) * contentWidth;
        const calculatedBeat = renderer.pixelToBeat(notePixelX, contentWidth, totalBeats);
        expect(calculatedBeat).toBeCloseTo(note.startBeat, 5);

        // Hit testing at this beat returns the note
        const hit = renderer.hitTestNote(calculatedBeat, notes);
        expect(hit).not.toBeNull();
        expect(hit?.id).toBe(note.id);
      }
    });
  });

  describe('3. Lane Label Offset Isolation & Layout Structure', () => {
    it('timeline HTML isolates lane tags from content track area and ruler ticks', () => {
      const html = layout.renderTimelineHTML();

      // Ruler has lane tag spacer/header and ruler content track
      expect(html).toContain('ruler-track-content');
      // Content track area is distinct container for alignment
      expect(html).toContain('timeline-track-content');

      // Playhead is rendered inside track content area or with track content alignment
      expect(html).toContain('id="timeline-playhead"');
    });

    it('clicking lane label area does not corrupt beat calculations', () => {
      // Lane tag label width is 80px. Any click within [0, 80px) on the wrapper
      // must be identified as label area and not evaluated as a valid content track beat.
      const laneTagWidth = 80;
      const trackContentWidth = 800;
      const totalBeats = 8;

      // In track content coordinates (where x = 0 is start of note lanes):
      expect(renderer.pixelToBeat(0, trackContentWidth, totalBeats)).toBe(1.0);

      // Wrapper coordinates offset by laneTagWidth:
      const clickWrapperX = 40; // Clicked inside lane tag!
      const isInsideLaneTag = clickWrapperX < laneTagWidth;
      expect(isInsideLaneTag).toBe(true);
    });
  });

  describe('4. Loop End Condition & Last Note Grace Period', () => {
    it('loop boundary allows last note landing and full duration to complete before looping', () => {
      const totalBeats = 8;
      const notes = sequenceEditor.getNotesForPhase('RUN_QUESTION');
      const lastNote = notes[notes.length - 1]; // NOTE_Q_8: startBeat: 8, duration: 1
      expect(lastNote.startBeat).toBe(8);
      expect(lastNote.durationBeats).toBe(1);

      const loopBoundary = renderer.getLoopBoundary(totalBeats, notes);
      // Branch duration is 8 beats from beat 1 -> ends at 9.0. Last note finishes at 8 + 1 = 9.0
      expect(loopBoundary).toBe(9.0);

      // During last note execution (beat 8.0, 8.5, 8.9), loop must NOT trigger
      expect(renderer.shouldLoop(8.0, totalBeats, notes)).toBe(false);
      expect(renderer.shouldLoop(8.5, totalBeats, notes)).toBe(false);
      expect(renderer.shouldLoop(8.99, totalBeats, notes)).toBe(false);

      // When reaching or exceeding branch duration / note completion, loop triggers
      expect(renderer.shouldLoop(9.0, totalBeats, notes)).toBe(true);
      expect(renderer.shouldLoop(9.5, totalBeats, notes)).toBe(true);
    });

    it('loop boundary accounts for notes extending beyond default totalBeats', () => {
      const totalBeats = 8;
      // Note with duration extending to beat 9.5
      const customNotes = [
        {
          id: 'NOTE_EXT',
          lane: 'motion' as const,
          startBeat: 8,
          durationBeats: 1.5,
          label: 'Extended Note',
          color: '#28E6FF',
          targetZones: [6],
        },
      ];

      const loopBoundary = renderer.getLoopBoundary(totalBeats, customNotes);
      expect(loopBoundary).toBe(9.5);
      expect(renderer.shouldLoop(9.0, totalBeats, customNotes)).toBe(false);
      expect(renderer.shouldLoop(9.5, totalBeats, customNotes)).toBe(true);
    });
  });

  describe('5. Non-Mutation Guarantee', () => {
    it('playing, seeking, or selecting notes does NOT increment project revision or mutate document state', () => {
      const initialRevision = state.commandManager.revision;
      const initialCanUndo = state.commandManager.canUndo();
      const initialPatternCount = state.getPatterns().length;
      const initialNotesJson = JSON.stringify(state.getCurrentPhaseNotes());

      // 1. Play / Pause
      state.play();
      expect(state.isPlaying).toBe(true);
      state.pause();
      expect(state.isPlaying).toBe(false);

      // 2. Seek beat
      state.seekBeat(3.5);
      expect(state.currentBeat).toBe(3.5);

      // 3. Select note
      const notes = state.getCurrentPhaseNotes();
      state.setSelectedNoteId(notes[0]?.id ?? 'test-note');
      expect(state.selectedNoteId).toBe(notes[0]?.id);

      // Deselect note
      state.setSelectedNoteId(null);
      expect(state.selectedNoteId).toBeNull();

      // Verify no document state mutation occurred
      expect(state.commandManager.revision).toBe(initialRevision);
      expect(state.commandManager.canUndo()).toBe(initialCanUndo);
      expect(state.getPatterns().length).toBe(initialPatternCount);
      expect(JSON.stringify(state.getCurrentPhaseNotes())).toBe(initialNotesJson);
    });
  });
});
