import { getDatasetConfig, getGameConfig, getLevelConfig } from '../game/config';
import { buildLevelAgentPrompt } from '../game/config/agenticRiskLevels';
import type { DatasetConfig, LevelConfig } from '../game/config';
import { PRODUCTION_WORKING_PREMISE } from '../game/config/productionAgentPolicy.ts';

const FALLBACK_HALLUCINATION_PROMPT = PRODUCTION_WORKING_PREMISE;

function getDatasetOrThrow(datasetId: string): DatasetConfig {
    const datasetConfig = getDatasetConfig(datasetId);

    if (!datasetConfig) {
        throw new Error(`Missing dataset configuration for "${datasetId}".`);
    }

    return datasetConfig;
}

function getLevelOrThrow(levelId: string): LevelConfig {
    const levelConfig = getLevelConfig(levelId);

    if (!levelConfig) {
        throw new Error(`Missing level configuration for "${levelId}".`);
    }

    return levelConfig;
}

export function getMASModels() {
    return getGameConfig().mas.model;
}

export function getDatasetConfigForScene(scene: any): DatasetConfig {
    const datasetId =
        scene?.registry?.get('currentDataset') ?? getGameConfig().defaults.dataset;

    return getDatasetOrThrow(datasetId);
}

export function getLevelConfigForScene(scene: any): LevelConfig {
    const levelId =
        scene?.registry?.get('currentLevel') ??
        scene?.scene?.key ??
        getGameConfig().defaults.startLevel;

    return getLevelOrThrow(levelId);
}

export function getDatasetGroundTruth(datasetId: string): string {
    return getDatasetOrThrow(datasetId).groundTruth;
}

export function getDatasetGoldOutput(datasetId: string) {
    return getDatasetOrThrow(datasetId).goldOutput;
}

export function getHallucinationInstruction(
    hallucinationType?: string,
    scene?: any,
): string {
    const activeLevel = scene ? getLevelConfigForScene(scene) : undefined;
    const matchedLevel =
        activeLevel?.hallucination.biasPool.includes(hallucinationType ?? '')
            ? activeLevel
            : getGameConfig().mechanics.levels.find(
                  (level) => level.hallucination.type === hallucinationType,
              );

    return (
        matchedLevel?.hallucination.injectedPrompt ??
        FALLBACK_HALLUCINATION_PROMPT
    );
}

export function getAgentMASPrompt(
    scene: any,
    isProblematic: boolean,
    _hallucinationType?: string,
): string {
    const level = getLevelConfigForScene(scene);
    return buildLevelAgentPrompt(level, isProblematic);
}

export function getHallucinationStats(
    datasetId: string,
    hallucinationType?: string,
): string {
    const datasetConfig = getDatasetOrThrow(datasetId);

    if (!hallucinationType) {
        return datasetConfig.neutralStatistics;
    }

    return (
        datasetConfig.hallucinationStatistics[hallucinationType] ??
        datasetConfig.neutralStatistics
    );
}
