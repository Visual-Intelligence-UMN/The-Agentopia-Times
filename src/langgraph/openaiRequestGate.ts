export interface RateLimitedFetchOptions {
    fetchImpl?: typeof fetch;
    maxRetries?: number;
    minimumIntervalMs?: number;
    now?: () => number;
    sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_MINIMUM_INTERVAL_MS = 250;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;

function createAbortError() {
    const error = new Error('OpenAI request aborted.');
    error.name = 'AbortError';
    return error;
}

function defaultSleep(milliseconds: number, signal?: AbortSignal) {
    if (signal?.aborted) return Promise.reject(createAbortError());

    return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timeout);
            reject(createAbortError());
        };
        const timeout = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, milliseconds);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

function parseDuration(value: string | null): number | null {
    if (!value) return null;

    let durationMs = 0;
    let matched = false;
    const units: Record<string, number> = {
        ms: 1,
        s: 1_000,
        m: 60_000,
        h: 3_600_000,
    };

    for (const match of value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)) {
        matched = true;
        durationMs += Number(match[1]) * units[match[2]];
    }

    return matched ? durationMs : null;
}

function retryAfterMs(response: Response): number | null {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

        const date = Date.parse(retryAfter);
        if (Number.isFinite(date)) return Math.max(0, date - Date.now());
    }

    const resets = [
        parseDuration(response.headers.get('x-ratelimit-reset-requests')),
        parseDuration(response.headers.get('x-ratelimit-reset-tokens')),
    ].filter((value): value is number => value !== null);

    return resets.length > 0 ? Math.max(...resets) : null;
}

function exhaustedWindowDelayMs(response: Response): number | null {
    const windows = [
        {
            remaining: response.headers.get('x-ratelimit-remaining-requests'),
            reset: response.headers.get('x-ratelimit-reset-requests'),
        },
        {
            remaining: response.headers.get('x-ratelimit-remaining-tokens'),
            reset: response.headers.get('x-ratelimit-reset-tokens'),
        },
    ];
    const exhaustedResets = windows
        .filter(({ remaining }) => remaining !== null && Number(remaining) <= 0)
        .map(({ reset }) => parseDuration(reset))
        .filter((value): value is number => value !== null);

    return exhaustedResets.length > 0 ? Math.max(...exhaustedResets) : null;
}

async function errorCode(response: Response): Promise<string | null> {
    try {
        const body = (await response.clone().json()) as {
            error?: { code?: string; type?: string };
        };
        return body.error?.code ?? body.error?.type ?? null;
    } catch {
        return null;
    }
}

function isRetryableStatus(status: number) {
    return status === 408 || status === 409 || status === 429 || status >= 500;
}

function requestSignal(
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
) {
    if (init?.signal) return init.signal;
    return typeof Request !== 'undefined' && input instanceof Request
        ? input.signal
        : undefined;
}

export function createRateLimitedFetch(
    options: RateLimitedFetchOptions = {},
): typeof fetch {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const minimumIntervalMs =
        options.minimumIntervalMs ?? DEFAULT_MINIMUM_INTERVAL_MS;
    const now = options.now ?? Date.now;
    const sleep = options.sleep ?? defaultSleep;

    let queueTail = Promise.resolve();
    let nextRequestAt = 0;

    const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
        const result = queueTail.then(work, work);
        queueTail = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    };

    const rateLimitedFetch: typeof fetch = (input, init) =>
        enqueue(async () => {
            const signal = requestSignal(input, init);

            for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
                if (signal?.aborted) throw createAbortError();

                const queueDelay = Math.max(0, nextRequestAt - now());
                if (queueDelay > 0) await sleep(queueDelay, signal);

                nextRequestAt = now() + minimumIntervalMs;

                let response: Response;
                try {
                    response = await fetchImpl(input, init);
                } catch (error) {
                    if (
                        signal?.aborted ||
                        (error instanceof Error &&
                            error.name === 'AbortError') ||
                        attempt === maxRetries
                    ) {
                        throw error;
                    }

                    nextRequestAt = Math.max(
                        nextRequestAt,
                        now() +
                            Math.min(
                                DEFAULT_RETRY_DELAY_MS * 2 ** attempt,
                                MAX_RETRY_DELAY_MS,
                            ),
                    );
                    continue;
                }

                const exhaustedWindowDelay = exhaustedWindowDelayMs(response);
                if (exhaustedWindowDelay !== null) {
                    nextRequestAt = Math.max(
                        nextRequestAt,
                        now() + exhaustedWindowDelay,
                    );
                }

                if (!isRetryableStatus(response.status)) return response;
                if (
                    response.status === 429 &&
                    (await errorCode(response)) === 'insufficient_quota'
                ) {
                    return response;
                }
                if (attempt === maxRetries) return response;

                const delay = Math.min(
                    retryAfterMs(response) ??
                        DEFAULT_RETRY_DELAY_MS * 2 ** attempt,
                    MAX_RETRY_DELAY_MS,
                );
                nextRequestAt = Math.max(nextRequestAt, now() + delay);
            }

            throw new Error('OpenAI request retry loop ended unexpectedly.');
        });

    return rateLimitedFetch;
}

const sharedOpenAIRequestFetch = createRateLimitedFetch();

export function getOpenAIRequestFetch() {
    return sharedOpenAIRequestFetch;
}
