/**
 * [DEVUI-010] (Issue #579) 레이아웃 패널 이력 관리자 (순수 TypeScript 클래스)
 *
 * DOM 및 Tweakpane 에 의존하지 않으며, 레이아웃 값의 변경/묶음/되돌리기/다시실행을 관리한다.
 * - 단일 변경: { path, before, after }
 * - 묶음(batch) 변경: Array<{ path, before, after }>
 * - 슬라이더 드래그 묶음 처리 (recordChange / beginDrag / endDrag)
 * - 최대 200건 보관 (상한 초과 시 가장 오래된 항목 shift)
 * - 새 변경 push 시 Redo 스택 초기화
 */

export interface LayoutChangeItem {
  path: string;
  before: number;
  after: number;
}

export type LayoutHistoryEntry = LayoutChangeItem | LayoutChangeItem[];

export const DEFAULT_MAX_HISTORY = 200;

export class DevLayoutHistory {
  private readonly maxEntries: number;
  private readonly undoStack: LayoutHistoryEntry[] = [];
  private readonly redoStack: LayoutHistoryEntry[] = [];
  private readonly dragStarts = new Map<string, number>();
  private readonly currentValues = new Map<string, number>();

  constructor(maxEntries: number = DEFAULT_MAX_HISTORY) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  setValue(path: string, value: number): void {
    this.currentValues.set(path, value);
  }

  getValue(path: string): number | undefined {
    return this.currentValues.get(path);
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.dragStarts.clear();
  }

  push(entry: LayoutChangeItem | readonly LayoutChangeItem[]): boolean {
    if (Array.isArray(entry)) {
      const arr = entry as readonly LayoutChangeItem[];
      const validItems = arr.filter((it) => it.before !== it.after);
      if (validItems.length === 0) return false;
      this.undoStack.push([...validItems]);
      for (const item of validItems) {
        this.currentValues.set(item.path, item.after);
        this.dragStarts.delete(item.path);
      }
    } else {
      const item = entry as LayoutChangeItem;
      if (item.before === item.after) return false;
      this.undoStack.push({ ...item });
      this.currentValues.set(item.path, item.after);
      this.dragStarts.delete(item.path);
    }

    this.redoStack.length = 0;

    while (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }

    return true;
  }

  undo(): LayoutHistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    this.redoStack.push(entry);
    const items = Array.isArray(entry) ? (entry as LayoutChangeItem[]) : [entry as LayoutChangeItem];
    for (const item of items) {
      this.currentValues.set(item.path, item.before);
      this.dragStarts.delete(item.path);
    }
    return entry;
  }

  redo(): LayoutHistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    this.undoStack.push(entry);
    const items = Array.isArray(entry) ? (entry as LayoutChangeItem[]) : [entry as LayoutChangeItem];
    for (const item of items) {
      this.currentValues.set(item.path, item.after);
      this.dragStarts.delete(item.path);
    }
    return entry;
  }

  beginDrag(path: string, startValue: number): void {
    this.dragStarts.set(path, startValue);
  }

  endDrag(path: string, endValue: number): LayoutChangeItem | null {
    const startValue = this.dragStarts.get(path) ?? this.currentValues.get(path) ?? endValue;
    this.dragStarts.delete(path);
    this.currentValues.set(path, endValue);

    if (startValue !== endValue) {
      const item: LayoutChangeItem = { path, before: startValue, after: endValue };
      this.push(item);
      return item;
    }
    return null;
  }

  recordChange(
    path: string,
    newValue: number,
    isLast: boolean,
    startValueIfNew?: number,
  ): LayoutChangeItem | null {
    if (!this.dragStarts.has(path)) {
      const start = this.currentValues.get(path) ?? startValueIfNew ?? newValue;
      this.dragStarts.set(path, start);
    }

    if (!isLast) {
      return null;
    }

    return this.endDrag(path, newValue);
  }

  static toItems(entry: LayoutHistoryEntry | null): LayoutChangeItem[] {
    if (!entry) return [];
    return Array.isArray(entry) ? [...entry] : [entry];
  }
}
