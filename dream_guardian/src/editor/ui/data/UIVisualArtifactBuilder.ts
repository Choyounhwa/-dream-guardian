/**
 * UIVisualArtifactBuilder.ts - UI 표시 적용본(presentation artifact) 및 전체 백업(full backup) 결정적 생성기
 *
 * Issue #468 / UI-VIS-038:
 * - 저장 checkpoint 기반의 versioned UI presentation artifact (kind: 'dream-guardian-ui-presentation') 생성
 * - 결정적 content/artifact SHA-256 해시 생성 (동일 입력 시 100% 동일 해시)
 * - 10개 정규 페이지 (홈, 서브, 옵션, pause, 시작, 러닝/문제, 답안, 위험, 보스, 결과) 표준 매핑
 * - 편집용 selection/grid/history/groupId/잠금 및 fixture/gameplay stats 필드 100% 누출 차단
 * - 자산 매니페스트 및 검증 바이트 번들 구성
 * - 전체 프로젝트 백업 (kind: 'dream-guardian-ui-backup') 및 이미지 바이트 왕복(round-trip) 직렬화
 */

import {
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_VERSION,
  UI_DESIGN_CANVAS,
  type UIPresentationPageId,
  type UIPresentationDocument,
  type UIPresentationPage,
  type UIPresentationElement,
} from '../../../data/UIPresentation';
import { validateUIPresentationDocument } from '../../../data/UIPresentationValidator';
import {
  UI_VISUAL_PAGE_IDS,
  type UIVisualPageId,
  type UIVisualDocument,
} from './UIVisualDocument';
import { validateUIVisualDocument } from './UIVisualValidator';
import { RENDERER_FINGERPRINT } from './UIBaselines';
import {
  canonicalize,
  contentHash,
  artifactHash,
  sourceCheckpointHash,
} from './UICanonicalJSON';

export {
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_VERSION,
};

export const UI_BACKUP_KIND = 'dream-guardian-ui-backup' as const;
export const UI_BACKUP_SCHEMA_VERSION = '1.0.0' as const;
export const DEFAULT_BASELINE_ID = 'menu-v1' as const;

// -------------------------------------------------------------
// Pure TypeScript FIPS 180-4 SHA-256 for binary bytes (Uint8Array)
// -------------------------------------------------------------
const K_SHA256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export function sha256BytesHex(bytes: Uint8Array): string {
  const len = bytes.length;
  const bitLen = len * 8;

  const blockCount = ((len + 9 + 63) >>> 6);
  const buffer = new Uint8Array(blockCount * 64);
  buffer.set(bytes);
  buffer[len] = 0x80;

  const view = new DataView(buffer.buffer);
  const byteOffset = blockCount * 64 - 8;
  view.setUint32(byteOffset, Math.floor(bitLen / 0x100000000) >>> 0, false);
  view.setUint32(byteOffset + 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const W = new Uint32Array(64);

  for (let b = 0; b < blockCount; b++) {
    const chunkOffset = b * 64;
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(chunkOffset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15];
      const s0 =
        ((w15 >>> 7) | (w15 << 25)) ^
        ((w15 >>> 18) | (w15 << 14)) ^
        (w15 >>> 3);
      const w2 = W[i - 2];
      const s1 =
        ((w2 >>> 17) | (w2 << 15)) ^
        ((w2 >>> 19) | (w2 << 13)) ^
        (w2 >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }

    let a = h0;
    let bReg = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K_SHA256[i] + W[i]) | 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & bReg) ^ (a & c) ^ (bReg & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = bReg;
      bReg = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + bReg) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return (
    toHex(h0) +
    toHex(h1) +
    toHex(h2) +
    toHex(h3) +
    toHex(h4) +
    toHex(h5) +
    toHex(h6) +
    toHex(h7)
  );
}

// -------------------------------------------------------------
// Base64 conversion (Node Buffer & Browser atob/btoa universal)
// -------------------------------------------------------------
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    const ab = new ArrayBuffer(buf.byteLength);
    const view = new Uint8Array(ab);
    view.set(buf);
    return view;
  }
  const binary = atob(base64);
  const len = binary.length;
  const ab = new ArrayBuffer(len);
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// -------------------------------------------------------------
// 10-Page Bidirectional Mapping
// -------------------------------------------------------------
export const EDITOR_PAGE_TO_PRESENTATION_PAGE_MAP: Record<UIVisualPageId, UIPresentationPageId> = Object.freeze({
  menu_main: 'main_home',
  menu_sub: 'submenu',
  settings: 'options',
  pause: 'pause',
  ready_position: 'play_ready',
  run_question: 'running_question',
  answer_select: 'answer_select',
  hazard_evade: 'hazard_evade',
  boss_climax: 'boss_battle',
  result: 'result',
});

