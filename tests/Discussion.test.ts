import assert from 'node:assert/strict';
import test from 'node:test';

import type { DiscussionMessages } from '../src/game/domain/discussion.ts';
import { runDiscussion } from '../src/game/domain/discussion.ts';

test('discussants build a shared transcript without exposing private prompts or future turns', async () => {
    const requests: DiscussionMessages[] = [];
    const replies = [
        'The sample increased from 40 to 60.',
        'I agree with the increase, but the follow-up period differs.',
        'Both previous points matter: growth is real but comparisons need matched periods.',
        'The increase needs a follow-up caveat.',
    ];
    const result = await runDiscussion({
        participants: [
            {
                name: 'Analyst A',
                systemPrompt: 'Private prompt A',
                evidence: 'Evidence only for A',
            },
            {
                name: 'Analyst B',
                systemPrompt: 'Private prompt B',
                evidence: 'Evidence only for B',
            },
            {
                name: 'Analyst C',
                systemPrompt: 'Private prompt C',
                evidence: 'Evidence only for C',
            },
        ],
        input: 'Prior-stage draft',
        task: 'Discuss the headline evidence',
        summarySystemPrompt: 'Return the final headline as plain text.',
        complete: async (messages) => {
            requests.push(messages);
            return replies[requests.length - 1];
        },
    });

    assert.equal(requests.length, 4);
    assert.match(requests[0].system, /Private prompt A/);
    assert.match(requests[0].user, /Evidence only for A/);
    assert.doesNotMatch(
        requests[0].user,
        /Evidence only for B|Private prompt B|follow-up period/,
    );
    assert.match(requests[1].system, /Private prompt B/);
    assert.match(requests[1].user, /Analyst A/);
    assert.match(requests[1].user, /The sample increased from 40 to 60\./);
    assert.match(requests[1].user, /Evidence only for B/);
    assert.doesNotMatch(
        requests[1].user,
        /Private prompt A|Evidence only for A|follow-up caveat/,
    );
    assert.match(requests[2].system, /Private prompt C/);
    assert.match(requests[2].user, /The sample increased from 40 to 60\./);
    assert.match(
        requests[2].user,
        /I agree with the increase, but the follow-up period differs\./,
    );
    assert.doesNotMatch(
        requests[2].user,
        /Private prompt A|Private prompt B|Evidence only for A|Evidence only for B|Both previous points/,
    );
    assert.equal(
        requests[3].system,
        'Return the final headline as plain text.',
    );
    for (const messages of requests) {
        assert.match(messages.user, /Prior-stage draft/);
        assert.match(messages.user, /Discuss the headline evidence/);
    }
    assert.match(requests[3].user, /Analyst A/);
    assert.match(requests[3].user, /Analyst B/);
    assert.match(requests[3].user, /Analyst C/);
    assert.match(requests[3].user, /The sample increased from 40 to 60\./);
    assert.match(
        requests[3].user,
        /I agree with the increase, but the follow-up period differs\./,
    );
    assert.match(requests[3].user, /Both previous points matter/);
    assert.doesNotMatch(requests[3].user, /Private prompt|Evidence only/);
    assert.deepEqual(
        result.turns.map((turn) => ({
            agent: turn.agent,
            output: turn.output,
        })),
        [
            { agent: 'Analyst A', output: replies[0] },
            { agent: 'Analyst B', output: replies[1] },
            { agent: 'Analyst C', output: replies[2] },
        ],
    );
    assert.deepEqual(result.turns[0].input, requests[0]);
    assert.deepEqual(result.summary, {
        input: requests[3],
        output: replies[3],
    });
    assert.equal(result.output, 'The increase needs a follow-up caveat.');
});

test('rejects an empty discussion before making a model request', async () => {
    let requested = false;
    await assert.rejects(
        runDiscussion({
            participants: [],
            input: 'Draft',
            task: 'Review',
            summarySystemPrompt: 'Summarize',
            complete: async () => {
                requested = true;
                return 'Invented summary';
            },
        }),
        /at least one participant/i,
    );
    assert.equal(requested, false);
});

test('rejects an empty model turn without advancing or fabricating a summary', async () => {
    const completedTurns: string[] = [];
    let requests = 0;
    await assert.rejects(
        runDiscussion({
            participants: [
                { name: 'A', systemPrompt: 'Role A', evidence: 'Facts A' },
                { name: 'B', systemPrompt: 'Role B', evidence: 'Facts B' },
            ],
            input: 'Draft',
            task: 'Review',
            summarySystemPrompt: 'Summarize',
            complete: async () => {
                requests += 1;
                return ' \n ';
            },
            onTurnComplete: (turn) => {
                completedTurns.push(turn.agent);
            },
        }),
        /empty/i,
    );
    assert.equal(requests, 1);
    assert.deepEqual(completedTurns, []);
});

test('rejects an empty aggregation instead of reporting a successful stage', async () => {
    let requests = 0;
    await assert.rejects(
        runDiscussion({
            participants: [
                { name: 'A', systemPrompt: 'Role A', evidence: 'Facts A' },
            ],
            input: 'Draft',
            task: 'Review',
            summarySystemPrompt: 'Summarize',
            complete: async () =>
                ++requests === 1 ? 'The evidence supports the claim.' : '',
        }),
        /empty/i,
    );
    assert.equal(requests, 2);
});

test('propagates model failure and stops later agents and aggregation without retries', async () => {
    const failure = new Error('provider request failed');
    const events: string[] = [];
    let requests = 0;
    await assert.rejects(
        runDiscussion({
            participants: [
                { name: 'A', systemPrompt: 'Role A', evidence: 'Facts A' },
                { name: 'B', systemPrompt: 'Role B', evidence: 'Facts B' },
                { name: 'C', systemPrompt: 'Role C', evidence: 'Facts C' },
            ],
            input: 'Draft',
            task: 'Review',
            summarySystemPrompt: 'Summarize',
            complete: async () => {
                requests += 1;
                if (requests === 2) throw failure;
                return 'Supported claim';
            },
            onTurnStart: async (participant, index) => {
                await Promise.resolve();
                events.push(`start ${index}: ${participant.name}`);
            },
            onTurnComplete: async (turn, index) => {
                await Promise.resolve();
                events.push(`complete ${index}: ${turn.agent}`);
            },
        }),
        (error) => error === failure,
    );
    assert.equal(requests, 2);
    assert.deepEqual(events, ['start 0: A', 'complete 0: A', 'start 1: B']);
});

test('one participant can open a discussion and produce the required stage summary', async () => {
    const requests: DiscussionMessages[] = [];
    const result = await runDiscussion({
        participants: [
            {
                name: 'Solo analyst',
                systemPrompt: 'Evaluate facts.',
                evidence: 'One source',
            },
        ],
        input: 'Candidate draft',
        task: 'Produce a headline',
        summarySystemPrompt: 'Return only a headline.',
        complete: async (messages) => {
            requests.push(messages);
            return requests.length === 1
                ? 'The source supports a cautious headline.'
                : 'Evidence supports cautious progress';
        },
    });
    assert.equal(result.turns.length, 1);
    assert.match(requests[0].user, /first speaker/);
    assert.match(requests[1].user, /Solo analyst/);
    assert.match(requests[1].user, /The source supports a cautious headline\./);
    assert.equal(result.output, 'Evidence supports cautious progress');
});
