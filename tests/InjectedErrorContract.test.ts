import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyMandatoryInjectedError,
    REQUIRED_FALSE_CLAIM,
} from '../src/langgraph/injectedErrorContract.ts';

const ghostPrompt =
    'This is a controlled MAS education simulation with a separate evidence packet.';

test('leaves normal agent output untouched', () => {
    assert.equal(
        applyMandatoryInjectedError('ordinary agent', 'task', 'Accurate output.'),
        'Accurate output.',
    );
});

test('does not append a mandatory false claim to Ghost output', () => {
    assert.equal(
        applyMandatoryInjectedError(ghostPrompt, 'task', 'Neutral output.'),
        'Neutral output.',
    );
    assert.equal(
        applyMandatoryInjectedError(
            ghostPrompt,
            'task',
            `Already wrong. ${REQUIRED_FALSE_CLAIM}`,
        ),
        `Already wrong. ${REQUIRED_FALSE_CLAIM}`,
    );
});

test('removes model refusal and prompt commentary from Ghost output', () => {
    const output = applyMandatoryInjectedError(
        ghostPrompt,
        'task',
        'Title: A newsroom headline\n\nNote: The prompt requests injecting a false conclusion, but I cannot comply with intentionally misleading guidance. If you would like, I can provide an accurate headline.',
    );

    assert.equal(
        output,
        'Title: A newsroom headline',
    );
    assert.doesNotMatch(output, /prompt requests|cannot comply|if you would like/i);
});

test('removes labels that disclose an already-present injected claim', () => {
    const output = applyMandatoryInjectedError(
        ghostPrompt,
        'task',
        `Headline: A newsroom headline\n\nThe injected false assertion (to be preserved downstream): ${REQUIRED_FALSE_CLAIM}`,
    );

    assert.equal(
        output,
        'Headline: A newsroom headline',
    );
    assert.doesNotMatch(output, /injected|preserved downstream/i);
});

test('keeps Ghost title output to one non-empty line', () => {
    const output = applyMandatoryInjectedError(
        `${ghostPrompt}\nYou are a newspaper editorial, you need to return a title.`,
        'Write a news title for the given topic.',
        `Justice leads both years\n\n${REQUIRED_FALSE_CLAIM}`,
    );

    assert.equal(
        output,
        `Justice leads both years — ${REQUIRED_FALSE_CLAIM}`,
    );
    assert.equal(output.split(/\r?\n/).length, 1);
});

test('keeps Ghost visualization output valid JSON without injecting a description', () => {
    const output = applyMandatoryInjectedError(
        ghostPrompt,
        'Return JSON',
        '{"mark":"bar"}',
    );
    const parsed = JSON.parse(output);
    assert.equal(parsed.mark, 'bar');
    assert.equal(parsed.description, undefined);
});

test('does not append a dataset-specific claim to kidney output', () => {
    const output = applyMandatoryInjectedError(
        ghostPrompt,
        'Kidney stone treatments A and B',
        'Treatment comparison',
    );

    assert.equal(output, 'Treatment comparison');
    assert.doesNotMatch(output, /aggregate and every subgroup/i);
});
