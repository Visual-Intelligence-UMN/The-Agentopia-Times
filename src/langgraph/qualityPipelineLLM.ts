import { ChatOpenAI } from '@langchain/openai';

import { getStoredOpenAIKey } from '../utils/openai';
import { getMASModels } from './config';
import { createMASTraceCallback } from './masTrace';
import { getOpenAIRequestFetch } from './openaiRequestGate';
import {
    runQualityEditor,
    type QualityEditorInput,
} from './qualityEditor';
import {
    buildStrategyJudgeMessages,
    runStrategyJudge,
    type StrategyJudgeInput,
} from './strategyJudge';

const strategyResponseFormat = {
    type: 'json_schema' as const,
    json_schema: {
        name: 'strategy_judgement',
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['score', 'explanation', 'evidence'],
            properties: {
                score: { type: 'number', minimum: 0, maximum: 10 },
                explanation: { type: 'string' },
                evidence: {
                    type: 'array',
                    minItems: 1,
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['stageIndex', 'observation'],
                        properties: {
                            stageIndex: { type: 'number' },
                            observation: { type: 'string' },
                        },
                    },
                },
            },
        },
    },
};

function createJudgeLLM() {
    const apiKey = getStoredOpenAIKey();
    if (!apiKey) throw new Error('OpenAI API Key is not set.');
    const model = getMASModels().judge;
    return new ChatOpenAI({
        apiKey,
        modelName: model,
        maxRetries: 0,
        modelKwargs: { reasoning_effort: 'minimal' },
        configuration: { fetch: getOpenAIRequestFetch() },
        callbacks: [createMASTraceCallback(model)],
    });
}

function contentAsString(content: unknown) {
    if (typeof content === 'string') return content;
    throw new Error('Quality pipeline returned non-text content.');
}

export function judgeStrategyWithLLM(
    input: StrategyJudgeInput,
    signal?: AbortSignal,
) {
    return runStrategyJudge(input, {
        signal,
        complete: async (_messages, requestSignal) => {
            const response = await createJudgeLLM().invoke(
                buildStrategyJudgeMessages(input),
                {
                    signal: requestSignal,
                    response_format: strategyResponseFormat,
                },
            );
            return contentAsString(response.content);
        },
    });
}

export function refineOutputWithLLM(
    input: QualityEditorInput,
    signal?: AbortSignal,
) {
    return runQualityEditor(input, {
        signal,
        complete: async (messages, requestSignal) => {
            const response = await createJudgeLLM().invoke(
                messages,
                {
                    signal: requestSignal,
                    response_format: { type: 'json_object' },
                },
            );
            return contentAsString(response.content);
        },
    });
}
