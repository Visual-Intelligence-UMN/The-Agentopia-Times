import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import { createServer } from 'vite';

import { createLocalRunArchivePlugin } from '../server/localRunArchive.ts';

interface HttpResponse {
    status: number;
    body: string;
}

type Headers = Record<string, string>;

const sendRequest = async (
    port: number,
    method: string,
    pathname: string,
    body?: string,
    headers: Headers = {},
): Promise<HttpResponse> => {
    return new Promise((resolve, reject) => {
        let status = 0;
        const chunks: Buffer[] = [];
        const request = http.request(
            {
                method,
                hostname: '127.0.0.1',
                port,
                path: pathname,
                headers: {
                    ...(body ? { 'content-type': 'application/json' } : {}),
                    ...headers,
                },
            },
            (response) => {
                status = response.statusCode ?? 0;
                response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
                response.on('end', () =>
                    resolve({
                        status,
                        body: Buffer.concat(chunks).toString('utf8'),
                    }),
                );
            },
        );
        request.on('error', reject);
        if (body) {
            request.write(body);
        }
        request.end();
    });
};

const readJson = (body: string) => {
    try {
        return body ? JSON.parse(body) : {};
    } catch {
        return {};
    }
};

const countEventRows = async (filePath: string): Promise<number> => {
    try {
        const raw = await readFile(filePath, 'utf8');
        return raw
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0).length;
    } catch {
        return 0;
    }
};

const mkTempRoot = async () =>
    mkdtemp(path.join(os.tmpdir(), 'agentopia-archive-'));
type ArchiveTestServer = Awaited<ReturnType<typeof createServer>>;

const startArchiveServer = async (
    projectRoot: string,
    testContext?: TestContext,
) => {
    const server = await createServer({
        root: projectRoot,
        logLevel: 'error',
        plugins: [createLocalRunArchivePlugin({ projectRoot })],
        server: {
            host: '127.0.0.1',
            port: 0,
        },
        configFile: false,
    });
    await server.listen(0);
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to start Vite server');
    }
    const port = (address as { port: number }).port;
    if (testContext) {
        testContext.after(() => closeArchiveServer(server));
        testContext.after(() =>
            rm(projectRoot, { recursive: true, force: true }),
        );
    }
    return { server, port };
};

const closeArchiveServer = async (server: ArchiveTestServer) => {
    await server.close();
};

test('GET health endpoint returns archive root path', async (t) => {
    const root = await mkTempRoot();
    const { port } = await startArchiveServer(root, t);

    const response = await sendRequest(port, 'GET', '/__agentopia_archive');
    const payload = readJson(response.body);

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.archiveRoot, path.resolve(root, '.local', 'mas-runs'));
});