export const PRESENTATION_PAGE_TO_EDITOR_PAGE_MAP: Record<UIPresentationPageId, UIVisualPageId> = Object.freeze({
  main_home: 'menu_main',
  submenu: 'menu_sub',
  options: 'settings',
  pause: 'pause',
  play_ready: 'ready_position',
  running_question: 'run_question',
  answer_select: 'answer_select',
  hazard_evade: 'hazard_evade',
  boss_battle: 'boss_climax',
  result: 'result',
});

// Forbidden gameplay data keys
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

export interface VisualArtifactAssetEntry {
  assetId: string;
  contentHash: string;
  mimeType: string;
  byteLength: number;
}

export interface UIPresentationArtifact {
  kind: typeof UI_PRESENTATION_ARTIFACT_KIND;
  version: typeof UI_PRESENTATION_VERSION;
  resolution: { width: number; height: number };
  baseline: string;
  rendererFingerprint: string;
  sourceProjectId: string;
  sourceRevision: number;
  sourceCheckpointId?: string;
  sourceCheckpointHash: string;
  pages: Record<UIPresentationPageId, UIPresentationPage>;
  manifest: {
    assetIds: string[];
    assets?: VisualArtifactAssetEntry[];
  };
  contentHash: string;
  integrity: {
    artifactHash: string;
    algorithm: 'sha256';
  };
}

export interface AssetInputRecord {
  assetId: string;
  contentHash: string;
  durableAssetId?: string;
  mimeType?: string;
  byteLength?: number;
  data?: Uint8Array | ArrayBuffer | string;
  metadata?: Record<string, unknown>;
}

export interface BuildPresentationInput {
  checkpoint:
    | {
        projectId?: string;
        revision?: number;
        checkpointId?: string;
        document?: UIVisualDocument | Record<string, unknown>;
        snapshot?: Record<string, unknown>;
        saved?: boolean;
        isDirty?: boolean;
      }
    | UIVisualDocument;
  projectId?: string;
  revision?: number;
  checkpointId?: string;
  isPublish?: boolean;
  assets?: (VisualArtifactAssetEntry | AssetInputRecord)[];
  rendererFingerprint?: string;
  baseline?: string;
}

export type BuildPresentationResult =
  | {
      ok: true;
      artifact: UIPresentationArtifact;
    }
  | {
      ok: false;
      reason: string;
      errors: string[];
    };

export interface BackupAssetEntry {
  assetId: string;
  contentHash: string;
  durableAssetId?: string;
  mimeType: string;
  byteLength: number;
  dataBase64: string;
  metadata?: Record<string, unknown>;
}

export interface UIProjectBackup {
  kind: typeof UI_BACKUP_KIND;
  schemaVersion: typeof UI_BACKUP_SCHEMA_VERSION;
  projectId: string;
  revision: number;
  createdAt: number;
  generator: string;
  document: UIVisualDocument;
  assets: BackupAssetEntry[];
  contentHash: string;
  integrity: {
    backupHash: string;
    algorithm: 'sha256';
  };
}

export interface BuildBackupInput {
  projectId: string;
  revision: number;
  document: UIVisualDocument;
  assets?: AssetInputRecord[];
  createdAt?: number;
}

export type BuildBackupResult =
  | {
      ok: true;
      backup: UIProjectBackup;
    }
  | {
      ok: false;
      reason: string;
      errors: string[];
    };

export type RestoreBackupResult =
  | {
      ok: true;
      backup: UIProjectBackup;
      document: UIVisualDocument;
      binaryAssets: Map<string, Uint8Array>;
    }
  | {
      ok: false;
      reason: string;
      errors?: string[];
    };

function cleanUndefined<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(cleanUndefined) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = cleanUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function normalizeActionId(actionId: string | undefined): string | undefined {
  if (!actionId) return undefined;
  if (actionId.startsWith('select_sublevel_')) {
    return actionId.replace('select_sublevel_', 'select_chapter_');
  }
  return actionId;
}

