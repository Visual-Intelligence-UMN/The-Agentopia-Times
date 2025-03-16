import { Annotation, END, START, StateGraph } from "@langchain/langgraph/web";
import { autoControlAgent } from "../game/utils/controlUtils";
import { Agent } from "openai/_shims/index.mjs";
import { initializeLLM } from "./langgraphUtils";
import { EventBus } from "../game/EventBus";

export const VotingState = Annotation.Root({
    topic: Annotation<string>,
    votes: Annotation<string[]>({
        default: () => [],
        reducer: (x, y) => x.concat(y),
    }),
    decision: Annotation<string>,
});

export function createVoter(
    agent: any,
    scene: any,
    tilemap: any,
    destination: any
) {
    return async function voter(state: typeof VotingState.State) {
        console.log("voter state: ", state);

        const originalAgent1X = agent.x;
        const originalAgent1Y = agent.y;

        await autoControlAgent(scene, agent, tilemap, (destination?.x as number), (destination?.y as number), "Voted");

        const llm = initializeLLM();

        const decision = await llm.invoke(`Vote for ${state.topic}, select only one option as your final decision`);

        await autoControlAgent(scene, agent, tilemap, originalAgent1X, originalAgent1Y, "Return to Seat");

        console.log(`Agent ${agent.getName()} voted: ${decision.content}`);

        return { ...state, votes: state.votes.concat(`${agent.getName()}: ${decision.content}`) };
    };
}

export function createAggregator() {
    return async function aggregator(state: typeof VotingState.State) {
        console.log("aggregator state: ", state.votes);
        let votes = state.votes;
        let llmInput = votes.join("; ");
        const llm = initializeLLM();
        const decision = await llm.invoke(`aggregate vote: ${llmInput}; return the final result from this voting as the decision`);
        EventBus.emit("final-report", { report: decision.content });
        return { ...state, decision: decision.content };
    };
}

export function constructVotingGraph(
    agents: Agent[],
    scene: any,
    tilemap: any,
    destination: any
) {
    const votingGraph = new StateGraph(VotingState);
    
    // 依次执行投票
    let previousNode = START;
    for (let i = 0; i < agents.length; i++) {
        const agentNode = agents[i].getName();
        votingGraph.addNode(agentNode, createVoter(agents[i], scene, tilemap, destination));
        votingGraph.addEdge(previousNode as any, agentNode);
        previousNode = agentNode;
    }

    // 投票结束后执行聚合
    votingGraph.addNode("aggregator", createAggregator() as any);
    votingGraph.addEdge(previousNode as any, "aggregator" as any);
    votingGraph.addEdge("aggregator" as any, END);

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
