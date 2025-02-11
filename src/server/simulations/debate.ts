import { Agent } from "../../sprites/Agent";
import { fetchChatCompletion } from "../server";

async function judgeDebate(messages: any) {
    let judgeResponse = await fetchChatCompletion([
      ...messages,
      { role: "user", content: "Judge, analyze the arguments and declare which agent made stronger points. Keep it brief." }
    ]);
  
    let verdict = judgeResponse.choices[0].message.content;
    console.log(`⚖️ Judge: ${verdict}\n`);
}

export async function debateWithJudging(
  topic: string, 
  rounds: number,
) {
    let messages = [
      { role: "system", content: `You are participating in a structured debate. 
        Agent A will support the topic: "${topic}", while Agent B will oppose it.
        Each response should be concise (maximum 3 sentences).` },
      { role: "user", content: `Agent A, start the debate by stating your main argument for: "${topic}".` }
    ];
  
    for (let i = 0; i < rounds; i++) {
      console.log(`\n🔵 Round ${i + 1}`);
  
      let responseA = await fetchChatCompletion(messages);
      let textA = responseA.choices[0].message.content;
      console.log(`Agent A: ${textA}\n`);
      messages.push({ role: "assistant", content: textA });
  
      let responseB = await fetchChatCompletion([
        ...messages,
        { role: "user", content: `Agent B, rebut Agent A's argument.` }
      ]);
      let textB = responseB.choices[0].message.content;
      console.log(`Agent B: ${textB}\n`);
      messages.push({ role: "assistant", content: textB });
  
      await judgeDebate(messages);
    }
  
    console.log("⚖️ Debate Ended.");
}