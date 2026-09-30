import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorLayout } from '../../src/editor/EditorLayout.js';

describe('EditorLayout - 에디터 3단 반응형 레이아웃 및 뷰 모델 (Phase 1)', () => {
  let state: EditorState;
  let layout: EditorLayout;

  beforeEach(() => {
    state = new EditorState();
    layout = new EditorLayout(state);
  });

  describe('1. 상단 툴바(Header) HTML 렌더링 검증', () => {
    it('상단 툴바에 BPM, 페이즈 선택, 재생 버튼, 데이터 입출력 버튼이 포함된다', () => {
      const html = layout.renderHeaderHTML();
      expect(html).toContain('BPM');
      expect(html).toContain('id="bpm-input"');
      expect(html).toContain('id="phase-select"');
      expect(html).toContain('id="btn-play"');
      expect(html).toContain('id="btn-export-json"');
      expect(html).toContain('id="btn-export-csv"');
      expect(html).toContain('id="btn-new-pattern"');
    });

    it('현재 state의 BPM(95)과 선택된 페이즈(RUN_QUESTION)가 반영된다', () => {
      const html = layout.renderHeaderHTML();
      expect(html).toContain('value="95"');
      expect(html).toContain('value="RUN_QUESTION" selected');
    });
  });

  describe('2. 좌측 패널(Sidebar) 안무 패턴 및 속성 편집기 렌더링', () => {
    it('패턴 목록에 4대 핵심 고양이 안무 패턴이 모두 렌더링된다', () => {
      const html = layout.renderSidebarHTML();
      expect(html).toContain('CAT_LOW_BOUNCE');
      expect(html).toContain('CAT_SKY_POINT_RIGHT');
      expect(html).toContain('CAT_CENTER_CLASP');
      expect(html).toContain('CAT_SKY_POINT_LEFT');
    });

    it('선택된 패턴(CAT_LOW_BOUNCE)의 신체 부위 존(왼손, 오른손, 머리, 골반) 속성이 렌더링된다', () => {
      const html = layout.renderSidebarHTML();
      expect(html).toContain('id="select-left-hand"');
      expect(html).toContain('id="select-right-hand"');
      expect(html).toContain('id="select-head"');
      expect(html).toContain('id="select-hip"');
      expect(html).toContain('id="foot-zone-9"');
      expect(html).toContain('id="foot-zone-11"');
    });

    it('유효한 포즈일 경우 "정상 포즈" 상태 배지를 렌더링한다', () => {
      const status = layout.getValidationBadge();
      expect(status.status).toBe('valid');
      expect(status.message).toContain('물리 제약 통과');
    });

    it('물리 제약 위반(Cross-Body) 발생 시 "제약 위반 경고" 상태 배지와 에러 목록을 반환한다', () => {
      state.updateCurrentPattern({ hip: 10, leftHand: 1 });
      const status = layout.getValidationBadge();
      expect(status.status).toBe('invalid');
      expect(status.message).toContain('위반');
      expect(status.errors.length).toBeGreaterThan(0);
      expect(status.errors[0]).toContain('Cross-Body');
    });
  });

  describe('3. 중앙 캔버스 워크스페이스 HTML 렌더링', () => {
    it('11개 피트니스 존 뷰어용 canvas 요소와 범례가 포함된다', () => {
      const html = layout.renderWorkspaceHTML();
      expect(html).toContain('id="editor-canvas"');
      expect(html).toContain('피트니스 존');
      expect(html).toContain('신체 커서');
    });
  });

  describe('4. 하단 타임라인 패널 HTML 렌더링', () => {
    it('타임라인 눈금자, 페이즈 안내 문구, 재생헤드가 포함된다', () => {
      const html = layout.renderTimelineHTML();
      expect(html).toContain('id="timeline-ruler"');
      expect(html).toContain('id="timeline-tracks"');
      expect(html).toContain('id="timeline-playhead"');
      expect(html).toContain(state.getCurrentPhaseRoutine().prompt);
    });

    it('비트 수에 맞는 눈금 마커 정보(Ruler markers)를 생성한다', () => {
      const markers = layout.getTimelineMarkers();
      expect(markers.length).toBe(8); // RUN_QUESTION은 8비트
      expect(markers[0].beat).toBe(1);
      expect(markers[7].beat).toBe(8);
    });
  });
});
