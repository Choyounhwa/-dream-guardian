import { describe, expect, it, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import { compileEditorProject } from '../../src/data/ContentCompiler.js';
import type { EditorBinding } from '../../src/data/EditorProject.js';

describe('[Issue #398 / EDITOR-FEVER] Phase B 피버 노트 편집과 16박 가이드 분리', () => {
  let state: EditorState;
  let layout: EditorLayout;

  beforeEach(() => {
    state = new EditorState();
    layout = new EditorLayout(state);
  });

  describe('1. 16박 motionGuide와 8노트 feverNotes 독립 생성/저장 및 분리 확인', () => {
    it('EditorState 초기화 시 기본 8개 피버 슬롯이 생성되며 480틱 간격 및 2종 교대 기본값을 갖는다', () => {
      const slots = state.getFeverSlots();
      expect(slots).toHaveLength(8);

      // 480 tick interval (ticks 480, 960, 1440, 1920, 2400, 2880, 3360, 3840)
      for (let i = 0; i < 8; i++) {
        expect(slots[i].slotIndex).toBe(i);
        expect(slots[i].slotNumber).toBe(i + 1);
        expect(slots[i].beat).toBe(i + 1);
        expect(slots[i].tick).toBe((i + 1) * 480);
        expect(slots[i].noteId).toBe(`NOTE_F_${i + 1}`);
      }

      // 2종 교대 (leftHand Zone 4 / rightHand Zone 5)
      expect(slots[0].part).toBe('leftHand');
      expect(slots[0].zoneId).toBe(4);
      expect(slots[1].part).toBe('rightHand');
      expect(slots[1].zoneId).toBe(5);
      expect(slots[2].part).toBe('leftHand');
      expect(slots[2].zoneId).toBe(4);
      expect(slots[3].part).toBe('rightHand');
      expect(slots[3].zoneId).toBe(5);
    });

    it('기존 FEVER_PHASE_B 16박 motion guide가 변경 없이 온전히 보존된다', () => {
      const motionGuideNotes = state.getNotesForPhase('FEVER_PHASE_B');
      expect(motionGuideNotes.length).toBeGreaterThanOrEqual(4);

      // FEVER_PHASE_B routine 총 16박 보존
      state.setSelectedPhase('FEVER_PHASE_B');
      expect(state.selectedPhase).toBe('FEVER_PHASE_B');
      expect(state.getCurrentPhaseRoutine().totalBeats).toBe(16);
    });

    it('toEditorProject() 출력 시 phaseB의 motionGuide와 feverNotes가 독립 시퀀스로 분리 출력된다', () => {
      const project = state.toEditorProject();

      const motionGuideSeq = project.sequences.find(
        (s) => s.phase === 'phaseB' && s.kind === 'motionGuide',
      );
      expect(motionGuideSeq).toBeDefined();
      expect(motionGuideSeq?.id).toBe('seq_phaseB_motion');

      const feverNotesSeq = project.sequences.find(
        (s) => s.phase === 'phaseB' && s.kind === 'feverNotes',
      );
      expect(feverNotesSeq).toBeDefined();
      expect(feverNotesSeq?.id).toBe('seq_phaseB_fever');
      expect(feverNotesSeq?.events).toHaveLength(8);

      // 온전한 feverNote 실행 데이터 객체 확인 (단순 가이드 이름 치환 금지)
      const firstEvent = feverNotesSeq!.events[0] as any;
      expect(firstEvent.kind).toBe('feverNote');
      expect(firstEvent.landingTick).toBe(480);
      expect(firstEvent.target).toEqual({
        type: 'cursor',
        part: 'leftHand',
        zoneId: 4,
      });

      const secondEvent = feverNotesSeq!.events[1] as any;
      expect(secondEvent.kind).toBe('feverNote');
      expect(secondEvent.landingTick).toBe(960);
      expect(secondEvent.target).toEqual({
        type: 'cursor',
        part: 'rightHand',
        zoneId: 5,
      });
    });

    it('컴파일러(ContentCompiler)를 통과하여 Phase B에 motionGuide와 feverNotes가 독립 주입된다', () => {
      // 컴파일러 검증을 위해 유효한 StarNotes 시퀀스와 120 BPM 설정
      state.applyProject({
        kind: 'dream-guardian-authoring-project',
        schemaVersion: 2,
        projectId: 'proj_fever_compile',
        revision: 1,
        rulesetId: 'dg-ruleset-v2',
        metadata: {
          title: 'Fever Compile Project',
          createdAt: '2026-10-06T00:00:00.000Z',
          updatedAt: '2026-10-06T00:00:00.000Z',
        },
        previewTempo: { bpm: 120, beatsPerBar: 4 },
        patterns: [
          { id: 'pat_1', name: 'Pattern 1', target: { leftHand: 4, rightHand: 5 } },
        ],
        sequences: [
          {
            id: 'seq_phaseA_star',
            phase: 'phaseA',
            kind: 'starNotes',
            events: [
              { id: 's1', kind: 'starNote', landingTick: 960, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
              { id: 's2', kind: 'starNote', landingTick: 1440, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
              { id: 's3', kind: 'starNote', landingTick: 1920, target: { type: 'cursor', part: 'leftHand', zoneId: 1 } },
              { id: 's4', kind: 'starNote', landingTick: 2400, target: { type: 'cursor', part: 'rightHand', zoneId: 2 } },
              { id: 's5', kind: 'starNote', landingTick: 2880, target: { type: 'cursor', part: 'leftHand', zoneId: 4 } },
              { id: 's6', kind: 'starNote', landingTick: 3360, target: { type: 'cursor', part: 'rightHand', zoneId: 5 } },
              { id: 's7', kind: 'starNote', landingTick: 3840, target: { type: 'cursor', part: 'leftHand', zoneId: 1 } },
            ],
          },
          {
            id: 'seq_phaseB_motion',
            phase: 'phaseB',
            kind: 'motionGuide',
            events: [
              { id: 'm1', kind: 'motionCue', startTick: 0, durationTicks: 1920, target: { leftHand: 4, rightHand: 5 } },
              { id: 'm2', kind: 'motionCue', startTick: 1920, durationTicks: 1920, target: { leftHand: 1, rightHand: 2 } },
              { id: 'm3', kind: 'motionCue', startTick: 3840, durationTicks: 1920, target: { leftHand: 4, rightHand: 5 } },
              { id: 'm4', kind: 'motionCue', startTick: 5760, durationTicks: 1920, target: { leftHand: 1, rightHand: 2 } },
            ],
          },
        ],
        bindings: [
          { chapterId: 'ch1', subLevelId: 'star_collect', phase: 'phaseA', sequenceId: 'seq_phaseA_star', role: 'starNotes' },
          { chapterId: 'ch1', subLevelId: 'fever_phase_b', phase: 'phaseB', sequenceId: 'seq_phaseB_motion', role: 'motionGuide' },
          { chapterId: 'ch1', subLevelId: 'fever_phase_b', phase: 'phaseB', sequenceId: 'seq_phaseB_fever', role: 'feverNotes' },
        ],
      });

      const project = state.toEditorProject();
      const compileResult = compileEditorProject(project);

      expect(compileResult.success).toBe(true);
      const stageB = compileResult.pack!.stages['ch1']?.phaseB;
      expect(stageB).toBeDefined();

      // 16박 motion guide와 8노트 feverNotes 독립 존재
      expect(stageB?.motionGuide).toBeDefined();
      expect(stageB?.motionGuide?.length).toBeGreaterThan(0);
      expect(stageB?.feverNotes).toBeDefined();
      expect(stageB?.feverNotes?.length).toBe(8);
      expect(stageB?.feverNotes?.[0]?.landingTick).toBe(480);
    });
  });

  describe('2. 8노트 feverNotes 슬롯 편집 및 Capability 제약 검증', () => {
    it('개별 슬롯의 신체 부위 및 존을 수정할 수 있다', () => {
      const updateRes = state.updateFeverSlot(0, {
        part: 'leftHand',
        zoneId: 1,
      });
      expect(updateRes.valid).toBe(true);

      const slots = state.getFeverSlots();
      expect(slots[0].part).toBe('leftHand');
      expect(slots[0].zoneId).toBe(1);
    });

    it('발(foot) 타겟으로 수정 시 foot 속성과 9~11 존이 올바르게 반영된다', () => {
      const updateRes = state.updateFeverSlot(1, {
        part: 'foot',
        zoneId: 9,
      });
      expect(updateRes.valid).toBe(true);

      const slots = state.getFeverSlots();
      expect(slots[1].part).toBe('foot');
      expect(slots[1].zoneId).toBe(9);

      const project = state.toEditorProject();
      const feverSeq = project.sequences.find((s) => s.phase === 'phaseB' && s.kind === 'feverNotes');
      const secondEvt = feverSeq!.events[1] as any;
      expect(secondEvt.target).toEqual({
        type: 'foot',
        foot: 'leftFoot',
        zoneId: 9,
      });
    });

    it('capability 제약: head 및 hip 커서는 feverNotes에서 허용되지 않는다', () => {
      const headRes = state.validateFeverSlot(0, { part: 'head' as any });
      expect(headRes.valid).toBe(false);
      expect(headRes.lockCode).toBe('LOCKED_INPUT_CAPABILITY');

      const hipRes = state.validateFeverSlot(0, { part: 'hip' as any });
      expect(hipRes.valid).toBe(false);
      expect(hipRes.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
    });

    it('capability 제약: 손 존 1~5 범위를 벗어난 존(예: Zone 6)은 거부된다', () => {
      const res = state.validateFeverSlot(0, { part: 'leftHand', zoneId: 6 });
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
    });

    it('capability 제약: 발 존 9~11 범위를 벗어난 존(예: Zone 4)은 거부된다', () => {
      const res = state.validateFeverSlot(0, { part: 'foot', zoneId: 4 });
      expect(res.valid).toBe(false);
      expect(res.lockCode).toBe('LOCKED_INPUT_CAPABILITY');
    });

    it('capability 제약: Cross-Body 물리 제약을 엄격히 검증한다 (왼손 Zone 3, 오른손 Zone 1 차단)', () => {
      const leftCross = state.validateFeverSlot(0, { part: 'leftHand', zoneId: 3 });
      expect(leftCross.valid).toBe(false);
      expect(leftCross.lockCode).toBe('CROSS_BODY_VIOLATION');

      const rightCross = state.validateFeverSlot(1, { part: 'rightHand', zoneId: 1 });
      expect(rightCross.valid).toBe(false);
      expect(rightCross.lockCode).toBe('CROSS_BODY_VIOLATION');
    });

    it('슬롯 개수 및 착지 타이밍 임의 수정이 잠겨 있다', () => {
      expect(state.canModifyFeverNoteCount()).toBe(false);

      const timingRes = state.validateFeverSlot(0, { tick: 777 });
      expect(timingRes.valid).toBe(false);
      expect(timingRes.lockCode).toBe('FIXED_SLOT_LANDING');
    });

    it('폼 버퍼(FormBuffer) 연동으로 에러 상태 및 적용이 지원된다', () => {
      state.setFeverFormBuffer(0, { part: 'leftHand', zoneId: 3 });
      const buf = state.getFeverFormBuffer(0);
      expect(buf?.isDirty).toBe(true);
      expect(buf?.errors?.length).toBeGreaterThan(0);

      const applyFail = state.applyFeverFormBuffer(0);
      expect(applyFail.valid).toBe(false);

      // 올바른 값으로 수정 후 적용
      state.setFeverFormBuffer(0, { part: 'leftHand', zoneId: 2 });
      const applyOk = state.applyFeverFormBuffer(0);
      expect(applyOk.valid).toBe(true);
      expect(state.getFeverSlots()[0].zoneId).toBe(2);
    });
  });

  describe('3. BOSS_CLIMAX 바인딩 공존 및 역할 누락 진단', () => {
    it('동일한 chapterId 및 boss_climax subLevelId 하에서 feverNotes와 hazard 바인딩이 공존할 수 있다', () => {
      // feverNotes 바인딩 추가
      const feverBinding: EditorBinding = {
        chapterId: 'ch1',
        subLevelId: 'boss_climax',
        phase: 'phaseB',
        sequenceId: 'seq_phaseB_fever',
        role: 'feverNotes',
      };
      const resFever = state.addBinding(feverBinding);
      expect(resFever.success).toBe(true);

      // hazard 바인딩 추가 (공존 가능)
      const hazardBinding: EditorBinding = {
        chapterId: 'ch1',
        subLevelId: 'boss_climax',
        phase: 'phaseB',
        sequenceId: 'seq_phaseA_hazard', // phase mismatch 방지를 위해 phaseB hazard 시퀀스 추가 필요 여부 확인
        role: 'hazard',
      };
      // phase mismatch 방지를 위해 phaseB hazard 시퀀스 추가
      state.addCustomSequence({
        id: 'seq_phaseB_hazard_boss',
        phase: 'phaseB',
        kind: 'hazard',
        events: [{ id: 'evt_hz_b', kind: 'phaseBHazard', attackType: 'dual_slam' }],
      });
      hazardBinding.sequenceId = 'seq_phaseB_hazard_boss';

      const resHazard = state.addBinding(hazardBinding);
      expect(resHazard.success).toBe(true);

      // 두 바인딩 모두 존재 확인
      const bindings = state.getBindings();
      const bFever = bindings.find(
        (b) => b.chapterId === 'ch1' && b.subLevelId === 'boss_climax' && b.role === 'feverNotes',
      );
      const bHazard = bindings.find(
        (b) => b.chapterId === 'ch1' && b.subLevelId === 'boss_climax' && b.role === 'hazard',
      );
      expect(bFever).toBeDefined();
      expect(bHazard).toBeDefined();
    });

    it('동일 role에 대한 중복 바인딩은 거부된다', () => {
      state.addBinding({
        chapterId: 'ch1',
        subLevelId: 'boss_climax',
        phase: 'phaseB',
        sequenceId: 'seq_phaseB_fever',
        role: 'feverNotes',
      });

      const dupeRes = state.addBinding({
        chapterId: 'ch1',
        subLevelId: 'boss_climax',
        phase: 'phaseB',
        sequenceId: 'seq_phaseB_fever',
        role: 'feverNotes',
      });
      expect(dupeRes.success).toBe(false);
      expect(dupeRes.error).toMatch(/duplicate/i);
    });

    it('diagnoseBossClimaxBindings()는 feverNotes 또는 hazard 누락 역할을 정확히 진단한다', () => {
      // 바인딩 없는 상태에서 ch2 진단 -> 둘 다 누락
      const diagEmpty = state.diagnoseBossClimaxBindings('ch2');
      expect(diagEmpty.isComplete).toBe(false);
      expect(diagEmpty.missingRoles).toContain('feverNotes');
      expect(diagEmpty.missingRoles).toContain('hazard');

      // feverNotes만 바인딩
      state.addBinding({
        chapterId: 'ch2',
        subLevelId: 'boss_climax',
        phase: 'phaseB',
        sequenceId: 'seq_phaseB_fever',
        role: 'feverNotes',
      });
      const diagOnlyFever = state.diagnoseBossClimaxBindings('ch2');
      expect(diagOnlyFever.isComplete).toBe(false);
      expect(diagOnlyFever.hasFeverNotes).toBe(true);
      expect(diagOnlyFever.hasHazard).toBe(false);
      expect(diagOnlyFever.missingRoles).toEqual(['hazard']);

      // hazard도 바인딩
      state.addCustomSequence({
        id: 'seq_phaseB_hazard_ch2',
        phase: 'phaseB',
        kind: 'hazard',
        events: [{ id: 'evt_hz_ch2', kind: 'phaseBHazard', attackType: 'dual_slam' }],
      });
      state.addBinding({
        chapterId: 'ch2',
        subLevelId: 'boss_climax',
        phase: 'phaseB',
        sequenceId: 'seq_phaseB_hazard_ch2',
        role: 'hazard',
      });
      const diagComplete = state.diagnoseBossClimaxBindings('ch2');
      expect(diagComplete.isComplete).toBe(true);
      expect(diagComplete.hasFeverNotes).toBe(true);
      expect(diagComplete.hasHazard).toBe(true);
      expect(diagComplete.missingRoles).toEqual([]);
    });
  });

  describe('4. 별 수집(STAR_COLLECT) 및 Phase A 장판(HAZARD_EVADE) 100% 불변 보존', () => {
    it('피버 슬롯을 변경해도 STAR_COLLECT 7슬롯 데이터와 Phase A 장판이 영향을 받지 않는다', () => {
      const origStarSlots = JSON.stringify(state.getStarSlots());
      const origHazard = state.getPhaseAHazardPattern();

      state.updateFeverSlot(0, { part: 'leftHand', zoneId: 1 });
      state.updateFeverSlot(1, { part: 'foot', zoneId: 9 });

      expect(JSON.stringify(state.getStarSlots())).toBe(origStarSlots);
      expect(state.getPhaseAHazardPattern()).toBe(origHazard);
    });

    it('Phase A 장판을 변경해도 피버 슬롯 데이터가 영향을 받지 않는다', () => {
      const origFeverSlots = JSON.stringify(state.getFeverSlots());

      state.setPhaseAHazardPattern('jump');
      expect(JSON.stringify(state.getFeverSlots())).toBe(origFeverSlots);
    });

    it('구버전/외부 프로젝트 applyProject 및 toEditorProject 왕복 시 feverNotes와 motionGuide가 무손실 보존된다', () => {
      state.updateFeverSlot(0, { part: 'leftHand', zoneId: 2 });
      state.updateFeverSlot(3, { part: 'foot', zoneId: 11 });

      const exported = state.toEditorProject();

      const newState = new EditorState();
      newState.applyProject(exported);

      const reExported = newState.toEditorProject();

      const origFeverSeq = exported.sequences.find((s) => s.kind === 'feverNotes');
      const reFeverSeq = reExported.sequences.find((s) => s.kind === 'feverNotes');
      expect(reFeverSeq).toEqual(origFeverSeq);

      const origMotionSeq = exported.sequences.find((s) => s.phase === 'phaseB' && s.kind === 'motionGuide');
      const reMotionSeq = reExported.sequences.find((s) => s.phase === 'phaseB' && s.kind === 'motionGuide');
      expect(reMotionSeq).toEqual(origMotionSeq);
    });
  });

  describe('5. UI & 레이아웃 검증 (EditorLayout & main.ts)', () => {
    it('상단 페이즈 셀렉터에 FEVER_NOTES 탭이 존재한다', () => {
      const headerHTML = layout.renderHeaderHTML();
      expect(headerHTML).toContain('value="FEVER_NOTES"');
      expect(headerHTML).toContain('피버 노트');
    });

    it('FEVER_NOTES 페이즈 선택 시 8슬롯 전용 편집 패널이 렌더링된다', () => {
      state.setSelectedPhase('FEVER_NOTES');
      const sidebarHTML = layout.renderSidebarHTML();

      expect(sidebarHTML).toContain('피버 노트 편집 (Phase B / FEVER_NOTES)');
      expect(sidebarHTML).toContain('fever-slot-item');
      expect(sidebarHTML).toContain('fever-part-select');
      expect(sidebarHTML).toContain('fever-zone-select');

      // 8개 슬롯 확인
      for (let i = 0; i < 8; i++) {
        expect(sidebarHTML).toContain(`data-slot-index="${i}"`);
      }
    });

    it('FEVER_PHASE_B 페이즈 선택 시 16박 모션 가이드 편집 모드가 렌더링된다', () => {
      state.setSelectedPhase('FEVER_PHASE_B');
      const sidebarHTML = layout.renderSidebarHTML();

      // FEVER_NOTES 8슬롯 섹션은 표시되지 않음
      expect(sidebarHTML).not.toContain('피버 노트 편집 (Phase B / FEVER_NOTES)');
    });
  });
});
