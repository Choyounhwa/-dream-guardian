/**
 * EditorContentDatabase.ts - 피트니스 전용 IndexedDB 원자적 초안 저장 데이터베이스 어댑터
 *
 * Issue #379 / EDITOR-STORE:
 * - 피트니스 전용 DB 네임스페이스 및 5대 store 정의:
 *   projectHeads, projectSnapshots, recoveryBuffers, publishedPacks, activationHeads
 * - 단일 트랜잭션 내 원자성(다중 put/get) 및 abort 시 완전 롤백 보장
 * - Node/Vitest 환경 격리용 인메모리 트랜잭션 어댑터(MemoryIndexedDBAdapter)와
 *   브라우저 표준 IndexedDB 어댑터(BrowserIndexedDBAdapter) 제공
 * - UIX DB 및 플레이어 세이브 스토리지 무접근
 */

export const EDITOR_DB_NAME = 'dream_guardian_fitness_editor_v1';
export const EDITOR_DB_VERSION = 1;

export const EDITOR_STORE_NAMES = [
  'projectHeads',
  'projectSnapshots',
  'recoveryBuffers',
  'publishedPacks',
  'activationHeads',
] as const;

export type EditorStoreName = (typeof EDITOR_STORE_NAMES)[number];
export type TransactionMode = 'readonly' | 'readwrite';

/**
 * 트랜잭션 내부에서 사용할 저장소 오퍼레이션 인터페이스
 */
export interface IEditorTransaction {
  get<T = unknown>(storeName: EditorStoreName, key: string | number): Promise<T | undefined>;
  put<T = unknown>(storeName: EditorStoreName, key: string | number, value: T): Promise<void>;
  delete(storeName: EditorStoreName, key: string | number): Promise<void>;
  getAll<T = unknown>(storeName: EditorStoreName): Promise<T[]>;
  abort(): void;
}

/**
 * 데이터베이스 어댑터 인터페이스
 */
export interface IEditorDatabaseAdapter {
  readonly dbName: string;
  readonly isAvailable: boolean;
  open(): Promise<void>;
  close(): void;
  transaction<R>(
    storeNames: EditorStoreName[],
    mode: TransactionMode,
    callback: (tx: IEditorTransaction) => Promise<R>
  ): Promise<R>;
  clearAll(): Promise<void>;
}

/**
 * Node/Vitest 테스트 환경 및 폴백을 위한 격리 인메모리 트랜잭션 어댑터
 */
export class MemoryIndexedDBAdapter implements IEditorDatabaseAdapter {
  readonly dbName: string;
  private _isOpen: boolean = false;
  private _simulatedNextError: Error | null = null;
  private readonly _stores: Map<EditorStoreName, Map<string | number, unknown>> = new Map();
  private _txQueue: Promise<void> = Promise.resolve();

  constructor(dbName: string = EDITOR_DB_NAME) {
    this.dbName = dbName;
    for (const name of EDITOR_STORE_NAMES) {
      this._stores.set(name, new Map());
    }
  }

  get isAvailable(): boolean {
    return this._isOpen;
  }

  /**
   * QuotaExceededError 등 스토리지 장애를 시뮬레이션하기 위한 헬퍼
   */
  simulateNextError(err: Error | null): void {
    this._simulatedNextError = err;
  }

  async open(): Promise<void> {
    this._isOpen = true;
  }

  close(): void {
    this._isOpen = false;
  }

  async clearAll(): Promise<void> {
    for (const store of this._stores.values()) {
      store.clear();
    }
  }

