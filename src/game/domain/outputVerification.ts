export type VerificationEvidence = {
    id: string;
    text: string;
};

export type TextAnnotation = {
    start: number;
    end: number;
    quote: string;
    category: 'contradicted' | 'unsupported';
    reason: string;
    evidenceIds: string[];
};

/** Provenance follows consumed inputs, independently of verification verdicts. */
export function deriveGhostSources(
    inputs: readonly (readonly string[])[],
    ghostId?: string,
): string[] {
    const sources = new Set(inputs.flat());
    if (ghostId) sources.add(ghostId);
    return [...sources];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchQuote(
    text: string,
    quote: string,
    prefix?: string,
    suffix?: string,
): { start: number; end: number } | undefined {
    let match: { start: number; end: number } | undefined;
    for (
        let start = text.indexOf(quote);
        start !== -1;
        start = text.indexOf(quote, start + 1)
    ) {
        const end = start + quote.length;
        if (
            (prefix !== undefined &&
                text.slice(Math.max(0, start - prefix.length), start) !==
                    prefix) ||
            (suffix !== undefined && !text.startsWith(suffix, end))
        ) {
            continue;
        }
        // Even overlapping occurrences must be uniquely identified by context.
        if (match) return undefined;
        match = { start, end };
    }
    return match;
}

function parseAnnotation(
    value: unknown,
    text: string,
    knownEvidenceIds: ReadonlySet<string>,
): TextAnnotation | undefined {
    if (!isRecord(value)) return undefined;
    const { quote, category, reason, evidenceIds, prefix, suffix } = value;
    if (
        typeof quote !== 'string' ||
        !quote.trim() ||
        (category !== 'contradicted' && category !== 'unsupported') ||
        typeof reason !== 'string' ||
        !reason.trim() ||
        !Array.isArray(evidenceIds) ||
        !evidenceIds.every(
            (id): id is string =>
                typeof id === 'string' && knownEvidenceIds.has(id),
        ) ||
        (category === 'contradicted' && evidenceIds.length === 0) ||
        (prefix !== undefined && typeof prefix !== 'string') ||
        (suffix !== undefined && typeof suffix !== 'string')
    ) {
        return undefined;
    }

    const span = matchQuote(text, quote, prefix, suffix);
    if (!span) return undefined;
    return {
        ...span,
        quote,
        category,
        reason,
        evidenceIds: [...new Set(evidenceIds)],
    };
}

/**
 * Invalid JSON or a missing annotations array throws. Invalid individual entries
 * increment rejectedCount, so an unusable verdict cannot look like a clean one.
 * First valid entries win overlaps; returned spans are ordered by text position.
 * Offsets are derived UTF-16 indices for String.slice, never model-provided ones.
 */
export function parseVerificationResponse(
    raw: string,
    text: string,
    evidence: readonly VerificationEvidence[],
): { annotations: TextAnnotation[]; rejectedCount: number } {
    const json = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error('Output verification returned invalid JSON.');
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.annotations)) {
        throw new Error(
            'Output verification must return an object containing an annotations array.',
        );
    }

    const knownEvidenceIds = new Set(evidence.map((item) => item.id));
    const annotations: TextAnnotation[] = [];
    let rejectedCount = 0;
    for (const value of parsed.annotations) {
        const annotation = parseAnnotation(value, text, knownEvidenceIds);
        if (
            !annotation ||
            annotations.some(
                (existing) =>
                    annotation.start < existing.end &&
                    existing.start < annotation.end,
            )
        ) {
            rejectedCount++;
            continue;
        }
        annotations.push(annotation);
    }
    annotations.sort((left, right) => left.start - right.start);
    return { annotations, rejectedCount };
}