function checkForForbiddenGameData(target: unknown): string | null {
  if (!target || typeof target !== 'object') return null;
  const obj = target as Record<string, unknown>;
  for (const key of FORBIDDEN_GAME_DATA_KEYS) {
    if (key in obj) {
      return `GAME_DATA_INJECTION: 게임 런타임 데이터 속성(${key})은 포함될 수 없습니다.`;
    }
  }
  return null;
}

function extractDocument(checkpointInput: BuildPresentationInput['checkpoint']): {
  doc: UIVisualDocument;
  saved?: boolean;
  isDirty?: boolean;
  checkpointId?: string;
  revision?: number;
} {
  const chk = checkpointInput as any;
  let doc: UIVisualDocument;
  let saved: boolean | undefined = undefined;
  let isDirty: boolean | undefined = undefined;
  let checkpointId: string | undefined = undefined;
  let revision: number | undefined = undefined;

  if (chk && typeof chk === 'object') {
    if ('document' in chk && chk.document && typeof chk.document === 'object') {
      doc = chk.document;
      saved = chk.saved;
      isDirty = chk.isDirty;
      checkpointId = chk.checkpointId;
      revision = chk.revision;
    } else if ('snapshot' in chk && chk.snapshot && typeof chk.snapshot === 'object') {
      doc = chk.snapshot;
      saved = chk.saved;
      isDirty = chk.isDirty;
      checkpointId = chk.checkpointId;
      revision = chk.revision;
    } else {
      doc = chk;
      saved = chk.saved;
      isDirty = chk.isDirty;
      checkpointId = chk.checkpointId;
      revision = chk.revision;
    }
  } else {
    doc = chk;
  }

  return { doc, saved, isDirty, checkpointId, revision };
}

/**
 * 저장 checkpoint 기반의 versioned UI presentation artifact를 결정적으로 생성합니다.
 */
