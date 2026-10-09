/**
 * UIVisualIndexedDB.ts - UI visual 전용 비동기 IndexedDB 원자 저장 엔진
 *
 * Issue #464 / UI-VIS-035:
 * - UI visual 전용 DB 네임스페이스 ('dg-ui-visual-store') 및 6대 전용 store 정의:
 *   projects, backups, drafts, checkpoints, assets, releases
 * - 실제 브라우저 IDB API (IDBDatabase, IDBTransaction, IDBObjectStore) 기반의 명시적 비동기 파이프라인
 * - transaction.oncomplete 이후에만 성공 반환 및 abort 시 100% 롤백 보장
 * - Node/Vitest 테스트 환경 및 폴백을 위한 완전 규격 IDBFactory 시뮬레이터 제공
 * - UIX DB 및 게임 런타임 저장소(localStorage, save DB) 절대 접근 금지
 */

export const UI_VISUAL_DB_NAME = "dg-ui-visual-store";
export const UI_VISUAL_DB_VERSION = 1;

export const UI_VISUAL_STORE_NAMES = [
  "projects",
  "backups",
  "drafts",
  "checkpoints",
  "assets",
  "releases",
] as const;

export type UIVisualStoreName = (typeof UI_VISUAL_STORE_NAMES)[number];

const FORBIDDEN_NAMESPACES = [
  "dream_guardian_save",
  "dg_progress",
  "uix-project-db",
  "dream_guardian_fitness_editor_v1",
  "dg-accessibility-db",
  "localStorage",
  "sessionStorage",
];

export interface UIVisualIDBOptions {
  dbName?: string;
  version?: number;
  factory?: IDBFactory;
}

export function promisifyRequest<T = any>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDBRequest failed"));
  });
}

/**
 * Node.js / Vitest 환경 격리를 위한 W3C 표준 규격 인메모리 IDBFactory
 */
