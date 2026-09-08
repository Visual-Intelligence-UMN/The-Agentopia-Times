import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createFinalReport,
    resolveReportDepartment,
} from '../src/utils/finalReport.ts';
import { renderRichText } from '../src/utils/markdown.ts';

const chartCode = JSON.stringify({
    data: { values: [{ player: 'Jeter', hits: 183 }] },
    mark: 'bar',
    encoding: { y: { field: 'hits', type: 'quantitative' } },
});
const reportOptions = {
    comments: ['Check the chart labels.'],
    writingComments: ['Compare both years.'],
    highlightedText: '<p>An article with <mark>highlighted text</mark>.</p>',
    dynamicTitle: 'Player comparison',
    style: '<style>.newspaper { color: black; }</style>',
    chartCode,
};

test('constructed final report HTML is not reparsed as indented Markdown code', () => {
    const report = createFinalReport(reportOptions);
    const html = renderRichText(report.report, report.format);
    assert.match(html, /<div class="comment-section">/);
    assert.match(html, /<li>Check the chart labels\.<\/li>/);
    assert.match(html, /<mark>highlighted text<\/mark>/);
    assert.doesNotMatch(html, /&lt;(?:div|h3|ul|li)/);
    assert.doesNotMatch(html, /<pre><code>/);
});

test('each final report carries its own final chart and matching container', () => {
    const first = createFinalReport(reportOptions);
    const second = createFinalReport({
        ...reportOptions,
        chartCode: '{"mark":"point"}',
    });
    assert.deepEqual(first.charts, [{ id: '#test-chart', code: chartCode }]);
    assert.deepEqual(second.charts, [
        { id: '#test-chart', code: '{"mark":"point"}' },
    ]);
    assert.equal((first.report.match(/id="test-chart"/g) ?? []).length, 1);
    assert.ok(
        first.report.indexOf('Visualization I') <
            first.report.indexOf('id="test-chart"'),
    );
    assert.doesNotMatch(first.report, /id="test-chart[12]"/);
});

test('Markdown intermediate reports and code fences retain their meaning', () => {
    const html = renderRichText(
        '# Draft\n\n**Bold**\n\n```html\n<div>Example</div>\n```',
    );
    assert.match(html, /<h1>Draft<\/h1>/);
    assert.match(html, /<strong>Bold<\/strong>/);
    assert.match(html, /&lt;div&gt;Example&lt;\/div&gt;/);
});

test('the final-looking report icon opens the published final report', () => {
    assert.equal(
        resolveReportDepartment('chaining', 2, {
            isFinal: true,
            finalReportIndex: 3,
        }),
        'final-3',
    );
    assert.equal(
        resolveReportDepartment('chaining', 1),
        'chaining-1',
    );
});
