import { getGameConfig, getLevelConfig } from '../config';
import type { LevelConfig } from '../config';

export function getRequiredLevelConfig(levelId: string): LevelConfig {
    const levelConfig = getLevelConfig(levelId);

    if (!levelConfig) {
        throw new Error(`Missing level configuration for "${levelId}".`);
    }

    return levelConfig;
}

export function initializeLevelRegistry(scene: any, levelConfig: LevelConfig) {
    if (!levelConfig.mas) {
        throw new Error(
            `Level configuration "${levelConfig.id}" is missing its MAS risk definition.`,
        );
    }

    scene.registry.set('currentLevel', levelConfig.id);
    scene.registry.set('agenticRisk', levelConfig.mas.agenticRisk);
    scene.registry.set('levelMASPrompt', levelConfig.mas.scenarioPrompt);
    scene.registry.set('biasTypePool', [...levelConfig.hallucination.biasPool]);
    scene.registry.set('isWorkflowRunning', false);
    scene.registry.set('currentPattern', '');
    scene.registry.set('currentDataset', levelConfig.initialDataset);
    scene.registry.set('workflowConfig', [...levelConfig.workflow]);
}

export function getNextLevelSceneKey(activeLevelId: string): string {
    const levels = getGameConfig().mechanics.levels;
    if (!levels.length) {
        return 'level1';
    }

    const normalizedActiveLevelId = activeLevelId.toLowerCase();
    const currentLevelIndex = levels.findIndex(
        (level) =>
            level.sceneKey.toLowerCase() === normalizedActiveLevelId ||
            level.id.toLowerCase() === normalizedActiveLevelId,
    );

    if (currentLevelIndex < 0) {
        const fallback =
            levels.find((level) => level.sceneKey) ?? levels[0];
        return fallback?.sceneKey ?? 'level1';
    }

    const nextLevel =
        levels[(currentLevelIndex + 1) % levels.length] ?? levels[0];
    return nextLevel?.sceneKey ?? 'level1';
}
