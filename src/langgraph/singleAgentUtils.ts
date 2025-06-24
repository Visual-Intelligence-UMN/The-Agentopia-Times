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
import { startVisualizer } from './workflowUtils';

export function constructSingleAgentGraph(
  agent: Agent[],
  scene: any,
  tilemap: any,
  thisRoomDestination: any,
  destination: any
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
        scene.creditsText
    )
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
    scoreText: Phaser.GameObjects.Text,
) {
    return async function workAgent(state: typeof SingleAgentGraphAnnotation.State) {
        // store the original position
        const originalAgentX = agent.x;
        const originalAgentY = agent.y;

        // move the agent to the destination
        console.log('destination from leaf: ', destination);

        startVisualizer(
            scene,
            'visualization',
            state,
            state.singleAgentInput,
            agent,
            scoreText,
        );

        // await updateStateIcons(zones, "mail");

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

        await createReport(scene, 'routing', thisRoomDestination.x, thisRoomDestination.y);
        // create the report from routing graph
        const report = await createReport(
            scene,
            'routing',
            thisRoomDestination.x,
            thisRoomDestination.y,
        );
        // transmit the report to the final location
        await transmitReport(scene, report, destination.x, destination.y);

        // await updateStateIcons(zones, "idle");

        return { singleAgentOutput: state.singleAgentInput };
    };
}

