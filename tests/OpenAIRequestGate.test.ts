import assert from 'node:assert/strict';
import test from 'node:test';

import { ChatOpenAI } from '@langchain/openai';

import {
    createOpenAIRequestLanes,
    createRateLimitedFetch,
} from '../src/langgraph/openaiRequestGate.ts';

function delay(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test('serializes a Voting request burst before it reaches OpenAI', async () => {
    let activeRequests = 0;
    let peakActiveRequests = 0;
    const upstreamFetch: typeof fetch = async () => {
        activeRequests += 1;
        peakActiveRequests = Math.max(peakActiveRequests, activeRequests);

        if (activeRequests > 1) {
            activeRequests -= 1;
            return new Response(
                JSON.stringify({
                    error: {
                        type: 'rate_limit_error',
                        code: 'rate_limit_exceeded',
                    },
                }),
                { status: 429 },
            );
        }

        await delay(5);
        activeRequests -= 1;
        return new Response('{}', { status: 200 });
    };
    const rateLimitedFetch = createRateLimitedFetch({
        fetchImpl: upstreamFetch,
        maxRetries: 0,
        minimumIntervalMs: 0,
    });

    const unprotectedResponses = await Promise.all([
        upstreamFetch('https://api.openai.com/v1/chat/completions'),
        upstreamFetch('https://api.openai.com/v1/chat/completions'),
        upstreamFetch('https://api.openai.com/v1/chat/completions'),
    ]);
    assert.deepEqual(
        unprotectedResponses.map((response) => response.status),
        [200, 429, 429],
    );
    peakActiveRequests = 0;

    const responses = await Promise.all([
        rateLimitedFetch('https://api.openai.com/v1/chat/completions'),
        rateLimitedFetch('https://api.openai.com/v1/chat/completions'),
        rateLimitedFetch('https://api.openai.com/v1/chat/completions'),
    ]);

    assert.deepEqual(
        responses.map((response) => response.status),
        [200, 200, 200],
    );
    assert.equal(peakActiveRequests, 1);
});

test('protects concurrent LangChain Voting invocations with the shared fetch boundary', async () => {
    let activeRequests = 0;
    let peakActiveRequests = 0;
    let responseIndex = 0;
    const upstreamFetch: typeof fetch = async () => {
        activeRequests += 1;
        peakActiveRequests = Math.max(peakActiveRequests, activeRequests);
        await delay(5);
        activeRequests -= 1;
        responseIndex += 1;

        return new Response(
            JSON.stringify({
                id: `chatcmpl-test-${responseIndex}`,
                object: 'chat.completion',
                created: 1,
                model: 'gpt-5-nano',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: `vote-${responseIndex}`,
                        },
                        finish_reason: 'stop',
                    },
                ],
                usage: {
                    prompt_tokens: 1,
                    completion_tokens: 1,
                    total_tokens: 2,
                },
            }),
            {
                status: 200,
                headers: { 'content-type': 'application/json' },
            },
        );
    };
    const client = new ChatOpenAI({
        apiKey: 'test-key',
        modelName: 'gpt-5-nano',
        maxRetries: 0,
        configuration: {
            fetch: createRateLimitedFetch({
                fetchImpl: upstreamFetch,
                maxRetries: 0,
                minimumIntervalMs: 0,
            }),
        },
    });

    const responses = await Promise.all([
        client.invoke('vote A'),
        client.invoke('vote B'),
        client.invoke('vote C'),
    ]);

    assert.deepEqual(
        responses.map((response) => response.content),
        ['vote-1', 'vote-2', 'vote-3'],
    );
    assert.equal(peakActiveRequests, 1);
});

