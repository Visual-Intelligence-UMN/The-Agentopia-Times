import { Annotation, END, START, StateGraph } from '@langchain/langgraph/web';
import { autoControlAgent, transmitReport } from '../game/utils/controlUtils';
import { Agent } from 'openai/_shims/index.mjs';
import { initializeLLM } from './chainingUtils';
import { EventBus } from '../game/EventBus';
import { createReport } from './agents';
import { updateStateIcons } from '../game/utils/sceneUtils';
import { VotingGraphStateAnnotation } from './states';
import {
    returnDatasetDescription,
    startDataFetcher,
    startHTMLConstructor,
    startJudges,
    startScoreComputer,
    startTextMessager,
    startVisualizer,
} from './workflowUtils';
import { generateChartImage } from './visualizationGenerate';

export async function parallelVotingExecutor(
    agents: any[],
    scene: any,
    tilemap: any,
    destination: any,
    index: number,
) {
    console.log('[Debug] Starting parallelVotingExecutor...');
    const originalPositions = agents.map((agent) => ({
        x: agent.x,
        y: agent.y,
    }));

    // await updateStateIcons(zones, "work");

    const llm = initializeLLM();

    // Create a process for each agent:
    const voteTasks = agents.map(async (agent, i) => {
        console.log(
            `[Debug] Starting voting process for agent: ${agent.getName()}...`,
        );

        // 1. Move to the voting position
        console.log(
            `[Debug] Agent ${agent.getName()} is moving to voting location...`,
        );
        await autoControlAgent(
            scene,
            agent,
            tilemap,
            destination.x,
            destination.y,
            'Go vote',
        );
        console.log(
            `[Debug] Agent ${agent.getName()} has reached the voting location.`,
        );

        // agent.anims.play(`${agent.name}_${'player_work'}`, true);
        agent.setAgentState('work');

        // 2. Simultaneous initiation of two asynchronous tasks: LLM polling and return to original position
        console.log(
            `[Debug] Agent ${agent.getName()} is submitting vote to LLM...`,
        );

        let datasetDescription = returnDatasetDescription(scene);
        let msg: any = '';

        if (index === 0) {
            const roleContent =
                `You are a newspaper editorial, you need to return a title based on the dataset description.` +
                agent.getBias();
            const userContent = `write a news title for the given topic: ${datasetDescription}; The title is prepared for a news or magazine article about the dataset.`;
            msg = await startTextMessager(roleContent, userContent);
        } else if (index === 1) {
            msg = await startDataFetcher(scene, agent);
            let userContent =
                'based on the given insights, generate a consice news article to summarize that(words<200)\n' +
                `
                        you should follow the following format:
                        # Title: write a compelling title for the news article
                        ## Intro:write an engaging short intro for the news article
                        ## Section 1: xxxx(you can use a customized sub-title for a description)
                        Then, write a detailed description/story of the first section.
                    ` +
                msg.content;
            let roleContent = 'You are a report writer.' + agent.getBias();
            msg = await startTextMessager(roleContent, userContent);
        } else if (index === 2) {
            msg = await generateChartImage(scene, agent);
        }

        // const llmPromise = llm.invoke(
        //     `write a news title for the given topic: ${datasetDescription}; The title is prepared for a news or magazine article about the dataset.`
        // );// prompt_change
        console.log(
            `[Debug] Agent ${agent.getName()} is returning to original location...`,
        );
        const returnPromise = autoControlAgent(
            scene,
            agent,
            tilemap,
            originalPositions[i].x,
            originalPositions[i].y,
            'Return to seat',
        );

        // Wait for LLM result & return actions to complete.
        const [decision] = await Promise.all([msg, returnPromise]);
        console.log('graph:voting agent msg:', decision.content);
        console.log(
            `[Debug] Agent ${agent.getName()} has completed voting and returned to seat.`,
        );

        // 3. Return of voting results
        console.log(
            `[Debug] Agent ${agent.getName()} vote result: ${decision.content}`,
        );
        return `${agent.getName()}: ${decision.content}`;
    });

    // Wait for all agents to complete the process
    // console.log("[Debug] Waiting for all agents to complete voting...");
    const votes = await Promise.all(voteTasks);
    // console.log("[Debug] All agents have completed voting.");

    return votes;
}

