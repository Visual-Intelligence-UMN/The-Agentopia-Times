import { Annotation } from "@langchain/langgraph/web";
import { ChatOpenAI } from "@langchain/openai";
import { state } from "../game/state";
import { EventBus } from "../game/EventBus";
import { autoControlAgent } from "../game/utils/controlUtils";

const journalistPrompt = [
    "Extract the key information from the input and format it clearly and concisely."
];

const writerPrompt = [
    "Using the structured information provided, write a short news article of 3-5 sentences, ensuring clarity and brevity."
];

const llm = new ChatOpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    modelName: "gpt-4o-mini",
});

export const StateAnnotation = Annotation.Root({
  input: Annotation<string>,
  formattedText: Annotation<string>,
  finalOutput: Annotation<string>,
});

export async function journalist(state: typeof StateAnnotation.State){
    console.log("journalist state: ", state.input);
    const msg = await llm.invoke(journalistPrompt[0] + state.input);
    console.log("journalist msg: ", msg.content);
    // send the data to next agent

    // agent back to original location
    
    return { formattedText: msg.content };
}

export function createJournalist(
    agent: any,
    destination: any,
    scene: any,
    tilemap: any,
) {
    return async function journalist(state: typeof StateAnnotation.State) {
        console.log("journalist state:", state.input);

        const msg = await llm.invoke(journalistPrompt[0] + state.input);
        console.log("journalist msg:", msg.content);
        const originalAgent1X = agent.x;
        const originalAgent1Y = agent.y;
        await autoControlAgent(scene, agent, tilemap, (destination?.x as number), (destination?.y as number), "Send Message");
        await autoControlAgent(scene, agent, tilemap, originalAgent1X, originalAgent1Y, "Return to Office");
        return { formattedText: msg.content };
    };
}


export function createWriter(
    agent: any,
    scene: any,
    tilemap: any,
    destination: any
){ 
    return async function writer(state: typeof StateAnnotation.State){
        console.log("writer state: ", state.formattedText);
        const msg = await llm.invoke(writerPrompt[0] + state.formattedText);
        console.log("writer msg: ", msg.content);
        EventBus.emit("final-report", { report: msg.content });
        // send the final report to final location
        const originalAgent2X = agent.x;
        const originalAgent2Y = agent.y;
        await autoControlAgent(scene, agent, tilemap, destination.x, destination.y, "Send Report to Final Location");
        await autoControlAgent(scene, agent, tilemap, originalAgent2X, originalAgent2Y, "Return to Office");
        // agent return to original location

        return { finalOutput: msg.content };
    }
}



export const testInput = `
Breaking News: Company XYZ's Q3 Report Released

In its latest earnings report for Q3, Company XYZ announced a significant increase in customer satisfaction, reaching 92 points, a noticeable improvement from last quarter. The company also reported a strong annual revenue growth of 45%, exceeding market expectations. 

Additionally, the company's market share has expanded to 23% in its primary sector. A key highlight includes a decline in customer churn from 8% to 5%, reflecting improved customer retention strategies. The cost of acquiring a new user has dropped to $43, while the product adoption rate now stands at 78%. 

Internal performance indicators also show improvements: employee satisfaction has climbed to 87 points, and the company's operating margin reached 34%, marking a significant milestone in financial performance.
`;
