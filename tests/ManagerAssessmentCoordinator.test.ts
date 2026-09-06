import assert from 'node:assert/strict';
import test from 'node:test';

import { createManagerAssessmentCoordinator } from '../src/game/domain/managerAssessmentCoordinator.ts';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((fulfill, fail) => {
        resolve = fulfill;
        reject = fail;
    });
    return { promise, resolve, reject };
}

test('keeps only the latest Manager assessment when assignments race', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const signals: AbortSignal[] = [];
    const readyManagers: string[] = [];
    let callCount = 0;
    const coordinator = createManagerAssessmentCoordinator<string, string>(
        (_manager, context) => {
            signals.push(context.signal);
            return callCount++ === 0 ? first.promise : second.promise;
        },
        {
            onReady: (manager) => readyManagers.push(manager),
        },
    );

    coordinator.assign('Manager A');
    const firstSnapshot = coordinator.capture();
    coordinator.assign('Manager B');
    const secondSnapshot = coordinator.capture();

    assert.ok(firstSnapshot);
    assert.ok(secondSnapshot);
    assert.equal(signals[0].aborted, true);

    first.resolve('assessment A');
    second.resolve('assessment B');

    assert.deepEqual(await firstSnapshot.outcome, {
        status: 'superseded',
    });
    assert.deepEqual(await secondSnapshot.outcome, {
        status: 'ready',
        assessment: 'assessment B',
    });
    assert.deepEqual(readyManagers, ['Manager B']);
});

test('does not surface a failure from a superseded Manager', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const failures: string[] = [];
    let callCount = 0;
    const coordinator = createManagerAssessmentCoordinator<string, string>(
        () => (callCount++ === 0 ? first.promise : second.promise),
        {
            onFailure: (manager) => failures.push(manager),
        },
    );

    coordinator.assign('Manager A');
    const firstSnapshot = coordinator.capture();
    coordinator.assign('Manager B');
    const secondSnapshot = coordinator.capture();

    assert.ok(firstSnapshot);
    assert.ok(secondSnapshot);
    first.reject(new Error('stale failure'));
    second.resolve('assessment B');

    assert.equal((await firstSnapshot.outcome).status, 'superseded');
    assert.equal((await secondSnapshot.outcome).status, 'ready');
    assert.deepEqual(failures, []);
});

test('captures a pending assessment immediately and refreshes it for a dataset change', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const signals: AbortSignal[] = [];
    let callCount = 0;
    const coordinator = createManagerAssessmentCoordinator<string, string>(
        (_manager, context) => {
            signals.push(context.signal);
            return callCount++ === 0 ? first.promise : second.promise;
        },
    );

    coordinator.assign('Manager A');
    const pendingSnapshot = coordinator.capture();

    assert.ok(pendingSnapshot);
    assert.equal(pendingSnapshot.manager, 'Manager A');

    coordinator.refresh();
    const refreshedSnapshot = coordinator.capture();

    assert.ok(refreshedSnapshot);
    assert.equal(signals[0].aborted, true);
    assert.notEqual(refreshedSnapshot.version, pendingSnapshot.version);

    first.resolve('old dataset assessment');
    second.resolve('new dataset assessment');

    assert.deepEqual(await pendingSnapshot.outcome, {
        status: 'superseded',
    });
    assert.deepEqual(await refreshedSnapshot.outcome, {
        status: 'ready',
        assessment: 'new dataset assessment',
    });
});
