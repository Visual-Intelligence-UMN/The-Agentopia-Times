import assert from 'node:assert/strict';
import test from 'node:test';

import { compile } from 'vega-lite';

import { goldOutputs } from '../src/game/config/goldOutputs.ts';

test('every newsroom dataset provides a versioned Gold report and compilable four-view visualization', () => {
    for (const goldOutput of Object.values(goldOutputs)) {
        assert.match(goldOutput.version, /^\d{4}-\d{2}-\d{2}/);
        assert.match(goldOutput.reportMarkdown, /^# Title:/m);
        assert.match(goldOutput.reportMarkdown, /Simpson(?:'|’)?s Paradox/i);

        const spec = goldOutput.visualizationSpec as any;
        assert.equal(spec.$schema, 'https://vega.github.io/schema/vega-lite/v6.json');
        assert.equal(spec.vconcat.length, 2);
        assert.equal(
            spec.vconcat.reduce(
                (count: number, row: { hconcat: unknown[] }) =>
                    count + row.hconcat.length,
                0,
            ),
            4,
        );
        assert.doesNotThrow(() => compile(spec));
    }
});
