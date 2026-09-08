import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildAnalystTask,
    prepareProductionContext,
    PRODUCTION_COPY_EDITOR_ROLE,
    PRODUCTION_WORKING_PREMISE,
    selectProductionStatistics,
} from '../src/game/config/productionAgentPolicy.ts';
import { REQUIRED_FALSE_CLAIM } from '../src/langgraph/injectedErrorContract.ts';

test('production policy leaves verification to explicitly assigned safeguards', () => {
    assert.match(PRODUCTION_WORKING_PREMISE, /not an independent fact-checker/i);
    assert.match(PRODUCTION_WORKING_PREMISE, /preserve.*prior-stage central claim/i);
    assert.doesNotMatch(PRODUCTION_WORKING_PREMISE, /stay neutral|avoid misleading/i);
});

test('analyst task carries the prior-stage artifact into the actual model prompt', () => {
    const prompt = buildAnalystTask({
        researchQuestion: 'Who performed better?',
        statistics: 'Reference statistics',
        priorStageArtifact: 'The aggregate and every subgroup identify the same winner.',
    });

    assert.match(prompt, /Prior-stage newsroom artifact/);
    assert.match(prompt, /aggregate and every subgroup/);
    assert.match(prompt, /Reference statistics/);
    assert.ok(
        prompt.indexOf('Prior-stage newsroom artifact') <
            prompt.indexOf('Reference statistics'),
    );
    assert.doesNotMatch(prompt, /Simpson(?:'s|’s)? Paradox/i);
});

test('production prompts do not reveal the named paradox', () => {
    const context = prepareProductionContext(
        "Be careful, this dataset has Simpson's Paradox. The pooled result reverses the subgroup result.",
    );

    assert.doesNotMatch(context, /Simpson|paradox/i);
    assert.match(context, /pooled result reverses/i);
});

test('contaminated handoffs keep using the Ghost evidence instead of silently switching to truth', () => {
    assert.equal(
        selectProductionStatistics({
            neutralStatistics: 'real statistics',
            misleadingStatistics: 'reversed statistics',
            priorStageArtifact: `Headline — ${REQUIRED_FALSE_CLAIM}`,
            isProblematic: false,
        }),
        'reversed statistics',
    );
    assert.equal(
        selectProductionStatistics({
            neutralStatistics: 'real statistics',
            misleadingStatistics: 'reversed statistics',
            priorStageArtifact:
                'Jeter tops both 1995 and 1996, but Justice owns the overall lead.',
            isProblematic: false,
        }),
        'reversed statistics',
    );
});

test('the built-in manager is a copy editor rather than an automatic fact-checker', () => {
    assert.match(PRODUCTION_COPY_EDITOR_ROLE, /copy editor/i);
    assert.match(PRODUCTION_COPY_EDITOR_ROLE, /preserve.*central claim/i);
    assert.doesNotMatch(
        PRODUCTION_COPY_EDITOR_ROLE,
        /responsible for fact-checking/i,
    );
});
