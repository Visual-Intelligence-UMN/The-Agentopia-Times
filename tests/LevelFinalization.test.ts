import assert from 'node:assert/strict';
import test from 'node:test';

import { goldOutputs } from '../src/game/config/goldOutputs.ts';
import { finalizeLevelOutput } from '../src/langgraph/finalizeLevelRun.ts';
import { runQualityEditor } from '../src/langgraph/qualityEditor.ts';

const input = {
    strategyInput: {
        level: {
            id: 'level1',
            risk: 'error_propagation' as const,
            calibrationTarget: 'Contain propagation.',
            scenarioPrompt: 'A Ghost injects an error.',
        },
        configuration: {
            levelId: 'level1',
            datasetId: 'baseball',
            risk: 'error_propagation' as const,
            requiredScore: 8,
            managerId: null,
            managerReviewApproved: false,
            stages: [
                {
                    strategy: 'voting' as const,
                    agents: [
                        { id: 'ghost', ghost: true },
                        { id: 'reviewer-a', ghost: false },
                        { id: 'reviewer-b', ghost: false },
                    ],
                },
            ],
        },
        trace: [{ stageIndex: 0, output: 'draft' }],
        draftReport: 'Original draft report with enough content for testing.',
        draftVisualization: '{"mark":"point"}',
    },
    qualityInput: {
        dataset: {
            id: 'baseball',
            description: 'Baseball data.',
            researchQuestion: 'What does the paradox show?',
            groundTruth: 'Justice leads yearly; Jeter leads overall.',
            neutralStatistics: 'Known rates.',
            goldOutput: goldOutputs.baseball,
        },
        rubrics: ['correctness'],
    },
};

test('an unusable editor chart falls back to grading the actual Voting drafts', async () => {
    const events: Array<{ type: string; data: any }> = [];
    let attempts = 0;
    const result = await finalizeLevelOutput(input, {
        judgeStrategy: async () => ({ score: 8, explanation: 'Contained.', evidence: [] }),
        refineOutput: (qualityInput, signal) => runQualityEditor(qualityInput, {
            signal,
            complete: async () => {
                attempts += 1;
                return JSON.stringify({
                    reportMarkdown: goldOutputs.baseball.reportMarkdown,
                    visualizationSpec: { title: 'Yearly versus combined' },
                    vconcat: [{ mark: 'point' }],
                });
            },
        }),
        gradeOutput: async (output) => {
            assert.equal(output.reportMarkdown, input.strategyInput.draftReport);
            assert.equal(output.visualizationSpec, input.strategyInput.draftVisualization);
            return { overall_score: '6.4' };
        },
        onEvent: (type, data) => events.push({ type, data }),
    });
    assert.equal(attempts, 2);
    assert.equal(result.strategy.score, 8);
    assert.equal(result.outputScore, 6.4);
    assert.deepEqual(result.refinement, { applied: false, goldOutputVersion: null });
    assert.deepEqual(events.map(event => event.type), [
        'strategy_judgement_started', 'strategy_judgement_completed',
        'quality_refinement_started', 'quality_refinement_failed',
        'output_scoring_started', 'output_scoring_completed',
    ]);
    assert.equal(events[4].data.refinementApplied, false);
    assert.match(events[3].data.reason, /invalid visualization/i);
});

test('cancelled refinement does not fall back or grade', async () => {
    const controller = new AbortController();
    await assert.rejects(finalizeLevelOutput(input, {
        signal: controller.signal,
        judgeStrategy: async () => ({ score: 8, explanation: 'Contained.', evidence: [] }),
        refineOutput: async () => { controller.abort(); throw new Error('Cancelled request'); },
        gradeOutput: async () => { assert.fail('Cancelled runs must not be graded'); },
    }), { name: 'AbortError' });
});

