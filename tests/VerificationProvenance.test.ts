import assert from 'node:assert/strict';
import test from 'node:test';

import { parseVerificationResponse } from '../src/game/domain/outputVerification.ts';
import { createVerificationProvenance } from '../src/game/domain/verificationProvenance.ts';

const strategies = ['sequential', 'voting', 'single_agent', 'discussion'];

for (const ghostFinishesFirst of [true, false]) {
    test(`stage-zero Voting peers remain independent when the Ghost completes ${ghostFinishesFirst ? 'first' : 'last'}`, () => {
        const provenance = createVerificationProvenance();
        provenance.beginStage(0, 'voting');
        if (ghostFinishesFirst) {
            assert.deepEqual(provenance.agentSources(0, 'Ghost', 'Ghost'), [
                'Ghost',
            ]);
        }

        assert.deepEqual(provenance.agentSources(0, 'Normal A'), []);
        assert.deepEqual(provenance.agentSources(0, 'Normal B'), []);

        if (!ghostFinishesFirst) {
            assert.deepEqual(provenance.agentSources(0, 'Ghost', 'Ghost'), [
                'Ghost',
            ]);
        }
        assert.deepEqual(provenance.stageSources(0), ['Ghost']);
    });
}

test('sequential agents inherit the preceding output after the Ghost speaks', () => {
    const provenance = createVerificationProvenance();
    provenance.beginStage(0, 'sequential');

    assert.deepEqual(provenance.agentSources(0, 'First normal'), []);
    assert.deepEqual(provenance.agentSources(0, 'Ghost', 'Ghost'), ['Ghost']);
    assert.deepEqual(provenance.agentSources(0, 'Second normal'), ['Ghost']);
    assert.deepEqual(provenance.agentSources(0, 'Third normal'), ['Ghost']);
    assert.deepEqual(provenance.stageSources(0), ['Ghost']);
});

test('discussion excludes pre-Ghost turns and includes later turns and the summary', () => {
    const provenance = createVerificationProvenance();
    provenance.beginStage(0, 'discussion');

    assert.deepEqual(provenance.agentSources(0, 'First speaker'), []);
    assert.deepEqual(provenance.agentSources(0, 'Ghost', 'Ghost'), ['Ghost']);
    const laterSources = provenance.agentSources(0, 'Later speaker');
    const verdict = parseVerificationResponse(
        '{"annotations":[]}',
        'Accurate reply.',
        [],
    );

    assert.deepEqual(verdict, { annotations: [], rejectedCount: 0 });
    assert.deepEqual(laterSources, ['Ghost']);
    assert.deepEqual(provenance.stageSources(0), ['Ghost']);
    provenance.beginStage(1, 'single_agent');
    assert.deepEqual(provenance.agentSources(1, 'Writer'), ['Ghost']);
});

for (const strategy of strategies) {
    test(`${strategy} retains inherited stage sources for every agent`, () => {
        const provenance = createVerificationProvenance();
        provenance.beginStage(0, 'single_agent');
        provenance.agentSources(0, 'Original Ghost', 'Original Ghost');
        provenance.beginStage(1, strategy);

        assert.deepEqual(provenance.stageSources(1), ['Original Ghost']);
        assert.deepEqual(provenance.agentSources(1, 'Normal A'), [
            'Original Ghost',
        ]);
        if (strategy !== 'single_agent') {
            assert.deepEqual(provenance.agentSources(1, 'Normal B'), [
                'Original Ghost',
            ]);
        }
        assert.deepEqual(provenance.stageSources(1), ['Original Ghost']);
    });

    test(`${strategy} leaves outputs ineligible when there is no Ghost ancestry`, () => {
        const provenance = createVerificationProvenance();
        provenance.beginStage(0, strategy);

        assert.deepEqual(provenance.agentSources(0, 'Normal A'), []);
        if (strategy !== 'single_agent') {
            assert.deepEqual(provenance.agentSources(0, 'Normal B'), []);
        }
        assert.deepEqual(provenance.stageSources(0), []);
        provenance.beginStage(1, 'single_agent');
        assert.deepEqual(provenance.agentSources(1, 'Writer'), []);
    });
}

