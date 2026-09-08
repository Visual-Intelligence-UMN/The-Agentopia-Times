import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildStrategyJudgeMessages,
    parseStrategyJudgeResult,
    runStrategyJudge,
} from '../src/langgraph/strategyJudge.ts';

const input = {
    level: {
        id: 'level1',
        risk: 'error_propagation' as const,
        calibrationTarget: 'Stop a false claim from crossing departments.',
        scenarioPrompt: 'One Ghost Agent introduces a false claim.',
    },
    configuration: {
        workflow: ['sequential', 'voting', 'single_agent'],
        stages: [
            { index: 0, strategy: 'sequential', agents: ['Ghost Agent'] },
            { index: 1, strategy: 'voting', agents: ['Agent 2', 'Agent 3'] },
        ],
    },
    trace: [{ stageIndex: 0, output: 'A false claim.' }],
    draftReport: 'A corrected report.',
    draftVisualization: '{"mark":"bar"}',
};

test('Strategy Judge sees the original run but never receives Gold output', () => {
    const messages = buildStrategyJudgeMessages(input);
    const serialized = JSON.stringify(messages);

    assert.match(serialized, /error_propagation/);
    assert.match(serialized, /A false claim/);
    assert.match(serialized, /A corrected report/);
    assert.doesNotMatch(serialized, /Gold Report|goldOutput|reference answer/i);
});

test('Strategy Judge parser clamps scores and requires trace evidence', () => {
    assert.deepEqual(
        parseStrategyJudgeResult(
            JSON.stringify({
                score: 12,
                explanation: 'The voting stage removed the injected claim.',
                evidence: [
                    { stageIndex: 1, observation: 'The majority rejected it.' },
                ],
            }),
        ),
        {
            score: 10,
            explanation: 'The voting stage removed the injected claim.',
            evidence: [
                { stageIndex: 1, observation: 'The majority rejected it.' },
            ],
        },
    );

    assert.throws(
        () =>
            parseStrategyJudgeResult(
                JSON.stringify({ score: 8, explanation: 'Looks safe.', evidence: [] }),
            ),
        /evidence/i,
    );
});

test('Strategy Judge uses one completion and returns the structured score', async () => {
    let calls = 0;
    const result = await runStrategyJudge(input, {
        complete: async () => {
            calls += 1;
            return JSON.stringify({
                score: 8.4,
                explanation: 'The configured review contained the risk.',
                evidence: [
                    { stageIndex: 1, observation: 'Only the corrected claim survived.' },
                ],
            });
        },
    });

    assert.equal(calls, 1);
    assert.equal(result.score, 8.4);
});
