/**
 * star-note-schedule.test.ts - 별모으기 노트 스케줄·판정창·마지막 정산 순서 통합 테스트
 *
 * @see Issue #235 [BUG-STAR-SCHEDULE-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';

function createMockPose(options: {
  leftWrist?: { x: number; y: number };
  rightWrist?: { x: number; y: number };
  leftHip?: { x: number; y: number };
  rightHip?: { x: number; y: number };
  nose?: { x: number; y: number };
}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  if (options.leftWrist) {
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: options.leftWrist.x, y: options.leftWrist.y, z: 0, visibility: 0.9 };
  }
  if (options.rightWrist) {
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: options.rightWrist.x, y: options.rightWrist.y, z: 0, visibility: 0.9 };
  }
  if (options.leftHip) {
    landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: options.leftHip.x, y: options.leftHip.y, z: 0, visibility: 0.9 };
  }
  if (options.rightHip) {
    landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: options.rightHip.x, y: options.rightHip.y, z: 0, visibility: 0.9 };
  }
  if (options.nose) {
    landmarks[POSE_LANDMARKS.NOSE] = { x: options.nose.x, y: options.nose.y, z: 0, visibility: 0.9 };
  }

  return landmarks;
}

function getZoneCenter(zoneId: number): { x: number; y: number } {
  const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId)!;
  return {
    x: zone.x + zone.width * 0.5,
    y: zone.y + zone.height * 0.5,
  };
}

describe('StarNoteScheduler & Resolution Order (Issue #235 - BUG-STAR-SCHEDULE-001)', () => {
  let scheduler: StarNoteScheduler;

  beforeEach(() => {
    scheduler = new StarNoteScheduler({
      secondsPerBeat: 0.5,
    });
  });

  describe('1. 7개 노트 착지 일정 분리 예약 (0.5s, 1.0s, 1.5s, 2.0s, 2.5s, 3.0s, 3.5s)', () => {
    it('start(10.0) 호출 시 7개 노트가 0.5s부터 3.5s까지 0.5s 간격으로 분리 예약된다', () => {
      scheduler.start(10.0, { roundId: 1 });

      expect(scheduler.notes).toHaveLength(7);
      const expectedLandings = [10.5, 11.0, 11.5, 12.0, 12.5, 13.0, 13.5];

      scheduler.notes.forEach((note, idx) => {
        expect(note.landingTime).toBeCloseTo(expectedLandings[idx], 4);
        expect(note.beat).toBe(idx + 2); // 2..8
        expect(note.id).toBeTruthy();
        expect(note.resolved).toBe(false);
      });

      // 1번째 노트(beat 2)와 6번째 노트(beat 7)는 foot 악기여야 함
      expect(scheduler.notes[0].instrument).toBe('foot');
      expect(scheduler.notes[0].zoneId).toBe(10);
      expect(scheduler.notes[5].instrument).toBe('foot');
      expect(scheduler.notes[5].zoneId).toBe(10);

      // 나머지 노트는 hand 악기
      expect(scheduler.notes[1].instrument).toBe('hand');
    });
  });

  describe('2. 노트 ID/roundId로 각 결과 1회 보장 (중복 및 누락 0건)', () => {
    it('각 노트당 정확히 1회 결과만 발생하며, 중복 입력 시에도 추가 판정이 발생하지 않는다', () => {
      const results: string[] = [];
      scheduler.onRating((res) => {
        results.push(res.target ? `${(res.target as any).id}:${res.rating}` : res.rating);
      });

      scheduler.start(0.0, { roundId: 1 });

      // Note 0: landing at 0.5s. Foot input at 0.5s
      const hit1 = scheduler.fromFoot({ foot: 'centerFoot', zoneId: 10, source: 'knee-proxy', timestamp: 0.5, confidence: 1 });
      expect(hit1).not.toBeNull();
      expect(hit1?.rating).toBe('Perfect');

      // Duplicate foot input for Note 0 at 0.52s
      const dup = scheduler.fromFoot({ foot: 'centerFoot', zoneId: 10, source: 'knee-proxy', timestamp: 0.52, confidence: 1 });
      expect(dup).toBeNull();

      expect(results).toHaveLength(1);
      expect(scheduler.resolvedCount).toBe(1);
    });
  });

  describe('3. 미입력 시 landingTime + 0.40s 만료 시점에 Miss 1회 확정', () => {
    it('노트 미입력 시 landingTime + 0.40s 초과 시점에 정확히 1회 Miss가 확정된다', () => {
      const ratings: string[] = [];
      scheduler.onRating((res) => {
        ratings.push(res.rating);
      });

      scheduler.start(0.0, { roundId: 1 });

      // Note 0 landingTime = 0.5s. Late window ends at 0.90s.
      // Update at 0.89s -> not expired yet
      scheduler.update(0.89);
      expect(ratings).toHaveLength(0);
      expect(scheduler.resolvedCount).toBe(0);

      // Update at 0.91s -> Note 0 expires (+0.40s late window exceeded)
      scheduler.update(0.91);
      expect(ratings).toHaveLength(1);
      expect(ratings[0]).toBe('Miss');
      expect(scheduler.resolvedCount).toBe(1);
      expect(scheduler.notes[0].resolved).toBe(true);

      // All 7 notes expire if we advance past 4.0s without input
      scheduler.update(4.0);
      expect(ratings).toHaveLength(7);
      expect(ratings.every((r) => r === 'Miss')).toBe(true);
      expect(scheduler.resolvedCount).toBe(7);
    });
  });

  describe('4. 손/머리 커서 판정 (update)', () => {
    it('instrument === hand인 노트는 해당 부위 커서가 목표 존에 위치할 때 타이밍에 따라 수집된다', () => {
      scheduler.start(0.0, { roundId: 1 });

      // Note 1 (beat 3, leftHand, zoneId 6, landingTime 1.0s)
      const zone6Center = getZoneCenter(6);
      const poseAtZone6 = createMockPose({ leftWrist: zone6Center });

      // Note 0 expires at 0.91s
      scheduler.update(0.91);
      expect(scheduler.notes[0].resolved).toBe(true);

      // Note 1 hit at 1.02s with left wrist in zone 6
      const results = scheduler.update(1.02, poseAtZone6);
      expect(results.some((r) => r.collected && r.rating === 'Perfect')).toBe(true);
      expect(scheduler.notes[1].resolved).toBe(true);
    });
  });

  describe('5. instrument === foot인 노트는 손/머리/골반 커서 판정을 바이패스하고 발 입력으로만 판정', () => {
    it('골반(hip) 커서가 Zone 10에 체류해도 instrument === foot인 노트는 바이패스되어 수집되지 않고, fromFoot으로만 수집된다', () => {
      scheduler.start(0.0, { roundId: 1 });

      // Note 0 (beat 2, hip/foot, zone 10, landing 0.5s)
      const zone10Center = getZoneCenter(10);
      const hipPoseAtZone10 = createMockPose({
        leftHip: zone10Center,
        rightHip: zone10Center,
      });

      // Update with hip in zone 10 at 0.5s -> should NOT collect Note 0!
      const motionResults = scheduler.update(0.5, hipPoseAtZone10);
      expect(motionResults.filter((r) => r.collected)).toHaveLength(0);
      expect(scheduler.notes[0].resolved).toBe(false);

      // fromFoot input at 0.5s -> correctly collects Note 0
      const footRes = scheduler.fromFoot({
        foot: 'centerFoot',
        zoneId: 10,
        source: 'knee-proxy',
        timestamp: 0.5,
        confidence: 1,
      });
      expect(footRes).not.toBeNull();
      expect(footRes?.collected).toBe(true);
      expect(footRes?.rating).toBe('Perfect');
      expect(scheduler.notes[0].resolved).toBe(true);
    });
  });

  describe('6. Space 키보드(fromKeyboard) 및 터치(fromTouch) 공통 결과 경로 지원', () => {
    it('Space 키보드 및 터치 입력이 공통 onRating 리스너로 동일하게 전달된다', () => {
      const dispatched: string[] = [];
      scheduler.onRating((res) => {
        dispatched.push(`${res.source}:${res.rating}`);
      });

      scheduler.start(0.0, { roundId: 1 });

      // Space at 0.5s -> hits Note 0
      const keyRes = scheduler.fromKeyboard(0.5);
      expect(keyRes).not.toBeNull();
      expect(keyRes?.collected).toBe(true);
      expect(keyRes?.rating).toBe('Perfect');
      expect(dispatched).toContain('keyboard:Perfect');

      // Touch zone 6 at 1.05s -> hits Note 1 (zoneId 6, landing 1.0s)
      const touchRes = scheduler.fromTouch(6, 1.05);
      expect(touchRes).not.toBeNull();
      expect(touchRes?.collected).toBe(true);
      expect(touchRes?.rating).toBe('Perfect');
      expect(dispatched).toContain('touch:Perfect');
    });
  });

  describe('7. isComplete 조건 (7개 노트 확정 AND currentTime >= startTime + 3.90s)', () => {
    it('7개 노트가 조기에 모두 hit되어도 currentTime < startTime + 3.90s이면 isComplete는 false이며, 3.90s 이상일 때 true가 된다', () => {
      scheduler.start(0.0, { roundId: 1 });

      // Fast-forward collect all 7 notes with keyboard
      const times = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
      for (const t of times) {
        scheduler.fromKeyboard(t);
      }

      expect(scheduler.resolvedCount).toBe(7);
      // Still at 3.5s < 3.90s
      scheduler.update(3.5);
      expect(scheduler.isComplete).toBe(false);

      // At 3.89s
      scheduler.update(3.89);
      expect(scheduler.isComplete).toBe(false);

      // At 3.90s
      scheduler.update(3.90);
      expect(scheduler.isComplete).toBe(true);
    });
  });

  describe('8. BeatRunCoordinator BRANCH_ROUTINE_BEATS = 8 (4.0s) 및 정산 순서 보장', () => {
    it('7번째 노트(3.5s 착지)의 Late 허용창(3.90s) 및 만료(4.00s)가 끝난 후 _resolveRound()가 호출된다', () => {
      const qb = new QuestionBank();
      qb.loadRecords([
        {
          level: 1,
          subLevel: 1,
          levelTitle: '덧셈',
          subLevelTitle: '기초',
          questionTemplate: '{A} + {B} = ?',
          answerEval: 'A + B',
          wrongEval: 'A + B + 1',
          varA: '2',
          varB: '3',
          varC: '',
          varD: '',
          shapeCode: '',
        },
      ]);

      const battle = new BattleState();
      const boss = new BossController(1);
      const resolver = new BeatRoundResolver({ battle, boss });
      const armSelector = new ArmReachAnswerSelector({ isMirrored: false });
      let confirmedCount = 0;

      const coordinator = new BeatRunCoordinator({
        questionBank: qb,
        battle,
        armReachAnswerSelector: armSelector,
        onAnswerConfirmed: (_idx, _correct, status) => {
          confirmedCount++;
          resolver.resolveRound(status);
        },
      });

      coordinator.startRound({ chapter: 1 });

      // 8박 운동 완료
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      // 정답 선택
      const correctIdx = coordinator.currentQuestion!.correctIndex;
      coordinator.confirmAnswerByFallback(correctIdx);
      expect(coordinator.phase).toBe('STAR_COLLECT');

      // 3.5초(7박) 시점: 기존 결함에서는 여기서 조기 정산되어 7번째 노트 유실
      // 수정 후: 3.5초 시점에는 아직 STAR_COLLECT 유지 중이어야 함
      coordinator.update(3.5);
      expect(coordinator.phase).toBe('STAR_COLLECT');
      expect(confirmedCount).toBe(0);

      // 3.9초 시점: 7번째 노트 Late 허용창 완료 시점, 여전히 4.0초 만료 대기
      coordinator.update(0.4); // 총 3.9초
      expect(coordinator.phase).toBe('STAR_COLLECT');
      expect(confirmedCount).toBe(0);

      // 4.0초(8박) 시점: 분기 루틴 8박 완료 -> ROUND_RESOLVE 진입 및 단 1회 정산
      coordinator.update(0.1); // 총 4.0초
      expect(coordinator.phase).toBe('ROUND_RESOLVE');
      expect(confirmedCount).toBe(1);
      expect(coordinator.roundResolveCount).toBe(1);
    });
  });
});