  async transaction<R>(
    storeNames: EditorStoreName[],
    mode: TransactionMode,
    callback: (tx: IEditorTransaction) => Promise<R>
  ): Promise<R> {
    if (!this._isOpen) {
      await this.open();
    }

    if (this._simulatedNextError) {
      const err = this._simulatedNextError;
      this._simulatedNextError = null;
      throw err;
    }

    const runTx = async (): Promise<R> => {
      for (const name of storeNames) {
        if (!this._stores.has(name)) {
          throw new Error(`Unknown store name: ${name}`);
        }
      }

      // 트랜잭션 스테이징 버퍼 (원자적 커밋/롤백)
      const stagedPuts = new Map<EditorStoreName, Map<string | number, unknown>>();
      const stagedDeletes = new Map<EditorStoreName, Set<string | number>>();
      for (const name of storeNames) {
        stagedPuts.set(name, new Map());
        stagedDeletes.set(name, new Set());
      }

      let isAborted = false;

      const tx: IEditorTransaction = {
        get: async <T = unknown>(storeName: EditorStoreName, key: string | number): Promise<T | undefined> => {
          if (isAborted) throw new Error('Transaction has been aborted');
          if (!storeNames.includes(storeName)) {
            throw new Error(`Store "${storeName}" is not included in this transaction`);
          }
          if (stagedDeletes.get(storeName)?.has(key)) {
            return undefined;
          }
          if (stagedPuts.get(storeName)?.has(key)) {
            const val = stagedPuts.get(storeName)!.get(key);
            return structuredClone(val) as T;
          }
          const baseMap = this._stores.get(storeName)!;
          if (baseMap.has(key)) {
            return structuredClone(baseMap.get(key)) as T;
          }
          return undefined;
        },

        put: async <T = unknown>(storeName: EditorStoreName, key: string | number, value: T): Promise<void> => {
          if (isAborted) throw new Error('Transaction has been aborted');
          if (mode === 'readonly') {
            throw new Error('Cannot write in a readonly transaction');
          }
          if (!storeNames.includes(storeName)) {
            throw new Error(`Store "${storeName}" is not included in this transaction`);
          }
          if (this._simulatedNextError) {
            const err = this._simulatedNextError;
            this._simulatedNextError = null;
            isAborted = true;
            throw err;
          }
          stagedDeletes.get(storeName)?.delete(key);
          stagedPuts.get(storeName)?.set(key, structuredClone(value));
        },

        delete: async (storeName: EditorStoreName, key: string | number): Promise<void> => {
          if (isAborted) throw new Error('Transaction has been aborted');
          if (mode === 'readonly') {
            throw new Error('Cannot delete in a readonly transaction');
          }
          if (!storeNames.includes(storeName)) {
            throw new Error(`Store "${storeName}" is not included in this transaction`);
          }
          stagedPuts.get(storeName)?.delete(key);
          stagedDeletes.get(storeName)?.add(key);
        },

        getAll: async <T = unknown>(storeName: EditorStoreName): Promise<T[]> => {
          if (isAborted) throw new Error('Transaction has been aborted');
          if (!storeNames.includes(storeName)) {
            throw new Error(`Store "${storeName}" is not included in this transaction`);
          }
          const baseMap = this._stores.get(storeName)!;
          const merged = new Map<string | number, unknown>(baseMap);
          for (const key of stagedDeletes.get(storeName) || []) {
            merged.delete(key);
          }
          for (const [key, val] of stagedPuts.get(storeName) || []) {
            merged.set(key, val);
          }
          const items: T[] = [];
          for (const val of merged.values()) {
            items.push(structuredClone(val) as T);
          }
          return items;
        },

        abort: (): void => {
          isAborted = true;
          for (const m of stagedPuts.values()) m.clear();
          for (const s of stagedDeletes.values()) s.clear();
        },
      };

      try {
        const result = await callback(tx);
        if (isAborted) {
          throw new Error('TransactionAborted');
        }

        // 원자적 일괄 반영
        if (mode === 'readwrite') {
          for (const [storeName, puts] of stagedPuts.entries()) {
            const baseMap = this._stores.get(storeName)!;
            const deletes = stagedDeletes.get(storeName)!;
            for (const key of deletes) {
              baseMap.delete(key);
            }
            for (const [key, val] of puts.entries()) {
              baseMap.set(key, val);
            }
          }
        }
        return result;
      } catch (err) {
        // 롤백: 스테이징 폐기
        for (const m of stagedPuts.values()) m.clear();
        for (const s of stagedDeletes.values()) s.clear();
        throw err;
      }
    };

    // 직렬 큐 처리로 동시성 안전 보장
    const prevQueue = this._txQueue;
    let finishResolve: () => void;
    const currentPromise = new Promise<void>((resolve) => {
      finishResolve = resolve;
    });
    this._txQueue = prevQueue.then(() => currentPromise).catch(() => currentPromise);

    try {
      await prevQueue;
      return await runTx();
    } finally {
      finishResolve!();
    }
  }
}

/**
 * 브라우저 표준 IndexedDB 어댑터
 */
export class BrowserIndexedDBAdapter implements IEditorDatabaseAdapter {
  readonly dbName: string;
  private _db: IDBDatabase | null = null;

