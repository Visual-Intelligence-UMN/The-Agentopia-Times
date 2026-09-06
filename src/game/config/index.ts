import { newsroomConfig } from './newsroom';
import type { DatasetConfig, GameThemeConfig, LevelConfig } from './types';

const configs: Record<string, GameThemeConfig> = {
    [newsroomConfig.id]: newsroomConfig,
};

const activeThemeId =
    import.meta.env.VITE_GAME_THEME && configs[import.meta.env.VITE_GAME_THEME]
        ? import.meta.env.VITE_GAME_THEME
        : newsroomConfig.id;

export function getGameConfig(
    themeId: string = activeThemeId,
): GameThemeConfig {
    return configs[themeId] ?? newsroomConfig;
}

export function getLevelConfig(
    levelId: string,
    themeId?: string,
): LevelConfig | undefined {
    return getGameConfig(themeId).mechanics.levels.find(
        (level) => level.id === levelId || level.sceneKey === levelId,
    );
}

export function getDefaultLevelConfig(themeId?: string): LevelConfig {
    const config = getGameConfig(themeId);
    return (
        getLevelConfig(config.defaults.startLevel, themeId) ??
        config.mechanics.levels[0]
    );
}

export function getDatasetConfig(
    datasetId: string,
    themeId?: string,
): DatasetConfig | undefined {
    return getGameConfig(themeId).mas.datasets[datasetId];
}

export { newsroomConfig };
export type {
    AgenticRisk,
    DatasetConfig,
    GameThemeConfig,
    LevelConfig,
    LevelMASConfig,
    WorkflowType,
} from './types';
