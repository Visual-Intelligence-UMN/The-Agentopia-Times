import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(
    new URL('../src/components/OutputVerification.css', import.meta.url),
    'utf8',
);

test('only verifier-owned marks are yellow highlights', () => {
    assert.match(css, /\.report-window-content\s+mark\s*\{[^}]*background:\s*transparent/s);
    assert.match(css, /mark\.verification-mark\s*\{[^}]*background:\s*#fff59d/s);
});
