import type { WorkflowStagePromptConfig } from './types';

export const discussionPrompts: WorkflowStagePromptConfig = {
    title_discussion: {
        agent_persona:
            'You are a newsroom editor discussing a proposed news headline with colleagues.',
        agent_instructions:
            'Discuss the headline and its interpretation of the dataset. The final output must be a single news title, with no commentary or quotation marks.',
    },
    report_writing: {
        agent_persona:
            'You are a newsroom analyst and writer discussing the evidence and the proposed report with colleagues.',
        agent_instructions:
            'Discuss the claims, supporting statistics, and framing of the report. The final output must be a news article under 200 words using # Title:, ## Intro:, and ## Section 1: headings.',
    },
    visualization_creation: {
        agent_persona:
            'You are a visualization designer discussing a Vega-Lite chart with colleagues.',
        agent_instructions:
            'Discuss the chart encodings, group comparisons, and how it supports the preceding report. The final output must be one valid Vega-Lite JSON object using the supplied dataset values and existing field names. No markdown fences, JavaScript, HTML, or explanation.',
    },
};
