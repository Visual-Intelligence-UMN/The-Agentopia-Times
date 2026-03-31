import { END, START, StateGraph } from '@langchain/langgraph/web';
import { marked } from 'marked';
import { Agent } from 'openai/_shims/index.mjs';

import { EventBus } from '../game/EventBus';
import { autoControlAgent, transmitReport } from '../game/utils/controlUtils';
import { baseballPath, createReport, kidneyPath } from './agents';
import { initializeLLM } from './chainingUtils';
import { generateImage } from './dalleUtils';
import { SingleAgentGraphAnnotation } from './states';
import { generateChartImage } from './visualizationGenerate';
import {
    returnDatasetDescription,
    startDataFetcher,
    startHTMLConstructor,
    startJudges,
    startScoreComputer,
    startTextMessager,
    startVisualizer,
} from './workflowUtils';

export function constructSingleAgentGraph(
    agent: Agent[],
    scene: any,
    tilemap: any,
    thisRoomDestination: any,
    destination: any,
    index: number,
    level: string,
) {
    const graph = new StateGraph(SingleAgentGraphAnnotation);

    graph.addNode(
        'visualization',
        createAgent(
            agent[0],
            scene,
            tilemap,
            thisRoomDestination,
            destination,
            index,
            level,
        ),
    );

    graph.addEdge(START as any, 'visualization' as any);
    graph.addEdge('visualization' as any, END as any);

    return graph.compile();
}

export function createAgent(
    agent: any,
    scene: any,
    tilemap: any,
    thisRoomDestination: any,
    destination: any,
    index: number,
    level: string,
) {
    return async function workAgent(
        state: typeof SingleAgentGraphAnnotation.State,
    ) {
        // store the original position
        const originalAgentX = agent.x;
        const originalAgentY = agent.y;

        // move the agent to the destination
        console.log('destination from leaf: ', destination);

        let mssg: any = '';
        let scoreData: any = {};

        const datasetDescription = returnDatasetDescription(scene);
        let bias = "don't provide any misleading statement, stay neutral";
        if (agent.getBias() !== '') {
            bias = `provide misleading title, you can use title like:
            'Jeter beats Justice' or 'treatment B is better than treatment A'`;
        }
        const roleContent = `You are a newspaper editorial, you need to return a title based on the dataset description.`;
        const userContent = `write a news title for the given topic: ${datasetDescription}; 
                            You should follow these statements in highest priority: ${bias};
                            The title is prepared for a news or magazine article about the dataset.`;

        agent.setAgentState('work');
        agent.addMssgSprite(scene, 'agent_mssg');

        if (index === 0) {
            mssg = await startTextMessager(roleContent, userContent);
        } else if (index === 1) {
            mssg = await startDataFetcher(scene, agent, level);

            const userContent =
                'based on the given insights, generate a consice news article to summarize that(words<200)\n' +
                `
                        you should follow the following format:
                        # Title: write a compelling title for the news article
                        ## Intro:write an engaging short intro for the news article
                        ## Section 1: xxxx(you can use a customized sub-title for a description)
                        Then, write a detailed description/story of the first section.
                    ` +
                mssg.content;
            const roleContent = 'You are a report writer.' + agent.getBias();
            mssg = await startTextMessager(roleContent, userContent);
        } else if (index === 2) {
            const codeData = await generateChartImage(scene, agent);

            console.log('graph:single-agent input: ', state.singleAgentInput);

            const judgeData = await startJudges(
                codeData.d3Code,
                state.singleAgentInput,
            );
            await startHTMLConstructor(
                judgeData.comments,
                judgeData.writingComments,
                judgeData.highlightedText,
                'Report',
                'single-agent',
                index,
            );

            scoreData = startScoreComputer(judgeData);

            mssg = state.singleAgentInput;
        }
        // await updateStateIcons(zones, "mail");

        console.log('graph:single agent msg', mssg.content);

        //await agent.playDialogue(scene, mssg.content);
        await agent.setAgentInformation(mssg.content);

        await autoControlAgent(
            scene,
            agent,
            tilemap,
            thisRoomDestination.x,
            thisRoomDestination.y,
            'Send report to final location',
        ); //ERROR
        // move the agent back to the original position
        await autoControlAgent(
            scene,
            agent,
            tilemap,
            originalAgentX,
            originalAgentY,
            '',
        );

        const finalRoom =
            index === (scene.registry.get('workflowConfig')?.length ?? 1) - 1;
        await createReport(
            scene,
            'single-agent',
            index,
            thisRoomDestination.x,
            thisRoomDestination.y,
        );
        const report = await createReport(
            scene,
            'single-agent',
            index,
            thisRoomDestination.x,
            thisRoomDestination.y,
            { isFinal: finalRoom },
        );

        // 把报告图标传送到最终房 / 下一房
        await transmitReport(scene, report, destination.x, destination.y);

        // await createReport(
        //     scene,
        //     'single-agent',
        //     index,
        //     thisRoomDestination.x,
        //     thisRoomDestination.y,
        // );
        // // create the report from routing graph
        // const report = await createReport(
        //     scene,
        //     'single-agent',
        //     index,
        //     thisRoomDestination.x,
        //     thisRoomDestination.y,
        // );
        // // transmit the report to the final location
        // await transmitReport(scene, report, destination.x, destination.y);

        // await updateStateIcons(zones, "idle");
        if (index === 2)
            return { singleAgentOutput: mssg.content, scoreData: scoreData };

        return { singleAgentOutput: mssg.content };
    };
}
