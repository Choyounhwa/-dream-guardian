import { describe, expect, it, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import { ProjectCommandManager } from '../../src/editor/ProjectCommands.js';
import {
  PHASE_B_PUBLISHABLE_ATTACKS,
  type PhaseBPublishableAttack,
} from '../../src/data/ContentCapabilities.js';

describe('[Issue #400 / EDITOR-HAZARD-B] Phase B 보스 공격 순서·회피 정보 편집', () => {
  let state: EditorState;
  let layout: EditorLayout;

  beforeEach(() => {
    state = new EditorState();
    layout = new EditorLayout(state);
  });

  describe('1. 초기 상태 및 공격-회피 자동 매핑 검증', () => {
    it('초기 Phase B 보스 공격 순서 목록이 기본 3종 패턴으로 생성된다', () => {
      const attacks = state.getPhaseBHazardAttacks();
      expect(attacks).toHaveLength(3);
      expect(attacks[0].attackType).toBe('dual_slam');
      expect(attacks[1].attackType).toBe('alternating_stomp_left');
      expect(attacks[2].attackType).toBe('alternating_stomp_right');
    });

    it('각 공격 종류에 대해 요구 회피 동작이 자동으로 1:1 도출된다', () => {
      const attacks = state.getPhaseBHazardAttacks();
      expect(attacks[0].requiredAction).toBe('jump');
      expect(attacks[1].requiredAction).toBe('left_step');
      expect(attacks[2].requiredAction).toBe('right_step');

      expect(state.getRequiredActionForPhaseBAttack('dual_slam')).toBe('jump');
      expect(state.getRequiredActionForPhaseBAttack('alternating_stomp_left')).toBe('left_step');
      expect(state.getRequiredActionForPhaseBAttack('alternating_stomp_right')).toBe('right_step');
    });

    it('지원되는 공격 3종 목록을 올바르게 제공한다', () => {
      const supported = state.getSupportedPhaseBAttacks();
      expect(supported).toEqual(PHASE_B_PUBLISHABLE_ATTACKS);
    });
  });

  describe('2. 공격 목록 조작 (추가, 제거, 이동, 복제, 설정)', () => {
    it('공격 추가(addPhaseBHazardAttack) 시 지정된 위치 또는 끝에 올바르게 추가된다', () => {
      const addRes = state.addPhaseBHazardAttack('dual_slam');
      expect(addRes.success).toBe(true);
      const attacks = state.getPhaseBHazardAttacks();
      expect(attacks).toHaveLength(4);
      expect(attacks[3].attackType).toBe('dual_slam');
      expect(attacks[3].requiredAction).toBe('jump');

      // 특정 인덱스(0번)에 삽입
      const insertRes = state.addPhaseBHazardAttack('alternating_stomp_left', 0);
      expect(insertRes.success).toBe(true);
      const updatedAttacks = state.getPhaseBHazardAttacks();
      expect(updatedAttacks).toHaveLength(5);
      expect(updatedAttacks[0].attackType).toBe('alternating_stomp_left');
      expect(updatedAttacks[0].requiredAction).toBe('left_step');
    });

    it('공격 제거(removePhaseBHazardAttack) 시 올바르게 삭제된다', () => {
      const removeRes = state.removePhaseBHazardAttack(1);
      expect(removeRes.success).toBe(true);
      const attacks = state.getPhaseBHazardAttacks();
      expect(attacks).toHaveLength(2);
      expect(attacks[0].attackType).toBe('dual_slam');
      expect(attacks[1].attackType).toBe('alternating_stomp_right');
    });

    it('유효하지 않은 인덱스 제거 시 실패를 반환한다', () => {
      const failResNegative = state.removePhaseBHazardAttack(-1);
      expect(failResNegative.success).toBe(false);
      const failResOverflow = state.removePhaseBHazardAttack(99);
      expect(failResOverflow.success).toBe(false);
    });

    it('공격 순서 이동(movePhaseBHazardAttack)이 정확히 동작한다', () => {
      // 초기 [0: dual_slam, 1: alternating_stomp_left, 2: alternating_stomp_right]
      // 0번(dual_slam)을 2번 위치로 이동
      const moveRes = state.movePhaseBHazardAttack(0, 2);
      expect(moveRes.success).toBe(true);
      const attacks = state.getPhaseBHazardAttacks();
      expect(attacks[0].attackType).toBe('alternating_stomp_left');
      expect(attacks[1].attackType).toBe('alternating_stomp_right');
      expect(attacks[2].attackType).toBe('dual_slam');
    });

    it('공격 복제(duplicatePhaseBHazardAttack) 시 다음 위치에 고유 ID로 복제된다', () => {
      const dupeRes = state.duplicatePhaseBHazardAttack(0);
      expect(dupeRes.success).toBe(true);
      const attacks = state.getPhaseBHazardAttacks();
      expect(attacks).toHaveLength(4);
      expect(attacks[0].attackType).toBe('dual_slam');
      expect(attacks[1].attackType).toBe('dual_slam');
      expect(attacks[0].id).not.toBe(attacks[1].id);
    });

    it('전체 공격 목록 설정(setPhaseBHazardAttacks)이 올바르게 동작한다', () => {
      const newSequence: PhaseBPublishableAttack[] = [
        'alternating_stomp_right',
        'dual_slam',
        'dual_slam',
      ];
      const setRes = state.setPhaseBHazardAttacks(newSequence);
      expect(setRes.success).toBe(true);
      const attacks = state.getPhaseBHazardAttacks();
      expect(attacks).toHaveLength(3);
      expect(attacks[0].attackType).toBe('alternating_stomp_right');
      expect(attacks[1].attackType).toBe('dual_slam');
      expect(attacks[2].attackType).toBe('dual_slam');
    });
  });

  describe('3. 미지원 공격 차단 및 임의 회피 불가 검증', () => {
    it('미지원 공격 추가 시 거부된다', () => {
      const invalidRes = state.addPhaseBHazardAttack('meteor_strike' as any);
      expect(invalidRes.success).toBe(false);
      expect(invalidRes.error).toMatch(/미지원|유효하지 않은/i);
    });

    it('setPhaseBHazardAttacks에 미지원 공격이 포함되면 전체 변경이 거부된다', () => {
      const invalidSeq: any[] = ['dual_slam', 'unknown_attack'];
      const setRes = state.setPhaseBHazardAttacks(invalidSeq);
      expect(setRes.success).toBe(false);
      // 기존 목록 보존
      expect(state.getPhaseBHazardAttacks()).toHaveLength(3);
    });

    it('임의 회피 동작 입력은 불가하며 항상 공격 종류에 의해 강제 결정된다', () => {
      // 공격과 회피가 불일치하는 객체를 강제로 주입하려 해도 매핑에 맞게 정정되거나 거부된다
      const mismatchSeq: any[] = [
        { attackType: 'dual_slam', requiredAction: 'left_step' }, // dual_slam requires jump
      ];
      const setRes = state.setPhaseBHazardAttacks(mismatchSeq);
      if (setRes.success) {
        // 성공하더라도 requiredAction은 canonical jump 여야 함
        expect(state.getPhaseBHazardAttacks()[0].requiredAction).toBe('jump');
      } else {
        expect(setRes.success).toBe(false);
      }
    });
  });

  describe('4. 빈 공격 목록(0개) 검증 및 게시 차단 진단', () => {
    it('공격을 모두 삭제하여 0개가 되면 validatePhaseBHazard()가 실패 및 진단을 보고한다', () => {
      state.removePhaseBHazardAttack(0);
      state.removePhaseBHazardAttack(0);
      state.removePhaseBHazardAttack(0);
      expect(state.getPhaseBHazardAttacks()).toHaveLength(0);

      const val = state.validatePhaseBHazard();
      expect(val.valid).toBe(false);
      expect(val.diagnosticCode).toBe('empty-hazard-sequence');
      expect(val.errors.length).toBeGreaterThan(0);
    });

    it('빈 공격 목록 상태에서 toEditorProject() 출력 시에도 진단 또는 빈 이벤트가 기록된다', () => {
      state.setPhaseBHazardAttacks([]);
      const project = state.toEditorProject();
      const hazardSeq = project.sequences.find(
        (s) => s.phase === 'phaseB' && s.kind === 'hazard'
      );
      expect(hazardSeq).toBeDefined();
      expect(hazardSeq?.events).toHaveLength(0);
    });
  });

  describe('5. 전투 수치 읽기 전용 잠금(Locked) 검증', () => {
    it('전투 수치(주기, 전조, 지속시간, 데미지, 광폭화, 군단손실)가 잠금 상태로 제공된다', () => {
      const lockedConfig = state.getPhaseBHazardLockedConfig();
      expect(lockedConfig.attackInterval).toBe(5.0);
      expect(lockedConfig.warningDuration).toBe(1.5);
      expect(lockedConfig.activeDuration).toBe(1.0);
      expect(lockedConfig.damage).toBe(15);
      expect(lockedConfig.enrageHpRatio).toBe(0.3);
      expect(lockedConfig.enrageSpeedMultiplier).toBe(1.5);
      expect(lockedConfig.minionCasualtyCount).toBe(1);
    });

    it('전투 수치는 불변 객체 또는 복사본으로 반환되어 외부 변경이 내부 상태에 영향을 주지 않는다', () => {
      const lockedConfig = state.getPhaseBHazardLockedConfig();
      (lockedConfig as any).damage = 999;
      expect(state.getPhaseBHazardLockedConfig().damage).toBe(15);
    });
  });

  describe('6. 타 레이어 데이터(피버 노트, 모션 가이드, Phase A 장판, 별 수집) 격리 검증', () => {
    it('Phase B 보스 공격 순서를 변경해도 피버 노트(8슬롯)는 전혀 변경되지 않는다', () => {
      const feverBefore = state.getFeverSlots();
      state.addPhaseBHazardAttack('dual_slam');
      state.removePhaseBHazardAttack(0);
      const feverAfter = state.getFeverSlots();

      expect(feverAfter).toEqual(feverBefore);
      expect(feverAfter).toHaveLength(8);
    });

    it('Phase B 보스 공격 순서를 변경해도 Phase A 장판 패턴은 전혀 변경되지 않는다', () => {
      const hazardABefore = state.getPhaseAHazardPattern();
      state.setPhaseBHazardAttacks(['alternating_stomp_left']);
      expect(state.getPhaseAHazardPattern()).toBe(hazardABefore);
    });

    it('피버 노트나 Phase A 장판을 변경해도 Phase B 보스 공격 순서는 영향받지 않는다', () => {
      const attacksBefore = state.getPhaseBHazardAttacks();
      state.setPhaseAHazardPattern('jump');
      state.setFeverFormBuffer(0, { part: 'foot', zoneId: 10 });
      state.applyFeverFormBuffer(0);

      const attacksAfter = state.getPhaseBHazardAttacks();
      expect(attacksAfter).toEqual(attacksBefore);
    });
  });

  describe('7. 직렬화/역직렬화 및 프로젝트 저장 무결성', () => {
    it('toEditorProject() 시 Phase B hazard 시퀀스 및 바인딩이 포함된다', () => {
      state.setPhaseBHazardAttacks(['dual_slam', 'alternating_stomp_left']);
      const project = state.toEditorProject();

      const seq = project.sequences.find((s) => s.phase === 'phaseB' && s.kind === 'hazard');
      expect(seq).toBeDefined();
      expect(seq?.events).toHaveLength(2);
      expect((seq?.events[0] as any).attackType).toBe('dual_slam');
      expect((seq?.events[1] as any).attackType).toBe('alternating_stomp_left');

      const binding = project.bindings.find((b) => b.phase === 'phaseB' && b.role === 'hazard');
      expect(binding).toBeDefined();
      expect(binding?.sequenceId).toBe(seq?.id);
    });

    it('applyProject() 역직렬화 시 Phase B hazard 공격 목록이 정확히 복원된다', () => {
      state.setPhaseBHazardAttacks([
        'alternating_stomp_right',
        'alternating_stomp_left',
        'dual_slam',
      ]);
      const project = state.toEditorProject();

      const newState = new EditorState();
      newState.applyProject(project);

      const restored = newState.getPhaseBHazardAttacks();
      expect(restored).toHaveLength(3);
      expect(restored[0].attackType).toBe('alternating_stomp_right');
      expect(restored[0].requiredAction).toBe('right_step');
      expect(restored[1].attackType).toBe('alternating_stomp_left');
      expect(restored[1].requiredAction).toBe('left_step');
      expect(restored[2].attackType).toBe('dual_slam');
      expect(restored[2].requiredAction).toBe('jump');
    });

    it('JSON 왕복(Serialize -> JSON -> Parse -> applyProject) 후 완벽히 일치한다', () => {
      state.setPhaseBHazardAttacks(['dual_slam', 'dual_slam', 'alternating_stomp_left']);
      const project = state.toEditorProject();
      const jsonStr = JSON.stringify(project);
      const parsedProject = JSON.parse(jsonStr);

      const roundtripState = new EditorState();
      roundtripState.applyProject(parsedProject);

      const attacks = roundtripState.getPhaseBHazardAttacks();
      expect(attacks).toHaveLength(3);
      expect(attacks[0].attackType).toBe('dual_slam');
      expect(attacks[1].attackType).toBe('dual_slam');
      expect(attacks[2].attackType).toBe('alternating_stomp_left');
    });
  });

  describe('8. Undo / Redo 무결성 검증', () => {
    it('공격 추가 및 삭제 시 CommandManager를 통해 실행 취소와 재실행이 보장된다', () => {
      const baseState = new EditorState();
      const commandManager = new ProjectCommandManager(baseState.toEditorProject());
      const undoableState = new EditorState(undefined, undefined, commandManager);

      const initialLength = undoableState.getPhaseBHazardAttacks().length; // 3
      undoableState.addPhaseBHazardAttack('dual_slam');
      expect(undoableState.getPhaseBHazardAttacks()).toHaveLength(initialLength + 1);

      // Undo
      commandManager.undo();
      expect(undoableState.getPhaseBHazardAttacks()).toHaveLength(initialLength);

      // Redo
      commandManager.redo();
      expect(undoableState.getPhaseBHazardAttacks()).toHaveLength(initialLength + 1);
    });
  });

  describe('9. EditorLayout UI 및 페이즈 셀렉터 렌더링 검증', () => {
    it('상단 페이즈 셀렉터에 BOSS_HAZARD 옵션이 포함된다', () => {
      const headerHTML = layout.renderHeaderHTML();
      expect(headerHTML).toContain('BOSS_HAZARD');
      expect(headerHTML).toContain('보스 장판');
    });

    it('BOSS_HAZARD 페이즈 선택 시 사이드바에 전용 편집 패널 및 공격 목록/액션 버튼이 렌더링된다', () => {
      state.setSelectedPhase('BOSS_HAZARD');
      const sidebarHTML = layout.renderSidebarHTML();

      expect(sidebarHTML).toContain('boss-hazard-editor-section');
      expect(sidebarHTML).toContain('양손 내려치기');
      expect(sidebarHTML).toContain('JUMP');
      expect(sidebarHTML).toContain('btn-add-boss-hazard');
      expect(sidebarHTML).toContain('btn-move-up-boss-hazard');
      expect(sidebarHTML).toContain('btn-move-down-boss-hazard');
      expect(sidebarHTML).toContain('btn-duplicate-boss-hazard');
      expect(sidebarHTML).toContain('btn-delete-boss-hazard');
      expect(sidebarHTML).toContain('전투 수치 잠금');
      expect(sidebarHTML).toContain('5.0초');
    });

    it('공격 목록이 비어 있는 경우 사이드바에 경고 안내가 표시된다', () => {
      state.setSelectedPhase('BOSS_HAZARD');
      state.setPhaseBHazardAttacks([]);
      const sidebarHTML = layout.renderSidebarHTML();

      expect(sidebarHTML).toContain('등록된 공격 패턴이 없습니다');
    });
  });
});
