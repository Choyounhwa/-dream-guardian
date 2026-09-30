import { describe, it, expect } from 'vitest';
import {
  CAT_CHOREO_PATTERNS,
  DEFAULT_CAT_CHOREO_PATTERNS,
  DancePatternRegistry,
  dancePatternRegistry,
  QUESTION_PHASE_ROUTINE,
  ANSWER_PHASE_ROUTINE,
  STAR_COLLECT_ROUTINE,
  FEVER_PHASE_B_ROUTINE,
  getDanceKeynotesForStarCollection,
  getDancePatternRecords,
  getDanceRoutineForPhase,
  type CatChoreoPattern,
} from '../../src/data/danceRoutineData.js';
import {
  isCrossBodyViolation,
  isValidZoneForCursor,
} from '../../config/zone.config.js';
import { validateStarTargets } from '../../src/game/StarSequenceGenerator.js';

describe('DanceRoutineData - 피트니스존 고양이 안무 루틴 데이터', () => {
  describe('1. 4대 핵심 고양이 안무 패턴 검증', () => {
    it('4가지 핵심 패턴(로우바운스, 우측스카이, 가슴모으기, 좌측스카이)이 모두 정의되어 있다', () => {
      expect(CAT_CHOREO_PATTERNS).toHaveLength(4);
      const ids = CAT_CHOREO_PATTERNS.map((p) => p.id);
      expect(ids).toContain('CAT_LOW_BOUNCE');
      expect(ids).toContain('CAT_SKY_POINT_RIGHT');
      expect(ids).toContain('CAT_CENTER_CLASP');
      expect(ids).toContain('CAT_SKY_POINT_LEFT');
    });

    it('모든 패턴이 신체 물리 제약(Cross-Body 위반 없음)을 완벽히 준수한다', () => {
      for (const pattern of CAT_CHOREO_PATTERNS) {
        if (pattern.hip !== null) {
          if (pattern.leftHand !== null) {
            expect(isCrossBodyViolation(pattern.leftHand, pattern.hip)).toBe(false);
          }
          if (pattern.rightHand !== null) {
            expect(isCrossBodyViolation(pattern.rightHand, pattern.hip)).toBe(false);
          }
        }
      }
    });

    it('각 부위별 배치된 피트니스 존이 유효한 존(isValidZoneForCursor)이다', () => {
      for (const pattern of CAT_CHOREO_PATTERNS) {
        if (pattern.leftHand !== null) {
          expect(isValidZoneForCursor('leftHand', pattern.leftHand)).toBe(true);
        }
        if (pattern.rightHand !== null) {
          expect(isValidZoneForCursor('rightHand', pattern.rightHand)).toBe(true);
        }
        if (pattern.head !== null) {
          expect(isValidZoneForCursor('head', pattern.head)).toBe(true);
        }
        if (pattern.hip !== null) {
          expect(isValidZoneForCursor('hip', pattern.hip)).toBe(true);
        }
      }
    });
  });

  describe('2. 문제 페이즈: 8박 로우바운스 모션 루틴 검증', () => {
    it('문제 페이즈 루틴은 총 8박으로 구성되며 로우바운스 모션 데이터를 가진다', () => {
      expect(QUESTION_PHASE_ROUTINE.beats).toBe(8);
      expect(QUESTION_PHASE_ROUTINE.motionType).toBe('low_bounce');
      expect(QUESTION_PHASE_ROUTINE.notes).toHaveLength(8);

      // 짝수 박은 딥 바운스(하단 Zone 6/8/10), 홀수 박은 업/리바운드
      const dipBeats = QUESTION_PHASE_ROUTINE.notes.filter((n) => n.action === 'dip');
      expect(dipBeats.length).toBe(4);
      for (const dip of dipBeats) {
        expect(dip.targetZones).toContain(10); // 골반 하단 스쿼트
      }
    });
  });

  describe('3. 답선택 페이즈: 2박 좌우 답선택 루틴 검증', () => {
    it('답선택 루틴은 좌(Zone 4, 0번) 및 우(Zone 5, 1번) 선택지 존을 가진다', () => {
      expect(ANSWER_PHASE_ROUTINE.maxBeats).toBe(2);
      expect(ANSWER_PHASE_ROUTINE.choices[0].choiceIndex).toBe(0);
      expect(ANSWER_PHASE_ROUTINE.choices[0].zoneId).toBe(4);
      expect(ANSWER_PHASE_ROUTINE.choices[1].choiceIndex).toBe(1);
      expect(ANSWER_PHASE_ROUTINE.choices[1].zoneId).toBe(5);
    });
  });

  describe('4. 별모으기 페이즈: 2~8박 로우바운스 & 우측스카이포인트 루틴 검증', () => {
    it('별모으기 루틴은 2~8박(7비트) 동안 로우바운스와 우측스카이포인트로 구성된다', () => {
      expect(STAR_COLLECT_ROUTINE.notes).toHaveLength(7);
      const beats = STAR_COLLECT_ROUTINE.notes.map((n) => n.beat);
      expect(beats).toEqual([2, 3, 4, 5, 6, 7, 8]);

      // 로우바운스 파트와 우측스카이 파트가 모두 포함됨
      const patterns = new Set(STAR_COLLECT_ROUTINE.notes.map((n) => n.patternId));
      expect(patterns.has('CAT_LOW_BOUNCE')).toBe(true);
      expect(patterns.has('CAT_SKY_POINT_RIGHT')).toBe(true);
    });

    it('getDanceKeynotesForStarCollection()이 안전한 Keynote[] 시퀀스를 반환한다', () => {
      const keynotes = getDanceKeynotesForStarCollection();
      expect(keynotes).toHaveLength(7);
      expect(keynotes[0].beat).toBe(2);
      expect(keynotes[6].beat).toBe(8);

      // StarSequenceGenerator의 validateStarTargets로 시퀀스 안전성 검증
      const starTargets = keynotes.map((k, index) => ({
        patternId: k.patternId,
        part: k.part,
        zoneId: k.zoneId,
        beatIndex: index + 1,
      }));
      const validation = validateStarTargets(starTargets);
      expect(validation.valid).toBe(true);
    });
  });

  describe('5. 피버, 페이즈B: 4가지 안무 패턴 순환 루틴 검증', () => {
    it('피버/페이즈B 루틴은 4가지 패턴이 모두 순환되는 16박(4마디) 구조를 갖는다', () => {
      expect(FEVER_PHASE_B_ROUTINE.patterns).toHaveLength(4);
      expect(FEVER_PHASE_B_ROUTINE.totalBeats).toBe(16);

      const patternIds = FEVER_PHASE_B_ROUTINE.patterns.map((p) => p.patternId);
      expect(patternIds).toEqual([
        'CAT_LOW_BOUNCE',
        'CAT_SKY_POINT_RIGHT',
        'CAT_CENTER_CLASP',
        'CAT_SKY_POINT_LEFT',
      ]);
    });
  });

  describe('6. 헬퍼 및 호환 레코드 검증', () => {
    it('getDancePatternRecords()가 FitnessPatternRecord 형태로 유효하게 변환된다', () => {
      const records = getDancePatternRecords();
      expect(records).toHaveLength(4);
      for (const rec of records) {
        expect(rec.id.startsWith('CAT_')).toBe(true);
        expect(rec.parts.length).toBeGreaterThan(0);
        expect(rec.zoneIds.length).toBe(rec.parts.length);
      }
    });

    it('getDanceRoutineForPhase()가 각 페이즈별 올바른 루틴 데이터를 반환한다', () => {
      expect(getDanceRoutineForPhase('RUN_QUESTION')).toBe(QUESTION_PHASE_ROUTINE);
      expect(getDanceRoutineForPhase('ANSWER_SELECT')).toBe(ANSWER_PHASE_ROUTINE);
      expect(getDanceRoutineForPhase('STAR_COLLECT')).toBe(STAR_COLLECT_ROUTINE);
      expect(getDanceRoutineForPhase('KEYNOTE_PERFORMANCE')).toBe(STAR_COLLECT_ROUTINE);
      expect(getDanceRoutineForPhase('FEVER_PHASE_B')).toBe(FEVER_PHASE_B_ROUTINE);
    });
  });

  describe('7. DancePatternRegistry - 동적 패턴 등록, 수정, 삭제, 직렬화 검증', () => {
    it('초기화 시 기본 4대 패턴을 포함하며 DEFAULT_CAT_CHOREO_PATTERNS 및 싱글톤 인스턴스와 일치한다', () => {
      const registry = new DancePatternRegistry();
      expect(registry.getAll()).toHaveLength(4);
      expect(registry.has('CAT_LOW_BOUNCE')).toBe(true);
      expect(DEFAULT_CAT_CHOREO_PATTERNS).toHaveLength(4);
      expect(dancePatternRegistry.getAll()).toHaveLength(4);
    });

    it('새로운 안무 패턴을 성공적으로 추가/등록할 수 있다', () => {
      const registry = new DancePatternRegistry();
      const newPattern: CatChoreoPattern = {
        id: 'CAT_CLAP_HIGH',
        name: '하이 클랩 & 점프 준비',
        description: '양손을 머리 위로 모아 박수',
        motionType: 'center_clasp',
        leftHand: 2,
        rightHand: 2,
        head: null,
        hip: 8,
        footZones: [9, 11],
        partZoneMap: { leftHand: 2, rightHand: 2, hip: 8 },
      };

      const result = registry.register(newPattern);
      expect(result.valid).toBe(true);
      expect(registry.has('CAT_CLAP_HIGH')).toBe(true);
      expect(registry.getAll()).toHaveLength(5);
      expect(registry.get('CAT_CLAP_HIGH')?.name).toBe('하이 클랩 & 점프 준비');
    });

    it('신체 물리 제약(Cross-Body 위반)이 있는 패턴 등록을 차단한다', () => {
      const registry = new DancePatternRegistry();
      const invalidPattern: CatChoreoPattern = {
        id: 'INVALID_PATTERN',
        name: '위반 패턴 (골반 최하단 + 손 최상단)',
        description: '위반',
        motionType: 'low_bounce',
        leftHand: 1, // 1~3 최상단
        rightHand: 8,
        head: null,
        hip: 10, // 9~11 최하단
        footZones: [],
        partZoneMap: { leftHand: 1, rightHand: 8, hip: 10 },
      };

      const result = registry.register(invalidPattern);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(registry.has('INVALID_PATTERN')).toBe(false);
    });

    it('존재하는 패턴의 정보를 동적으로 수정(update)할 수 있다', () => {
      const registry = new DancePatternRegistry();
      const updateResult = registry.update('CAT_LOW_BOUNCE', {
        name: '익스트림 로우바운스',
        description: '더 깊숙이 내려앉는 딥 스쿼트 바운스',
      });

      expect(updateResult.valid).toBe(true);
      const updated = registry.get('CAT_LOW_BOUNCE');
      expect(updated?.name).toBe('익스트림 로우바운스');
      expect(updated?.description).toBe('더 깊숙이 내려앉는 딥 스쿼트 바운스');
      // 기존 필드 유지 확인
      expect(updated?.leftHand).toBe(6);
    });

    it('패턴을 삭제(unregister)할 수 있다', () => {
      const registry = new DancePatternRegistry();
      const removed = registry.unregister('CAT_LOW_BOUNCE');
      expect(removed).toBe(true);
      expect(registry.has('CAT_LOW_BOUNCE')).toBe(false);
      expect(registry.getAll()).toHaveLength(3);
    });

    it('JSON 직렬화 및 역직렬화(loadFromJSON)로 외부 데이터를 동적 로드할 수 있다', () => {
      const registry = new DancePatternRegistry();
      const json = registry.toJSON();
      expect(typeof json).toBe('string');

      const customRegistry = new DancePatternRegistry([]);
      expect(customRegistry.getAll()).toHaveLength(0);

      const loadResult = customRegistry.loadFromJSON(json);
      expect(loadResult.loadedCount).toBe(4);
      expect(customRegistry.getAll()).toHaveLength(4);
      expect(customRegistry.has('CAT_SKY_POINT_RIGHT')).toBe(true);
    });

    it('CSV 텍스트(toCSV / loadFromCSV)로 외부 데이터를 동적 로드할 수 있다', () => {
      const registry = new DancePatternRegistry();
      const csv = registry.toCSV();
      expect(csv).toContain('ID,NAME,DESCRIPTION,MOTION_TYPE,LEFT_HAND,RIGHT_HAND,HEAD,HIP,FOOT_ZONES');
      expect(csv).toContain('CAT_LOW_BOUNCE');

      const customRegistry = new DancePatternRegistry([]);
      const loadResult = customRegistry.loadFromCSV(csv);
      expect(loadResult.loadedCount).toBe(4);
      expect(customRegistry.get('CAT_CENTER_CLASP')?.leftHand).toBe(4);
    });

    it('reset() 호출 시 기본 4대 패턴으로 복원된다', () => {
      const registry = new DancePatternRegistry();
      registry.clear();
      expect(registry.getAll()).toHaveLength(0);

      registry.reset();
      expect(registry.getAll()).toHaveLength(4);
    });

    describe('[BUG-DANCE-DATA-001 / #244] 부위 해제 후 매핑 동기화 및 발 존 유효성 검증', () => {
      it('부위 해제(null 지정) 시 partZoneMap에서도 해당 키가 완벽히 제거된다', () => {
        const registry = new DancePatternRegistry();
        // CAT_LOW_BOUNCE는 leftHand: 6, rightHand: 8, hip: 10
        expect(registry.get('CAT_LOW_BOUNCE')?.leftHand).toBe(6);
        expect(registry.get('CAT_LOW_BOUNCE')?.partZoneMap.leftHand).toBe(6);

        const updateRes = registry.update('CAT_LOW_BOUNCE', { leftHand: null });
        expect(updateRes.valid).toBe(true);

        const updated = registry.get('CAT_LOW_BOUNCE');
        expect(updated?.leftHand).toBeNull();
        expect(updated?.partZoneMap.leftHand).toBeUndefined();
        expect('leftHand' in (updated?.partZoneMap ?? {})).toBe(false);
        expect(updated?.partZoneMap).toEqual({ rightHand: 8, hip: 10 });
      });

      it('신규 등록(register) 시에도 null 부위는 partZoneMap에 포함되지 않는다', () => {
        const registry = new DancePatternRegistry();
        const pattern: CatChoreoPattern = {
          id: 'TEST_PARTIAL_NULL',
          name: '일부 부위 null 패턴',
          description: '테스트',
          motionType: 'center_clasp',
          leftHand: null,
          rightHand: 5,
          head: null,
          hip: 8,
          footZones: [10],
          partZoneMap: { leftHand: 999, rightHand: 5, hip: 8 } as any, // 잘못된 이전 매핑 전달 가정
        };

        const res = registry.register(pattern);
        expect(res.valid).toBe(true);
        const registered = registry.get('TEST_PARTIAL_NULL');
        expect(registered?.leftHand).toBeNull();
        expect(registered?.partZoneMap.leftHand).toBeUndefined();
        expect(registered?.partZoneMap).toEqual({ rightHand: 5, hip: 8 });
      });

      it('발 디딤 존(footZones)이 9, 10, 11 이외의 존(예: [1, 999])을 포함하면 검증에 실패한다', () => {
        const registry = new DancePatternRegistry();
        const invalidPattern: Partial<CatChoreoPattern> = {
          id: 'TEST_INVALID_FOOT',
          name: '비허용 발 존',
          leftHand: 4,
          rightHand: 5,
          footZones: [1, 999],
        };

        const val = registry.validate(invalidPattern);
        expect(val.valid).toBe(false);
        expect(val.errors.some((e) => e.includes('1') && e.includes('발'))).toBe(true);
        expect(val.errors.some((e) => e.includes('999') && e.includes('발'))).toBe(true);

        // update 시도시에도 거부되어야 함
        const updateRes = registry.update('CAT_LOW_BOUNCE', { footZones: [1, 999] });
        expect(updateRes.valid).toBe(false);
        expect(registry.get('CAT_LOW_BOUNCE')?.footZones).toEqual([9, 11]);
      });

      it('발 디딤 존(footZones)에 중복된 존(예: [9, 9])이 있으면 검증에 실패한다', () => {
        const registry = new DancePatternRegistry();
        const dupPattern: Partial<CatChoreoPattern> = {
          id: 'TEST_DUP_FOOT',
          name: '중복 발 존',
          leftHand: 4,
          rightHand: 5,
          footZones: [9, 9],
        };

        const val = registry.validate(dupPattern);
        expect(val.valid).toBe(false);
        expect(val.errors.some((e) => e.includes('중복'))).toBe(true);
      });

      it('발 디딤 존(footZones)에 비정상 타입(문자열/NaN 등)이 들어오면 검증에 실패한다', () => {
        const registry = new DancePatternRegistry();
        const badTypePattern: any = {
          id: 'TEST_BAD_TYPE_FOOT',
          name: '잘못된 타입 발 존',
          leftHand: 4,
          rightHand: 5,
          footZones: ['invalid', NaN],
        };

        const val = registry.validate(badTypePattern);
        expect(val.valid).toBe(false);
      });

      it('JSON 및 CSV 왕복(Roundtrip) 후에도 partZoneMap과 footZones가 일치한다', () => {
        const registry = new DancePatternRegistry();
        registry.update('CAT_LOW_BOUNCE', { leftHand: null, footZones: [10] });

        // JSON Roundtrip
        const json = registry.toJSON();
        const jsonRegistry = new DancePatternRegistry([]);
        const jsonRes = jsonRegistry.loadFromJSON(json);
        expect(jsonRes.loadedCount).toBe(4);
        const jsonLowBounce = jsonRegistry.get('CAT_LOW_BOUNCE');
        expect(jsonLowBounce?.leftHand).toBeNull();
        expect(jsonLowBounce?.partZoneMap.leftHand).toBeUndefined();
        expect(jsonLowBounce?.partZoneMap).toEqual({ rightHand: 8, hip: 10 });
        expect(jsonLowBounce?.footZones).toEqual([10]);

        // CSV Roundtrip
        const csv = registry.toCSV();
        const csvRegistry = new DancePatternRegistry([]);
        const csvRes = csvRegistry.loadFromCSV(csv);
        expect(csvRes.loadedCount).toBe(4);
        const csvLowBounce = csvRegistry.get('CAT_LOW_BOUNCE');
        expect(csvLowBounce?.leftHand).toBeNull();
        expect(csvLowBounce?.partZoneMap.leftHand).toBeUndefined();
        expect(csvLowBounce?.partZoneMap).toEqual({ rightHand: 8, hip: 10 });
        expect(csvLowBounce?.footZones).toEqual([10]);
      });
    });
  });
});
