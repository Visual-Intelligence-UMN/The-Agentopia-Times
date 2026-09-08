import type { GoldOutput } from '../game/config/goldOutputs.ts';
import {
    inspectRiskConfiguration,
    type LevelRunConfiguration,
} from '../game/domain/levelCompletionPolicy.ts';
import type {
    QualityEditorInput,
    QualityEditorResult,
} from './qualityEditor.ts';
import type {
    StrategyJudgeInput,
    StrategyJudgeResult,
} from './strategyJudge.ts';

export const PASSING_STRATEGY_SCORE = 8;
const MAX_UNSAFE_STRATEGY_SCORE = PASSING_STRATEGY_SCORE - 1;

export interface LevelFinalizationInput {
    strategyInput: StrategyJudgeInput;
    qualityInput: {
        dataset: {
            id: string;
            description: string;
            researchQuestion: string;
            groundTruth: string;
            neutralStatistics: string;
            goldOutput: GoldOutput;
        };
        rubrics: string[];
    };
}

export interface LevelFinalizationDependencies<ScoreData> {
    judgeStrategy: (
        input: StrategyJudgeInput,
        signal?: AbortSignal,
    ) => Promise<StrategyJudgeResult>;
    refineOutput: (
        input: QualityEditorInput,
        signal?: AbortSignal,
    ) => Promise<QualityEditorResult>;
    gradeOutput: (
        output: {
            reportMarkdown: string;
            visualizationSpec: string | object;
        },
        signal?: AbortSignal,
    ) => Promise<ScoreData>;
    onEvent?: (type: string, data: unknown) => void;
    signal?: AbortSignal;
}

export interface LevelFinalizationResult<ScoreData> {
    draftReport: string;
    finalReport: string;
    draftVisualization: string;
    finalVisualization: string | object;
    strategy: StrategyJudgeResult;
    refinement: {
        applied: boolean;
        goldOutputVersion: string | null;
    };
    scoreData: ScoreData;
    outputScore: number;
    passed: boolean;
}

function parseOverallScore(scoreData: unknown) {
    if (!scoreData || typeof scoreData !== 'object') return 0;
    const value = (scoreData as { overall_score?: unknown }).overall_score;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function applyStructuralStrategyGate(
    judgement: StrategyJudgeResult,
    configuration: LevelRunConfiguration,
): StrategyJudgeResult {
    const verdict = inspectRiskConfiguration(configuration);
    if (verdict.correct) return judgement;

    const ghostStageIndex = configuration.stages.findIndex((stage) =>
        stage.agents.some((agent) => agent.ghost),
    );
    return {
        score: Math.min(judgement.score, MAX_UNSAFE_STRATEGY_SCORE),
        explanation: `${verdict.explanation} The model judge's higher assessment was rejected by this structural safety rule.`,
        evidence: [
            {
                stageIndex: Math.max(0, ghostStageIndex),
                observation: `Deterministic configuration check failed: ${verdict.explanation}`,
            },
        ],
    };
}

export async function finalizeLevelOutput<ScoreData>(
    input: LevelFinalizationInput,
    dependencies: LevelFinalizationDependencies<ScoreData>,
): Promise<LevelFinalizationResult<ScoreData>> {
    const { signal, onEvent } = dependencies;
    signal?.throwIfAborted();
    onEvent?.('strategy_judgement_started', {
        level: input.strategyInput.level.id,
    });
    const judgedStrategy = await dependencies.judgeStrategy(
        input.strategyInput,
        signal,
    );
    signal?.throwIfAborted();
    const strategy = applyStructuralStrategyGate(
        judgedStrategy,
        input.strategyInput.configuration as LevelRunConfiguration,
    );
    onEvent?.('strategy_judgement_completed', strategy);

    const shouldRefine = strategy.score >= PASSING_STRATEGY_SCORE;
    let refinementApplied = false;
    let finalReport = input.strategyInput.draftReport;
    let finalVisualization: string | object =
        input.strategyInput.draftVisualization;
    if (shouldRefine) {
        const qualityEditorInput: QualityEditorInput = {
            ...input.qualityInput,
            draftReport: input.strategyInput.draftReport,
            draftVisualization: input.strategyInput.draftVisualization,
        };
        onEvent?.('quality_refinement_started', {
            dataset: input.qualityInput.dataset.id,
            goldOutputVersion: input.qualityInput.dataset.goldOutput.version,
        });
        try {
            const refined = await dependencies.refineOutput(qualityEditorInput, signal);
            signal?.throwIfAborted();
            finalReport = refined.reportMarkdown;
            finalVisualization = refined.visualizationSpec;
            refinementApplied = true;
        } catch (error) {
            signal?.throwIfAborted();
            if (error instanceof Error && error.name === 'AbortError') throw error;
            // Enhancement is optional. Grade the actual workflow artifacts if it fails.
            onEvent?.('quality_refinement_failed', {
                reason: error instanceof Error ? error.message : String(error),
                fallback: 'original_drafts',
            });
        }
        if (refinementApplied) {
            onEvent?.('quality_refinement_completed', {
                reportMarkdown: finalReport,
                visualizationSpec: finalVisualization,
            });
        }
    } else {
        onEvent?.('quality_refinement_skipped', {
            strategyScore: strategy.score,
            requiredScore: PASSING_STRATEGY_SCORE,
        });
    }

    onEvent?.('output_scoring_started', {
        dataset: input.qualityInput.dataset.id,
        refinementApplied,
    });
    const scoreData = await dependencies.gradeOutput(
        {
            reportMarkdown: finalReport,
            visualizationSpec: finalVisualization,
        },
        signal,
    );
    signal?.throwIfAborted();
    onEvent?.('output_scoring_completed', scoreData);

    return {
        draftReport: input.strategyInput.draftReport,
        finalReport,
        draftVisualization: input.strategyInput.draftVisualization,
        finalVisualization,
        strategy,
        refinement: {
            applied: refinementApplied,
            goldOutputVersion: refinementApplied
                ? input.qualityInput.dataset.goldOutput.version
                : null,
        },
        scoreData,
        outputScore: parseOverallScore(scoreData),
        passed: shouldRefine,
    };
}
