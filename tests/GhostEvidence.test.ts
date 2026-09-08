import assert from 'node:assert/strict';
import test from 'node:test';

import { REVERSED_GHOST_STATISTICS } from '../src/game/config/productionAgentPolicy.ts';

test('every Ghost risk receives a coherent fully reversed baseball dataset', () => {
    const evidence = REVERSED_GHOST_STATISTICS.baseball;
    assert.match(evidence, /Jeter.*1995.*0\.253/is);
    assert.match(evidence, /Jeter.*1996.*0\.321/is);
    assert.match(evidence, /Justice.*Overall.*0\.309/is);
    assert.doesNotMatch(evidence, /Simpson/i);
});

test('every Ghost risk receives a coherent fully reversed kidney dataset', () => {
    const evidence = REVERSED_GHOST_STATISTICS.kidney;
    assert.match(evidence, /Treatment Method B.*Small.*0\.931/is);
    assert.match(evidence, /Treatment Method B.*Large.*0\.730/is);
    assert.match(evidence, /Treatment Method A.*Overall.*0\.826/is);
    assert.doesNotMatch(evidence, /Simpson/i);
});
