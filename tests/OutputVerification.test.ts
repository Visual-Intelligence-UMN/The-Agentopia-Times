import assert from 'node:assert/strict';
import test from 'node:test';

import {
    deriveGhostSources,
    parseVerificationResponse,
    type VerificationEvidence,
} from '../src/game/domain/outputVerification.ts';

const evidence: VerificationEvidence[] = [
    { id: 'original-data', text: 'The observed rate is 20%.' },
];

function annotation(quote: string, overrides: Record<string, unknown> = {}) {
    return {
        quote,
        category: 'unsupported',
        reason: 'The supplied evidence does not establish this claim.',
        evidenceIds: [],
        ...overrides,
    };
}

function response(annotations: unknown[]) {
    return JSON.stringify({ annotations });
}

test('sequential outputs retain the Ghost source through normal downstream agents', () => {
    const original = deriveGhostSources([]);
    const ghost = deriveGhostSources([original], 'ghost-analytics');
    const analyst = deriveGhostSources([ghost]);
    const writer = deriveGhostSources([analyst]);

    assert.deepEqual(original, []);
    assert.deepEqual(writer, ['ghost-analytics']);
});

test('independent voting peers inherit only the inputs they consumed', () => {
    const original = Object.freeze([] as string[]);
    const ghost = deriveGhostSources([original], 'ghost-voter');
    const normalPeer = deriveGhostSources([original]);
    const aggregator = deriveGhostSources([normalPeer, ghost]);

    assert.deepEqual(normalPeer, []);
    assert.deepEqual(aggregator, ['ghost-voter']);
    assert.deepEqual(original, []);
});

test('aggregation preserves stable unique sources across stages and a clean verdict', () => {
    const first = Object.freeze(['ghost-a', 'ghost-b']);
    const second = Object.freeze(['ghost-b', 'ghost-c']);
    const aggregator = deriveGhostSources([first, second], 'ghost-a');
    const clean = parseVerificationResponse(
        response([]),
        'Accurate text.',
        evidence,
    );
    const nextStage = deriveGhostSources([aggregator]);

    assert.deepEqual(clean, { annotations: [], rejectedCount: 0 });
    assert.deepEqual(nextStage, ['ghost-a', 'ghost-b', 'ghost-c']);
    assert.notEqual(nextStage, aggregator);
    assert.deepEqual(first, ['ghost-a', 'ghost-b']);
    assert.deepEqual(second, ['ghost-b', 'ghost-c']);
});

test('computes an exact contradicted span from a fenced response without rewriting text', () => {
    const text = 'The observed rate is 90%. Further study is needed.';
    const quote = '90%';
    const raw = response([
        annotation(quote, {
            category: 'contradicted',
            reason: 'The observed rate in the original data is 20%.',
            evidenceIds: ['original-data'],
            start: 0,
            end: text.length,
        }),
    ]);
    const result = parseVerificationResponse(
        '```json\n' + raw + '\n```',
        text,
        evidence,
    );

    assert.deepEqual(result, {
        annotations: [
            {
                start: text.indexOf(quote),
                end: text.indexOf(quote) + quote.length,
                quote,
                category: 'contradicted',
                reason: 'The observed rate in the original data is 20%.',
                evidenceIds: ['original-data'],
            },
        ],
        rejectedCount: 0,
    });
    assert.equal(text, 'The observed rate is 90%. Further study is needed.');
});

test('accepts an unsupported exact claim without an evidence reference', () => {
    const result = parseVerificationResponse(
        response([annotation('A prediction.')]),
        'A prediction.',
        evidence,
    );

    assert.equal(result.rejectedCount, 0);
    assert.equal(result.annotations.length, 1);
    assert.deepEqual(result.annotations[0].evidenceIds, []);
});

test('Unicode spans slice the original text without normalizing its characters', () => {
    const text = '🧪 Café e\u0301 shows 42%.';
    const quote = 'Café e\u0301';
    const result = parseVerificationResponse(
        response([annotation(quote), annotation('Café é')]),
        text,
        evidence,
    );
    const span = result.annotations[0];

    assert.equal(span.start, 3);
    assert.equal(span.end, 3 + quote.length);
    assert.equal(text.slice(span.start, span.end), quote);
    assert.equal(result.annotations.length, 1);
    assert.equal(result.rejectedCount, 1);
});

test('repeated quotes can be disambiguated by an exact adjacent prefix or suffix', () => {
    const text = 'First: same one. Second: same two.';
    const result = parseVerificationResponse(
        response([
            annotation('same', { prefix: 'Second: ' }),
            annotation('same', { suffix: ' one.' }),
        ]),
        text,
        evidence,
    );

    assert.deepEqual(
        result.annotations.map((span) => span.start),
        [text.indexOf('same'), text.lastIndexOf('same')],
    );
    assert.equal(result.rejectedCount, 0);
});

