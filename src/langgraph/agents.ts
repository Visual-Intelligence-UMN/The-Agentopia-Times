import { Annotation } from "@langchain/langgraph/web";
import { ChatOpenAI } from "@langchain/openai";
import { EventBus } from "../game/EventBus";
import { autoControlAgent, transmitReport } from "../game/utils/controlUtils";
import { updateStateIcons } from "../game/utils/sceneUtils";
import OpenAI from "openai";
import { getStoredOpenAIKey } from '../utils/openai';
import { marked } from "marked";
import { SequentialGraphStateAnnotation } from "./states";
import { sequential } from "../game/assets/sprites";
import { dataFetcher, returnDatasetDescription, startDataFetcher, startHTMLConstructor, startJudges, startScoreComputer, startTextMessager, startVisualizer } from "./workflowUtils";
import { generateChartImage } from "./visualizationGenerate";
import { baseballDatasetStatistic, biasedBaseballDatasetStatistic, biasedKidneyDatasetStatistic, kidneyDatasetStatistic } from "../const";



export const kidneyPath: string = "./data/kidney.csv";
export const baseballPath: string = "./data/baseball_cleaned.csv";

let cachedOpenAI: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!cachedOpenAI) {
    const apiKey = getStoredOpenAIKey();
    if (!apiKey) throw new Error("❌ OpenAI API key not set.");
    cachedOpenAI = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }
  return cachedOpenAI;
}

// export const openai = new OpenAI({
//     apiKey: import.meta.env.VITE_OPENAI_API_KEY,
//     dangerouslyAllowBrowser: true, // This will allow the API key to be used directly in the browser environment
// });

export const promptTable = {
    extraction: "Extract the key information from the input and format it clearly and concisely.",
    summary: "Using the structured information provided, write a short news article of 3-5 sentences, ensuring clarity and brevity.",
    analysis: "Analyze the information provided and write a detailed news article of 5-7 sentences, ensuring clarity and coherence.",
    validation: "Validate the information provided and write a comprehensive news article of 7-10 sentences, ensuring clarity and coherence.",
    voting: "Vote for the best options based on the information provided.",
};

let cachedLLM: ChatOpenAI | null = null;

export function getLLM() {
  if (!cachedLLM) {
    const apiKey = getStoredOpenAIKey();
    if (!apiKey) {
      throw new Error("OpenAI API Key is not set.");
    }

    cachedLLM = new ChatOpenAI({
      apiKey,
      modelName: "gpt-4o",
    });
  }
  return cachedLLM;
}

export async function createReport(
    scene: any, 
    zoneName: string, 
    index: number,
    x: number, 
    y: number,
) {

    const reportBtn = scene.add.image(x, y, "report")
        .setDepth(1002).setInteractive();
    
    reportBtn.on("pointerdown", () => {
        EventBus.emit("open-report", { department: zoneName+"-"+index });
    console.log("report button clicked", zoneName+"-"+index);
        });


    return reportBtn;

} 

export function createJournalist(
    agent: any,
    destination: any,
    scene: any,
    tilemap: any,
    index: number
) {
    return async function journalist(state: typeof SequentialGraphStateAnnotation.State) {
        console.log("journalist state:", state.sequentialInput);

        // const message = await startDataFetcher(scene, state, agent);

        // const msg = await getLLM().invoke(message);
        let msg:any = '';
        if (index === 0) {
            let datasetDescription = returnDatasetDescription(scene);
            let roleContent = `You are a newspaper editorial, you need to return a title based on the dataset description.`;
            let userContent = `write a news title for the given topic: ${datasetDescription}; The title is prepared for a news or magazine article about the dataset.`;
            msg = await startTextMessager(roleContent, userContent);
        } else if (index === 1) {
            msg = await startDataFetcher(scene, agent);
        } else if (index === 2) {
            // generating visualization code
            msg = await generateChartImage(scene, agent);
        }


        console.log("graph:1st agent msg:", msg.content);
        const originalAgent1X = agent.x;
        const originalAgent1Y = agent.y;

        // await updateStateIcons(zones, "mail", 0);
        console.log("debug agent pos", destination.x, destination.y);
        await autoControlAgent(scene, agent, tilemap, (destination.x as number), (destination.y as number), "Send Message");
        await autoControlAgent(scene, agent, tilemap, originalAgent1X, originalAgent1Y, "Return to Office");

        // await updateStateIcons(zones, "idle", 0);

        if(index===2){
            return {sequentialFirstAgentOutput: msg};
        }

        return { sequentialFirstAgentOutput: msg.content };
    };
}

