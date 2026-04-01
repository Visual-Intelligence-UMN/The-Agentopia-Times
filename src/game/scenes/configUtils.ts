import { getLevelConfig } from '../config';
import type { LevelConfig } from '../config';

export function getRequiredLevelConfig(levelId: string): LevelConfig {
    const levelConfig = getLevelConfig(levelId);

    if (!levelConfig) {
        throw new Error(`Missing level configuration for "${levelId}".`);
    }

    return levelConfig;
}

export function initializeLevelRegistry(scene: any, levelConfig: LevelConfig) {
    scene.registry.set('biasTypePool', [...levelConfig.hallucination.biasPool]);
    scene.registry.set('isWorkflowRunning', false);
    scene.registry.set('currentPattern', '');
    scene.registry.set('currentDataset', levelConfig.initialDataset);
    scene.registry.set('workflowConfig', [...levelConfig.workflow]);
}
