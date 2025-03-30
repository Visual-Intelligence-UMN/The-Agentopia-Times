// TODO: adding new report interactions
// TODO: animating the report icon
// DONE: hiring UI for each room
// TODO: unifying the backend of langgraph
// TODO: adding task assignment interaction
// TOOD: adding a single-agent pattern for each room

import React from 'react';
import { Annotation } from "@langchain/langgraph/web";
import { ChatOpenAI } from "@langchain/openai";
import { state } from "../game/state";
import { EventBus } from "../game/EventBus";
import { autoControlAgent, transmitReport } from "../game/utils/controlUtils";
import { updateStateIcons } from "../game/utils/sceneUtils";
import OpenAI from "openai";
import * as fs from "fs";

import { generateImage } from "./dalleUtils";
import { generateChartImage } from './visualizationGenerate';


const ucbPath: string = "./data/simulated_ucb.csv"
const covidPath: string = "./data/simulated_covid.csv"
const newPath = ""


export const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true, // This will allow the API key to be used directly in the browser environment
});

export const promptTable = {
    extraction: "Extract the key information from the input and format it clearly and concisely.",
    summary: "Using the structured information provided, write a short news article of 3-5 sentences, ensuring clarity and brevity.",
    analysis: "Analyze the information provided and write a detailed news article of 5-7 sentences, ensuring clarity and coherence.",
    validation: "Validate the information provided and write a comprehensive news article of 7-10 sentences, ensuring clarity and coherence.",
    voting: "Vote for the best options based on the information provided.",
};

const llm = new ChatOpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    modelName: "gpt-4o-mini",
});

export const GeneralStateAnnotation = Annotation.Root({
    data: Annotation<string>, 
    votingTopic: Annotation<string>,
    votingVotes: Annotation<string[]>({
        default: () => [],
        reducer: (x, y) => x.concat(y),
    }),
    votingToChaining: Annotation<string>, 
    // votingDecision: Annotation<string>,
    // chainInput: Annotation<string>,
    chainFormattedText: Annotation<string>,
    // chainOutput: Annotation<string>,
    // routeInput: Annotation<string>,
    chainingToRouting: Annotation<string>,
    routeDecision: Annotation<string>,
    routeOutput: Annotation<string>,
});


export async function createReport(
    scene: any, 
    zoneName: string, 
    x: number, 
    y: number,
) {

    const reportBtn = scene.add.image(x, y, "report")
        .setDepth(1002).setInteractive();
    
    reportBtn.on("pointerdown", () => {
        EventBus.emit("open-report", { department: zoneName });
    console.log("report button clicked", zoneName);
        });


    return reportBtn;

} 

export function createJournalist(
    agent: any,
    destination: any,
    scene: any,
    tilemap: any,
    zones: any,
    task: keyof typeof promptTable
) {
    return async function journalist(state: typeof GeneralStateAnnotation.State) {
        console.log("journalist state:", state.votingToChaining);

        let datasetPath = covidPath;

        if(!state.votingToChaining) {
            if(state.votingToChaining.includes("UCB")){
                datasetPath = ucbPath;
            }
        }

        //const csvRaw = require(datasetPath);
        // const parsedData = csvRaw.split("\n").map(row => row.split(","));
        const res = await fetch(datasetPath);
        const csvRaw = await res.text();
        console.log("csvRaw", csvRaw);
        
        await updateStateIcons(zones, "work", 0);
        await updateStateIcons(scene.chainingZones, "work");

        // const msg = await llm.invoke(promptTable[task] + state.votingToChaining);
        const msg = await llm.invoke("analyze the given dataset, and provide some insights and conclusions based on the data. The dataset is as follows:\n\n"
             + csvRaw + 
             "\n\nPlease provide a detailed analysis of the dataset, including any trends, patterns, or anomalies you observe."
        );
        console.log("journalist msg:", msg.content);
        const originalAgent1X = agent.x;
        const originalAgent1Y = agent.y;

        // testing for LLM signaling for visualization creation
        // const visCode = await generateChartImage(csvRaw);
        // console.log("visCode", visCode);
        // EventBus.emit("d3-code", { d3Code: visCode });

        await updateStateIcons(zones, "mail", 0);

        await autoControlAgent(scene, agent, tilemap, (destination?.x as number), (destination?.y as number), "Send Message");
        await autoControlAgent(scene, agent, tilemap, originalAgent1X, originalAgent1Y, "Return to Office");

        await updateStateIcons(zones, "idle", 0);

        return { chainFormattedText: msg.content };
    };
}


