import { StateGraph, START, END } from '@langchain/langgraph/web';
import { GeneralStateAnnotation } from './agents';
import { createLeaf } from './routeUtils';
import { Agent } from 'openai/_shims/index.mjs';

export function constructSingleAgentGraph(
  agent: Agent[],
  scene: any,
  tilemap: any,
  thisRoomDestination: any,
  destination: any
) {
  const graph = new StateGraph(GeneralStateAnnotation);

  graph.addNode(
    'visualization',
    createLeaf(
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



