import { StateGraph, Annotation, START, END } from "@langchain/langgraph/web";
import {z} from "zod";
import { initializeLLM } from "./langgraphUtils";
import { autoControlAgent } from "../game/utils/controlUtils";
import { Agent } from "openai/_shims/index.mjs";

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
        await autoControlAgent(scene, agent, tilemap, (destination?.x as number), (destination?.y as number), "Moved to decision agent");

        const llm = initializeLLM();
        const result = await llm.invoke(
            [{ role: "system", content: systemPrompt }, { role: "user", content: state.input }]
        );

        // move the agent back to the original position
        await autoControlAgent(scene, agent, tilemap, originalAgentX, originalAgentY, "Returned");

        return { output: result.content };
    };
}


export function createRouter(){
    return async function router(state: typeof RouteAnnotation.State) {
        const llm = initializeLLM();
        const routeLLM = llm.withStructuredOutput(routeSchema);
        const decision = await routeLLM.invoke([
            {
              role: "system",
              content: "Route the input to story, joke, or poem based on the user's request."
            },
            {
              role: "user",
              content: state.input
            },
          ]);
        
          return { decision: decision.step };        
    };
}

export function routeDecision(state: typeof RouteAnnotation.State){
    if (state.decision === "weather-reporter"){
        return "";
    }
    else if (state.decision === "social-reporter"){
        return "";
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
    
    // add nodes
    for (let i = 0; i < agents.length; i++){
        if(i < 2)routeGraph.addNode(sampleSystemPrompts[i].role, createLeaf(agents[i], scene, tilemap, destination, sampleSystemPrompts[i].prompt));
        // else {
        //     const agentNode = agents[i].getName();
        //     routeGraph.addNode(agentNode, createLeaf(agents[i], scene, tilemap, destination));
        // }
    }

    routeGraph.addNode("router", createRouter() as any);
    routeGraph.addEdge(startNode as any, "router" as any);
    
    // add conditional edge
    routeGraph
        .addConditionalEdges(
            "router" as any, 
            routeDecision as any, 
            ["weather-reporter", "social-reporter"] as any
        );

    // add edges
    for(let i = 0; i < agents.length; i++){
        routeGraph.addEdge(agents[i].getName(), END);
    }

    return routeGraph.compile();
}

export const testingPrompts = [
    "Give me the latest weather update for New York City.",
    "Tell me about the latest social trends among teenagers in the US.",
];

