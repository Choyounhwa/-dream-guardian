import { describe, expect, it } from 'vitest';
import {
  AUTHORING_PROJECT_KIND,
  AUTHORING_SCHEMA_VERSION,
} from '../../src/data/EditorProject.js';
import { validateEditorProject } from '../../src/data/ProjectValidator.js';
import {
  migrateV1ProjectToV2,
} from '../../src/data/EditorProjectMigration.js';
import {
  mergePatternLibrary,
  type AuthoringPattern,
  type PatternMergeResult,
} from '../../src/data/PatternLibraryMigration.js';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function createSampleV1Package() {
  return {
    version: '1.0.0',
    exportedAt: '2026-10-04T12:00:00.000Z',
    bpm: 120,
    selectedPhase: 'STAR_COLLECT',
    selectedPatternId: 'CAT_LOW_BOUNCE',
    patterns: [
      {
        id: 'CAT_LOW_BOUNCE',
        name: '로우바운스 & 오픈스텝 (Low Bounce)',
        description: '양손 하단 무릎 굽힘',
        motionType: 'low_bounce',
        leftHand: 6,
        rightHand: 8,
        head: null,
        hip: 10,
        footZones: [9, 11],
        partZoneMap: { leftHand: 6, rightHand: 8, hip: 10 },
      },
      {
        id: 'CAT_SKY_POINT_RIGHT',
        name: '우측 스카이포인트 & 크로스탭',
        description: '오른손 하늘 찌르기',
        motionType: 'sky_point_right',
        leftHand: 6,
        rightHand: 3,
        head: null,
        hip: 8,
        footZones: [9],
        partZoneMap: { leftHand: 6, rightHand: 3, hip: 8 },
      },
    ],
    sequences: {
      RUN_QUESTION: [
        {
          id: 'NOTE_Q_1',
          lane: 'motion',
          startBeat: 1,
          durationBeats: 1,
          label: 'dip: 로우바운스 딥',
          color: '#FF865E',
          targetZones: [10],
          payload: { action: 'dip', part: 'hip', patternId: 'CAT_LOW_BOUNCE' },
        },
        {
          id: 'NOTE_Q_2',
          lane: 'motion',
          startBeat: 2,
          durationBeats: 1,
          label: 'rebound: 로우바운스 리바운드',
          color: '#28E6FF',
          targetZones: [6],
          payload: { action: 'rebound', part: 'leftHand', patternId: 'CAT_LOW_BOUNCE' },
        },
      ],
      ANSWER_SELECT: [
        {
          id: 'NOTE_A_0',
          lane: 'answer',
          startBeat: 1,
          durationBeats: 1,
          label: '0번 답안: Zone 4 (왼손 도달)',
          color: '#28E6FF',
          targetZones: [4],
          payload: { choiceIndex: 0, targetPart: 'leftHand' },
        },
        {
          id: 'NOTE_A_1',
          lane: 'answer',
          startBeat: 2,
          durationBeats: 1,
          label: '1번 답안: Zone 5 (오른손 도달)',
          color: '#FFCB4D',
          targetZones: [5],
          payload: { choiceIndex: 1, targetPart: 'rightHand' },
        },
      ],
      STAR_COLLECT: [
        {
          id: 'NOTE_S_1',
          lane: 'keynote',
          startBeat: 2,
          durationBeats: 1,
          label: '스쿼트 드럼 킥',
          color: '#FFCB4D',
          targetZones: [10],
          payload: { part: 'hip', instrument: 'foot', patternId: 'CAT_LOW_BOUNCE' },
        },
        {
          id: 'NOTE_S_2',
          lane: 'keynote',
          startBeat: 3,
          durationBeats: 1,
          label: '좌측 핸즈',
          color: '#28E6FF',
          targetZones: [6],
          payload: { part: 'leftHand', instrument: 'hand', patternId: 'CAT_LOW_BOUNCE' },
        },
        {
          id: 'NOTE_S_3',
          lane: 'keynote',
          startBeat: 4,
          durationBeats: 1,
          label: '우측 핸즈',
          color: '#28E6FF',
          targetZones: [8],
          payload: { part: 'rightHand', instrument: 'hand', patternId: 'CAT_LOW_BOUNCE' },
        },
        {
          id: 'NOTE_S_4',
          lane: 'keynote',
          startBeat: 5,
          durationBeats: 1,
          label: '우측 스카이 찌르기',
          color: '#FFCB4D',
          targetZones: [3],
          payload: { part: 'rightHand', instrument: 'hand', patternId: 'CAT_SKY_POINT_RIGHT' },
        },
        {
          id: 'NOTE_S_5',
          lane: 'keynote',
          startBeat: 6,
          durationBeats: 1,
          label: '우측 스카이 허리 지지',
          color: '#28E6FF',
          targetZones: [6],
          payload: { part: 'leftHand', instrument: 'hand', patternId: 'CAT_SKY_POINT_RIGHT' },
        },
        {
          id: 'NOTE_S_6',
          lane: 'keynote',
          startBeat: 7,
          durationBeats: 1,
          label: '딥 킥',
          color: '#FFCB4D',
          targetZones: [10],
          payload: { part: 'hip', instrument: 'foot', patternId: 'CAT_LOW_BOUNCE' },
        },
        {
          id: 'NOTE_S_7',
          lane: 'keynote',
          startBeat: 8,
          durationBeats: 1,
          label: '스카이포인트 피니시',
          color: '#FFCB4D',
          targetZones: [3],
          payload: { part: 'rightHand', instrument: 'hand', patternId: 'CAT_SKY_POINT_RIGHT' },
        },
      ],
      FEVER_PHASE_B: [
        {
          id: 'NOTE_F_1',
          lane: 'motion',
          startBeat: 1,
          durationBeats: 4,
          label: '패턴 1: 로우바운스',
          color: '#28E6FF',
          targetZones: [6, 8, 10],
          payload: { patternId: 'CAT_LOW_BOUNCE', motionType: 'low_bounce' },
        },
        {
          id: 'NOTE_F_2',
          lane: 'motion',
          startBeat: 5,
          durationBeats: 4,
          label: '패턴 2: 우측 스카이포인트',
          color: '#FFCB4D',
          targetZones: [3, 6, 8],
          payload: { patternId: 'CAT_SKY_POINT_RIGHT', motionType: 'sky_point_right' },
        },
        {
          id: 'NOTE_F_3',
          lane: 'motion',
          startBeat: 9,
          durationBeats: 4,
          label: '패턴 3: 로우바운스 2차',
          color: '#28E6FF',
          targetZones: [6, 8, 10],
          payload: { patternId: 'CAT_LOW_BOUNCE', motionType: 'low_bounce' },
        },
        {
          id: 'NOTE_F_4',
          lane: 'motion',
          startBeat: 13,
          durationBeats: 4,
          label: '패턴 4: 우측 스카이포인트 2차',
          color: '#FFCB4D',
          targetZones: [3, 6, 8],
          payload: { patternId: 'CAT_SKY_POINT_RIGHT', motionType: 'sky_point_right' },
        },
      ],
    },
  };
}

