import { ChatOpenAI } from '@langchain/openai';
import type Phaser from 'phaser';

import { createVerificationProvenance } from '../game/domain/verificationProvenance';
import {
    createVerificationSession,
    type VerificationSession,
} from '../game/domain/verificationSession';
import { runSceneWorkflow } from '../game/domain/workflowRun';
import type { Agent } from '../game/sprites/Agent';
import {
    resetVerificationStore,
    updateVerifiedOutput,
} from '../game/verificationStore';
import { getStoredOpenAIKey } from '../utils/openai';
import { toVerificationText } from '../utils/verificationMarkup';
import { getDatasetConfigForScene, getMASModels } from './config';
import { getOpenAIRequestFetch } from './openaiRequestGate';

interface VerificationRun {
    session: VerificationSession;
    provenance: ReturnType<typeof createVerificationProvenance>;
    outputs: Map<number, { text: string; sources: string; id: string }>;
    dispose: () => void;
}

const runs = new WeakMap<Phaser.Scene, VerificationRun>();
let activeRun: VerificationRun | undefined;

const responseFormat = {
    type: 'json_schema' as const,
    json_schema: {
        name: 'output_verification',
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['annotations'],
            properties: {
                annotations: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: [
                            'quote',
                            'category',
                            'reason',
                            'evidenceIds',
                            'prefix',
                            'suffix',
                        ],
                        properties: {
                            quote: { type: 'string' },
                            category: {
                                type: 'string',
                                enum: ['contradicted', 'unsupported'],
                            },
                            reason: { type: 'string' },
                            evidenceIds: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                        },
                    },
                },
            },
        },
    },
};

function startVerification(scene: Phaser.Scene): VerificationRun {
    activeRun?.dispose();
    resetVerificationStore();
    const dataset = getDatasetConfigForScene(scene);
    const model = getMASModels().chat;
    const runId = crypto.randomUUID();
    const evidence = [
        { id: `${dataset.id}.ground-truth`, text: dataset.groundTruth },
        { id: `${dataset.id}.statistics`, text: dataset.neutralStatistics },
        { id: `${dataset.id}.description`, text: dataset.description },
    ];
    let llm: ChatOpenAI | undefined;
    const persist = () => {
        if (activeRun !== run) return;
        try {
            localStorage.setItem(
                'agentopia-output-verification-latest',
                JSON.stringify({
                    runId,
                    dataset: dataset.id,
                    model,
                    records: session.records(),
                }),
            );
        } catch {
            /* In-memory checks remain usable when browser storage is full. */
        }
    };
    const session = createVerificationSession({
        runId,
        model,
        evidence,
        complete: async (messages, signal) => {
            if (!llm) {
                const apiKey = getStoredOpenAIKey();
                if (!apiKey) throw new Error('OpenAI API key is not set.');
                // No MAS trace callback: these asynchronous checks have their own run-scoped trace.
                llm = new ChatOpenAI({
                    apiKey,
                    modelName: model,
                    maxRetries: 0,
                    modelKwargs: { reasoning_effort: 'medium' },
                    configuration: { fetch: getOpenAIRequestFetch() },
                });
            }
            const response = await llm.invoke(
                [
                    { role: 'system', content: messages.system },
                    { role: 'user', content: messages.user },
                ],
                { signal, response_format: responseFormat },
            );
            if (typeof response.content !== 'string')
                throw new Error('Verification returned non-text content.');
            return response.content;
        },
        onUpdate: (record) => {
            if (activeRun !== run) return;
            updateVerifiedOutput(record);
            persist();
        },
    });
    const dispose = () => {
        session.cancel();
        scene.events.off('shutdown', dispose);
        runs.delete(scene);
        if (activeRun === run) {
            activeRun = undefined;
            resetVerificationStore();
        }
    };
    const run: VerificationRun = {
        session,
        provenance: createVerificationProvenance(),
        outputs: new Map(),
        dispose,
    };
    runs.set(scene, run);
    activeRun = run;
    scene.events.once('shutdown', dispose);
    persist();
    return run;
}

/** Keep checks outside the MAS await chain and preserve the existing scene run lock. */
export function runVerifiedSceneWorkflow(
    scene: Phaser.Scene,
    work: (scope: {
        beginStage: (index: number, strategy: string) => void;
    }) => Promise<void>,
    onError: (error: unknown) => void,
) {
    return runSceneWorkflow(
        scene,
        async () => {
            const run = startVerification(scene);
            await work({
                beginStage: (index, strategy) => {
                    if (activeRun !== run)
                        throw new Error('This workflow run has ended.');
                    run.provenance.beginStage(index, strategy);
                },
            });
        },
        onError,
    );
}

function registerOutput(
    run: VerificationRun,
    index: number,
    producer: string,
    raw: string,
    ghostSources: string[],
) {
    const text = toVerificationText(raw);
    const sources = JSON.stringify([...ghostSources].sort());
    const previous = run.outputs.get(index);
    // Stage forwarding an unchanged final speaker's text is the same check, not another API call.
    if (
        producer === 'Stage summary' &&
        previous?.text === text &&
        previous.sources === sources
    )
        return previous.id;
    const id = run.session.register({
        stageIndex: index,
        producer,
        text,
        ghostSources,
    });
    run.outputs.set(index, { text, sources, id });
    return id;
}

/** Bind at graph construction so late callbacks from a reset run cannot annotate its replacement. */
export function createOutputVerification(scene: Phaser.Scene, index: number) {
    const run = runs.get(scene);
    const isCurrent = () => run && activeRun === run && runs.get(scene) === run;
    return {
        agent(
            agent: Pick<Agent, 'getName' | 'getBias'>,
            text: string,
        ): string | undefined {
            if (!run || !isCurrent()) return;
            const name = agent.getName();
            const sources = run.provenance.agentSources(
                index,
                name,
                agent.getBias() !== '' ? name : undefined,
            );
            return registerOutput(run, index, name, text, sources);
        },
        stage(text: string): string | undefined {
            if (!run || !isCurrent()) return;
            return registerOutput(
                run,
                index,
                'Stage summary',
                text,
                run.provenance.stageSources(index),
            );
        },
    };
}
