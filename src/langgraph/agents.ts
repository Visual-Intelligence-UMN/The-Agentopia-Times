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

import { generateImage } from "./dalleUtils";


export const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true, // This will allow the API key to be used directly in the browser environment
});

const journalistPrompt = [
    "Extract the key information from the input and format it clearly and concisely."
];

const writerPrompt = [
    "Using the structured information provided, write a short news article of 3-5 sentences, ensuring clarity and brevity."
];

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
    chainInput: Annotation<string>,
    chainFormattedText: Annotation<string>,
    chainOutput: Annotation<string>,
    votingTopic: Annotation<string>,
    votingVotes: Annotation<string[]>({
        default: () => [],
        reducer: (x, y) => x.concat(y),
    }),
    votingDecision: Annotation<string>,
    routeInput: Annotation<string>,
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
        console.log("journalist state:", state.chainInput);

        
        await updateStateIcons(zones, "work", 0);
        await updateStateIcons(scene.chainingZones, "work");

        const msg = await llm.invoke(promptTable[task] + state.chainInput);
        console.log("journalist msg:", msg.content);
        const originalAgent1X = agent.x;
        const originalAgent1Y = agent.y;

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

        const msg = await llm.invoke(promptTable[task] + state.chainFormattedText);
        console.log("writer msg: ", msg.content);

        const URL = await generateImage("please give me an image of a company meeting with the boss and employers");
        console.log("URL", URL)

        // const arry = `${msg.content}\n\n<img src="${URL}" style="max-width: 80%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />`;

        const reportMessage = `# This is the titile
        \n\n\n\n${msg.content}
        \n\n<img src="${URL}" style="max-width: 50%; height: auto; border-radius: 8px; margin: 10px auto; display: block;" />
        \n\n## Visual Representation
        \n\nThis image visually represents the core concept discussed above, bringing clarity to the complex data. It highlights key trends and relationships, giving the viewer an immediate understanding of the subject matter.
        
        \n\nThe above graph is designed to enhance comprehension, showing not just raw data but the story behind it. As with all visual tools, this graph serves as a bridge between data and human understanding, ensuring a deeper connection with the material.
    
        \n\n<div id="testdiv1" style="
                width: 100%; /* 确保容器宽度自适应 */
                height: auto;
                display: flex;
                justify-content: center; /* 水平居中 */
                align-items: center; /* 垂直居中 */
                margin-top: 20px;">
            <p>Below, you'll see an interactive bar chart that dynamically adjusts based on the data visualized. The chart provides insight into the trends and distributions in a more detailed and engaging way. The chart is created using D3.js, and you can interact with it to see how values vary across categories.</p>
        </div>
        <hr style="width: 100%; height: 3px; background-color: #333; border: none; margin: 20px 0;">
        \n\n## Conclusion
        \n\nThis image complements the textual output and helps visualize the content more effectively.
        \n\nBy integrating both textual and visual information, we are able to provide a more comprehensive and intuitive understanding of the subject matter. The generated image not only supports the descriptive elements provided earlier, but also adds clarity and engagement for users who benefit from visual representation. Such multimodal outputs enhance interpretability, especially in contexts that require abstract reasoning, conceptual associations, or aesthetic appreciation.
        
        \n\nMoreover, incorporating images generated dynamically through language model prompts opens up new possibilities for creative storytelling, education, simulation, and even product prototyping. In this case, the image acts as an extension of the language output—bridging the gap between imagination and representation. This seamless chaining of models demonstrates the growing power of composable AI workflows, enabling richer, more expressive applications than ever before.
        \n\n<div id="testdiv2" style="
            width: 100%; /* 确保容器宽度自适应 */
            height: auto;
            display: flex;
            justify-content: center; /* 水平居中 */
            align-items: center; /* 垂直居中 */
            margin-top: 20px;">
        `;
    

        EventBus.emit("final-report", { report: reportMessage, department: "chaining" });
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
        await transmitReport(scene, report, 522, 130);
        // agent return to original location

        await updateStateIcons(scene.chainingZones, "idle");
        await updateStateIcons(zones, "idle", 1);

        return { chainFinalOutput: msg.content };
    }
}



export const testInput = `
Breaking News: Company XYZ's Q3 Report Released
In its latest earnings report for Q3, Company XYZ announced a significant increase in customer satisfaction, reaching 92 points, a noticeable improvement from last quarter. The company also reported a strong annual revenue growth of 45%, exceeding market expectations. 
Additionally, the company's market share has expanded to 23% in its primary sector. A key highlight includes a decline in customer churn from 8% to 5%, reflecting improved customer retention strategies. The cost of acquiring a new user has dropped to $43, while the product adoption rate now stands at 78%. 
Internal performance indicators also show improvements: employee satisfaction has climbed to 87 points, and the company's operating margin reached 34%, marking a significant milestone in financial performance.
`;