describe('EditorProjectMigration - V1 프로젝트 무손실 변환 (#378)', () => {
  describe('1. V1 프로젝트 패키지 감지 및 V2 EditorProject 변환 (Roundtrip/Conversion)', () => {
    it('V1 패키지를 V2 저작 프로젝트(schemaVersion: 2, kind: dream-guardian-authoring-project)로 변환한다', () => {
      const v1 = createSampleV1Package();
      const res = migrateV1ProjectToV2(v1);

      expect(res.success).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.project).toBeDefined();

      const project = res.project!;
      expect(project.kind).toBe(AUTHORING_PROJECT_KIND);
      expect(project.schemaVersion).toBe(AUTHORING_SCHEMA_VERSION);
      expect(project.previewTempo.bpm).toBe(120);

      // Validate against official V2 ProjectValidator
      const validation = validateEditorProject(project);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('STAR_COLLECT 2~8 표시 박을 상대 1~7박(480, 960, 1440, 1920, 2400, 2880, 3360 tick)으로 정확히 변환한다', () => {
      const v1 = createSampleV1Package();
      const res = migrateV1ProjectToV2(v1);

      expect(res.success).toBe(true);
      const starSeq = res.project!.sequences.find((s) => s.kind === 'starNotes');
      expect(starSeq).toBeDefined();
      expect(starSeq!.phase).toBe('phaseA');
      expect(starSeq!.events).toHaveLength(7);

      const expectedTicks = [480, 960, 1440, 1920, 2400, 2880, 3360];
      const actualTicks = starSeq!.events.map((e: any) => e.landingTick);
      expect(actualTicks).toEqual(expectedTicks);

      // Foot note target verification (NOTE_S_1: beat 2, zone 10, foot)
      const firstNote = starSeq!.events[0] as any;
      expect(firstNote.target.type).toBe('foot');
      expect(firstNote.target.zoneId).toBe(10);
      expect(firstNote.target.foot).toBe('centerFoot');

      // Hand note target verification (NOTE_S_4: beat 5, zone 3, hand)
      const handNote = starSeq!.events[3] as any;
      expect(handNote.target.type).toBe('cursor');
      expect(handNote.target.part).toBe('rightHand');
      expect(handNote.target.zoneId).toBe(3);
    });

    it('2.5박과 같은 비정규 박자는 자동 반올림하지 않고 720 tick을 정확히 보존하며 호환성 경고(warning)를 보고한다', () => {
      const v1 = createSampleV1Package();
      // Insert fractional 2.5 beat note
      v1.sequences.STAR_COLLECT.push({
        id: 'NOTE_S_FRAC',
        lane: 'keynote',
        startBeat: 2.5,
        durationBeats: 1,
        label: '분할 박자 테스트',
        color: '#FFCB4D',
        targetZones: [3],
        payload: { part: 'rightHand', instrument: 'hand', patternId: 'CAT_SKY_POINT_RIGHT' },
      });

      const res = migrateV1ProjectToV2(v1);
      expect(res.success).toBe(true);

      const starSeq = res.project!.sequences.find((s) => s.kind === 'starNotes');
      const fracEvt = starSeq!.events.find((e: any) => e.id === 'NOTE_S_FRAC') as any;
      expect(fracEvt).toBeDefined();

      // (2.5 - 1) * 480 = 720 tick exactly preserved, NOT rounded to 480 or 960!
      expect(fracEvt.landingTick).toBe(720);

      // Non-slot tick diagnostic warning reported
      const slotWarnings = res.diagnostics.filter(
        (d) => d.code === 'non-slot-star-tick' || d.code.includes('slot') || d.code.includes('tick'),
      );
      expect(slotWarnings.length).toBeGreaterThan(0);
      expect(res.warnings.length).toBeGreaterThan(0);
    });

    it('FEVER_PHASE_B를 BOSS_CLIMAX 8노트로 자동 치환하지 않고 Phase B motionGuide(16박 가이드)로 보존한다', () => {
      const v1 = createSampleV1Package();
      const res = migrateV1ProjectToV2(v1);

      expect(res.success).toBe(true);
      const phaseBSeq = res.project!.sequences.find((s) => s.phase === 'phaseB');
      expect(phaseBSeq).toBeDefined();
      expect(phaseBSeq!.kind).toBe('motionGuide');
      expect(phaseBSeq!.events).toHaveLength(4);

      // 4 blocks * 4 beats each = total 16 beats (7680 ticks)
      const firstGuide = phaseBSeq!.events[0] as any;
      expect(firstGuide.kind).toBe('motionCue');
      expect(firstGuide.startTick).toBe(0); // (1 - 1) * 480
      expect(firstGuide.durationTicks).toBe(1920); // 4 * 480

      const lastGuide = phaseBSeq!.events[3] as any;
      expect(lastGuide.startTick).toBe(5760); // (13 - 1) * 480
      expect(lastGuide.durationTicks).toBe(1920);
    });

    it('RUN_QUESTION 및 ANSWER_SELECT를 Phase A motionGuide 시퀀스로 적절히 변환한다', () => {
      const v1 = createSampleV1Package();
      const res = migrateV1ProjectToV2(v1);

      expect(res.success).toBe(true);
      const phaseAMotionSeqs = res.project!.sequences.filter(
        (s) => s.phase === 'phaseA' && s.kind === 'motionGuide',
      );
      expect(phaseAMotionSeqs.length).toBeGreaterThanOrEqual(1);

      // Check all motion events mapped
      const totalEvents = phaseAMotionSeqs.flatMap((s) => s.events);
      expect(totalEvents.some((e: any) => e.id === 'NOTE_Q_1')).toBe(true);
      expect(totalEvents.some((e: any) => e.id === 'NOTE_A_0')).toBe(true);
    });

    it('누락된 시퀀스를 현재 프로젝트 기본값으로 임의로 채우지 않고 진단(warning/info)을 남긴다', () => {
      const v1 = {
        version: '1.0.0',
        bpm: 120,
        patterns: [
          {
            id: 'PAT_1',
            name: 'P1',
            leftHand: 4,
            rightHand: null,
            head: null,
            hip: null,
          },
        ],
        sequences: {
          STAR_COLLECT: [
            {
              id: 'NOTE_S_1',
              startBeat: 2,
              targetZones: [4],
              payload: { part: 'leftHand', instrument: 'hand', patternId: 'PAT_1' },
            },
          ],
          // RUN_QUESTION, ANSWER_SELECT, FEVER_PHASE_B are omitted
        },
      };

      const res = migrateV1ProjectToV2(v1);
      expect(res.success).toBe(true);
      expect(res.project).toBeDefined();

      // Does not synthesize FEVER_PHASE_B or RUN_QUESTION
      const feverSeq = res.project!.sequences.find((s) => s.phase === 'phaseB');
      expect(feverSeq).toBeUndefined();

      // Reports missing sequences in diagnostics
      const missingSeqDiags = res.diagnostics.filter(
        (d) => d.code === 'missing-sequence' || d.message.includes('missing') || d.message.includes('omitted'),
      );
      expect(missingSeqDiags.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. 결정성 및 원본 불변성 (Determinism & Immutability)', () => {
    it('동일한 V1 입력에 대해 복수 회 실행 시 완전히 동일한 결과를 반환한다 (결정성)', () => {
      const v1 = createSampleV1Package();
      const res1 = migrateV1ProjectToV2(v1);
      const res2 = migrateV1ProjectToV2(v1);

      expect(res1.project).toEqual(res2.project);
      expect(res1.idRemap).toEqual(res2.idRemap);
      expect(res1.diagnostics).toEqual(res2.diagnostics);
    });

    it('입력 데이터가 deepFreeze 상태여도 변형(mutation) 없이 성공하며 원본을 변경하지 않는다', () => {
      const v1 = deepFreeze(createSampleV1Package());
      expect(() => migrateV1ProjectToV2(v1)).not.toThrow();

      const res = migrateV1ProjectToV2(v1);
      expect(res.success).toBe(true);
    });

    it('알 수 없거나 손상된 버전/형식은 원본을 변형하지 않고 명시적으로 거부한다', () => {
      const invalidVersion = deepFreeze({
        version: '999.0.0',
        patterns: [],
        sequences: {},
      });
      const res1 = migrateV1ProjectToV2(invalidVersion);
      expect(res1.success).toBe(false);
      expect(res1.errors.length).toBeGreaterThan(0);

      const corruptData = deepFreeze({
        version: '1.0.0',
        patterns: 'not-an-array',
        sequences: null,
      });
      const res2 = migrateV1ProjectToV2(corruptData);
      expect(res2.success).toBe(false);
      expect(res2.errors.length).toBeGreaterThan(0);

      const nonObject = deepFreeze('invalid string payload');
      const res3 = migrateV1ProjectToV2(nonObject);
      expect(res3.success).toBe(false);
      expect(res3.errors.length).toBeGreaterThan(0);
    });
  });

  describe('3. ID 충돌 및 참조 재매핑 (ID Collision & Reference Remapping)', () => {
    it('패턴 ID 충돌 시 결정적으로 새 ID로 복제(rename)하고 이벤트의 sourcePatternId를 함께 remap한다', () => {
      const v1 = createSampleV1Package();
      // Introduce duplicate pattern ID
      v1.patterns.push({
        id: 'CAT_LOW_BOUNCE', // Duplicate!
        name: '로우바운스 복제본 (Variant)',
        description: '변형 로우바운스',
        motionType: 'low_bounce',
        leftHand: 1,
        rightHand: 3,
        head: null,
        hip: 10,
        footZones: [10],
        partZoneMap: { leftHand: 1, rightHand: 3, hip: 10 },
      });

      const res = migrateV1ProjectToV2(v1, { idConflictPolicy: 'rename' });
      expect(res.success).toBe(true);

      const project = res.project!;
      const patternIds = project.patterns.map((p) => p.id);
      expect(new Set(patternIds).size).toBe(patternIds.length); // All pattern IDs are unique

      // Check idRemap table
      expect(res.idRemap).toBeDefined();
      const renamedId = patternIds.find((id) => id !== 'CAT_LOW_BOUNCE' && id.startsWith('CAT_LOW_BOUNCE'));
      expect(renamedId).toBeDefined();

      // Project validator must still pass with 0 errors
      const validation = validateEditorProject(project);
      expect(validation.valid).toBe(true);
    });

    it('idConflictPolicy가 fail일 경우 패턴 ID 충돌 시 즉시 거부하고 에러를 보고한다', () => {
      const v1 = createSampleV1Package();
      (v1.patterns as any[]).push({
        id: 'CAT_LOW_BOUNCE', // Duplicate!
        name: '충돌 패턴',
        leftHand: 1,
        rightHand: 2,
        head: null,
        hip: null,
      });

      const res = migrateV1ProjectToV2(v1, { idConflictPolicy: 'fail' });
      expect(res.success).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.diagnostics.some((d) => d.code === 'pattern-id-conflict')).toBe(true);
    });

    it('사용자 지정 MigrationOptions (projectId, rulesetId, title, author)가 반영된다', () => {
      const v1 = createSampleV1Package();
      const res = migrateV1ProjectToV2(v1, {
        projectId: 'custom_project_42',
        rulesetId: 'custom_ruleset_v2',
        title: 'Custom Title',
        author: 'Lead Choreographer',
      });

      expect(res.success).toBe(true);
      const project = res.project!;
      expect(project.projectId).toBe('custom_project_42');
      expect(project.rulesetId).toBe('custom_ruleset_v2');
      expect(project.metadata.title).toBe('Custom Title');
      expect(project.metadata.author).toBe('Lead Choreographer');
    });
  });
});

describe('PatternLibraryMigration - 패턴 라이브러리 병합 (#378)', () => {
  const existingPatterns: AuthoringPattern[] = [
    {
      id: 'pat_exist_1',
      name: 'Existing Pattern 1',
      target: { leftHand: 1, rightHand: 5, head: null, hip: null },
      description: 'First pattern',
    },
    {
      id: 'pat_exist_2',
      name: 'Existing Pattern 2',
      target: { leftHand: null, rightHand: null, head: null, hip: 10 },
      description: 'Second pattern',
    },
  ];

  it('새로운 고유 패턴들을 기존 라이브러리에 순수하게 병합한다', () => {
    const imported = [
      {
        id: 'pat_new_1',
        name: 'New Pattern 1',
        target: { leftHand: 4, rightHand: 5, head: 4, hip: null },
      },
    ];

    const res: PatternMergeResult = mergePatternLibrary(existingPatterns, imported);
    expect(res.success).toBe(true);
    expect(res.patterns).toHaveLength(3);
    expect(res.importedCount).toBe(1);
    expect(res.skippedCount).toBe(0);
    expect(res.overwrittenCount).toBe(0);
    expect(res.renamedCount).toBe(0);
    expect(res.patterns.map((p) => p.id)).toEqual(['pat_exist_1', 'pat_exist_2', 'pat_new_1']);
  });

  it('ID 충돌 시 skip 정책에 따라 기존 패턴을 유지하고 수입을 건너뛴다', () => {
    const imported = [
      {
        id: 'pat_exist_1', // Conflict
        name: 'Conflicting Name',
        target: { leftHand: 2, rightHand: 2, head: null, hip: null },
      },
      {
        id: 'pat_fresh',
        name: 'Fresh Pattern',
        target: { leftHand: 3, rightHand: 3, head: null, hip: null },
      },
    ];

    const res = mergePatternLibrary(existingPatterns, imported, { collisionPolicy: 'skip' });
    expect(res.success).toBe(true);
    expect(res.patterns).toHaveLength(3);
    expect(res.skippedCount).toBe(1);
    expect(res.importedCount).toBe(1);
    expect(res.idRemap['pat_exist_1']).toBe('pat_exist_1');

    // Content of pat_exist_1 remains unchanged
    const pat1 = res.patterns.find((p) => p.id === 'pat_exist_1')!;
    expect(pat1.name).toBe('Existing Pattern 1');
  });

  it('ID 충돌 시 overwrite 정책에 따라 기존 패턴을 대체한다', () => {
    const imported = [
      {
        id: 'pat_exist_1', // Conflict
        name: 'Overwritten Name',
        target: { leftHand: 2, rightHand: 2, head: null, hip: null },
      },
    ];

    const res = mergePatternLibrary(existingPatterns, imported, { collisionPolicy: 'overwrite' });
    expect(res.success).toBe(true);
    expect(res.patterns).toHaveLength(2);
    expect(res.overwrittenCount).toBe(1);

    const pat1 = res.patterns.find((p) => p.id === 'pat_exist_1')!;
    expect(pat1.name).toBe('Overwritten Name');
    expect(pat1.target.leftHand).toBe(2);
  });

  it('ID 충돌 시 rename 정책에 따라 새 고유 ID를 생성하고 remap 매핑을 반환한다', () => {
    const imported = [
      {
        id: 'pat_exist_1', // Conflict
        name: 'Cloned Pattern',
        target: { leftHand: 2, rightHand: 2, head: null, hip: null },
      },
    ];

    const res = mergePatternLibrary(existingPatterns, imported, { collisionPolicy: 'rename' });
    expect(res.success).toBe(true);
    expect(res.patterns).toHaveLength(3);
    expect(res.renamedCount).toBe(1);

    const newId = res.idRemap['pat_exist_1'];
    expect(newId).toBeDefined();
    expect(newId).not.toBe('pat_exist_1');
    expect(res.patterns.some((p) => p.id === newId)).toBe(true);
  });

  it('CSV 형식 패턴 데이터(문자열 또는 레코드 배열)를 정규 AuthoringPattern으로 변환 및 병합한다', () => {
    const csvContent = `ID,사용 부위,왼손,오른손,머리,골반,판정 부위 수
S001,왼손,1,X,X,X,1
D001,왼손 + 오른손,1,3,X,X,2`;

    const res = mergePatternLibrary(existingPatterns, csvContent);
    expect(res.success).toBe(true);
    expect(res.patterns).toHaveLength(4);
    expect(res.importedCount).toBe(2);

    const s001 = res.patterns.find((p) => p.id === 'S001');
    expect(s001).toBeDefined();
    expect(s001!.target.leftHand).toBe(1);
    expect(s001!.target.rightHand).toBeNull();
  });

  it('시퀀스 데이터가 혼입된 패키지가 인입되면 시퀀스를 제외하고 패턴만 안전하게 추출한다 (no sequence mixing)', () => {
    const packageWithSequences = [
      {
        id: 'pat_clean_1',
        name: 'Clean Pattern',
        target: { leftHand: 1, rightHand: null, head: null, hip: null },
      },
      {
        id: 'corrupt_item_with_sequences',
        name: 'Item With Sequence Mixing',
        target: { leftHand: 2, rightHand: null, head: null, hip: null },
        sequences: { STAR_COLLECT: [] }, // Sequence mixing!
      },
    ];

    const res = mergePatternLibrary(existingPatterns, packageWithSequences);
    expect(res.success).toBe(true);
    expect(res.patterns.some((p) => p.id === 'pat_clean_1')).toBe(true);
    const mixed = res.patterns.find((p) => p.id === 'corrupt_item_with_sequences');
    expect(mixed).toBeDefined();
    expect((mixed as any).sequences).toBeUndefined(); // Stripped from library pattern

    const seqWarning = res.diagnostics.find((d) => d.code === 'sequence-mixing-detected');
    expect(seqWarning).toBeDefined();
  });

  it('기존 패턴 배열 및 수입 배열이 deepFreeze 상태여도 변형 없이 작동한다', () => {
    const frozenExisting = deepFreeze([...existingPatterns]);
    const frozenImported = deepFreeze([
      {
        id: 'pat_frozen_test',
        name: 'Frozen Test',
        target: { leftHand: 1, rightHand: null, head: null, hip: null },
      },
    ]);

    expect(() => mergePatternLibrary(frozenExisting, frozenImported)).not.toThrow();
  });

  it('잘못된 importedPatterns 타입(null, 숫자 등)은 거부하고 에러를 반환한다', () => {
    const res1 = mergePatternLibrary(existingPatterns, null as any);
    expect(res1.success).toBe(false);
    expect(res1.errors.length).toBeGreaterThan(0);

    const res2 = mergePatternLibrary(existingPatterns, 12345 as any);
    expect(res2.success).toBe(false);
    expect(res2.errors.length).toBeGreaterThan(0);
  });
});
