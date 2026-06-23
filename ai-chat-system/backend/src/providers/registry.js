import 'dotenv/config';
import { makeOpenAiCompatProvider } from './openAiCompatProvider.js';
import { makeGeminiProvider } from './geminiProvider.js';

const groq = makeOpenAiCompatProvider({
  name: 'groq',
  baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
  defaultModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
});

const gemini = makeGeminiProvider({
  baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: process.env.GEMINI_API_KEY,
  defaultModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
});

const kimi = makeOpenAiCompatProvider({
  name: 'kimi',
  baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
  apiKey: process.env.KIMI_API_KEY,
  defaultModel: process.env.KIMI_MODEL || 'moonshot-v1-128k',
});

export const providers = { groq, gemini, kimi };

// "auto" tries providers in this order, skipping unconfigured ones.
const AUTO_CHAIN = ['groq', 'gemini', 'kimi'];

export function resolveChain(model) {
  const key = (model || 'auto').toLowerCase();
  if (key === 'auto') {
    return AUTO_CHAIN.map((k) => providers[k]).filter((p) => p.isConfigured());
  }
  const p = providers[key];
  if (!p) throw new Error(`Unknown model "${model}". Use groq|gemini|kimi|auto.`);
  if (!p.isConfigured()) throw new Error(`Provider "${key}" is not configured (missing API key).`);
  return [p];
}

export function listModels() {
  return Object.values(providers)
    .map((p) => ({ id: p.name, configured: p.isConfigured() }))
    .concat([{ id: 'auto', configured: true }]);
}
