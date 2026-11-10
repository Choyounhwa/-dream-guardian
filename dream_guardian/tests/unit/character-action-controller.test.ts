import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { ClipPlayer } from '../../src/skeleton/anim/ClipPlayer.js';
import {
  CharacterActionController,
  type EventActionMap,
  RABBIT_ACTION_MAP,
  BEAR_ACTION_MAP,
} from '../../src/skeleton/anim/CharacterActionController.js';
import type { AnimationClip } from '../../src/types/animation-clip.js';

describe('CharacterActionController (FEAT-ANIM-002 / Issue #688)', () => {
  let eventBus: EventBus;
  let clipPlayer: ClipPlayer;

  const createClip = (id: string, duration = 1.0, loop = false): AnimationClip => ({
    id,
    name: `Clip ${id}`,
    duration,
    loop,
    tracks: {
      arm_right: [
        { t: 0, angle: 0 },
        { t: duration, angle: Math.PI / 2 },
      ],
    },
  });

  const clipsRecord: Record<string, AnimationClip> = {
    rabbit_ear_wiggle: createClip('rabbit_ear_wiggle', 1.0),
    rabbit_ear_droop: createClip('rabbit_ear_droop', 1.0),
    rabbit_spin: createClip('rabbit_spin', 2.0),
    rabbit_flinch: createClip('rabbit_flinch', 0.5),
    rabbit_victory_hop: createClip('rabbit_victory_hop', 2.5),
    bear_belly_drum: createClip('bear_belly_drum', 1.2),
    bear_roar: createClip('bear_roar', 1.8),
    generic_idle: createClip('generic_idle', 2.0, true),
    generic_cheer1: createClip('generic_cheer1', 1.0),
    generic_cheer2: createClip('generic_cheer2', 1.0),
  };

  beforeEach(() => {
    eventBus = new EventBus();
    clipPlayer = new ClipPlayer();
  });

  describe('초기화 및 클립/규칙 등록', () => {
    it('Map 또는 Record 형태의 클립 목록을 올바르게 등록한다', () => {
      const controllerFromRecord = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
      );
      expect(controllerFromRecord.getClips().size).toBe(Object.keys(clipsRecord).length);
      expect(controllerFromRecord.getClip('rabbit_ear_wiggle')).toBeDefined();

      const clipMap = new Map<string, AnimationClip>(Object.entries(clipsRecord));
      const controllerFromMap = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipMap,
      );
      expect(controllerFromMap.getClips().size).toBe(clipMap.size);
    });

    it('생성 시 전달된 EventActionMap에 따라 EventBus 리스너를 자동 등록한다', () => {
      const actionMap: EventActionMap = {
        'answer:correct': { clipId: 'rabbit_ear_wiggle', priority: 1 },
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      expect(controller.hasRule('answer:correct')).toBe(true);
      expect(clipPlayer.isPlaying).toBe(false);

      // 이벤트 발행
      eventBus.emit('answer:correct', { mana: 25, combo: 1 });

      // ClipPlayer가 재생 중이어야 함
      expect(clipPlayer.isPlaying).toBe(true);
      expect(clipPlayer.currentClip?.id).toBe('rabbit_ear_wiggle');
      expect(controller.currentPriority).toBe(1);
      expect(controller.currentAction).toBe('answer:correct');
    });

    it('문자열 또는 문자열 배열 축약형 규칙을 기본 priority 0으로 자동 정규화한다', () => {
      const actionMap: EventActionMap = {
        'answer:wrong': 'rabbit_ear_droop',
        'guardian:cast': ['generic_cheer1', 'generic_cheer2'],
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      const rule1 = controller.getRule('answer:wrong');
      expect(rule1?.clipId).toBe('rabbit_ear_droop');
      expect(rule1?.priority).toBe(0);

      const rule2 = controller.getRule('guardian:cast');
      expect(rule2?.clipId).toEqual(['generic_cheer1', 'generic_cheer2']);
      expect(rule2?.priority).toBe(0);
    });
  });

  describe('우선순위(Priority) 기반 선점(Preemption)', () => {
    it('재생 중인 액션보다 낮은 우선순위의 이벤트는 무시된다', () => {
      const actionMap: EventActionMap = {
        'player:hurt': { clipId: 'rabbit_flinch', priority: 3 }, // 고우선
        'answer:correct': { clipId: 'rabbit_ear_wiggle', priority: 1 }, // 저우선
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      // 고우선 액션 발생
      eventBus.emit('player:hurt', { hp: 50 });
      expect(clipPlayer.currentClip?.id).toBe('rabbit_flinch');
      expect(controller.currentPriority).toBe(3);

      // 저우선 액션 발생 시 무시되어야 함
      eventBus.emit('answer:correct', { mana: 25, combo: 1 });
      expect(clipPlayer.currentClip?.id).toBe('rabbit_flinch');
      expect(controller.currentPriority).toBe(3);
    });

    it('재생 중인 액션보다 높거나 같은 우선순위의 이벤트는 즉시 선점(preempt)한다', () => {
      const actionMap: EventActionMap = {
        'answer:correct': { clipId: 'rabbit_ear_wiggle', priority: 1 },
        'guardian:cast': { clipId: 'rabbit_spin', priority: 2 },
        'boss:defeated': { clipId: 'rabbit_victory_hop', priority: 2 },
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      // 1. 저우선 시작
      eventBus.emit('answer:correct', { mana: 25, combo: 1 });
      expect(clipPlayer.currentClip?.id).toBe('rabbit_ear_wiggle');
      expect(controller.currentPriority).toBe(1);

      // 2. 더 높은 우선순위 선점
      eventBus.emit('guardian:cast', { damage: 4 });
      expect(clipPlayer.currentClip?.id).toBe('rabbit_spin');
      expect(controller.currentPriority).toBe(2);

      // 3. 같은 우선순위 선점
      eventBus.emit('boss:defeated', { chapter: 1 });
      expect(clipPlayer.currentClip?.id).toBe('rabbit_victory_hop');
      expect(controller.currentPriority).toBe(2);
    });

    it('클립 재생이 완료되면 우선순위가 초기화되어 낮은 우선순위 액션도 다시 재생된다', () => {
      const actionMap: EventActionMap = {
        'player:hurt': { clipId: 'rabbit_flinch', priority: 3 }, // duration 0.5s
        'answer:correct': { clipId: 'rabbit_ear_wiggle', priority: 1 },
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      // 고우선 재생 시작
      eventBus.emit('player:hurt', { hp: 50 });
      expect(clipPlayer.currentClip?.id).toBe('rabbit_flinch');

      // 0.6초 경과 -> 재생 종료
      controller.update(0.6);
      expect(clipPlayer.isPlaying).toBe(false);
      expect(controller.currentPriority).toBe(-Infinity);

      // 이제 저우선 재생 가능
      eventBus.emit('answer:correct', { mana: 25, combo: 1 });
      expect(clipPlayer.isPlaying).toBe(true);
      expect(clipPlayer.currentClip?.id).toBe('rabbit_ear_wiggle');
      expect(controller.currentPriority).toBe(1);
    });
  });

  describe('쿨다운(Cooldown) 제어', () => {
    it('쿨다운 중인 규칙의 이벤트는 무시된다', () => {
      const actionMap: EventActionMap = {
        'answer:correct': { clipId: 'rabbit_ear_wiggle', priority: 1, cooldown: 1.0 },
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      // 첫 번째 트리거 -> 성공 및 쿨다운 1.0초 설정
      eventBus.emit('answer:correct', { mana: 25, combo: 1 });
      expect(controller.getCooldown('answer:correct')).toBe(1.0);

      // 클립 종료 강제
      clipPlayer.stop();
      expect(clipPlayer.isPlaying).toBe(false);

      // 쿨다운 0.4초 소진 (0.6초 남음)
      controller.update(0.4);
      expect(controller.getCooldown('answer:correct')).toBeCloseTo(0.6, 2);

      // 다시 이벤트 발생 시 쿨다운 중이므로 무시
      const triggered = controller.trigger('answer:correct');
      expect(triggered).toBe(false);
      expect(clipPlayer.isPlaying).toBe(false);
    });

    it('쿨다운 시간이 모두 경과하면 다시 트리거될 수 있다', () => {
      const actionMap: EventActionMap = {
        'answer:correct': { clipId: 'rabbit_ear_wiggle', priority: 1, cooldown: 1.0 },
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      eventBus.emit('answer:correct', { mana: 25, combo: 1 });
      expect(controller.getCooldown('answer:correct')).toBe(1.0);

      // 1.1초 경과 -> 쿨다운 해제
      controller.update(1.1);
      expect(controller.getCooldown('answer:correct')).toBe(0);

      // 재트리거 성공
      const triggered = controller.trigger('answer:correct');
      expect(triggered).toBe(true);
      expect(clipPlayer.isPlaying).toBe(true);
    });
  });

  describe('복수 클립 배열(string[]) 및 옵션 전달', () => {
    it('clipId가 배열일 때 clipIndex 옵션으로 지정한 인덱스의 클립을 재생한다', () => {
      const actionMap: EventActionMap = {
        'guardian:cast': {
          clipId: ['generic_cheer1', 'generic_cheer2'],
          priority: 2,
        },
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      controller.trigger('guardian:cast', { clipIndex: 1 });
      expect(clipPlayer.currentClip?.id).toBe('generic_cheer2');
    });

    it('boneMask 및 fadeIn/fadeOutDuration 옵션이 ClipPlayer.play로 정상 전달된다', () => {
      const actionMap: EventActionMap = {
        'custom:partial': {
          clipId: 'rabbit_ear_wiggle',
          priority: 1,
          boneMask: ['head', 'neck'],
          fadeInDuration: 0.2,
          fadeOutDuration: 0.3,
          weight: 0.8,
        },
      };

      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        actionMap,
      );

      controller.trigger('custom:partial');
      expect(clipPlayer.isPlaying).toBe(true);
      expect(clipPlayer.getBoneMask()).toEqual(new Set(['head', 'neck']));
      expect(clipPlayer.getCurrentWeight()).toBeCloseTo(0, 2); // fadeIn 중이므로 0에서 시작
    });
  });

  describe('직접 트리거(trigger) 및 수동 제어', () => {
    it('등록되지 않은 클립 ID도 clips 목록에 존재하면 직접 트리거할 수 있다', () => {
      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
      );

      const triggered = controller.trigger('bear_belly_drum');
      expect(triggered).toBe(true);
      expect(clipPlayer.currentClip?.id).toBe('bear_belly_drum');
      expect(controller.currentPriority).toBe(0);
    });

    it('존재하지 않는 이벤트나 클립을 트리거하면 false를 반환한다', () => {
      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
      );

      const triggered = controller.trigger('non_existent_action');
      expect(triggered).toBe(false);
      expect(clipPlayer.isPlaying).toBe(false);
    });

    it('stop() 호출 시 재생 중인 클립과 우선순위를 즉시 정지/초기화한다', () => {
      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        { 'player:hurt': { clipId: 'rabbit_flinch', priority: 5 } },
      );

      controller.trigger('player:hurt');
      expect(clipPlayer.isPlaying).toBe(true);
      expect(controller.currentPriority).toBe(5);

      controller.stop();
      expect(clipPlayer.isPlaying).toBe(false);
      expect(controller.currentPriority).toBe(-Infinity);
      expect(controller.currentAction).toBeNull();
    });
  });

  describe('동적 규칙 등록/제거 및 프리셋(RABBIT / BEAR)', () => {
    it('registerRule 및 removeRule을 통해 규칙을 동적으로 관리한다', () => {
      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
      );

      expect(controller.hasRule('boss:defeated')).toBe(false);

      controller.registerRule('boss:defeated', {
        clipId: 'rabbit_victory_hop',
        priority: 4,
      });
      expect(controller.hasRule('boss:defeated')).toBe(true);

      eventBus.emit('boss:defeated', { chapter: 1 });
      expect(clipPlayer.currentClip?.id).toBe('rabbit_victory_hop');

      controller.removeRule('boss:defeated');
      expect(controller.hasRule('boss:defeated')).toBe(false);

      clipPlayer.stop();
      eventBus.emit('boss:defeated', { chapter: 1 });
      expect(clipPlayer.isPlaying).toBe(false);
    });

    it('RABBIT_ACTION_MAP 및 BEAR_ACTION_MAP 프리셋이 올바르게 작동한다', () => {
      const rabbitController = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        RABBIT_ACTION_MAP,
      );

      // 토끼 정답 트리거
      eventBus.emit('answer:correct', { mana: 25, combo: 1 });
      expect(clipPlayer.currentClip?.id).toBe('rabbit_ear_wiggle');
      rabbitController.dispose();

      // 곰 컨트롤러 적용
      const bearController = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        BEAR_ACTION_MAP,
      );

      // 곰 정답 트리거
      eventBus.emit('answer:correct', { mana: 25, combo: 1 });
      expect(clipPlayer.currentClip?.id).toBe('bear_belly_drum');
      bearController.dispose();
    });
  });

  describe('메모리 누수 방지 및 dispose()', () => {
    it('dispose() 호출 시 모든 EventBus 리스너가 안전하게 해제된다', () => {
      const controller = new CharacterActionController(
        eventBus,
        clipPlayer,
        clipsRecord,
        {
          'answer:correct': { clipId: 'rabbit_ear_wiggle', priority: 1 },
          'boss:defeated': { clipId: 'rabbit_victory_hop', priority: 4 },
        },
      );

      controller.dispose();
      expect(controller.isDisposed).toBe(true);

      // dispose 후 이벤트 발행해도 재생되지 않음
      eventBus.emit('answer:correct', { mana: 25, combo: 1 });
      eventBus.emit('boss:defeated', { chapter: 1 });
      expect(clipPlayer.isPlaying).toBe(false);
    });
  });
});
