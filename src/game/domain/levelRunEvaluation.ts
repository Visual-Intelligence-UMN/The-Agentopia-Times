import type { LevelConfig, WorkflowType } from '../config/types.ts';
import type { LevelRunConfiguration } from './levelCompletionPolicy.ts';

interface AgentSnapshotSource {
    getName(): string;
    getBias(): string;
}

interface StageZoneSnapshot {
    agents: AgentSnapshotSource[];
}

export function buildLevelRunConfiguration(input: {
    level: LevelConfig;
    datasetId: string;
    workflow: WorkflowType[];
    dataMaps: StageZoneSnapshot[][];
    managerId: string | null;
    managerReviewApproved: boolean;
}): LevelRunConfiguration {
    return {
        levelId: input.level.id,
        datasetId: input.datasetId,
        risk: input.level.mas.agenticRisk,
        requiredScore: input.level.required_score,
        managerId: input.managerId,
        managerReviewApproved: input.managerReviewApproved,
        stages: input.workflow.map((strategy, index) => ({
            strategy,
            agents: (input.dataMaps[index] ?? [])
                .flatMap((zone) => zone.agents)
                .map((agent) => ({
                    id: agent.getName(),
                    ghost: agent.getBias() !== '',
                })),
        })),
    };
}
