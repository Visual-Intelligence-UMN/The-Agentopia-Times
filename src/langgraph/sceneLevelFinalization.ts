import type Phaser from 'phaser';

import type { LevelConfig, WorkflowType } from '../game/config/types';
import { createLevelCompletionOutcome } from '../game/domain/levelCompletionPolicy';
import { buildLevelRunConfiguration } from '../game/domain/levelRunEvaluation';
import { createFinalizationProgressHUD } from '../game/utils/finalizationProgressHUD';
import { recorder } from '../game/utils/recorder';
import { finalizeLevelOutput } from './finalizeLevelRun';
import { getDatasetConfig } from '../game/config';
import { getGameConfig } from '../game/config';
import { getLatestMASTrace, recordMASStage } from './masTrace';
import { createOutputVerification } from './outputVerifier';
import {
    judgeStrategyWithLLM,
    refineOutputWithLLM,
} from './qualityPipelineLLM';
import {
    createScoreUI,
    startHTMLConstructor,
    startJudges,
    startScoreComputer,
} from './workflowUtils';

interface AgentSnapshotSource {
    getName(): string;
    getBias(): string;
}

interface StageZoneSnapshot {
    agents: AgentSnapshotSource[];
}

interface SceneLevelFinalizationInput {
    scene: Phaser.Scene & Record<string, any>;
    level: LevelConfig;
    datasetId: string;
    workflow: WorkflowType[];
    dataMaps: StageZoneSnapshot[][];
    managerId: string | null;
    managerReviewApproved: boolean;
    draftReport: string;
    draftVisualization: string;
    signal?: AbortSignal;
}

export async function finalizeSceneLevelRun(
    input: SceneLevelFinalizationInput,
) {
    const progress = createFinalizationProgressHUD(input.scene);
    let strategyScore: number | undefined;
    let scoresDisplayed = false;
    let refinementFailed = false;
    try {
        const dataset = getDatasetConfig(input.datasetId);
        if (!dataset) {
            throw new Error(
                `Missing dataset configuration for "${input.datasetId}".`,
            );
        }
        const configuration = buildLevelRunConfiguration({
            level: input.level,
            datasetId: input.datasetId,
            workflow: input.workflow,
            dataMaps: input.dataMaps,
            managerId: input.managerId,
            managerReviewApproved: input.managerReviewApproved,
        });
        const originalTrace = getLatestMASTrace();

        const result = await finalizeLevelOutput(
            {
                strategyInput: {
                    level: {
                        id: input.level.id,
                        risk: input.level.mas.agenticRisk,
                        calibrationTarget: input.level.mas.calibrationTarget,
                        scenarioPrompt: input.level.mas.scenarioPrompt,
                    },
                    configuration,
                    trace: originalTrace?.stages ?? [],
                    draftReport: input.draftReport,
                    draftVisualization: input.draftVisualization,
                },
                qualityInput: {
                    dataset,
                    rubrics: getGameConfig().mas.judge.scoringRubrics,
                },
            },
            {
                signal: input.signal,
                judgeStrategy: judgeStrategyWithLLM,
                refineOutput: refineOutputWithLLM,
                gradeOutput: async (output, signal) => {
                    const chartCode =
                        typeof output.visualizationSpec === 'string'
                            ? output.visualizationSpec
                            : JSON.stringify(output.visualizationSpec);
                    const judgement = await startJudges(
                        chartCode,
                        output.reportMarkdown,
                        signal,
                    );
                    return {
                        ...startScoreComputer(judgement),
                        judgement,
                    };
                },
                onEvent: (type, data) => {
                    if (type === 'strategy_judgement_completed') {
                        strategyScore = (data as { score: number }).score;
                        createScoreUI(input.scene, 600, 20, null, 'Pending', 'Pending', [], [], strategyScore);
                    }
                    if (type === 'quality_refinement_failed') refinementFailed = true;
                    progress.handleEvent(type);
                    recorder.recordEvent({ type, data });
                    if (type.endsWith('_completed') || type === 'quality_refinement_failed') {
                        recordMASStage({
                            stageIndex: input.workflow.length,
                            workflow: type,
                            input: null,
                            output: data,
                        });
                    }
                },
            },
        );

        const scoreData = result.scoreData;
        // Publish completed scores before HTML rendering, which may fail independently.
        createScoreUI(
            input.scene, 600, 20, result.outputScore,
            scoreData.writing_score, scoreData.coding_score,
            scoreData.writing_reasons, scoreData.coding_reasons,
            result.strategy.score, 'Pending',
            refinementFailed ? 'Quality enhancement failed. Scores reflect the original workflow output.' : '',
        );
        scoresDisplayed = true;
        const chartCode =
            typeof result.finalVisualization === 'string'
                ? result.finalVisualization
                : JSON.stringify(result.finalVisualization);
        progress.handleEvent('final_report_publishing_started');
        recorder.recordEvent({ type: 'final_report_publishing_started' });
        const verificationId = createOutputVerification(input.scene, 1).stage(
            result.finalReport,
        );
        await startHTMLConstructor(
            scoreData.judgement.comments,
            scoreData.judgement.writingComments,
            scoreData.judgement.highlightedText,
            'Report',
            'final',
            input.workflow.length,
            undefined,
            chartCode,
            verificationId,
        );
        const completion = createLevelCompletionOutcome({
            strategyScore: result.strategy.score,
            outputScore: result.outputScore,
            refinementApplied: result.refinement.applied,
            explanation: result.strategy.explanation,
        });
        recorder.recordEvent({
            type: 'final_report_published',
            strategyScore: completion.strategyScore,
            outputScore: completion.outputScore,
            refinementApplied: completion.refinementApplied,
            passed: completion.passed,
        });

        progress.complete();
        return { ...result, completion, scoreData, chartCode };
    } catch (error) {
        if (!input.signal?.aborted && strategyScore !== undefined && !scoresDisplayed) {
            createScoreUI(input.scene, 600, 20, null, 'Unavailable', 'Unavailable', [], [], strategyScore, 'Unavailable', 'Output scoring failed. Your completed Strategy score is preserved. Reset to retry.');
        }
        progress.fail();
        throw error;
    }
}
