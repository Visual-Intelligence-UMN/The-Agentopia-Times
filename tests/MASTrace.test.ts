import assert from 'node:assert/strict';
import test from 'node:test';

import {
    AIMessage,
    HumanMessage,
    SystemMessage,
} from '@langchain/core/messages';

import {
    finishMASTrace,
    MASTraceCallbackHandler,
    recordMASStage,
    resetMASTraceForTests,
    startMASTrace,
} from '../src/langgraph/masTrace.ts';

test('records complete MAS inputs, outputs, stages, and final output', () => {
    resetMASTraceForTests();
    startMASTrace({
        level: 'level1',
        dataset: 'baseball',
        workflow: ['voting'],
    });

    const callback = new MASTraceCallbackHandler('gpt-5-nano');
    callback.handleChatModelStart(
        {},
        [
            [
                new SystemMessage('system instructions'),
                new HumanMessage('agent input'),
            ],
        ],
        'call-1',
    );
    callback.handleLLMEnd(
        {
            generations: [
                [
                    {
                        text: 'agent output',
                        message: new AIMessage('agent output'),
                    },
                ],
            ],
            llmOutput: {
                tokenUsage: {
                    promptTokens: 10,
                    completionTokens: 4,
                    totalTokens: 14,
                },
            },
        },
        'call-1',
    );

    recordMASStage({
        stageIndex: 0,
        workflow: 'voting',
        input: { votingInput: 'initial input' },
        output: { votingOutput: 'agent output' },
    });

    const trace = finishMASTrace(
        { cycleOutputs: ['initial input', 'agent output'] },
        false,
    );

    assert.ok(trace);
    assert.equal(trace.status, 'completed');
    assert.equal(trace.context.level, 'level1');
    assert.equal(trace.calls.length, 1);
    assert.equal(trace.calls[0].model, 'gpt-5-nano');
    assert.deepEqual(
        trace.calls[0].input[0].map((message) => message.content),
        ['system instructions', 'agent input'],
    );
    assert.equal(trace.calls[0].status, 'completed');
    assert.equal(trace.stages[0].workflow, 'voting');
    assert.deepEqual(trace.finalOutput, {
        cycleOutputs: ['initial input', 'agent output'],
    });
});

test('preserves a failed model call without recording credentials', () => {
    resetMASTraceForTests();
    startMASTrace({
        level: 'level4',
        dataset: 'kidney',
        workflow: ['sequential'],
    });

    const callback = new MASTraceCallbackHandler('gpt-5-nano');
    callback.handleLLMStart({}, ['safe prompt'], 'call-2');
    callback.handleLLMError(new Error('request failed'), 'call-2');

    const trace = finishMASTrace(null, false);
    assert.ok(trace);
    assert.equal(trace.status, 'error');
    assert.deepEqual(trace.calls[0].error, {
        name: 'Error',
        message: 'request failed',
    });
    assert.ok(!JSON.stringify(trace).includes('apiKey'));
});
