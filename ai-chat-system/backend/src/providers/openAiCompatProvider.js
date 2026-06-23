import { fetch } from 'undici';
import { readSse } from './sseReader.js';
import { startEvent, tokenEvent, doneEvent } from '../streamEvent.js';

// Shared adapter for OpenAI-compatible providers (Groq, Kimi/Moonshot).
// Both expose POST {baseUrl}/chat/completions with stream:true (SSE, OpenAI delta format).
export function makeOpenAiCompatProvider({ name, baseUrl, apiKey, defaultModel }) {
  return {
    name,
    isConfigured: () => Boolean(apiKey),

    // streaming generator -> StreamEvent
    async *stream({ messages, model, chatId, messageId, signal, temperature = 0.7 }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || defaultModel,
          messages,
          stream: true,
          temperature,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await safeText(res);
        throw new Error(`${name} HTTP ${res.status}: ${detail}`);
      }

      yield startEvent(chatId, messageId, name);

      for await (const data of readSse(res.body)) {
        if (data === '[DONE]') break;
        let json;
        try { json = JSON.parse(data); } catch { continue; }
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield tokenEvent(delta);
      }
      yield doneEvent('stop');
    },

    // non-streaming fallback
    async complete({ messages, model, signal, temperature = 0.7 }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || defaultModel,
          messages,
          stream: false,
          temperature,
        }),
      });
      if (!res.ok) throw new Error(`${name} HTTP ${res.status}: ${await safeText(res)}`);
      const json = await res.json();
      return json?.choices?.[0]?.message?.content ?? '';
    },
  };
}

async function safeText(res) {
  try { return (await res.text()).slice(0, 300); } catch { return '<no body>'; }
}