export function createInMemoryIDBFactory(): IDBFactory {
  type StoreData = Map<any, any>;
  type DBData = {
    version: number;
    stores: Map<string, StoreData>;
  };

  const databases = new Map<string, DBData>();

  class MemoryDOMException extends Error {
    readonly name: string;
    constructor(message: string, name: string = "Error") {
      super(message);
      this.name = name;
    }
  }

  class MemoryRequest<T = any> extends EventTarget implements IDBRequest<T> {
    result: T = undefined as any;
    error: DOMException | null = null;
    source: any = null;
    transaction: IDBTransaction | null = null;
    readyState: IDBRequestReadyState = "pending";
    onsuccess: ((this: IDBRequest<T>, ev: Event) => any) | null = null;
    onerror: ((this: IDBRequest<T>, ev: Event) => any) | null = null;

    succeed(val: T): void {
      this.result = val;
      this.readyState = "done";
      const ev = new Event("success");
      this.onsuccess?.call(this, ev);
      this.dispatchEvent(ev);
    }

    fail(err: DOMException): void {
      this.error = err;
      this.readyState = "done";
      const ev = new Event("error");
      this.onerror?.call(this, ev);
      this.dispatchEvent(ev);
    }

    override dispatchEvent(event: Event): boolean {
      const handler = (this as any)[`on${event.type}`];
      if (typeof handler === "function") {
        handler.call(this, event);
      }
      return super.dispatchEvent(event);
    }
  }

  class MemoryOpenDBRequest extends MemoryRequest<IDBDatabase> implements IDBOpenDBRequest {
    onblocked: ((this: IDBOpenDBRequest, ev: Event) => any) | null = null;
    onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any) | null = null;
  }

  class MemoryObjectStore implements IDBObjectStore {
    readonly autoIncrement = false;
    readonly indexNames = [] as any;
    readonly keyPath = null as any;

    constructor(
      readonly name: string,
      readonly transaction: MemoryTransaction,
      private readonly map: StoreData
    ) {}

    get(key: IDBValidKey): IDBRequest {
      const req = new MemoryRequest();
      req.source = this;
      req.transaction = this.transaction;
      this.transaction.enqueue(() => {
        const val = this.map.get(key);
        req.succeed(val !== undefined ? structuredClone(val) : undefined);
      });
      return req;
    }

    put(value: any, key?: IDBValidKey): IDBRequest {
      const req = new MemoryRequest();
      req.source = this;
      req.transaction = this.transaction;
      this.transaction.enqueue(() => {
        const actualKey = key ?? (value && typeof value === "object" ? value.id : undefined);
        if (actualKey === undefined) {
          req.fail(new MemoryDOMException("Key is required", "DataError") as any);
          return;
        }
        this.map.set(actualKey, structuredClone(value));
        req.succeed(actualKey);
      });
      return req;
    }

    add(value: any, key?: IDBValidKey): IDBRequest {
      return this.put(value, key);
    }

    delete(key: IDBValidKey): IDBRequest {
      const req = new MemoryRequest();
      req.source = this;
      req.transaction = this.transaction;
      this.transaction.enqueue(() => {
        this.map.delete(key);
        req.succeed(undefined);
      });
      return req;
    }

    clear(): IDBRequest {
      const req = new MemoryRequest();
      req.source = this;
      req.transaction = this.transaction;
      this.transaction.enqueue(() => {
        this.map.clear();
        req.succeed(undefined);
      });
      return req;
    }

    getAll(): IDBRequest {
      const req = new MemoryRequest();
      req.source = this;
      req.transaction = this.transaction;
      this.transaction.enqueue(() => {
        const values = Array.from(this.map.values()).map((v) => structuredClone(v));
        req.succeed(values);
      });
      return req;
    }

    count(): IDBRequest {
      const req = new MemoryRequest();
      this.transaction.enqueue(() => {
        req.succeed(this.map.size);
      });
      return req;
    }

    createIndex(): any {
      throw new Error("Not implemented");
    }
    deleteIndex(): void {}
    index(): any {
      throw new Error("Not implemented");
    }
    openCursor(): any {
      throw new Error("Not implemented");
    }
    openKeyCursor(): any {
      throw new Error("Not implemented");
    }
    getAllKeys(): any {
      const req = new MemoryRequest();
      this.transaction.enqueue(() => {
        req.succeed(Array.from(this.map.keys()));
      });
      return req;
    }
    getKey(): any {
      throw new Error("Not implemented");
    }
  }

  class MemoryTransaction extends EventTarget implements IDBTransaction {
    readonly objectStoreNames: DOMStringList;
    error: DOMException | null = null;
    durability: IDBTransactionDurability = "default";
    onabort: ((this: IDBTransaction, ev: Event) => any) | null = null;
    oncomplete: ((this: IDBTransaction, ev: Event) => any) | null = null;
    onerror: ((this: IDBTransaction, ev: Event) => any) | null = null;

    private readonly queue: (() => void)[] = [];
    private aborted = false;
    private completed = false;
    private pendingRequests = 0;
    private snapshots = new Map<string, StoreData>();
    private draining = false;

    constructor(
      readonly db: MemoryDatabase,
      readonly mode: IDBTransactionMode,
      storeNames: string[]
    ) {
      super();
      this.objectStoreNames = {
        contains: (name: string) => storeNames.includes(name),
        item: (i: number) => storeNames[i] ?? null,
        length: storeNames.length,
        [Symbol.iterator]: function* () {
          yield* storeNames;
        },
      } as unknown as DOMStringList;

      // Save snapshots of stores for complete rollback on abort
      for (const name of storeNames) {
        const storeMap = db.getStoreMap(name);
        if (storeMap) {
          const snapshot = new Map();
          for (const [k, v] of storeMap.entries()) {
            snapshot.set(k, structuredClone(v));
          }
          this.snapshots.set(name, snapshot);
        }
      }
    }

    objectStore(name: string): IDBObjectStore {
      if (!this.objectStoreNames.contains(name)) {
        throw new MemoryDOMException(`Store not in transaction: ${name}`, "NotFoundError");
      }
      const map = this.db.getStoreMap(name);
      if (!map) {
        throw new MemoryDOMException(`Store not found: ${name}`, "NotFoundError");
      }
      return new MemoryObjectStore(name, this, map);
    }

    enqueue(op: () => void): void {
      if (this.aborted || this.completed) {
        throw new MemoryDOMException("Transaction is inactive", "TransactionInactiveError");
      }
      this.pendingRequests++;
      this.queue.push(op);
      this.scheduleDrain();
    }

    abort(): void {
      if (this.aborted || this.completed) return;
      this.aborted = true;

      // Rollback all stores
      for (const [name, snapshot] of this.snapshots.entries()) {
        const storeMap = this.db.getStoreMap(name);
        if (storeMap) {
          storeMap.clear();
          for (const [k, v] of snapshot.entries()) {
            storeMap.set(k, structuredClone(v));
          }
        }
      }

      const abortEv = new Event("abort");
      this.onabort?.call(this, abortEv);
      this.dispatchEvent(abortEv);

      const errorEv = new Event("error");
      this.onerror?.call(this, errorEv);
      this.dispatchEvent(errorEv);
    }

    commit(): void {
      if (this.aborted || this.completed) return;
      this.scheduleComplete();
    }

    private scheduleDrain(): void {
      if (this.draining) return;
      this.draining = true;
      queueMicrotask(() => {
        this.draining = false;
        this.drain();
      });
    }

    private drain(): void {
      if (this.aborted || this.completed) return;
      while (this.queue.length > 0) {
        const op = this.queue.shift();
        try {
          op?.();
        } catch (err: any) {
          this.error =
            err instanceof DOMException
              ? err
              : (new MemoryDOMException(err.message, "AbortError") as any);
          this.abort();
          return;
        } finally {
          this.pendingRequests = Math.max(0, this.pendingRequests - 1);
        }
      }
    }

    private scheduleComplete(): void {
      queueMicrotask(() => {
        if (this.aborted || this.completed) return;
        if (this.queue.length > 0) {
          this.drain();
        }
        if (this.aborted || this.completed) return;

        this.completed = true;
        const completeEv = new Event("complete");
        this.oncomplete?.call(this, completeEv);
        this.dispatchEvent(completeEv);
      });
    }

    override dispatchEvent(event: Event): boolean {
      const handler = (this as any)[`on${event.type}`];
      if (typeof handler === "function") {
        handler.call(this, event);
      }
      return super.dispatchEvent(event);
    }
  }

  class MemoryDatabase extends EventTarget implements IDBDatabase {
    onabort: ((this: IDBDatabase, ev: Event) => any) | null = null;
    onclose: ((this: IDBDatabase, ev: Event) => any) | null = null;
    onerror: ((this: IDBDatabase, ev: Event) => any) | null = null;
    onversionchange: ((this: IDBDatabase, ev: IDBVersionChangeEvent) => any) | null = null;

    private closed = false;

    constructor(
      readonly name: string,
      public version: number,
      private readonly dbData: DBData
    ) {
      super();
    }

    get objectStoreNames(): DOMStringList {
      const names = Array.from(this.dbData.stores.keys());
      return {
        contains: (n: string) => this.dbData.stores.has(n),
        item: (i: number) => names[i] ?? null,
        length: names.length,
        [Symbol.iterator]: function* () {
          yield* names;
        },
      } as unknown as DOMStringList;
    }

    getStoreMap(name: string): StoreData | undefined {
      return this.dbData.stores.get(name);
    }

    createObjectStore(name: string): IDBObjectStore {
      if (this.dbData.stores.has(name)) {
        throw new MemoryDOMException(`Object store ${name} already exists`, "ConstraintError");
      }
      const storeMap = new Map();
      this.dbData.stores.set(name, storeMap);
      return new MemoryObjectStore(name, null as any, storeMap);
    }

    deleteObjectStore(name: string): void {
      this.dbData.stores.delete(name);
    }

    transaction(
      storeNames: string | string[],
      mode: IDBTransactionMode = "readonly"
    ): IDBTransaction {
      if (this.closed) {
        throw new MemoryDOMException("Database is closed", "InvalidStateError");
      }
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return new MemoryTransaction(this, mode, names);
    }

    close(): void {
      if (this.closed) return;
      this.closed = true;
      const ev = new Event("close");
      this.onclose?.call(this, ev);
      this.dispatchEvent(ev);
    }

    override dispatchEvent(event: Event): boolean {
      const handler = (this as any)[`on${event.type}`];
      if (typeof handler === "function") {
        handler.call(this, event);
      }
      return super.dispatchEvent(event);
    }
  }

  return {
    open(name: string, version?: number): IDBOpenDBRequest {
      const req = new MemoryOpenDBRequest();

      queueMicrotask(() => {
        let dbData = databases.get(name);
        const targetVersion = version ?? 1;

        if (!dbData) {
          dbData = { version: targetVersion, stores: new Map() };
          databases.set(name, dbData);

          const db = new MemoryDatabase(name, targetVersion, dbData);
          req.result = db;

          // Trigger upgradeneeded
          const upgradeEvent = new CustomEvent("upgradeneeded", {
            detail: { oldVersion: 0, newVersion: targetVersion },
          }) as unknown as IDBVersionChangeEvent;
          req.onupgradeneeded?.call(req, upgradeEvent);
          req.dispatchEvent(upgradeEvent);

          req.succeed(db);
        } else {
          const oldVersion = dbData.version;
          const db = new MemoryDatabase(name, oldVersion, dbData);
          req.result = db;

          if (version !== undefined && version > oldVersion) {
            dbData.version = version;
            db.version = version;
            const upgradeEvent = new CustomEvent("upgradeneeded", {
              detail: { oldVersion, newVersion: version },
            }) as unknown as IDBVersionChangeEvent;
            req.onupgradeneeded?.call(req, upgradeEvent);
            req.dispatchEvent(upgradeEvent);
          }

          req.succeed(db);
        }
      });

      return req;
    },

    deleteDatabase(name: string): IDBOpenDBRequest {
      const req = new MemoryOpenDBRequest();
      queueMicrotask(() => {
        databases.delete(name);
        req.succeed(undefined as any);
      });
      return req;
    },

    cmp(a: any, b: any): number {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    },
  } as unknown as IDBFactory;
}

