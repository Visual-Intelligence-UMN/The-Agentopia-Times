import { Annotation, END, START, StateGraph } from "@langchain/langgraph/web";
import { autoControlAgent, transmitReport } from "../game/utils/controlUtils";
import { Agent } from "openai/_shims/index.mjs";
import { initializeLLM } from "./chainingUtils";
import { EventBus } from "../game/EventBus";
import { createReport, GeneralStateAnnotation } from "./agents";
import { updateStateIcons } from "../game/utils/sceneUtils";

export async function parallelVotingExecutor(
    agents: any[],
    scene: any,
    tilemap: any,
    destination: any,
) {
    console.log("[Debug] Starting parallelVotingExecutor...");
    const originalPositions = agents.map(agent => ({ x: agent.x, y: agent.y }));

    // await updateStateIcons(zones, "work");

    const llm = initializeLLM();

    // Create a process for each agent:
    const voteTasks = agents.map(async (agent, index) => {
        console.log(`[Debug] Starting voting process for agent: ${agent.getName()}...`);

        // 1. Move to the voting position
        console.log(`[Debug] Agent ${agent.getName()} is moving to voting location...`);
        await autoControlAgent(scene, agent, tilemap, destination.x, destination.y, "Go vote");
        console.log(`[Debug] Agent ${agent.getName()} has reached the voting location.`);

        
        // agent.anims.play(`${agent.name}_${'player_work'}`, true);
        agent.setAgentState("work");
        

        // 2. Simultaneous initiation of two asynchronous tasks: LLM polling and return to original position
        console.log(`[Debug] Agent ${agent.getName()} is submitting vote to LLM...`);


        let datasetDescription = `The Justice and Jeter Baseball Dataset is a classic example illustrating Simpson's Paradox, where trends observed within individual groups reverse when the groups are combined. In the 1995 and 1996 MLB seasons, David Justice had a higher batting average than Derek Jeter in each year individually. However, when the data from both years are combined, Jeter's overall batting average surpasses Justice's. This counterintuitive result arises because Jeter had significantly more at-bats in 1996—a year in which he performed exceptionally well—while Justice had more at-bats in 1995, when his performance was comparatively lower. The imbalance in the distribution of at-bats across the two years affects the combined averages, leading to the paradoxical outcome. This dataset serves as a compelling demonstration of how aggregated data can sometimes lead to misleading conclusions if underlying subgroup trends and data distributions are not carefully considered. ​`;
        if(scene.registry.get('currentDataset')==='kidney'){
            datasetDescription = `The kidney stone treatment dataset is a renowned real-world example illustrating Simpson’s Paradox, where aggregated data can lead to conclusions that contradict those derived from subgroup analyses. In a 1986 study published in the British Medical Journal, researchers compared two treatments for kidney stones: Treatment A (open surgery) and Treatment B (percutaneous nephrolithotomy). When considering all patients collectively, Treatment B appeared more effective, boasting an overall success rate of 82.6% compared to 78.0% for Treatment A. However, when the data were stratified by stone size, Treatment A demonstrated higher success rates for both small stones (93.1% vs. 86.7%) and large stones (73.0% vs. 68.8%) . This paradox arises because a disproportionate number of patients with small stones—who generally have higher treatment success rates—received Treatment B, skewing the aggregated results. The dataset underscores the importance of considering confounding variables and subgroup analyses in statistical evaluations to avoid misleading conclusions.`;
        }

        const llmPromise = llm.invoke(
            `write a news title for the given topic: ${datasetDescription}; The title is prepared for a news or magazine article about the dataset.`
        );// prompt_change
        console.log(`[Debug] Agent ${agent.getName()} is returning to original location...`);
        const returnPromise = autoControlAgent(scene, agent, tilemap, originalPositions[index].x, originalPositions[index].y, "Return to seat");

        // Wait for LLM result & return actions to complete.
        const [decision] = await Promise.all([llmPromise, returnPromise]);
        console.log(`[Debug] Agent ${agent.getName()} has completed voting and returned to seat.`);

        // 3. Return of voting results
        console.log(`[Debug] Agent ${agent.getName()} vote result: ${decision.content}`);
        return `${agent.getName()}: ${decision.content}`;
    });

    // Wait for all agents to complete the process
    // console.log("[Debug] Waiting for all agents to complete voting...");
    const votes = await Promise.all(voteTasks);
    // console.log("[Debug] All agents have completed voting.");

    return votes;
}

