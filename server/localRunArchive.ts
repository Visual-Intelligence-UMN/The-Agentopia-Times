import { promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';

import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

import { redactArchiveData } from '../src/utils/archiveRedaction.ts';

const ARCHIVE_ROUTE = '/__agentopia_archive';
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const SNAPSHOT_FILES = Object.create(null) as Record<string, string>;
SNAPSHOT_FILES.configuration = 'configuration.json';
SNAPSHOT_FILES.verification = 'verification.json';
SNAPSHOT_FILES.mas = 'mas.json';
const SNAPSHOT_FILE_KINDS = new Set(['configuration', 'verification', 'mas']);
const isSnapshotKind = (kind: string): kind is keyof typeof SNAPSHOT_FILES => {
    return SNAPSHOT_FILE_KINDS.has(kind);
};
const hasOwnSnapshotKind = (
    kind: string,
): kind is keyof typeof SNAPSHOT_FILES => {
    return Object.prototype.hasOwnProperty.call(SNAPSHOT_FILES, kind);
};

interface ArchiveEnvelope {
    runId: string;
    eventId: string;
    kind: string;
    at: string;
    data: unknown;
}

interface StoredEvent {
    runId: string;
    eventId: string;
    kind: string;
    at: string;
    data: unknown;
    receivedAt: string;
}

interface VerificationCounts {
    total: number;
    pending: number;
    verified: number;
    partial: number;
    failed: number;
    cancelled: number;
    not_checked: number;
    unknown: number;
    withFindings: number;
    annotations: number;
}

interface RunSummary {
    runId: string;
    updatedAt: string;
    totalEvents: number;
    lastEventId: string;
    lastKind: string;
    status?: string;
    context?: unknown;
    startedAt?: string;
    completedAt?: string;
    verificationCounts: VerificationCounts;
}

interface RunState {
    eventIds: Set<string>;
    totalEvents: number;
    lastEventId: string;
    lastKind: string;
    status?: string;
    context?: unknown;
    startedAt?: string;
    completedAt?: string;
    verificationCounts: VerificationCounts;
    updatedAt: string;
}

interface ArchivePluginOptions {
    projectRoot?: string;
}

const emptyVerificationCounts: VerificationCounts = {
    total: 0,
    pending: 0,
    verified: 0,
    partial: 0,
    failed: 0,
    cancelled: 0,
    not_checked: 0,
    unknown: 0,
    withFindings: 0,
    annotations: 0,
};

const summarizeVerificationPayload = (raw: unknown): VerificationCounts => {
    const counts = { ...emptyVerificationCounts };
    if (
        !raw ||
        typeof raw !== 'object' ||
        !('records' in raw) ||
        !Array.isArray(raw.records)
    )
        return counts;
    for (const record of raw.records) {
        if (!record || typeof record !== 'object') continue;
        const status: unknown = record.status;
        if (
            status === 'pending' ||
            status === 'verified' ||
            status === 'partial' ||
            status === 'failed' ||
            status === 'cancelled' ||
            status === 'not_checked'
        )
            counts[status] += 1;
        else counts.unknown += 1;
        const annotations = Array.isArray(record.annotations)
            ? record.annotations.length
            : 0;
        counts.annotations += annotations;
        if (annotations) counts.withFindings += 1;
        counts.total += 1;
    }
    return counts;
};

const parseJsonEvent = (line: string): StoredEvent | undefined => {
    try {
        const event = JSON.parse(line) as StoredEvent;
        if (!event || typeof event !== 'object') {
            return undefined;
        }
        if (
            typeof event.runId !== 'string' ||
            typeof event.eventId !== 'string' ||
            typeof event.kind !== 'string' ||
            typeof event.receivedAt !== 'string'
        ) {
            return undefined;
        }
        return event;
    } catch {
        return undefined;
    }
};

const makeRunState = (): RunState => ({
    eventIds: new Set(),
    totalEvents: 0,
    lastEventId: '',
    lastKind: '',
    verificationCounts: { ...emptyVerificationCounts },
    updatedAt: new Date(0).toISOString(),
});

export const createLocalRunArchivePlugin = (
    options: ArchivePluginOptions = {},
): Plugin => {
    const root = options.projectRoot
        ? path.resolve(options.projectRoot)
        : undefined;
    const runStates = new Map<string, RunState>();
    const writeQueues = new Map<string, Promise<unknown>>();
    let projectRoot = path.resolve(process.cwd());

    const getRunDir = (runId: string) =>
        path.join(projectRoot, '.local', 'mas-runs', runId);

    const getArchiveRoot = () =>
        path.join(path.resolve(projectRoot, '.local', 'mas-runs'));

    const sendJson = (
        response: ServerResponse,
        status: number,
        payload: unknown,
    ) => {
        const text = JSON.stringify(payload);
        response.statusCode = status;
        response.setHeader('content-type', 'application/json; charset=utf-8');
        response.end(text);
    };

    const parseHost = (hostHeader?: string): string => {
        if (!hostHeader) {
            return '';
        }
        try {
            return new URL(`http://${hostHeader}`).hostname
                .toLowerCase()
                .replace(/^\[/, '')
                .replace(/\]$/, '');
        } catch {
            return hostHeader
                .split(':')[0]
                .replace(/^\[/, '')
                .replace(/\]$/, '')
                .toLowerCase();
        }
    };

    const isAllowedHost = (hostHeader?: string): boolean => {
        return LOOPBACK_HOSTS.has(parseHost(hostHeader));
    };

    const isAllowedRemoteAddress = (address?: string): boolean => {
        if (!address) {
            return false;
        }
        const normalized = address.startsWith('::ffff:')
            ? address.slice(7)
            : address;
        return (
            normalized === '127.0.0.1' ||
            normalized === '::1' ||
            normalized.startsWith('127.')
        );
    };

    const isSameOrigin = (
        request: IncomingMessage,
        origin: string,
    ): boolean => {
        try {
            const requestHostHeader = String(request.headers.host ?? '');
            if (!requestHostHeader) {
                return false;
            }
            const parsedRequest = new URL(`http://${requestHostHeader}`);
            const parsedOrigin = new URL(origin);

            if (
                parsedOrigin.protocol !== 'http:' &&
                parsedOrigin.protocol !== 'https:'
            ) {
                return false;
            }
            if (!isAllowedHost(parsedOrigin.hostname)) {
                return false;
            }

            return (
                parsedRequest.host.toLowerCase() ===
                parsedOrigin.host.toLowerCase()
            );
        } catch {
            return false;
        }
    };

    const ensureAllowedRequest = (request: IncomingMessage): string | null => {
        const address = request.socket.remoteAddress;
        if (!isAllowedRemoteAddress(address)) {
            return 'Requests must come from loopback';
        }
        const hostHeader = request.headers.host;
        if (!isAllowedHost(hostHeader)) {
            return 'Host must be loopback';
        }
        const origin = request.headers.origin;
        if (typeof origin === 'string' && origin.length > 0) {
            if (!isSameOrigin(request, origin)) {
                return 'Origin mismatch';
            }
        }
        return null;
    };

    const readEnvelope = async (
        request: IncomingMessage,
    ): Promise<{
        envelope?: ArchiveEnvelope;
        error?: string;
        code?: number;
    }> => {
        const contentType = (
            request.headers['content-type'] ?? ''
        ).toLowerCase();
        if (!contentType.startsWith('application/json')) {
            return { error: 'Unsupported content type', code: 415 };
        }

        let size = 0;
        let exceeded = false;
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                exceeded = true;
                continue;
            }
            if (!exceeded) {
                chunks.push(Buffer.from(chunk));
            }
        }
        if (exceeded) {
            return { error: 'Payload too large', code: 413 };
        }

        try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (
                !parsed ||
                typeof parsed !== 'object' ||
                !('runId' in parsed) ||
                !('eventId' in parsed) ||
                !('kind' in parsed) ||
                !('at' in parsed) ||
                !('data' in parsed)
            ) {
                return { error: 'Malformed archive payload', code: 400 };
            }
            return { envelope: parsed as ArchiveEnvelope };
        } catch {
            return { error: 'Malformed archive payload', code: 400 };
        }
    };

    const isValidId = (value: string): boolean =>
        RUN_ID_RE.test(value) && value.length <= 64;

    const parseEvents = async (eventsPath: string): Promise<StoredEvent[]> => {
        try {
            const raw = await fs.readFile(eventsPath, 'utf8');
            return raw
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .map(parseJsonEvent)
                .filter((event): event is StoredEvent => Boolean(event));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    };

    const getEventsAppendPrefix = async (
        eventsPath: string,
    ): Promise<string> => {
        try {
            const handle = await fs.open(eventsPath, 'r');
            try {
                const stats = await handle.stat();
                if (stats.size === 0) {
                    return '';
                }
                const buffer = Buffer.alloc(1);
                await handle.read(buffer, 0, 1, stats.size - 1);
                return buffer.toString() === '\n' ? '' : '\n';
            } finally {
                await handle.close();
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return '';
            }
            throw error;
        }
    };

    const hydrateState = (events: StoredEvent[]): RunState => {
        const state = makeRunState();
        for (const event of events) {
            if (!event.eventId || !event.kind) {
                continue;
            }

            state.eventIds.add(event.eventId);
            state.totalEvents += 1;
            state.lastEventId = event.eventId;
            state.lastKind = event.kind;
            state.updatedAt = event.receivedAt;

            if (event.kind === 'verification') {
                state.verificationCounts = summarizeVerificationPayload(
                    event.data,
                );
            }

            if (
                event.kind === 'mas' &&
                event.data &&
                typeof event.data === 'object'
            ) {
                const mas = event.data as Record<string, unknown>;
                if (typeof mas.status === 'string') {
                    state.status = mas.status;
                }
                if (Object.prototype.hasOwnProperty.call(mas, 'context')) {
                    state.context = mas.context;
                }
                if (typeof mas.startedAt === 'string') {
                    state.startedAt = mas.startedAt;
                }
                if (typeof mas.completedAt === 'string') {
                    state.completedAt = mas.completedAt;
                }
            }
        }

        return state;
    };

    const persistSummary = async (
        runDir: string,
        runId: string,
        state: RunState,
    ) => {
        const summary: RunSummary = {
            runId,
            updatedAt: state.updatedAt,
            totalEvents: state.totalEvents,
            lastEventId: state.lastEventId,
            lastKind: state.lastKind,
            status: state.status,
            context: state.context,
            startedAt: state.startedAt,
            completedAt: state.completedAt,
            verificationCounts: state.verificationCounts,
        };
        await fs.writeFile(
            path.join(runDir, 'summary.json'),
            `${JSON.stringify(summary, null, 2)}\n`,
            'utf8',
        );
    };

    const writeSnapshot = async (
        runDir: string,
        kind: string,
        data: unknown,
    ) => {
        if (!hasOwnSnapshotKind(kind)) {
            return;
        }
        const filename = SNAPSHOT_FILES[kind];
        const target = path.join(runDir, filename);
        await fs.writeFile(
            target,
            `${JSON.stringify(data, null, 2)}\n`,
            'utf8',
        );
    };

    const getRunState = async (runId: string): Promise<RunState> => {
        const cached = runStates.get(runId);
        if (cached) {
            return cached;
        }
        const runDir = getRunDir(runId);
        const eventsPath = path.join(runDir, 'events.jsonl');
        const events = await parseEvents(eventsPath);
        const state = hydrateState(events);
        runStates.set(runId, state);
        return state;
    };

    const updateStateWithRecord = (state: RunState, record: StoredEvent) => {
        state.eventIds.add(record.eventId);
        state.totalEvents += 1;
        state.lastEventId = record.eventId;
        state.lastKind = record.kind;
        state.updatedAt = record.receivedAt;

        if (record.kind === 'verification') {
            state.verificationCounts = summarizeVerificationPayload(
                record.data,
            );
        }

        if (
            record.kind === 'mas' &&
            record.data &&
            typeof record.data === 'object'
        ) {
            const mas = record.data as Record<string, unknown>;
            if (typeof mas.status === 'string') {
                state.status = mas.status;
            }
            if (Object.prototype.hasOwnProperty.call(mas, 'context')) {
                state.context = mas.context;
            }
            if (typeof mas.startedAt === 'string') {
                state.startedAt = mas.startedAt;
            }
            if (typeof mas.completedAt === 'string') {
                state.completedAt = mas.completedAt;
            }
        }
    };

    const repairArtifacts = async (runId: string): Promise<void> => {
        const runDir = getRunDir(runId);
        const eventsPath = path.join(runDir, 'events.jsonl');
        const events = await parseEvents(eventsPath);
        const state = hydrateState(events);
        runStates.set(runId, state);

        await persistSummary(runDir, runId, state);

        const latestSnapshots = new Map<string, unknown>();
        for (const event of events) {
            if (isSnapshotKind(event.kind)) {
                latestSnapshots.set(event.kind, event.data);
            }
        }
        await Promise.all(
            [...latestSnapshots.entries()].map(([kind, data]) =>
                writeSnapshot(runDir, kind, data),
            ),
        );
    };

    const archiveRunEvent = async (
        envelope: ArchiveEnvelope,
    ): Promise<{ duplicate: boolean }> => {
        const runDir = getRunDir(envelope.runId);
        const eventsPath = path.join(runDir, 'events.jsonl');
        const { runId, eventId, kind, at, data } = envelope;
        const redactedData = redactArchiveData(data);

        const previous = writeQueues.get(runId) ?? Promise.resolve();
        const work = previous
            .catch(() => undefined)
            .then(async () => {
                const state = await getRunState(runId);

                if (state.eventIds.has(eventId)) {
                    await repairArtifacts(runId);
                    return { duplicate: true };
                }

                await fs.mkdir(runDir, { recursive: true });
                const record: StoredEvent = {
                    runId,
                    eventId,
                    kind,
                    at,
                    data: redactedData,
                    receivedAt: new Date().toISOString(),
                };
                const prefix = await getEventsAppendPrefix(eventsPath);

                await fs.appendFile(
                    eventsPath,
                    `${prefix}${JSON.stringify(record)}\n`,
                    'utf8',
                );
                updateStateWithRecord(state, record);

                await Promise.all([
                    persistSummary(runDir, runId, state),
                    writeSnapshot(runDir, kind, redactedData),
                ]);

                return { duplicate: false };
            })
            .finally(() => {
                if (writeQueues.get(runId) === work) {
                    writeQueues.delete(runId);
                }
            });

        writeQueues.set(runId, work);
        return work as Promise<{ duplicate: boolean }>;
    };

    const handleRequest = async (
        request: IncomingMessage,
        response: ServerResponse,
    ): Promise<void> => {
        const pathname = new URL(
            (request.url ?? '').split('?')[0],
            'http://localhost',
        ).pathname;

        if (pathname !== ARCHIVE_ROUTE) {
            response.statusCode = 404;
            response.end();
            return;
        }

        if (request.method === 'GET') {
            const reason = ensureAllowedRequest(request);
            if (reason) {
                sendJson(response, 403, { ok: false, reason });
                return;
            }
            sendJson(response, 200, {
                ok: true,
                archiveRoot: getArchiveRoot(),
            });
            return;
        }

        if (request.method !== 'POST') {
            sendJson(response, 405, {
                ok: false,
                reason: 'Method not allowed',
            });
            return;
        }

        const reason = ensureAllowedRequest(request);
        if (reason) {
            sendJson(response, 403, { ok: false, reason });
            return;
        }

        const { envelope, error, code } = await readEnvelope(request);
        if (error || !envelope) {
            sendJson(response, code ?? 400, {
                ok: false,
                reason: error ?? 'Invalid body',
            });
            return;
        }

        if (!isValidId(envelope.runId) || !isValidId(envelope.eventId)) {
            sendJson(response, 400, { ok: false, reason: 'Invalid id format' });
            return;
        }

        if (typeof envelope.kind !== 'string' || !envelope.kind.trim()) {
            sendJson(response, 400, { ok: false, reason: 'Invalid kind' });
            return;
        }

        if (typeof envelope.at !== 'string') {
            sendJson(response, 400, { ok: false, reason: 'Invalid timestamp' });
            return;
        }

        if (
            !RUN_ID_RE.test(envelope.runId) ||
            !RUN_ID_RE.test(envelope.eventId)
        ) {
            sendJson(response, 400, { ok: false, reason: 'Invalid id format' });
            return;
        }

        if (envelope.runId.includes('..') || envelope.eventId.includes('..')) {
            sendJson(response, 400, {
                ok: false,
                reason: 'Invalid path sequence',
            });
            return;
        }

        try {
            const result = await archiveRunEvent(envelope);
            sendJson(response, 200, { ok: true, duplicate: result.duplicate });
        } catch {
            sendJson(response, 500, {
                ok: false,
                reason: 'Archive write failed',
            });
        }
    };

    type MiddlewareServer =
        | Pick<ViteDevServer, 'middlewares'>
        | Pick<PreviewServer, 'middlewares'>;

    const attach = (server: MiddlewareServer) => {
        server.middlewares.use(async (request, response, next) => {
            const url = request.url ? request.url.split('?')[0] : '';
            if (!url.startsWith(ARCHIVE_ROUTE)) {
                next();
                return;
            }
            await handleRequest(request, response);
        });
    };

    return {
        name: 'local-run-archive',
        configResolved(config) {
            projectRoot = path.resolve(root ?? config.root);
        },
        configureServer(server) {
            attach(server);
        },
        configurePreviewServer(server) {
            attach(server);
        },
    };
};

export default createLocalRunArchivePlugin;
