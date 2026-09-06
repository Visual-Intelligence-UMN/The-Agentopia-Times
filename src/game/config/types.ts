export type WorkflowType = 'voting' | 'sequential' | 'single_agent';

export type HallucinationType = 'factual' | 'cherry' | 'framing' | string;

export type AgenticRisk =
    | 'error_propagation'
    | 'premature_consensus'
    | 'verifier_capture'
    | 'collusion'
    | 'responsibility_diffusion';

export type AssetSource = string | Record<string, unknown>;

export interface BitmapFontAssetConfig {
    key: string;
    textureSrc: string;
    dataSrc: AssetSource;
}

export interface ImageAssetConfig {
    key: string;
    src: AssetSource;
}

export interface SpritesheetAssetConfig extends ImageAssetConfig {
    frameWidth: number;
    frameHeight: number;
}

export interface AtlasAssetConfig {
    key: string;
    textureSrc: AssetSource;
    dataSrc: AssetSource;
}

export interface TilemapAssetConfig {
    key: string;
    src: AssetSource;
}

export interface ThemeAssetsConfig {
    bitmapFonts: BitmapFontAssetConfig[];
    images: ImageAssetConfig[];
    spritesheets: SpritesheetAssetConfig[];
    atlases: AtlasAssetConfig[];
    tilemaps: TilemapAssetConfig[];
    decorations?: Record<string, string>;
}

export interface WorkflowAgentPrompt {
    agent_persona: string;
    agent_instructions: string;
}

export interface WorkflowStagePromptConfig {
    title_discussion: WorkflowAgentPrompt | WorkflowAgentPrompt[];
    report_writing: WorkflowAgentPrompt | WorkflowAgentPrompt[];
    visualization_creation: WorkflowAgentPrompt | WorkflowAgentPrompt[];
}

export interface DatasetConfig {
    id: string;
    label: string;
    csvPath: string;
    description: string;
    groundTruth: string;
    researchQuestion: string;
    neutralStatistics: string;
    hallucinationStatistics: Record<string, string>;
}

export interface JudgeConfig {
    scoringRubrics: string[];
    defaultGroundTruthDataset: string;
}

export interface MASConfig {
    model: {
        chat: string;
        judge: string;
    };
    agents: Record<WorkflowType, WorkflowStagePromptConfig>;
    datasets: Record<string, DatasetConfig>;
    judge: JudgeConfig;
}

export interface LevelHallucinationConfig {
    type: HallucinationType;
    name: string;
    injectedPrompt: string;
    biasPool: HallucinationType[];
    hallucinatedAgents: number;
}

export interface LevelMASConfig {
    agenticRisk: AgenticRisk;
    calibrationTarget: string;
    scenarioPrompt: string;
}

export interface LevelConfig {
    id: string;
    sceneKey: string;
    level_name: string;
    uiTitle: string;
    uiInfo: string;
    required_score: number;
    tilemapKey: string;
    workflow: WorkflowType[];
    config_options: string[];
    initialDataset: string;
    availableDatasets: string[];
    hallucination: LevelHallucinationConfig;
    mas: LevelMASConfig;
}

export interface MechanicsConfig {
    levels: LevelConfig[];
    config_options: string[];
}

export interface GameThemeConfig {
    id: string;
    title: string;
    assets: ThemeAssetsConfig;
    mechanics: MechanicsConfig;
    mas: MASConfig;
    defaults: {
        startScene: string;
        startLevel: string;
        dataset: string;
    };
}
