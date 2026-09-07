import type { AgenticRisk, WorkflowType } from '../config/types.ts';

export const MAX_CORRECT_STRATEGY_ATTEMPTS = 3;

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
    configurationCorrect: boolean;
    correctStrategyAttempt: number;
    maxCorrectStrategyAttempts: number;
    qualityScore: number;
    requiredQualityScore: number;
    reason:
        | 'wrong_strategy'
        | 'quality_met'
        | 'quality_retry'
        | 'attempt_guarantee';
    explanation: string;
}

const ATTEMPT_STORAGE_KEY = 'agentopia-level-strategy-attempts-v1';

export interface AttemptStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

interface StoredAttempt {
    count: number;
    updatedAt: string;
}

function readAttempts(storage: AttemptStorage): Record<string, StoredAttempt> {
    try {
        const raw = storage.getItem(ATTEMPT_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, StoredAttempt>)
            : {};
    } catch {
        return {};
    }
}

function writeAttempts(
    storage: AttemptStorage,
    attempts: Record<string, StoredAttempt>,
) {
    const recentEntries = Object.entries(attempts)
        .sort(([, left], [, right]) =>
            String(right.updatedAt).localeCompare(String(left.updatedAt)),
        )
        .slice(0, 25);
    try {
        storage.setItem(
            ATTEMPT_STORAGE_KEY,
            JSON.stringify(Object.fromEntries(recentEntries)),
        );
    } catch {
        // Passing still works for the current run when browser storage is unavailable.
    }
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
            if (contaminatedStages.some(({ index }) => index > 1)) {
                return {
                    correct: false,
                    explanation:
                        'The Ghost Agent acts after the Manager review boundary. Move it into title or report production so the independent review can inspect its effect.',
                };
            }
            return {
                correct: true,
                explanation:
                    'The Manager formed a sealed evidence-only assessment and approved the reviewed report.',
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
            if (contaminatedStages.some(({ index }) => index > 1)) {
                return {
                    correct: false,
                    explanation:
                        'The Ghost Agent acts after the accountable review boundary. Keep the central-claim risk within the work reviewed by the Manager.',
                };
            }
            return {
                correct: true,
                explanation:
                    'A named Manager completed the end-to-end accountability check.',
            };
        }
    }
}

export function createLevelConfigurationFingerprint(
    configuration: LevelRunConfiguration,
): string {
    return JSON.stringify({
        levelId: configuration.levelId,
        datasetId: configuration.datasetId,
        risk: configuration.risk,
        managerId: configuration.managerId,
        stages: configuration.stages.map((stage) => ({
            strategy: stage.strategy,
            ghostCount: stage.agents.filter((agent) => agent.ghost).length,
        })),
    });
}

export function evaluateLevelAttempt(input: {
    configuration: LevelRunConfiguration;
    qualityScore: number;
    previousCorrectAttempts: number;
}): LevelCompletionOutcome {
    const verdict = inspectRiskConfiguration(input.configuration);
    const qualityScore = Number.isFinite(input.qualityScore)
        ? input.qualityScore
        : 0;
    const previousCorrectAttempts = Math.max(
        0,
        Math.min(
            MAX_CORRECT_STRATEGY_ATTEMPTS,
            Math.floor(input.previousCorrectAttempts),
        ),
    );

    if (!verdict.correct) {
        return {
            passed: false,
            configurationCorrect: false,
            correctStrategyAttempt: previousCorrectAttempts,
            maxCorrectStrategyAttempts: MAX_CORRECT_STRATEGY_ATTEMPTS,
            qualityScore,
            requiredQualityScore: Math.max(
                0,
                input.configuration.requiredScore,
            ),
            reason: 'wrong_strategy',
            explanation: verdict.explanation,
        };
    }

    const correctStrategyAttempt = Math.min(
        MAX_CORRECT_STRATEGY_ATTEMPTS,
        previousCorrectAttempts + 1,
    );
    const qualityThresholds = [
        Math.max(0, input.configuration.requiredScore),
        Math.max(0, input.configuration.requiredScore - 1),
        0,
    ];
    const requiredQualityScore = qualityThresholds[correctStrategyAttempt - 1];
    const qualityMet = qualityScore >= requiredQualityScore;
    const guaranteed = correctStrategyAttempt === MAX_CORRECT_STRATEGY_ATTEMPTS;

    return {
        passed: qualityMet || guaranteed,
        configurationCorrect: true,
        correctStrategyAttempt,
        maxCorrectStrategyAttempts: MAX_CORRECT_STRATEGY_ATTEMPTS,
        qualityScore,
        requiredQualityScore,
        reason: guaranteed
            ? 'attempt_guarantee'
            : qualityMet
              ? 'quality_met'
              : 'quality_retry',
        explanation: guaranteed
            ? 'The structural intervention is correct; the third completed attempt is protected from model-scoring variance.'
            : qualityMet
              ? verdict.explanation
              : `${verdict.explanation} The strategy is correct, but this generation scored below ${requiredQualityScore.toFixed(1)}.`,
    };
}

/** Record only successfully completed runs using a structurally correct setup. */
export function evaluateAndRecordLevelAttempt(input: {
    configuration: LevelRunConfiguration;
    qualityScore: number;
    storage: AttemptStorage;
}): LevelCompletionOutcome {
    const fingerprint = createLevelConfigurationFingerprint(
        input.configuration,
    );
    const attempts = readAttempts(input.storage);
    const previous = attempts[fingerprint]?.count ?? 0;
    const outcome = evaluateLevelAttempt({
        configuration: input.configuration,
        qualityScore: input.qualityScore,
        previousCorrectAttempts: previous,
    });

    if (outcome.configurationCorrect) {
        attempts[fingerprint] = {
            count: outcome.correctStrategyAttempt,
            updatedAt: new Date().toISOString(),
        };
        writeAttempts(input.storage, attempts);
    }

    return outcome;
}
