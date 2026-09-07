import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
    abortableWorkflowStep,
    runSceneWorkflow,
} from '../src/game/domain/workflowRun.ts';

test('shutdown settles a movement wait whose tween will never complete', async () => {
    const abort = new AbortController();
    const pending = abortableWorkflowStep(
        new Promise<void>(() => {}),
        abort.signal,
    );
    abort.abort();
    await assert.rejects(pending, { name: 'AbortError' });
});

test('a completed movement preserves its result', async () => {
    assert.equal(
        await abortableWorkflowStep(
            Promise.resolve('arrived'),
            new AbortController().signal,
        ),
        'arrived',
    );
});

function fixture() {
    const values = new Map<string, unknown>();
    return {
        registry: {
            get: (key: string) => values.get(key),
            set: (key: string, value: unknown) => values.set(key, value),
        },
        events: new EventEmitter(),
    };
}

test('a completed run releases the lock and permits the next run', async () => {
    const scene = fixture();
    let calls = 0;
    const run = async () => {
        assert.equal(scene.registry.get('isWorkflowRunning'), true);
        calls++;
    };
    await runSceneWorkflow(scene, run, assert.fail);
    await runSceneWorkflow(scene, run, assert.fail);
    assert.equal(calls, 2);
    assert.equal(scene.registry.get('isWorkflowRunning'), false);
    assert.equal(scene.events.listenerCount('shutdown'), 0);
});

test('repeated Start while running does not start another workflow', async () => {
    const scene = fixture();
    let release!: () => void;
    const first = runSceneWorkflow(
        scene,
        () =>
            new Promise<void>((resolve) => {
                release = resolve;
            }),
        assert.fail,
    );
    await runSceneWorkflow(
        scene,
        () => assert.fail('duplicate run'),
        assert.fail,
    );
    release();
    await first;
});

test('failure is reported once and releases the lock', async () => {
    const scene = fixture();
    const error = new Error('invalid model output');
    const errors: unknown[] = [];
    await runSceneWorkflow(
        scene,
        async () => {
            throw error;
        },
        (failure) => {
            errors.push(failure);
        },
    );
    assert.deepEqual(errors, [error]);
    assert.equal(scene.registry.get('isWorkflowRunning'), false);
});

test('an old run cannot report failure or unlock a new scene after Reset', async () => {
    const scene = fixture();
    let reject!: (error: Error) => void;
    const oldRun = runSceneWorkflow(
        scene,
        () =>
            new Promise<void>((_resolve, fail) => {
                reject = fail;
            }),
        () => assert.fail('stale error'),
    );
    scene.events.emit('shutdown');
    scene.registry.set('isWorkflowRunning', true);
    reject(new Error('aborted'));
    await oldRun;
    assert.equal(scene.registry.get('isWorkflowRunning'), true);
    assert.equal(scene.events.listenerCount('shutdown'), 0);
});