export function createAggregator(
    scene: any, 
    agents: any[], 
    tilemap: any, 
    finalDestination: any,
) {
    return async function aggregator(state: typeof GeneralStateAnnotation.State) {
        console.log("[Debug] Starting aggregator...");
        console.log("aggregator state: ", state.votingVotes);
        let votes = state.votingVotes;
        let llmInput = votes.join("; ");
        const llm = initializeLLM();

        // await updateStateIcons(zones, "work");

        console.log("[Debug] Submitting aggregated votes to LLM...");
        const decision = await llm.invoke(`
            aggregate data: ${llmInput}; 
            return the aggreated result in one title, don't add any other information or quotation marks.
        `);// prompt_change
        console.log("[Debug] Received final decision from LLM.");

        let originalAgent1X = agents[agents.length-1].x;
        let originalAgent1Y = agents[agents.length-1].y;

        // await updateStateIcons(zones, "mail");

        console.log("[Debug] Sending decision to final location...");
        await autoControlAgent(scene, agents[agents.length-1], tilemap, finalDestination.x, finalDestination.y, "Send Decision to Final Location");
        console.log("[Debug] Decision sent to final location.");

        const report = await createReport(scene, "voting", 250, 350);
        await createReport(scene, "voting", 250, 350);


        console.log("[Debug] Returning to office...");
        await autoControlAgent(scene, agents[agents.length-1], tilemap, originalAgent1X, originalAgent1Y, "");
        console.log("[Debug] Returned to office.");

        // await autoControlAgent(scene, report, tilemap, 765, 265, "Send Report to Next Department");
        await transmitReport(scene, report, finalDestination.x, finalDestination.y);

        EventBus.emit("final-report", { report: decision.content, department: "voting" });
        console.log("[Debug] Final report emitted.");

        // await updateStateIcons(zones, "idle");
        console.log("[Debug] Aggregator completed.");

        return { ...state, firstRoomOutput: decision.content };
    };
}

export function constructVotingGraph(
    agents: Agent[],
    scene: any,
    tilemap: any,
    destination: any,
    finalDestination: any,
) {
    console.log("[Debug] Starting to construct voting graph...");
    const votingGraph = new StateGraph(GeneralStateAnnotation as any);

    votingGraph.addNode(
        "votingPhase",
        async (state: any) => {
            console.log("[Debug] Starting voting phase...");
            const votes = await parallelVotingExecutor(
                agents,
                scene,
                tilemap,
                destination,
            );
            console.log("[Debug] Voting phase completed.");
            return { ...state, votingVotes: votes };
        }
    );

    votingGraph.addNode(
        "aggregator",
        async (state: any) => {
            console.log("[Debug] Starting aggregator phase...");
            const decision = await createAggregator(
                scene,
                agents,
                tilemap,
                finalDestination,
            )(state);
            console.log("[Debug] Aggregator phase completed.");
            return { ...state, firstRoomOutput: decision.firstRoomOutput };
        }
    );

    votingGraph.addEdge(START as any, "votingPhase" as any);
    votingGraph.addEdge("votingPhase" as any, "aggregator" as any);
    votingGraph.addEdge("aggregator" as any, END as any);

    console.log("[Debug] Voting graph constructed and compiled.");
    return votingGraph.compile();
}


export const votingExample = `
You are an employee in a news company.
You are assigned to vote for the best theme for next news publication.
There're two options: 
1. Kidney Stone Treatment

This topic compares the success rates of two medical treatments (A and B) for patients with kidney stones. 

We can write a news article about the effectiveness of these treatments, including statistics and expert opinions.

2. Baseball Players Comparison

This topic compared two baseball players in terms of their performance.

We can write a news article about their statistics, achievements, and impact on the game.

Choose one of the two options and give a reason for your choice.
`;