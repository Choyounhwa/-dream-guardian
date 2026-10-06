/**
 * editor-compiled-preview.test.ts - 컴파일된 이벤트 기반 자세·시간 미리보기 테스트
 *
 * Issue #392 / EDITOR-PREVIEW:
 * 1. 게임 런타임과 동일한 컴파일 데이터/시간 변환(compileEditorProject / ticksToSeconds / bpm)을 미리보기에 사용
 * 2. 7개 별 노트 및 구간 이벤트에 대해 컴파일된 targetTimeSeconds, targetZone, targetBodyPart, toleranceWindowSeconds 기반 가이드 포즈 및 타임라인 산출
 * 3. BPM 변경 시 마지막 착지/판정 여유(tolerance)/구간 종료가 선택 프로필(BPM 등)과 정확히 일치
 * 4. 전투 판정 엔진(HP/데미지/콤보/마나 계산) 복제 없이 순수 가이드/시뮬레이션 상태 격리
 * 5. preview 재생 중 원본 프로젝트 문서, 게시본, 게임 세션 데이터 불변성 유지
 * 6. 컴파일 불가/유효하지 않은 구간 시 안전한 폴백 및 진단 사유 제공 ("실제 웹캠 인식 성공 보장 안 함" 가이드 전용 명시)
 * 7. 가이드 애니메이션 시뮬레이션과 런타임 호환 이벤트 미리보기 모드 명확한 구분
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { ChoreoPoseSimulator } from '../../src/editor/ChoreoPoseSimulator.js';
import { EditorCanvasRenderer } from '../../src/editor/EditorCanvasRenderer.js';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
  type EditorProject,
  type StarNoteEvent,
} from '../../src/data/EditorProject.js';
import { DEFAULT_RULESET_ID } from '../../src/data/ContentCapabilities.js';
import { DEFAULT_STAR_TIMING_WINDOWS } from '../../config/beat-motion.config.js';
import { calculateStarNoteTimings } from '../../src/data/ContentTiming.js';

function createMockCanvas(): HTMLCanvasElement {
  const mockCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    clearRect: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  return {
    getContext: vi.fn(() => mockCtx),
    width: 800,
    height: 600,
  } as unknown as HTMLCanvasElement;
}

function createValid7StarProject(projectId = 'proj_preview_01', bpm = 120): EditorProject {
  return {
    kind: AUTHORING_PROJECT_KIND,
    schemaVersion: AUTHORING_SCHEMA_VERSION,
    projectId,
    revision: 1,
    rulesetId: DEFAULT_RULESET_ID,
    metadata: {
      title: 'Valid 7-Star Choreo Project',
      description: 'Project for compiled preview test',
      author: 'Tester',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
    },
    previewTempo: { bpm, beatsPerBar: 4 },
    patterns: [
      {
        id: 'pat_punch_l',
        name: 'Left Punch',
        description: 'Left Hand to Zone 4',
        target: { leftHand: 4, rightHand: null, head: null, hip: null },
      },
      {
        id: 'pat_punch_r',
        name: 'Right Punch',
        description: 'Right Hand to Zone 5',
        target: { leftHand: null, rightHand: 5, head: null, hip: null },
      },
    ],
    sequences: [
      {
        id: 'seq_phaseA_star',
        phase: 'phaseA',
        kind: 'starNotes',
        events: [
          {
            id: 'star_01',
            kind: 'starNote',
            landingTick: 960,
            target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
            sourcePatternId: 'pat_punch_l',
          },
          {
            id: 'star_02',
            kind: 'starNote',
            landingTick: 1440,
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'pat_punch_r',
          },
          {
            id: 'star_03',
            kind: 'starNote',
            landingTick: 1920,
            target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
            sourcePatternId: 'pat_punch_l',
          },
          {
            id: 'star_04',
            kind: 'starNote',
            landingTick: 2400,
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'pat_punch_r',
          },
          {
            id: 'star_05',
            kind: 'starNote',
            landingTick: 2880,
            target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
            sourcePatternId: 'pat_punch_l',
          },
          {
            id: 'star_06',
            kind: 'starNote',
            landingTick: 3360,
            target: { type: 'cursor', part: 'rightHand', zoneId: 5 },
            sourcePatternId: 'pat_punch_r',
          },
          {
            id: 'star_07',
            kind: 'starNote',
            landingTick: 3840,
            target: { type: 'cursor', part: 'leftHand', zoneId: 4 },
            sourcePatternId: 'pat_punch_l',
          },
        ],
      },
      {
        id: 'seq_phaseA_motion',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: [],
      },
      {
        id: 'seq_phaseA_answer',
        phase: 'phaseA',
        kind: 'motionGuide',
        events: [],
      },
      {
        id: 'seq_phaseB_motion',
        phase: 'phaseB',
        kind: 'motionGuide',
        events: [],
      },
    ],
    bindings: [
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseA',
        sequenceId: 'seq_phaseA_star',
      },
      {
        chapterId: 'ch1',
        subLevelId: null,
        phase: 'phaseB',
        sequenceId: 'seq_phaseB_motion',
      },
    ],
  };
}

describe('Issue #392 [EDITOR-PREVIEW] 컴파일된 이벤트 기반 자세·시간 미리보기', () => {
  let state: EditorState;
  let simulator: ChoreoPoseSimulator;

  beforeEach(() => {
    state = new EditorState();
    simulator = new ChoreoPoseSimulator();
  });

  describe('1. 컴파일된 이벤트의 정확한 시간(초/비트) 및 타깃 존/부위 포즈 프레임 계산', () => {
    it('컴파일된 7개 별노트의 landingBeat, targetTimeSeconds, toleranceWindowSeconds, targetZone이 정확히 산출된다', () => {
      const project = createValid7StarProject('proj_01', 120);
      state.applyProject(project);

      const previewState = state.getCompiledPreviewState();
      expect(previewState.isCompiled).toBe(true);
      expect(previewState.compilerSuccess).toBe(true);
      expect(previewState.events.length).toBe(7);

      const spb = 60 / 120;
      // 1번째 별노트 검증 (Beat 2, Tick 960, LeftHand Zone 4)
      const star1 = previewState.events[0];
      expect(star1.slotIndex).toBe(0);
      expect(star1.landingBeat).toBe(2);
      expect(star1.landingTick).toBe(960);
      expect(star1.targetTimeSeconds).toBeCloseTo(1 * spb, 4);
      expect(star1.toleranceWindowSeconds).toBeCloseTo(DEFAULT_STAR_TIMING_WINDOWS.late, 4);
      expect(star1.windowStartSeconds).toBeCloseTo(Math.max(0, 1 * spb - DEFAULT_STAR_TIMING_WINDOWS.late), 4);
      expect(star1.windowEndSeconds).toBeCloseTo(1 * spb + DEFAULT_STAR_TIMING_WINDOWS.late, 4);
      expect(star1.targetZone).toBe(4);
      expect(star1.targetBodyPart).toBe('leftHand');

      // 7번째 별노트 검증 (Beat 8, Tick 3840, LeftHand Zone 4)
      const star7 = previewState.events[6];
      expect(star7.slotIndex).toBe(6);
      expect(star7.landingBeat).toBe(8);
      expect(star7.landingTick).toBe(3840);
      expect(star7.targetTimeSeconds).toBeCloseTo(7 * spb, 4);
      expect(star7.targetZone).toBe(4);
      expect(star7.targetBodyPart).toBe('leftHand');
    });

    it('착지 판정 허용 구간(tolerance window) 진입 시 isLanding 플래그가 true가 되고 해당 타깃 포즈가 산출된다', () => {
      const project = createValid7StarProject('proj_01', 120);
      state.applyProject(project);

      const spb = 60 / 120;
      // 2번째 별노트(오른손 Zone 5): targetTime = 2 * spb (약 1.0s)
      // tolerance window: [1.0 - 0.40, 1.0 + 0.40]
      state.seekSeconds(2 * spb); // 정확히 2번째 노트 착지 시점

      const frame = state.computeCurrentPoseFrame();
      expect(frame.previewMode).toBe('compiled_runtime');
      expect(frame.compiledPreview).toBeDefined();
      expect(frame.compiledPreview?.activeEvent).not.toBeNull();
      expect(frame.compiledPreview?.activeEvent?.slotIndex).toBe(1);
      expect(frame.compiledPreview?.activeEvent?.isLanding).toBe(true);
      expect(frame.targetZones).toContain(5);

      // 관절 좌표가 Zone 5 중심에 도달해 있는지 검증
      const zone5Center = simulator.getZoneCenter(5);
      expect(zone5Center).not.toBeNull();
      expect(frame.jointPositions.rightHand.x).toBeCloseTo(zone5Center!.x, 4);
      expect(frame.jointPositions.rightHand.y).toBeCloseTo(zone5Center!.y, 4);
    });
  });

  describe('2. BPM 변경 시 시간 축 변환이 게임 런타임과 동일하게 계산되는지 검증', () => {
    it('BPM 110, 120, 140 변경 시 시간 축 스케일링이 ContentTiming의 calculateStarNoteTimings와 100% 일치한다', () => {
      const testBpms = [110, 120, 140];

      for (const bpm of testBpms) {
        const project = createValid7StarProject(`proj_${bpm}`, bpm);
        state.applyProject(project);
        state.setBpm(bpm);

        const previewState = state.getCompiledPreviewState();
        const expectedTimings = calculateStarNoteTimings(bpm);

        expect(previewState.bpm).toBe(bpm);
        expect(previewState.secondsPerBeat).toBeCloseTo(expectedTimings.secondsPerBeat, 5);
        expect(previewState.lastLandingTimeSeconds).toBeCloseTo(expectedTimings.notes[6].landingTimeSeconds, 5);
        expect(previewState.completeAtSeconds).toBeCloseTo(expectedTimings.completeAtSeconds, 5);
        expect(previewState.totalDurationSeconds).toBeCloseTo(expectedTimings.totalDurationSeconds, 5);

        // 7개 각 노트의 착지 시간 및 윈도우 일치 확인
        for (let i = 0; i < 7; i++) {
          const evt = previewState.events[i];
          const expectedNote = expectedTimings.notes[i];
          expect(evt.targetTimeSeconds).toBeCloseTo(expectedNote.landingTimeSeconds, 5);
          expect(evt.windowStartSeconds).toBeCloseTo(expectedNote.windowStartSeconds, 5);
          expect(evt.windowEndSeconds).toBeCloseTo(expectedNote.windowEndSeconds, 5);
        }
      }
    });
  });

  describe('3. 전투 판정 엔진 복제 없이 순수 가이드/시뮬레이션 상태 격리 검증', () => {
    it('미리보기 상태 및 프레임에 HP/데미지/콤보/마나 계산 필드가 일체 존재하지 않는다', () => {
      const project = createValid7StarProject('proj_iso', 120);
      state.applyProject(project);

      const previewState = state.getCompiledPreviewState();
      const frame = state.computeCurrentPoseFrame();

      // HP, combo, damage, mana, score 계산 필드 부재 확인
      expect((previewState as any).playerHp).toBeUndefined();
      expect((previewState as any).bossHp).toBeUndefined();
      expect((previewState as any).combo).toBeUndefined();
      expect((previewState as any).mana).toBeUndefined();
      expect((previewState as any).damage).toBeUndefined();
      expect((previewState as any).score).toBeUndefined();

      expect((frame as any).playerHp).toBeUndefined();
      expect((frame as any).bossHp).toBeUndefined();
      expect((frame as any).combo).toBeUndefined();
      expect((frame as any).mana).toBeUndefined();
    });

    it('가이드 전용 명시 플래그(isGuideOnly: true)가 항상 유지된다', () => {
      const project = createValid7StarProject('proj_guide', 120);
      state.applyProject(project);

      const previewState = state.getCompiledPreviewState();
      expect(previewState.isGuideOnly).toBe(true);
      expect(previewState.isCompiled).toBe(true);
    });
  });

  describe('4. preview 재생 중 프로젝트 데이터·저장소·세션 불변성 유지 검증', () => {
    it('preview 탐색/재생/프레임 산출을 수행해도 프로젝트 원본 데이터와 리비전이 변경되지 않는다', () => {
      const project = createValid7StarProject('proj_immut', 120);
      state.applyProject(project);

      const originalProjectJson = JSON.stringify(state.getCurrentProject());
      const originalRevision = state.revision;
      const originalPubStatus = state.getProjectPublicationStatus();

      // preview 재생 및 시간 스크러빙
      state.seekSeconds(0.5);
      state.computeCurrentPoseFrame();
      state.seekSeconds(1.5);
      state.computeCurrentPoseFrame();
      state.seekSeconds(3.0);
      state.computeCurrentPoseFrame();
      state.getCompiledPreviewState();

      // 불변성 검증: 프로젝트 내용 100% 동일, revision 동일, dirty 동일
      expect(JSON.stringify(state.getCurrentProject())).toBe(originalProjectJson);
      expect(state.revision).toBe(originalRevision);
      expect(state.getProjectPublicationStatus().isClean).toBe(originalPubStatus.isClean);
    });

    it('preview 탐색 중 localStorage 쓰기 호출이 발생하지 않는다', () => {
      const setItemSpy = vi.fn();
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
        setItem: setItemSpy,
        removeItem: vi.fn(),
        clear: vi.fn(),
      });

      const project = createValid7StarProject('proj_store', 120);
      state.applyProject(project);

      state.seekSeconds(2.0);
      state.computeCurrentPoseFrame();
      state.getCompiledPreviewState();

      expect(setItemSpy).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe('5. 컴파일 불가/유효하지 않은 구간 시 안전한 폴백 및 진단 사유 제공 검증', () => {
    it('크로스바디 제약 위반 등 컴파일 오류 프로젝트 주입 시 진단 사유를 표시하고 안전 폴백한다', () => {
      // 왼손이 우측 끝단(Zone 3)으로 향하는 크로스바디 제약 위반 프로젝트
      const invalidProject = createValid7StarProject('proj_invalid', 120);
      (invalidProject.sequences[0].events[0] as StarNoteEvent).target = {
        type: 'cursor',
        part: 'leftHand',
        zoneId: 3, // 왼손 우측 끝단(Zone 3) 도달 차단 (Cross-Body 제약 위반)
      };

      state.applyProject(invalidProject);

      const previewState = state.getCompiledPreviewState();
      expect(previewState.compilerSuccess).toBe(false);
      expect(previewState.isGuideOnly).toBe(true);
      expect(previewState.diagnosticMessage).toBeDefined();
      expect(typeof previewState.diagnosticMessage).toBe('string');
      expect(previewState.diagnosticMessage!.length).toBeGreaterThan(0);
      expect(previewState.diagnosticMessage).toContain('Zone 3');

      // 크래시 없이 안전한 폴백 포즈 프레임 반환
      const frame = state.computeCurrentPoseFrame();
      expect(frame).toBeDefined();
      expect(frame.jointPositions).toBeDefined();
      expect(frame.compiledPreview?.compilerSuccess).toBe(false);
      expect(frame.compiledPreview?.diagnosticMessage).toBeDefined();
    });
  });

  describe('6. 가이드 애니메이션 시뮬레이션 vs 런타임 호환 이벤트 미리보기 모드 명확한 분리', () => {
    it('previewMode 전환(guide_simulation vs compiled_runtime)에 따라 산출 상태가 올바르게 분기된다', () => {
      const project = createValid7StarProject('proj_modes', 120);
      state.applyProject(project);

      // 기본 모드는 compiled_runtime
      expect(state.previewMode).toBe('compiled_runtime');
      const compiledFrame = state.computeCurrentPoseFrame();
      expect(compiledFrame.previewMode).toBe('compiled_runtime');
      expect(compiledFrame.compiledPreview).toBeDefined();

      // guide_simulation 모드로 전환
      state.setPreviewMode('guide_simulation');
      expect(state.previewMode).toBe('guide_simulation');
      const guideFrame = state.computeCurrentPoseFrame();
      expect(guideFrame.previewMode).toBe('guide_simulation');
      expect(guideFrame.compiledPreview).toBeUndefined();

      // 다시 compiled_runtime 모드로 전환
      state.setPreviewMode('compiled_runtime');
      expect(state.previewMode).toBe('compiled_runtime');
    });
  });

  describe('7. EditorCanvasRenderer 렌더링 검증', () => {
    it('EditorCanvasRenderer가 컴파일 미리보기 프레임 및 가이드 전용 오버레이를 정상 렌더링한다', () => {
      const canvas = createMockCanvas();
      const renderer = new EditorCanvasRenderer(canvas);

      const project = createValid7StarProject('proj_canvas', 120);
      state.applyProject(project);
      state.seekSeconds(1.5);

      const frame = state.computeCurrentPoseFrame();
      expect(() => {
        renderer.render(state.getSelectedPattern(), {
          simulatedFrame: frame,
          showSkeleton: true,
        });
      }).not.toThrow();
    });
  });
});
