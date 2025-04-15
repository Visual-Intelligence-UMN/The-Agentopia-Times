// src/utils/openai.ts

export function getStoredOpenAIKey(): string | null {
    return localStorage.getItem('openai-api-key') || import.meta.env.VITE_OPENAI_API_KEY || null;
  }
  