  constructor(dbName: string = EDITOR_DB_NAME) {
    this.dbName = dbName;
  }

  get isAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  async open(): Promise<void> {
    if (this._db) return;
    if (!this.isAvailable) {
      throw new Error('IndexedDB is not available in current environment');
    }

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, EDITOR_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const storeName of EDITOR_STORE_NAMES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        }
      };

      request.onsuccess = () => {
        this._db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to open IndexedDB'));
      };
    });
  }

  close(): void {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  async clearAll(): Promise<void> {
    if (!this._db) await this.open();
    return this.transaction([...EDITOR_STORE_NAMES], 'readwrite', async (tx) => {
      for (const store of EDITOR_STORE_NAMES) {
        const items = await tx.getAll<{ id?: string | number }>(store);
        for (const item of items) {
          if (item && typeof item === 'object' && 'id' in item) {
            await tx.delete(store, item.id as string | number);
          }
        }
      }
    });
  }

  async transaction<R>(
    storeNames: EditorStoreName[],
    mode: TransactionMode,
    callback: (tx: IEditorTransaction) => Promise<R>
  ): Promise<R> {
    if (!this._db) {
      await this.open();
    }
    const db = this._db!;

    return new Promise<R>((resolve, reject) => {
      let callbackResult: R;
      let hasFinished = false;

      const idbTx = db.transaction(storeNames, mode);

      const txWrapper: IEditorTransaction = {
        get: <T = unknown>(storeName: EditorStoreName, key: string | number): Promise<T | undefined> => {
          return new Promise<T | undefined>((res, rej) => {
            const req = idbTx.objectStore(storeName).get(key);
            req.onsuccess = () => res(req.result as T | undefined);
            req.onerror = () => rej(req.error);
          });
        },
        put: <T = unknown>(storeName: EditorStoreName, key: string | number, value: T): Promise<void> => {
          return new Promise<void>((res, rej) => {
            const req = idbTx.objectStore(storeName).put(value, key);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
          });
        },
        delete: (storeName: EditorStoreName, key: string | number): Promise<void> => {
          return new Promise<void>((res, rej) => {
            const req = idbTx.objectStore(storeName).delete(key);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
          });
        },
        getAll: <T = unknown>(storeName: EditorStoreName): Promise<T[]> => {
          return new Promise<T[]>((res, rej) => {
            const req = idbTx.objectStore(storeName).getAll();
            req.onsuccess = () => res((req.result || []) as T[]);
            req.onerror = () => rej(req.error);
          });
        },
        abort: (): void => {
          idbTx.abort();
        },
      };

      idbTx.oncomplete = () => {
        if (!hasFinished) {
          hasFinished = true;
          resolve(callbackResult);
        }
      };

      idbTx.onerror = () => {
        if (!hasFinished) {
          hasFinished = true;
          reject(idbTx.error ?? new Error('IndexedDB transaction failed'));
        }
      };

      idbTx.onabort = () => {
        if (!hasFinished) {
          hasFinished = true;
          reject(idbTx.error ?? new Error('IndexedDB transaction was aborted'));
        }
      };

      Promise.resolve()
        .then(() => callback(txWrapper))
        .then((result) => {
          callbackResult = result;
        })
        .catch((err) => {
          try {
            idbTx.abort();
          } catch {
            // Already aborted
          }
          if (!hasFinished) {
            hasFinished = true;
            reject(err);
          }
        });
    });
  }
}

/**
 * 피트니스 에디터 콘텐츠 데이터베이스 상위 래퍼
 */
export class EditorContentDatabase {
  readonly adapter: IEditorDatabaseAdapter;

  constructor(adapter?: IEditorDatabaseAdapter) {
    if (adapter) {
      this.adapter = adapter;
    } else if (typeof indexedDB !== 'undefined') {
      this.adapter = new BrowserIndexedDBAdapter();
    } else {
      this.adapter = new MemoryIndexedDBAdapter();
    }
  }

  async open(): Promise<void> {
    await this.adapter.open();
  }

  close(): void {
    this.adapter.close();
  }

  async clearAll(): Promise<void> {
    await this.adapter.clearAll();
  }

  async transaction<R>(
    storeNames: EditorStoreName[],
    mode: TransactionMode,
    callback: (tx: IEditorTransaction) => Promise<R>
  ): Promise<R> {
    return this.adapter.transaction(storeNames, mode, callback);
  }
}
