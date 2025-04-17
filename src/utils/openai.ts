// src/utils/openai.ts

// export function getStoredOpenAIKey(): string | null {
//     // return localStorage.getItem('openai-api-key') || import.meta.env.VITE_OPENAI_API_KEY || null;
//     return localStorage.getItem('openai-api-key') || null;

//   }
  

let runtimeApiKey: string | null = null;

export function setStoredOpenAIKey(key: string) {
  runtimeApiKey = key;
  localStorage.setItem('openai-api-key', key);
}

export function clearStoredOpenAIKey() {
  runtimeApiKey = null;
  localStorage.removeItem('openai-api-key');
}

export function getStoredOpenAIKey(): string | null {
  if (runtimeApiKey) return runtimeApiKey;
  return localStorage.getItem('openai-api-key') || import.meta.env.VITE_OPENAI_API_KEY || null;
}
