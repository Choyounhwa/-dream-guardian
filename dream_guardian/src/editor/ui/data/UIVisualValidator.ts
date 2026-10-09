/**
 * UIVisualValidator.ts - 10페이지 저작 문서 스키마 검증기 (Issue #432 / UI-VIS-002)
 */

import {
  ALLOWED_VISUAL_ELEMENT_TYPES,
  UIRect,
  UIVisualElement,
  UIVisualGroup,
  UI_VISUAL_CANVAS,
  UI_VISUAL_DOCUMENT_KIND,
  UI_VISUAL_PAGE_IDS,
  UI_VISUAL_SCHEMA_VERSION,
} from './UIVisualDocument';

export interface UIVisualValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface UIVisualValidationResult {
  valid: boolean;
  errors: UIVisualValidationError[];
}

const ALLOWED_ELEMENT_KEYS = new Set([
  'id',
  'name',
  'type',
  'bounds',
  'hitBounds',
  'groupId',
  'actionId',
  'text',
  'assetId',
  'fontSize',
  'dynamicBinding',
  'isLocked',
  'lockReason',
  'isSupported',
  'unsupportedReason',
]);

const FORBIDDEN_GAME_DATA_KEYS = [
  'playerHp',
  'bossHp',
  'hp',
  'combo',
  'damage',
  'mana',
  'score',
  'bpm',
  'questionCsv',
  'charts',
  'phases',
];

const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /data:/i,
  /onerror=/i,
  /onload=/i,
  /eval\(/i,
  /^https?:\/\//i,
];

function isFiniteRect(rect: unknown): rect is UIRect {
  if (!rect || typeof rect !== 'object') return false;
  const r = rect as Record<string, unknown>;
  return (
    typeof r.x === 'number' &&
    Number.isFinite(r.x) &&
    typeof r.y === 'number' &&
    Number.isFinite(r.y) &&
    typeof r.width === 'number' &&
    Number.isFinite(r.width) &&
    r.width >= 0 &&
    typeof r.height === 'number' &&
    Number.isFinite(r.height) &&
    r.height >= 0
  );
}

