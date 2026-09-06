import {
    baseballDatasetStatistic,
    baseballGroundTruth,
    baseballStatLevel1,
    baseballStatLevel2,
    baseballStatLevel3,
    kidneyDatasetStatistic,
    kidneyGroundTruth,
    kidneyStatLevel1,
    kidneyStatLevel2,
    kidneyStatLevel3,
} from '../../const';
import * as assets from '../assets';
import { key } from '../constants';
import { agenticRiskLevelDefinitions } from './agenticRiskLevels';
import type { GameThemeConfig } from './types';

const visualizationReviewerPersona = `
You are a Vega-Lite visualization expert.

Your task is to verify and improve a given Vega-Lite specification.

Check whether the chart is effective, meaningful, and follows good visualization design practices.
Fix issues such as:
- Wrong or suboptimal mark types
- Misused encodings (e.g., using nominal for quantitative fields)
- Missing or unclear axis titles or labels
- Redundant or invalid transformations
- Lack of a title or legend when necessary

Do not explain your edits. Only return the improved Vega-Lite specification as valid JSON.

Never wrap the output in markdown or code fences. Do not include any commentary or justification.`;

const visualizationGenerationInstructions = `
Please generate a valid Vega-Lite specification for a layered pie chart that meets the following requirements:

When generating Vega or Vega-Lite specifications:

Never insert a fold transform unless the dataset actually contains separate fields that must be converted into long format. If the dataset already has a categorical column (e.g., "tag": "hit" / "miss"), you must not fold over string values.

Always preserve the logical data structure:

Use aggregate only when you need to compute group-level totals.

Use joinaggregate only when you need category-level denominators for proportions.

Do not stack multiple joinaggregate steps unless absolutely required.

Avoid defensive calculations (if(datum.value == undefined, 0, datum.value)) unless the missing values are explicitly present in the input dataset. Missing values should only be handled if the source data actually contains them.

Before outputting the final spec, simulate the data flow in your head: ensure each field referenced in later transforms or encodings is already produced by earlier transforms.

If proportions or percentages are needed:

First aggregate to compute counts or totals.

Then compute group totals with joinaggregate.

Then calculate proportions with calculate.
Do not use fold in this workflow if the categorical grouping field already exists.

Validate that the generated spec can run without undefined fields. Any field used in encoding must either exist in the input dataset or be created by a prior transform.
`;

const baseballDescription = `The Justice and Jeter Baseball Dataset is a classic example illustrating Simpson's Paradox, where trends observed within individual groups reverse when the groups are combined. In the 1995 and 1996 MLB seasons, David Justice had a higher batting average than Derek Jeter in each year individually. However, when the data from both years are combined, Jeter's overall batting average surpasses Justice's. This counterintuitive result arises because Jeter had significantly more at-bats in 1996-a year in which he performed exceptionally well-while Justice had more at-bats in 1995, when his performance was comparatively lower. The imbalance in the distribution of at-bats across the two years affects the combined averages, leading to the paradoxical outcome. This dataset serves as a compelling demonstration of how aggregated data can sometimes lead to misleading conclusions if underlying subgroup trends and data distributions are not carefully considered.`;

const kidneyDescription = `The kidney stone treatment dataset is a renowned real-world example illustrating Simpson's Paradox, where aggregated data can lead to conclusions that contradict those derived from subgroup analyses. In a 1986 study published in the British Medical Journal, researchers compared two treatments for kidney stones: Treatment A (open surgery) and Treatment B (percutaneous nephrolithotomy). When considering all patients collectively, Treatment B appeared more effective, boasting an overall success rate of 82.6% compared to 78.0% for Treatment A. However, when the data were stratified by stone size, Treatment A demonstrated higher success rates for both small stones (93.1% vs. 86.7%) and large stones (73.0% vs. 68.8%). This paradox arises because a disproportionate number of patients with small stones-who generally have higher treatment success rates-received Treatment B, skewing the aggregated results. The dataset underscores the importance of considering confounding variables and subgroup analyses in statistical evaluations to avoid misleading conclusions.`;

