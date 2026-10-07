/**
 * UIVisualMigration.ts - 기존 UI 프로젝트 비파괴 버전 변환 (Issue #433 / UI-VIS-003)
 *
 * 개발 규칙 준수:
 * - 기존 UIX 프로젝트('dream-guardian-ui-project') 및 transfer 문서 판별
 * - 10페이지 UIVisualDocument로의 비파괴 변환
 * - 원본 bytes 및 미지원 속성/scope 보존 (MigrationReport)
 * - 멱등성 및 stable ID 충돌 감지/보고
 * - 미지원 미래 버전 / 손상 JSON 거부
 */

import {
  UI_VISUAL_DOCUMENT_KIND,
  UI_VISUAL_SCHEMA_VERSION,
  UIVisualDocument,
  createDefaultUIVisualDocument,
} from '../data/UIVisualDocument';
import { validateUIVisualDocument } from '../data/UIVisualValidator';
import { KINDS, SCHEMA_VERSION } from '../data/UIContracts';

export interface MigrationWarning {
  code: string;
  message: string;
  path?: string;
}

export interface UnmappedItem {
  key: string;
  sourcePath: string;
  value: unknown;
  reason: string;
}

export interface IDConflict {
  id: string;
  scope: string;
  reason: string;
}

export interface MigrationReport {
  sourceKind: string;
  sourceSchemaVersion: string;
  targetKind: string;
  targetSchemaVersion: string;
  steps: string[];
  warnings: MigrationWarning[];
  unmappedItems: UnmappedItem[];
  conflicts: IDConflict[];
  sourceProjectId?: string;
  sourceScope?: string;
}

export type UIVisualMigrationOk = {
  ok: true;
  document: UIVisualDocument;
  report: MigrationReport;
  originalRaw: string;
};

export type UIVisualMigrationFail = {
  ok: false;
  reason: string;
  report?: MigrationReport;
  originalRaw: string;
  document?: undefined;
  errors?: string[];
};

export type UIVisualMigrationResult = UIVisualMigrationOk | UIVisualMigrationFail;

