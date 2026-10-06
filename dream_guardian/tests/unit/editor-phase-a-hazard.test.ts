import { describe, expect, it, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import { compileEditorProject } from '../../src/data/ContentCompiler.js';
import { EditorProjectStore } from '../../src/storage/EditorProjectStore.js';
import { EditorContentDatabase } from '../../src/storage/EditorContentDatabase.js';

describe('[Issue #395 / EDITOR-HAZARD-A] Phase A 장판 편집 탭·경고/입력/판정 읽기 전용 표시', () => {
  let state: EditorState;
  let layout: EditorLayout;

  beforeEach(() => {
    state = new EditorState();
    layout = new EditorLayout(state);
  });

  describe('1. 활성 3종(left_step, right_step, jump) 선택 및 시퀀스 반영', () => {
    it('기본 Phase A 장판 패턴은 left_step 이어야 한다', () => {
      expect(state.getPhaseAHazardPattern()).toBe('left_step');
    });

    it('활성 회피 3종(left_step, right_step, jump)을 선택 및 변경할 수 있다', () => {
      const resRight = state.setPhaseAHazardPattern('right_step');
      expect(resRight.success).toBe(true);
      expect(state.getPhaseAHazardPattern()).toBe('right_step');

      const resJump = state.setPhaseAHazardPattern('jump');
      expect(resJump.success).toBe(true);
      expect(state.getPhaseAHazardPattern()).toBe('jump');

      const resLeft = state.setPhaseAHazardPattern('left_step');
      expect(resLeft.success).toBe(true);
      expect(state.getPhaseAHazardPattern()).toBe('left_step');
    });

    it('toEditorProject() 출력 시 Phase A hazard 시퀀스 및 이벤트에 선택된 패턴이 반영된다', () => {
      state.setPhaseAHazardPattern('jump');
      const project = state.toEditorProject();

      const hazardSeq = project.sequences.find(
        (s) => s.phase === 'phaseA' && s.kind === 'hazard',
      );
      expect(hazardSeq).toBeDefined();
      expect(hazardSeq?.events).toHaveLength(1);

      const evt = hazardSeq?.events[0] as any;
      expect(evt.hazardType).toBe('jump');
      expect(evt.kind).toBe('hazard');

      // 바인딩에도 phaseA hazard 시퀀스가 연결되어 있어야 함
      const hazardBinding = project.bindings.find(
        (b) => b.phase === 'phaseA' && b.sequenceId === hazardSeq?.id,
      );
      expect(hazardBinding).toBeDefined();
      expect(hazardBinding?.role).toBe('hazard');
    });
  });

  describe('2. 비활성 패턴 및 잘못된 종류 선택 시 잠금/거부 검증', () => {
    it('비활성 패턴(balance_left, balance_right)은 선택할 수 없고 잠겨 있어야 한다', () => {
      const resBalLeft = state.setPhaseAHazardPattern('balance_left');
      expect(resBalLeft.success).toBe(false);
      expect(state.getPhaseAHazardPattern()).toBe('left_step'); // 변경되지 않음

      const resBalRight = state.setPhaseAHazardPattern('balance_right');
      expect(resBalRight.success).toBe(false);
      expect(state.getPhaseAHazardPattern()).toBe('left_step');
    });

    it('정의되지 않은 임의의 문자열은 거부된다', () => {
      const resInvalid = state.setPhaseAHazardPattern('somersault');
      expect(resInvalid.success).toBe(false);
      expect(state.getPhaseAHazardPattern()).toBe('left_step');
    });

    it('활성 패턴 및 비활성(잠금) 패턴 목록을 제공한다', () => {
      expect(state.getActivePhaseAHazardPatterns()).toEqual(['left_step', 'right_step', 'jump']);
      expect(state.getLockedPhaseAHazardPatterns()).toEqual(['balance_left', 'balance_right']);
    });

    it('피해량(damage: 25)은 읽기 전용으로 잠겨 있으며 임의 수정 불가하다', () => {
      expect(state.getPhaseAHazardDamage()).toBe(25);
    });
  });

  describe('3. 현재 BPM 기준 스케줄(경고/정규입력/판정/종료) 읽기 전용 계산', () => {
    it('BPM 120 기준 스케줄(초 및 박자)을 정확히 계산한다', () => {
      state.setBpm(120);
      const schedule = state.getPhaseAHazardSchedule();

      expect(schedule.bpm).toBe(120);
      expect(schedule.secondsPerBeat).toBe(0.5);
      expect(schedule.damage).toBe(25);

      // 초 단위 (BPM 120 기준)
      expect(schedule.warningDuration).toBe(2.6);
      expect(schedule.inputWindowEnd).toBe(3.4);
      expect(schedule.judgmentTime).toBe(3.5);
      expect(schedule.totalDuration).toBe(4.0);

      // 박 단위
      expect(schedule.warningDurationBeats).toBe(5.2);
      expect(schedule.inputWindowEndBeats).toBe(6.8);
      expect(schedule.judgmentTimeBeats).toBe(7.0);
      expect(schedule.totalDurationBeats).toBe(8.0);
    });

    it('BPM 변경 시(예: 60 BPM) scaleHazardSchedule에 의해 초 단위 일정이 비례 스케일링된다', () => {
      state.setBpm(60);
      const schedule = state.getPhaseAHazardSchedule();

      expect(schedule.bpm).toBe(60);
      expect(schedule.secondsPerBeat).toBe(1.0);

      // 초 단위 2배 (secondsPerBeat 0.5 -> 1.0)
      expect(schedule.warningDuration).toBe(5.2);
      expect(schedule.inputWindowEnd).toBe(6.8);
      expect(schedule.judgmentTime).toBe(7.0);
      expect(schedule.totalDuration).toBe(8.0);

      // 박 단위는 BPM에 무관하게 일정하게 유지
      expect(schedule.warningDurationBeats).toBe(5.2);
      expect(schedule.inputWindowEndBeats).toBe(6.8);
      expect(schedule.judgmentTimeBeats).toBe(7.0);
      expect(schedule.totalDurationBeats).toBe(8.0);
    });

    it('BPM 150 기준 scaleHazardSchedule 비례 스케일링을 정확히 계산한다', () => {
      state.setBpm(150);
      const schedule = state.getPhaseAHazardSchedule();

      expect(schedule.bpm).toBe(150);
      expect(schedule.secondsPerBeat).toBeCloseTo(0.4, 4);

      // ratio = 0.4 / 0.5 = 0.8
      expect(schedule.warningDuration).toBeCloseTo(2.08, 4);
      expect(schedule.inputWindowEnd).toBeCloseTo(2.72, 4);
      expect(schedule.judgmentTime).toBeCloseTo(2.8, 4);
      expect(schedule.totalDuration).toBeCloseTo(3.2, 4);
    });
  });

  describe('4. 장판 변경 시 STAR_COLLECT 별 7슬롯 데이터 100% 불변 보존', () => {
    it('Phase A 장판 패턴을 변경해도 기존 7슬롯 별 데이터가 전혀 영향을 받지 않는다', () => {
      // 슬롯 2 수정 (leftHand, Zone 2)
      state.setFormBuffer(2, { part: 'leftHand', zoneId: 2 });
      const res = state.applyFormBuffer(2);
      expect(res.valid).toBe(true);

      const slotsBefore = state.getStarSlots();
      expect(slotsBefore[2].zoneId).toBe(2);

      // Phase A 장판 패턴 변경
      state.setPhaseAHazardPattern('right_step');

      // 별 슬롯 데이터 100% 보존 확인
      const slotsAfter = state.getStarSlots();
      expect(slotsAfter).toHaveLength(7);
      expect(slotsAfter[0].zoneId).toBe(slotsBefore[0].zoneId);
      expect(slotsAfter[1].zoneId).toBe(slotsBefore[1].zoneId);
      expect(slotsAfter[2].zoneId).toBe(2);
      expect(slotsAfter[2].part).toBe('leftHand');
      expect(slotsAfter[6].part).toBe(slotsBefore[6].part);

      // toEditorProject()에서도 starNotes와 hazard가 독립적으로 공존
      const project = state.toEditorProject();
      const starSeq = project.sequences.find(
        (s) => s.phase === 'phaseA' && s.kind === 'starNotes',
      );
      const hazardSeq = project.sequences.find(
        (s) => s.phase === 'phaseA' && s.kind === 'hazard',
      );

      expect(starSeq?.events).toHaveLength(7);
      expect(hazardSeq?.events).toHaveLength(1);
      expect((hazardSeq?.events[0] as any).hazardType).toBe('right_step');
    });
  });

  describe('5. 저장, 복원, 컴파일 연동 검증', () => {
    it('프로젝트 저장 후 새 EditorState에 복원 시 Phase A hazard 설정이 완벽히 유지된다', async () => {
      state.setBpm(120);
      state.setPhaseAHazardPattern('jump');
      const project = state.toEditorProject();

      const db = new EditorContentDatabase();
      const store = new EditorProjectStore(db);
      await store.saveProject(project);

      const restoredProject = await store.loadProject(project.projectId);
      expect(restoredProject).not.toBeNull();

      const newState = new EditorState();
      newState.applyProject(restoredProject!);

      expect(newState.getPhaseAHazardPattern()).toBe('jump');
      const restoredSchedule = newState.getPhaseAHazardSchedule();
      expect(restoredSchedule.damage).toBe(25);
      expect(restoredSchedule.judgmentTime).toBe(3.5);
    });

    it('컴파일러(ContentCompiler)를 통과하여 Phase A bundle에 hazard가 올바르게 주입된다', () => {
      const validProject = {
        kind: 'dream-guardian-authoring-project' as const,
        schemaVersion: 2 as const,
        projectId: 'proj_hazard_compile',
        revision: 1,
        rulesetId: 'dg-ruleset-v2',
        metadata: {
          title: 'Hazard Compile Project',
          createdAt: '2026-10-06T00:00:00.000Z',
          updatedAt: '2026-10-06T00:00:00.000Z',
        },
        previewTempo: { bpm: 120, beatsPerBar: 4 },
        patterns: [
          { id: 'pat_1', name: 'Pattern 1', target: { leftHand: 4, rightHand: 5 } },
        ],
        sequences: [
          {
            id: 'seq_stars',
            phase: 'phaseA' as const,
            kind: 'starNotes' as const,
            events: [
              { id: 's1', kind: 'starNote' as const, landingTick: 960, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 4 } },
              { id: 's2', kind: 'starNote' as const, landingTick: 1440, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 5 } },
              { id: 's3', kind: 'starNote' as const, landingTick: 1920, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 1 } },
              { id: 's4', kind: 'starNote' as const, landingTick: 2400, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 3 } },
              { id: 's5', kind: 'starNote' as const, landingTick: 2880, target: { type: 'cursor' as const, part: 'leftHand' as const, zoneId: 4 } },
              { id: 's6', kind: 'starNote' as const, landingTick: 3360, target: { type: 'cursor' as const, part: 'rightHand' as const, zoneId: 5 } },
              { id: 's7', kind: 'starNote' as const, landingTick: 3840, target: { type: 'foot' as const, foot: 'centerFoot' as const, zoneId: 10 as const } },
            ],
          },
          {
            id: 'seq_hazard_a',
            phase: 'phaseA' as const,
            kind: 'hazard' as const,
            events: [
              { id: 'h1', kind: 'hazard' as const, hazardType: 'left_step' },
            ],
          },
        ],
        bindings: [
          { chapterId: 'ch1', subLevelId: null, phase: 'phaseA' as const, sequenceId: 'seq_stars' },
          { chapterId: 'ch1', subLevelId: null, phase: 'phaseA' as const, sequenceId: 'seq_hazard_a', role: 'hazard' },
        ],
      };

      state.applyProject(validProject);
      state.setPhaseAHazardPattern('right_step');
      const project = state.toEditorProject();

      const compileResult = compileEditorProject(project);

      expect(compileResult.success).toBe(true);
      expect(compileResult.pack).toBeDefined();

      const ch1Bundle = compileResult.pack?.stages.ch1;
      expect(ch1Bundle?.phaseA?.hazard).toBeDefined();
      expect(ch1Bundle?.phaseA?.hazard?.hazardType).toBe('right_step');
      expect(ch1Bundle?.phaseA?.hazard?.requiredAction).toBe('right_step');
      expect(ch1Bundle?.phaseA?.hazard?.timings?.judgmentBeat).toBe(7.0);

      // starNotes 7개도 동시에 존재
      expect(ch1Bundle?.phaseA?.starNotes).toHaveLength(7);
    });
  });

  describe('6. EditorLayout UI 렌더링 검증', () => {
    it('헤더의 페이즈 선택 셀렉트에 HAZARD_EVADE (오답 장판) 옵션이 포함된다', () => {
      const headerHtml = layout.renderHeaderHTML();
      expect(headerHtml).toContain('HAZARD_EVADE');
      expect(headerHtml).toContain('오답 장판');
    });

    it('HAZARD_EVADE 페이즈 선택 시 사이드바에 장판 회피 편집 섹션이 렌더링된다', () => {
      state.setSelectedPhase('HAZARD_EVADE');
      const sidebarHtml = layout.renderSidebarHTML();

      expect(sidebarHtml).toContain('hazard-evade-editor-section');
      expect(sidebarHtml).toContain('오답 장판');

      // 활성 3종 옵션 렌더링
      expect(sidebarHtml).toContain('left_step');
      expect(sidebarHtml).toContain('right_step');
      expect(sidebarHtml).toContain('jump');

      // 비활성 2종 잠금(disabled) 표시
      expect(sidebarHtml).toContain('balance_left');
      expect(sidebarHtml).toContain('balance_right');

      // 읽기 전용 스케줄 및 피해량(25) 표시
      expect(sidebarHtml).toContain('25');
      expect(sidebarHtml).toContain('warning-duration-display');
      expect(sidebarHtml).toContain('judgment-time-display');

      // 별 수집 슬롯 섹션은 표시되지 않아야 함 (구간 분리)
      expect(sidebarHtml).not.toContain('star-slot-editor-section');
    });
  });
});
