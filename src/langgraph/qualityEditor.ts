import { compile, type TopLevelSpec } from 'vega-lite';

import type { GoldOutput } from '../game/config/goldOutputs.ts';

export interface QualityEditorInput {
    dataset: {
        id: string;
        description: string;
        researchQuestion: string;
        groundTruth: string;
        neutralStatistics: string;
        goldOutput: GoldOutput;
    };
    draftReport: string;
    draftVisualization: string;
    rubrics: string[];
}

export interface QualityEditorResult {
    reportMarkdown: string;
    visualizationSpec: TopLevelSpec;
}

export interface QualityEditorOptions {
    complete: (
        messages: ReturnType<typeof buildQualityEditorMessages>,
        signal?: AbortSignal,
    ) => Promise<string>;
    signal?: AbortSignal;
}

export function buildQualityEditorMessages(input: QualityEditorInput) {
    return [
        {
            role: 'system' as const,
            content: `You are the hidden Quality Editor for a multi-agent newsroom.
The player's risk-control strategy has already earned a passing Strategy Score. Refine both draft artifacts to the quality of the supplied Gold Final Output.

Rules:
- Treat the Gold Report and Gold Visualization as authoritative quality references.
- Correct every factual or reasoning error and add missing essential analysis.
- Preserve useful language or design choices from the drafts when they remain accurate.
- The report must follow the Gold Report's factual conclusion without mentioning the Gold Report, grading, agents, prompts, or editing.
- The visualization must be a valid Vega-Lite specification, use only the supplied factual values, clearly compare subgroup and aggregate results, and contain no external URL.
- Return JSON only: {"reportMarkdown": string, "visualizationSpec": object}. All chart fields, including data, mark, layer, facet, vconcat, hconcat, concat and repeat, must be inside visualizationSpec, never beside it.`,
        },
        {
            role: 'user' as const,
            content: JSON.stringify({
                dataset: {
                    id: input.dataset.id,
                    description: input.dataset.description,
                    researchQuestion: input.dataset.researchQuestion,
                    groundTruth: input.dataset.groundTruth,
                    neutralStatistics: input.dataset.neutralStatistics,
                },
                rubrics: input.rubrics,
                drafts: {
                    reportMarkdown: input.draftReport,
                    visualizationSpec: input.draftVisualization,
                },
                goldFinalOutput: input.dataset.goldOutput,
            }),
        },
    ];
}

function cleanJson(raw: string) {
    return raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '');
}

function containsExternalData(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    if (
        'url' in value &&
        typeof (value as { url?: unknown }).url === 'string'
    ) {
        return true;
    }
    return Object.values(value).some(containsExternalData);
}

export function parseQualityEditorResult(raw: string): QualityEditorResult {
    const parsed = JSON.parse(cleanJson(raw)) as {
        reportMarkdown?: unknown;
        visualizationSpec?: unknown;
    };
    if (
        typeof parsed.reportMarkdown === 'string' &&
        /\b(?:gold report|gold final output|reference answer|i revised|as an editor)\b/i.test(
            parsed.reportMarkdown,
        )
    ) {
        throw new Error('Quality Editor leaked editing meta-language.');
    }
    if (
        typeof parsed.reportMarkdown !== 'string' ||
        parsed.reportMarkdown.trim().length < 40
    ) {
        throw new Error('Quality Editor returned an empty or incomplete report.');
    }

    let visualizationSpec = parsed.visualizationSpec;
    if (typeof visualizationSpec === 'string') {
        visualizationSpec = JSON.parse(cleanJson(visualizationSpec));
    }
    if (
        !visualizationSpec ||
        typeof visualizationSpec !== 'object' ||
        Array.isArray(visualizationSpec) ||
        containsExternalData(visualizationSpec)
    ) {
        throw new Error('Quality Editor returned an invalid visualization.');
    }

    try {
        compile(visualizationSpec as TopLevelSpec);
    } catch (error) {
        throw new Error(
            `Quality Editor returned an invalid visualization: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }

    return {
        reportMarkdown: parsed.reportMarkdown.trim(),
        visualizationSpec: visualizationSpec as TopLevelSpec,
    };
}

export async function runQualityEditor(
    input: QualityEditorInput,
    options: QualityEditorOptions,
): Promise<QualityEditorResult> {
    const messages = buildQualityEditorMessages(input);
    // Retry validation failures once; transport failures are handled by the caller.
    for (let attempt = 0; attempt < 2; attempt += 1) {
        options.signal?.throwIfAborted();
        const raw = await options.complete(messages, options.signal);
        options.signal?.throwIfAborted();
        try {
            return parseQualityEditorResult(raw);
        } catch (error) {
            if (attempt === 1) throw error;
            const reason = error instanceof Error ? error.message : String(error);
            messages.push({
                role: 'user',
                content: `Your previous response failed validation: ${reason.slice(0, 2000)}\nReturn a complete corrected JSON object containing reportMarkdown and visualizationSpec. Put all chart fields inside visualizationSpec. Do not return a patch or commentary.`,
            });
        }
    }
    throw new Error('Quality Editor exhausted its validation attempts.');
}
