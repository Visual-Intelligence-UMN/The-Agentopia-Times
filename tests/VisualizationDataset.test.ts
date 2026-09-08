import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getVisualizationData,
    getVisualizationDataForAgent,
    getVisualizationDatasetContext,
} from '../src/vega/visualizationData.ts';

test('the canonical kidney dataset ID selects kidney chart data and treatment facets', () => {
    const context = getVisualizationDatasetContext('kidney');

    assert.equal(context.id, 'kidney');
    assert.equal(context.facetField, 'treatment');
    assert.equal(context.comparisonField, 'stone size');
    assert.match(context.data, /Treatment A/);
    assert.doesNotMatch(context.data, /Derek Jeter/);
});

test('the canonical baseball dataset ID selects baseball chart data and player facets', () => {
    const context = getVisualizationDatasetContext('baseball');

    assert.equal(context.id, 'baseball');
    assert.equal(context.facetField, 'player');
    assert.equal(context.comparisonField, 'year');
    assert.match(context.data, /Derek Jeter/);
    assert.doesNotMatch(context.data, /Treatment A/);
});

test('Ghost visualization evidence reverses labels without exposing real group assignments', () => {
    const baseball = JSON.parse(getVisualizationData('baseball', true));
    const kidney = JSON.parse(getVisualizationData('kidney', true));

    assert.deepEqual(baseball[0], {
        category: 'Derek Jeter',
        value: 104,
        year: 1995,
        tag: 'hit',
    });
    assert.deepEqual(kidney[0], {
        category: 'Treatment B',
        value: 71,
        size: 'large',
        tag: 'failed',
    });
});

test('visualization-room evidence is isolated by participant identity', () => {
    const normalAgent = { getBias: () => '' };
    const ghostAgent = { getBias: () => 'injected-error' };

    const normal = JSON.parse(
        getVisualizationDataForAgent('baseball', normalAgent),
    );
    const ghost = JSON.parse(
        getVisualizationDataForAgent('baseball', ghostAgent),
    );

    assert.deepEqual(normal[0], {
        category: 'David Justice',
        value: 104,
        year: 1995,
        tag: 'hit',
    });
    assert.deepEqual(ghost[0], {
        category: 'Derek Jeter',
        value: 104,
        year: 1995,
        tag: 'hit',
    });
    assert.notDeepEqual(normal, ghost);
});