test('writes normal events and special snapshots with redaction and enhanced summary', async (t) => {
    const root = await mkTempRoot();
    const { port } = await startArchiveServer(root, t);
    const runId = `run-${randomUUID()}`;
    const now = new Date().toISOString();

    const normal = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId,
            eventId: 'evt-1',
            kind: 'normal',
            at: now,
            data: { text: 'hello world' },
        }),
    );
    assert.equal(normal.status, 200);
    assert.equal(readJson(normal.body).duplicate, false);

    const configuration = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId,
            eventId: 'evt-2',
            kind: 'configuration',
            at: now,
            data: {
                openai: { apiKey: 'sk-abcdefghijklmnopqrstuvwxyz' },
                authorization: 'Bearer super-secret-token',
            },
        }),
    );
    assert.equal(configuration.status, 200);

    const verification = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId,
            eventId: 'evt-3',
            kind: 'verification',
            at: now,
            data: {
                summary: 'ok',
                records: [
                    { status: 'verified', annotations: [] },
                    { status: 'verified', annotations: [{ quote: 'error' }] },
                    { status: 'failed' },
                    { status: 'not_checked' },
                    { status: 'pending' },
                    {
                        status: 'partial',
                        annotations: [{ quote: 'partial error' }],
                    },
                    { status: 'cancelled' },
                ],
                apiToken: 'sk-1234567890abcdef',
            },
        }),
    );
    assert.equal(verification.status, 200);

    const masPayload = {
        runId,
        eventId: 'evt-4',
        kind: 'mas',
        at: now,
        data: {
            status: 'completed',
            context: { level: 'one' },
            startedAt: now,
            completedAt: now,
            finalOutput: 'done',
        },
    };
    const mas = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify(masPayload),
    );
    assert.equal(mas.status, 200);

    const runDir = path.join(root, '.local', 'mas-runs', runId);
    const eventsPath = path.join(runDir, 'events.jsonl');
    const summaryPath = path.join(runDir, 'summary.json');
    const configPath = path.join(runDir, 'configuration.json');
    const verificationPath = path.join(runDir, 'verification.json');
    const masPath = path.join(runDir, 'mas.json');

    assert.equal(await countEventRows(eventsPath), 4);
    const summaryText = await readFile(summaryPath, 'utf8');
    const summary = readJson(summaryText);
    assert.equal(summary.totalEvents, 4);
    assert.equal(summary.lastKind, 'mas');
    assert.equal(summary.lastEventId, masPayload.eventId);
    assert.equal(summary.status, 'completed');
    assert.equal(summary.context.level, 'one');
    assert.equal(summary.startedAt, now);
    assert.equal(summary.completedAt, now);
    assert.equal(summary.verificationCounts.total, 7);
    assert.equal(summary.verificationCounts.verified, 2);
    assert.equal(summary.verificationCounts.failed, 1);
    assert.equal(summary.verificationCounts.pending, 1);
    assert.equal(summary.verificationCounts.not_checked, 1);
    assert.equal(summary.verificationCounts.partial, 1);
    assert.equal(summary.verificationCounts.cancelled, 1);
    assert.equal(summary.verificationCounts.withFindings, 2);
    assert.equal(summary.verificationCounts.annotations, 2);

    const configText = await readFile(configPath, 'utf8');
    assert.equal(configText.includes('sk-'), false);
    assert.equal(readJson(configText).openai.apiKey.includes('REDACTED'), true);

    const verificationText = await readFile(verificationPath, 'utf8');
    assert.equal(verificationText.includes('sk-'), false);
    assert.equal(readJson(verificationText).summary, 'ok');

    const masExists = await readFile(masPath, 'utf8');
    assert.equal(masExists.includes('completed'), true);
});

test('duplicate request should repair stale snapshots and preserve dedup', async (t) => {
    const root = await mkTempRoot();
    const { port } = await startArchiveServer(root, t);
    const runId = `run-${randomUUID()}`;

    const now = new Date().toISOString();
    const payload = JSON.stringify({
        runId,
        eventId: 'evt-1',
        kind: 'configuration',
        at: now,
        data: {
            credentials: {
                apiKey: 'sk-abcdefghijklmnopqrstuvwxyz',
            },
        },
    });

    const first = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        payload,
    );
    assert.equal(first.status, 200);
    assert.equal(readJson(first.body).duplicate, false);

    const runDir = path.join(root, '.local', 'mas-runs', runId);
    const configPath = path.join(runDir, 'configuration.json');
    const eventsPath = path.join(runDir, 'events.jsonl');
    assert.equal(await countEventRows(eventsPath), 1);
    await rm(configPath, { force: true });
    assert.equal(await readFile(configPath, 'utf8').catch(() => null), null);

    const duplicate = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        payload,
    );
    assert.equal(duplicate.status, 200);
    assert.equal(readJson(duplicate.body).duplicate, true);
    assert.equal(await countEventRows(eventsPath), 1);
    const repaired = await readFile(configPath, 'utf8');
    assert.equal(repaired.includes('REDACTED'), true);
});

test('serializes writes and avoids duplicate event ids under concurrency', async (t) => {
    const root = await mkTempRoot();
    const { port } = await startArchiveServer(root, t);
    const runId = `run-${randomUUID()}`;
    const now = new Date().toISOString();

    const requests = Array.from({ length: 20 }, (_, index) =>
        sendRequest(
            port,
            'POST',
            '/__agentopia_archive',
            JSON.stringify({
                runId,
                eventId: `evt-${index}`,
                kind: 'normal',
                at: now,
                data: { step: index },
            }),
        ),
    );

    const responses = await Promise.all(requests);
    assert.equal(
        responses.every((entry) => entry.status === 200),
        true,
    );

    const eventsPath = path.join(
        root,
        '.local',
        'mas-runs',
        runId,
        'events.jsonl',
    );
    assert.equal(await countEventRows(eventsPath), 20);

    const summary = await readFile(
        path.join(root, '.local', 'mas-runs', runId, 'summary.json'),
        'utf8',
    );
    assert.equal(readJson(summary).totalEvents, 20);
});

