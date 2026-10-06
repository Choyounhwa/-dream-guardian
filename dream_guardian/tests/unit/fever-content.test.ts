import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { BossController } from '../../src/game/BossController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import {
  createSessionStageSnapshot,
  type SessionStageBundle,
} from '../../src/game/SessionContent.js';
import type { CompiledFeverNote } from '../../src/data/PublishedContentPack.js';

function createMockFeverNotes(count = 8): CompiledFeverNote[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `custom_fever_${idx}`,
    landingTick: (idx + 1) * 480,
    target: {
      type: idx === 4 ? 'foot' : 'cursor',
      part: idx === 4 ? 'hip' : idx % 2 === 0 ? 'leftHand' : 'rightHand',
      foot: idx === 4 ? 'leftFoot' : undefined,
      zoneId: idx === 4 ? 10 : idx % 2 === 0 ? 4 : 5,
      instrument: idx === 4 ? 'foot' : 'hand',
    },
  }));
}

function createMockBundle(params?: {
  isBuiltin?: boolean;
  feverNotes?: CompiledFeverNote[];
}): SessionStageBundle {
  const isBuiltin = params?.isBuiltin ?? false;
  const feverNotes = params?.feverNotes ?? createMockFeverNotes(8);

  return createSessionStageSnapshot({
    stageId: 'stage_fever_test',
    sourcePackHash: 'hash_source_123',
    rulesetId: 'ruleset_default',
    rulesetHash: 'hash_ruleset_456',
    runtimeContractVersion: '1.0.0',
    bpm: 120,
    beatsPerBar: 4,
    isBuiltin,
    isFallback: false,
    seed: 777,
    phaseA: {
      starNotes: [],
      hazard: null,
      motionGuide: [],
    },
    phaseB: {
      feverNotes,
      hazards: [],
      motionGuide: [],
    },
    bindings: [
      {
        chapterId: 'ch1',
        subLevelId: '1-1',
        phase: 'phaseB',
        role: 'STAR_COLLECT',
        targetId: 'fever_binding',
      },
    ],
  });
}

