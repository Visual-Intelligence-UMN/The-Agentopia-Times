import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getVerificationRecords,
    getVerifiedOutput,
    resetVerificationStore,
    subscribeToVerification,
    updateVerifiedOutput,
} from '../src/game/verificationStore.ts';

test('React store snapshots keep stable references until an update or reset', () => {
    resetVerificationStore();
    const initial = getVerificationRecords();
    assert.equal(initial, getVerificationRecords());
    let updates = 0;
    const unsubscribe = subscribeToVerification(() => {
        updates++;
    });
    const record = {
        id: 'run:1',
        runId: 'run',
        stageIndex: 0,
        producer: 'speaker',
        model: 'test',
        text: 'A title',
        ghostSources: [],
        evidence: [],
        status: 'not_checked' as const,
        annotations: [],
        rejectedCount: 0,
    };
    updateVerifiedOutput(record);
    assert.notEqual(initial, getVerificationRecords());
    assert.equal(getVerificationRecords(), getVerificationRecords());
    assert.equal(getVerifiedOutput(record.id), getVerifiedOutput(record.id));
    assert.equal(getVerifiedOutput(record.id)?.text, record.text);
    assert.equal(updates, 1);
    resetVerificationStore();
    assert.equal(getVerifiedOutput(record.id), undefined);
    assert.deepEqual(getVerificationRecords(), []);
    assert.equal(getVerificationRecords(), getVerificationRecords());
    unsubscribe();
    resetVerificationStore();
    assert.equal(updates, 2);
});