test('Voting summaries union every Ghost branch without passing local Ghosts to peers', () => {
    const provenance = createVerificationProvenance();
    provenance.beginStage(0, 'voting');
    provenance.agentSources(0, 'Ghost A', 'Ghost A');
    provenance.agentSources(0, 'Normal voter');
    provenance.agentSources(0, 'Ghost B', 'Ghost B');
    assert.deepEqual(provenance.stageSources(0), ['Ghost A', 'Ghost B']);

    provenance.beginStage(1, 'voting');
    assert.deepEqual(provenance.agentSources(1, 'Ghost C', 'Ghost C'), [
        'Ghost A',
        'Ghost B',
        'Ghost C',
    ]);
    assert.deepEqual(provenance.agentSources(1, 'Normal voter'), [
        'Ghost A',
        'Ghost B',
    ]);
    assert.deepEqual(provenance.stageSources(1), [
        'Ghost A',
        'Ghost B',
        'Ghost C',
    ]);

    provenance.beginStage(2, 'discussion');
    assert.deepEqual(provenance.agentSources(2, 'Final writer'), [
        'Ghost A',
        'Ghost B',
        'Ghost C',
    ]);
});

test('returned agent and stage source arrays cannot mutate stored provenance', () => {
    const provenance = createVerificationProvenance();
    provenance.beginStage(0, 'sequential');
    const agentSources = provenance.agentSources(0, 'Ghost', 'Ghost');
    const stageSources = provenance.stageSources(0);
    agentSources.push('Unrelated agent');
    stageSources[0] = 'Altered source';

    assert.deepEqual(provenance.stageSources(0), ['Ghost']);
    assert.deepEqual(provenance.agentSources(0, 'Downstream'), ['Ghost']);
    provenance.beginStage(1, 'voting');
    const peerSources = provenance.agentSources(1, 'Peer A');
    peerSources.length = 0;
    assert.deepEqual(provenance.agentSources(1, 'Peer B'), ['Ghost']);
    assert.deepEqual(provenance.stageSources(1), ['Ghost']);
});

test('a stage snapshots its input sources at beginStage', () => {
    const provenance = createVerificationProvenance();
    provenance.beginStage(0, 'voting');
    provenance.agentSources(0, 'Original Ghost', 'Original Ghost');
    provenance.beginStage(1, 'voting');
    provenance.agentSources(0, 'Later Ghost', 'Later Ghost');

    assert.deepEqual(provenance.stageSources(0), [
        'Original Ghost',
        'Later Ghost',
    ]);
    assert.deepEqual(provenance.agentSources(1, 'Peer A'), ['Original Ghost']);
    assert.deepEqual(provenance.agentSources(1, 'Peer B'), ['Original Ghost']);
    assert.deepEqual(provenance.stageSources(1), ['Original Ghost']);
});

test('repeated discussion speakers preserve accumulated sources without duplicates', () => {
    const provenance = createVerificationProvenance();
    provenance.beginStage(0, 'discussion');
    provenance.agentSources(0, 'Normal speaker');
    provenance.agentSources(0, 'Ghost A', 'Ghost A');
    provenance.agentSources(0, 'Normal speaker');
    provenance.agentSources(0, 'Ghost B', 'Ghost B');
    assert.deepEqual(provenance.agentSources(0, 'Ghost A', 'Ghost A'), [
        'Ghost A',
        'Ghost B',
    ]);
    assert.deepEqual(provenance.stageSources(0), ['Ghost A', 'Ghost B']);
});

test('new workflow trackers do not inherit another workflow sources', () => {
    const previous = createVerificationProvenance();
    previous.beginStage(0, 'single_agent');
    previous.agentSources(0, 'Ghost', 'Ghost');

    const current = createVerificationProvenance();
    assert.deepEqual(current.stageSources(0), []);
    current.beginStage(0, 'single_agent');
    assert.deepEqual(current.agentSources(0, 'Normal agent'), []);
});

test('an agent output without a begun stage fails explicitly', () => {
    const provenance = createVerificationProvenance();
    assert.throws(
        () => provenance.agentSources(0, 'Ghost', 'Ghost'),
        /stage 0 has not begun/,
    );
});
