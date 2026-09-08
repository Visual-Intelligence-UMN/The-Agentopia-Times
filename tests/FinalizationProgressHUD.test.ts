import assert from 'node:assert/strict';
import test from 'node:test';

import { finalizationPhaseForEvent } from '../src/game/domain/finalizationProgress.ts';

test('maps each long-running finalization event to a visible progress phase', () => {
    assert.equal(
        finalizationPhaseForEvent('strategy_judgement_started'),
        'strategy',
    );
    assert.equal(
        finalizationPhaseForEvent('output_scoring_started'),
        'scoring',
    );
    assert.equal(
        finalizationPhaseForEvent('final_report_publishing_started'),
        'publishing',
    );
});

test('ignores completion and unrelated MAS events', () => {
    assert.equal(finalizationPhaseForEvent('quality_refinement_started'), null);
    assert.equal(finalizationPhaseForEvent('quality_refinement_skipped'), null);
    assert.equal(finalizationPhaseForEvent('output_scoring_completed'), null);
    assert.equal(finalizationPhaseForEvent('agent_completed'), null);
});
