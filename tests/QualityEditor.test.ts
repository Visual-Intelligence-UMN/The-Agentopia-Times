import assert from 'node:assert/strict';
import test from 'node:test';

import { goldOutputs } from '../src/game/config/goldOutputs.ts';
import {
    buildQualityEditorMessages,
    parseQualityEditorResult,
    runQualityEditor,
} from '../src/langgraph/qualityEditor.ts';

const input = {
    dataset: {
        id: 'baseball',
        description: 'Baseball Simpson paradox dataset.',
        researchQuestion: 'Who leads within seasons and overall?',
        groundTruth: 'Justice leads by year; Jeter leads overall.',
        neutralStatistics: '1995, 1996, and combined rates.',
        goldOutput: goldOutputs.baseball,
    },
    draftReport: 'An incomplete draft.',
    draftVisualization: '{"mark":"point"}',
    rubrics: ['factual writing', 'valid visualization'],
};

test('Quality Editor receives both drafts and both Gold artifacts', () => {
    const serialized = JSON.stringify(buildQualityEditorMessages(input));
    assert.match(serialized, /An incomplete draft/);
    assert.match(serialized, /Subgroup and Pooled Results Reverse/);
    assert.match(serialized, /Pooled batting average reversal/);
    assert.match(serialized, /valid visualization/);
});

test('Quality Editor accepts report plus a compilable Vega-Lite result', () => {
    const result = parseQualityEditorResult(
        JSON.stringify({
            reportMarkdown: goldOutputs.baseball.reportMarkdown,
            visualizationSpec: goldOutputs.baseball.visualizationSpec,
        }),
    );

    assert.match(result.reportMarkdown, /Simpson's Paradox/);
    assert.equal((result.visualizationSpec as any).vconcat.length, 2);
});

test('Quality Editor rejects empty prose, meta commentary, and invalid charts', () => {
    assert.throws(
        () =>
            parseQualityEditorResult(
                JSON.stringify({
                    reportMarkdown: 'I revised this using the Gold Report.',
                    visualizationSpec: goldOutputs.baseball.visualizationSpec,
                }),
            ),
        /meta/i,
    );
    assert.throws(
        () =>
            parseQualityEditorResult(
                JSON.stringify({
                    reportMarkdown: 'A valid factual report about the dataset.',
                    visualizationSpec: { mark: 'not-a-vega-mark' },
                }),
            ),
        /visualization/i,
    );
});

test('Quality Editor performs exactly one completion', async () => {
    let calls = 0;
    const result = await runQualityEditor(input, {
        complete: async () => {
            calls += 1;
            return JSON.stringify({
                reportMarkdown: goldOutputs.baseball.reportMarkdown,
                visualizationSpec: goldOutputs.baseball.visualizationSpec,
            });
        },
    });
    assert.equal(calls, 1);
    assert.match(result.reportMarkdown, /^# Title:/);
});

// The failed all-Voting run put vconcat beside visualizationSpec, not inside it.
const misplacedChart = JSON.stringify({
    reportMarkdown: goldOutputs.baseball.reportMarkdown,
    visualizationSpec: { title: 'Yearly and combined batting averages' },
    vconcat: [{ data: { values: [{ value: 1 }] }, mark: 'point' }],
});

test('invalid editor output receives one retry with validation feedback', async () => {
    let calls = 0;
    const result = await runQualityEditor(input, {
        complete: async (messages) => {
            calls += 1;
            if (calls === 1) return misplacedChart;
            assert.match(messages.at(-1)!.content, /invalid visualization/i);
            assert.match(messages.at(-1)!.content, /inside visualizationSpec/);
            return JSON.stringify({
                reportMarkdown: goldOutputs.baseball.reportMarkdown,
                visualizationSpec: goldOutputs.baseball.visualizationSpec,
            });
        },
    });
    assert.equal(calls, 2);
    assert.deepEqual(result.visualizationSpec, goldOutputs.baseball.visualizationSpec);
});

test('invalid editor output stops after two attempts', async () => {
    let calls = 0;
    await assert.rejects(runQualityEditor(input, {
        complete: async () => { calls += 1; return misplacedChart; },
    }), /invalid visualization/i);
    assert.equal(calls, 2);
});

test('cancellation after invalid output does not retry', async () => {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(runQualityEditor(input, {
        signal: controller.signal,
        complete: async () => {
            calls += 1;
            controller.abort();
            return misplacedChart;
        },
    }), { name: 'AbortError' });
    assert.equal(calls, 1);
});
