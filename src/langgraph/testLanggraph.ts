import { StateGraph, Annotation, START, END } from "@langchain/langgraph/web";
import { ChatOpenAI } from "@langchain/openai";
import { EventBus } from "../game/EventBus";

const llm = new ChatOpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    modelName: "gpt-4o-mini",
});

// Graph state
const StateAnnotation = Annotation.Root({
  topic: Annotation<string>,
  joke: Annotation<string>,
  improvedJoke: Annotation<string>,
  finalJoke: Annotation<string>,
});

// Define node functions

// First LLM call to generate initial joke
async function generateJoke(state: typeof StateAnnotation.State) {
  const msg = await llm.invoke(`Write a short joke about ${state.topic}`);
  return { joke: msg.content };
}

// Gate function to check if the joke has a punchline
function checkPunchline(state: typeof StateAnnotation.State) {
  // Simple check - does the joke contain "?" or "!"
  if (state.joke?.includes("?") || state.joke?.includes("!")) {
    return "Pass";
  }
  return "Fail";
}

  // Second LLM call to improve the joke
async function improveJoke(state: typeof StateAnnotation.State) {
  const msg = await llm.invoke(
    `Make this joke funnier by adding wordplay: ${state.joke}`
  );
  
  return { improvedJoke: msg.content };
}

// Third LLM call for final polish
async function polishJoke(state: typeof StateAnnotation.State) {
  const msg = await llm.invoke(
    `Add a surprising twist to this joke: ${state.improvedJoke}`
  );
  EventBus.emit("test-signal");
  return { finalJoke: msg.content };
}

// Build workflow
export const testGraphChain = new StateGraph(StateAnnotation)
.addNode("generateJoke", generateJoke)
  .addNode("improveJoke", improveJoke)
  .addNode("polishJoke", polishJoke)
  .addEdge(START,"generateJoke")  
  .addConditionalEdges("generateJoke", checkPunchline, {
    Pass: "improveJoke",
    Fail: "__end__"
  })
  .addEdge("improveJoke", "polishJoke")
  .addEdge("polishJoke", END)
  .compile();

// Invoke
// const state = await testGraphChain.invoke({ topic: "cats" });
// console.log("Initial joke:");
// console.log(state.joke);
// console.log("\n--- --- ---\n");
// if (state.improvedJoke !== undefined) {
//   console.log("Improved joke:");
//   console.log(state.improvedJoke);
//   console.log("\n--- --- ---\n");

//   console.log("Final joke:");
//   console.log(state.finalJoke);
// } else {
//   console.log("Joke failed quality gate - no punchline detected!");
// }