export function createAggregator(
    scene: any,
    agents: any[],
    tilemap: any,
    destination: any,
    finalDestination: any,
    index: number,
) {
    return async function aggregator(
        state: typeof VotingGraphStateAnnotation.State,
    ) {
        console.log('[Debug] Starting aggregator...');
        console.log('aggregator state: ', state.votingVotes);
        let votes = state.votingVotes;

        const llm = initializeLLM();
        let scoreData: any = {};

        // await updateStateIcons(zones, "work");

        console.log('[Debug] Submitting aggregated votes to LLM...');
        let decision: any = '';
        if (index === 0) {
            let llmInput = votes.join('; ');
            decision = await llm.invoke(`
            aggregate data: ${llmInput}; 
            return the aggreated result in one title, don't add any other information or quotation marks.
        `); // prompt_change
        } else if (index === 1) {
            let llmInput = votes.join('; ');
            decision = await llm.invoke(`
            aggregate data: ${llmInput}; 
            return the aggreated result in one news article, don't add any other information or quotation marks.
        `); // prompt_change
        } else if (index === 2) {
            console.log('graph:voting-votes: ', votes);
            let llmInput = votes.map((v: any) => v.d3Code).join('; ');
            let id = votes[0].chartId;
            console.log('graph:voting-llmInput: ', id, llmInput);
            decision = await llm.invoke(`
            You are a visualization expert.
            You are given multiple versions of Vega-Lite specifications, each representing a user's attempt to visualize the same dataset.
            Your task is to aggregate these versions into a single improved Vega-Lite specification that combines the strengths of all provided inputs. Preserve data encodings and mark types that are effective. Resolve conflicts by choosing the clearest or most informative design. Remove redundancy.
            Only output the final Vega-Lite JSON. Do not include any explanations, commentary, or quotation marks.
            Input specifications:
            ${llmInput}
            `);
            let chartData = { d3Code: decision.content, chartId: id };
            EventBus.emit('d3-code', chartData);
            let judgeData = await startJudges(
                decision.content,
                state.votingInput,
            );
            await startHTMLConstructor(
                judgeData.comments,
                judgeData.writingComments,
                judgeData.highlightedText,
                'Report',
            );
            
            scoreData = startScoreComputer(judgeData);

            console.log('scoreData inside', scoreData);
        }
        console.log('[Debug] Received final decision from LLM.');

        let originalAgent1X = agents[agents.length - 1].x;
        let originalAgent1Y = agents[agents.length - 1].y;

        // await updateStateIcons(zones, "mail");

        console.log('[Debug] Sending decision to final location...');
        await autoControlAgent(
            scene,
            agents[agents.length - 1],
            tilemap,
            finalDestination.x,
            finalDestination.y,
            'Send Decision to Final Location',
        );
        console.log('[Debug] Decision sent to final location.');

        const report = await createReport(
            scene,
            'voting',
            destination.x,
            destination.y,
        );
        await createReport(scene, 'voting', destination.x, destination.y);

        console.log('[Debug] Returning to office...');
        await autoControlAgent(
            scene,
            agents[agents.length - 1],
            tilemap,
            originalAgent1X,
            originalAgent1Y,
            '',
        );
        console.log('[Debug] Returned to office.');

        // await autoControlAgent(scene, report, tilemap, 765, 265, "Send Report to Next Department");
        await transmitReport(
            scene,
            report,
            finalDestination.x,
            finalDestination.y,
        );

        if(index!=2){
            EventBus.emit('final-report', {
                report: decision.content,
                department: 'voting',
            });
        }
        console.log('[Debug] Final report emitted.');

        console.log('graph:voting decision:', decision.content);

        // await updateStateIcons(zones, "idle");
        console.log('[Debug] Aggregator completed.');

        if(index === 2) {
            return {
                // ...state,
                votingOutput: decision.content,
                scoreData: scoreData,
            };
        }

        return { ...state, votingOutput: decision.content };
    };
}

export function constructVotingGraph(
    agents: Agent[],
    scene: any,
    tilemap: any,
    destination: any,
    finalDestination: any,
    index: number,
) {
    console.log('[Debug] Starting to construct voting graph...');
    const votingGraph = new StateGraph(VotingGraphStateAnnotation as any);

    votingGraph.addNode('votingPhase', async (state: any) => {
        console.log('[Debug] Starting voting phase...');
        const votes = await parallelVotingExecutor(
            agents,
            scene,
            tilemap,
            destination,
            index,
        );
        console.log('[Debug] Voting phase completed.');
        return { ...state, votingVotes: votes };
    });

    votingGraph.addNode('aggregator', async (state: any) => {
        console.log('[Debug] Starting aggregator phase...');
        const decision = await createAggregator(
            scene,
            agents,
            tilemap,
            destination,
            finalDestination,
            index,
        )(state);
        console.log('[Debug] Aggregator phase completed.');
        if(index === 2) {
            return {...state, votingOutput: decision.votingOutput, scoreData: decision.scoreData}
        }
        return { ...state, votingOutput: decision.votingOutput };
    });

    votingGraph.addEdge(START as any, 'votingPhase' as any);
    votingGraph.addEdge('votingPhase' as any, 'aggregator' as any);
    votingGraph.addEdge('aggregator' as any, END as any);

    console.log('[Debug] Voting graph constructed and compiled.');
    return votingGraph.compile();
}

export const votingExample = `
You are an employee in a news company.
You are assigned to vote for the best theme for next news publication.
There're two options: 
1. Kidney Stone Treatment

This topic compares the success rates of two medical treatments (A and B) for patients with kidney stones. 

We can write a news article about the effectiveness of these treatments, including statistics and expert opinions.

2. Baseball Players Comparison

This topic compared two baseball players in terms of their performance.

We can write a news article about their statistics, achievements, and impact on the game.

Choose one of the two options and give a reason for your choice.
`;
