import { Annotation } from "@langchain/langgraph/web";
import { ChatOpenAI } from "@langchain/openai";
import { EventBus } from "../game/EventBus";
import { autoControlAgent, transmitReport } from "../game/utils/controlUtils";
import { updateStateIcons } from "../game/utils/sceneUtils";
import OpenAI from "openai";
import { getStoredOpenAIKey } from '../utils/openai';


const kidneyPath: string = "./data/kidney.csv";
const baseballPath: string = "./data/baseball.csv";

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
    data: Annotation<string>, 
    votingTopic: Annotation<string>,
    votingVotes: Annotation<string[]>({
        default: () => [],
        reducer: (x, y) => x.concat(y),
    }),
    votingToChaining: Annotation<string>, 
    chainFormattedText: Annotation<string>,
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

        // let datasetPath = covidPath;
        let datasetPath = baseballPath;
        let researchQuestions = `
            Across both 1995 and 1996, 
            which player had the better batting average overall? 
            Does this confirm who was the better hitter in each individual year?
        `;

        if(!state.votingToChaining) {
            if(state.votingToChaining.includes("Kidney")){
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
        
        await updateStateIcons(zones, "work", 0);
        await updateStateIcons(scene.chainingZones, "work");

        // const msg = await llm.invoke(promptTable[task] + state.votingToChaining);
        // const msg = await llm.invoke("analyze the given dataset, and provide some insights and conclusions based on the data. The dataset is as follows:\n\n"
        //      + csvRaw + 
        //      "\n\nPlease provide a detailed analysis of the dataset, including any trends, patterns, or anomalies you observe."
        // );
        
        const msg = await getLLM().invoke(
        // const msg = await llm.invoke(
            "you are a journalist, and your work is to analyze the given dataset...\n\n" + 
            `
                Your analysis should answer following questions: 
                ${researchQuestions}
            ` +
            csvRaw +
            agent.getBias()
        );

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

        
        // const msg = await llm.invoke("you are a news writer, based on the given insights, generate a consice news article to summarize that(words<200)" + state.chainFormattedText);

        const msg = await getLLM().invoke(
        // const msg = await llm.invoke(
            "you are a news writer, based on the given insights, generate a consice news article to summarize that(words<200)\n" +
            `
                you should follow the following format:
                # Title: write a compelling title for the news article
                ## Intro: write an engaging short intro for the news article
                ## Section 1: xxxx(you can use a customized sub-title for a description)
                Then, write a detailed description/story of the first section.
            ` + 
            state.chainFormattedText +
            agent.getBias()
          );
        
        
        console.log("writer msg: ", msg.content);

        const reportMessage = `
        \n\n${msg.content}
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
        await transmitReport(scene, report, 767, 330);
        // agent return to original location

        await updateStateIcons(scene.chainingZones, "idle");
        await updateStateIcons(zones, "idle", 1);

        return { chainingToRouting: msg.content };
    }
}