export function buildPresentationArtifact(input: BuildPresentationInput): BuildPresentationResult {
  const { doc, saved, isDirty, checkpointId, revision } = extractDocument(input.checkpoint);

  if (!doc || typeof doc !== 'object') {
    return {
      ok: false,
      reason: 'INVALID_DOCUMENT: 문서가 올바른 객체가 아닙니다.',
      errors: ['INVALID_DOCUMENT'],
    };
  }

  // 1. 게시(Publish) 게이트 검사: 미저장 문서 게시 거부
  if (input.isPublish === true) {
    if (saved === false || isDirty === true) {
      return {
        ok: false,
        reason: 'UNSAVED_DOCUMENT_PUBLISH_REJECTED: 저장되지 않았거나(saved=false) 수정 중(isDirty=true)인 문서는 게시할 수 없습니다.',
        errors: ['UNSAVED_DOCUMENT_PUBLISH_REJECTED'],
      };
    }
  }

  // 2. 루트 레벨 게임플레이 / fixture 데이터 검사
  const rootGameDataError = checkForForbiddenGameData(doc);
  if (rootGameDataError) {
    return {
      ok: false,
      reason: rootGameDataError,
      errors: ['GAME_DATA_INJECTION'],
    };
  }

  // 3. Renderer capability 검증
  const rendererFingerprint = input.rendererFingerprint ?? RENDERER_FINGERPRINT;
  if (rendererFingerprint !== RENDERER_FINGERPRINT) {
    return {
      ok: false,
      reason: `UNSUPPORTED_CAPABILITY: 미지원 renderer fingerprint (${rendererFingerprint})입니다.`,
      errors: ['UNSUPPORTED_CAPABILITY'],
    };
  }

  // 4. UIVisualDocument 유효성 검증
  const docValidation = validateUIVisualDocument(doc);
  if (!docValidation.valid) {
    return {
      ok: false,
      reason: docValidation.errors[0]?.message ?? 'INVALID_DOCUMENT',
      errors: docValidation.errors.map((e) => e.code),
    };
  }

  // 5. 10개 정규 페이지 정규화 및 편집용 속성 스트리핑
  const presentationPages: Record<UIPresentationPageId, UIPresentationPage> = {} as any;
  const referencedAssetIds = new Set<string>();

  for (const editorPageId of UI_VISUAL_PAGE_IDS) {
    const presPageId = EDITOR_PAGE_TO_PRESENTATION_PAGE_MAP[editorPageId];
    const editorPage = doc.pages[editorPageId];

    if (!editorPage) {
      return {
        ok: false,
        reason: `MISSING_PAGE: 필수 페이지 [${editorPageId}]가 문서에 없습니다.`,
        errors: ['MISSING_PAGES'],
      };
    }

    const pageGameDataError = checkForForbiddenGameData(editorPage);
    if (pageGameDataError) {
      return {
        ok: false,
        reason: pageGameDataError,
        errors: ['GAME_DATA_INJECTION'],
      };
    }

    const cleanElements: UIPresentationElement[] = [];

    for (const el of editorPage.elements) {
      const elGameDataError = checkForForbiddenGameData(el);
      if (elGameDataError) {
        return {
          ok: false,
          reason: elGameDataError,
          errors: ['GAME_DATA_INJECTION'],
        };
      }

      // 닫힌 속성 허용목록 필터링 (편집 전용 속성 groupId, isLocked, isSupported 등 완전 배제)
      const cleanEl: any = {
        id: el.id,
        name: el.name,
        type: el.type,
        bounds: { ...el.bounds },
      };

      if (el.hitBounds) {
        cleanEl.hitBounds = { ...el.hitBounds };
      } else if (el.type === 'button') {
        cleanEl.hitBounds = { ...el.bounds };
      }

      if (el.actionId !== undefined) cleanEl.actionId = normalizeActionId(el.actionId);
      if (el.text !== undefined) cleanEl.text = el.text;
      if (el.assetId !== undefined) {
        cleanEl.assetId = el.assetId;
        referencedAssetIds.add(el.assetId);
      }
      if (el.fontSize !== undefined) cleanEl.fontSize = el.fontSize;
      if (el.dynamicBinding !== undefined) cleanEl.dynamicBinding = el.dynamicBinding;

      cleanElements.push(cleanEl);
    }

    presentationPages[presPageId] = {
      pageId: presPageId,
      elements: cleanElements,
    };
  }

  // 6. 자산 매니페스트 및 참조 검증
  const sortedAssetIds = Array.from(referencedAssetIds).sort();
  const manifestAssets: VisualArtifactAssetEntry[] = [];

  if (input.assets && input.assets.length > 0) {
    const assetMap = new Map<string, AssetInputRecord | VisualArtifactAssetEntry>();
    for (const a of input.assets) {
      assetMap.set(a.assetId, a);
    }

    for (const assetId of sortedAssetIds) {
      const provided = assetMap.get(assetId);
      if (!provided) {
        return {
          ok: false,
          reason: `MISSING_ASSET: 요소에서 참조하는 자산 [${assetId}]이 누락되었습니다.`,
          errors: ['MISSING_ASSET'],
        };
      }

      // 바이너리 데이터가 제공된 경우 SHA-256 해시 검증
      if ('data' in provided && provided.data) {
        let bytes: Uint8Array;
        if (typeof provided.data === 'string') {
          bytes = new TextEncoder().encode(provided.data);
        } else if (provided.data instanceof Uint8Array) {
          bytes = provided.data;
        } else if (provided.data instanceof ArrayBuffer) {
          bytes = new Uint8Array(provided.data);
        } else {
          bytes = new Uint8Array(0);
        }

        const computedHash = sha256BytesHex(bytes);
        if (computedHash !== provided.contentHash) {
          return {
            ok: false,
            reason: `ASSET_HASH_MISMATCH: 자산 [${assetId}]의 실제 데이터 해시가 불일치합니다.`,
            errors: ['ASSET_HASH_MISMATCH'],
          };
        }
      }

      manifestAssets.push({
        assetId: provided.assetId,
        contentHash: provided.contentHash,
        mimeType: (provided as any).mimeType ?? 'image/png',
        byteLength: (provided as any).byteLength ?? 0,
      });
    }
  } else if (sortedAssetIds.length > 0) {
    // 자산이 필요한데 input.assets가 빈 배열인 경우
    return {
      ok: false,
      reason: `MISSING_ASSET: 요소에서 참조하는 자산 [${sortedAssetIds[0]}]이 누락되었습니다.`,
      errors: ['MISSING_ASSET'],
    };
  }

  // 7. 실게임 표시 계약 유효성 검증 (보호 구역 침범, actionId, dynamicBinding 등)
  const manifestData = cleanUndefined({
    assetIds: sortedAssetIds,
    assets: manifestAssets.length > 0 ? manifestAssets : undefined,
  });

  const presentationDocCandidate: UIPresentationDocument = cleanUndefined({
    kind: UI_PRESENTATION_ARTIFACT_KIND,
    version: UI_PRESENTATION_VERSION,
    resolution: { width: UI_DESIGN_CANVAS.width, height: UI_DESIGN_CANVAS.height },
    pages: presentationPages,
    manifest: manifestData as any,
  });

  const presValidation = validateUIPresentationDocument(presentationDocCandidate);
  if (!presValidation.valid) {
    const firstErr = presValidation.errors[0];
    return {
      ok: false,
      reason: firstErr ? `${firstErr.code}: ${firstErr.message}` : 'INVALID_PRESENTATION_CONTRACT',
      errors: presValidation.errors.map((e) => e.code),
    };
  }

  // 8. 결정적 contentHash 및 artifactHash 계산
  const contentToHash = cleanUndefined({
    manifest: manifestData,
    pages: presentationPages,
    resolution: { width: UI_DESIGN_CANVAS.width, height: UI_DESIGN_CANVAS.height },
  });

  const calculatedContentHash = contentHash(contentToHash);

  const envelope = cleanUndefined({
    kind: UI_PRESENTATION_ARTIFACT_KIND,
    version: UI_PRESENTATION_VERSION,
    resolution: { width: UI_DESIGN_CANVAS.width, height: UI_DESIGN_CANVAS.height },
    baseline: input.baseline ?? DEFAULT_BASELINE_ID,
    rendererFingerprint,
    sourceProjectId: input.projectId ?? (doc as any).projectId ?? 'project-default',
    sourceRevision: input.revision ?? revision ?? 1,
    sourceCheckpointId: input.checkpointId ?? checkpointId,
    sourceCheckpointHash: sourceCheckpointHash(cleanUndefined(doc)),
    pages: presentationPages,
    manifest: manifestData,
    contentHash: calculatedContentHash,
  });

  const calculatedArtifactHash = artifactHash(envelope);

  const artifact: UIPresentationArtifact = cleanUndefined({
    ...envelope,
    integrity: {
      artifactHash: calculatedArtifactHash,
      algorithm: 'sha256',
    },
  });

  return {
    ok: true,
    artifact,
  };
}