export function createWriter(
    agent: any,
    scene: any,
    tilemap: any,
    destination: any,
    zones: any,
    task: keyof typeof promptTable
){ 
    return async function writer(state: typeof GeneralStateAnnotation.State){
        console.log("writer state: ", state.chainFormattedText);

        await updateStateIcons(zones, "work", 1);

        const msg = await llm.invoke("you are a news writer, based on the given insights, generate a consice news article to summarize that(words<200)" + state.chainFormattedText);
        console.log("writer msg: ", msg.content);

        // const URL = await generateImage("please give me an image of a man");
        // console.log("URL", URL)

        // // const arry = `${msg.content}\n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />`;

        // const reportMessage = `${msg.content}
        //     \n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />
        //     \n\n**Conclusion:**
        //     \n\nThis image complements the textual output and helps visualize the content more effectively.
        //     \n\nBy integrating both textual and visual information, we are able to provide a more comprehensive and intuitive understanding of the subject matter. The generated image not only supports the descriptive elements provided earlier, but also adds clarity and engagement for users who benefit from visual representation. Such multimodal outputs enhance interpretability, especially in contexts that require abstract reasoning, conceptual associations, or aesthetic appreciation.
        //     \n\nMoreover, incorporating images generated dynamically through language model prompts opens up new possibilities for creative storytelling, education, simulation, and even product prototyping. In this case, the image acts as an extension of the language output—bridging the gap between imagination and representation. This seamless chaining of models demonstrates the growing power of composable AI workflows, enabling richer, more expressive applications than ever before.
        // `;

        EventBus.emit("final-report", { report: msg.content, department: "chaining" });
        // send the final report to final location
        const originalAgent2X = agent.x;
        const originalAgent2Y = agent.y;

        await updateStateIcons(zones, "mail", 1);
        await updateStateIcons(scene.chainingZones, "mail");     
        
        await autoControlAgent(scene, agent, tilemap, destination.x, destination.y, "Send Report to Final Location");
        await createReport(scene, "chaining", destination.x, destination.y);
        const report = await createReport(scene, "voting", destination.x, destination.y);
        await autoControlAgent(scene, agent, tilemap, originalAgent2X, originalAgent2Y, "Return to Office");
        await console.log("report in agent", report);
        // await autoControlAgent(scene, report, tilemap, 530, 265, "Send Report to Next Department");
        await transmitReport(scene, report, 767, 130);
        // agent return to original location

        await updateStateIcons(scene.chainingZones, "idle");
        await updateStateIcons(zones, "idle", 1);

        return { chainingToRouting: msg.content };
    }
}



export const testInput = `
Breaking News: Company XYZ's Q3 Report Released
In its latest earnings report for Q3, Company XYZ announced a significant increase in customer satisfaction, reaching 92 points, a noticeable improvement from last quarter. The company also reported a strong annual revenue growth of 45%, exceeding market expectations. 
Additionally, the company's market share has expanded to 23% in its primary sector. A key highlight includes a decline in customer churn from 8% to 5%, reflecting improved customer retention strategies. The cost of acquiring a new user has dropped to $43, while the product adoption rate now stands at 78%. 
Internal performance indicators also show improvements: employee satisfaction has climbed to 87 points, and the company's operating margin reached 34%, marking a significant milestone in financial performance.
`;
