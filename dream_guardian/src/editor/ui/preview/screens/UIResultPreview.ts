import { RESULT_BASELINE, cloneResultPresetForEdit } from "../../data/UIBaselines";
import { lookupScreenContract } from "../../data/UIProperties";
import {
  RESULT_ALLOWED_FIELDS,
  RESULT_CONTRACT,
  RESULT_FIXTURES,
  RESULT_LOCK_REASONS,
  RESULT_REGIONS,
  RESULT_VERSION,
  resolveResultProperty,
} from "../../data/screens/UIResultContract";
import { buildTransfer } from "../../data/UITransferBuilder";
import { inspectTransfer } from "../../io/UITransferInspector";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";

export const RESULT_PREVIEW_ID = "result";

export type ResultPorts = {
  storage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    keys: () => string[];
  };
  bootGame?: () => void;
  camera?: { start: () => void };
  network?: { send: (payload: unknown) => void };
  onDanger?: () => void;
};

type Slot = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };
type Fixture = (typeof RESULT_FIXTURES)[number];

export type ResultForm = {
  screen: "result";
  panel: Slot;
  title: Point;
  stars: Point;
  chapter: Point;
  statLineHeight: number;
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
  regions: typeof RESULT_REGIONS;
  display: {
    profile: typeof RESULT_CONTRACT.fingerprint;
    outcome: Fixture["outcome"];
    stats: string;
    rank?: string;
  };
};

export type ResultEditResult = {
  ok: boolean;
  locks: string[];
  editEnabled: false;
  exportEnabled: false;
};

function presetOf() {
  return cloneResultPresetForEdit(RESULT_BASELINE.id);
}

function fixtureOf(id: string): Fixture | undefined {
  return RESULT_FIXTURES.find((fixture) => fixture.id === id);
}

export function createResultPreview(ports: ResultPorts = {}) {
  void ports;
  let preset = presetOf();
  let statLineHeight = preset.statLineHeight;
  let dirty = false;
  let fixtureId = RESULT_FIXTURES[0]?.id ?? "result-victory";
  const history: { statLineHeight: number }[] = [];

  function displayOf() {
    const fixture = fixtureOf(fixtureId) ?? RESULT_FIXTURES[0];
    return {
      profile: RESULT_CONTRACT.fingerprint,
      outcome: fixture.outcome,
      stats: fixture.stats,
      rank: fixture.rank,
    };
  }

  function form(): ResultForm {
    return {
      screen: "result",
      panel: { ...preset.panel },
      title: { ...preset.title },
      stars: { ...preset.stars },
      chapter: { ...preset.chapter },
      statLineHeight,
      dirty,
      editEnabled: false,
      exportEnabled: false,
      regions: RESULT_REGIONS,
      display: displayOf(),
    };
  }

  function select() {
    const registry = lookupScreenContract("result", RESULT_VERSION, "result");
    return {
      screen: "result" as const,
      registry,
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  function edit(patch: Record<string, unknown>): ResultEditResult {
    const locks: string[] = [];
    let nextHeight = statLineHeight;
    let changed = false;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "statLineHeight" && typeof value === "number") {
        nextHeight = value;
        changed = true;
        continue;
      }
      if (key === "recordWrite" || key === "persist" || key === "saveRecord") {
        locks.push(RESULT_LOCK_REASONS.recordWriteBlocked);
        continue;
      }
      const resolved = resolveResultProperty(key);
      if (resolved.status === "locked") {
        if (resolved.reason) locks.push(resolved.reason);
        continue;
      }
      if (!(RESULT_ALLOWED_FIELDS as readonly string[]).includes(key)) {
        locks.push(resolveResultProperty(key).reason ?? "result-lock:unknown-field");
      }
    }
    if (changed) {
      history.push({ statLineHeight });
      statLineHeight = nextHeight;
      dirty = true;
    }
    return { ok: locks.length === 0 && changed, locks, editEnabled: false, exportEnabled: false };
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return form();
    statLineHeight = previous.statLineHeight;
    dirty = history.length > 0;
    return form();
  }

  function loadFixture(id: string) {
    const fixture = fixtureOf(id);
    if (!fixture) return { ok: false as const, form: form() };
    fixtureId = fixture.id;
    preset = presetOf();
    return { ok: true as const, form: form() };
  }

  function preview() {
    return {
      drew: true,
      contextId: PREVIEW_CONTEXT_ID,
      bootedGame: false,
      form: form(),
    };
  }

  function save() {
    const current = form();
    return {
      checkpoint: {
        screen: "result" as const,
        result: {
          panel: current.panel,
          title: current.title,
          stars: current.stars,
          chapter: current.chapter,
          statLineHeight: current.statLineHeight,
          profile: current.display.profile,
          outcome: current.display.outcome,
        },
      },
    };
  }

  function fixturePersistsRecords(_id: string) {
    return false;
  }

  return {
    select,
    edit,
    undo,
    loadFixture,
    preview,
    save,
    form,
    fixturePersistsRecords,
  };
}

export type ResultPreview = ReturnType<typeof createResultPreview>;

export function roundTripResult(preview: ResultPreview = createResultPreview()) {
  const selected = preview.select();
  const drawn = preview.preview();
  const snapshot = preview.save();
  const exported = buildTransfer({
    checkpoint: snapshot.checkpoint,
    scope: "result",
    sourceId: "uix-025",
    exportId: "uix-025-export",
    screen: "result",
    version: RESULT_CONTRACT.version,
    previewLinked: true,
  });
  const inspection = inspectTransfer({
    file: { kind: "dream-guardian-ui-transfer", validation: { passed: true } },
    originalCheckpoint: snapshot.checkpoint,
  });
  return {
    invoked: true,
    selected,
    preview: drawn,
    snapshot,
    export: exported,
    inspection,
  };
}

export function registerResultPreview(): {
  screen: typeof RESULT_PREVIEW_ID;
  editEnabled: false;
  exportEnabled: false;
  linked: false;
} {
  lookupScreenContract("result", RESULT_VERSION, "result");
  return {
    screen: RESULT_PREVIEW_ID,
    editEnabled: false,
    exportEnabled: false,
    linked: false,
  };
}