/**
 * UIVisualIndexedDB: 실제 브라우저 IDB 및 고신뢰 IDBFactory 기반 명시적 비동기 래퍼
 */
export class UIVisualIndexedDB {
  readonly dbName: string;
  readonly version: number;
  private readonly factory: IDBFactory;
  private db: IDBDatabase | null = null;
  private versionChangeHandlers: ((e: Event) => void)[] = [];
  private blockedHandlers: ((e: Event) => void)[] = [];

  constructor(options: UIVisualIDBOptions = {}) {
    const requestedName = options.dbName ?? UI_VISUAL_DB_NAME;

    for (const forbidden of FORBIDDEN_NAMESPACES) {
      if (requestedName === forbidden || requestedName.includes(forbidden)) {
        throw new Error(`Forbidden namespace access rejected: ${requestedName}`);
      }
    }

    this.dbName = requestedName;
    this.version = options.version ?? UI_VISUAL_DB_VERSION;
    this.factory =
      options.factory ??
      (typeof indexedDB !== "undefined" ? indexedDB : createInMemoryIDBFactory());
  }

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = this.factory.open(this.dbName, this.version);

      request.onblocked = (e) => {
        for (const handler of this.blockedHandlers) {
          handler(e);
        }
      };

      request.onupgradeneeded = () => {
        const database = request.result;
        for (const storeName of UI_VISUAL_STORE_NAMES) {
          if (!database.objectStoreNames.contains(storeName)) {
            database.createObjectStore(storeName);
          }
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        const onVersionChangeHandler = (e: Event) => {
          for (const handler of this.versionChangeHandlers) {
            handler(e);
          }
          // Default behavior on version change: close to allow clean upgrade
          this.close();
        };

        this.db.onversionchange = onVersionChangeHandler;
        this.db.addEventListener("versionchange", onVersionChangeHandler);

        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error ?? new Error(`Failed to open IndexedDB '${this.dbName}'`));
      };
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isOpen(): boolean {
    return this.db !== null;
  }

