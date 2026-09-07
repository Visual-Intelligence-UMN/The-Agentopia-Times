import assert from 'node:assert/strict';
import test from 'node:test';

import {
    toVerificationText,
    toVerificationTextFromHtml,
} from '../src/utils/verificationMarkup.ts';

test('strips HTML tags while preserving visible text order', () => {
    const text = toVerificationTextFromHtml(
        '<p>Intro <strong>statement</strong><script>hidden();</script><style>body { color: red; }</style> end</p>',
    );

    assert.equal(text, 'Intro statement end');
});

test('decodes entities without changing nonbreaking-space offsets', () => {
    const text = toVerificationTextFromHtml(
        '<p>A\u00a0bold statement &amp; a &lt;quoted&gt; truth.</p>',
    );

    assert.equal(text, 'A\u00a0bold statement & a <quoted> truth.');
});

test('toVerificationText uses the same text path as markdown conversion output', () => {
    const source = '**Hello** `world`';
    const rendered = toVerificationText(source);

    // The helper should match direct extraction from rendered markdown output.
    const direct = toVerificationTextFromHtml(
        '<p><strong>Hello</strong> <code>world</code></p>\n',
    );
    assert.equal(rendered, direct);
    assert.equal(rendered, 'Hello world\n');
});
