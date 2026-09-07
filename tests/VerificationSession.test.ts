import assert from 'node:assert/strict';
import test from 'node:test';

import { createVerificationSession } from '../src/game/domain/verificationSession.ts';

const output = {
    stageIndex: 0,
    producer: 'normal',
    text: 'Wrong title',
    ghostSources: ['ghost'],
};

test('verdict input contains only reference facts and output, never Ghost identity', async () => {
    let userInput = '';
    const session = createVerificationSession({
        runId: 'r',
        model: 'test',
        evidence: [],
        complete: async (input) => {
            userInput = input.user;
            return '{"annotations":[]}';
        },
    });
    const id = session.register(output);
    assert.equal(session.register(output), id);
    await session.finish();
    assert.deepEqual(JSON.parse(userInput), {
        referenceFacts: [],
        outputUnderReview: output.text,
    });
    assert.equal(session.records().length, 1);
    assert.deepEqual(session.get(id)?.ghostSources, ['ghost']);
    assert.equal(session.get(id)?.text, output.text);
    assert.equal(session.get(id)?.rawResponse, '{"annotations":[]}');
});

test('a failed or partially rejected check cannot look clean or stop later checks', async () => {
    let calls = 0;
    const session = createVerificationSession({
        runId: 'r',
        model: 'test',
        evidence: [],
        complete: async () => {
            calls++;
            if (calls === 1) throw new Error('Rate limited');
            if (calls === 2) return '{"annotations":[{"quote":"missing"}]}';
            return '{"annotations":[]}';
        },
    });
    const failed = session.register(output);
    const partial = session.register({ ...output, text: 'Other title' });
    const clean = session.register({ ...output, text: 'Correct title' });
    await session.finish();
    assert.equal(session.get(failed)?.status, 'failed');
    assert.equal(session.get(failed)?.error, 'Rate limited');
    assert.equal(session.get(partial)?.status, 'partial');
    assert.equal(session.get(partial)?.rejectedCount, 1);
    assert.equal(session.get(clean)?.status, 'verified');
});

test('cancelling a run aborts requests, drops late results, and cancels queued checks', async () => {
    let resolve!: (text: string) => void;
    let signal!: AbortSignal;
    let calls = 0;
    const session = createVerificationSession({
        runId: 'old',
        model: 'test',
        evidence: [],
        complete: async (_input, requestSignal) => {
            calls++;
            signal = requestSignal;
            return new Promise<string>((done) => {
                resolve = done;
            });
        },
    });
    const first = session.register(output);
    const second = session.register({ ...output, text: 'Queued title' });
    await Promise.resolve();
    session.cancel();
    assert.equal(signal.aborted, true);
    resolve('{"annotations":[]}');
    await session.finish();
    assert.equal(calls, 1);
    assert.equal(session.get(first)?.status, 'cancelled');
    assert.equal(session.get(second)?.status, 'cancelled');
    assert.equal(session.get(first)?.rawResponse, undefined);
    const next = createVerificationSession({
        runId: 'new',
        model: 'test',
        evidence: [],
        complete: async () => '{"annotations":[]}',
    });
    const nextId = next.register(output);
    await next.finish();
    assert.notEqual(first, nextId);
    assert.equal(next.get(nextId)?.status, 'verified');
});

test('registering outputs never waits for verification, and unaffected outputs make no requests', async () => {
    const calls: string[] = [];
    let inputPublishedBeforeResponse = false;
    let resolve!: (text: string) => void;
    const session = createVerificationSession({
        runId: 'run-1',
        model: 'test',
        evidence: [{ id: 'facts', text: 'Justice leads in each year.' }],
        onUpdate: (record) => {
            if (record.status === 'pending' && record.input)
                inputPublishedBeforeResponse = true;
        },
        complete: async (input) => {
            calls.push(input.user);
            return new Promise<string>((done) => {
                resolve = done;
            });
        },
    });
    const clean = session.register({
        stageIndex: 0,
        producer: 'normal',
        text: 'Title',
        ghostSources: [],
    });
    const affected = session.register({
        stageIndex: 0,
        producer: 'ghost',
        text: 'Wrong title',
        ghostSources: ['ghost'],
    });
    assert.equal(session.get(clean)?.status, 'not_checked');
    assert.equal(session.get(affected)?.status, 'pending');
    await Promise.resolve();
    assert.equal(calls.length, 1);
    assert.equal(inputPublishedBeforeResponse, true);
    resolve('{"annotations":[]}');
    await session.finish();
    assert.equal(session.get(affected)?.status, 'verified');
});
