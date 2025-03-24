// TODO: adding new report interactions
// TODO: animating the report icon
// DONE: hiring UI for each room
// TODO: unifying the backend of langgraph
// TODO: adding task assignment interaction
// TOOD: adding a single-agent pattern for each room

import { Annotation } from "@langchain/langgraph/web";
import { ChatOpenAI } from "@langchain/openai";
import { state } from "../game/state";
import { EventBus } from "../game/EventBus";
import { autoControlAgent, transmitReport } from "../game/utils/controlUtils";
import { updateStateIcons } from "../game/utils/sceneUtils";

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


export async function createReport(scene: any, zoneName: string, x: number, y: number) {

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
    zones: any
) {
    return async function journalist(state: typeof GeneralStateAnnotation.State) {
        console.log("journalist state:", state.chainInput);

        
        await updateStateIcons(zones, "work", 0);
        await updateStateIcons(scene.chainingZones, "work");

        const msg = await llm.invoke(journalistPrompt[0] + state.chainInput);
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
    zones: any
){ 
    return async function writer(state: typeof GeneralStateAnnotation.State){
        console.log("writer state: ", state.chainFormattedText);

        await updateStateIcons(zones, "work", 1);

        const msg = await llm.invoke(writerPrompt[0] + state.chainFormattedText);
        console.log("writer msg: ", msg.content);
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
