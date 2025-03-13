import axios from 'axios';
import { selector } from './templates';
import { extractXML } from './textProcessingUtils';

interface Message {
    role: string;
    content: string;
}

// call LLM API with messages and return the response.
export const callLLM = async (messages: Message[]) => {
  const openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const apiClient = axios.create({
    baseURL: openaiApiUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
  try {
    const response = await apiClient.post('', {
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.data;
  } catch (error) {
    console.error('error when requested to OpenAI API:', error);
    throw error;
  }
};

// Chain multiple LLM calls sequentially, passing results between steps.
export const chain = async (input: string, prompts: string[]) => {
    let result: string = input;
    for (const prompt of prompts) {
        try{
        const messages: Message[] = [
          {role: 'system', content: result}, 
          {role: 'user', content: prompt}
        ];
        const response = await callLLM(messages);
        result = response.choices[0].message.content;
        } catch (error) {
            console.error('error when requested to OpenAI API:', error);
            throw error;
        }
    }
    return result;
};

// Process multiple inputs concurrently with the same prompt.
export const parallel = async (prompt: string, inputs: string[], n_workers: number = 3) => {
    const tasks = inputs.map((input, i) => callLLM([{role: 'system', content: inputs[i]}, {role: 'user', content: prompt}]));
    const responses = await Promise.allSettled(tasks);
    return responses.map(response => {
        if (response.status === 'fulfilled') {
            return response.value.choices[0].message.content;
        } else {
            console.error('Error in parallel processing:', response.reason);
            return null;
        }
    });
};

// Route input to specialized prompt using content classification.
export const route = async (input: string, routes: Map<string, string>) => {
    console.log("available routes:", routes.keys());
    const selectorPrompt = selector(input, routes);
    console.log("Selector prompt:", selectorPrompt);

    try{
        const routeResponse = (await callLLM([{role: "user", content: selectorPrompt}])).choices[0].message.content;
        const reasoning = extractXML(routeResponse, 'reasoning');
        const routeKey = extractXML(routeResponse, 'selection').trim().toLowerCase();

        console.log("Intermediate steps:", routeResponse)

        console.log("Routing Analysis:");
        console.log(reasoning);
        console.log("\nSelected route:", routeKey);

        const selectedPrompt: string | undefined = routes.get(routeKey);
        if (!selectedPrompt) {
            throw new Error(`Route "${routeKey}" not found in available routes.`);
        }
        const result = (await callLLM([{role: "system", content: input}, {role: "user", content: selectedPrompt}])).choices[0].message.content;
        console.log("Final result:", result);
        return result;
    } catch (error) {
        console.error("Route selection failed:", error);
        return "[ERROR: Route selection failed]";
    }

};


// the judge agent for the Debate Design Pattern
async function judgeDebate(messages: any) {
    let judgeResponse = await callLLM([
      ...messages,
      { role: "user", content: "Judge, analyze the arguments and declare which agent made stronger points. Keep it brief." }
    ]);
  
    let verdict = judgeResponse.choices[0].message.content;
    console.log(`⚖️ Judge: ${verdict}\n`);
}

//  two agents debate a topic for a number of rounds, with a judge declaring the winner at the end.
export async function debate(topic: string, rounds: number){
    console.log("Debate Started!", topic, rounds);
    let messages = [
        { role: "system", content: `You are participating in a structured debate. 
          Agent A will support the topic: "${topic}", while Agent B will oppose it.
          Each response should be concise (maximum 2 sentences).` },
        { role: "user", content: `Agent A, start the debate by stating your main argument for: "${topic}".` }
    ];

    let history = [];
    let results = [];

    for (let i = 0; i < rounds; i++) {
          console.log(`\n🔵 Round ${i + 1}`);
      
          let responseA = await callLLM(messages);
          let textA = responseA.choices[0].message.content;
          console.log(`Agent A: ${textA}\n`);
          messages.push({ role: "assistant", content: textA });
      
          let responseB = await callLLM([
            ...messages,
            { role: "user", content: `Agent B, rebut Agent A's argument.` }
          ]);
          let textB = responseB.choices[0].message.content;
          console.log(`Agent B: ${textB}\n`);
          messages.push({ role: "assistant", content: textB });

          history.push({round: i+1, agentA: textA, agentB: textB});
      
          let result = await judgeDebate(messages);
          results.push(result);
    }
      
    console.log("⚖️ Debate Ended.");
    return {results: results, history: history};
}

