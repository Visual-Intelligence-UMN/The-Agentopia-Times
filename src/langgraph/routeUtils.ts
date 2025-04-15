import { StateGraph, Annotation, START, END } from "@langchain/langgraph/web";
import { z } from "zod";
import { initializeLLM } from "./chainingUtils";
import { autoControlAgent, transmitReport } from "../game/utils/controlUtils";
import { Agent } from "openai/_shims/index.mjs";
import { EventBus } from "../game/EventBus";
import { createReport, GeneralStateAnnotation } from "./agents";
import { updateStateIcons } from "../game/utils/sceneUtils";
import { cleanUpD3Code, generateChartImage } from "./visualizationGenerate";
import { generateImage } from "./dalleUtils";
import { d3Script } from "./const";

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


async function testBranchWork(command: string, state: any, content: string, agent: any){
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

    command = "visualization";
    console.log("command", command);
    
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
        console.log("entered visualization branch")

        const chartData = await generateChartImage(csvRaw, agent, state);

        const svgId1 = chartData.chartId;
        const svgId2 = chartData.chartId;

        const d3Code = chartData.d3Code;

        // EventBus.emit("final-report", { report: content, department: "routing" });
        const URL = await generateImage(`please give me an image based on the following describ or coonect with it: ${content}`);
        console.log("URL", URL)

        

        console.log("d3code", d3Code)

        // eval(d3Script)

        let reportMessage = (await createHighlighter(content)) as any;

        reportMessage = `\n\n\n\n${reportMessage}
        \n\n<img src="${URL}" style="max-width: 50%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />
        \n\n## Visualization I
        \n\n<div id="test-chart" style="
            width: 100%; 
            height: auto;
            display: flex;
            justify-content: center; 
            align-items: center; 
            margin-top: 20px;">
        </div>
        <hr style="width: 100%; height: 3px; background-color: #333; border: none; margin: 20px 0;">
        `;


        const comments = await extractTSArray(await createVisualizationJudge(d3Code));
        console.log("comments from routes", comments, d3Code);

        if(comments){
            reportMessage += `\n\n## Comments on Visualization`;
            for (let i = 0; i < comments.length; i++){
                reportMessage += `\n\n- ${comments[i]}`;
            }
        }

        console.log("reportMessage before stringnify", reportMessage)

        

        console.log("reportMessage after stringnify", reportMessage)

        const writingComments = await extractTSArray(await createWritingJudge(state.chainingToRouting));

        if(writingComments){
            reportMessage += `\n\n## Comments on Writing`;
            for (let i = 0; i < writingComments.length; i++){
                reportMessage += `\n\n- ${writingComments[i]}`;
            }
        }

        
    

        EventBus.emit("final-report", { report: reportMessage, department: "routing" });
    }else{
        console.log("entered illustration branch")
        const URL = await generateImage("please give me an image of a man");
        console.log("URL", URL)
        
        // const arry = `${msg.content}\n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />`;
        
        const reportMessage = `${content}
            \n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />
        `;
        
        EventBus.emit("final-report", { report: reportMessage, department: "routing" });
    }

    return content;
}


async function createHighlighter(message: string) {
    const llm = initializeLLM();
    const systemMssg: string = `
        You are a text highlighter expert.
        Don't remove or modify any html tags in the message.
        Highlight the biased statements in the writing portion(all texts above Visualization I) of the text.
        For example: 

        Message: xxxx, aaaa, bbb. 
        If xxxx is biased, highlight it.
        Then, the output is: 
        <mark>xxxx</mark>, aaaa, bbb. 

        Dont change any other texts in the message.

        ${message}

        return the original message with highlighted texts, 
        but don't change any other texts in the message.
    `;


    console.log("message before highlighter", message)
    const comment = await llm.invoke(systemMssg);
    console.log("message after highligher: ", comment.content);

    console.log("comments from routes llm: ", comment.content);

    return comment.content;
}

async function extractTSArray(raw: any): Promise<string[]> {
    //const trimmed = raw.map((str) => str.trim());
    const clean = raw.replace(/^```typescript\s*|```$/g, "");
    return JSON.parse(clean);
  }
  

