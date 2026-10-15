import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AssaultRoundController,
} from '../../src/game/assault/AssaultRoundController.js';
import type {
  AssaultEncounterDef,
  AssaultRoundPresentation,
} from '../../src/types/assault.js';

describe('[BOSS-ASSAULT-15 / #517] 투척·생각·교대 라운드 순수 진행 어댑터 (AssaultRoundController)', () => {
  const sample3PairEncounters: readonly AssaultEncounterDef[] = Object.freeze([
    {
      id: 'attack_pair_01',
      kind: 'answer_pair',
      startBeat: 0,
      durationBeats: 4,
      interactionProfileId: 'profile_punch_default',
      visualProfileId: 'bullet_choice_basic',
      pairId: 'pair_01',
      correctAnswerSide: 'left',
    },
    {
      id: 'attack_squat_01',
      kind: 'squat',
      startBeat: 4,
      durationBeats: 4,
      interactionProfileId: 'profile_squat_default',
      visualProfileId: 'hazard_sweep_low',
    },
    {
      id: 'attack_pair_02',
      kind: 'answer_pair',
      startBeat: 8,
      durationBeats: 4,
      interactionProfileId: 'profile_punch_default',
      visualProfileId: 'bullet_choice_basic',
      pairId: 'pair_02',
      correctAnswerSide: 'right',
    },
  ]);

  const defaultQuestion = {
    id: 'q_test_01',
    text: '2 + 3 = ?',
    type: 'addition',
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 순수 어댑터 제약 및 자원 무부작용 검증', () => {
    it('setTimeout, setInterval, rAF, window/document DOM 리스너를 일체 등록하지 않아야 한다', () => {
      const g = globalThis as Record<string, unknown>;
      const originalRaf = g.requestAnimationFrame;
      const originalAddEventListener = g.addEventListener;

      const rafMock = vi.fn();
      const addEventListenerMock = vi.fn();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      g.requestAnimationFrame = rafMock;
      g.addEventListener = addEventListenerMock;

      try {
        const controller = new AssaultRoundController({
          sessionId: 'session_test_01',
          roundId: 'round_test_01',
          question: defaultQuestion,
          plan: { encounters: sample3PairEncounters },
          bpm: 120,
          throwDurationSeconds: 1.0,
        });

        controller.update(0.5);
        controller.update(1.5);
        controller.getPresentationSnapshot();

        expect(rafMock).not.toHaveBeenCalled();
        expect(setIntervalSpy).not.toHaveBeenCalled();
        expect(setTimeoutSpy).not.toHaveBeenCalled();
        expect(addEventListenerMock).not.toHaveBeenCalled();
      } finally {
        if (originalRaf === undefined) {
          delete g.requestAnimationFrame;
        } else {
          g.requestAnimationFrame = originalRaf;
        }
        if (originalAddEventListener === undefined) {
          delete g.addEventListener;
        } else {
          g.addEventListener = originalAddEventListener;
        }
      }
    });

    it('컨트롤러는 플레이어 HP나 보스 HP를 직접 변경하지 않고 정산 명령만 큐에 축적해야 한다', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // controller should not have hp properties or mutate external state
      expect((controller as unknown as Record<string, unknown>).hp).toBeUndefined();
      expect((controller as unknown as Record<string, unknown>).playerHp).toBeUndefined();
      expect((controller as unknown as Record<string, unknown>).bossHp).toBeUndefined();
      expect(controller.getSettlementCommands()).toEqual([]);
    });
  });

  describe('2. 투척(throw_in) 및 생각 시간(question_reading) 생명주기 검증', () => {
    it('readable 시점 직전까지는 throw_in 상태를 유지하고 공격을 일체 진행하지 않아야 한다 (A03)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // 0.0s 시작
      controller.update(0.0);
      expect(controller.phase).toBe('throw_in');
      expect(controller.readingProgress).toBe(0.0);
      expect(controller.currentEncounterIndex).toBe(0);

      // 0.99s (readable 직전)
      controller.update(0.99);
      expect(controller.phase).toBe('throw_in');
      expect(controller.readingProgress).toBe(0.0);
    });

    it('문제 진입 시 TTS 낭독 요청 신호를 정확히 1회만 출력해야 한다 (DEC-B3)', () => {
      const onTtsSpeakMock = vi.fn();
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
        onTtsSpeak: onTtsSpeakMock,
      });

      controller.update(0.0);
      expect(onTtsSpeakMock).toHaveBeenCalledTimes(1);
      expect(onTtsSpeakMock).toHaveBeenCalledWith('2 + 3 = ?');

      // 이후 프레임 진행 중 중복 호출 0회
      controller.update(0.5);
      controller.update(1.0);
      controller.update(2.0);
      expect(onTtsSpeakMock).toHaveBeenCalledTimes(1);
    });

    it('readable(1.0s)부터 최소 8박(4.0s) 동안 question_reading을 유지하고 8박 동일 시점에 조우로 진입해야 한다', () => {
      // 120 BPM -> spb = 0.5s. 8박 = 4.0s.
      // throwDuration = 1.0s. readingMinSeconds default for addition = 3.0s.
      // max(8 * 0.5 = 4.0, 3.0) = 4.0s. Aligned to beat = 4.0s.
      // reading end = 1.0s + 4.0s = 5.0s.
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // 1.0s (readable 시작점)
      controller.update(1.0);
      expect(controller.phase).toBe('question_reading');
      expect(controller.readingProgress).toBeCloseTo(0.0, 5);

      // 3.0s (2.0s 경과, 50% 진행)
      controller.update(3.0);
      expect(controller.phase).toBe('question_reading');
      expect(controller.readingProgress).toBeCloseTo(0.5, 5);

      // 4.99s (8박 직전)
      controller.update(4.99);
      expect(controller.phase).toBe('question_reading');
      expect(controller.readingProgress).toBeLessThan(1.0);

      // 5.0s (8박 동일 시점 -> encounters 진입)
      controller.update(5.0);
      expect(controller.phase).toBe('encounters');
      expect(controller.readingProgress).toBe(1.0);
      expect(controller.currentEncounterIndex).toBe(0);
    });

    it('유형별 readingMinSeconds가 8박보다 길 경우 초 하한이 우선 적용되어야 한다 (DEC-C1, A03)', () => {
      // multiplication: readingMinSeconds = 5.0s (8박=4.0s보다 큼)
      // targetBeats = Math.max(8, Math.ceil(5.0 / 0.5)) = 10 beats = 5.0s.
      // reading end = 1.0s + 5.0s = 6.0s.
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: { id: 'q_mult', text: '7 * 8 = ?', type: 'multiplication' },
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
        config: {
          readingMinSeconds: {
            addition: 3.0,
            subtraction: 3.0,
            multiplication: 5.0,
            division: 4.0,
            default: 3.5,
          },
        },
      });

      controller.update(1.0);
      expect(controller.phase).toBe('question_reading');

      // 5.0s (8박 시점: throw 1.0s + 4.0s = 5.0s) -> 아직 5.0s 미달이므로 reading 유지!
      controller.update(5.0);
      expect(controller.phase).toBe('question_reading');
      expect(controller.readingProgress).toBeCloseTo(4.0 / 5.0, 5);

      // 6.0s (throw 1.0s + 5.0s) -> encounters 진입
      controller.update(6.0);
      expect(controller.phase).toBe('encounters');
      expect(controller.readingProgress).toBe(1.0);
    });

    it('readingMinSeconds가 박자 배수가 아닐 경우 다음 박자 경계로 정렬되어야 한다 (DEC-B3, DOC-14 §5.1)', () => {
      // 120 BPM -> spb = 0.5s.
      // readingMinSeconds = 4.2s (8.4 beats).
      // ceil(4.2 / 0.5) = 9 beats -> 4.5s.
      // reading end = 1.0s + 4.5s = 5.5s.
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: { id: 'q_custom', text: '12 / 3 = ?', type: 'division' },
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
        config: {
          readingMinSeconds: {
            addition: 3.0,
            subtraction: 3.0,
            multiplication: 4.0,
            division: 4.2,
            default: 3.5,
          },
        },
      });

      controller.update(1.0);
      expect(controller.phase).toBe('question_reading');

      // 5.2s (4.2s 경과 시점) -> 아직 4.5s(9박)에 도달하지 않았으므로 reading 유지!
      controller.update(5.2);
      expect(controller.phase).toBe('question_reading');

      // 5.5s (9박 경계) -> encounters 진입
      controller.update(5.5);
      expect(controller.phase).toBe('encounters');
    });

    it('TTS 콜백이 지연되거나 완료되지 않아도 계산된 생각 시간이 끝나면 반드시 조우로 진행한다 (DEC-B3, A20)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
        onTtsSpeak: () => {
          // TTS가 시작되었으나 완료 콜백이나 상태 변화를 주지 않음
        },
      });

      controller.update(0.0);
      controller.update(1.0);
      controller.update(5.0); // 8박 경과
      // 무한 대기 없이 encounters로 전이
      expect(controller.phase).toBe('encounters');
    });
  });

  describe('3. 조우(encounters) 순차 진행 및 정산 명령 수집', () => {
    it('3쌍 이상의 조우가 진행되는 동안에도 문제 참조를 일관되게 보존해야 한다 (A11, A23)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      controller.update(5.0); // encounter 0
      expect(controller.question.text).toBe('2 + 3 = ?');

      controller.update(7.0); // encounter 1
      expect(controller.question.text).toBe('2 + 3 = ?');

      controller.update(9.0); // encounter 2
      expect(controller.question.text).toBe('2 + 3 = ?');
    });

    it('답 쌍 조우에서 정답 펀치 입력 시 보스 무효화 정산 명령이 발행되고 조우가 성공 처리되어야 한다', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      controller.update(5.0); // encounters 시작 (encounter 0: pair_01, correctAnswer: left, duration: 4 beats = 2.0s, arrival: 7.0s)
      expect(controller.currentEncounterIndex).toBe(0);

      // t = 6.0s (arrival 7.0s 이전) 왼손 펀치 (정답)
      controller.submitPunch('left', 6000, { activeSeconds: 6.0, inputId: 'punch_correct_01' });

      // 정산 명령 확인
      const commands = controller.getSettlementCommands();
      expect(commands.length).toBeGreaterThan(0);
      const negateCommand = commands.find((cmd) => cmd.effectType === 'boss_negate');
      expect(negateCommand).toBeDefined();
      expect(negateCommand?.attackId).toBe('attack_pair_01');
    });

    it('스쿼트 조우에서 안전 자세(squatting) 입력 시 회피 성공 처리되고 플레이어 피해가 없어야 한다', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // encounter 0 (5.0s ~ 7.0s) 정답 처리
      controller.update(5.0);
      controller.submitPunch('left', 6000, { activeSeconds: 6.0, inputId: 'p1' });
      controller.update(7.0); // encounter 1 (squat: 7.0s ~ 9.0s)

      expect(controller.currentEncounterIndex).toBe(1);

      // 스쿼트 자세 주입 (7.5s에 squatting)
      controller.submitSquat('squatting', 7500, { activeSeconds: 7.5, standGeneration: 1 });

      // 도착 시점(9.0s) 및 마감 통과
      controller.update(9.2);

      // 플레이어 피해 명령이 없어야 함
      const commands = controller.getSettlementCommands();
      const damageCommands = commands.filter((cmd) => cmd.effectType === 'player_damage' && cmd.attackId === 'attack_squat_01');
      expect(damageCommands.length).toBe(0);
    });

    it('스쿼트 조우에서 회피 미수행 시 마감 통과 후 player_damage 정산 명령이 발행되어야 한다', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // encounter 0 정답 넘김
      controller.update(5.0);
      controller.submitPunch('left', 6000, { activeSeconds: 6.0, inputId: 'p1' });
      controller.update(7.0); // encounter 1 (squat: 7.0s ~ 9.0s)

      // 스쿼트 미입력 상태로 마감 시점(9.0s + lateGrace) 통과
      controller.update(9.3);

      const commands = controller.getSettlementCommands();
      const squatDamage = commands.find((cmd) => cmd.effectType === 'player_damage' && cmd.attackId === 'attack_squat_01');
      expect(squatDamage).toBeDefined();
      expect(squatDamage?.target).toBe('player');
    });
  });

  describe('4. 논리 경계 및 시간순 병합(Chronological Merge) 검증 (A08, A17)', () => {
    it('입력 시각과 마감 시각이 동일한 경우(t == deadline), 만료보다 입력을 우선 처리해야 한다 (A08)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      controller.update(5.0); // encounter 0 (arrival: 7.0s, deadline: 7.0s + 0.17s = 7.17s)
      const deadlineSeconds = 7.17;

      // 마감 시각과 정확히 일치하는 시각(7.17s)에 정답 펀치 제출
      controller.submitPunch('left', 7170, { activeSeconds: deadlineSeconds, inputId: 'deadline_punch' });
      controller.update(deadlineSeconds);

      // 만료(timeout)로 인한 피해 대신 정답 처리(boss_negate)가 우선되어야 함
      const commands = controller.getSettlementCommands();
      const negateCommand = commands.find((cmd) => cmd.effectType === 'boss_negate' && cmd.attackId === 'attack_pair_01');
      const damageCommand = commands.find((cmd) => cmd.effectType === 'player_damage' && cmd.attackId === 'attack_pair_01');

      expect(negateCommand).toBeDefined();
      expect(damageCommand).toBeUndefined();
    });

    it('마감 이후의 늦은 입력(t > deadline)은 만료된 과거 결과를 소급 수정할 수 없다 (A08)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      controller.update(5.0);
      // 마감 통과 (7.25s > 7.17s)
      controller.update(7.25);

      // 이미 타임아웃된 후 늦은 정답 펀치 입력
      controller.submitPunch('left', 7300, { activeSeconds: 7.3, inputId: 'late_punch' });
      controller.update(7.3);

      const commands = controller.getSettlementCommands();
      const damageCommand = commands.find((cmd) => cmd.effectType === 'player_damage' && cmd.attackId === 'attack_pair_01');
      const negateCommand = commands.find((cmd) => cmd.effectType === 'boss_negate' && cmd.attackId === 'attack_pair_01');

      expect(damageCommand).toBeDefined();
      expect(negateCommand).toBeUndefined();
    });

    it('큰 프레임 델타로 여러 경계를 한 번에 건너뛰더라도 시간순으로 정확히 순서대로 처리해야 한다 (A17)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      // 단 한 번의 큰 frame update (0.0s -> 12.0s: throw_in, reading, encounter 0, 1, 2 모두 포함)
      controller.update(12.0);

      // 세 조우 모두 미입력으로 차례대로 타임아웃 처리되어 완료되어야 함
      expect(controller.phase).toBe('round_clear');
      expect(controller.isCompleted).toBe(true);

      const commands = controller.getSettlementCommands();
      // encounter 0, encounter 1, encounter 2 각각에 대해 타임아웃/미스 피해 명령이 시간순 발행되었는지 확인
      expect(commands.length).toBeGreaterThanOrEqual(3);
    });

    it('동일한 activeSeconds로 중복 update를 호출하더라도 시간 진행이나 정산 명령이 중복되지 않아야 한다 (Idempotence)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      controller.update(3.0);
      const snapshot1 = controller.getPresentationSnapshot();

      // 동일 시각 중복 호출
      controller.update(3.0);
      const snapshot2 = controller.getPresentationSnapshot();

      expect(snapshot1).toEqual(snapshot2);
      expect(controller.getSettlementCommands().length).toBe(0);
    });
  });

  describe('5. 일시정지 및 복귀 정책 검증 (DEC-B8, A04, A23)', () => {
    it('question_reading 중 일시정지 발생 시 경과 시간이 소급 삭감되지 않고 복귀 후 남은 시간만큼 유지되어야 한다 (A23)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      controller.update(1.0); // reading 시작
      controller.update(2.0); // 1.0s 경과 (남은 reading: 3.0s)
      expect(controller.phase).toBe('question_reading');

      // pause
      controller.pause('pause');
      expect(controller.isPaused).toBe(true);

      // pause 중 update 호출 (활성 시간 축이 멈추거나 2.0s로 유지됨)
      controller.update(2.0);
      expect(controller.phase).toBe('question_reading');

      // resume
      controller.resume();
      expect(controller.isPaused).toBe(false);

      // 복귀 후 남은 3.0s (2.0s + 2.99s = 4.99s)까지는 여전히 reading 유지
      controller.update(4.99);
      expect(controller.phase).toBe('question_reading');

      // 5.0s (남은 시간 전부 소진) 시점에 encounters 진입
      controller.update(5.0);
      expect(controller.phase).toBe('encounters');
    });

    it('조우 진행 도중 일시정지 발생 후 해제 시 진행 중이던 공격 예고부터 재시작하고 1박 카운트 유예를 제공해야 한다 (DEC-B8)', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
        config: {
          resumeReadyBeats: 1, // 1박 = 0.5s
        },
      });

      // encounter 0 진행 (5.0s 시작, 원래 arrival: 7.0s)
      controller.update(5.0);
      controller.update(5.8); // 공격 도중

      // 정지
      controller.pause('pause');
      expect(controller.isPaused).toBe(true);

      // 재개 (resume)
      controller.resume();
      expect(controller.isPaused).toBe(false);

      // DEC-B8: 현재 진행 중이던 공격 예고부터 재시작 + 1박(0.5s) 유예 제공
      // 5.8s에서 원래 arrival 7.0s(1.2s 남음) 대신 재시작 + 1박 유예로 마감 시간이 연장됨
      // 이전 완료 공격은 없으며 현재 공격의 예고 상태로 재설정됨
      expect(controller.currentEncounterIndex).toBe(0);

      // 7.0s 시점에 원래 마감이어야 했으나 유예로 인해 아직 미만료 상태여야 함
      controller.update(7.0);
      expect(controller.getSettlementCommands().filter((c) => c.effectType === 'player_damage').length).toBe(0);

      // 유예된 시간 내에 정답 펀치 제출 가능
      controller.submitPunch('left', 7200, { activeSeconds: 7.2, inputId: 'resumed_punch' });
      controller.update(7.2);

      const negateCommand = controller.getSettlementCommands().find((c) => c.effectType === 'boss_negate');
      expect(negateCommand).toBeDefined();
    });
  });

  describe('6. 라운드 완료 및 단일 신호 발행 검증', () => {
    it('모든 조우가 끝나면 round_resolve를 거쳐 round_clear로 전이하고 완료 신호를 단 1회 발행해야 한다 (A04)', () => {
      const onRoundCompleteMock = vi.fn();
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
        onRoundComplete: onRoundCompleteMock,
      });

      controller.update(5.0); // encounter 0
      controller.submitPunch('left', 6000, { activeSeconds: 6.0, inputId: 'p0' });
      controller.update(7.0); // encounter 1
      controller.submitSquat('squatting', 7500, { activeSeconds: 7.5, standGeneration: 1 });
      controller.update(9.0); // encounter 2
      controller.submitPunch('right', 10000, { activeSeconds: 10.0, inputId: 'p2' });

      // 모든 조우 완료 (11.0s)
      controller.update(11.0);

      expect(controller.phase).toBe('round_clear');
      expect(controller.isCompleted).toBe(true);
      expect(onRoundCompleteMock).toHaveBeenCalledTimes(1);
      expect(onRoundCompleteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session_test_01',
          roundId: 'round_test_01',
          success: true,
        }),
      );

      // 이후 추가 update 호출 시에도 완료 신호 중복 발행 0회
      controller.update(12.0);
      controller.update(13.0);
      expect(onRoundCompleteMock).toHaveBeenCalledTimes(1);
    });

    it('getPresentationSnapshot은 불변 DTO를 반환하며 정답 플래그를 외부에 노출하지 않아야 한다', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_test_01',
        roundId: 'round_test_01',
        question: defaultQuestion,
        plan: { encounters: sample3PairEncounters },
        bpm: 120,
        throwDurationSeconds: 1.0,
      });

      controller.update(3.0);
      const snapshot: AssaultRoundPresentation = controller.getPresentationSnapshot();

      expect(snapshot.sessionId).toBe('session_test_01');
      expect(snapshot.roundId).toBe('round_test_01');
      expect(snapshot.phase).toBe('question_reading');
      expect(snapshot.questionText).toBe('2 + 3 = ?');
      expect(snapshot.currentEncounterIndex).toBe(0);
      expect(snapshot.totalEncounters).toBe(3);
      expect(snapshot.activeSeconds).toBe(3.0);
      expect(snapshot.readingProgress).toBeGreaterThan(0.0);
      expect(snapshot.isPaused).toBe(false);

      // Object.isFrozen 검증
      expect(Object.isFrozen(snapshot)).toBe(true);
      // correctAnswerSide 등 내부 정답 플래그는 스냅샷에 없어야 함
      expect((snapshot as unknown as Record<string, unknown>).correctAnswerSide).toBeUndefined();
    });
  });
});
