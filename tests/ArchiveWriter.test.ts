import assert from 'node:assert/strict';
import test from 'node:test';

import { redactArchiveData } from '../src/utils/archiveRedaction.ts';
import {
    type ArchiveEvent,
    type ArchiveOutbox,
    createArchiveWriter,
} from '../src/utils/localRunArchive.ts';

function memoryOutbox(): ArchiveOutbox {
    let sequence = 0;
    const entries = new Map<number, ArchiveEvent>();
    return {
        async put(event) {
            entries.set(++sequence, event);
        },
        async list() {
            return [...entries].map(([key, event]) => ({ key, event }));
        },
        async remove(key) {
            entries.delete(key);
        },
    };
}
const event = (eventId: string, runId = 'run-one'): ArchiveEvent => ({
    eventId,
    runId,
    kind: 'mas',
    at: new Date().toISOString(),
    data: { output: eventId },
});

test('archives independent runs and late verification in order without rewriting old snapshots', async () => {
    const sent: ArchiveEvent[] = [];
    const writer = createArchiveWriter(memoryOutbox(), async (item) => {
        sent.push(item);
    });
    const first = event('one');
    await writer.append(first);
    first.data = 'mutated';
    await writer.append(event('two', 'run-two'));
    await writer.append({ ...event('late'), kind: 'verification' });
    await writer.flush();
    assert.deepEqual(
        sent.map((item) => [item.runId, item.kind]),
        [
            ['run-one', 'mas'],
            ['run-two', 'mas'],
            ['run-one', 'verification'],
        ],
    );
    assert.deepEqual(sent[0].data, { output: 'one' });
});

test('failed delivery survives a new writer and retries the same event ID', async () => {
    const outbox = memoryOutbox();
    const first = createArchiveWriter(outbox, async () => {
        throw Error('offline');
    });
    await first.append(event('retry-id'));
    await assert.rejects(first.flush(), /offline/);
    const sent: string[] = [];
    const restored = createArchiveWriter(outbox, async (item) => {
        sent.push(item.eventId);
    });
    await Promise.all([restored.flush(), restored.flush()]);
    assert.deepEqual(sent, ['retry-id']);
    assert.equal((await outbox.list()).length, 0);
});

test('temporary storage failure retains unsaved data for the next flush', async () => {
    const outbox = memoryOutbox();
    const original = outbox.put;
    let failed = false;
    outbox.put = async (item) => {
        if (!failed) {
            failed = true;
            throw Error('storage');
        }
        await original(item);
    };
    const sent: string[] = [];
    const writer = createArchiveWriter(outbox, async (item) => {
        sent.push(item.eventId);
    });
    await assert.rejects(writer.append(event('unsaved')), /storage/);
    await writer.flush();
    assert.deepEqual(sent, ['unsaved']);
});

test('redacts credential fields and secrets embedded in failure strings, retaining token usage', () => {
    const value = redactArchiveData({
        apiKey: 'abc',
        Authorization: 'Bearer abc',
        nested: [{ password: 'secret' }],
        error: 'failed with sk-proj-secret-token and Bearer session-token',
        totalTokens: 123,
    });
    assert.deepEqual(value, {
        apiKey: '[REDACTED]',
        Authorization: '[REDACTED]',
        nested: [{ password: '[REDACTED]' }],
        error: 'failed with [REDACTED] and Bearer [REDACTED]',
        totalTokens: 123,
    });
});
