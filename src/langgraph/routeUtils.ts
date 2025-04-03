import { StateGraph, Annotation, START, END } from "@langchain/langgraph/web";
import { z } from "zod";
import { initializeLLM } from "./chainingUtils";
import { autoControlAgent, transmitReport } from "../game/utils/controlUtils";
import { Agent } from "openai/_shims/index.mjs";
import { EventBus } from "../game/EventBus";
import { createReport, GeneralStateAnnotation } from "./agents";
import { updateStateIcons } from "../game/utils/sceneUtils";
import { generateChartImage } from "./visualizationGenerate";
import { generateImage } from "./dalleUtils";

// const RouteAnnotation = Annotation.Root({
//     input: Annotation<string>,
//     decision: Annotation<string>,
//     output: Annotation<string>,
// });


const ucbPath: string = "./data/simulated_ucb.csv"
const covidPath: string = "./data/simulated_covid.csv"

const routeSchema = z.object({
    step: z.enum(["visualization", "illustration"]).describe(
      "The next step in the routing process"
    ),
});

const sampleSystemPrompts = [
    {
        role: "visualization", 
        prompt: "write a short report(<100words) about weather in New York City"
    },
    {
        role: "illustration", 
        prompt: "write a short report(<100words) about social trends among teenagers in the US"
    },
];


async function testBranchWork(command: string, state: any, content: string){
    let datasetPath = covidPath;

    console.log("state route", state);

        if(!state.votingToChaining) {
            if(state.votingToChaining.includes("UCB")){
                datasetPath = ucbPath;
            }
        }

        const res = await fetch(datasetPath);
        const csvRaw = await res.text();
        console.log("csvRaw", csvRaw);
    
    if(command === "visualization"){
        // const chartId1 = `chart-${Math.random().toString(36).substr(2, 9)}`;
        // console.log("cgartId1", chartId1)
        // const visCode1 = await generateChartImage(chartId1, csvRaw);
        // console.log("visCode", visCode1);
        // EventBus.emit("d3-code", { d3Code: visCode1, id: chartId1});

        // const chartId2 = `chart-${Math.random().toString(36).substr(2, 9)}`;
        // console.log("cgartId2", chartId2)
        // const visCode2 = await generateChartImage(chartId2, csvRaw);
        // console.log("visCode", visCode2);
        // EventBus.emit("d3-code", { d3Code: visCode2, id: chartId2});

        const svgId1 = await generateChartImage(csvRaw);
        const svgId2 = await generateChartImage(csvRaw);

        // EventBus.emit("final-report", { report: content, department: "routing" });
        const URL = await generateImage(`please give me an image based on the following describ or coonect with it: ${content}`);
        console.log("URL", URL)

        const reportMessage = `\n\n\n\n${content}
        \n\n<img src="${URL}" style="max-width: 50%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />
        \n\n## Visual Representation
        \n\nThis image visually represents the core concept discussed above, bringing clarity to the complex data. It highlights key trends and relationships, giving the viewer an immediate understanding of the subject matter.
        
        \n\nThe above graph is designed to enhance comprehension, showing not just raw data but the story behind it. As with all visual tools, this graph serves as a bridge between data and human understanding, ensuring a deeper connection with the material.
    
        \n\n<div id="${svgId1}" style="
            width: 100%; /* 确保容器宽度自适应 */
            height: auto;
            display: flex;
            justify-content: center; /* 水平居中 */
            align-items: center; /* 垂直居中 */
            margin-top: 20px;">
        </div>
        <hr style="width: 100%; height: 3px; background-color: #333; border: none; margin: 20px 0;">
        \n\n## Conclusion
        \n\nThis image complements the textual output and helps visualize the content more effectively.
        \n\nBy integrating both textual and visual information, we are able to provide a more comprehensive and intuitive understanding of the subject matter. The generated image not only supports the descriptive elements provided earlier, but also adds clarity and engagement for users who benefit from visual representation. Such multimodal outputs enhance interpretability, especially in contexts that require abstract reasoning, conceptual associations, or aesthetic appreciation.
        
        \n\nMoreover, incorporating images generated dynamically through language model prompts opens up new possibilities for creative storytelling, education, simulation, and even product prototyping. In this case, the image acts as an extension of the language output—bridging the gap between imagination and representation. This seamless chaining of models demonstrates the growing power of composable AI workflows, enabling richer, more expressive applications than ever before.
            \n\n<div id="${svgId2}" style="
            width: 100%; /* 确保容器宽度自适应 */
            height: auto;
            display: flex;
            justify-content: center; /* 水平居中 */
            align-items: center; /* 垂直居中 */
            margin-top: 20px;"></div>
        `;
    

        EventBus.emit("final-report", { report: reportMessage, department: "routing" });
    }else{
        const URL = await generateImage("please give me an image of a man");
        console.log("URL", URL)
        
        // const arry = `${msg.content}\n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />`;
        
        const reportMessage = `${content}
            \n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />
            \n\n**Conclusion:**
            \n\nThis image complements the textual output and helps visualize the content more effectively.
            \n\nBy integrating both textual and visual information, we are able to provide a more comprehensive and intuitive understanding of the subject matter. The generated image not only supports the descriptive elements provided earlier, but also adds clarity and engagement for users who benefit from visual representation. Such multimodal outputs enhance interpretability, especially in contexts that require abstract reasoning, conceptual associations, or aesthetic appreciation.
            \n\nMoreover, incorporating images generated dynamically through language model prompts opens up new possibilities for creative storytelling, education, simulation, and even product prototyping. In this case, the image acts as an extension of the language output—bridging the gap between imagination and representation. This seamless chaining of models demonstrates the growing power of composable AI workflows, enabling richer, more expressive applications than ever before.
        `;
        
        EventBus.emit("final-report", { report: reportMessage, department: "routing" });
    }

    return content;
}


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
        
        testBranchWork(state.routeDecision, state, state.chainingToRouting);

        await updateStateIcons(zones, "mail");

        await autoControlAgent(scene, agent, tilemap, 767, 130, "Send report to final location"); //ERROR
        // create the report from routing graph
        const report = await createReport(scene, "routing", 767, 130);
        // transmit the report to the final location
        await transmitReport(scene, report, destination.x, destination.y);
        // move the agent back to the original position
        await autoControlAgent(scene, agent, tilemap, originalAgentX, originalAgentY, "Returned");

        await updateStateIcons(zones, "idle");

        return { routeOutput: state.chainingToRouting };
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

        console.log("checking for data", state)

        await updateStateIcons(zones, "work");

        const decision = await routeLLM.invoke([
            {
              role: "system",
              content: "Route the input to visualization or illustration based on the user's request."
            },
            {
              role: "user",
              content: state.chainingToRouting
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
    if (state.routeDecision === "visualization"){
        return "visualization";
    }
    else if (state.routeDecision === "illustration"){
        return "illustration";
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
            ["visualization", "illustration"] as any
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

