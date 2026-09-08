/** Archive data, never credentials. Applied before browser storage and again on disk. */
export function redactArchiveData(value: unknown): unknown {
    if (typeof value === 'string') {
        return value
            .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
            .replace(/\bsk-[A-Za-z0-9_-]+/g, '[REDACTED]');
    }
    if (Array.isArray(value)) return value.map(redactArchiveData);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                /^(authorization|proxy-authorization|cookie|set-cookie|api[_-]?key|openai[_-]?api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)$/i.test(
                    key,
                )
                    ? '[REDACTED]'
                    : redactArchiveData(item),
            ]),
        );
    }
    return typeof value === 'bigint' ? value.toString() : value;
}
