import { checkVegaLiteCode } from '../vega/renderChart.ts';

export interface JudgeResult {
    score: string;
    reasons: string[];
    comments: string[];
}

export function enforceVisualizationValidity(
    code: string,
    result: JudgeResult,
): JudgeResult {
    const validation = checkVegaLiteCode(code);
    if (!validation.ok) {
        return {
            ...result,
            score: '0/10',
            reasons: [
                `The visualization could not be compiled: ${validation.error ?? 'unknown validation error'}`,
                ...result.reasons.filter(
                    (reason) => !/invalid|unusable|compile/i.test(reason),
                ),
            ],
        };
    }

    if (result.score !== '0/10') return result;

    return {
        ...result,
        score: '1/10',
        reasons: [
            'The visualization compiled successfully, so it receives the minimum valid-visualization score; higher scores still require the rubric’s analytical views.',
            ...result.reasons.filter(
                (reason) => !/invalid|unusable|no four views/i.test(reason),
            ),
        ],
        comments: result.comments.filter(
            (comment) => !/invalid|unusable/i.test(comment),
        ),
    };
}

export const judgeResponseFormat = {
    type: 'json_schema' as const,
    json_schema: {
        name: 'output_judgement',
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['score', 'reasons', 'comments'],
            properties: {
                score: { type: 'string', pattern: '^(?:10|[0-9])/10$' },
                reasons: {
                    type: 'array',
                    items: { type: 'string' },
                },
                comments: {
                    type: 'array',
                    items: { type: 'string' },
                },
            },
        },
    },
};
