import { fetch } from 'undici';
import { readSse } from './sseReader.js';
import { startEvent, tokenEvent, doneEvent } from '../streamEvent.js';

// Google Gemini adapter.
// Uses :streamGenerateContent?alt=sse  -> SSE frames of GenerateContentResponse.
// Normalizes Gemini's role/parts format to the unified StreamEvent shape.
export function makeGeminiProvider({ baseUrl, apiKey, defaultModel }) {
  const name = 'gemini';

  return {
    name,
    isConfigured: () => Boolean(apiKey),

    async *stream({ messages, model, chatId, messageId, signal, temperature = 0.7 }) {
      const m = model || defaultModel;
      const { contents, systemInstruction } = toGemini(messages);

      const url =
        `${baseUrl}/models/${m}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: { temperature },
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`gemini HTTP ${res.status}: ${await safeText(res)}`);
      }

      yield startEvent(chatId, messageId, name);

      for await (const data of readSse(res.body)) {
        let json;
        try { json = JSON.parse(data); } catch { continue; }
        const parts = json?.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          if (typeof p.text === 'string' && p.text.length) yield tokenEvent(p.text);
        }
      }
      yield doneEvent('stop');
    },

    async complete({ messages, model, signal, temperature = 0.7 }) {
      const m = model || defaultModel;
      const { contents, systemInstruction } = toGemini(messages);
      const url = `${baseUrl}/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, systemInstruction, generationConfig: { temperature } }),
      });
      if (!res.ok) throw new Error(`gemini HTTP ${res.status}: ${await safeText(res)}`);
      const json = await res.json();
      return json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    },
  };
}

// Convert OpenAI-style messages -> Gemini contents + systemInstruction.
function toGemini(messages) {
  let systemInstruction;
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { role: 'user', parts: [{ text: msg.content }] };
      continue;
    }
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  return { contents, systemInstruction };
}

async function safeText(res) {
  try { return (await res.text()).slice(0, 300); } catch { return '<no body>'; }
}
