import { Annotation } from "@langchain/langgraph/web";
import { ChatOpenAI } from "@langchain/openai";
import { EventBus } from "../game/EventBus";
import { autoControlAgent, transmitReport } from "../game/utils/controlUtils";
import { updateStateIcons } from "../game/utils/sceneUtils";
import OpenAI from "openai";
import { getStoredOpenAIKey } from '../utils/openai';
import { marked } from "marked";



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
      modelName: "gpt-4o-mini",
    });
  }
  return cachedLLM;
}

// const llm = new ChatOpenAI({
//     apiKey: import.meta.env.VITE_OPENAI_API_KEY,
//     modelName: "gpt-4o-mini",
// });

export const GeneralStateAnnotation = Annotation.Root({
    votingVotes: Annotation<string[]>({
        default: () => [],
        reducer: (x, y) => x.concat(y),
    }), // graph internal state
    firstRoomInput: Annotation<string>, // external state
    firstRoomOutput: Annotation<string>,  // external state
    secondRoomInput: Annotation<string>,  // external state
    secondRoomOutput: Annotation<string>, // external state
    thirdRoomOutput: Annotation<string>,  // external state, thirdroom is visualization room, no input needed
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
    tilemap: any
) {
    return async function journalist(state: typeof GeneralStateAnnotation.State) {
        console.log("journalist state:", state.firstRoomOutput);

        // let datasetPath = covidPath;
        let datasetPath = baseballPath;
        let researchQuestions = `
            Across both 1995 and 1996, 
            which player had the better batting average overall? 
            Does this confirm who was the better hitter in each individual year?
        `;

        if(state.firstRoomOutput) {
            if(scene.registry.get('currentDataset')==='kidney'){
                // datasetPath = ucbPath;
                datasetPath = kidneyPath;
                researchQuestions = `
                    Treatment B has a higher overall success rate across all patients. 
                    Should it be considered more effective than Treatment A?
                `;
            }
        }

        const res = await fetch(datasetPath);
        const csvRaw = await res.text();
        console.log("csvRaw", csvRaw);

        agent.setAgentState("work");
        
        // await updateStateIcons(zones, "work", 0);
        // await updateStateIcons(scene.chainingZones, "work");

        const message = [
            {
                role: "system", 
                content: "You are a data analyst." + agent.getBias()
            },
            {
                role: "user", 
                content: "Your work is to analyze the given dataset..." + csvRaw + ` and answer following questions ${researchQuestions}`
            },
        ];

        const msg = await getLLM().invoke(message);

        console.log("journalist msg:", msg.content);
        const originalAgent1X = agent.x;
        const originalAgent1Y = agent.y;

        // await updateStateIcons(zones, "mail", 0);
        console.log("debug agent pos", destination.x, destination.y);
        await autoControlAgent(scene, agent, tilemap, (destination.x as number), (destination.y as number), "Send Message");
        await autoControlAgent(scene, agent, tilemap, originalAgent1X, originalAgent1Y, "Return to Office");

        // await updateStateIcons(zones, "idle", 0);

        return { secondRoomInput: msg.content };
    };
}

export function createManager(agent: any, scene: any, destination: any, nextRoomDestination: any) {
    return async function Manager(state: typeof GeneralStateAnnotation.State) {
        console.log("journalist state:", state.firstRoomOutput);

        agent.setAgentState("work");
        
        // await updateStateIcons(zones, "work", 0);
        // await updateStateIcons(scene.chainingZones, "work");

        const message = [
            {
                role: "system", 
                content: "You are a manager responsible for fact-checking." + agent.getBias()
            },
            {
                role: "user", 
                content: "your task is to fact check the given insights and make sure they are correct.\n" + state.secondRoomInput
            }
        ];

        const msg = await getLLM().invoke(message);

        console.log("manager msg:", msg.content);
        // await updateStateIcons(zones, "idle", 0);
        await agent.setAgentState("idle");

        await createReport(scene, "chaining", destination.x, destination.y);
        const report = await createReport(scene, "voting", destination.x, destination.y);
        await console.log("report in agent", report);
        // await autoControlAgent(scene, report, tilemap, 530, 265, "Send Report to Next Department");
        await transmitReport(scene, report, nextRoomDestination.x, nextRoomDestination.y);

        return { secondRoomInput: msg.content };
    };
}


export function createWriter(
    agent: any,
    scene: any,
    tilemap: any,
    destination: any
){ 
    return async function writer(state: typeof GeneralStateAnnotation.State){
        console.log("writer state: ", state.secondRoomInput);

        agent.setAgentState("work");
        // await updateStateIcons(zones, "work", 1);

        const message = [
            {
                role: "system", 
                content: "You are a report writer." + agent.getBias()
            },
            {
                role: "user", 
                content: "based on the given insights, generate a consice news article to summarize that(words<200)\n" +
                `
                        you should follow the following format:
                        # Title: write a compelling title for the news article
                        ## Intro:write an engaging short intro for the news article
                        ## Section 1: xxxx(you can use a customized sub-title for a description)
                        Then, write a detailed description/story of the first section.
                    ` + 
                    state.secondRoomInput
            }
        ];

        const msg = await getLLM().invoke(message);

        const rawText = msg.content as string;
        const htmlContent = marked.parse(rawText);
        
        
        
        console.log("writer msg: ", msg.content);

        const reportMessage = `
        <div class="report-body">
            ${htmlContent}
        </div>
        `;

        // const reportMessage = `
        // \n\n${msg.content}
        // `;
    
        EventBus.emit("final-report", { report: reportMessage, department: "chaining" });
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

        return { secondRoomOutput: msg.content };
    }
}
