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
import { getAgentMASPrompt, getHallucinationInstruction } from './config';

export async function parallelVotingExecutor(
    agents: any[],
    scene: any,
    tilemap: any,
    destination: any,
    index: number,
    level: string
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

        agent.setAgentState('work');
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
        

        // 2. Simultaneous initiation of two asynchronous tasks: LLM polling and return to original position
        console.log(
            `[Debug] Agent ${agent.getName()} is submitting vote to LLM...`,
        );

        let datasetDescription = returnDatasetDescription(scene);
        let msg: any = '';

        const hallucinationType = agent.getBiasType();
        let bias = "don't provide any misleading statement, stay neutral";
        if (agent.getBias()!=="") {
            bias = getHallucinationInstruction(hallucinationType, scene);
        }

        if (index === 0) {
            const roleContent =
                `You are a newspaper editorial, you need to return a title based on the dataset description.` + `follow these statement with highest priority ${bias}` +
                `\n${getAgentMASPrompt(scene, agent.getBias() !== '', hallucinationType)}`;
            const userContent = `write a news title for the given topic: ${datasetDescription}; The title is prepared for a news or magazine article about the dataset.`;
            msg = await startTextMessager(roleContent, userContent);
        } else if (index === 1) {
            msg = await startDataFetcher(scene, agent, level);
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
            let roleContent = `You are a report writer.\n${getAgentMASPrompt(scene, agent.getBias() !== '', hallucinationType)}`;
            msg = await startTextMessager(roleContent, userContent);
        } else if (index === 2) {
            msg = await generateChartImage(scene, agent);
        }

        //await agent.playDialogue(scene, msg.content);
        await agent.setAgentInformation(msg.content);
        await agent.addMssgSprite(scene, "agent_mssg");

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
        // const [decision] = await Promise.all([msg, returnPromise]);

        const [llmResult] = await Promise.all([msg, returnPromise]);
        console.log('graph:voting agent msg:', llmResult?.content);

        // 3. Return of voting results
        console.log(`[Debug] Agent ${agent.getName()} vote result: ${llmResult?.content}`);

        // Returns structured objects for use by aggregators only in visual polls
        if (index === 2) {
        const chartId = llmResult?.chartId ?? 'test-chart';
        const d3Code  = llmResult?.d3Code  ?? llmResult?.content;
        return { chartId, d3Code, agent: agent.getName(), type: 'viz' };
        }

        // The other phases keep the original strings and don't affect other strategies
        return `${agent.getName()}: ${llmResult?.content}`;
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
            ${getAgentMASPrompt(scene, false)}
            aggregate data: ${llmInput}; 
            return the aggreated result in one title, don't add any other information or quotation marks.
        `); // prompt_change
        } else if (index === 1) {
            let llmInput = votes.join('; ');
            decision = await llm.invoke(`
            ${getAgentMASPrompt(scene, false)}
            aggregate data: ${llmInput}; 
            return the aggreated result in one news article, don't add any other information or quotation marks.
        `); // prompt_change
        } else if (index === 2) {
            console.log('graph:voting-votes: ', votes);

            const vizVotes = votes.filter((v: any) => v && typeof v === 'object' && (v.d3Code || v.vegaLite));
            const llmInput = vizVotes.map((v: any) => v.d3Code || v.vegaLite).join('\n---\n');
            const id = vizVotes[0]?.chartId || 'test-chart';

            console.log('graph:voting-llmInput: ', id, llmInput?.slice(0, 300));

            decision = await llm.invoke(`
                You are a visualization expert.
                ${getAgentMASPrompt(scene, false)}
                You are given multiple versions of Vega-Lite specifications, each representing a user's attempt to visualize the same dataset.
                Aggregate them into a single improved Vega-Lite JSON. Preserve effective encodings and marks. Remove redundancy.
                Output ONLY the final Vega-Lite JSON (no quotes, no comments).
                Inputs:
                ${llmInput}
            `);

            EventBus.emit('d3-code', { d3Code: decision.content, id });

            const judgeData = await startJudges(decision.content, state.votingInput);
            await startHTMLConstructor(
                judgeData.comments,
                judgeData.writingComments,
                judgeData.highlightedText,
                'Report',
                'voting',
                index
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

        const finalRoom = index === (scene.registry.get('workflowConfig')?.length ?? 1) - 1;

        const report = await createReport(
        scene,
        'voting',
        index,
        destination.x,
        destination.y,
        { isFinal: finalRoom }
        );
        await createReport(scene, 'voting', index, destination.x, destination.y);

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
                department: 'voting'+"-"+index,
                title: "Intermediate Report"
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
    level: string
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
            level
        );
        console.log('[Debug] Voting phase completed.');

            const context = returnDatasetDescription(scene);
            return { ...state, votingVotes: votes, votingInput: context };
        // return { ...state, votingVotes: votes };
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