/**
 * 전체 프로젝트 원본 문서, 10개 페이지, 그룹 및 이미지 바이너리 bytes를 포함하는 불변 백업 생성
 */
export function buildFullProjectBackup(input: BuildBackupInput): BuildBackupResult {
  const { projectId, revision, document: doc, assets, createdAt } = input;

  if (!doc || typeof doc !== 'object') {
    return {
      ok: false,
      reason: 'INVALID_DOCUMENT: 백업 대상 문서가 유효하지 않습니다.',
      errors: ['INVALID_DOCUMENT'],
    };
  }

  const gameDataError = checkForForbiddenGameData(doc);
  if (gameDataError) {
    return {
      ok: false,
      reason: gameDataError,
      errors: ['GAME_DATA_INJECTION'],
    };
  }

  const docValidation = validateUIVisualDocument(doc);
  if (!docValidation.valid) {
    return {
      ok: false,
      reason: docValidation.errors[0]?.message ?? 'INVALID_DOCUMENT',
      errors: docValidation.errors.map((e) => e.code),
    };
  }

  const backupAssets: BackupAssetEntry[] = [];

  if (assets && assets.length > 0) {
    for (const a of assets) {
      let dataBase64 = '';
      let byteLen = a.byteLength ?? 0;

      if (a.data) {
        let bytes: Uint8Array;
        if (typeof a.data === 'string') {
          // If already base64 string or raw string
          if (/^[A-Za-z0-9+/]+={0,2}$/.test(a.data) && a.data.length % 4 === 0) {
            dataBase64 = a.data;
            bytes = base64ToUint8Array(a.data);
          } else {
            bytes = new TextEncoder().encode(a.data);
            dataBase64 = uint8ArrayToBase64(bytes);
          }
        } else if (a.data instanceof Uint8Array) {
          bytes = a.data;
          dataBase64 = uint8ArrayToBase64(bytes);
        } else if (a.data instanceof ArrayBuffer) {
          bytes = new Uint8Array(a.data);
          dataBase64 = uint8ArrayToBase64(bytes);
        } else {
          bytes = new Uint8Array(0);
        }
        byteLen = bytes.length;
      }

      backupAssets.push({
        assetId: a.assetId,
        contentHash: a.contentHash,
        durableAssetId: a.durableAssetId,
        mimeType: a.mimeType ?? 'image/png',
        byteLength: byteLen,
        dataBase64,
        metadata: a.metadata,
      });
    }
  }

  // Sort assets deterministically
  backupAssets.sort((x, y) => (x.assetId < y.assetId ? -1 : x.assetId > y.assetId ? 1 : 0));

  const envelope = cleanUndefined({
    kind: UI_BACKUP_KIND,
    schemaVersion: UI_BACKUP_SCHEMA_VERSION,
    projectId,
    revision,
    createdAt: createdAt ?? Date.now(),
    generator: 'dream-guardian-visual-editor-v1',
    document: doc,
    assets: backupAssets,
    contentHash: contentHash(cleanUndefined(doc)),
  });

  const calculatedBackupHash = artifactHash(envelope);

  const backup: UIProjectBackup = cleanUndefined({
    ...envelope,
    integrity: {
      backupHash: calculatedBackupHash,
      algorithm: 'sha256',
    },
  });

  return {
    ok: true,
    backup,
  };
}