test('a Strategy Score below 8 skips Gold refinement and cannot pass', async () => {
    const calls: string[] = [];
    const events: string[] = [];
    const result = await finalizeLevelOutput(input, {
        onEvent: (type) => events.push(type),
        judgeStrategy: async () => {
            calls.push('strategy');
            return {
                score: 7.99,
                explanation: 'Partial containment.',
                evidence: [{ stageIndex: 0, observation: 'One weak check.' }],
            };
        },
        refineOutput: async () => {
            calls.push('refine');
            throw new Error('must not run');
        },
        gradeOutput: async ({ reportMarkdown, visualizationSpec }) => {
            calls.push('grade');
            assert.equal(reportMarkdown, input.strategyInput.draftReport);
            assert.equal(
                visualizationSpec,
                input.strategyInput.draftVisualization,
            );
            return { overall_score: '6.00' };
        },
    });

    assert.deepEqual(calls, ['strategy', 'grade']);
    assert.deepEqual(events, [
        'strategy_judgement_started',
        'strategy_judgement_completed',
        'quality_refinement_skipped',
        'output_scoring_started',
        'output_scoring_completed',
    ]);
    assert.equal(result.passed, false);
    assert.equal(result.refinement.applied, false);
});

test('a Strategy Score of 8 refines both artifacts before grading and passes', async () => {
    const calls: string[] = [];
    const events: string[] = [];
    const result = await finalizeLevelOutput(input, {
        onEvent: (type) => events.push(type),
        judgeStrategy: async () => {
            calls.push('strategy');
            return {
                score: 8,
                explanation: 'Contained.',
                evidence: [
                    {
                        stageIndex: 1,
                        observation: 'Voting rejected the error.',
                    },
                ],
            };
        },
        refineOutput: async (qualityInput) => {
            calls.push('refine');
            assert.equal(
                qualityInput.dataset.goldOutput.version,
                '2026-09-07.1',
            );
            return {
                reportMarkdown: goldOutputs.baseball.reportMarkdown,
                visualizationSpec: goldOutputs.baseball.visualizationSpec,
            };
        },
        gradeOutput: async ({ reportMarkdown, visualizationSpec }) => {
            calls.push('grade');
            assert.match(reportMarkdown, /Subgroup and Pooled Results Reverse/);
            assert.ok(
                typeof visualizationSpec === 'object' &&
                    visualizationSpec !== null &&
                    'vconcat' in visualizationSpec &&
                    Array.isArray(visualizationSpec.vconcat),
            );
            assert.equal(visualizationSpec.vconcat.length, 2);
            return { overall_score: '9.20' };
        },
    });

    assert.deepEqual(calls, ['strategy', 'refine', 'grade']);
    assert.deepEqual(events, [
        'strategy_judgement_started',
        'strategy_judgement_completed',
        'quality_refinement_started',
        'quality_refinement_completed',
        'output_scoring_started',
        'output_scoring_completed',
    ]);
    assert.equal(result.passed, true);
    assert.equal(result.refinement.applied, true);
    assert.equal(result.outputScore, 9.2);
});

test('an unsafe default workflow cannot pass when the Strategy Judge incorrectly awards 8', async () => {
    const calls: string[] = [];
    const unsafeInput = {
        ...input,
        strategyInput: {
            ...input.strategyInput,
            configuration: {
                ...input.strategyInput.configuration,
                stages: [
                    {
                        strategy: 'sequential' as const,
                        agents: [{ id: 'title-agent', ghost: false }],
                    },
                    {
                        strategy: 'sequential' as const,
                        agents: [{ id: 'writer', ghost: false }],
                    },
                    {
                        strategy: 'sequential' as const,
                        agents: [
                            { id: 'visualizer', ghost: false },
                            { id: 'ghost', ghost: true },
                        ],
                    },
                ],
            },
        },
    };

    const result = await finalizeLevelOutput(unsafeInput, {
        judgeStrategy: async () => {
            calls.push('strategy');
            return {
                score: 8,
                explanation:
                    'The Ghost at the final stage acts as an independent validator.',
                evidence: [
                    {
                        stageIndex: 2,
                        observation: 'The Ghost appears in the final stage.',
                    },
                ],
            };
        },
        refineOutput: async () => {
            calls.push('refine');
            throw new Error(
                'unsafe strategies must not receive Gold refinement',
            );
        },
        gradeOutput: async ({ reportMarkdown, visualizationSpec }) => {
            calls.push('grade');
            assert.equal(reportMarkdown, unsafeInput.strategyInput.draftReport);
            assert.equal(
                visualizationSpec,
                unsafeInput.strategyInput.draftVisualization,
            );
            return { overall_score: '9.40' };
        },
    });

    assert.deepEqual(calls, ['strategy', 'grade']);
    assert.equal(result.strategy.score, 7);
    assert.equal(result.passed, false);
    assert.equal(result.refinement.applied, false);
    assert.match(result.strategy.explanation, /independent Voting stage/i);
});