test('supports ipv6 loopback host header while rejecting non-loopback', async (t) => {
    const root = await mkTempRoot();
    const { port } = await startArchiveServer(root, t);
    const runId = `run-${randomUUID()}`;

    const good = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId,
            eventId: 'evt-1',
            kind: 'normal',
            at: new Date().toISOString(),
            data: {},
        }),
        {
            host: `[::1]:${port}`,
        },
    );
    assert.equal(good.status, 200);

    const bad = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId,
            eventId: 'evt-2',
            kind: 'normal',
            at: new Date().toISOString(),
            data: {},
        }),
        {
            host: '[fe80::1]:1234',
        },
    );
    assert.equal(bad.status, 403);
});

test('rejects oversized payloads, bad IDs, foreign host, and foreign origin', async (t) => {
    const root = await mkTempRoot();
    const { port } = await startArchiveServer(root, t);

    const tooLarge = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId: 'run-large',
            eventId: 'big',
            kind: 'normal',
            at: new Date().toISOString(),
            data: { blob: 'a'.repeat(33 * 1024 * 1024) },
        }),
    );
    assert.equal(tooLarge.status, 413);

    const badId = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId: '../escape',
            eventId: 'x',
            kind: 'normal',
            at: new Date().toISOString(),
            data: {},
        }),
    );
    assert.equal(badId.status, 400);

    const foreignHost = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId: 'run-host',
            eventId: 'x',
            kind: 'normal',
            at: new Date().toISOString(),
            data: {},
        }),
        {
            host: 'evil.example',
        },
    );
    assert.equal(foreignHost.status, 403);

    const foreignOrigin = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId: 'run-origin',
            eventId: 'x',
            kind: 'normal',
            at: new Date().toISOString(),
            data: {},
        }),
        {
            host: `127.0.0.1:${port}`,
            origin: `http://127.0.0.1:${port + 1}`,
        },
    );
    assert.equal(foreignOrigin.status, 403);
});

test('does not treat prototype-chain keys as snapshots', async (t) => {
    const root = await mkTempRoot();
    const { port } = await startArchiveServer(root, t);
    for (const kind of ['__proto__', 'constructor', 'prototype']) {
        const runId = `run-${randomUUID()}`;
        const eventsPath = path.join(
            root,
            '.local',
            'mas-runs',
            runId,
            'events.jsonl',
        );
        const snapshotPath = path.join(
            root,
            '.local',
            'mas-runs',
            runId,
            'configuration.json',
        );

        const response = await sendRequest(
            port,
            'POST',
            '/__agentopia_archive',
            JSON.stringify({
                runId,
                eventId: 'evt-1',
                kind,
                at: new Date().toISOString(),
                data: { value: 'x' },
            }),
        );

        assert.equal(response.status, 200);
        assert.equal(await countEventRows(eventsPath), 1);
        assert.equal(
            await readFile(snapshotPath, 'utf8').catch(() => null),
            null,
        );
    }
});

test('recovers from trailing partial events line before appending next record', async (t) => {
    const root = await mkTempRoot();
    const { port } = await startArchiveServer(root, t);
    const runId = `run-${randomUUID()}`;
    const runDir = path.join(root, '.local', 'mas-runs', runId);
    const eventsPath = path.join(runDir, 'events.jsonl');
    await mkdir(runDir, { recursive: true });
    await writeFile(eventsPath, '{"runId":"oops"', 'utf8');

    const response = await sendRequest(
        port,
        'POST',
        '/__agentopia_archive',
        JSON.stringify({
            runId,
            eventId: 'evt-1',
            kind: 'normal',
            at: new Date().toISOString(),
            data: { value: 'fresh' },
        }),
    );
    assert.equal(response.status, 200);
    assert.equal(await countEventRows(eventsPath), 2);

    const summary = await readFile(path.join(runDir, 'summary.json'), 'utf8');
    assert.equal(readJson(summary).totalEvents, 1);
});
