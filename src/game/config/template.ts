import type { GameThemeConfig } from './types';

export const gameThemeTemplate: GameThemeConfig = {
    id: 'replace-me',
    title: 'Replace Me',
    assets: {
        bitmapFonts: [],
        spritesheets: [],
        images: [],
        atlases: [],
        tilemaps: [],
    },
    mechanics: {
        config_options: ['workflow', 'dataset', 'level'],
        levels: [
            {
                id: 'level1',
                sceneKey: 'level1',
                level_name: 'Level 1',
                uiTitle: 'Level 1',
                uiInfo: 'Explain the level objective here.',
                required_score: 8,
                tilemapKey: 'replace_tilemap_key',
                workflow: ['voting', 'sequential', 'single_agent'],
                config_options: ['workflow', 'dataset'],
                initialDataset: 'dataset1',
                availableDatasets: ['dataset1'],
                hallucination: {
                    type: 'factual',
                    name: 'replace hallucination label',
                    injectedPrompt: 'Describe the biased behavior here.',
                    biasPool: ['factual'],
                    hallucinatedAgents: 1,
                },
                mas: {
                    agenticRisk: 'error_propagation',
                    calibrationTarget:
                        'Describe the conditional MAS knowledge this level examines.',
                    scenarioPrompt:
                        'Describe the MAS conditions that instantiate the risk.',
                },
            },
        ],
    },
    mas: {
        model: {
            chat: 'gpt-4o',
            judge: 'gpt-4o-mini',
        },
        agents: {
            voting: {
                title_discussion: {
                    agent_persona: '',
                    agent_instructions: '',
                },
                report_writing: {
                    agent_persona: '',
                    agent_instructions: '',
                },
                visualization_creation: {
                    agent_persona: '',
                    agent_instructions: '',
                },
            },
            sequential: {
                title_discussion: [],
                report_writing: [],
                visualization_creation: [],
            },
            single_agent: {
                title_discussion: {
                    agent_persona: '',
                    agent_instructions: '',
                },
                report_writing: {
                    agent_persona: '',
                    agent_instructions: '',
                },
                visualization_creation: {
                    agent_persona: '',
                    agent_instructions: '',
                },
            },
        },
        datasets: {
            dataset1: {
                id: 'dataset1',
                label: 'Replace Dataset',
                csvPath: './data/replace.csv',
                description: 'Describe the dataset for the player and agents.',
                groundTruth: 'Provide the canonical interpretation here.',
                researchQuestion: 'Provide the main question for agents here.',
                neutralStatistics: 'Provide the unbiased stats summary here.',
                hallucinationStatistics: {
                    factual: 'Provide biased stats or wording here.',
                },
            },
        },
        judge: {
            scoringRubrics: ['replace rubric'],
            defaultGroundTruthDataset: 'dataset1',
        },
    },
    defaults: {
        startScene: 'level1',
        startLevel: 'level1',
        dataset: 'dataset1',
    },
};