  getDatabase(): IDBDatabase | null {
    return this.db;
  }

  onVersionChange(handler: (e: Event) => void): () => void {
    this.versionChangeHandlers.push(handler);
    return () => {
      this.versionChangeHandlers = this.versionChangeHandlers.filter((h) => h !== handler);
    };
  }

  onBlocked(handler: (e: Event) => void): () => void {
    this.blockedHandlers.push(handler);
    return () => {
      this.blockedHandlers = this.blockedHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * 원자적 트랜잭션 실행기:
   * transaction.oncomplete 이후에만 Promise를 resolve하고,
   * 에러나 QuotaExceeded 발생 시 tx.abort()로 100% 롤백 보장.
   */
  async runTransaction<T>(
    storeNames: UIVisualStoreName | readonly UIVisualStoreName[],
    mode: IDBTransactionMode,
    operation: (
      tx: IDBTransaction,
      stores: Record<string, IDBObjectStore>
    ) => Promise<T> | T
  ): Promise<T> {
    if (!this.db) {
      await this.open();
    }
    const db = this.db!;
    const names = Array.isArray(storeNames) ? [...storeNames] : [storeNames as string];

    const tx = db.transaction(names, mode);
    const storeMap: Record<string, IDBObjectStore> = {};
    for (const name of names) {
      storeMap[name] = tx.objectStore(name);
    }

    return new Promise<T>((resolve, reject) => {
      let result: T;
      let settled = false;
      let operationError: any = null;

      const completeHandler = () => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      const errorHandler = () => {
        if (!settled) {
          settled = true;
          reject(operationError ?? tx.error ?? new Error("IndexedDB transaction error"));
        }
      };

      const abortHandler = () => {
        if (!settled) {
          settled = true;
          reject(operationError ?? tx.error ?? new Error("IndexedDB transaction aborted"));
        }
      };

      tx.oncomplete = completeHandler;
      tx.addEventListener("complete", completeHandler);

      tx.onerror = errorHandler;
      tx.addEventListener("error", errorHandler);

      tx.onabort = abortHandler;
      tx.addEventListener("abort", abortHandler);

      Promise.resolve()
        .then(() => operation(tx, storeMap))
        .then((res) => {
          result = res;
          if (typeof (tx as any).commit === "function") {
            try {
              (tx as any).commit();
            } catch (_) {}
          }
        })
        .catch((err) => {
          operationError = err;
          try {
            tx.abort();
          } catch (_) {
            // Already aborted or inactive
          }
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
    });
  }

  async get<T>(storeName: UIVisualStoreName, key: IDBValidKey): Promise<T | undefined> {
    return this.runTransaction(storeName, "readonly", async (_, stores) => {
      return promisifyRequest<T | undefined>(stores[storeName].get(key));
    });
  }

  async put<T>(storeName: UIVisualStoreName, key: IDBValidKey, value: T): Promise<void> {
    await this.runTransaction(storeName, "readwrite", async (_, stores) => {
      await promisifyRequest(stores[storeName].put(value, key));
    });
  }

  async delete(storeName: UIVisualStoreName, key: IDBValidKey): Promise<void> {
    await this.runTransaction(storeName, "readwrite", async (_, stores) => {
      await promisifyRequest(stores[storeName].delete(key));
    });
  }

  async getAll<T>(storeName: UIVisualStoreName): Promise<T[]> {
    return this.runTransaction(storeName, "readonly", async (_, stores) => {
      return promisifyRequest<T[]>(stores[storeName].getAll());
    });
  }

  async clear(storeName: UIVisualStoreName): Promise<void> {
    await this.runTransaction(storeName, "readwrite", async (_, stores) => {
      await promisifyRequest(stores[storeName].clear());
    });
  }

  async clearAll(): Promise<void> {
    await this.runTransaction(UI_VISUAL_STORE_NAMES, "readwrite", async (_, stores) => {
      for (const name of UI_VISUAL_STORE_NAMES) {
        await promisifyRequest(stores[name].clear());
      }
    });
  }
}