export function validateUIVisualDocument(doc: unknown): UIVisualValidationResult {
  const errors: UIVisualValidationError[] = [];

  if (!doc || typeof doc !== 'object') {
    return {
      valid: false,
      errors: [{ code: 'INVALID_ROOT', message: '문서가 유효한 객체가 아닙니다.' }],
    };
  }

  const d = doc as Record<string, unknown>;

  // 1. 게임 수치 주입 차단
  for (const key of FORBIDDEN_GAME_DATA_KEYS) {
    if (key in d) {
      errors.push({
        code: 'GAME_DATA_INJECTION',
        message: `게임 런타임 데이터 속성(${key})은 편집 문서에 포함될 수 없습니다.`,
        path: key,
      });
    }
  }

  // 2. kind & schemaVersion
  if (d.kind !== UI_VISUAL_DOCUMENT_KIND) {
    errors.push({
      code: 'UNSUPPORTED_KIND',
      message: `지원되지 않는 visual doc kind입니다: ${String(d.kind)}`,
      path: 'kind',
    });
  }

  if (d.schemaVersion !== UI_VISUAL_SCHEMA_VERSION) {
    errors.push({
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      message: `지원되지 않는 schemaVersion입니다: ${String(d.schemaVersion)}`,
      path: 'schemaVersion',
    });
  }

  // 3. design resolution
  if (
    !d.design ||
    typeof d.design !== 'object' ||
    (d.design as any).width !== UI_VISUAL_CANVAS.width ||
    (d.design as any).height !== UI_VISUAL_CANVAS.height
  ) {
    errors.push({
      code: 'INVALID_DESIGN_SIZE',
      message: '디자인 크기는 1080x2160이어야 합니다.',
      path: 'design',
    });
  }

  // 4. pages 검사
  if (!d.pages || typeof d.pages !== 'object') {
    errors.push({
      code: 'MISSING_PAGES',
      message: 'pages 속성이 누락되었습니다.',
      path: 'pages',
    });
    return { valid: errors.length === 0, errors };
  }

  const pages = d.pages as Record<string, unknown>;
  const presentPageIds = Object.keys(pages);

  for (const requiredPageId of UI_VISUAL_PAGE_IDS) {
    if (!(requiredPageId in pages)) {
      errors.push({
        code: 'MISSING_PAGES',
        message: `필수 페이지 [${requiredPageId}]가 누락되었습니다.`,
        path: `pages.${requiredPageId}`,
      });
    }
  }

  for (const pageKey of presentPageIds) {
    if (!UI_VISUAL_PAGE_IDS.includes(pageKey as any)) {
      errors.push({
        code: 'INVALID_PAGE_ID',
        message: `알 수 없는 페이지 ID입니다: ${pageKey}`,
        path: `pages.${pageKey}`,
      });
    }
  }

  // 5. 각 페이지 및 그룹/요소 검증
  for (const pageKey of presentPageIds) {
    const pageObj = pages[pageKey];
    if (!pageObj || typeof pageObj !== 'object') continue;
    const page = pageObj as Record<string, unknown>;

    // 페이지 내 게임 수치 검사
    for (const key of FORBIDDEN_GAME_DATA_KEYS) {
      if (key in page) {
        errors.push({
          code: 'GAME_DATA_INJECTION',
          message: `페이지 내 게임 수치 속성(${key})은 포함될 수 없습니다.`,
          path: `pages.${pageKey}.${key}`,
        });
      }
    }

    // 그룹 검증 및 Cycle 감지
    const groupMap = new Map<string, UIVisualGroup>();
    if (Array.isArray(page.groups)) {
      for (const g of page.groups as UIVisualGroup[]) {
        if (!g || !g.id) continue;
        if (groupMap.has(g.id)) {
          errors.push({
            code: 'DUPLICATE_GROUP_ID',
            message: `중복된 그룹 ID입니다: ${g.id}`,
            path: `pages.${pageKey}.groups`,
          });
        }
        groupMap.set(g.id, g);
      }

      // Cycle 검사
      for (const g of page.groups as UIVisualGroup[]) {
        const visited = new Set<string>();
        let curr: string | undefined = g.id;
        while (curr) {
          if (visited.has(curr)) {
            errors.push({
              code: 'GROUP_CYCLE_DETECTED',
              message: `그룹 순환 참조가 감지되었습니다: ${g.id}`,
              path: `pages.${pageKey}.groups.${g.id}`,
            });
            break;
          }
          visited.add(curr);
          const parentGroup = groupMap.get(curr);
          curr = parentGroup?.parentGroupId;
        }
      }
    }

    if (!Array.isArray(page.elements)) {
      errors.push({
        code: 'INVALID_ELEMENTS_ARRAY',
        message: 'elements는 배열이어야 합니다.',
        path: `pages.${pageKey}.elements`,
      });
      continue;
    }

    const elements = page.elements as UIVisualElement[];
    const elementIdSet = new Set<string>();

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const elPath = `pages.${pageKey}.elements[${i}]`;

      if (!el || typeof el !== 'object') {
        errors.push({
          code: 'INVALID_ELEMENT',
          message: '요소가 올바른 객체가 아닙니다.',
          path: elPath,
        });
        continue;
      }

      // 닫힌 속성 검사
      for (const prop of Object.keys(el)) {
        if (!ALLOWED_ELEMENT_KEYS.has(prop)) {
          errors.push({
            code: 'UNKNOWN_PROPERTY',
            message: `허용되지 않은 속성 [${prop}]이 포함되어 있습니다.`,
            path: `${elPath}.${prop}`,
          });
        }
      }

      // ID 중복 검사
      if (!el.id || typeof el.id !== 'string') {
        errors.push({
          code: 'MISSING_ELEMENT_ID',
          message: '요소 ID가 누락되었습니다.',
          path: `${elPath}.id`,
        });
      } else {
        if (elementIdSet.has(el.id)) {
          errors.push({
            code: 'DUPLICATE_ELEMENT_ID',
            message: `페이지 내 중복된 element ID입니다: ${el.id}`,
            path: `${elPath}.id`,
          });
        }
        elementIdSet.add(el.id);
      }

      // Type 검사
      if (!ALLOWED_VISUAL_ELEMENT_TYPES.includes(el.type as any)) {
        errors.push({
          code: 'INVALID_ELEMENT_TYPE',
          message: `지원되지 않는 요소 타입입니다: ${String(el.type)}`,
          path: `${elPath}.type`,
        });
      }

      // Bounds 검사
      if (!isFiniteRect(el.bounds)) {
        errors.push({
          code: 'INVALID_BOUNDS',
          message: 'bounds는 유한하고 0 이상의 크기를 가져야 합니다.',
          path: `${elPath}.bounds`,
        });
      }

      // hitBounds display-hit 불일치 검사
      if (el.hitBounds !== undefined) {
        if (!isFiniteRect(el.hitBounds)) {
          errors.push({
            code: 'INVALID_HIT_BOUNDS',
            message: 'hitBounds는 유한하고 0 이상의 크기를 가져야 합니다.',
            path: `${elPath}.hitBounds`,
          });
        } else if (isFiniteRect(el.bounds)) {
          const b = el.bounds;
          const h = el.hitBounds;
          if (
            Math.abs(b.x - h.x) > 0.001 ||
            Math.abs(b.y - h.y) > 0.001 ||
            Math.abs(b.width - h.width) > 0.001 ||
            Math.abs(b.height - h.height) > 0.001
          ) {
            errors.push({
              code: 'DISPLAY_HIT_MISMATCH',
              message: '표시 bounds와 hitBounds가 일치하지 않습니다.',
              path: `${elPath}.hitBounds`,
            });
          }
        }
      }

      // groupId 참조 유효성 검사
      if (el.groupId !== undefined) {
        if (!groupMap.has(el.groupId)) {
          errors.push({
            code: 'INVALID_GROUP_REFERENCE',
            message: `존재하지 않는 그룹 참조입니다: ${el.groupId}`,
            path: `${elPath}.groupId`,
          });
        }
      }

      // 보안 및 스크립트 검사
      if (el.text && typeof el.text === 'string') {
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(el.text)) {
            errors.push({
              code: 'SECURITY_VIOLATION',
              message: '텍스트에 위험한 스크립트 또는 URL 패턴이 포함되어 있습니다.',
              path: `${elPath}.text`,
            });
            break;
          }
        }
      }

      if (el.assetId && typeof el.assetId === 'string') {
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(el.assetId)) {
            errors.push({
              code: 'SECURITY_VIOLATION',
              message: `assetId에 외부 URL 또는 위험한 프로토콜이 포함되어 있습니다: ${el.assetId}`,
              path: `${elPath}.assetId`,
            });
            break;
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
