import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';
import { EditorCanvasRenderer } from '../../src/editor/EditorCanvasRenderer.js';
import { DEFAULT_CAT_CHOREO_PATTERNS } from '../../src/data/danceRoutineData.js';

describe('Editor Interactive Pattern Enhancements (Issue User Feedback)', () => {
  let state: EditorState;
  let layout: EditorLayout;

  beforeEach(() => {
    state = new EditorState();
    layout = new EditorLayout(state);
  });

  describe('1. 캔버스 커서 직접 클릭 및 hitTestCursor 검증 (Req 1)', () => {
    it('hitTestCursor가 캔버스 좌표(px)를 통해 해당 신체 커서 부위를 정확히 판별한다', () => {
      const mockCanvas = {
        getContext: () => ({}),
        width: 800,
        height: 600,
      } as unknown as HTMLCanvasElement;
      const renderer = new EditorCanvasRenderer(mockCanvas);

      // 관절 좌표가 설정된 프레임
      const pattern = DEFAULT_CAT_CHOREO_PATTERNS[0]; // CAT_LOW_BOUNCE: LH=6, RH=8, Hip=10
      // Zone 6 center px: (0.04 + 0.26/2)*800 = 136, (0.58 + 0.16/2)*600 = 396
      const hitLH = renderer.hitTestCursor(136, 396, pattern);
      expect(hitLH).toBe('leftHand');

      // Zone 8 center px: (0.70 + 0.26/2)*800 = 664, (0.58 + 0.16/2)*600 = 396
      const hitRH = renderer.hitTestCursor(664, 396, pattern);
      expect(hitRH).toBe('rightHand');

      // 빈 공간 클릭 시 null 반환
      const miss = renderer.hitTestCursor(400, 100, pattern);
      expect(miss).toBeNull();
    });
  });

  describe('2. 모션별 키노트 타임라인 동적 변화 및 명시적 연동 (Req 2)', () => {
    it('패턴을 명시적으로 적용(applyPatternToSequence)하면 타임라인의 키노트 시퀀스가 해당 모션에 맞게 동적으로 갱신된다', () => {
      // 1. 초기 CAT_LOW_BOUNCE (low_bounce)
      state.applyPatternToSequence('CAT_LOW_BOUNCE');
      const lowNotes = state.getCurrentPhaseNotes();
      expect(lowNotes.length).toBeGreaterThan(0);

      // 2. 우측 스카이포인트 패턴으로 명시적 적용
      state.applyPatternToSequence('CAT_SKY_POINT_RIGHT');
      const skyNotes = state.getCurrentPhaseNotes();
      expect(skyNotes.length).toBeGreaterThan(0);

      // 모션 타입이 다르므로 키노트 타깃 존 및 라벨이 달라져야 함
      const lowZones = lowNotes.flatMap((n) => n.targetZones);
      const skyZones = skyNotes.flatMap((n) => n.targetZones);
      expect(skyZones).toContain(3); // 우측 스카이포인트는 Zone 3 타깃 포함
      expect(lowZones).not.toEqual(skyZones);
    });

    it('패턴의 피트니스 존을 수정 후 명시적 적용 시 타임라인의 해당 키노트 타깃 존도 동기화된다', () => {
      state.applyPatternToSequence('CAT_SKY_POINT_RIGHT');
      // 우측 손을 Zone 3 -> Zone 2로 수정 후 명시적 적용
      state.updateCurrentPattern({ rightHand: 2 });
      state.applyPatternToSequence();

      const notes = state.getCurrentPhaseNotes();
      const rightHandNote = notes.find((n) => n.payload?.part === 'rightHand' || n.targetZones.includes(2));
      expect(rightHandNote).toBeDefined();
      expect(rightHandNote?.targetZones).toContain(2);
    });
  });

  describe('3. 안무 패턴 목록 10개 이상 제공 및 뷰 확장 (Req 3)', () => {
    it('에디터 기본 패턴 목록이 10개 이상 등록되어 있다', () => {
      const patterns = state.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(10);
    });

    it('사이드바 HTML에 10개 이상의 패턴 카드가 렌더링된다', () => {
      const html = layout.renderSidebarHTML();
      const patternCardMatches = html.match(/class="pattern-card/g);
      expect(patternCardMatches?.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('4. 사이드바 레이아웃: 패턴 속성 편집이 패턴 목록 상단에 위치 (Req 4)', () => {
    it('사이드바 HTML에서 패턴 속성 편집 섹션이 패턴 목록 섹션보다 앞에 위치한다', () => {
      const html = layout.renderSidebarHTML();
      const propEditIndex = html.indexOf('패턴 속성 편집');
      const listIndex = html.indexOf('안무 패턴 목록');

      expect(propEditIndex).toBeGreaterThan(-1);
      expect(listIndex).toBeGreaterThan(-1);
      // 패턴 속성 편집이 패턴 목록보다 앞(작은 인덱스)에 위치
      expect(propEditIndex).toBeLessThan(listIndex);
    });
  });
});