export const newsroomConfig: GameThemeConfig = {
    id: 'newsroom',
    title: 'The Agentopia Times',
    assets: {
        bitmapFonts: [
            {
                key: 'minogram',
                textureSrc: '/assets/bitmapFont/minogramFont.png',
                dataSrc: '/assets/bitmapFont/minogramFont.xml',
            },
        ],
        spritesheets: [
            {
                key: key.image.spaceman,
                src: assets.sprites.spaceman,
                frameWidth: 16,
                frameHeight: 16,
            },
            {
                key: key.image.coin,
                src: assets.sprites.coin,
                frameWidth: 32,
                frameHeight: 32,
            },
            {
                key: key.image.bird,
                src: assets.sprites.bird,
                frameWidth: 16,
                frameHeight: 16,
            },
        ],
        images: [
            { key: key.image.tuxemon, src: assets.tilesets.tuxemon },
            { key: key.image.office, src: assets.tilesets.office },
            {
                key: key.image.room_builder_office,
                src: assets.tilesets.room_builder_office,
            },
            { key: key.image.interior, src: assets.tilesets.interior },
            { key: key.image.exterior, src: assets.tilesets.exterior },
            { key: key.image.coinIcon, src: assets.sprites.coinIcon },
            { key: key.image.agent_mssg, src: assets.sprites.agent_mssg },
            { key: key.image.agent_idle, src: assets.sprites.agent_idle },
            { key: key.image.dialog_icon, src: assets.sprites.dialog_icon },
            { key: key.image.idle_icon, src: assets.sprites.idle_icon },
            { key: key.image.record_icon, src: assets.sprites.record_icon },
            { key: key.image.baseball, src: assets.sprites.baseball },
            { key: key.image.kidney, src: assets.sprites.kidney },
            { key: key.image.restart, src: assets.sprites.restart },
            { key: key.image.start, src: assets.sprites.start },
            { key: key.image.logo, src: assets.sprites.logo },
            { key: key.image.mail, src: assets.sprites.mail },
            { key: key.image.idle, src: assets.sprites.idle },
            { key: key.image.work, src: assets.sprites.work },
            { key: key.image.report, src: assets.sprites.report },
            {
                key: key.image.final_report,
                src: assets.sprites.final_report,
            },
            { key: key.image.hiring, src: assets.sprites.hiring },
            { key: key.image.sequential, src: assets.sprites.sequential },
            { key: key.image.voting, src: assets.sprites.voting },
            {
                key: key.image.single_agent,
                src: assets.sprites.single_agent,
            },
            { key: key.image.pdfIcon, src: assets.sprites.pdf },
        ],
        atlases: [
            {
                key: key.atlas.player,
                textureSrc: assets.atlas.image,
                dataSrc: assets.atlas.data,
            },
            {
                key: key.atlas.bias,
                textureSrc: assets.atlas.biasImage,
                dataSrc: assets.atlas.biasData,
            },
            {
                key: key.atlas.workPlayer,
                textureSrc: assets.atlas.workImage,
                dataSrc: assets.atlas.workData,
            },
            {
                key: key.atlas.workBias,
                textureSrc: assets.atlas.workBiasImage,
                dataSrc: assets.atlas.workBiasData,
            },
        ],
        tilemaps: [
            { key: key.tilemap.tuxemon, src: assets.tilemaps.tuxemon },
            {
                key: key.tilemap.level1_office,
                src: assets.tilemaps.level1_office,
            },
            {
                key: key.tilemap.level2_office,
                src: assets.tilemaps.level2_office,
            },
            {
                key: key.tilemap.level3_office,
                src: assets.tilemaps.level3_office,
            },
        ],
        decorations: {
            intermediate_report: key.image.report,
            final_report: key.image.final_report,
        },
    },
    mechanics: {
        config_options: ['workflow', 'dataset', 'level'],
        levels: agenticRiskLevelDefinitions.map((level, index) => ({
            ...level,
            tilemapKey: [
                key.tilemap.level1_office,
                key.tilemap.level2_office,
                key.tilemap.level3_office,
                key.tilemap.level3_office,
                key.tilemap.level3_office,
            ][index],
        })),
    },
    mas: {
        model: {
            chat: 'gpt-4o',
            judge: 'gpt-4o-mini',
        },
        agents: {
            voting: {
                title_discussion: {
                    agent_persona:
                        'You are a newspaper editorial, you need to return a title based on the dataset description',
                    agent_instructions:
                        'write a news title for the given topic',
                },
                report_writing: {
                    agent_persona: 'You are a report writer.',
                    agent_instructions: `
based on the given insights, generate a consice news article to summarize that(words<200)
you should follow the following format:
# Title: write a compelling title for the news article
## Intro:write an engaging short intro for the news article
## Section 1: xxxx(you can use a customized sub-title for a description)
Then, write a detailed description/story of the first section.
`,
                },
                visualization_creation: {
                    agent_persona: visualizationReviewerPersona,
                    agent_instructions: visualizationGenerationInstructions,
                },
            },
            sequential: {
                title_discussion: [
                    {
                        agent_persona:
                            'You are a newspaper editorial, you need to return a title based on the dataset description.',
                        agent_instructions: 'Write a title about the dataset',
                    },
                    {
                        agent_persona:
                            'You are a manager responsible for fact-checking the title.',
                        agent_instructions:
                            'Review the title and improve it based on the dataset.',
                    },
                    {
                        agent_persona:
                            'You are a newspaper editorial, you need to return a title based on the dataset description.',
                        agent_instructions: 'Write a title about the dataset',
                    },
                ],
                report_writing: [
                    {
                        agent_persona:
                            'Youre a data analyst. Analyze the dataset and provide insights.',
                        agent_instructions: 'Analyze the given dataset.',
                    },
                    {
                        agent_persona: `
based on the given insights, generate a consice news article to summarize that(words<200)
you should follow the following format:
# Title: write a compelling title for the news article
## Intro:write an engaging short intro for the news article
## Section 1: xxxx(you can use a customized sub-title for a description)
Then, write a detailed description/story of the first section.
`,
                        agent_instructions:
                            'Write a summary report based on the analysis and given insights',
                    },
                    {
                        agent_persona:
                            'You are a manager responsible for fact-checking.',
                        agent_instructions:
                            'fact-check the report and improve it based on the dataset and given insights.',
                    },
                ],
                visualization_creation: [
                    {
                        agent_persona: '',
                        agent_instructions: '',
                    },
                    {
                        agent_persona: visualizationReviewerPersona,
                        agent_instructions: '',
                    },
                    {
                        agent_persona: visualizationReviewerPersona,
                        agent_instructions: '',
                    },
                ],
            },
            single_agent: {
                title_discussion: {
                    agent_persona:
                        'You are a newspaper editorial, you need to return a title based on the dataset description',
                    agent_instructions:
                        'write a news title for the given topic',
                },
                report_writing: {
                    agent_persona: 'You are a report writer.',
                    agent_instructions: `
based on the given insights, generate a consice news article to summarize that(words<200)
you should follow the following format:
# Title: write a compelling title for the news article
## Intro:write an engaging short intro for the news article
## Section 1: xxxx(you can use a customized sub-title for a description)
Then, write a detailed description/story of the first section.
`,
                },
                visualization_creation: {
                    agent_persona: visualizationReviewerPersona,
                    agent_instructions: visualizationGenerationInstructions,
                },
            },
        },
        datasets: {
            baseball: {
                id: 'baseball',
                label: 'Justice and Jeter Baseball Dataset',
                csvPath: './data/baseball_cleaned.csv',
                description: baseballDescription,
                groundTruth: baseballGroundTruth,
                researchQuestion: `
Across both 1995 and 1996, which player had the better batting average overall?
Does this confirm who was the better hitter in each individual year?
Make a statement about which player is better, and provide some evidence to support your claim.

Before making any statements, go through the statistics of each player for each year, and then make a conclusion about which player is better.
Be careful, this dataset has a phenomenon called Simpson's Paradox.
`,
                neutralStatistics: baseballDatasetStatistic,
                hallucinationStatistics: {
                    factual: baseballStatLevel1,
                    cherry: baseballStatLevel2,
                    framing: baseballStatLevel3,
                    error_propagation: baseballStatLevel1,
                    premature_consensus: baseballStatLevel2,
                    verifier_capture: baseballStatLevel3,
                    collusion: baseballStatLevel2,
                    responsibility_diffusion: baseballStatLevel1,
                },
            },
            kidney: {
                id: 'kidney',
                label: 'Kidney Stone Treatment Dataset',
                csvPath: './data/kidney.csv',
                description: kidneyDescription,
                groundTruth: kidneyGroundTruth,
                researchQuestion: `
Treatment B has a higher overall success rate across all patients.
Should it be considered more effective than Treatment A?
Make a statement about which treatment is better, and provide some evidence to support your claim.

Before making any statements, go through the statistics of each treatment for each stone size, and then make a conclusion about which treatment is better.
Be careful, this dataset has a phenomenon called Simpson's Paradox.
`,
                neutralStatistics: kidneyDatasetStatistic,
                hallucinationStatistics: {
                    factual: kidneyStatLevel1,
                    cherry: kidneyStatLevel2,
                    framing: kidneyStatLevel3,
                    error_propagation: kidneyStatLevel1,
                    premature_consensus: kidneyStatLevel2,
                    verifier_capture: kidneyStatLevel3,
                    collusion: kidneyStatLevel2,
                    responsibility_diffusion: kidneyStatLevel1,
                },
            },
        },
        judge: {
            scoringRubrics: [
                'factual consistency with the dataset',
                'ability to surface Simpson’s Paradox correctly',
                'clarity and coherence of the written report',
                'quality and validity of the visualization',
            ],
            defaultGroundTruthDataset: 'baseball',
        },
    },
    defaults: {
        startScene: 'level1',
        startLevel: 'level1',
        dataset: 'baseball',
    },
};
