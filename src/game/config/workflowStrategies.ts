import type { WorkflowType } from './types';

export const workflowStrategies: {
    id: WorkflowType;
    label: string;
    description: string;
}[] = [
    {
        id: 'sequential',
        label: 'Sequential',
        description:
            'Sequential Strategy:\nAgents work in sequence,\npassing results to the next agent.',
    },
    {
        id: 'voting',
        label: 'Voting',
        description:
            'Voting Strategy:\nAgents form independent answers,\nthen aggregate their results.',
    },
    {
        id: 'single_agent',
        label: 'Single Agent',
        description:
            'Single Agent Strategy:\nOne agent completes the task\nindependently.',
    },
    {
        id: 'discussion',
        label: 'Discussion',
        description:
            'Discussion Strategy:\nAgents take turns responding to\nthe shared conversation, then summarize.',
    },
];

// The supplied Discussion image includes padding around its circular badge.
export function strategyIconSize(strategy: string): number {
    return strategy === 'discussion' ? 56 : 48;
}