test('retries a temporary 429 inside the shared request queue', async () => {
    let attempts = 0;
    const upstreamFetch: typeof fetch = async () => {
        attempts += 1;
        if (attempts === 1) {
            return new Response(
                JSON.stringify({
                    error: {
                        type: 'rate_limit_error',
                        code: 'rate_limit_exceeded',
                    },
                }),
                {
                    status: 429,
                    headers: { 'retry-after': '0' },
                },
            );
        }
        return new Response('{}', { status: 200 });
    };
    const rateLimitedFetch = createRateLimitedFetch({
        fetchImpl: upstreamFetch,
        maxRetries: 1,
        minimumIntervalMs: 0,
    });

    const response = await rateLimitedFetch(
        'https://api.openai.com/v1/chat/completions',
    );

    assert.equal(response.status, 200);
    assert.equal(attempts, 2);
});

test('does not retry a 429 caused by exhausted quota', async () => {
    let attempts = 0;
    const upstreamFetch: typeof fetch = async () => {
        attempts += 1;
        return new Response(
            JSON.stringify({
                error: {
                    type: 'insufficient_quota',
                    code: 'insufficient_quota',
                },
            }),
            { status: 429 },
        );
    };
    const rateLimitedFetch = createRateLimitedFetch({
        fetchImpl: upstreamFetch,
        maxRetries: 5,
        minimumIntervalMs: 0,
    });

    const response = await rateLimitedFetch(
        'https://api.openai.com/v1/chat/completions',
    );

    assert.equal(response.status, 429);
    assert.equal(attempts, 1);
});

test('waits for an exhausted rate-limit window before starting the next request', async () => {
    let currentTime = 1_000;
    const startedAt: number[] = [];
    let attempts = 0;
    const upstreamFetch: typeof fetch = async () => {
        startedAt.push(currentTime);
        attempts += 1;
        return new Response('{}', {
            status: 200,
            headers:
                attempts === 1
                    ? {
                          'x-ratelimit-remaining-requests': '0',
                          'x-ratelimit-reset-requests': '2s',
                      }
                    : undefined,
        });
    };
    const rateLimitedFetch = createRateLimitedFetch({
        fetchImpl: upstreamFetch,
        maxRetries: 0,
        minimumIntervalMs: 0,
        now: () => currentTime,
        sleep: async (milliseconds) => {
            currentTime += milliseconds;
        },
    });

    await Promise.all([
        rateLimitedFetch('https://api.openai.com/v1/chat/completions'),
        rateLimitedFetch('https://api.openai.com/v1/chat/completions'),
    ]);

    assert.deepEqual(startedAt, [1_000, 3_000]);
});

test('times out a hung request and releases the next queued request', async () => {
    let calls = 0;
    const fetchWithFirstCallHung: typeof fetch = async () => {
        calls += 1;
        if (calls === 1) return new Promise<Response>(() => undefined);
        return new Response('{}', { status: 200 });
    };
    const gatedFetch = createRateLimitedFetch({
        fetchImpl: fetchWithFirstCallHung,
        maxRetries: 0,
        minimumIntervalMs: 0,
        requestTimeoutMs: 10,
    });

    const first = gatedFetch('https://api.openai.com/v1/chat/completions');
    const second = gatedFetch('https://api.openai.com/v1/chat/completions');

    await assert.rejects(first, /timed out/i);
    assert.equal((await second).status, 200);
});

test('a hung verification request cannot block foreground MAS traffic', async () => {
    const lanes = createOpenAIRequestLanes({
        fetchImpl: async (_input, init) => {
            if (new Headers(init?.headers).get('x-test-lane') === 'verification') {
                return new Promise<Response>(() => undefined);
            }
            return new Response('{}', { status: 200 });
        },
        maxRetries: 0,
        minimumIntervalMs: 0,
        requestTimeoutMs: 25,
    });

    const verification = lanes.verification(
        'https://api.openai.com/v1/chat/completions',
        { headers: { 'x-test-lane': 'verification' } },
    );
    const foreground = lanes.foreground(
        'https://api.openai.com/v1/chat/completions',
    );

    assert.equal((await foreground).status, 200);
    await assert.rejects(verification, /timed out/i);
});
