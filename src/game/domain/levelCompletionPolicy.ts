import type { AgenticRisk, WorkflowType } from '../config/types.ts';

export const PASSING_STRATEGY_SCORE = 8;

export interface LevelRunAgent {
    id: string;
    ghost: boolean;
}

export interface LevelRunStage {
    strategy: WorkflowType;
    agents: LevelRunAgent[];
}

export interface LevelRunConfiguration {
    levelId: string;
    datasetId: string;
    risk: AgenticRisk;
    requiredScore: number;
    stages: LevelRunStage[];
    managerId: string | null;
    managerReviewApproved: boolean;
}

export interface RiskConfigurationVerdict {
    correct: boolean;
    explanation: string;
}

export interface LevelCompletionOutcome {
    passed: boolean;
    strategyScore: number;
    outputScore: number;
    refinementApplied: boolean;
    reason: 'strategy_passed' | 'strategy_failed';
    explanation: string;
}

function ghostStages(configuration: LevelRunConfiguration) {
    return configuration.stages
        .map((stage, index) => ({
            index,
            stage,
            ghosts: stage.agents.filter((agent) => agent.ghost),
        }))
        .filter(({ ghosts }) => ghosts.length > 0);
}

function isIndependentVotingBarrier(stage: LevelRunStage): boolean {
    if (stage.strategy !== 'voting') return false;
    const ghostCount = stage.agents.filter((agent) => agent.ghost).length;
    const normalCount = stage.agents.length - ghostCount;
    return normalCount >= 2 && normalCount > ghostCount;
}

function requireParticipatingGhost(
    configuration: LevelRunConfiguration,
): RiskConfigurationVerdict | undefined {
    if (ghostStages(configuration).length > 0) return;
    return {
        correct: false,
        explanation:
            'The Ghost Agent is outside the workflow, so this configuration does not exercise or resolve the level risk.',
    };
}

function requireCompletedManagerReview(
    configuration: LevelRunConfiguration,
): RiskConfigurationVerdict | undefined {
    if (!configuration.managerId) {
        return {
            correct: false,
            explanation:
                'Assign a normal agent as Manager to establish independent final accountability.',
        };
    }
    if (!configuration.managerReviewApproved) {
        return {
            correct: false,
            explanation:
                'The Manager review did not complete with an approved evidence-based decision.',
        };
    }
}

function hasUnreviewedGhost(configuration: LevelRunConfiguration): boolean {
    const managerStageIndex = configuration.stages.findIndex(stage =>
        stage.agents.some(agent => agent.id === configuration.managerId),
    );
    if (managerStageIndex < 0) return true;
    const managerStage = configuration.stages[managerStageIndex];
    const managerPosition = managerStage.agents.findIndex(agent => agent.id === configuration.managerId);
    return ghostStages(configuration).some(({ index, stage }) =>
        index > managerStageIndex ||
        (index === managerStageIndex && (stage.strategy === 'voting' ||
            stage.agents.some((agent, position) => agent.ghost && position > managerPosition))),
    );
}

/**
 * Deterministic structural check for the intervention taught by each level.
 * It intentionally does not use an LLM score, so a lucky output cannot make an
 * unsafe strategy pass.
 */
export function inspectRiskConfiguration(
    configuration: LevelRunConfiguration,
): RiskConfigurationVerdict {
    const missingGhost = requireParticipatingGhost(configuration);
    if (missingGhost) return missingGhost;

    const contaminatedStages = ghostStages(configuration);

    switch (configuration.risk) {
        case 'error_propagation': {
            const hasIndependentBarrier = contaminatedStages.every(
                ({ index }) =>
                    configuration.stages.some(
                        (stage, stageIndex) =>
                            (stageIndex === index ||
                                (index === 0 && stageIndex === 1)) &&
                            isIndependentVotingBarrier(stage),
                    ),
            );
            return hasIndependentBarrier
                ? {
                      correct: true,
                      explanation:
                          'Every injected error meets an independent voting barrier before publication.',
                  }
                : {
                      correct: false,
                      explanation:
                          'Place an independent Voting stage at or after every Ghost Agent to stop unchecked error propagation.',
                  };
        }

        case 'premature_consensus': {
            const independentFirstJudgements = contaminatedStages.every(
                ({ stage }) => isIndependentVotingBarrier(stage),
            );
            return independentFirstJudgements
                ? {
                      correct: true,
                      explanation:
                          'Ghost claims are considered through independent votes before aggregation.',
                  }
                : {
                      correct: false,
                      explanation:
                          'A Ghost Agent in Sequential, Discussion, or Single Agent work can anchor the team before independent judgement. Use Voting in its room.',
                  };
        }

        case 'verifier_capture': {
            const managerIssue = requireCompletedManagerReview(configuration);
            if (managerIssue) return managerIssue;
            if (hasUnreviewedGhost(configuration)) {
                return {
                    correct: false,
                    explanation:
                        'Place the Manager node after the risky work. Its verification cannot inspect a later agent or unseen parallel votes.',
                };
            }
            return {
                correct: true,
                explanation:
                    'The assigned agent verified its complete input against original evidence while executing its node task.',
            };
        }

        case 'collusion': {
            const ghostIds = new Set(
                contaminatedStages.flatMap(({ ghosts }) =>
                    ghosts.map((ghost) => ghost.id),
                ),
            );
            if (ghostIds.size < 2) {
                return {
                    correct: false,
                    explanation:
                        'Both Ghost Agents must participate so the collusion risk is exercised.',
                };
            }
            if (contaminatedStages.some(({ ghosts }) => ghosts.length > 1)) {
                return {
                    correct: false,
                    explanation:
                        'Separate the Ghost Agents so they cannot manufacture corroboration in the same room.',
                };
            }
            if (
                contaminatedStages.some(
                    ({ stage }) => !isIndependentVotingBarrier(stage),
                )
            ) {
                return {
                    correct: false,
                    explanation:
                        'Each Ghost Agent must be handled through independent Voting rather than a shared conversational chain.',
                };
            }
            return {
                correct: true,
                explanation:
                    'The Ghost Agents are separated and their claims are independently aggregated.',
            };
        }

        case 'responsibility_diffusion': {
            const managerIssue = requireCompletedManagerReview(configuration);
            if (managerIssue) return managerIssue;
            if (hasUnreviewedGhost(configuration)) {
                return {
                    correct: false,
                    explanation:
                        'The accountable verification node must follow the risky work; later or parallel agents remain outside its review.',
                };
            }
            return {
                correct: true,
                explanation:
                    'A named participant completed accountable verification of its input while executing its node task.',
            };
        }
    }
}

export function createLevelCompletionOutcome(input: {
    strategyScore: number;
    outputScore: number;
    refinementApplied: boolean;
    explanation: string;
}): LevelCompletionOutcome {
    const strategyScore = Number.isFinite(input.strategyScore)
        ? Math.max(0, Math.min(10, input.strategyScore))
        : 0;
    const outputScore = Number.isFinite(input.outputScore)
        ? Math.max(0, Math.min(10, input.outputScore))
        : 0;
    const passed = strategyScore >= PASSING_STRATEGY_SCORE;
    return {
        passed,
        strategyScore,
        outputScore,
        refinementApplied: passed && input.refinementApplied,
        reason: passed ? 'strategy_passed' : 'strategy_failed',
        explanation: input.explanation,
    };
}
