import assert from 'node:assert/strict';
import test from 'node:test';

import { agenticRiskLevelDefinitions } from '../src/game/config/agenticRiskLevels.ts';
import {
    createLevelCompletionOutcome,
    inspectRiskConfiguration,
    type LevelRunConfiguration,
} from '../src/game/domain/levelCompletionPolicy.ts';
import { buildLevelRunConfiguration } from '../src/game/domain/levelRunEvaluation.ts';

function configuration(
    overrides: Partial<LevelRunConfiguration> = {},
): LevelRunConfiguration {
    return {
        levelId: 'level1',
        datasetId: 'baseball',
        risk: 'error_propagation',
        requiredScore: 8,
        managerId: null,
        managerReviewApproved: false,
        stages: [
            {
                strategy: 'sequential',
                agents: [{ id: 'ghost', ghost: true }],
            },
            {
                strategy: 'voting',
                agents: [
                    { id: 'writer-a', ghost: false },
                    { id: 'writer-b', ghost: false },
                ],
            },
            {
                strategy: 'single_agent',
                agents: [{ id: 'visualizer', ghost: false }],
            },
        ],
        ...overrides,
    };
}

test('the hidden Strategy Score is the only level-completion gate', () => {
    const below = createLevelCompletionOutcome({
        strategyScore: 7.99,
        outputScore: 10,
        refinementApplied: false,
        explanation: 'Partial containment.',
    });
    const passing = createLevelCompletionOutcome({
        strategyScore: 8,
        outputScore: 6,
        refinementApplied: true,
        explanation: 'The risk was contained.',
    });

    assert.equal(below.passed, false);
    assert.equal(below.reason, 'strategy_failed');
    assert.equal(passing.passed, true);
    assert.equal(passing.reason, 'strategy_passed');
    assert.equal(passing.refinementApplied, true);
});

test('the five risks enforce their intended structural intervention', () => {
    assert.equal(inspectRiskConfiguration(configuration()).correct, true);

    assert.equal(
        inspectRiskConfiguration(
            configuration({
                levelId: 'level2',
                risk: 'premature_consensus',
                stages: [
                    {
                        strategy: 'voting',
                        agents: [
                            { id: 'ghost', ghost: true },
                            { id: 'normal-a', ghost: false },
                            { id: 'normal-b', ghost: false },
                        ],
                    },
                ],
            }),
        ).correct,
        true,
    );

    assert.equal(
        inspectRiskConfiguration(
            configuration({
                levelId: 'level3',
                risk: 'verifier_capture',
                managerId: 'writer-a',
                managerReviewApproved: true,
            }),
        ).correct,
        true,
    );

    assert.equal(
        inspectRiskConfiguration(
            configuration({
                levelId: 'level4',
                risk: 'collusion',
                stages: [
                    {
                        strategy: 'voting',
                        agents: [
                            { id: 'ghost-a', ghost: true },
                            { id: 'normal-a', ghost: false },
                            { id: 'normal-b', ghost: false },
                        ],
                    },
                    {
                        strategy: 'voting',
                        agents: [
                            { id: 'ghost-b', ghost: true },
                            { id: 'normal-c', ghost: false },
                            { id: 'normal-d', ghost: false },
                        ],
                    },
                ],
            }),
        ).correct,
        true,
    );

    assert.equal(
        inspectRiskConfiguration(
            configuration({
                levelId: 'level5',
                risk: 'responsibility_diffusion',
                managerId: 'writer-a',
                managerReviewApproved: true,
            }),
        ).correct,
        true,
    );
});

test('manager-only risks do not pass when the review did not complete', () => {
    for (const risk of [
        'verifier_capture',
        'responsibility_diffusion',
    ] as const) {
        const result = inspectRiskConfiguration(
            configuration({
                risk,
                managerId: 'manager-a',
                managerReviewApproved: false,
            }),
        );
        assert.equal(result.correct, false);
        assert.match(result.explanation, /review/i);
    }
});

test('Manager coverage follows its real node, not a fixed room boundary', () => {
    const ghost = { id: 'ghost', ghost: true };
    const manager = { id: 'manager', ghost: false };
    for (const risk of ['verifier_capture', 'responsibility_diffusion'] as const) {
        const check = (stages: LevelRunConfiguration['stages']) => inspectRiskConfiguration(configuration({ risk, managerId: 'manager', managerReviewApproved: true, stages })).correct;
        assert.equal(check([{ strategy: 'sequential', agents: [ghost, manager] }]), true);
        assert.equal(check([{ strategy: 'sequential', agents: [manager, ghost] }]), false);
        assert.equal(check([{ strategy: 'voting', agents: [ghost, manager] }]), false);
        assert.equal(check([{ strategy: 'discussion', agents: [ghost, manager] }]), true);
        assert.equal(check([{ strategy: 'discussion', agents: [manager, ghost] }]), false);
        assert.equal(check([
            { strategy: 'single_agent', agents: [ghost] },
            { strategy: 'single_agent', agents: [{ id: 'writer', ghost: false }] },
            { strategy: 'single_agent', agents: [manager] },
        ]), true);
    }
});

test('colluding ghosts must be separated and independently aggregated', () => {
    const result = inspectRiskConfiguration(
        configuration({
            risk: 'collusion',
            stages: [
                {
                    strategy: 'voting',
                    agents: [
                        { id: 'ghost-a', ghost: true },
                        { id: 'ghost-b', ghost: true },
                        { id: 'normal', ghost: false },
                    ],
                },
            ],
        }),
    );

    assert.equal(result.correct, false);
    assert.match(result.explanation, /separate/i);
});

test('a nominal Voting label is not a safeguard without a normal-agent majority', () => {
    const result = inspectRiskConfiguration(
        configuration({
            risk: 'premature_consensus',
            stages: [
                {
                    strategy: 'voting',
                    agents: [
                        { id: 'ghost', ghost: true },
                        { id: 'normal', ghost: false },
                    ],
                },
            ],
        }),
    );

    assert.equal(result.correct, false);
});

test('visualization-stage voting cannot repair a propagated report claim', () => {
    const result = inspectRiskConfiguration(
        configuration({
            stages: [
                {
                    strategy: 'sequential',
                    agents: [{ id: 'ghost', ghost: true }],
                },
                {
                    strategy: 'sequential',
                    agents: [{ id: 'writer', ghost: false }],
                },
                {
                    strategy: 'voting',
                    agents: [
                        { id: 'visualizer-a', ghost: false },
                        { id: 'visualizer-b', ghost: false },
                    ],
                },
            ],
        }),
    );

    assert.equal(result.correct, false);
});

test('scene snapshots preserve stage strategy and Ghost placement for policy evaluation', () => {
    const level = {
        ...agenticRiskLevelDefinitions[0],
        tilemapKey: 'test-map',
    };
    const ghost = { getName: () => 'ghost-a', getBias: () => 'injected' };
    const normal = { getName: () => 'normal-a', getBias: () => '' };

    const result = buildLevelRunConfiguration({
        level,
        datasetId: 'baseball',
        workflow: ['sequential', 'voting', 'single_agent'],
        dataMaps: [
            [{ agents: [ghost] }],
            [{ agents: [normal] }, { agents: [normal] }],
            [{ agents: [normal] }],
        ],
        managerId: null,
        managerReviewApproved: false,
    });

    assert.deepEqual(result.stages[0], {
        strategy: 'sequential',
        agents: [{ id: 'ghost-a', ghost: true }],
    });
    assert.equal(inspectRiskConfiguration(result).correct, true);
});
