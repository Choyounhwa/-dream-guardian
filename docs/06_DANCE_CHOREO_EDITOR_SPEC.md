# 📋 피트니스 안무 & 비트 타임라인 에디터 데이터 설계 명세서 (Dance Editor Data Spec)

---

## 1. 개요 및 목적

이 문서는 고양이 그루브 댄스 안무 및 비트 페이즈별 노트를 브라우저에서 시각적으로 손쉽게 제작, 수정, 검증할 수 있는 **「피트니스 안무 & 비트 타임라인 에디터(Dance Pattern & Timeline Editor)」**를 구축하기 위한 데이터 규격 및 아키텍처 명세서입니다.

---

## 2. 관련 시스템 및 구현 파일 경로

- **안무 데이터 및 동적 레지스트리**: `dream_guardian/src/data/danceRoutineData.ts`
- **배럴 Export**: `dream_guardian/src/data/index.ts`
- **TDD 단위 테스트**: `dream_guardian/tests/unit/dance-routine-data.test.ts`
- **피트니스 존 좌표 설정**: `dream_guardian/config/zone.config.ts`

---

## 3. 에디터 6대 핵심 데이터 명세

### 3.1 캔버스 및 피트니스 존 좌표계 메타데이터
```typescript
export interface EditorZoneDefinition {
  id: number;              // 1 ~ 11
  label: string;           // '좌상', '상단', '우상', '좌', '우', ...
  x: number;               // 정규화 X (0.0 ~ 1.0)
  y: number;               // 정규화 Y (0.0 ~ 1.0)
  width: number;           // 너비 비율 (기본 0.26)
  height: number;          // 높이 비율 (기본 0.16)
  color: string;           // 가이드 색상 ('#28E6FF')
}
```

### 3.2 신체 커서 및 물리 제약 룰 (Validation)
```typescript
export interface CursorRuleDefinition {
  part: 'leftHand' | 'rightHand' | 'head' | 'hip';
  label: string;
  themeColor: string;
  allowedZones: number[];
}

export const CURSOR_RULES: Record<string, CursorRuleDefinition> = {
  leftHand:  { part: 'leftHand',  label: '왼손',  themeColor: '#28E6FF', allowedZones: [1,2,3,4,5,6,7,8,9,10,11] },
  rightHand: { part: 'rightHand', label: '오른손', themeColor: '#FFCB4D', allowedZones: [1,2,3,4,5,6,7,8,9,10,11] },
  head:      { part: 'head',      label: '머리',  themeColor: '#C889FF', allowedZones: [4, 5] },
  hip:       { part: 'hip',       label: '골반',  themeColor: '#FF865E', allowedZones: [6, 8, 9, 10, 11] },
};
```
- **Cross-Body 제약**: 골반이 존 9~11일 때 손이 존 1~3에 위치할 수 없음 (`isCrossBodyViolation`).

### 3.3 단일 안무 패턴 데이터 스키마
```typescript
export interface CatChoreoPattern {
  readonly id: string;               // 고유 식별자 (예: 'CAT_LOW_BOUNCE')
  readonly name: string;             // 안무 이름 (예: '로우바운스 & 오픈스텝')
  readonly description: string;      // 설명
  readonly motionType: DanceMotionType;
  readonly leftHand: number | null;  // 1 ~ 11
  readonly rightHand: number | null; // 1 ~ 11
  readonly head: number | null;      // 4, 5
  readonly hip: number | null;       // 6, 8, 9, 10, 11
  readonly footZones: readonly number[]; // 9, 10, 11
  readonly partZoneMap: Partial<Record<BodyPart, number>>;
}
```

### 3.4 페이즈별 타임라인 시퀀스 데이터 스키마
1. **문제 페이즈 (`RUN_QUESTION`)**: 8박 로우바운스 모션 (홀수 박 `rebound`, 짝수 박 `dip`)
2. **답선택 페이즈 (`ANSWER_SELECT`)**: 2박 좌우 도달 (Zone 4 - 0번, Zone 5 - 1번)
3. **별모으기 페이즈 (`STAR_COLLECT`)**: 2~8박(7비트) 로우바운스 & 우측스카이포인트 키노트 시퀀스
4. **피버 / 페이즈B (`FEVER_PHASE_B`)**: 4가지 안무 패턴 16박 풀루프 시퀀스

### 3.5 오디오 및 싱크 메타데이터
```typescript
export interface AudioTrackMetadata {
  title: string;
  audioUrl: string;
  bpm: number;            // 기본: 95 BPM
  timeSignature: [4, 4];
  offsetMs: number;
  secondsPerBeat: number;
}
```

---

## 4. 인게임 데이터 입출력 연동 (`DancePatternRegistry`)

- **JSON 내보내기/불러오기**:
  ```typescript
  const jsonStr = dancePatternRegistry.toJSON();
  dancePatternRegistry.loadFromJSON(jsonStr);
  ```
- **CSV 내보내기/불러오기**:
  ```typescript
  const csvText = dancePatternRegistry.toCSV();
  dancePatternRegistry.loadFromCSV(csvText);
  ```
