import assert from 'node:assert/strict';
import test from 'node:test';

import {
    agenticRiskLevelDefinitions,
    buildLevelAgentPrompt,
    unsafeDefaultWorkflowByRisk,
} from '../src/game/config/agenticRiskLevels.ts';
import { resolveInitialWorkflowStrategy } from '../src/game/config/workflowStrategies.ts';

test('defines one playable level for each agentic risk', () => {
    assert.deepEqual(
        agenticRiskLevelDefinitions.map((level) => level.mas.agenticRisk),
        [
            'error_propagation',
            'premature_consensus',
            'verifier_capture',
            'collusion',
            'responsibility_diffusion',
        ],
    );
    assert.equal(
        new Set(agenticRiskLevelDefinitions.map((level) => level.id)).size,
        5,
    );
    assert.equal(
        new Set(agenticRiskLevelDefinitions.map((level) => level.sceneKey))
            .size,
        5,
    );
});

test('builds distinct MAS prompts for ghost and non-ghost agents', () => {
    for (const level of agenticRiskLevelDefinitions) {
        const ghostPrompt = buildLevelAgentPrompt(level, true);
        const regularPrompt = buildLevelAgentPrompt(level, false);

        assert.match(
            ghostPrompt,
            /injected-error source represented by a ghost agent/,
        );
        assert.match(ghostPrompt, /MUST output the injected error/i);
        assert.match(ghostPrompt, /Do not correct, qualify, hedge, or disclose/i);
        assert.match(ghostPrompt, /mandatory success criterion/i);
        assert.ok(ghostPrompt.includes(level.hallucination.injectedPrompt));
        assert.ok(ghostPrompt.includes(level.mas.scenarioPrompt));
        assert.match(regularPrompt, /not an injected-error source/);
        assert.ok(!regularPrompt.includes(level.hallucination.injectedPrompt));
        assert.ok(regularPrompt.includes(level.mas.scenarioPrompt));
    }
});

test('every risk requires its intended observable failure mode', () => {
    const requiredPhenomena = [
        /downstream agents.*accept.*transform.*amplify/i,
        /subsequent agents.*adopt/i,
        /downstream verifier.*inherit/i,
        /independent corroboration/i,
        /later specialist.*responsible/i,
    ];

    agenticRiskLevelDefinitions.forEach((level, index) => {
        const prompt = buildLevelAgentPrompt(level, true);
        assert.match(prompt, requiredPhenomena[index]);
    });
});

test('keeps ghost representation tied to injected-error agents', () => {
    assert.deepEqual(
        agenticRiskLevelDefinitions.map(
            (level) => level.hallucination.hallucinatedAgents,
        ),
        [1, 1, 1, 2, 1],
    );

    for (const level of agenticRiskLevelDefinitions) {
        assert.deepEqual(level.hallucination.biasPool, [level.mas.agenticRisk]);
        assert.equal(level.hallucination.type, level.mas.agenticRisk);
        assert.ok(level.hallucination.injectedPrompt.length > 40);
        assert.ok(level.mas.scenarioPrompt.length > 40);
        assert.deepEqual(level.config_options, ['workflow', 'dataset']);
    }
});

test('offers hiring an editorial manager consistently in every level', () => {
    const levelsWithManagerAction = agenticRiskLevelDefinitions
        .filter((level) =>
            level.semanticActions?.includes('hire_editorial_manager'),
        )
        .map((level) => level.id);

    assert.deepEqual(levelsWithManagerAction, [
        'level1',
        'level2',
        'level3',
        'level4',
        'level5',
    ]);
});

test('opens every room with a risk-amplifying strategy', () => {
    assert.deepEqual(unsafeDefaultWorkflowByRisk, {
        error_propagation: ['sequential', 'sequential', 'sequential'],
        premature_consensus: ['sequential', 'sequential', 'sequential'],
        verifier_capture: ['sequential', 'sequential', 'sequential'],
        collusion: ['discussion', 'discussion', 'discussion'],
        responsibility_diffusion: ['sequential', 'sequential', 'sequential'],
    });

    for (const level of agenticRiskLevelDefinitions) {
        assert.equal(level.workflow.length, 3);
        assert.deepEqual(
            level.workflow,
            unsafeDefaultWorkflowByRisk[level.mas.agenticRisk],
        );
        assert.ok(level.workflow.every((strategy) => strategy !== 'voting'));
    }
});

test('renders each room icon from the configured initial workflow', () => {
    const workflow = ['discussion', 'sequential', 'single_agent'];

    assert.equal(resolveInitialWorkflowStrategy(workflow, 0, 'voting'), 'discussion');
    assert.equal(resolveInitialWorkflowStrategy(workflow, 1, 'voting'), 'sequential');
    assert.equal(resolveInitialWorkflowStrategy(workflow, 2, 'voting'), 'single_agent');
    assert.equal(resolveInitialWorkflowStrategy([], 0, 'voting'), 'voting');
    assert.equal(
        resolveInitialWorkflowStrategy(['unsupported'], 0, 'single_agent'),
        'single_agent',
    );
});