describe('[Issue #399 / GAME-FEVER-CONTENT] 피버 시퀀스 공급·반복 ID·마지막 판정 수명 연결', () => {
  let bossController: BossController;
  let battleState: BattleState;
  let stateMachine: StateMachine;
  let scheduler: StarNoteScheduler;

  beforeEach(() => {
    bossController = new BossController(1); // Normal boss, HP = 10
    battleState = new BattleState(100);
    stateMachine = new StateMachine('BOSS_CLIMAX');
    scheduler = new StarNoteScheduler({ secondsPerBeat: 0.5 });
  });

  describe('1. SessionStageBundle의 Phase B 피버 노트 Keynote 생성 및 loop executionId 공급', () => {
    it('커스텀 feverNotes가 있을 때 landingTick(480틱 단위)을 beat로 변환하고 루프별 고유 ID를 부여한다', () => {
      const bundle = createMockBundle({ isBuiltin: false });

      const loop0Notes = bundle.getPhaseBFeverKeynotes(0);
      expect(loop0Notes).toHaveLength(8);

      // landingTick 480 -> beat 1, 960 -> beat 2, ...
      for (let i = 0; i < 8; i++) {
        expect(loop0Notes[i].beat).toBe(i + 1);
        const expectedId = bundle.getPhaseBNoteExecutionId(0, i);
        expect(loop0Notes[i].patternId).toBe(expectedId);
        expect((loop0Notes[i] as any).id).toBe(expectedId);
      }

      // 발(foot) 타겟 매핑 확인
      expect(loop0Notes[4].instrument).toBe('foot');
      expect(loop0Notes[4].part).toBe('hip');
      expect(loop0Notes[4].zoneId).toBe(10);

      // loop 1 생성 시 ID가 완전히 분리됨
      const loop1Notes = bundle.getPhaseBFeverKeynotes(1);
      expect(loop1Notes).toHaveLength(8);
      for (let i = 0; i < 8; i++) {
        const expectedId1 = bundle.getPhaseBNoteExecutionId(1, i);
        expect(loop1Notes[i].patternId).toBe(expectedId1);
        expect(loop1Notes[i].patternId).not.toBe(loop0Notes[i].patternId);
      }
    });

    it('커스텀 feverNotes가 비어있거나 isBuiltin인 경우 기본 패턴으로 안전하게 fallback하며 고유 ID를 부여한다', () => {
      // 1) feverNotes가 빈 배열인 경우
      const emptyBundle = createMockBundle({ isBuiltin: false, feverNotes: [] });
      const fallbackNotes0 = emptyBundle.getPhaseBFeverKeynotes(0);
      expect(fallbackNotes0).toHaveLength(8);
      expect(fallbackNotes0[0].patternId).toBe(emptyBundle.getPhaseBNoteExecutionId(0, 0));

      // 2) isBuiltin: true 인 경우
      const builtinBundle = createMockBundle({ isBuiltin: true });
      const builtinNotes0 = builtinBundle.getPhaseBFeverKeynotes(0);
      expect(builtinNotes0).toHaveLength(8);
      expect(builtinNotes0[0].patternId).toBe(builtinBundle.getPhaseBNoteExecutionId(0, 0));

      const builtinNotes1 = builtinBundle.getPhaseBFeverKeynotes(1);
      expect(builtinNotes1[0].patternId).toBe(builtinBundle.getPhaseBNoteExecutionId(1, 0));
      expect(builtinNotes1[0].patternId).not.toBe(builtinNotes0[0].patternId);
    });
  });

  describe('2. BossFeverController에 stageBundle 주입 및 루프 반복 시퀀스 공급', () => {
    it('setStageBundle 또는 생성자 옵션으로 번들을 주입하여 루프마다 고유 executionId 시퀀스가 스케줄러에 전달된다', () => {
      const bundle = createMockBundle();
      const controller = new BossFeverController({
        bossController,
        battleState,
        stateMachine,
        scheduler,
        stageBundle: bundle,
        secondsPerBeat: 0.5,
      });

      controller.start(0);

      // 루프 0 시퀀스 생성 확인
      expect(controller.sequenceCount).toBe(1);
      const scheduledNotes = scheduler.notes;
      expect(scheduledNotes).toHaveLength(8);

      for (let i = 0; i < 8; i++) {
        const expectedId = bundle.getPhaseBNoteExecutionId(0, i);
        expect(scheduledNotes[i].id).toBe(expectedId);
      }
    });
  });

  describe('3. 반복 시퀀스 간 ID 충돌 차단 및 중복 보상 없는 단일 보상 검증', () => {
    it('동일 루프 내 동일 노트 중복 타격은 차단되고, 다음 루프의 동일 슬롯 노트는 고유 ID로 정상 피해가 적용된다', () => {
      const bundle = createMockBundle();
      const controller = new BossFeverController({
        bossController,
        battleState,
        stateMachine,
        scheduler,
        stageBundle: bundle,
        secondsPerBeat: 0.5,
      });

      controller.start(0);

      const loop0Note0Id = bundle.getPhaseBNoteExecutionId(0, 0);

      // 1) 루프 0의 첫 번째 노트 타격
      const dmg1 = controller.recordRating('Perfect', loop0Note0Id);
      expect(dmg1).toBeGreaterThan(0);
      expect(controller.feverCombo).toBe(1);

      // 2) 동일 노트 ID로 중복 타격 시도 -> 0 피해, 콤보 변화 없음
      const dmgDuplicate = controller.recordRating('Perfect', loop0Note0Id);
      expect(dmgDuplicate).toBe(0);
      expect(controller.feverCombo).toBe(1);

      // 3) 루프 1의 첫 번째 노트 ID로 타격 -> ID가 다르므로 정상 인정
      const loop1Note0Id = bundle.getPhaseBNoteExecutionId(1, 0);
      const dmgLoop1 = controller.recordRating('Perfect', loop1Note0Id);
      expect(dmgLoop1).toBeGreaterThan(0);
      expect(controller.feverCombo).toBe(2);
    });
  });

  describe('4. 마지막 노트 판정 유효창(Late 포함) 완료 수명 및 시퀀스 전이 검증', () => {
    it('8번째 착지 시점에 시퀀스가 즉시 덮어씌워지지 않고, Late 만료 시점(4.40s)까지 마지막 노트 판정이 유지된다', () => {
      const bundle = createMockBundle();
      const controller = new BossFeverController({
        bossController,
        battleState,
        stateMachine,
        scheduler,
        stageBundle: bundle,
        secondsPerBeat: 0.5,
      });

      controller.start(0);

      // 8개 노트 착지 시점: 0.5s, 1.0s, 1.5s, 2.0s, 2.5s, 3.0s, 3.5s, 4.0s
      // 1~7번 노트를 만료로 미스 처리 또는 시간 전진
      // t = 4.0s 시점 (8번째 노트 착지 직후)
      controller.update(4.0);

      // 8번째 노트는 아직 유효(resolved = false, active)해야 하며, 시퀀스 루프가 아직 1이어야 함
      expect(controller.sequenceCount).toBe(1);
      const note8 = scheduler.notes[7];
      expect(note8.resolved).toBe(false);

      // t = 4.2s (착지 +0.20s, Late 판정창 내부)에서 8번째 노트를 Late 또는 Good으로 수집
      scheduler.recordDirectHit(note8.id, 'Late', 4.2);
      expect(note8.resolved).toBe(true);
      expect(scheduler.isAllResolved).toBe(true);

      // 아직 4.40s (4.0s + 0.40s late window) 이전이므로 시퀀스 완료되지 않고 대기
      controller.update(4.3);
      expect(controller.sequenceCount).toBe(1);
      expect(scheduler.isComplete).toBe(false);

      // t = 4.40s 도달 시 마지막 판정 수명이 끝나고 다음 루프(sequenceCount = 2)로 전이
      controller.update(4.41);
      expect(scheduler.isComplete).toBe(false); // 새 시퀀스가 시작되었으므로 false
      expect(controller.sequenceCount).toBe(2);

      // 새로 시작된 2번째 루프의 첫 번째 노트는 loop 1 ID를 가짐
      const newNotes = scheduler.notes;
      expect(newNotes[0].id).toBe(bundle.getPhaseBNoteExecutionId(1, 0));
    });

    it('마지막 노트를 놓친 경우에도 4.40s에 Miss 판정이 확정된 후 다음 루프로 전이되어 누락이 0건이다', () => {
      const bundle = createMockBundle();
      const controller = new BossFeverController({
        bossController,
        battleState,
        stateMachine,
        scheduler,
        stageBundle: bundle,
        secondsPerBeat: 0.5,
      });

      controller.start(0);

      // 4.41s까지 아무 입력 없이 시간만 흐름
      controller.update(4.41);

      // 모든 8개 노트가 미스로 처리되어야 함
      expect(controller.missedStars).toBe(8);
      // 루프 2로 정상 전이됨
      expect(controller.sequenceCount).toBe(2);
    });

    it('StarNoteScheduler의 isAllResolved 및 onAllNotesCompleted 콜백이 정상 작동한다', () => {
      const completedMock = vi.fn();
      scheduler.onAllNotesCompleted(completedMock);

      scheduler.start(0, {
        notes: createMockFeverNotes(8).map((_, idx) => ({
          patternId: `note_${idx}`,
          part: 'leftHand' as const,
          zoneId: 4,
          instrument: 'hand' as const,
          beat: idx + 1,
        })),
        secondsPerBeat: 0.5,
      });

      expect(scheduler.isAllResolved).toBe(false);

      // 모든 노트를 빠르게 판정
      for (let i = 0; i < 8; i++) {
        scheduler.recordDirectHit(scheduler.notes[i].id, 'Perfect', (i + 1) * 0.5);
      }

      // 모든 노트가 해결되었으나 아직 late window(4.40s) 미도달
      expect(scheduler.isAllResolved).toBe(true);
      expect(scheduler.isComplete).toBe(false);
      expect(completedMock).not.toHaveBeenCalled();

      // 4.40s 경과
      scheduler.update(4.41);
      expect(scheduler.isComplete).toBe(true);
      expect(completedMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. reset() 및 세션 격리 검증', () => {
    it('reset() 호출 시 콤보, 데미지, 시퀀스 카운트 및 처리된 노트 ID 집합이 완전히 초기화된다', () => {
      const bundle = createMockBundle();
      const controller = new BossFeverController({
        bossController,
        battleState,
        stateMachine,
        scheduler,
        stageBundle: bundle,
        secondsPerBeat: 0.5,
      });

      controller.start(0);
      const note0Id = bundle.getPhaseBNoteExecutionId(0, 0);
      controller.recordRating('Perfect', note0Id);

      expect(controller.feverCombo).toBe(1);
      expect(controller.totalFeverDamage).toBeGreaterThan(0);
      expect(controller.sequenceCount).toBe(1);

      controller.reset();

      expect(controller.feverCombo).toBe(0);
      expect(controller.totalFeverDamage).toBe(0);
      expect(controller.sequenceCount).toBe(0);
      expect(controller.isActive).toBe(false);

      // 재시작 시 동일 note0Id로 다시 피해를 입힐 수 있어야 함 (processedNoteIds 초기화 증명)
      controller.start(0);
      expect(controller.sequenceCount).toBe(1);
      const dmgAfterReset = controller.recordRating('Perfect', note0Id);
      expect(dmgAfterReset).toBeGreaterThan(0);
      expect(controller.feverCombo).toBe(1);
    });
  });
});
