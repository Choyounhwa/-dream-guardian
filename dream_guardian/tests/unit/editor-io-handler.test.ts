import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorIOHandler, STORAGE_KEY } from '../../src/editor/EditorIOHandler.js';

describe('EditorIOHandler - 에디터 데이터 입출력(IO) 및 LocalStorage 영속화 (Phase 5)', () => {
  let state: EditorState;
  let ioHandler: EditorIOHandler;

  // Mock localStorage
  const mockStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    }),
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    state = new EditorState();
    ioHandler = new EditorIOHandler(mockLocalStorage as unknown as Storage);
  });

  describe('1. 프로젝트 전체 JSON 직렬화 및 역직렬화 (Roundtrip)', () => {
    it('exportFullProjectJSON()이 패턴, 시퀀스, BPM 메타데이터를 포함한 JSON을 생성한다', () => {
      state.setBpm(105);
      state.setSelectedPhase('STAR_COLLECT');

      const jsonStr = ioHandler.exportFullProjectJSON(state);
      expect(typeof jsonStr).toBe('string');

      const parsed = JSON.parse(jsonStr);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.bpm).toBe(105);
      expect(parsed.selectedPhase).toBe('STAR_COLLECT');
      expect(Array.isArray(parsed.patterns)).toBe(true);
      expect(parsed.sequences).toBeDefined();
      expect(parsed.sequences.STAR_COLLECT.length).toBeGreaterThan(0);
    });

    it('importFullProjectJSON()이 JSON 데이터를 역직렬화하여 state에 완벽히 복원한다', () => {
      // 1. 커스텀 패턴 추가 및 BPM 변경
      state.setBpm(110);
      state.createNewPattern({
        id: 'CAT_TEST_IO',
        name: 'IO 테스트 패턴',
        description: '',
        motionType: 'center_clasp',
        leftHand: 4,
        rightHand: 5,
        head: 4,
        hip: 8,
        footZones: [10],
      });

      const jsonStr = ioHandler.exportFullProjectJSON(state);

      // 2. 새 state에 복원
      const newState = new EditorState();
      const result = ioHandler.importFullProjectJSON(newState, jsonStr);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(newState.bpm).toBe(110);
      expect(newState.registry.get('CAT_TEST_IO')).toBeDefined();
      expect(newState.registry.get('CAT_TEST_IO')?.name).toBe('IO 테스트 패턴');
    });

    it('손상된 JSON 입력 시 success=false와 에러 메시지를 반환한다', () => {
      const result = ioHandler.importFullProjectJSON(state, '{ invalid_json ');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('2. CSV 내보내기 및 불러오기', () => {
    it('exportCSV()가 4대 핵심 패턴 CSV 문자열을 반환한다', () => {
      const csv = ioHandler.exportCSV(state);
      expect(csv).toContain('ID,NAME,DESCRIPTION');
      expect(csv).toContain('CAT_LOW_BOUNCE');
      expect(csv).toContain('CAT_SKY_POINT_RIGHT');
    });

    it('importCSV()가 CSV 데이터를 파싱하여 패턴을 등록한다', () => {
      const csvData = [
        'id,name,description,motionType,leftHand,rightHand,head,hip,footZones',
        'CAT_CSV_DANCE,CSV 안무,설명,low_bounce,6,8,,10,"9,11"',
      ].join('\n');

      const result = ioHandler.importCSV(state, csvData);
      expect(result.success).toBe(true);
      expect(state.registry.get('CAT_CSV_DANCE')).toBeDefined();
      expect(state.registry.get('CAT_CSV_DANCE')?.name).toBe('CSV 안무');
    });
  });

  describe('3. LocalStorage 자동 저장 및 복원', () => {
    it('saveToLocalStorage()가 storage에 직렬화 데이터를 저장한다', () => {
      state.setBpm(115);
      const saved = ioHandler.saveToLocalStorage(state);
      expect(saved).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
    });

    it('loadFromLocalStorage()가 storage에서 데이터를 불러와 state에 적용한다', () => {
      state.setBpm(125);
      ioHandler.saveToLocalStorage(state);

      const restoredState = new EditorState();
      const loaded = ioHandler.loadFromLocalStorage(restoredState);
      expect(loaded).toBe(true);
      expect(restoredState.bpm).toBe(125);
    });

    it('storage가 비어있을 경우 loadFromLocalStorage()는 false를 반환한다', () => {
      const loaded = ioHandler.loadFromLocalStorage(state);
      expect(loaded).toBe(false);
    });

    it('clearLocalStorage()가 저장된 키를 제거한다', () => {
      ioHandler.saveToLocalStorage(state);
      ioHandler.clearLocalStorage();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });
});