/**
 * 백업 객체를 정규화된 JSON 문자열로 직렬화합니다.
 */
export function serializeBackup(backup: UIProjectBackup): string {
  const result = canonicalize(backup);
  if (result.ok) {
    return result.json;
  }
  return JSON.stringify(backup, null, 2);
}

/**
 * 백업 JSON 문자열 또는 객체를 역직렬화하고 해시 및 자산 바이너리를 복구합니다.
 */
export function deserializeBackup(raw: string | unknown): RestoreBackupResult {
  let backupObj: any;
  if (typeof raw === 'string') {
    try {
      backupObj = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        reason: 'INVALID_JSON: 백업 JSON 파싱에 실패했습니다.',
      };
    }
  } else {
    backupObj = raw;
  }

  if (!backupObj || typeof backupObj !== 'object') {
    return {
      ok: false,
      reason: 'INVALID_BACKUP: 백업 데이터가 유효한 객체가 아닙니다.',
    };
  }

  if (backupObj.kind !== UI_BACKUP_KIND) {
    return {
      ok: false,
      reason: `UNSUPPORTED_KIND: 지원되지 않는 백업 kind입니다 (${String(backupObj.kind)})`,
    };
  }

  if (backupObj.schemaVersion !== UI_BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `UNSUPPORTED_SCHEMA_VERSION: 지원되지 않는 스키마 버전입니다 (${String(backupObj.schemaVersion)})`,
    };
  }

  const doc = backupObj.document;
  if (!doc || typeof doc !== 'object') {
    return {
      ok: false,
      reason: 'MISSING_DOCUMENT: 백업 내 원본 문서가 누락되었습니다.',
    };
  }

  // 1. Content Hash 검증
  const recomputedContentHash = contentHash(cleanUndefined(doc));
  if (recomputedContentHash !== backupObj.contentHash) {
    return {
      ok: false,
      reason: 'CONTENT_HASH_MISMATCH: 문서 콘텐츠 해시가 변조되었습니다.',
    };
  }

  // 2. Backup Envelope Hash 검증
  const recomputedBackupHash = artifactHash(cleanUndefined(backupObj));
  if (backupObj.integrity?.backupHash !== recomputedBackupHash) {
    return {
      ok: false,
      reason: 'BACKUP_HASH_MISMATCH: 백업 아티팩트 해시가 변조되었습니다.',
    };
  }

  // 3. 문서 유효성 검증
  const docVal = validateUIVisualDocument(doc);
  if (!docVal.valid) {
    return {
      ok: false,
      reason: docVal.errors[0]?.message ?? 'INVALID_BACKUP_DOCUMENT',
      errors: docVal.errors.map((e) => e.code),
    };
  }

  // 4. 자산 바이너리 복구 및 해시 검증
  const binaryAssets = new Map<string, Uint8Array>();
  const assets = Array.isArray(backupObj.assets) ? backupObj.assets : [];

  for (const a of assets) {
    if (!a.assetId) continue;
    let bytes = new Uint8Array(0);
    if (a.dataBase64) {
      bytes = base64ToUint8Array(a.dataBase64);
    }
    const computedHash = sha256BytesHex(bytes);
    if (a.contentHash && computedHash !== a.contentHash) {
      return {
        ok: false,
        reason: `ASSET_HASH_MISMATCH: 자산 [${a.assetId}] 바이너리 해시가 불일치합니다.`,
      };
    }
    binaryAssets.set(a.assetId, bytes);
  }

  return {
    ok: true,
    backup: backupObj as UIProjectBackup,
    document: doc as UIVisualDocument,
    binaryAssets,
  };
}
