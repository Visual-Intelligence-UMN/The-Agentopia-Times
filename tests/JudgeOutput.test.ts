import assert from 'node:assert/strict';
import test from 'node:test';

import {
    enforceVisualizationValidity,
    judgeResponseFormat,
} from '../src/langgraph/judgeOutput.ts';

test('judge requests enforce the score result JSON schema', () => {
    assert.equal(judgeResponseFormat.type, 'json_schema');
    assert.equal(judgeResponseFormat.json_schema.strict, true);
    assert.deepEqual(
        judgeResponseFormat.json_schema.schema.required,
        ['score', 'reasons', 'comments'],
    );
});

test('a compilable visualization cannot be scored as invalid', () => {
    const result = enforceVisualizationValidity(
        JSON.stringify({
            data: { values: [{ category: 'A', value: 1 }] },
            mark: 'bar',
            encoding: {
                x: { field: 'category', type: 'nominal' },
                y: { field: 'value', type: 'quantitative' },
            },
        }),
        {
            score: '0/10',
            reasons: ['The spec is invalid/unusable.'],
            comments: ['No four views are produced.'],
        },
    );

    assert.equal(result.score, '1/10');
    assert.match(result.reasons[0], /compiled successfully/i);
    assert.doesNotMatch(result.reasons.join(' '), /invalid\/unusable/i);
});

test('a visualization that fails compilation always receives zero', () => {
    const result = enforceVisualizationValidity('{"mark":', {
        score: '7/10',
        reasons: [],
        comments: [],
    });

    assert.equal(result.score, '0/10');
    assert.match(result.reasons[0], /could not be compiled/i);
});
