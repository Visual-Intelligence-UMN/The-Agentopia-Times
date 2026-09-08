import { redactArchiveData } from './archiveRedaction.ts';

export interface ArchiveEvent {
    runId: string;
    eventId: string;
    kind: string;
    at: string;
    data: unknown;
}

export interface ArchiveOutbox {
    put(event: ArchiveEvent): Promise<void>;
    list(): Promise<Array<{ key: number; event: ArchiveEvent }>>;
    remove(key: number): Promise<void>;
}

/** Save before sending; a failed write remains in the outbox for retry/reload. */
export function createArchiveWriter(
    outbox: ArchiveOutbox,
    send: (event: ArchiveEvent) => Promise<void>,
) {
    const pending: ArchiveEvent[] = [];
    let saving: Promise<void> | undefined;
    const save = () =>
        (saving ??= (async () => {
            while (pending.length) {
                await outbox.put(pending[0]);
                pending.shift();
            }
        })().finally(() => {
            saving = undefined;
        }));
    let draining: Promise<void> | undefined;
    return {
        append(event: ArchiveEvent) {
            const snapshot = redactArchiveData(event) as ArchiveEvent;
            pending.push(snapshot);
            return save();
        },
        flush(): Promise<void> {
            if (draining) return draining;
            draining = (async () => {
                for (;;) {
                    await save();
                    const entries = await outbox.list();
                    if (!entries.length) return;
                    for (const entry of entries) {
                        await send(entry.event);
                        await outbox.remove(entry.key);
                    }
                }
            })().finally(() => {
                draining = undefined;
            });
            return draining;
        },
    };
}

function indexedOutbox(): ArchiveOutbox {
    let opening: Promise<IDBDatabase> | undefined;
    const open = () =>
        (opening ??= new Promise((resolve, reject) => {
            const request = indexedDB.open('agentopia-run-archive', 1);
            request.onupgradeneeded = () =>
                request.result.createObjectStore('outbox', {
                    autoIncrement: true,
                });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }));
    const write = async (action: (store: IDBObjectStore) => void) => {
        const db = await open();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('outbox', 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () =>
                reject(tx.error ?? new Error('Archive storage aborted'));
            action(tx.objectStore('outbox'));
        });
    };
    return {
        put: (event) =>
            write((store) => {
                store.add(event);
            }),
        remove: (key) =>
            write((store) => {
                store.delete(key);
            }),
        async list() {
            const db = await open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('outbox', 'readonly');
                const store = tx.objectStore('outbox');
                const values = store.getAll();
                const keys = store.getAllKeys();
                tx.oncomplete = () =>
                    resolve(
                        values.result.map((event, index) => ({
                            key: Number(keys.result[index]),
                            event,
                        })),
                    );
                tx.onerror = () => reject(tx.error);
            });
        },
    };
}

let writer: ReturnType<typeof createArchiveWriter> | undefined;
let initialized = false;
let warned = false;

function localWriter() {
    if (
        typeof location === 'undefined' ||
        !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    )
        return;
    if (!writer) {
        writer = createArchiveWriter(indexedOutbox(), async (event) => {
            const response = await fetch('/__agentopia_archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
                signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok)
                throw new Error(`Local archive HTTP ${response.status}`);
            const receipt = await response.json();
            if (receipt?.ok !== true)
                throw new Error('Local archive did not acknowledge the write');
            warned = false;
        });
    }
    return writer;
}

function warn(error: unknown) {
    if (warned) return;
    warned = true;
    // Persistence failures must be visible without adding game UI.
    // eslint-disable-next-line no-console
    console.warn(
        '[Local archive] Could not finish saving; pending records will retry. Keep this browser profile and restart the local server if needed.',
        error,
    );
}

export function flushLocalRunArchive(): Promise<void> {
    return localWriter()?.flush() ?? Promise.resolve();
}

export function initializeLocalRunArchive(): void {
    if (initialized || !localWriter()) return;
    initialized = true;
    window.addEventListener('online', () => {
        void flushLocalRunArchive().catch(warn);
    });
    window.setInterval(() => {
        void flushLocalRunArchive().catch(warn);
    }, 3_000);
    void flushLocalRunArchive().catch(warn);
}

/** Non-blocking observer: archiving must never reject a MAS call. */
export function archiveRunEvent(
    runId: string | undefined,
    kind: string,
    data: unknown,
): void {
    if (!runId) return;
    try {
        const target = localWriter();
        if (!target) return;
        initializeLocalRunArchive();
        void target
            .append({
                runId,
                eventId: crypto.randomUUID(),
                kind,
                at: new Date().toISOString(),
                data,
            })
            .then(() => target.flush())
            .catch(warn);
    } catch (error) {
        warn(error);
    }
}