export function createManager(
    agent: any, 
    scene: any, 
    destination: any, 
    nextRoomDestination: any,
    index: number
) {
    return async function Manager(state: typeof SequentialGraphStateAnnotation.State) {
        console.log("journalist state:", state.sequentialInput);

        agent.setAgentState("work");

        let stats = biasedBaseballDatasetStatistic
        if(scene.registry.get("currentDataset") === "kidney"){
            stats = biasedKidneyDatasetStatistic;
        }

        let msg:any = '';
        let scoreData:any = {};
        if (index === 0) {
            let datasetDescription = returnDatasetDescription(scene);
            let roleContent = `You are a newspaper editorial, you need to return a title based on the dataset description.`;
            let userContent = `write a news title for the given topic: ${datasetDescription}; The title is prepared for a news or magazine article about the dataset.`;
            msg = await startTextMessager(roleContent, userContent);
        } else if (index === 1) {
            if(agent.getBias() === ''){
            const roleContent = "You are a manager responsible for fact-checking." + agent.getBias();
            const userContent = "your task is to refine the paragraph. Only return the article. \n" + 
            state.sequentialSecondAgentOutput;

            msg = await startTextMessager(roleContent, userContent);
        }else {
            const roleContent = "You are a manager responsible for fact-checking." + agent.getBias();
            const userContent = "your task is to refine the paragraph. Only return the article. \n" + 
            state.sequentialSecondAgentOutput + "\n" +
            `Here are some statistics about the dataset: ${stats}` + "based on the statistics, you need to refine the paragraph and make sure it is accurate and follow the statistical facts. "

            msg = await startTextMessager(roleContent, userContent);
        }
        } else if (index === 2) {
            // generating visualization code
            const code = state.sequentialFirstAgentOutput.d3Code;
            const id = state.sequentialFirstAgentOutput.chartId;
            const roleContent = `
                    You are a Vega-Lite visualization expert.

                    Your task is to verify and improve a given Vega-Lite specification.

                    Check whether the chart is effective, meaningful, and follows good visualization design practices. 
                    Fix issues such as:
                    - Wrong or suboptimal mark types
                    - Misused encodings (e.g., using nominal for quantitative fields)
                    - Missing or unclear axis titles or labels
                    - Redundant or invalid transformations
                    - Lack of a title or legend when necessary

                    Do not explain your edits. Only return the improved Vega-Lite specification as valid JSON.

                    Never wrap the output in markdown or code fences. Do not include any commentary or justification.`;
            const userContent = `
            Please verify and improve the following Vega-Lite specification:

            ${code} 
            `;

            msg = await startTextMessager(roleContent, userContent);

            let chartData = { d3Code: code, chartId: id };
                        EventBus.emit('d3-code', chartData);
                        let judgeData = await startJudges(
                            msg.content,
                            state.sequentialInput,
                        );
                        await startHTMLConstructor(
                            judgeData.comments,
                            judgeData.writingComments,
                            judgeData.highlightedText,
                            'Report',
                            'chaining',
                            index
                        );
            

            scoreData = startScoreComputer(judgeData);
        }

        // const msg = await getLLM().invoke(message);

        console.log("graph:3rd agent msg:", msg.content);
        // await updateStateIcons(zones, "idle", 0);
        await agent.setAgentState("idle");

        await createReport(scene, "chaining", index, destination.x, destination.y);
        const report = await createReport(scene, "chaining", index, destination.x, destination.y);
        await console.log("report in agent", report);
        // await autoControlAgent(scene, report, tilemap, 530, 265, "Send Report to Next Department");
        await transmitReport(scene, report, nextRoomDestination.x, nextRoomDestination.y);

        if(index === 2)return { sequentialOutput: msg.content, scoreData: scoreData };
        return { sequentialOutput: msg.content };
    };
}


