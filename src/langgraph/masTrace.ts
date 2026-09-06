import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { BaseMessage } from '@langchain/core/messages';
import type { LLMResult } from '@langchain/core/outputs';

const STORAGE_KEY = 'agentopia-mas-trace-latest';

export interface MASTraceContext {
    level: string;
    dataset: string;
    workflow: string[];
}

export interface MASTraceMessage {
    role: string;
    content: unknown;
    additionalKwargs?: Record<string, unknown>;
}

export interface MASTraceCall {
    sequence: number;
    runId: string;
    parentRunId?: string;
    model: string;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    status: 'running' | 'completed' | 'error';
    input: MASTraceMessage[][];
    output?: unknown;
    error?: {
        name: string;
        message: string;
    };
}

export interface MASTraceStage {
    sequence: number;
    recordedAt: string;
    stageIndex: number;
    workflow: string;
    input: unknown;
    output: unknown;
}

export interface MASTrace {
    schemaVersion: 1;
    runId: string;
    startedAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'error';
    context: MASTraceContext;
    calls: MASTraceCall[];
    stages: MASTraceStage[];
    finalOutput?: unknown;
}

let activeTrace: MASTrace | null = null;
let nextSequence = 1;
const callStartTimes = new Map<string, number>();

function nowIso(): string {
    return new Date().toISOString();
}

function makeRunId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    return `mas-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toSerializable(value: unknown): unknown {
    try {
        return JSON.parse(
            JSON.stringify(value, (_key, item) =>
                typeof item === 'bigint' ? item.toString() : item,
            ),
        );
    } catch {
        return String(value);
    }
}

function cloneTrace(trace: MASTrace): MASTrace {
    return toSerializable(trace) as MASTrace;
}

function persistTrace(): void {
    if (!activeTrace || typeof globalThis.localStorage === 'undefined') {
        return;
    }

    try {
        globalThis.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(activeTrace),
        );
    } catch {
        // Keep the in-memory trace when browser storage is unavailable.
    }
}

function ensureTrace(model = 'unknown'): MASTrace {
    if (!activeTrace || activeTrace.status !== 'running') {
        startMASTrace({
            level: 'unknown',
            dataset: 'unknown',
            workflow: [model],
        });
    }

    return activeTrace as MASTrace;
}

function serializeMessage(message: BaseMessage): MASTraceMessage {
    return {
        role: message._getType(),
        content: toSerializable(message.content),
        additionalKwargs: toSerializable(message.additional_kwargs) as Record<
            string,
            unknown
        >,
    };
}

function serializeResult(output: LLMResult): unknown {
    return {
        generations: output.generations.map((generationList) =>
            generationList.map((generation) => ({
                text: generation.text,
                message:
                    'message' in generation && generation.message
                        ? serializeMessage(generation.message as BaseMessage)
                        : undefined,
                generationInfo: toSerializable(generation.generationInfo),
            })),
        ),
        llmOutput: toSerializable(output.llmOutput),
    };
}

function createCall(
    runId: string,
    model: string,
    input: MASTraceMessage[][],
    parentRunId?: string,
): void {
    const trace = ensureTrace(model);
    if (trace.calls.some((call) => call.runId === runId)) {
        return;
    }

    trace.calls.push({
        sequence: nextSequence++,
        runId,
        parentRunId,
        model,
        startedAt: nowIso(),
        status: 'running',
        input,
    });
    callStartTimes.set(runId, Date.now());
    persistTrace();
}

function completeCall(runId: string, output: LLMResult): void {
    const call = activeTrace?.calls.find((item) => item.runId === runId);
    if (!call) {
        return;
    }

    call.status = 'completed';
    call.completedAt = nowIso();
    call.durationMs = Date.now() - (callStartTimes.get(runId) ?? Date.now());
    call.output = serializeResult(output);
    callStartTimes.delete(runId);
    persistTrace();
}

function failCall(runId: string, error: unknown): void {
    const trace = activeTrace;
    const call = trace?.calls.find((item) => item.runId === runId);
    if (!trace || !call) {
        return;
    }

    const normalizedError =
        error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: 'Error', message: String(error) };

    call.status = 'error';
    call.completedAt = nowIso();
    call.durationMs = Date.now() - (callStartTimes.get(runId) ?? Date.now());
    call.error = normalizedError;
    trace.status = 'error';
    callStartTimes.delete(runId);
    persistTrace();
}

export function startMASTrace(context: MASTraceContext): MASTrace {
    nextSequence = 1;
    callStartTimes.clear();
    activeTrace = {
        schemaVersion: 1,
        runId: makeRunId(),
        startedAt: nowIso(),
        status: 'running',
        context: toSerializable(context) as MASTraceContext,
        calls: [],
        stages: [],
    };
    persistTrace();
    return cloneTrace(activeTrace);
}

export function recordMASStage(details: {
    stageIndex: number;
    workflow: string;
    input: unknown;
    output: unknown;
}): void {
    const trace = ensureTrace();
    trace.stages.push({
        sequence: nextSequence++,
        recordedAt: nowIso(),
        stageIndex: details.stageIndex,
        workflow: details.workflow,
        input: toSerializable(details.input),
        output: toSerializable(details.output),
    });
    persistTrace();
}

export function finishMASTrace(
    finalOutput: unknown,
    download = true,
): MASTrace | null {
    if (!activeTrace) {
        return null;
    }

    activeTrace.completedAt = nowIso();
    activeTrace.status = activeTrace.calls.some(
        (call) => call.status === 'error',
    )
        ? 'error'
        : 'completed';
    activeTrace.finalOutput = toSerializable(finalOutput);
    persistTrace();

    const snapshot = cloneTrace(activeTrace);
    if (download) {
        downloadMASTrace(snapshot);
    }
    return snapshot;
}

export function getLatestMASTrace(): MASTrace | null {
    if (activeTrace) {
        return cloneTrace(activeTrace);
    }

    if (typeof globalThis.localStorage === 'undefined') {
        return null;
    }

    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as MASTrace) : null;
}

export function downloadMASTrace(trace = getLatestMASTrace()): void {
    if (!trace || typeof document === 'undefined') {
        return;
    }

    const blob = new Blob([JSON.stringify(trace, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mas-trace-${trace.context.level}-${trace.runId}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

export function resetMASTraceForTests(): void {
    activeTrace = null;
    nextSequence = 1;
    callStartTimes.clear();
}

export class MASTraceCallbackHandler extends BaseCallbackHandler {
    name = 'agentopia-mas-trace';
    private readonly model: string;

    constructor(model: string) {
        super();
        this.model = model;
    }

    handleChatModelStart(
        _llm: unknown,
        messages: BaseMessage[][],
        runId: string,
        parentRunId?: string,
    ): void {
        createCall(
            runId,
            this.model,
            messages.map((batch) => batch.map(serializeMessage)),
            parentRunId,
        );
    }

    handleLLMStart(
        _llm: unknown,
        prompts: string[],
        runId: string,
        parentRunId?: string,
    ): void {
        createCall(
            runId,
            this.model,
            prompts.map((prompt) => [{ role: 'prompt', content: prompt }]),
            parentRunId,
        );
    }

    handleLLMEnd(output: LLMResult, runId: string): void {
        completeCall(runId, output);
    }

    handleLLMError(error: unknown, runId: string): void {
        failCall(runId, error);
    }
}

export function createMASTraceCallback(model: string): MASTraceCallbackHandler {
    return new MASTraceCallbackHandler(model);
}