test('repeated quotes require enough context to identify one occurrence', () => {
    const text = 'A: claim (old); A: claim (new); B: claim (new)';
    const result = parseVerificationResponse(
        response([
            annotation('claim'),
            annotation('claim', { prefix: 'A: ' }),
            annotation('claim', { suffix: ' (new)' }),
            annotation('claim', { prefix: 'A: ', suffix: ' (new)' }),
        ]),
        text,
        evidence,
    );

    assert.equal(result.annotations.length, 1);
    assert.equal(result.annotations[0].start, text.indexOf('claim (new)'));
    assert.equal(result.rejectedCount, 3);
});

test('overlapping occurrences of the same quote still require disambiguation', () => {
    const result = parseVerificationResponse(
        response([annotation('aa'), annotation('aa', { prefix: 'a' })]),
        'aaa',
        evidence,
    );

    assert.equal(result.annotations.length, 1);
    assert.equal(result.annotations[0].start, 1);
    assert.equal(result.rejectedCount, 1);
});

test('empty, unmatched, and incorrectly contextualized quotes are counted as rejected', () => {
    const result = parseVerificationResponse(
        response([
            annotation(''),
            annotation('   '),
            annotation('missing'),
            annotation('claim', { prefix: 'Wrong: ' }),
            annotation('claim', { suffix: ' wrong' }),
            annotation('claim', { prefix: 'claim' }),
        ]),
        'claim',
        evidence,
    );

    assert.deepEqual(result, { annotations: [], rejectedCount: 6 });
});

test('unknown evidence references and contradictions without references cannot highlight', () => {
    const result = parseVerificationResponse(
        response([
            annotation('claim', { category: 'contradicted' }),
            annotation('claim', {
                category: 'contradicted',
                evidenceIds: ['original-data', 'invented-data'],
            }),
            annotation('claim', { evidenceIds: ['invented-data'] }),
            annotation('claim', {
                category: 'contradicted',
                evidenceIds: ['original-data'],
            }),
        ]),
        'claim',
        evidence,
    );

    assert.equal(result.annotations.length, 1);
    assert.deepEqual(result.annotations[0].evidenceIds, ['original-data']);
    assert.equal(result.rejectedCount, 3);
});

test('invalid annotation schemas are counted without losing a valid annotation', () => {
    const invalid = [
        null,
        [],
        'claim',
        {},
        annotation('claim', { category: 'correct' }),
        annotation('claim', { reason: '' }),
        annotation('claim', { reason: 10 }),
        annotation('claim', { quote: 10 }),
        annotation('claim', { evidenceIds: undefined }),
        annotation('claim', { evidenceIds: 'original-data' }),
        annotation('claim', { evidenceIds: [10] }),
        annotation('claim', { prefix: null }),
        annotation('claim', { suffix: 10 }),
    ];
    const result = parseVerificationResponse(
        response([...invalid, annotation('claim')]),
        'claim',
        evidence,
    );

    assert.equal(result.annotations.length, 1);
    assert.equal(result.rejectedCount, invalid.length);
});

test('first valid spans win overlaps and duplicates, with accepted spans returned in text order', () => {
    const text = 'Alpha beta gamma; delta.';
    const result = parseVerificationResponse(
        response([
            annotation('delta'),
            annotation('Alpha beta'),
            annotation('beta gamma'),
            annotation('gamma'),
            annotation('gamma'),
        ]),
        text,
        evidence,
    );

    assert.deepEqual(
        result.annotations.map((span) => text.slice(span.start, span.end)),
        ['Alpha beta', 'gamma', 'delta'],
    );
    assert.equal(result.rejectedCount, 2);
});

test('adjacent spans do not overlap', () => {
    const result = parseVerificationResponse(
        response([annotation('Alpha '), annotation('beta')]),
        'Alpha beta',
        evidence,
    );

    assert.equal(result.annotations.length, 2);
    assert.equal(result.annotations[0].end, result.annotations[1].start);
    assert.equal(result.rejectedCount, 0);
});

test('malformed JSON and top-level schemas fail explicitly instead of returning clean', () => {
    for (const raw of ['', 'not JSON', '{"annotations":', '```json\n{}']) {
        assert.throws(
            () => parseVerificationResponse(raw, 'claim', evidence),
            /invalid JSON/,
        );
    }
    for (const raw of [
        'null',
        '[]',
        'true',
        '{}',
        '{"annotations":{}}',
        '{"annotations":null}',
    ]) {
        assert.throws(
            () => parseVerificationResponse(raw, 'claim', evidence),
            /object containing an annotations array/,
        );
    }
});

test('an explicit empty annotations array is a legitimate clean result', () => {
    assert.deepEqual(parseVerificationResponse(response([]), '', []), {
        annotations: [],
        rejectedCount: 0,
    });
});
