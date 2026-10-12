/**
 * [DEVUI-009] (Issue #578) 레이아웃 내보내기 경로 public/layouts/ 저장 (showSaveFilePicker) 및 로드 경로 변경
 *
 * 1. UI_LAYOUT_OVERRIDE_URL === '/layouts/ui-layout.json'
 * 2. showSaveFilePicker 지원 시 대화상자로 저장 (suggestedName, types, startIn 핸들 캐시)
 * 3. showSaveFilePicker 에서 AbortError 발생 시 조용히 무시 (예외 던지지 않음)
 * 4. showSaveFilePicker 미지원 시 fallback 다운로드 호출 및 콘솔 안내
 * 5. 패널의 내보내기 버튼 라벨에 'public/layouts/' 저장 경로 안내 포함
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UI_LAYOUT } from '../../config/ui.config';
import {
  UI_LAYOUT_OVERRIDE_URL,
  applyLayoutOverride,
  loadUiLayoutOverride,
} from '../../src/core/UILayoutOverride';
import {
  DEV_LAYOUT_EXPORT_FILENAME,
  DEV_LAYOUT_LOAD_URL,
  saveLayoutExport,
  getCachedSaveFileHandle,
  clearCachedSaveFileHandle,
  mountDevLayoutPanel,
} from '../../src/dev/DevLayoutPanel';

const PRISTINE = JSON.parse(JSON.stringify(UI_LAYOUT));

function fakeDoc() {
  const all: any[] = [];
  const mk = (tag: string) => {
    const el: any = {
      tagName: tag,
      id: '',
      style: {},
      children: [] as any[],
      appendChild(c: any) {
        el.children.push(c);
        all.push(c);
        return c;
      },
      remove() {},
    };
    return el;
  };
  return {
    getElementById: (id: string) => all.find((c) => c.id === id) ?? null,
    createElement: mk,
    body: mk('body'),
  };
}

function fakeCreatePane() {
  const folders: any[] = [];
  const bindings: any[] = [];
  const buttons: any[] = [];
  const makeFolder = (folderParams: { title: string }) => {
    const f: any = {
      title: folderParams.title,
      expanded: false,
      addBinding(o: any, k: string, p: any) {
        const b = { o, k, p, handlers: {} as Record<string, () => void>, on(e: string, fn: () => void) { this.handlers[e] = fn; } };
        bindings.push(b);
        return b;
      },
      addFolder(fp: any) { return makeFolder(fp); },
      addButton(bp: any) {
        const btn = { title: bp.title, handlers: {} as Record<string, () => void>, on(e: string, fn: () => void) { this.handlers[e] = fn; } };
        buttons.push(btn);
        return btn;
      },
    };
    folders.push(f);
    return f;
  };
  const pane: any = {
    ...makeFolder({ title: 'root' }),
    refresh: vi.fn(),
    dispose: vi.fn(),
  };
  return { pane, folders, bindings, buttons };
}

describe('DEVUI-009 레이아웃 로드 경로 단일화', () => {
  afterEach(() => {
    applyLayoutOverride(UI_LAYOUT, PRISTINE);
    vi.restoreAllMocks();
  });

  it('UI_LAYOUT_OVERRIDE_URL 상수는 /layouts/ui-layout.json 이어야 한다', () => {
    expect(UI_LAYOUT_OVERRIDE_URL).toBe('/layouts/ui-layout.json');
  });

  it('DevLayoutPanel의 로드 URL도 UI_LAYOUT_OVERRIDE_URL과 일치한다', () => {
    expect(DEV_LAYOUT_LOAD_URL).toBe('/layouts/ui-layout.json');
    expect(DEV_LAYOUT_LOAD_URL).toBe(UI_LAYOUT_OVERRIDE_URL);
  });

  it('loadUiLayoutOverride 호출 시 /layouts/ui-layout.json 을 fetch 한다', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => '{"menu":{"title":{"y":260}}}',
    }));
    const res = await loadUiLayoutOverride(fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledWith('/layouts/ui-layout.json', { cache: 'no-store' });
    expect(res.status).toBe('applied');
    expect(UI_LAYOUT.menu.title.y).toBe(260);
  });
});

describe('DEVUI-009 showSaveFilePicker 대화상자 저장 및 캐시', () => {
  beforeEach(() => {
    clearCachedSaveFileHandle();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearCachedSaveFileHandle();
    vi.restoreAllMocks();
  });

  it('showSaveFilePicker 지원 시 파일 대화상자를 열고 write/close 한다', async () => {
    let writtenData = '';
    let closed = false;
    const fakeWritable = {
      write: vi.fn(async (data: string) => { writtenData = data; }),
      close: vi.fn(async () => { closed = true; }),
    };
    const fakeHandle = {
      createWritable: vi.fn(async () => fakeWritable),
    };
    const showSaveFilePickerMock = vi.fn(async () => fakeHandle);

    const exportData = { json: '{"menu":{"title":{"y":260}}}', filename: 'ui-layout.json' };
    const result = await saveLayoutExport(exportData, {
      showSaveFilePicker: showSaveFilePickerMock,
    });

    expect(result).toBe('saved');
    expect(showSaveFilePickerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedName: 'ui-layout.json',
        types: [
          expect.objectContaining({
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          }),
        ],
      })
    );
    expect(fakeHandle.createWritable).toHaveBeenCalled();
    expect(fakeWritable.write).toHaveBeenCalledWith(exportData.json);
    expect(fakeWritable.close).toHaveBeenCalled();
    expect(writtenData).toBe(exportData.json);
    expect(closed).toBe(true);

    // 같은 세션에서 고른 핸들이 캐시되었는지 확인
    expect(getCachedSaveFileHandle()).toBe(fakeHandle);
  });

  it('두 번째 저장 시 이전 핸들을 startIn으로 재사용한다', async () => {
    const fakeWritable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    const firstHandle = { id: 1, createWritable: vi.fn(async () => fakeWritable) };
    const secondHandle = { id: 2, createWritable: vi.fn(async () => fakeWritable) };

    const showSaveFilePickerMock = vi.fn()
      .mockResolvedValueOnce(firstHandle)
      .mockResolvedValueOnce(secondHandle);

    const exportData = { json: '{}', filename: 'ui-layout.json' };
    await saveLayoutExport(exportData, { showSaveFilePicker: showSaveFilePickerMock });

    // 첫 번째 호출 시 startIn 없음
    expect(showSaveFilePickerMock.mock.calls[0][0].startIn).toBeUndefined();

    // 두 번째 호출 시 firstHandle이 startIn에 포함됨
    await saveLayoutExport(exportData, { showSaveFilePicker: showSaveFilePickerMock });
    expect(showSaveFilePickerMock.mock.calls[1][0].startIn).toBe(firstHandle);
    expect(getCachedSaveFileHandle()).toBe(secondHandle);
  });

  it('사용자가 대화상자를 취소하면 AbortError 를 조용히 무시한다', async () => {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';

    const showSaveFilePickerMock = vi.fn(async () => {
      throw abortErr;
    });

    const exportData = { json: '{}', filename: 'ui-layout.json' };
    const result = await saveLayoutExport(exportData, { showSaveFilePicker: showSaveFilePickerMock });

    expect(result).toBe('cancelled');
  });

  it('showSaveFilePicker 미지원 시 fallback 다운로드를 수행하고 안내 로그를 남긴다', async () => {
    let downloadedText = '';
    let downloadedName = '';
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const exportData = { json: '{"hud":{"hpBar":{"y":100}}}', filename: 'ui-layout.json' };
    const result = await saveLayoutExport(exportData, {
      download: (text, name) => {
        downloadedText = text;
        downloadedName = name;
      },
    });

    expect(result).toBe('downloaded');
    expect(downloadedText).toBe(exportData.json);
    expect(downloadedName).toBe('ui-layout.json');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('showSaveFilePicker 미지원 환경')
    );
  });
});

describe('DEVUI-009 DevLayoutPanel 패널 버튼 라벨 및 연동', () => {
  afterEach(() => {
    applyLayoutOverride(UI_LAYOUT, PRISTINE);
    vi.restoreAllMocks();
  });

  it('내보내기 버튼 라벨에 public/layouts/ 경로 안내가 포함되어 있다', async () => {
    const doc = fakeDoc();
    const { pane, buttons } = fakeCreatePane();
    await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc as unknown as Document,
      {
        createPane: async () => pane,
        fileOverride: null,
        storage: null,
        watchState: false,
      }
    );

    const exportBtn = buttons.find((b: any) => /내보내기|export/i.test(b.title));
    expect(exportBtn).toBeTruthy();
    expect(exportBtn.title).toContain('public/layouts/');
    expect(exportBtn.title).toContain(DEV_LAYOUT_EXPORT_FILENAME);
  });

  it('패널에서 내보내기 버튼 클릭 시 showSaveFilePicker 를 통해 저장된다', async () => {
    let written = '';
    const fakeWritable = {
      write: vi.fn(async (d: string) => { written = d; }),
      close: vi.fn(async () => {}),
    };
    const fakeHandle = {
      createWritable: vi.fn(async () => fakeWritable),
    };
    const pickerMock = vi.fn(async () => fakeHandle);

    const doc = fakeDoc();
    const { pane, buttons } = fakeCreatePane();
    await mountDevLayoutPanel(
      { stateMachine: { currentState: 'MENU_MAIN' } },
      doc as unknown as Document,
      {
        createPane: async () => pane,
        fileOverride: null,
        storage: null,
        watchState: false,
        showSaveFilePicker: pickerMock,
      }
    );

    const exportBtn = buttons.find((b: any) => /내보내기|export/i.test(b.title));
    UI_LAYOUT.menu.title.y = 205;
    await exportBtn.handlers.click();

    expect(pickerMock).toHaveBeenCalled();
    expect(fakeWritable.write).toHaveBeenCalled();
    expect(written).toContain('"menu"');
  });
});
