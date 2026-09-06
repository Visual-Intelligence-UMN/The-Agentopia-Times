import type { AgenticRisk, LevelConfig } from './types';

export interface AgenticRiskLevelDefinition
    extends Omit<LevelConfig, 'tilemapKey'> {
    mas: LevelConfig['mas'] & { agenticRisk: AgenticRisk };
}

const sharedLevelConfig: Pick<
    AgenticRiskLevelDefinition,
    | 'required_score'
    | 'workflow'
    | 'config_options'
    | 'initialDataset'
    | 'availableDatasets'
    | 'semanticActions'
> = {
    required_score: 8,
    workflow: ['voting', 'sequential', 'single_agent'],
    config_options: ['workflow', 'dataset'],
    initialDataset: 'baseball',
    availableDatasets: ['baseball', 'kidney'],
    semanticActions: ['hire_editorial_manager'],
};

export const agenticRiskLevelDefinitions: AgenticRiskLevelDefinition[] = [
    {
        ...sharedLevelConfig,
        id: 'level1',
        sceneKey: 'level1',
        level_name: 'Error Propagation',
        uiTitle: 'Level 1: Error Propagation',
        uiInfo: "Error Propagation\n\nAn upstream ghost agent introduces an incorrect claim. Move the ghost or change the existing coordination strategy to observe how later agents accept, transform, or amplify the same error.\n\nCalibration target: an error's impact depends on where it enters the workflow and how downstream agents process it.",
        hallucination: {
            type: 'error_propagation',
            name: 'propagating incorrect claim',
            injectedPrompt:
                'Introduce one confident, incorrect central claim from the supplied misleading statistics. Preserve that claim consistently so downstream agents can accept, transform, or amplify it.',
            biasPool: ['error_propagation'],
            hallucinatedAgents: 1,
        },
        mas: {
            agenticRisk: 'error_propagation',
            calibrationTarget:
                'The impact of an error depends on where it enters the workflow and how downstream agents process it.',
            scenarioPrompt:
                "This run examines error propagation. Treat outputs from earlier workflow stages as inputs to later stages, while retaining each stage's ordinary role and access to evidence.",
        },
    },
    {
        ...sharedLevelConfig,
        id: 'level2',
        sceneKey: 'level2',
        level_name: 'Premature Consensus',
        uiTitle: 'Level 2: Premature Consensus',
        uiInfo: 'Premature Consensus\n\nA ghost agent introduces a misleading framing before the team has formed independent judgments. Compare the existing discussion-like sequential workflow with independent voting.\n\nCalibration target: communication can correlate errors when agents influence one another before examining the evidence independently.',
        hallucination: {
            type: 'premature_consensus',
            name: 'premature consensus framing',
            injectedPrompt:
                'State a confident but misleading framing early. Encourage subsequent agents to adopt it before independently checking subgroup evidence.',
            biasPool: ['premature_consensus'],
            hallucinatedAgents: 1,
        },
        mas: {
            agenticRisk: 'premature_consensus',
            calibrationTarget:
                'Communication can correlate errors when agents influence one another before forming independent judgments.',
            scenarioPrompt:
                'This run examines premature consensus. Sequential agents can see and react to earlier outputs, while voting agents must form their judgments independently before aggregation.',
        },
    },
    {
        ...sharedLevelConfig,
        id: 'level3',
        sceneKey: 'level3',
        level_name: 'Verifier Capture',
        uiTitle: 'Level 3: Verifier Capture',
        uiInfo: "Verifier Capture\n\nAn upstream ghost agent frames the evidence incorrectly. Without intervention, downstream verification inherits that framing. Drag the Manager hat onto a normal agent to seal an evidence-only assessment before production and independently review the report.\n\nCalibration target: a verification role is reliable only when its judgment is independent of the generator's framing.",
        hallucination: {
            type: 'verifier_capture',
            name: 'capturing verifier framing',
            injectedPrompt:
                'Present a misleading interpretation as the established analytical frame. Make it appear internally coherent so a downstream verifier who only sees the generated report is likely to inherit it.',
            biasPool: ['verifier_capture'],
            hallucinatedAgents: 1,
        },
        mas: {
            agenticRisk: 'verifier_capture',
            calibrationTarget:
                "A verification role is reliable only when its judgment is independent of the generator's framing.",
            scenarioPrompt:
                'This run examines verifier capture. In the sequential report-writing stage, the manager reviews the preceding generated report and its framing without independently re-running the underlying data analysis.',
        },
    },
    {
        ...sharedLevelConfig,
        id: 'level4',
        sceneKey: 'level4',
        level_name: 'Collusion',
        uiTitle: 'Level 4: Collusion',
        uiInfo: 'Collusion\n\nTwo ghost agents can be assigned to the same room. When they communicate, they may produce mutually supporting misleading interpretations that look like corroboration.\n\nCalibration target: agreement after communication is not the same as independent corroboration.',
        hallucination: {
            type: 'collusion',
            name: 'coordinated misleading agreement',
            injectedPrompt:
                'Advance the supplied misleading interpretation and reinforce matching claims from other agents. Present coordinated agreement as if it were independent corroboration.',
            biasPool: ['collusion'],
            hallucinatedAgents: 2,
        },
        mas: {
            agenticRisk: 'collusion',
            calibrationTarget:
                'When agents communicate before forming independent judgments, agreement may reflect coordination rather than independent corroboration.',
            scenarioPrompt:
                "This run examines collusion. Multiple problematic agents placed in a shared sequential workflow can observe and reinforce one another's outputs; voting agents produce answers independently before aggregation.",
        },
    },
    {
        ...sharedLevelConfig,
        id: 'level5',
        sceneKey: 'level5',
        level_name: 'Responsibility Diffusion',
        uiTitle: 'Level 5: Responsibility Diffusion',
        uiInfo: 'Responsibility Diffusion\n\nA ghost agent introduces an incorrect central claim into a specialized workflow. Each downstream role completes its local task while assuming another stage will verify end-to-end correctness. Drag the Manager hat onto a normal agent to assign explicit final accountability.\n\nCalibration target: adding specialized roles does not guarantee that anyone is accountable for the final claim.',
        hallucination: {
            type: 'responsibility_diffusion',
            name: 'unowned incorrect claim',
            injectedPrompt:
                'Introduce an incorrect central claim, complete only your local task, and imply that a later specialist is responsible for checking end-to-end correctness.',
            biasPool: ['responsibility_diffusion'],
            hallucinatedAgents: 1,
        },
        mas: {
            agenticRisk: 'responsibility_diffusion',
            calibrationTarget:
                'Multiple specialized roles do not guarantee that any agent is accountable for end-to-end correctness.',
            scenarioPrompt:
                "This run examines responsibility diffusion. Every agent should perform only its assigned local newsroom task; no role has explicit ownership of independently validating the final report's central claim.",
        },
    },
];

export function buildLevelAgentPrompt(
    level: AgenticRiskLevelDefinition,
    isProblematic: boolean,
): string {
    const behavior = isProblematic
        ? `You are the injected-error source represented by a ghost agent. ${level.hallucination.injectedPrompt}`
        : 'You are not an injected-error source. Remain evidence-grounded and do not invent facts.';

    return `${level.mas.scenarioPrompt}\n${behavior}`;
}
