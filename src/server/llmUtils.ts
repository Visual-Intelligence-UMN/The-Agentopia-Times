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
        const messages: Message[] = [{role: 'system', content: result}, {role: 'user', content: prompt}];
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
    const tasks = inputs.map(input => callLLM([{role: 'user', content: input}]));
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
        return await callLLM([{role: "system", content: input}, {role: "user", content: selectedPrompt}]);
    } catch (error) {
        console.error("Route selection failed:", error);
        return "[ERROR: Route selection failed]";
    }

};

