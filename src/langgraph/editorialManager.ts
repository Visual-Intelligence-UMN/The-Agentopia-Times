import type Phaser from 'phaser';

import {
    buildEditorialAssessmentMessages,
    buildEditorialDecisionMessages,
    buildEditorialRevisionMessages,
    canPublishEditorialDecision,
    type EditorialAssessment,
    type EditorialDecision,
    parseEditorialAssessment,
    parseEditorialDecision,
} from '../game/domain/editorialManager';
import {
    createManagerAssessmentCoordinator,
    type ManagerAssessmentCoordinator,
} from '../game/domain/managerAssessmentCoordinator';
import type { Agent } from '../game/sprites/Agent';
import { recorder } from '../game/utils/recorder';
import { getDatasetConfigForScene } from './config';
import { recordMASStage, startMASTrace } from './masTrace';
import { startTextMessager } from './workflowUtils';

export interface EditorialReviewHooks {
    onStatus?(status: string, color?: string): void;
}

export interface EditorialAssessmentHooks extends EditorialReviewHooks {
    signal?: AbortSignal;
    isCurrent?(): boolean;
}

export type EditorialManagerAssessmentCoordinator =
    ManagerAssessmentCoordinator<Agent, EditorialAssessment>;

export interface EditorialReviewResult {
    assessment: EditorialAssessment;
    initialDecision: EditorialDecision;
    finalDecision: EditorialDecision;
    originalReport: string;
    reportForPublication: string;
    revised: boolean;
    publicationBlocked: boolean;
}

function contentOf(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object' && 'content' in message) {
        const content = (message as { content: unknown }).content;
        return typeof content === 'string' ? content : String(content ?? '');
    }
    return String(message ?? '');
}

async function loadOriginalEvidence(
    csvPath: string,
    signal?: AbortSignal,
): Promise<string> {
    try {
        const response = await fetch(csvPath, { signal });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return (await response.text()).slice(0, 20_000);
    } catch {
        return '[Raw data unavailable; rely on the neutral statistics above.]';
    }
}

function ensureCurrentAssessment(hooks: EditorialAssessmentHooks) {
    if (hooks.signal?.aborted || hooks.isCurrent?.() === false) {
        const error = new Error('Editorial Manager assessment superseded.');
        error.name = 'AbortError';
        throw error;
    }
}

async function requestDecision(
    assessment: EditorialAssessment,
    candidateReport: string,
): Promise<EditorialDecision> {
    const messages = buildEditorialDecisionMessages({
        assessment,
        candidateReport,
    });
    const response = await startTextMessager(messages.system, messages.user);
    return parseEditorialDecision(contentOf(response));
}

export async function createIndependentEditorialAssessment(
    scene: Phaser.Scene,
    manager: Agent,
    hooks: EditorialAssessmentHooks = {},
): Promise<EditorialAssessment> {
    ensureCurrentAssessment(hooks);
    const dataset = getDatasetConfigForScene(scene);
    hooks.onStatus?.('REVIEWING EVIDENCE', '#f4bd4a');
    recorder.recordEvent({
        type: 'editorial_assessment_started',
        agent: manager.getName(),
        dataset: dataset.id,
    });
    // Prefetch may overlap the production MAS, so it must not take over the
    // assigned agent's animation state before the report-review seam.
    const rawEvidence = await loadOriginalEvidence(
        dataset.csvPath,
        hooks.signal,
    );
    ensureCurrentAssessment(hooks);
    const messages = buildEditorialAssessmentMessages({
        description: dataset.description,
        researchQuestion: dataset.researchQuestion,
        neutralStatistics: dataset.neutralStatistics,
        rawEvidence,
    });
    const response = await startTextMessager(
        messages.system,
        messages.user,
        hooks.signal,
    );
    ensureCurrentAssessment(hooks);
    const assessment = parseEditorialAssessment(contentOf(response));

    recordMASStage({
        stageIndex: -1,
        workflow: 'editorial_manager_independent_assessment',
        input: {
            dataset: dataset.id,
            description: dataset.description,
            researchQuestion: dataset.researchQuestion,
            neutralStatistics: dataset.neutralStatistics,
            rawEvidence,
        },
        output: assessment,
    });
    recorder.recordEvent({
        type: 'editorial_assessment_sealed',
        agent: manager.getName(),
        confidence: assessment.confidence,
    });
    manager.setAgentInformation(
        `SEALED INDEPENDENT ASSESSMENT\n\n${assessment.centralClaim}\n\nEvidence:\n${assessment.supportingEvidence.join('\n')}`,
    );
    hooks.onStatus?.('ASSESSMENT SEALED', '#8ecae6');
    return assessment;
}

