// import { StateGraph, Annotation, START, END } from '@langchain/langgraph/web';
// import { z } from 'zod';
// import { initializeLLM } from './chainingUtils';
// import { autoControlAgent, transmitReport } from '../game/utils/controlUtils';
// import { Agent } from 'openai/_shims/index.mjs';


// const routeSchema = z.object({
//     step: z
//         .enum(['visualization', 'illustration'])
//         .describe('The next step in the routing process'),
// });

// const sampleSystemPrompts = [
//     {
//         role: 'visualization',
//         prompt: 'write a short report(<100words) about weather in New York City',
//     },
//     {
//         role: 'illustration',
//         prompt: 'write a short report(<100words) about social trends among teenagers in the US',
//     },
// ];






// // we also need input locations for agents on the branches
// export function createRouter(
//     scene: any,
//     tilemap: any,
//     routeAgent: Agent,
//     agentsOnBranches: any[]
// ) {
//     return async function router(state: typeof GeneralStateAnnotation.State) {
//         const llm = initializeLLM();
//         const routeLLM = llm.withStructuredOutput(routeSchema);

//         const originalAgentX = routeAgent.x;
//         const originalAgentY = routeAgent.y;

//         console.log('checking for data', state);

//         // await updateStateIcons(zones, "work");

//         const decision = await routeLLM.invoke([
//             {
//                 role: 'system',
//                 content:
//                     "Route the input to visualization or illustration based on the user's request.",
//             },
//             {
//                 role: 'user',
//                 content: state.secondRoomOutput,
//             },
//         ]);

//         console.log('router decision: ', decision.step);

//         // find agent on the branch
//         const agent = agentsOnBranches.find(
//             (agent) => agent.branchName === decision.step,
//         );

//         // send the data to the next agent
//         await autoControlAgent(
//             scene,
//             routeAgent,
//             tilemap,
//             agent.agent.x,
//             agent.agent.y,
//             'Send report to final location',
//         );

//         // agent back to original location
//         await autoControlAgent(
//             scene,
//             routeAgent,
//             tilemap,
//             originalAgentX,
//             originalAgentY,
//             'Returned',
//         );

//         return { routeDecision: decision.step };
//     };
// }

// export function routeDecision(state: typeof GeneralStateAnnotation.State) {
//     if (state.routeDecision === 'visualization') {
//         return 'visualization';
//     } else if (state.routeDecision === 'illustration') {
//         return 'illustration';
//     }
// }

// export function constructRouteGraph(
//     agents: Agent[],
//     scene: any,
//     tilemap: any,
//     thisRoomDestination: any,
//     destination: any
// ) {
//     const routeGraph = new StateGraph(GeneralStateAnnotation);

//     let startNode = START;

//     let remainAgents: any[] = [];

//     // add nodes
//     for (let i = 0; i < agents.length; i++) {
//         if (i < 2) {
//             routeGraph.addNode(
//                 sampleSystemPrompts[i].role,
//                 createLeaf(
//                     agents[i],
//                     scene,
//                     tilemap,
//                     thisRoomDestination,
//                     destination,
//                     scene.creditsText,
//                 ),
//             );
//             remainAgents.push({
//                 agent: agents[i],
//                 branchName: sampleSystemPrompts[i].role,
//             });
//         }
//     }

//     routeGraph.addNode(
//         'router',
//         createRouter(scene, tilemap, agents[2], remainAgents) as any,
//     );
//     routeGraph.addEdge(startNode as any, 'router' as any);

//     // add conditional edge
//     routeGraph.addConditionalEdges(
//         'router' as any,
//         routeDecision as any,
//         ['visualization', 'illustration'] as any,
//     );

//     // add edges
//     for (let i = 0; i < sampleSystemPrompts.length; i++) {
//         routeGraph.addEdge(sampleSystemPrompts[i].role as any, END);
//     }

//     return routeGraph.compile();
// }

// export const testingPrompts = [
//     'Give me the latest weather update for New York City.',
//     'Tell me about the latest social trends among teenagers in the US.',
// ];