export function createLeaf(
    agent: any,
    scene: any,
    tilemap: any,
    destination: any,
    systemPrompt: string = "",
    zones: any,
){
    return async function leaf(state: typeof GeneralStateAnnotation.State) {
        // store the original position
        const originalAgentX = agent.x;
        const originalAgentY = agent.y;

        // move the agent to the destination
        console.log("destination from leaf: ", destination);
        
        testBranchWork(state.routeDecision, state, state.chainingToRouting, agent);

        await updateStateIcons(zones, "mail");

        await autoControlAgent(scene, agent, tilemap, 767, 330, "Send report to final location"); //ERROR
        // create the report from routing graph
        const report = await createReport(scene, "routing", 767, 330);
        // transmit the report to the final location
        await transmitReport(scene, report, destination.x, destination.y);
        // move the agent back to the original position
        await autoControlAgent(scene, agent, tilemap, originalAgentX, originalAgentY, "Returned");

        await updateStateIcons(zones, "idle");

        return { routeOutput: state.chainingToRouting };
    };
}


export async function createVisualizationJudge(message: string) {
    const llm = initializeLLM();
    console.log("message before vis judge", message)
    const systemMssg: string = `
        You are a visualization grammar expert.

Your task is to evaluate a Vega-Lite specification and provide constructive feedback about its quality and correctness. Consider whether the visualization uses appropriate encodings, mark types, and transformations to represent the intended data meaningfully and clearly.

Follow this reasoning process:
1. Examine the Vega-Lite specification carefully.
2. Identify issues such as:
   - Missing or misleading encodings (e.g., using nominal on a quantitative field).
   - Ineffective mark choices (e.g., using bar when line is more suitable).
   - Redundant or invalid transformations.
   - Poor use of scale, axis, or color channels.
   - Incompatibility with common visualization best practices.
3. Note any good practices or well-designed elements.
4. Do **not** check for syntax errors—assume the spec is valid JSON and compiles.

        Now evaluate the following vega-lite code:

        ${message}

        Return your output as a TypeScript-compatible array of strings (string[]). Each element must be a single-sentence observation or judgment (e.g., "This uses a force layout, which is not supported in Vega-Lite.").

        Do not include any additional text—just the array of strings.

        Example Output: 
        [
            "aaaaaaaaaaaaaaaaaaa",
            "bbbbbbbbbbbbbbbbbbb",
            "ccccccccccccccccccc"
        ]
    `;

    const comment = await llm.invoke(systemMssg);

    console.log("comments from routes llm: ", comment.content);

    console.log("message after vis judge", comment.content)

    try {
        // Try parsing response as a JSON array
        return comment.content;
    } catch (e) {
        console.error("Failed to parse comment as string[]:", e);
        return [`Error: LLM response is not a valid string[]: ${comment.content}`];
    }
}

export async function createWritingJudge(message: string) {
    const llm = initializeLLM();
    console.log("message before writing judge", message)
    const systemMssg: string = `
        You are a bias detection expert.
        Carefully evaluate the following text and identify any potential biases or misleading statements.
        Your task is to provide a list of potential biases or misleading statements in the text.

        ${message}

        Return your output as a TypeScript-compatible array of strings (string[]). Each element must be a single-sentence observation or judgment (e.g., "This uses a force layout, which is not supported in Vega-Lite.").

        Do not include any additional text—just the array of strings.
        Do not highlight any texts in the "Comments on Writing" or "Comments on Visualization" sections.

        Example Output: 
        [
            "The data source can be specified in Vega-Lite using a similar dataset.",
            "The chart dimensions and margins can be set using padding and width/height properties in Vega-Lite.",
            "Filtering the data to exclude null values is supported through the filter transformation in Vega-Lite."
        ]
    `;

    const comment = await llm.invoke(systemMssg);

    console.log("comments from routes llm: ", comment.content);

    console.log("message after writing judge", comment.content)

    try {
        // Try parsing response as a JSON array
        return comment.content;
    } catch (e) {
        console.error("Failed to parse comment as string[]:", e);
        return [`Error: LLM response is not a valid string[]: ${comment.content}`];
    }
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

