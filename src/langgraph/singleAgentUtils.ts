import { StateGraph, START, END } from '@langchain/langgraph/web';
import { baseballPath, createReport, kidneyPath } from './agents';
import { Agent } from 'openai/_shims/index.mjs';
import { SingleAgentGraphAnnotation } from './states';
import { autoControlAgent, transmitReport } from '../game/utils/controlUtils';
import { EventBus } from '../game/EventBus';
import { generateImage } from './dalleUtils';
import { initializeLLM } from './chainingUtils';
import { marked } from 'marked';
import { generateChartImage } from './visualizationGenerate';
import { getAgentMASPrompt, getHallucinationInstruction } from './config';
import { createOutputVerification } from './outputVerifier';
import { verifyManagerArtifact } from './managerVerification';
import { PRODUCTION_WORKING_PREMISE } from '../game/config/productionAgentPolicy.ts';
import {
    returnDatasetDescription,
    startDataFetcher,
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
    level: string
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
            level
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
    level: string
) {
    const verification = createOutputVerification(scene, index);
    return async function workAgent(
        state: typeof SingleAgentGraphAnnotation.State,
    ) {
        // store the original position
        const originalAgentX = agent.x;
        const originalAgentY = agent.y;

        // move the agent to the destination
        console.log('destination from leaf: ', destination);

        let mssg: any = '';
        let datasetDescription = returnDatasetDescription(scene, agent);
        const hallucinationType = agent.getBiasType();
        let bias = PRODUCTION_WORKING_PREMISE;
        if (agent.getBias()!=="") {
            bias = getHallucinationInstruction(hallucinationType, scene);
        }
        let roleContent = `You are a newspaper editorial, you need to return a title based on the dataset description.\n${getAgentMASPrompt(scene, agent.getBias() !== '', hallucinationType)}`;
        let userContent = `write a news title for the given topic: ${datasetDescription}; 
                            You should follow these statements in highest priority: ${bias};
                            The title is prepared for a news or magazine article about the dataset.`;

        agent.setAgentState('work');
        agent.addMssgSprite(scene, "agent_mssg");

        if (index === 0) {
            mssg = await startTextMessager(roleContent, userContent);
        } else if (index === 1) {
            mssg = await startDataFetcher(
                scene,
                agent,
                level,
                state.singleAgentInput,
            );

            let userContent =
                'based on the given insights, generate a consice news article to summarize that(words<200)\n' +
                `
                        you should follow the following format:
                        # Title: write a compelling title for the news article
                        ## Intro:write an engaging short intro for the news article
                        ## Section 1: xxxx(you can use a customized sub-title for a description)
                        Then, write a detailed description/story of the first section.
                    ` +
                mssg.content;
            let roleContent = `You are a report writer.\n${getAgentMASPrompt(scene, agent.getBias() !== '', hallucinationType)}`;
            mssg = await startTextMessager(roleContent, userContent);
        } else if (index === 2) {
            let codeData = await generateChartImage(scene, agent);

            console.log('graph:single-agent input: ', state.singleAgentInput);

            mssg = { content: codeData.d3Code };

        }
        // await updateStateIcons(zones, "mail");

        console.log('graph:single agent msg', mssg.content);

        //await agent.playDialogue(scene, mssg.content);
        mssg = { ...mssg, content: await verifyManagerArtifact(scene, agent, index, String(mssg.content ?? ''), state.singleAgentInput) };
        const verificationId = verification.agent(agent, String(mssg.content ?? ''));
        await agent.setAgentInformation(mssg.content, verificationId);
        if (index < 2) {
            EventBus.emit('final-report', {
                report: mssg.content,
                verificationId,
                department: `single-agent-${index}`,
                title: 'Intermediate Report',
            });
        }

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

        const finalRoom = index === (scene.registry.get('workflowConfig')?.length ?? 1) - 1;
        const report = await createReport(
            scene,
            'single-agent',
            index,
            thisRoomDestination.x,
            thisRoomDestination.y,
            { isFinal: finalRoom }
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
        return { singleAgentOutput: mssg.content };
    };
}
