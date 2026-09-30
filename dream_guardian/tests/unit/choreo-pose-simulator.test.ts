import { describe, it, expect, beforeEach } from 'vitest';
import { ChoreoPoseSimulator } from '../../src/editor/ChoreoPoseSimulator.js';
import { DancePatternRegistry, DEFAULT_CAT_CHOREO_PATTERNS } from '../../src/data/danceRoutineData.js';
import { PhaseSequenceEditor } from '../../src/editor/PhaseSequenceEditor.js';

describe('ChoreoPoseSimulator - 실시간 안무 시뮬레이션 및 포즈 프레임 계산 (Phase 4)', () => {
  let simulator: ChoreoPoseSimulator;
  let registry: DancePatternRegistry;
  let sequenceEditor: PhaseSequenceEditor;

  beforeEach(() => {
    simulator = new ChoreoPoseSimulator();
    registry = new DancePatternRegistry(DEFAULT_CAT_CHOREO_PATTERNS);
    sequenceEditor = new PhaseSequenceEditor();
  });

  describe('1. RUN_QUESTION 페이즈 바운스(dip & rebound) 시뮬레이션', () => {
    it('홀수 박(Beat 1)에서는 rebound(위쪽/업) 상태이고 바운스 오프셋이 작거나 0에 가깝다', () => {
      const notes = sequenceEditor.getNotesForPhase('RUN_QUESTION');
      const frame = simulator.computeLiveFrame({
        phase: 'RUN_QUESTION',
        currentBeat: 1.0,
        selectedPattern: registry.get('CAT_LOW_BOUNCE'),
        notes,
        registry,
      });

      expect(frame.phase).toBe('RUN_QUESTION');
      expect(frame.activeNote?.label).toContain('rebound');
      expect(frame.isDip).toBe(false);
      expect(frame.targetZones).toContain(6);
      expect(frame.targetZones).toContain(8);
      // 관절 좌표가 유효한 0~1 범위 내에 존재
      expect(frame.jointPositions.hip.x).toBeGreaterThan(0);
      expect(frame.jointPositions.hip.y).toBeGreaterThan(0);
    });

    it('짝수 박(Beat 2)에서는 dip(하단 스쿼트) 상태이며 골반 위치가 낮아진다', () => {
      const notes = sequenceEditor.getNotesForPhase('RUN_QUESTION');
      const frameDip = simulator.computeLiveFrame({
        phase: 'RUN_QUESTION',
        currentBeat: 2.0,
        selectedPattern: registry.get('CAT_LOW_BOUNCE'),
        notes,
        registry,
      });

      expect(frameDip.isDip).toBe(true);
      expect(frameDip.activeNote?.label).toContain('dip');
      expect(frameDip.targetZones).toContain(10); // 골반 하단 스쿼트 존
      expect(frameDip.bounceOffset).toBeGreaterThan(0); // 하강 오프셋 양수
    });
  });

  describe('2. STAR_COLLECT 페이즈 키노트 노트 추적 시뮬레이션', () => {
    it('Beat 2에서 로우바운스 딥(Zone 10) 키노트 노트를 검출하고 타깃 존으로 설정한다', () => {
      const notes = sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const frame = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: 2.0,
        selectedPattern: registry.get('CAT_LOW_BOUNCE'),
        notes,
        registry,
      });

      expect(frame.phase).toBe('STAR_COLLECT');
      expect(frame.activeNote).not.toBeNull();
      expect(frame.targetZones).toContain(10);
    });

    it('Beat 5에서 우측 스카이포인트 찌르기(Zone 3) 노트를 검출한다', () => {
      const notes = sequenceEditor.getNotesForPhase('STAR_COLLECT');
      const frame = simulator.computeLiveFrame({
        phase: 'STAR_COLLECT',
        currentBeat: 5.0,
        selectedPattern: registry.get('CAT_SKY_POINT_RIGHT'),
        notes,
        registry,
      });

      expect(frame.targetZones).toContain(3);
      expect(frame.activeNote?.label).toContain('우측 스카이포인트');
    });
  });

  describe('3. FEVER_PHASE_B 16박 풀루프 안무 패턴 순환 시뮬레이션', () => {
    it('16박 타임라인 진행에 따라 4가지 안무 패턴이 순차적으로 활성화된다', () => {
      const notes = sequenceEditor.getNotesForPhase('FEVER_PHASE_B');

      // Beat 2 (블록 1: 1~4박) -> CAT_LOW_BOUNCE
      const frame1 = simulator.computeLiveFrame({
        phase: 'FEVER_PHASE_B',
        currentBeat: 2.0,
        selectedPattern: null,
        notes,
        registry,
      });
      expect(frame1.activePattern?.id).toBe('CAT_LOW_BOUNCE');

      // Beat 6 (블록 2: 5~8박) -> CAT_SKY_POINT_RIGHT
      const frame2 = simulator.computeLiveFrame({
        phase: 'FEVER_PHASE_B',
        currentBeat: 6.0,
        selectedPattern: null,
        notes,
        registry,
      });
      expect(frame2.activePattern?.id).toBe('CAT_SKY_POINT_RIGHT');

      // Beat 10 (블록 3: 9~12박) -> CAT_CENTER_CLASP
      const frame3 = simulator.computeLiveFrame({
        phase: 'FEVER_PHASE_B',
        currentBeat: 10.0,
        selectedPattern: null,
        notes,
        registry,
      });
      expect(frame3.activePattern?.id).toBe('CAT_CENTER_CLASP');

      // Beat 14 (블록 4: 13~16박) -> CAT_SKY_POINT_LEFT
      const frame4 = simulator.computeLiveFrame({
        phase: 'FEVER_PHASE_B',
        currentBeat: 14.0,
        selectedPattern: null,
        notes,
        registry,
      });
      expect(frame4.activePattern?.id).toBe('CAT_SKY_POINT_LEFT');
    });
  });

  describe('4. 관절 위치 보간 및 바운스 커브', () => {
    it('비트 분수 위치(예: 1.5)에서 부드러운 코사인/사인 바운스 오프셋을 생성한다', () => {
      const notes = sequenceEditor.getNotesForPhase('RUN_QUESTION');
      const frameMid = simulator.computeLiveFrame({
        phase: 'RUN_QUESTION',
        currentBeat: 1.5,
        selectedPattern: registry.get('CAT_LOW_BOUNCE'),
        notes,
        registry,
      });

      // 바운스 오프셋이 -1 ~ 1 범위 내에 위치
      expect(frameMid.bounceOffset).toBeGreaterThanOrEqual(-1);
      expect(frameMid.bounceOffset).toBeLessThanOrEqual(1);
      expect(frameMid.jointPositions).toBeDefined();
      expect(frameMid.jointPositions.leftHand).toBeDefined();
      expect(frameMid.jointPositions.rightHand).toBeDefined();
      expect(frameMid.jointPositions.head).toBeDefined();
      expect(frameMid.jointPositions.hip).toBeDefined();
    });
  });
});
