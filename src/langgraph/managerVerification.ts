import { compile, type TopLevelSpec } from 'vega-lite';

import { getVisualizationData } from '../vega/visualizationData';
import { getDatasetConfigForScene } from './config';
import { recordMASStage } from './masTrace';
import { startTextMessager } from './workflowUtils';

interface VerificationRecord {
    agentId: string;
    stageIndex: number;
    status: 'verified' | 'issues_found' | 'failed';
    issues: string[];
}

interface VerificationAgent {
    getName(): string;
    isEditorialManager?(): boolean;
}

interface VerificationScene {
    registry: Phaser.Data.DataManager;
    events?: Phaser.Events.EventEmitter;
    managerAssignment?: { setStatus(status: string, color: string): void };
}

const responseFormat = {
    type: 'json_schema' as const,
    json_schema: {
        name: 'node_verification',
        strict: true,
        schema: {
            type: 'object',
            additionalProperties: false,
            required: ['status', 'issues', 'artifact'],
            properties: {
                status: { type: 'string', enum: ['verified', 'issues_found'] },
                issues: { type: 'array', items: { type: 'string' } },
                artifact: { type: 'string' },
            },
        },
    },
};

export function getManagerVerificationSummary(
    scene: Pick<VerificationScene, 'registry'>,
    agentId?: string,
) {
    const results: VerificationRecord[] = (
        scene.registry.get('managerVerificationResults') ?? []
    ).filter((result: VerificationRecord) => result.agentId === agentId);
    return {
        results,
        approved:
            results.length > 0 &&
            results.every((result) => result.status === 'verified'),
    };
}

/** Extra responsibility of an existing participant, never a separate approval gate. */
export async function verifyManagerArtifact(
    scene: VerificationScene,
    agent: VerificationAgent,
    stageIndex: number,
    artifact: string,
    context = '',
    kind = ['title', 'report', 'visualization'][stageIndex] ?? 'report',
    signal?: AbortSignal,
): Promise<string> {
    if (!agent.isEditorialManager?.()) return artifact;
    const abort = new AbortController();
    const cancel = () => abort.abort();
    scene.events?.once('shutdown', cancel);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const agentId = agent.getName();
    let output = artifact;
    let result: VerificationRecord;
    try {
        abort.signal.throwIfAborted();
        scene.managerAssignment?.setStatus('VERIFYING AT NODE', '#f4bd4a');
        recordMASStage({
            stageIndex,
            workflow: 'manager_verification_started',
            input: { agentId, kind },
            output: null,
        });
        const dataset = getDatasetConfigForScene(scene);
        const response = await startTextMessager(
            `You are ${agentId}, still the same participant at this workflow node, with an additional verification responsibility.
Your node is: INPUT -> original task execution + verification -> OUTPUT. Verify the complete received input, including upstream claims and all earlier discussion, against the original dataset counts. This is not merely proofreading your own draft. Reconcile incorrect input while completing the original task; produce the node output from that verified understanding. The task-execution draft is a starting point, not an authority. Do not assess future nodes or impose a global publication decision. A subgroup result differing from an aggregate result is not by itself an inconsistency.
Return JSON with status (verified or issues_found), issues (remaining concerns), and artifact (the complete node output as a string). Keep review commentary in issues, not in the artifact. For a title return one title; for a report preserve the article; for visualization return Vega-Lite JSON; for discussion preserve a discussion contribution, not a final chart. Mark unresolved concerns as issues_found; downstream work will continue.`,
            JSON.stringify({
                kind,
                input: context,
                taskExecutionDraft: artifact,
                dataset: dataset.id,
                originalCounts: getVisualizationData(dataset.id),
            }),
            abort.signal,
            responseFormat,
        );
        abort.signal.throwIfAborted();
        const parsed = JSON.parse(String(response.content));
        if (
            !['verified', 'issues_found'].includes(parsed.status) ||
            !Array.isArray(parsed.issues) ||
            !parsed.issues.every(
                (issue: unknown) => typeof issue === 'string',
            ) ||
            typeof parsed.artifact !== 'string' ||
            !parsed.artifact.trim()
        ) {
            throw new Error('Invalid node verification response');
        }
        if (kind === 'visualization')
            compile(JSON.parse(parsed.artifact) as TopLevelSpec);
        output = parsed.artifact;
        result = {
            agentId,
            stageIndex,
            status: parsed.status,
            issues: parsed.issues,
        };
    } catch (error) {
        abort.signal.throwIfAborted();
        if (error instanceof Error && error.name === 'AbortError') throw error;
        result = {
            agentId,
            stageIndex,
            status: 'failed',
            issues: [error instanceof Error ? error.message : String(error)],
        };
        // Keep the participant's real output when verification is unavailable.
    } finally {
        scene.events?.off('shutdown', cancel);
        signal?.removeEventListener('abort', cancel);
    }
    const previous: VerificationRecord[] =
        scene.registry.get('managerVerificationResults') ?? [];
    scene.registry.set('managerVerificationResults', [...previous, result]);
    scene.managerAssignment?.setStatus(
        result.status === 'verified' ? 'NODE VERIFIED' : 'CONCERNS RECORDED',
        result.status === 'verified' ? '#80ed99' : '#ffb45c',
    );
    recordMASStage({
        stageIndex,
        workflow: 'manager_verification_completed',
        input: { agentId, kind, context, artifact },
        output: { ...result, artifact: output },
    });
    return output;
}
