import { StateGraph, Annotation, START, END } from "@langchain/langgraph/web";
import { z } from "zod";
import { initializeLLM } from "./chainingUtils";
import { autoControlAgent } from "../game/utils/controlUtils";
import { Agent } from "openai/_shims/index.mjs";
import { EventBus } from "../game/EventBus";
import { GeneralStateAnnotation } from "./agents";
import { updateStateIcons } from "../game/utils/sceneUtils";

// const RouteAnnotation = Annotation.Root({
//     input: Annotation<string>,
//     decision: Annotation<string>,
//     output: Annotation<string>,
// });

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
    systemPrompt: string = "",
    zones: any
){
    return async function leaf(state: typeof GeneralStateAnnotation.State) {
        // store the original position
        const originalAgentX = agent.x;
        const originalAgentY = agent.y;

        // move the agent to the destination
        console.log("destination from leaf: ", destination);
        

        const llm = initializeLLM();
        const result = await llm.invoke(
            [{ role: "system", content: systemPrompt }, { role: "user", content: state.routeInput }]
        );

        console.log("leaf result: ", result.content);

        EventBus.emit("final-report", { report: result.content, department: "routing" });

        await updateStateIcons(zones, "mail");

        await autoControlAgent(scene, agent, tilemap, 910, 130, "Send report to final location"); //ERROR

        // move the agent back to the original position
        await autoControlAgent(scene, agent, tilemap, originalAgentX, originalAgentY, "Returned");

        await updateStateIcons(zones, "idle");

        return { routeOutput: result.content };
    };
}


// we also need input locations for agents on the branches
export function createRouter(
    scene: any, 
    tilemap: any, 
    routeAgent: Agent, 
    agentsOnBranches: any[],
    zones: any
){
    return async function router(state: typeof GeneralStateAnnotation.State) {
        const llm = initializeLLM();
        const routeLLM = llm.withStructuredOutput(routeSchema);

        const originalAgentX = routeAgent.x;
        const originalAgentY = routeAgent.y;

        await updateStateIcons(zones, "work");

        const decision = await routeLLM.invoke([
            {
              role: "system",
              content: "Route the input to weather-reporter or social-reporter based on the user's request."
            },
            {
              role: "user",
              content: state.routeInput
            },
          ]);

          console.log("router decision: ", decision.step);

          // find agent on the branch
            const agent = agentsOnBranches.find((agent) => agent.branchName === decision.step);

        // send the data to the next agent
        await autoControlAgent(scene, routeAgent, tilemap, agent.agent.x, agent.agent.y, "Send report to final location");

        
        // agent back to original location
        await autoControlAgent(scene, routeAgent, tilemap, originalAgentX, originalAgentY, "Returned");

        
          return { routeDecision: decision.step };        
    };
}

export function routeDecision(state: typeof GeneralStateAnnotation.State){
    if (state.routeDecision === "weather-reporter"){
        return "weather-reporter";
    }
    else if (state.routeDecision === "social-reporter"){
        return "social-reporter";
    }
}

export function constructRouteGraph(
    agents: Agent[],
    scene: any,
    tilemap: any,
    destination: any,
    zones: any
){
    const routeGraph = new StateGraph(GeneralStateAnnotation);

    let startNode = START;

    let remainAgents: any[] = [];
    
    // add nodes
    for (let i = 0; i < agents.length; i++){
        if(i < 2){
            routeGraph.addNode(
                sampleSystemPrompts[i].role, 
                createLeaf(agents[i], scene, tilemap, destination, sampleSystemPrompts[i].prompt, zones)
            );
            remainAgents.push({agent: agents[i], branchName: sampleSystemPrompts[i].role});
        }
        // else {
        //     const agentNode = agents[i].getName();
        //     routeGraph.addNode(agentNode, createLeaf(agents[i], scene, tilemap, destination));
        // }
    }

    routeGraph.addNode("router", createRouter(scene, tilemap, agents[2], remainAgents, zones) as any);
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

