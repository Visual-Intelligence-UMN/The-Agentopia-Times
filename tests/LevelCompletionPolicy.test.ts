import assert from 'node:assert/strict';
import test from 'node:test';

import { agenticRiskLevelDefinitions } from '../src/game/config/agenticRiskLevels.ts';
import {
    evaluateAndRecordLevelAttempt,
    evaluateLevelAttempt,
    inspectRiskConfiguration,
    type LevelRunConfiguration,
} from '../src/game/domain/levelCompletionPolicy.ts';
import { buildLevelRunConfiguration } from '../src/game/domain/levelRunEvaluation.ts';

function memoryStorage() {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    };
}

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

test('a structurally unsafe strategy cannot pass even with a perfect quality score', () => {
    const result = evaluateLevelAttempt({
        configuration: configuration({
            stages: [
                {
                    strategy: 'sequential',
                    agents: [{ id: 'normal', ghost: false }],
                },
                {
                    strategy: 'single_agent',
                    agents: [{ id: 'ghost', ghost: true }],
                },
                {
                    strategy: 'single_agent',
                    agents: [{ id: 'visualizer', ghost: false }],
                },
            ],
        }),
        qualityScore: 10,
        previousCorrectAttempts: 0,
    });

    assert.equal(result.passed, false);
    assert.equal(result.configurationCorrect, false);
    assert.equal(result.correctStrategyAttempt, 0);
    assert.equal(result.reason, 'wrong_strategy');
});

test('a correct strategy is guaranteed to pass by its third completed attempt', () => {
    const first = evaluateLevelAttempt({
        configuration: configuration(),
        qualityScore: 6.6,
        previousCorrectAttempts: 0,
    });
    const second = evaluateLevelAttempt({
        configuration: configuration(),
        qualityScore: 6.6,
        previousCorrectAttempts: first.correctStrategyAttempt,
    });
    const third = evaluateLevelAttempt({
        configuration: configuration(),
        qualityScore: 6.6,
        previousCorrectAttempts: second.correctStrategyAttempt,
    });

    assert.deepEqual(
        [first.passed, second.passed, third.passed],
        [false, false, true],
    );
    assert.deepEqual(
        [
            first.requiredQualityScore,
            second.requiredQualityScore,
            third.requiredQualityScore,
        ],
        [8, 7, 0],
    );
    assert.equal(third.reason, 'attempt_guarantee');
});

test('quality can pass a correct strategy before the third attempt', () => {
    const result = evaluateLevelAttempt({
        configuration: configuration(),
        qualityScore: 7.2,
        previousCorrectAttempts: 1,
    });

    assert.equal(result.passed, true);
    assert.equal(result.correctStrategyAttempt, 2);
    assert.equal(result.reason, 'quality_met');
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

test('manager-only risks do not pass when the review did not complete', () => {
    for (const risk of [
        'verifier_capture',
        'responsibility_diffusion',
    ] as const) {
        const result = inspectRiskConfiguration(
            configuration({
                risk,
                managerId: 'writer-a',
                managerReviewApproved: false,
            }),
        );
        assert.equal(result.correct, false);
        assert.match(result.explanation, /review/i);
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

test('only completed runs with the same correct configuration consume protected attempts', () => {
    const storage = memoryStorage();
    const correct = configuration();
    const wrong = configuration({
        stages: [
            {
                strategy: 'single_agent',
                agents: [{ id: 'ghost', ghost: true }],
            },
        ],
    });

    const wrongResult = evaluateAndRecordLevelAttempt({
        configuration: wrong,
        qualityScore: 10,
        storage,
    });
    const first = evaluateAndRecordLevelAttempt({
        configuration: correct,
        qualityScore: 6.6,
        storage,
    });
    const second = evaluateAndRecordLevelAttempt({
        configuration: correct,
        qualityScore: 6.6,
        storage,
    });

    assert.equal(wrongResult.correctStrategyAttempt, 0);
    assert.equal(first.correctStrategyAttempt, 1);
    assert.equal(second.correctStrategyAttempt, 2);

    const changedManager = evaluateAndRecordLevelAttempt({
        configuration: { ...correct, managerId: 'manager-b' },
        qualityScore: 6.6,
        storage,
    });
    assert.equal(changedManager.correctStrategyAttempt, 1);

    const replacementGhost = evaluateAndRecordLevelAttempt({
        configuration: {
            ...correct,
            stages: correct.stages.map((stage) => ({
                ...stage,
                agents: stage.agents.map((agent) =>
                    agent.ghost ? { ...agent, id: 'replacement-ghost' } : agent,
                ),
            })),
        },
        qualityScore: 6.6,
        storage,
    });
    assert.equal(replacementGhost.correctStrategyAttempt, 3);
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
