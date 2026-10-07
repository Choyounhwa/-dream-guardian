import { describe, expect, it } from 'vitest';
import {
  createDefaultUIVisualDocument,
  type UIVisualDocument,
} from '../../src/editor/ui/data/UIVisualDocument';
import {
  createSession,
  beginDrag,
  commitDrag,
  undo,
  redo,
  createVisualSession,
  selectVisualElements,
  switchVisualPage,
  executeVisualCommand,
  beginVisualDrag,
  updateVisualDrag,
  commitVisualDrag,
  cancelVisualDrag,
  undoVisual,
  redoVisual,
  moveVisualElements,
  moveSelectedElements,
  resizeVisualElement,
  setVisualElementProp,
  setVisualElementGroup,
  alignVisualElements,
  loadVisualDocument,
  resetVisualSession,
  type VisualEditorSession,
} from '../../src/editor/ui/UIEditorState';
import {
  type VisualCommand,
  type VisualMoveElementsCommand,
  isVisualDocEqual,
} from '../../src/editor/ui/UICommands';

describe('[Issue #434 / UI-VIS-004] 페이지 문서 명령과 일관된 Undo 상태', () => {
  const getSampleDoc = (): UIVisualDocument => createDefaultUIVisualDocument();

  describe('1. VisualEditorSession 초기화 및 불변 문서 관찰', () => {
    it('초기 세션은 baseline과 동일하며 dirty=false, revision=0, 빈 history를 가진다', () => {
      const doc = getSampleDoc();
      const session = createVisualSession(doc, 'menu_main');

      expect(session.activePageId).toBe('menu_main');
      expect(session.revision).toBe(0);
      expect(session.dirty).toBe(false);
      expect(session.historyCount).toBe(0);
      expect(session.undo).toHaveLength(0);
      expect(session.redo).toHaveLength(0);
      expect(session.draft).toBeNull();
      expect(session.selectedElementIds).toEqual([]);
      expect(isVisualDocEqual(session.present, session.baseline)).toBe(true);
    });

    it('지정하지 않으면 activePageId는 menu_main으로 기본 설정된다', () => {
      const doc = getSampleDoc();
      const session = createVisualSession(doc);
      expect(session.activePageId).toBe('menu_main');
    });
  });

  describe('2. 원자적 Visual Command 지원 및 속성/크기/그룹 변경', () => {
    it('set-element-prop으로 텍스트 및 액션을 변경하고 Undo/Redo가 정상 동작한다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      const initialText = session.present.pages.menu_main.elements.find(
        (e) => e.id === 'card-story'
      )?.text;

      // 텍스트 속성 변경
      session = setVisualElementProp(session, 'card-story', 'text', '새로운 스토리 모드');
      expect(session.revision).toBe(1);
      expect(session.dirty).toBe(true);
      expect(session.historyCount).toBe(1);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')?.text
      ).toBe('새로운 스토리 모드');

      // Undo
      session = undoVisual(session);
      expect(session.revision).toBe(2);
      expect(session.dirty).toBe(false);
      expect(session.historyCount).toBe(0);
      expect(session.redo).toHaveLength(1);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')?.text
      ).toBe(initialText);

      // Redo
      session = redoVisual(session);
      expect(session.revision).toBe(3);
      expect(session.dirty).toBe(true);
      expect(session.historyCount).toBe(1);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')?.text
      ).toBe('새로운 스토리 모드');
    });

    it('resize-element로 요소 크기를 변경하고 복원한다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      const originalBounds = session.present.pages.menu_main.elements.find(
        (e) => e.id === 'card-story'
      )!.bounds;

      const newBounds = { ...originalBounds, width: 500, height: 300 };
      session = resizeVisualElement(session, 'card-story', newBounds);

      expect(session.dirty).toBe(true);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds
      ).toEqual(newBounds);

      session = undoVisual(session);
      expect(session.dirty).toBe(false);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds
      ).toEqual(originalBounds);
    });

    it('set-element-group으로 그룹을 설정하고 복원한다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = setVisualElementGroup(session, 'card-story', 'main-card-group');
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.groupId
      ).toBe('main-card-group');

      session = undoVisual(session);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.groupId
      ).toBeUndefined();
    });
  });

  describe('3. 다중 선택 요소(텍스트 + 이미지 등) 동시 이동 및 한 번의 Undo 복원', () => {
    it('다중 요소를 (dx, dy) 이동 시 단 한 번의 Undo로 모든 요소의 위치가 원래대로 복원된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      const card1 = session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!;
      const card2 = session.present.pages.menu_main.elements.find((e) => e.id === 'card-play')!;

      const initialPos1 = { x: card1.bounds.x, y: card1.bounds.y };
      const initialPos2 = { x: card2.bounds.x, y: card2.bounds.y };

      // 두 요소 선택 후 이동
      session = selectVisualElements(session, ['card-story', 'card-play']);
      session = moveSelectedElements(session, { dx: 45, dy: 60 });

      expect(session.historyCount).toBe(1);
      expect(session.dirty).toBe(true);

      const moved1 = session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!;
      const moved2 = session.present.pages.menu_main.elements.find((e) => e.id === 'card-play')!;
      expect(moved1.bounds.x).toBe(initialPos1.x + 45);
      expect(moved1.bounds.y).toBe(initialPos1.y + 60);
      expect(moved2.bounds.x).toBe(initialPos2.x + 45);
      expect(moved2.bounds.y).toBe(initialPos2.y + 60);

      // 단 한 번의 Undo로 둘 다 원위치 복원
      session = undoVisual(session);
      expect(session.historyCount).toBe(0);
      expect(session.dirty).toBe(false);

      const restored1 = session.present.pages.menu_main.elements.find(
        (e) => e.id === 'card-story'
      )!;
      const restored2 = session.present.pages.menu_main.elements.find((e) => e.id === 'card-play')!;
      expect(restored1.bounds.x).toBe(initialPos1.x);
      expect(restored1.bounds.y).toBe(initialPos1.y);
      expect(restored2.bounds.x).toBe(initialPos2.x);
      expect(restored2.bounds.y).toBe(initialPos2.y);
    });
  });

  describe('4. 드래그 draft 관리 (임시 상태 격리 및 no-op 커밋 차단)', () => {
    it('드래그 중 updateVisualDrag는 history를 증가시키지 않으며 draft에만 반영된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = beginVisualDrag(session, ['card-story']);
      expect(session.draft).not.toBeNull();
      expect(session.historyCount).toBe(0);

      session = updateVisualDrag(session, { dx: 100, dy: 100 });
      expect(session.historyCount).toBe(0);
      // present는 변경되지 않음
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds.x
      ).toBe(90);
      // draft는 변경됨
      expect(
        session.draft!.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds.x
      ).toBe(190);

      // commit 시점에 단 1회 history 추가
      session = commitVisualDrag(session);
      expect(session.draft).toBeNull();
      expect(session.historyCount).toBe(1);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds.x
      ).toBe(190);
    });

    it('cancelVisualDrag 시 draft가 버려지고 history 카운트는 0이다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = beginVisualDrag(session, ['card-story']);
      session = updateVisualDrag(session, { dx: 120, dy: 80 });
      session = cancelVisualDrag(session);

      expect(session.draft).toBeNull();
      expect(session.historyCount).toBe(0);
      expect(session.dirty).toBe(false);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds.x
      ).toBe(90);
    });

    it('위치 변경이 없는 no-op commitVisualDrag는 history 카운트가 0이다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = beginVisualDrag(session, ['card-story']);
      session = updateVisualDrag(session, { dx: 0, dy: 0 }); // 제자리
      session = commitVisualDrag(session);

      expect(session.draft).toBeNull();
      expect(session.historyCount).toBe(0);
      expect(session.dirty).toBe(false);
    });
  });

  describe('5. 순차적 명령(속성 -> 드래그 -> 정렬 -> 속성) 후 Undo-Redo 왕복 동일성', () => {
    it('순차 명령 후 baseline까지 Undo 왕복 및 다시 Redo 시 완전히 동일한 문서로 복원된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');
      const baselineSnapshot = JSON.parse(JSON.stringify(session.present));

      // 1. 속성 변경 (name)
      session = setVisualElementProp(session, 'card-story', 'name', '커스텀 스토리 버튼');

      // 2. 드래그 이동
      session = beginVisualDrag(session, ['card-story']);
      session = updateVisualDrag(session, { dx: 30, dy: 40 });
      session = commitVisualDrag(session);

      // 3. 정렬 (align-top)
      session = selectVisualElements(session, ['card-story', 'card-play']);
      session = alignVisualElements(session, 'top');

      // 4. 추가 속성 변경 (assetId)
      session = setVisualElementProp(session, 'card-play', 'assetId', 'custom-play-icon');

      expect(session.historyCount).toBe(4);
      expect(session.dirty).toBe(true);
      const after4OpsSnapshot = JSON.parse(JSON.stringify(session.present));

      // 4회 Undo -> baseline으로 복귀
      session = undoVisual(session);
      session = undoVisual(session);
      session = undoVisual(session);
      session = undoVisual(session);

      expect(session.historyCount).toBe(0);
      expect(session.dirty).toBe(false);
      expect(isVisualDocEqual(session.present, baselineSnapshot)).toBe(true);

      // 4회 Redo -> 다시 after4Ops 상태로 복원
      session = redoVisual(session);
      session = redoVisual(session);
      session = redoVisual(session);
      session = redoVisual(session);

      expect(session.historyCount).toBe(4);
      expect(session.dirty).toBe(true);
      expect(isVisualDocEqual(session.present, after4OpsSnapshot)).toBe(true);
    });

    it('Undo 후 새로운 명령 실행 시 Redo 스택은 즉시 삭제된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = setVisualElementProp(session, 'card-story', 'name', '이름 1');
      session = setVisualElementProp(session, 'card-story', 'name', '이름 2');
      expect(session.historyCount).toBe(2);

      session = undoVisual(session);
      expect(session.redo).toHaveLength(1);

      // 새로운 명령 실행
      session = setVisualElementProp(session, 'card-story', 'name', '이름 3');
      expect(session.redo).toHaveLength(0);
      expect(session.historyCount).toBe(2);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')?.name
      ).toBe('이름 3');
    });
  });

  describe('6. 페이지 전환 및 프로젝트 교체 유효성 검증', () => {
    it('페이지 전환 시 대상 페이지에 없는 선택 요소는 자동으로 선택 해제된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = selectVisualElements(session, ['card-story', 'card-play']);
      expect(session.selectedElementIds).toEqual(['card-story', 'card-play']);

      // pause 페이지로 전환 (card-story, card-play 없음)
      session = switchVisualPage(session, 'pause');
      expect(session.activePageId).toBe('pause');
      expect(session.selectedElementIds).toEqual([]);
    });

    it('새 프로젝트/문서 교체 시(loadVisualDocument) stale history가 제거되고 baseline이 갱신된다', () => {
      const doc1 = getSampleDoc();
      let session = createVisualSession(doc1, 'menu_main');

      session = setVisualElementProp(session, 'card-story', 'name', '수정본 1');
      expect(session.dirty).toBe(true);
      expect(session.historyCount).toBe(1);

      const doc2 = getSampleDoc();
      doc2.pages.menu_main.elements[0]!.name = '완전 새로운 프로젝트';

      session = loadVisualDocument(session, doc2, 'project-new');
      expect(session.dirty).toBe(false);
      expect(session.historyCount).toBe(0);
      expect(session.undo).toHaveLength(0);
      expect(session.redo).toHaveLength(0);
      expect(session.present.pages.menu_main.elements[0]!.name).toBe('완전 새로운 프로젝트');
      expect(session.baseline.pages.menu_main.elements[0]!.name).toBe('완전 새로운 프로젝트');
    });

    it('stale command(존재하지 않는 요소 조작)는 차단된다', () => {
      const doc = getSampleDoc();
      const session = createVisualSession(doc, 'menu_main');

      const invalidCommand: VisualCommand = {
        id: 'cmd-stale',
        type: 'set-element-prop',
        pageId: 'menu_main',
        elementId: 'ghost-non-existent-id',
        prop: 'name',
        before: 'a',
        after: 'b',
      };

      expect(() => executeVisualCommand(session, invalidCommand)).toThrow();
    });

    it('stale command: 다른 세션 docId의 명령은 실행이 차단된다', () => {
      const doc = getSampleDoc();
      const session = createVisualSession(doc, 'menu_main', 'session-alpha');

      const foreignCommand: VisualCommand = {
        id: 'cmd-foreign',
        docId: 'session-beta', // 불일치
        type: 'set-element-prop',
        pageId: 'menu_main',
        elementId: 'card-story',
        prop: 'name',
        before: '이전',
        after: '이후',
      };

      expect(() => executeVisualCommand(session, foreignCommand)).toThrow(/stale/i);
    });

    it('드래그 중 undo 실행 시 열린 draft가 버려지고 undo가 정상 수행된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = setVisualElementProp(session, 'card-story', 'name', '최초 수정');
      expect(session.historyCount).toBe(1);

      // 드래그 시작 후 미확정 상태
      session = beginVisualDrag(session, ['card-story']);
      session = updateVisualDrag(session, { dx: 150, dy: 150 });
      expect(session.draft).not.toBeNull();

      // Undo 호출
      session = undoVisual(session);
      expect(session.draft).toBeNull();
      expect(session.dragDraft).toBeNull();
      expect(session.historyCount).toBe(0);
      expect(session.dirty).toBe(false);
    });

    it('beginVisualDrag 후 updateVisualDrag 없이 바로 commit 시 0 이동이므로 historyCount 0 유지', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = beginVisualDrag(session, ['card-story']);
      session = commitVisualDrag(session);

      expect(session.draft).toBeNull();
      expect(session.dragDraft).toBeNull();
      expect(session.historyCount).toBe(0);
      expect(session.dirty).toBe(false);
    });

    it('서로 다른 타입의 요소(버튼 + 텍스트)를 다중 이동 후 단 한 번의 Undo로 복원된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      // menu_main의 카드(card-story)와 워크아웃 버튼(menu-workout-btn) 동시 이동
      const cardStory = session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!;
      const workoutBtn = session.present.pages.menu_main.elements.find((e) => e.id === 'menu-workout-btn')!;

      const initStoryX = cardStory.bounds.x;
      const initWorkoutX = workoutBtn.bounds.x;

      session = selectVisualElements(session, ['card-story', 'menu-workout-btn']);
      session = moveSelectedElements(session, { dx: 70, dy: -50 });

      expect(session.historyCount).toBe(1);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds.x
      ).toBe(initStoryX + 70);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'menu-workout-btn')!.bounds.x
      ).toBe(initWorkoutX + 70);

      // 1회 Undo로 둘 다 완벽 복원
      session = undoVisual(session);
      expect(session.historyCount).toBe(0);
      expect(session.dirty).toBe(false);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds.x
      ).toBe(initStoryX);
      expect(
        session.present.pages.menu_main.elements.find((e) => e.id === 'menu-workout-btn')!.bounds.x
      ).toBe(initWorkoutX);
    });

    it('HISTORY_LIMIT(100) 초과 시 가장 오래된 히스토리가 폐기된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      for (let i = 0; i < 105; i++) {
        session = setVisualElementProp(session, 'card-story', 'name', `이름_${i}`);
      }

      expect(session.historyCount).toBe(100);
      expect(session.undo).toHaveLength(100);
    });
  });

  describe('7. 잠금(isLocked) 요소 보호', () => {
    it('isLocked=true인 요소(신체 실루엣 등)는 이동이나 크기 변경이 차단된다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'ready_position');

      const lockedElem = session.present.pages.ready_position.elements.find(
        (e) => e.id === 'ready-silhouette'
      )!;
      expect(lockedElem.isLocked).toBe(true);

      // 잠금 요소 드래그 시도 차단
      expect(() => beginVisualDrag(session, ['ready-silhouette'])).toThrow(/locked/i);

      // 잠금 요소 resize 시도 차단
      expect(() =>
        resizeVisualElement(session, 'ready-silhouette', { x: 0, y: 0, width: 100, height: 100 })
      ).toThrow(/locked/i);
    });
  });

  describe('8. 기존 MenuDoc 기반 API 100% 회귀 없음 (호환성 검증)', () => {
    it('기존 createSession, beginDrag, commitDrag, undo, redo가 정상 동작한다', () => {
      const menuDoc = {
        cards: [
          { id: 'card-1', x: 10, y: 20 },
          { id: 'card-2', x: 50, y: 60 },
        ],
        width: 400,
        height: 250,
      };

      let session = createSession('legacy-menu', menuDoc);
      expect(session.dirty).toBe(false);
      expect(session.revision).toBe(0);

      session = beginDrag(session, 'card-1', { x: 30, y: 40 });
      session = commitDrag(session);
      expect(session.dirty).toBe(true);
      expect(session.present.cards[0]!.x).toBe(30);
      expect(session.present.cards[0]!.y).toBe(40);

      session = undo(session);
      expect(session.dirty).toBe(false);
      expect(session.present.cards[0]!.x).toBe(10);
      expect(session.present.cards[0]!.y).toBe(20);

      session = redo(session);
      expect(session.dirty).toBe(true);
      expect(session.present.cards[0]!.x).toBe(30);
      expect(session.present.cards[0]!.y).toBe(40);
    });

    it('다형적 undo/redo 함수가 VisualEditorSession도 지원한다', () => {
      const doc = getSampleDoc();
      let session = createVisualSession(doc, 'menu_main');

      session = setVisualElementProp(session, 'card-story', 'name', '테스트');
      expect(session.dirty).toBe(true);

      // 다형적 undo 호출
      session = undo(session) as VisualEditorSession;
      expect(session.dirty).toBe(false);

      // 다형적 redo 호출
      session = redo(session) as VisualEditorSession;
      expect(session.dirty).toBe(true);
    });

    it('moveVisualElements 및 resetVisualSession 팩토리가 정상 동작하고 VisualMoveElementsCommand가 생성된다', () => {
      const doc = getSampleDoc();
      let session = resetVisualSession(doc, 'menu_main', 'reset-session');
      expect(session.sessionId).toBe('reset-session');
      expect(session.activePageId).toBe('menu_main');

      session = moveVisualElements(session, ['card-story'], { dx: 15, dy: 25 });
      expect(session.historyCount).toBe(1);

      const lastCommand = session.undo[session.undo.length - 1] as VisualMoveElementsCommand;
      expect(lastCommand.type).toBe('move-elements');
      expect(lastCommand.moves).toHaveLength(1);
      expect(lastCommand.moves[0]!.elementId).toBe('card-story');
      expect(lastCommand.moves[0]!.after.x).toBe(lastCommand.moves[0]!.before.x + 15);
      expect(lastCommand.moves[0]!.after.y).toBe(lastCommand.moves[0]!.before.y + 25);
    });
  });
});
