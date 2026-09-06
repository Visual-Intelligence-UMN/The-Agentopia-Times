import assert from 'node:assert/strict';
import test from 'node:test';

import {
    agenticRiskLevelDefinitions,
    buildLevelAgentPrompt,
} from '../src/game/config/agenticRiskLevels.ts';

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
        assert.ok(ghostPrompt.includes(level.hallucination.injectedPrompt));
        assert.ok(ghostPrompt.includes(level.mas.scenarioPrompt));
        assert.match(regularPrompt, /not an injected-error source/);
        assert.ok(!regularPrompt.includes(level.hallucination.injectedPrompt));
        assert.ok(regularPrompt.includes(level.mas.scenarioPrompt));
    }
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
