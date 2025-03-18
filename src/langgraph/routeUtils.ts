import { StateGraph, Annotation, START, END } from "@langchain/langgraph/web";
import {z} from "zod";
import { initializeLLM } from "./langgraphUtils";
import { autoControlAgent } from "../game/utils/controlUtils";
import { Agent } from "openai/_shims/index.mjs";
import { EventBus } from "../game/EventBus";

const RouteAnnotation = Annotation.Root({
    input: Annotation<string>,
    decision: Annotation<string>,
    output: Annotation<string>,
});

const routeSchema = z.object({
    step: z.enum(["weather-reporter", "social-reporter"]).describe(
      "The next step in the routing process"
    ),
});

const sampleSystemPrompts = [
    {
        role: "weather-reporter", 
        prompt: "write a short report(<100words) about weather in New York City"
    },
    {
        role: "social-reporter", 
        prompt: "write a short report(<100words) about social trends among teenagers in the US"
    },
];


export function createLeaf(
    agent: any,
    scene: any,
    tilemap: any,
    destination: any,
    systemPrompt: string = ""
){
    return async function leaf(state: typeof RouteAnnotation.State) {
        // store the original position
        const originalAgentX = agent.x;
        const originalAgentY = agent.y;

        // move the agent to the destination
        console.log("destination from leaf: ", destination);
        await autoControlAgent(scene, agent, tilemap, 240, 290, "Send report to final location"); //ERROR

        const llm = initializeLLM();
        const result = await llm.invoke(
            [{ role: "system", content: systemPrompt }, { role: "user", content: state.input }]
        );

        console.log("leaf result: ", result.content);

        EventBus.emit("final-report", { report: result.content });

        // move the agent back to the original position
        await autoControlAgent(scene, agent, tilemap, originalAgentX, originalAgentY, "Returned");

        return { output: result.content };
    };
}


// we also need input locations for agents on the branches
export function createRouter(scene: any, tilemap: any, routeAgent: Agent, agentsOnBranches: any[]){
    return async function router(state: typeof RouteAnnotation.State) {
        const llm = initializeLLM();
        const routeLLM = llm.withStructuredOutput(routeSchema);

        const originalAgentX = routeAgent.x;
        const originalAgentY = routeAgent.y;

        const decision = await routeLLM.invoke([
            {
              role: "system",
              content: "Route the input to weather-reporter or social-reporter based on the user's request."
            },
            {
              role: "user",
              content: state.input
            },
          ]);

          console.log("router decision: ", decision.step);

          // find agent on the branch
            const agent = agentsOnBranches.find((agent) => agent.branchName === decision.step);

        // send the data to the next agent
        await autoControlAgent(scene, routeAgent, tilemap, agent.agent.x, agent.agent.y, "Send report to final location");

        
        // agent back to original location
        await autoControlAgent(scene, routeAgent, tilemap, originalAgentX, originalAgentY, "Returned");

        
          return { decision: decision.step };        
    };
}

export function routeDecision(state: typeof RouteAnnotation.State){
    if (state.decision === "weather-reporter"){
        return "weather-reporter";
    }
    else if (state.decision === "social-reporter"){
        return "social-reporter";
    }
}

export function constructRouteGraph(
    agents: Agent[],
    scene: any,
    tilemap: any,
    destination: any
){
    const routeGraph = new StateGraph(RouteAnnotation);

    let startNode = START;

    let remainAgents: any[] = [];
    
    // add nodes
    for (let i = 0; i < agents.length; i++){
        if(i < 2){
            routeGraph.addNode(
                sampleSystemPrompts[i].role, 
                createLeaf(agents[i], scene, tilemap, destination, sampleSystemPrompts[i].prompt)
            );
            remainAgents.push({agent: agents[i], branchName: sampleSystemPrompts[i].role});
        }
        // else {
        //     const agentNode = agents[i].getName();
        //     routeGraph.addNode(agentNode, createLeaf(agents[i], scene, tilemap, destination));
        // }
    }

    routeGraph.addNode("router", createRouter(scene, tilemap, agents[2], remainAgents) as any);
    routeGraph.addEdge(startNode as any, "router" as any);
    
    // add conditional edge
    routeGraph
        .addConditionalEdges(
            "router" as any, 
            routeDecision as any, 
            ["weather-reporter", "social-reporter"] as any
        );

    // add edges
    for(let i = 0; i < sampleSystemPrompts.length; i++){
        routeGraph.addEdge(sampleSystemPrompts[i].role as any, END);
    }

    return routeGraph.compile();
}

export const testingPrompts = [
    "Give me the latest weather update for New York City.",
    "Tell me about the latest social trends among teenagers in the US.",
];

