/**
 * audio-band-integration.test.ts - 실제 노트·장판·Web Audio 밴드 음향 동기화 통합 테스트
 *
 * Issue #191 [AUDIO-BAND-001]:
 * - 손 (Zone 1~5) 일렉 기타 / 발 (Zone 9~11) 드럼 키사운드 실입력 연동
 * - 판정별 음향: Perfect(sync: 정박 클린/오버드라이브), Good/Late(stumble: 엇박 피치벤드/스크래치), Miss(miss: 틱 사운드 및 주악기 뮤트)
 * - 장판 회피(Hazard Evade): 회피 성공 시 shield_deflect, 피격 시 player_hurt 및 배틀 데미지
 * - 노트결과 ID 기준 중복 방지 (1회 재생) 및 무입력 Miss 누락 0건 검증
 * - AudioContext 공유, 음소거(Mute), 일시정지(suspend/resume) 생명주기 검증
 *
 * @see Issue #191 [AUDIO-BAND-001]
 * @see Issue #229 [SPEC-ROUTINE-VERIFY-001]
 * @see Issue #235 [BUG-STAR-SCHEDULE-001]
 * @see Issue #236 [BUG-HAZARD-RUNTIME-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BandSynthesizer, type BandTimingQuality } from '../../src/audio/BandSynthesizer.js';
import { SFXSynth } from '../../src/audio/SFXSynth.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import type { FootKeynoteEvent } from '../../src/types/keynote.js';

interface MockAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
}

function createMockAudioParam(initial: number = 0): MockAudioParam {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
}

function createMockAudioContext(): AudioContext {
  const destination = {} as AudioDestinationNode;

  return {
    currentTime: 10.0,
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    destination,
    createOscillator: vi.fn().mockImplementation(() => ({
      type: 'sine',
      frequency: createMockAudioParam(440),
      detune: createMockAudioParam(0),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    })),
    createGain: vi.fn().mockImplementation(() => ({
      gain: createMockAudioParam(1.0),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createWaveShaper: vi.fn().mockImplementation(() => ({
      curve: null,
      oversample: 'none',
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBiquadFilter: vi.fn().mockImplementation(() => ({
      type: 'lowpass',
      frequency: createMockAudioParam(1000),
      Q: createMockAudioParam(1),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn().mockImplementation(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBuffer: vi.fn().mockImplementation(() => ({
      getChannelData: vi.fn().mockReturnValue(new Float32Array(4096)),
    })),
  } as unknown as AudioContext;
}

function createMockPose(options: {
  leftWrist?: { x: number; y: number };
  rightWrist?: { x: number; y: number };
}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));

  if (options.leftWrist) {
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = {
      x: options.leftWrist.x,
      y: options.leftWrist.y,
      z: 0,
      visibility: 0.9,
    };
  }
  if (options.rightWrist) {
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = {
      x: options.rightWrist.x,
      y: options.rightWrist.y,
      z: 0,
      visibility: 0.9,
    };
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

describe('Audio & Band Synthesizer Integration (Issue #191 - AUDIO-BAND-001)', () => {
  let mockCtx: AudioContext;
  let bandSynth: BandSynthesizer;
  let sfx: SFXSynth;
  let scheduler: StarNoteScheduler;
  let battle: BattleState;

  // 단일 결과 음향 디스패치 파이프라인 (main.ts 로직과 100% 동일)
  let playedNoteAudioIds: Set<string>;
  let audioDispatchLog: { noteId: string; zoneId: number; quality: BandTimingQuality; sfx?: string }[];

  beforeEach(() => {
    mockCtx = createMockAudioContext();
    sfx = new SFXSynth({ audioContext: mockCtx });
    bandSynth = new BandSynthesizer({ audioContext: mockCtx });
    battle = new BattleState(100);
    playedNoteAudioIds = new Set<string>();
    audioDispatchLog = [];

    scheduler = new StarNoteScheduler({ secondsPerBeat: 0.5 });

    scheduler.onRating((starResult) => {
      const noteId = starResult.target
        ? (starResult.target as any).id
        : `note_${starResult.timestamp}_${starResult.zoneId}`;
      if (noteId) {
        if (playedNoteAudioIds.has(noteId)) {
          return;
        }
        playedNoteAudioIds.add(noteId);
      }

      if (starResult.collected) {
        const quality: BandTimingQuality = starResult.rating === 'Perfect' ? 'sync' : 'stumble';
        bandSynth.playZoneSound(starResult.zoneId, quality);
        sfx.play('correct');
        audioDispatchLog.push({ noteId, zoneId: starResult.zoneId, quality, sfx: 'correct' });
      } else if (starResult.rating === 'Miss') {
        bandSynth.playZoneSound(starResult.zoneId, 'miss');
        audioDispatchLog.push({ noteId, zoneId: starResult.zoneId, quality: 'miss' });
      }
    });
  });

  describe('1. 별모으기(Star Note) 판정별 밴드 음향 실시간 동기화', () => {
    it('손 노트(Zone 1, Perfect) 수집 시 기타 파워코드 sync 사운드와 SFX correct가 재생된다', () => {
      // Zone 1 전용 손 노트 주입
      scheduler.start(0.0, {
        roundId: 1,
        notes: [
          {
            beat: 2,
            patternId: 'CAT_LOW_BOUNCE',
            part: 'leftHand',
            zoneId: 1,
            instrument: 'hand',
            actionName: 'Zone 1 Left Hand',
          },
        ],
      });
      // beat 2 (landingTime 0.5s)
      const center = getZoneCenter(1);
      const pose = createMockPose({ leftWrist: center });

      scheduler.update(0.50, pose);

      expect(audioDispatchLog).toHaveLength(1);
      expect(audioDispatchLog[0].zoneId).toBe(1);
      expect(audioDispatchLog[0].quality).toBe('sync');
      expect(audioDispatchLog[0].sfx).toBe('correct');
    });

    it('손 노트(Good/Late) 수집 시 기타 stumble 사운드(피치 벤드)와 SFX correct가 재생된다', () => {
      scheduler.start(0.0, {
        roundId: 1,
        notes: [
          {
            beat: 2,
            patternId: 'CAT_LOW_BOUNCE',
            part: 'leftHand',
            zoneId: 1,
            instrument: 'hand',
            actionName: 'Zone 1 Left Hand',
          },
        ],
      });
      // beat 2 (landingTime 0.5s, late window 0.75s)
      const center = getZoneCenter(1);
      const pose = createMockPose({ leftWrist: center });

      scheduler.update(0.75, pose);

      expect(audioDispatchLog).toHaveLength(1);
      expect(audioDispatchLog[0].quality).toBe('stumble');
      expect(audioDispatchLog[0].sfx).toBe('correct');
    });

    it('발 노트(Zone 10, Perfect) 발 입력 시 스네어 드럼 sync 사운드가 재생된다', () => {
      scheduler.start(0.0, { roundId: 1 });
      // beat 2 (0.5s, Zone 10, foot)
      const footEvent: FootKeynoteEvent = {
        source: 'virtual',
        zoneId: 10,
        foot: 'centerFoot',
        confidence: 0.95,
        timestamp: 0.50,
      };

      scheduler.fromFoot(footEvent, 0.50);

      expect(audioDispatchLog).toHaveLength(1);
      expect(audioDispatchLog[0].zoneId).toBe(10);
      expect(audioDispatchLog[0].quality).toBe('sync');
      expect(audioDispatchLog[0].sfx).toBe('correct');
    });

    it('Space 키 폴백으로 노트 수집 시 올바른 밴드 사운드가 출력된다', () => {
      scheduler.start(0.0, { roundId: 1 });
      // beat 2 (0.5s, foot note Zone 10)
      scheduler.fromKeyboard(0.50, 'Space');

      expect(audioDispatchLog).toHaveLength(1);
      expect(audioDispatchLog[0].zoneId).toBe(10);
      expect(audioDispatchLog[0].quality).toBe('sync');
    });

    it('터치 폴백으로 노트 수집 시 올바른 밴드 사운드가 출력된다', () => {
      scheduler.start(0.0, {
        roundId: 1,
        notes: [
          {
            beat: 2,
            patternId: 'CAT_LOW_BOUNCE',
            part: 'leftHand',
            zoneId: 1,
            instrument: 'hand',
            actionName: 'Zone 1 Left Hand',
          },
        ],
      });
      // beat 2 (0.5s, Zone 1)
      scheduler.fromTouch(1, 0.50);

      expect(audioDispatchLog).toHaveLength(1);
      expect(audioDispatchLog[0].zoneId).toBe(1);
      expect(audioDispatchLog[0].quality).toBe('sync');
    });

    it('무입력 만료(Miss) 시 메인 악기 음소거 및 틱 사운드가 출력되고 SFX correct는 발생하지 않는다', () => {
      scheduler.start(0.0, { roundId: 1 });
      // beat 2 (0.5s landing, late 0.40s -> 0.91s 경과 시 만료)
      scheduler.update(0.95);

      expect(audioDispatchLog).toHaveLength(1);
      expect(audioDispatchLog[0].zoneId).toBe(10);
      expect(audioDispatchLog[0].quality).toBe('miss');
      expect(audioDispatchLog[0].sfx).toBeUndefined();
    });
  });

  describe('2. 노트결과 ID 기준 중복 방지 (1회 재생) 및 7노트 누락 0건', () => {
    it('동일한 노트에 대해 중복 판정이 인입되어도 사운드는 정확히 1회만 재생된다', () => {
      scheduler.start(0.0, {
        roundId: 1,
        notes: [
          {
            beat: 2,
            patternId: 'CAT_LOW_BOUNCE',
            part: 'leftHand',
            zoneId: 1,
            instrument: 'hand',
            actionName: 'Zone 1 Left Hand',
          },
        ],
      });
      const center = getZoneCenter(1);
      const pose = createMockPose({ leftWrist: center });

      // 0.50s에 수집 성공
      scheduler.update(0.50, pose);
      expect(audioDispatchLog).toHaveLength(1);

      // 이후 프레임에서도 동일 타깃 수집이 중복 발생하지 않음
      scheduler.update(0.55, pose);
      scheduler.update(0.60, pose);
      expect(audioDispatchLog).toHaveLength(1);
    });

    it('7개 노트 루틴에서 수집 및 만료가 혼합되어도 정확히 7회의 사운드가 출력되며 누락이 없다', () => {
      scheduler.start(0.0, { roundId: 1 });

      // beat 2 (0.5s, foot Zone 10) -> 발 입력 수집
      scheduler.fromFoot({ source: 'virtual', zoneId: 10, foot: 'centerFoot', confidence: 0.95, timestamp: 0.50 }, 0.50);

      // beat 3 (1.0s, hand Zone 6) -> 손 입력 수집 (STAR_NOTES note 1은 zone 6)
      const center6 = getZoneCenter(6);
      scheduler.update(1.00, createMockPose({ leftWrist: center6 }));

      // beat 4 (1.5s), beat 5 (2.0s), beat 6 (2.5s) -> 무입력 방치
      // beat 7 (3.0s, foot Zone 10) -> 발 입력 수집
      scheduler.fromFoot({ source: 'virtual', zoneId: 10, foot: 'centerFoot', confidence: 0.95, timestamp: 3.00 }, 3.00);

      // beat 8 (3.5s) -> 무입력 방치

      // 전체 만료 완료 시점까지 진행 (4.0s)
      scheduler.update(4.00);

      // 총 7개의 노트에 대해 정확히 7회의 음향 디스패치 발생 (3 hit + 4 miss)
      expect(audioDispatchLog).toHaveLength(7);

      const hits = audioDispatchLog.filter((l) => l.quality !== 'miss');
      const misses = audioDispatchLog.filter((l) => l.quality === 'miss');
      expect(hits).toHaveLength(3);
      expect(misses).toHaveLength(4);
    });
  });

  describe('3. 장판 회피(Hazard Evade) 성공/피격 사운드 동기화', () => {
    it('회피 성공(evaded: true) 시 shield_deflect 사운드가 재생되고 데미지가 없다', () => {
      const sfxSpy = vi.spyOn(sfx, 'play');
      const hazardController = new PhaseAHazardController({
        onBeatResolved: ({ evaded, damage }) => {
          if (evaded) {
            sfx.play('shield_deflect');
            return;
          }
          battle.applyHazardDamage(damage ?? 25);
          sfx.play('player_hurt');
        },
      });

      hazardController.start({ pattern: 'jump' });
      // 3.0초에 점프 동작 기록
      hazardController.recordAction('jump');
      // 3.5초 판정 해결
      hazardController.update(3.55);

      expect(hazardController.isResolved).toBe(true);
      expect(hazardController.isEvaded).toBe(true);
      expect(sfxSpy).toHaveBeenCalledWith('shield_deflect');
      expect(sfxSpy).not.toHaveBeenCalledWith('player_hurt');
      expect(battle.hp).toBe(100);
    });

    it('회피 실패(evaded: false) 시 player_hurt 사운드가 재생되고 HP가 25 감소한다', () => {
      const sfxSpy = vi.spyOn(sfx, 'play');
      const hazardController = new PhaseAHazardController({
        onBeatResolved: ({ evaded, damage }) => {
          if (evaded) {
            sfx.play('shield_deflect');
            return;
          }
          battle.applyHazardDamage(damage ?? 25);
          sfx.play('player_hurt');
        },
      });

      hazardController.start({ pattern: 'jump' });
      // 아무 동작도 하지 않고 3.5초 판정 도달
      hazardController.update(3.55);

      expect(hazardController.isResolved).toBe(true);
      expect(hazardController.isEvaded).toBe(false);
      expect(sfxSpy).toHaveBeenCalledWith('player_hurt');
      expect(sfxSpy).not.toHaveBeenCalledWith('shield_deflect');
      expect(battle.hp).toBe(75); // 100 - 25
    });
  });

  describe('4. 음소거(Mute) 및 AudioContext 제어', () => {
    it('음소거 활성화 시 모든 신디사이저의 오디오 노드 생성이 차단된다', () => {
      bandSynth.setMuted(true);
      sfx.setMuted(true);

      bandSynth.playZoneSound(1, 'sync');
      bandSynth.playZoneSound(10, 'sync');
      sfx.play('shield_deflect');
      sfx.play('correct');

      // 음소거 상태이므로 오실레이터 생성 호출 0건
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });

    it('suspend / resume이 AudioContext 상태와 동기화된다', async () => {
      await bandSynth.suspend();
      expect((mockCtx as any).suspend).toHaveBeenCalled();

      await bandSynth.resume();
      expect(mockCtx.resume).toHaveBeenCalled();
    });
  });
});
