import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';
import type Phaser from 'phaser';

import { getGameConfig } from '../game/config';
import type { WorkflowAgentPrompt } from '../game/config/types';
import {
    type DiscussionResult,
    runDiscussion,
} from '../game/domain/discussion';
import { abortableWorkflowStep } from '../game/domain/workflowRun';
import { EventBus } from '../game/EventBus';
import type { Agent } from '../game/sprites/Agent';
import { autoControlAgent, transmitReport } from '../game/utils/controlUtils';
import { recorder } from '../game/utils/recorder';
import {
    getVisualizationData,
    getVisualizationDataForAgent,
} from '../vega/visualizationData';
import {
    prepareProductionContext,
    PRODUCTION_COMPARISON_QUESTION,
} from '../game/config/productionAgentPolicy.ts';
import { createReport } from './agents';
import {
    getAgentMASPrompt,
    getDatasetConfigForScene,
    getHallucinationStats,
} from './config';
import { recordMASStage } from './masTrace';
import { createOutputVerification } from './outputVerifier';
import { verifyManagerArtifact } from './managerVerification';
import {
    startTextMessager,
} from './workflowUtils';

const DiscussionState = Annotation.Root({
    discussionInput: Annotation<string>,
    discussionOutput: Annotation<string>,
    discussionResult: Annotation<DiscussionResult>,
    scoreData: Annotation<unknown>,
});

const stageKeys = [
    'title_discussion',
    'report_writing',
    'visualization_creation',
] as const;
type Position = { x: number; y: number };

export function constructDiscussionGraph(
    agents: Agent[],
    scene: Phaser.Scene,
    tilemap: Phaser.Tilemaps.Tilemap,
    discussionPosition: Position,
    nextPosition: Position,
    stageIndex: number,
) {
    const stageKey = stageKeys[stageIndex];
    const verification = createOutputVerification(scene, stageIndex);
    if (!stageKey)
        throw new Error(`Unsupported Discussion stage: ${stageIndex}`);
    if (!agents.length || agents.some((agent) => !agent)) {
        throw new Error('Place at least one agent in the Discussion room.');
    }
    const abort = new AbortController();
    scene.events.once('shutdown', () => abort.abort());
    const ensureActive = () => abort.signal.throwIfAborted();

    return new StateGraph(DiscussionState)
        .addNode('discuss', async (state) => {
            const dataset = getDatasetConfigForScene(scene);
            const configured = getGameConfig().mas.agents.discussion[stageKey];
            const prompts: WorkflowAgentPrompt[] = Array.isArray(configured)
                ? configured
                : [configured];
            const task = prompts[0].agent_instructions;
            const seats = agents.map(({ x, y }) => ({ x, y }));
            const visualizationData =
                stageIndex === 2 ? getVisualizationData(dataset.id) : '';

            let result: DiscussionResult;
            try {
                result = await runDiscussion({
                    input: state.discussionInput,
                    task,
                    participants: agents.map((agent, index) => {
                        const isGhost = agent.getBias() !== '';
                        return {
                            name: agent.getName(),
                            systemPrompt: `${prompts[index % prompts.length].agent_persona}\n${getAgentMASPrompt(scene, isGhost, agent.getBiasType())}`,
                            evidence: `Dataset: ${dataset.label}\nQuestion: ${isGhost ? PRODUCTION_COMPARISON_QUESTION : prepareProductionContext(dataset.researchQuestion)}\nStatistics: ${isGhost ? getHallucinationStats(dataset.id, agent.getBiasType()) : dataset.neutralStatistics}${visualizationData ? `\nChart data values: ${getVisualizationDataForAgent(dataset.id, agent)}` : ''}`,
                        };
                    }),
                    summarySystemPrompt: `You are the newsroom discussion facilitator. Synthesize the shared conversation into the required stage output. Consider disagreements as well as agreements.\n${getAgentMASPrompt(scene, false)}\n${task}${visualizationData ? `\nUse exactly these chart data values: ${visualizationData}` : ''}`,
                    complete: async ({ system, user }) => {
                        ensureActive();
                        const response = await startTextMessager(
                            system,
                            user,
                            abort.signal,
                        );
                        ensureActive();
                        if (typeof response.content !== 'string')
                            throw new Error(
                                'Discussion returned non-text content.',
                            );
                        return response.content;
                    },
                    onTurnStart: async (_participant, index) => {
                        ensureActive();
                        agents[index].setAgentState('work');
                        await abortableWorkflowStep(
                            autoControlAgent(
                                scene,
                                agents[index],
                                tilemap,
                                discussionPosition.x,
                                discussionPosition.y,
                                'Join discussion',
                            ),
                            abort.signal,
                        );
                        ensureActive();
                    },
                    onTurnComplete: async (turn, index) => {
                        ensureActive();
                        turn.output = await verifyManagerArtifact(scene, agents[index], stageIndex, turn.output, turn.input.user, 'discussion', abort.signal);
                        ensureActive();
                        recordMASStage({
                            stageIndex,
                            workflow: 'discussion_turn',
                            input: { agent: turn.agent, ...turn.input },
                            output: turn.output,
                        });
                        recorder.recordEvent({
                            type: 'discussion_turn_completed',
                            stageIndex,
                            agent: turn.agent,
                            output: turn.output,
                        });
                        agents[index].setAgentInformation(
                            `DISCUSSION — TURN ${index + 1}\n\n${turn.output}`,
                            verification.agent(agents[index], turn.output),
                        );
                        agents[index].addMssgSprite(scene, 'agent_mssg');
                        await abortableWorkflowStep(
                            autoControlAgent(
                                scene,
                                agents[index],
                                tilemap,
                                seats[index].x,
                                seats[index].y,
                                'Return to seat',
                            ),
                            abort.signal,
                        );
                        ensureActive();
                        agents[index].setAgentState('idle');
                    },
                });
            } finally {
                if (!abort.signal.aborted) {
                    agents.forEach((agent) => agent.setAgentState('idle'));
                }
            }
            recordMASStage({
                stageIndex,
                workflow: 'discussion_summary',
                input: result.summary.input,
                output: result.output,
            });
            return {
                discussionResult: result,
                discussionOutput: result.output,
            };
        })
        .addNode('publish', async (state) => {
            ensureActive();
            let discussionOutput = state.discussionOutput;
            const verificationId = verification.stage(discussionOutput);
            if (stageIndex === 2) {
                const cleaned = discussionOutput
                    .trim()
                    .replace(/^```(?:json)?\s*/i, '')
                    .replace(/```\s*$/, '');
                // Carry the actual chart to finalization, including invalid model output.
                // The shared evaluator grades validity; one bad chart must not abort
                // report publication or silently become the previous room's article.
                const chartCode = cleaned;
                discussionOutput = chartCode;
                recordMASStage({
                    stageIndex,
                    workflow: 'discussion_visualization',
                    input: { report: state.discussionInput },
                    output: { chartCode },
                });
            } else {
                EventBus.emit('final-report', {
                    report: discussionOutput,
                    verificationId,
                    department: `discussion-${stageIndex}`,
                    title: 'Intermediate Report',
                });
            }
            ensureActive();
            const report = await createReport(
                scene,
                'discussion',
                stageIndex,
                discussionPosition.x,
                discussionPosition.y,
                { isFinal: stageIndex === 2 },
            );
            await abortableWorkflowStep(
                transmitReport(scene, report, nextPosition.x, nextPosition.y),
                abort.signal,
            );
            ensureActive();
            return { discussionOutput };
        })
        .addEdge(START, 'discuss')
        .addEdge('discuss', 'publish')
        .addEdge('publish', END)
        .compile();
}