function parseSemVer(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function compareSemVer(v1: string, v2: string): number {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);
  if (!p1 || !p2) {
    return v1.localeCompare(v2);
  }
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

const SUPPORTED_SOURCE_KINDS = new Set([
  UI_VISUAL_DOCUMENT_KIND,
  KINDS.project,
  KINDS.transfer,
]);

const KNOWN_ROOT_KEYS = new Set([
  'kind',
  'schemaVersion',
  'version',
  'design',
  'menu',
  'baseline',
  'projectId',
  'scope',
  'screen',
  'content',
  'contentHash',
  'artifactHash',
  'sourceCheckpointHash',
  'sourceComparison',
  'styleVersion',
]);

const STANDARD_CARD_FIELDS = new Set(['id', 'x', 'y', 'width', 'height', 'text', 'name']);
const STANDARD_WORKOUT_FIELDS = new Set(['x', 'y', 'width', 'height', 'text', 'name']);
const STANDARD_MENU_FIELDS = new Set(['cards', 'width', 'height', 'workoutButton']);

/**
 * 기존 UIX 프로젝트, UI transfer, 또는 visual doc 문자열을 새 UIVisualDocument로 안전하게 변환
 */
export function migrateToUIVisualDocument(raw: string): UIVisualMigrationResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return {
      ok: false,
      reason: 'Empty input or invalid JSON format',
      originalRaw: raw ?? '',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    return {
      ok: false,
      reason: `Failed to parse JSON: ${err?.message ?? 'syntax error'}`,
      originalRaw: raw,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: 'Root value must be an object (not an array or primitive)',
      originalRaw: raw,
    };
  }

  const doc = parsed as Record<string, unknown>;

  // 1. Kind 및 Version 파악
  const kind = typeof doc.kind === 'string' ? doc.kind : undefined;
  const isStyleTransfer = doc.scope === 'style-resources' || typeof doc.styleVersion === 'string';

  if (!kind && !isStyleTransfer) {
    return {
      ok: false,
      reason: 'Missing or unknown kind in document',
      originalRaw: raw,
    };
  }

  if (kind && !SUPPORTED_SOURCE_KINDS.has(kind as any) && !isStyleTransfer) {
    return {
      ok: false,
      reason: `Unsupported document kind: ${kind}`,
      originalRaw: raw,
    };
  }

  const rawVersion = (doc.schemaVersion ?? doc.version ?? doc.styleVersion ?? SCHEMA_VERSION) as string;
  if (typeof rawVersion !== 'string') {
    return {
      ok: false,
      reason: 'Invalid schemaVersion format',
      originalRaw: raw,
    };
  }

  if (compareSemVer(rawVersion, '1.0.0') > 0) {
    return {
      ok: false,
      reason: `Unsupported future schemaVersion: ${rawVersion}`,
      originalRaw: raw,
    };
  }

  // 2. 이미 UIVisualDocument 규격인 경우 직행 검증
  if (kind === UI_VISUAL_DOCUMENT_KIND) {
    if (rawVersion !== UI_VISUAL_SCHEMA_VERSION) {
      return {
        ok: false,
        reason: `Unsupported schemaVersion for UIVisualDocument: ${rawVersion}`,
        originalRaw: raw,
      };
    }

    const validation = validateUIVisualDocument(doc as unknown as UIVisualDocument);
    if (!validation.valid) {
      return {
        ok: false,
        reason: `Validation failed for UIVisualDocument: ${validation.errors.map((e) => `${e.code}: ${e.message}`).join(', ')}`,
        errors: validation.errors.map((e) => e.message),
        originalRaw: raw,
      };
    }

    const report: MigrationReport = {
      sourceKind: UI_VISUAL_DOCUMENT_KIND,
      sourceSchemaVersion: UI_VISUAL_SCHEMA_VERSION,
      targetKind: UI_VISUAL_DOCUMENT_KIND,
      targetSchemaVersion: UI_VISUAL_SCHEMA_VERSION,
      steps: ['parse', 'validate_direct_pass'],
      warnings: [],
      unmappedItems: [],
      conflicts: [],
    };

    return {
      ok: true,
      document: JSON.parse(raw) as UIVisualDocument,
      report,
      originalRaw: raw,
    };
  }

  // 3. 레거시 UIX 프로젝트 / Transfer 변환 시작
  const targetDoc = createDefaultUIVisualDocument();

  const report: MigrationReport = {
    sourceKind: kind ?? 'style-transfer',
    sourceSchemaVersion: rawVersion,
    targetKind: UI_VISUAL_DOCUMENT_KIND,
    targetSchemaVersion: UI_VISUAL_SCHEMA_VERSION,
    steps: ['parse', 'detect_source', 'check_conflicts', 'map_menu', 'collect_unmapped', 'validate'],
    warnings: [],
    unmappedItems: [],
    conflicts: [],
    sourceProjectId: typeof doc.projectId === 'string' ? doc.projectId : undefined,
    sourceScope: typeof doc.scope === 'string' ? doc.scope : typeof doc.screen === 'string' ? doc.screen : undefined,
  };

  // 소스 내 menu 영역 추출
  const menuSource = (
    doc.menu ??
    (doc.scope === 'menu' && doc.content ? doc.content : undefined) ??
    (doc.kind === KINDS.transfer && (doc.content as any)?.cards ? doc.content : undefined)
  ) as Record<string, unknown> | undefined;

  // stable ID 충돌 감지
  if (menuSource && Array.isArray(menuSource.cards)) {
    const seenCardIds = new Set<string>();
    for (let i = 0; i < menuSource.cards.length; i++) {
      const card = menuSource.cards[i];
      if (card && typeof card === 'object' && typeof card.id === 'string') {
        if (seenCardIds.has(card.id)) {
          report.conflicts.push({
            id: card.id,
            scope: `menu.cards[${i}]`,
            reason: `Duplicate element ID detected: ${card.id}`,
          });
        } else {
          seenCardIds.add(card.id);
        }
      }
    }
  }

  // 충돌이 발생한 경우 변환 중단 및 보고서/원본 보존
  if (report.conflicts.length > 0) {
    return {
      ok: false,
      reason: `ID conflict detected: ${report.conflicts.map((c) => c.id).join(', ')}`,
      report,
      originalRaw: raw,
    };
  }

  // menu 요소 매핑
  if (menuSource && typeof menuSource === 'object') {
    const menuPage = targetDoc.pages.menu_main;

    // 카드 목록 매핑
    if (Array.isArray(menuSource.cards)) {
      for (const card of menuSource.cards) {
        if (!card || typeof card !== 'object') continue;
        const cardObj = card as Record<string, unknown>;
        const cardId = typeof cardObj.id === 'string' ? cardObj.id : undefined;
        if (!cardId) continue;

        const el = menuPage.elements.find((e) => e.id === cardId);
        if (el) {
          const w =
            typeof cardObj.width === 'number'
              ? cardObj.width
              : typeof menuSource.width === 'number'
                ? menuSource.width
                : el.bounds.width;
          const h =
            typeof cardObj.height === 'number'
              ? cardObj.height
              : typeof menuSource.height === 'number'
                ? menuSource.height
                : el.bounds.height;
          const x = typeof cardObj.x === 'number' ? cardObj.x : el.bounds.x;
          const y = typeof cardObj.y === 'number' ? cardObj.y : el.bounds.y;

          el.bounds = { x, y, width: w, height: h };
          el.hitBounds = { x, y, width: w, height: h };

          if (typeof cardObj.text === 'string') el.text = cardObj.text;
          if (typeof cardObj.name === 'string') el.name = cardObj.name;

          // 미지원 카드 속성 보존
          for (const [k, v] of Object.entries(cardObj)) {
            if (!STANDARD_CARD_FIELDS.has(k)) {
              report.unmappedItems.push({
                key: k,
                sourcePath: `menu.cards[${cardId}].${k}`,
                value: v,
                reason: `Unmapped attribute on card: ${k}`,
              });
              report.warnings.push({
                code: 'UNMAPPED_CARD_ATTRIBUTE',
                message: `Unmapped attribute '${k}' on card ${cardId}`,
                path: `menu.cards[${cardId}].${k}`,
              });
            }
          }
        } else {
          // 표준 슬롯 외 카드 ID 보존
          report.unmappedItems.push({
            key: cardId,
            sourcePath: `menu.cards[${cardId}]`,
            value: cardObj,
            reason: `Unrecognized card ID: ${cardId}`,
          });
          report.warnings.push({
            code: 'UNRECOGNIZED_CARD_ID',
            message: `Card with ID '${cardId}' could not be mapped to standard menu_main slots`,
            path: `menu.cards[${cardId}]`,
          });
        }
      }
    }

    // 운동 시작 버튼 매핑
    const wb = menuSource.workoutButton as Record<string, unknown> | undefined;
    if (wb && typeof wb === 'object') {
      const workoutEl = menuPage.elements.find((e) => e.id === 'menu-workout-btn');
      if (workoutEl) {
        const x = typeof wb.x === 'number' ? wb.x : workoutEl.bounds.x;
        const y = typeof wb.y === 'number' ? wb.y : workoutEl.bounds.y;
        const w = typeof wb.width === 'number' ? wb.width : workoutEl.bounds.width;
        const h = typeof wb.height === 'number' ? wb.height : workoutEl.bounds.height;

        workoutEl.bounds = { x, y, width: w, height: h };
        workoutEl.hitBounds = { x, y, width: w, height: h };

        if (typeof wb.text === 'string') workoutEl.text = wb.text;
        if (typeof wb.name === 'string') workoutEl.name = wb.name;

        for (const [k, v] of Object.entries(wb)) {
          if (!STANDARD_WORKOUT_FIELDS.has(k)) {
            report.unmappedItems.push({
              key: k,
              sourcePath: `menu.workoutButton.${k}`,
              value: v,
              reason: `Unmapped attribute on workoutButton: ${k}`,
            });
            report.warnings.push({
              code: 'UNMAPPED_WORKOUT_ATTRIBUTE',
              message: `Unmapped attribute '${k}' on workoutButton`,
              path: `menu.workoutButton.${k}`,
            });
          }
        }
      }
    }

    // 메뉴 자체의 미지원 속성 보존
    for (const [k, v] of Object.entries(menuSource)) {
      if (!STANDARD_MENU_FIELDS.has(k)) {
        report.unmappedItems.push({
          key: k,
          sourcePath: `menu.${k}`,
          value: v,
          reason: `Unsupported menu property: ${k}`,
        });
        report.warnings.push({
          code: 'UNSUPPORTED_MENU_PROPERTY',
          message: `Unsupported menu property: ${k}`,
          path: `menu.${k}`,
        });
      }
    }
  }

  // 4. 루트 레벨 미지원 scope 및 속성 보존
  for (const [key, value] of Object.entries(doc)) {
    if (!KNOWN_ROOT_KEYS.has(key)) {
      report.unmappedItems.push({
        key,
        sourcePath: key,
        value,
        reason: `Unsupported root scope or property: ${key}`,
      });
      report.warnings.push({
        code: 'UNSUPPORTED_ROOT_SCOPE',
        message: `Root property/scope '${key}' is preserved in report but not mapped to UIVisualDocument`,
        path: key,
      });
    }
  }

  // 비메뉴 transfer scope 보존
  if (doc.scope && doc.scope !== 'menu') {
    report.unmappedItems.push({
      key: String(doc.scope),
      sourcePath: `content(${doc.scope})`,
      value: doc.content,
      reason: `Unsupported transfer scope: ${doc.scope}`,
    });
    report.warnings.push({
      code: 'UNSUPPORTED_TRANSFER_SCOPE',
      message: `Transfer scope '${doc.scope}' is not directly mapped to menu_main`,
      path: 'scope',
    });
  }

  // 5. 변환된 UIVisualDocument 유효성 최종 검증
  const finalValidation = validateUIVisualDocument(targetDoc);
  if (!finalValidation.valid) {
    return {
      ok: false,
      reason: `Converted document validation failed: ${finalValidation.errors.map((e) => e.message).join('; ')}`,
      report,
      originalRaw: raw,
      errors: finalValidation.errors.map((e) => e.message),
    };
  }

  return {
    ok: true,
    document: targetDoc,
    report,
    originalRaw: raw,
  };
}
