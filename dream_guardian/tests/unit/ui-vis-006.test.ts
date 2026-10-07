import { describe, expect, it } from 'vitest';
import {
  createDefaultUIVisualDocument,
  type UIVisualDocument,
  type UIVisualElement,
} from '../../src/editor/ui/data/UIVisualDocument';
import {
  inspectElementsProperties,
  findVisualElement,
  findVisualElements,
  isPropertySupportedForType,
  getUnsupportedPropertyReason,
  type ElementInspectionResult,
} from '../../src/editor/ui/data/UIProperties';
import {
  createPropertyPanel,
  setBuffer,
  commit,
  cancelBuffer,
  selectElement,
  type PropertyPanel,
  type CommitResult,
} from '../../src/editor/ui/UIPropertyPanel';
import { BASELINE_REGISTRY } from '../../src/editor/ui/data/UIBaselines';

describe('[Issue #436 / UI-VIS-006] 선택 요소 속성 조회·입력 버퍼 모델', () => {
  const createTestDoc = (): UIVisualDocument => {
    const doc = createDefaultUIVisualDocument();
    // result 화면에 추가 텍스트 및 이미지 요소 배치
    const textEl: UIVisualElement = {
      id: 'txt-summary-title',
      name: '결과 요약 타이틀',
      type: 'text',
      bounds: { x: 120, y: 300, width: 840, height: 60 },
      text: '수호신 승리!',
      fontSize: 36,
    };
    const imgEl: UIVisualElement = {
      id: 'img-summary-badge',
      name: '골드 훈장 이미지',
      type: 'image',
      bounds: { x: 440, y: 400, width: 200, height: 200 },
      assetId: 'badge_victory_gold',
    };
    const lockedEl: UIVisualElement = {
      id: 'hud-core-locked',
      name: '잠금된 시스템 코어',
      type: 'container',
      bounds: { x: 0, y: 0, width: 1080, height: 100 },
      isLocked: true,
      lockReason: 'protected-system-header',
    };
    doc.pages.result.elements.push(textEl, imgEl, lockedEl);
    return doc;
  };

  describe('1. 단일 요소 속성 조회 모델 (10페이지 전역 및 unknown fallback 제거)', () => {
    it('10개 화면 중 result 화면의 요소(button, text, image, container)의 실제 속성을 정상 로드한다', () => {
      const doc = createTestDoc();

      // button 요소 조회
      const btnFound = findVisualElement(doc, 'result-confirm-btn');
      expect(btnFound).not.toBeNull();
      expect(btnFound?.pageId).toBe('result');
      expect(btnFound?.element.bounds).toEqual({ x: 340, y: 1240, width: 400, height: 100 });

      // 다중 요소 일괄 조회 (findVisualElements)
      const batchFound = findVisualElements(doc, ['result-confirm-btn', 'txt-summary-title']);
      expect(batchFound).toHaveLength(2);
      expect(batchFound[0].element.id).toBe('result-confirm-btn');
      expect(batchFound[1].element.id).toBe('txt-summary-title');

      // text 요소 조회 (문구 text, fontSize 확인)
      const textFound = findVisualElement(doc, 'txt-summary-title');
      expect(textFound).not.toBeNull();
      expect(textFound?.element.text).toBe('수호신 승리!');
      expect(textFound?.element.fontSize).toBe(36);

      // image 요소 조회 (assetId 확인)
      const imgFound = findVisualElement(doc, 'img-summary-badge');
      expect(imgFound).not.toBeNull();
      expect(imgFound?.element.assetId).toBe('badge_victory_gold');

      // boss_climax 화면의 요소 정상 조회
      const bossHpFound = findVisualElement(doc, 'hud-boss-hp-bar');
      expect(bossHpFound).not.toBeNull();
      expect(bossHpFound?.pageId).toBe('boss_climax');
      expect(bossHpFound?.element.bounds.width).toBe(320);
    });

    it('알 수 없는 ID(unknown ID) 전달 시 첫 카드(cards[0])로의 대체 fallback이 0건이어야 하고 오류/빈 선택으로 처리한다', () => {
      const doc = createTestDoc();

      // UIProperties 검사기에서 unknown ID 조회 시
      const inspection: ElementInspectionResult = inspectElementsProperties({
        doc,
        selectedIds: ['completely-unknown-id'],
      });
      expect(inspection.isValidSelection).toBe(false);
      expect(inspection.error?.code).toBe('unknown-id');
      expect(inspection.x.value).toBeNull();
      expect(inspection.y.value).toBeNull();

      // PropertyPanel 생성 시 unknown ID 전달 시 cards[0] 값(90, 350 등)이 노출되지 않고 에러 상태가 된다
      const panel: PropertyPanel = createPropertyPanel({
        selectedId: 'unknown-element-xyz',
        baseline: BASELINE_REGISTRY.preset,
        current: BASELINE_REGISTRY.preset,
      });
      expect(panel.error).not.toBeNull();
      expect(panel.error?.message).toBe('unknown-id');
      // 첫 카드인 card-story (x: 90, y: 350)의 값이 buffer에 노출되지 않아야 함
      expect(panel.buffer.x).not.toBe('90');
      expect(panel.buffer.y).not.toBe('350');
      expect(panel.preview.x).toBe(0);
      expect(panel.preview.y).toBe(0);
    });

    it('선택 시 렌더러 기준값(baseline)이 아닌 현재 문서의 override 값을 읽는다', () => {
      const doc = createTestDoc();
      // baseline에서는 card-story의 x가 90이지만, 현재 문서에서 350으로 override
      const cardStory = doc.pages.menu_main.elements.find((e) => e.id === 'card-story')!;
      cardStory.bounds.x = 350;

      const inspection = inspectElementsProperties({
        doc,
        selectedIds: ['card-story'],
        activePageId: 'menu_main',
      });
      expect(inspection.isValidSelection).toBe(true);
      expect(inspection.x.value).toBe(350);
      expect(inspection.x.isMixed).toBe(false);
    });
  });

  describe('2. 다중 선택(Multi-selection) 속성 조회 및 요소 유형별 지원·잠금 판정', () => {
    it('다중 선택 시 동일한 값은 해당 값을, 서로 다른 값은 "mixed"를 반환한다', () => {
      const doc = createTestDoc();
      // card-story: bounds { x: 90, y: 350, width: 420, height: 260 }
      // card-play: bounds { x: 570, y: 350, width: 420, height: 260 }
      // 둘 다 y는 350, width는 420, height는 260으로 동일, x만 90 vs 570으로 다름
      const inspection = inspectElementsProperties({
        doc,
        selectedIds: ['card-story', 'card-play'],
        activePageId: 'menu_main',
      });

      expect(inspection.isValidSelection).toBe(true);
      expect(inspection.count).toBe(2);

      // x는 다르므로 mixed
      expect(inspection.x.isMixed).toBe(true);
      expect(inspection.x.value).toBe('mixed');

      // y, width, height는 동일하므로 공통 값 반환
      expect(inspection.y.isMixed).toBe(false);
      expect(inspection.y.value).toBe(350);
      expect(inspection.width.isMixed).toBe(false);
      expect(inspection.width.value).toBe(420);
      expect(inspection.height.isMixed).toBe(false);
      expect(inspection.height.value).toBe(260);
    });

    it('요소 유형별(text vs image) 지원 속성과 미지원 사유를 정확히 판정한다', () => {
      expect(isPropertySupportedForType('text', 'text')).toBe(true);
      expect(isPropertySupportedForType('text', 'fontSize')).toBe(true);
      expect(isPropertySupportedForType('text', 'assetId')).toBe(false);
      expect(getUnsupportedPropertyReason('text', 'assetId')).toBe('text-element-does-not-support-asset');

      expect(isPropertySupportedForType('image', 'assetId')).toBe(true);
      expect(isPropertySupportedForType('image', 'text')).toBe(false);
      expect(isPropertySupportedForType('image', 'fontSize')).toBe(false);
      expect(getUnsupportedPropertyReason('image', 'text')).toBe('image-element-does-not-support-text');
      expect(getUnsupportedPropertyReason('image', 'fontSize')).toBe('image-element-does-not-support-fontSize');
    });

    it('텍스트와 이미지를 동시 선택한 경우 혼합 속성 지원 여부 및 unsupported 사유를 반환한다', () => {
      const doc = createTestDoc();
      const inspection = inspectElementsProperties({
        doc,
        selectedIds: ['txt-summary-title', 'img-summary-badge'],
        activePageId: 'result',
      });

      expect(inspection.isValidSelection).toBe(true);
      // bounds(x, y, w, h)는 둘 다 지원
      expect(inspection.x.supported).toBe(true);
      expect(inspection.width.supported).toBe(true);

      // text와 assetId는 한쪽만 지원하므로 다중 선택에서는 지원 불가 판정
      expect(inspection.text.supported).toBe(false);
      expect(inspection.text.unsupportedReason).toBeDefined();
      expect(inspection.assetId.supported).toBe(false);
      expect(inspection.assetId.unsupportedReason).toBeDefined();
    });

    it('잠금 요소 또는 보호 영역 요소의 경우 isLocked=true 및 잠금 사유를 반환하고 수정을 비활성화한다', () => {
      const doc = createTestDoc();
      const inspection = inspectElementsProperties({
        doc,
        selectedIds: ['hud-core-locked'],
        activePageId: 'result',
      });

      expect(inspection.isValidSelection).toBe(true);
      expect(inspection.x.isLocked).toBe(true);
      expect(inspection.x.lockReason).toBe('protected-system-header');
      expect(inspection.x.editable).toBe(false);
    });
  });

  describe('3. 입력 버퍼(Input Buffer) 모델 및 확정·취소·수치 보존', () => {
    it('편집 중 임시 문자열 버퍼와 유효 문서를 엄격히 분리한다 (setBuffer 시 문서 변경 없음)', () => {
      const doc = createTestDoc();
      const initialX = doc.pages.menu_main.elements.find((e) => e.id === 'card-story')!.bounds.x;

      let panel = createPropertyPanel({
        selectedId: 'card-story',
        document: doc,
        activePageId: 'menu_main',
        baseline: BASELINE_REGISTRY.preset,
        current: BASELINE_REGISTRY.preset,
      });

      // 입력 버퍼 변경
      panel = setBuffer(panel, 'x', '220');

      // 버퍼와 프리뷰는 변경되었으나 원본 문서의 값은 변경되지 않아야 함
      expect(panel.buffer.x).toBe('220');
      expect(panel.preview.x).toBe(220);
      const docElement = doc.pages.menu_main.elements.find((e) => e.id === 'card-story')!;
      expect(docElement.bounds.x).toBe(initialX);
    });

    it('Enter 또는 blur 확정 시에만 단일 명령을 발행하고, Enter 직후 blur 발생 시 중복 명령을 방지한다', () => {
      const doc = createTestDoc();
      let panel = createPropertyPanel({
        selectedId: 'card-story',
        document: doc,
        activePageId: 'menu_main',
        baseline: BASELINE_REGISTRY.preset,
        current: BASELINE_REGISTRY.preset,
      });

      panel = setBuffer(panel, 'x', '150');

      // 1) Enter 확정 -> 단일 명령 발행
      const enterResult: CommitResult = commit(panel, { reason: 'enter' });
      expect(enterResult.command).not.toBeNull();
      expect(enterResult.command?.field).toBe('x');
      expect(enterResult.command?.value).toBe(150);

      // 2) 곧이어 blur 발생 -> 이미 확정되었으므로 중복 명령(null)이어야 함
      const blurResult: CommitResult = commit(enterResult.panel, { reason: 'blur' });
      expect(blurResult.command).toBeNull();
    });

    it('Escape 키(cancelBuffer) 호출 시 임시 편집을 취소하고 이전 확정 값으로 복원한다', () => {
      const doc = createTestDoc();
      let panel = createPropertyPanel({
        selectedId: 'card-story',
        document: doc,
        activePageId: 'menu_main',
        baseline: BASELINE_REGISTRY.preset,
        current: BASELINE_REGISTRY.preset,
      });

      const originalX = panel.buffer.x;
      panel = setBuffer(panel, 'x', '999');
      expect(panel.buffer.x).toBe('999');

      // Escape 취소
      panel = cancelBuffer(panel, 'x');
      expect(panel.buffer.x).toBe(originalX);
      expect(panel.preview.x).toBe(Number(originalX));
      expect(panel.error).toBeNull();
    });

    it('잘못된 숫자(NaN, 부분 입력 "-", 음수, 초과치)는 에러를 표시하고 commit을 거부하여 문서를 변경하지 않는다', () => {
      const doc = createTestDoc();
      let panel = createPropertyPanel({
        selectedId: 'card-story',
        document: doc,
        activePageId: 'menu_main',
        baseline: BASELINE_REGISTRY.preset,
        current: BASELINE_REGISTRY.preset,
      });

      // 1) 문자열 NaN 입력
      panel = setBuffer(panel, 'x', 'invalid-num');
      expect(panel.error).not.toBeNull();
      expect(panel.error?.message).toBe('invalid number');
      let res = commit(panel, { reason: 'enter' });
      expect(res.command).toBeNull();

      // 2) 부분 입력 "-"
      panel = setBuffer(panel, 'x', '-');
      expect(panel.error).not.toBeNull();
      res = commit(panel, { reason: 'enter' });
      expect(res.command).toBeNull();

      // 3) 음수 입력
      panel = setBuffer(panel, 'x', '-50');
      expect(panel.error).not.toBeNull();
      res = commit(panel, { reason: 'enter' });
      expect(res.command).toBeNull();
    });

    it('정확한 소수점 수치(123.456) 입력 시 강제 snap(반올림) 없이 소수점 수치를 그대로 보존한다', () => {
      const doc = createTestDoc();
      let panel = createPropertyPanel({
        selectedId: 'card-story',
        document: doc,
        activePageId: 'menu_main',
        baseline: BASELINE_REGISTRY.preset,
        current: BASELINE_REGISTRY.preset,
      });

      panel = setBuffer(panel, 'x', '123.456');
      expect(panel.error).toBeNull();
      expect(panel.preview.x).toBe(123.456);

      const result = commit(panel, { reason: 'enter' });
      expect(result.command).not.toBeNull();
      expect(result.command?.value).toBe(123.456);
      expect(result.panel.buffer.x).toBe('123.456');
    });

    it('요소 편집 중 선택 변경 시 이전 요소의 미확정/오류 버퍼가 새 요소로 오염되지 않고 새 요소의 값으로 초기화된다', () => {
      const doc = createTestDoc();
      let panel = createPropertyPanel({
        selectedId: 'card-story',
        document: doc,
        activePageId: 'menu_main',
        baseline: BASELINE_REGISTRY.preset,
        current: BASELINE_REGISTRY.preset,
      });

      // card-story 편집 중 에러 발생
      panel = setBuffer(panel, 'x', 'corrupted-input');
      expect(panel.error).not.toBeNull();

      // card-play로 선택 변경
      panel = selectElement(panel, 'card-play');
      expect(panel.selectedId).toBe('card-play');
      expect(panel.error).toBeNull();
      // card-play의 원래 x값(570)으로 깨끗하게 초기화되어야 함
      expect(panel.buffer.x).toBe('570');
      expect(panel.preview.x).toBe(570);
    });

    it('잠금된 요소(isLocked=true)의 속성 변경 시도 시 거부하고 에러를 반환한다', () => {
      const doc = createTestDoc();
      let panel = createPropertyPanel({
        selectedId: 'hud-core-locked',
        document: doc,
        activePageId: 'result',
        baseline: BASELINE_REGISTRY.preset,
        current: BASELINE_REGISTRY.preset,
      });

      expect(panel.isLocked).toBe(true);
      panel = setBuffer(panel, 'x', '100');
      expect(panel.error).not.toBeNull();
      expect(panel.error?.message).toContain('protected-system-header');

      const result = commit(panel, { reason: 'enter' });
      expect(result.command).toBeNull();
    });
  });
});
