import assert from 'node:assert/strict';
import test from 'node:test';

import {
    checkVegaLiteCode,
    cleanUpD3Code,
    compileJSCode,
} from '../src/vega/renderChart.ts';

const spec = {
    data: { values: [{ player: 'Jeter', hits: 183 }] },
    mark: 'bar',
    encoding: { y: { field: 'hits', type: 'quantitative' } },
};

test('validates JSON and legacy chart output using the actual Vega compiler', () => {
    const json = JSON.stringify(spec);
    for (const code of [
        json,
        '```json\n' + json + '\n```',
        `const spec = ${json}; vegaEmbed('#generated-id', spec);`,
    ]) {
        assert.deepEqual(checkVegaLiteCode(code), { ok: true });
    }
});

test('rejects malformed or invalid charts so generation can retry them', () => {
    for (const code of [
        '{"mark":',
        '{"mark":"not-a-real-mark"}',
        'There is no chart.',
    ]) {
        const result = checkVegaLiteCode(code);
        assert.equal(result.ok, false);
        assert.ok(result.error);
    }
});

test('normalizes fenced chart output without interpreting it as JavaScript', () => {
    assert.equal(
        cleanUpD3Code('```json\n{"mark":"bar"}\n```'),
        '{"mark":"bar"}',
    );
});

test('missing chart containers reject instead of silently discarding the visualization', async () => {
    await assert.rejects(
        compileJSCode(JSON.stringify(spec), '#missing-chart', null),
        /Chart container not found/,
    );
});