export function createWriter(
    agent: any,
    scene: any,
    tilemap: any,
    destination: any,
    index: number
){ 
    return async function writer(state: typeof SequentialGraphStateAnnotation.State){
        console.log("writer state: ", state.sequentialFirstAgentOutput);

        agent.setAgentState("work");

        let bias = "";
        if(agent.getBias() !== ''){
        if(scene.registry.get("currentDataset") === "baseball"){
            bias = biasedBaseballDatasetStatistic;
        }else {
bias = biasedKidneyDatasetStatistic;
        }
    }

        let msg:any = '';
        if (index === 0) {
            let datasetDescription = returnDatasetDescription(scene);
            let roleContent = `You are a newspaper editorial, you need to return a title based on the dataset description.`;
            let userContent = `write a news title for the given topic: ${datasetDescription}; The title is prepared for a news or magazine article about the dataset.`;
            msg = await startTextMessager(roleContent, userContent);
        } else if (index === 1) {
            let userContent = "based on the given insights, generate a consice news article to summarize that(words<200)\n" +
                `
                        you should follow the following format:
                        # Title: write a compelling title for the news article
                        ## Intro:write an engaging short intro for the news article
                        ## Section 1: xxxx(you can use a customized sub-title for a description)
                        Then, write a detailed description/story of the first section.
                    ` + 
                    state.sequentialFirstAgentOutput
            let roleContent = "You are a report writer." + agent.getBias();
            if(agent.getBias() !== ''){
                userContent += `\nHere are some statistics about the dataset, based on these statistics not the given insights to write the paragrpah, if there're some statement in insights that not follow these statistical facts, use these statistical facts: ${bias}`;
            }
            msg = await startTextMessager(roleContent, userContent);
        } else if (index === 2) {
            // generating visualization code
            const code = state.sequentialFirstAgentOutput.d3Code;
            const roleContent = `
                    You are a Vega-Lite visualization expert.

                    Your task is to verify and improve a given Vega-Lite specification.

                    Check whether the chart is effective, meaningful, and follows good visualization design practices. 
                    Fix issues such as:
                    - Wrong or suboptimal mark types
                    - Misused encodings (e.g., using nominal for quantitative fields)
                    - Missing or unclear axis titles or labels
                    - Redundant or invalid transformations
                    - Lack of a title or legend when necessary

                    Do not explain your edits. Only return the improved Vega-Lite specification as valid JSON.

                    Never wrap the output in markdown or code fences. Do not include any commentary or justification.`;
            const userContent = `
            Please verify and improve the following Vega-Lite specification:

            ${code} 
            `;

            msg = await startTextMessager(roleContent, userContent);
            
        }

        const rawText = msg.content as string;
        const htmlContent = marked.parse(rawText);
        
        
        
        console.log("graph:2nd agent msg: ", msg.content);

        const reportMessage = `
        <div class="report-body">
            ${htmlContent}
        </div>
        `;

        // const reportMessage = `
        // \n\n${msg.content}
        // `;
    
        EventBus.emit("final-report", { report: reportMessage, department: "chaining"+"-"+index });
        // send the final report to final location
        const originalAgent2X = agent.x;
        const originalAgent2Y = agent.y;

        // await updateStateIcons(zones, "mail", 1);
        // await updateStateIcons(scene.chainingZones, "mail");     
        
        await autoControlAgent(scene, agent, tilemap, destination.x, destination.y, "Send Report to Final Location");
        
        await autoControlAgent(scene, agent, tilemap, originalAgent2X, originalAgent2Y, "");
        
        // agent return to original location

        // await updateStateIcons(scene.chainingZones, "idle");
        // await updateStateIcons(zones, "idle", 1);

        return { sequentialSecondAgentOutput: msg.content };
    }
}
