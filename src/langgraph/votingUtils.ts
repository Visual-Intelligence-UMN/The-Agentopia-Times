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
    zones: any,
    votingTopic: string
) {
    console.log("[Debug] Starting parallelVotingExecutor...");
    const originalPositions = agents.map(agent => ({ x: agent.x, y: agent.y }));
    await updateStateIcons(zones, "work");

    const llm = initializeLLM();

    // Create a process for each agent:
    const voteTasks = agents.map(async (agent, index) => {
        console.log(`[Debug] Starting voting process for agent: ${agent.getName()}...`);

        // 1. Move to the voting position
        console.log(`[Debug] Agent ${agent.getName()} is moving to voting location...`);
        await autoControlAgent(scene, agent, tilemap, destination.x, destination.y, "Go vote");
        console.log(`[Debug] Agent ${agent.getName()} has reached the voting location.`);

        // 2. Simultaneous initiation of two asynchronous tasks: LLM polling and return to original position
        console.log(`[Debug] Agent ${agent.getName()} is submitting vote to LLM...`);
        const llmPromise = llm.invoke(
            `Vote for: ${votingTopic}. Please select only one option as your final decision.`
        );
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
    zones: any
) {
    return async function aggregator(state: typeof GeneralStateAnnotation.State) {
        console.log("[Debug] Starting aggregator...");
        console.log("aggregator state: ", state.votingVotes);
        let votes = state.votingVotes;
        let llmInput = votes.join("; ");
        const llm = initializeLLM();

        await updateStateIcons(zones, "work");

        console.log("[Debug] Submitting aggregated votes to LLM...");
        const decision = await llm.invoke(`aggregate vote: ${llmInput}; return the final result from this voting as the decision`);
        console.log("[Debug] Received final decision from LLM.");

        let originalAgent1X = agents[agents.length-1].x;
        let originalAgent1Y = agents[agents.length-1].y;

        await updateStateIcons(zones, "mail");

        console.log("[Debug] Sending decision to final location...");
        await autoControlAgent(scene, agents[agents.length-1], tilemap, finalDestination.x, finalDestination.y, "Send Decision to Final Location");
        console.log("[Debug] Decision sent to final location.");

        const report = await createReport(scene, "voting", 522, 130);

        console.log("[Debug] Returning to office...");
        await autoControlAgent(scene, agents[agents.length-1], tilemap, originalAgent1X, originalAgent1Y, "Return to Office");
        console.log("[Debug] Returned to office.");

        // await autoControlAgent(scene, report, tilemap, 765, 265, "Send Report to Next Department");
        await transmitReport(scene, report, finalDestination.x, finalDestination.y);

        EventBus.emit("final-report", { report: decision.content, department: "voting" });
        console.log("[Debug] Final report emitted.");

        await updateStateIcons(zones, "idle");
        console.log("[Debug] Aggregator completed.");

        return { ...state, votingDecision: decision.content };
    };
}

export function constructVotingGraph(
    agents: Agent[],
    scene: any,
    tilemap: any,
    destination: any,
    finalDestination: any,
    zones: any
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
                zones,
                state.votingTopic
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
                zones
            )(state);
            console.log("[Debug] Aggregator phase completed.");
            return { ...state, votingDecision: decision.votingDecision };
        }
    );

    votingGraph.addEdge(START as any, "votingPhase" as any);
    votingGraph.addEdge("votingPhase" as any, "aggregator" as any);
    votingGraph.addEdge("aggregator" as any, END as any);

    console.log("[Debug] Voting graph constructed and compiled.");
    return votingGraph.compile();
}

export const votingExample = `
In a bustling newsroom, journalists are locked in a heated debate over the next issue’s front-page story. The editor-in-chief raps on the table, calling for order. “We need a quick vote to decide our headline!”  

On the large screen at the front of the room, two options appear:  

**Option A: Political Scandal Uncovered**  
A prominent politician has been exposed for accepting bribes and abusing power to benefit a particular corporation. An exclusive investigation has unearthed evidence of insider deals, potentially triggering a nationwide controversy.  

**Option B: Groundbreaking Tech Shocks the World**  
A startup has announced a revolutionary breakthrough in artificial intelligence that could transform the journalism industry. Experts are debating whether this technology will assist reporters or ultimately replace some of their roles, sparking discussions about the future of news.  
`;