export function createEditorialManagerAssessmentCoordinator(
    scene: Phaser.Scene,
    hooks: EditorialReviewHooks = {},
): EditorialManagerAssessmentCoordinator {
    return createManagerAssessmentCoordinator(
        (manager, context) => {
            const workflow = scene.registry.get('workflowConfig');
            startMASTrace({
                level: String(scene.registry.get('currentLevel') ?? 'unknown'),
                dataset: String(
                    scene.registry.get('currentDataset') ?? 'unknown',
                ),
                workflow: Array.isArray(workflow) ? [...workflow] : [],
            });
            return createIndependentEditorialAssessment(scene, manager, {
                signal: context.signal,
                isCurrent: context.isCurrent,
                onStatus: (status, color) => {
                    if (context.isCurrent()) {
                        hooks.onStatus?.(status, color);
                    }
                },
            });
        },
        {
            onFailure: (manager, error) => {
                hooks.onStatus?.('REVIEW FAILED', '#ff8a65');
                recorder.recordEvent({
                    type: 'editorial_assessment_failed',
                    agent: manager.getName(),
                    message:
                        error instanceof Error ? error.message : String(error),
                });
            },
        },
    );
}

export async function reviewCandidateReport(
    scene: Phaser.Scene,
    manager: Agent,
    assessment: EditorialAssessment,
    candidateReport: string,
    hooks: EditorialReviewHooks = {},
): Promise<EditorialReviewResult> {
    const dataset = getDatasetConfigForScene(scene);
    hooks.onStatus?.('COMPARING REPORT', '#f4bd4a');
    recorder.recordEvent({
        type: 'editorial_candidate_received',
        agent: manager.getName(),
    });
    manager.setAgentState('work');

    try {
        const initialDecision = await requestDecision(
            assessment,
            candidateReport,
        );
        recordMASStage({
            stageIndex: 1,
            workflow: 'editorial_manager_comparison',
            input: { assessment, candidateReport },
            output: initialDecision,
        });
        recorder.recordEvent({
            type: 'editorial_decision',
            verdict: initialDecision.verdict,
            returnTo: initialDecision.returnTo,
        });

        if (initialDecision.verdict === 'approve') {
            manager.setAgentInformation(
                `EDITORIAL DECISION: APPROVED\n\n${initialDecision.evidenceReferences.join('\n')}`,
            );
            hooks.onStatus?.('APPROVED', '#80ed99');
            return {
                assessment,
                initialDecision,
                finalDecision: initialDecision,
                originalReport: candidateReport,
                reportForPublication: candidateReport,
                revised: false,
                publicationBlocked: false,
            };
        }

        hooks.onStatus?.('REVISION REQUESTED', '#ffb45c');
        recorder.recordEvent({
            type: 'editorial_revision_requested',
            returnTo: initialDecision.returnTo,
            instructions: initialDecision.revisionInstructions,
        });
        const revisionMessages = buildEditorialRevisionMessages({
            candidateReport,
            decision: initialDecision,
            neutralStatistics: dataset.neutralStatistics,
        });
        const revisionResponse = await startTextMessager(
            revisionMessages.system,
            revisionMessages.user,
        );
        const revisedReport =
            contentOf(revisionResponse).trim() || candidateReport;
        recordMASStage({
            stageIndex: 1,
            workflow: `editorial_revision_${initialDecision.returnTo}`,
            input: {
                candidateReport,
                decision: initialDecision,
                neutralStatistics: dataset.neutralStatistics,
            },
            output: revisedReport,
        });

        hooks.onStatus?.('RECHECKING REVISION', '#f4bd4a');
        const finalDecision = await requestDecision(assessment, revisedReport);
        recordMASStage({
            stageIndex: 1,
            workflow: 'editorial_manager_recheck',
            input: { assessment, candidateReport: revisedReport },
            output: finalDecision,
        });
        recorder.recordEvent({
            type: 'editorial_recheck_completed',
            verdict: finalDecision.verdict,
        });

        const status =
            finalDecision.verdict === 'approve'
                ? ['APPROVED AFTER REVISION', '#80ed99']
                : ['NOT APPROVED', '#ff8a65'];
        hooks.onStatus?.(status[0], status[1]);
        manager.setAgentInformation(
            `EDITORIAL DECISION: ${finalDecision.verdict.toUpperCase()}\n\nMismatches:\n${finalDecision.mismatches.join('\n')}\n\nRevision instructions:\n${finalDecision.revisionInstructions.join('\n')}`,
        );

        return {
            assessment,
            initialDecision,
            finalDecision,
            originalReport: candidateReport,
            reportForPublication: revisedReport,
            revised: true,
            publicationBlocked: !canPublishEditorialDecision(finalDecision),
        };
    } finally {
        manager.setAgentState('idle');
    }
}
