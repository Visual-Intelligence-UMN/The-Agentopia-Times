import axios from 'axios';

const openaiApiUrl = 'https://api.openai.com/v1/chat/completions'; 
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;


const apiClient = axios.create({
  baseURL: openaiApiUrl,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }
});


export const fetchChatCompletion = async (messages:any) => {
  try {
    const response = await apiClient.post('', {
      model: 'gpt-4o-mini', 
      messages, 
      temperature: 0.7, 
      max_tokens: 150 
    });

    return response.data;
  } catch (error) {
    console.error('error when requested to OpenAI API:', error);
    throw error;
  }
};