import assert from 'node:assert/strict';
import test from 'node:test';

import {
    analyzeEventLog,
    encodeEvent,
} from '../src/game/utils/EventLogAnalysis.ts';

test('reports progression, retries, exploration, and configuration diversity', () => {
    const events = [
        {
            time: 1,
            log: encodeEvent({ type: 'dataset_selected', dataset: 'baseball' }),
        },
        {
            time: 2,
            log: encodeEvent({
                type: 'simulation_started',
                configuration: { dataset: 'baseball', workflow: ['parallel'] },
            }),
        },
        { time: 5, log: encodeEvent({ type: 'score_recorded', score: 5 }) },
        { time: 7, log: 'strategy_selected_route' },
        {
            time: 10,
            log: encodeEvent({
                type: 'simulation_started',
                configuration: { workflow: ['route'], dataset: 'baseball' },
            }),
        },
        { time: 14, log: encodeEvent({ type: 'score_recorded', score: 8 }) },
        {
            time: 20,
            log: encodeEvent({
                type: 'simulation_started',
                configuration: { dataset: 'baseball', workflow: ['route'] },
            }),
        },
        { time: 25, log: encodeEvent({ type: 'score_recorded', score: 7 }) },
    ];

    const report = analyzeEventLog(events);

    assert.deepEqual(
        report.scoreProgression.map(({ score, delta, bestSoFar }) => ({
            score,
            delta,
            bestSoFar,
        })),
        [
            { score: 5, delta: null, bestSoFar: 5 },
            { score: 8, delta: 3, bestSoFar: 8 },
            { score: 7, delta: -1, bestSoFar: 8 },
        ],
    );
    assert.deepEqual(report.retryPatterns, {
        attempts: 3,
        retries: 2,
        improvedRetries: 1,
        unchangedRetries: 0,
        regressedRetries: 1,
        averageScoreChange: 1,
        averageSecondsBetweenAttempts: 9,
    });
    assert.deepEqual(
        report.explorationTrajectory.map(({ type, value, beforeAttempt }) => ({
            type,
            value,
            beforeAttempt,
        })),
        [
            { type: 'dataset_selected', value: 'baseball', beforeAttempt: 1 },
            { type: 'strategy_selected', value: 'route', beforeAttempt: 2 },
        ],
    );
    assert.equal(report.configurationDiversity.configurationsTried, 3);
    assert.equal(report.configurationDiversity.uniqueConfigurations, 2);
    assert.equal(report.configurationDiversity.repeatedConfigurations, 1);
    assert.equal(report.configurationDiversity.diversityRatio, 2 / 3);
    assert.deepEqual(report.configurationDiversity.dimensions.dataset, [
        '"baseball"',
    ]);
});

test('returns stable empty metrics for a log with no attempts', () => {
    const report = analyzeEventLog([{ time: 1, log: 'agent_clicked' }]);

    assert.equal(report.retryPatterns.averageScoreChange, null);
    assert.equal(report.retryPatterns.averageSecondsBetweenAttempts, null);
    assert.equal(report.configurationDiversity.diversityRatio, 0);
    assert.equal(report.explorationTrajectory[0].beforeAttempt, 1);
});
